# Golden Cross Realty SMS verification — internal-test draft

Status: implemented locally, not deployed, not live-validated. No production sends are supported by this draft. The only accepted mode is `internal_test`; every destination must be explicitly allowlisted. This change is based on Customer main, independent of unmerged multi-client PR #4. Reconcile with that PR before merging both.

## What it does

The authenticated website ingestion endpoint captures explicit, versioned SMS consent into a server-only `smsIntakes` record in the same batch as the lead. Its creation trigger reserves one verification message, sends a Golden Cross Realty-branded six-digit reply challenge, and stores a redacted receipt on that lead. A signed inbound reply confirms phone possession. It does not establish identity, email ownership, qualification, marketing consent beyond the captured disclosure, or a completed handoff.

Provider acceptance, sent, delivered, failure and unknown delivery are separate from verification. Signed inbound messages, STOP and verification outcomes are projected to the same lead's `smsMessages`/`smsVerification` for both portals. The last 50 messages are displayed. Other SMS state lives in root collections denied by the existing default-deny rules. Browser writes to the projections are denied in rules and stripped in Agent callables.

## Deployment/configuration prerequisites — not yet completed

1. Secure access to Firebase project `gms-prod-1089114348316` and Telnyx. Use existing Secret Manager `TELNYX_API_KEY`; never put it in frontend settings. Confirm `TELNYX_PUBLIC_KEY`. Deploy rules and `sendLeadSmsVerification` / `telnyxMessagingWebhook` together with the ingestion change, initially without `GMS_SMS_ENABLED=true`.
2. Inspect campaign `4b3001a1-8004-8c4f-a3d2-e2660a814a3e`, TCR `CGWEP9X`, approved use case and samples in Telnyx. Confirm the number is SMS capable, is assigned to this campaign, and its messaging profile is dedicated to the correct client. Do not reuse another client's authorization. Campaign provisioning alone is insufficient.
3. Set messaging profile v2 webhook to the deployed `telnyxMessagingWebhook` URL. Confirm Telnyx's branded STOP/START/HELP auto-responses and actual callback payloads. This application intentionally does not duplicate provider auto-responses; START is recorded but never removes application suppression automatically.
4. Using privileged server administration, provision `smsRoutes/{routeId}` with tenantId, brandId, brandName exactly `Golden Cross Realty`, explicit GMS campaignIds, telnyxCampaignId, tcrCampaignId, from (US E.164), Telnyx numberId, profileId, mode `internal_test`, enabled false, and explicitly authorized `internalTestNumbers`. Do not infer authorization from a contact address book or lead record.
5. Record independently checked provider evidence under route.evidence: tenantId, brandId, from, numberId, profileId, telnyxCampaignId, tcrCampaignId, campaignStatus `MNO_PROVISIONED`, numberStatus `ASSIGNED` (normalized operator result), optOutAutoResponseVerified true, webhookVerified true, checkedAtMs. Evidence expires after one hour. These fields are operational attestations; this code does not independently query Telnyx assignment status.
6. Provision `smsNumberRoutes/{sha256(JSON.stringify([from]))}` with the exact same tenantId, brandId, from and profileId. This immutable inbound ownership lookup remains available when outbound is disabled so STOP can still be processed. Never remap a number while bindings remain without an audited migration.
7. On the existing authenticated `ingestionRoutes/{routeKey}`, configure smsRouteId, smsDisclosureVersion, smsDisclosureText, smsAllowedPageUrls. The website must submit `phone` in US E.164 and `consent.sms = {accepted:true, disclosureVersion:<exact version>}` plus the exact pageUrl. Checkbox must be unchecked by default and display the approved disclosure. Existing legacy consent objects deliberately do not authorize sends. Source website form changes are not included in this two-repository patch.
8. Only after these checks, enable the route and GMS_SMS_ENABLED for internal tests. No customer-facing mode is implemented. Turning either flag off stops new sends; keep callbacks running for STOP and outstanding deliveries.

## Internal acceptance tests still required

Obtain an explicitly authorized internal handset. Submit a new lead with explicit consent through the real source form. Confirm one branded message, reply with code, and inspect the correct lead in Agent and Customer portals after refresh. Repeat without consent, with a non-allowlisted number, changed brand/profile, duplicate callback, expired code, incorrect code, STOP, subsequent new intake, and START. Verify suppression remains after START pending renewed consent and review. Confirm another client cannot read the record, use the number, mutate receipt fields, or obtain the challenge. Validate provider auto-response wording and HELP behavior.

No handset, real provider, deployed rules or portal end-to-end tests ran in this workspace. Branded email verification is also outstanding; existing notification email delivery is not an email ownership check.

## Recovery and limitations

- One active conversation binding per sender/recipient pair; a second intake for that pair fails closed for operator review rather than assigning replies to an arbitrary duplicate lead. Resend/rebinding needs a separately audited flow; do not delete a suppression to retry.
- A crash/timeout after reservation never automatically resends. Inspect `smsOutbound` reserved/reconciliation_required records against Telnyx message logs; reconcile the exact provider ID into smsProviderMessages before retrying callbacks. Never blindly retry an ambiguous send.
- Unknown outbound IDs return 503 to support callbacks that race POST persistence. Telnyx retries are finite; investigate and reconcile unresolved events. This draft has no scheduled reconciler.
- STOP creates a tenant+brand+recipient suppression, including when no lead binding exists. It is processed even with outbound disabled. A message already dispatched cannot be recalled; the final pre-dispatch check narrows but cannot eliminate that race.
- Keyword opt-outs and provider autoresponse_type STOP are supported. Free-text opt-out review, provider-wide suppression synchronization, full retention/TTL configuration, and durable long-term conversation history need operational acceptance before customer activation.
- Existing manual verification is preserved. Automated SMS results are displayed separately so they cannot imply completed email verification or qualification.

## Local validation

`node --test firebase/functions/tests/messaging.test.cjs firebase/functions/tests/bridge-contract.test.cjs`

The 14 focused SMS/ingestion tests pass using a deterministic transaction harness and mocked Telnyx responses. Both portal production builds and the Agent Firebase contract check pass. The full Auth/Firestore/Storage emulator suite ran 64 tests: 60 passed, including the new SMS private-state/receipt authorization test; four Storage upload tests failed. All four failures reproduce against the unchanged baseline rules and tests in this environment. Three additional focused regression cases were added afterward and pass. No real carrier tests ran. Full SMS concurrency and handset/portal acceptance remain required before activation.
