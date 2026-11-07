import test from 'node:test';
import assert from 'node:assert/strict';
import {LIMITS,PLAN_QUOTAS,ValidationError,assertRecording,assertUploadSize,assertMediaCount,remainingQuota,canReadSharedResource,nextRetentionDeadline,calculateStorageBytes,requireString} from '../.build/core.js';
test('single recording limited to 100 minutes',()=>{
  assert.deepEqual(assertRecording({slot:10,durationSeconds:6000}),{slot:10,durationSeconds:6000});
  assert.throws(()=>assertRecording({slot:1,durationSeconds:6001}),ValidationError);
  assert.throws(()=>assertRecording({slot:1,durationSeconds:0}),ValidationError);
});
test('at most 10 recordings per course',()=>{
  assert.throws(()=>assertRecording({slot:11,durationSeconds:30}),ValidationError);
  assert.throws(()=>assertRecording({slot:0,durationSeconds:30}),ValidationError);
});
test('100MB decimal file limit',()=>{
  assert.equal(assertUploadSize(100_000_000),100_000_000);
  assert.throws(()=>assertUploadSize(100_000_001),ValidationError);
  assert.throws(()=>assertUploadSize(-1),ValidationError);
});
test('50 images one 10-second video per recording',()=>{
  assert.doesNotThrow(()=>assertMediaCount(50,1,10));
  assert.throws(()=>assertMediaCount(51,1,10),ValidationError);
  assert.throws(()=>assertMediaCount(50,2,10),ValidationError);
  assert.throws(()=>assertMediaCount(50,1,11),ValidationError);
});
test('free transcription is 30 minutes once; paid monthly quotas correct',()=>{
  assert.equal(PLAN_QUOTAS.free.transcriptionSeconds,1800);
  assert.equal(PLAN_QUOTAS.standard.transcriptionSeconds,36000);
  assert.equal(PLAN_QUOTAS.professional.transcriptionSeconds,108000);
  assert.equal(remainingQuota('free','ai_questions',7),3);
  assert.equal(remainingQuota('standard','ocr_images',600),0);
});
test('shares are private and AI rights separate',()=>{
  const privateGrant={hasActiveGrant:false,allowDownload:true,allowAI:true};
  assert.equal(canReadSharedResource(privateGrant,'view'),false);
  const viewOnly={hasActiveGrant:true,allowDownload:false,allowAI:false};
  assert.equal(canReadSharedResource(viewOnly,'view'),true);
  assert.equal(canReadSharedResource(viewOnly,'download'),false);
  assert.equal(canReadSharedResource(viewOnly,'ai'),false);
  assert.equal(canReadSharedResource({...viewOnly,allowAI:true},'ai'),true);
});
test('180 days after paid entitlement ends',()=>{
  const end=new Date('2026-10-23T00:00:00Z');
  assert.equal(nextRetentionDeadline(end).getTime()-end.getTime(),180*86400000);
});
test('100-minute 64kbps audio is around 48MB',()=>{
  assert.equal(calculateStorageBytes(100),48000000);
  assert.ok(calculateStorageBytes(100)<LIMITS.maxAudioBytes);
});
test('titles sanitized to bounded nonempty text',()=>{
  assert.equal(requireString('  hello  ','title',120),'hello');
  assert.throws(()=>requireString('  ','title',120),ValidationError);
});
