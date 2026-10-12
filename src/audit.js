import {abi} from 'genlayer-js';
// Shared browser/Node verifier. Imported bundles are untrusted data, never executable HTML.
export const BUNDLE_SCHEMA = 'accesspatch-audit-v1';
export const MAX_BUNDLE_BYTES = 500000;
const address = /^0x[0-9a-fA-F]{40}$/;
const digest = /^[0-9a-f]{64}$/;
const txHash = /^0x[0-9a-fA-F]{64}$/;
const encoder = new TextEncoder();
const fail = message => { throw new Error(message); };
export async function sha256(text) {
  if (typeof text !== 'string') fail('Expected UTF-8 text');
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function parseBundle(text) {
  if (typeof text !== 'string' || encoder.encode(text).length > MAX_BUNDLE_BYTES) fail('Bundle exceeds 500 KB');
  return JSON.parse(text);
}
function sameAddress(a, b) { return address.test(a ?? '') && address.test(b ?? '') && a.toLowerCase() === b.toLowerCase(); }
function validAmount(value) { return typeof value === 'string' && /^[1-9][0-9]*$/.test(value); }
export async function verifyBundle(bundle, trusted) {
  if (!bundle || bundle.schema !== BUNDLE_SCHEMA) fail('Unsupported audit bundle schema');
  if (encoder.encode(JSON.stringify(bundle)).length > MAX_BUNDLE_BYTES) fail('Bundle exceeds 500 KB');
  if (bundle.chain_id !== trusted.chain_id || !sameAddress(bundle.contract, trusted.contract)) fail('Bundle belongs to a different chain or contract');
  if (!digest.test(bundle.source_sha256 ?? '') || bundle.source_sha256 !== trusted.source_sha256) fail('Contract source digest does not match the configured release');
  const b = bundle.bounty, e = bundle.evidence;
  if (!b || !Number.isSafeInteger(b.id) || b.id < 0 || !e || !validAmount(b.reward_wei) || !address.test(b.sponsor ?? '') || !Array.isArray(b.history)) fail('Invalid bounty record');
  if (!['OPEN', 'INCONCLUSIVE', 'REVIEW', 'PAID', 'REFUNDED'].includes(b.status)) fail('Invalid bounty status');
  const snapshots = [{name: 'baseline', expected: b.baseline_hash}];
  if (b.candidate) {
    if (!address.test(b.candidate.fixer ?? '')) fail('Invalid candidate fixer');
    snapshots.push({name: 'page', expected: b.candidate.page_hash}, {name: 'report', expected: b.candidate.report_hash});
    if (b.candidate.counter) snapshots.push({name: 'counter', expected: b.candidate.counter.hash});
    else if (e.counter !== null) fail('Unexpected counter-evidence');
  } else if (e.page !== null || e.report !== null || e.counter !== null) fail('Snapshots do not match the empty candidate');
  for (const item of snapshots) {
    const text = e[item.name];
    if (typeof text !== 'string' || encoder.encode(text).length > 60000 || !digest.test(item.expected ?? '')) fail('Invalid ' + item.name + ' snapshot');
    item.actual = await sha256(text);
    item.bytes = encoder.encode(text).length;
    if (item.actual !== item.expected) fail(item.name + ' snapshot digest mismatch');
  }
  const terminal = ['PAID', 'REFUNDED'].includes(b.status);
  if (['PAID', 'REVIEW', 'INCONCLUSIVE'].includes(b.status) && !b.candidate) fail('Status requires a candidate');
  if (b.status === 'OPEN' && b.candidate) fail('Open bounty cannot have a candidate');
  if (terminal) {
    const recipient = b.status === 'PAID' ? b.candidate.fixer : b.sponsor;
    const type = b.status === 'PAID' ? 'REWARD' : 'REFUND';
    if (!b.payment || b.payment.type !== type || b.payment.amount_wei !== b.reward_wei || !sameAddress(b.payment.recipient, recipient)) fail('Payment does not match the authenticated beneficiary and reward');
  } else if (b.payment !== null) fail('Nonterminal bounty cannot have a payment');
  if (!Array.isArray(bundle.transfers) || bundle.transfers.length > 1) fail('Expected at most one transfer');
  for (const transfer of bundle.transfers) {
    const s = transfer.settlement, t = transfer.credit;
    if (!terminal || !s || !t || !txHash.test(s.hash ?? '') || !txHash.test(t.hash ?? '') || s.hash.toLowerCase() === t.hash.toLowerCase()) fail('Invalid transfer evidence');
    if (s.method !== (b.status === 'PAID' ? 'settle' : 'refund') || s.bounty_id !== String(b.id)) fail('Settlement call belongs to a different bounty or action');
    if (s.status !== 'FINALIZED' || s.execution !== 'SUCCESS' || !sameAddress(s.to, bundle.contract) || !Array.isArray(s.triggered) || !s.triggered.some(h => typeof h === 'string' && h.toLowerCase() === t.hash.toLowerCase())) fail('Transfer is not linked to a finalized successful contract call');
    if (t.status !== 'FINALIZED' || t.value_credited !== true || !sameAddress(t.from, bundle.contract) || !sameAddress(t.to, b.payment.recipient) || t.value_wei !== b.payment.amount_wei) fail('Transfer is not a matching finalized credit');
  }
  return {mode: 'offline', bounty_id: b.id, status: b.status, snapshots, transfer_evidence: bundle.transfers.length ? 'internally-consistent' : 'not-included', note: 'Offline checks prove internal consistency only. Recheck on GenLayer to authenticate state and payment.'};
}
export async function readPair(client, contract, id, variant) {
  const read = functionName => client.readContract({address: contract, functionName, args: [id], transactionHashVariant: variant});
  const bounty = JSON.parse(await read('get_bounty'));
  const evidence = JSON.parse(await read('get_evidence'));
  const after = JSON.parse(await read('get_bounty'));
  if (canonical(bounty) !== canonical(after)) fail('Bounty changed during export; refresh and retry');
  return {bounty, evidence};
}
function normalizeSettlement(r, hash) {
  const raw = r.data?.calldata?.raw;
  if (!Array.isArray(raw) || !raw.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) fail('Settlement calldata unavailable');
  const call = abi.calldata.decode(Uint8Array.from(raw));
  const method = call instanceof Map ? call.get('method') : null;
  const args = call instanceof Map ? call.get('args') : null;
  if (!Array.isArray(args) || args.length !== 1 || typeof args[0] !== 'bigint' || args[0] < 0n) fail('Unexpected settlement calldata');
  return {hash, method, bounty_id: args[0].toString(), status: r.statusName, execution: r.consensus_data?.leader_receipt?.[0]?.execution_result, to: r.to_address, triggered: r.triggered_transactions ?? []};
}
function normalizeCredit(r, hash) {
  return {hash, status: r.statusName, from: r.from_address, to: r.to_address, value_wei: String(r.value), value_credited: r.value_credited};
}
export async function readTransfer(client, hash) {
  if (!txHash.test(hash ?? '')) fail('Use a full settlement or refund transaction hash');
  const receipt = await client.getTransaction({hash});
  const links = receipt.triggered_transactions ?? [];
  if (links.length !== 1 || !txHash.test(links[0])) fail('Expected one outgoing transfer from this settlement/refund');
  return {settlement: normalizeSettlement(receipt, hash), credit: normalizeCredit(await client.getTransaction({hash: links[0]}), links[0])};
}
export async function exportBundle(client, trusted, id, variant, settlementHash) {
  if (await client.getChainId() !== trusted.chain_id) fail('Connected to the wrong chain');
  const source = await sha256(await client.getContractCode(trusted.contract));
  if (source !== trusted.source_sha256) fail('Deployed source does not match the configured release');
  const pair = await readPair(client, trusted.contract, id, variant);
  const bundle = {schema: BUNDLE_SCHEMA, chain_id: trusted.chain_id, contract: trusted.contract, source_sha256: source, exported_at: new Date().toISOString(), ...pair, transfers: settlementHash ? [await readTransfer(client, settlementHash)] : []};
  await verifyBundle(bundle, trusted);
  return bundle;
}
export async function verifyOnline(bundle, client, trusted, variant) {
  const result = await verifyBundle(bundle, trusted);
  if (await client.getChainId() !== trusted.chain_id) fail('Connected to the wrong chain');
  if (await sha256(await client.getContractCode(trusted.contract)) !== trusted.source_sha256) fail('Live contract source mismatch');
  const pair = await readPair(client, trusted.contract, bundle.bounty.id, variant);
  if (canonical(pair.bounty) !== canonical(bundle.bounty) || canonical(pair.evidence) !== canonical(bundle.evidence)) fail('Bundle differs from current finalized state; export again');
  for (const t of bundle.transfers) {
    const actual = await readTransfer(client, t.settlement.hash);
    if (canonical(actual) !== canonical(t)) fail('Imported transfer evidence differs from GenLayer');
  }
  return {...result, mode: 'online', authenticated_state: true, payment_credited: bundle.transfers.length ? true : null, note: bundle.transfers.length ? 'State, source, snapshots and credited transfer independently rechecked on GenLayer.' : 'State, source and snapshots rechecked. No transfer supplied; payment credit is unverified.'};
}
