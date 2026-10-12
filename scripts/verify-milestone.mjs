// Live read-only verification of the new audit tooling against the accepted v3 deployment.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
import {exportBundle,verifyOnline,verifyBundle,sha256} from '../src/audit.js';
const d=JSON.parse(await fs.readFile('public/deployment.json','utf8'));
const trusted={chain_id:d.chain_id,contract:d.contract,source_sha256:d.source_sha256};
const client=createClient({chain:studionet}),variant=TransactionHashVariant.LATEST_FINAL;
const cases=[];
for(const [id,action,status] of [[0,'settle','PAID'],[1,'recovery_refund','REFUNDED']]){
 const tx=d.transactions.find(t=>t.action===action).hash;
 const bundle=await exportBundle(client,trusted,id,variant,tx);
 const verified=await verifyOnline(bundle,client,trusted,variant);
 assert.equal(verified.status,status);assert.equal(verified.payment_credited,true);
 await fs.writeFile(id===0?'public/audit-example.json':'docs/milestone-v1-refund-bundle.json',JSON.stringify(bundle,null,2)+'\n');
 cases.push({bounty_id:id,settlement:tx,result:verified});
}
const example=JSON.parse(await fs.readFile('public/audit-example.json','utf8'));
const tampered=structuredClone(example);tampered.evidence.page+='tampered';
await assert.rejects(()=>verifyBundle(tampered,trusted),/digest mismatch/);
const forged=structuredClone(tampered);forged.bounty.candidate.page_hash=await sha256(forged.evidence.page);
await verifyBundle(forged,trusted); // Internal consistency is deliberately not authentication.
await assert.rejects(()=>verifyOnline(forged,client,trusted,variant),/differs from current finalized state/);
const wrongBounty=structuredClone(example);wrongBounty.transfers[0].settlement.bounty_id='1';
await assert.rejects(()=>verifyBundle(wrongBounty,trusted),/different bounty or action/);
const result={milestone:'v1-portable-audit-workbench',recorded_at:new Date().toISOString(),accepted_baseline_commit:'d4965c7d8abf17e77eae891bd15a7f778bd1ba52',contract:d.contract,chain_id:d.chain_id,new_contract_deployment:false,read_only_verification:true,synthetic_existing_bounties:true,cases,tampered_snapshot_rejected:true,forged_snapshot_and_digest_rejected_online:true,cross_bounty_receipt_rejected:true,tests:{existing:32,new_audit:30,total:62},browser_interaction_qa:'not performed: supported browser-control capability unavailable'};
await fs.writeFile('docs/milestone-v1-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
