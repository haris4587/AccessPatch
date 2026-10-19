# Repair Evidence Studio: security and scope

## Trust boundary

A preparation JSON is untrusted, unsigned data. `verifyPreparation` recomputes the complete deterministic analysis, exact report text and both SHA-256 values. It rejects added top-level fields and unknown context fields. This detects modifications but does not authenticate provenance: someone can regenerate a consistent package with forged baseline/criteria. `authenticatePreparation` therefore independently verifies the configured chain and deployed source, re-reads finalized bounty/evidence via the accepted v1 verifier and compares all locked fields. The trusted deployment comes from `public/deployment.json`, never the imported file's RPC address.

Bindings include chain, contract, source hash, bounty ID, baseline hash, barrier, acceptance criteria, authorized repair URL and deadline. Before form handoff the application fetches current state again and checks OPEN/INCONCLUSIVE with more than 60 seconds remaining, matching contract commitment timing. It rejects other states. The actual contract checks its transaction timestamp and caller caps; browser clock, network or consensus delay can still cause a transaction to fail. Imported packages cannot send writes. Handoff fills report URL and hashes only; the user must explicitly commit and later reveal. The fixer identity/salt are created only by the existing wallet/commitment flow, not exported here.

## Parsing and byte integrity

- parse5 8.0.0 parses a syntax tree without evaluating scripts, loading images/CSS, or making HTTP requests. Template content is inert and excluded from active control checks.
- Uploaded source is decoded as strict UTF-8, retaining BOM, CRLF and Unicode without normalization. Invalid byte sequences are rejected. Textarea edits intentionally become the new exact UTF-8 source and invalidate prior output; download the generated file if using pasted/edited text.
- Each original/repair is nonblank and at most 60,000 UTF-8 bytes, matching the contract fetch cap. The traversal caps elements at 1,500. Notes cap at 1,500 bytes; generated report at 60,000 bytes; preparation JSON at 350,000 bytes.
- Source/report output is displayed with `textContent` / textarea `value`, never `innerHTML`, an iframe or a document-insertion API. JSON/HTML is downloaded as data. Attacker text is not a result, instruction, or executable code.
- Reports contain findings and source locations, not scripts, keys or commitment salts copied from the session. User-provided notes/source can of course contain any text the user chooses; review them before publishing.
- Report URL preflight enforces the contract's HTTPS, length, credential/fragment and common private-host exclusions. Neither it nor the contract is a full DNS/redirect defense. Local preflight makes no request to that URL.

## Deliberately narrow checks

`present` means a source declaration exists, not that a WCAG criterion passes. Checks cover explicit/wrapping form labels, nonempty aria-label, resolvable unique aria-labelledby text references, image alt attribute presence, duplicate IDs, document title and language tag declaration. The engine uses conservative reference handling and may flag valid advanced accessible-name patterns for manual review. Placeholder/title alone are not accepted by this limited label check. Empty image alt is a decorative-intent claim, not proof the image should be decorative.

Continuity is by a control's unique ID, tag and type. Untracked controls require manual review. Same ID/type does not prove the same feature, intent, server behavior or context survives. Removed controls cannot count as label fixes. Newly missing declarations are listed as regressions. A complete accessible-name algorithm, CSS visibility, computed contrast, keyboard behavior, screen-reader output, shadow DOM, full ARIA patterns, alt-text quality and live site publication are outside scope. Browser/client tests do not establish these properties.

GenLayer still decides whether the same feature survives and all sponsor criteria are meaningfully resolved. The generated report is evidence and a claim; it is never an oracle verdict. A local `DECLARED_SOURCE_CHECKS_CLEAR` summary must not be represented as RESOLVED or WCAG certification.

## Commit first

Keep the repair/report private until the fixer-bound commitment is finalized. Choose the final report URL, commit the exact hashes, publish the downloaded bytes, wait for the 60-second minimum age and reveal with the same built-in sandbox account/session. An already public repair can be independently committed by another participant; this tool does not establish authorship. Losing the session salt requires a new commitment. Settlement/recovery behavior remains the accepted v3 contract's responsibility.

## Primary references

- [W3C WAI labeling controls](https://www.w3.org/WAI/tutorials/forms/labels/)
- [W3C ARIA16](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA16)
- [parse5 parser options / source locations](https://parse5.js.org/interfaces/parse5.ParserOptions.html)
- [parse5 source and license](https://github.com/inikulin/parse5)
