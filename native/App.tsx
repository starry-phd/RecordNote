import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Linking,Modal,Platform,Pressable,ScrollView,Share,StatusBar,StyleSheet,Text,TextInput,View} from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import {StarryMemberWebView,type MemberPage} from './StarryMemberWebView';
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
 const [memberPage,setMemberPage]=useState<MemberPage|null>(null),[cardRefresh,setCardRefresh]=useState(0);
 const [deleteConfirmOpen,setDeleteConfirmOpen]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmText,setConfirmText]=useState('');
 const lastCheck=useRef(0),checking=useRef(false),mounted=useRef(true);
 const gateState=useRef<AppGate|null>(null),syncing=useRef(false);
 const passkeySupported=Passkey.isSupported();
 const readUser=useCallback(async()=>{
  const data=await starryClient.me();
  if(mounted.current){setUser(data);setConsent(Boolean(data.consent?.required));}
 },[]);
 const readKeys=useCallback(async()=>{
  const data=await listPasskeys();
  if(mounted.current)setPasskeys(data);
 },[]);
 const syncMember=useCallback(async()=>{
  // Always consult shared device SSO on every foreground transition,
  // including when remote config is throttled to once per minute.
  if(syncing.current)return;
  syncing.current=true;
  try {
   const signedIn=await restoreSignIn(); // official SDK restore() includes syncDeviceSignIn()
   if(!mounted.current)return;
   if(!signedIn){setUser(null);setConsent(false);setPasskeys([]);return;}
   try{await readUser();}
   catch {if(mounted.current)setMessage('已保留登入資料，稍後重新讀取會員資訊。');}
  }catch{
   if(mounted.current)setMessage('無法同步其他繁星 App 的登入狀態，請檢查網路。');
  }finally{syncing.current=false;}
 },[readUser]);
 const checkCentral=useCallback(async(force=false)=>{
  if(checking.current)return;
  if(!force&&Date.now()-lastCheck.current<FOREGROUND_INTERVAL_MS){
   if(gateState.current?.state==='ok')await syncMember();
   return;
  }
  checking.current=true;lastCheck.current=Date.now();
  try{
   const current=await checkApp(VERSION);
   if(!mounted.current)return;
   gateState.current=current;setGate(current);
   if(current.state!=='ok')return;
   await syncMember();
  }catch{
   if(mounted.current){
    const failed:AppGate={state:'unreachable',notices:[],config:{},minVersion:null};
    gateState.current=failed;setGate(failed);
   }
  }finally{checking.current=false;}
 },[syncMember]);
 useEffect(()=>{
  mounted.current=true;void checkCentral(true);
  const listener=AppState.addEventListener('change',state=>{if(state==='active'){setCardRefresh(n=>n+1);void checkCentral();}});
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
  await clearLocalSignIn();setUser(null);setPasskeys([]);setConsent(false);setConfirmText('');setMemberPage(null);setDeleteConfirmOpen(false);
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
    await deleteAccount();setUser(null);setPasskeys([]);setConsent(false);setConfirmText('');setMemberPage(null);setDeleteConfirmOpen(false);
    setMessage('中央會員刪除程序已完成。');
   })}
  ]);
 };
 const open=(url:string)=>void run(async()=>{await Linking.openURL(url);});
 const contact=()=>void run(async()=>{await Linking.openURL(await supportUrl(VERSION+' ('+BUILD+')',DEVICE));});
 const invite=()=>void run(async()=>{
  if(!user)return;
  // member_no is mutable: retrieve fresh /v1/me before invoking native Share.
  const currentUserId=user.user_id;
  const me=await starryClient.me();
  if(me.user_id!==currentUserId)return;
  setUser(me);
  const memberNo=typeof me.member_no==='string'?me.member_no:'';
  if(!memberNo){setMessage('尚未取得會員編號，請至中央帳號中心查看。');return;}
  const url=ID+'/Invite/'+encodeURIComponent(memberNo);
  await Share.share({message:url,url});
 });
 const gated=gate?.state!=='ok';
 const warning=!gate?'正在確認中央會員系統…':gate.state==='maintenance'?'繁星答錄機目前維護中。':
  gate.state==='killed'?'繁星答錄機已停止服務。':gate.state==='update_required'?'請更新 App 再繼續。':
  gate.state==='unreachable'?'中央暫時無法連線；登入與 🔋 普通電池扣量停止。':'';
 return <View style={styles.root}>
  <StatusBar barStyle="dark-content"/>
  <ScrollView contentContainerStyle={styles.scroll}>
   <Text style={styles.title}>{user?'設定':'繁星答錄機 RecordNote'}</Text>
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
   {!gated&&user&&consent?<View style={styles.card}>
    <Text style={styles.heading}>請同意最新版會員條款及隱私權政策</Text>
    <Button text="閱讀服務條款" disabled={busy} onPress={()=>open(ID+'/terms')}/>
    <Button text="閱讀隱私權政策" disabled={busy} onPress={()=>open(ID+'/privacy')}/>
    <Button text="我同意條款與隱私權政策" disabled={busy} onPress={approve}/>
   </View>:null}
   {!gated&&user&&!consent?<>
    <StarryMemberWebView page="card" userId={user.user_id} refreshKey={cardRefresh}/>
    <View style={styles.card}>
     <Button text="會員中心" disabled={busy} onPress={()=>setMemberPage('profile')}/>
     <Button text="聯絡客服" disabled={busy} onPress={contact}/>
     <Button text="登出所有繁星 App" disabled={busy} onPress={logout}/>
     <Button text="永久刪除中央帳號" disabled={busy} danger onPress={()=>{setConfirmText('');setDeleteConfirmOpen(true);}}/>
    </View>
    <View style={styles.card}>
     <Text style={styles.heading}>我的 Passkey</Text>
     {passkeySupported?<Button text="新增 Passkey" disabled={busy} onPress={addKey}/>:null}
     <Button text="查看我的 Passkey" disabled={busy} onPress={()=>void run(readKeys,true)}/>
     {passkeys.map(k=><View key={k.id} style={styles.keyRow}>
      <Text style={styles.keyName}>{k.name||'Passkey'}</Text>
      <Button text="移除" disabled={busy} danger onPress={()=>removeKey(k)}/>
     </View>)}
     <Text style={styles.muted}>每位會員最多 10 把 Passkey，登入後隨時可以新增。</Text>
    </View>
    <View style={styles.card}>
     <Text style={styles.heading}>繁星答錄機設定</Text>
     <Button text="分享邀請連結" disabled={busy} onPress={invite}/>
     <Button text="開啟既有 RecordNote 網頁版" disabled={busy} onPress={()=>open(WEB)}/>
     <Text style={styles.muted}>此基座僅驗收原生登入。錄音、AI 任務與完整 RecordNote 手機畫面尚未移植。</Text>
    </View>
   </>:null}
   {message?<Text accessibilityRole="alert" style={styles.error}>{message}</Text>:null}
   {busy?<ActivityIndicator/>:null}
  </ScrollView>
  <Modal visible={Boolean(memberPage&&user)} animationType="slide" presentationStyle="pageSheet"
   onRequestClose={()=>setMemberPage(null)}>
   <View style={styles.modalRoot}>
    <Pressable style={styles.modalClose} accessibilityRole="button" onPress={()=>setMemberPage(null)}>
     <Text style={styles.modalCloseText}>關閉</Text>
    </Pressable>
    {memberPage&&user?<StarryMemberWebView page={memberPage} userId={user.user_id} fullScreen/>:null}
   </View>
  </Modal>
  <Modal visible={deleteConfirmOpen} transparent animationType="fade" onRequestClose={()=>setDeleteConfirmOpen(false)}>
   <View style={styles.deleteOverlay}><View style={styles.deleteCard}>
    <Text style={styles.heading}>永久刪除中央帳號</Text>
    <Text style={styles.muted}>立即永久刪除，沒有撤回期，不會自動取消 App Store／Google Play 訂閱。</Text>
    <TextInput value={confirmText} onChangeText={setConfirmText} placeholder="輸入 DELETE"
     accessibilityLabel="輸入 DELETE 確認永久刪除" autoCapitalize="characters" style={styles.input}/>
    <Button text="永久刪除帳號" disabled={busy||confirmText.trim()!=='DELETE'} danger onPress={erase}/>
    <Button text="取消" onPress={()=>{setDeleteConfirmOpen(false);setConfirmText('');}}/>
   </View></View>
  </Modal>
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
 memberRow:{flexDirection:'row',alignItems:'center',gap:12},memberDetails:{flex:1},avatar:{width:56,height:56,borderRadius:28,backgroundColor:'#e5e7eb',alignItems:'center',justifyContent:'center',overflow:'hidden'},avatarText:{fontSize:19,fontWeight:'700',color:'#334155'},avatarImage:{position:'absolute',width:56,height:56,borderRadius:28},
 muted:{fontSize:14,lineHeight:21,color:'#475569'},error:{color:'#b91c1c'},
 keyRow:{flexDirection:'row',alignItems:'center',gap:10},keyName:{flex:1},
 input:{borderWidth:1,borderColor:'#cbd5e1',borderRadius:7,padding:10},
 modalRoot:{flex:1,backgroundColor:'#fff',paddingTop:48},
 modalClose:{alignSelf:'flex-end',paddingHorizontal:20,paddingVertical:12},
 modalCloseText:{color:'#354e7a',fontSize:16,fontWeight:'600'},
 deleteOverlay:{flex:1,justifyContent:'center',padding:22,backgroundColor:'rgba(0,0,0,0.4)'},
 deleteCard:{padding:20,borderRadius:14,backgroundColor:'#fff',gap:14}
});
