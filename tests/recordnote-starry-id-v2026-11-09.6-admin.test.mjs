import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sdk=read('vendor/starry-id/starry-client.ts');
const native=read('native/App.tsx'),nativePkg=JSON.parse(read('native/package.json'));
const webSource=read('cloudflare-candidate/recordnote-web.mjs');
const worker=read('cloudflare-candidate/recordnote-worker.js');
const bundle=read('cloudflare-candidate/recordnote-unified.mjs');
const page=JSON.parse(/const PAGE=("(?:\\.|[^"\\])*")/s.exec(webSource)[1]);
const script=ts.transpileModule(sdk,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {starrySettingsBlocks}=await import('data:text/javascript;base64,'+Buffer.from(script).toString('base64'));

test('SDK shows precisely one inverse gear Admin button only for centrally verified owner',()=>{
 const base={me:{member_no:'TW0123456',profile:{shown_name:'會員',initials:'會'},staff_role:null},battery:null,passkeys:[]};
 for(const role of [null,'admin','support',undefined]){
  const buttons=starrySettingsBlocks({...base,me:{...base.me,staff_role:role}}).find(b=>b.id==='member').buttons;
  assert.equal(buttons.some(b=>b.id==='admin'),false);
 }
 const member=starrySettingsBlocks({...base,me:{...base.me,staff_role:'owner'}}).find(b=>b.id==='member');
 const btn=member.buttons.find(b=>b.id==='admin');
 assert.deepEqual({id:btn.id,label:btn.label,icon:btn.icon,inverse:btn.inverse},{id:'admin',label:'Admin 專區',icon:'gear',inverse:true});
 assert.equal(member.buttons.findIndex(b=>b.id==='admin'),member.buttons.findIndex(b=>b.id==='support')+1);
});

test('Web uses only /admin SPA route and official current version with dynamic owner handoff',()=>{
 assert.ok(page.includes("INTEGRATED_STARRY_HANDOFF_VERSION='2026-11-09.6'"));
 assert.ok(page.includes("['/admin','admin']"));
 assert.ok(page.includes("case 'admin':if(state.centralMe?.staff_role!=='owner')throw Error('FORBIDDEN');navigate('admin');return;"));
 assert.ok(page.includes('getLatestHandoff(INTEGRATED_STARRY_HANDOFF_VERSION)'));
 assert.ok(page.includes('getLatestHandoff'));
 assert.ok(page.includes('navigator.clipboard.writeText(state.adminHandoff.text)'));
 assert.ok(page.includes("b.inverse?'primary':'outline'"));
 assert.ok(page.includes("b.icon==='gear'"));
 assert.ok(webSource.includes("'/admin'].includes(url.pathname)"));
 assert.ok(bundle.includes("'/admin'"));
});

test('Only owner sees /admin content; handoff card is first and displays version status',()=>{
 const chunk=page.slice(page.indexOf('function adminPage(){'),page.indexOf('function settings(){'));
 const e=String;
 const ctx={state:{mode:'live',consentRequired:false,centralMe:{staff_role:'support'},adminGate:'ready',adminHandoff:null,adminHandoffError:'',uploadPolicy:{can_manage:false}},
  APP_ID:'recordnote',INTEGRATED_STARRY_HANDOFF_VERSION:'2026-11-09.6',e,banner:()=>'',aiBatterySettings:()=>'<div data-admin-ai="yes"></div>'};
 runInNewContext(chunk,ctx);
 assert.ok(runInNewContext('adminPage()',ctx).includes('無權限'));
 ctx.state.centralMe.staff_role='owner';
 const html=runInNewContext('adminPage()',ctx);
 assert.ok(html.includes('data-admin-card="handoff"'));
 assert.ok(html.includes('目前採用版本：2026-11-09.6'));
 assert.ok(html.includes('更新時請 AI 只補差異，不要整份重做'));
 assert.ok(html.indexOf('data-admin-card="handoff"')<html.indexOf('data-admin-ai="yes"'));
 ctx.state.adminHandoff={app_id:'recordnote',version:'2026-11-09.7',up_to_date:false,text:'latest'};
 assert.ok(runInNewContext('adminPage()',ctx).includes('有新版'));
 assert.ok(runInNewContext('adminPage()',ctx).includes('複製最新串接指令'));
 ctx.state.adminHandoff={...ctx.state.adminHandoff,version:'2026-11-09.6',up_to_date:true};
 assert.ok(runInNewContext('adminPage()',ctx).includes('已是最新'));
 assert.ok(!runInNewContext('adminPage()',ctx).includes('data-action="copyAdminHandoff"'));
});

test('Existing admin controls are MOVED from settings to /admin, not copied or rewritten',()=>{
 const settings=page.slice(page.indexOf('function settings(){'),page.indexOf('function dialog(){'));
 const admin=page.slice(page.indexOf('function adminPage(){'),page.indexOf('function settings(){'));
 for(const phrase of ['aiBatterySettings()','id="uploadPolicyForm"','recordnote-metadata-admin.html']){
  assert.ok(admin.includes(phrase),'missing admin component '+phrase);
  assert.ok(!settings.includes(phrase),'management control scattered in settings '+phrase);
 }
 assert.ok(!settings.includes('href="/admin/metadata"'));
 assert.ok(webSource.includes("Response.redirect(url.origin+'/admin',302)"));
 assert.ok(webSource.includes("frame-ancestors 'self'"));
 assert.ok(webSource.includes("frame-src 'self'"));
});

test('Every RecordNote management API uses centrally verified owner, never a static ID or email allowlist',()=>{
 assert.ok(worker.includes("verifiedCentralIdentity.set(req,{user_id:user,staff_role:account.staff_role||null})"));
 assert.ok(worker.includes("return isCentralOwner(req,user);"));
 assert.ok(worker.includes("function isUploadSuperadmin(req,env,user)"));
 assert.ok(worker.includes("if(!isUploadSuperadmin(req,env,user))return mdErr('FORBIDDEN',403)"));
 assert.ok(worker.includes("if(!isUploadSuperadmin(req,env,user))return fail('FORBIDDEN',403)"));
 assert.ok(worker.includes("if(!isCentralOwner(req,user))return fail('FORBIDDEN',403)"));
 assert.ok(!worker.includes("RECORDNOTE_SUPERADMIN_IDS||"));
});
test('Native renders official Admin button and copies owner-only handoff in the in-App /admin screen',()=>{
 assert.ok(native.includes("INTEGRATED_STARRY_HANDOFF_VERSION='2026-11-09.6'"));
 assert.ok(native.includes("case 'admin':openAdmin()"));
 assert.ok(native.includes("me.staff_role!=='owner'"));
 assert.ok(native.includes("getLatestHandoff(INTEGRATED_STARRY_HANDOFF_VERSION)"));
 assert.ok(native.includes("Clipboard.setStringAsync(handoff.text)"));
 assert.ok(native.includes("nativePage==='admin'&&user.staff_role==='owner'"));
 assert.ok(native.includes("button.icon==='gear'"));
 assert.equal(nativePkg.dependencies['expo-clipboard'],'~58.0.4');
});
