import {exportBundle} from './audit.js';
import {CHALLENGE_SCOPE,MAX_CHALLENGE_BYTES,prepareChallenge,parseChallenge,verifyChallenge,authenticateChallenge,assertCanChallenge,challengeArguments} from './challenge.js';

export function initChallengeStudio({client,trusted,variant,account,useChallenge,doc=document,fetcher=fetch}) {
  const $ = id => doc.getElementById(id);
  let audit=null, prepared=null, busy=false, citations=[];
  const controls=['challengeLoad','challengeExample','challengeAdd','challengeBuild','challengeImport','challengeOnline','challengeUse','challengeSave','challengeText'];
  function update() {
    for(const id of controls) $(id).disabled=busy;
    for(const id of ['challengeOnline','challengeUse','challengeSave','challengeText']) $(id).disabled=busy||!prepared;
    $('challengeAdd').disabled=busy||!audit;
    $('challengeBuild').disabled=busy||!audit||!citations.length;
    $('challengeSource').disabled=busy||!audit;
  }
  function invalidate() {prepared=null;$('challengeReport').textContent='';$('challengeResult').textContent='';update();}
  function showSources() {$('challengeSnapshot').textContent=audit?.evidence[$('challengeSource').value]||'';}
  function showCitations() {$('challengeCitations').textContent=JSON.stringify(citations,null,2);}
  function loaded(a) {audit=a;citations=[];showCitations();invalidate();$('challengeContext').textContent=JSON.stringify(a.bounty,null,2);showSources();}
  async function run(task) {if(busy)return;busy=true;update();try{await task();}catch(e){$('challengeStatus').textContent='Challenge tools: '+e.message;}finally{busy=false;update();}}
  function save(text,name,type) {const u=URL.createObjectURL(new Blob([text],{type}));const a=doc.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function load() {
    prepared=null;audit=null;citations=[];showCitations();$('challengeContext').textContent='';showSources();invalidate();
    const raw=$('challengeId').value;
    if(!/^[0-9]+$/.test(raw)||!Number.isSafeInteger(Number(raw)))throw Error('Use a nonnegative integer bounty ID');
    const a=await exportBundle(client(),trusted,Number(raw),variant);loaded(a);
    $('challengeStatus').textContent='Loaded finalized reviewed snapshots. Choose a source and cite exact text; terminal bounties are inspectable but cannot be challenged.';
  }
  $('challengeScope').textContent=CHALLENGE_SCOPE;
  $('challengeLoad').onclick=()=>run(load);
  $('challengeExample').onclick=()=>run(async()=>{
    audit=null;citations=[];showCitations();$('challengeContext').textContent='';showSources();invalidate();
    const r=await fetcher('/audit-example.json');if(!r.ok)throw Error('Recorded example unavailable');
    const a=JSON.parse(await r.text());
    // Build the example through the same verifier; this is an allegation example, not an asserted defect.
    const quote=a.evidence.report.slice(0,Math.min(100,a.evidence.report.length));
    const claims=[{source:'report',quote,explanation:'Demonstration citation only. A reviewer must explain a concrete contradiction of the locked criteria; this example does not establish a defect.'}];
    const p=await prepareChallenge(a,claims,trusted);loaded(a);citations=claims;prepared=p;showCitations();
    $('challengeReport').textContent=p.report;$('challengeResult').textContent=JSON.stringify(await verifyChallenge(p,trusted),null,2);
    $('challengeStatus').textContent='Recorded synthetic PAID example: offline consistency only. Form handoff is blocked for paid bounties.';
  });
  $('challengeSource').onchange=showSources;
  $('challengeAdd').onclick=()=>run(async()=>{
    const claim={source:$('challengeSource').value,quote:$('challengeQuote').value,explanation:$('challengeExplanation').value};
    await prepareChallenge(audit,[...citations,claim],trusted);
    citations.push(claim);invalidate();showCitations();$('challengeQuote').value='';$('challengeExplanation').value='';
    $('challengeStatus').textContent='Citation anchored to pinned source. Build the report when all reviewer claims are included.';
  });
  $('challengeClear').onclick=()=>{if(busy)return;citations=[];invalidate();showCitations();$('challengeStatus').textContent='Citations cleared.';};
  $('challengeBuild').onclick=()=>run(async()=>{
    prepared=null;invalidate();prepared=await prepareChallenge(audit,citations,trusted);
    $('challengeReport').textContent=prepared.report;$('challengeResult').textContent=JSON.stringify(await verifyChallenge(prepared,trusted),null,2);
    $('challengeStatus').textContent='Report built. Download exact text, publish it at a public HTTPS URL, then authenticate before form handoff.';
  });
  $('challengeImport').onchange=()=>run(async()=>{
    audit=null;prepared=null;citations=[];showCitations();showSources();$('challengeContext').textContent='';invalidate();
    try{const file=$('challengeImport').files[0];if(!file)return;if(file.size>MAX_CHALLENGE_BYTES)throw Error('Challenge package exceeds 750 KB');
      const p=parseChallenge(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await file.arrayBuffer()));
      const result=await verifyChallenge(p,trusted);loaded(p.audit);citations=p.allegations;prepared=p;showCitations();
      $('challengeReport').textContent=p.report;$('challengeResult').textContent=JSON.stringify(result,null,2);$('challengeStatus').textContent=result.note;
    }finally{$('challengeImport').value='';}
  });
  $('challengeOnline').onclick=()=>run(async()=>{
    const result=await authenticateChallenge(prepared,client(),trusted,variant);$('challengeResult').textContent=JSON.stringify(result,null,2);$('challengeStatus').textContent=result.note;
  });
  $('challengeUse').onclick=()=>run(async()=>{
    // Always reread, even after a successful authentication. No writes are sent here.
    await authenticateChallenge(prepared,client(),trusted,variant);
    assertCanChallenge(prepared,prepared.audit.bounty,account());
    const args=challengeArguments(prepared,$('challengeUrl').value);
    await useChallenge({bounty:prepared.audit.bounty,args,prepared});
    $('challengeStatus').textContent='Exact challenge URL and hash loaded into the form. No transaction has been sent. The contract rechecks eligibility and fetches the published bytes.';
  });
  $('challengeSave').onclick=()=>{if(prepared&&!busy)save(JSON.stringify(prepared,null,2)+'\n','accesspatch-challenge-'+prepared.binding.bounty_id+'.json','application/json');};
  $('challengeText').onclick=()=>{if(prepared&&!busy)save(prepared.report,'accesspatch-counter-evidence-'+prepared.binding.bounty_id+'.txt','text/plain;charset=utf-8');};
  update();
}
