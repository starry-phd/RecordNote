import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const native=read('native/App.tsx');
const member=read('native/StarryMemberWebView.tsx');
const pkg=JSON.parse(read('native/package.json'));
const api=JSON.parse(read('vendor/starry-id/starry-id.v1.json'));

test('v2026-11-09.2 replaces 11-09.1 member card with canonical SDK settings blocks',()=>{
 assert.equal(pkg.dependencies['react-native-webview'],'14.0.1');
 assert.ok(api.paths['/v1/me/web-link'].post);
 const sdk=read('vendor/starry-id/starry-client.ts');
 assert.ok(sdk.includes('export function starrySettingsBlocks(input: SettingsInput)'));
 for(const title of ['繁星電池艙','我的中央會員','我的 Passkey'])assert.ok(sdk.includes(title));
 assert.ok(native.includes('settingsBlocks.map(block=>'));
 assert.ok(native.includes('starrySettingsBlocks({me:user,battery,passkeys})'));
 assert.ok(!native.includes('<StarryMemberWebView page="card"'));
 assert.ok(!native.includes('setCardRefresh('));
});
test('one-time web-link is acquired with official SDK and consumed only in same-origin WebView',()=>{
 assert.ok(member.includes("starryClient.request<WebLink>('POST','/v1/me/web-link',{page})"));
 assert.ok(member.includes('setUri(link.url)'));
 assert.ok(member.includes('MEMBER_ORIGIN=\'https://id.starry.phd\''));
 assert.ok(member.includes('centralUrlOnly(request.url)'));
 assert.ok(member.includes('injectedJavaScript={fullScreen?undefined:HEIGHT_SCRIPT}'));
 assert.ok(member.includes('onMessage={event=>'));
 assert.ok(member.includes('setCardHeight('));
 assert.ok(member.includes('onHttpError='));
 assert.ok(!member.includes('Linking.openURL'));
 assert.ok(!member.includes('localStorage'));
 assert.ok(!member.includes('AsyncStorage'));
});

test('member center stays in an in-app WebView; support alone uses the system browser',()=>{
 assert.ok(native.includes("setMemberPage('profile')"));
 assert.ok(native.includes('<Modal visible={Boolean(memberPage&&user)}'));
 assert.ok(native.includes('page={memberPage}'));
 assert.ok(native.includes('fullScreen'));
 assert.ok(native.includes('Linking.openURL(await supportUrl('));
 assert.ok(native.includes('Promise.allSettled([readUser(),readKeys(),readBattery()])'));
 assert.ok(native.includes('confirmText.trim()!==\'DELETE\''));
 assert.ok(native.includes('不會自動取消 App Store／Google Play 訂閱'));
});

test('Starry ID SDK remains vendored, not reimplemented or modified for member pages',()=>{
 const sdk=read('vendor/starry-id/starry-client.ts');
 assert.ok(sdk.includes('async request<T = unknown>'));
 assert.ok(native.includes('restoreSignIn()'));
 assert.ok(member.includes("page:MemberPage"));
});
