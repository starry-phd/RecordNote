import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const worker=readFileSync(new URL('../cloudflare-candidate/recordnote-worker.js',import.meta.url),'utf8');
const frontend=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const start=worker.indexOf('export const RN_AI_TASKS='),end=worker.indexOf('function toBase64(',start);
assert.ok(start>0&&end>start);
const contract=worker.slice(start,end).replace('export const RN_AI_TASKS=','const RN_AI_TASKS=');
const valid={
 tasks:{
  summary:{label:'AI 課程摘要',description:'摘要',units:2},
  question:{label:'AI 問答',description:'問答',units:3},
  transcribe:{label:'AI 逐字稿',description:'轉文字',units:4}
 }
};
const key='unit-test-service-key-not-a-real-secret-123456789';
function harness({response=async()=>({ok:true,status:201,json:async()=>({reservation_id:'reservation-1'})}),secret=key}={}){
 const calls=[];
 const ctx=createContext({
  URL,AbortSignal,JSON,Date,WeakMap,Math,Error,Number,RegExp,String,Promise,
  encodeURIComponent,console:{warn:()=>{},error:()=>{}},
  fetch:async(url,options)=>{calls.push({url:String(url),options});return response(url,options);},
  fail:(code,status)=>({code,status})
 });
 runInContext(contract,ctx);
 const env={STARRY_ID_BASE:'https://id.starry.phd',
  AI_ENABLED:'true',AI_BILLING_MODE:'free-limited',
  AI:{run:async()=>{throw Error('must not run during Battery checks')}},
  STARRY_BATTERY_KEY:secret};
 const exec=(expr)=>runInContext(expr,ctx);
 return {ctx,env,calls,exec};
}
test('Task definitions stay recordnote scoped and policy requires Owner-approved integer 1..100',()=>{
 const h=harness();
 assert.equal(h.exec('validAiBatteryPricing('+JSON.stringify(valid)+')'),true);
 for(const changed of [0,101,1.5,-1]){
  const obj=structuredClone(valid);obj.tasks.summary.units=changed;
  assert.equal(h.exec('validAiBatteryPricing('+JSON.stringify(obj)+')'),false);
 }
 assert.equal(h.exec('RN_AI_TASKS.transcribe.task_type'),'recordnote.transcribe');
 assert.equal(h.exec('RN_AI_TASKS.question.task_type'),'recordnote.question');
 assert.equal(h.exec('RN_AI_TASKS.summary.task_type'),'recordnote.summary');
});
test('AI without central App secret fails closed before provider or balance use',async()=>{
 const h=harness({secret:undefined});
 delete h.env.STARRY_BATTERY_KEY;
 h.ctx.env=h.env;
 const enabled=h.exec('aiEnabled(env)');
 assert.equal(enabled,false);
 const result=await h.exec('beginAiTask(env,{headers:{get:()=>null}},"summary")');
 assert.deepEqual({code:result.error.code,status:result.error.status},{code:'BATTERY_NOT_CONFIGURED',status:503});
 assert.equal(h.calls.length,0);
});
test('Reserve uses member Bearer and server-only App key; 201, scoped task & idempotency',async()=>{
 const h=harness();h.ctx.env=h.env;h.ctx.pricing=valid.tasks;
 const result=await h.exec('reserveAiBattery(env,"Bearer test_member_token","summary",pricing,"test-123456789")');
 assert.equal(result.ok,true);
 assert.equal(result.id,'reservation-1');
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].url,'https://id.starry.phd/v1/battery/reservations');
 assert.equal(h.calls[0].options.headers.Authorization,'Bearer test_member_token');
 assert.equal(h.calls[0].options.headers['x-starry-app-key'],key);
 const sent=JSON.parse(h.calls[0].options.body);
 assert.deepEqual(sent,{task_type:'recordnote.summary',task_label:'AI 課程摘要',units:2,idempotency_key:'test-123456789'});
});
test('Repeated idempotency key refuses running the model twice',async()=>{
 const h=harness({response:async()=>({ok:true,status:200,json:async()=>({reservation_id:'reservation-1',replayed:true})})});
 h.ctx.env=h.env;h.ctx.pricing=valid.tasks;
 const result=await h.exec('reserveAiBattery(env,"Bearer member","question",pricing,"same-key-1234")');
 assert.equal(result.ok,false);
 assert.equal(result.status,409);
 assert.equal(result.code,'AI_TASK_ALREADY_RESERVED');
});
test('Central service/network failure returns a controlled 503 and no AI model call',async()=>{
 const h=harness({response:async()=>{throw Error('central offline')}});
 h.ctx.env=h.env;h.ctx.pricing=valid.tasks;
 const result=await h.exec('reserveAiBattery(env,"Bearer member","transcribe",pricing,"call-12345678")');
 assert.equal(result.ok,false);
 assert.equal(result.status,503);
 assert.equal(result.code,'BATTERY_UNAVAILABLE');
});
test('Commit and release use the App-scoped key and are not sent to a different host',async()=>{
 const h=harness({response:async()=>({ok:true,status:200,json:async()=>({status:'committed'})})});
 h.ctx.env=h.env;
 assert.equal(await h.exec("finishAiBattery(env,'res_42','commit')"),true);
 assert.equal(await h.exec("finishAiBattery(env,'res_42','release')"),true);
 assert.equal(h.calls[0].url,'https://id.starry.phd/v1/battery/reservations/res_42/commit');
 assert.equal(h.calls[1].url,'https://id.starry.phd/v1/battery/reservations/res_42/release');
});
test('Only verified Starry ID staff_role owner can edit AI prices',()=>{
 const h=harness();
 const req={};
 h.ctx.req=req;
 assert.equal(h.exec("isCentralOwner(req,'member-1')"),false);
 h.exec("verifiedCentralIdentity.set(req,{user_id:'member-1',staff_role:'admin'})");
 assert.equal(h.exec("isCentralOwner(req,'member-1')"),false);
 h.exec("verifiedCentralIdentity.set(req,{user_id:'member-1',staff_role:'owner'})");
 assert.equal(h.exec("isCentralOwner(req,'member-1')"),true);
 assert.equal(h.exec("isCentralOwner(req,'member-2')"),false);
});
test('Every AI model path has Battery reserve, commit and release; never runs unbilled',()=>{
 for(const [current,next,task] of [
  ['async function aiSummary(','async function aiQuestion(','summary'] ,
  ['async function aiQuestion(','async function aiTranscribe(','question'] ,
  ['async function aiTranscribe(','async function principal(','transcribe')
 ]){
  const i=worker.indexOf(current),j=worker.indexOf(next,i);
  assert.ok(i>=0&&j>i);
  const part=worker.slice(i,j);
  assert.ok(part.includes("beginAiTask(env,req,'"+task+"')"));
  assert.ok(part.indexOf('beginAiTask(env,req,')<part.indexOf('await aiCall(')||task==='transcribe');
  assert.ok(part.includes("finishAiBattery(env,battery.reservationId,'commit')"));
  assert.ok(part.includes("finishAiBattery(env,battery.reservationId,'release')"));
  assert.ok(part.includes('await quotaRefund(env,quota)'));
 }
 assert.ok(worker.includes("p==='/v1/admin/ai-battery-policy'&&method==='PUT'"));
 assert.ok(worker.includes("if(!isCentralOwner(req,user))return fail('FORBIDDEN',403)"));
 assert.ok(worker.includes('rn_ai_battery_policy_audit'));
});
test('Browser never receives the service key and AI summary sends a fresh idempotency identifier',()=>{
 assert.ok(!frontend.includes('STARRY_BATTERY_KEY'));
 assert.ok(frontend.includes("'X-RecordNote-AI-Idempotency-Key':crypto.randomUUID()"));
 assert.ok(frontend.includes("id=\"aiBatteryPricingForm\""));
 assert.ok(frontend.includes("state.aiBatteryPolicy?.can_manage"));
});
