import {abi} from 'genlayer-js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,parseBundle,verifyBundle,verifyOnline,exportBundle,readPair,canonical} from '../src/audit.js';
const contract='0x'+'1'.repeat(40),fixer='0x'+'2'.repeat(40),sponsor='0x'+'3'.repeat(40);
const settlement='0x'+'4'.repeat(64),credit='0x'+'5'.repeat(64),source='contract source';
const trusted={chain_id:61999,contract,source_sha256:await sha256(source)};
async function fixture() {
 return {schema:'accesspatch-audit-v1',...trusted,exported_at:'2026-10-12T00:00:00Z',bounty:{id:0,status:'PAID',reward_wei:'1000000000000000000',sponsor,baseline_hash:await sha256('before'),history:[],candidate:{fixer,page_hash:await sha256('after'),report_hash:await sha256('report'),counter:null},payment:{type:'REWARD',recipient:fixer,amount_wei:'1000000000000000000'}},evidence:{baseline:'before',page:'after',report:'report',counter:null},transfers:[{settlement:{hash:settlement,method:'settle',bounty_id:'0',status:'FINALIZED',execution:'SUCCESS',to:contract,triggered:[credit]},credit:{hash:credit,status:'FINALIZED',from:contract,to:fixer,value_wei:'1000000000000000000',value_credited:true}}]};
}
function clientFor(bundle) {
 return {getChainId:async()=>61999,getContractCode:async()=>source,readContract:async({functionName,transactionHashVariant})=>{assert.equal(transactionHashVariant,'final');return JSON.stringify(functionName==='get_bounty'?bundle.bounty:bundle.evidence);},getTransaction:async({hash})=>hash===settlement?{data:{calldata:{raw:[...abi.calldata.encode(abi.calldata.makeCalldataObject('settle',[0n]))]}},statusName:'FINALIZED',consensus_data:{leader_receipt:[{execution_result:'SUCCESS'}]},to_address:contract,triggered_transactions:[credit]}:{statusName:'FINALIZED',from_address:contract,to_address:fixer,value:1000000000000000000n,value_credited:true}};
}
test('SHA-256 uses exact UTF-8 bytes and preserves whitespace',async()=>{
 assert.equal(await sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 assert.notEqual(await sha256('é'),await sha256('e'));assert.notEqual(await sha256('a\n'),await sha256('a\r\n'));
});
test('offline consistency never claims online authentication',async()=>{const r=await verifyBundle(await fixture(),trusted);assert.equal(r.mode,'offline');assert.equal(r.authenticated_state,undefined);assert.equal(r.payment_credited,undefined);assert.equal(r.snapshots.length,3);});
for(const [label,change,expected] of [
 ['tampered page',b=>b.evidence.page+='!',/page snapshot digest mismatch/],
 ['tampered report',b=>b.evidence.report+='!',/report snapshot digest mismatch/],
 ['tampered baseline',b=>b.evidence.baseline+='!',/baseline snapshot digest mismatch/],
 ['wrong contract',b=>b.contract=fixer,/different chain or contract/],
 ['wrong chain',b=>b.chain_id=1,/different chain or contract/],
 ['wrong source',b=>b.source_sha256='0'.repeat(64),/source digest/],
 ['another bounty receipt',b=>b.transfers[0].settlement.bounty_id='1',/different bounty or action/],
 ['wrong action receipt',b=>b.transfers[0].settlement.method='refund',/different bounty or action/],
 ['wrong amount',b=>b.bounty.payment.amount_wei='1',/Payment does not match/],
 ['uncredited transfer',b=>b.transfers[0].credit.value_credited=false,/matching finalized credit/],
 ['unfinalized transfer',b=>b.transfers[0].credit.status='PENDING',/matching finalized credit/],
 ['unlinked transfer',b=>b.transfers[0].settlement.triggered=[],/not linked/],
 ['failed settlement',b=>b.transfers[0].settlement.execution='ERROR',/not linked/],
 ['transfer from another contract',b=>b.transfers[0].credit.from=fixer,/matching finalized credit/],
 ['invalid status',b=>b.bounty.status='UNKNOWN',/Invalid bounty status/]
]) {
 test('rejects '+label,async()=>{const b=await fixture();change(b);await assert.rejects(()=>verifyBundle(b,trusted),expected);});
}
test('rejects redirected beneficiary',async()=>{const b=await fixture();b.bounty.payment.recipient=sponsor;await assert.rejects(()=>verifyBundle(b,trusted),/authenticated beneficiary/);});
test('rejects schema and oversized UTF-8 bundle before verification',()=>{assert.throws(()=>parseBundle('{'),SyntaxError);assert.throws(()=>parseBundle('é'.repeat(250001)),/500 KB/);});
test('refund verifies sponsor payment without candidate snapshots',async()=>{const b=await fixture();b.bounty.status='REFUNDED';b.bounty.candidate=null;b.bounty.payment.type='REFUND';b.bounty.payment.recipient=sponsor;b.evidence.page=null;b.evidence.report=null;b.transfers=[];assert.equal((await verifyBundle(b,trusted)).snapshots.length,1);});
test('counter-evidence is authenticated by its own digest',async()=>{const b=await fixture();b.bounty.candidate.counter={hash:await sha256('counter')};b.evidence.counter='counter';await verifyBundle(b,trusted);b.evidence.counter='wrong';await assert.rejects(()=>verifyBundle(b,trusted),/counter snapshot digest mismatch/);});
test('missing transfer leaves payment credit unverified even online',async()=>{const b=await fixture();b.transfers=[];const r=await verifyOnline(b,clientFor(b),trusted,'final');assert.equal(r.authenticated_state,true);assert.equal(r.payment_credited,null);});
test('online authenticates finalized state and follows credited transfer',async()=>{const b=await fixture();const r=await verifyOnline(b,clientFor(b),trusted,'final');assert.equal(r.mode,'online');assert.equal(r.payment_credited,true);});
test('forging both snapshot and local digest fails the online recheck',async()=>{const original=await fixture(),forged=structuredClone(original);forged.evidence.page='forged';forged.bounty.candidate.page_hash=await sha256('forged');await verifyBundle(forged,trusted);await assert.rejects(()=>verifyOnline(forged,clientFor(original),trusted,'final'),/differs from current finalized state/);});
test('forged linked receipt metadata fails independent RPC receipt comparison',async()=>{const b=await fixture();b.transfers[0].settlement.triggered.push('0x'+'6'.repeat(64));await verifyBundle(b,trusted);await assert.rejects(()=>verifyOnline(b,clientFor(b),trusted,'final'),/differs from GenLayer/);});
test('wrong live chain and source fail closed',async()=>{const b=await fixture();const c=clientFor(b);c.getChainId=async()=>1;await assert.rejects(()=>verifyOnline(b,c,trusted,'final'),/wrong chain/);c.getChainId=async()=>61999;c.getContractCode=async()=>'tampered';await assert.rejects(()=>verifyOnline(b,c,trusted,'final'),/source mismatch/);});
test('concurrent state changes require export retry',async()=>{const b=await fixture();let n=0;const c=clientFor(b);c.readContract=async({functionName})=>JSON.stringify(functionName==='get_evidence'?b.evidence:++n===1?b.bounty:{...b.bounty,status:'OPEN'});await assert.rejects(()=>readPair(c,contract,0,'final'),/changed during export/);});
test('export includes no account key, secret salt or imported RPC',async()=>{const b=await fixture();const r=await exportBundle(clientFor(b),trusted,0,'final',settlement);assert.deepEqual(Object.keys(r).sort(),['schema','chain_id','contract','source_sha256','exported_at','bounty','evidence','transfers'].sort());});
test('canonical object equality is independent of property ordering',()=>{assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));});

test('fails closed when settlement calldata is missing',async()=>{const b=await fixture(),c=clientFor(b),get=c.getTransaction;c.getTransaction=async arg=>{const r=await get(arg);delete r.data;return r;};await assert.rejects(()=>exportBundle(c,trusted,0,'final',settlement),/calldata unavailable/);});
