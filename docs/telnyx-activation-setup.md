# GMS Telnyx activation setup — 2026-10-03

Calling remains disabled. Resource creation and account verification are recorded separately from calling readiness.

## Account and test setup

The user supplied payment-success and verification-approved notices. A fresh Telnyx account-settings view displayed VERIFIED. Payment, account verification and two-factor setup are complete according to the supplied evidence. The earlier Voice API application save succeeded and was verified in the application inventory.

Created resources:

- GMS Production Voice API: 3062716158479172720, active, with the independent GMS webhook URL.
- GMS Controlled Testing outbound profile: 3062722605057312505. Saved settings: United States only, one outbound channel, maximum destination rate 0.05, daily spend limit 1.00, automatic outbound recording disabled. The profile is not yet assigned to a connection/application. These ceilings do not authorize purchases or calls.
- The account webhook-verification public key was validated as 32-byte base64 and deployed to the GMS communications and telnyxWebhook server environments. Both functions were confirmed ACTIVE with calling, warm transfer and dialing-restrictions verification still disabled. An unsigned webhook was rejected. No privileged API key is stored in this document.

The GMS Production WebRTC credential-connection form is prepared. Connection creation and the dedicated GMS API key remain pending the required confirmation for persistent access. No API key has been created, copied or stored by this setup run.

Test-number area: Woodlands/Conroe. Purchase and initial account-credit budgets, test-agent identity and consenting test-recipient identity are pending. No number purchase or test call has been made.

## GMS connection configuration

- Use an independently owned GMS credential-based SIP connection for WebRTC, with separate on-demand telephony credentials for agents.
- Name: GMS Production WebRTC. Match TELNYX_CONNECTION_ID to that credential connection for the current browser-dial and signed-event workflow; a Voice API application ID is not interchangeable with a credential connection ID.
- Separate Voice API application: GMS Production Voice API, created and confirmed. It is not the parent connection for browser credentials.
- Webhook URL: https://us-central1-gms-prod-1089114348316.cloudfunctions.net/telnyxWebhook
- Webhook API version: 2. Configure fail-closed timeout handling where supported.
- Create a GMS outbound voice profile with conservative concurrency, destination and spending limits. No provider-wide automatic recording.
- Provider-side destination and caller-ID restrictions, or a fully implemented parked-call/server-controlled workflow, must be proven before marking dialing restrictions verified. Parking by itself is not an implemented authorization workflow.

## Private backend configuration

Project: gms-prod-1089114348316. Store the GMS Telnyx API key in the existing TELNYX_API_KEY Secret Manager resource; never put it in source, frontend configuration, logs or chat. Obtain the Telnyx account's public verification key and validate its format before storing it in server configuration.

Set TELNYX_CONNECTION_ID, TELNYX_PUBLIC_KEY, TELNYX_STATUS_WEBHOOK_URL and TELEPHONY_STATUS_URL. Both webhook variables must match the URL above. Preserve TELEPHONY_PROVIDER=telnyx and DEFAULT_RECORDING_POLICY=record_on_consent.

Keep TELEPHONY_ENABLED=false, TELEPHONY_WARM_TRANSFER_ENABLED=false and TELNYX_DIALING_RESTRICTIONS_VERIFIED=false throughout setup. Redeploy affected GMS functions after storing real configuration. Validate account/connection identity, signatures and fail-closed behavior before the later activation stage.

## References

- https://developers.telnyx.com/docs/voice/webrtc/auth/credential-connections/index
- https://developers.telnyx.com/docs/voice/webrtc/use-cases/contact-center
