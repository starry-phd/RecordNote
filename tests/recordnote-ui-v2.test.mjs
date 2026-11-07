import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const literal=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(source);
assert.ok(literal,'Cloudflare PAGE exists');
const page=JSON.parse(literal[1]);
function slice(start,stop){
 const a=page.indexOf(start),b=page.indexOf(stop,a+start.length);
 assert.ok(a>=0&&b>a,'missing source section: '+start);
 return page.slice(a,b);
}
function execute(fn,start,stop,ctx){return runInNewContext(slice(start,stop)+'\n'+(fn.includes('(')?fn:fn+'()'),ctx)}
function validDetails(html){
 let n=0;for(const x of html.matchAll(/<\/?details\b[^>]*>/g)){
  n+=x[0].startsWith('</')?-1:1;assert.ok(n>=0,'unbalanced details');
 }assert.equal(n,0,'unclosed details');
}
const e=x=>String(x??'');

test('five main routes: 4 obvious + More with old cloud/trash actions',()=>{
 const html=execute('header','function header(){','\n\nfunction localPlaceInfo(',{
  state:{view:'home',mode:'live',pending:[]}
 });
 for(const a of ['home','books','search','settings','trash','storage'])
  assert.ok(html.includes('data-action="'+a+'"'),'missing '+a);
 assert.ok(html.includes('<details class="nav-more"'));validDetails(html);
});
test('home stays compact and removes redundant titles and promotional controls',()=>{
 const html=execute('home','function home(){','\nfunction booksPage(',{
  allRecordings:()=>[],recordingTile:()=>'',banner:()=>'',pendingMarkup:()=>'',playerMarkup:()=>'',state:{busy:false,rec:null}
 });
 assert.ok(html.includes('data-action="quickRecord"'));
 assert.ok(html.includes('class="rn-mini-list"'));
 assert.ok(html.includes('class="rn-home-recorder"'));
 assert.ok(!html.includes('我的錄音'));
 assert.ok(!html.includes('錄音紀錄'));
 assert.ok(!html.includes('data-action="importOpen"'));validDetails(html);
});
test('record card has two compact rows; Play and Trim are visible, all others in right menu',()=>{
 const m={id:'media-1',original_name:'RecordNote-20261107-021024-007.m4a',course_id:'book-1',
 duration_seconds:5,bytes:44032,localOnly:true,gps:{lat:24.59939,lon:120.77735,accuracy:20}};
 const html=execute('recordingTile(m)','function recordingTile(m){','\nfunction showRecordingLocation(',{
  m,state:{mode:'live'},currentCourses:()=>[{id:'book-1',title:'未分類'}],
  cloudSynced:()=>false,recordingDate:()=> '2026/11/07 02:10:24',
  compactRecordingPlace:()=> '十班坑附近',compactRecordingTime:()=> '11/07 02:10',
  compactRecordingDuration:()=> '00:05',recordingCompactName:()=> '錄音 007',
  isImportedRecording:()=>false,localPlaceInfo:()=>({}),e
 });
 assert.ok(html.includes('class="rn-mini-line1"'));
 assert.ok(html.includes('class="rn-mini-line2"'));
 assert.ok(html.includes('十班坑附近'));
 assert.ok(html.includes('11/07 02:10'));
 for(const action of ['playMedia','editAudio','renameRecording'])assert.ok(html.includes('data-action="'+action+'"'));
 const dropdown=html.indexOf('<div class="rn-mini-more-panel">');
 for(const action of ['shareMediaFile','downloadMedia','syncLocal','editLocationName','resolveSavedRecordingGpsPlace','showRecordingLocation','deleteMedia']){
  assert.ok(html.indexOf('data-action="'+action+'"')>dropdown,'not in More: '+action);
 }
 assert.ok(html.includes('data-move-audio="media-1"'));
 assert.ok(html.includes('本機'));
 validDetails(html);
});
test('settings account and location first; advanced options hidden, including deletion',()=>{
 const base={state:{mode:'live',uploadPolicy:{can_manage:true,max_file_mb:200},storageFolderName:'下載',pending:[]},
  readNameRule:()=>({prefix:'RecordNote',date:true,time:true,counter:true}),
  banner:()=>'',aiBatterySettings:()=>'',memberBatterySection:()=>'',e,ID:'https://id.starry.phd',gpsOptIn:()=>true,mdGeoOptIn:()=>true,
  mdManualPoint:()=>null,mdGoogleMapsUrl:()=> 'https://www.google.com/maps',mdManualRecordEnabled:()=>false};
 for(const desktop of [true,false]){
  const html=execute('settings','function settings(){','function dialog(){',{...base,mdDesktopLocation:()=>desktop});
  assert.ok(html.indexOf('<h3>Starry ID')<html.indexOf('<h3>定位與地名'));
  assert.ok(html.indexOf('<h3>定位與地名')<html.indexOf('<summary>其他設定</summary>'));
  const a=html.indexOf('<summary>其他設定</summary>');
  for(const id of ['nameRuleForm','uploadPolicyForm','selectFolder','deleteMyData'])
   assert.ok(html.indexOf(id)>a,'not hidden: '+id);
  if(desktop)assert.ok(html.includes('manualMapInput'));
  else assert.ok(!html.includes('manualMapInput'));
  assert.ok(html.includes('https://www.geoapify.com/'));
  validDetails(html);
 }
});
test('course retains record, photo, AI, transcript and sharing under expandable sections',()=>{
 const c={id:'book-1',title:'測試書本',is_system:1,visibility:'private'};
 const state={rec:null,mode:'demo',busy:false,uploadPolicy:{max_file_mb:200},uploadProgress:null,summary:null,resources:[]};
 const html=execute('course','function course(){','\nfunction mediaList(',{
  currentCourse:()=>c,currentMedia:()=>[],currentQuestions:()=>[],state,
  banner:()=>'',e,pendingMarkup:()=>'',playerMarkup:()=>'',batchToolbar:()=>'',mediaList:()=>'',sharePanel:()=>'',transcriptMarkup:()=>'',window:{RecordNoteAudioMeter:{markup:()=>''}},clock:()=> '00:00'
 });
 for(const name of ['photos','qa','privacy','transcript','summary','resources','tools'])
  assert.ok(html.includes('data-ui-key="course-'+name+'"'),'missing course-'+name);
 for(const action of ['startRecord','choosePhoto','createSummary'])
  assert.ok(html.includes('data-action="'+action+'"'));
 validDetails(html);
});
test('render retains manually expanded sections through updates',()=>{
 const body=slice('function render(){','\nfunction formValue(');
 assert.ok(body.includes("details[data-ui-key][open]"));
 assert.ok(body.includes("d.open=true"));
 assert.ok(body.includes('syncPlayerControls()'));
});
test('large type, safe-area, and touch targets',()=>{
 const style=page.slice(page.indexOf('<style>'),page.indexOf('</style>'));
 for(const x of ['RecordNote UI v2:','body{font-size:17px','min-height:48px','env(safe-area-inset-bottom)'])
  assert.ok(style.includes(x));
});

