import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pkg=JSON.parse(read('native/package.json'));
const cfg=JSON.parse(read('native/app.json')).expo;
const app=read('native/App.tsx');
const adapter=read('expo/RecordNoteStarryAuth.ts');
const entry=read('native/index.js');
const metro=read('native/metro.config.cjs');
const tsconfig=JSON.parse(read('native/tsconfig.json'));

test('Native acceptance screen compiles as TypeScript JSX and uses a development build',()=>{
 const result=ts.transpileModule(app,{fileName:'native/App.tsx',reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});
 assert.equal(result.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 assert.equal(pkg.main,'index.js');
 assert.match(pkg.dependencies.expo,/^~58/);
 assert.equal(pkg.dependencies['react-native'],'0.88.1');
 for(const dep of ['react-native-passkey','expo-dev-client','expo-secure-store','expo-device','expo-crypto'])
  assert.ok(pkg.dependencies[dep],dep);
 assert.ok(entry.includes('registerRootComponent(App)'));
 assert.ok(entry.includes('fast-text-encoding'));
 assert.ok(metro.includes('config.watchFolders'));
 assert.ok(tsconfig.compilerOptions.paths['react-native-passkey']);
});
test('Native App IDs and central Passkey domain match registered app; no unsafe auth shortcuts',()=>{
 assert.equal(cfg.scheme,'recordnote');
 assert.equal(cfg.ios.bundleIdentifier,'phd.starry.recordnote');
 assert.equal(cfg.android.package,'phd.starry.recordnote');
 assert.ok(cfg.ios.associatedDomains.includes('webcredentials:id.starry.phd'));
 assert.equal(cfg.extra.starryAppId,'recordnote');
 assert.ok(!app.includes('STARRY_BATTERY_KEY'));
 assert.ok(!app.includes('RevenueCat'));
 assert.ok(!app.includes('GoogleSignin'));
 assert.ok(!app.includes('expo-apple-authentication'));
});
test('Native UI exposes provider relay, Passkey and centralized account actions',()=>{
 for(const term of ["login('google')","login('apple')","signInWithProvider(provider)",
  'signInWithPasskey()','Passkey.isSupported()','acceptConsent()','addPasskey(',
  'listPasskeys()','removePasskey(','clearLocalSignIn()','deleteAccount()','supportUrl(',
  "confirmText.trim()!=='DELETE'","Passkey","不會自動取消 App Store／Google Play 訂閱"]){
  assert.ok(app.includes(term),term);
 }
 assert.ok(adapter.includes('starryClient.signInWithRelay'));
 assert.ok(adapter.includes('recordnote://auth/'));
 assert.ok(adapter.includes('randomState:()=>Crypto.randomUUID()'));
 assert.ok(adapter.includes('SecureStore'));
});
test('Central remote gate, foreground throttle and safe user guidance are present',()=>{
 for(const term of ["AppState.addEventListener('change'","FOREGROUND_INTERVAL_MS=60000",
  'checkApp(VERSION)',"current.state!=='ok'","maintenance","killed","update_required","unreachable",
  'n.message','Android Passkey 必須先']){
  assert.ok(app.includes(term),term);
 }
});
test('Native Passkey error normalization: cancellation silent and no-credential guidance',()=>{
 const start=adapter.indexOf('function nativePasskeyFailure(');
 const end=adapter.indexOf('const passkey={',start);
 assert.ok(start>0&&end>start);
 const js=ts.transpileModule(adapter.slice(start,end),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 const ctx=createContext({Error,String});
 runInContext(js,ctx);
 for(const [raw,normalized] of [['UserCancelled','UserCancelled'],
  ['NoCredentials','NotFoundError'],['CredentialAlreadyExists','InvalidStateError'],
  ['BadConfiguration','SecurityError']]){
  assert.throws(()=>runInContext("nativePasskeyFailure({error:'"+raw+"'})",ctx),
   error=>error?.name===normalized);
 }
});
