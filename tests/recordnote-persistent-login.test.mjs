import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const input=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const literal=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(input);
assert.ok(literal);
const page=JSON.parse(literal[1]);
const official=readFileSync(new URL('../vendor/starry-id/starry-client.ts',import.meta.url),'utf8');
test('Official v9 frontend client compiles and coalesces refreshes',()=>{
 const c=ts.transpileModule(official,{fileName:'starry-client.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
 assert.equal(c.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 assert.ok(official.includes('this.refreshing ??= this.doRefresh().finally'));
 assert.ok(official.includes("this.key('refresh')"));
 assert.ok(official.includes("async beginRelayRedirect("));
 assert.ok(official.includes("async completeRelayRedirect("));
});
test('Legacy browser token is moved once into sessionStorage, not retained persistently',()=>{
 assert.ok(page.includes("const key='starry.refresh.'+APP_ID"));
 assert.ok(page.includes("sessionStorage.setItem(key,old)"));
 assert.ok(page.includes("localStorage.removeItem(KEY_REFRESH)"));
 assert.ok(!page.includes('localStorage.setItem(KEY_REFRESH'));
 assert.ok(page.includes('storage:sessionStorageAdapter()'));
});
test('Web uses official relay and token instead of reimplementing rotation',()=>{
 for(const method of ['beginRelayRedirect','completeRelayRedirect','getAccessToken','signInWithPasskey','registerPasskey','listPasskeys','removePasskey','acceptConsent','signOutWebEverywhere','shareWebSignIn','syncWebSignIn','completeWebSsoCheck','checkApp']){
  assert.ok(page.includes('starryClient.'+method+'('),'Missing '+method);
 }
 assert.ok(!page.includes("fetch('https://id.starry.phd/v1/auth/refresh'"));
 assert.ok(page.includes("window.addEventListener('online',()=>{void recordnoteForegroundCheck();})"));
 assert.ok(page.includes("window.addEventListener('focus',()=>{void recordnoteForegroundCheck();})"));
 assert.ok(page.includes('mobileCapture?48000:64000'));
 assert.ok(page.includes('mobileCapture?stream:voice.stream'));
});
