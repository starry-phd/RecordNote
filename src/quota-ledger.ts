import {PLAN_QUOTAS,ValidationError,type Plan,type QuotaKind} from './core.js';

/**
 * Private server-side billing ledger.
 * Inputs MUST originate from verified Starry ID + server-verified subscription entitlements.
 * NEVER expose this function via a caller-controlled quota or plan endpoint.
 * One atomic SQLite INSERT...SELECT enforces the cap and idempotency, even under retries.
 */
interface Row { id:string;units:number;billing_period:string; }
interface Statement {
 bind(...args:(string|number)[]):Statement;
 first<T>():Promise<T|null>;
}
export interface QuotaDB { prepare(sql:string):Statement; }
export interface QuotaCharge {
 userId:string; plan:Plan; kind:QuotaKind; units:number;
 periodKey:string; idempotencyKey:string;
}
export type QuotaResult =
 |{status:'applied'|'duplicate';remaining:number}
 |{status:'exhausted'|'not_member';remaining:0};

const ALL_KINDS=new Set<QuotaKind>(['transcription_seconds','ai_questions','ocr_images']);
const ALL_PLANS=new Set<Plan>(['free','standard','professional']);
const CAP_KEY:{[K in QuotaKind]:'transcriptionSeconds'|'aiQuestions'|'ocrImages'}={
 transcription_seconds:'transcriptionSeconds',ai_questions:'aiQuestions',ocr_images:'ocrImages'
};
const SELECT_USED='SELECT COALESCE(SUM(units),0) AS used FROM usage_events WHERE user_id=? AND kind=? AND billing_period=?';
const PREVIOUS='SELECT id,units,billing_period FROM usage_events WHERE user_id=? AND kind=? AND idempotency_key=?';
const TRY_INSERT=`
INSERT INTO usage_events(id,user_id,kind,units,billing_period,idempotency_key)
SELECT ?,?,?,?,?,?
WHERE EXISTS (SELECT 1 FROM members WHERE user_id=? AND plan=?)
AND (SELECT COALESCE(SUM(units),0) FROM usage_events
     WHERE user_id=? AND kind=? AND billing_period=?) + ? <= ?
ON CONFLICT(user_id,kind,idempotency_key) DO NOTHING
RETURNING id`;

export function quotaCeiling(plan:Plan,kind:QuotaKind):number{
 if(!ALL_PLANS.has(plan)||!ALL_KINDS.has(kind))throw new ValidationError('unknown quota kind or plan');
 return PLAN_QUOTAS[plan][CAP_KEY[kind]];
}
function validCharge(c:QuotaCharge):void{
 if(!c||!ALL_PLANS.has(c.plan)||!ALL_KINDS.has(c.kind))throw new ValidationError('invalid quota inputs');
 if(typeof c.userId!=='string'||c.userId.length<1||c.userId.length>200||/\s/.test(c.userId))
  throw new ValidationError('invalid user id');
 if(!Number.isSafeInteger(c.units)||c.units<=0)throw new ValidationError('invalid quota amount');
 if(typeof c.idempotencyKey!=='string'||!/^[a-zA-Z0-9._:-]{8,160}$/.test(c.idempotencyKey))
  throw new ValidationError('invalid idempotency key');
 if(c.plan==='free'&&c.periodKey!=='free:lifetime')throw new ValidationError('free trial must use lifetime ledger');
 if(c.plan!=='free'&&
  (typeof c.periodKey!=='string'||!/^paid:[0-9T:Z.-]{20,80}$/.test(c.periodKey)))
  throw new ValidationError('paid quota requires a verified billing cycle');
}
export async function chargeQuota(db:QuotaDB,c:QuotaCharge):Promise<QuotaResult>{
 validCharge(c);
 const cap=quotaCeiling(c.plan,c.kind);
 const [prev,member]=await Promise.all([
  db.prepare(PREVIOUS).bind(c.userId,c.kind,c.idempotencyKey).first<Row>(),
  db.prepare('SELECT user_id FROM members WHERE user_id=? AND plan=?')
    .bind(c.userId,c.plan).first<{user_id:string}>()
 ]);
 if(!member)return {status:'not_member',remaining:0};
 const remaining=async():Promise<number>=>{
  const r=await db.prepare(SELECT_USED).bind(c.userId,c.kind,c.periodKey).first<{used:number}>();
  return Math.max(0,cap-Number(r?.used??0));
 };
 if(prev){
  if(prev.units!==c.units||prev.billing_period!==c.periodKey)
   throw new ValidationError('idempotency key reused with different charge');
  return {status:'duplicate',remaining:await remaining()};
 }
 const id=crypto.randomUUID();
 const applied=await db.prepare(TRY_INSERT).bind(
  id,c.userId,c.kind,c.units,c.periodKey,c.idempotencyKey,
  c.userId,c.plan,c.userId,c.kind,c.periodKey,c.units,cap
 ).first<{id:string}>();
 if(applied)return {status:'applied',remaining:await remaining()};
 // A concurrent identical retry can lose the INSERT conflict but must never charge twice.
 const concurrent=await db.prepare(PREVIOUS).bind(c.userId,c.kind,c.idempotencyKey).first<Row>();
 if(concurrent){
  if(concurrent.units!==c.units||concurrent.billing_period!==c.periodKey)
   throw new ValidationError('idempotency key reused with different charge');
  return {status:'duplicate',remaining:await remaining()};
 }
 return {status:'exhausted',remaining:0};
}
