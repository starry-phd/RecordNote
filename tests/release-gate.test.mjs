import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateReleaseGate,GATE_KEYS} from '../scripts/release-gate.mjs';
test('default development manifest always blocks full paid production deployment',async()=>{
 const {default:manifest}=await import('../release-manifest.json',{with:{type:'json'}});
 const r=evaluateReleaseGate(manifest);
 assert.equal(r.approved,false);
 assert.ok(r.errors.includes('productionReady not approved'));
 assert.ok(r.errors.some(e=>e.includes('centralIdentity')));
});
test('missing single requirement blocks production regardless of label',()=>{
 const record={project:'starry-recorder',releaseStage:'production',productionReady:true,
  evidence:Object.fromEntries(GATE_KEYS.map(k=>[k,true]))};
 assert.equal(evaluateReleaseGate(record).approved,true);
 for(const key of GATE_KEYS){
  const altered={...record,evidence:{...record.evidence,[key]:false}};
  assert.equal(evaluateReleaseGate(altered).approved,false);
 }
});
test('rejects missing manifest, wrong project and omitted controls',()=>{
 assert.equal(evaluateReleaseGate(null).approved,false);
 assert.equal(evaluateReleaseGate({project:'other',productionReady:true,releaseStage:'production'}).approved,false);
});
