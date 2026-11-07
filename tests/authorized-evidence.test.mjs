import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAuthorizedCourseEvidence,NoAIAccess} from '../.build/authorized-evidence.js';
import {ValidationError} from '../.build/core.js';
const cid='11111111-1111-4111-8111-111111111111';
const rid='22222222-2222-4222-8222-222222222222';
function fake(permitted){
 const queries=[];
 return {queries,db:{prepare(sql){
  let args;
  return {bind(...a){args=a;queries.push({sql,args});return this;},
   async first(){return permitted?{id:cid}:null;},
   async all(){
    if(sql.includes('FROM transcript_segments'))
     return {results:[{id:'seg1',courseId:cid,recordingId:rid,startMs:1200,text:'講師說明水分的重要性'}]};
    if(sql.includes('FROM media m'))
     return {results:[{id:'photo3',courseId:cid,recordingId:rid,photoPosition:3,text:'人體水分平衡'}]};
    throw Error('unexpected query');
   }
  };
 }}};
}
test('unauthorized user never queries transcript or OCR source tables',async()=>{
 const f=fake(false);
 await assert.rejects(loadAuthorizedCourseEvidence(f.db,'member-b',cid),NoAIAccess);
 assert.equal(f.queries.length,1);
});
test('authorized owner or allow_ai recipient receives evidence tied to exact recording and time',async()=>{
 const f=fake(true);
 const e=await loadAuthorizedCourseEvidence(f.db,'member-a',cid);
 assert.equal(e.length,2);
 assert.equal(e[0].id,'t_seg1');assert.equal(e[0].startMs,1200);
 assert.equal(e[1].id,'p_photo3');assert.equal(e[1].photoPosition,3);
 assert.ok(f.queries.every(x=>x.args[0]===cid));
 for(const q of f.queries){
  assert.match(q.sql,/g.allow_ai=1/);
  assert.match(q.sql,/g.revoked_at IS NULL/);
  assert.match(q.sql,/g.expires_at IS NULL OR g.expires_at>CURRENT_TIMESTAMP/);
  assert.equal(q.args[1],'member-a');
 }
});
test('reject malformed user ID and arbitrary course access before D1 queries',async()=>{
 const f=fake(true);
 await assert.rejects(loadAuthorizedCourseEvidence(f.db,'member bad',cid),ValidationError);
 await assert.rejects(loadAuthorizedCourseEvidence(f.db,'member-a','other-course'),ValidationError);
 assert.equal(f.queries.length,0);
});
