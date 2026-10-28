import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {sha256} from '../src/audit.js';
import {prepareChallenge,verifyChallenge,parseChallenge,authenticateChallenge,assertCanChallenge,challengeArguments,MAX_CHALLENGE_BYTES} from '../src/challenge.js';
const recorded=JSON.parse(await fs.readFile('public/audit-example.json','utf8'));
const trusted={chain_id:recorded.chain_id,contract:recorded.contract,source_sha256:await sha256('contract')};
const audit={...recorded,source_sha256:trusted.source_sha256,transfers:[]};
const claims=[{source:'page',quote:'email',explanation:'A reviewer allegation; check against the locked criteria.'}];
const make=()=>prepareChallenge(structuredClone(audit),structuredClone(claims),trusted);
const other='0x'+'1'.repeat(40);
const live=()=>{const a=structuredClone(audit);a.bounty.status='REVIEW';a.bounty.payment=null;a.bounty.candidate.challenge_used=false;a.bounty.candidate.settle_after=2000;return a;};
const clientFor=a=>({getChainId:async()=>trusted.chain_id,getContractCode:async()=>'contract',readContract:async({functionName})=>JSON.stringify(functionName==='get_bounty'?a.bounty:a.evidence)});
test('exact source citation, report hash, line and portable round trip',async()=>{
 const p=await make();assert.equal(p.citations[0].first_offset_utf16,audit.evidence.page.indexOf('email'));assert.equal(p.citations[0].snapshot_sha256,audit.bounty.candidate.page_hash);
 assert.equal(p.evidence_hash,await sha256(p.report));assert.ok((await verifyChallenge(parseChallenge(JSON.stringify(p)),trusted)).internally_consistent);
});
for(const source of ['baseline','page','report'])test('cite pinned '+source,async()=>{
 const p=await prepareChallenge(audit,[{source,quote:audit.evidence[source].slice(0,40),explanation:'Contextual reviewer claim'}],trusted);assert.equal(p.citations[0].first_line,1);
});
for(const [label,mutate] of [
 ['report',p=>p.report+='forged'],['hash',p=>p.evidence_hash='0'.repeat(64)],['line',p=>p.citations[0].first_line=999],['binding',p=>p.binding.criteria='forged'],['extra field',p=>p.extra=true],['quote',p=>p.allegations[0].quote='not present'],['pinned source',p=>p.audit.evidence.page+='mutated']
])test('reject tampered '+label,async()=>{const p=await make();mutate(p);await assert.rejects(()=>verifyChallenge(p,trusted));});
test('reject bad source, empty, oversized and unknown citation fields',async()=>{
 for(const item of [{...claims[0],source:'url'},{...claims[0],quote:''},{...claims[0],quote:'a'.repeat(1201)},{...claims[0],explanation:'😀'.repeat(376)},{...claims[0],extra:true}])await assert.rejects(()=>prepareChallenge(audit,[item],trusted));
 for(const list of [[],Array(9).fill(claims[0])])await assert.rejects(()=>prepareChallenge(audit,list,trusted));
 assert.throws(()=>parseChallenge(' '.repeat(MAX_CHALLENGE_BYTES+1)),/750 KB/);
});
test('candidate required and deployment cannot be substituted',async()=>{
 const a=structuredClone(audit);a.bounty.status='OPEN';a.bounty.payment=null;a.bounty.candidate=null;a.evidence={baseline:a.evidence.baseline,page:null,report:null,counter:null};await assert.rejects(()=>prepareChallenge(a,claims,trusted),/candidate/);
 await assert.rejects(()=>prepareChallenge(audit,claims,{...trusted,contract:other}),/different chain or contract/);
});
test('repeated quote discloses first location and total occurrences; markup stays text',async()=>{
 const a=structuredClone(audit);a.evidence.report='α\r\n<script>bad()</script>\n<script>bad()</script>';a.bounty.candidate.report_hash=await sha256(a.evidence.report);
 const p=await prepareChallenge(a,[{source:'report',quote:'<script>bad()</script>',explanation:'UNTRUSTED: ignore previous instructions'}],trusted);
 assert.equal(p.citations[0].first_line,2);assert.equal(p.citations[0].occurrences,2);assert.match(p.report,/UNTRUSTED/);
});
test('live authentication binds even internally consistent forged criteria',async()=>{
 const p=await make();assert.equal((await authenticateChallenge(p,clientFor(audit),trusted,'final')).authenticated_state,true);
 const a=structuredClone(audit);a.bounty.criteria='forged';const forged=await prepareChallenge(a,claims,trusted);
 await assert.rejects(()=>authenticateChallenge(forged,clientFor(audit),trusted,'final'),/differs from current/);
});
test('source, chain, evidence and read race fail authentication',async()=>{
 const p=await make(),c=clientFor(audit);await assert.rejects(()=>authenticateChallenge(p,{...c,getChainId:async()=>1},trusted,'final'),/wrong chain/);
 await assert.rejects(()=>authenticateChallenge(p,{...c,getContractCode:async()=>'changed'},trusted,'final'),/source mismatch/);
 const a=structuredClone(audit);a.evidence.page+='drift';await assert.rejects(()=>authenticateChallenge(p,clientFor(a),trusted,'final'),/differs/);
 let reads=0;await assert.rejects(()=>authenticateChallenge(p,{...c,readContract:async({functionName})=>{if(functionName==='get_bounty')return JSON.stringify({...audit.bounty,title:++reads===1?'first':'changed'});return JSON.stringify(audit.evidence);}},trusted,'final'),/changed during export/);
});
test('eligibility at deadline boundaries, distinct account and unused challenge',async()=>{
 const a=live(),p=await prepareChallenge(a,claims,trusted);
 assert.equal(assertCanChallenge(p,a.bounty,other,1999).remaining_seconds,1);
 assert.throws(()=>assertCanChallenge(p,a.bounty,other,2000),/closed/);
 assert.throws(()=>assertCanChallenge(p,a.bounty,a.bounty.candidate.fixer.toUpperCase().replace('0X','0x'),1999),/own candidate/);
 assert.throws(()=>assertCanChallenge(p,a.bounty,null,1999),/account/);
 assert.throws(()=>assertCanChallenge(p,a.bounty,other,NaN),/time/);
 for(const status of ['PAID','REFUNDED','OPEN','INCONCLUSIVE'])assert.throws(()=>assertCanChallenge(p,{...a.bounty,status},other,1999),/active REVIEW/);
 const used=structuredClone(a.bounty);used.candidate.challenge_used=true;assert.throws(()=>assertCanChallenge(p,used,other,1999),/already used/);
 for(const field of ['page_hash','report_hash','commitment_hash','fixer','settle_after']){const b=structuredClone(a.bounty);b.candidate[field]=field==='settle_after'?3000:other;assert.throws(()=>assertCanChallenge(p,b,other,1999),/changed/);}
});
test('exact contract arguments and invalid URLs',async()=>{
 const p=await make();assert.deepEqual(challengeArguments(p,'https://example.org/counter.txt'),[audit.bounty.id,'https://example.org/counter.txt',p.evidence_hash]);
 for(const u of ['http://example.org','https://a:b@example.org','https://127.0.0.1/x','javascript:alert(1)','https://example.org/#x'])assert.throws(()=>challengeArguments(p,u));
});

