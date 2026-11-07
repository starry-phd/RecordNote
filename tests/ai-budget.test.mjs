import test from 'node:test';
import assert from 'node:assert/strict';
import {protectedAIClient,AIBudgetExceeded,AI_LAB_DAILY_LIMIT_MICRO_USD} from '../.build/ai-budget.js';
import {MODELS} from '../.build/ai-cloudflare.js';
import {ValidationError} from '../.build/core.js';
const options={testEnvironment:true,dayUTC:'2026-10-23',jobId:'synthetic-check-12345'};
test('no real member job can access internal AI budget',()=>{
 assert.throws(()=>protectedAIClient({run:async()=>{}},null,{...options,testEnvironment:false}),ValidationError);
 assert.throws(()=>protectedAIClient({run:async()=>{}},null,{...options,jobId:'user-12345'}),ValidationError);
});
test('allowed model first reserves capped spending in D1',async()=>{
 const events=[],db={prepare(sql){return{bind(...args){events.push({sql,args});return this;},async first(){return{id:'reservation'};}}}};
 const model={async run(name){events.push({model:name});return {response:'ok'};}};
 const w=protectedAIClient(model,db,options);
 assert.equal((await w.run(MODELS.llm,{messages:[]})).response,'ok');
 assert.match(events[0].sql,/SUM\(estimated_micro_usd\)/);
 assert.equal(events[0].args.at(-1),AI_LAB_DAILY_LIMIT_MICRO_USD);
 assert.equal(events[1].model,MODELS.llm);
});
test('unknown model and denied reservation never invoke AI',async()=>{
 const ai={calls:0,async run(){this.calls++;return {}}};
 const db={prepare(){return{bind(){return this;},async first(){return null;}}}};
 const bound=protectedAIClient(ai,db,options);
 await assert.rejects(bound.run('unknown',{text:'hi'}),ValidationError);
 await assert.rejects(bound.run(MODELS.llm,{messages:[]}),AIBudgetExceeded);
 assert.equal(ai.calls,0);
});
