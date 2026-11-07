import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const file=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const match=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(file);
assert.ok(match);
const page=JSON.parse(match[1]);
const start=page.indexOf('const RECORDNOTE_APP_VERSION=');
const end=page.indexOf('async function resumeSavedLogin(){',start);
assert.ok(start>0&&end>start);
const contract=page.slice(start,end);
async function run(state){
 const ctx=createContext({starryClient:{checkApp:async()=>{if(state instanceof Error)throw state;return state;}},String,Number,Object});
 runInContext(contract,ctx);
 return runInContext('recordnoteStartupGate()',ctx);
}
test('v9 client returns expected gate statuses',async()=>{
 for(const [input,expected] of [['ok','active'],['maintenance','paused'],['killed','killed'],['update_required','update'],['unreachable','unavailable']]){
  assert.equal((await run({state:input,notices:[]})).status,expected);
 }
 assert.equal((await run(new Error('central unavailable'))).status,'unavailable');
});
test('Central notices stay plain strings and preserve time filtering in official client',async()=>{
 const result=await run({state:'ok',notices:[{message:'維護公告'}]});
 assert.deepEqual(Array.from(result.notices),['維護公告']);
 assert.ok(page.includes('.textContent=message'));
});
test('App gate precedes access token renewal and blocked OAuth callbacks are erased',()=>{
 const boot=page.slice(page.indexOf('async function boot(){'));
 assert.ok(boot.indexOf('await recordnoteStartupGate()')<boot.indexOf('await refresh()'));
 assert.ok(boot.includes("gate.status==='active'"));
 assert.ok(boot.includes("sessionStorage.removeItem(KEY_OAUTH)"));
 assert.ok(boot.includes("gate.status==='active'&&API&&state.token?'live':'demo'"));
});
