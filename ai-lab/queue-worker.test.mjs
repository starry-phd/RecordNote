import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{validJob,processSyntheticJob,JOB_ATTEMPT_LIMIT} from './queue-worker.mjs';

const good={type:'synthetic_text',id:'synthetic-abcdefgh',prompt:'Water matters.'};
function fixture({budgetLimit=10,failedInvocations=0}={}){
 const state={jobs:new Map(),reservations:new Map(),results:new Map(),modelCalls:0,events:[],failedInvocations};
 const db={prepare(sql){
  let args;
  return {bind(...values){args=values;return this;},
   async run(){
    if(sql.includes('INSERT INTO ai_lab_jobs')){
     const [id,payload_hash]=args;
     if(!state.jobs.has(id))state.jobs.set(id,{payload_hash,status:'queued',attempts:0});
    }else if(sql.includes('INSERT INTO ai_synthetic_results')){
     const [id,answer,status]=args;
     if(!state.results.has(id))state.results.set(id,{answer,status});
    }else if(sql.includes("UPDATE ai_lab_jobs SET status='succeeded'")){
     const [id,digest]=args;const job=state.jobs.get(id);
     if(job?.payload_hash===digest)job.status='succeeded';
    }else throw Error('unexpected run '+sql);
    return {meta:{changes:1}};
   },
   async first(){
    if(sql.startsWith('SELECT payload_hash,status,attempts FROM ai_lab_jobs')){
     return state.jobs.get(args[0])??null;
    }
    if(sql.startsWith('SELECT id FROM ai_synthetic_results')){
     return state.results.has(args[0])?{id:args[0]}:null;
    }
    if(sql.includes('UPDATE ai_lab_jobs')&&sql.includes('RETURNING attempts')){
     const [id,digest,cap]=args,job=state.jobs.get(id);
     if(!job||job.payload_hash!==digest||job.status==='succeeded'||job.attempts>=cap)return null;
     job.attempts++;job.status='processing';return {attempts:job.attempts};
    }
    if(sql.includes('INSERT INTO ai_daily_reservations')){
     const [id,day,attemptKey,model,amount,,, , , , ,]=args;
     if(state.reservations.size>=budgetLimit||state.reservations.has(attemptKey))return null;
     state.reservations.set(attemptKey,{day,amount});state.events.push('reserved');return {id};
    }
    throw Error('unexpected first '+sql);
   }
  };
 }};
 const ai={async run(model,payload){
  state.modelCalls++;state.events.push('ai_called');
  if(state.modelCalls<=state.failedInvocations)throw Error('transient AI outage');
  return {response:'水很重要'};
 }};
 return {env:{DB:db,AI:ai},state};
}
test('public AI worker rejects every unauthenticated HTTP request',async()=>{
 const r=await worker.fetch(new Request('https://invalid.example/ai?prompt=hello'),{AI:{async run(){throw Error('unreachable')}}});
 assert.equal(r.status,404);
});
test('reject any real member job or oversized synthetic input',()=>{
 assert.equal(validJob(good),true);
 for(const data of [
  {...good,type:'real_user'},
  {...good,id:'user-real-member'},
  {...good,prompt:'a'.repeat(121)}
 ])assert.equal(validJob(data),false);
});
test('successful job is persisted once and a retry never uses AI again',async()=>{
 const f=fixture();
 const out=await processSyntheticJob(f.env,good,'2026-10-24');
 assert.equal(out.status,'succeeded');assert.equal(f.state.modelCalls,1);
 assert.deepEqual(f.state.events,['reserved','ai_called']);
 const dupe=await processSyntheticJob(f.env,good,'2026-10-24');
 assert.equal(dupe.status,'already_succeeded');
 assert.equal(f.state.modelCalls,1);
 assert.equal(f.state.reservations.size,1);
 assert.equal(f.state.results.size,1);
});
test('changed prompt with same work ID is rejected without extra charge',async()=>{
 const f=fixture();
 await processSyntheticJob(f.env,good,'2026-10-24');
 const changed=await processSyntheticJob(f.env,{...good,prompt:'New forbidden content.'},'2026-10-24');
 assert.equal(changed.status,'rejected');assert.equal(f.state.modelCalls,1);
 assert.equal(f.state.reservations.size,1);
});
test('transient AI failure allows a bounded second attempt and reserves its actual cost',async()=>{
 const f=fixture({failedInvocations:1});
 await assert.rejects(processSyntheticJob(f.env,good,'2026-10-24'),/transient AI outage/);
 assert.equal(f.state.modelCalls,1);
 assert.equal((await processSyntheticJob(f.env,good,'2026-10-24')).status,'succeeded');
 assert.equal(f.state.reservations.size,2);assert.equal(f.state.modelCalls,2);
});
test('two failures exhaust retry limit instead of infinite AI calls',async()=>{
 const f=fixture({failedInvocations:3});
 for(let i=0;i<JOB_ATTEMPT_LIMIT;i++)
  await assert.rejects(processSyntheticJob(f.env,good,'2026-10-24'),/transient AI outage/);
 assert.equal((await processSyntheticJob(f.env,good,'2026-10-24')).status,'retry_exhausted');
 assert.equal(f.state.modelCalls,JOB_ATTEMPT_LIMIT);
});
test('exhausted daily budget blocks AI without evading limits',async()=>{
 const f=fixture({budgetLimit:0});
 assert.equal((await processSyntheticJob(f.env,good,'2026-10-24')).status,'budget_exhausted');
 assert.equal(f.state.modelCalls,0);
});
test('reject malformed job without D1 access',async()=>{
 const result=await processSyntheticJob({DB:{prepare(){throw Error('db touched')}}},{id:'invalid'},'2026-10-24');
 assert.equal(result.status,'rejected');
});

test('crash after response storage but before job completion recovers without second AI cost',async()=>{
 const f=fixture();
 assert.equal((await processSyntheticJob(f.env,good,'2026-10-24')).status,'succeeded');
 const record=f.state.jobs.get(good.id);
 record.status='processing'; // simulate database status write interruption after result persisted
 const recovered=await processSyntheticJob(f.env,good,'2026-10-24');
 assert.equal(recovered.status,'already_succeeded');
 assert.equal(f.state.modelCalls,1);
 assert.equal(f.state.reservations.size,1);
 assert.equal(f.state.jobs.get(good.id).status,'succeeded');
});
