import test from 'node:test';
import assert from 'node:assert/strict';
import {transition,mayStartNextSlot} from '../.build/recorder-session.js';
import {ValidationError} from '../.build/core.js';
const init=()=>({courseId:'course-a',slot:1,elapsedSeconds:0,state:'idle',chunkCount:0});
test('100 minutes automatically ends recording, confirms saved chunks before completion',()=>{
 const a=transition(init(),{type:'START'});
 const b=transition(a,{type:'TICK',deltaSeconds:5990});
 const c=transition(b,{type:'CHUNK_SAVED'});
 const d=transition(c,{type:'TICK',deltaSeconds:60});
 assert.equal(d.elapsedSeconds,6000);assert.equal(d.state,'finishing');
 assert.equal(transition(d,{type:'FINISH_SAVED'}).state,'saved');
});
test('cannot mark session saved without a persisted audio chunk',()=>{
 const s=transition(transition(init(),{type:'START'}),{type:'STOP'});
 assert.throws(()=>transition(s,{type:'FINISH_SAVED'}),ValidationError);
});
test('pause freezes counting and interruption marks recoverable state',()=>{
 const a=transition(transition(init(),{type:'START'}),{type:'PAUSE'});
 assert.throws(()=>transition(a,{type:'TICK',deltaSeconds:10}),ValidationError);
 assert.equal(transition(a,{type:'INTERRUPT'}).state,'interrupted');
});
test('auto continue never creates eleventh course recording',()=>{
 assert.equal(mayStartNextSlot(9,true),true);
 assert.equal(mayStartNextSlot(10,true),false);
 assert.equal(mayStartNextSlot(1,false),false);
});
