import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import worker from '../cloudflare-candidate/recordnote-unified.mjs';

// This suite is opted into only by its browser workflow. Generic node --test
// runs must not download Chromium or require optional browser-only packages.
if(process.env.RECORDNOTE_BROWSER_ACCEPTANCE!=='1'){
 test('Chrome acceptance runs in a separate dedicated GitHub workflow',{skip:'browser-only suite'},()=>{});
}else{
const {chromium}=await import('playwright-core');
const chrome=[
 process.env.CHROME_BIN,
 '/usr/bin/google-chrome',
 '/usr/bin/chromium',
 '/usr/bin/chromium-browser'
].find(x=>x&&existsSync(x));
assert.ok(chrome,'A real local Chromium/Chrome binary is needed for browser acceptance tests');

const server=createServer(async(req,res)=>{
 try{
  const url='http://127.0.0.1:'+server.address().port+(req.url||'/');
  const reply=await worker.fetch(new Request(url,{method:req.method,headers:req.headers}),{});
  res.writeHead(reply.status,Object.fromEntries(reply.headers.entries()));
  res.end(Buffer.from(await reply.arrayBuffer()));
 }catch(err){res.writeHead(500);res.end('Worker failed: '+String(err));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const baseUrl='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({
 executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']
});
after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));});

function remoteConfig({status='active',minVersion='0.0.0',notices=[]}={}){
 return {app_id:'recordnote',status,min_version:minVersion,config:{},notices};
}
async function pageWithConfig(gate=remoteConfig()){
 const context=await browser.newContext({viewport:{width:1280,height:860}});
 await context.route('https://id.starry.phd/v1/apps/recordnote/config',route=>route.fulfill({
  status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
  body:JSON.stringify(gate)
 }));
 const page=await context.newPage();
 const exceptions=[];
 page.on('pageerror',e=>exceptions.push(String(e)));
 await page.goto(baseUrl+'/',{waitUntil:'domcontentloaded'});
 return {page,context,exceptions};
}
test('Real Chromium: candidate homepage renders, navigates, and offers Google/Apple/Passkey safely',async()=>{
 const {page,context,exceptions}=await pageWithConfig();
 try{
  await page.locator('.app-shell').waitFor({state:'visible',timeout:20000});
  assert.match(await page.title(),/繁星答錄機 RecordNote/);
  await page.locator('button[data-action="settings"]').first().click();
  await page.locator('button[data-action="loginGoogle"]').waitFor({state:'visible'});
  await page.locator('button[data-action="loginApple"]').waitFor({state:'visible'});
  const supported=await page.evaluate(()=>typeof PublicKeyCredential==='function'&&
   typeof navigator.credentials?.get==='function'&&typeof navigator.credentials?.create==='function');
  if(supported){
   await page.locator('button[data-action="signInPasskey"]').waitFor({state:'visible'});
  }else{
   assert.equal(await page.locator('button[data-action="signInPasskey"]').count(),0);
  }
  const support=await page.locator('a[href*="id.starry.phd/support?"]').first().getAttribute('href');
  const url=new URL(support);
  assert.equal(url.hostname,'id.starry.phd');
  assert.equal(url.searchParams.get('app_id'),'recordnote');
  assert.ok(url.searchParams.has('app_version'));
  assert.ok(url.searchParams.has('device'));
  assert.ok(!url.searchParams.has('token'));
  assert.deepEqual(exceptions,[],'No unhandled browser JavaScript exceptions allowed');
 }finally{await context.close();}
});
test('Real Chromium: owner pause and kill stop entire login UI at startup',async()=>{
 for(const status of ['paused','killed']){
  const {page,context,exceptions}=await pageWithConfig(remoteConfig({status}));
  try{
   await page.waitForFunction(()=>document.getElementById('app')?.textContent?.includes('目前'),null,{timeout:18000});
   assert.equal(await page.locator('button[data-action="loginGoogle"]').count(),0);
   assert.equal(await page.locator('button[data-action="signInPasskey"]').count(),0);
   assert.deepEqual(exceptions,[]);
  }finally{await context.close();}
 }
});
test('Real Chromium: forced minimum version blocks old App before login',async()=>{
 const {page,context}=await pageWithConfig(remoteConfig({minVersion:'99.0.0'}));
 try{
  await page.getByText('繁星答錄機需要更新後才能繼續使用。').waitFor({timeout:18000});
  assert.equal(await page.locator('.app-shell').count(),0);
 }finally{await context.close();}
});
test('Real Chromium: time-filtered owner notices render as literal text, never HTML',async()=>{
 const attack='<img src=x onerror=window.__unsafeNotice=1>';
 const {page,context,exceptions}=await pageWithConfig(remoteConfig({
  notices:[{message:attack,starts_at:0,ends_at:9999999999999}]
 }));
 try{
  await page.locator('.rn-central-notices p').waitFor({state:'visible',timeout:18000});
  assert.equal(await page.locator('.rn-central-notices p').textContent(),attack);
  assert.equal(await page.locator('.rn-central-notices img').count(),0);
  assert.equal(await page.evaluate(()=>window.__unsafeNotice),undefined);
  assert.deepEqual(exceptions,[]);
 }finally{await context.close();}
});

}
