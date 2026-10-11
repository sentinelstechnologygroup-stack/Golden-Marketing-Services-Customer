# GCR live-agent inbound callbacks

Approved October 10, 2026. Number +19362499427; GMS-only project gms-prod-1089114348316. No SMS or AI activation.

Daily 09:00–19:00 America/Chicago (Central local time including daylight saving). Server-owned configuration: tenants/tenant-golden-cross-beta/config/inboundCalling and gmsInboundNumberRoutes/3065097412952458363.

Signed Telnyx inbound events identify the tenant by the dialed number and verified connection. Updated October 11: a brief recording notice plays before live routing, without a keypad choice. After-hours voicemail gives the same notice and records after the tone. Record-all applies only after the notice completion event.

During open hours, offers appear to fresh, Available, inbound-enabled agents assigned to the brand. The first acceptance is reserved in a Firestore transaction together with the agent busy state and lead active-call lock. Only the winning agent receives a SIP leg. The caller joins the same conference used by existing hold and handoff controls. Unknown/ambiguous caller numbers create an unverified inquiry instead of guessing an identity or merging existing leads.

An unanswered offer remains queued up to the configured maximum (default ten minutes); callers receive position/options after each 30-second music window, and the private authenticated scheduler repairs expired offers. Agent browser connection timeout is 20 seconds. Voicemail is limited to 120 seconds with a five-second silence timeout. Missed calls and voicemail create deterministic callback tasks.

Recordings require completion of the approved recording notice, verified call attribution, and primary plus backup archive checks. Private downloads use the existing authenticated evidence API and five-minute signed URLs. The S3 media allowlist is restricted to Telnyx telephony-recorder-prod. No provider media URLs or credentials are stored in customer profiles. Retention/deletion remains a separate policy decision; provider copies are retained.

Queue timeout transitions recheck the current status transactionally; stopping a gather during agent connection cannot trigger voicemail. Auxiliary signed conference/recording events may omit call addresses, while lifecycle events still require complete bound attribution.

Outbound calling test restrictions and global recording readiness gates remain unchanged. Inbound call controls require a server-owned inbound binding, the claimed agent, matching tenant/brand, and the configured number.

Validation: schedule/DST, eligibility, expired offers, evidence access, archive checks; frontend lint/build. Live ringing, audio, recording playback and handoff still require an incoming test call.

October 11 flow refinement: recording notice uses a tagged client-state completion event; only that completed prompt opens the queue. Original generated hold music loops for the caller while waiting and connecting, and stops after the agent joins. The conference is prepared before offers appear. Patrick-first / Jonathan-backup handoff order is an explicit server-owned temporary override scoped to the approved test operators; Patrick explicitly approved transferring to his caller number through mobile call waiting; test routing therefore permits that destination and falls back to Jonathan when Patrick is unavailable.

October 11 queue/readiness repair: legacy admin operator role requires fresh super-admin identity and an explicit GCR assignment. Portal presence writes run before outbound availability updates, errors are shown, and queue polls refresh active available presence. Oldest pending caller is offered first. Live callers stay queued for ten minutes by default. A 30-second DTMF window offers 1 for voicemail or 2 for a callback task, with position announcements between windows. Callback requests end the call after confirmation and create a task; automatic reserved-place callback dialing is not enabled. A brief connected announcement supplies an audible transition.