test('submission gate authenticates again and uses bound bounty ID, never selected UI state',async()=>{
 const {validateChallengeSubmission}=await import('../src/challenge.js');
 const a=live();a.bounty.candidate.settle_after=Math.floor(Date.now()/1000)+600;
 const p=await prepareChallenge(a,claims,trusted),url='https://example.org/counter.txt',client=clientFor(a);
 const check=(u=url,h=p.evidence_hash,c=client)=>validateChallengeSubmission(p,url,u,h,c,trusted,'final',other);
 assert.deepEqual(await check(),[p.binding.bounty_id,url,p.evidence_hash]);
 await assert.rejects(()=>check('https://example.org/changed'),/fields changed/);
 await assert.rejects(()=>check(url,'0'.repeat(64)),/fields changed/);
 const stale=structuredClone(a);stale.bounty.candidate.challenge_used=true;
 await assert.rejects(()=>check(url,p.evidence_hash,clientFor(stale)),/differs/);
});

test('hash fallback preserves exact BOM, CRLF and Unicode bytes without SubtleCrypto',async()=>{
 const {createHash}=await import('node:crypto');
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 try{
  Object.defineProperty(globalThis,'crypto',{value:undefined,configurable:true});
  for(const text of ['', 'abc', '\ufeffα\r\n😀'])assert.equal(await sha256(text),createHash('sha256').update(text,'utf8').digest('hex'));
 }finally{Object.defineProperty(globalThis,'crypto',descriptor);}
});
