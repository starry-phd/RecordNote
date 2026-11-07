import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sdk=read('vendor/starry-id/starry-client.ts');
const app=read('native/App.tsx');
const auth=read('expo/RecordNoteStarryAuth.ts');
const bridge=read('native/StarrySharedSso.ts');
const config=JSON.parse(read('native/app.json')).expo;
const nativeModuleConfig=JSON.parse(read('native/modules/starry-shared-sso/expo-module.config.json'));
const ios=read('native/modules/starry-shared-sso/ios/StarrySharedSsoModule.swift');
const json=JSON.parse(read('vendor/starry-id/starry-id.v1.json'));

test('Vendored central v12 SDK and OpenAPI support all 4 SSO routes',()=>{
 const s=JSON.stringify(json);
 for(const uri of ['/v1/auth/sso/start','/v1/auth/sso/exchange','/v1/auth/sso/status','/v1/auth/sso/logout'])
  assert.ok(s.includes(uri),uri);
 for(const method of ['async syncDeviceSignIn()','async signOut(','sharedStorage?: StarryStorage','/v1/auth/sso/start','/v1/auth/sso/exchange','/v1/auth/sso/status','/v1/auth/sso/logout'])
  assert.ok(sdk.includes(method),method);
});
test('Native Client passes one secure device-shared storage adapter, not a fake local Store',()=>{
 assert.ok(auth.includes("sharedStorage:Device.osName==='iOS'?sharedSsoStorage:undefined"));
 assert.match(bridge,/requireNativeModule<NativeSso>\('StarrySharedSso'\)/);
 assert.ok(!bridge.includes('SecureStore.getItemAsync'));
 assert.ok(!auth.includes('請重新登入（10 分鐘內）'));
 assert.ok(app.includes('登入後隨時可以新增'));
 assert.ok(app.includes('登出所有繁星 App'));
 assert.ok(app.includes("if(gateState.current?.state==='ok')await syncMember()"));
 assert.ok(app.includes('restoreSignIn()'));
 assert.ok(app.includes('setUser(null)'));
});
test('v14 Android shared SSO is optional, not registered and not a release blocker',()=>{
 assert.ok(!config.plugins.includes('./plugins/withStarrySsoProvider'));
 assert.deepEqual(nativeModuleConfig.platforms,['ios']);
 assert.equal(nativeModuleConfig.android,undefined);
 assert.ok(auth.includes("Device.osName==='iOS'?sharedSsoStorage:undefined"));
 assert.ok(bridge.includes("const native=()=>requireNativeModule"));
});
test('iOS shared Keychain group derives its prefix from signing entitlements',()=>{
 assert.deepEqual(config.ios.entitlements['keychain-access-groups'],
  ['$(AppIdentifierPrefix)phd.starry.shared']);
 assert.ok(ios.includes('SecTaskCopyValueForEntitlement'));
 assert.ok(ios.includes('kSecAttrAccessGroup'));
 assert.ok(ios.includes('kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly'));
 assert.ok(!ios.includes('4W7QRTXN5Y'));
});
const js=ts.transpileModule(sdk,{
 fileName:'starry-client.ts',
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
 reportDiagnostics:true
});
assert.ok(!js.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error));
const {StarryClient}=await import('data:text/javascript;base64,'+Buffer.from(js.outputText).toString('base64'));
const mkStorage=map=>({get:k=>map.get(k)??null,set:(k,v)=>{map.set(k,v);},remove:k=>{map.delete(k);}});
function access(sub){
 const payload=Buffer.from(JSON.stringify({sub})).toString('base64url');
 return 'eyJhbGciOiJFUzI1NiJ9.'+payload+'.signature';
}
function fakeServer(){
 const calls=[];
 let current='member-a',active=true,sequence=0;
 const fetch=async(url,init)=>{
  const path=new URL(url).pathname;
  const body=init.body?JSON.parse(init.body):{};
  calls.push({path,method:init.method,body,hasAuthorization:Boolean(init.headers?.authorization)});
  const ok=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{
   status,headers:{'content-type':'application/json'}});
  if(path==='/v1/auth/google')return ok({access_token:access(current),expires_in:3600,refresh_token:'refresh-a',user:{user_id:current},consent_required:false});
  if(path==='/v1/auth/sso/start')return ok({sso_token:'device-sso-'+(++sequence)});
  if(path==='/v1/auth/sso/status')return ok({active,user_id:current});
  if(path==='/v1/auth/sso/exchange')return ok({access_token:access(current),expires_in:3600,refresh_token:'refresh-b',user:{user_id:current},consent_required:false});
  if(path==='/v1/auth/logout'||path==='/v1/auth/sso/logout')return ok(null,204);
  if(path==='/v1/auth/refresh')return ok({access_token:access(current),expires_in:3600,refresh_token:'refreshed'});
  throw Error('Unexpected central route '+path);
 };
 return {calls,fetch,setMember:x=>{current=x;},setActive:x=>{active=x;}};
}
test('Official SDK SSO: first login -> shared token -> another App exchanges -> logout clears token',async()=>{
 const host=fakeServer(),shared=new Map(),localA=new Map(),localB=new Map();
 const opts={baseUrl:'https://id.starry.phd',appId:'recordnote',fetch:host.fetch,sharedStorage:mkStorage(shared)};
 const a=new StarryClient({...opts,storage:mkStorage(localA)});
 await a.signInWithIdToken('google',{idToken:'provider-id-token',nonce:'nonce'});
 assert.ok(shared.get('starry.sso')?.startsWith('device-sso-'));
 assert.equal(host.calls.filter(c=>c.path==='/v1/auth/sso/start').length,1);
 const b=new StarryClient({...opts,storage:mkStorage(localB)});
 assert.equal(await b.restore(),true);
 assert.equal(host.calls.filter(c=>c.path==='/v1/auth/sso/exchange').length,1);
 assert.equal(await b.getAccessToken(),access('member-a'));
 host.setMember('member-b');
 assert.equal(await a.syncDeviceSignIn(),true);
 assert.equal(await a.getAccessToken(),access('member-b'));
 await a.signOut();
 assert.equal(shared.has('starry.sso'),false);
 assert.equal(localA.has('starry.refresh.recordnote'),false);
 assert.equal(host.calls.filter(c=>c.path==='/v1/auth/sso/logout').length,1);
});
