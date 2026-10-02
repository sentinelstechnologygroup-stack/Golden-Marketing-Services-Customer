# GMS execution evidence — 2026-10-02

## Completed and published

- Removed the retired-brand domain-transfer gate from active launch use; the September acceptance record is explicitly historical.
- Corrected website intake default origins to GMS; removed four unreferenced former-brand images and one unused embedded logo module.
- Renamed all three frontend packages with matching lockfile metadata and updated active README/Agent engineering branding.
- Migrated Agent local-storage selection to the GMS key, preserving an existing valid selection through a one-time compatibility read.
- Corrected stale GHL documentation and replaced the Firebase architecture document with current hosts and honest registration/enforcement gates.
- Added server-verified contact linking: fresh Super Admin authorization, canonical client/location ownership, matching provider email or phone, transaction-time revision checks, conflict rejection, private mapping and audit.
- Added App Check initialization behind explicit deployment configuration in both portals. This does not constitute enabled production enforcement.
- Contact linking UI defaults OFF until Firebase deployment and `VITE_GMS_CONTACT_LINKING_ENABLED=true` are verified. App Check defaults OFF until correct domain keys and `VITE_FIREBASE_APPCHECK_ENABLED=true` are configured.
- Fixed emulator-suite concurrency: rules fixtures clear shared data, so cross-file tests must run serially.

## Validation

- Website: lint, typecheck, production build and intake-origin regression passed.
- Customer: lint, typecheck, production build and CSV/XLSX/DOCX/PDF/empty-state report exports passed.
- Agent: lint, typecheck and production build passed.
- Backend Auth/Firestore/Storage, contracts, onboarding and GHL permission suite: 37/37 passed with local emulators. Provider responses are mocked; not live-provider acceptance.
- Live production POST with GMS origin and empty body returned 400 Required fields are missing, confirming it passed origin validation without creating a lead.
- The same empty-body POST with the retired origin returned 403 Origin not allowed.
- GMS www homepage returned HTTPS 200.

## Production release identities

| Surface | Commit | Vercel deployment | State observed |
| --- | --- | --- | --- |
| Website | `ea51000beb38798cb1cd892cf2b56f26f7c356a8` | `dpl_2TwnxaA9osNRtzcjRJtCpCDxKSVn` | READY |
| Customer | `540f2ddbbda14a692844e67aa35c6f188391e426` | `dpl_CpQx1XBXQRd2F2MNFtrt2eNgJJPA` | READY |
| Agent | `bc9e08d5c926b95e6bc60b6397a6f82f1426ce92` | `dpl_4s7QDiNWHRBnSzQNWGbgh6Ljz787` | READY |

Backend source is pushed; a Vercel frontend build does not deploy Firebase Functions. This session has no authenticated Firebase/gcloud deployment credentials or provider-management connector. No production backend change, real call/message, payment charge, subscription change or provider write was made during this pass.

## Remaining required work

[The active GMS execution checklist](gms-launch-execution.md) maps all remaining steps and acceptance criteria. GHL contact upsert, appointment/opportunity writes, message sending, workflow enrollment and signed replay-safe synchronization remain implementation work. Correct cloud App Check registration/enforcement, live telephony/email, payment activation, ad publishing and a real controlled new-customer journey remain unverified. The full platform is not yet certified ready to receive new customers.
