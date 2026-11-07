/**
 * RecordNote Expo adapter for the official Starry Client (v2026-11-07.12).
 * This is an integration module, NOT a runnable iOS/Android Expo app.
 * Install Expo development build + react-native-passkey in the future App.
 */
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {Passkey} from 'react-native-passkey';
import {StarryClient,StarryError} from '../vendor/starry-id/starry-client';

const ID='https://id.starry.phd';
const APP_ID='recordnote';
export type Provider='google'|'apple';
export type NativeSignInResponse={user:{user_id:string};consent_required:boolean};

const storage={
 get:(key:string)=>SecureStore.getItemAsync(key),
 set:(key:string,value:string)=>SecureStore.setItemAsync(key,value),
 remove:(key:string)=>SecureStore.deleteItemAsync(key)
};
// Official API supplies rpId. Never substitute RecordNote's own domain.
function requireCentralRp(options:Record<string,unknown>,creation=false):Record<string,unknown>{
 const rp=options.rp as {id?:string}|undefined;
 const value=creation?(rp?.id||options.rpId):options.rpId;
 if(value!=='id.starry.phd')throw new Error('INVALID_PASSKEY_RP_ID');
 return options;
}
// react-native-passkey exposes normalized codes under error.error, whereas
// the shared SDK reads DOM-style error.name. Normalize at the platform boundary.
function nativePasskeyFailure(error:unknown):never{
 const source=error as {error?:string;code?:string;name?:string;message?:string};
 const code=String(source?.error||source?.code||source?.name||'');
 if(code==='UserCancelled')throw new StarryError(0,'PASSKEY_CANCELLED','Passkey cancelled');
 if(code==='NoCredentials')throw new StarryError(0,'PASSKEY_NOT_FOUND','No Passkey available');
 if(code==='CredentialAlreadyExists')throw new StarryError(0,'PASSKEY_EXISTS','Passkey already registered');
 if(code==='BadConfiguration')throw new StarryError(0,'PASSKEY_CONFIGURATION_REQUIRED','Domain verification incomplete');
 if(code==='NotSupported')throw new StarryError(0,'PASSKEY_UNSUPPORTED','Passkey is unavailable');
 throw error;
}
const passkey={
 async get(options:Record<string,unknown>){
  if(!Passkey.isSupported())throw new Error('PASSKEY_NOT_SUPPORTED');
  let result;
  try{result=await Passkey.get(requireCentralRp(options) as unknown as Parameters<typeof Passkey.get>[0]);}
  catch(error){nativePasskeyFailure(error);}
  if(!result?.response)throw new Error('PASSKEY_CANCELLED');
  return {id:result.id,clientDataJSON:result.response.clientDataJSON,
   authenticatorData:result.response.authenticatorData,signature:result.response.signature};
 },
 async create(options:Record<string,unknown>){
  if(!Passkey.isSupported())throw new Error('PASSKEY_NOT_SUPPORTED');
  let result;
  try{result=await Passkey.create(requireCentralRp(options,true) as unknown as Parameters<typeof Passkey.create>[0]);}
  catch(error){nativePasskeyFailure(error);}
  if(!result?.response)throw new Error('PASSKEY_CANCELLED');
  return {clientDataJSON:result.response.clientDataJSON,
   attestationObject:result.response.attestationObject};
 }
};
export const starryClient=new StarryClient({
 baseUrl:ID,appId:APP_ID,storage,passkey,
 sha256Hex:(text)=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,text),
 randomState:()=>Crypto.randomUUID(),
 openAuthSession:async(url,returnUrl)=>{
  const result=await WebBrowser.openAuthSessionAsync(url,returnUrl);
  return result.type==='success'?result.url:null;
 },
 deviceLabel:'RecordNote Native'
});
export function centralPasskeyError(error:unknown):string|null{
 const e=error as {code?:string;name?:string;message?:string;cancelled?:boolean};
 const code=String(e?.code||e?.name||e?.message||'');
 if(e?.cancelled||['NotAllowedError','AbortError','PASSKEY_CANCELLED','RELAY_CANCELLED'].includes(code))return null;
 if(['NoCredentials','NotFoundError','PASSKEY_NOT_FOUND'].includes(code))return '找不到 Passkey，請改用 Apple 或 Google 登入。';
 if(['CredentialAlreadyExists','InvalidStateError','PASSKEY_EXISTS'].includes(code))return '這部裝置已經有這把 Passkey。';
 if(code==='REAUTH_REQUIRED')return '登入狀態已失效，請重新登入後再試。';
 if(['BadConfiguration','INVALID_PASSKEY_RP_ID','PASSKEY_CONFIGURATION_REQUIRED'].includes(code))return '此 App 的裝置網域尚未完成驗證，請聯絡管理員。';
 return 'Passkey 未完成，請稍後再試或改用 Apple／Google 登入。';
}
export async function restoreSignIn(){return starryClient.restore();}
export async function accessToken(){return starryClient.getAccessToken();}
export async function signInWithProvider(provider:Provider):Promise<NativeSignInResponse|null>{
 try{return await starryClient.signInWithRelay(provider,{returnUrl:'recordnote://auth/'+provider});}
 catch(error){if(error instanceof StarryError&&error.cancelled)return null;throw error;}
}
export async function signInWithPasskey():Promise<NativeSignInResponse|null>{
 try{return await starryClient.signInWithPasskey();}
 catch(error){if(error instanceof StarryError&&error.cancelled)return null;throw error;}
}
export async function addPasskey(name?:string):Promise<boolean>{
 try{await starryClient.registerPasskey(name?.trim().slice(0,80));return true;}
 catch(error){if(error instanceof StarryError&&error.cancelled)return false;throw error;}
}
export async function listPasskeys(){return starryClient.listPasskeys();}
export async function removePasskey(id:string){return starryClient.removePasskey(id);}
export async function clearLocalSignIn(){await starryClient.signOut();}
export async function deleteAccount(){await starryClient.deleteAccount();}
export async function acceptConsent(){await starryClient.acceptConsent();}
export async function checkApp(version:string){return starryClient.checkApp(version);}
export async function supportUrl(appVersion:string,deviceModel:string):Promise<string>{
 const url=new URL(ID+'/support');
 url.searchParams.set('app_id',APP_ID);
 url.searchParams.set('app_version',appVersion);
 url.searchParams.set('device',deviceModel);
 return url.toString();
}
