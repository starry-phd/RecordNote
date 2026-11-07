import test from 'node:test';
import assert from 'node:assert/strict';
import {promoteTrustedAudio} from '../.build/audio-promotion.js';
import {ValidationError} from '../.build/core.js';
const id='a1111111-1111-4111-8111-111111111111';
const user='safe-member';
const key='quarantine/'+user+'/'+id+'/upload.m4a';
const probe=()=>({format:{format_name:'mov,mp4,m4a,3gp,3g2,mj2',duration:'90',size:'720000',bit_rate:'64000'},
 streams:[{codec_type:'audio',codec_name:'aac',profile:'LC',sample_rate:'16000',channels:1,bit_rate:'64000'}]});
function rig(options={}){
 const rec={status:'quarantine',staging_object_key:key,duration_seconds:90,bytes:720000,
  ...options.row};
 const actions=[];
 const db={
  prepare(sql){
   let args=[];
   return {
    bind(...a){args=a;return this;},
    async first(){
     actions.push({kind:'select',sql,args});
     if(options.missingRow)return null;
     return {...rec};
    },
    async run(){
     actions.push({kind:'update',sql,args});
     return {meta:{changes:options.casMiss?0:1}};
    }
   };
  }
 };
 const bucket={
  async get(k){actions.push({kind:'get',key:k});return options.missingObject?null:{
    size:options.mismatchedObject?100:720000,
    body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1,2,3]));controller.close();}})
   };},
  async put(k,body,opts){actions.push({kind:'put',key:k,opts});if(options.putFails)throw Error('R2 outage');return {key:k};},
  async delete(k){actions.push({kind:'delete',key:k});}
 };
 return {db,bucket,actions};
}
const request=(extra={})=>({ownerUserId:user,recordingId:id,trustedProbe:probe(),...extra});
test('trusted measured M4A alone can promote via private R2 stream and owner-scoped CAS',async()=>{
 const r=rig();
 const out=await promoteTrustedAudio(r.db,r.bucket,request());
 assert.equal(out.status,'verified');assert.equal(out.verified.sampleRate,16000);
 const update=r.actions.find(x=>x.kind==='update');
 assert.equal(update.args[3],user);
 assert.match(update.sql,/owner_user_id=\?/);
 assert.equal(r.actions.filter(x=>x.kind==='put').length,1);
 assert.equal(r.actions.filter(x=>x.kind==='delete'&&x.key===key).length,1);
});
test('wrong codec, wrong duration, fake size block before R2 promotion',async()=>{
 for(const variation of [
  {trustedProbe:{...probe(),streams:[{...probe().streams[0],codec_name:'mp3'}]}},
  {trustedProbe:{...probe(),format:{...probe().format,duration:'140'}}},
  {trustedProbe:{...probe(),format:{...probe().format,size:'600000'}}}
 ]){
  const r=rig();
  await assert.rejects(promoteTrustedAudio(r.db,r.bucket,request(variation)),ValidationError);
  assert.equal(r.actions.some(x=>x.kind==='put'),false);
 }
});
test('wrong owner prefix never reveals source R2 object',async()=>{
 const r=rig({row:{staging_object_key:'quarantine/victim/'+id+'/object.m4a'}});
 await assert.rejects(promoteTrustedAudio(r.db,r.bucket,request()),ValidationError);
 assert.equal(r.actions.some(x=>x.kind==='get'),false);
});
test('wrong object bytes cannot be promoted',async()=>{
 const r=rig({mismatchedObject:true});
 await assert.rejects(promoteTrustedAudio(r.db,r.bucket,request()),ValidationError);
 assert.equal(r.actions.some(x=>x.kind==='put'),false);
});
test('CAS conflict deletes only the newly written private verified object',async()=>{
 const r=rig({casMiss:true});
 const out=await promoteTrustedAudio(r.db,r.bucket,request());
 assert.equal(out.status,'not_ready');
 const put=r.actions.find(x=>x.kind==='put');
 assert.equal(r.actions.some(x=>x.kind==='delete'&&x.key===put.key),true);
 assert.equal(r.actions.some(x=>x.kind==='delete'&&x.key===key),false);
});
test('R2 failure never advances DB status or deletes quarantine',async()=>{
 const r=rig({putFails:true});
 await assert.rejects(promoteTrustedAudio(r.db,r.bucket,request()),/R2 outage/);
 assert.equal(r.actions.some(x=>x.kind==='update'),false);
 assert.equal(r.actions.some(x=>x.kind==='delete'),false);
});
test('duplicate, unready, and missing media never create verified copy',async()=>{
 for(const options of [{row:{status:'verified'}},{row:{status:'uploading'}},{missingRow:true},{missingObject:true}]){
  const r=rig(options),out=await promoteTrustedAudio(r.db,r.bucket,request());
  assert.notEqual(out.status,'verified');
  assert.equal(r.actions.some(x=>x.kind==='put'),false);
 }
});
