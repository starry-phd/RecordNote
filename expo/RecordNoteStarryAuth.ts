/**
 * RecordNote native Starry ID auth adapter for the future Expo development build.
 * Requires expo-web-browser, expo-crypto, expo-secure-store, react-native-passkey.
 * NOT wired into a runnable Expo app until the native app shell is created.
 * All provider sign-in uses Starry ID's central browser relay (no provider SDK).
 */
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {Passkey} from 'react-native-passkey';

const ID='https://id.starry.phd';
const APP_ID='recordnote';
const REFRESH_KEY='recordnote.starry.refresh';

export type NativeSignInResponse={
 access_token:string;
 refresh_token:string;
 user:{user_id:string};
 consent_required:boolean;
};
export type Provider='google'|'apple';

type CentralError=Error&{code?:string};
async function central(path:string,body?:unknown,accessToken?:string,method='POST'):Promise<any>{
 const res=await fetch(ID+path,{
  method,headers:{
   ...(body!==undefined?{'Content-Type':'application/json'}:{}),
   ...(accessToken?{Authorization:'Bearer '+accessToken}:{})
  },
  ...(body!==undefined?{body:JSON.stringify(body)}:{})
 });
 const json=await res.json().catch(()=>({}));
 if(!res.ok){
  const code=String(json?.error?.code||'HTTP_'+res.status);
  const error=new Error(code) as CentralError;
  error.code=code;throw error;
 }
 return json;
}
async function acceptSignIn(data:any):Promise<NativeSignInResponse>{
 if(typeof data?.access_token!=='string'||typeof data?.refresh_token!=='string'||typeof data?.user?.user_id!=='string')throw Error('INVALID_CENTRAL_RESPONSE');
 await SecureStore.setItemAsync(REFRESH_KEY,data.refresh_token);
 return data as NativeSignInResponse;
}
export function centralPasskeyError(error:unknown):string|null{
 const err=error as {error?:string;name?:string;code?:string;message?:string};
 const code=String(err?.error||err?.code||err?.name||err?.message||'');
 if(['UserCancelled','NotAllowedError','AbortError'].includes(code))return null;
 if(code==='NoCredentials'||code==='NotFoundError')return '找不到 Passkey，請改用 Apple 或 Google 登入。';
 if(code==='CredentialAlreadyExists'||code==='InvalidStateError')return '這部裝置已經有這把 Passkey。';
 if(code==='REAUTH_REQUIRED')return '請重新登入（10 分鐘內）後再新增 Passkey。';
 if(code==='BadConfiguration')return '此 App 的裝置網域尚未完成驗證，請聯絡管理員。';
 return 'Passkey 未完成，請稍後再試或改用 Apple／Google 登入。';
}
export async function signInWithProvider(provider:Provider):Promise<NativeSignInResponse|null>{
 const {nonce}=await central('/v1/auth/nonce',{app_id:APP_ID});
 if(typeof nonce!=='string'||!nonce)throw Error('INVALID_NONCE');
 const nonceHash=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,nonce);
 const state=Crypto.randomUUID();
 const returnUrl='recordnote://auth/'+provider;
 const url=new URL(ID+'/auth/'+provider+'/start');
 url.searchParams.set('app_id',APP_ID);
 url.searchParams.set('nonce',nonceHash.toLowerCase());
 url.searchParams.set('state',state);
 url.searchParams.set('return',returnUrl);
 const answer=await WebBrowser.openAuthSessionAsync(url.toString(),returnUrl);
 if(answer.type!=='success')return null;
 const callback=new URL(answer.url);
 if(callback.protocol!=='recordnote:'||callback.hostname!=='auth'||callback.pathname!=='/'+provider)throw Error('INVALID_RETURN_URL');
 const hash=new URLSearchParams(callback.hash.replace(/^#/,''));
 const query=callback.searchParams;
 const get=(key:string)=>query.get(key)||hash.get(key);
 if(get('state')!==state)throw Error('AUTH_STATE_MISMATCH');
 if(get('error'))return null; // canceled in browser relay
 const token=get('id_token');
 if(!token)throw Error('AUTH_ID_TOKEN_MISSING');
 const payload:any={app_id:APP_ID,id_token:token,nonce,device_label:'RecordNote Native'};
 if(provider==='apple'&&get('code')){
  payload.authorization_code=get('code');
  payload.redirect_uri=ID+'/auth/apple/callback';
 }
 return acceptSignIn(await central('/v1/auth/'+provider,payload));
}
function validateRp(raw:any,creation=false):any{
 const options=raw?.publicKey;
 const rpId=creation?(options?.rp?.id||options?.rpId):options?.rpId;
 if(rpId!=='id.starry.phd')throw Error('INVALID_PASSKEY_RP_ID');
 return options; // Native react-native-passkey expects base64url JSON strings.
}
export async function signInWithPasskey():Promise<NativeSignInResponse|null>{
 if(!Passkey.isSupported())throw Error('PASSKEY_NOT_SUPPORTED');
 const options=await central('/v1/auth/passkey/options',{app_id:APP_ID});
 const publicKey=validateRp(options);
 let credential:any;
 try{credential=await Passkey.get(publicKey);}
 catch(error){if(centralPasskeyError(error)===null)return null;throw error;}
 if(!credential?.response)return null;
 const {id,response}=credential;
 return acceptSignIn(await central('/v1/auth/passkey',{
  app_id:APP_ID,id,clientDataJSON:response.clientDataJSON,
  authenticatorData:response.authenticatorData,signature:response.signature,
  device_label:'RecordNote Native'
 }));
}
export async function addPasskey(accessToken:string,name?:string):Promise<boolean>{
 if(!Passkey.isSupported())throw Error('PASSKEY_NOT_SUPPORTED');
 // Starry ID requires recent sign-in (10 minutes) and returns REAUTH_REQUIRED.
 const options=await central('/v1/me/passkeys/options',undefined,accessToken);
 let created:any;
 try{created=await Passkey.create(validateRp(options,true));}
 catch(error){if(centralPasskeyError(error)===null)return false;throw error;}
 if(!created?.response)return false;
 await central('/v1/me/passkeys',{
  clientDataJSON:created.response.clientDataJSON,
  attestationObject:created.response.attestationObject,
  ...(name?{name:name.trim().slice(0,80)}:{})
 },accessToken);
 return true;
}
export async function listPasskeys(accessToken:string):Promise<Array<{id:string;name:string}>>{
 const data=await central('/v1/me/passkeys',undefined,accessToken,'GET');
 return Array.isArray(data?.passkeys)?data.passkeys:[];
}
export async function removePasskey(accessToken:string,passkeyId:string):Promise<void>{
 await central('/v1/me/passkeys/'+encodeURIComponent(passkeyId),undefined,accessToken,'DELETE');
}
export async function readRefreshToken():Promise<string|null>{
 return SecureStore.getItemAsync(REFRESH_KEY);
}
export async function clearLocalSignIn():Promise<void>{
 await SecureStore.deleteItemAsync(REFRESH_KEY);
}
export async function supportUrl(appVersion:string,deviceModel:string):Promise<string>{
 const u=new URL(ID+'/support');
 u.searchParams.set('app_id',APP_ID);
 u.searchParams.set('app_version',appVersion);
 u.searchParams.set('device',deviceModel);
 return u.toString();
}
