// Imported inline by the RecordNote website <script type="module">.
// A new recording freezes this policy at the beginning. Old files are never modified.
const MD_POLICY_CACHE='recordnote.m4a.policy.cached.v1';
const MD_GEO_CONSENT='recordnote.location.reverse.optin.v1';
function mdGeoOptIn(){try{return localStorage.getItem(MD_GEO_CONSENT)==='on'}catch{return false}}
async function mdPolicyAtStart(){
  try{
    if(!API)throw Error('NO_API');
    const request=state.mode==='live'?authenticated(`${API}/v1/metadata-policy/active`,{signal:AbortSignal.timeout(8000)}):fetch(`${API}/v1/metadata-policy/active`,{cache:'no-store',signal:AbortSignal.timeout(2500)});
    const result=await request;
    if(!result.ok)throw Error('POLICY_API_'+result.status);
    const policy=await result.json();
    if(policy.app_id!=='recordnote'||policy.scope!=='future_recordings_only'||!Number.isSafeInteger(policy.revision)||policy.settings?.rewrite_existing_recordings!==false)throw Error('BAD_POLICY');
    localStorage.setItem(MD_POLICY_CACHE,JSON.stringify(policy));
    return structuredClone(policy);
  }catch{
    try{const p=JSON.parse(localStorage.getItem(MD_POLICY_CACHE)||'null');if(p?.app_id==='recordnote'&&p.scope==='future_recordings_only'&&p.settings?.rewrite_existing_recordings===false)return structuredClone(p)}catch{}
    return null;
  }
}
function mdGPSIso(gps){
 if(!gps||!gpsOptIn()||!Number.isFinite(gps.lat)||!Number.isFinite(gps.lon)||Math.abs(gps.lat)>90||Math.abs(gps.lon)>180)return '';
 const coordinate=(x,ints)=>`${x<0?'-':'+'}${Math.abs(x).toFixed(6).padStart(ints+7,'0')}`;
 return coordinate(gps.lat,2)+coordinate(gps.lon,3)+'/';
}
async function mdPlaceName(gps,policy){
 if(!gps||!gpsOptIn()||!mdGeoOptIn()||state.mode!=='live'||policy?.fields?.['quicktime.location.name']?.enabled!==true)return '';
 try{
   const response=await api('/v1/location/reverse',{method:'POST',headers:{'content-type':'application/json','x-recordnote-location-consent':'yes'},body:JSON.stringify({lat:gps.lat,lon:gps.lon}),signal:AbortSignal.timeout(10000)});
   return String(response?.name||'').trim().slice(0,120);
 }catch{return ''}
}
function mdValues(policy,{fileName,startedAt,endedAt,bookTitle,gps,placeName}){
 if(!policy||policy.revision<1||policy.status!=='published')return {};
 const localeStart=new Date(startedAt),localeEnd=new Date(endedAt);
 const values={recording_name:fileName,recording_start_iso:localeStart.toISOString(),recording_end_iso:localeEnd.toISOString(),book_title:bookTitle||'未分類',app_name:'繁星答錄機 Starry RecordNote',year:String(localeStart.getFullYear()),gps_iso6709:mdGPSIso(gps),place_name:placeName||'',location_date:gps?localeStart.toISOString():'',location_body:gps?'Earth':'',description:'',keywords:''};
 const output={};for(const [id,config] of Object.entries(policy.fields||{})){
   if(!id.startsWith('quicktime.')||!config?.enabled)continue;
   const key='com.apple.quicktime.'+id.slice('quicktime.'.length);
   if(key.includes('.location.')&&!gpsOptIn())continue;
   // Only verified string-like mdta keys. iTunes binary/numeric require separate encoding.
   if(!new Set(['quicktime.title','quicktime.album','quicktime.artist','quicktime.author','quicktime.comment','quicktime.copyright','quicktime.creationdate','quicktime.description','quicktime.genre','quicktime.information','quicktime.keywords','quicktime.producer','quicktime.publisher','quicktime.software','quicktime.year','quicktime.location.ISO6709','quicktime.location.name','quicktime.location.body','quicktime.location.note','quicktime.location.date']).has(id))continue;
   let v='';if(config.mode==='fixed')v=String(config.value||'');
   else if(config.mode==='system')v=String(values[config.value]||'');
   else if(config.mode==='template')v=String(config.value||'').replace(/\{([a-z_]+)\}/gi,(_,name)=>String(values[name]||''));
   if(v&&new TextEncoder().encode(v).byteLength<=4096)output[key]=v;
 }
 return output;
}
async function mdTagFutureWebRecording(file,policy,details){
 const values=mdValues(policy,details);
 if(!Object.keys(values).length)return {file,status:'no_active_supported_keys'};
 if(!/\.m4a$/i.test(file.name)||!/(audio\/mp4|audio\/x-m4a)/i.test(file.type))return {file,status:'not_m4a'};
 // Mobile browsers may run out of RAM when assembling large Blob parts. Native Expo adapter is chunked.
 if(file.size>70*1024*1024)return {file,status:'web_large_file_skipped'};
 try{
   const engine=await import('/assets/m4a-mdta.mjs');
   const chunks=[];
   const result=await engine.embedMdtaStream({size:file.size,readAt:async(o,n)=>new Uint8Array(await file.slice(o,o+n).arrayBuffer()),write:async chunk=>chunks.push(chunk)},values);
   const output=new File(chunks,file.name,{type:'audio/mp4',lastModified:file.lastModified});
   if(output.size!==result.bytes)throw Error('FILE_SIZE_MISMATCH');
   const actual=await engine.readMdtaStream({size:output.size,readAt:async(o,n)=>new Uint8Array(await output.slice(o,o+n).arrayBuffer())});
   for(const [key,value] of Object.entries(values))if(actual[key]!==value)throw Error('M4A_READBACK_MISMATCH');
   return {file:output,status:'written',keyCount:Object.keys(values).length,revision:policy.revision};
 }catch(error){console.warn('RecordNote M4A metadata skipped; original file retained',error instanceof Error?error.message:'unknown');return {file,status:'writer_failed'};}
}