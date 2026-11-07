import test from 'node:test';
import assert from 'node:assert/strict';
import {MODELS,AIProcessingError,transcribePreparedSegment,summarizeTranscribedLesson,recognizeSlide,answerFromAuthorizedSources} from '../.build/ai-cloudflare.js';
import {ValidationError} from '../.build/core.js';
const stub=result=>({calls:[],async run(model,input){this.calls.push({model,input});return result;}});
test('Whisper runs bounded audio chunk and offsets, never arbitrary full 100-minute audio',async()=>{
 const ai=stub({text:'A synthetic lecture',vtt:'WEBVTT'});
 const r=await transcribePreparedSegment(ai,{bytes:new Uint8Array(128),durationSeconds:1.5,startMs:3000});
 assert.equal(ai.calls[0].model,MODELS.asr);assert.equal(r.endMs,4500);
 assert.ok(typeof ai.calls[0].input.audio==='string');
});
test('invalid chunks, language or offset fail without spending AI quota',async()=>{
 const ai=stub({text:''});
 for(const input of [
  {bytes:new Uint8Array(2),durationSeconds:1,startMs:0},
  {bytes:new Uint8Array(128),durationSeconds:121,startMs:0},
  {bytes:new Uint8Array(128),durationSeconds:1,startMs:-1},
  {bytes:new Uint8Array(128),durationSeconds:1,startMs:0,language:'WRONG-LANGUAGE'}
 ])await assert.rejects(transcribePreparedSegment(ai,input),ValidationError);
 assert.equal(ai.calls.length,0);
});
test('summary calls real configured Llama model with synthetic transcript as untrusted data',async()=>{
 const ai=stub({response:'課程指出水對身體很重要。'});
 const r=await summarizeTranscribedLesson(ai,'講師：水對身體很重要。');
 assert.match(r,/水/);assert.equal(ai.calls[0].model,MODELS.llm);
 assert.equal(ai.calls[0].input.max_tokens,400);
 assert.match(ai.calls[0].input.messages[0].content,/untrusted/);
});
test('image OCR uses vision model and bounded fake PNG data',async()=>{
 const ai=stub({response:'維生素 D'});
 const r=await recognizeSlide(ai,{bytes:new Uint8Array(64),mime:'image/png'});
 assert.equal(r.text,'維生素 D');assert.equal(ai.calls[0].model,MODELS.vision);
 assert.match(ai.calls[0].input.messages[1].content[1].image_url.url,/^data:image\/png;base64,/);
});
test('citation model may only use supplied authorized source IDs',async()=>{
 const evidence=[{id:'source_1',kind:'transcript',courseId:'course1',recordingId:'recording1',startMs:1000,text:'Lesson mentions vitamin D'}];
 const ai=stub({response:JSON.stringify({answer:'這堂課談到維生素 D。',citations:['source_1'],insufficientEvidence:false})});
 const good=await answerFromAuthorizedSources(ai,'問什麼?',evidence);
 assert.deepEqual(good.citations,['source_1']);
 const empty=await answerFromAuthorizedSources(ai,'問什麼?',[]);
 assert.equal(empty.insufficientEvidence,true);assert.equal(ai.calls.length,1);
 const bad=stub({response:JSON.stringify({answer:'Made up',citations:['fake_id'],insufficientEvidence:false})});
 await assert.rejects(answerFromAuthorizedSources(bad,'What?',evidence),ValidationError);
 await assert.rejects(answerFromAuthorizedSources(stub({response:'broken json'}),'What?',evidence),AIProcessingError);
});
test('invalid media model response fails closed',async()=>{
 await assert.rejects(summarizeTranscribedLesson(stub({noText:true}),'Sample'),AIProcessingError);
});
