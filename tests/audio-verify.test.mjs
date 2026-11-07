import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMediaProbe} from '../.build/audio-verify.js';
import {ValidationError} from '../.build/core.js';
const example=()=>({
 format:{format_name:'mov,mp4,m4a,3gp,3g2,mj2',duration:'6000.0',size:'48000000',bit_rate:'64000'},
 streams:[{codec_type:'audio',codec_name:'aac',profile:'LC',sample_rate:'16000',channels:1,bit_rate:'64000'}]
});
test('accepts probed AAC mono M4A 16kHz 64kbps at exact limits',()=>{
 const meta=verifyMediaProbe(example());
 assert.equal(meta.bytes,48000000);assert.equal(meta.durationSeconds,6000);assert.equal(meta.sampleRate,16000);
});
test('rejects spoofed MIME or rename which fails actual codec check',()=>{
 const p=example();p.streams[0].codec_name='mp3';
 assert.throws(()=>verifyMediaProbe(p),ValidationError);
});
test('rejects stereo, wrong sample rate, extra video or multiple tracks',()=>{
 const p=example();p.streams[0].channels=2;assert.throws(()=>verifyMediaProbe(p),ValidationError);
 const q=example();q.streams[0].sample_rate='44100';assert.throws(()=>verifyMediaProbe(q),ValidationError);
 const v=example();v.streams.push({codec_type:'video',codec_name:'h264'});assert.throws(()=>verifyMediaProbe(v),ValidationError);
});
test('rejects overlong, oversized and bitrate mismatch',()=>{
 const p=example();p.format.duration='6000.001';assert.throws(()=>verifyMediaProbe(p),ValidationError);
 const q=example();q.format.size='100000001';assert.throws(()=>verifyMediaProbe(q),ValidationError);
 const r=example();r.streams[0].bit_rate='128000';assert.throws(()=>verifyMediaProbe(r),ValidationError);
});
test('rejects malformed or missing trusted metadata',()=>{
 const p=example();p.format.duration='NaN';assert.throws(()=>verifyMediaProbe(p),ValidationError);
 const q=example();q.streams[0].sample_rate=undefined;assert.throws(()=>verifyMediaProbe(q),ValidationError);
});
