import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Linking,Modal,Platform,Pressable,ScrollView,Share,StatusBar,StyleSheet,Text,TextInput,View} from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Clipboard from 'expo-clipboard';
import {StarryMemberWebView,type MemberPage} from './StarryMemberWebView';
import {Image} from 'expo-image';
import {starryAvatarSource} from './StarryAvatarUrl';
import {starrySettingsBlocks,type SettingsButtonId,type SettingsInput} from '../vendor/starry-id/starry-client';
import {Passkey} from 'react-native-passkey';
import {
 acceptConsent,addPasskey,checkApp,clearLocalSignIn,centralPasskeyError,
 deleteAccount,listPasskeys,removePasskey,restoreSignIn,
 signInWithPasskey,signInWithProvider,starryClient,supportUrl
} from '../expo/RecordNoteStarryAuth';
import type {AppGate,Me,LatestHandoff} from '../vendor/starry-id/starry-client';

const ID='https://id.starry.phd',WEB='https://recordnote.starry.phd';
const VERSION=Constants.expoConfig?.version||'0.1.0';
const BUILD=Platform.OS==='ios'?String(Constants.expoConfig?.ios?.buildNumber||'1'):String(Constants.expoConfig?.android?.versionCode||'1');
const DEVICE=Device.modelName||Platform.OS,FOREGROUND_INTERVAL_MS=60000;
const INTEGRATED_STARRY_HANDOFF_VERSION='2026-11-09.6';
type Key={id:string;name:string};
function explain(error:unknown,isPasskey=false):string|null{
 if(isPasskey)return centralPasskeyError(error);
 const e=error as {code?:string;cancelled?:boolean};
 if(e?.cancelled)return null;
 if(e?.code==='REAUTH_REQUIRED')return '請先重新登入 Starry ID 後再操作。';
 if(e?.code==='NETWORK')return '中央會員系統暫時無法連線。';
 return e?.code?'操作未完成：'+e.code:'操作未完成，請稍後再試。';
}
function Button({text,onPress,disabled=false,danger=false,inverse=false}:{text:string;onPress:()=>void;disabled?:boolean;danger?:boolean;inverse?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityLabel={text} disabled={disabled} onPress={onPress}
  style={({pressed})=>[styles.button,danger&&styles.danger,inverse&&styles.inverse,disabled&&styles.disabled,pressed&&styles.pressed]}>
  <Text style={styles.buttonText}>{text}</Text>
 </Pressable>;
}
function CentralMemberAvatar({url,initials}:{url:string|null;initials:string}){
 const source=starryAvatarSource(url);
 return <View style={styles.avatar}>
  <Text style={styles.avatarText}>{initials}</Text>
  {source?<Image key={source.cacheKey} source={source}
   style={styles.avatarImage} cachePolicy="disk" contentFit="cover"/>:null}
 </View>;
}
export default function App(){
 const [gate,setGate]=useState<AppGate|null>(null),[user,setUser]=useState<Me|null>(null);
 const [consent,setConsent]=useState(false),[passkeys,setPasskeys]=useState<Key[]>([]);
 const [memberPage,setMemberPage]=useState<MemberPage|null>(null);
 const [nativePage,setNativePage]=useState<'settings'|'admin'>('settings');
 const [handoff,setHandoff]=useState<LatestHandoff|null>(null),[handoffError,setHandoffError]=useState('');
 const [battery,setBattery]=useState<SettingsInput['battery']>(null);
 const [deleteConfirmOpen,setDeleteConfirmOpen]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmText,setConfirmText]=useState('');
 const lastCheck=useRef(0),checking=useRef(false),mounted=useRef(true);
 const gateState=useRef<AppGate|null>(null),syncing=useRef(false);
 const passkeySupported=Passkey.isSupported();
 const readUser=useCallback(async()=>{
  const data=await starryClient.me();
  if(mounted.current){setUser(data);setConsent(Boolean(data.consent?.required));if(data.staff_role!=='owner')setNativePage('settings');}
 },[]);
 const readKeys=useCallback(async()=>{
  const data=await listPasskeys();
  if(mounted.current)setPasskeys(data);
 },[]);
 const readBattery=useCallback(async()=>{
  try{
   const data=await starryClient.request<NonNullable<SettingsInput['battery']>>('GET','/v1/me/battery');
   if(mounted.current)setBattery(data);
  }catch{if(mounted.current)setBattery(null);}
 },[]);
 const syncMember=useCallback(async()=>{
  // Always consult shared device SSO on every foreground transition,
  // including when remote config is throttled to once per minute.
  if(syncing.current)return;
  syncing.current=true;
  try {
   const signedIn=await restoreSignIn(); // official SDK restore() includes syncDeviceSignIn()
   if(!mounted.current)return;
   if(!signedIn){setUser(null);setConsent(false);setPasskeys([]);setBattery(null);setNativePage('settings');setHandoff(null);return;}
   const settled=await Promise.allSettled([readUser(),readKeys(),readBattery()]);
   if(settled[0].status==='rejected'&&mounted.current)setMessage('已保留登入資料，稍後重新讀取會員資訊。');
  }catch{
   if(mounted.current)setMessage('無法同步其他繁星 App 的登入狀態，請檢查網路。');
  }finally{syncing.current=false;}
 },[readUser,readKeys,readBattery]);
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
  setConsent(Boolean(result.consent_required));await Promise.allSettled([readUser(),readKeys(),readBattery()]);
 });
 const loginPasskey=()=>void run(async()=>{
  if(gate?.state!=='ok')return;
  const result=await signInWithPasskey();
  if(!result)return;
  setConsent(Boolean(result.consent_required));await readUser();
 },true);
 const logout=()=>void run(async()=>{
  await clearLocalSignIn();setUser(null);setPasskeys([]);setBattery(null);setConsent(false);setNativePage('settings');setHandoff(null);setConfirmText('');setMemberPage(null);setDeleteConfirmOpen(false);
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
    await deleteAccount();setUser(null);setPasskeys([]);setBattery(null);setConsent(false);setNativePage('settings');setHandoff(null);setConfirmText('');setMemberPage(null);setDeleteConfirmOpen(false);
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
 const openAdmin=()=>void run(async()=>{
  if(!user)return;
  const me=await starryClient.me();
  if(me.user_id!==user.user_id||me.staff_role!=='owner'){setNativePage('settings');setHandoff(null);setMessage('只有中央 Owner 可以使用 Admin 專區。');return;}
  setUser(me);setNativePage('admin');setHandoff(null);setHandoffError('');
  try{
   const next=await starryClient.getLatestHandoff(INTEGRATED_STARRY_HANDOFF_VERSION);
   if(next.app_id!=='recordnote')throw Error('HANDOFF_APP_MISMATCH');
   setHandoff(next);
  }catch{setHandoffError('無法取得最新串接指令，請稍後重試。');}
 });
 const copyHandoff=()=>void run(async()=>{
  if(nativePage!=='admin'||user?.staff_role!=='owner'||!handoff||handoff.up_to_date)return;
  const me=await starryClient.me();
  if(me.user_id!==user.user_id||me.staff_role!=='owner'){setNativePage('settings');setHandoff(null);return;}
  await Clipboard.setStringAsync(handoff.text);
  setMessage('已複製最新串接指令。');
 });
 const settingsBlocks=starrySettingsBlocks({me:user,battery,passkeys});
 const settingAction=(id:SettingsButtonId)=>{
  switch(id){
   case 'battery-history': setMemberPage('battery');break;
   case 'public-profile': void run(async()=>{
    if(!user)return;
    const me=await starryClient.me();
    if(me.user_id!==user.user_id||!me.member_no)return;
    setUser(me);await Linking.openURL(ID+'/'+encodeURIComponent(me.member_no));
   });break;
   case 'share-invite':invite();break;
   case 'member-center':setMemberPage('profile');break;
   case 'admin':openAdmin();break;
   case 'support':contact();break;
   case 'sign-out-all':logout();break;
   case 'delete-account':setConfirmText('');setDeleteConfirmOpen(true);break;
   case 'add-passkey':addKey();break;
  }
 };
 const gated=gate?.state!=='ok';
 const warning=!gate?'正在確認中央會員系統…':gate.state==='maintenance'?'繁星答錄機目前維護中。':
  gate.state==='killed'?'繁星答錄機已停止服務。':gate.state==='update_required'?'請更新 App 再繼續。':
  gate.state==='unreachable'?'中央暫時無法連線；登入與 🔋 普通電池扣量停止。':'';
 return <View style={styles.root}>
  <StatusBar barStyle="dark-content"/>
  <ScrollView contentContainerStyle={styles.scroll}>
   <Text style={styles.title}>{user?(nativePage==='admin'?'Admin 專區':'設定'):'繁星答錄機 RecordNote'}</Text>
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
   {!gated&&user&&!consent&&nativePage==='settings'?<>
    {settingsBlocks.map(block=><View key={block.id} style={styles.card}>
      <Text style={styles.heading}>{block.title}</Text>
      {block.avatar?<View style={styles.memberRow}>
        <CentralMemberAvatar url={block.avatar.url} initials={block.avatar.initials}/>
        <Text style={styles.memberName}>{block.name}</Text>
       </View>:null}
      {block.lines.map((line,i)=><Text key={i} style={styles.memberLine}>{line}</Text>)}
      {block.passkeys?.map(key=><View key={key.id} style={styles.keyRow}>
       <Text style={styles.keyName}>{key.name}</Text>
       <Button text={key.removeLabel} danger disabled={busy} onPress={()=>removeKey(key)}/>
      </View>)}
      {block.buttons.map(button=><Button key={button.id} text={(button.icon==='gear'?'⚙ ':'')+button.label}
       danger={Boolean(button.danger)} inverse={Boolean(button.inverse)} disabled={busy||(button.id==='add-passkey'&&!passkeySupported)}
       onPress={()=>settingAction(button.id)}/>)}
    </View>)}
    <View style={styles.card}>
     <Text style={styles.heading}>繁星答錄機設定</Text>
     <Button text="開啟既有 RecordNote 網頁版" disabled={busy} onPress={()=>open(WEB)}/>
    </View>
   </>:null}
   {!gated&&user&&!consent&&nativePage==='admin'&&user.staff_role==='owner'?<>
    <View style={styles.card}>
     <Text style={styles.heading}>串接指令</Text>
     <Text style={styles.memberLine}>目前採用版本：{INTEGRATED_STARRY_HANDOFF_VERSION}</Text>
     <Text style={styles.memberLine}>中央最新版本：{handoff?.version||'查詢中…'}</Text>
     <Text style={styles.memberLine}>{handoff?(handoff.up_to_date?'已是最新':'有新版'):(handoffError||'正在確認中央版本…')}</Text>
     <Text style={styles.muted}>更新時請 AI 只補差異，不要整份重做</Text>
     {!handoff?.up_to_date&&handoff?.text?<Button text="複製最新串接指令" disabled={busy} inverse onPress={copyHandoff}/>:null}
     <Button text="重新檢查版本" disabled={busy} onPress={openAdmin}/>
     <Button text="返回設定" onPress={()=>setNativePage('settings')}/>
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
 danger:{backgroundColor:'#9a2d36'},inverse:{backgroundColor:'#182845'},disabled:{opacity:.5},pressed:{opacity:.75},
 buttonText:{fontWeight:'600',fontSize:15,color:'#fff'},
 muted:{fontSize:14,lineHeight:21,color:'#475569'},error:{color:'#b91c1c'},
 keyRow:{flexDirection:'row',alignItems:'center',gap:10},keyName:{flex:1},
 memberRow:{flexDirection:'row',alignItems:'center',gap:12},
 avatar:{width:56,height:56,borderRadius:28,backgroundColor:'#e5e7eb',alignItems:'center',justifyContent:'center',overflow:'hidden'},
 avatarText:{fontSize:19,fontWeight:'700',color:'#334155'},
 avatarImage:{position:'absolute',width:56,height:56,borderRadius:28},
 memberName:{fontSize:17,fontWeight:'700',color:'#17233d'},
 memberLine:{fontSize:15,color:'#334155'},
 input:{borderWidth:1,borderColor:'#cbd5e1',borderRadius:7,padding:10},
 modalRoot:{flex:1,backgroundColor:'#fff',paddingTop:48},
 modalClose:{alignSelf:'flex-end',paddingHorizontal:20,paddingVertical:12},
 modalCloseText:{color:'#354e7a',fontSize:16,fontWeight:'600'},
 deleteOverlay:{flex:1,justifyContent:'center',padding:22,backgroundColor:'rgba(0,0,0,0.4)'},
 deleteCard:{padding:20,borderRadius:14,backgroundColor:'#fff',gap:14}
});
