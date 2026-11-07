import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sdk=read('vendor/starry-id/starry-client.ts');
const web=read('cloudflare-candidate/recordnote-web.mjs');
const page=JSON.parse(/const PAGE=("(?:\\.|[^"\\])*")/s.exec(web)[1]);
const transpiled=ts.transpileModule(sdk,{fileName:'starry-client.ts',
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
 reportDiagnostics:true});
assert.ok(!transpiled.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error));
const {StarryClient}=await import('data:text/javascript;base64,'+Buffer.from(transpiled.outputText).toString('base64'));
function store(m){return {get:k=>m.get(k)??null,set:(k,v)=>{m.set(k,v)},remove:k=>{m.delete(k)}}}
function token(member){return 'header.'+Buffer.from(JSON.stringify({sub:member})).toString('base64url')+'.sig'}
function fakeServer(){
 const calls=[];let member='member-a';
 const response=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 const fetch=async(url,init={})=>{
  const path=new URL(url).pathname,body=init.body?JSON.parse(init.body):{};
  calls.push({path,body,auth:init.headers?.authorization});
  if(path==='/v1/auth/google')return response({access_token:token('member-a'),expires_in:3600,refresh_token:'refresh-a',user:{user_id:'member-a'},consent_required:false});
  if(path==='/v1/auth/sso/start')return response({sso_token:'test-sso-token'});
  if(path==='/v1/auth/sso/web-code')return response({code:'one-time-web-code'});
  if(path==='/v1/auth/nonce')return response({nonce:'random-nonce'});
  if(path==='/v1/auth/sso/web-exchange')return response({access_token:token(member),expires_in:3600,refresh_token:'refresh-'+member,user:{user_id:member},consent_required:false});
  if(path==='/v1/auth/logout')return response(null,204);
  throw Error('Unexpected central request: '+path);
 };
 return {fetch,calls,setMember:m=>{member=m}};
}
function client(env,storage,navigations){
 return new StarryClient({appId:'recordnote',baseUrl:'https://id.starry.phd',
  storage:store(storage),fetch:env.fetch,deviceLabel:'RecordNote Web',
  randomState:()=> 'random-state',sha256Hex:async()=> 'a'.repeat(64),
  navigate:url=>navigations.push(url),now:()=>1800000000000});
}
async function login(c){await c.signInWithIdToken('google',{idToken:'id-token',nonce:'n'})}
const returnUrl='https://recordnote.starry.phd/';

test('Web candidate wires all v14 official methods and leaves callback URL unfragmented',()=>{
 for(const s of ['starryClient.shareWebSignIn({returnUrl:webSsoReturnUrl()})',
  'starryClient.syncWebSignIn({returnUrl:webSsoReturnUrl()})',
  'starryClient.completeWebSsoCheck(location.href)',
  'starryClient.signOutWebEverywhere({returnUrl:webSsoReturnUrl()})',
  "return location.origin+location.pathname",
  '登出所有繁星 App']){
  assert.ok(page.includes(s),'Missing web SSO implementation: '+s);
 }
 assert.ok(!page.includes('重新登入 Starry ID（10 分鐘內）'));
});

test('Central SDK: sign-in adopts browser cookie using one-time code and no tokens in URL',async()=>{
 const server=fakeServer(),storage=new Map(),nav=[];
 const c=client(server,storage,nav);await login(c);
 await c.shareWebSignIn({returnUrl});
 assert.equal(nav.length,1);
 const url=new URL(nav[0]);
 assert.equal(url.pathname,'/auth/sso/adopt');
 assert.equal(url.searchParams.get('app_id'),'recordnote');
 assert.equal(url.searchParams.get('return'),returnUrl);
 assert.equal(url.searchParams.get('c'),'one-time-web-code');
 assert.ok(!nav[0].includes('test-sso-token')&&!nav[0].includes('refresh-a'));
 assert.equal(await c.completeWebSsoCheck(returnUrl+'#sso_adopted=1'),true);
 assert.equal(storage.get('starry.ssoweb.recordnote'),'1');
 assert.ok(server.calls.some(x=>x.path==='/v1/auth/sso/web-code'));
});

test('Central SDK: 5-minute throttle, signed-out browser callback clears linked app',async()=>{
 const server=fakeServer(),storage=new Map(),nav=[];
 const c=client(server,storage,nav);await login(c);await c.shareWebSignIn({returnUrl});
 assert.equal(await c.syncWebSignIn({returnUrl}),true);
 assert.equal(await c.syncWebSignIn({returnUrl}),false);
 const url=new URL(nav.at(-1));
 assert.equal(url.pathname,'/auth/sso/check');
 assert.equal(url.searchParams.get('nonce'),'a'.repeat(64));
 assert.equal(url.searchParams.get('state'),'random-state');
 assert.equal(url.searchParams.get('return'),returnUrl);
 assert.equal(await c.completeWebSsoCheck(returnUrl+'#sso_none=1'),false);
 assert.equal(storage.has('starry.refresh.recordnote'),false);
 assert.equal(storage.has('starry.ssoweb.recordnote'),false);
});

test('Central SDK: browser callback exchanges one-time code to switch member',async()=>{
 const server=fakeServer(),storage=new Map(),nav=[];
 const c=client(server,storage,nav);await login(c);
 await c.shareWebSignIn({returnUrl});
 await c.syncWebSignIn({returnUrl});
 server.setMember('member-b');
 const code='once-only-callback-code';
 assert.equal(await c.completeWebSsoCheck(returnUrl+'#sso_code='+code+'&sso_user=member-b&state=random-state'),true);
 const exchange=server.calls.find(x=>x.path==='/v1/auth/sso/web-exchange');
 assert.equal(exchange.body.app_id,'recordnote');
 assert.equal(exchange.body.nonce,'random-nonce');
 assert.equal(exchange.body.code,code);
 assert.equal(await c.getAccessToken(),token('member-b'));
});

test('Central SDK: logout clears current app and redirects to browser-wide logout',async()=>{
 const server=fakeServer(),storage=new Map(),nav=[];
 const c=client(server,storage,nav);await login(c);
 await c.shareWebSignIn({returnUrl});
 await c.signOutWebEverywhere({returnUrl});
 assert.equal(storage.has('starry.refresh.recordnote'),false);
 assert.equal(storage.has('starry.ssoweb.recordnote'),false);
 assert.equal(new URL(nav.at(-1)).pathname,'/auth/sso/logout');
 assert.equal(new URL(nav.at(-1)).searchParams.get('return'),returnUrl);
});
