import {requireString,ValidationError} from './core.js';
/**
 * Only operate on authenticated ownerUserId from verified Starry ID.
 * All member-specific SQL is parameterized and scoped to owner_user_id.
 * Soft-deleted courses stay inaccessible. Cleanup/deletion of R2 assets is a separate reviewed job.
 */
interface BoundStatement {
  bind(...args:(string|number)[]):BoundStatement;
  first<T>():Promise<T|null>;
  all<T>():Promise<{results:T[]}>;
}
export interface CourseDatabase {prepare(sql:string):BoundStatement;}
export interface OwnerCourse {
 id:string;title:string;created_at:string;
 protected_at:string|null;last_viewed_at:string|null;
}
export class CourseInputError extends ValidationError {}
function identity(userId:string):string {
 if(typeof userId!=='string'||userId.length<1||userId.length>200||/\s/.test(userId))
  throw new CourseInputError('invalid member identity');
 return userId;
}
export function validCourseId(value:string):string {
 if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
  throw new CourseInputError('invalid course ID');
 return value.toLowerCase();
}
export async function listOwnedCourses(db:CourseDatabase,userId:string,limit=50):Promise<OwnerCourse[]> {
 identity(userId);
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new CourseInputError('invalid page limit');
 const result=await db.prepare(`SELECT id,title,created_at,protected_at,last_viewed_at
   FROM courses WHERE owner_user_id=? AND deleted_at IS NULL
   ORDER BY created_at DESC,id DESC LIMIT ?`)
   .bind(userId,limit).all<OwnerCourse>();
 return result.results;
}
export async function createOwnedCourse(db:CourseDatabase,userId:string,title:unknown):Promise<OwnerCourse> {
 identity(userId);
 const cleaned=requireString(title,'title',120);
 const id=crypto.randomUUID();
 const row=await db.prepare(`INSERT INTO courses(id,owner_user_id,title)
    VALUES(?,?,?) RETURNING id,title,created_at,protected_at,last_viewed_at`)
    .bind(id,userId,cleaned).first<OwnerCourse>();
 if(!row)throw new Error('course insert not acknowledged');
 return row;
}
export async function renameOwnedCourse(db:CourseDatabase,userId:string,id:string,title:unknown):Promise<OwnerCourse|null>{
 identity(userId);const courseId=validCourseId(id);
 const cleaned=requireString(title,'title',120);
 return db.prepare(`UPDATE courses SET title=? WHERE id=? AND owner_user_id=? AND deleted_at IS NULL
   RETURNING id,title,created_at,protected_at,last_viewed_at`)
   .bind(cleaned,courseId,userId).first<OwnerCourse>();
}
export async function protectOwnedCourse(db:CourseDatabase,userId:string,id:string,pinned:unknown):Promise<OwnerCourse|null>{
 identity(userId);const courseId=validCourseId(id);
 if(typeof pinned!=='boolean')throw new CourseInputError('pinned must be boolean');
 return db.prepare(`UPDATE courses
   SET protected_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END
   WHERE id=? AND owner_user_id=? AND deleted_at IS NULL
   RETURNING id,title,created_at,protected_at,last_viewed_at`)
   .bind(pinned?1:0,courseId,userId).first<OwnerCourse>();
}
export async function touchOwnedCourse(db:CourseDatabase,userId:string,id:string):Promise<boolean>{
 identity(userId);const courseId=validCourseId(id);
 const row=await db.prepare(`UPDATE courses SET last_viewed_at=CURRENT_TIMESTAMP
   WHERE id=? AND owner_user_id=? AND deleted_at IS NULL RETURNING id`)
   .bind(courseId,userId).first<{id:string}>();
 return Boolean(row);
}
