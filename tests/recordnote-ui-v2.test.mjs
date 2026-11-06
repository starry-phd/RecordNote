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
test('home keeps big record and hides import actions in More',()=>{
 const html=execute('home','function home(){','\nfunction booksPage(',{
  allRecordings:()=>[],recordingTile:()=>'',banner:()=>'',pendingMarkup:()=>'',playerMarkup:()=>'',state:{busy:false,rec:null}
 });
 assert.ok(html.includes('data-action="quickRecord"'));
 assert.ok(html.includes('data-ui-key="home-actions"'));
 assert.ok(html.includes('data-action="importOpen"'));validDetails(html);
});
test('record card primary Play and Share, all legacy actions available only after expansion',()=>{
 const m={id:'media-1',original_name:'20261107.m4a',course_id:'book-1',duration_seconds:5,bytes:44032,localOnly:true,gps:{lat:24.59939,lon:120.77735,accuracy:20}};
 const html=execute('recordingTile(m)','function recordingTile(m){','\nfunction showRecordingLocation(',{
  m,state:{shareLoading:null,mode:'live'},currentCourses:()=>[{id:'book-1',title:'未分類'}],
  cloudSynced:()=>false,playbackClock:()=> '00:00:05',recordingDate:()=> '2026/11/07',
  recordingPlace:()=> 'GPS',recordingFormat:()=> 'M4A',prettySize:()=> '43 KB',
  localPlaceInfo:()=>({}),e
 });
 const first=html.slice(0,html.indexOf('<details class="rn-disclosure rn-record-more"'));
 for(const a of ['playMedia','shareMediaFile'])assert.ok(first.includes('data-action="'+a+'"'));
 for(const a of ['editAudio','downloadMedia','syncLocal','editLocationName','resolveSavedRecordingGpsPlace','showRecordingLocation','deleteMedia']){
  assert.ok(html.includes('data-action="'+a+'"'),'missing '+a);
  assert.ok(!first.includes('data-action="'+a+'"'),'not hidden: '+a);
 }
 assert.ok(html.includes('data-move-audio="media-1"'));validDetails(html);
});
test('settings account and location first; advanced options hidden, including deletion',()=>{
 const base={state:{mode:'live',uploadPolicy:{can_manage:true,max_file_mb:200},storageFolderName:'下載',pending:[]},
  readNameRule:()=>({prefix:'RecordNote',date:true,time:true,counter:true}),
  banner:()=>'',e,ID:'https://id.starry.phd',gpsOptIn:()=>true,mdGeoOptIn:()=>true,
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
