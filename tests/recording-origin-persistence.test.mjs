import test from 'node:test';
import assert from 'node:assert/strict';
import {storeOriginVerified} from '../src/recording-origin-persistence.mjs';

const origin={id:'e12f990a-85a8-4b13-855b-79347efad245',time:1793970999999,
  zone:'Asia/Taipei',lat:24.59939,lon:120.77734,accuracy:6,
  place:'苗栗縣後龍鎮十班坑',source:'NLSC_Taiwan',revision:3,writer:'written'};
const request={mediaId:'media-abc',ownerId:'user-test',origin,nowMs:1793971000999};

function mockD1({neverPersists=false}={}){
  let row=null,insertCount=0;
  return {
    get row(){return row;},get insertCount(){return insertCount;},
    prepare(sql){return {bind(...args){return {
      async first(){assert.match(sql,/^SELECT/);return row&&row.media_id===args[0]?{...row}:null;},
      async run(){assert.match(sql,/^INSERT/);assert.match(sql,/ON CONFLICT\\(media_id\\) DO NOTHING/);insertCount++;
        const cols=['media_id','owner_id','client_recording_id','recorded_at_ms','recorded_timezone',
          'gps_lat','gps_lon','gps_accuracy_m','location_name','location_source','policy_revision',
          'metadata_write_status','created_at_ms'];
        if(!row&&!neverPersists)row=Object.fromEntries(cols.map((k,i)=>[k,args[i]]));
        return {meta:{changes:row&&insertCount===1?1:0}};
      },
    };}};}
  };
}

test('inserts a future recording and verifies all stored fields',async()=>{
  const db=mockD1();const result=await storeOriginVerified(db,request);
  assert.deepEqual(result,{mediaId:'media-abc',replayed:false,verified:true});
  assert.equal(db.row.recorded_timezone,'Asia/Taipei');
  assert.equal(db.row.gps_lat,24.59939);
  assert.equal(db.row.location_name,'苗栗縣後龍鎮十班坑');
});

test('an identical retry is idempotent',async()=>{
  const db=mockD1();await storeOriginVerified(db,request);
  assert.deepEqual(await storeOriginVerified(db,request),{mediaId:'media-abc',replayed:true,verified:true});
  assert.equal(db.insertCount,1);
});

test('conflicting GPS on same media ID is rejected; original remains unchanged',async()=>{
  const db=mockD1();await storeOriginVerified(db,request);
  await assert.rejects(storeOriginVerified(db,{...request,origin:{...origin,lat:24.1}}),/ORIGIN_IMMUTABLE/);
  assert.equal(db.row.gps_lat,24.59939);
});

test('a write that stored nothing never reports success',async()=>{
  const db=mockD1({neverPersists:true});
  await assert.rejects(storeOriginVerified(db,request),/ORIGIN_NOT_PERSISTED/);
});
