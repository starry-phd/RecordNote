import test from 'node:test';import assert from 'node:assert/strict';import {embedMdta,embedMdtaStream,readMdta,readMdtaStream} from '../src/m4a-mdta.mjs';
const text=s=>new TextEncoder().encode(s);
const U32=n=>{const a=new Uint8Array(4);new DataView(a.buffer).setUint32(0,n,false);return a};
const concat=(...bs)=>{const a=new Uint8Array(bs.reduce((n,b)=>n+b.length,0));let o=0;for(const b of bs){a.set(b,o);o+=b.length}return a};
const box=(type,...contents)=>{const b=concat(...contents);return concat(U32(b.length+8),text(type),b)};
function tinyM4a(moovFirst){
 const ftyp=box('ftyp',text('M4A '),U32(0),text('isom'));
 const mdat=box('mdat',Uint8Array.from([1,2,3,4,5,6,7,8]));
 const makeMoov=offset=>box('moov',box('trak',box('mdia',box('minf',box('stbl',box('stco',U32(0),U32(1),U32(offset)))))));
 let moov=makeMoov(ftyp.length+8);
 if(moovFirst)moov=makeMoov(ftyp.length+moov.length+8);
 return concat(ftyp,...(moovFirst?[moov,mdat]:[mdat,moov]));
}
const sample={'com.apple.quicktime.title':'2026 新錄音','com.apple.quicktime.location.ISO6709':'+24.60491+120.78164/','com.apple.quicktime.location.name':'苗栗縣後龍鎮'};
function bytesAt(b,type){let pos=0;for(;pos<b.length;){const size=new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(pos,false);if(new TextDecoder().decode(b.subarray(pos+4,pos+8))===type)return b.subarray(pos,pos+size);pos+=size}return null}
for(const moovFirst of [false,true]){
 test(`${moovFirst?'faststart':'regular'}: writes all keys and leaves media atom exactly intact`,()=>{
   const old=tinyM4a(moovFirst),updated=embedMdta(old,sample);
   assert.deepEqual(readMdta(updated),sample);
   assert.deepEqual(bytesAt(updated,'mdat'),bytesAt(old,'mdat'));
   if(moovFirst){const textString=new TextDecoder('latin1').decode(updated);const idx=textString.indexOf('stco');assert.ok(idx>0);const off=new DataView(updated.buffer).getUint32(idx+12,false);let at=0;while(at<updated.length){if(new TextDecoder().decode(updated.subarray(at+4,at+8))==='mdat')break;at+=new DataView(updated.buffer).getUint32(at,false)}assert.equal(off,at+8)}
 });
 test(`${moovFirst?'faststart':'regular'}: streaming writer/reader and size`,async()=>{
   const old=tinyM4a(moovFirst),parts=[];
   const res=await embedMdtaStream({size:old.length,readAt:async (o,n)=>old.subarray(o,o+n),write:async b=>parts.push(b)},sample,{chunkBytes:3});
   const bytes=concat(...parts);assert.equal(res.bytes,bytes.length);
   const found=await readMdtaStream({size:bytes.length,readAt:async(o,n)=>bytes.subarray(o,o+n)});
   assert.deepEqual(found,sample);assert.deepEqual(bytesAt(bytes,'mdat'),bytesAt(old,'mdat'));
 });
}
test('invalid audio rejected without writing output',()=>assert.throws(()=>embedMdta(Uint8Array.from([1,2,3,4,5]),sample),/M4A_METADATA_/));
test('unrelated metadata keys are not included',()=>{const actual=readMdta(embedMdta(tinyM4a(false),{...sample,'nonstandard.private':'not exposed'}));assert.equal(actual['nonstandard.private'],undefined)});