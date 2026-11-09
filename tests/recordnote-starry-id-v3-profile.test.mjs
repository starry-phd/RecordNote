import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const m=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(read('cloudflare-candidate/recordnote-web.mjs'));
assert.ok(m);
const page=JSON.parse(m[1]),native=read('native/App.tsx');
const pkg=JSON.parse(read('native/package.json'));
const api=JSON.parse(read('vendor/starry-id/starry-id.v1.json'));
const a=page.indexOf('function centralAvatarUrl('),b=page.indexOf('function memberBatterySection()',a);
assert.ok(a>=0&&b>a);
function ctx(profile){
 const state={mode:'live',centralMe:{user_id:'immutable-sub',member_no:'TW0123456',profile},centralMeLoading:false};
 const context={state,ID:'https://id.starry.phd',URL,encodeURIComponent,
  e:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
 runInNewContext(page.slice(a,b),context);
 return context;
}
test('OpenAPI specifies central shown_name for /me and directory members',()=>{
 assert.ok(api.components.schemas.Profile.properties.shown_name);
 assert.ok(api.components.schemas.DirectoryMember.properties.shown_name);
});
test('Web renders ONLY shown_name, never nickname or raw name',()=>{
 const v=ctx({shown_name:'中央顯示名稱',nickname:'不顯示暱稱',display_name:'不顯示姓名',initials:'中名',avatar_url:null});
 const html=runInNewContext('centralMemberSection()',v);
 assert.ok(html.includes('中央顯示名稱'));
 assert.ok(!html.includes('不顯示暱稱')&&!html.includes('不顯示姓名'));
});
test('Null shown_name falls back to the server-computed initials',()=>{
 const v=ctx({shown_name:null,nickname:'其他暱稱',display_name:'其他姓名',initials:'黃龍',avatar_url:null});
 const html=runInNewContext('centralMemberSection()',v);
 assert.ok(html.includes('黃龍'));
 assert.ok(!html.includes('其他暱稱')&&!html.includes('其他姓名'));
});
test('Signed avatar cache key drops query and never uses user ID',()=>{
 const v=ctx({shown_name:'示範',initials:'示',avatar_url:null});
 const one=runInNewContext("centralAvatarUrl('https://id.starry.phd/avatars/first?sig=one')",v);
 const two=runInNewContext("centralAvatarUrl('https://id.starry.phd/avatars/first?sig=two')",v);
 const next=runInNewContext("centralAvatarUrl('https://id.starry.phd/avatars/second?sig=three')",v);
 assert.equal(one.cacheKey,'https://id.starry.phd/avatars/first');
 assert.equal(two.cacheKey,one.cacheKey);
 assert.notEqual(next.cacheKey,one.cacheKey);
 assert.equal(runInNewContext('centralAvatarUrl.cache.has("https://id.starry.phd/avatars/first")',v),false);
 assert.equal(runInNewContext('centralAvatarUrl.cache.has("https://id.starry.phd/avatars/second")',v),true);
 assert.equal(runInNewContext("centralAvatarUrl('javascript:alert(1)')",v),null);
});
test('Web avatar is refreshed at every settings entry and foreground resume, even during gate throttle',()=>{
 const focus=page.slice(page.indexOf('async function recordnoteForegroundCheck()'),page.indexOf("document.addEventListener('visibilitychange'"));
 assert.ok(focus.includes("if(Date.now()-recordnoteGateLastCheck<60000){"));
 assert.ok(focus.includes('refreshCentralMember(),refreshMemberBattery(),loadPasskeys()'));
 assert.ok(page.includes("if(page==='settings'){void refreshMemberBattery();void loadPasskeys();void refreshCentralMember();}"));
 assert.ok(page.includes('const me=await starryClient.me();'));
 assert.ok(page.includes('data-cache-key'));
 assert.ok(page.includes("img.addEventListener('error'"));
});
test('Native draws the three Starry SDK settings blocks and refreshes on foreground',()=>{
 const nativePage=read('native/StarryMemberWebView.tsx');
 assert.equal(pkg.dependencies['react-native-webview'],'14.0.1');
 assert.ok(native.includes('starrySettingsBlocks({me:user,battery,passkeys})'));
 assert.ok(native.includes('settingsBlocks.map(block=>'));
 assert.ok(native.includes("state==='active'"));
 assert.ok(native.includes('restoreSignIn()'));
 assert.ok(native.includes("case 'member-center':setMemberPage('profile')"));
 assert.ok(native.includes("case 'battery-history': setMemberPage('battery')"));
 assert.ok(nativePage.includes("starryClient.request<WebLink>('POST','/v1/me/web-link',{page})"));
 assert.ok(!native.includes('<StarryMemberWebView page="card"'));
 assert.ok(!native.includes('avatarCacheKey'));
});
test('Public-profile Battery bonus is centrally managed, never multiplied or awarded by RecordNote',()=>{
 const balance=page.slice(page.indexOf('function validateRecordnoteBattery('),page.indexOf('// Deletion is a separate',page.indexOf('function validateRecordnoteBattery(')));
 assert.ok(balance.includes('b.remaining'));
 assert.ok(balance.includes('q.available'));
 assert.ok(!/multiplier|bonus_multiplier|public_field_count/.test(balance));
 assert.ok(!native.includes('batteryMultiplier'));
 assert.ok(!page.includes('兌換序號'));
});
