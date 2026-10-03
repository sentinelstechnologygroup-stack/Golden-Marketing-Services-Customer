# GMS launch execution checklist

Updated: 2026-10-02. This is the active checklist for Golden Marketing Services.
Old brand domain transfers are retired and cannot block GMS launch. Historical
acceptance records identify past releases, not current production readiness.

## Release policy

Complete all five workstreams below. Code completion, emulator acceptance,
production deployment and live customer acceptance are separate evidence gates.
A Ready Vercel build or three successful GHL read requests is not full acceptance.
Record commit SHA, backend revision, test output, production URLs, timestamp and
redacted provider receipt for every completed production gate.

Preserve layouts, controls, forms, workflows and permanent demos. Do not widen
permissions, fabricate records, mark missing providers successful, or change an
agency subscription to satisfy a release gate.

## 1. Retire old brand blockers and establish one shared Firebase backend

- [x] Retire the former domain-transfer gate in the historical acceptance record.
- [x] Correct the website's default intake origins to the GMS apex and www hosts.
- [x] Align active frontend package names with GMS and preserve lockfile metadata.
- [x] Remove four unreferenced former-brand website image assets and one embedded logo module.
- [x] Correct the GHL checkpoint's stale claim that the module is not exported.
- [x] Publish frontend changes and record the resulting deployment identities.
- [ ] Verify apex/www HTTPS, portal footer links, sitemap/canonicals and no public
      navigation, consent, contract, email or asset reference to the retired brand.
- [ ] Review retained Website/history trees separately; referenced historic assets
      are not dead files and must not be blindly deleted.
- [x] Set the cloud project's display name to GMS Platform Production.
- [x] Rename all three registered web apps to GMS Agent CRM, GMS Customer Portal and GMS Website.
- [x] Remove retired LMS custom authorized Auth domains; preserve both GMS portal domains and Firebase default identities.
- [x] Verify existing weekly Sunday backups with 98-day retention. PITR is off; actual backup availability and restore validation remain pending.
- [ ] Confirm both portals, ingestion, Auth, Firestore, Storage, Functions and
      Secret Manager use the canonical shared backend below. Inventory reserved
      projects; do not deploy to them or delete them as a branding fix.
- [ ] Export a production backup; record rules, indexes, deployed function revisions,
      authorized Auth domains, redirects, secret names (not values), bucket paths,
      tenant/brand contracts and rollback points.
- [ ] Reconcile active GMS domain registration, Firebase Auth templates and provider
      callback URLs. Historical domain transfers are not a prerequisite.

Canonical GMS backend: gms-prod-1089114348316. The 2026-10-03 ownership migration supersedes the former compatibility requirement. GMS has independent app IDs, Storage, Functions, secrets, gmsSuperAdmin claims and GMS-only tenant assignments. The three GMS applications use this GMS backend; LMS uses its own infrastructure. See gms-ownership-isolation.md for the migration and backup evidence.

## 2. Complete GoHighLevel integration

- [ ] Reverify agency ownership and one-location/one-tenant mapping for each client;
      distinguish `gms-internal` from paying customer locations.
- [ ] Install each location-scoped credential server-side and verify granted scopes.
      No token in Vite env, client documents, browser storage, logs or Git.
- [ ] Configure the approved GMS pipeline, stages, calendars, timezone, routing,
      scripts, qualification fields, forms and workflow assets in a clean location.
- [x] Implement a Super Admin contact-link callable that checks provider location,
      matching lead email/phone, canonical location ownership and revision races;
      prevent conflicting lead/contact mappings and write an audit event.
- [ ] Pass emulator permission/conflict/race tests for contact linkage, deploy the
      callable first, then enable `VITE_GMS_CONTACT_LINKING_ENABLED=true` in the
      Agent Portal build and test a live link. The control defaults off.
- [ ] Implement contact upsert from trusted ingested lead records; persist the
      provider mapping and reverse ownership. Reconcile duplicate email/phone
      behavior before retrying. No client-supplied ownership.
- [ ] Implement calendar availability and appointment creation/update/cancellation;
      verify timezone, consent, authorized calendar, retry safety and portal sync.
