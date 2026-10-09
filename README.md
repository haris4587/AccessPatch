# AccessPatch

Accessibility repair bounties powered by a real GenLayer Intelligent Contract.

A sponsor commits a specific barrier, its acceptance criteria, an original page, an authorized repaired-page URL, a deadline, a challenge window, and a funded sandbox GEN reward. A fixer submits a public report and exact repair/report SHA-256 digests. GenLayer independently fetches the evidence and judges whether the barrier is meaningfully resolved. Deterministic code controls escrow, deadlines, bounded challenges, retry limits, payouts, and refunds.

## Run

```sh
npm ci
npm test
npm run dev
npm run build
node scripts/read-live.mjs
```

The app reads `public/deployment.json`. Reads explicitly use `TransactionHashVariant.LATEST_FINAL`. Writes use genlayer-js 1.1.8, signed by a newly generated, faucet-funded **sandbox account in this browser session**. No external wallet connection is required. Deployment and the primary live test use GenLayer Studio's built-in account. Never send real funds to browser test accounts; closing the browser session removes the app's stored key.

## Contract lifecycle

1. `create_bounty(...)` is payable. It requires a positive reward, fetches a UTF-8 baseline with the declared `Response.status` API, and pins its HTML and digest. Deadline: 60 seconds–30 days. Challenge window: 30 seconds–7 days.
2. `commit_repair(bounty_id, commitment_hash)` binds a private, salted evidence commitment to the caller. Keep the repair/report private until this commitment is recorded. `submit_repair(bounty_id, report_url, page_hash, report_hash, salt)` reveals from the same caller after at least 60 transaction-time seconds and asks GenLayer to independently fetch and judge the repaired page and report. The repaired URL was fixed at creation. The report's assertion alone cannot prove a repair. NOT_RESOLVED leaves the bounty open; RESOLVED enters REVIEW; INCONCLUSIVE retains a nonexclusive candidate that anyone may immediately reopen or a valid new reveal may replace. Invalid/unavailable/digest-mismatched sources revert before installing a candidate.
3. `challenge(...)` accepts at most one challenge per candidate from a non-fixer before the review window closes. Counter-evidence must first be fetched and match its digest. The fetched counter-evidence is pinned; validators rejudge immutable repair/report snapshots. Only NOT_RESOLVED revokes the accepted candidate. INCONCLUSIVE records an unproven challenge and leaves REVIEW and its original settlement time intact.
4. `retry_review(...)` is candidate-fixer-only and permits at most three retries before the submission deadline. A newly resolved retry starts a fresh challenge window; it does not renew the bounty deadline or replenish a consumed challenge slot.
5. `settle(...)` is permissionless after the challenge window. It records a terminal PAID state and emits an EOA transfer using the consensus-approved snapshots. Later sponsor-controlled URL edits, deletion, or outage cannot withhold the earned reward.
6. `refund(...)` is sponsor-only, after the deadline and any remaining candidate window, for OPEN or INCONCLUSIVE bounties. Terminal states cannot settle or refund twice.

Each fixer has at most ten reviewed submissions and twenty commitments per bounty. There is no attacker-exhaustible global submission cap. `reopen_bounty(...)` is permissionless for INCONCLUSIVE only, needs no URL fetch or participant consent, preserves consumed commitments and history, and never changes the deadline. New valid reveals can atomically replace unresolved candidates; REVIEW/PAID/REFUNDED candidates cannot be reopened. Commitments do not reserve or lock the bounty. Replacement resets the delay; a successfully judged reveal consumes its commitment, including NOT_RESOLVED outcomes. History is append-only. A baseline remains an immutable stored snapshot so that a website may intentionally be updated at the same URL. The sponsor specifies the authorized repair URL, including an explicitly authorized staging URL when appropriate.

## Why GenLayer is central

Hash equality cannot decide whether a new label describes the same feature, whether a repair removes the barrier or merely removes functionality, or whether the report overclaims what the markup proves. The Intelligent Contract performs that semantic judgment. At reveal, validators fetch sources under strict snapshot equality; its leader and each validator assess those consensus-pinned bytes; they compare the verdict and all decision-binding source digests. A JSON-shape-only validator is not used. Prose reasoning may differ; the payment decision and evidence must agree.

Pages and reports are untrusted prompt data. The prompt explicitly rejects instructions embedded in evidence and does not use LLM output for amounts, permissions, deadlines, or payment addresses. Missing, changed, oversized, non-UTF8, or malformed evidence fails closed.

## Scope and limitations

The current review supports barriers directly observable in fetched source HTML: explicit labels, names, semantic markup, and descriptive text. It cannot establish actual screen-reader output, keyboard interaction, or computed CSS contrast; those criteria must return INCONCLUSIVE. It is not a WCAG certification. Resources must be public HTTPS, return 200, and be at most 60 KB. At reveal, exact hashes are intentionally conservative. Once accepted, the reward purchases the assessed source snapshot, not perpetual website uptime. Before acceptance, changes can prevent verification; a fixer must reveal while the authorized URL exposes the committed bytes. This contract does not force a sponsor to publish a repair or prove ongoing runtime deployment.

