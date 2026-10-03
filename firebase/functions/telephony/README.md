# GMS Telnyx integration

Telnyx is the only production phone provider. TELEPHONY_ENABLED defaults to
false and TELEPHONY_WARM_TRANSFER_ENABLED stays false until conferencing and
recording continuity after agent departure pass an end-to-end test.

Store TELNYX_API_KEY only in Google Secret Manager. Server configuration uses
TELNYX_CONNECTION_ID, TELNYX_PUBLIC_KEY, TELNYX_STATUS_WEBHOOK_URL,
TELEPHONY_STATUS_URL and DEFAULT_RECORDING_POLICY=record_on_consent.
A disabled deployment can use the literal not-configured for the API secret;
this is not a working credential or proof of readiness.

Onboarding stores telnyxPhoneNumberId and an E.164 phoneNumber, with provider
set to telnyx. Draft identifiers remain unverified. Purchased numbers must be
verified against Telnyx before activation, and assigned under the correct
tenants/{tenantId}/phoneNumbers record and brandId. Campaign-specific numbers
take precedence; ambiguous assignments reject dialing.

Agent assignment telnyxCredentialId stays server-side. Only short-lived calling
tokens enter browser memory. Browser state cannot authorize provider call
binding or recording. Signed webhooks correlate a matching connection, tenant,
number and destination; recording requires the stored policy and consent.

TELNYX_DIALING_RESTRICTIONS_VERIFIED stays false until provider-side restrictions
or a server-controlled media workflow prevent SDK token holders from dialing
arbitrary destinations or choosing another tenant's caller ID. A server-selected
browser dial instruction alone does not establish this security boundary.

Deploy from firebase/firebase.json using the production project
linkmarketing-agent-portal-crm. If Firebase CLI login fails, gcloud can deploy
these same second-generation functions. Keep calling disabled during deployment.

Inbound dispatch, voicemail, SMS delivery/opt-out callbacks, token refresh,
transcription and conference handoff still require separate implementation and
validation. Do not infer readiness from successful builds or an API key.
