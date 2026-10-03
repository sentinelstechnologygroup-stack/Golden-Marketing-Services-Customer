# Golden Marketing Services Firebase Backend Contract

## Canonical ownership

- Backend project: `gms-prod-1089114348316`
- Firestore location: `nam5`
- Website project: `golden-marketing-services` (public application/hosting boundary)
- Customer project: `golden-marketing-services-customer` (customer application/hosting boundary)
- Development uses the Firebase Emulator Suite and the demo project only.
- Demo tenants are vertical-specific and isolated from production. The initial model is `firebase/demo/real-estate-demo.json` for a neutral Realtor demonstration. Golden Cross Realty remains a separate beta tenant. Future verticals reuse the same portal contracts with separate configuration and tenant data rather than sharing records.

## Tenant and identity model

All operational data is owned by a tenant. The tenant identifier is the Firestore document ID under `/tenants/{tenantId}`. A user is authorized only when a server-created membership exists at `/tenants/{tenantId}/members/{uid}` with `active: true`.

Membership fields:

- `uid`, `tenantId`, `role`, `active`
- `email`, `displayName`
- `brandIds` (optional restricted brand scope)
- `createdAt`, `updatedAt`, `invitedBy`, `lastSignInAt`

The client may read its own membership. It may not create, update, delete, or select membership records. Functions using the Admin SDK create invitations, approve memberships, assign roles, and revoke access.

## Roles and permissions

- `admin`: platform owner; manages tenant configuration, memberships, and all operational data.
- `supervisor`: manages leads, follow-ups, appointments, scripts, forms, routing, and operational reviews within the tenant.
- `agent`: reads assigned operational data and may update assigned leads, calls, notes, and follow-ups.
- `auditor`: read-only operational and audit access within the tenant.
- `customer`: read-only access to customer-facing leads, appointments, reports, billing, documents, notifications, and support records for the assigned tenant.

No role is accepted from browser input. The server derives authorization from the verified Firebase UID and membership document.

## Collections

Tenant collections preserve the migrated CRM fields and require `tenantId` to equal the parent tenant ID. Initial collections are: `organizations`, `brands`, `campaigns`, `leadSources`, `leads`, `followUpTasks`, `communicationAlerts`, `callRecords`, `callTranscripts`, `callQualityReviews`, `appointments`, `businessOwners`, `scripts`, `qualificationForms`, `routingRules`, `phoneNumbers`, `reports`, `billing`, `invoices`, `documents`, `supportRequests`, `notifications`, and `auditLogs`.

Required common fields for tenant-owned documents: `tenantId`, `createdAt`, and `updatedAt`. Audit documents additionally require `actorUid`, `action`, and `occurredAt`; clients cannot write audit documents.

## Authentication, invitations, and MFA

- Email/password sign-in is invitation-only; public account creation is disabled.
- Functions create one-time invitation records and send the setup link through the approved email provider.
- Password reset uses Firebase Auth’s managed recovery flow.
- MFA is required for `admin` and `supervisor` before pilot access; the client must complete MFA enrollment before privileged actions are enabled.
- Disabled memberships and disabled Auth users are denied by rules and Functions.
- Sign-out and token refresh use Firebase Auth; no long-lived tokens are stored in browser storage.

## Migration and retention

The former platform remains the migration source until entity counts, fields, relationships, permissions, and workflow outcomes reconcile in staging. Migration is read-only and staged. A recoverable export is retained outside the application repository until the owner approves deletion. No production customer data is written to the new backend until parity, security, legal, and pilot gates pass.
