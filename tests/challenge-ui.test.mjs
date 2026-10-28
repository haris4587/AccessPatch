// DOM-double event-flow checks; browser QA is a separate verification step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {sha256} from '../src/audit.js';
import {prepareChallenge} from '../src/challenge.js';
import {initChallengeStudio} from '../src/challenge-ui.js';
const a=JSON.parse(await fs.readFile('public/audit-example.json','utf8'));a.source_sha256=await sha256('contract');a.transfers=[];
const trusted={chain_id:a.chain_id,contract:a.contract,source_sha256:a.source_sha256};
const ids=[...(await fs.readFile('index.html','utf8')).matchAll(/id="(challenge[^"]*)"/g)].map(m=>m[1]);
const els=Object.fromEntries(ids.map(id=>[id,{value:'',textContent:'',disabled:false,files:[]}]));els.challengeSource.value='page';els.challengeId.value='0';
const doc={getElementById:id=>els[id]};let live=structuredClone(a),handoffs=[],who='0x'+'1'.repeat(40);
const client={getChainId:async()=>trusted.chain_id,getContractCode:async()=>'contract',readContract:async({functionName})=>JSON.stringify(functionName==='get_bounty'?live.bounty:live.evidence)};
const upload=text=>({size:new TextEncoder().encode(text).length,arrayBuffer:async()=>new TextEncoder().encode(text).buffer});
initChallengeStudio({client:()=>client,trusted,variant:'final',account:()=>who,useChallenge:async x=>handoffs.push(x),doc,fetcher:async()=>({ok:true,text:async()=>JSON.stringify(a)})});
test('challenge UI complete review, import, eligibility and stale-state event flow',async t=>{
 await t.test('recorded paid example verifies but blocks form handoff',async()=>{
  await els.challengeExample.onclick();assert.equal(els.challengeSave.disabled,false);assert.match(els.challengeStatus.textContent,/PAID/);await els.challengeOnline.onclick();assert.match(els.challengeResult.textContent,/authenticated_state/);
  els.challengeUrl.value='https://example.org/counter.txt';await els.challengeUse.onclick();assert.equal(handoffs.length,0);assert.match(els.challengeStatus.textContent,/active REVIEW/);
 });
 await t.test('non-verbatim citation rejected; report invalidated when citation added',async()=>{
  els.challengeQuote.value='not in snapshot';els.challengeExplanation.value='claim';await els.challengeAdd.onclick();assert.match(els.challengeStatus.textContent,/verbatim/);
  els.challengeQuote.value='email';await els.challengeAdd.onclick();assert.equal(els.challengeSave.disabled,true);assert.equal(els.challengeReport.textContent,'');await els.challengeBuild.onclick();assert.equal(els.challengeSave.disabled,false);
 });
 await t.test('valid active candidate hands off exact args; account and window rechecked',async()=>{
  live=structuredClone(a);live.bounty.status='REVIEW';live.bounty.payment=null;live.bounty.candidate.challenge_used=false;live.bounty.candidate.settle_after=Math.floor(Date.now()/1000)+600;
  await els.challengeLoad.onclick();els.challengeQuote.value='email';els.challengeExplanation.value='Explain a contradiction against criteria';await els.challengeAdd.onclick();await els.challengeBuild.onclick();
  const hash=JSON.parse(els.challengeResult.textContent).evidence_hash;await els.challengeUse.onclick();assert.equal(handoffs.length,1);assert.deepEqual(handoffs[0].args,[0,'https://example.org/counter.txt',hash]);assert.equal(handoffs[0].prepared.evidence_hash,hash);
  who=live.bounty.candidate.fixer;await els.challengeUse.onclick();assert.equal(handoffs.length,1);assert.match(els.challengeStatus.textContent,/own candidate/);who='0x'+'1'.repeat(40);
  live.bounty.candidate.settle_after=1;await els.challengeUse.onclick();assert.equal(handoffs.length,1);assert.match(els.challengeStatus.textContent,/differs/);
 });
 await t.test('malformed import clears previously usable report',async()=>{
  els.challengeImport.files=[upload('{bad')];await els.challengeImport.onchange();assert.equal(els.challengeUse.disabled,true);assert.equal(els.challengeReport.textContent,'');
 });
 await t.test('imports fully recompute; forged report cannot be used',async()=>{
  const p=await prepareChallenge(a,[{source:'page',quote:'email',explanation:'claim'}],trusted);els.challengeImport.files=[upload(JSON.stringify(p))];await els.challengeImport.onchange();assert.equal(els.challengeSave.disabled,false);
  p.report+='forged';els.challengeImport.files=[upload(JSON.stringify(p))];await els.challengeImport.onchange();assert.equal(els.challengeUse.disabled,true);assert.match(els.challengeStatus.textContent,/recomputed/);
 });
 await t.test('failed live load clears exports; clear citations also invalidates report',async()=>{
  await els.challengeExample.onclick();els.challengeId.value='bad';await els.challengeLoad.onclick();assert.equal(els.challengeSave.disabled,true);assert.equal(els.challengeSnapshot.textContent,'');
  await els.challengeExample.onclick();els.challengeClear.onclick();assert.equal(els.challengeSave.disabled,true);assert.equal(els.challengeBuild.disabled,true);
 });
});
