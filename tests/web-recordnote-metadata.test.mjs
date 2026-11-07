import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/web-recordnote-metadata.js',import.meta.url),'utf8');
const sandbox={TextEncoder,Date,console:{warn:()=>{}},state:{mode:'demo'}};
runInNewContext(source+'\n;globalThis.__recordnoteTest={mdValues,mdTagFutureWebRecording};',sandbox);
const {mdValues,mdTagFutureWebRecording}=sandbox.__recordnoteTest;

const policy={revision:1,status:'published',fields:{
  'quicktime.title':{enabled:true,mode:'system',value:'recording_name'},
  'quicktime.creationdate':{enabled:true,mode:'system',value:'recording_start_iso'},
}};
const details={fileName:'test.m4a',startedAt:Date.parse('2026-11-06T12:00:00Z'),
  endedAt:Date.parse('2026-11-06T12:00:02Z'),bookTitle:'測試',gps:null,placeName:''};

test('valid start time remains UTC, independent of viewing device timezone',()=>{
  const data=mdValues(policy,details);
  assert.equal(data['com.apple.quicktime.creationdate'],'2026-11-06T12:00:00.000Z');
  assert.equal(data['com.apple.quicktime.title'],'test.m4a');
});

test('invalid time is a safe metadata failure, never an exception that loses original recording',async()=>{
  const file={name:'test.m4a',type:'audio/mp4',size:100};
  const actual=await mdTagFutureWebRecording(file,policy,{...details,startedAt:'not-a-date'});
  assert.equal(actual.file,file);
  assert.equal(actual.status,'writer_failed');
});

test('unsupported audio format is kept byte-for-byte by metadata path',async()=>{
  const file={name:'test.wav',type:'audio/wav',size:100};
  const actual=await mdTagFutureWebRecording(file,policy,details);
  assert.equal(actual.file,file);
  assert.equal(actual.status,'not_m4a');
});

test('disabled metadata policy keeps input untouched',async()=>{
  const file={name:'test.m4a',type:'audio/mp4',size:100};
  const actual=await mdTagFutureWebRecording(file,{...policy,fields:{}},details);
  assert.equal(actual.file,file);
  assert.equal(actual.status,'no_active_supported_keys');
});
