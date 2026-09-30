import fs from 'node:fs';
import crypto from 'node:crypto';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
const c=createClient({chain:studionet});
const d=JSON.parse(fs.readFileSync('public/deployment.json','utf8'));
const summarize=r=>({hash:r.hash,status:r.statusName??r.status,result:r.result_name??r.resultName,execution_mode:r.execution_mode,leader_only:r.leader_only,from:r.from_address,to:r.to_address,value_wei:String(r.value),created_at:r.created_at,value_credited:r.value_credited,validator_votes:r.last_round?.validator_votes_name,leader_results:r.consensus_data?.leader_receipt?.map(x=>({execution_result:x.execution_result,result_status:x.result?.status})),triggered_transactions:r.triggered_transactions,messages:r.messages?.map(m=>({...m,value:String(m.value)}))});
const transactions=[];
for(const tx of d.transactions){const receipt=await c.getTransaction({hash:tx.hash});transactions.push({action:tx.action,...summarize(receipt)});}
const payout=[];
for(const tx of transactions.filter(t=>t.action==='settle'))for(const hash of tx.triggered_transactions??[])payout.push(summarize(await c.getTransaction({hash})));
const bounty=JSON.parse(await c.readContract({address:d.contract,functionName:'get_bounty',args:[0],transactionHashVariant:TransactionHashVariant.LATEST_FINAL}));
const balance=await c.getBalance({address:d.contract});
const record={recorded_at:new Date().toISOString(),network:'Studionet',chain_id:61999,contract:d.contract,studio_account:d.studio_account,source_sha256:crypto.createHash('sha256').update(fs.readFileSync('contracts/access_patch.py')).digest('hex'),fixture_commit:'b885358d4e9822c80cd0f2f08a4263cd85069d1d',synthetic_evidence:true,sponsor_and_fixer_same_studio_account:true,tests:{offline_behavior_tests:16,production_build:'passed'},transactions,payout_transactions:payout,finalized_bounty:bounty,contract_balance_wei:String(balance)};
fs.writeFileSync('docs/live-test.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({contract:d.contract,status:bounty.status,reward_wei:bounty.reward_wei,transactions:transactions.map(t=>({action:t.action,hash:t.hash,status:t.status,result:t.result})),payout_transactions:payout,contract_balance_wei:String(balance)},null,2));
