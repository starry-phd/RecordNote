import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext,runInContext} from 'node:vm';
const source=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const match=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(source);
assert.ok(match);
const html=JSON.parse(match[1]);
const script=html.slice(html.indexOf('<script type="module">')+'<script type="module">'.length,html.lastIndexOf('</script>'));
const official=readFileSync(new URL('../vendor/starry-id/starry-client.ts',import.meta.url),'utf8');
test('Browser remains valid JavaScript and includes official client injection marker',()=>{
 assert.doesNotThrow(()=>new Script(script));
 assert.ok(script.includes('/* __RECORDNOTE_STARRY_CLIENT__ */'));
 assert.ok(official.includes('export class StarryClient'));
});
test('Passkey UI delegates login, register, list, remove to official Starry Client',()=>{
 for(const method of ['signInWithPasskey','registerPasskey','listPasskeys','removePasskey']){
  assert.ok(script.includes('starryClient.'+method+'('));
 }
 assert.ok(official.includes("'/v1/auth/passkey/options'"));
 assert.ok(official.includes("'/v1/me/passkeys/options'"));
 assert.ok(script.includes("typeof window.PublicKeyCredential==='function'"));
 assert.ok(script.includes('data-action="loginGoogle"'));
 assert.ok(script.includes('data-action="loginApple"'));
 assert.ok(script.includes('data-action="signInPasskey"'));
});
test('Passkey cancellation is silent; errors explain missing credentials and recent login',()=>{
 assert.ok(script.includes('error?.cancelled'));
 assert.ok(script.includes('REAUTH_REQUIRED'));
 assert.ok(script.includes('NotFoundError'));
 assert.ok(script.includes('InvalidStateError'));
});
test('Foreground gate preserves 60-second limit, plain text notices and visitor fallback',()=>{
 assert.ok(script.includes("document.addEventListener('visibilitychange'"));
 assert.ok(script.includes("window.addEventListener('focus'"));
 assert.ok(script.includes('60000'));
 assert.ok(script.includes('starryClient.checkApp(RECORDNOTE_APP_VERSION)'));
 assert.ok(script.includes('.textContent=message'));
 assert.ok(script.includes('root.textContent=gate.message'));
});
test('Customer support URL retains only app, version and generic device',()=>{
 const start=script.indexOf('function recordnoteSupportUrl(){');
 const end=script.indexOf('function settings(){',start);
 assert.ok(start>=0&&end>start);
 const ctx=createContext({URL,ID:'https://id.starry.phd',APP_ID:'recordnote',config:{appVersion:'0.1.0'},RECORDNOTE_APP_VERSION:'0.0.0',String});
 runInContext(script.slice(start,end),ctx);
 const link=new URL(runInContext('recordnoteSupportUrl()',ctx));
 assert.equal(link.origin,'https://id.starry.phd');
 assert.equal(link.pathname,'/support');
 assert.deepEqual([...link.searchParams.keys()],['app_id','app_version','device']);
 assert.equal(link.searchParams.get('app_version'),'0.1.0');
});
test('No unregistered payment products or frontend Battery service secrets',()=>{
 assert.ok(!script.includes('STARRY_BATTERY_KEY'));
 assert.ok(!script.includes('RevenueCat.purchasePackage('));
 assert.ok(!script.includes('recordnote.quantum.sku'));
});
