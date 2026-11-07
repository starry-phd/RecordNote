import test from 'node:test';
import assert from 'node:assert/strict';
import lab from './worker.mjs';
test('isolated AI lab returns 404 for every unauthenticated route and method',async()=>{
 const count={calls:0};
 const env={AI:{async run(){count.calls++;throw Error('unauthenticated call')}}};
 for(const [method,path] of [['GET','/'],['POST','/ai/run'],['GET','/healthz'],['PUT','/audio'],['POST','/billing']]){
   const res=await lab.fetch(new Request('https://example.invalid'+path,{method}),env);
   assert.equal(res.status,404);assert.match(res.headers.get('x-robots-tag'),/noindex/);
 }
 assert.equal(count.calls,0);
});