test('default long filename is shown as simple date/time without changing real filename',()=>{
 const actual=runInNewContext(slice('function recordingDisplayTitle(fileName){','function recordingTile(m){')+
  '\nrecordingDisplayTitle("RecordNote-20261107-021024-007.m4a")',{String});
 assert.equal(actual,'11/07 02:10 錄音');
 const custom=runInNewContext(slice('function recordingDisplayTitle(fileName){','function recordingTile(m){')+
  '\nrecordingDisplayTitle("meeting.m4a")',{String});
 assert.equal(custom,'meeting.m4a');
 assert.ok(page.includes('rn-mini-more-title')); // Exact source filename is still available in the per-record menu.
});
test('book media list retains batch selection and advanced file controls',()=>{
 const m={id:'audio-1',kind:'audio',original_name:'hello.m4a',bytes:40000,localOnly:true,visibility:'private'};
 const html=execute('mediaList([m])','function mediaList(arr){','\nfunction settings(){',{
  m,state:{batchIds:[],mode:'live',active:'book-1',shareLoading:null,preview:null},
  shareReadyFiles:new Set(),currentCourses:()=>[{id:'book-1',title:'我的書本'}],
  prettySize:()=> '40 KB',recordingDisplayTitle:x=>x,e
 });
 assert.ok(html.includes('data-batch-select="audio-1"'));
 assert.ok(html.includes('<details class="rn-disclosure rn-media-more"'));
 const advanced=html.indexOf('<summary>其他操作</summary>');
 for(const a of ['downloadMedia','shareMediaFile','editAudio','enhanceVoiceAi','showTranscript','transcribe','toggleMediaPrivacy','deleteMedia'])
  assert.ok(html.indexOf('data-action="'+a+'"')>advanced,'file action must be available in More: '+a);
 validDetails(html);
});
test('cloud storage hides share and deletion, but keeps download as the primary action',()=>{
 const html=execute('storagePage','function storagePage(){','\nasync function storageFile(',{
  banner:()=>'',state:{mode:'live',cloudStorage:{plan:'free',used_bytes:40000,
    available_bytes:500000000,quota_bytes:500040000,files:[
     {id:'cloud-1',original_name:'hello.m4a',bytes:40000,deleted_at:null,ai_status:''}]},shareLoading:null},
  prettySize:x=>Math.round(x/1024)+' KB',shareReadyFiles:new Set(),e
 });
 assert.ok(html.includes('data-action="storageDownload"'));
 assert.ok(html.includes('data-ui-key="storage-cloud-1"'));
 const hide=html.indexOf('<summary>其他操作</summary>');
 assert.ok(html.indexOf('data-action="storageShareFile"')>hide);
 assert.ok(html.indexOf('data-action="storagePurge"')>hide);
 validDetails(html);
});