- [ ] Implement opportunity writes while preserving GMS qualification and billing
      decisions in Firebase. Provider stage changes cannot create billable handoffs.
- [ ] Implement conversation history and approved message sending. Enforce channel
      consent, opt-out/DND, assigned lead, destination and immutable audit evidence.
- [ ] Implement workflow enrollment against approved workflows; verify write scope
      availability before expanding credentials. Test duplicate enrollment behavior.
- [ ] Implement signed webhook receipt using the provider's documented signature
      mechanism, original body verification, event deduplication, trusted location
      resolution, immutable ownership, out-of-order events and retry handling.
- [ ] Add webhook reconciliation, stale sync indicators, safe error/empty/loading
      states, operational alerts and dead-letter/manual retry handling.
- [ ] Record parity for each portal screen: live CRM data, editing, notifications,
      calendar, campaigns, forms and reporting. Reputation is not enabled until
      its access and implementation are verified; do not display fabricated data.
- [ ] Test a new client location end-to-end. Manual sub-account creation/linkage is
      the supported current-plan path; automatic provisioning remains disabled.

Authority: GHL owns CRM activity. Firebase owns identity, tenant/brand permissions,
qualification, customer approvals, handoff evidence, billing decisions and audit.

## 3. Restore security attestation and verify current permissions

- [x] Add environment-configured reCAPTCHA Enterprise App Check initialization to
      both portals, with auto-refresh and no stale hardcoded preview key.
- [ ] Register `agentcrm.goldenmarketingservices.com` and
      `customer.goldenmarketingservices.com` against the correct Firebase web apps.
- [ ] Set each portal's `VITE_FIREBASE_APPCHECK_SITE_KEY` and
      `VITE_FIREBASE_APPCHECK_ENABLED=true`, rebuild, observe valid
      tokens, then enable server/service enforcement. Do not enforce first and
      lock users out; do not report enforcement complete while disabled in code.
- [ ] Audit every callable, including onboarding and GHL, and re-enable enforcement
      after valid portal tokens are observed. Verify missing/invalid-token denial.
- [ ] Run Auth/Firestore/Storage and callable permission suites: customer, client
      admin, supervisor, agent, agent supervisor and GMS Super Admin.
- [ ] Verify fresh claims, disabled/password-change users, revoked assignments,
      cross-tenant/brand/lead access, exports, downloads and private provider maps.
- [ ] Test invitation issuance/delivery/acceptance, password reset, mandatory initial
      password change, session revocation and intended-route return after login.
- [ ] Keep invitation-only Agent access; remove privileged test access when finished.

## 4. Verify live communications and complete customer activation

- [ ] Configure approved Telnyx credentials, sender number, inbound/voice/status
      webhooks, agent routing, queues and after-hours behavior in the shared backend.
- [ ] Verify inbound/outbound calls, client identity, consent announcement, warm
      transfer, no-answer fallback, recording/transcript and protected downloads.
- [ ] Configure transactional email and verify sender domain. Test invite, password
      reset, notification, failure, opt-out and duplicate-delivery behavior.
- [ ] Configure and test SMS only if part of the approved pilot, including consent,
      opt-out and delivery status; otherwise explicitly exclude it from activation.
- [ ] Complete payment-method collection, activation gate, billing cadence, accepted
      handoff evidence, dispute flow and idempotent billing. Do not charge real
      customers during a technical acceptance test.
- [ ] Configure ad-account access and publishing pathway. Verify customer approval
      hashes, approved creative/scripts, budgets, publishing and paused intake after
      material edits. Saving a draft does not publish a campaign.

## 5. Complete production acceptance and release

- [x] Run builds/lint/type checks and focused contracts for all three repositories;
      run backend emulator suite and customer report exports.
- [ ] Deploy rules/indexes/storage/backend before dependent portal features. Record
      immutable release IDs; verify live Functions revision, not just repository code.
- [ ] Onboard a clearly identified controlled test customer: tenant + GHL location +
      membership + invitation + campaign/brand + agent assignment + consent policy +
      routing + customer approval + verified communications/payment prerequisites.
- [ ] Submit a GMS website inquiry; verify trusted ownership, contact sync, Agent
      visibility, qualification, handoff/appointment, customer acceptance, reports,
      notification and billing evidence, with no unauthorized duplicate actions.
