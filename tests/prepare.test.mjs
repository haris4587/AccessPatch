import test from 'node:test';
import assert from 'node:assert/strict';
import {abi} from 'genlayer-js';
import {scanSource,compareSources,prepareRepair,verifyPreparation,parsePreparation,authenticatePreparation,assertCanCommit,contextFromAudit,validateEvidenceUrl,MAX_SOURCE} from '../src/prepare.js';
import {sha256} from '../src/audit.js';
const doc=body=>'<!doctype html><html lang="en"><head><title>Test</title></head><body>'+body+'</body></html>';
const before=doc('<input id="email" type="email" placeholder="Email">');
const after=doc('<label for="email">Email address</label><input id="email" type="email">');
const trusted={chain_id:61999,contract:'0x'+'1'.repeat(40),source_sha256:await sha256('source')};
const ctx={...trusted,bounty_id:0,baseline_hash:await sha256(before),barrier:'Missing email label',criteria:'Retain email input and associate a label',repair_url:'https://example.org/after.html',deadline:9999999999};
const make=()=>prepareRepair(ctx,before,after,'',trusted);
const labels=html=>scanSource(doc(html)).checks.filter(r=>r.rule==='control-label');
const needs=html=>labels(html).map(r=>r.result);

for(const [name,html] of [
 ['explicit label','<label for="x">Name</label><input id="x">'],
 ['wrapping label','<label>Name <input id="x"></label>'],
 ['aria-label','<input id="x" aria-label="Name">'],
 ['aria-labelledby','<span id="label">Given</span><span id="last">name</span><input id="x" aria-labelledby="label last">'],
 ['select and textarea','<label for="x">Notes</label><textarea id="x"></textarea><label for="y">Country</label><select id="y"></select>'],
 ['entities and case','<LABEL FOR="x">&Eacute;mail</LABEL><INPUT ID="x">']
])test('finds declared '+name,()=>assert.ok(needs(html).every(x=>x==='present')));
for(const [name,html] of [
 ['placeholder-only','<input id="x" placeholder="Name">'],
 ['wrong label target','<label for="else">Name</label><input id="x">'],
 ['empty label','<label for="x"> </label><input id="x">'],
 ['missing reference','<input id="x" aria-label="fallback" aria-labelledby="missing">'],
 ['partly missing references','<span id="a">Name</span><input id="x" aria-labelledby="a missing">'],
 ['duplicate references','<span id="a">Name</span><span id="a">Other</span><input id="x" aria-labelledby="a">'],
 ['duplicate control IDs','<label for="x">Name</label><input id="x"><input id="x">'],
 ['ambiguous wrapping','<label>Name <input><input></label>'],
 ['conflicting wrapping for','<label for="other">Name <input id="x"></label>'],
 ['script masquerading as label','<script><label for="x">Name</label></script><input id="x">'],
 ['comment masquerading as label','<!-- <label for="x">Name</label> --><input id="x">'],
 ['inert template masquerading as label','<template><label for="x">Name</label></template><input id="x">'],
 ['hidden label text','<label for="x"><span hidden>Name</span></label><input id="x">']
])test('requires review for '+name,()=>assert.ok(needs(html).every(x=>x==='needs_review')));
test('hidden inputs and submit buttons are outside field-label check',()=>assert.equal(labels('<input type="hidden"><input type="submit"><button>OK</button>').length,0));
test('alternative text presence is separate from semantic quality',()=>{
 const rows=scanSource(doc('<img src="x"><img src="y" alt=""><img src="z" alt="A">')).checks.filter(r=>r.rule==='image-alt');
 assert.deepEqual(rows.map(r=>r.result),['needs_review','present','present']);assert.match(rows[1].detail,/human review/);
});
test('document title and language are checked',()=>{
 const scan=scanSource('<html lang="invalid_tag"><head><title> </title></head><body></body></html>');
 assert.equal(scan.counts.needs_review,2);
});
test('source code is inert and never executed',()=>{
 globalThis.__preflightAttack=false;
 const s=scanSource(doc('<script>globalThis.__preflightAttack=true</script><input id="x">'));
 assert.equal(globalThis.__preflightAttack,false);assert.equal(s.runtime_content,true);
});
test('repair fixes label while preserving its control',()=>{
 const result=compareSources(before,after);assert.equal(result.fixed.length,1);assert.equal(result.removed_controls.length,0);assert.equal(result.summary,'DECLARED_SOURCE_CHECKS_CLEAR');
});
test('removing the input cannot masquerade as fixing it',()=>{
 const result=compareSources(before,doc('<p>No form</p>'));assert.equal(result.fixed.length,0);assert.equal(result.removed_controls[0].id,'email');assert.equal(result.summary,'MANUAL_REVIEW_REQUIRED');
});
test('changing a field type is flagged',()=>{
 const result=compareSources(before,after.replace('type="email"','type="text"'));assert.equal(result.changed_controls.length,1);assert.equal(result.summary,'MANUAL_REVIEW_REQUIRED');
});
test('new source problems are reported as regressions',()=>assert.ok(compareSources(after,after+'<img src="x">').new_findings.some(k=>k.startsWith('image-alt'))));
test('fields without unique IDs require manual continuity review',()=>assert.equal(compareSources(doc('<label>Name<input></label>'),doc('<label>Name<input></label>')).summary,'MANUAL_REVIEW_REQUIRED'));
test('huge and deeply nested sources are bounded',()=>{
 assert.throws(()=>scanSource('x'.repeat(MAX_SOURCE+1)),/60,000/);
 assert.throws(()=>scanSource('   '),/nonempty/);
 assert.throws(()=>scanSource('é'.repeat(MAX_SOURCE/2+1)),/60,000/);
 assert.throws(()=>scanSource('<div>'.repeat(1501)),/1,500/);
});
test('preparation is reproducible and has exact report bytes',async()=>{
 const a=await make(),b=await make();assert.deepEqual(a,b);assert.equal(a.report_hash,await sha256(a.report));assert.equal(a.page_hash,await sha256(after));assert.equal((await verifyPreparation(a,trusted)).mode,'offline');
 assert.match(a.report,/not a browser accessibility audit/);assert.match(a.report,/GenLayer verdict/);
});
test('CRLF, BOM and unicode remain byte-distinct',async()=>{
 const crlf=after.replaceAll('><','>\r\n<'),bom='\ufeff'+after;
 for(const repair of [crlf,bom,after+'é']){const p=await prepareRepair(ctx,before,repair,'',trusted);assert.equal(p.page_hash,await sha256(repair));assert.notEqual(p.page_hash,await sha256(after));await verifyPreparation(p,trusted);}
});
for(const [name,change] of [
 ['page',p=>p.repair_html+='!'],['original',p=>p.original_html+='!'],['report',p=>p.report+='!'],
 ['analysis',p=>p.analysis.summary='GENLAYER_APPROVED'],['report hash',p=>p.report_hash='0'.repeat(64)],
 ['page hash',p=>p.page_hash='0'.repeat(64)],['extra fields',p=>p.secret_salt='do not export'],
 ['context fields',p=>p.context.private_key='do not export'],['wrong chain',p=>p.context.chain_id=1],
 ['wrong contract',p=>p.context.contract='0x'+'2'.repeat(40)],['wrong source',p=>p.context.source_sha256='0'.repeat(64)]
])test('rejects tampered '+name,async()=>{const p=structuredClone(await make());change(p);await assert.rejects(()=>verifyPreparation(p,trusted));});
test('notes, generated report and package sizes are bounded',async()=>{
 await assert.rejects(()=>prepareRepair(ctx,before,after,'é'.repeat(751),trusted),/1,500/);
 assert.throws(()=>parsePreparation('é'.repeat(175001)),/350 KB/);
 const many=doc(Array.from({length:220},(_,i)=>'<input id="a'+i+'">').join(''));
 await assert.rejects(()=>prepareRepair(ctx,before,many,'',trusted),/report exceeds/);
});
test('unknown schema and engine are rejected',async()=>{const p=await make();await assert.rejects(()=>verifyPreparation({...p,schema:'bad'},trusted),/version/);await assert.rejects(()=>verifyPreparation({...p,engine:'bad'},trusted),/version/);});
const bounty={id:0,baseline_hash:ctx.baseline_hash,barrier:ctx.barrier,criteria:ctx.criteria,repair_url:ctx.repair_url,deadline:ctx.deadline,status:'OPEN',candidate:null,reward_wei:'1000000000000000000',sponsor:'0x'+'3'.repeat(40),history:[],payment:null};
const audit={schema:'accesspatch-audit-v1',...trusted,exported_at:'test',bounty,evidence:{baseline:before,page:null,report:null,counter:null},transfers:[]};
const client={getChainId:async()=>61999,getContractCode:async()=>'source',readContract:async({functionName,transactionHashVariant})=>{assert.equal(transactionHashVariant,'final');return JSON.stringify(functionName==='get_bounty'?bounty:audit.evidence);}};
test('online context authentication reads actual finalized state',async()=>{const result=await authenticatePreparation(await make(),audit,client,trusted,'final');assert.equal(result.authenticated_context,true);assert.match(result.note,/not been approved/);});
test('forged criteria with recomputed report still fail online authentication',async()=>{const p=await prepareRepair({...ctx,criteria:'Forged criteria'},before,after,'',trusted);await verifyPreparation(p,trusted);await assert.rejects(()=>authenticatePreparation(p,audit,client,trusted,'final'),/authenticated bounty context/);});
test('forged baseline and recomputed hashes fail online authentication',async()=>{const original=before+'!',p=await prepareRepair({...ctx,baseline_hash:await sha256(original)},original,after,'',trusted);await verifyPreparation(p,trusted);await assert.rejects(()=>authenticatePreparation(p,audit,client,trusted,'final'),/authenticated bounty context/);});
test('stale audit cannot authenticate a preparation',async()=>{const stale=structuredClone(audit);stale.bounty.deadline--;await assert.rejects(async()=>authenticatePreparation(await make(),stale,client,trusted,'final'),/current finalized state/);});
test('handoff blocks paid, review, refunded and expired bounties',async()=>{
 const p=await make();for(const status of ['PAID','REVIEW','REFUNDED'])assert.throws(()=>assertCanCommit(p,{...bounty,status},1),/not open/);
 assert.throws(()=>assertCanCommit(p,bounty,bounty.deadline),/not open/);
 assert.throws(()=>assertCanCommit(p,bounty,bounty.deadline-60),/not open/);
 assert.doesNotThrow(()=>assertCanCommit(p,bounty,bounty.deadline-61));
 assert.doesNotThrow(()=>assertCanCommit(p,{...bounty,status:'INCONCLUSIVE'},1));
});
test('handoff rejects another bounty and changed locked criteria',async()=>{const p=await make();assert.throws(()=>assertCanCommit(p,{...bounty,id:1},1),/does not match/);assert.throws(()=>assertCanCommit(p,{...bounty,criteria:'changed'},1),/does not match/);});
test('generated export has no wallet keys, salts, RPC endpoints or approval flag',async()=>{const p=await make();assert.deepEqual(Object.keys(p).sort(),['schema','engine','context','original_html','repair_html','notes','analysis','report','page_hash','report_hash'].sort());assert.deepEqual(contextFromAudit(audit),ctx);});

test('report URL validation enforces contract-compatible public URL rules',()=>{
 assert.equal(validateEvidenceUrl('https://example.org/report.txt'),'https://example.org/report.txt');
 for(const raw of ['http://example.org','HTTPS://example.org','https://user@example.org','https://example.org/#x','https://example.org/path@x','https://localhost/x','https://127.0.0.1/x','https://10.1.1.1/x','https://192.168.1.1/x','https://169.254.1.1/x','https://metadata.google.internal/x','https://example.org/'+'x'.repeat(500)])assert.throws(()=>validateEvidenceUrl(raw));
});
