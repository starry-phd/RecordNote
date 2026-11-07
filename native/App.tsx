import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Linking,Platform,Pressable,ScrollView,StatusBar,StyleSheet,Text,TextInput,View} from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import {Passkey} from 'react-native-passkey';
import {
 acceptConsent,addPasskey,checkApp,clearLocalSignIn,centralPasskeyError,
 deleteAccount,listPasskeys,removePasskey,restoreSignIn,
 signInWithPasskey,signInWithProvider,starryClient,supportUrl
} from '../expo/RecordNoteStarryAuth';
import type {AppGate,Me} from '../vendor/starry-id/starry-client';

const ID='https://id.starry.phd',WEB='https://recordnote.starry.phd';
const VERSION=Constants.expoConfig?.version||'0.1.0';
const BUILD=Platform.OS==='ios'?String(Constants.expoConfig?.ios?.buildNumber||'1'):String(Constants.expoConfig?.android?.versionCode||'1');
const DEVICE=Device.modelName||Platform.OS,FOREGROUND_INTERVAL_MS=60000;
type Key={id:string;name:string};
function explain(error:unknown,isPasskey=false):string|null{
 if(isPasskey)return centralPasskeyError(error);
 const e=error as {code?:string;cancelled?:boolean};
 if(e?.cancelled)return null;
 if(e?.code==='REAUTH_REQUIRED')return '請先重新登入 Starry ID 後再操作。';
 if(e?.code==='NETWORK')return '中央會員系統暫時無法連線。';
 return e?.code?'操作未完成：'+e.code:'操作未完成，請稍後再試。';
}
function Button({text,onPress,disabled=false,danger=false}:{text:string;onPress:()=>void;disabled?:boolean;danger?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityLabel={text} disabled={disabled} onPress={onPress}
  style={({pressed})=>[styles.button,danger&&styles.danger,disabled&&styles.disabled,pressed&&styles.pressed]}>
  <Text style={styles.buttonText}>{text}</Text>
 </Pressable>;
}
export default function App(){
 const [gate,setGate]=useState<AppGate|null>(null),[user,setUser]=useState<Me|null>(null);
 const [consent,setConsent]=useState(false),[passkeys,setPasskeys]=useState<Key[]>([]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmText,setConfirmText]=useState('');
 const lastCheck=useRef(0),checking=useRef(false),mounted=useRef(true);
 const passkeySupported=Passkey.isSupported();
 const readUser=useCallback(async()=>{
  const data=await starryClient.me();
  if(mounted.current){setUser(data);setConsent(Boolean(data.consent?.required));}
 },[]);
 const readKeys=useCallback(async()=>{
  const data=await listPasskeys();
  if(mounted.current)setPasskeys(data);
 },[]);
 const checkCentral=useCallback(async(force=false)=>{
  if(checking.current||(!force&&Date.now()-lastCheck.current<FOREGROUND_INTERVAL_MS))return;
  checking.current=true;lastCheck.current=Date.now();
  try{
   const current=await checkApp(VERSION);
   if(!mounted.current)return;
   setGate(current);
   if(current.state!=='ok')return;
   if(await restoreSignIn()){
    try{await readUser();}
    catch{if(mounted.current)setMessage('已保留登入資料，稍後重新讀取會員資訊。');}
   }
  }catch{if(mounted.current)setGate({state:'unreachable',notices:[],config:{},minVersion:null});}
  finally{checking.current=false;}
 },[readUser]);
 useEffect(()=>{
  mounted.current=true;void checkCentral(true);
  const listener=AppState.addEventListener('change',state=>{if(state==='active')void checkCentral();});
  return ()=>{mounted.current=false;listener.remove();};
 },[checkCentral]);
 const run=useCallback(async(action:()=>Promise<void>,isPasskey=false)=>{
  if(busy)return;
  setBusy(true);setMessage('');
  try{await action();}catch(error){const text=explain(error,isPasskey);if(text&&mounted.current)setMessage(text);}
  finally{if(mounted.current)setBusy(false);}
 },[busy]);
 const login=(provider:'google'|'apple')=>void run(async()=>{
  if(gate?.state!=='ok')return;
  const result=await signInWithProvider(provider);
  if(!result)return;
  setConsent(Boolean(result.consent_required));await readUser();
 });
 const loginPasskey=()=>void run(async()=>{
  if(gate?.state!=='ok')return;
  const result=await signInWithPasskey();
  if(!result)return;
  setConsent(Boolean(result.consent_required));await readUser();
 },true);
 const logout=()=>void run(async()=>{
  await clearLocalSignIn();setUser(null);setPasskeys([]);setConsent(false);setConfirmText('');
 });
 const approve=()=>void run(async()=>{await acceptConsent();setConsent(false);await readUser();});
 const addKey=()=>void run(async()=>{
  if(await addPasskey(DEVICE+' Passkey')){await readKeys();setMessage('Passkey 已新增。');}
 },true);
 const removeKey=(key:Key)=>Alert.alert('移除 Passkey','確定要移除這把 Passkey？這不會刪除會員帳號。',[
  {text:'取消',style:'cancel'},
  {text:'移除',style:'destructive',onPress:()=>void run(async()=>{await removePasskey(key.id);await readKeys();},true)}
 ]);
 const erase=()=>{
  if(confirmText.trim()!=='DELETE')return;
  Alert.alert('永久刪除 Starry ID 帳號','立即永久刪除，沒有撤回期，也不會自動取消 App Store／Google Play 訂閱。確定嗎？',[
   {text:'取消',style:'cancel'},
   {text:'永久刪除',style:'destructive',onPress:()=>void run(async()=>{
    await deleteAccount();setUser(null);setPasskeys([]);setConsent(false);setConfirmText('');
    setMessage('中央會員刪除程序已完成。');
   })}
  ]);
 };
 const open=(url:string)=>void run(async()=>{await Linking.openURL(url);});
 const contact=()=>void run(async()=>{await Linking.openURL(await supportUrl(VERSION+' ('+BUILD+')',DEVICE));});
 const gated=gate?.state!=='ok';
 const warning=!gate?'正在確認中央會員系統…':gate.state==='maintenance'?'繁星答錄機目前維護中。':
  gate.state==='killed'?'繁星答錄機已停止服務。':gate.state==='update_required'?'請更新 App 再繼續。':
  gate.state==='unreachable'?'中央暫時無法連線；登入與電池扣量停止。':'';
 return <View style={styles.root}>
  <StatusBar barStyle="dark-content"/>
  <ScrollView contentContainerStyle={styles.scroll}>
   <Text style={styles.title}>繁星答錄機 RecordNote</Text>
   <Text style={styles.sub}>Starry ID 原生驗收基座 · {VERSION} ({BUILD})</Text>
   {warning?<View style={styles.alert}><Text>{warning}</Text></View>:null}
   {gate?.notices?.map((n,i)=><View key={i} style={styles.alert}><Text>{n.message}</Text></View>)}
   {!gate?<ActivityIndicator/>:null}
   {!gated&&!user?<View style={styles.card}>
    <Text style={styles.heading}>繁星中央會員登入</Text>
    <Button text="使用 Google 登入" disabled={busy} onPress={()=>login('google')}/>
    <Button text="使用 Apple 登入" disabled={busy} onPress={()=>login('apple')}/>
    {passkeySupported?<Button text="使用 Passkey 登入" disabled={busy} onPress={loginPasskey}/>:null}
    {Platform.OS==='android'?<Text style={styles.muted}>Android Passkey 必須先由業主登記實際安裝 APK 的 SHA-256；登記前無法正常使用。</Text>:null}
   </View>:null}
   {!gated&&user?<View style={styles.card}>
    <Text style={styles.heading}>我的中央會員</Text>
    <Text style={styles.muted}>會員 ID：{user.user_id}</Text>
    <Button text="登出" disabled={busy} onPress={logout}/>
    {consent?<View style={styles.card}>
      <Text style={styles.heading}>請同意最新版會員條款及隱私權政策</Text>
      <Button text="閱讀服務條款" disabled={busy} onPress={()=>open(ID+'/terms')}/>
      <Button text="閱讀隱私權政策" disabled={busy} onPress={()=>open(ID+'/privacy')}/>
      <Button text="我同意條款與隱私權政策" disabled={busy} onPress={approve}/>
    </View>:<>
      <Text style={styles.heading}>我的 Passkey</Text>
      {passkeySupported?<Button text="新增 Passkey" disabled={busy} onPress={addKey}/>:null}
      <Button text="查看我的 Passkey" disabled={busy} onPress={()=>void run(readKeys,true)}/>
      {passkeys.map(k=><View key={k.id} style={styles.keyRow}>
        <Text style={styles.keyName}>{k.name||'Passkey'}</Text>
        <Button text="移除" disabled={busy} danger onPress={()=>removeKey(k)}/>
      </View>)}
      <Text style={styles.muted}>最多 10 把；新增前需於 10 分鐘內登入。</Text>
      <Text style={styles.heading}>永久刪除中央會員帳號</Text>
      <Text style={styles.muted}>立即永久刪除，沒有撤回期，不會自動取消 App Store／Google Play 訂閱。</Text>
      <TextInput value={confirmText} onChangeText={setConfirmText} placeholder="輸入 DELETE"
       accessibilityLabel="輸入 DELETE 確認永久刪除" autoCapitalize="characters" style={styles.input}/>
      <Button text="永久刪除帳號" disabled={busy||confirmText.trim()!=='DELETE'} danger onPress={erase}/>
    </>}
   </View>:null}
   <View style={styles.card}>
    <Text style={styles.heading}>服務與支援</Text>
    <Button text="聯絡客服" disabled={busy} onPress={contact}/>
    <Button text="中央帳號中心" disabled={busy} onPress={()=>open(ID+'/account')}/>
    <Button text="開啟既有 RecordNote 網頁版" disabled={busy} onPress={()=>open(WEB)}/>
    <Text style={styles.muted}>此基座僅驗收原生登入。錄音、AI 任務與完整 RecordNote 手機畫面尚未移植。</Text>
   </View>
   {message?<Text accessibilityRole="alert" style={styles.error}>{message}</Text>:null}
   {busy?<ActivityIndicator/>:null}
  </ScrollView>
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#f5f7fb'},scroll:{paddingHorizontal:18,paddingTop:56,paddingBottom:56,gap:18},
 title:{fontSize:25,fontWeight:'700',color:'#0f172a'},sub:{fontSize:13,color:'#64748b'},
 alert:{padding:12,borderRadius:8,backgroundColor:'#e4edff'},heading:{fontSize:18,fontWeight:'700',color:'#17233d'},
 card:{padding:16,borderRadius:12,backgroundColor:'#fff',gap:12},
 button:{padding:13,backgroundColor:'#354e7a',borderRadius:8,alignItems:'center'},
 danger:{backgroundColor:'#9a2d36'},disabled:{opacity:.5},pressed:{opacity:.75},
 buttonText:{fontWeight:'600',fontSize:15,color:'#fff'},
 muted:{fontSize:14,lineHeight:21,color:'#475569'},error:{color:'#b91c1c'},
 keyRow:{flexDirection:'row',alignItems:'center',gap:10},keyName:{flex:1},
 input:{borderWidth:1,borderColor:'#cbd5e1',borderRadius:7,padding:10}
});
