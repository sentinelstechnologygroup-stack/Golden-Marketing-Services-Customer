# GMS GoHighLevel connection — implementation checkpoint, 2026-09-30

## Verified account facts

Jonathan's logged-in Golden Cross Realty agency is on Unlimited ($297/month).
With the user's action-time approval, the agency private integration **GMS Agent
Portal** was created with only `locations.readonly`. Its credential is installed
as version 1 of `GMS_GOHIGHLEVEL_CONFIG` in project
`linkmarketing-agent-portal-crm`. A separate read-back from Secret Manager and
live GET `/locations/5GaI30HFH3H9Lzqg3iiO` returned HTTP 200 and matching location
and agency IDs. No token values are recorded here.

Automatic provisioning remains disabled. The agency credential verifies
ownership; it does **not** authorize contacts, conversations, calendars or
opportunities. No subscription was changed, and no
existing client sub-account was modified. The account-creation template picker
recovered. With final user approval, **Golden Marketing Services** was created
using a blank snapshot, sample data OFF, and the GMS-owned account option.
Location ID: `5BAXXiLlxJSiM5tspPQy`. A live agency-token GET confirmed its name,
agency ownership and `America/Chicago` timezone. No unrelated snapshot was used.

With separate user approval, **GMS Portal CRM** was created inside that GMS
location (integration ID `6abdd5215f060fe516bbb0ba`). Its token is installed in
Secret Manager version 2, under `locationTokens[5BAXXiLlxJSiM5tspPQy]`; the
agency credential and other settings were preserved. A separate secret read-back
matched the created token. Three live read requests with the stored credential
returned HTTP 200 and valid arrays: conversations, calendars, opportunities.
Returned counts were respectively 1, 0, 1 (limit 1 on search requests). These
are provider responses, not proof that records are production data or that
the portal integration is complete. No writes or message sends were tested.

Approved location scopes:
`calendars.readonly`, `calendars/events.readonly`, `calendars/events.write`,
`contacts.readonly`, `contacts.write`, `conversations.readonly`,
`conversations.write`, `conversations/message.readonly`,
`conversations/message.write`, `conversations/reports.readonly`,
`opportunities.readonly`, `opportunities.write`, `workflows.readonly`,
`forms.readonly`, `campaigns.readonly`, `emails/campaigns.readonly`,
`locations.readonly`. No payments, user administration, phone-provider or
blanket access scopes were selected. Reputation/reviews scopes were not available
in the searched private-integration scope list; do not claim reputation access.

Official API documentation says automatic location creation requires Agency Pro
($497). Existing/manual sub-account linkage is the current-plan implementation
path. Do not upgrade the agency without a separate user decision.

## Local implementation (not deployed or live-connected)

`gohighlevel-operations.js` defines five Firebase callables. It is deliberately
not exported by `index.js`. The agency credential is now configured, but the
location credential is also installed. Canonical onboarding mapping
reconciliation, authorization tests and portal adapters must be completed before
these callables go live.

- `getGoHighLevelConnection`: Super Admin status, without credentials.
- `connectExistingGoHighLevelLocation`: verifies agency ownership and records a
  one-location/one-tenant mapping transactionally.
- `provisionGoHighLevelLocation`: disabled unless explicitly configured; requests
  the approved snapshot on creation, reserves the attempt before the external
  call, and blocks blind retries after ambiguous provider/network failures.
- `verifyGoHighLevelConnection`: checks the three implemented read resources
  before marking the connection connected. This does NOT imply all GHL features
  or snapshot import completion have been verified.
- `readGoHighLevelResource`: finite, read-only conversations/calendars/opportunities
  calls. Full-tenant administrators only until brand-level filtering is added.

Provider configuration is the server-side Secret Manager secret
`GMS_GOHIGHLEVEL_CONFIG`, JSON containing `companyId`, `agencyToken`,
`snapshotId`, `automaticProvisioningEnabled` (default false), and
`locationTokens` keyed by provider location ID. Never place this JSON in a
frontend `.env`, Firestore tenant document, Git, browser storage or chat.
Use private agency/location credentials for the initial pilot. Agency OAuth
installation, rotating refresh tokens and automatic per-location access remain
unimplemented; agency private tokens must not be assumed to support OAuth token
exchange.

Private metadata is stored outside the tenant wildcard rules:
`gmsProviderConnections/{tenantId}` and `gmsProviderLocations/{locationId}`.
Existing catch-all Firestore rules deny direct client access. Credentials are not
stored in those documents. Tenant `ghlLocationId` is metadata, not authorization.
Callable authorization rechecks the Firebase user and server-owned membership.

## Deliberately untouched

Existing portal layouts, authentication, qualification/handoff decisions,
billing/evidence, Twilio configuration, customer records and production domains.
No new CRM schema, fixture data, public GoHighLevel login, outbound messages,
phone-number purchase or subscription activation.

## Remaining work — do not claim complete

1. Agency and GMS location credentials installed and three CRM read endpoints
   live-tested. Do not broaden the agency token or treat these checks as write
   verification.
2. GMS location exists with a blank snapshot. Build and verify the required GMS
   pipeline/calendar/workflow configuration without unrelated real-estate assets.
3. GMS internal workspace `gms-internal` is linked and verified through the backend.
   The narrow connector uses fresh Auth records; portal App Check remains pending.
4. Clients > Connections exposes verification and bounded CRM lists. Lead Detail
   exposes read-only conversations. Agents require an active brand assignment,
   their own assigned lead, and a backend-owned provider contact mapping.
5. Implement contacts, appointment writes, message send, workflow enrollment,
   reputation/campaign activity and signed, replay-safe webhook normalization.
6. Keep GHL authoritative for CRM activity; Firebase remains authoritative for
   identity, permissions, qualification, billing/evidence and audit. Never let a
   GHL opportunity status alone qualify a lead or create a billable handoff.
7. End-to-end test tenant isolation, loading/empty/error chart structures, forms,
   consent-aware communications, retries and actual live provider data.

## Tests run

Six pure contract tests passed (including the existing website bridge tests).
Six targeted contract/onboarding/emulator tests pass. The permission suite covers
fresh claims, disabled/password-change accounts, cross-tenant/brand/lead denial,
agent assigned-contact success, ownership conflicts and changed-config races.
Emulator provider responses are explicitly mocked, not live integration evidence.
Live maintenance verification connected GMS internal and read conversations,
calendars and opportunities through the backend adapter. No messages were sent.
Provider-contact mappings and signed webhook synchronization remain outstanding;
unmapped leads show an explicit pending error rather than fabricated conversations.

## Primary documentation

- https://marketplace.gohighlevel.com/docs/ghl/locations/create-location/index.html
- https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/index.html
- https://marketplace.gohighlevel.com/docs/ghl/conversations/search-conversation/index.html
- https://marketplace.gohighlevel.com/docs/ghl/calendars/get-calendars/index.html
- https://marketplace.gohighlevel.com/docs/ghl/opportunities/search-opportunity/index.html
