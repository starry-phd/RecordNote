import {ValidationError} from './core.js';
import {verifyMediaProbe,type MediaProbe,type VerifiedAudio} from './audio-verify.js';

/**
 * Audio promotion is a private, trusted backend job step; it is NOT an HTTP endpoint.
 * Probe MUST come from server-side ffprobe over the same quarantined R2 object,
 * never from a caller-supplied JSON value.
 * This module does not invoke ffprobe itself or enable public upload.
 */
interface Statement{
 bind(...args:(string|number)[]):Statement;
 first<T>():Promise<T|null>;
 run():Promise<{meta:{changes:number}}>;
}
export interface PromotionDB{prepare(sql:string):Statement}
interface R2Body {body:ReadableStream<Uint8Array>;size:number}
export interface PrivateAudioBucket{
 get(key:string):Promise<R2Body|null>;
 put(key:string,data:ReadableStream<Uint8Array>,opts:{httpMetadata:{contentType:string}}):Promise<unknown>;
 delete(key:string):Promise<void>;
}
export interface PromotionRequest {
 ownerUserId:string;recordingId:string;
 trustedProbe:MediaProbe;
}
interface RecordingRow {status:string;staging_object_key:string|null;duration_seconds:number;bytes:number}
export type PromotionOutcome=
 |{status:'verified';recordingId:string;verified:VerifiedAudio}
 |{status:'already_verified';recordingId:string}
 |{status:'not_found'|'not_ready'|'missing_staging_object';recordingId:string};

export async function promoteTrustedAudio(
 db:PromotionDB,storage:PrivateAudioBucket,job:PromotionRequest
):Promise<PromotionOutcome>{
 if(!job||typeof job.ownerUserId!=='string'||job.ownerUserId.length<1||job.ownerUserId.length>200||
    typeof job.recordingId!=='string'||!/^[0-9a-f-]{36}$/i.test(job.recordingId))
  throw new ValidationError('invalid private promotion job');
 const rec=await db.prepare(`SELECT r.status,r.staging_object_key,r.duration_seconds,r.bytes
   FROM recordings r JOIN courses c ON r.course_id=c.id
   WHERE r.id=? AND c.owner_user_id=? AND c.deleted_at IS NULL`)
  .bind(job.recordingId,job.ownerUserId).first<RecordingRow>();
 if(!rec)return {status:'not_found',recordingId:job.recordingId};
 if(rec.status==='verified')return {status:'already_verified',recordingId:job.recordingId};
 if(rec.status!=='quarantine')return {status:'not_ready',recordingId:job.recordingId};
 const prefix='quarantine/'+job.ownerUserId+'/'+job.recordingId+'/';
 if(!rec.staging_object_key||!rec.staging_object_key.startsWith(prefix))
  throw new ValidationError('quarantine object ownership mismatch');
 const verified=verifyMediaProbe(job.trustedProbe);
 if(Math.abs(verified.durationSeconds-rec.duration_seconds)>5)
  throw new ValidationError('measured duration differs from recorded metadata');
 if(verified.bytes!==rec.bytes)
  throw new ValidationError('measured bytes differ from reserved bytes');
 const source=await storage.get(rec.staging_object_key);
 if(!source)return {status:'missing_staging_object',recordingId:job.recordingId};
 if(source.size!==verified.bytes)throw new ValidationError('media probe does not match R2 object size');
 const dest='verified/'+job.ownerUserId+'/'+job.recordingId+'/'+crypto.randomUUID()+'.m4a';
 // R2 object key never comes from user text; destination is unique and private.
 await storage.put(dest,source.body,{httpMetadata:{contentType:'audio/mp4'}});
 let acknowledged=false;
 try{
  const update=await db.prepare(`UPDATE recordings SET
    verified_object_key=?,status='verified',staging_object_key=NULL
    WHERE id=? AND status='quarantine' AND staging_object_key=?
    AND EXISTS(SELECT 1 FROM courses
      WHERE id=recordings.course_id AND owner_user_id=? AND deleted_at IS NULL)`)
   .bind(dest,job.recordingId,rec.staging_object_key,job.ownerUserId).run();
  acknowledged=update.meta.changes===1;
 }finally{
  if(!acknowledged){
   // A race, revoked ownership or DB outage must not orphan a visible verified object.
   try{await storage.delete(dest);}catch{/* private orphan cleanup job will retry */}
  }
 }
 if(!acknowledged)return {status:'not_ready',recordingId:job.recordingId};
 // Quarantine deletion is best-effort *after* DB CAS commit. Failure only leaves an inaccessible orphan.
 try{await storage.delete(rec.staging_object_key);}catch{/* enqueue purge in future durable cleanup */}
 return {status:'verified',recordingId:job.recordingId,verified};
}
