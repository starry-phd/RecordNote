import test from 'node:test';
import assert from 'node:assert/strict';
import {capabilities} from '../.build/capabilities.js';
const valid={STAR_ID_ISSUER:'https://id.example.com',STAR_ID_JWKS_URL:'https://id.example.com/jwks.json',STAR_ID_AUDIENCE:'starry-recorder'};
test('all private features default closed',()=>{
 assert.deepEqual(capabilities({}),{memberApi:false,audioUpload:false,sharing:false});
 assert.deepEqual(capabilities(valid),{memberApi:false,audioUpload:false,sharing:false});
});
test('unconfigured identity cannot enable member features',()=>{
 assert.deepEqual(capabilities({FEATURE_MEMBER_API:'enabled',FEATURE_AUDIO_UPLOAD:'enabled',FEATURE_SHARING:'enabled'}),
 {memberApi:false,audioUpload:false,sharing:false});
});
test('member mode does not implicitly enable risky media or sharing',()=>{
 assert.deepEqual(capabilities({...valid,FEATURE_MEMBER_API:'enabled'}),{memberApi:true,audioUpload:false,sharing:false});
});
test('media/sharing require explicit separate enabled flags',()=>{
 assert.deepEqual(capabilities({...valid,FEATURE_MEMBER_API:'enabled',FEATURE_AUDIO_UPLOAD:'enabled'}),
 {memberApi:true,audioUpload:true,sharing:false});
});
test('placeholder issuer is always rejected',()=>{
 assert.equal(capabilities({...valid,STAR_ID_ISSUER:'NOT_CONFIGURED',FEATURE_MEMBER_API:'enabled'}).memberApi,false);
});
