import {parse} from 'parse5';
import {canonical, sha256, verifyBundle, verifyOnline} from './audit.js';

export const PREP_SCHEMA = 'accesspatch-preparation-v2';
export const ENGINE = 'source-preflight-1';
export const MAX_SOURCE = 60000, MAX_PACKAGE = 350000;
const enc = new TextEncoder();
const fail = message => { throw new Error(message); };
export const SCOPE = 'Source HTML checks only; not a browser accessibility audit, WCAG certification, proof of runtime behavior, or GenLayer verdict. Names are declared markup, not computed accessible names. CSS, scripts, shadow DOM and assistive technology require separate testing.';
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const tidy = text => text.replace(/\s+/g, ' ').trim();
const inputType = n => (attr(n, 'type') || 'text').toLowerCase();
const isControl = n => ['select','textarea'].includes(n.tagName) || n.tagName === 'input' && !['hidden','button','submit','reset','image'].includes(inputType(n));
function textOf(node) {
  // An iterative walk bounds hostile nesting and excludes non-label source content.
  const stack = [node], parts = [];
  while (stack.length) {
    const n = stack.pop();
    if (['script','style','template','noscript','input','select','textarea'].includes(n.tagName) || attr(n,'hidden') !== undefined || attr(n,'aria-hidden') === 'true') continue;
    if (n.nodeName === '#text') parts.push(n.value);
    else stack.push(...(n.childNodes || []).slice().reverse());
  }
  return tidy(parts.join(' '));
}
function source(text) {
  if (typeof text !== 'string' || !text.trim().length || enc.encode(text).length > MAX_SOURCE) fail('Each HTML source must be nonempty and at most 60,000 UTF-8 bytes');
}
export function scanSource(html) {
  source(html);
  const doc = parse(html, {sourceCodeLocationInfo:true, scriptingEnabled:true});
  const nodes = [], stack = [doc];
  while (stack.length) {
    const n = stack.pop();
    if (n.tagName) nodes.push(n);
    if (nodes.length > 1500) fail('Source exceeds 1,500 elements');
    // Template content is inert and intentionally not treated as rendered markup.
    stack.push(...(n.childNodes || []).slice().reverse());
  }
  const ids = new Map();
  for (const n of nodes) { const id = attr(n,'id'); if (id) ids.set(id,[...(ids.get(id)||[]),n]); }
  const controls = nodes.filter(isControl), labels = nodes.filter(n => n.tagName === 'label');
  const rows = [];
  const locate = n => ({tag:n.tagName,id:attr(n,'id') || null,line:n.sourceCodeLocation?.startLine || null});
  const keyFor = n => attr(n,'id') && ids.get(attr(n,'id')).length === 1 ? 'id:'+attr(n,'id') : n.tagName+':'+nodes.indexOf(n);
  const add = (rule,n,ok,detail) => rows.push({key:rule+':'+keyFor(n),rule,...locate(n),result:ok?'present':'needs_review',detail});
  for (const n of controls) {
    const id = attr(n,'id');
    let name = '', method = '';
    const refs = tidy(attr(n,'aria-labelledby') || '').split(' ').filter(Boolean);
    if (refs.length) {
      const resolved = refs.map(ref => ids.get(ref));
      if (resolved.every(matches => matches?.length === 1 && textOf(matches[0]))) {
        name = resolved.map(matches => textOf(matches[0])).join(' '); method = 'aria-labelledby';
      } else method = 'aria-labelledby has missing, duplicate, or empty references; manual review required';
    } else if (tidy(attr(n,'aria-label') || '')) {
      name = tidy(attr(n,'aria-label')); method = 'aria-label';
    } else if (id && ids.get(id).length === 1) {
      const linked = labels.filter(l => attr(l,'for') === id).map(textOf).filter(Boolean);
      if (linked.length) {name = linked.join(' '); method = 'label for/id';}
    }
    if (!name && !refs.length) {
      for (let p=n.parentNode;p;p=p.parentNode) {
        if (p.tagName !== 'label') continue;
        const descendants=controls.filter(c=>{for(let q=c.parentNode;q;q=q.parentNode)if(q===p)return true;return false;});
        const target=attr(p,'for');
        if (descendants.length===1 && (target===undefined || target===id) && textOf(p)) {name=textOf(p);method='wrapping label';}
        break;
      }
    }
    // Duplicate control IDs are ambiguous even if a label appears to match.
    if (id && ids.get(id).length > 1) {name='';method='duplicate control ID';}
    add('control-label',n,!!name,name ? method+': '+name.slice(0,180) : method || 'No supported explicit name declaration. Placeholder/title are not accepted by this limited check.');
  }
  for (const n of nodes.filter(n=>n.tagName==='img')) add('image-alt',n,attr(n,'alt')!==undefined,attr(n,'alt')===undefined?'Missing alt attribute':attr(n,'alt')===''?'Empty alt: decorative intent requires human review':'Alt text declared; quality is not assessed');
  for (const [id,matches] of ids) if (matches.length>1) for (const n of matches) add('unique-id',n,false,'Duplicate ID: '+id.slice(0,180));
  const root=nodes.find(n=>n.tagName==='html'), title=nodes.find(n=>n.tagName==='title');
  let language=false;try {language=!!attr(root,'lang') && Intl.getCanonicalLocales(attr(root,'lang')).length===1;} catch { /* invalid language tag */ }
  add('document-language',root,language,language?'Language tag declared':'Missing or invalid language tag');
  add('document-title',title || root,!!title && !!textOf(title),title && textOf(title)?'Title text declared':'Missing or empty document title');
  const tracked=controls.filter(n=>attr(n,'id')&&ids.get(attr(n,'id')).length===1).map(n=>({id:attr(n,'id'),tag:n.tagName,type:n.tagName==='input'?inputType(n):n.tagName}));
  return {checks:rows,counts:{elements:nodes.length,controls:controls.length,untracked_controls:controls.length-tracked.length,needs_review:rows.filter(r=>r.result==='needs_review').length},tracked_controls:tracked,runtime_content:nodes.some(n=>['script','iframe','object','embed','template','style','link'].includes(n.tagName))};
}
export function compareSources(original,repair) {
  const before=scanSource(original),after=scanSource(repair);
  const a=new Map(after.checks.map(r=>[r.key,r])),b=new Map(before.checks.map(r=>[r.key,r]));
  const fixed=before.checks.filter(r=>r.result==='needs_review'&&a.get(r.key)?.result==='present').map(r=>r.key);
  const new_findings=after.checks.filter(r=>r.result==='needs_review'&&b.get(r.key)?.result!=='needs_review').map(r=>r.key);
  const removed_controls=before.tracked_controls.filter(n=>!after.tracked_controls.some(m=>m.id===n.id));
  const changed_controls=before.tracked_controls.filter(n=>after.tracked_controls.some(m=>m.id===n.id&&(m.tag!==n.tag||m.type!==n.type)));
  const manual=after.counts.needs_review || removed_controls.length || changed_controls.length || before.counts.untracked_controls || after.counts.untracked_controls;
  return {before,after,fixed,new_findings,removed_controls,changed_controls,summary:manual?'MANUAL_REVIEW_REQUIRED':'DECLARED_SOURCE_CHECKS_CLEAR'};
}
export function validateEvidenceUrl(raw) {
  if(typeof raw!=='string'||!raw.startsWith('https://')||raw.length>500||raw.includes('@')||raw.includes('#'))fail('Use a public HTTPS URL without credentials or fragments (maximum 500 characters)');
  let u;try{u=new URL(raw);}catch{fail('Invalid evidence URL');}
  const host=u.hostname.toLowerCase();
  if(!host.includes('.')||host.startsWith('127.')||host.startsWith('10.')||host.startsWith('192.168.')||host.startsWith('169.254.')||host==='metadata.google.internal')fail('Private hosts are not allowed');
  return raw;
}
function validContext(c,trusted) {
  const keys=['chain_id','contract','source_sha256','bounty_id','baseline_hash','barrier','criteria','repair_url','deadline'];
  if(!c||canonical(Object.keys(c).sort())!==canonical(keys.sort()))fail('Unexpected or missing bounty context fields');
  if (!c || c.chain_id!==trusted.chain_id || typeof c.contract!=='string' || c.contract.toLowerCase()!==trusted.contract.toLowerCase() || c.source_sha256!==trusted.source_sha256) fail('Preparation belongs to a different deployment');
  if (!Number.isSafeInteger(c.bounty_id)||c.bounty_id<0||!Number.isSafeInteger(c.deadline)||c.deadline<0||!/^[0-9a-f]{64}$/.test(c.baseline_hash)) fail('Invalid bounty binding');
  for (const name of ['barrier','criteria','repair_url']) if (typeof c[name]!=='string'||!c[name].length||c[name].length>2000) fail('Invalid bounty '+name);
  validateEvidenceUrl(c.repair_url);
}
export function contextFromAudit(audit) {
  const b=audit.bounty;
  return {chain_id:audit.chain_id,contract:audit.contract,source_sha256:audit.source_sha256,bounty_id:b.id,baseline_hash:b.baseline_hash,barrier:b.barrier,criteria:b.criteria,repair_url:b.repair_url,deadline:b.deadline};
}
export async function prepareRepair(context,original_html,repair_html,notes,trusted) {
  validContext(context,trusted);source(original_html);source(repair_html);
  if (typeof notes!=='string'||enc.encode(notes).length>1500)fail('Notes must be at most 1,500 UTF-8 bytes');
  if (await sha256(original_html)!==context.baseline_hash)fail('Original HTML does not match the bounty baseline');
  const page_hash=await sha256(repair_html),analysis=compareSources(original_html,repair_html);
  const report=JSON.stringify({format:'AccessPatch source repair report v2',engine:ENGINE,scope:SCOPE,binding:context,page_hash,notes,analysis},null,2)+'\n';
  if(enc.encode(report).length>MAX_SOURCE)fail('Generated report exceeds the contract 60,000-byte evidence limit; narrow the source');
  const result={schema:PREP_SCHEMA,engine:ENGINE,context,original_html,repair_html,notes,analysis,report,page_hash,report_hash:await sha256(report)};
  if(enc.encode(JSON.stringify(result)).length>MAX_PACKAGE)fail('Preparation exceeds 350 KB');
  return result;
}
export function parsePreparation(text) {
  if(typeof text!=='string'||enc.encode(text).length>MAX_PACKAGE)fail('Preparation exceeds 350 KB');
  return JSON.parse(text);
}
export async function verifyPreparation(p,trusted) {
  if(!p||p.schema!==PREP_SCHEMA||p.engine!==ENGINE)fail('Unsupported preparation version');
  if(enc.encode(JSON.stringify(p)).length>MAX_PACKAGE)fail('Preparation exceeds 350 KB');
  const expected=await prepareRepair(p.context,p.original_html,p.repair_html,p.notes,trusted);
  if(canonical(p)!==canonical(expected))fail('Preparation differs from recomputed analysis, report, or hashes');
  return {verified:true,mode:'offline',bounty_id:p.context.bounty_id,summary:p.analysis.summary,page_hash:p.page_hash,report_hash:p.report_hash,note:'Internal consistency only. Authenticate the locked context against GenLayer before commit.'};
}
export async function authenticatePreparation(p,audit,client,trusted,variant) {
  await verifyPreparation(p,trusted);await verifyBundle(audit,trusted);await verifyOnline(audit,client,trusted,variant);
  if(canonical(p.context)!==canonical(contextFromAudit(audit)))fail('Preparation does not match the authenticated bounty context');
  return {verified:true,mode:'online',authenticated_context:true,bounty_id:p.context.bounty_id,status:audit.bounty.status,summary:p.analysis.summary,note:'Locked context and baseline authenticated. Repair is locally prepared; it has not been approved by GenLayer.'};
}
export function assertCanCommit(p,bounty,now=Math.floor(Date.now()/1000)) {
  if(!bounty||bounty.id!==p.context.bounty_id||bounty.baseline_hash!==p.context.baseline_hash||bounty.criteria!==p.context.criteria||bounty.barrier!==p.context.barrier||bounty.repair_url!==p.context.repair_url||bounty.deadline!==p.context.deadline)fail('Bounty changed or does not match preparation');
  if(!['OPEN','INCONCLUSIVE'].includes(bounty.status)||now+60>=bounty.deadline)fail('Bounty is not open for repair commitments');
}
