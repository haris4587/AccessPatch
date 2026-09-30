import './style.css';
import {createClient,createAccount,generatePrivateKey} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionStatus,TransactionHashVariant} from 'genlayer-js/types';
import {parseEther,formatEther} from 'viem';
const $=s=>document.querySelector(s);
let deployment=await fetch('/deployment.json').then(r=>r.json());
let key=sessionStorage.getItem('ap-test-key');
let account=key?createAccount(key):null;
let client=createClient({chain:studionet,...(account?{account}:{})});
let rows=[],selected=null,offset=0,total=0,busy=false;
const say=t=>{$('#notice').textContent=t;};
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=t=>new Date(Number(t)*1000).toLocaleString();
const safeLink=(u,text)=>(/^(https:\/\/|\/)/.test(u))?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(text)}</a>`:'';
const money=w=>formatEther(BigInt(w));
function accountLabel(){ $('#account').textContent=account?`${account.address.slice(0,6)}…${account.address.slice(-4)} · Fund test account`:'Create test account'; }
accountLabel();
$('#account').onclick=async()=>{
 try{
 if(!account){key=generatePrivateKey();sessionStorage.setItem('ap-test-key',key);account=createAccount(key);client=createClient({chain:studionet,account});accountLabel();say('Test account created for this browser session. Use it only for sandbox GEN; closing the session removes access.');}
 const balance=await client.getBalance({address:account.address});
 if(balance===0n){await client.request({method:'sim_fundAccount',params:[account.address,10e18]});say('Studio faucet requested 10 sandbox GEN for '+account.address+'. Check balance before sponsoring.');}else say('Sandbox balance: '+formatEther(balance)+' GEN. Account: '+account.address);
 }catch(e){say('Account funding failed: '+e.message);}
};
async function refresh(){
 if(!deployment.contract){$('#networkStatus').textContent='Deployment pending';$('#bounties').innerHTML='<p>No contract is configured yet.</p>';return;}
 try{
 total=Number(await client.readContract({address:deployment.contract,functionName:'get_count',transactionHashVariant:TransactionHashVariant.LATEST_FINAL}));
 const data=await client.readContract({address:deployment.contract,functionName:'list_bounties',args:[offset,10],transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
 rows=JSON.parse(data); $('#networkStatus').textContent='Finalized state connected';$('#count').textContent=total+' bounties';$('#page').textContent=`${offset+1}–${Math.min(offset+10,total)} of ${total}`;$('#prev').disabled=offset===0;$('#next').disabled=offset+10>=total;
 if(selected){selected=rows.find(x=>x.id===selected.id)??JSON.parse(await client.readContract({address:deployment.contract,functionName:'get_bounty',args:[selected.id],transactionHashVariant:TransactionHashVariant.LATEST_FINAL}));detail();}
 board();
 }catch(e){$('#networkStatus').textContent='Read unavailable';say('Could not load finalized state: '+e.message);$('#bounties').innerHTML='<p>Finalized state is unavailable. Use Refresh to retry.</p>';}
}
function board(){
 const filtered=rows.filter(b=>$('#filter').value==='ALL'||b.status===$('#filter').value);
 $('#bounties').innerHTML=filtered.map(b=>`<button class="card ${selected?.id===b.id?'selected':''}" data-id="${b.id}" aria-label="Inspect ${esc(b.title)}"><div class="cardTop"><span class="small">BOUNTY #${b.id}</span><span class="badge ${b.status}">${esc(b.status)}</span></div><h3>${esc(b.title)}</h3><p>${esc(b.barrier.slice(0,160))}</p><div class="cardBottom"><span class="reward">${money(b.reward_wei)} GEN</span><span class="small">${b.status==='OPEN'?'Deadline':'Submitted'} ${when(b.deadline)}</span></div></button>`).join('')||'<p>No bounties match this view.</p>';
 document.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>{selected=rows.find(x=>x.id===Number(el.dataset.id));board();detail();});
}
function detail(){
 const b=selected,c=b.candidate;
 $('#detail').innerHTML=`<div class="detailHeading"><span class="small">BOUNTY #${b.id}</span><span class="badge ${b.status}">${b.status}</span></div><h2>${esc(b.title)}</h2><p class="reward">${money(b.reward_wei)} sandbox GEN</p><div class="detailBlock"><h3>Barrier</h3><p>${esc(b.barrier)}</p></div><div class="detailBlock"><h3>Acceptance criteria</h3><p>${esc(b.criteria)}</p></div><div class="detailBlock"><h3>Committed sources</h3>${safeLink(b.baseline_url,'Original page')}${safeLink(b.repair_url,'Authorized repair page')}<p class="digest">Baseline SHA-256: ${esc(b.baseline_hash)}</p>${c?safeLink(c.report_url,'Repair evidence report')+`<p class="digest">Repair SHA-256: ${esc(c.page_hash)}<br>Report SHA-256: ${esc(c.report_hash)}</p>`:''}</div><div class="detailBlock"><h3>Timing & participants</h3><p>Submission deadline: ${when(b.deadline)}<br>Challenge period: ${b.challenge_seconds} seconds${c?'<br>Settlement after: '+when(c.settle_after):''}</p><p class="digest">Sponsor: ${esc(b.sponsor)}${c?'<br>Fixer: '+esc(c.fixer):''}</p></div><div class="actions">${b.status==='OPEN'?'<button data-action="repair">Submit repair</button>':''}${b.status==='REVIEW'?'<button data-action="challenge" class="secondary">Challenge</button><button data-action="settle">Settle reward</button>':''}${b.status==='INCONCLUSIVE'?'<button data-action="retry_review">Retry review</button>':''}${['OPEN','INCONCLUSIVE'].includes(b.status)?'<button data-action="refund" class="secondary">Refund after deadline</button>':''}</div>${b.payment?`<div class="event"><strong>${b.payment.type==='REWARD'?'Reward released':'Reward refunded'}</strong><p>${money(b.payment.amount_wei)} GEN</p><p class="digest">Recipient ${esc(b.payment.recipient)}</p></div>`:''}<div class="detailBlock"><h3>Decision history</h3>${b.history.map(h=>`<div class="event"><strong>${esc(h.action)} · ${esc(h.verdict)}</strong><p>${esc(h.reason)}</p><span class="small">${when(h.time)}</span></div>`).join('')||'<p>No repair has been judged yet.</p>'}</div>`;
 document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>{const a=el.dataset.action;if(a==='repair'||a==='challenge')openForm(a);else execute(a==='settle'?'settle':a,[b.id],0n);});
}
function field(name,label,type='text',value='',help='') {return `<label class="field"><span>${esc(label)}</span>${type==='textarea'?`<textarea name="${name}" required maxlength="2000">${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" required ${type==='number'?'min="1" step="1"':''}>`}${help?`<small>${esc(help)}</small>`:''}</label>`;}
let mode='create';
function openForm(m){mode=m;$('#formTitle').textContent={create:'Sponsor a repair',repair:'Submit repair evidence',challenge:'Challenge a repair'}[m];
 $('#fields').innerHTML=m==='create'?field('title','Bounty title')+field('baseline_url','Public original page URL','url')+field('repair_url','Authorized repaired page URL','url')+field('barrier','Specific accessibility barrier','textarea')+field('criteria','Acceptance criteria','textarea')+field('reward','Reward in sandbox GEN','text','0.1')+field('duration','Submission period in seconds','number','86400')+field('challenge_seconds','Challenge period in seconds','number','3600'):m==='repair'?field('report_url','Public repair report URL','url')+field('page_hash','Repaired page SHA-256')+field('report_hash','Report SHA-256'):field('evidence_url','Public counter-evidence URL','url')+field('evidence_hash','Counter-evidence SHA-256');
 $('#formHelp').textContent=m==='create'?'The contract fetches and pins the original page at creation. The authorized repaired URL is immutable. Fund the reward with this transaction.':'Commit lowercase SHA-256 of the exact UTF-8 response bytes. The contract fetches these sources independently; changed or unavailable evidence is inconclusive.';$('#dialog').showModal();}
$('#new').onclick=()=>openForm('create');$('#close').onclick=()=>$('#dialog').close();
$('#form').onsubmit=async ev=>{ev.preventDefault();const f=Object.fromEntries(new FormData(ev.target));try{let name,args,value=0n;
 if(mode==='create'){name='create_bounty';args=[f.title,f.baseline_url,f.repair_url,f.barrier,f.criteria,Number(f.duration),Number(f.challenge_seconds)];value=parseEther(f.reward);if(value<=0n)throw Error('Reward must be positive');}
 else if(mode==='repair'){name='submit_repair';args=[selected.id,f.report_url,f.page_hash,f.report_hash];}
 else{name='challenge';args=[selected.id,f.evidence_url,f.evidence_hash];}
 await execute(name,args,value);if(!busy)$('#dialog').close();}catch(e){say(e.message);}};
async function execute(name,args,value){
 if(busy)return;
 if(!deployment.contract){say('Contract deployment is not yet configured.');return;}
 if(!account){say('Create and fund a test account first. The Studio account used for deployment remains in Studio.');return;}
 busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{say('Submitting '+name+' to GenLayer…');const tx=await client.writeContract({address:deployment.contract,functionName:name,args,value,leaderOnly:false});say('Transaction submitted: '+tx+'. Waiting for finalized consensus…');
 const receipt=await client.waitForTransactionReceipt({hash:tx,status:TransactionStatus.FINALIZED,interval:4000,retries:90});
 const consensus=receipt.result_name??receipt.resultName;
 const leader=receipt.consensus_data?.leader_receipt?.[0];
 if((consensus && !['MAJORITY_AGREE','SUCCESS'].includes(consensus)) || (leader?.execution_result && leader.execution_result!=='SUCCESS'))throw Error('Transaction failed; inspect '+tx+' in Studio.');
 say('Finalized transaction: '+tx);await refresh();
 }catch(e){say('Transaction did not complete: '+e.message);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
$('#refresh').onclick=refresh;$('#filter').onchange=board;$('#prev').onclick=()=>{offset=Math.max(0,offset-10);refresh();};$('#next').onclick=()=>{offset+=10;refresh();};
$('#contract').textContent=deployment.contract?'Studionet contract '+deployment.contract:'Awaiting deployment';
$('#proofLinks').innerHTML=(deployment.contract?safeLink('https://studio.genlayer.com/?import-contract='+deployment.contract,'Open deployed contract in Studio'):'')+safeLink('https://github.com/haris4587/AccessPatch/blob/main/docs/live-test.json','Transaction records & live test')+safeLink('/fixtures/before.html','Synthetic original page')+safeLink('/fixtures/after.html','Synthetic repaired page');
// Source-level WebMCP read tool. Transactions remain explicit user actions.
if(navigator.modelContext?.registerTool)navigator.modelContext.registerTool({name:'accesspatch_list_bounties',description:'Read finalized AccessPatch bounties from Studionet.',inputSchema:{type:'object',properties:{}},execute:async()=>({content:[{type:'text',text:JSON.stringify(rows)}]})});
await refresh();
