import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyStarryToken,AuthenticationError} from '../.build/auth.js';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
async function fixture(){
  const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',kp.publicKey);
  const current=1_800_000_000;
  const cfg={issuer:'https://id.example.com',audience:'recorder',jwksUrl:'https://id.example.com/.well-known/jwks.json'};
  const fetcher=async()=>new Response(JSON.stringify({keys:[{...jwk,kid:'key1',alg:'RS256',use:'sig'}]}),{status:200});
  const sign=async claims=>{
    const data=enc({alg:'RS256',typ:'JWT',kid:'key1'})+'.'+enc({sub:'user-one',iss:cfg.issuer,aud:cfg.audience,exp:current+3600,iat:current,...claims});
    const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(data));
    return data+'.'+Buffer.from(sig).toString('base64url');
  };
  return {sign,cfg,fetcher,current};
}
test('accepts verified RS256 token for expected issuer/audience',async()=>{
  const f=await fixture();assert.equal(await verifyStarryToken(await f.sign({}),f.cfg,f.fetcher,f.current),'user-one');
});
test('rejects wrong audience, expired, and forged payload',async()=>{
  const f=await fixture();
  await assert.rejects(verifyStarryToken(await f.sign({aud:'not-recorder'}),f.cfg,f.fetcher,f.current),AuthenticationError);
  await assert.rejects(verifyStarryToken(await f.sign({exp:f.current-1}),f.cfg,f.fetcher,f.current),AuthenticationError);
  const t=await f.sign({});const p=t.split('.');p[1]=enc({sub:'attacker',iss:f.cfg.issuer,aud:f.cfg.audience,exp:f.current+3600});
  await assert.rejects(verifyStarryToken(p.join('.'),f.cfg,f.fetcher,f.current),AuthenticationError);
});
test('rejects missing config and unavailable JWKS (fail closed)',async()=>{
  const f=await fixture();const t=await f.sign({});
  await assert.rejects(verifyStarryToken(t,{...f.cfg,jwksUrl:''},f.fetcher,f.current),AuthenticationError);
  await assert.rejects(verifyStarryToken(t,f.cfg,async()=>{throw Error('offline')},f.current),AuthenticationError);
});
