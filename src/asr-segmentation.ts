import {LIMITS,ValidationError} from './core.js';

export interface ChunkPlan{
 index:number;startMs:number;endMs:number;displayFromMs:number;
}
export interface WhisperTimedSegment{
 start:number;end:number;text:string;
}
export interface VerifiedTimedSegment{
 index:number;startMs:number;endMs:number;text:string;speaker:null;
}
/**
 * Plans extraction of complete decoded audio segments. This NEVER slices AAC/M4A bytes.
 * FFmpeg service will use these time windows to produce independently decodable WAV chunks.
 */
export function planAudioChunks(durationSeconds:number,chunkSeconds=90,overlapSeconds=1):ChunkPlan[]{
 if(!Number.isFinite(durationSeconds)||durationSeconds<=0||durationSeconds>LIMITS.maxRecordingSeconds)
  throw new ValidationError('invalid source audio duration');
 if(!Number.isInteger(chunkSeconds)||chunkSeconds<10||chunkSeconds>120||
    !Number.isInteger(overlapSeconds)||overlapSeconds<0||overlapSeconds>=chunkSeconds)
  throw new ValidationError('invalid chunk planning parameters');
 const durationMs=Math.round(durationSeconds*1000);
 const spanMs=chunkSeconds*1000,overlapMs=overlapSeconds*1000;
 const result:ChunkPlan[]=[];
 let startMs=0,displayFromMs=0;
 while(startMs<durationMs){
  if(result.length>1000)throw new ValidationError('excessive chunk count');
  const endMs=Math.min(startMs+spanMs,durationMs);
  result.push({index:result.length,startMs,endMs,displayFromMs});
  if(endMs===durationMs)break;
  displayFromMs=endMs;
  startMs=endMs-overlapMs;
 }
 return result;
}
/**
 * Cloudflare Whisper returns timestamps relative to each chunk; normalize to original
 * recording timeline and remove most overlap. Never assign speaker IDs without diarization.
 */
export function normalizeWhisperTimedSegments(
 plan:ChunkPlan,items:WhisperTimedSegment[]
):VerifiedTimedSegment[]{
 if(!plan||!Number.isInteger(plan.index)||!Number.isSafeInteger(plan.startMs)||
  !Number.isSafeInteger(plan.endMs)||plan.endMs<=plan.startMs)
  throw new ValidationError('invalid trusted chunk window');
 if(!Array.isArray(items)||items.length>500)throw new ValidationError('too many ASR segments');
 const maxSeconds=(plan.endMs-plan.startMs)/1000;
 const saved:VerifiedTimedSegment[]=[];
 for(const s of items){
  if(!s||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start
    ||s.end>maxSeconds+0.5||typeof s.text!=='string'||s.text.length>5000)
    throw new ValidationError('invalid Whisper segment');
  const startMs=Math.max(plan.startMs+Math.round(s.start*1000),plan.displayFromMs);
  const endMs=Math.min(plan.startMs+Math.round(s.end*1000),plan.endMs);
  if(endMs<=plan.displayFromMs||endMs<=startMs||!s.text.trim())continue;
  saved.push({index:saved.length,startMs,endMs,text:s.text.trim(),speaker:null});
 }
 return saved.sort((a,b)=>a.startMs-b.startMs||a.endMs-b.endMs)
   .map((s,index)=>({...s,index}));
}
