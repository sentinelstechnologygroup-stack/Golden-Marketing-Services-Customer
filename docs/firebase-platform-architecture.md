# GMS independent Firebase architecture

The GMS backend is gms-prod-1089114348316, display name GMS Production, project number 852174491354. It has independent Authentication, Firestore, Storage, Functions, service accounts and secrets. LMS is a separate product and no LMS runtime resources are shared.

| Application | Firebase web app ID | Production host |
| --- | --- | --- |
| GMS Website | 1:852174491354:web:622943755a30ad887b5fe3 | www.goldenmarketingservices.com |
| GMS Customer Portal | 1:852174491354:web:2a343214aa5cc41c7b5fe3 | customer.goldenmarketingservices.com |
| GMS Agent CRM | 1:852174491354:web:4d7468295ba977987b5fe3 | agentcrm.goldenmarketingservices.com |

These hosts are required registration targets, not a claim that Auth/App Check
registration has been verified in the cloud. Both portals can initialize
reCAPTCHA Enterprise using `VITE_FIREBASE_APPCHECK_SITE_KEY` plus
`VITE_FIREBASE_APPCHECK_ENABLED=true`; register the hosts,
observe valid tokens and then enforce. The GHL callable boundary currently has
App Check enforcement disabled. Prior acceptance of old hosts is historical.

Tenant membership, agent/brand assignment, fresh server-verified claims, immutable
ownership, Firestore/Storage rules and audit enforce authorization. Browser tenant
IDs and provider location IDs never grant access. Private provider mappings remain
outside tenant wildcard rules. GHL owns CRM activity; Firebase owns identity,
permissions, qualification, customer approvals, billing evidence and audit.

Reserved projects `linkmarketing-customer-portal` and `linkmarketing-website` are
not production targets. Their inventory/state requires authenticated verification;
do not switch runtime configuration to them or delete them as a branding fix.

See [GMS launch execution checklist](gms-launch-execution.md). Retired brand domain
transfers do not apply to this release.
