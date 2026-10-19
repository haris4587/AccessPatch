import {exportBundle,verifyBundle} from './audit.js';
import {contextFromAudit,prepareRepair,parsePreparation,verifyPreparation,authenticatePreparation,assertCanCommit,validateEvidenceUrl,MAX_SOURCE,MAX_PACKAGE,SCOPE} from './prepare.js';

export function initEvidenceStudio({client,trusted,variant,usePrepared}) {
 const $=id=>document.getElementById(id);
 let audit=null,original='',repair='',prepared=null;
 const state=(message,result)=>{$('prepStatus').textContent=message;$('prepResult').textContent=result?JSON.stringify(result,null,2):'';};
 const reset=()=>{prepared=null;$('prepReport').textContent='';for(const id of ['prepSave','prepPage','prepText','prepUse','prepOnline'])$(id).disabled=true;};
 const busy=value=>{
  for(const n of document.querySelectorAll('#prepare input,#prepare textarea,#prepare button'))n.disabled=value;
  if(!value){for(const id of ['prepSave','prepPage','prepText','prepUse','prepOnline'])$(id).disabled=!prepared;}
 };
 const run=fn=>async()=>{busy(true);try{await fn();}catch(e){state(e.message);}finally{busy(false);}};
 const bytesToText=async(file,max)=>{
  if(!file||file.size>max)throw Error('Choose a file within the displayed size limit');
  // Fatal UTF-8 decode prevents silently replacing bytes before hashing; keep a BOM if present.
  return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await file.arrayBuffer());
 };
 const showBinding=()=>{$('prepBinding').textContent=JSON.stringify(contextFromAudit(audit),null,2);$('prepOriginal').value=original;};
 const result=()=>{state('Prepared locally. '+prepared.analysis.summary+'. GenLayer has not approved this repair.',{summary:prepared.analysis.summary,fixed:prepared.analysis.fixed,new_findings:prepared.analysis.new_findings,removed_controls:prepared.analysis.removed_controls,changed_controls:prepared.analysis.changed_controls,before:prepared.analysis.before.counts,after:prepared.analysis.after.counts,page_hash:prepared.page_hash,report_hash:prepared.report_hash});$('prepReport').textContent=prepared.report;};
 const download=(text,name,type='text/plain')=>{const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('prepScope').textContent=SCOPE;
 $('prepLoad').onclick=run(async()=>{
  reset();const raw=$('prepId').value;if(!/^[0-9]+$/.test(raw)||!Number.isSafeInteger(Number(raw)))throw Error('Use a nonnegative bounty ID');
  audit=null;state('Loading consensus-pinned baseline and locked criteria…');
  const loaded=await exportBundle(client(),trusted,Number(raw),variant);audit=loaded;original=loaded.evidence.baseline;showBinding();
  state('Baseline and locked context loaded from GenLayer. Upload or paste repaired HTML. Current bounty status: '+audit.bounty.status);
 });
 $('prepExample').onclick=run(async()=>{
  reset();audit=null;const response=await fetch('/audit-example.json');if(!response.ok)throw Error('Recorded example unavailable');
  const loaded=JSON.parse(await response.text());await verifyBundle(loaded,trusted);
  audit=loaded;original=loaded.evidence.baseline;repair=loaded.evidence.page;$('prepRepair').value=repair;$('prepNotes').value='Synthetic missing-label example. Source markup only.';$('prepId').value=loaded.bounty.id;showBinding();
  prepared=await prepareRepair(contextFromAudit(audit),original,repair,$('prepNotes').value,trusted);result();
  $('prepStatus').textContent='Recorded synthetic example: offline consistency only. '+prepared.analysis.summary+'. This already-paid bounty cannot accept a new commitment.';
 });
 $('prepRepairFile').onchange=run(async()=>{
  reset();repair=await bytesToText($('prepRepairFile').files[0],MAX_SOURCE);$('prepRepair').value=repair;state('Exact UTF-8 file bytes loaded. Analyze to generate the report.');
 });
 $('prepRepair').oninput=()=>{reset();repair=$('prepRepair').value;state('Repair edited. Analyze again to recompute both hashes.');};
 $('prepNotes').oninput=()=>{reset();state('Notes edited. Analyze again to recompute the report hash.');};
 $('prepAnalyze').onclick=run(async()=>{reset();if(!audit)throw Error('Load a bounty or recorded example first');prepared=await prepareRepair(contextFromAudit(audit),original,repair,$('prepNotes').value,trusted);result();});
 $('prepImport').onchange=run(async()=>{
  reset();audit=null;const imported=parsePreparation(await bytesToText($('prepImport').files[0],MAX_PACKAGE));await verifyPreparation(imported,trusted);
  original=imported.original_html;repair=imported.repair_html;prepared=imported;
  $('prepRepair').value=repair;$('prepOriginal').value=original;$('prepNotes').value=imported.notes;$('prepId').value=imported.context.bounty_id;$('prepBinding').textContent=JSON.stringify(imported.context,null,2);result();
  $('prepStatus').textContent='Imported and recomputed successfully. Offline consistency only; recheck the bounty on GenLayer before using this report.';
 });
 $('prepSave').onclick=run(async()=>{await verifyPreparation(prepared,trusted);download(JSON.stringify(prepared,null,2)+'\n','accesspatch-preparation-'+prepared.context.bounty_id+'.json','application/json');});
 $('prepPage').onclick=()=>download(prepared.repair_html,'repair.html');
 $('prepText').onclick=()=>download(prepared.report,'repair-report.txt');
 const recheck=async()=>{
  const latest=await exportBundle(client(),trusted,prepared.context.bounty_id,variant);
  const checked=await authenticatePreparation(prepared,latest,client(),trusted,variant);return {latest,checked};
 };
 $('prepOnline').onclick=run(async()=>{const {checked}=await recheck();state(checked.note,checked);});
 $('prepUse').onclick=run(async()=>{
  const reportUrl=validateEvidenceUrl($('prepReportUrl').value.trim());
  const {latest}=await recheck();assertCanCommit(prepared,latest.bounty);
  await usePrepared({bounty:latest.bounty,reportUrl,pageHash:prepared.page_hash,reportHash:prepared.report_hash});
  state('Repair form prepared. Commit privately first, publish the exact downloaded page/report at the locked URLs, then reveal after the 60-second minimum. No transaction has been sent.');
 });
}
