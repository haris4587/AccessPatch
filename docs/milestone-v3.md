# Milestone v3 — Candidate-bound Challenge Review Studio

## New progress beyond milestone v2

The review baseline is `eb754fec5fd6cbfc3bfe917c0fa716241196d389`, the repository HEAD before this work. [Milestone v2](milestone-v2.md) already included the repair preparation engine; it is not counted again here. The contract's older internal `release: v3` label predates these portal milestones and is not a new deployment.

| Existing v2 | New portal milestone v3 |
| --- | --- |
| Fixer prepares new repair evidence | Reviewer prepares counter-evidence against the installed candidate |
| Form accepts manually authored challenge URL/hash | Citation editor anchors exact excerpts to baseline, reviewed page, or report |
| Repair page/report hashes | Recomputed counter-evidence report/hash and portable challenge package |
| Open-bounty commit checks | Current candidate, challenge deadline, fixer exclusion, and one-challenge checks |
| No dedicated challenge preparation CLI | Shared CLI create/replay and optional live authentication |

The new workflow makes the existing contract's challenge function usable with reproducible, candidate-bound evidence. It does not add a new contract method or change escrow rules.

## What changed

- **Challenge Review Studio** at `/#challenge`, plus an entry from REVIEW bounty details. It loads finalized state and exact reviewed snapshots; no live website substitution is used.
- Up to eight reviewer citations: select a pinned snapshot, paste an exact quote, and explain the alleged contradiction of locked acceptance criteria. Quotes must occur verbatim. The report records source hash, first UTF-16 offset, first line, and occurrence count so repeated excerpts are not presented as unique.
- Generate/download exact UTF-8 counter-evidence text and its SHA-256, plus an importable package. Import replays every citation, binding, report, and hash; altered and unknown fields fail verification. Snapshots are rendered using `textContent`, never as executable HTML.
- Authenticate chain ID, deployed source, current finalized bounty, and all pinned evidence before handoff. Candidate commitment, fixer, page/report hashes, deadline and locked criteria are bound to the report. Changed state requires a new package.
- Handoff checks REVIEW status, unexpired challenge window, unused challenge slot and a challenger distinct from the fixer. The explicit transaction submission repeats authentication/eligibility checks and uses the package's bounty ID, so changing the selected board row cannot retarget a prepared challenge. The contract remains authoritative at execution time.
- A shared **challenge-review CLI** creates/replays packages and optionally authenticates them using configured Studionet, with byte limits, strict UTF-8 decoding and exclusive output creation.
- Added 27 tests (149 total), including tampering, forged but recomputed criteria, chain/source mismatch, source races, boundary times, fixer exclusion, consumed slots, stale imports, exact form arguments, submission rechecks and browser event flows through a DOM double. Added GitHub Actions for the test suite and production build.
- Browser QA caught that an HTTP development preview lacks SubtleCrypto. The shared hash helper now falls back to the existing viem SHA-256 implementation; known vectors and exact Unicode/BOM/CRLF bytes are tested. Production HTTPS keeps WebCrypto.

## Contract preserved

- Address: `0x8acED57B7f0875A67D5A4CC56De48105949d7405`
- Existing contract link: https://studio.genlayer.com/?import-contract=0x8acED57B7f0875A67D5A4CC56De48105949d7405
- Source SHA-256: `a97d1934297108628e792fb7396c0108339e623e5158b40020348cd2d0237db8`
- `contracts/access_patch.py` and `public/deployment.json` are unchanged. Fresh live verification compared deployed source byte-for-byte to the repository.
- No new contract deployment, challenge transaction, adoption, payout, or accessibility defect is claimed.

## Reviewer path

Run `npm ci && npm run dev`, open the Vite URL, then choose **Review challenges**. The existing hosted site's update is currently blocked: Sites returns `project_not_found` for the preserved hosting project ID `appgprj_6abcbc084cd88191860952d82dda33da`. The configured site identity and URL were not replaced. This release must not be described as published to that website until hosting access is restored and it is deployed.

1. Click **Load recorded citation example**. Inspect the synthetic PAID bounty and its inert source. The example is explicitly a demonstration allegation, not a claimed defect.
2. Authenticate the reviewed candidate on GenLayer. Expect `authenticated_state: true`, `status: PAID`. This authenticates the source of the evidence, not the allegation.
3. Select the reviewed page and try adding a quote absent from it: the citation is rejected. Add a verbatim excerpt plus explanation; the previous report is invalidated. Rebuild and inspect the exact report/hash.
4. Download/import a challenge package. Alter the report, line metadata or hash: import rejects it and clears usable exports.
5. Paid candidates cannot open the challenge form. For a real active REVIEW candidate, publish the exact report at a public HTTPS URL, then open the form with a distinct sandbox account before `settle_after`. Handoff and actual submission both reread current state. No write is sent by preparation or authentication.

## Reproduce and evidence

```sh
npm ci
npm test
npm run build
node scripts/challenge-review.mjs create public/audit-example.json docs/milestone-v3-citations.json /tmp/accesspatch-challenge-v3.json
node scripts/challenge-review.mjs verify /tmp/accesspatch-challenge-v3.json
node scripts/challenge-review.mjs verify /tmp/accesspatch-challenge-v3.json --online
node scripts/verify-milestone-v3.mjs
```

Choose a new output path for each create run; overwrites are refused. Online commands depend on Studionet availability and its persisted state.

- [Fresh read-only live verification](milestone-v3-verification.json): existing synthetic bounty #0, unchanged source, authenticated state, forged criteria/report rejection and closed-bounty handoff rejection.
- [Generated challenge package](milestone-v3-challenge.json), [exact counter-evidence](milestone-v3-counter-evidence.txt), [citation input](milestone-v3-citations.json).
- [Domain implementation](../src/challenge.js), [UI](../src/challenge-ui.js), [CLI](../scripts/challenge-review.mjs), [tests](../tests/challenge.test.mjs), [UI event-flow tests](../tests/challenge-ui.test.mjs).
- [Development preview screenshot](milestone-v3-preview.jpg).
- Native browser QA: recorded example, inert snapshot display and live authentication on the managed development preview. Successful active-candidate handoff and submission guards use test doubles; no new live challenge is claimed.

## Submission fields

- Type: Builder → Milestones
- Linked project: Access Patch (next v3)
- Date: 10/28/2026
- Title: Candidate-bound Challenge Review Studio
- Change type: New functionality / feature (closest available label)
- Evidence: this document, repository comparison from the baseline commit, and the verification JSON.

### Changes & Improvements (under 1,000 characters)

Added a Challenge Review Studio beyond v2's repair-preparation tools. Reviewers cite exact text from pinned baseline, repaired-page and report snapshots; each citation records its source hash, line and occurrence count. The studio generates exact counter-evidence text/SHA-256 plus portable packages with full replay verification and a shared CLI.

Live authentication binds reports to finalized candidate state and locked criteria. Form handoff and submission recheck candidate identity, REVIEW status, challenge deadline, unused slot and fixer exclusion. Stale or tampered packages are blocked; HTML stays inert. Added 27 tests (149 total) and CI; production build passes. Fresh read-only Studionet verification authenticated the existing synthetic candidate and rejected forged reports/criteria. Contract source, address and link remain unchanged. No new deployment, challenge or payout is claimed. Website publication is pending restoration of existing hosting access.

## Current release limits

The GitHub feature is reviewable; the existing website has not yet been updated. Portal submission has not been performed: the browser has no connected wallet session. Restore hosting access and connect the owner's portal wallet before describing the feature as live or submitting on the owner's behalf.
