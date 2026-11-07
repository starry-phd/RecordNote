import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../cloudflare-candidate/recordnote-unified.mjs';

const source=readFileSync(new URL('../cloudflare-candidate/recordnote-unified.mjs',import.meta.url),'utf8');
const web=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const api=readFileSync(new URL('../cloudflare-candidate/recordnote-worker.js',import.meta.url),'utf8');

test('one deployable Worker owns both existing API and Web without importing another Worker',()=>{
 assert.equal(source.match(/export default/g)?.length,1);
 assert.ok(source.includes('const recordnoteApi = (() => {'));
 assert.ok(source.includes('const recordnoteWeb = (() => {'));
 assert.ok(source.includes("pathname.startsWith('/vendor/ffmpeg/')"));
 assert.ok(source.includes("pathname==='/admin/metadata'"));
 assert.ok(!source.includes('env.FRONTEND_SERVICE.fetch'));
 assert.ok(!source.includes('env.API_SERVICE.fetch'));
 assert.ok(source.length>100000,'Unified bundle must include substantial original Web and API logic');
});

test('production site homepage and admin assets are served directly on the API Worker',async()=>{
 for(const path of ['/','/index.html']){
  const response=await worker.fetch(new Request('https://recordnote.starry.phd'+path),{});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/text\/html/);
  const html=await response.text();
  assert.ok(html.includes('RecordNote'));
  assert.ok(html.includes("apiBase: window.location.origin"),'the web must use this Worker as its API');
  assert.ok(html.includes('永久刪除中央帳號'));
 }
 const metadata=await worker.fetch(new Request('https://recordnote.starry.phd/admin/metadata'),{});
 assert.equal(metadata.status,200);
 assert.match(metadata.headers.get('content-type'),/text\/html/);
 const code=await worker.fetch(new Request('https://recordnote.starry.phd/assets/m4a-mdta.mjs'),{});
 assert.equal(code.status,200);
 assert.match(code.headers.get('content-type'),/javascript/);
});

test('API health and OPTIONS remain handled by backend and keep the original D1/R2 bindings',async()=>{
 let count=0,files=0;
 const env={
  AI_ENABLED:'false',
  DB:{prepare:sql=>{assert.match(sql,/SELECT COUNT/);return {first:async()=>{count++;return {n:2}}}}},
  MEDIA:{list:async()=>{files++;return {objects:[]}}}
 };
 const response=await worker.fetch(new Request('https://recordnote-api.starry.phd/health'),env);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.ok,true);
 assert.equal(body.service,'RecordNote');
 assert.equal(body.d1,true);assert.equal(body.r2,true);
 assert.equal(count,1);assert.equal(files,1);
 const options=await worker.fetch(new Request('https://recordnote.starry.phd/v1/courses',{method:'OPTIONS'}),env);
 assert.equal(options.status,204);
});

test('unknown URLs do not return the website shell as a fallback API response',async()=>{
 const resp=await worker.fetch(new Request('https://recordnote.starry.phd/v1/nonexistent'),{});
 assert.equal(resp.status,401); // Existing backend authenticates every /v1/* request first.
 assert.match(resp.headers.get('content-type')||'',/json/);
 const body=await resp.json();
 assert.ok(body.error);
});

test('web assets still use same-origin URLs and no extra Worker in production',()=>{
 assert.ok(source.includes('apiBase: window.location.origin'));
 assert.ok(!source.includes('recordnote-web.workers.dev'));
 assert.ok(source.includes("const website = pathname==='/'"));
 assert.ok(web.includes("apiBase: 'https://recordnote-api.starry.phd'") || web.includes("recordnote-api.starry.phd"));
});
