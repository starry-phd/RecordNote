/* QuickTime mdta metadata-only atom writer for existing regular or safely-relative fragmented M4A.
 * Zero audio transcoding. This code never touches mdat payload bytes.
 * Only explicit, standard QuickTime mdta keys are accepted by the caller.
 * Copyright notice: newly authored code for RecordNote.
 */
const decoder=new TextDecoder();const encoder=new TextEncoder();
function assert(ok,msg){if(!ok)throw new Error('M4A_METADATA_'+msg)}
function fourCC(b,i){return String.fromCharCode(...b.subarray(i,i+4))}
function uint(b,i){return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(i,false)}
function setUint(b,i,n){new DataView(b.buffer,b.byteOffset,b.byteLength).setUint32(i,n,false)}
function int64(b,i){return new DataView(b.buffer,b.byteOffset,b.byteLength).getBigUint64(i,false)}
function set64(b,i,v){new DataView(b.buffer,b.byteOffset,b.byteLength).setBigUint64(i,v,false)}
function concat(...a){const len=a.reduce((n,x)=>n+x.length,0);const out=new Uint8Array(len);let i=0;for(const x of a){out.set(x,i);i+=x.length}return out}
function u32(n){assert(n>=0&&n<=0xffffffff,'U32_OVERFLOW');const b=new Uint8Array(4);setUint(b,0,n);return b}
function u64(n){const b=new Uint8Array(8);set64(b,0,BigInt(n));return b}
function box(type,body){const t=encoder.encode(type);assert(t.length===4,'BAD_TYPE');const size=body.length+8;assert(size<=0xffffffff,'BOX_TOO_LARGE');return concat(u32(size),t,body)}
function atoms(b,start=0,end=b.length){const out=[];let i=start;while(i<end){assert(i+8<=end,'ATOM_TRUNCATED');const size32=uint(b,i);const type=fourCC(b,i+4);let header=8;let size=size32;if(size32===1){assert(i+16<=end,'ATOM_TRUNCATED');size=Number(int64(b,i+8));header=16}if(size32===0)size=end-i;assert(Number.isSafeInteger(size)&&size>=header&&i+size<=end,'ATOM_SIZE');out.push({type,start:i,size,header,bodyStart:i+header,end:i+size});i+=size;}return out}
const childTypes=new Set(['moov','trak','mdia','minf','stbl','edts','dinf','udta','meta','ilst','moof','traf']);
function patchChunkOffsets(moov,delta){const b=moov.slice();let count=0;function walk(start,end,depth=0){assert(depth<16,'TREE_DEPTH');for(const a of atoms(b,start,end)){
 if(a.type==='stco'){assert(a.bodyStart+8<=a.end,'BAD_STCO');const n=uint(b,a.bodyStart+4),p=a.bodyStart+8;assert(p+n*4<=a.end,'BAD_STCO_COUNT');for(let i=0;i<n;i++){const v=uint(b,p+i*4);assert(v+delta<=0xffffffff,'STCO_OVERFLOW');setUint(b,p+i*4,v+delta)}count+=n;}
 else if(a.type==='co64'){assert(a.bodyStart+8<=a.end,'BAD_CO64');const n=uint(b,a.bodyStart+4),p=a.bodyStart+8;assert(p+n*8<=a.end,'BAD_CO64_COUNT');for(let i=0;i<n;i++)set64(b,p+i*8,int64(b,p+i*8)+BigInt(delta));count+=n;}
 else if(childTypes.has(a.type)&&a.type!=='ilst'){walk(a.bodyStart+(a.type==='meta'?4:0),a.end,depth+1)}
 }}walk(8,b.length);assert(count>0,'NO_CHUNK_OFFSETS');return b}

