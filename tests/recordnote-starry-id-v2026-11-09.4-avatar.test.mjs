import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=JSON.parse(/const PAGE=("(?:\\.|[^"\\])*")/s.exec(read('cloudflare-candidate/recordnote-web.mjs'))[1]);
const native=read('native/App.tsx');
const sdkSource=read('vendor/starry-id/starry-client.ts');
const toJS=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {starryAvatarSource}=await import('data:text/javascript;base64,'+Buffer.from(toJS(read('native/StarryAvatarUrl.ts'))).toString('base64'));
const {starrySettingsBlocks}=await import('data:text/javascript;base64,'+Buffer.from(toJS(sdkSource)).toString('base64'));
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function webAvatar(raw){
 const helper=page.slice(page.indexOf('function centralAvatarUrl('),page.indexOf('function centralMemberLink(',page.indexOf('function centralAvatarUrl(')));
 const ctx={URL,ID:'https://id.starry.phd'};
 runInNewContext(helper,ctx);
 const expression='centralAvatarUrl('+JSON.stringify(raw)+')';
 return runInNewContext(expression,ctx);
}
function webSettings(profile){
 const helper=page.slice(page.indexOf('function centralAvatarUrl('),page.indexOf('function centralMemberLink(',page.indexOf('function centralAvatarUrl(')));
 const block=page.slice(page.indexOf('function officialSettingsBlocks(){'),page.indexOf('async function openCentralMemberPage(',page.indexOf('function officialSettingsBlocks(){')));
 const context={URL,ID:'https://id.starry.phd',starrySettingsBlocks,e:escapeHTML,state:{centralMe:{member_no:'TW0123456',profile},memberBattery:null,passkeys:[],mode:'live'}};
 runInNewContext(helper+'\n'+block,context);
 return runInNewContext('officialSettingsBlocks()',context);
}
test('v2026-11-09.4: native and web accept central root-relative signed avatar URLs',()=>{
 const value='/media/avatars/new-photo?sig=abc&expires=123';
 for(const obj of [starryAvatarSource(value),webAvatar(value)]){
  assert.equal(obj.uri,'https://id.starry.phd/media/avatars/new-photo?sig=abc&expires=123');
  assert.equal(obj.cacheKey,'https://id.starry.phd/media/avatars/new-photo');
 }
 const html=webSettings({avatar_url:value,shown_name:'中央顯示名稱',initials:'中名'});
 assert.ok(html.includes('src="https://id.starry.phd/media/avatars/new-photo?sig=abc&amp;expires=123"'));
 assert.ok(html.includes('data-cache-key="https://id.starry.phd/media/avatars/new-photo"'));
 assert.ok(html.includes('中央顯示名稱'));
 assert.ok(!html.includes('中央會員目前未提供頭像'));
});
test('fully qualified HTTPS signed avatars work without changing the URL host',()=>{
 const signed='https://lh3.googleusercontent.com/p/a-new-photo?token=one';
 for(const obj of [starryAvatarSource(signed),webAvatar(signed)]){
  assert.equal(obj.uri,signed);
  assert.equal(obj.cacheKey,'https://lh3.googleusercontent.com/p/a-new-photo');
 }
 assert.ok(webSettings({avatar_url:signed,shown_name:'中名',initials:'中'}).includes('src="'+signed+'"'));
});
test('avatar path change invalidates cache, but new signed query uses same cache identity',()=>{
 const a='/media/avatars/first?sig=one',b='/media/avatars/first?sig=two',c='/media/avatars/second?sig=one';
 for(const resolve of [starryAvatarSource,webAvatar]){
  assert.equal(resolve(a).cacheKey,resolve(b).cacheKey);
  assert.notEqual(resolve(a).cacheKey,resolve(c).cacheKey);
 }
 assert.ok(native.includes('key={source.cacheKey}'));
 assert.ok(native.includes('source={source}'));
 assert.ok(native.includes('cachePolicy="disk"'));
});
test('invalid/empty image URLs fall back to Central-provided initials, never broken image or fake avatar',()=>{
 for(const raw of [null,'','javascript:alert(1)','data:image/svg+xml,foo','http://id.starry.phd/avatar','https://username:password@id.starry.phd/media/avatar']){
  assert.equal(starryAvatarSource(raw),null);
  assert.equal(webAvatar(raw),null);
 }
 const html=webSettings({avatar_url:null,shown_name:null,initials:'黃龍'});
 assert.ok(html.includes('黃龍'));
 assert.ok(!html.includes('<img'));
 assert.ok(!html.includes('沒有頭像'));
 assert.ok(native.includes('<Text style={styles.avatarText}>{initials}</Text>'));
 assert.ok(native.includes('const source=starryAvatarSource(url)'));
 assert.ok(!native.includes("block.avatar.url.split('?')[0]"));
});
test('Avatar renderer stays inside the three official SDK settings blocks',()=>{
 assert.ok(page.includes('starrySettingsBlocks({me:state.centralMe,battery:state.memberBattery,passkeys:state.passkeys||[]})'));
 assert.ok(native.includes('starrySettingsBlocks({me:user,battery,passkeys})'));
 assert.ok(native.includes('settingsBlocks.map(block=>'));
 assert.ok(page.includes('const picture=centralAvatarUrl(block.avatar?.url)'));
 assert.ok(page.includes('const url=new URL(value,ID)'));
});
