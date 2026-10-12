# Milestone v1: Portable Evidence and Payment Audit Workbench

Accepted baseline: [`d4965c7d8abf17e77eae891bd15a7f778bd1ba52`](https://github.com/haris4587/AccessPatch/commit/d4965c7d8abf17e77eae891bd15a7f778bd1ba52), October 9, 2026. The user confirmed Project Explorer acceptance on October 12.

## What is new

The accepted v3 release provided snapshot viewing and a hard-coded release verifier. This milestone adds a reusable, wallet-free browser workbench and a standalone command-line interface for arbitrary bounty IDs on the configured deployment. Reviewers can export/import portable audit bundles rather than relying on a project-maintained screenshot or hand-written proof.

- **Export:** finalized bounty state, exact baseline/repair/report/counter snapshots, deployment source SHA-256, and optionally a linked settlement/refund plus outgoing credit receipt. Read the bounty before and after evidence to reject concurrent state changes. Independently recheck before exporting.
- **Local verification:** schema and 500 KB bundle cap; 60 KB per snapshot; exact UTF-8 SHA-256; chain, contract and source binding; terminal beneficiary and amount checks; finalized settlement-to-transfer linkage; credited transfer checks. Decode settlement calldata with the installed official SDK and require the correct bounty ID and settle/refund action.
- **Online authentication:** independently fetch current finalized state, evidence, deployed code, settlement, and outgoing transfer. Forging both evidence and its claimed hash can pass internal consistency, but fails this independent recheck.
- **Browser:** export JSON; load a recorded example; import and verify locally; recheck against GenLayer; inspect evidence only as text. No wallet required, imported HTML is never executed, and imported RPC endpoints are never used.
- **CLI:** the same verifier is used by `scripts/audit-bundle.mjs`. Export any bounty ID on the configured accepted deployment and verify offline or online.

The v3 contract, commit/reveal, candidate recovery, and sponsor-mutation payout fixes are existing accepted work. They are **not** newly built milestone features. No contract redeployment or new payout was performed for this milestone. Live checks use existing, labelled synthetic sandbox bounties; no traction or real-world adoption is claimed.

## Reviewer path

1. Visit https://accesspatch.itzanza2.chatgpt.site/#audit and choose **Load verified example**. The result says local consistency only.
2. Choose **Recheck imported bundle on GenLayer**. Expect `mode: online`, `authenticated_state: true`, `payment_credited: true`, PAID bounty #0, and matching hashes for baseline, page and report.
3. Export bounty #0 with settlement hash `0x1db49f53a167bcf4927bc2d8701c889ffa87179d9f072491a803c07e349985cb`. Import the downloaded JSON and repeat the independent check.
4. Alter the imported page text: local verification rejects its digest. If both text and claimed digest are changed, local consistency alone is insufficient; online state comparison rejects the forgery.
5. Inspect `docs/milestone-v1-verification.json` for the new read-only run, including bounty #1's refund and cross-bounty rejection. Earlier payout evidence stays in `docs/live-test.json`.

## Reproduce

```sh
npm ci
npm test
npm run build
node scripts/audit-bundle.mjs verify public/audit-example.json
node scripts/audit-bundle.mjs verify public/audit-example.json --online
node scripts/audit-bundle.mjs export /tmp/accesspatch-audit.json 0 0x1db49f53a167bcf4927bc2d8701c889ffa87179d9f072491a803c07e349985cb
node scripts/verify-milestone.mjs
```

32 existing contract/encoding tests + 30 new audit tests = 62 passing tests. Tests use doubles only where explicitly offline; the live report uses actual Studionet RPC through genlayer-js 1.1.8.

## Verification limits

A JSON package is not a signed state proof. Offline checks do not authenticate its origin. Online verification trusts the configured Studionet RPC and expected release identity, and rejects stale packages differing from current finalized state. No transfer hash means payment credit remains unverified even when state is authenticated. Studionet may reset. Browser interaction QA was unavailable in the supported environment; production build, shared-module adversarial tests, and live Node RPC checks were performed. Source HTML remains the contract's scope; this tooling does not establish runtime accessibility or WCAG certification.

## Submission fields

- Contribution type: Builder → Milestones
- Linked project: Access Patch (next v1)
- Contribution date: 10/12/2026
- Title: Portable Evidence and Payment Audit Workbench
- Change type: New functionality / integration (choose the closest offered label)

### Changes & Improvements (under 1,000 characters)

Added a portable audit workbench beyond the accepted v3 release. Reviewers can export finalized bounty state, reviewed snapshots, source identity, and linked transfer receipts; import JSON for local SHA-256 checks; then independently recheck state and credited payments on GenLayer. Settlement calldata binds each receipt to the correct bounty and action. The browser and Node CLI share the verifier. Imports enforce size limits and render evidence as plain text. Bundles exclude account keys and commitment salts.

Added 30 audit tests (62 total), covering altered snapshots, forged digests, redirected beneficiaries, wrong amounts, uncredited transfers, cross-bounty receipts, and concurrent state changes. Live read-only checks authenticated the existing paid and refunded bounties and rejected tampering. Published the workbench and documented the delta from accepted commit d4965c7. This milestone adds verification tooling; the accepted v3 contract and earlier recovery fixes are the baseline.
