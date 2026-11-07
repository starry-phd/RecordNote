import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext,runInContext} from 'node:vm';

const input=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const result=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(input);
assert.ok(result,'RecordNote Web page must be embedded');
const html=JSON.parse(result[1]);
const script=html.split('<script type="module">')[1]?.split('</script>')[0];
assert.ok(script,'Main app script must exist');

test('full browser module syntax parses after Passkey and notice updates',()=>{
 assert.doesNotThrow(()=>new Script(script));
});

test('Starry Web login uses central Passkey challenge and signed assertion, never own credentials',()=>{
 assert.match(script,/\/v1\/auth\/passkey\/options/);
 assert.match(script,/navigator\.credentials\.get/);
 assert.match(script,/\/v1\/auth\/passkey'/);
 assert.match(script,/consent_required/);
 assert.match(script,/rpId!=='id\.starry\.phd'/);
 assert.match(script,/\/v1\/me\/passkeys\/options/);
 assert.match(script,/navigator\.credentials\.create/);
 assert.match(script,/\/v1\/me\/passkeys/);
 assert.match(script,/encodeURIComponent\(id\)/);
 assert.ok(!script.includes('STARRY_BATTERY_KEY'));
});

test('Passkey sign-in hidden in unsupported browsers but Google and Apple remain',()=>{
 assert.match(script,/typeof window\.PublicKeyCredential==='function'/);
 assert.match(script,/data-action="loginGoogle"/);
 assert.match(script,/data-action="loginApple"/);
 assert.match(script,/data-action="signInPasskey"/);
 assert.match(script,/name==='NotAllowedError'/);
 assert.match(script,/name==='InvalidStateError'/);
 assert.match(script,/請改用 Apple 或 Google 登入/);
});

test('WebAuthn challenge and credential IDs use base64url decoding and RP is strictly central',()=>{
 const start=script.indexOf('function passkeyBytes(value){');
 const end=script.indexOf('function passkeyFriendlyError(error){',start);
 assert.ok(start>=0&&end>start);
 const context=createContext({Uint8Array,atob,btoa,Error,String,Number,Array});
 runInContext(script.slice(start,end),context);
 const raw={publicKey:{challenge:'AQIDBA',rpId:'id.starry.phd',userVerification:'required',
   allowCredentials:[{type:'public-key',id:'BQYH'}]}};
 context.raw=raw;
 const key=runInContext('passkeyPublicKey(raw,false)',context);
 assert.deepEqual(Array.from(key.challenge),[1,2,3,4]);
 assert.deepEqual(Array.from(key.allowCredentials[0].id),[5,6,7]);
 assert.equal(runInContext('passkeyEncoded(new Uint8Array([1,2,3,4]).buffer)',context),'AQIDBA');
 assert.throws(()=>runInContext("passkeyPublicKey({publicKey:{...raw.publicKey,rpId:'recordnote.starry.phd'}},false)",context),/INVALID_PASSKEY_RP_ID/);
 context.createRaw={publicKey:{challenge:'AQIDBA',rp:{id:'id.starry.phd',name:'Starry ID'},user:{id:'BQYH',name:'test',displayName:'test'}}};
 const registration=runInContext('passkeyPublicKey(createRaw,true)',context);
 assert.deepEqual(Array.from(registration.user.id),[5,6,7]);
});

test('App config is refreshed on foreground, notices only inserted through textContent',()=>{
 assert.match(script,/document\.addEventListener\('visibilitychange'/);
 assert.match(script,/window\.addEventListener\('focus'/);
 assert.match(script,/60000/);
 assert.match(script,/recordnoteStartupGate/);
 assert.match(script,/recordnoteActiveNotices/);
 assert.match(script,/\.textContent=message/);
 assert.match(script,/root\.textContent=gate\.message/);
 assert.ok(!/innerHTML\s*=\s*[^;]*message/.test(script));
});

test('Support URL is fixed to Starry ID with app_id, version and generic device only',()=>{
 const start=script.indexOf('function recordnoteSupportUrl(){');
 const end=script.indexOf('function settings(){',start);
 assert.ok(start>=0&&end>start);
 const ctx=createContext({URL,ID:'https://id.starry.phd',APP_ID:'recordnote',config:{appVersion:'0.1.0'},RECORDNOTE_APP_VERSION:'0.0.0',String});
 runInContext(script.slice(start,end),ctx);
 const link=new URL(runInContext('recordnoteSupportUrl()',ctx));
 assert.equal(link.origin,'https://id.starry.phd');
 assert.equal(link.pathname,'/support');
 assert.equal(link.searchParams.get('app_id'),'recordnote');
 assert.equal(link.searchParams.get('app_version'),'0.1.0');
 assert.equal(link.searchParams.get('device'),'網頁瀏覽器');
 assert.equal([...link.searchParams.keys()].length,3);
});

test('No RevenueCat products are added without Owner catalog registration',()=>{
 assert.ok(!script.includes('RevenueCat.purchasePackage('));
 assert.ok(!script.includes('recordnote.quantum.sku'));
});
