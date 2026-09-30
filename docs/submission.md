# AccessPatch — Project Explorer submission

**Application date:** 09/30/2026  
**Contribution type:** Builder → Projects Project  
**Project name:** AccessPatch  
**Logo:** `public/accesspatch-logo.png` (512 × 512 PNG)  
**Primary tag:** AI & Agents  
**Suggested focus tags:** Accessibility; Public Goods (select the closest available portal options)

## One-liner

Evidence-bound accessibility repair bounties with GenLayer review, challenges, and escrowed rewards.

## Description

AccessPatch turns specific website accessibility barriers into funded repair bounties. A sponsor commits the original page, the authorized repair URL, acceptance criteria, deadline, challenge window, and a reward. The Intelligent Contract fetches and pins the original source. A fixer submits a public report plus exact page/report digests. GenLayer's leader and validators independently fetch the repaired page and report, then judge whether the same feature remains and the committed barrier is meaningfully resolved.

Deterministic contract rules enforce permissions, ten-submission and three-retry caps, one bounded challenge per candidate, evidence integrity, reward settlement, and sponsor refunds. A resolved repair waits through its challenge window; settlement rechecks the committed evidence before emitting the escrowed reward to the fixer. Missing, changed or insufficient evidence produces an explicit inconclusive outcome.

The app performs signed sandbox-account write transactions and explicitly finalized-state reads. It includes sponsoring, evidence submission, challenge, retry, settlement, refund, and append-only decision-history views. No external wallet connection is needed for the Studio deployment or live test.

Current scope is source-HTML accessibility: meaningful labels, accessible names, semantics, and descriptive text. It does not certify overall WCAG compliance or claim to verify runtime keyboard behavior, actual screen-reader output, or computed contrast. The primary live test uses explicitly synthetic before/after pages and a 1 GEN sandbox reward. Studionet balances are simulated and have no monetary value.

## Why GenLayer

Hash checks cannot judge whether a label is meaningful for the same control, whether a fix preserves the feature, or whether evidence overclaims the repair. GenLayer's semantic review is central to accepting a repair. Validators re-fetch evidence and independently recompute the verdict; they compare verdict and all decision-binding hashes, while deterministic code owns funds and lifecycle rules.

## Evidence

- Public app: https://accesspatch.itzanza2.chatgpt.site
- Repository: https://github.com/haris4587/AccessPatch
- Deployed release contract: https://explorer-studio.genlayer.com/address/0x52a73B7209e03dDa55296dEd56Fb3579aCa273a8
- Open in Studio: https://studio.genlayer.com/?import-contract=0x52a73B7209e03dDa55296dEd56Fb3579aCa273a8
- Contract source: https://github.com/haris4587/AccessPatch/blob/main/contracts/access_patch.py
- Passing behavior tests: https://github.com/haris4587/AccessPatch/blob/main/tests/test_access_patch.py
- Live execution, finalized state, and payout record: https://github.com/haris4587/AccessPatch/blob/main/docs/live-test.json
- Explorer screenshot: https://github.com/haris4587/AccessPatch/blob/main/docs/accesspatch-live-proof.jpg
- Finalized reward transfer: https://explorer-studio.genlayer.com/address/0x52a73B7209e03dDa55296dEd56Fb3579aCa273a8
- Reproducible live verifier: https://github.com/haris4587/AccessPatch/blob/main/scripts/verify-release.mjs
- Synthetic original: https://raw.githubusercontent.com/haris4587/AccessPatch/b885358d4e9822c80cd0f2f08a4263cd85069d1d/public/fixtures/before.html
- Synthetic repair: https://raw.githubusercontent.com/haris4587/AccessPatch/b885358d4e9822c80cd0f2f08a4263cd85069d1d/public/fixtures/after.html
- Evidence report: https://raw.githubusercontent.com/haris4587/AccessPatch/b885358d4e9822c80cd0f2f08a4263cd85069d1d/public/fixtures/report.txt

## Review notes

The contract compiled against the active GenVM runner. Sixteen offline behavior tests and the app production build pass. Offline tests use a clearly labelled SDK double and are supplemented by real, full-consensus Studio transactions; they do not claim to be a GenVM/LLM simulation. The primary smoke test uses the same built-in Studio address as sponsor and fixer; role separation is covered by offline tests. Earlier sandbox testing is retained separately and is not presented as the primary 1 GEN test. Portal submission is a separate action; this file prepares the content and evidence to submit.
