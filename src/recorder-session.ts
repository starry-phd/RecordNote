import {LIMITS,ValidationError} from './core.js';
/** Pure state reducer for native recorder adapters. This does not record audio by itself. */
export type RecorderSession={
 courseId:string;slot:number;elapsedSeconds:number;
 state:'idle'|'recording'|'paused'|'finishing'|'saved'|'interrupted';
 chunkCount:number;
};
export type RecorderEvent=
 |{type:'START'}|{type:'PAUSE'}|{type:'RESUME'}|{type:'TICK';deltaSeconds:number}
 |{type:'CHUNK_SAVED'}|{type:'STOP'}|{type:'FINISH_SAVED'}|{type:'INTERRUPT'};
export function transition(session:RecorderSession,event:RecorderEvent):RecorderSession{
 const next={...session};
 switch(event.type){
  case 'START':
   if(next.state!=='idle')throw new ValidationError('not idle');
   next.state='recording';break;
  case 'PAUSE':
   if(next.state!=='recording')throw new ValidationError('not recording');
   next.state='paused';break;
  case 'RESUME':
   if(next.state!=='paused')throw new ValidationError('not paused');
   next.state='recording';break;
  case 'TICK':
   if(next.state!=='recording')throw new ValidationError('not recording');
   if(!Number.isFinite(event.deltaSeconds)||event.deltaSeconds<0)throw new ValidationError('invalid duration');
   next.elapsedSeconds=Math.min(LIMITS.maxRecordingSeconds,next.elapsedSeconds+event.deltaSeconds);
   if(next.elapsedSeconds===LIMITS.maxRecordingSeconds)next.state='finishing';
   break;
  case 'CHUNK_SAVED':
   if(!['recording','paused','finishing'].includes(next.state))throw new ValidationError('invalid chunk save');
   next.chunkCount+=1;break;
  case 'STOP':
   if(!['recording','paused'].includes(next.state))throw new ValidationError('invalid stop');
   next.state='finishing';break;
  case 'FINISH_SAVED':
   if(next.state!=='finishing'||next.chunkCount===0)throw new ValidationError('no confirmed audio chunks');
   next.state='saved';break;
  case 'INTERRUPT':
   if(!['recording','paused','finishing'].includes(next.state))throw new ValidationError('invalid interruption');
   next.state='interrupted';break;
 }
 return next;
}
export function mayStartNextSlot(slot:number,autoContinue:boolean):boolean{
 if(!Number.isInteger(slot)||slot<1||slot>10)throw new ValidationError('invalid slot');
 return autoContinue&&slot<10;
}
