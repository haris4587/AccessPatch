# AccessPatch v3: recovery and earned-reward integrity

## Threats and fixes

| Attack | Deterministic defense |
| --- | --- |
| Reveal unavailable evidence or wrong digests | Strict consensus fetch preflight fails before candidate installation, commitment consumption, attempt accounting, or LLM assessment. |
| Reveal semantically insufficient evidence and abandon candidate | INCONCLUSIVE is nonexclusive. Anyone may call `reopen_bounty`; a valid reveal atomically replaces it. No sponsor consent or retry prerequisite. |
| Exhaust retries to retain slot | Only the candidate fixer can retry, at most three times; reopening remains permissionless after exhaustion. |
| Use ten failed attempts to deny every other fixer | Ten reviewed submissions per authenticated fixer per bounty; global attempt count is statistics only. |
| Reopen a competing accepted repair | Reopening requires INCONCLUSIVE. REVIEW, PAID and REFUNDED cannot be reopened. |
| Submit an unproven challenge | INCONCLUSIVE records the challenge but retains REVIEW and the existing settlement timestamp. Only a NOT_RESOLVED consensus result revokes a resolved candidate. |
| Sponsor changes/deletes repair or report after acceptance | Reveal stores strict-consensus snapshots. Challenge and settlement use those immutable bytes; URLs are provenance, not a payout veto. |
| Refund after a fix earns a resolved review | Refund remains unavailable in REVIEW, including after the bounty deadline. Permissionless settlement pays the authenticated fixer. |

## State semantics

OPEN allows commitments and reveals until the fixed deadline. RESOLVED installs an exclusive REVIEW candidate. NOT_RESOLVED leaves OPEN. Semantic INCONCLUSIVE retains a candidate for optional fixer-only retries, but never reserves an exclusive slot: commitments and valid reveals remain possible. `reopen_bounty` immediately clears that candidate, records REOPEN, and preserves the original deadline and consumed commitment. A valid replacement records the same transition atomically after its evidence preflight. Failed replacement evidence leaves the existing state untouched.

Counter-evidence is fetched and pinned before assessment. An inconclusive challenge is not proof that the already accepted repair is invalid; it therefore cannot revoke its verdict. This policy bounds adversarial delay without paying objectively rejected repairs. Evidence snapshots are available through `get_evidence`, including after PAID, and the app displays them as escaped text.

## What the reward purchases

The reward purchases the source-HTML repair represented by the exact consensus-approved snapshot. It does not purchase perpetual hosting, certify overall WCAG compliance, or prove runtime keyboard/screen-reader behavior. Before reveal, sponsor-controlled URL mutation can still prevent verification of a repair that validators have never observed; the contract cannot force a website owner to publish work. After successful reveal, neither sponsor URL mutation nor report disappearance can cancel the earned snapshot-based reward. Sponsors should authorize staging URLs where fixers can publish reliably.

## Tests

`npm test` runs 28 contract behavior tests and one canonical browser/Python encoding test. These execute the actual contract with an explicit SDK double; they are not claimed to simulate GenVM consensus. Adversarial cases prove invalid-hash recovery and settlement, retry exhaustion recovery, automatic replacement, per-fixer caps, protected REVIEW/PAID, stranger retry rejection, post-deadline recovery/refund, inconclusive challenge preservation, and sponsor deletion followed by payout. Real full-consensus Studio evidence is recorded separately in `docs/live-test.json`.

Earlier deployments are immutable and retain their historical behavior. The public app points to the new v3 contract; this is a new deployment, not a retroactive patch to previous bounties.
