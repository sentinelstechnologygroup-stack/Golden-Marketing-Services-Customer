# GMS shared Firebase architecture

The canonical backend is `linkmarketing-agent-portal-crm`, with one Firebase Auth
user directory, Firestore database, Storage bucket and Functions deployment.
The project ID and bucket name are retained compatibility identities.
Desired display name: **GMS Platform Production**; cloud configuration still needs
an authenticated verification pass.

| Application | Firebase web app ID | Current production host |
| --- | --- | --- |
| GMS Website | `1:1089114348316:web:8af2519a66cdddafc778d9` | `www.goldenmarketingservices.com` |
| GMS Customer Portal | `1:1089114348316:web:6d1cf9944ca6ef1cc778d9` | `customer.goldenmarketingservices.com` |
| GMS Agent CRM | `1:1089114348316:web:8df2b05d88d1df8cc778d9` | `agentcrm.goldenmarketingservices.com` |

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
