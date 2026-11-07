import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Fail closed. This is intentionally NOT a self-attestation or a production readiness assertion. */
const folder=path.dirname(fileURLToPath(import.meta.url));
const file=path.join(folder,'..','release-manifest.json');
export const GATE_KEYS=Object.freeze([
 'centralIdentity','secureAudioTranscoding','recordingRecovery',
 'cloudAIAndOCR','subscriptionsAndRefunds','nativeAndroidIOS',
 'privacyGlobalCompliance','loadAndSecurityReview','productionSmokeValidationPlan'
]);
export function evaluateReleaseGate(record){
 const errors=[];
 if(!record||record.project!=='starry-recorder')errors.push('invalid project manifest');
 if(record?.releaseStage!=='production')errors.push('releaseStage not set to production');
 if(record?.productionReady!==true)errors.push('productionReady not approved');
 const evidence=record?.evidence;
 for(const key of GATE_KEYS)if(evidence?.[key]!==true)errors.push('missing: '+key);
 return {approved:errors.length===0,errors};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let record;
 try{record=JSON.parse(fs.readFileSync(file,'utf8'));}catch{
  process.stderr.write('Refusing production deployment: missing or invalid release-manifest.json\n');
  process.exit(2);
 }
 const result=evaluateReleaseGate(record);
 if(!result.approved){
  process.stderr.write('PRODUCTION DEPLOY BLOCKED\n'+result.errors.join('\n')+'\n');
  process.exit(2);
 }
 process.stdout.write('Release checklist flags satisfied. Verify CI, provenance, security and Cloudflare credentials independently.\n');
}
