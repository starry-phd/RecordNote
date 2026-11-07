import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext, runInContext} from 'node:vm';

const worker=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const literal=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(worker);
assert.ok(literal,'Cloudflare PAGE literal exists');
const page=JSON.parse(literal[1]);
function section(start,end){
 const a=page.indexOf(start),b=page.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'source section '+start);
 return page.slice(a,b);
}
const recordingCode=section('const RECORDING_MIN_DURATION_MS=3000;', 'async function saveRotated(');
const homeCode=section('function home(){','function booksPage(');
const meterCode=section('/* Live microphone level meter.', '\n</script>');
function makeMeter(){
 const ctx=createContext({window:{},console});
 runInContext(meterCode,ctx);
 return ctx.window.RecordNoteAudioMeter;
}

test('reuse the exact original RecordNoteAudioMeter waveform, with 18 reactive bars',()=>{
 const meter=makeMeter();
 const markup=meter.markup();
 assert.equal((markup.match(/live-audio-meter-bar/g)||[]).length,18);
 assert.ok(markup.includes('aria-label="即時錄音音量"'));
 const quiet=meter.barHeights(0),loud=meter.barHeights(0.8);
 assert.equal(quiet.length,18);
 assert.ok(quiet.every((v,i)=>v<loud[i]),'bar height increases with measured volume');
});

test('compact homepage renders original meter only while recording',()=>{
 const meter=makeMeter();
 function renderHome(active){
  const ctx=createContext({
   state:{rec:active?{paused:false}:null,busy:false,cloudHomeError:false},
   allRecordings:()=>[],banner:()=>'',playerMarkup:()=>'',pendingMarkup:()=>'',clock:()=>'00:02',
   window:{RecordNoteAudioMeter:meter},recordingTile:()=>''
  });
  return runInContext(homeCode+'\nhome()',ctx);
 }
 const live=renderHome(true);
 assert.ok(live.includes('data-action="quickRecord"'));
 assert.ok(live.includes('class="rn-home-meter"'));
 assert.equal((live.match(/live-audio-meter-bar/g)||[]).length,18);
 const idle=renderHome(false);
 assert.ok(!idle.includes('rn-home-meter'));
 assert.ok(!idle.includes('live-audio-meter-bar'));
});

function fakeRecording(){
 let now=0,localWrites=0,uploads=0,lastSeconds=null,meterGetter=null,lastNotice='';
 const stream={getTracks:()=>[{stop(){}}]};
 class MockRecorder {
  static isTypeSupported(type){return type.startsWith('audio/mp4');}
  constructor(source,opts){this.source=source;this.opts=opts;this.state='inactive';}
  start(){this.state='recording';}
  stop(){this.state='inactive';}
  pause(){this.state='paused';}
  resume(){this.state='recording';}
 }
 class FakeFile{
  constructor(parts,name,{type}){this.name=name;this.type=type;this.size=parts.reduce((n,p)=>n+(p.size||1),0);}
 }
 const state={rec:null,active:'book-a',recordSeconds:0};
 const meterElement={id:'volume-graph'};
 const ctx=createContext({
  performance:{now:()=>now},
  Date,Math,Number,Object,String,Error,Intl,Promise,Blob,FakeFile,
  File:FakeFile,
  navigator:{userAgent:'Mozilla/5.0 Android',mediaDevices:{getUserMedia:async()=>stream}},
  window:{
   MediaRecorder:MockRecorder,
   RecordNoteAudioMeter:{attach:(_stream,getTarget)=>{meterGetter=getTarget;return{stop(){}};}},
   RecordNoteVoice:{attach:()=>{throw Error('mobile must bypass DSP')}}
  },
  MediaRecorder:MockRecorder,
  document:{querySelector:selector=>{
   assert.ok(selector.includes('.rn-home-meter .live-audio-meter'));
   assert.ok(selector.includes('.record-panel .live-audio-meter'));
   return meterElement;
  },getElementById:()=>null},
  mdPolicyAtStart:async()=>({revision:1}),
  ensureQuickCourse:async()=>{},
  captureRecordingGPS:async()=>null,
  mdPlaceName:async()=>'',mdDesktopLocation:()=>false,
  mdTagFutureWebRecording:async file=>({file,status:'unsupported',keyCount:0}),
  saveLocalWebFile:async()=>{localWrites++;},
  uploadFile:async(_f,_kind,seconds)=>{uploads++;lastSeconds=seconds;return 'saved';},
  buildAudioName:()=> 'test.m4a',
  currentCourses:()=>[{id:'book-a',title:'Book A'}],
  setLocalPlaceInfo:()=>{},
  gpsOptIn:()=>false,
  notice:(msg)=>{lastNotice=msg;},
  render:()=>{},
  setInterval:()=>1,clearInterval:()=>{},
  crypto:{randomUUID:()=> 'test-id'},
  console:{warn:()=>{}},
  state
 });
 runInContext(recordingCode,ctx);
 const call=expr=>runInContext(expr,ctx);
 return {
  state,call,setNow:value=>{now=value;},
  get localWrites(){return localWrites;},get uploads(){return uploads;},
  get lastSeconds(){return lastSeconds;},get lastNotice(){return lastNotice;},
  get meterTarget(){return meterGetter?.();}
 };
}

async function finish(f,elapsed){
 await f.call('startRecord(false)');
 assert.ok(f.state.rec,'started recording');
 assert.equal(f.state.rec.recorder.opts.audioBitsPerSecond,48000);
 assert.equal(f.meterTarget.id,'volume-graph');
 f.setNow(elapsed);
 f.call('stopRecord()');
 await f.state.rec.recorder.onstop();
}

test('recording of 2999 ms is discarded with notice; no local/cloud writes',async()=>{
 const f=fakeRecording();
 await finish(f,2999);
 assert.equal(f.localWrites,0);
 assert.equal(f.uploads,0);
 assert.equal(f.state.rec,null);
 assert.match(f.lastNotice,/錄音不足 3 秒，未儲存音檔/);
});

test('recording of exactly 3000 ms is saved once',async()=>{
 const f=fakeRecording();
 await finish(f,3000);
 assert.equal(f.localWrites,1);
 assert.equal(f.uploads,1);
 assert.equal(f.lastSeconds,3);
});

test('paused time does not count toward 3-second recording minimum',async()=>{
 const f=fakeRecording();
 await f.call('startRecord(false)');
 f.setNow(2000);f.call('pauseRecord()');
 f.setNow(12000);f.call('stopRecord()');
 await f.state.rec.recorder.onstop();
 assert.equal(f.uploads,0);
 assert.equal(f.localWrites,0);
 assert.match(f.lastNotice,/不足 3 秒/);
});

test('audio active time accumulates across pause and resume',async()=>{
 const f=fakeRecording();
 await f.call('startRecord(false)');
 f.setNow(1750);f.call('pauseRecord()');
 assert.equal(f.meterTarget,null,'paused animation is not updated');
 f.setNow(10750);f.call('pauseRecord()');
 assert.equal(f.meterTarget.id,'volume-graph','resume reattaches animation');
 f.setNow(12000);f.call('stopRecord()');
 await f.state.rec.recorder.onstop();
 assert.equal(f.uploads,1);
 assert.equal(f.lastSeconds,3); // 1.75 + 1.25 sec
});
