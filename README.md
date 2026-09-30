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
2. `submit_repair(...)` commits two digests and asks GenLayer to independently fetch and judge the repaired page and report. The repaired URL was fixed at creation. The report's assertion alone cannot prove a repair. NOT_RESOLVED leaves the bounty open; RESOLVED enters REVIEW; INCONCLUSIVE holds a bounded candidate.
3. `challenge(...)` accepts at most one challenge per candidate from a non-fixer before the review window closes. Counter-evidence must first be fetched and match its digest. Validators then refetch all sources and rejudge. A rejected candidate reopens the bounty.
4. `retry_review(...)` permits at most three retries before the submission deadline. A newly resolved retry starts a fresh challenge window; it does not renew the bounty deadline or replenish a consumed challenge slot.
5. `settle(...)` is permissionless after the challenge window. It rechecks repair/report digests, records a terminal PAID state, and emits an EOA transfer on finalization. Changed evidence cannot be paid.
6. `refund(...)` is sponsor-only, after the deadline and any remaining candidate window, for OPEN or INCONCLUSIVE bounties. Terminal states cannot settle or refund twice.

Each bounty allows at most ten submissions. History is append-only. A baseline remains an immutable stored snapshot so that a website may intentionally be updated at the same URL. The sponsor specifies the authorized repair URL, including an explicitly authorized staging URL when appropriate.

## Why GenLayer is central

Hash equality cannot decide whether a new label describes the same feature, whether a repair removes the barrier or merely removes functionality, or whether the report overclaims what the markup proves. The Intelligent Contract performs that semantic judgment. Its leader and each validator independently fetch the sources and call an assessor; they compare the verdict and all decision-binding source digests. A JSON-shape-only validator is not used. Prose reasoning may differ; the payment decision and evidence must agree.

Pages and reports are untrusted prompt data. The prompt explicitly rejects instructions embedded in evidence and does not use LLM output for amounts, permissions, deadlines, or payment addresses. Missing, changed, oversized, non-UTF8, or malformed evidence fails closed.

## Scope and limitations

The current review supports barriers directly observable in fetched source HTML: explicit labels, names, semantic markup, and descriptive text. It cannot establish actual screen-reader output, keyboard interaction, or computed CSS contrast; those criteria must return INCONCLUSIVE. It is not a WCAG certification. Resources must be public HTTPS, return 200, and be at most 60 KB. Exact hashes are intentionally conservative: even harmless evidence changes require a new submission or an eventual refund.

The built-in host checks reject common private literals but are not a complete DNS/redirect defense; validator network egress controls remain necessary. Open, cost-free challenges can produce a legitimate inconclusive result and delay payout. Sponsor-defined criteria remain subjective, and consensus can fail without changing state. EOA transfers are asynchronous; a PAID record proves a transfer was emitted, so also verify the transfer/balance evidence. Studionet is a sandbox with simulated GEN balances and may reset. The live fixture pages are synthetic, and sponsor/fixer share the built-in account in the primary smoke test; role separation and adversarial cases are covered by offline tests.

## Verification and submission

- `tests/test_access_patch.py`: 16 offline behavior tests against the actual contract source with an explicitly labelled SDK double. These cover successful creation through transfer emission, the status API, changed/missing evidence, permissions, deadlines, caps, challenges, retries, and refunds. They are not a GenVM/LLM substitute.
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
