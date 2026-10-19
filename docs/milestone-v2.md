# Milestone v2: Bounty-Bound Repair Evidence Studio

## Accepted baseline and exact delta

The user confirmed v1 accepted on October 19, 2026. The latest source before this upgrade is [`b054ff484a241099ed04b093fbbf73327ff2c777`](https://github.com/haris4587/AccessPatch/commit/b054ff484a241099ed04b093fbbf73327ff2c777): it includes the accepted portable audit workbench plus subsequent cosmetic background work. Neither v1's audit verification nor the background is counted as new v2 work.

| Accepted baseline | New v2 functionality |
| --- | --- |
| Verify already-reviewed snapshots and payments | Prepare a new repair against a locked bounty before commitment |
| Export/import audit records | Generate/replay exact repair reports and preparation packages |
| Manually author reports and compute submission digests | Parse source, compare declarations/continuity, compute exact report/page hashes |
| Manually copy submission arguments | Re-authenticate context and fill the existing commit/reveal form |
| Offline/live audit verifier | Browser and CLI preparation engine, adversarial and event-flow tests |

No Intelligent Contract source was changed or redeployed. No new payout or adoption is claimed. The v3 recovery/escrow logic, v1 payment verifier, and earlier synthetic payouts remain accepted baseline work. The new live run is read-only and explicitly uses existing synthetic bounty #0.

## What was built

- A **Repair Evidence Studio** at `/#prepare`, also reachable from a bounty's **Prepare repair evidence** button. Load consensus-pinned original HTML and locked criteria; upload/paste repaired HTML without executing it; inspect a deterministic before/after analysis.
- Source-level checks for supported form-name declarations, alt attribute presence, duplicate IDs, document title and language. Unique-ID control tracking flags removed/type-changed fields; fields without stable IDs are flagged for manual continuity review. Reports list newly missing declarations and observed fixes.
- Download an exact UTF-8 repair page, report and versioned preparation JSON. Imports recompute the entire analysis/report/hashes. Size limits and unknown-field rejection apply. File upload preserves BOM/CRLF/Unicode; editing invalidates the previous report.
- Authenticate the prepared baseline/criteria/deadline/URLs against finalized GenLayer state. A forged but internally consistent package cannot authenticate against another locked context. Before form handoff, reload state and reject paid/review/refunded/expired bounties and those without the contract's minimum commitment time.
- A shared Node CLI `scripts/prepare-repair.mjs` with local create/replay and optional online authentication. The CLI refuses to overwrite an existing output file.
- 60 new tests (122 total), including adversarial source/report/criteria tampering, feature removal, Unicode/CRLF/BOM, byte limits, and an event-flow integration test of the UI with an explicit DOM double.

The tool prepares evidence; it does not claim runtime accessibility, compute complete accessible names, certify WCAG compliance, approve a repair, or bypass GenLayer review. See [scope/security](preparation-security.md).

## Reviewer path

1. Visit https://accesspatch.itzanza2.chatgpt.site/#prepare. Click **Load recorded repair example**. It uses a recorded synthetic paid bounty and explicitly begins with offline consistency only.
2. Inspect the locked context, original source, generated report and comparison. Expect `control-label:id:email` under fixed findings and `DECLARED_SOURCE_CHECKS_CLEAR` for the limited declarations. The repaired input and its email type are retained.
3. Click **Authenticate bounty context on GenLayer**. Expect `authenticated_context: true`, `status: PAID`; the note states that the locally prepared repair has not been approved by GenLayer. The old accepted candidate is distinct from this newly generated report.
4. Download preparation JSON and the exact report/page files. Import the JSON; the application recomputes all output. Alter the JSON's report text or hashes and import again: it is rejected. If an attacker regenerates the whole report with forged criteria, online authentication rejects the context.
5. Edit the repaired HTML to remove input `id="email"` and analyze again. Expect a removed-controls entry and `MANUAL_REVIEW_REQUIRED`, not a fake fix based on removing the form.
6. For an actual new OPEN bounty, load its baseline, prepare privately, enter the future public report URL, then choose **Use hashes in commit / reveal form**. Create/fund a built-in sandbox account first. This fills arguments only; explicit commit, private salt retention, publication, 60-second age and reveal are still required. The recorded paid bounty deliberately blocks this path. The successful open-bounty handoff is exercised by the UI DOM-double test, not claimed as a new on-chain submission.

## Reproduce

```sh
npm ci
npm test
npm run build
node scripts/prepare-repair.mjs create public/audit-example.json public/fixtures/after.html /tmp/accesspatch-preparation-v2.json
node scripts/prepare-repair.mjs verify /tmp/accesspatch-preparation-v2.json
node scripts/prepare-repair.mjs verify /tmp/accesspatch-preparation-v2.json --online
node scripts/verify-milestone-v2.mjs
```

The create command uses exclusive creation; remove or choose a different local temporary output if it already exists. The online commands use the configured Studionet RPC, not imported endpoints. Availability and persisted state depend on Studionet. Native browser interaction/visual QA was unavailable; production build, domain tests, DOM-double event-flow integration, CLI checks and live Node RPC checks were performed.

## New evidence

- [Implementation and locked-context checks](../src/prepare.js)
- [Browser event flow](../src/studio-ui.js)
- [Preparation CLI](../scripts/prepare-repair.mjs)
- [Adversarial preparation tests](../tests/prepare.test.mjs)
- [UI event-flow test (DOM double)](../tests/studio-ui.test.mjs)
- [New live verification record](milestone-v2-verification.json)
- [New generated preparation package](milestone-v2-preparation.json)
- [Exact generated report text](milestone-v2-report.txt)
- [Reproducible live-check script](../scripts/verify-milestone-v2.mjs)

## Submission fields

- Contribution type: Builder → Milestones
- Linked project: Access Patch (next v2)
- Contribution date: 10/19/2026
- Title: Bounty-Bound Repair Evidence Studio
- Change type: New functionality / feature (closest available label)

### Changes & Improvements (under 1,000 characters)

Added a Repair Evidence Studio beyond accepted v1. Fixers load a bounty's pinned baseline and locked criteria, compare repaired HTML, and generate an exact report plus page/report SHA-256 hashes. Source checks cover label declarations, alt attributes, duplicate IDs, title and language; control tracking flags removed/type-changed fields and regressions. Download/import preparation packages with full recomputation, or use the shared Node CLI.

Online authentication binds preparations to finalized GenLayer context. The app rechecks state before filling commit/reveal arguments and blocks closed, expired or mismatched bounties. Files remain inert; byte limits and exact UTF-8 handling apply. Added 60 tests (122 total); production build passes. A new read-only Studionet run authenticated the baseline/criteria and rejected forged context and reports. This is preparation tooling, not WCAG certification or an AI verdict; no contract redeployment or new payout is claimed.
