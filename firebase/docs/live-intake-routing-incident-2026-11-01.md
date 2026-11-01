# Production intake incident — November 1, 2026

Owner submitted a property inquiry through HomesAroundNorthHouston.com and reports neither an SMS nor a lead in the Agent inbox/workspace.

Verified office email evidence:
- Initial property inquiry 2026-11-01 10:49:52 Central, for 215 Garden West Road, MLS 2522140.
- Updated inquiry 10:50:19 Central, with Montgomery County and maximum $350,000 preferences.
- Both notifications state that SMS permission is not included. This is not proof of the stored consent state; the email template may be stale.

Current production configuration independently inspected:
- Vercel project homes-around-north-houston-v1 / prj_V4Tw5YiZwlGW38hPkWWnv50TGn1m.
- INQUIRY_GHL_ENABLED=true (production).
- GMS_SEARCH_INTAKE_URL=https://gmswebsitesearchintake-bsy3o4ymea-uc.a.run.app.
- The live Agent bundle queries getAgentCollection under the user's authorized tenants. It does not itself establish or repair the website-to-lead projection.

The initial inquiry and preference update reached the branded notification path. The owner's missing Agent record plus missing SMS is an unresolved production routing/messaging incident, not a successful end-to-end intake. Investigate the deployed gmswebsitesearchintake handler: resolve the exact inquiry receipt/contact, find or prove absence of the tenant/brand lead projection, inspect assignment/customerVisible/lifecycle fields and duplicate or hidden-test filtering, inspect consent propagation and SMS dispatch status/provider errors. Reconcile deployed source before editing.

Required repair acceptance: recover the existing inquiry without duplicate emails or marketing enrollment; prove it appears under the correct tenant/brand in both portals with an authorized calling assignment; repair prospective intake projection before returning success; verify approved number/profile/campaign and consent, then send an authorized internal SMS and prove receipt and verification. Preserve currently functioning branded email delivery.

Do not blindly disable INQUIRY_GHL_ENABLED or deploy the older main-based prototype: the alternative ingestion route and current source parity have not been verified. Production Firebase/Cloud Run administrative access remains unavailable in this workspace, so no server repair or deployment has been performed.

Evidence messages:
- https://mail.google.com/mail/u/?authuser=patrick%40sentinelstechnologygroup.com#all/1a1980478593957c
- https://mail.google.com/mail/u/?authuser=patrick%40sentinelstechnologygroup.com#all/1a19804e4649a33e
