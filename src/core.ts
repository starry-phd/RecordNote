/** Starry Recorder: domain rules independent from Cloudflare runtime. */
export const LIMITS = Object.freeze({
  maxRecordingSeconds:100*60, maxRecordingsPerCourse:10, maxAudioBytes:100_000_000,
  maxImagesPerRecording:50, maxVideosPerRecording:1, maxVideoSeconds:10,
  freeImageWidth:800, paidImageWidth:1600,
});
export type Plan='free'|'standard'|'professional';
export type QuotaKind='transcription_seconds'|'ai_questions'|'ocr_images';
export type ShareRight='view'|'download'|'ai';
export const PLAN_QUOTAS:Record<Plan,Readonly<Record<'storageBytes'|'transcriptionSeconds'|'aiQuestions'|'ocrImages',number>>>={
  free:{storageBytes:1_000_000_000,transcriptionSeconds:1800,aiQuestions:10,ocrImages:10},
  standard:{storageBytes:20_000_000_000,transcriptionSeconds:600*60,aiQuestions:200,ocrImages:500},
  professional:{storageBytes:100_000_000_000,transcriptionSeconds:1800*60,aiQuestions:800,ocrImages:2000},
};
export class ValidationError extends Error {
  constructor(message:string){super(message);this.name='ValidationError';}
}
export function requireString(value:unknown,field:string,max:number):string{
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new ValidationError(`${field} must be 1-${max} characters`);
  return value.trim();
}
export function assertRecording(input:{durationSeconds:unknown;slot:unknown}):{durationSeconds:number;slot:number}{
  const {durationSeconds,slot}=input;
  if(!Number.isInteger(durationSeconds)||Number(durationSeconds)<=0||Number(durationSeconds)>LIMITS.maxRecordingSeconds)
    throw new ValidationError('recording duration must be 1-6000 seconds');
  if(!Number.isInteger(slot)||Number(slot)<1||Number(slot)>LIMITS.maxRecordingsPerCourse)
    throw new ValidationError('course recording slot must be 1-10');
  return {durationSeconds:Number(durationSeconds),slot:Number(slot)};
}
export function assertUploadSize(bytes:unknown):number{
  if(!Number.isSafeInteger(bytes)||Number(bytes)<=0||Number(bytes)>LIMITS.maxAudioBytes)
    throw new ValidationError('audio file must be between 1 byte and 100MB');
  return Number(bytes);
}
export function assertMediaCount(images:number,videos:number,videoSeconds=0):void{
  if(![images,videos,videoSeconds].every(Number.isFinite)||images<0||images>50||videos<0||videos>1||videoSeconds<0||videoSeconds>10)
    throw new ValidationError('media limit exceeded');
}
export function remainingQuota(plan:Plan,kind:QuotaKind,used:number):number{
  const key={transcription_seconds:'transcriptionSeconds',ai_questions:'aiQuestions',ocr_images:'ocrImages'} as const;
  if(!Number.isFinite(used)||used<0)throw new ValidationError('invalid used quota');
  return Math.max(0,PLAN_QUOTAS[plan][key[kind]]-used);
}
export function canReadSharedResource(permission:{hasActiveGrant:boolean;allowDownload:boolean;allowAI:boolean},right:ShareRight):boolean{
  if(!permission.hasActiveGrant)return false;
  return right==='view'||(right==='download'&&permission.allowDownload)||(right==='ai'&&permission.allowAI);
}
export function nextRetentionDeadline(activeSubscriptionEndedAt:Date):Date{
  if(Number.isNaN(activeSubscriptionEndedAt.valueOf()))throw new ValidationError('invalid subscription end date');
  return new Date(activeSubscriptionEndedAt.getTime()+180*86400000);
}
export function calculateStorageBytes(minutes:number,kbps=64):number{
  if(!Number.isFinite(minutes)||minutes<0||!Number.isFinite(kbps)||kbps<=0)throw new ValidationError('invalid audio bitrate/duration');
  return Math.ceil(minutes*60*kbps*1000/8);
}
