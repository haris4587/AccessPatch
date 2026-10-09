# Access Patch — October 9 steward update

Keep the existing logo, project name, application date, Builder → Projects Project selection, and AI & Agents / Autonomous Execution / Verifiable Inference tags.

## What did you change? (991 characters)

Paste the complete text from [steward-response.md](steward-response.md).

## One-liner

Evidence-bound accessibility repair bounties with GenLayer review, challenges, and escrowed rewards.

## Description

AccessPatch funds specific website accessibility repairs. A sponsor commits the original page, authorized repair URL, criteria, deadline and GEN reward. Fixers commit secret-salted evidence hashes bound to their address before revealing. GenLayer independently fetches and pins the repair/report, then validators assess whether the barrier is meaningfully resolved. Invalid evidence cannot reserve a candidate slot; INCONCLUSIVE candidates can be reopened by anyone or replaced by a valid reveal. Per-fixer limits prevent shared-cap exhaustion. Challenges use immutable reviewed snapshots, and later sponsor URL edits cannot veto an accepted payout. The app interacts with GenLayer using signed sandbox transactions and finalized reads. 32 tests pass. Live full-consensus Studio proof shows invalid/unresolved evidence followed by a 1 GEN payout despite sponsor mutation, plus INCONCLUSIVE reopening and refund. Review covers source HTML, not overall WCAG or runtime accessibility certification.

## How-to

1. **Open the repair workspace.** Visit https://accesspatch.itzanza2.chatgpt.site/ and wait for “Finalized state connected.” Refresh bounties if needed. Public inspection needs no wallet connection.
2. **Inspect recovery and payout.** Select bounty #0, “Synthetic adversarial recovery and payout · 1 GEN.” Inspect SUBMIT_REJECTED, NOT_RESOLVED, RESOLVED and the paid fixer. Open “View reviewed snapshots”; compare the retained labelled email form with the authorized URL, which was deliberately changed after approval.
3. **Inspect an unresolved bounty reopening.** Select bounty #1, “Synthetic runtime uncertainty recovery · 1 GEN.” Its history shows INCONCLUSIVE → REOPEN, followed by a deadline refund. Review the independent caller and finalized receipts in docs/live-test.json.
4. **Verify on GenLayer.** Open the current contract explorer below. Compare finalized calls and both outgoing Send credits with the website’s Live proof records. For reproducible checks, clone the repository, run npm ci, npm test, npm run build, and node scripts/verify-release.mjs.

## Expected verification outcome

Bounty #0 is PAID: invalid evidence was rejected, an unresolved attempt left it open, and the legitimate fixer received 1 sandbox GEN despite a later sponsor URL mutation. Its immutable reviewed snapshot retains the labelled email input. Bounty #1 records INCONCLUSIVE → REOPEN by an unrelated caller, then REFUNDED after its fixed deadline. Both outgoing transfers are finalized and credited; the current contract balance is 0 GEN. These are synthetic Studionet tests.

## Replace current contract link

https://explorer-studio.genlayer.com/address/0x8acED57B7f0875A67D5A4CC56De48105949d7405

## Project links

- Website: https://accesspatch.itzanza2.chatgpt.site/
- GitHub: https://github.com/haris4587/AccessPatch

## Evidence to add or retain

- https://github.com/haris4587/AccessPatch/blob/main/docs/live-test.json
- https://github.com/haris4587/AccessPatch/blob/main/docs/recovery-design.md
- https://github.com/haris4587/AccessPatch/blob/main/tests/test_access_patch.py
- https://github.com/haris4587/AccessPatch/blob/main/contracts/access_patch.py
- https://github.com/haris4587/AccessPatch/blob/main/scripts/verify-release.mjs
- Current explorer address above.

Retain historical v1/v2 proof only as historical evidence; it does not establish the v3 recovery behavior. Leave the optional video empty unless a real demo is provided. This document prepares the portal update; publishing the app does not resubmit the contribution form.
