# GCR live-agent inbound callbacks

Approved October 10, 2026. Number +19362499427; GMS-only project gms-prod-1089114348316. No SMS or AI activation.

Daily 09:00–19:00 America/Chicago (Central local time including daylight saving). Server-owned configuration: tenants/tenant-golden-cross-beta/config/inboundCalling and gmsInboundNumberRoutes/3065097412952458363.

Signed Telnyx inbound events identify the tenant by the dialed number and verified connection. A recording-choice prompt asks callers to press 1 for recording or 2 for an unrecorded conversation. After hours the branded voicemail prompt asks callers to press 1 to leave a recorded message or 2 to request a callback without recording.

During open hours, offers appear to fresh, Available, inbound-enabled agents assigned to the brand. The first acceptance is reserved in a Firestore transaction together with the agent busy state and lead active-call lock. Only the winning agent receives a SIP leg. The caller joins the same conference used by existing hold and handoff controls. Unknown/ambiguous caller numbers create an unverified inquiry instead of guessing an identity or merging existing leads.

An unanswered offer falls back after the provider gather timeout of 45 seconds; a private authenticated scheduler repairs expired offers. Agent browser connection timeout is 20 seconds. Voicemail is limited to 120 seconds with a five-second silence timeout. Missed calls and voicemail create deterministic callback tasks.

Recordings require explicit caller choice, verified call attribution, and primary plus backup archive checks. Private downloads use the existing authenticated evidence API and five-minute signed URLs. The S3 media allowlist is restricted to Telnyx telephony-recorder-prod. No provider media URLs or credentials are stored in customer profiles. Retention/deletion remains a separate policy decision; provider copies are retained.

Outbound calling test restrictions and global recording readiness gates remain unchanged. Inbound call controls require a server-owned inbound binding, the claimed agent, matching tenant/brand, and the configured number.

Validation: schedule/DST, eligibility, expired offers, evidence access, archive checks; frontend lint/build. Live ringing, audio, recording playback and handoff still require an incoming test call.
