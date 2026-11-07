import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const worker=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const literal=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(worker);
assert.ok(literal,'Cloudflare PAGE string available');
const page=JSON.parse(literal[1]);
function segment(first,last){
 const a=page.indexOf(first),b=page.indexOf(last,a+first.length);
 assert.ok(a>=0&&b>a,'expected auth segment '+first);
 return page.slice(a,b);
}
const authCode='const KEY_REFRESH="recordnote.web.refresh";let refreshFlight=null;\n'
 + segment('let authGeneration=0;','// Imported inline')
 + '\n' + segment('async function refresh(){','async function authenticated(');

function storage(map){
 return {
  getItem:k=>map.has(k)?map.get(k):null,
  setItem:(k,v)=>{map.set(k,String(v));},
  removeItem:k=>{map.delete(k);}
 };
}
function harness({shared=new Map(),temporary=new Map(),reply=async()=>({ok:true,json:async()=>({access_token:'access-1',refresh_token:'refresh-2'})}),locks=undefined}={}){
 const state={token:null};
 const ctx=createContext({
  localStorage:storage(shared),sessionStorage:storage(temporary),
  navigator:{locks},state,ID:'https://id.starry.phd',
  fetch:reply,console:{warn:()=>{}},JSON,Promise,
 });
 runInContext(authCode,ctx);
 return {ctx,state,shared,temporary,run:expr=>runInContext(expr,ctx)};
}
const key='recordnote.web.refresh';

test('legacy sessionStorage refresh token migrates to persistent localStorage',async()=>{
 const old=new Map([[key,'legacy-token']]);
 const h=harness({temporary:old,reply:async(_url,opts)=>{
  assert.equal(JSON.parse(opts.body).refresh_token,'legacy-token');
  return {ok:true,json:async()=>({access_token:'access-A',refresh_token:'rotated-A'})};
 }});
 const access=await h.run('refresh()');
 assert.equal(access,'access-A');
 assert.equal(h.shared.get(key),'rotated-A');
 assert.equal(old.has(key),false);
});
test('browser restart with fresh sessionStorage still silently restores login',async()=>{
 const saved=new Map([[key,'token-before-restart']]);
 const h=harness({shared:saved,temporary:new Map(),reply:async(_url,opts)=>{
  assert.equal(JSON.parse(opts.body).refresh_token,'token-before-restart');
  return {ok:true,json:async()=>({access_token:'access-new',refresh_token:'token-after-restart'})};
 }});
 assert.equal(await h.run('refresh()'),'access-new');
 assert.equal(saved.get(key),'token-after-restart');
 assert.equal(h.state.token,'access-new');
});
test('offline or server failure retains saved refresh token for retry',async()=>{
 const saved=new Map([[key,'still-valid']]);
 const h=harness({shared:saved,reply:async()=>{throw Error('offline');}});
 assert.equal(await h.run('refresh()'),null);
 assert.equal(saved.get(key),'still-valid');
 h.ctx.fetch=async()=>({ok:false,status:503});
 assert.equal(await h.run('refresh()'),null);
 assert.equal(saved.get(key),'still-valid');
 h.ctx.fetch=async()=>({ok:true,json:async()=>({access_token:'restored',refresh_token:'renewed'})});
 assert.equal(await h.run('refresh()'),'restored');
 assert.equal(saved.get(key),'renewed');
});
test('confirmed 401 invalid refresh clears persisted credentials',async()=>{
 const saved=new Map([[key,'expired']]);
 const h=harness({shared:saved,reply:async()=>({ok:false,status:401})});
 assert.equal(await h.run('refresh()'),null);
 assert.equal(saved.has(key),false);
 assert.equal(h.state.token,null);
});
test('concurrent same-tab refresh calls share a single network request',async()=>{
 const saved=new Map([[key,'original']]);
 let calls=0;
 const h=harness({shared:saved,reply:async()=>{
  calls++;
  return {ok:true,json:async()=>({access_token:'new',refresh_token:'rotated'})};
 }});
 const result=await h.run('Promise.all([refresh(),refresh(),refresh()])');
 assert.deepEqual(Array.from(result),['new','new','new']);
 assert.equal(calls,1);
});
test('manual logout removes persistent token and clears authenticated UI',async()=>{
 const saved=new Map([[key,'remembered']]);
 const h=harness({shared:saved});
 h.state.token='access';
 h.state.mode='live';h.state.courses=[{id:'private'}];h.state.active='private';
 h.ctx.window={listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}};
 let serverLogouts=0,rendered=0;
 h.ctx.authenticated=async()=>{serverLogouts++;return {ok:true};};
 h.ctx.shareReadyFiles={clear(){}};
 h.ctx.restoreGuestBooks=()=>{};
 h.ctx.loadLocalMedia=async()=>{};
 h.ctx.render=()=>{rendered++;};
 runInContext(segment('async function resetSignedOutUI(){','async function loadCourses()'),h.ctx);
 await h.run('logout()');
 assert.equal(serverLogouts,1);
 assert.equal(saved.has(key),false);
 assert.equal(h.state.token,null);
 assert.equal(h.state.mode,'demo');
 assert.equal(h.state.courses.length,0);
 assert.equal(rendered,1);
});
test('cross-tab storage logout notifies other tabs and clears their UI',async()=>{
 const shared=new Map();
 const h=harness({shared});
 h.state.token='access';h.state.mode='live';h.state.courses=[{id:1}];
 h.ctx.window={listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}};
 h.ctx.shareReadyFiles={clear(){}};
 h.ctx.restoreGuestBooks=()=>{};
 h.ctx.loadLocalMedia=async()=>{};
 h.ctx.render=()=>{};
 runInContext(segment('async function resetSignedOutUI(){','async function loadCourses()'),h.ctx);
 h.ctx.window.listeners.storage({key,newValue:null});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.state.token,null);
 assert.equal(h.state.mode,'demo');
});
test('OAuth nonce remains tab-scoped and no cloud upload or phone recording settings change',()=>{
 assert.match(page,/sessionStorage\.setItem\(KEY_OAUTH,/);
 assert.match(page,/sessionStorage\.removeItem\(KEY_OAUTH\)/);
 assert.ok(page.includes('mobileCapture?48000:64000'),'preserve mobile audio configuration');
 assert.ok(page.includes('mobileCapture?stream:voice.stream'));
 assert.ok(!page.includes('sessionStorage.setItem(KEY_REFRESH,tokens.refresh_token)'));
 assert.ok(page.includes('saveRefreshToken(tokens.refresh_token)'));
 assert.ok(page.includes("window.addEventListener('online',()=>{void resumeSavedLogin();})"));
});
