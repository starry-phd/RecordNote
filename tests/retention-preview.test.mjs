import test from 'node:test';
import assert from 'node:assert/strict';
import {previewCourseCleanup,retentionNoticeDays} from '../.build/retention-preview.js';
import {ValidationError} from '../.build/core.js';
const course=(id,bytes,pinned=false,lastViewedAt='2026-10-01T00:00:00Z')=>({
 id,title:'Lesson '+id,bytes,pinned,createdAt:'2026-09-01T00:00:00Z',lastViewedAt
});
test('protects explicitly pinned lessons before all unpinned recordings',()=>{
 const p=previewCourseCleanup([course('pinned',70,true),course('recent',50,false,'2026-10-22T00:00:00Z'),course('old',30)],100);
 assert.deepEqual(p.keepIds,['pinned','old']);
 assert.deepEqual(p.candidateRemovalIds,['recent']);
 assert.equal(p.canAutomaticallyDelete,false);
});
test('newest accessed course wins when only one fits',()=>{
 const p=previewCourseCleanup([course('old',80),course('new',80,false,'2026-10-23T00:00:00Z')],80);
 assert.deepEqual(p.keepIds,['new']);
 assert.deepEqual(p.candidateRemovalIds,['old']);
});
test('pinned overflow requires manual resolution and never deletes pinned files',()=>{
 const p=previewCourseCleanup([course('importantA',70,true),course('importantB',40,true),course('other',20)],100);
 assert.equal(p.manualReviewRequired,true);
 assert.deepEqual(p.keepIds,['importantA','importantB']);
 assert.deepEqual(p.candidateRemovalIds,['other']);
 assert.equal(p.canAutomaticallyDelete,false);
});
test('nothing to remove below capacity',()=>{
 const p=previewCourseCleanup([course('a',3),course('b',5)],100);
 assert.equal(p.overageBytes,0);
 assert.deepEqual(p.candidateRemovalIds,[]);
});
test('rejects invalid or duplicate course descriptions',()=>{
 assert.throws(()=>previewCourseCleanup([course('x',10),course('x',20)],100),ValidationError);
 assert.throws(()=>previewCourseCleanup([course('x',-2)],100),ValidationError);
 assert.throws(()=>previewCourseCleanup([course('x',5)],-2),ValidationError);
});
test('180-day retention reminders stay at approved milestones',()=>{
 const base=new Date('2026-10-23T00:00:00Z');
 const times=retentionNoticeDays(base);
 assert.deepEqual(times.map(t=>(t.getTime()-base.getTime())/86400000),[150,166,173,179]);
});
