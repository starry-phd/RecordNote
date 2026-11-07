import {ValidationError} from './core.js';
/**
 * Authenticated private audio playback with single-range streaming.
 * No R2 public URL, key, token, or object metadata is ever exposed in JSON.
 * The API does not promise DRM: authorized listeners can technically capture bytes.
 */
interface SqlStatement{
 bind(...args:(string|number)[]):SqlStatement;
 first<T>():Promise<T|null>;
}
export interface PlaybackDB{prepare(sql:string):SqlStatement}
interface AudioObject {size:number;body:ReadableStream<Uint8Array>}
export interface PlaybackStorage{
 head(key:string):Promise<{size:number}|null>;
 get(key:string,options?:{range:{offset:number;length:number}}):Promise<AudioObject|null>;
}
export type PlaybackDecision =
 |{type:'forbidden'}
 |{type:'unavailable'}
 |{type:'success';status:200|206;headers:Headers;body:ReadableStream<Uint8Array>|null}
 |{type:'range_error';headers:Headers};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function rangeFromHeader(value:string,total:number):
  {offset:number;length:number}|null{
 if(value.length>100||!/^bytes=(\d*)-(\d*)$/.test(value))return null;
 const m=/^bytes=(\d*)-(\d*)$/.exec(value)!;
 if(!m[1]&&!m[2])return null;
 if(!Number.isSafeInteger(total)||total<=0)return null;
 if(!m[1]){
  const suffix=Number(m[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return null;
  const offset=Math.max(0,total-suffix);
  return {offset,length:total-offset};
 }
 const start=Number(m[1]);
 if(!Number.isSafeInteger(start)||start>=total)return null;
 let last=total-1;
 if(m[2]){
  last=Number(m[2]);
  if(!Number.isSafeInteger(last)||last<start)return null;
  last=Math.min(last,total-1);
 }
 return {offset:start,length:last-start+1};
}
function sharedHeaders(){
 return new Headers({
  'Content-Type':'audio/mp4',
  'Content-Disposition':'inline',
  'Cache-Control':'private, no-store, max-age=0',
  'X-Content-Type-Options':'nosniff',
  'Cross-Origin-Resource-Policy':'same-origin',
  'Accept-Ranges':'bytes',
  'Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex, nofollow'
 });
}
export async function authorizedAudioPlayback(
 db:PlaybackDB,media:PlaybackStorage,options:{
  userId:string;recordingId:string;method:'GET'|'HEAD';rangeHeader:string|null
 }
):Promise<PlaybackDecision>{
 if(!options||typeof options.userId!=='string'||!options.userId||
 !UUID.test(options.recordingId)||!['GET','HEAD'].includes(options.method))
  throw new ValidationError('invalid audio playback request');
 // Single SQL query, requires valid owner OR unrevoked/nonexpired per-course VIEW grant.
 const row=await db.prepare(`SELECT r.verified_object_key AS object_key
   FROM recordings r JOIN courses c ON c.id=r.course_id
   WHERE r.id=? AND r.status='verified' AND r.verified_object_key IS NOT NULL
   AND c.deleted_at IS NULL AND (
       c.owner_user_id=?
       OR EXISTS(
         SELECT 1 FROM grants g
         WHERE g.course_id=c.id AND g.granted_user_id=?
         AND g.revoked_at IS NULL
         AND (g.expires_at IS NULL OR g.expires_at>CURRENT_TIMESTAMP)
       )
   )`).bind(options.recordingId,options.userId,options.userId)
  .first<{object_key:string}>();
 if(!row)return {type:'forbidden'};
 // Reject malformed or misplaced object metadata even if DB was accidentally corrupted.
 if(!/^verified\/[\w.-]{1,200}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.m4a$/i.test(row.object_key)
 || !row.object_key.includes('/'+options.recordingId+'/'))return {type:'unavailable'};
 const meta=await media.head(row.object_key);
 if(!meta||!Number.isSafeInteger(meta.size)||meta.size<=0)return {type:'unavailable'};
 const headers=sharedHeaders();
 headers.set('Content-Length',String(meta.size));
 let status:200|206=200,range:ReturnType<typeof rangeFromHeader>=null;
 if(options.rangeHeader!==null){
  range=rangeFromHeader(options.rangeHeader,meta.size);
  if(!range){
   headers.set('Content-Range','bytes */'+meta.size);
   headers.set('Content-Length','0');
   return {type:'range_error',headers};
  }
  status=206;
  headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${meta.size}`);
  headers.set('Content-Length',String(range.length));
 }
 if(options.method==='HEAD')return {type:'success',status,headers,body:null};
 const obj=await media.get(row.object_key,range?{range}:undefined);
 if(!obj)return {type:'unavailable'};
 return {type:'success',status,headers,body:obj.body};
}
