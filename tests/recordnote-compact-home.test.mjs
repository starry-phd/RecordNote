import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const literal=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(source);
assert.ok(literal);
const page=JSON.parse(literal[1]);
function section(start,end){const a=page.indexOf(start),b=page.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Missing section '+start);return page.slice(a,b);}
function run(code,expr,ctx){return runInNewContext(code+'\n'+expr,ctx)}
const helpers=section('function compactRecordingPlace(m){','function recordingTile(m){');

test('accurate place display keeps finest known field but never invents township locality',()=>{
 const get=x=>run(helpers,'compactRecordingPlace({id:"x"})',{recordingPlace:()=>x});
 assert.equal(get('苗栗縣後龍鎮龍坑里・十班坑附近'),'十班坑附近');
 assert.equal(get('苗栗縣後龍鎮龍坑里'),'龍坑里');
 assert.equal(get('苗栗縣後龍鎮'),'');
 assert.equal(get('GPS 24.59939,120.77735（地名待辨識）'),'');
 assert.equal(get('苗栗縣後龍鎮附近（大略位置）'),'大略位置');
});
test('time and duration are compact; default filename no longer duplicates long date',()=>{
 const ctx={recordingDate:()=> '2026/11/07 02:10:24',playbackClock:()=> '00:00:05'};
 assert.equal(run(helpers,'compactRecordingTime({})',ctx),'11/07 02:10');
 assert.equal(run(helpers,'compactRecordingDuration(5)',ctx),'00:05');
 assert.equal(run(helpers,'recordingCompactName({original_name:"RecordNote-20261107-021024-007.m4a"})',ctx),'錄音 007');
 assert.equal(run(helpers,'recordingCompactName({original_name:"我的會議.m4a"})',ctx),'我的會議.m4a');
});
test('import flag requires explicit source or recognizable old import naming',()=>{
 assert.equal(run(helpers,'isImportedRecording({original_name:"meeting.m4a",imported:true})',{}),true);
 assert.equal(run(helpers,'isImportedRecording({original_name:"meeting.m4a"})',{}),false);
 assert.equal(run(helpers,'isImportedRecording({original_name:"匯入-123.m4a"})',{}),true);
});
test('quick recording chooses book without moving to course view',async()=>{
 const state={view:'home',mode:'live',active:null,token:'token',consentRequired:false},course={id:'book-1',is_system:1};
 let navigations=0;
 await run(section('async function ensureQuickCourse(){','async function quickRecord(){'),'ensureQuickCourse()',{
  state,currentCourses:()=>[course],openCourse:async()=>{navigations++;}
 });
 assert.equal(state.active,'book-1');assert.equal(state.view,'home');assert.equal(navigations,0);
});
test('home record button stops current session instead of navigating',async()=>{
 let stops=0,starts=0;
 const state={view:'home',rec:{}};
 const code=section('async function quickRecord(){','async function startRecord(');
 const ctx={state,stopRecord:()=>{stops++},startRecord:async b=>{assert.equal(b,true);starts++}};
 await run(code,'quickRecord()',ctx);assert.equal(stops,1);assert.equal(starts,0);
 state.rec=null;await run(code,'quickRecord()',ctx);assert.equal(starts,1);assert.equal(state.view,'home');
});
test('local rename only changes persistent filename metadata, never Blob bytes',async()=>{
 const blob=new Blob(['safe audio'],{type:'audio/mp4'});
 const old={id:'audio-1',storage:'local-library',name:'Old.m4a',file:blob,imported:true};
 let saved;
 const ctx={demoMedia:()=>({id:'audio-1',kind:'audio',original_name:'Old.m4a',localOnly:true}),
  prompt:()=> '新錄音',recordingCompactName:()=> 'Old.m4a',Blob,state:{mode:'demo'},
  window:{RecordNoteOffline:{get:async()=>old,save:async x=>{saved=x}}},
  loadLocalMedia:async()=>{},render:()=>{},notice:()=>{}};
 await run(section('async function renameRecording(id){','async function editMediaAudio(id){'),
 'renameRecording("audio-1")',ctx);
 assert.equal(saved.name,'新錄音.m4a');assert.strictEqual(saved.file,blob);
 assert.equal(saved.imported,true);assert.equal(await saved.file.text(),'safe audio');
});
test('cloud-only rename calls existing single-item metadata API, no audio R2 overwrite',async()=>{
 let request;
 const ctx={demoMedia:()=>({id:'cloud-1',kind:'audio',original_name:'old.m4a',localOnly:false}),
  prompt:()=> 'new',recordingCompactName:()=> 'old.m4a',state:{mode:'live'},api:async(path,opt)=>{request={path,body:JSON.parse(opt.body)};return {success_count:1,failure_count:0}},
  refreshHomeRecordings:async()=>{},render:()=>{},notice:()=>{}};
 await run(section('async function renameRecording(id){','async function editMediaAudio(id){'),
 'renameRecording("cloud-1")',ctx);
 assert.equal(request.path,'/v1/media/batch');
 assert.equal(request.body.action,'rename');
 assert.equal(request.body.ids[0],'cloud-1');
 assert.equal(request.body.name,'new.m4a');
 assert.equal(request.body.numbered,false);
});
test('future imported files persist source across offline save and cloud sync',()=>{
 const local=section('function localMediaItem(entry){','async function syncLocalMedia(');
 assert.ok(local.includes('imported:entry.imported===true'));
 assert.ok(local.includes('imported:imported===true'));
 assert.ok(page.includes('options.imported===true'));
 assert.ok(section('async function importFileSelected(file){','async function importUrlSubmitted(').includes('imported:true'));
 assert.ok(page.includes('recordingOrigin:m.recordingOrigin||null,imported:m.imported===true'));
});
test('mobile CSS targets seven compact rows on typical-height screens',()=>{
 const style=page.slice(page.indexOf('<style>'),page.indexOf('</style>'));
 assert.ok(style.includes('RecordNote UI v3: two-line compact home recordings'));
 assert.ok(style.includes('min-height:62px'));
 assert.ok(style.includes('.rn-mini-line1'));
 assert.ok(style.includes('.rn-mini-line2'));
 assert.ok(style.includes('.rn-mini-more>summary'));
 assert.ok(7*(62+4)+51 <= 525);
});
test('home renders 9 rows without redundant section headings',()=>{
 const html=run(section('function home(){','\nfunction booksPage('),'home()',{
  state:{rec:null,busy:false,cloudHomeError:false},allRecordings:()=>Array.from({length:9},(_,i)=>({id:String(i)})),
  recordingTile:x=>'<article data-record-id="'+x.id+'"></article>',banner:()=>'',playerMarkup:()=>'',pendingMarkup:()=>'',clock:()=> '00:05'
 });
 assert.equal((html.match(/data-record-id=/g)||[]).length,9);
 assert.ok(html.includes('data-action="quickRecord"'));
 assert.ok(html.includes('rn-mini-list'));
 assert.ok(!html.includes('<h1>我的錄音</h1>'));
 assert.ok(!html.includes('錄音紀錄</h2>'));
});
