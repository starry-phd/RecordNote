/** Fail-closed identity boundary; Starry ID must publish trusted RS256 JWKS first. */
export type IdentityConfiguration={issuer:string;audience:string;jwksUrl:string};
export class AuthenticationError extends Error {constructor(message='authentication failed'){super(message);this.name='AuthenticationError';}}
function decodeBase64Url(data:string):Uint8Array{
  if(!/^[A-Za-z0-9_-]+$/.test(data))throw new AuthenticationError();
  const normalized=data.replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'='));
  return Uint8Array.from(binary,x=>x.charCodeAt(0));
}
function parsePart<T>(data:string):T{
  try{return JSON.parse(new TextDecoder().decode(decodeBase64Url(data))) as T;}
  catch{throw new AuthenticationError();}
}
export async function verifyStarryToken(
  token:string,config:IdentityConfiguration,requestFetch:typeof fetch=fetch,
  nowSeconds=Math.floor(Date.now()/1000),
):Promise<string>{
  if(!config.issuer||!config.audience||!config.jwksUrl||!config.jwksUrl.startsWith('https://'))
    throw new AuthenticationError('identity provider not configured');
  if(typeof token!=='string'||token.length>12000)throw new AuthenticationError();
  const parts=token.split('.');
  if(parts.length!==3)throw new AuthenticationError();
  const [head,body,signature]=parts;
  const header=parsePart<{alg?:string;kid?:string;typ?:string}>(head);
  const claims=parsePart<{iss?:string;aud?:string|string[];sub?:string;exp?:number;nbf?:number;iat?:number}>(body);
  if(header.alg!=='RS256'||!header.kid||header.kid.length>200)throw new AuthenticationError();
  if(claims.iss!==config.issuer||!(Array.isArray(claims.aud)?claims.aud.includes(config.audience):claims.aud===config.audience))
    throw new AuthenticationError();
  if(typeof claims.exp!=='number'||claims.exp<=nowSeconds||claims.exp>nowSeconds+86400)throw new AuthenticationError();
  if(claims.nbf!==undefined&&(typeof claims.nbf!=='number'||claims.nbf>nowSeconds))throw new AuthenticationError();
  if(claims.iat!==undefined&&(typeof claims.iat!=='number'||claims.iat>nowSeconds+60))throw new AuthenticationError();
  if(typeof claims.sub!=='string'||claims.sub.length<1||claims.sub.length>200)throw new AuthenticationError();
  let jwks:{keys?:Array<JsonWebKey&{kid?:string;use?:string;alg?:string}>};
  try{
    const response=await requestFetch(config.jwksUrl,{redirect:'error',signal:AbortSignal.timeout(4000)});
    if(!response.ok)throw new Error();
    jwks=await response.json();
  }catch{throw new AuthenticationError('identity verification unavailable');}
  const jwk=jwks.keys?.find(x=>x.kid===header.kid&&x.kty==='RSA'&&(!x.alg||x.alg==='RS256')&&(!x.use||x.use==='sig'));
  if(!jwk)throw new AuthenticationError();
  try{
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,new Uint8Array(decodeBase64Url(signature)),new TextEncoder().encode(head+'.'+body));
    if(!valid)throw new AuthenticationError();
  }catch{throw new AuthenticationError();}
  return claims.sub;
}
