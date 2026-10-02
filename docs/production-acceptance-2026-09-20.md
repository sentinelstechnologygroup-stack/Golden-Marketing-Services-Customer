# Historical production acceptance record — September 2026

> Archived evidence from before the GMS rebrand. This is not the current launch checklist.
> The retired brand’s domain transfer is not a GMS launch dependency.
> Use [GMS launch execution checklist](gms-launch-execution.md) for active work.

Date: 2026-09-20

## Release identities

- Platform and Customer source: `c8d6bde`
- Agent source: `9ac1694d7611a74bb33e73724581a025323b2c77`
- Platform release tag: `release/lms-platform-app-check-20260920`
- Agent release tag: `release/agent-app-check-20260920`
- Pre-enforcement rollback tag: `backup/pre-app-check-enforcement-20260920`
- Firebase Functions maintenance source: `42bbe1f`
- Firebase Functions maintenance tag: `release/firebase-functions-7.4.0-20260921`
- Firebase Functions Brand-isolation source: `ec6eb09`
- Firebase Functions Brand-isolation tag: `release/agent-brand-isolation-20260921`
- Firebase Functions communications-scope source: `971e57d`
- Firebase Functions communications-scope tag: `release/communications-scope-20260921`
- Firebase Functions routed-contact source: `dbba194`
- Firebase Functions routed-contact tag: `release/routed-contact-security-20260921`
- Customer export release tag: `release/customer-report-exports-20260921`
- Agent production deployment: `dpl_sKJYWhjmU7kgFNk7NACPpzocgDsa`
- Customer known-good deployment: `dpl_EbUPdwcLvmeUvguifP48WSQik3Ni`
- Website known-good deployment: `dpl_H8FJ8yZw1h9GnKKwFRTrztTeDCH5`

## Golden Cross production pilot

- Tenant: `tenant-golden-cross-beta`
- Brand: `brand-golden-cross-realty`
- Lead: `B4EHHkwiZDX7hH0bh3kB`
- Appointment: `rbsAy3jChzj5hD1YDkdY`
- Follow-up: `PqG7OvgwaGU5XNlMDg60`
- Final lead state: `handed_off`
- Server-authorized ingestion: passed
- Assigned Agent visibility: passed
- Qualification and disposition: passed
- Appointment and follow-up creation: passed
- Customer dashboard and report projection: passed
- In-app notification projection: passed
- Agent and Customer recording download: passed
- Unassigned-tenant Function denial: passed
- Customer cross-tenant denial: passed
- Unassigned-tenant Storage denial: passed

The pilot data is synthetic and intentionally retained as an auditable production
acceptance record.

## Security acceptance

- Emulator authorization and bridge suite: 15 of 15 passed.
- Provisioning, server-authorized ingestion, Agent disposition, appointment,
  Customer projection, audit, notification, tenant denial, and Brand denial:
  passed in one repeatable emulator workflow.
- Agent callable collection reads, record writes, lead transitions, appointment
  workflows, and assignment revocation enforce tenant and Brand ownership.
- App Check browser requests: valid tokens observed from Customer and Agent.
- Callable Functions reject missing App Check tokens.
- Authentication, Firestore, and Storage report `ENFORCED` baseline protection.
- Tenant membership, Agent assignment, Brand path, and immutable ownership checks
  remain the primary authorization boundaries.
- Authenticated Golden Cross Agent production regression: passed with all five
  production-tenant leads visible after the Brand-isolation deployment.
- Permanent Realtor demo tenant remained present and independently selectable.

## Export acceptance

- CSV artifact generation: passed.
- XLSX artifact generation and workbook parsing: passed.
- DOCX artifact generation and Office archive validation: passed.
- PDF artifact generation and trailer validation: passed.
- Zero-data report export preservation in all four formats: passed.
- CSV formula-injection escaping: passed.
- Customer production lint and build: passed.
- Authenticated Golden Cross production report page: passed.
- Production CSV, Excel, Word, and PDF controls: passed with no application
  export errors and no browser console warnings or errors.

The repeatable export gate is `npm run test:exports`.

## Communications acceptance

- In-app notifications: passed.
- Recording upload, metadata, and protected download: passed.
- Communication health checks and pre-provider failure handling: passed.
- Outbound call creation now requires an authorized tenant-and-Brand lead.
- Call lifecycle operations require the persisted tenant-and-Brand call record.
- Cross-Brand call attempts are rejected before provider access.
- Outbound calls must match the authorized lead phone number.
- Warm transfers must match the active Client Contact routed to that lead.
- Destination and routed-contact denial tests: passed.
- Twilio voice and transfers: blocked because no Twilio credentials or caller
  number are installed in the production Functions environment.
- External email delivery: blocked because no production email provider is
  configured.
- SMS: optional and blocked by the same missing provider configuration.

No real customer was called or messaged during acceptance testing.

