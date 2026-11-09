/**
 * Starry ID owns member pages; the App draws settings using the official starrySettingsBlocks().
 * The single-use URL is NEVER persisted, logged, or sent to another origin.
 * All linked member pages remain inside an iOS WKWebView / Android WebView.
 */
import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {WebView} from 'react-native-webview';
import {starryClient} from '../expo/RecordNoteStarryAuth';

export type MemberPage='battery'|'profile'|'referral'|'network'|'apps';
type WebLink={url:string;expires_in:number};

const MEMBER_ORIGIN='https://id.starry.phd';
const HEIGHT_SCRIPT=`(function(){
 function report(){
  var h=Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0);
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({kind:'height',height:h}));
 }
 if(typeof ResizeObserver!=='undefined'){new ResizeObserver(report).observe(document.documentElement);}
 window.addEventListener('load',report);report();setTimeout(report,250);
})();true;`;

function centralUrlOnly(value:string):boolean{
 try{
  const parsed=new URL(value);
  return parsed.origin===MEMBER_ORIGIN&&!parsed.username&&!parsed.password;
 }catch{return false;}
}

export function StarryMemberWebView({page,userId,refreshKey=0,fullScreen=false}:{
 page:MemberPage;userId:string;refreshKey?:number;fullScreen?:boolean;
}){
 const [uri,setUri]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [attempt,setAttempt]=useState(0);
 const [cardHeight,setCardHeight]=useState(225);
 useEffect(()=>{
  let live=true;
  setUri(null);setError('');
  // Request a fresh link on each button press; every code expires after 2 minutes and works only once.
  void starryClient.request<WebLink>('POST','/v1/me/web-link',{page}).then(link=>{
   if(!live)return;
   if(!centralUrlOnly(link?.url)||!link.url.startsWith(MEMBER_ORIGIN+'/auth/app-open?'))throw Error('INVALID_STARRY_WEB_LINK');
   if(!(Number(link.expires_in)>0&&Number(link.expires_in)<=120))throw Error('INVALID_STARRY_WEB_LINK_EXPIRY');
   setUri(link.url);
  }).catch(()=>{
   if(live)setError('中央會員頁暫時無法開啟，請重新載入。');
  });
  return ()=>{live=false;};
 },[page,userId,refreshKey,attempt]);

 const retry=()=>setAttempt(n=>n+1);
 return <View style={[styles.host,fullScreen?styles.full:{height:cardHeight}]}>
  {error?<View style={styles.center}>
    <Text style={styles.message}>{error}</Text>
    <Pressable accessibilityRole="button" onPress={retry}><Text style={styles.retry}>重新載入</Text></Pressable>
   </View>:uri?<WebView
    key={uri}
    source={{uri}}
    javaScriptEnabled
    domStorageEnabled
    sharedCookiesEnabled
    thirdPartyCookiesEnabled={false}
    incognito={false}
    setSupportMultipleWindows={false}
    originWhitelist={[MEMBER_ORIGIN]}
    scrollEnabled={fullScreen}
    bounces={fullScreen}
    injectedJavaScript={fullScreen?undefined:HEIGHT_SCRIPT}
    onShouldStartLoadWithRequest={request=>request.url==='about:blank'||centralUrlOnly(request.url)}
    onMessage={event=>{
     if(fullScreen)return;
     try{
      const data=JSON.parse(event.nativeEvent.data) as {kind?:string;height?:number};
      if(data.kind==='height'&&Number.isFinite(data.height))
       setCardHeight(Math.max(140,Math.min(520,Math.ceil(Number(data.height)))));
     }catch{}
    }}
    onError={()=>{setUri(null);setError('中央會員頁暫時無法載入，請重新載入。');}}
    onHttpError={event=>{if(event.nativeEvent.statusCode>=400){setUri(null);setError('會員連結已失效，請重新載入。');}}}
    style={styles.web}
   />:<View style={styles.center}><ActivityIndicator accessibilityLabel="載入中央會員資訊"/></View>}
 </View>;
}
const styles=StyleSheet.create({
 host:{width:'100%',backgroundColor:'transparent',overflow:'hidden'},
 full:{flex:1},
 web:{flex:1,backgroundColor:'transparent'},
 center:{flex:1,justifyContent:'center',alignItems:'center',gap:10,padding:14},
 message:{color:'#475569',textAlign:'center'},
 retry:{fontWeight:'600',color:'#354e7a'}
});
