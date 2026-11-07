import {LIMITS,ValidationError} from './core.js';

/** Trusted internal job output. The browser must never call this function with raw AI text. */
export interface TranscriptSegmentInput {
  index:number;startMs:number;endMs:number;text:string;speaker?:string|null;
}
interface Statement{
 bind(...values:(string|number|null)[]):Statement;
 first<T>():Promise<T|null>;
 all<T>():Promise<{results:T[]}>;
}
export interface TranscriptDB{
 prepare(sql:string):Statement;
 batch(statements:Statement[]):Promise<Array<{results:Array<{id:string}>}>>;
}
export interface TranscriptEntry {
 id:string;recording_id:string;start_ms:number;end_ms:number;speaker:string|null;
 text:string;revision:number;
}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function checkIds(userId:string,recordingId:string):void{
 if(typeof userId!=='string'||userId.length<1||userId.length>200||/\s/.test(userId))
  throw new ValidationError('invalid verified member identity');
 if(typeof recordingId!=='string'||!UUID.test(recordingId))
  throw new ValidationError('invalid recording ID');
}
function cleanSegments(segments:TranscriptSegmentInput[]):TranscriptSegmentInput[]{
 if(!Array.isArray(segments)||segments.length===0||segments.length>100)
  throw new ValidationError('invalid transcript chunk size');
 const seen=new Set<number>();
 return segments.map(s=>{
  if(!s||!Number.isInteger(s.index)||s.index<0||s.index>9999||seen.has(s.index))
   throw new ValidationError('duplicate or invalid segment index');
  seen.add(s.index);
  if(!Number.isSafeInteger(s.startMs)||!Number.isSafeInteger(s.endMs)||
    s.startMs<0||s.endMs<=s.startMs||s.endMs>LIMITS.maxRecordingSeconds*1000)
   throw new ValidationError('invalid transcript timestamp');
  if(typeof s.text!=='string'||!s.text.trim()||s.text.length>5000)
   throw new ValidationError('invalid transcript text');
  if(s.speaker!==null&&s.speaker!==undefined&&
    (typeof s.speaker!=='string'||!/^speaker_[1-9][0-9]{0,2}$/.test(s.speaker)))
    throw new ValidationError('invalid speaker; Whisper alone must not invent speaker IDs');
  return {...s,text:s.text.trim(),speaker:s.speaker??null};
 });
}
/**
 * Only previously verified recordings may receive transcripts.
 * Every INSERT itself repeats owner and verified-status checks to prevent TOCTOU races.
 * Cloudflare D1 batch provides transactionality for all segments in one chunk.
 */
export async function saveVerifiedTranscript(db:TranscriptDB,input:{
 ownerUserId:string;recordingId:string;sourceJobId:string;
 segments:TranscriptSegmentInput[];
}):Promise<{written:number;attempted:number}>{
 if(!input)throw new ValidationError('missing transcript job');
 checkIds(input.ownerUserId,input.recordingId);
 if(typeof input.sourceJobId!=='string'||!UUID.test(input.sourceJobId))
  throw new ValidationError('invalid internal transcription job ID');
 const segments=cleanSegments(input.segments);
 const permission=await db.prepare(`SELECT r.id FROM recordings r
 JOIN courses c ON c.id=r.course_id
 WHERE r.id=? AND r.status='verified' AND r.verified_object_key IS NOT NULL
 AND c.owner_user_id=? AND c.deleted_at IS NULL`)
 .bind(input.recordingId,input.ownerUserId).first<{id:string}>();
 if(!permission)throw new ValidationError('recording not verified or owner is unauthorized');
 const sql=`INSERT INTO transcript_segments(
   id,recording_id,start_ms,end_ms,speaker,text,revision,source_job_id,chunk_index)
 SELECT ?,r.id,?,?,?,?,1,?,? FROM recordings r
 JOIN courses c ON c.id=r.course_id
 WHERE r.id=? AND c.owner_user_id=? AND c.deleted_at IS NULL
 AND r.status='verified' AND r.verified_object_key IS NOT NULL
 ON CONFLICT(recording_id,source_job_id,chunk_index) DO NOTHING RETURNING id`;
 const statements=segments.map(s=>db.prepare(sql).bind(
  crypto.randomUUID(),s.startMs,s.endMs,s.speaker??null,s.text,
  input.sourceJobId,s.index,input.recordingId,input.ownerUserId
 ));
 const rows=await db.batch(statements);
 return {written:rows.reduce((sum,x)=>sum+(x.results?.length??0),0),attempted:segments.length};
}
/** Sharing grants allow read-only transcript viewing; separate AI rights are required for new AI processing. */
export async function readAuthorizedTranscript(db:TranscriptDB,userId:string,recordingId:string):Promise<TranscriptEntry[]>{
 checkIds(userId,recordingId);
 const r=await db.prepare(`SELECT t.id,t.recording_id,t.start_ms,t.end_ms,t.speaker,t.text,t.revision
 FROM transcript_segments t JOIN recordings r ON r.id=t.recording_id
 JOIN courses c ON c.id=r.course_id
 WHERE r.id=? AND c.deleted_at IS NULL AND r.status='verified'
 AND (c.owner_user_id=? OR EXISTS(
  SELECT 1 FROM grants g WHERE g.course_id=c.id AND g.granted_user_id=?
  AND g.revoked_at IS NULL
  AND (g.expires_at IS NULL OR g.expires_at>CURRENT_TIMESTAMP)
 ))
 ORDER BY t.start_ms ASC,t.chunk_index ASC LIMIT 1200`)
 .bind(recordingId,userId,userId).all<TranscriptEntry>();
 return r.results;
}
