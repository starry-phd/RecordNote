import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const native=read('native/App.tsx');
const member=read('native/StarryMemberWebView.tsx');
const pkg=JSON.parse(read('native/package.json'));
const api=JSON.parse(read('vendor/starry-id/starry-id.v1.json'));

test('v2026-11-09.1: native settings are led by the unmodified central Starry ID member card',()=>{
 assert.equal(pkg.dependencies['react-native-webview'],'14.0.1');
 assert.ok(api.paths['/v1/me/web-link'].post);
 const card=native.indexOf('<StarryMemberWebView page="card"');
 const memberCenter=native.indexOf('text="會員中心"',card);
 const support=native.indexOf('text="聯絡客服"',memberCenter);
 const logout=native.indexOf('text="登出所有繁星 App"',support);
 const deletion=native.indexOf('text="永久刪除中央帳號"',logout);
 const keys=native.indexOf('>我的 Passkey</Text>',deletion);
 const ownSettings=native.indexOf('>繁星答錄機設定</Text>',keys);
 assert.ok(card>0&&card<memberCenter&&memberCenter<support&&support<logout&&logout<deletion&&deletion<keys&&keys<ownSettings);
 assert.ok(!native.includes('memberRow'));
 assert.ok(!native.includes('avatarCacheKey'));
 assert.ok(!native.includes('expo-image'));
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
 assert.ok(native.includes("setCardRefresh(n=>n+1)"));
 assert.ok(native.includes('confirmText.trim()!==\'DELETE\''));
 assert.ok(native.includes('不會自動取消 App Store／Google Play 訂閱'));
});

test('Starry ID SDK remains vendored, not reimplemented or modified for member pages',()=>{
 const sdk=read('vendor/starry-id/starry-client.ts');
 assert.ok(sdk.includes('async request<T = unknown>'));
 assert.ok(native.includes('restoreSignIn()'));
 assert.ok(member.includes("page:MemberPage"));
});
