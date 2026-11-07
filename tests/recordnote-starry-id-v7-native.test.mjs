import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const src=readFileSync(new URL('../expo/RecordNoteStarryAuth.ts',import.meta.url),'utf8');
const cfg=JSON.parse(readFileSync(new URL('../expo/app.json.example',import.meta.url),'utf8'));
const client=readFileSync(new URL('../vendor/starry-id/starry-client.ts',import.meta.url),'utf8');
const api=readFileSync(new URL('../cloudflare-candidate/recordnote-worker.js',import.meta.url),'utf8');
const unified=readFileSync(new URL('../cloudflare-candidate/recordnote-unified.mjs',import.meta.url),'utf8');
test('Native Expo integration delegates to the official frontend client',()=>{
 const c=ts.transpileModule(src,{fileName:'RecordNoteStarryAuth.ts',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 assert.equal(c.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 for(const method of ['signInWithRelay','signInWithPasskey','registerPasskey','listPasskeys','removePasskey','restore','signOut','acceptConsent','deleteAccount','checkApp'])
  assert.ok(src.includes('starryClient.'+method+'('),'Missing '+method);
 assert.ok(src.includes("from '../vendor/starry-id/starry-client'"));
 assert.ok(src.includes('SecureStore.getItemAsync'));
 assert.ok(src.includes('Crypto.digestStringAsync'));
 assert.ok(src.includes('openAuthSessionAsync'));
 assert.ok(src.includes('Passkey.get(')&&src.includes('Passkey.create('));
 assert.ok(!src.includes('expo-apple-authentication'));
 assert.ok(!src.includes('GoogleSignin'));
});
test('Native platform identity and relying party match Central',()=>{
 assert.equal(cfg.expo.scheme,'recordnote');
 assert.equal(cfg.expo.ios.bundleIdentifier,'phd.starry.recordnote');
 assert.equal(cfg.expo.android.package,'phd.starry.recordnote');
 assert.ok(cfg.expo.ios.associatedDomains.includes('webcredentials:id.starry.phd'));
 assert.ok(src.includes("value!=='id.starry.phd'"));
 assert.ok(src.includes("'recordnote://auth/'+provider"));
 assert.ok(src.includes("'/support'"));
 assert.ok(!src.includes('STARRY_BATTERY_KEY'));
});
test('Backend official SDK remains bundled into the one Worker',()=>{
 assert.ok(client.includes('export class StarryClient'));
 assert.ok(api.includes('sdk.reserve('));
 assert.ok(unified.includes('class StarryError'));
 assert.ok(unified.includes('sdk.reserve('));
});
