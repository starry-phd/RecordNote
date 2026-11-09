import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const source=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const literal=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(source);
assert.ok(literal,'Bundled RecordNote page exists');
const page=JSON.parse(literal[1]);
const start=page.indexOf('// Read-only membership quota inspection.');
const end=page.indexOf('function settings(){',start);
assert.ok(start>0&&end>start,'Account and Battery helpers exist');
const helpers=page.slice(start,end);
const balance={
 balance:{period:'2026-11',allowance:100,used:22,reserved:4,remaining:74,resets_at:1796054400000},
 quantum:{app_id:'recordnote',balance:40,reserved:2,available:38},
 activity:[],next_cursor:null
};

function sandbox({reply=balance,role='live',confirmed='DELETE'}={}){
 const calls=[];
 let cleared=0,reset=0,notifications=[];
 const state={mode:role,token:role==='live'?'valid-token':null,consentRequired:false,memberBattery:null,memberBatteryError:null,memberBatteryLoading:false,accountDeleteBusy:false,view:'settings'};
 class FormDataMock {constructor(form){this.form=form;}get(name){return name==='confirm'?this.form.confirm:null;}}
 const ctx=createContext({
  state,APP_ID:'recordnote',ID:'https://id.starry.phd',String,Number,Date,Intl,JSON,Error,
  FormData:FormDataMock,console,
  // Account deletion uses the official Starry Client. Keep the request
  // expectations while stubbing the client, not rebuilding its HTTP logic.
  starryClient:{deleteAccount:async()=>{
   calls.push({url:'https://id.starry.phd/v1/me/deletion',init:{
    method:'POST',body:JSON.stringify({confirm:true})
   }});
   if(reply instanceof Error)throw reply;
  }},
  e:value=>String(value),
  currentUserScope:()=>state.mode==='live'&&state.token?'member-1':'',
  authenticated:async(url,init)=>{calls.push({url,init});return {ok:true,status:202,json:async()=>reply};},
  json:async response=>response.json(),
  render:()=>{},
  clearRefreshToken:()=>{cleared++},
  resetSignedOutUI:async()=>{reset++;state.mode='demo';state.token=null;state.memberBattery=null},
  notice:s=>notifications.push(s)
 });
 runInContext(helpers,ctx);
 return {ctx,state,calls,get cleared(){return cleared},get reset(){return reset},get notifications(){return notifications},execute:js=>runInContext(js,ctx)};
}
const valid=JSON.stringify(balance);

test('Rejects malformed balances and any Quantum Battery belonging to another App',()=>{
 const h=sandbox();
 assert.equal(h.execute('validateRecordnoteBattery('+valid+')'),true);
 assert.equal(h.execute('validateRecordnoteBattery('+JSON.stringify({...balance,quantum:{...balance.quantum,app_id:'echo'}})+')'),false);
 assert.equal(h.execute('validateRecordnoteBattery('+JSON.stringify({...balance,balance:{...balance.balance,remaining:-1}})+')'),false);
});

test('Read-only balance call uses Starry ID, no App service key or reservation',async()=>{
 const h=sandbox();
 await h.execute('refreshMemberBattery()');
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].url,'https://id.starry.phd/v1/me/battery');
 assert.equal(h.calls[0].init.cache,'no-store');
 assert.equal(h.calls[0].init.credentials,'omit');
 assert.ok(!h.calls[0].init.headers?.['x-starry-app-key']);
 assert.equal(h.state.memberBattery.balance.remaining,74);
 const ui=String(h.execute('memberBatterySection()'));
 assert.ok(ui.includes('🔋 <strong>74</strong> 顆普通電池'));
 assert.ok(ui.includes('⚛️ <strong>38</strong> 顆量子電池'));
 assert.match(ui,/38/);
 assert.match(ui,/先扣本月共用額度/);
});

test('Guest users cannot load private Battery balances',async()=>{
 const h=sandbox({role:'demo'});
 await h.execute('refreshMemberBattery()');
 assert.equal(h.calls.length,0);
 assert.equal(h.execute('memberBatterySection()'),'');
});

test('A late Battery reply cannot overwrite the next signed-in member',async()=>{
 const h=sandbox();
 const call=h.execute('refreshMemberBattery()');
 h.state.token=null;
 h.state.mode='demo';
 await call;
 assert.equal(h.state.memberBattery,null);
});

test('Central account deletion requires typed DELETE and live signed-in member',async()=>{
 const h=sandbox();
 const form={confirm:'no',querySelector:()=>({disabled:false})};
 h.ctx.form=form;
 await assert.rejects(()=>h.execute('permanentlyDeleteStarryAccount(form)'),/CONFIRMATION_REQUIRED/);
 assert.equal(h.calls.length,0);
 assert.equal(h.cleared,0);
 h.state.mode='demo';form.confirm='DELETE';
 await assert.rejects(()=>h.execute('permanentlyDeleteStarryAccount(form)'),/LOGIN_REQUIRED/);
 assert.equal(h.calls.length,0);
});

test('Confirmed deletion sends exactly one central API request and revokes local session',async()=>{
 const h=sandbox({reply:{status:'deleted'}});
 const button={disabled:false};
 h.ctx.form={confirm:'DELETE',querySelector:()=>button};
 await h.execute('permanentlyDeleteStarryAccount(form)');
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].url,'https://id.starry.phd/v1/me/deletion');
 assert.equal(h.calls[0].init.method,'POST');
 assert.deepEqual(JSON.parse(h.calls[0].init.body),{confirm:true});
 assert.equal(h.cleared,1);
 assert.equal(h.reset,1);
 assert.equal(h.state.mode,'demo');
 assert.equal(button.disabled,false);
});

test('Rejected central deletion never claims success or revokes the local session',async()=>{
 const h=sandbox({reply:new Error('CENTRAL_DELETE_FAILED')});
 h.ctx.form={confirm:'DELETE',querySelector:()=>({disabled:false})};
 await assert.rejects(()=>h.execute('permanentlyDeleteStarryAccount(form)'),/CENTRAL_DELETE_FAILED/);
 assert.equal(h.cleared,0);
 assert.equal(h.reset,0);
 assert.equal(h.state.accountDeleteBusy,false);
});

test('UI includes a separate irreversible central account deletion consent flow',()=>{
 assert.ok(page.includes("case 'delete-account':state.dialog='deleteStarryAccount';render();return;"));
 assert.ok(page.includes('id="deleteStarryAccountForm"'));
 assert.ok(page.includes('id="starryAccountDeletePhrase"'));
 assert.ok(page.includes("event.target.value.trim()!=='DELETE'"));
 assert.ok(page.includes("case 'starrySettingsAction':await runStarrySettingsAction(id)"));
 assert.ok(page.includes("event.target.id==='deleteStarryAccountForm'"));
 assert.ok(page.includes('不會自動取消 App Store／Google Play 訂閱'));
 assert.ok(!helpers.includes('STARRY_BATTERY_KEY'),'The browser must never contain the backend service key');
 assert.ok(helpers.includes('await starryClient.deleteAccount()'),'Central deletion uses the official frontend SDK');
});
