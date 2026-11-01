# Live internal intake test — November 1, 2026

## Result: partial pass; SMS and full CRM acceptance not established

User authorized an internal test before Meta campaigns scheduled for November 2. At approximately 10:42 a.m. America/Chicago, one clearly labeled INTERNAL TEST request was submitted to the deployed www.homesaroundnorthhouston.com/api/lead endpoint using Patrick's connected work email and his previously tested handset ending 6335. SMS consent was explicitly checked using the live form's north-houston-sms-v4 contract; weekly listings were not requested. This was an HTTP test matching the live form payload, not a browser UI test.

Inquiry reference: 313a3c59676972f9a937345caa4f6553b2d85c9b068f61f6bde5a83a6fecb2ad

| Step | Evidence |
|---|---|
| Live intake | HTTP 202; accepted true; state contact_captured; session returned. |
| Prospect branded email | Received 2026-11-01 16:42:54 UTC; subject We received your message — Homes Around North Houston. This acknowledges receipt; it does not verify email ownership. |
| Office email | Received 16:42:53 UTC; sent to broker@goldencrossrealty.com and copied to Patrick's office address. Correct internal-test message and contact details; no weekly listings. |
| SMS | Patrick explicitly confirmed no text received on handset ending 6335. Provider dispatch and delivery have not been inspected. |
| Consent discrepancy | Submitted smsConsentAccepted true and live version north-houston-sms-v4; office notification nevertheless says SMS permission is not included. Could be stale template text or missing propagation; root cause unverified. |
| Optional qualification skipped | Session exit returned HTTP 202 and the same inquiry reference. |
| Agent queue/callability | Not verified in authenticated production portal/backend. A receipt is not queue-assignment evidence. |
| Customer Portal visibility | Not verified in authenticated production portal. |
| Internal staff SMS alert | Not verified. |
| Duplicate-submission protection | Not certified. Automatic approval review blocked the replay check because it could resend production notifications; do not retry for this test. |

Email evidence:
- https://mail.google.com/mail/u/?authuser=patrick%40sentinelstechnologygroup.com#all/1a197fe1b8882230
- https://mail.google.com/mail/u/?authuser=patrick%40sentinelstechnologygroup.com#all/1a197fe1543cff8b

## Critical source reconciliation

The live website contains newer inquiry-session, GoHighLevel confirmation and SMS-consent/short-verification-link code absent from repository main and not fully represented by the inspected feature branch. Live HANH deployment: dpl_9YX89zK1S2i42zf52QU4dsYytJcS. Live Agent deployment: dpl_CUSmvPdbszENAzPfUaAN1vDz2ESw. Both are direct deployments with empty Git metadata.

The earlier main-based draft SMS implementation is NOT proof of production behavior and must not be deployed over the newer flow. Reconcile actual deployed Firebase/backend source and existing SMS implementation before deciding whether to reuse any part of this draft. Preserve the live intake and emails.

## Remaining access and acceptance

Firebase CLI reports no authorized accounts in this workspace. Plugin discovery lists Firebase as installed but exposes no Firebase tools in this session. Telnyx authenticated management is unavailable, and browser initialization failed earlier. Therefore campaign/number/profile configuration, actual SMS dispatch logs, deployed backend configuration and authenticated portal records remain uninspected.

The October 30 Telnyx capacity notices reported a three-concurrent-outbound-call ceiling. The current resolution is unknown; verify capacity before campaign calling.

No application production deployment or messaging configuration change was made during this test. A daily read-only GMS readiness watch was created; it is not continuous uptime monitoring or a guarantee of delivery.
