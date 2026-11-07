import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizedAudioPlayback} from '../.build/audio-playback.js';
import {ValidationError} from '../.build/core.js';
const rid='11111111-1111-4111-8111-111111111111';
const key='verified/member-a/'+rid+'/22222222-2222-4222-8222-222222222222.m4a';
function mock({allowed=true,objectKey=key,bytes=12000}={}){
 const events=[];
 const db={prepare(sql){events.push({step:'sql',sql});return {
  bind(...args){events.push({step:'args',args});return this;},
  async first(){return allowed?{object_key:objectKey}:null;}
 }}};
 const media={
  async head(k){events.push({step:'head',key:k});return {size:bytes};},
  async get(k,options){events.push({step:'get',key:k,options});return {
   size:bytes,body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1]));controller.close();}})
  };}
 };
 const play=(rangeHeader=null,method='GET')=>authorizedAudioPlayback(db,media,{userId:'member-a',recordingId:rid,method,rangeHeader});
 return {play,events};
}
test('owner or active grant gets private streaming, no public URL leaked',async()=>{
 const m=mock(),r=await m.play();
 assert.equal(r.type,'success');assert.equal(r.status,200);
 assert.equal(r.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal(r.headers.get('content-disposition'),'inline');
 assert.equal(r.headers.get('content-length'),'12000');
 assert.equal(m.events.filter(e=>e.step==='get').length,1);
 const sql=m.events.find(e=>e.step==='sql').sql;
 assert.match(sql,/c.owner_user_id=\?/);
 assert.match(sql,/g.revoked_at IS NULL/);
 assert.match(sql,/g.expires_at IS NULL OR g.expires_at>CURRENT_TIMESTAMP/);
});
test('unauthorized caller cannot even cause an R2 object head request',async()=>{
 const m=mock({allowed:false}),r=await m.play('bytes=0-100');
 assert.equal(r.type,'forbidden');
 assert.equal(m.events.some(e=>e.step==='head'||e.step==='get'),false);
});
test('range streaming produces valid 206 and cloud R2 byte range',async()=>{
 const m=mock(),r=await m.play('bytes=100-299');
 assert.equal(r.status,206);
 assert.equal(r.headers.get('content-range'),'bytes 100-299/12000');
 assert.equal(r.headers.get('content-length'),'200');
 assert.deepEqual(m.events.find(e=>e.step==='get').options,{range:{offset:100,length:200}});
});
test('suffix and open ended requests support HTML audio seek',async()=>{
 const m=mock();const r=await m.play('bytes=-100');
 assert.equal(r.headers.get('content-range'),'bytes 11900-11999/12000');
 const o=await m.play('bytes=11900-');
 assert.equal(o.headers.get('content-length'),'100');
});
test('invalid/multiple/oversized ranges return 416 without reading bytes',async()=>{
 for(const range of ['bytes=12000-12001','bytes=5-2','bytes=0-2,5-7','bytes=-0','bytes=a-b']){
  const m=mock(),r=await m.play(range);
  assert.equal(r.type,'range_error');
  assert.equal(r.headers.get('content-range'),'bytes */12000');
  assert.equal(m.events.some(e=>e.step==='get'),false);
 }
});
test('HEAD emits only headers and invalid object keys never touch R2',async()=>{
 const m=mock(),r=await m.play(null,'HEAD');
 assert.equal(r.body,null);
 assert.equal(m.events.some(e=>e.step==='get'),false);
 const n=mock({objectKey:'quarantine/member-a/'+rid+'/wrong.m4a'});
 assert.equal((await n.play()).type,'unavailable');
 assert.equal(n.events.some(e=>e.step==='head'),false);
});
test('rejects nonuuid request parameters',async()=>{
 const m=mock();
 await assert.rejects(authorizedAudioPlayback({prepare(){throw Error('unexpected DB call')}},null,
  {userId:'abc',recordingId:'../records',method:'GET',rangeHeader:null}),ValidationError);
});
