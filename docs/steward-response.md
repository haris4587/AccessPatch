Fixed candidate-slot denial of service and sponsor payout vetoes. Invalid/unavailable/digest-mismatched evidence now records SUBMIT_REJECTED without installing a candidate. INCONCLUSIVE candidates are nonexclusive: anyone can call reopen_bounty, or a valid new reveal can replace them atomically. Recovery needs no sponsor consent, retries, or URL availability. Attempts are capped per fixer, so an attacker cannot exhaust everyone else's capacity. Reopening cannot erase REVIEW or terminal states; only the candidate fixer can retry.

Reveal pins exact repair/report snapshots through validator consensus. Challenges review those immutable bytes; an INCONCLUSIVE challenge cannot revoke an accepted repair. Settlement pays the authenticated fixer from the approved snapshot even if sponsor URLs later change or disappear.

32 tests pass. Live proof covers rejected evidence, payout despite sponsor mutation, and INCONCLUSIVE reopening/refund. App, GitHub, contract and evidence are updated.
