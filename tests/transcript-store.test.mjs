import test from 'node:test';
import assert from 'node:assert/strict';
import {saveVerifiedTranscript,readAuthorizedTranscript} from '../.build/transcript-store.js';
import {ValidationError} from '../.build/core.js';
const rid='11111111-1111-4111-8111-111111111111';
const jid='22222222-2222-4222-8222-222222222222';
const chunk={index:0,startMs:1000,endMs:2500,text:'water is important'};
function fakeDB({permitted=true}={}){
 const events=[];
 return {events,db:{
  prepare(sql){return {
   bind(...args){events.push({sql,args});return this;},
   async first(){return permitted?{id:rid}:null;},
   async all(){return {results:[]};}
  };},
  async batch(batch){events.push({batchSize:batch.length});return batch.map(()=>({results:[{id:'segment'}]}));}
 }};
}
test('only verified owner may persist timestamped transcript chunks',async()=>{
 const {db,events}=fakeDB();
 const r=await saveVerifiedTranscript(db,{ownerUserId:'member1',recordingId:rid,sourceJobId:jid,segments:[chunk]});
 assert.deepEqual(r,{written:1,attempted:1});
 assert.match(events[0].sql,/r.status='verified'/);
 assert.match(events[0].sql,/owner_user_id=\?/);
 assert.match(events[1].sql,/ON CONFLICT\(recording_id,source_job_id,chunk_index\) DO NOTHING/);
 assert.equal(events[1].args.at(-1),'member1');
 assert.equal(events[2].batchSize,1);
});
test('unauthorized write never calls batch',async()=>{
 const f=fakeDB({permitted:false});
 await assert.rejects(saveVerifiedTranscript(f.db,{ownerUserId:'victim',recordingId:rid,sourceJobId:jid,segments:[chunk]}),ValidationError);
 assert.equal(f.events.some(x=>x.batchSize),false);
});
test('bad timestamps, duplications, huge chunks rejected before touching DB',async()=>{
 const f=fakeDB();
 const base={ownerUserId:'member1',recordingId:rid,sourceJobId:jid};
 for(const segments of [
  [],[chunk,chunk],[{...chunk,endMs:1000}],[{...chunk,endMs:6000001}],
  [{...chunk,speaker:'speaker_fake'}],[{...chunk,text:''}],[{...chunk,index:10000}]
 ]){
  await assert.rejects(saveVerifiedTranscript(f.db,{...base,segments}),ValidationError);
 }
 assert.equal(f.events.length,0);
});
test('read transcript requires owner or active nonexpired grant',async()=>{
 const f=fakeDB();
 const entries=await readAuthorizedTranscript(f.db,'member1',rid);
 assert.deepEqual(entries,[]);
 assert.match(f.events[0].sql,/g.revoked_at IS NULL/);
 assert.match(f.events[0].sql,/g.expires_at IS NULL OR g.expires_at>CURRENT_TIMESTAMP/);
 assert.equal(f.events[0].args[1],'member1');
});
