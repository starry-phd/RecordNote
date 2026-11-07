import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../.build/worker-boundary.mjs';
const env={
  STAR_ID_ISSUER:'NOT_CONFIGURED',
  STAR_ID_AUDIENCE:'starry-recorder',
  STAR_ID_JWKS_URL:'NOT_CONFIGURED',
  FEATURE_MEMBER_API:'disabled',
  FEATURE_AUDIO_UPLOAD:'disabled',
  FEATURE_SHARING:'disabled',
};
const req=(path,method='GET',data)=>worker.fetch(new Request('https://recorder.invalid'+path,{
  method,
  ...(data?{body:JSON.stringify(data),headers:{'content-type':'application/json'}}:{})
}),env);
test('health endpoint explicitly says product not ready',async()=>{
 const r=await req('/api/health');const body=await r.json();
 assert.equal(r.status,200);
 assert.equal(body.ready,false);
});
test('capabilities declare private, upload, sharing disabled',async()=>{
 const r=await req('/api/capabilities');const body=await r.json();
 assert.deepEqual(body.features,{memberApi:false,audioUpload:false,sharing:false});
});
test('member and private courses requests reject without touching DB',async()=>{
 const paths=['/api/me','/api/courses','/api/courses/00000000-0000-4000-8000-000000000001'];
 for(const path of paths){
  const r=await req(path);
  assert.equal(r.status,503);
  assert.equal((await r.json()).error,'identity_integration_pending');
 }
});
test('data writes reject before opening R2 or D1',async()=>{
 const routes=[
  ['/api/courses','POST',{title:'test'}],
  ['/api/courses/00000000-0000-4000-8000-000000000001/recordings','POST',{slot:1,title:'lecture',durationSeconds:20}],
  ['/api/courses/00000000-0000-4000-8000-000000000001/shares','POST',{recipientUserId:'x',allowAI:false,allowDownload:false}],
 ];
 for(const [path,method,payload] of routes){
  const r=await req(path,method,payload);
  assert.equal(r.status,503);
 }
});
test('upload rejects even if caller claims to have a valid M4A',async()=>{
 const r=await worker.fetch(new Request('https://recorder.invalid/api/recordings/00000000-0000-4000-8000-000000000001/audio',{
  method:'PUT',body:new Uint8Array([0,1,2,3]),headers:{'content-type':'audio/mp4'}
 }),env);
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,'identity_integration_pending');
});
