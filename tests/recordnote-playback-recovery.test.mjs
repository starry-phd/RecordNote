import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const script=readFileSync(new URL('../cloudflare-candidate/recordnote-web.mjs',import.meta.url),'utf8');
const literal=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(script);
assert.ok(literal,'web HTML literal present');
const page=JSON.parse(literal[1]);
const begin=page.indexOf('function playerEngine(){');
const end=page.indexOf('// Guest and signed-in users both own local-first recordings',begin);
assert.ok(begin>0&&end>begin,'playback functions must exist');

function playerFixture({blockFirstPlay=false,cloud=false,response=null}={}){
 const revoked=new Set(['blob:expired']);
 const made=[];
 const notices=[];
 const media={id:'rec-1',kind:'audio',localOnly:!cloud,localBlob:new Blob(['sample'],{type:'audio/mp4'}),url:'blob:expired',original_name:'rec.m4a'};
 class FakeAudio{
  constructor(){this.paused=true;this.duration=12;this.currentTime=0;this.readyState=1;this.error=null;this.src='';this.playCount=0;}
  addEventListener(){}
  removeAttribute(){this.src='';}
  load(){}
  pause(){this.paused=true;}
  async play(){
   this.playCount++;
   if(!this.src||revoked.has(this.src))throw Error('STALE_OBJECT_URL');
   if(blockFirstPlay&&this.playCount===1){const error=Error('gesture lost');error.name='NotAllowedError';throw error;}
   this.paused=false;
  }
 }
 const state={mode:cloud?'live':'demo',playback:null};
 let audio;
 const ctx=createContext({
  state, playbackAudio:null, Blob, Audio:class extends FakeAudio{constructor(){super();audio=this;}},
  URL:{createObjectURL(){const url='blob:fresh-'+made.length;made.push(url);return url;},revokeObjectURL(url){revoked.add(url);}},
  document:{querySelector(){return null;}}, render(){}, notice(msg){notices.push(msg);},
  demoMedia(){return media;}, recordingDisplayTitle(s){return s;},e(s){return s},
  API:'https://recordnote.example', authenticated:async()=>response,
  encodeURIComponent
 });
 runInContext(page.slice(begin,end)+'\nthis.fixture={playMedia,togglePlayer,stopPlayer,playerMarkup};',ctx);
 return {ctx,state,media,made,revoked,notices,getAudio:()=>audio,player:ctx.fixture};
}

test('Android local playback uses a fresh object URL from stored audio bytes',async()=>{
 const f=playerFixture();
 await f.player.playMedia('rec-1');
 assert.equal(f.state.playback.url,'blob:fresh-0');
 assert.equal(f.state.playback.ownedUrl,true);
 assert.equal(f.getAudio().paused,false);
 assert.equal(f.made.length,1);
 f.player.stopPlayer();
 assert.ok(f.revoked.has('blob:fresh-0'),'closing player frees only its playback URL');
});

test('after mobile autoplay rejection, explicit second tap plays the already loaded file',async()=>{
 const f=playerFixture({blockFirstPlay:true});
 await f.player.playMedia('rec-1');
 assert.equal(f.getAudio().paused,true);
 assert.match(f.state.playback.message,/播放/);
 assert.match(f.player.playerMarkup(),/role="status"/);
 await f.player.togglePlayer();
 assert.equal(f.getAudio().paused,false);
 assert.equal(f.state.playback.message,'');
 assert.equal(f.getAudio().playCount,2);
});

test('cloud error pages cannot be mistaken for audio blobs',async()=>{
 const response=new Response('<html>error</html>',{status:200,headers:{'content-type':'text/html'}});
 const f=playerFixture({cloud:true,response});
 await assert.rejects(()=>f.player.playMedia('rec-1'),/AUDIO_INVALID_RESPONSE/);
 assert.equal(f.state.playback,null);
 assert.equal(f.made.length,0);
});

test('metadata writer verifies browser decodability and keeps original on failure',()=>{
 assert.match(page,/await browserCanReadAudioMetadata\(output\)/);
 assert.match(page,/throw Error\('M4A_DECODE_FAILED'\)/);
 assert.match(page,/return \{file,status:'writer_failed',errorCode\}/);
});
