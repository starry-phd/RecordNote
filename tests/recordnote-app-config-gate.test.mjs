import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const file=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const match=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(file);
assert.ok(match,'RecordNote static HTML page must be bundled');
const page=JSON.parse(match[1]);
const start=page.indexOf("const RECORDNOTE_APP_VERSION=");
const end=page.indexOf('async function resumeSavedLogin(){',start);
assert.ok(start>0&&end>start,'App configuration gate must precede persisted login');
const contract=page.slice(start,end);

function gate(response){
 const ctx=createContext({
  APP_ID:'recordnote',
  central:async(path,init)=>{
   assert.equal(path,'/v1/apps/recordnote/config');
   assert.equal(init.cache,'no-store');
   if(response instanceof Error)throw response;
   return response;
  },
  String,Number,Object,
 });
 runInContext(contract,ctx);
 return runInContext('recordnoteStartupGate()',ctx);
}

test('Active registered App with supported version allows boot',async()=>{
 assert.equal((await gate({app_id:'recordnote',status:'active',min_version:'0.0.0'})).status,'active');
});

test('Paused and killed stop authenticated App entry',async()=>{
 assert.equal((await gate({app_id:'recordnote',status:'paused',min_version:'0.0.0'})).status,'paused');
 assert.equal((await gate({app_id:'recordnote',status:'killed',min_version:'0.0.0'})).status,'killed');
});

test('Minimum version higher than installed app asks for upgrade',async()=>{
 assert.equal((await gate({app_id:'recordnote',status:'active',min_version:'1.0.0'})).status,'update');
});

test('Mismatched App identity and central outage fail into guest-only mode',async()=>{
 assert.equal((await gate({app_id:'another-app',status:'active',min_version:'0.0.0'})).status,'unavailable');
 assert.equal((await gate(new Error('central unavailable'))).status,'unavailable');
});

test('App gate runs before automatic token refresh and guest-only mode blocks it',()=>{
 const boot=page.slice(page.indexOf('async function boot(){'));
 assert.ok(boot.indexOf('await recordnoteStartupGate()')<boot.indexOf('await refresh()'));
 assert.ok(boot.includes("if(gate.status==='active')"));
 assert.ok(boot.includes("history.replaceState(null,'',location.pathname);sessionStorage.removeItem(KEY_OAUTH);"),'blocked callbacks must erase the provider ID token URL');
 assert.ok(boot.includes("gate.status==='active'&&API&&state.token?'live':'demo'"));
});
