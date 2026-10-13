# GMS assignment-driven communications — draft implementation

Status: NOT DEPLOYED / NOT PRODUCTION APPROVED. No live calling was performed.

## Server contracts

- `communications` actions `browser_session`, `health_check`, `set_availability`
  use authenticated user identity, not a sidebar client. Fresh Firebase Auth user
  records determine Super Admin status; disabled users, mandatory password changes,
  revoked privilege and expired/revoked assignments fail closed.
- Super Admin has every active client in the server deployment environment.
  Other operators require `agentUsers/{uid}/assignments/{tenantId}` with active
  status, enabled state, effective date, explicit `capabilities`, and `lineIds`.
  Capabilities are `read_communications`, `call`, `can_answer_calls`.
- User calling credentials live only in `telephonyIdentities/{uid}`:
  `enabled: true`, `environment: production`, `connectionId`,
  `telnyxCredentialId`, and verified `sipUri: sip:USER@sip.telnyx.com` for inbound
  routing. Each credential must belong to exactly one user. API keys stay in
  Secret Manager. Tokens remain in browser memory. Legacy assignment credentials
  are no longer read for phone registration or exposed by profile/rules reads.
- `getCommunicationsQueue` takes optional narrowing `tenantId`, `kind` (`calls`,
  `voicemail`, `callbacks`), `limit` (max 100), and a returned cursor. Each item
  includes verified tenant/client name, brand, line, campaign, caller, state and
  media availability. Stable tenant/document path order avoids cross-client ID
  collisions; it is intentionally not a global chronological ranking. Every page
  recomputes scope. Empty success is distinct from Auth, permission and provider errors.
- `getCommunicationRecord`, `getCommunicationMedia`, `updateCommunicationsQueue`
  reauthorize the exact record and line. Transitions are audited and idempotent
  using `operationId`; callback creation retains the source client/brand/line.
  `createCommunicationCallback` derives context from an authorized lead and line.
- Playback proxies approved Telnyx audio origins (`media.telnyx.com`,
  `recordings.telnyx.com`) with HTTPS, no redirects, an 8 MiB cap and a second grant
  check after download. It does not issue persistent public media links.
  Other provider origins and larger recordings fail explicitly pending validation.
- `setOperationalGrant` and `getOperationalPermissions` are Super Admin-only.
  Grant updates synchronize an existing legacy assignment mirror, increment the
  permissions version, invalidate availability and audit the actor and change.
  Legacy assignment creation/revocation entry points are also Super Admin-only.
- General record CRUD cannot write call records or callback records; unverified
  edits to phone-number configuration invalidate its verified status. Firestore
  and Storage deny direct access to credentials, raw call media and callbacks.
  Existing tenant paths, aliases, Firebase project IDs and other fixtures remain.

## Inbound routing

Signed Telnyx events resolve the called DID from exactly one verified active
`phoneNumbers` record, verify connection/environment and retain its client/line
and campaign. They record incoming calls and resolve eligible agents using fresh
line/capability grants plus unexpired user availability.

`TELEPHONY_INBOUND_ENABLED=true` is a separate, default-off gate. When approved,
the handler persists dispatch state before dialing each eligible user's server
SIP identity. Signed answer events reauthorize the recipient, select one winner
transactionally, bridge the verified legs and cancel competing legs. Provider
command IDs make bridge retries idempotent. Browser metadata never authorizes a
client, call binding, caller ID or recording. Provider errors retain uncertain
state for manual reconciliation rather than making duplicate calls. No available
agents is represented explicitly, not reported as a successful answered call.

Inbound voicemail greeting/capture, no-answer timeout/reconciliation and retention
remain live-provider validation/integration gates. Existing verified voicemail
records can be accessed through the queue; this change does not fabricate incoming
voicemail or claim provider-side capture is configured.

## Required configuration and migration before activation

1. Deploy reviewed backend/rules and coordinated frontend with
   `TELEPHONY_ENABLED=false`, `TELEPHONY_INBOUND_ENABLED=false` and
   `TELEPHONY_WARM_TRANSFER_ENABLED=false`.
2. Explicitly migrate each agent to one unique, environment-specific credential.
   Verify provider ownership, SIP identity, connection and line assignments;
   never select an arbitrary legacy assignment's credential.
3. Verify every active number with Telnyx and populate `verified: true` only through
   the approved provisioning/verification process. Audit legacy call/voicemail/
   callback records for tenant/brand/line/environment context. Agents cannot read
   records lacking an authorized line. Super Admin can inspect legacy records.
4. Audit token TTL, provider-side destination/caller-ID restrictions and session
   termination after revocation. A valid SDK token can outlive a Firestore grant;
   server checks alone do not revoke the issued provider token. Keep
   `TELNYX_DIALING_RESTRICTIONS_VERIFIED=false` until this boundary is demonstrated.
5. `TELEPHONY_ENVIRONMENT` defaults to production. Demo deployments can read demo
   fixtures but cannot issue calling credentials or execute provider actions.
   Keep separate Firebase/provider resources for demo; request parameters cannot
   switch the server's environment. Existing demo fixtures were not replaced.

## Acceptance evidence (must all pass before merge/activation)

Automated suite uses only `demo-gms-local` Auth/Firestore/Storage emulators and
mock Telnyx transport. It exercises tenantless Super Admin registration, labeled
voicemail access, a shared two-client credential, verified two-client inbound
SIP dispatch/bridging, server-selected outbound caller IDs, outsider/customer/
disabled/stale-claim denial, line/brand/expiry/revocation, empty queues, pagination,
media isolation, audited callbacks and demo/production separation.

Live acceptance is STILL PENDING:
- Super Admin sees the actual two Golden Cross Realty test voicemails in GMS context.
- Super Admin registers without selecting a client and deliberately becomes Available.
- A two-client agent receives and handles actual DID calls in one session with
  correct client greetings, labels, audio and caller IDs.
- Direct list/read/play/download/call/token attempts fail after permission removal;
  measure provider token/session invalidation and in-progress-call behavior.
- Empty/401/403/5xx/timeout/outage behavior is verified in the browser.
- Voicemail recording capture, playback origin/size, missed-call callbacks,
  no-answer timeout and uncertain-dispatch reconciliation pass provider tests.
- Demonstrate demo isolation with no production calling, billing, campaign or
  recording side effects. Document deployment SHA, traces, IAM, rules and rollback.

Rollback: keep all activation gates false; revert the paired code/rules only as a
coordinated rollback. Retain the compatibility assignments and audit trail.
Never restore a credential/media exposure as an operational shortcut.
