# North Houston GMS Intake — Execution Status

Verified October 10, 2026 (America/Chicago).

## Production backend and configuration

- GCR onboarding revision 13: named Homes Around North Houston campaign, website source, existing broker-review questions, phone-agent script, permission text, website creative and private client-cabinet review packet. Existing staff and brokerage call tree preserved.
- Campaign remains paused; onboarding lifecycle remains draft. No customer approval was invented and no call or real prospect was created.
- GHL conversations, calendars and opportunities rechecked successfully. Connection hash matches onboarding. Phone readiness remains false; live audio/handoff acceptance still needs an attended test. CRM verification expires after 24 hours and must be current at activation.
- Durable intake receipt, per-contact rate limit, atomic lead/audit/notification persistence deployed: ingestwebsitelead-00003-jot.
- Qualification evidence and provider-transfer guards deployed: updateagentrecord-00005-yuz and transitionlead-00002-cuw.
- Saved website qualification required before Realtor consultation/transfer: communications-00022-fah. Existing restricted phone-test controls were preserved.
- Firestore expiration of temporary websiteIntakeLimits records is ACTIVE. Intake receipts and lead evidence remain retained; this does not change general lead/call retention policy.
- Website production endpoint, managed route and sensitive server-only credential configured. Preview intake values cleared. No public domain configuration changed.
- Authenticated production intake probe confirmed the paused route rejects submissions with 404; the website API translates a paused route to an unavailable response.

## Website and portal source

- Website draft PR: https://github.com/sentinelstechnologygroup-stack/homes-around-north-houston-v1/pull/1
- Website intake is prepared on gms-website-lead-routing. The public V1 contact form has not been switched to the GMS API while the campaign is paused.
- Agent Portal qualification calculation no longer treats a draft or unscored form as qualified. This fix is included in production deployment dpl_9Gu4pxQpQxSRHJQzaMaHchKnTHin (commit 5542b60).
- Agent Portal script-body display, draft warning and onboarding qualification-field aliases are committed and build successfully. Their production publication should be verified against the next Agent Portal deployment; other portal work is in progress in the shared workspace.
- Shared portal changes from other work were preserved. Functions were updated from each function's current deployed source with this task's isolated changes.

## Evidence

- Full HTTP website API -> GMS ingestion -> Firestore emulator queue -> returned receipt passed. Route ownership, attribution, permission, pending qualification, staff notification, retry deduplication and paused-route rejection checked.
- Eight concurrent retries produced one lead, audit entry and staff notification.
- Existing Agent/Customer bridge and onboarding readiness regressions passed. The fixture now sets phone staff Available before testing dialing authorization, preserving the actual availability gate.
- Website build, lint, typecheck and handler/hardening tests passed.
- Agent Portal build, qualification tests and Firebase entity-contract checks passed.
- Qualification/handoff policy tests reject draft/unscored/unverified assessment, forged manual transfer completion and consultation before saved qualification.
- These checks do not certify production phone audio, automated SMS, recording analysis or billable delivery.

## Remaining activation work

1. Golden Cross Realty reviews the actual script, qualification criteria/rubric and assessment method, three requalification checkpoints, callback expectations and contractual handoff acceptance. The existing draft has no approved scoring weights or pass threshold. Final criteria must be configured and tied to current customer approval; no assumed score is authorized.
2. Complete attended phone acceptance: claim and availability, correct caller ID, two-way audio, hold/resume, recipient consultation/acceptance, no-answer/cancel fallback and completion evidence. Recording/analysis must meet the approved service scope before they are advertised as active.
3. Renew readiness if needed, record customer approval through the existing client workflow, and enable the managed campaign through its readiness gate.
4. Promote the website intake and verify a controlled end-to-end production submission and the assigned phone-agent queue. Publicly advertise response times only after staffing/coverage is settled.
5. Repliers integration, provider-owned lead-copy settings, domain/DNS launch and paid-traffic conversion-account verification remain pending. Human-verification challenge remains deferred as instructed.

Review packet: ../output/north-houston-workflow-review.md in the GMS workspace, also saved privately in the GCR client cabinet. No GMS reference originals, tax or ownership documents were uploaded or committed.
