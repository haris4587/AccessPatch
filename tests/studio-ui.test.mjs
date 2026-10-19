// Event-flow integration checks using a minimal DOM double, not a browser/visual test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initEvidenceStudio} from '../src/studio-ui.js';
import {sha256} from '../src/audit.js';
const recorded=JSON.parse(await fs.readFile('public/audit-example.json','utf8'));
const trusted={chain_id:recorded.chain_id,contract:recorded.contract,source_sha256:await sha256('test contract')};
const example={...recorded,source_sha256:trusted.source_sha256};
const ids=[...new Set([...((await fs.readFile('index.html','utf8')).matchAll(/id="(prep[^"]*)"/g))].map(m=>m[1]))];
const elements=Object.fromEntries(ids.map(id=>[id,{value:'',textContent:'',disabled:false,files:[]} ]));
globalThis.document={getElementById:id=>elements[id],querySelectorAll:()=>Object.values(elements)};
globalThis.fetch=async()=>({ok:true,text:async()=>JSON.stringify(example)});
let live=structuredClone(example),handoffs=[];
const client={getChainId:async()=>trusted.chain_id,getContractCode:async()=>'test contract',readContract:async({functionName})=>JSON.stringify(functionName==='get_bounty'?live.bounty:live.evidence)};
initEvidenceStudio({client:()=>client,trusted,variant:'final',usePrepared:async p=>handoffs.push(p)});
const upload=text=>({size:new TextEncoder().encode(text).length,arrayBuffer:async()=>new TextEncoder().encode(text).buffer});

test('example -> compare -> byte preservation -> import -> authenticated form handoff',async t=>{
 await t.test('recorded example produces safe plain-text report',async()=>{
  await elements.prepExample.onclick();assert.match(elements.prepStatus.textContent,/offline/);assert.equal(elements.prepSave.disabled,false);assert.match(elements.prepReport.textContent,/source repair report/);
 });
 await t.test('editing a repair invalidates exports until recomputed',async()=>{
  elements.prepRepair.value+='<img src="x">';elements.prepRepair.oninput();assert.equal(elements.prepSave.disabled,true);assert.equal(elements.prepReport.textContent,'');
  await elements.prepAnalyze.onclick();assert.match(elements.prepResult.textContent,/image-alt/);assert.equal(elements.prepSave.disabled,false);
 });
 await t.test('UTF-8 upload preserves BOM/CRLF in computed hash',async()=>{
  const text='\ufeff'+example.evidence.page.replaceAll('><','>\r\n<');elements.prepRepairFile.files=[upload(text)];await elements.prepRepairFile.onchange();await elements.prepAnalyze.onclick();
  assert.equal(JSON.parse(elements.prepResult.textContent).page_hash,await sha256(text));
 });
 await t.test('invalid UTF-8 upload fails closed',async()=>{
  elements.prepRepairFile.files=[{size:1,arrayBuffer:async()=>new Uint8Array([255]).buffer}];await elements.prepRepairFile.onchange();assert.equal(elements.prepSave.disabled,true);
 });
 await t.test('forged imported report cannot be exported or handed off',async()=>{
  const {prepareRepair,contextFromAudit}=await import('../src/prepare.js');const p=await prepareRepair(contextFromAudit(example),example.evidence.baseline,example.evidence.page,'',trusted);p.report+='forged';
  elements.prepImport.files=[upload(JSON.stringify(p))];await elements.prepImport.onchange();assert.equal(elements.prepSave.disabled,true);assert.equal(elements.prepUse.disabled,true);
 });
 await t.test('live paid example can authenticate but cannot enter commit form',async()=>{
  await elements.prepExample.onclick();await elements.prepOnline.onclick();assert.match(elements.prepResult.textContent,/authenticated_context/);
  elements.prepReportUrl.value='https://example.org/report.txt';await elements.prepUse.onclick();assert.equal(handoffs.length,0);assert.match(elements.prepStatus.textContent,/not open/);
 });
 await t.test('an open authenticated bounty fills only exact hashes and sends no write',async()=>{
  live=structuredClone(example);live.bounty={...live.bounty,status:'OPEN',candidate:null,payment:null,deadline:Math.floor(Date.now()/1000)+3600};live.evidence={baseline:live.evidence.baseline,page:null,report:null,counter:null};live.transfers=[];
  elements.prepId.value='0';await elements.prepLoad.onclick();elements.prepRepair.value=example.evidence.page;elements.prepRepair.oninput();await elements.prepAnalyze.onclick();
  const expected=JSON.parse(elements.prepResult.textContent);await elements.prepUse.onclick();assert.equal(handoffs.length,1);assert.equal(handoffs[0].pageHash,expected.page_hash);assert.equal(handoffs[0].reportHash,expected.report_hash);assert.match(elements.prepStatus.textContent,/No transaction has been sent/);
 });
});