- [ ] Test refresh/bookmark/deep links, expired sessions, mobile sidebar/tables/forms,
      loading/empty/error states, downloads and consent-aware retries.
- [ ] Verify GA4/conversion events and source attribution without exposing protected
      lead data; review search metadata and obsolete public URLs.
- [ ] Scan logs for errors and secret/PII leaks, test provider failure/recovery and
      demonstrate rollback without deleting tenant records or permanent demos.
- [ ] Publish a new GMS acceptance record with passed/failed/blocked results. Open
      customer activation only when the required gates above have live evidence.

## Live findings and access constraints — 2026-10-02

Firebase Console is authenticated and its configuration changes above are
verified. Google Cloud Console and embedded Cloud Shell show Site Unavailable,
including after one Cloud Console reload. No authenticated local Firebase/gcloud
deployment credential is available. The existing GHL tab is signed out; its
secure sign-in request was interrupted and was not repeated.

Firebase rejected Auth template saves: "Email template updates are currently
unavailable for this project." Sender and subject branding did not persist.
Resolve that vendor/project restriction; retain the current functional action
handler until a GMS handler is implemented and tested.

All three Firebase web apps are already registered with Fraud Defense (formerly
reCAPTCHA Enterprise). Registration alone does not verify allowed GMS domains.
Storage and Firestore are already Enforced; Firestore displayed 0% verified and
100% unverified requests. Authentication is Monitoring (8%/92%). These are
console metrics, not an end-to-end access test. Verify domain restrictions and
valid portal tokens urgently; do not disable enforcement to mask the issue.

The console lists 50 deployed v2 Functions in us-central1. Existing GHL reads and
connection verification are deployed. The new linkGoHighLevelContact callable is
absent. verifyGoHighLevelConnection displayed deployed 9/30/26 8:59 PM, nodejs22,
256 MiB; that is a console timestamp, not an immutable revision identifier.

Backend deployment, backup export/restore validation, attestation domain setup,
provider administration and live acceptance remain blocked by these specific
access boundaries. This is not a request for renewed approval or an old-domain
blocker.

## Next-pass order and evidence

| Order | Concrete work | Completion evidence |
| --- | --- | --- |
| 1A | Restore Google Cloud deployment access and a signed-in GHL session; inventory backend revisions, secret metadata and backup objects. | Authenticated access, immutable revision IDs, successful production export and isolated restore validation. |
| 1B | Resolve Firebase template update restriction; verify GMS sender domain and callbacks. Finish public old-brand scan, retaining technical identities and permanent demos. | Persisted templates, delivered reset/invite emails and correct return routes; zero obsolete public branding. |
| 2A | Complete trusted contact upsert, appointment CRUD and opportunity writes with private mappings, scope checks, revision checks, audit and retry reconciliation. | Emulator denial/duplicate tests plus provider receipts and matching Firebase/GHL records. |
| 2B | Complete consent-aware messaging, approved workflow enrollment, raw-body signed webhook validation, deduplication, ordering and reconciliation. | Delivery/workflow receipts, invalid-signature denial, duplicate-event no-op and failure/recovery evidence. |
| 3 | Verify existing attestation keys allow GMS hosts, configure portal keys/enabled flags, observe valid tokens, deploy callable enforcement and exercise every role boundary. | Valid tokens; missing/invalid-token and cross-tenant/brand denials; successful authorized customer/agent journeys. Existing Firestore/Storage enforcement stays in place. |
| 4 | Activate approved calling/email, payment prerequisites and approved campaign publishing. | Call/email receipts, customer approval hash, payment-method readiness, published campaign ID and budget evidence. |
| 5 | Run a controlled customer intake → qualification → handoff → acceptance → billing-evidence journey; exercise retries and rollback. | Linked record IDs, redacted provider receipts, immutable approval/acceptance/billing audit and signed-off production acceptance record. |

Steps 2A/2B are implementation work, not merely credential setup. Step 3 must
pass before activating customer traffic. Steps 4/5 require an identified
controlled pilot and customer-approved campaign details. A mock run cannot
certify new-customer readiness.
