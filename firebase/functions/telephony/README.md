# GMS call-center integration

One TELEPHONY_PROVIDER (`twilio`, `telnyx`, or `signalwire`) is selected globally.
TELEPHONY_ENABLED defaults to false. No automatic failover, parallel phone
systems, provider console redirects, or provider branding in agent controls.

## Implemented

- Provider REST adapters: outbound initiation, end, conference create/join,
  participant hold/unhold/mute/remove, recording start, SMS initiation.
- Browser credentials: authenticated Firebase callable issues Twilio voice JWT,
  Telnyx telephony-credential token, or SignalWire subscriber token. Identity is
  server-derived, with credentials in memory only in the browser.
- Telnyx outbound browser calls: the server reserves the authorized lead,
  selects the active number for its tenant and Brand, and returns a correlated
  dial instruction. The browser supplies the agent audio while signed Telnyx
  webhooks bind provider identifiers and status back to the CRM call record.
- Brand recording policy is enforced before dialing. Approved Telnyx calls can
  start dual-channel recording after the provider call is bound; recording
  status and saved URLs are exposed in the tenant-isolated Customer Portal.
- Lead claim/release uses a Firestore transaction and a two-minute renewable lease.
  Call initiation reserves the lead; ambiguous provider failures stay pending for
  reconciliation instead of retrying a potentially successful paid call.
- Availability is stored per authorized agent assignment.
- Consult, cancel, and complete handoff validate the routed customer contact on
  the server. Complete requires an answered consultation callback. Completion
  request is not claimed as a completed customer handoff.
- Provider webhook signatures are checked against canonical configured URLs;
  Telnyx additionally checks timestamp freshness. Events deduplicate under the
  call record and terminal status does not regress. Consultation answers are
  correlated by the consultation leg identifier, not browser assertions.
- SMS requires verified stored consent and respects opt-out flags.
- Recording requires an authorized brand policy and explicit consent when needed.

## Configuration

Secret Manager: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY_SECRET,
TELNYX_API_KEY, SIGNALWIRE_API_TOKEN. The existing callable binds all five;
unused values must be provisioned as `not-configured` until deployment is split
into provider-specific callables. Never put these values in VITE variables.

Server environment: TELEPHONY_PROVIDER, TELEPHONY_ENABLED,
TELEPHONY_VOICE_URL, TELEPHONY_STATUS_URL, TELEPHONY_CONSULTATION_URL,
TWILIO_API_KEY_SID, TWILIO_TWIML_APP_SID, TELNYX_CONNECTION_ID,
TELNYX_PUBLIC_KEY, SIGNALWIRE_PROJECT_ID, SIGNALWIRE_SPACE_URL.
Use provider-specific canonical *_STATUS_WEBHOOK_URL values for validation.
The SignalWire space must be HTTPS at a *.signalwire.com origin.

Active number records use existing tenants/{tenantId}/phoneNumbers fields:
brandId, phoneNumber (E.164), provider, status='active'.
Agent assignment provisioning adds telnyxCredentialId or
signalwireSubscriberReference. Never accept these from the browser.
Deploy the callRecords collection-group indexes before webhook activation.

## Still required before live activation

This change is a development integration, not a certified complete phone system.
The Telnyx outbound agent-to-prospect media path is connected through the WebRTC
SDK. Warm consultation and handoff still require an account-specific conference
workflow that persists conferenceId/agentCallId and routes consultation audio
privately before handoff.
Twilio/SignalWire compatibility conference commands and SignalWire Fabric
browser calls must be explicitly linked by the account's voice application;
Fabric identifiers must not be assumed to equal Compatibility API identifiers.

Inbound number-to-tenant mapping, shared incoming-call dispatch and timeout
requeue, voicemail capture, delivery-status/opt-out SMS webhooks, token refresh,
transcription and GHL evidence synchronization are not completed by these
adapters. They must be implemented and verified before TELEPHONY_ENABLED=true.
Keep the activation gate off until those backend paths are complete. There is
no automatic claim of readiness from a nonempty provider API key.

Validation: node --test firebase/functions/tests/telephony-adapters.test.cjs;
Agent npm run build, npm run test:contract, npm run lint. Credential-free tests
validate transports, signature rejection, replay protection and token identity.
Real audio/queue/transfer acceptance requires a selected configured provider.
