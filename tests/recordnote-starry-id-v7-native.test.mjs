import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const src=readFileSync(new URL('../expo/RecordNoteStarryAuth.ts',import.meta.url),'utf8');
const cfg=JSON.parse(readFileSync(new URL('../expo/app.json.example',import.meta.url),'utf8'));
const official=readFileSync(new URL('../vendor/starry-id/starry-sdk.ts',import.meta.url),'utf8');
const api=readFileSync(new URL('../cloudflare-candidate/recordnote-worker.js',import.meta.url),'utf8');
const unified=readFileSync(new URL('../cloudflare-candidate/recordnote-unified.mjs',import.meta.url),'utf8');

test('native Expo auth adapter compiles without introducing provider SDKs',()=>{
 const c=ts.transpileModule(src,{fileName:'RecordNoteStarryAuth.ts',reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 const errors=(c.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0);
 assert.match(src,/expo-web-browser/);
 assert.match(src,/openAuthSessionAsync/);
 assert.match(src,/expo-crypto/);
 assert.match(src,/react-native-passkey/);
 assert.match(src,/Passkey\.get\(/);
 assert.match(src,/Passkey\.create\(/);
 assert.ok(!src.includes('expo-google-sign-in'));
 assert.ok(!src.includes('expo-apple-authentication'));
 assert.ok(!src.includes('GoogleSignin'));
});

test('native Bundle/Package and associated domain use central RP and correct URL scheme',()=>{
 assert.equal(cfg.expo.scheme,'recordnote');
 assert.equal(cfg.expo.ios.bundleIdentifier,'phd.starry.recordnote');
 assert.equal(cfg.expo.android.package,'phd.starry.recordnote');
 assert.ok(cfg.expo.ios.associatedDomains.includes('webcredentials:id.starry.phd'));
 assert.match(src,/id\.starry\.phd/);
 assert.match(src,/recordnote:\/\/auth\//);
 assert.match(src,/AUTH_STATE_MISMATCH/);
 assert.match(src,/SecureStore\.setItemAsync/);
});

test('native settings support passkeys and support, but do not ship a false Expo Go app',()=>{
 assert.match(src,/\/v1\/me\/passkeys\/options/);
 assert.match(src,/\/v1\/me\/passkeys'/);
 assert.match(src,/\/v1\/me\/passkeys\//);
 assert.match(src,/REAUTH_REQUIRED/);
 assert.match(src,/UserCancelled/);
 assert.match(src,/CredentialAlreadyExists/);
 assert.match(src,/\/support/);
 assert.ok(!src.includes('STARRY_BATTERY_KEY'));
});

test('official SDK is copied and production build includes it',()=>{
 assert.match(official,/export class Starry/);
 assert.match(official,/reserve\(accessToken/);
 assert.match(api,/sdk\.reserve\(/);
 assert.match(api,/sdk\.commit\(/);
 assert.match(api,/sdk\.release\(/);
 assert.match(api,/\.me\(token\)/);
 assert.match(unified,/class StarryError/);
 assert.match(unified,/class Starry/);
 assert.match(unified,/sdk\.reserve\(/);
});