test('reloadPending excludes all ordinary local-library recordings without deleting any audio',async()=>{
 const oldSaved={id:'record-1',owner:'user-1',kind:'audio',storage:'local-library',file:new Blob(['audio'])};
 const pendingBackup={id:'backup-2',owner:'user-1',kind:'audio',file:new Blob(['audio']),name:'backup.m4a'};
 const state={pending:[],volatilePending:[]};
 await runInNewContext(slice('async function reloadPending(){','\nasync function keepPendingRecording(')+
  '\nreloadPending()',{
  state,Blob,currentUserScope:()=> 'user-1',
  window:{RecordNoteOffline:{list:async()=>[oldSaved,pendingBackup]}}
 });
 assert.deepEqual(state.pending.map(x=>x.id),['backup-2']);
 assert.equal(oldSaved.file.size,5,'saved audio file must remain untouched');
});
test('if all saved files are local-library, pending count is zero, no redundant list or sync banner',async()=>{
 const state={pending:[],volatilePending:[]};
 await runInNewContext(slice('async function reloadPending(){','\nasync function keepPendingRecording(')+
  '\nreloadPending()',{
  state,Blob,currentUserScope:()=> 'user-1',
  window:{RecordNoteOffline:{list:async()=>Array.from({length:6},(_,i)=>({
   id:'local-'+i,owner:'user-1',kind:'audio',storage:'local-library',file:new Blob(['abc'])
  }))}}
 });
 assert.equal(state.pending.length,0);
 const html=execute('pendingMarkup(true)','function pendingMarkup(all=false){','\nasync function retryPending(',{
  state,currentUserScope:()=> 'user-1',e,recordingDisplayTitle:x=>x,prettySize:()=> '3 B'
 });
 assert.equal(html,'');
});
test('genuine pending backup is collapsed below normal recording list, and retains manual recovery buttons',()=>{
 const row={id:'backup-1',owner:'user-1',kind:'audio',storage:undefined,
  file:new Blob(['one']),name:'RecordNote-20261107-035900-011.m4a'};
 const state={pending:[row],active:'book-1',mode:'live'};
 const html=execute('pendingMarkup(true)','function pendingMarkup(all=false){','\nasync function retryPending(',{
  state,currentUserScope:()=> 'user-1',e,recordingDisplayTitle:()=> '11/07 03:59 錄音',
  prettySize:()=> '3 B'
 });
 assert.ok(html.startsWith('<details class="card rn-disclosure rn-pending-compact"'));
 assert.ok(html.includes('其他本機備份'));
 assert.ok(html.includes('備份至雲端'));
 assert.ok(html.includes('下載備份'));
 assert.ok(!html.includes('本機錄音／待同步'));
 validDetails(html);
 const home=slice('function home(){','\nfunction booksPage(');
 assert.ok(home.indexOf('${pendingMarkup(true)}')>home.indexOf('<div class="rn-mini-list"'),
  'pending backups should be after the standard recordings, never ahead of them');
 const header=slice('function header(){','\n\nfunction localPlaceInfo(');
 assert.ok(!header.includes('待同步'));
});
test('never remove or retry ordinary saved local-library recordings as if they were pending',()=>{
 const safe=slice('async function clearPendingRecording(entry){','function pendingMarkup(');
 const retry=slice('async function retryPending(id){','function downloadPending(');
 assert.ok(safe.includes("entry?.storage==='local-library'"));
 assert.ok(retry.includes("x.storage!=='local-library'"));
});

