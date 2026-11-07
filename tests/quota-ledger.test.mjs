import test from 'node:test';
import assert from 'node:assert/strict';
import {quotaCeiling,chargeQuota} from '../.build/quota-ledger.js';
import {ValidationError} from '../.build/core.js';
test('free trial 30-minute lifetime cap, not a monthly reset',()=>{
 assert.equal(quotaCeiling('free','transcription_seconds'),1800);
 assert.equal(quotaCeiling('standard','transcription_seconds'),36000);
 assert.equal(quotaCeiling('professional','transcription_seconds'),108000);
});
test('requires lifetime free window and server-confirmed paid windows',async()=>{
 const invalid={userId:'u1',plan:'free',kind:'transcription_seconds',units:100,periodKey:'paid:2026-10-23',idempotencyKey:'request-0001'};
 await assert.rejects(chargeQuota({prepare(){throw Error('unexpected SQL')}},invalid),ValidationError);
});
test('cannot accept negative, fractional units or short request keys',async()=>{
 const base={userId:'u1',plan:'free',kind:'ai_questions',units:1,periodKey:'free:lifetime',idempotencyKey:'request-0001'};
 const noSql={prepare(){throw Error('invalid charge reached DB')}};
 for(const invalid of [{...base,units:-1},{...base,units:0},{...base,units:1.5},{...base,idempotencyKey:'a'}]){
  await assert.rejects(chargeQuota(noSql,invalid),ValidationError);
 }
});
