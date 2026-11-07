import {ValidationError} from './core.js';
interface Statement{
 bind(...args:(string|number)[]):Statement;
 first<T>():Promise<T|null>;
}
export interface CourseDB{prepare(sql:string):Statement;}
export interface ProtectedCourse{id:string;protected_at:string|null;}
const ID=/^[a-zA-Z0-9_-]{1,200}$/;
/** Only the verified owner may update their own course protection. */
export async function setCourseProtected(
 db:CourseDB,ownerUserId:string,courseId:string,pin:boolean
):Promise<ProtectedCourse|null>{
 if(typeof ownerUserId!=='string'||!ID.test(ownerUserId)||
    typeof courseId!=='string'||!ID.test(courseId)||typeof pin!=='boolean')
  throw new ValidationError('invalid ownership or protection request');
 return db.prepare(`UPDATE courses
   SET protected_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END
   WHERE id=? AND owner_user_id=? AND deleted_at IS NULL
   RETURNING id,protected_at`)
   .bind(pin?1:0,courseId,ownerUserId).first<ProtectedCourse>();
}
/** Touching last_viewed_at must be scoped to verified owner; shared viewers never overwrite it. */
export async function recordOwnerCourseView(
 db:CourseDB,ownerUserId:string,courseId:string
):Promise<boolean>{
 if(typeof ownerUserId!=='string'||!ID.test(ownerUserId)||
    typeof courseId!=='string'||!ID.test(courseId))
  throw new ValidationError('invalid course owner');
 const row=await db.prepare(`UPDATE courses SET last_viewed_at=CURRENT_TIMESTAMP
    WHERE id=? AND owner_user_id=? AND deleted_at IS NULL RETURNING id`)
    .bind(courseId,ownerUserId).first<{id:string}>();
 return Boolean(row);
}
