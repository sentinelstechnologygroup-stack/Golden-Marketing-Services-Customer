# Customer Portal Firebase Release Contract

## Permanent environment boundaries

- `tenant-gms-realtor-demo` is the permanent neutral Realtor demo. It may use fixtures and must not be changed by production migrations.
- Golden Cross Realty is a live beta tenant. It must use tenant-scoped Firebase records and must never inherit demo fixtures.
- All other customer tenants use live Firebase data. Empty tenants retain every page, card, form, filter, table header, and workflow control while displaying zero or empty rows.
- Agent CRM records and customer records share the canonical `/tenants/{tenantId}` contract. Customer users never receive Agent CRM-wide permissions.

## Canonical roles

- `client`: reads tenant-facing records and performs permitted customer workflows.
- `client_supervisor`: client access plus team visibility and operational oversight.
- `client_admin`: client supervisor access plus profile, invitation, membership, and tenant settings management.
- `gms_super_admin`: privileged GMS support access granted only by a Firebase Auth custom claim.

Legacy `customer`, `supervisor`, `admin`, and `super_admin` membership values are normalized by the Functions layer during migration. A browser-supplied role or tenant identifier never grants access.

## Authentication and authorization

- Firebase Authentication owns sign-in, password recovery, sessions, and logout.
- Every customer read or write derives authorization from the authenticated UID and `/tenants/{tenantId}/members/{uid}`.
- GMS super-admin access requires the `gmsSuperAdmin: true` custom claim; a string role in browser data is insufficient.
- Agent access is derived from `/agentUsers/{uid}/assignments/{tenantId}` and is separate from customer membership.
- Firestore and Storage rules deny cross-tenant access even if a caller guesses another tenant ID or document path.

## Live data and writes

- Dashboard and report metrics are calculated server-side from the tenant's own leads and appointments.
- Leads, appointments, billing, documents, support, notifications, security, profiles, memberships, and invitations use tenant-scoped Firebase adapters.
- Profile, business, invitation, role, status, support, billing-review, notification, security, and document-metadata writes use authorized callable Functions.
- Documents use `tenants/{tenantId}/documents/{documentId}/{fileName}` and validate size and content type before metadata is committed.
- Collections materialize when the first valid record is written. No production placeholder documents are required.

## Release order

1. Create an annotated Git backup tag and record the current production deployment URL.
2. Run the application build and lint checks.
3. Run Firestore and Storage emulator isolation tests.
4. Deploy Firestore rules, indexes, Storage rules, and Functions.
5. Deploy the Customer Portal production artifact.
6. Inspect the production deployment and scan runtime logs.
7. Verify sign-in, recovery, direct routes, tenant empty states, protected writes, uploads/downloads, and exports with authenticated test accounts.

## Rollback

1. Re-point Vercel production to the recorded prior deployment.
2. Check out the annotated backup tag for the matching source state.
3. Redeploy the prior Firestore rules, indexes, Storage rules, and Functions from that tag.
4. Do not delete tenant records during rollback; schema changes are additive and adapters tolerate absent optional fields.
5. Confirm the permanent Realtor demo and Golden Cross beta tenant independently after rollback.

## Deferred external release items

Custom domains, final TLS aliases, and domain-specific public-site review remain deferred until the Namecheap registrar work is complete. These do not block the Firebase-backed Vercel portal release.
