import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const native=read('native/App.tsx');
const member=read('native/StarryMemberWebView.tsx');
const source=read('vendor/starry-id/starry-client.ts');
const page=JSON.parse(/const PAGE=("(?:\\.|[^"\\])*")/s.exec(read('cloudflare-candidate/recordnote-web.mjs'))[1]);
const contract=JSON.parse(read('vendor/starry-id/starry-id.v1.json'));
const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {starrySettingsBlocks}=await import('data:text/javascript;base64,'+Buffer.from(transpiled).toString('base64'));

test('Official v2026-11-09.2 SDK is the sole source of settings block names, order and buttons',()=>{
 const list=starrySettingsBlocks({me:{member_no:'TW0123456',profile:{shown_name:'範例',initials:'範',avatar_url:null}},
  battery:{balance:{remaining:19},quantum:{available:15}},passkeys:[{id:'passkey-1',name:'手機'}]});
 assert.deepEqual(list.map(b=>b.title),['繁星電池艙','我的中央會員','我的 Passkey']);
 assert.deepEqual(list[0].lines,['🔋 19 顆普通電池','⚛️ 15 顆量子電池']);
 assert.deepEqual(list[1].buttons.map(b=>b.id),
  ['public-profile','share-invite','member-center','support','sign-out-all','delete-account']);
 assert.equal(list[0].buttons[0].id,'battery-history');
 assert.equal(list[2].passkeys[0].removeLabel,'移除');
 assert.equal(list[1].avatar.url,null);
});

test('Native settings render SDK blocks, fetch all three sources and use no embedded member card',()=>{
 assert.ok(native.includes('starrySettingsBlocks({me:user,battery,passkeys})'));
 assert.ok(native.includes('settingsBlocks.map(block=>'));
 assert.ok(native.includes("starryClient.request<NonNullable<SettingsInput['battery']>>('GET','/v1/me/battery')"));
 assert.ok(native.includes('Promise.allSettled([readUser(),readKeys(),readBattery()])'));
 assert.ok(native.includes("case 'battery-history': setMemberPage('battery')"));
 assert.ok(native.includes("case 'member-center':setMemberPage('profile')"));
 assert.ok(!native.includes('<StarryMemberWebView page="card"'));
 assert.ok(member.includes("export type MemberPage='battery'|'profile'|'referral'|'network'|'apps'"));
 assert.ok(contract.paths['/v1/me/web-link'].post);
});

test('Web uses official SDK blocks and no app-authored Battery/member/Passkey descriptions',()=>{
 const settings=page.slice(page.indexOf('function settings(){'),page.indexOf('function dialog(){'));
 assert.ok(settings.includes('officialSettingsBlocks()'));
 assert.ok(!settings.includes('memberBatterySection()'));
 assert.ok(!settings.includes('centralMemberSection()'));
 assert.ok(!settings.includes('passkeySection()'));
 assert.ok(page.includes("starrySettingsBlocks({me:state.centralMe,battery:state.memberBattery,passkeys:state.passkeys||[]})"));
 assert.ok(page.includes("starryClient.request('POST','/v1/me/web-link',{page})"));
 assert.ok(page.includes("window.location.assign(target.href)"));
 assert.ok(!settings.includes('重新整理會員資料'));
});

test('Website deep links are real History API routes and not just in-memory views',()=>{
 assert.ok(page.includes('function routeFromPath(pathname)'));
 assert.ok(page.includes("window.addEventListener('popstate'"));
 assert.ok(page.includes('history.pushState('));
 assert.ok(page.includes("const initial=routeFromPath(location.pathname)"));
 for(const path of ['/books','/search','/settings','/storage','/trash'])assert.ok(page.includes(path));
 assert.ok(page.includes("'/courses/'+encodeURIComponent("));
 assert.ok(page.includes("return {page:'notFound'}"));
});
