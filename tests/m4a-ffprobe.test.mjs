import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {embedMdta,embedMdtaStream,readMdta,readMdtaStream} from '../src/m4a-mdta.mjs';

const values={'com.apple.quicktime.title':'RecordNote 新錄音驗證',
 'com.apple.quicktime.creationdate':'2026-11-06T12:00:00.000Z'};
function tool(bin,args){
  return execFileSync(bin,args,{maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
}
function decodedHash(path){
  return createHash('sha256').update(tool('ffmpeg',['-hide_banner','-loglevel','error',
    '-i',path,'-map','0:a:0','-f','s16le','-acodec','pcm_s16le','-'])).digest('hex');
}
function probe(path){
  return JSON.parse(tool('ffprobe',['-v','error','-show_entries','format=duration:format_tags',
    '-of','json',path]).toString());
}
for(const faststart of [false,true]){
  test(`real AAC M4A ${faststart?'faststart':'regular'}: mdta survives ffprobe and decoded PCM`,async()=>{
    const dir=mkdtempSync(join(tmpdir(),'recordnote-m4a-'));
    try{
      const input=join(dir,'source.m4a'),regular=join(dir,'tagged.m4a'),
        streamed=join(dir,'streamed.m4a');
      const command=['-hide_banner','-loglevel','error','-f','lavfi',
        '-i','sine=frequency=440:sample_rate=44100','-t','0.7','-c:a','aac',
        '-b:a','96k'];
      if(faststart)command.push('-movflags','+faststart');
      tool('ffmpeg',[...command,input]);
      const original=new Uint8Array(readFileSync(input));
      const expectedHash=decodedHash(input);
      const tagged=embedMdta(original,values);
      writeFileSync(regular,tagged);
      assert.deepEqual(readMdta(tagged),values);
      assert.equal(decodedHash(regular),expectedHash);
      const info=probe(regular);
      assert.ok(Number(info.format?.duration)>0);
      assert.ok(Object.values(info.format?.tags||{}).includes(values['com.apple.quicktime.title']),
        'Third-party ffprobe should discover mdta title');
      const chunks=[];
      const written=await embedMdtaStream({size:original.length,
        readAt:async(o,n)=>original.subarray(o,o+n),write:async b=>chunks.push(b)},values);
      const out=new Uint8Array(written.bytes);let at=0;
      for(const c of chunks){out.set(c,at);at+=c.length}
      assert.equal(at,written.bytes);
      writeFileSync(streamed,out);
      assert.deepEqual(await readMdtaStream({size:out.length,
        readAt:async(o,n)=>out.subarray(o,o+n)}),values);
      assert.equal(decodedHash(streamed),expectedHash);
      assert.ok(Object.values(probe(streamed).format?.tags||{}).includes(values['com.apple.quicktime.title']));
    }finally{rmSync(dir,{recursive:true,force:true});}
  });
}
