import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
const api=readFileSync(new URL('../cloudflare-candidate/recordnote-worker.js',import.meta.url),'utf8');
const web=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const baselineApi=readFileSync(new URL('../cloudflare-baseline/recordnote-worker.js',import.meta.url),'utf8');
const baselineWeb=readFileSync(new URL('../cloudflare-baseline/recordnote-web.mjs',import.meta.url),'utf8');
const pageMatch=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(web);
assert.ok(pageMatch,'serialized Web PAGE exists');
const page=JSON.parse(pageMatch[1]);
test('both Cloudflare candidate scripts are syntactically valid',()=>{
 for(const file of ['cloudflare-candidate/recordnote-worker.js','cloudflare-candidate/recordnote-web.mjs']){
  execFileSync(process.execPath,['--check',file],{cwd:new URL('..',import.meta.url)});
 }
});
test('HTML inline JavaScript parses as modules without executing it',()=>{
 const matches=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
 assert.ok(matches.length>=3,'expected inline scripts in real page');
 for(const code of matches)execFileSync(process.execPath,['--check','--input-type=module'],{input:code,timeout:15000,maxBuffer:1024*1024});
});
test('location change is based on unchanged production baselines',()=>{
 assert.ok(baselineApi.includes('https://api.nlsc.gov.tw'));
 assert.ok(baselineWeb.includes("api('/v1/location/reverse'"));
 assert.ok(!api.includes('https://api.nlsc.gov.tw'));
 assert.ok(api.includes('LOCATION_PROVIDER_MOVED_TO_CENTRAL_SERVICE'));
 assert.ok(api.includes("'Geoapify','manual'"));
 assert.ok(api.includes('o.client_recording_id,o.recorded_at_ms'));
});
test('recording stop cannot issue third-party location HTTP requests or wait for a GPS fix',()=>{
 const start=page.indexOf('async function mdPlaceName(gps,policy){'),end=page.indexOf('function mdValues(',start);
 assert.ok(start>0&&end>start);
 const fn=page.slice(start,end);
 assert.ok(!/fetch\s*\(|authenticated\s*\(|api\s*\(/.test(fn));
 assert.ok(!page.includes('const gps=await gpsPromise'));
 assert.ok(!page.includes("api('/v1/location/reverse'"));
 assert.ok(page.includes('let capturedGps=null;void captureRecordingGPS().then('));
});
test('Geoapify opt-in is new, scoped and never inherits old government consent',()=>{
 assert.ok(page.includes("recordnote.location.geoapify.optin.v2"));
 assert.ok(page.includes('function mdGeoConsentKey()'));
 assert.ok(page.includes('LOCATION_SERVICE_URL'));
 assert.ok(page.includes('location_consent:true'));
 assert.ok(!page.includes("recordnote.location.reverse.optin.v1"));
 assert.ok(page.includes('data-action="lookupGeoapify"'));
 assert.ok(page.includes('data-action="forceGeoapify"'));
 assert.ok(page.includes('data-action="clearGeoapifyCache"'));
 assert.ok(web.includes("https://location.starry.phd https://id.starry.phd"));
});
test('persistent cache enforces Haversine/precision and shows attribution',()=>{
 assert.ok(page.includes('function mdGeoCacheKey()'));
 assert.ok(page.includes('mdGeoMeters(gps,x)'));
 assert.ok(page.includes('x.expires_at_ms<=now'));
 assert.ok(page.includes('Powered by'));
 assert.ok(page.includes('https://www.geoapify.com/'));
 assert.ok(page.includes('https://www.openstreetmap.org/copyright'));
 assert.ok(page.includes("location_source:gps?.position_mode==='manual'?'manual':placeName?'Geoapify':''"));
});

function readMapParser(){
 const begin=page.indexOf('function mdReadMapCoordinates(raw){');
 const end=page.indexOf('function mdApplyManualMap(){',begin);
 assert.ok(begin>0&&end>begin,'manual parser exists');
 return runInNewContext(page.slice(begin,end)+'\nmdReadMapCoordinates',{URL,Number,String,Math,Error});
}
test('manual coordinates accept Google Maps search URL and plain latitude/longitude without any Google API',()=>{
 const parse=readMapParser();
 const examples=[
  '24.59939, 120.77734',
  'https://www.google.com/maps/search/?api=1&query=24.59939%2C120.77734',
  'https://www.google.com/maps/place/example/data=!3d24.59939!4d120.77734',
 ];
 for(const item of examples){const p=parse(item);assert.equal(p.lat,24.59939);assert.equal(p.lon,120.77734);}
});
test('Google Maps center position is explicitly identified as center, not confirmed pin',()=>{
 const result=readMapParser()('https://www.google.com/maps/@24.59939,120.77734,17z');
 assert.equal(result.kind,'map-center');assert.equal(result.lat,24.59939);
});
test('untrusted URLs, Google short links, out-of-range coordinates and noncoordinates are rejected',()=>{
 const parse=readMapParser();
 for(const item of ['https://evil.example/maps/@24.59939,120.77734','https://maps.app.goo.gl/example','95,120','24,200','not a place']){
  assert.throws(()=>parse(item),Error);
 }
});
test('desktop mode permits stale or low-accuracy Wi-Fi while manual selection remains explicit',()=>{
 assert.ok(page.includes('maximumAge:desktop?Infinity:30000'));
 assert.ok(page.includes("position_mode:coarse?'approximate':'precise'"));
 assert.ok(page.includes("position_mode:mdDesktopLocation()&&(Number(p.coords.accuracy)>100||Date.now()-Number(p.timestamp)>300000)?'approximate':'precise'"));
 assert.ok(page.includes('accuracy>30000'));
 assert.ok(page.includes("source==='manual'"));
 assert.ok(page.includes("mdManualRecordEnabled()&&mdGeoOptIn()?mdManualPoint()||capturedGps:capturedGps"));
 assert.ok(page.includes('manualRecordEnabled'));
 assert.ok(page.includes('套用手動座標'));
 assert.ok(page.includes('辨識所選座標地名'));
 assert.ok(!page.includes('GPS 精度不足或座標已過期'));
});

test('desktop detection distinguishes Android, iPhone and iPad desktop-mode Safari',()=>{
 const begin=page.indexOf('function mdDesktopLocation(){');
 const end=page.indexOf('let mdGeoBusy=',begin);
 assert.ok(begin>0&&end>begin);
 const fn=page.slice(begin,end);
 const run=(ua,touches=0)=>runInNewContext(fn+'\nmdDesktopLocation()',{
  navigator:{userAgent:ua,maxTouchPoints:touches},Number
 });
 assert.equal(run('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit'),true);
 assert.equal(run('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome'),true);
 assert.equal(run('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile'),false);
 assert.equal(run('Mozilla/5.0 (Linux; Android 15) Mobile'),false);
 assert.equal(run('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit',5),false);
});
test('mobile renders no Google Maps manual coordinates controls and desktop retains them',()=>{
 const begin=page.indexOf('function settings(){'),end=page.indexOf('function dialog(){',begin);
 assert.ok(begin>=0&&end>begin,'settings renderer exists');
 const source=page.slice(begin,end);
 const base={state:{mode:'live',uploadPolicy:{can_manage:true,max_file_mb:200},storageFolderName:'下載'},
  readNameRule:()=>({prefix:'RecordNote',date:true,time:true,counter:true}),banner:()=>'',aiBatterySettings:()=>'',
  gpsOptIn:()=>true,mdGeoOptIn:()=>true,mdManualPoint:()=>null,
  mdGoogleMapsUrl:()=>'',mdManualRecordEnabled:()=>false,
  e:x=>String(x),ID:'https://id.starry.phd'};
 const mobile=runInNewContext(source+'\nsettings()', {...base,mdDesktopLocation:()=>false});
 assert.ok(mobile.includes('手機使用 GPS'));
 assert.ok(!mobile.includes('manualMapInput'));
 assert.ok(!mobile.includes('Google 地圖選點'));
 assert.ok(!mobile.includes('manualRecordEnabled'));
 const desktop=runInNewContext(source+'\nsettings()', {...base,mdDesktopLocation:()=>true});
 assert.ok(desktop.includes('manualMapInput'));
 assert.ok(desktop.includes('Google 地圖選點'));
 assert.ok(desktop.includes('lookupDesktopWifi'));
});
test('desktop prioritizes selected Google Maps coordinates, mobile disallows manual and uses high accuracy GPS',()=>{
 assert.ok(page.includes("if(desktop&&source==='device'&&mdManualPoint())source='manual'"));
 assert.ok(page.includes("if(source==='manual'&&!desktop)throw Error"));
 assert.ok(page.includes("if(source==='wifi'&&!desktop)throw Error"));
 assert.ok(page.includes("if(!mdDesktopLocation())return null;"));
 assert.ok(page.includes('if(!mdDesktopLocation())return false;'));
 assert.ok(page.includes('enableHighAccuracy:!desktop,timeout:12000'));
 assert.ok(page.includes('enableHighAccuracy:!mdDesktopLocation(),timeout:7000'));
 assert.ok(page.includes("mdDesktopLocation()&&mdManualRecordEnabled()&&mdGeoOptIn()?mdManualPoint()||capturedGps:capturedGps"));
});
test('new location cache version discards old township-only cached name without modifying recordings',()=>{
 assert.ok(page.includes("recordnote.location.geoapify.cache.v2"));
 assert.ok(page.includes('if(x.version!==2'));
 assert.ok(page.includes('const entry={version:2,lat:fix.lat'));
 assert.ok(page.includes("(!desktop&&entry.level==='administrative'?'（Geoapify 尚無此點的村里或小地名資料）':'')"));
 assert.ok(!page.includes("api('/v1/location/reverse'"));
});

test('same-place 24.59939,120.77735 saved recording reuses precise nearby Geoapify label despite GPS uncertainty',()=>{
 const begin=page.indexOf('function mdGeoCacheHit(gps){');
 const end=page.indexOf('function mdDesktopLocation()',begin);
 assert.ok(begin>0&&end>begin);
 const fixed=Date.now();
 const entry={version:2,lat:24.59939,lon:120.77734,accuracy_m:24,
  label:'苗栗縣後龍鎮龍坑里・十班坑附近',position_mode:'precise',level:'locality',
  source:'Geoapify',expires_at_ms:fixed+600000};
 const meters=(a,b)=>6371008.8*2*Math.asin(Math.min(1,
  Math.sqrt(Math.sin((b.lat-a.lat)*Math.PI/360)**2+
  Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*
  Math.sin((b.lon-a.lon)*Math.PI/360)**2)));
 const ctx={mdGeoEntries:()=>[entry],mdGeoMeters:meters,Date,Math,Number,String};
 const hit=runInNewContext(page.slice(begin,end)+'\nmdGeoCacheHit',{...ctx});
 assert.equal(hit({lat:24.59939,lon:120.77735,accuracy:26,position_mode:'precise'})?.label,entry.label);
 // Faraway fixes and very uncertain GPS must not inherit the detailed village.
 assert.equal(hit({lat:24.60539,lon:120.77735,accuracy:26,position_mode:'precise'}),null);
 assert.equal(hit({lat:24.59939,lon:120.77735,accuracy:200,position_mode:'precise'}),null);
 assert.equal(hit({lat:24.59939,lon:120.77735,accuracy:26,position_mode:'approximate'}),null);
});
test('saved recording details offer explicit GPS geocoding without background lookups or audio mutation',()=>{
 assert.ok(page.includes('data-action="resolveSavedRecordingGpsPlace"'));
 assert.ok(page.includes("case 'resolveSavedRecordingGpsPlace':await resolveSavedRecordingGpsPlace(id)"));
 const start=page.indexOf('async function resolveSavedRecordingGpsPlace(id){');
 const end=page.indexOf('async function editLocationName(id){',start);
 assert.ok(start>0&&end>start);
 const code=page.slice(start,end);
 assert.ok(code.includes("position_mode:'manual',location_consent:true"));
 assert.ok(code.includes("setLocalPlaceInfo(id,{name:label,source:'Geoapify'"));
 assert.ok(!/uploadFile\s*\(|saveLocalWebFile\s*\(|R2/.test(code));
 assert.ok(!page.slice(page.indexOf('function recordingPlace(m){'),page.indexOf('async function resolveSavedRecordingGpsPlace(id){')).includes('authenticated('));
});
test('M4A site bundle embeds the same fragment-safe metadata module and gives diagnostic codes',()=>{
 const original=readFileSync(new URL('../src/m4a-mdta.mjs',import.meta.url),'utf8');
 const encoded=/const MDTA_MODULE=("(?:\\.|[^"\\])*")/s.exec(web);
 assert.ok(encoded,'M4A module is inline in the real Cloudflare Worker');
 assert.equal(JSON.parse(encoded[1]),original);
 assert.ok(original.includes('FRAGMENT_ABSOLUTE_BASE_OFFSET'));
 assert.ok(original.includes('assertFragmentedSafe'));
 const start=page.indexOf('async function mdTagFutureWebRecording(');
 const body=page.slice(start,page.indexOf('const sampleCourses=',start));
 assert.ok(body.indexOf('try{')<body.indexOf('const values=mdValues('));
 assert.ok(body.includes("errorCode"));
 assert.ok(body.includes("return {file,status:'writer_failed',errorCode}"));
});
