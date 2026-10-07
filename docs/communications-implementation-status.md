# GMS communications implementation — October 6–7, 2026

Production remains gated. Passing software checks is not proof of live audio,
message delivery, recording continuity or successful client access.

## October 7 OAuth callback correction

The first fresh agency-admin installation reached the owned callback but failed
before a credential was saved. Its state was marked `needs_reconciliation`.
The previous handler discarded the failure detail, so the exact original
exception cannot be recovered from that state. The code nevertheless had a
confirmed incompatibility with GHL's documented agency installation flow:
it requested and accepted only Location tokens, whereas agency installation
returns a Company token that must be converted for the selected location.

The corrected callback requests the Company grant, validates agency ownership
and the approved workflow scopes, derives only the state-bound GCR location token,
and verifies its authenticated profile and company before storage. The transient
agency grant is never persisted; only the verified Location token and its refresh
token enter the existing per-location GMS secret. Existing Location refresh logic
and all calling/messaging gates remain unchanged. Fixed failure-stage names and
numeric HTTP statuses provide diagnostics without logging credential values or
provider bodies. Subsequent safe diagnostics confirmed the Company grant had
the exact thirteen approved scopes, but the converted Location token also had
GHL's documented `oauth.readonly` and `oauth.write` protocol permissions. The
policy now accepts only that complete pair in addition to every required CRM
scope; unrelated additions, missing CRM permissions and partial protocol pairs
still fail closed. Permission arrays are normalized with the same checks.
Fifteen focused OAuth/connector tests and lint pass. Live reauthorization succeeded
on October 7: only location `1nMOAalgP22erJpYc5dv` was selected, its verified
Location credential was stored in per-location Secret Manager version 1, and
profile, contacts, calendars, conversations, pipelines and workflows returned
HTTP 200 using that OAuth credential. A controlled real Location refresh then
passed, replaced the refresh token, saved/read back version 2, updated connection
metadata and passed the authenticated profile identity check. Callback revision
`gmscrmoauthcallback-00005-vod` and refresh worker revision
`refreshgmscrmauthorizations-00002-riw` are ACTIVE. The hourly scheduler remains
configured; its future automatic renewal still needs operational observation.
No communications gates were enabled and no SMS or call was sent.

## Ownership and approved scope

Only GMS-Golden Cross Realty location `1nMOAalgP22erJpYc5dv` connects to tenant
`tenant-golden-cross-beta`. The GMS profile and location ID were verified in GHL.
Jonathan's separate GCR account is outside this integration. The canonical Brand
is `brand-golden-cross-realty`; three onboarding records were reconciled with a
seven-record local backup and an audit entry. No records were deleted.

All production infrastructure uses `gms-prod-1089114348316`, its own service
account, Secret Manager and private primary/backup storage. LMS infrastructure
must remain untouched. Provider credentials and OAuth tokens never belong in
client profiles, frontend variables, chat or Git.

Approved workflows: contacts/leads, notes/tasks, opportunities, appointments,
conversations and approved messaging. GHL orchestrates workflows; Telnyx carries
calls/SMS. GHL's configured email service delivers email. Social/marketing
management remains separate from the initial communications implementation.

## Implemented and verified

- Thirteen approved GHL permissions were saved on the location private integration
  and the private GMS CRM and Telnyx Bridge Marketplace app
  `6ac5a8c41c03807b0f29c841`. App version 1.0.0 is live.
- GHL profile, contacts and workflows reads returned HTTP 200. Opening the GMS
  client refreshes shared business details while preserving GMS-specific settings.
- Finite CRM mutations require server-owned location/contact mappings, assignment,
  lead and Brand access, with audit entries, deduplication and reconciliation of
  uncertain writes. Live CRM writes have not yet been tested.
- Owned OAuth begin/callback and hourly refresh endpoints are deployed. Client
  credential is in GMS Secret Manager. Per-location tokens are stored separately;
  only status/IDs/timestamps appear in client metadata. Refresh credentials are
  single-use and uncertain failures never cause blind replay. The hourly scheduler
  passed authenticated invocation; actual OAuth installation and rotation remain pending.
- GMS Telnyx SMS provider `6ac5adf33b3ab6e04a835251` is registered on the app with
  the owned signed delivery endpoint. It is not selected as GCR's default provider.
