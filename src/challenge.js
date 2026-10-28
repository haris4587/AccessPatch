import {canonical, sha256, verifyBundle, verifyOnline} from './audit.js';
import {validateEvidenceUrl} from './prepare.js';

export const CHALLENGE_SCHEMA = 'accesspatch-challenge-v3';
export const MAX_CHALLENGE_BYTES = 750000;
export const CHALLENGE_SCOPE = 'Reviewer allegations anchored to immutable reviewed snapshots. Quotes prove only what the pinned source says; they do not prove runtime behavior, a successful challenge, or a WCAG violation. Later website drift cannot revoke a snapshot-based reward. GenLayer independently judges counter-evidence.';
const enc = new TextEncoder();
const fail = message => { throw Error(message); };
function bounded(text, max, label) {
  if (typeof text !== 'string' || !text.trim() || enc.encode(text).length > max) fail(label + ' must be nonempty and at most ' + max + ' UTF-8 bytes');
}
export function challengeBinding(audit) {
  const b = audit.bounty, c = b.candidate;
  if (!c) fail('A reviewed candidate is required');
  if (!Number.isSafeInteger(c.settle_after) || c.settle_after < 0 || typeof c.challenge_used !== 'boolean') fail('Invalid candidate challenge window');
  return {chain_id:audit.chain_id, contract:audit.contract.toLowerCase(), source_sha256:audit.source_sha256,
    bounty_id:b.id, barrier:b.barrier, criteria:b.criteria, baseline_hash:b.baseline_hash,
    candidate:{fixer:c.fixer.toLowerCase(), commitment_hash:c.commitment_hash, page_hash:c.page_hash,
      report_hash:c.report_hash, settle_after:c.settle_after}};
}
export async function prepareChallenge(audit, allegations, trusted) {
  await verifyBundle(audit, trusted);
  const binding = challengeBinding(audit);
  if (!Array.isArray(allegations) || allegations.length < 1 || allegations.length > 8) fail('Use between 1 and 8 evidence citations');
  const citations = allegations.map((item, index) => {
    if (!item || canonical(Object.keys(item).sort()) !== canonical(['source','quote','explanation'].sort())) fail('Unexpected citation fields');
    if (!['baseline','page','report'].includes(item.source)) fail('Cite baseline, page, or report snapshots only');
    bounded(item.quote, 1200, 'Quote'); bounded(item.explanation, 1500, 'Explanation');
    const text = audit.evidence[item.source];
    const start = text.indexOf(item.quote);
    if (start < 0) fail('Citation ' + (index+1) + ' does not occur verbatim in the pinned ' + item.source + ' snapshot');
    const occurrences = text.split(item.quote).length - 1;
    return {...item, first_offset_utf16:start, first_line:text.slice(0,start).split('\n').length, occurrences,
      snapshot_sha256:item.source==='baseline'?binding.baseline_hash:binding.candidate[item.source+'_hash']};
  });
  const report = JSON.stringify({format:'AccessPatch counter-evidence report v3',scope:CHALLENGE_SCOPE,binding,citations},null,2)+'\n';
  if (enc.encode(report).length > 60000) fail('Counter-evidence report exceeds the contract 60 KB limit');
  const result = {schema:CHALLENGE_SCHEMA,audit,allegations,binding,citations,report,evidence_hash:await sha256(report)};
  if (enc.encode(JSON.stringify(result)).length > MAX_CHALLENGE_BYTES) fail('Challenge package exceeds 750 KB');
  return result;
}
export function parseChallenge(text) {
  if (typeof text !== 'string' || enc.encode(text).length > MAX_CHALLENGE_BYTES) fail('Challenge package exceeds 750 KB');
  return JSON.parse(text);
}
export async function verifyChallenge(p, trusted) {
  if (!p || p.schema !== CHALLENGE_SCHEMA) fail('Unsupported challenge package');
  if (enc.encode(JSON.stringify(p)).length > MAX_CHALLENGE_BYTES) fail('Challenge package exceeds 750 KB');
  const expected = await prepareChallenge(p.audit,p.allegations,trusted);
  if (canonical(p) !== canonical(expected)) fail('Challenge differs from recomputed citations, binding, report, or hash');
  return {mode:'offline',internally_consistent:true,bounty_id:p.binding.bounty_id,citations:p.citations.length,evidence_hash:p.evidence_hash,
    note:'Offline consistency only. Authenticate against current GenLayer state before using the challenge form.'};
}
export async function authenticateChallenge(p, client, trusted, variant) {
  await verifyChallenge(p,trusted);
  await verifyOnline(p.audit,client,trusted,variant);
  return {mode:'online',authenticated_state:true,bounty_id:p.binding.bounty_id,status:p.audit.bounty.status,evidence_hash:p.evidence_hash,
    note:'Candidate and reviewed snapshots authenticated. Reviewer claims have not been accepted by GenLayer.'};
}
export function assertCanChallenge(p, bounty, challenger, now = Math.floor(Date.now()/1000)) {
  if (!Number.isSafeInteger(now) || now < 0) fail('Invalid challenge time');
  if (!bounty || bounty.status !== 'REVIEW' || !bounty.candidate) fail('Challenge requires an active REVIEW candidate');
  if (!/^0x[0-9a-fA-F]{40}$/.test(challenger || '')) fail('Create a sandbox account before opening the challenge form');
  const current = challengeBinding({...p.audit,bounty});
  if (canonical(current) !== canonical(p.binding)) fail('Candidate or locked bounty context changed; prepare a new challenge');
  if (bounty.candidate.challenge_used) fail('This candidate has already used its one challenge');
  if (challenger.toLowerCase() === bounty.candidate.fixer.toLowerCase()) fail('A fixer cannot challenge their own candidate');
  if (now >= bounty.candidate.settle_after) fail('Challenge window is closed');
  return {remaining_seconds:bounty.candidate.settle_after-now};
}
export function challengeArguments(p, url) {
  validateEvidenceUrl(url);
  return [p.binding.bounty_id,url,p.evidence_hash];
}

export async function validateChallengeSubmission(p, expectedUrl, url, hash, client, trusted, variant, challenger) {
  if (url !== expectedUrl || hash !== p.evidence_hash) fail('Prepared challenge fields changed; reopen from Challenge Review Studio');
  await authenticateChallenge(p,client,trusted,variant);
  assertCanChallenge(p,p.audit.bounty,challenger);
  return challengeArguments(p,url);
}
