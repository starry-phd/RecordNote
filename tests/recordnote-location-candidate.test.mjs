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
