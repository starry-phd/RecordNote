import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../.build/worker-boundary.mjs';

const issuer='https://starry-test-identity.invalid';
const audience='starry-recorder';
const jwksUrl=issuer+'/jwks';
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const alice='alice-localtest',bob='bob-localtest';
const COURSE_A='11111111-1111-4111-8111-111111111111';
const COURSE_B='22222222-2222-4222-8222-222222222222';
const originalFetch=globalThis.fetch;

function fakeD1(){
 const members=new Set(),courses=new Map();
 const DB={
  prepare(sql){
   let args=[];
   const stmt={
    bind(...values){args=values;return this;},
    async run(){
     if(sql.includes('INSERT OR IGNORE INTO members'))members.add(args[0]);
     else throw new Error('Unexpected SQL.run(): '+sql);
     return {success:true,meta:{changes:1}};
    },
    async first(){
     if(sql.includes('INSERT INTO courses')&&sql.includes('RETURNING')){
      const [id,owner,title]=args;
      const result={id,owner_user_id:owner,title,created_at:'2026-10-23 07:00:00',protected_at:null,last_viewed_at:null,deleted_at:null};
      courses.set(id,result);return result;
     }
     if(sql.includes('UPDATE courses SET title=')){
      const [title,id,owner]=args;
      const c=courses.get(id);if(!c||c.owner_user_id!==owner||c.deleted_at)return null;
      c.title=title;return c;
     }
     if(sql.includes('UPDATE courses')&&sql.includes('protected_at=')){
      const [pinned,id,owner]=args;const c=courses.get(id);
      if(!c||c.owner_user_id!==owner||c.deleted_at)return null;
      c.protected_at=pinned?'2026-10-23 07:30:00':null;return c;
     }
     if(sql.includes('UPDATE courses SET last_viewed_at=')){
      const [id,owner]=args;const c=courses.get(id);
      if(!c||c.owner_user_id!==owner||c.deleted_at)return null;
      c.last_viewed_at='2026-10-23 07:31:00';return {id};
     }
     if(sql.includes('SELECT 1 FROM courses')){
      const [id,owner]=args;const c=courses.get(id);
      return c&&c.owner_user_id===owner&&!c.deleted_at?{'1':1}:null;
     }
     if(sql.includes('SELECT 1 FROM grants'))return null;
     if(sql.includes('SELECT id,title,created_at FROM courses WHERE id=')){
      const c=courses.get(args[0]);return c&&!c.deleted_at?c:null;
     }
     throw new Error('Unexpected SQL.first(): '+sql);
    },
    async all(){
     if(sql.includes('FROM courses WHERE owner_user_id=?')){
      const [owner,limit]=args;
      return {results:[...courses.values()].filter(x=>x.owner_user_id===owner&&!x.deleted_at).slice(0,limit)};
     }
     throw new Error('Unexpected SQL.all(): '+sql);
    }
   };
   return stmt;
  }
 };
 return {DB,members,courses};
}
async function fixture(){
 const pair=await crypto.subtle.generateKey(
  {name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const key=await crypto.subtle.exportKey('jwk',pair.publicKey);
 globalThis.fetch=async url=>{
  if(url!==jwksUrl)throw new Error('unexpected JWKS request: '+url);
  return new Response(JSON.stringify({keys:[{...key,kid:'test-key',alg:'RS256',use:'sig'}]}),{status:200});
 };
 const sign=async(sub)=>{
  const data=encode({alg:'RS256',kid:'test-key',typ:'JWT'})+'.'+encode({sub,iss:issuer,aud:audience,exp:now+1800,iat:now});
  const bytes=new TextEncoder().encode(data);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,bytes);
  return data+'.'+Buffer.from(signature).toString('base64url');
 };
 const [aliceToken,bobToken]=await Promise.all([sign(alice),sign(bob)]);
 const db=fakeD1();
 const env={
  STAR_ID_ISSUER:issuer,STAR_ID_AUDIENCE:audience,STAR_ID_JWKS_URL:jwksUrl,
  FEATURE_MEMBER_API:'enabled',FEATURE_AUDIO_UPLOAD:'disabled',FEATURE_SHARING:'disabled',DB:db.DB
 };
 const request=(token,method,path,payload,envOverride={})=>worker.fetch(
  new Request('https://recorder.invalid'+path,{method,headers:{
   authorization:'Bearer '+token,...(payload?{'content-type':'application/json'}:{})
  },...(payload?{body:JSON.stringify(payload)}:{})}),
  {...env,...envOverride}
 );
 return {request,db,aliceToken,bobToken};
}
test('verified users can create/list own courses; owner IDs come only from token',async(t)=>{
 t.after(()=>{globalThis.fetch=originalFetch});
 const f=await fixture();
 const created=await f.request(f.aliceToken,'POST','/api/courses',{title:' My own lecture ',owner_user_id:bob});
 assert.equal(created.status,201);
 const a=await created.json();
 assert.equal(a.course.title,'My own lecture');
 assert.equal(f.db.courses.get(a.course.id).owner_user_id,alice);
 const asAlice=await f.request(f.aliceToken,'GET','/api/courses');
 const asBob=await f.request(f.bobToken,'GET','/api/courses');
 assert.equal((await asAlice.json()).courses.length,1);
 assert.equal((await asBob.json()).courses.length,0);
});
test('cross-member rename, pin and recent view all reject, legitimate owner succeeds',async(t)=>{
 t.after(()=>{globalThis.fetch=originalFetch});
 const f=await fixture();
 f.db.courses.set(COURSE_B,{
  id:COURSE_B,owner_user_id:bob,title:"Bob's private course",
  protected_at:null,last_viewed_at:null,created_at:'2026-10-23',deleted_at:null
 });
 const path='/api/courses/'+COURSE_B;
 const blocked=[
  await f.request(f.aliceToken,'PATCH',path,{title:'Stolen'}),
  await f.request(f.aliceToken,'PUT',path+'/protection',{pinned:true}),
  await f.request(f.aliceToken,'POST',path+'/view')
 ];
 assert.deepEqual(blocked.map(x=>x.status),[404,404,404]);
 assert.equal(f.db.courses.get(COURSE_B).title,"Bob's private course");
 assert.equal(f.db.courses.get(COURSE_B).protected_at,null);
 const renamed=await f.request(f.bobToken,'PATCH',path,{title:'Updated by Bob'});
 const pinned=await f.request(f.bobToken,'PUT',path+'/protection',{pinned:true});
 const viewed=await f.request(f.bobToken,'POST',path+'/view');
 assert.equal(renamed.status,200);assert.equal(pinned.status,200);assert.equal(viewed.status,204);
 assert.equal(f.db.courses.get(COURSE_B).title,'Updated by Bob');
 assert.ok(f.db.courses.get(COURSE_B).protected_at);
});
test('tampering with signed token fails before accessing member DB',async(t)=>{
 t.after(()=>{globalThis.fetch=originalFetch});
 const f=await fixture();
 const token=f.aliceToken.split('.');
 token[1]=encode({iss:issuer,aud:audience,sub:bob,exp:now+1800});
 const r=await f.request(token.join('.'),'POST','/api/courses',{title:'forgery'});
 assert.equal(r.status,401);assert.equal(f.db.members.size,0);
});
test('feature switch denies even an otherwise valid signed-in account',async(t)=>{
 t.after(()=>{globalThis.fetch=originalFetch});
 const f=await fixture();
 const r=await f.request(f.aliceToken,'POST','/api/courses',{title:'Not allowed'},
  {FEATURE_MEMBER_API:'disabled'});
 assert.equal(r.status,503);assert.equal(f.db.members.size,0);
});
