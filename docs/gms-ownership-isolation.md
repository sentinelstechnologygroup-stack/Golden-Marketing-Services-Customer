# GMS ownership isolation — 2026-10-03

GMS runtime ownership is moved to Firebase project `gms-prod-1089114348316`. Authentication, Firestore, Storage, Functions, service identity, and secrets are independent of LMS. GMS Agent, Customer and Website remain in their own repositories and Vercel projects. No LMS provider credentials are reused.

## Preserved behavior before cutover

Preserve all Agent CRM routes, Customer Portal layouts/forms, invitation and onboarding flows, tenant permissions, campaign/brand attribution, call evidence, consent enforcement and website consent/lead intake. Only the runtime project, GMS claim names, independent secrets, webhook endpoint and brand names change. Live calling and warm transfer remain disabled. Existing connection verification is invalidated and must pass against GMS credentials.

## Demo and reset scope

The Realtor demo is independently copied as `tenant-gms-realtor-demo`, brand `brand-gms-realtor-demo`, and sign-in `realtordemo@goldenmarketingservices.com`. Imported password hashes preserve existing passwords without storing plaintext. The original LMS demo remains in LMS. GMS data and relevant identities are copied; no original production data is deleted. The earlier reset manifest requires a new review against the dedicated GMS project and must exclude the preserved Realtor demo. No reset is authorized by this migration.

## Remaining activation requirements

Configure independent Telnyx, GoHighLevel and email-provider credentials. Verify client connections again. Complete Golden Cross onboarding and number purchase, then pass calling tests before enabling telephony. Original project backup is retained privately for recovery, not as a runtime dependency.