The built-in host checks reject common private literals but are not a complete DNS/redirect defense; validator network egress controls remain necessary. An inconclusive challenge cannot delay an already resolved payment. A conclusive NOT_RESOLVED challenge can reopen the bounty. Sponsor-defined criteria remain subjective, and consensus can fail without changing state. EOA transfers are asynchronous; a PAID record proves a transfer was emitted, so also verify the transfer/balance evidence. Studionet is a sandbox with simulated GEN balances and may reset. The original live fixture pages are synthetic. The v2 steward repair test uses separate built-in Studio sponsor, fixer, and copying-attacker accounts. Synthetic fixtures were already public and demonstrate caller binding rather than authorship; real fixers must commit before publishing their work.

## Verification and submission

- `tests/test_access_patch.py`: 28 offline contract behavior tests plus one browser/Python commitment encoding test against the actual contract source with an explicitly labelled SDK double. These cover successful creation through transfer emission, the status API, changed/missing evidence, permissions, deadlines, caps, challenges, retries, and refunds. They are not a GenVM/LLM substitute.
- `scripts/read-live.mjs`: actual finalized state reads using the official JS SDK.
- `docs/live-test.json`: primary live deployment, transactions, consensus results and settlement evidence.
- `docs/fixture-hashes.json`: exact reproducible fixture digests.
- `docs/superseded-test.json`: earlier sandbox smoke-test state retained for transparency. Its reward amount was distorted by Studio's amount field; it is not the primary release test.
- `docs/submission.md`: copy-ready Project Explorer content and evidence links.
- `public/accesspatch-logo.png`: 512 × 512 submission logo.

## Verified official references

- [Networks and Studionet](https://docs.genlayer.com/developers/networks)
- [Value transfers](https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers)
- [Independent consensus validation](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle)
- [Transaction context](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context)
- [Declared web-response source](https://github.com/genlayerlabs/genvm/blob/main/runners/genlayer-py-std/src/genlayer/nondet/web.py) — uses `status`, despite some prose documentation examples showing `status_code`.

The release pins the exact runner supported by the active Studio: GenVM v0.2.16 / py-genlayer 1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6. Public main-branch examples currently use another runner; a schema compilation was verified against the deployed runtime.

## Fixer-bound commit/reveal (v2 steward repair)

The commitment is SHA-256 of compact, ASCII-escaped JSON:

```text
["accesspatch-repair-v2", chain_id_as_string, lowercase_contract_address,
 bounty_id_as_string, lowercase_fixer_address, report_url,
 page_sha256, report_sha256, secret_32_byte_hex_salt]
```

Use `src/commitment.js` for the browser/Node implementation. The contract derives the fixer from `gl.message.sender_address`, never a user-supplied payment address. It checks a sender-specific prior commitment, minimum age, exact preimage, and one-time consumption before fetching or judging evidence. Payment always goes to that authenticated candidate. Hash copying fails because changing the sender changes the preimage; a new commitment after a successful reveal cannot replace a REVIEW candidate. Domain binding prevents reuse across networks, contracts, and bounties. A secret random salt prevents an observer from guessing the private URL/digests from the public commitment.

Prepare the exact bytes and final report URL privately. Commit, retain the secret salt, wait for finalization and the 60-second minimum age, publish the exact bytes, and reveal from the same account before the bounty deadline. The app stores this draft and salt only in the current browser session. Closing it before reveal loses the secret; create a fresh commitment if necessary. Public evidence that existed before commitment is not proof of original authorship, and unrelated prior commitments are not a global ownership registry.

Focused regression: `test_copied_valid_submission_cannot_redirect_reward` in `tests/test_access_patch.py`. It rejects a second address copying the commitment and complete reveal, preserves the legitimate commitment and state, rejects another copy after reveal, and proves that permissionless settlement pays the original fixer only. Additional tests cover missing/early commitments, altered URL/digests/salt, replay after rejection, replacement delay, domain binding, and Unicode encoding parity.

## Recovery and sponsor-veto repair (v3)

The October 9 steward regression fixes invalid evidence occupying the sole candidate, retry exhaustion requiring sponsor cooperation, and source mutation suppressing settlement. The app exposes **Reopen bounty**, unresolved-slot replacement, and **View reviewed snapshots** (`get_evidence`). Invalid fetch/digest preflight is distinct from semantic INCONCLUSIVE: the first reverts; the second may be immediately reopened by anyone or replaced by a valid reveal. Three retries are optional, not a recovery prerequisite.

Adversarial regressions prove invalid-hash rejection followed by legitimate payout, recovery after three retries, automatic replacement, per-fixer caps after ten malicious attempts, no reopening accepted/paid candidates, no retry consumption by strangers, inconclusive challenges preserving REVIEW, and settlement despite all sponsor URLs being changed/deleted. All use the actual contract source and an explicit SDK double; real GenVM transactions are separate evidence. Commit/reveal caller and domain protections remain intact.
