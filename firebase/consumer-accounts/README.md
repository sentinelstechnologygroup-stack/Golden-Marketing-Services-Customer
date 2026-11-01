# GCR consumer account release snapshot

See `../../docs/consumer-accounts-and-saved-searches-2026-11-01.md` for scope, source provenance, deployments, security boundaries and acceptance status.

This package preserves the reconciled backend source and shared helpers. Deploy only the explicitly intended function with project `gms-prod-1089114348316` and `--runtime-update-policy on-deploy`; it also contains legacy exports for provenance and is not authorization to redeploy all functions. Never deploy the sites subfolder as a standalone site or copy it over a different baseline without reconciliation.

Run the emulator tests from the GMS workspace root after installing dependencies here (or using the existing local dependency junction):

```powershell
node Customer-Portal/firebase/functions/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --config tmp/sms-workflow-20261030/emulator-config.json --only firestore --project demo-gms-local "node --test Customer-Portal/firebase/consumer-accounts/tests/consumer.test.cjs"
```

Tests refuse to run without the Firestore emulator. Credentials are never checked into this package. Consumer passwords remain in Firebase Auth, and provider credentials remain in GMS Secret Manager.