test('mobile capture disables AEC and noise suppression and bypasses RecordNote voice DSP',async()=>{
 const section=slice('const RECORDING_MIN_DURATION_MS=3000;','\nfunction stopRecord()');
 async function captureWith(device){
  const stream={getTracks:()=>[{stop:()=>{}}]};
  const enhancedStream={getTracks:()=>[{stop:()=>{}}]};
  let constraints=null,encoder=null,dspCalls=0;
  class FakeMediaRecorder {
   static isTypeSupported(type){return type.startsWith('audio/mp4');}
   constructor(source,options){encoder={source,options};this.state='recording';}
   start(){}
  }
  const state={active:'book-1',rec:null,recordSeconds:0};
  const ctx={
   navigator:{userAgent:device.ua,platform:device.platform||'',
     maxTouchPoints:device.touches||0,
     userAgentData:device.uaMobile===undefined?undefined:{mobile:device.uaMobile},
     mediaDevices:{getUserMedia:async options=>{constraints=options.audio;return stream;}}},
   window:{MediaRecorder:FakeMediaRecorder,
     RecordNoteVoice:{attach:()=>{dspCalls++;return {stream:enhancedStream,ready:Promise.resolve(),close(){}};}},
     RecordNoteAudioMeter:{attach:()=>({stop(){}})}},
   MediaRecorder:FakeMediaRecorder,
   mdPolicyAtStart:()=>Promise.resolve({}),
   captureRecordingGPS:()=>Promise.resolve(null),
   setInterval:()=>1,render:()=>{},notice:()=>{},
   state,Promise,Date,Number,Object,String,Error,console
  };
  await runInNewContext(section+'\nstartRecord(false)',ctx);
  return {encoder,constraints,dspCalls,stream,enhancedStream};
 }
 for(const device of [
  {ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},
  {ua:'Mozilla/5.0 (Linux; Android 15; Pixel 8)'},
  {ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',touches:5}
 ]){
  const r=await captureWith(device);
  assert.equal(r.constraints.sampleRate.ideal,22050);
  assert.equal(r.constraints.channelCount.ideal,1);
  assert.equal(r.constraints.echoCancellation,false);
  assert.equal(r.constraints.noiseSuppression,false);
  assert.equal(r.encoder.options.audioBitsPerSecond,48000);
  assert.equal(r.encoder.source,r.stream);
  assert.equal(r.dspCalls,0);
 }
 const desktop=await captureWith({ua:'Mozilla/5.0 (X11; Linux x86_64) Chrome/133',uaMobile:false});
 assert.equal(desktop.constraints.echoCancellation,true);
 assert.equal(desktop.constraints.noiseSuppression,true);
 assert.equal(desktop.encoder.options.audioBitsPerSecond,64000);
 assert.equal(desktop.encoder.source,desktop.enhancedStream);
 assert.equal(desktop.dspCalls,1);
});