## Retired domain gate

The former brand domain-transfer gate is retired and does not apply to GMS.
Historical deployment aliases below identify past tests only.

## Rollback procedure

1. Set App Check service modes for Authentication, Firestore, and Storage from
   `ENFORCED` to `UNENFORCED` through the Firebase App Check API or console.
2. Check out `backup/pre-app-check-enforcement-20260920` and deploy Firebase
   Functions to remove callable enforcement.
3. If a portal regression exists, use Vercel Rollback to restore the deployment
   IDs recorded above.
4. Confirm `.co` aliases point to the restored deployments.
5. Verify Customer and Agent sign-in, then review Function logs before reopening
   production traffic.

Rollback does not require deleting tenants, records, demos, or Storage objects.

## Agent Firebase entity contract release - 2026-09-21

- Agent source commit: `d93f59a` (`Normalize Firebase entity contract`).
- Production deployment: `dpl_4NcqdpXEjw3Da2sJBR9vZnJA9jpG`.
- Production alias: `https://agent.linkmarketingservices.co`.
- Focused Firebase entity-contract test passed.
- Production Vite build passed.
- Live authenticated Golden Cross verification passed: five leads resolve to `Golden Cross Realty`, Brand activity is populated, and the pilot agent tenant menu remains assignment-scoped.
- The repository-wide lint command remains blocked by 15 pre-existing unused-import errors in legacy page files; none are introduced by this release.

## Agent lint-gate release - 2026-09-21

- Agent source commit: `5645238` (`Clear Agent CRM lint gate`).
- Production deployment: `dpl_A6NgmKwG3nHkax9RDMv7uP1tweRq`.
- Firebase entity-contract test, repository-wide lint, and production build all passed.
- The changes remove unused import names only; no page layout, table, card, form, workflow, fixture, or demo behavior changed.
- Live authenticated verification passed with five Golden Cross leads and correct Brand attribution.

## Complete role-boundary emulator gate - 2026-09-21

- Authorization suite expanded from 15 to 16 tests.
- Added explicit Agent Supervisor Firestore and Storage tenant/Brand boundary coverage.
- Client, Client Supervisor, Client Admin, Agent, Agent Supervisor, and LMS Super Admin boundaries are now represented.
- Browser-supplied tenant ownership, cross-tenant access, cross-Brand access, unsupported uploads, and unauthorized recording paths remain denied.
- `16/16` Auth, Firestore, workflow, and Storage tests passed.
- The emulator command now starts only Auth, Firestore, and Storage because Functions contracts are imported directly by the workflow tests, removing an unrelated startup-timeout warning.

## Golden Cross Client Supervisor acceptance - 2026-09-21

- Added guarded LMS provisioning command `npm run provision:client-supervisor`.
- Provisioned `goldencross.client-supervisor@linkmarketingservices.co` as `client_supervisor` in `tenant-golden-cross-beta`, limited to `brand-golden-cross-realty`.
- Membership and profile records were created through Firebase Admin and an audit event was recorded.
- Live sign-in passed at `https://customer.linkmarketingservices.co/login`.
- All 11 direct Customer Portal routes loaded without authorization or permission errors.
- The authenticated dashboard showed the five Golden Cross leads and two appointments, with no fixture fallback.
- The admin surface keeps user provisioning and permission changes on the trusted backend.

## Post-release monitoring - 2026-09-21

- Agent Vercel production deployment `dpl_A6NgmKwG3nHkax9RDMv7uP1tweRq` remained `Ready` on `https://agent.linkmarketingservices.co`.
- Vercel reported no Agent runtime errors during the post-release window.
- Firebase Cloud Run reported no severity `ERROR` entries during the post-release hour.
- Firebase health endpoint returned `status: ok`.
- Git working trees were synchronized before the monitoring pass.
- DNS/TLS check: all three `.co` hosts returned HTTPS 200; the `.com` hosts still point to transfer/parking addresses and do not yet present working TLS.
- Secret inventory contains only `LMS_INGESTION_KEY`; Twilio and transactional-email credentials remain external release blockers.

## Tenant-aware transactional email release - 2026-09-21

- Added `deliverNotificationEmail`, a Firestore notification trigger using Resend through Secret Manager.
- Delivery requires the tenant workflow `email` channel and honors user email opt-out preferences.
- Messages contain no protected lead details and link recipients back to the authenticated Customer Portal.
- Provider calls use the immutable tenant and notification identifiers as an idempotency key.
- Delivery status and provider message ID are stored on the tenant-owned notification; delivered and failed attempts create tenant audit events.
- The authorization and notification suite passes `19/19` tests.
- Production function state is `ACTIVE` and the post-invocation error scan is clean.
- Production readiness notification `ebvv7ONX5JMhMhrwuFyw` returned `skipped / provider_not_configured`, proving the safe placeholder behavior.
- `RESEND_API_KEY` version 1 is intentionally set to `not-configured`; replace it only after Resend setup and sender-domain verification.

