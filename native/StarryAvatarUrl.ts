/**
 * Resolve Starry ID's short-lived signed avatar URLs.
 * Central may return an absolute HTTPS URL or a root-relative path in tests.
 * Keep cache identity anchored to image path so a newly uploaded photo refreshes.
 */
export function starryAvatarSource(value:string|null|undefined):{uri:string;cacheKey:string}|null{
 if(typeof value!=='string'||!value.trim())return null;
 try{
  const url=new URL(value,'https://id.starry.phd');
  if(url.protocol!=='https:'||url.username||url.password)return null;
  return {uri:url.href,cacheKey:url.origin+url.pathname};
 }catch{return null;}
}
