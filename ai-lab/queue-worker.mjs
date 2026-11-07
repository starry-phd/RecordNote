/** Internal-only AI consumer. Synthetic test data ONLY; never expose to real member requests. */
const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const DAILY_CAP_MICRO_USD=1_000_000;
export const DAILY_CALL_LIMIT=10;
export const JOB_ATTEMPT_LIMIT=2;
export function validJob(job){
 return Boolean(job&&typeof job==='object'&&job.type==='synthetic_text'&&
  typeof job.id==='string'&&/^synthetic-[A-Za-z0-9_-]{8,80}$/.test(job.id)&&
  typeof job.prompt==='string'&&job.prompt.length>0&&job.prompt.length<=120);
}
async function sha256(value){
 const bytes=new TextEncoder().encode(value);
 const result=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(result),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function processSyntheticJob(env,job,day){
 if(!validJob(job)||!/^\d{4}-\d{2}-\d{2}$/.test(day))return {status:'rejected'};
 // Same ID with changed payload can never silently reuse the previous charge.
 const digest=await sha256(JSON.stringify({type:job.type,prompt:job.prompt}));
 await env.DB.prepare(`INSERT INTO ai_lab_jobs(id,payload_hash,status,attempts)
 VALUES (?,?,'queued',0) ON CONFLICT(id) DO NOTHING`).bind(job.id,digest).run();
 const record=await env.DB.prepare('SELECT payload_hash,status,attempts FROM ai_lab_jobs WHERE id=?')
   .bind(job.id).first();
 if(!record||record.payload_hash!==digest)return {status:'rejected'};
 if(record.status==='succeeded')return {status:'already_succeeded'};
 // An AI response may have been saved just before the Worker crashed.
 // Repair the job state without invoking the paid model a second time.
 const saved=await env.DB.prepare("SELECT id FROM ai_synthetic_results WHERE id=? AND status='succeeded'")
  .bind(job.id).first();
 if(saved){
  await env.DB.prepare("UPDATE ai_lab_jobs SET status='succeeded' WHERE id=? AND payload_hash=?")
   .bind(job.id,digest).run();
  return {status:'already_succeeded'};
 }
 if(record.attempts>=JOB_ATTEMPT_LIMIT)return {status:'retry_exhausted'};
 // Claim one attempt atomically. A failed invocation uses its own reserved budget slot.
 const claim=await env.DB.prepare(`UPDATE ai_lab_jobs
   SET attempts=attempts+1,status='processing'
   WHERE id=? AND payload_hash=? AND status!='succeeded' AND attempts<?
   RETURNING attempts`).bind(job.id,digest,JOB_ATTEMPT_LIMIT).first();
 if(!claim)return {status:'retry_exhausted'};
 const reservationKey=job.id+':'+claim.attempts;
 const reservation=await env.DB.prepare(`INSERT INTO ai_daily_reservations
  (id,usage_day,job_id,model,estimated_micro_usd)
  SELECT ?,?,?,?,?
  WHERE (SELECT COUNT(*) FROM ai_daily_reservations WHERE usage_day=?) < ?
   AND (SELECT COALESCE(SUM(estimated_micro_usd),0)
    FROM ai_daily_reservations WHERE usage_day=?) + ? <= ?
  ON CONFLICT(job_id) DO NOTHING RETURNING id`).bind(
    crypto.randomUUID(),day,reservationKey,MODEL,40000,
    day,DAILY_CALL_LIMIT,day,40000,DAILY_CAP_MICRO_USD
  ).first();
 if(!reservation)return {status:'budget_exhausted'};
 const generated=await env.AI.run(MODEL,{
   messages:[{role:'system',content:'Summarize only this fictional engineering test note, briefly in Traditional Chinese.'},
   {role:'user',content:job.prompt}],
   max_tokens:90,temperature:0
 });
 const answer=generated?.response??generated?.choices?.[0]?.message?.content;
 if(typeof answer!=='string'||answer.length===0||answer.length>1000)throw Error('no usable model answer');
 await env.DB.prepare(`INSERT INTO ai_synthetic_results(id,answer,status)
  VALUES (?,?,?) ON CONFLICT(id) DO NOTHING`)
  .bind(job.id,answer,'succeeded').run();
 await env.DB.prepare("UPDATE ai_lab_jobs SET status='succeeded' WHERE id=? AND payload_hash=?")
  .bind(job.id,digest).run();
 return {status:'succeeded'};
}
export default {
 async fetch(){
  return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'}});
 },
 async queue(batch,env){
  const day=new Date().toISOString().slice(0,10);
  for(const msg of batch.messages){
   if(!validJob(msg.body)){msg.ack();continue;}
   try{
    const result=await processSyntheticJob(env,msg.body,day);
    if(['succeeded','already_succeeded','budget_exhausted','retry_exhausted','rejected'].includes(result.status))
      msg.ack();
    else msg.retry({delaySeconds:600});
   }catch{
    msg.retry({delaySeconds:600});
   }
  }
 }
};