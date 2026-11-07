import {ValidationError} from './core.js';
/**
 * Dry-run ONLY. Produces a member-visible cleanup suggestion; never deletes R2/D1 objects.
 * Pinned courses always have priority; other courses follow recent activity.
 */
export interface StoredCourse {
 id:string; title:string; bytes:number; pinned:boolean;
 createdAt:string; lastViewedAt:string|null;
}
export interface RetentionPreview{
 capacityBytes:number;usedBytes:number;overageBytes:number;
 keepIds:string[];candidateRemovalIds:string[];
 protectedBytes:number;manualReviewRequired:boolean;
 canAutomaticallyDelete:false;
}
const parseDate=(date:string):number=>{
 const n=Date.parse(date);
 if(!Number.isFinite(n))throw new ValidationError('invalid course timestamp');
 return n;
};
export function previewCourseCleanup(
 courses:StoredCourse[],capacityBytes:number
):RetentionPreview{
 if(!Number.isSafeInteger(capacityBytes)||capacityBytes<0||!Array.isArray(courses))
  throw new ValidationError('invalid retention input');
 const seen=new Set<string>();
 let used=0;
 const trusted=courses.map(c=>{
  if(!c||typeof c.id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(c.id)||seen.has(c.id))
   throw new ValidationError('duplicate or invalid course ID');
  seen.add(c.id);
  if(typeof c.title!=='string'||!c.title.trim()||c.title.length>200||
    typeof c.pinned!=='boolean'||!Number.isSafeInteger(c.bytes)||c.bytes<0)
   throw new ValidationError('invalid course properties');
  used+=c.bytes;
  if(!Number.isSafeInteger(used))throw new ValidationError('storage integer overflow');
  const timestamp=parseDate(c.lastViewedAt||c.createdAt);
  parseDate(c.createdAt);
  return {...c,timestamp};
 });
 const protectedCourses=trusted.filter(c=>c.pinned);
 const remaining=trusted.filter(c=>!c.pinned).sort((a,b)=>b.timestamp-a.timestamp||a.id.localeCompare(b.id));
 const protectedBytes=protectedCourses.reduce((sum,c)=>sum+c.bytes,0);
 const keepIds=protectedCourses.map(c=>c.id);
 const candidateRemovalIds:string[]=[];
 let selectedBytes=protectedBytes;
 if(protectedBytes>capacityBytes){
  // No automatic deletion of pinned items even if they alone exceed the quota.
  candidateRemovalIds.push(...remaining.map(c=>c.id));
 }else{
  for(const c of remaining){
   if(selectedBytes+c.bytes<=capacityBytes){
    selectedBytes+=c.bytes;keepIds.push(c.id);
   }else{
    candidateRemovalIds.push(c.id);
   }
  }
 }
 return {
  capacityBytes,usedBytes:used,overageBytes:Math.max(0,used-capacityBytes),
  keepIds,candidateRemovalIds,protectedBytes,
  manualReviewRequired:protectedBytes>capacityBytes,
  canAutomaticallyDelete:false
 };
}
export function retentionNoticeDays(endOfPaidTerm:Date):Date[]{
 if(Number.isNaN(endOfPaidTerm.getTime()))throw new ValidationError('invalid subscription end');
 return [150,166,173,179].map(day=>new Date(endOfPaidTerm.getTime()+day*86400000));
}
