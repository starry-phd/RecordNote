import test from 'node:test';
import assert from 'node:assert/strict';
import {setCourseProtected,recordOwnerCourseView} from '../.build/course-protection.js';
import {ValidationError} from '../.build/core.js';
test('uses strict owner-bound parameterized SQL, never trusts caller ownership',async()=>{
 const calls=[];
 const db={prepare(sql){return {bind(...v){calls.push({sql,args:v});return this;},async first(){return {id:'course1',protected_at:'2026-10-23'};}};}};
 const r=await setCourseProtected(db,'user1','course1',true);
 assert.equal(r.id,'course1');
 assert.deepEqual(calls[0].args,[1,'course1','user1']);
 assert.match(calls[0].sql,/owner_user_id=\?/);
});
test('owner course view is recorded with same ownership rule',async()=>{
 const calls=[];
 const db={prepare(sql){return {bind(...v){calls.push({sql,args:v});return this;},async first(){return null;}};}};
 assert.equal(await recordOwnerCourseView(db,'user1','course1'),false);
 assert.match(calls[0].sql,/owner_user_id=\?/);
});
test('bad ids and nonboolean protection fail before touching DB',async()=>{
 const db={prepare(){throw Error('must never access DB')}};
 await assert.rejects(setCourseProtected(db,'','lesson',true),ValidationError);
 await assert.rejects(setCourseProtected(db,'user','lesson','yes'),ValidationError);
 await assert.rejects(recordOwnerCourseView(db,'user','bad id'),ValidationError);
});
