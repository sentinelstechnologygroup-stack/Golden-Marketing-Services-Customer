# Consumer accounts and independent saved searches — November 1, 2026

## Scope and identity

GoldenCrossRealty.com and HomesAroundNorthHouston.com share the existing consumer Auth project `gcr-visitor-preview-2026`. This is separate from GMS staff/broker authentication and is not LMS. Email-link sign-in is enabled; existing password users retain password sign-in. Both sites expose `/account` and My account navigation.

The GMS project remains `gms-prod-1089114348316`. Account records live under `tenants/tenant-golden-cross-beta/consumerAccounts/{sha256(consumerProject:uid)}`; independently scheduled searches are in `consumerSavedSearches`. Existing GMS deny-all browser Firestore rules are unchanged. Consumers access these records only through a backend that verifies a current, non-revoked, verified-email token from the consumer project. Staff tokens are not accepted. The GMS runtime has only Auth viewer and Datastore viewer in the consumer project, for account-status checks and read-only legacy-save migration.

## Behavior

- First verified sign-in durably creates the account and a CRM sync job. Registration does not create a lead, callback task, qualification result, or billing credit.
- GoHighLevel contact matching uses the verified email in the owning GCR location `1nMOAalgP22erJpYc5dv`. An unverified phone is never used as an upsert identity. Subsequent profile changes update the mapped contact. The UI reports saved/pending sync independently of the background provider job.
- Profile name and optional phone are editable. Email changes use Firebase's verify-before-update flow; the backend accepts the new email only after Auth verification for the same UID and rejects conflicting account ownership.
- Up to 50 named searches and 50 homes per account. Legacy saves migrate without enabling email for a merely saved search. Existing requested weekly searches can migrate as subscribed, subject to suppression.
- Each search retains its own filters, including property type, lot sizes, new construction, and drawn map criteria. Frequencies are off, daily, twice weekly (Monday/Thursday), or weekly (Monday), scheduled at 9 a.m. Central with DST handling.
- Each search has its own delivery identity. Emails for separate searches can reach the same person independently. Signed preference pages distinguish stopping one search from stopping all property emails. GET never unsubscribes; a deliberate POST is required. Deleting a search stops its future delivery while preserving other searches.
- Account communication controls cover property email, inquiry/customer-care SMS, and callbacks. STOP is not removed by a checkbox or a new form. Existing provider DND is checked and mirrored; only a newer explicit verified-account permission revision can renew an allowed channel. No qualification or billing evidence is invented.
- For a signed-in visitor whose verified email matches the submitted inquiry, successful form receipts can be adopted into the account. The backend verifies the persisted receipt/email and imports the explicit choices and weekly search. The initial contact and later completed-preferences revisions are independently idempotent. Pending browser adoption references retry on later profile loads. Anonymous inquiries continue through the existing intake and do not silently change another person's account preferences.
- GoHighLevel receives contact/profile updates, channel DND settings, an account tag and bounded readable search summaries. Complete structured searches remain in Firebase. This does not publish or enroll the unrelated native AI workflow.

## Durable processing and limits

`gmsConsumerMaintenance` is private and invoked every minute by `gms-consumer-maintenance` using the existing GMS service identity. Jobs use leases and revision checks, retry with backoff, and notify the admin after repeated CRM failures. Synced profiles refresh external restrictions on a ten-minute interval; the email sender also rechecks provider DND at delivery. Website email/SMS suppression is recorded immediately when disabled; existing matching lead callbacks are blocked in the account preference transaction.

Search emails use the established public IDX renderer and HighLevel sender. Only already-public permitted listing fields are used. Provider-uncertain sends are held for review rather than sent twice; preflight failures can retry. Legacy weekly delivery skips records adopted by a consumer account, preventing parallel old/new subscriptions. Working inquiry email/SMS/call intake is preserved.

Patrick explicitly approved connecting the existing GMS billing account. Billing is now enabled for the consumer project, and a readback confirmed its billing account exactly matches GMS. Firebase’s published Blaze allowance is 25,000 email-link sign-in emails/day (subject to provider abuse controls), replacing Spark’s 5/day allowance. No new billing account or Firebase project was created. Official limits: https://firebase.google.com/docs/auth/limits.

## Source and releases

Recovered North source baseline: `dpl_9YX89zK1S2i42zf52QU4dsYytJcS` (210 files hash-verified). GCR baseline: production git commit `a92fcab3241dd2c7f9cc42cac1799aec1316262e` / `dpl_5eCwSXnhNjMYLxVcFzswRuq69EeF`, in a detached isolated worktree. No dirty main checkout was deployed. New backend source was based on the exact deployed weekly-function source archive, preserving existing intake helpers. Runtime policy remains `on-deploy`.

Final website deployments:

- North: `dpl_5rJyCVL1DDbHjYAfg1MeS5BC4jRH`.
- GCR: `dpl_9iiJTgXc3SBoGxTowy1uqLKrYdSa`.

Backend services: `gmsConsumerAccount` (public transport, verified consumer token required except signed unsubscribe pages), `gmsConsumerMaintenance` (private), and `gmsWeeklyMatchingEmails` revision `gmsweeklymatchingemails-00003-mob` (legacy adopted-record skip). Account revision: `gmsconsumeraccount-00004-woj`; maintenance revision: `gmsconsumermaintenance-00005-lay`. Read current revision metadata before the next change. Preserve all secrets, IAM and existing function settings.

Reviewable backend snapshot and tests: `firebase/consumer-accounts/`. The `sites/` subfolder contains changed frontend files plus baseline manifests, **not complete deployable websites**. Full isolated site release directories remain in the GMS workspace at `tmp/consumer-accounts-20261101/{north,gcr}`. Review branches and draft PRs preserve the live site source: GCR https://github.com/sentinelstechnologygroup-stack/golden-cross-realty-v2/pull/16 and North https://github.com/sentinelstechnologygroup-stack/homes-around-north-houston-v1/pull/5. These have not been merged into the websites' main branches; future content/website deployments must reconcile production source and retain these changes. Do not deploy the older Customer PR5 or Agent PR4.

North's production build check previously probed retired `ingestWebsiteLead` and failed with 409. It now selects the active inquiry service when `INQUIRY_GHL_ENABLED=true`, using deliberately invalid data and expecting a 400 before any lead/email is created. The legacy route check remains for legacy mode; no approval guard was bypassed.

One root-directory deployment process was stopped before it created any deployment. Verified zero new deployments for the main GMS website and its existing production release unchanged.

## Validation and remaining acceptance

Both site lint/build checks passed; production county/price-reduction/intake release checks passed for North. Both account pages render in the browser with correct titles. Live unauthorized account calls return 401, private maintenance returns 403 without OIDC, invalid preference links return 400, and account responses carry no-referrer/noindex headers. Both public search endpoints remain enabled and return 48 actual Conroe listings. GCR's owning CRM profile is readable using the current integration. Scheduled maintenance has returned 200.

Ten emulator checks pass: owner isolation, forged IDs, stale revisions/type injection, per-search editing/deletion, one-vs-all unsubscribe and token tampering, two independent same-email deliveries and replay, contact sync without lead creation, frequency/filter isolation, STOP preservation, receipt ownership/idempotency, and uncertain-send review without duplicate delivery.

**Patrick's live acceptance remains:** request an actual sign-in link, finish sign-in, save the profile, confirm the actual GHL contact link, save two different searches, change their frequencies, pause one, and confirm the other remains subscribed. Confirm SMS/callback controls and an accepted inquiry's explicit preferences while signed in. No new consumer account was marked verified or fabricated for an internal test, and no live marketing emails/calls were sent by these account release checks.