// Fragmented ISO BMFF may be produced by mobile MediaRecorder, even when the file is .m4a.
// Moving a moov atom shifts all following moof/mdat atom positions by the same amount.
// We only allow this when fragment data offsets are relative and the moov has no
// ordinary sample-table chunk offsets. Absolute offsets, indexes and encryption
// auxiliary offsets remain unsupported rather than risking corrupted audio.
function assertFragmentedSafe(moov,moofs){
 const m=atoms(moov,8,moov.length);
 assert(m.some(a=>a.type==='mvex'),'FRAGMENT_MISSING_MVEX');
 function checkTables(b,start,end,depth=0){
  assert(depth<12,'FRAGMENT_MOOV_DEPTH');
  for(const a of atoms(b,start,end)){
   if(a.type==='stco'||a.type==='co64'){
    assert(a.bodyStart+8<=a.end,'BAD_FRAGMENT_STBL');
    assert(uint(b,a.bodyStart+4)===0,'FRAGMENT_MIXED_CHUNK_OFFSETS');
   }else if(childTypes.has(a.type)&&a.type!=='ilst'){
    checkTables(b,a.bodyStart+(a.type==='meta'?4:0),a.end,depth+1);
   }
  }
 }
 checkTables(moov,8,moov.length);
 for(const chunk of moofs){
  assert(chunk.length<=8*1024*1024,'FRAGMENT_MOOF_TOO_LARGE');
  const mParts=atoms(chunk,8,chunk.length);
  const trafs=mParts.filter(a=>a.type==='traf');
  assert(trafs.length>0,'FRAGMENT_MISSING_TRAF');
  for(const traf of trafs){
   const parts=atoms(chunk,traf.bodyStart,traf.end);
   const tfhd=parts.find(a=>a.type==='tfhd');
   assert(tfhd&&tfhd.bodyStart+8<=tfhd.end,'FRAGMENT_MISSING_TFHD');
   const flags=uint(chunk,tfhd.bodyStart)&0xffffff;
   assert((flags&1)===0,'FRAGMENT_ABSOLUTE_BASE_OFFSET');
   assert(!parts.some(a=>['saio','saiz','senc','uuid'].includes(a.type)),'FRAGMENT_AUXILIARY_OFFSETS');
  }
 }
}
function makeMdta(entries){const keys=[],items=[];let n=0;
 for(const [key,value] of entries){n++;const k=encoder.encode(key),v=encoder.encode(value);assert(k.length>=5&&k.length<=255,'KEY_LENGTH');assert(v.length<=65536,'VALUE_TOO_LONG');keys.push(concat(u32(k.length+8),encoder.encode('mdta'),k));items.push(box(String.fromCharCode(...u32(n)),box('data',concat(u32(1),u32(0),v))))}
 const handler=box('hdlr',concat(u32(0),u32(0),encoder.encode('mdta'),new Uint8Array(12),new Uint8Array(1)));
 return box('meta',concat(u32(0),handler,box('keys',concat(u32(0),u32(n),...keys)),box('ilst',concat(...items))))}
