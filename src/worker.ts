import {assertRecording,assertUploadSize,requireString,ValidationError} from './core';
import {verifyStarryToken,AuthenticationError} from './auth';
import {capabilities} from './capabilities';
import {listOwnedCourses,createOwnedCourse,renameOwnedCourse,protectOwnedCourse,touchOwnedCourse} from './course-service';
import {authorizedAudioPlayback} from './audio-playback';
/** Replace with generated Cloudflare Env types after verifying resource bindings. */
interface Env {
  STAR_ID_ISSUER:string;STAR_ID_AUDIENCE:string;STAR_ID_JWKS_URL:string;
  FEATURE_MEMBER_API?:string;FEATURE_AUDIO_UPLOAD?:string;FEATURE_SHARING?:string;
  DB:D1Database;MEDIA:R2Bucket;
}
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow',
  'permissions-policy':'microphone=(), camera=(), geolocation=()'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const error=(status:number,code:string)=>json({error:code},status);
async function bodyObject(req:Request):Promise<Record<string,unknown>>{
  if(!(req.headers.get('content-type')??'').startsWith('application/json'))throw new ValidationError('JSON required');
  if(Number(req.headers.get('content-length')??0)>10000)throw new ValidationError('JSON body too large');
  const raw=await req.text();
  if(raw.length>10000)throw new ValidationError('JSON body too large');
  let input:unknown;try{input=JSON.parse(raw);}catch{throw new ValidationError('invalid JSON');}
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ValidationError('expected object');
  return input as Record<string,unknown>;
}
async function member(req:Request,env:Env):Promise<string>{
  const m=/^Bearer (\S+)$/.exec(req.headers.get('authorization')??'');
  if(!m)throw new AuthenticationError();
  return verifyStarryToken(m[1],{issuer:env.STAR_ID_ISSUER,audience:env.STAR_ID_AUDIENCE,jwksUrl:env.STAR_ID_JWKS_URL});
}
async function owns(env:Env,userId:string,courseId:string):Promise<boolean>{
  return Boolean(await env.DB.prepare('SELECT 1 FROM courses WHERE id=? AND owner_user_id=? AND deleted_at IS NULL').bind(courseId,userId).first());
}
async function mayView(env:Env,userId:string,courseId:string):Promise<boolean>{
  if(await owns(env,userId,courseId))return true;
  return Boolean(await env.DB.prepare(`SELECT 1 FROM grants g JOIN courses c ON c.id=g.course_id
    WHERE g.course_id=? AND g.granted_user_id=? AND g.revoked_at IS NULL
      AND c.deleted_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>CURRENT_TIMESTAMP)`)
    .bind(courseId,userId).first());
}
async function handle(req:Request,env:Env):Promise<Response>{
  const url=new URL(req.url),path=url.pathname,method=req.method;
  if(method==='GET'&&path==='/api/health')return json({service:'starry-recorder',ready:false,state:'development'});
  if(method==='GET'&&path==='/api/capabilities')return json({features:capabilities(env)});
  if(!path.startsWith('/api/'))return error(404,'not_found');
  const features=capabilities(env);
  // No user records or private storage access before centrally verified identity is ready.
  if(!features.memberApi)return error(503,'identity_integration_pending');
  const origin=req.headers.get('origin');
  if(origin&&origin!==url.origin)return error(403,'cross_origin_denied');
  const userId=await member(req,env);
  await env.DB.prepare('INSERT OR IGNORE INTO members(user_id) VALUES (?)').bind(userId).run();
  if(method==='GET'&&path==='/api/me'){
    const row=await env.DB.prepare('SELECT plan,used_bytes,reserved_bytes,free_trial_seconds_used FROM members WHERE user_id=?').bind(userId).first();
    return json({member:row});
  }
  if(method==='GET'&&path==='/api/courses'){
    return json({courses:await listOwnedCourses(env.DB,userId)});
  }
  if(method==='POST'&&path==='/api/courses'){
    const data=await bodyObject(req);
    return json({course:await createOwnedCourse(env.DB,userId,data.title)},201);
  }
  // Owner writes are always checked again by the SQL statement itself.
  // Shared readers never acquire edit/protection rights.
  const rename=/^\/api\/courses\/([0-9a-f-]{36})$/.exec(path);
  if(rename&&method==='PATCH'){
    const data=await bodyObject(req);
    const changed=await renameOwnedCourse(env.DB,userId,rename[1],data.title);
    return changed?json({course:changed}):error(404,'not_found');
  }
  const protect=/^\/api\/courses\/([0-9a-f-]{36})\/protection$/.exec(path);
  if(protect&&method==='PUT'){
    const data=await bodyObject(req);
    const changed=await protectOwnedCourse(env.DB,userId,protect[1],data.pinned);
    return changed?json({course:changed}):error(404,'not_found');
  }
  const view=/^\/api\/courses\/([0-9a-f-]{36})\/view$/.exec(path);
  if(view&&method==='POST'){
    return await touchOwnedCourse(env.DB,userId,view[1])
      ?new Response(null,{status:204,headers}):error(404,'not_found');
  }
  const course=/^\/api\/courses\/([0-9a-f-]{36})$/.exec(path);
  if(course&&method==='GET'){
    if(!await mayView(env,userId,course[1]))return error(404,'not_found');
    const info=await env.DB.prepare('SELECT id,title,created_at FROM courses WHERE id=? AND deleted_at IS NULL').bind(course[1]).first();
    return info?json({course:info}):error(404,'not_found');
  }
  const rec=/^\/api\/courses\/([0-9a-f-]{36})\/recordings$/.exec(path);
  if(rec&&method==='GET'){
    if(!await mayView(env,userId,rec[1]))return error(404,'not_found');
    const result=await env.DB.prepare("SELECT id,slot,title,duration_seconds,status FROM recordings WHERE course_id=? AND status!='deleted' ORDER BY slot").bind(rec[1]).all();
    return json({recordings:result.results});
  }
  if(rec&&method==='POST'){
    if(!await owns(env,userId,rec[1]))return error(404,'not_found');
    const body=await bodyObject(req),{durationSeconds,slot}=assertRecording({durationSeconds:body.durationSeconds,slot:body.slot});
    const title=requireString(body.title,'title',120),id=crypto.randomUUID();
    try{
      await env.DB.prepare('INSERT INTO recordings(id,course_id,slot,title,duration_seconds) VALUES (?,?,?,?,?)').bind(id,rec[1],slot,title,durationSeconds).run();
    }catch{return error(409,'slot_already_used');}
    return json({id,slot,title,durationSeconds,status:'pending'},201);
  }
  const playback=/^\/api\/recordings\/([0-9a-f-]{36})\/play$/.exec(path);
  if(playback&&(method==='GET'||method==='HEAD')){
    const found=await authorizedAudioPlayback(env.DB,{
      head:key=>env.MEDIA.head(key),
      get:async(key,options)=>{
        const object=await env.MEDIA.get(key,options);
        if(!object||!('body' in object))return null;
        return {size:object.size,body:object.body};
      }
    },{userId,recordingId:playback[1],method,rangeHeader:req.headers.get('range')});
    if(found.type==='forbidden'||found.type==='unavailable')return error(404,'not_found');
    if(found.type==='range_error')return new Response(null,{status:416,headers:found.headers});
    return new Response(found.body,{status:found.status,headers:found.headers});
  }
  const upload=/^\/api\/recordings\/([0-9a-f-]{36})\/audio$/.exec(path);
  if(upload&&method==='PUT'){
    if(!features.audioUpload)return error(503,'audio_pipeline_not_ready');
    // Stored in nonpublic quarantine ONLY. Never promote until server-side AAC/M4A checks exist.
    const size=assertUploadSize(Number(req.headers.get('content-length')));
    if(req.headers.get('content-type')!=='audio/mp4')return error(415,'m4a_required');
    if(!req.body)return error(400,'empty_upload');
    const row=await env.DB.prepare(`SELECT r.id,r.status FROM recordings r JOIN courses c ON c.id=r.course_id
       WHERE r.id=? AND c.owner_user_id=? AND c.deleted_at IS NULL`).bind(upload[1],userId).first<{id:string;status:string}>();
    if(!row)return error(404,'not_found');
    if(row.status!=='pending')return error(409,'upload_not_pending');
    const reserve=await env.DB.prepare(`UPDATE members SET reserved_bytes=reserved_bytes+? WHERE user_id=?
      AND used_bytes+reserved_bytes+? <= CASE plan WHEN 'professional' THEN 100000000000
      WHEN 'standard' THEN 20000000000 ELSE 1000000000 END`).bind(size,userId,size).run();
    if(reserve.meta.changes!==1)return error(409,'storage_quota_exceeded');
    const key=`quarantine/${userId}/${row.id}/${crypto.randomUUID()}.m4a`;
    const claim=await env.DB.prepare("UPDATE recordings SET status='uploading',staging_object_key=? WHERE id=? AND status='pending'").bind(key,row.id).run();
    if(claim.meta.changes!==1){
      await env.DB.prepare('UPDATE members SET reserved_bytes=MAX(0,reserved_bytes-?) WHERE user_id=?').bind(size,userId).run();
      return error(409,'upload_conflict');
    }
    try{
      await env.MEDIA.put(key,req.body,{httpMetadata:{contentType:'audio/mp4'}});
      await env.DB.batch([
        env.DB.prepare("UPDATE recordings SET status='quarantine',bytes=? WHERE id=? AND status='uploading'").bind(size,row.id),
        env.DB.prepare('UPDATE members SET reserved_bytes=MAX(0,reserved_bytes-?),used_bytes=used_bytes+? WHERE user_id=?').bind(size,size,userId)
      ]);
      return json({recordingId:row.id,status:'quarantine'},202);
    }catch{
      await env.DB.batch([
        env.DB.prepare("UPDATE recordings SET status='failed' WHERE id=? AND status='uploading'").bind(row.id),
        env.DB.prepare('UPDATE members SET reserved_bytes=MAX(0,reserved_bytes-?) WHERE user_id=?').bind(size,userId)
      ]);
      return error(503,'upload_failed_retry_later');
    }
  }
  const share=/^\/api\/courses\/([0-9a-f-]{36})\/shares$/.exec(path);
  if(share&&method==='POST'){
    if(!features.sharing)return error(503,'sharing_not_ready');
    if(!await owns(env,userId,share[1]))return error(404,'not_found');
    const body=await bodyObject(req),recipient=requireString(body.recipientUserId,'recipientUserId',200);
    if(recipient===userId)return error(400,'self_share_forbidden');
    if(typeof body.allowDownload!=='boolean'||typeof body.allowAI!=='boolean')return error(400,'invalid_permissions');
    const expires=new Date(Date.now()+30*86400000).toISOString().replace('T',' ').slice(0,19);
    await env.DB.prepare(`INSERT INTO grants(id,course_id,granted_user_id,allow_download,allow_ai,expires_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(course_id,granted_user_id) DO UPDATE SET
      allow_download=excluded.allow_download,allow_ai=excluded.allow_ai,expires_at=excluded.expires_at,revoked_at=NULL`)
      .bind(crypto.randomUUID(),share[1],recipient,Number(body.allowDownload),Number(body.allowAI),expires).run();
    return json({recipientUserId:recipient,expiresAt:expires},201);
  }
  if(path.startsWith('/api/billing')||path.startsWith('/api/transcribe')||path.startsWith('/api/ask'))
    return error(501,'not_yet_implemented');
  return error(404,'not_found');
}
export default{
  async fetch(req:Request,env:Env):Promise<Response>{
    try{return await handle(req,env);}
    catch(e){
      if(e instanceof AuthenticationError)return error(401,'authentication_required');
      if(e instanceof ValidationError)return error(400,e.message);
      console.error('starry-recorder-api-failure',{kind:e instanceof Error?e.name:'unknown'});
      return error(500,'internal_error');
    }
  }
};
