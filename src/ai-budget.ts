import {ValidationError} from './core.js';
import {MODELS,type AIClient} from './ai-cloudflare.js';
/** Conservative budget reservation per trusted internal AI job, denominated in micro-USD. */
export const AI_LAB_DAILY_LIMIT_MICRO_USD=1_000_000; // US$1/day in the isolated lab
const COST_RESERVATION:Record<string,number>={
 [MODELS.asr]:10000, // $0.01 per bounded two-minute segment, conservatively above listed ASR unit price
 [MODELS.llm]:40000, // $0.04 for one bounded text call
 [MODELS.vision]:80000 // $0.08 for one bounded slide call
};
interface Statement{bind(...args:(string|number)[]):Statement;first<T>():Promise<T|null>}
export interface BudgetDatabase{prepare(sql:string):Statement}
export class AIBudgetExceeded extends Error{constructor(){super('internal AI budget or request cap exceeded');this.name='AIBudgetExceeded';}}
export function protectedAIClient(ai:AIClient,db:BudgetDatabase,options:{testEnvironment:boolean;dayUTC:string;jobId:string}):AIClient{
 if(!options.testEnvironment||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(options.dayUTC)
 ||!/^synthetic-[a-zA-Z0-9_-]{8,80}$/.test(options.jobId))
  throw new ValidationError('AI job must be authorized synthetic lab traffic');
 return {
  async run(model:string,input:Record<string,unknown>):Promise<unknown>{
   const charge=COST_RESERVATION[model];
   if(!charge||!input||typeof input!=='object')throw new ValidationError('AI model not allowed');
   // 10 model calls/day in internal lab; no on-failure refund, so infinite retries cannot overspend.
   const ledger=await db.prepare(`INSERT INTO ai_daily_reservations
      (id,usage_day,job_id,model,estimated_micro_usd)
      SELECT ?,?,?,?,?
      WHERE (SELECT COUNT(*) FROM ai_daily_reservations WHERE usage_day=?) < 10
        AND (SELECT COALESCE(SUM(estimated_micro_usd),0) FROM ai_daily_reservations
             WHERE usage_day=?) + ? <= ?
      RETURNING id`)
      .bind(crypto.randomUUID(),options.dayUTC,options.jobId,model,charge,
       options.dayUTC,options.dayUTC,charge,AI_LAB_DAILY_LIMIT_MICRO_USD)
      .first<{id:string}>();
   if(!ledger)throw new AIBudgetExceeded();
   return ai.run(model,input);
  }
 };
}