## Twilio Secret Manager hardening - 2026-09-21

- Bound `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` to Firebase Secret Manager for both `communications` and `twilioWebhook`.
- Created non-calling placeholder secret versions using `not-configured`.
- Redeployed only `communications` and `twilioWebhook`; both report `ACTIVE`.
- The full authorization and workflow suite remains `19/19` passing.
- Production webhook readiness probe returned the expected `503 Telephony is not configured` response.
- The only error-class request log is that intentional 503 probe and contains no runtime exception.
- Real calling remains disabled until the Twilio SID, token, approved from-number, and voice webhook configuration are installed.

## LMS Super Admin production acceptance - 2026-09-21

- Corrected `setIndustryConfig` so the approved `lmsSuperAdmin` claim is authoritative while retaining legacy `platformAdmin` compatibility.
- Added guarded command `npm run provision:lms-super-admin`.
- Provisioned `lms.super-admin.test@linkmarketingservices.co` with trusted LMS Super Admin claims and explicit UI assignments across all six tenants.
- Live Agent CRM authentication passed.
- The tenant selector showed Golden Cross production, Golden Cross Demo, internal test tenants, the permanent Realtor Demo, and LMS Sales.
- All 16 direct Agent CRM routes loaded without authentication, authorization, or section-load errors.
- The Admin Portal displayed the complete trusted client-provisioning workflow for tenant, Brand, industry, initial Client Admin, route key, assigned agents, and retention configuration.
- `setIndustryConfig` is `ACTIVE`; Vercel reported no runtime errors during the acceptance pass.
- The privileged browser session was signed out after verification.

## Golden Cross Agent Supervisor acceptance - 2026-09-21

- Extended `createAgentAssignment` to support explicit `agent` and `supervisor` assignments.
- Only LMS or tenant administrators can create Supervisor assignments; Supervisors may create Agent assignments but cannot elevate peers.
- Added guarded command `npm run provision:agent-supervisor`.
- Provisioned `goldencross.agent-supervisor@linkmarketingservices.co` for `tenant-golden-cross-beta` and `brand-golden-cross-realty` only.
- Live Agent CRM authentication passed and displayed exactly one tenant, one Brand, and the five Golden Cross leads.
- Supervisor navigation and the Supervisor route loaded successfully.
- LMS Admin Portal and Settings were absent from navigation.
- A direct `/admin` request redirected to the ordinary dashboard and exposed no client-provisioning controls.
- The privileged test session was signed out after verification.

## Golden Cross Client acceptance - 2026-09-21

- Added guarded command `npm run provision:client-user`.
- Provisioned `goldencross.client.test@linkmarketingservices.co` as `client` in `tenant-golden-cross-beta`, scoped to `brand-golden-cross-realty`.
- Live Customer Portal authentication passed.
- The dashboard showed the five Golden Cross leads and two appointments without fixture fallback.
- All ten ordinary Customer Portal routes loaded without authentication, authorization, or section-load errors.
- Admin Portal navigation was absent.
- A direct `/admin` request redirected to the dashboard and exposed no administrative controls.
- The test session was signed out after verification.

## Consolidated internal release gate - 2026-09-21

- Customer Portal report export verification passed for CSV, XLSX, DOCX, PDF, and empty-state artifacts.
- Customer Portal repository-wide lint passed.
- Customer Portal production build passed.
- Agent CRM Firebase entity-contract verification passed.
- Agent CRM repository-wide lint passed.
- Agent CRM production build passed.
- Firebase Auth, Firestore, workflow, email-contract, cross-tenant, cross-Brand, role, and Storage suite passed `19/19`.
- Expected emulator Secret Manager warnings confirm that local tests do not consume production Twilio credentials.

## Final internal-ready checkpoint - 2026-09-21

- Website, Customer Portal login, and Agent CRM login return HTTPS 200 on `.co`.
- Customer production deployment `dpl_CKoRKWsC2vWRsvY7nNMUWBkqVvKP` is `Ready` and owns `customer.linkmarketingservices.co`.
- Agent production deployment `dpl_A6NgmKwG3nHkax9RDMv7uP1tweRq` is `Ready` and owns `agent.linkmarketingservices.co`.
- The Customer Vercel project already reserves `customer.linkmarketingservices.com`; external DNS/TLS is not yet ready.
- Customer and Agent Vercel error scans are clean after the complete role and route acceptance passes.
- Firebase contains no runtime exception; the sole error-class request is the documented intentional Twilio placeholder 503 probe.
- Internal code, authorization, workflow, export, Storage, role, build, deployment, and monitoring gates are complete.
- External release dependencies remain real Twilio configuration, real Resend configuration, optional SMS decision, provider-backed Golden Cross pilot, temporary credential rotation, and `.com` DNS/TLS cutover.