export function embedMdta(input,data,{maxFileBytes=60_000_000}={}){
 const b=input instanceof Uint8Array?input:new Uint8Array(input);
 assert(b.length>32&&b.length<=maxFileBytes,'UNSUPPORTED_SIZE');
 const top=atoms(b);assert(top.filter(a=>a.type==='moov').length===1&&top.some(a=>a.type==='mdat')&&top.some(a=>a.type==='ftyp'),'NOT_M4A');
 assert(!top.some(a=>['sidx','mfra','wide','ssix'].includes(a.type)),'INDEXED_OR_UNSUPPORTED');
 const moov=top.find(x=>x.type==='moov'),mdats=top.filter(x=>x.type==='mdat'),moofs=top.filter(x=>x.type==='moof');
 if(moofs.length){
  assertFragmentedSafe(b.subarray(moov.start,moov.end),moofs.map(a=>b.subarray(a.start,a.end)));
 }else assert(mdats.length===1,'MULTIPLE_MDAT');
 assert(moov.header===8,'EXTENDED_MOOV_UNSUPPORTED');const moovOrig=b.slice(moov.start,moov.end);
 const children=atoms(moovOrig,8,moovOrig.length),udta=children.find(x=>x.type==='udta');assert(children.filter(x=>x.type==='udta').length<=1,'MULTI_UDTA');
 const candidates=Object.entries(data||{}).filter(([k,v])=>k.startsWith('com.apple.quicktime.')&&typeof v==='string'&&v.length>0);
 assert(candidates.length>0&&candidates.length<=100,'NO_SUPPORTED_FIELDS');
 const keys=new Set(candidates.map(x=>x[0]));assert(keys.size===candidates.length,'DUPLICATE_KEYS');
 const mdta=makeMdta(candidates),oldUdta=udta?moovOrig.slice(udta.start,udta.end):null;
 if(udta){const uc=atoms(oldUdta,8,oldUdta.length);for(const atom of uc.filter(x=>x.type==='meta')){
 const metaChildren=atoms(oldUdta,atom.bodyStart+4,atom.end);const handler=metaChildren.find(x=>x.type==='hdlr');if(handler&&fourCC(oldUdta,handler.bodyStart+8)==='mdta')throw new Error('M4A_METADATA_ALREADY_HAS_MDTA');
 }}
 const newUdta=udta?box('udta',concat(oldUdta.subarray(8),mdta)):box('udta',mdta);
 const nextChildren=children.map(c=>c===udta?newUdta:moovOrig.slice(c.start,c.end));if(!udta)nextChildren.push(newUdta);
 let nextMoov=box('moov',concat(...nextChildren));const delta=nextMoov.length-moovOrig.length;
 if(!moofs.length&&moov.start<mdats[0].start)nextMoov=patchChunkOffsets(nextMoov,delta);
 const out=concat(b.subarray(0,moov.start),nextMoov,b.subarray(moov.end));
 // Atom structure + unchanged mdat are mandatory; never return a corrupt file.
 const outTop=atoms(out),outMdats=outTop.filter(x=>x.type==='mdat');
 assert(outMdats.length===mdats.length,'MDAT_COUNT_CHANGED');
 for(let j=0;j<mdats.length;j++){
  const before=mdats[j],after=outMdats[j];
  assert(after.size===before.size,'MDAT_LENGTH_CHANGED');
  assert(out.subarray(after.start,after.end).every((x,i)=>x===b[before.start+i]),'MDAT_PAYLOAD_CHANGED');
 }
 return out;
}
export function readMdta(input){const b=input instanceof Uint8Array?input:new Uint8Array(input),top=atoms(b),moov=top.find(x=>x.type==='moov');if(!moov)return {};
 const result={};const parts=atoms(b,moov.bodyStart,moov.end);for(const udta of parts.filter(x=>x.type==='udta'))for(const meta of atoms(b,udta.bodyStart,udta.end).filter(x=>x.type==='meta')){
 const sub=atoms(b,meta.bodyStart+4,meta.end),handler=sub.find(x=>x.type==='hdlr');if(!handler||fourCC(b,handler.bodyStart+8)!=='mdta')continue;
 const keys=sub.find(x=>x.type==='keys'),list=sub.find(x=>x.type==='ilst');if(!keys||!list)continue;
 const dict=[];let pos=keys.bodyStart+8;const count=uint(b,keys.bodyStart+4);for(let i=0;i<count;i++){const len=uint(b,pos);assert(len>=8&&pos+len<=keys.end,'BAD_KEYS');dict.push(decoder.decode(b.subarray(pos+8,pos+len)));pos+=len}
 for(const entry of atoms(b,list.bodyStart,list.end)){const ix=uint(b,entry.start+4)-1;if(ix<0||ix>=dict.length)continue;const dataAtom=atoms(b,entry.bodyStart,entry.end).find(x=>x.type==='data');if(!dataAtom)continue;const kind=uint(b,dataAtom.bodyStart);if(kind===1)result[dict[ix]]=decoder.decode(b.subarray(dataAtom.bodyStart+8,dataAtom.end));}
 }return result}

/** Progressive ISO BMFF file rewrite. Reads only moov + small chunks.
 * readAt(offset,length): Promise<Uint8Array>; write(chunk): Promise<void>.
 * On any exception caller MUST discard temporary output and retain original.
 */
