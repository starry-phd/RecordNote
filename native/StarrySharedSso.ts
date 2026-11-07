import {requireNativeModule} from 'expo-modules-core';
import type {StarryStorage} from '../vendor/starry-id/starry-client';

interface NativeSso {
  get(key:string):Promise<string|null>;
  set(key:string,value:string):Promise<void>;
  remove(key:string):Promise<void>;
}
// No fallback to per-App SecureStore: that would silently claim cross-App SSO
// while actually leaving all other Starry Apps signed out.
const native=()=>requireNativeModule<NativeSso>('StarrySharedSso');
export const sharedSsoStorage:StarryStorage={
 get:(key)=>native().get(key),
 set:(key,value)=>native().set(key,value),
 remove:(key)=>native().remove(key)
};
