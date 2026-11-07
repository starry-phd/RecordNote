import {ValidationError} from './core.js';
/** Contract for JSON emitted by a trusted server-side ffprobe process.
 * NEVER accept this object from a mobile/web client as proof of a file's media properties.
 */
export type MediaProbe={
  format?:{format_name?:string;duration?:string;size?:string;bit_rate?:string};
  streams?:Array<{codec_type?:string;codec_name?:string;profile?:string;sample_rate?:string;channels?:number;bit_rate?:string}>;
};
export type VerifiedAudio={container:'m4a';codec:'aac';sampleRate:16000;channels:1;bitrate:number;bytes:number;durationSeconds:number};
function positive(value:unknown):number{
  if(typeof value!=='string'||!/^\d+(?:\.\d+)?$/.test(value))throw new ValidationError('missing trusted media property');
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0)throw new ValidationError('invalid media property');
  return n;
}
export function verifyMediaProbe(probe:MediaProbe):VerifiedAudio{
  if(!probe||!probe.format||!Array.isArray(probe.streams))throw new ValidationError('media probe unavailable');
  // Verify the bytes themselves by ffprobe; extension or MIME is insufficient.
  const fmt=probe.format.format_name?.split(',')||[];
  if(!fmt.includes('mov')&&!fmt.includes('mp4')&&!fmt.includes('m4a'))
    throw new ValidationError('not MP4/M4A container');
  if(probe.streams.length!==1)throw new ValidationError('audio-only single-track required');
  const track=probe.streams[0];
  if(track.codec_type!=='audio'||track.codec_name!=='aac')throw new ValidationError('AAC codec required');
  if(track.profile!==undefined&&!['LC','Low Complexity'].includes(track.profile))
    throw new ValidationError('AAC-LC profile required');
  if(track.channels!==1)throw new ValidationError('mono audio required');
  if(positive(track.sample_rate)!==16000)throw new ValidationError('16kHz sample rate required');
  const bytes=positive(probe.format.size),durationSeconds=positive(probe.format.duration);
  if(!Number.isSafeInteger(bytes)||bytes>100_000_000)throw new ValidationError('audio exceeds 100MB');
  if(durationSeconds>6000)throw new ValidationError('audio exceeds 100 minutes');
  const bitrate=positive(track.bit_rate??probe.format.bit_rate);
  // AAC encoders approximate target bit rate; reject materially mismatched inputs.
  if(bitrate<56000||bitrate>72000)throw new ValidationError('64kbps target encoding required');
  return {container:'m4a',codec:'aac',sampleRate:16000,channels:1,bitrate,bytes,durationSeconds};
}
