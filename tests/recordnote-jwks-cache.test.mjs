import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext, runInContext} from 'node:vm';

const worker=readFileSync(new URL('../cloudflare-candidate/recordnote-worker.js',import.meta.url),'utf8');
const start=worker.indexOf('const RN_JWKS_CACHE_MS=');
const end=worker.indexOf('async function principal(req,env){',start);
assert.ok(start>0 && end>start,'JWKS cache helper must exist before JWT validation');
const helper=worker.slice(start,end);
const host='https://id.starry.phd';
const jwk=kid=>({kid,kty:'EC',crv:'P-256',alg:'ES256'});

function harness(responses){
 let calls=0,clock=1_000_000;
 const ctx=createContext({
  URL, Map, Error, Array, AbortSignal,
  Date:{now:()=>clock},
  fetch:async url=>{
   assert.equal(String(url),host+'/.well-known/jwks.json');
   const response=responses[Math.min(calls,responses.length-1)];
   calls++;
   if(response instanceof Error)throw response;
   return {ok:true,json:async()=>({keys:response})};
  }
 });
 runInContext(helper,ctx);
 return {
  get calls(){return calls},
  advance:ms=>{clock+=ms},
  signer:kid=>runInContext('rnVerifierJwk(new URL('+JSON.stringify(host)+'),'+JSON.stringify(kid)+')',ctx),
 };
}

test('JWKS is cached for repeated verification on the same issuer origin',async()=>{
 const h=harness([[jwk('kid-a')]]);
 assert.equal((await h.signer('kid-a')).kid,'kid-a');
 assert.equal((await h.signer('kid-a')).kid,'kid-a');
 assert.equal(h.calls,1);
});

test('New kid forces refresh and accepts overlapping old/new keys',async()=>{
 const h=harness([[jwk('kid-a')],[jwk('kid-a'),jwk('kid-b')]]);
 assert.equal((await h.signer('kid-a')).kid,'kid-a');
 assert.equal((await h.signer('kid-b')).kid,'kid-b');
 assert.equal((await h.signer('kid-a')).kid,'kid-a');
 assert.equal(h.calls,2);
});

test('Unknown kid remains rejected after a forced refresh',async()=>{
 const h=harness([[jwk('kid-a')],[jwk('kid-a')]]);
 await assert.rejects(()=>h.signer('forged-kid'),/INVALID_SIGNER/);
 assert.equal(h.calls,2);
});

test('Expired JWKS cache refreshes before using a key',async()=>{
 const h=harness([[jwk('kid-a')],[jwk('kid-a')]]);
 await h.signer('kid-a');
 h.advance(5*60*1000+1);
 await h.signer('kid-a');
 assert.equal(h.calls,2);
});

test('Refresh failure fails closed rather than accepting an unknown kid',async()=>{
 const h=harness([[jwk('kid-a')],new Error('upstream unavailable')]);
 await h.signer('kid-a');
 await assert.rejects(()=>h.signer('kid-b'),/upstream unavailable/);
 assert.equal(h.calls,2);
});
