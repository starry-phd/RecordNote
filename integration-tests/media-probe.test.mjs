import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ffmpeg=require('@ffmpeg-installer/ffmpeg').path;
const ffprobe=require('@ffprobe-installer/ffprobe').path;
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyMediaProbe} from '../.build/audio-verify.js';
import {ValidationError} from '../.build/core.js';
function audioFile(output,rate=16000,bitrate='64k'){
 execFileSync(ffmpeg,['-nostdin','-loglevel','error','-f','lavfi','-i',
 'anoisesrc=color=white:sample_rate='+rate+':duration=5','-ac','1','-c:a','aac','-b:a',bitrate,'-movflags','+faststart','-y',output],{timeout:30000});
 const out=execFileSync(ffprobe,['-v','error','-show_streams','-show_format','-of','json',output],{timeout:10000});
 return JSON.parse(out.toString('utf-8'));
}
test('real FFmpeg-produced AAC LC, 16kHz, 64kbps M4A passes server-side contract',()=>{
 const dir=mkdtempSync(join(tmpdir(),'recorder-m4a-'));
 try {
  const probe=audioFile(join(dir,'lesson.m4a'));
  const result=verifyMediaProbe(probe);
  assert.equal(result.codec,'aac');
  assert.equal(result.channels,1);
  assert.equal(result.sampleRate,16000);
  assert.ok(result.bytes<100_000_000);
  assert.ok(result.durationSeconds<=6000);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('real AAC M4A at 44.1kHz is rejected even if renamed as M4A',()=>{
 const dir=mkdtempSync(join(tmpdir(),'recorder-invalid-'));
 try {
  const probe=audioFile(join(dir,'fake-compatible.m4a'),44100);
  assert.throws(()=>verifyMediaProbe(probe),ValidationError);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
