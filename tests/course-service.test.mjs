import test from 'node:test';
import assert from 'node:assert/strict';
import {listOwnedCourses,createOwnedCourse,renameOwnedCourse,protectOwnedCourse,touchOwnedCourse,validCourseId} from '../.build/course-service.js';
import {ValidationError} from '../.build/core.js';
const A='11111111-1111-4111-8111-111111111111';
function mockDatabase(rowFactory){
 const operations=[];
 const db={prepare(sql){return {
  bind(...args){operations.push({sql,args});return this;},
  async first(){return rowFactory?.(operations.at(-1))??null;},
  async all(){return {results:rowFactory?.(operations.at(-1))??[]};}
 };}};
 return {db,operations};
}
test('owner listing has mandatory ownership filter, bounded limit and no deleted records',async()=>{
 const {db,operations}=mockDatabase(()=>[]);
 assert.deepEqual(await listOwnedCourses(db,'member-a',100),[]);
 assert.deepEqual(operations[0].args,['member-a',100]);
 assert.match(operations[0].sql,/owner_user_id=\?/);
 assert.match(operations[0].sql,/deleted_at IS NULL/);
 await assert.rejects(listOwnedCourses(db,'member-a',101),ValidationError);
});
test('creation derives member identity from server and never from course input',async()=>{
 const {db,operations}=mockDatabase(()=>({id:A,title:'Lesson',created_at:'today',protected_at:null,last_viewed_at:null}));
 const out=await createOwnedCourse(db,'member-a',' Lesson ');
 assert.equal(out.title,'Lesson');
 assert.equal(operations[0].args[1],'member-a');
 assert.equal(operations[0].args[2],'Lesson');
 assert.match(operations[0].sql,/RETURNING/);
});
test('rename uses owner bound SQL and prevents deleted course changes',async()=>{
 const {db,operations}=mockDatabase(()=>null);
 assert.equal(await renameOwnedCourse(db,'member-a',A,'New title'),null);
 assert.deepEqual(operations[0].args,['New title',A,'member-a']);
 assert.match(operations[0].sql,/owner_user_id=\?/);
 assert.match(operations[0].sql,/deleted_at IS NULL/);
});
test('protection is owner-scoped and accepts only explicit boolean values',async()=>{
 const {db,operations}=mockDatabase(()=>null);
 await protectOwnedCourse(db,'member-a',A,true);
 assert.deepEqual(operations[0].args,[1,A,'member-a']);
 await assert.rejects(protectOwnedCourse(db,'member-a',A,'true'),ValidationError);
});
test('only owners can update their last access time',async()=>{
 const {db,operations}=mockDatabase(()=>null);
 assert.equal(await touchOwnedCourse(db,'member-a',A),false);
 assert.deepEqual(operations[0].args,[A,'member-a']);
});
test('rejects malformed IDs, whitespace identity and oversized title before accessing DB',async()=>{
 const {db,operations}=mockDatabase(()=>null);
 assert.throws(()=>validCourseId('not-an-id'),ValidationError);
 await assert.rejects(renameOwnedCourse(db,'member-a','not-an-id','OK'),ValidationError);
 await assert.rejects(createOwnedCourse(db,'member a','OK'),ValidationError);
 await assert.rejects(createOwnedCourse(db,'member-a','x'.repeat(121)),ValidationError);
 assert.equal(operations.length,0);
});
