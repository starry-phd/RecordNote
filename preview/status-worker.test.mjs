import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './status-worker.mjs';
const request=(path,method='GET')=>worker.respond(new Request('https://preview.example.test'+path,{method}));
test('homepage is an honest noindex noninteractive preview',async()=>{
 const r=await request('/');const s=await r.text();
 assert.equal(r.status,200);assert.match(s,/尚未正式上線/);assert.match(s,/不是可使用的錄音 App/);
 assert.match(r.headers.get('content-security-policy'),/form-action 'none'/);
 assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
});
test('health does not pretend service is ready',async()=>{
 const r=await request('/healthz'),d=await r.json();
 assert.equal(d.ready,false);assert.equal(d.recording,false);assert.equal(d.billing,false);
});
test('writes and private routes stay blocked',async()=>{
 assert.equal((await request('/api/courses')).status,404);
 assert.equal((await request('/api/upload','POST')).status,405);
 assert.equal((await request('/api/billing','PUT')).status,405);
});
test('robots disallow all indexing',async()=>{
 const r=await request('/robots.txt');
 assert.match(await r.text(),/Disallow: \/$/m);
});