export async function embedMdtaStream({size,readAt,write},data,{chunkBytes=512*1024,maxMoovBytes=24*1024*1024}={}){
 assert(Number.isSafeInteger(size)&&size>32,'BAD_FILE_SIZE');
 async function exact(offset,length){const b=await readAt(offset,length);assert(b instanceof Uint8Array&&b.length===length,'SHORT_READ');return b}
 const top=[];for(let i=0;i<size;){let head=await exact(i,8),size32=uint(head,0),kind=fourCC(head,4),hdr=8,count=size32;
 if(size32===1){head=await exact(i,16);count=Number(int64(head,8));hdr=16}
 if(size32===0)count=size-i;
 assert(Number.isSafeInteger(count)&&count>=hdr&&i+count<=size,'BAD_TOP_LEVEL_ATOM');top.push({type:kind,start:i,end:i+count,size:count,header:hdr});i+=count;}
 assert(top.filter(a=>a.type==='moov').length===1&&top.some(a=>a.type==='mdat')&&top.some(a=>a.type==='ftyp'),'NOT_M4A');
 assert(!top.some(a=>['sidx','mfra','wide','ssix'].includes(a.type)),'INDEXED_OR_UNSUPPORTED');
 const oldMoov=top.find(a=>a.type==='moov'),mdat=top.find(a=>a.type==='mdat'),moofs=top.filter(a=>a.type==='moof');
 if(!moofs.length)assert(top.filter(a=>a.type==='mdat').length===1,'MULTIPLE_MDAT');
 assert(oldMoov.header===8&&oldMoov.size<=maxMoovBytes,'MOOV_TOO_LARGE');
 const m=await exact(oldMoov.start,oldMoov.size),children=atoms(m,8,m.length),udta=children.find(a=>a.type==='udta');assert(children.filter(a=>a.type==='udta').length<=1,'MULTI_UDTA');
 if(moofs.length){
  const fragments=[];
  for(const f of moofs){
   assert(f.size<=8*1024*1024,'FRAGMENT_MOOF_TOO_LARGE');
   fragments.push(await exact(f.start,f.size));
  }
  assertFragmentedSafe(m,fragments);
 }
 const entries=Object.entries(data||{}).filter(([k,v])=>k.startsWith('com.apple.quicktime.')&&typeof v==='string'&&v.length>0);
 assert(entries.length>0&&entries.length<=100,'NO_FIELDS');
 const newMeta=makeMdta(entries);
 if(udta){const uc=atoms(m,udta.bodyStart,udta.end);for(const a of uc.filter(a=>a.type==='meta')){const s=atoms(m,a.bodyStart+4,a.end),h=s.find(x=>x.type==='hdlr');if(h&&fourCC(m,h.bodyStart+8)==='mdta')throw Error('M4A_METADATA_ALREADY_HAS_MDTA')}}
 const oldUdta=udta?m.subarray(udta.start,udta.end):null;
 const newerUdta=box('udta',concat(oldUdta?oldUdta.subarray(8):new Uint8Array(0),newMeta));
 const parts=children.map(c=>c===udta?newerUdta:m.subarray(c.start,c.end));if(!udta)parts.push(newerUdta);
 let updatedMoov=box('moov',concat(...parts));const delta=updatedMoov.length-m.length;
 if(!moofs.length&&oldMoov.start<mdat.start)updatedMoov=patchChunkOffsets(updatedMoov,delta);
 // Read the entire source only in chunks; binary media bytes remain identical.
 let written=0;for(const a of top){if(a===oldMoov){await write(updatedMoov);written+=updatedMoov.length;continue}
 for(let i=a.start;i<a.end;i+=chunkBytes){const bytes=await exact(i,Math.min(chunkBytes,a.end-i));await write(bytes);written+=bytes.length}}
 assert(written===size+delta,'WRITTEN_LENGTH_MISMATCH');return {bytes:written,metadataKeys:entries.map(x=>x[0]),audioUnmodified:true,metadataDelta:delta}
}

/** Extract written metadata without reading media bytes. */
export async function readMdtaStream({size,readAt},{maxMoovBytes=24*1024*1024}={}){
 let offset=0;while(offset<size){const head=await readAt(offset,16);assert(head?.length>=8,'SHORT_READ');const type=fourCC(head,4),short=uint(head,0),hdr=short===1?16:8;
 const length=short===1?Number(int64(head,8)):short===0?size-offset:short;
 assert(Number.isSafeInteger(length)&&length>=hdr&&offset+length<=size,'BAD_ATOM');
 if(type==='moov'){assert(length<=maxMoovBytes,'MOOV_TOO_LARGE');const bytes=await readAt(offset,length);assert(bytes?.length===length,'SHORT_READ');return readMdta(bytes)}
 offset+=length;
 }return {}
}