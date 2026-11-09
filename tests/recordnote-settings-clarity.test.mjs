import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const m=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(src);
assert.ok(m);
const page=JSON.parse(m[1]);
const from=page.indexOf('function centralAvatarUrl('),to=page.indexOf('function memberBatterySection()',from);
assert.ok(from>0&&to>from);
function rendered(profile){
 const ctx={ID:'https://id.starry.phd',URL,encodeURIComponent,
  state:{mode:'live',centralMe:{user_id:'stable-user-id',member_no:'TW0067527',profile},centralMeLoading:false},
  e:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
 runInNewContext(page.slice(from,to),ctx);
 return runInNewContext('centralMemberSection()',ctx);
}
test('avatar_url null shows Central initials and truthful help, not a fake photo',()=>{
 const html=rendered({shown_name:'繁星管理員',initials:'繁星',avatar_url:null});
 assert.ok(html.includes('繁星管理員'));
 assert.ok(html.includes('data-avatar-status="missing"'));
 assert.ok(html.includes('中央會員目前未提供頭像照片'));
 assert.ok(!html.includes('<img'));
});
test('signed avatar has image with a hidden failure message that can be revealed',()=>{
 const html=rendered({shown_name:'繁星管理員',initials:'繁星',avatar_url:'https://id.starry.phd/media/avatar?sig=one&expires=two'});
 assert.ok(html.includes('src="https://id.starry.phd/media/avatar?sig=one&amp;expires=two"'));
 assert.ok(html.includes('data-avatar-status="error" hidden'));
 assert.ok(page.includes("if(message)message.hidden=false"));
});
test('shown_name is Central-controlled, never based on local nickname or email',()=>{
 const html=rendered({shown_name:'官方名稱',initials:'繁星',nickname:'不應顯示暱稱',display_name:'不應顯示本名',avatar_url:null});
 assert.ok(html.includes('官方名稱'));
 assert.ok(!html.includes('不應顯示暱稱')&&!html.includes('不應顯示本名'));
});
test('Settings page uses canonical SDK blocks, not extra account or Battery descriptions',()=>{
 const settings=page.slice(page.indexOf('function settings(){'),page.indexOf('function dialog(){'));
 assert.ok(settings.includes('officialSettingsBlocks()'));
 assert.ok(!settings.includes('centralMemberSection()'));
 assert.ok(!settings.includes('memberBatterySection()'));
 assert.ok(!settings.includes('passkeySection()'));
 assert.ok(!settings.includes('重新查詢餘額'));
 assert.ok(page.includes('data-action="starrySettingsAction"'));
});
test('Web logout retains same-browser Starry ID SSO logic without a non-standard footnote',()=>{
 assert.ok(page.includes('await starryClient.signOutWebEverywhere({returnUrl:webSsoReturnUrl()})'));
 const settings=page.slice(page.indexOf('function settings(){'),page.indexOf('function dialog(){'));
 assert.ok(!settings.includes('網頁版登出僅影響此瀏覽器內的繁星網頁'));
});