- GCR messaging profile `4001a114-05ed-45ad-b868-63adb3054c16` is assigned to its
  number and disabled. Both signed HTTP messaging endpoints and both Firestore
  messaging workers are deployed, with owned Eventarc invocation permissions.
- Local SMS bridge enforces owned senders, exact approved text, recipient consent,
  STOP, duplicate suppression, segment and monetary reservations, fresh verified
  rate ceilings and the separately recorded $1 daily testing approval. Signed
  reply/status handling is tested, including early-report retries and terminal-state
  protection. Registration, real delivery and worker activation remain pending.
- Customer administrator email is saved and its tenant-only account/membership is
  prepared. A private password-setup link is available to the GMS administrator;
  no email was sent and customer sign-in has not been tested.
- Agent and Customer production domains are registered in the owned App Check
  configuration. Customer production evidence UI deployment is READY
  (`dpl_E9cuURfzpoCu7TetGN1oPnnTCZD4`). Both secure evidence endpoints are deployed.
- Browser direct dialing is blocked. Server calling dials the provisioned agent
  first, then the authorized lead after a signed answered event. Immutable root
  bindings retain client/Brand/campaign/lead/agent attribution and qualification
  rubric snapshots. Provider credentials never reach the browser.
- Dedicated Call Control app `3065135378978572260` and receive-only SIP connection
  `3065099933334898003` are separate. Call Control remains inactive; actual browser
  outbound rejection is not verified. GCR outbound number is `+19362499427`.
- Signed recording-ready events queue authenticated recording metadata lookup,
  policy/ownership verification, restricted HTTPS media retrieval, WAV validation,
  two private GMS copies and SHA-256 readback. Archive worker is deployed, but
  exact media-host configuration and actual recording tests remain pending.
- Transcription/scoring code preserves channels/timestamps, approved rubric weights,
  literal transcript evidence, model/rubric/transcript versions and human review.
  Audio, transcript and scorecard are independently verified in both archives.
  Analysis start and polling workers are deployed with processing disabled. The
  authenticated two-minute scheduler passed invocation; live analysis verification
  remains pending. Retained provider copies do not consume transcript/scoring slots.
- Provider cleanup code requires two verified copies of every artifact, completed
  processing, explicit deletion approval and retention/legal-hold checks. It deletes
  only Telnyx's copy and audits deletion. Provider deletion remains disabled and
  has not been tested live.
- The Customer Portal offers tenant/Brand-authorized transcript/scorecard access and
  five-minute recording download links, without public objects or persistent
  public download tokens. Actual customer downloads remain untested.
- Direct client writes cannot fabricate or replace Telnyx/AI evidence. Legacy SMS
  and manual recording commands are rejected in favor of the controlled workflows.
- Latest full emulator suite passed 86 tests. Customer lint, type, export and build
  checks passed. Further source/deployment checks are required after any subsequent edit.

## Required before live acceptance

1. Complete the separate Marketplace installation login, select and verify only
   location `1nMOAalgP22erJpYc5dv`, authorize installation, and verify token ownership,
   actual refresh rotation and CRM writes. The regular agency dashboard login alone
   does not complete this installation flow.
2. Finish the normal GCR campaign/client approvals and test-agent onboarding.
   Provision owned receive-only credentials and campaign/Brand assignments.
3. Complete GCR business messaging registration, verify applicable fees and rates,
   select the GMS SMS provider and deploy/activate the guarded bridge workers.
4. Finish recording host/IAM/worker/model configuration and verify private evidence
   access. Required configuration gates must pass before controlled test calling.
5. Run the authorized real test: agent browser connection, lead claim, correct GCR
   caller ID, two-way audio, hold/resume/end, consent, signed CRM updates, audio
   archive, transcript, scorecard, secure customer download and provider cleanup.
6. Test outbound SMS, incoming reply and STOP within the approved test limit.
7. Warm transfer stays disabled until an actual conference test proves recording
   continuity after the agent leaves. A mock hold or conference test is insufficient.

Do not enable `TELEPHONY_ENABLED`, `TELNYX_DIALING_RESTRICTIONS_VERIFIED`,
`GMS_RECORDING_PIPELINE_READY`, messaging or deletion flags merely because a build
passed. Re-check current provider and tenant configuration at activation time.
