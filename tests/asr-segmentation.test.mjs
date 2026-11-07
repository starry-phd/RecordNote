import test from 'node:test';
import assert from 'node:assert/strict';
import {planAudioChunks,normalizeWhisperTimedSegments} from '../.build/asr-segmentation.js';
import {ValidationError} from '../.build/core.js';
test('100-minute recording covers timeline in 90-second decodable chunks',()=>{
 const p=planAudioChunks(6000);
 assert.equal(p[0].startMs,0);
 assert.equal(p[0].endMs,90000);
 assert.equal(p[1].startMs,89000);
 assert.equal(p[1].displayFromMs,90000);
 assert.equal(p.at(-1).endMs,6000000);
 assert.ok(p.length<100);
 for(let i=1;i<p.length;i++)assert.ok(p[i].startMs<=p[i-1].endMs);
});
test('single short recording is not padded or split',()=>{
 assert.deepEqual(planAudioChunks(1.5),[{index:0,startMs:0,endMs:1500,displayFromMs:0}]);
});
test('Whisper relative times become original course times; no made-up speakers',()=>{
 const p=planAudioChunks(200);
 const segments=normalizeWhisperTimedSegments(p[1],[
  {start:0,end:0.5,text:'overlap, ignore'},
  {start:0.9,end:3.1,text:'second part'}
 ]);
 assert.equal(segments.length,1);
 assert.equal(segments[0].startMs,90000);
 assert.equal(segments[0].endMs,92100);
 assert.equal(segments[0].speaker,null);
});
test('invalid timestamps and excessive chunk plans fail closed',()=>{
 assert.throws(()=>planAudioChunks(6001),ValidationError);
 assert.throws(()=>planAudioChunks(120,120,120),ValidationError);
 assert.throws(()=>normalizeWhisperTimedSegments(planAudioChunks(5)[0],[{start:-1,end:2,text:'invalid'}]),ValidationError);
 assert.throws(()=>normalizeWhisperTimedSegments(planAudioChunks(5)[0],[{start:1,end:25,text:'invalid'}]),ValidationError);
});
