import {ValidationError} from './core.js';
import type {EvidenceSource} from './grounded-answer.js';

interface Statement{
 bind(...args:(string|number)[]):Statement;
 first<T>():Promise<T|null>;
 all<T>():Promise<{results:T[]}>;
}
export interface EvidenceDB{prepare(sql:string):Statement}
export class NoAIAccess extends Error{
 constructor(){super('private course AI access denied');this.name='NoAIAccess';}
}
interface TranscriptSourceRow{id:string;courseId:string;recordingId:string;startMs:number;text:string}
interface PhotoSourceRow{id:string;courseId:string;recordingId:string;photoPosition:number;text:string}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function allowedUser(user:string,course:string){
 if(typeof user!=='string'||user.length<1||user.length>200||/\s/.test(user)||
  typeof course!=='string'||!UUID.test(course))throw new ValidationError('invalid private evidence identity');
}
function filterText(row:{text:string}){
 return typeof row.text==='string'&&row.text.trim().length>0&&row.text.length<=4000;
}
/**
 * Generates only authorized source references. Starry ID token MUST be verified upstream.
 * Shared readers require an active explicit allow_ai grant, unlike plain audio playback.
 * This is a limited DB-source sampler, not full-course semantic retrieval.
 */
export async function loadAuthorizedCourseEvidence(
 db:EvidenceDB,userId:string,courseId:string
):Promise<EvidenceSource[]>{
 allowedUser(userId,courseId);
 const permission=await db.prepare(`SELECT c.id FROM courses c WHERE c.id=? AND c.deleted_at IS NULL
  AND (c.owner_user_id=? OR EXISTS(
   SELECT 1 FROM grants g WHERE g.course_id=c.id AND g.granted_user_id=?
   AND g.allow_ai=1 AND g.revoked_at IS NULL
   AND (g.expires_at IS NULL OR g.expires_at>CURRENT_TIMESTAMP)
  ))`).bind(courseId,userId,userId).first<{id:string}>();
 if(!permission)throw new NoAIAccess();
 // Repeat permission in each SQL statement (revocations while fetching must fail closed).
 const permissionSql=`(c.owner_user_id=? OR EXISTS(
  SELECT 1 FROM grants g WHERE g.course_id=c.id AND g.granted_user_id=?
   AND g.allow_ai=1 AND g.revoked_at IS NULL
   AND (g.expires_at IS NULL OR g.expires_at>CURRENT_TIMESTAMP)))`;
 const transcript=await db.prepare(`SELECT t.id AS id,c.id AS courseId,r.id AS recordingId,
  t.start_ms AS startMs,t.text AS text FROM transcript_segments t
  JOIN recordings r ON r.id=t.recording_id JOIN courses c ON c.id=r.course_id
  WHERE c.id=? AND c.deleted_at IS NULL AND r.status='verified'
   AND ${permissionSql}
  ORDER BY t.start_ms ASC LIMIT 8`).bind(courseId,userId,userId).all<TranscriptSourceRow>();
 const photos=await db.prepare(`SELECT m.id AS id,c.id AS courseId,r.id AS recordingId,
  m.position AS photoPosition,m.ocr_text AS text FROM media m
  JOIN recordings r ON r.id=m.recording_id JOIN courses c ON c.id=r.course_id
  WHERE c.id=? AND c.deleted_at IS NULL AND r.status='verified'
   AND m.kind='image' AND m.ocr_text IS NOT NULL AND ${permissionSql}
  ORDER BY m.position ASC LIMIT 4`).bind(courseId,userId,userId).all<PhotoSourceRow>();
 const transcriptEvidence:EvidenceSource[]=(transcript.results||[]).filter(x=>filterText(x)&&Number.isSafeInteger(x.startMs)&&x.startMs>=0)
  .map(x=>({id:'t_'+x.id,kind:'transcript',courseId:x.courseId,recordingId:x.recordingId,startMs:x.startMs,text:x.text}));
 const photoEvidence:EvidenceSource[]=(photos.results||[]).filter(x=>filterText(x)&&Number.isInteger(x.photoPosition)&&x.photoPosition>=1&&x.photoPosition<=50)
  .map(x=>({id:'p_'+x.id,kind:'photo_ocr',courseId:x.courseId,recordingId:x.recordingId,photoPosition:x.photoPosition,text:x.text}));
 return [...transcriptEvidence,...photoEvidence];
}
