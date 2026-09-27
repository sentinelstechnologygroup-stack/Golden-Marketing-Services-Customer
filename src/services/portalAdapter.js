// Golden Marketing Services — Customer Portal Service Adapter
// ----------------------------------------------------------------------------
// This is the ONLY layer that talks to a backend. Every page and component
// imports from here; nothing in the portal calls portalAuthClient or any data source
// directly. To go live, set VITE_CUSTOMER_PORTAL_API_URL and implement the
// matching endpoints server-side — no UI changes required.
//
// Contract (preview shapes mirror production responses):
//   GET    /auth/session
//   POST   /auth/session            { email, password, trustDevice }
//   DELETE /auth/session
//   POST   /auth/mfa/verify          { code, method, trustDevice }
//   POST   /auth/recovery/request    { email }
//   POST   /auth/recovery/complete    { token, password }
//   GET    /dashboard
//   GET    /leads                    ?search&source&campaign&service&stage&...
//   GET    /leads/:id              includes lifecycleStage, verificationStatus,
//                                  handoffStatus, handoffEvidence, intentScore,
//                                  consentRecorded, qualification and acceptance evidence
//   GET    /appointments
//   GET    /reports                  ?range&compare
//   GET    /billing
//   GET    /billing/invoices/:id
//   POST   /billing/reviews          { invoice, reason, note }
//   GET    /documents
//   POST   /documents                FormData
//   GET    /support
//   POST   /support                  { type, subject, priority, body }
//   GET    /notifications
//   PATCH  /notifications/preferences { preferences }
//   GET    /security
//   GET    /account
//   GET    /account/users
//   POST   /account/users/invite      { email, role }
//
// All live requests use credentials: "include" + cache: "no-store" (secure
// cookie sessions). No tokens, passwords, or secrets are persisted in the
// browser. Preview mode never transmits entered credentials anywhere.

import {
  sampleSession, sampleDashboard, sampleLeads, sampleAppointments,
  sampleReports, sampleBilling, sampleInvoice, sampleDocuments,
  sampleSupport, sampleNotifications, sampleSecurity, sampleAccount,
} from "./sampleData";
import { firebaseAuth, firebaseConfigured, firebaseFunctions, firebaseDb, firebaseStorage } from "@/lib/firebaseClient";
import { httpsCallable } from "firebase/functions";
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

const API_URL = (import.meta.env && import.meta.env.VITE_CUSTOMER_PORTAL_API_URL) || "";
const PREVIEW_DATA_ENABLED = (import.meta.env && import.meta.env.VITE_PORTAL_PREVIEW_DATA === "true");
const UI_FIXTURES_ENABLED = (import.meta.env && import.meta.env.VITE_PORTAL_UI_FIXTURES === "true");
const BYPASS_ENABLED = (import.meta.env && import.meta.env.VITE_PORTAL_BYPASS_AUTH === "true");
const BYPASS_TOKEN = (import.meta.env && import.meta.env.VITE_PORTAL_BYPASS_TOKEN) || "";
const BYPASS_KEY = "link-marketing-portal-bypass";
export const isPreviewMode = PREVIEW_DATA_ENABLED;
export const isFixtureDataMode = PREVIEW_DATA_ENABLED || UI_FIXTURES_ENABLED;
export const isFirebaseMode = firebaseConfigured && !API_URL;
const DEMO_TENANT_IDS = new Set([
  "tenant-lms-realtor-demo",
]);
let activeTenantId = null;

const toPortalSession = (profile, user) => {
  const membership = profile?.memberships?.[0] || {};
  activeTenantId = membership.tenantId || null;
  const name = profile?.displayName || user?.displayName || profile?.email || user?.email || "Customer";
  return {
    ...profile,
    user: { id: profile?.uid || user?.uid, name, email: profile?.email || user?.email || "", role: membership.role || "customer", initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() },
    company: { name: membership.tenantName || membership.organizationName || membership.tenantId || "Customer organization", programStatus: membership.active ? "Active" : "Inactive" },
    tenantId: membership.tenantId || null,
  };
};

const isNode = typeof window === "undefined";
const readBypassFromQuery = () => {
  if (isNode) return false;
  try {
    const queryToken = new URLSearchParams(window.location.search).get("portal_bypass_token");
    if (!BYPASS_ENABLED && !BYPASS_TOKEN) return false;

    if (queryToken && BYPASS_TOKEN && queryToken === BYPASS_TOKEN) {
      window.sessionStorage.setItem(BYPASS_KEY, "granted");
      return true;
    }

    if (BYPASS_ENABLED && !BYPASS_TOKEN) {
      return true;
    }

    return window.sessionStorage.getItem(BYPASS_KEY) === "granted";
  } catch {
    return false;
  }
};

// Always let local developers reach the workspace. Production bypass remains
// an explicit deployment setting and must never be inferred from a URL alone.
export const isBypassMode = () => Boolean(import.meta.env.DEV || BYPASS_ENABLED || (isPreviewMode && readBypassFromQuery()));
const isDataFixtureMode = () => Boolean(
  isBypassMode()
  || PREVIEW_DATA_ENABLED
  || (UI_FIXTURES_ENABLED && DEMO_TENANT_IDS.has(activeTenantId))
);
export const isFixtureDataActive = () => isDataFixtureMode();

// Keep the complete UI contract when a live tenant has no records yet.
const emptyFromShape = (value) => {
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, emptyFromShape(child)]));
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  return "";
};
const mergeShape = (shape, value) => {
  if (Array.isArray(shape)) return Array.isArray(value) ? value : [];
  if (shape && typeof shape === "object") {
    const source = value && typeof value === "object" ? value : {};
    return Object.fromEntries(Object.entries(shape).map(([key, child]) => [key, mergeShape(child, source[key])]));
  }
  return value === undefined || value === null ? emptyFromShape(shape) : value;
};
const normalizeLive = (shape, value) => mergeShape(emptyFromShape(shape), value);
const normalizeDashboard = (value) => normalizeLive(sampleDashboard, value);
const normalizeReports = (value) => {
  const normalized = normalizeLive(sampleReports, value);
  normalized.metrics = Object.fromEntries(Object.entries(normalized.metrics).map(([key, metric]) => [key, typeof metric === "number" ? { value: metric, change: 0 } : { value: metric?.value ?? 0, change: metric?.change ?? 0 }]));
  return normalized;
};
const asIso = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
};
const normalizeLeadRow = (row) => {
  const qualificationData = row.qualificationAnswers || row.qualification_data || [];
  const qualificationAnswers = Array.isArray(qualificationData)
    ? qualificationData
    : Object.entries(qualificationData || {}).map(([q, a]) => ({ q, a: typeof a === "object" ? JSON.stringify(a) : String(a ?? "") }));
  const acceptanceRaw = row.customerAcceptance || row.owner_acceptance_status || row.ownerAcceptanceStatus || "Pending";
  const customerAcceptance = String(acceptanceRaw).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  return {
    ...row,
    name: row.name || [row.firstName || row.first_name, row.lastName || row.last_name].filter(Boolean).join(" ") || row.email || "Unnamed lead",
    source: row.source || row.sourceName || row.sourceId || row.lead_source_id || "—",
    campaign: row.campaign || row.campaignName || row.campaignId || row.campaign_id || "—",
    service: row.service || row.serviceName || row.industry || row.industryId || "—",
    location: row.location || row.market || row.city || "—",
    stage: row.stage || row.lifecycleStage || row.lifecycle_stage || row.status || row.lead_status || "New",
    lifecycleStage: row.lifecycleStage || row.lifecycle_stage || null,
    verificationStatus: row.verificationStatus || row.verification_status || (row.phoneVerified === true ? "verified" : "pending"),
    verifiedAt: asIso(row.verifiedAt || row.verified_at),
    qualification: row.qualification || row.qualificationStatus || row.qualification_status || "In progress",
    qualificationAnswers,
    score: row.score ?? row.qualificationScore ?? row.qualification_score ?? null,
    handoffType: row.handoffType || row.handoff || "None",
    handoffStatus: row.handoffStatus || row.handoff_status || "not_ready",
    handoffEvidence: row.handoffEvidence || row.handoff_evidence || null,
    handoffAcceptedAt: asIso(row.handoffAcceptedAt || row.handoff_accepted_at),
    intentScore: row.intentScore ?? row.intent_score ?? null,
    intentConflict: row.intentConflict ?? row.intent_conflict ?? false,
    declaredIntent: row.declaredIntent || row.declared_intent || null,
    observedIntent: row.observedIntent || row.observed_intent || null,
    consentRecorded: row.consentRecorded ?? row.consent_recorded ?? null,
    customerAcceptance,
    billingEligible: row.billingEligible ?? row.billing_eligible ?? false,
    disposition: row.disposition || row.closed_outcome || "Open",
    received: asIso(row.received || row.receivedAt || row.createdAt || row.created_date),
    rep: row.rep || row.assignedToName || row.assignedTo || row.assigned_agent_id || "Unassigned",
    outreachAttempts: row.outreachAttempts ?? row.contact_attempts ?? 0,
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
    events: Array.isArray(row.events) ? row.events : [],
  };
};
const normalizeAppointmentRow = (row) => {
  const status = String(row.attendance || row.status || "upcoming").toLowerCase();
  return { ...row, prospect: row.prospect || row.leadName || row.title || "Appointment", when: asIso(row.when || row.scheduledStart || row.startAt), type: row.type || row.title || "Appointment", salesperson: row.salesperson || row.assignedToName || row.assignedTo || "Unassigned", confirmation: row.confirmation || (status === "confirmed" ? "Confirmed" : "Pending"), attendance: row.attendance || (['completed', 'show', 'no-show', 'cancelled', 'canceled'].includes(status) ? (status === 'completed' ? 'Show' : status === 'no-show' ? 'No-show' : status) : 'Upcoming'), acceptance: row.acceptance || "Pending", reschedule: row.reschedule || "None" };
};
const normalizeDocumentRow = (row) => ({ ...row, uploaded: asIso(row.uploaded || row.createdAt), updated: asIso(row.updated || row.updatedAt || row.createdAt), uploadedBy: row.uploadedBy || row.createdBy || "Portal user", size: row.size ?? row.sizeBytes ?? 0, access: row.access || "Tenant members", version: row.version || "1.0" });
const normalizeSupportRow = (row) => ({ ...row, type: row.type || row.category || "General", priority: row.priority || "Normal", status: row.status ? `${row.status.charAt(0).toUpperCase()}${row.status.slice(1)}` : "Open", assigned: row.assigned || "Queued - GMS team", created: asIso(row.created || row.createdAt), updated: asIso(row.updated || row.updatedAt || row.createdAt), thread: Array.isArray(row.thread) ? row.thread : [] });

async function getActiveTenantId() {
  const session = await getSession();
  return session?.memberships?.find((membership) => membership.active !== false)?.tenantId || null;
}

async function getTenantRows(collectionName) {
  if (!isFirebaseMode) return null;
  const tenantId = await getActiveTenantId();
  if (!tenantId) return [];
  const snapshot = await getDocs(query(
    collection(firebaseDb, `tenants/${tenantId}/${collectionName}`),
    where("tenantId", "==", tenantId),
    limit(250),
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
export const isPreviewOrBypassMode = () => isBypassMode();

export class PortalApiError extends Error {
  constructor(status, message) {
    super(message || `Request failed (${status})`);
    this.status = status;
    this.name = "PortalApiError";
  }
}

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

async function request(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new PortalApiError(401, "Session expired");
  if (!res.ok) {
    const data = await safeJson(res);
    throw new PortalApiError(res.status, (data && (data.message || data.error)) || `Request failed (${res.status})`);
  }
  return safeJson(res);
}

// ---- Auth -----------------------------------------------------------------
async function getSession() {
  // Hosted previews open directly into the sample customer workspace.
  // A configured production API still requires its real secure session and MFA.
  if (isPreviewOrBypassMode()) { await delay(120); return sampleSession; }
  if (isFirebaseMode) {
    if (typeof firebaseAuth.authStateReady === "function") await firebaseAuth.authStateReady();
    const user = firebaseAuth.currentUser;
    if (!user) return null;
    const profile = await httpsCallable(firebaseFunctions, "getMyProfile")();
    return { ...toPortalSession(profile.data, user), access_token: await user.getIdToken() };
  }
  try { return await request("GET", "/auth/session"); } catch (e) { if (e.status === 401) return null; throw e; }
}

async function createSession({ email, password, trustDevice }) {
  if (isPreviewOrBypassMode()) {
    await delay(500);
    // Preview never authenticates against a real identity service. We return a
    // pending-MFA state so the reviewer can walk the full flow with sample data.
    return { status: "mfa_required", methods: ["authenticator", "email"], email, trustDevice };
  }
  if (isFirebaseMode) {
    await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    const profile = await httpsCallable(firebaseFunctions, "getMyProfile")();
    return { ...toPortalSession(profile.data, firebaseAuth.currentUser), trustDevice: !!trustDevice };
  }
  return request("POST", "/auth/session", { email, password, trustDevice });
}

async function verifyMfa({ code, method, trustDevice }) {
  if (isPreviewOrBypassMode()) {
    await delay(500);
    if (!/^\d{6}$/.test(code || "")) throw new PortalApiError(422, "Invalid code");
    return { ...sampleSession, trustDevice: !!trustDevice };
  }
  return request("POST", "/auth/mfa/verify", { code, method, trustDevice });
}

async function deleteSession() {
  if (isPreviewOrBypassMode()) { await delay(120); return { ok: true }; }
  if (isFirebaseMode) { await signOut(firebaseAuth); return { ok: true }; }
  return request("DELETE", "/auth/session");
}

async function requestRecovery({ email }) {
  if (isPreviewOrBypassMode()) { await delay(400); return { ok: true }; }
  if (isFirebaseMode) {
    await sendPasswordResetEmail(firebaseAuth, email.trim(), { url: `${window.location.origin}/login` });
    return { ok: true };
  }
  return request("POST", "/auth/recovery/request", { email });
}

async function completeRecovery({ token, password }) {
  if (isPreviewOrBypassMode()) {
    await delay(400);
    if (!token || password.length < 8) throw new PortalApiError(422, "Invalid or expired recovery token");
    return { ok: true };
  }
  return request("POST", "/auth/recovery/complete", { token, password });
}

// ---- Data -----------------------------------------------------------------
const getDashboard = async () => {
  if (isDataFixtureMode()) return delay().then(() => sampleDashboard);
  if (isFirebaseMode) {
    const tenantId = await getActiveTenantId();
    if (!tenantId) return null;
    const response = await httpsCallable(firebaseFunctions, "getDashboardWorkspace")({ tenantId });
    return normalizeDashboard(response.data);
  }
  return request("GET", "/dashboard");
};

function getLeads(params = {}) {
  if (isDataFixtureMode()) {
    return delay().then(() => {
      let rows = [...sampleLeads];
      const { search, source, campaign, service, stage, qualification, handoff, disposition, rep } = params;
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter((r) => [r.name, r.email, r.phone, r.campaign, r.location].join(" ").toLowerCase().includes(q));
      }
      if (source && source !== "all") rows = rows.filter((r) => r.source === source);
      if (campaign && campaign !== "all") rows = rows.filter((r) => r.campaign === campaign);
      if (service && service !== "all") rows = rows.filter((r) => r.service === service);
      if (stage && stage !== "all") rows = rows.filter((r) => r.stage === stage);
      if (qualification && qualification !== "all") rows = rows.filter((r) => r.qualification === qualification);
      if (handoff && handoff !== "all") rows = rows.filter((r) => (r.handoffType || "None") === handoff);
      if (disposition && disposition !== "all") rows = rows.filter((r) => r.disposition.startsWith(disposition));
      if (rep && rep !== "all") rows = rows.filter((r) => r.rep === rep);
      return { total: rows.length, rows };
    });
  }
  if (isFirebaseMode) {
    return getTenantRows("leads").then((sourceRows) => {
      let rows = (sourceRows || []).map(normalizeLeadRow);
      const { search, source, campaign, service, stage, qualification, handoff, disposition, rep } = params;
      if (search) { const term = search.toLowerCase(); rows = rows.filter((row) => [row.name, row.email, row.phone, row.campaign, row.location].filter(Boolean).join(" ").toLowerCase().includes(term)); }
      if (source && source !== "all") rows = rows.filter((row) => row.source === source);
      if (campaign && campaign !== "all") rows = rows.filter((row) => row.campaign === campaign);
      if (service && service !== "all") rows = rows.filter((row) => row.service === service);
      if (stage && stage !== "all") rows = rows.filter((row) => row.stage === stage);
      if (qualification && qualification !== "all") rows = rows.filter((row) => row.qualification === qualification);
      if (handoff && handoff !== "all") rows = rows.filter((row) => (row.handoffType || "None") === handoff);
      if (disposition && disposition !== "all") rows = rows.filter((row) => (row.disposition || "").startsWith(disposition));
      if (rep && rep !== "all") rows = rows.filter((row) => row.rep === rep);
      return { total: rows.length, rows };
    });
  }
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v && v !== "all")).toString();
  return request("GET", `/leads${qs ? `?${qs}` : ""}`);
}

const getLead = async (id) => {
  if (isDataFixtureMode()) return delay().then(() => sampleLeads.find((l) => l.id === id) || null);
  if (isFirebaseMode) { const tenantId = await getActiveTenantId(); if (!tenantId) return null; const snapshot = await getDoc(doc(firebaseDb, `tenants/${tenantId}/leads/${id}`)); return snapshot.exists() ? normalizeLeadRow({ id: snapshot.id, ...snapshot.data() }) : null; }
  return request("GET", `/leads/${id}`);
};
const getAppointments = async () => {
  if (isDataFixtureMode()) return delay().then(() => sampleAppointments);
  if (isFirebaseMode) return getTenantRows("appointments").then((rows) => rows.map(normalizeAppointmentRow));
  return request("GET", "/appointments");
};
const getReports = async (params) => {
  if (isDataFixtureMode()) return delay().then(() => sampleReports);
  if (isFirebaseMode) return normalizeReports((await httpsCallable(firebaseFunctions, "getLiveReport")({ tenantId: await getActiveTenantId(), range: params?.range || null, comparison: params?.comparison || null })).data);
  return request("GET", `/reports${params?.range ? `?range=${params.range}` : ""}`);
};
const getBilling = async () => {
  if (isDataFixtureMode()) return delay().then(() => sampleBilling);
  if (isFirebaseMode) { const rows = await getTenantRows("billing"); return normalizeLive(sampleBilling, rows[0] || null); }
  return request("GET", "/billing");
};
const getInvoice = async (id) => {
  if (isDataFixtureMode()) return sampleInvoice;
  if (isFirebaseMode) {
    const tenantId = await getActiveTenantId();
    if (!tenantId || !id) return null;
    const snapshot = await getDoc(doc(firebaseDb, `tenants/${tenantId}/invoices/${id}`));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  }
  return request("GET", `/billing/invoices/${id}`);
};
const callTenantFunction = async (name, data) => {
  if (!isFirebaseMode) return null;
  const tenantId = await getActiveTenantId();
  if (!tenantId) throw new PortalApiError(403, "No active tenant membership");
  return (await httpsCallable(firebaseFunctions, name)({ tenantId, ...data })).data;
};
const createBillingReview = (data) => (isDataFixtureMode() ? delay().then(() => ({ ok: true, id: `rev_${Date.now()}`, ...data, status: "Submitted" })) : isFirebaseMode ? callTenantFunction("createBillingReview", { ...data, invoiceId: data.invoiceId || data.invoice }) : request("POST", "/billing/reviews", data));
const getDocuments = async () => {
  if (isDataFixtureMode()) return delay().then(() => sampleDocuments);
  if (isFirebaseMode) return getTenantRows("documents").then((rows) => (rows || []).map(normalizeDocumentRow));
  return request("GET", "/documents");
};
const createDocument = async (formData) => {
  if (isDataFixtureMode()) return delay(400).then(() => ({ ok: true, id: `doc_${Date.now()}` }));
  if (!isFirebaseMode) return request("POST", "/documents", formData);
  const file = formData?.get("file");
  if (!(file instanceof File)) throw new PortalApiError(422, "A file is required");
  const tenantId = await getActiveTenantId();
  if (!tenantId) throw new PortalApiError(403, "No active tenant membership");
  if (file.size > 25 * 1024 * 1024) throw new PortalApiError(413, "File exceeds the 25 MB limit");
  const documentId = `${Date.now()}-${crypto.randomUUID()}`;
  const storagePath = `tenants/${tenantId}/documents/${documentId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await uploadBytes(ref(firebaseStorage, storagePath), file, { contentType: file.type || "application/octet-stream" });
  return callTenantFunction("createDocumentMetadata", { documentId, name: file.name, category: formData.get("category") || "Customer-uploaded files", storagePath, contentType: file.type, sizeBytes: file.size });
};
const downloadDocument = async (document) => {
  if (isDataFixtureMode()) return null;
  if (isFirebaseMode && document?.storagePath) return getDownloadURL(ref(firebaseStorage, document.storagePath));
  return null;
};
const getSupport = async () => {
  if (isDataFixtureMode()) return delay().then(() => sampleSupport);
  if (isFirebaseMode) return getTenantRows("supportRequests").then((rows) => ({ requests: (rows || []).map(normalizeSupportRow) }));
  return request("GET", "/support");
};
const createSupport = (data) => (isDataFixtureMode() ? delay(400).then(() => ({ ok: true, id: `sr_${Date.now()}`, ...data, status: "Open" })) : isFirebaseMode ? callTenantFunction("createSupportRequest", { ...data, category: data.category || data.type }) : request("POST", "/support", data));
const addSupportReply = (requestId, body) => (isDataFixtureMode() ? delay(250).then(() => ({ ok: true, message: { body, at: new Date().toISOString() } })) : isFirebaseMode ? callTenantFunction("addSupportReply", { requestId, body }) : request("POST", `/support/${requestId}/replies`, { body }));
const getNotifications = async () => {
  if (isDataFixtureMode()) return delay().then(() => sampleNotifications);
  if (isFirebaseMode) return normalizeLive(sampleNotifications, await callTenantFunction("getNotificationWorkspace", {}));
  return request("GET", "/notifications");
};
const updateNotifications = (prefs) => (isDataFixtureMode() ? delay().then(() => ({ ok: true, preferences: prefs })) : isFirebaseMode ? callTenantFunction("updateNotificationPreferences", { preferences: prefs }) : request("PATCH", "/notifications/preferences", { preferences: prefs }));
const getSecurity = async () => {
  if (isDataFixtureMode()) return delay().then(() => sampleSecurity);
  if (isFirebaseMode) return normalizeLive(sampleSecurity, await callTenantFunction("getSecurityWorkspace", {}));
  return request("GET", "/security");
};
const updateSecuritySettings = (settings) => (isDataFixtureMode() ? delay().then(() => ({ ok: true, settings })) : isFirebaseMode ? callTenantFunction("updateSecuritySettings", { settings }) : request("PATCH", "/security/settings", settings));
const revokeAllSessions = () => (isDataFixtureMode() ? delay().then(() => ({ ok: true })) : isFirebaseMode ? callTenantFunction("revokeAllSessions", {}) : request("POST", "/security/sessions/revoke-all"));
const requestCurrentPasswordReset = async () => {
  const email = firebaseAuth.currentUser?.email;
  if (!email) throw new PortalApiError(400, "No email is associated with this account.");
  return requestRecovery({ email });
};
const getAccount = async () => {
  if (isDataFixtureMode()) return delay().then(() => sampleAccount);
  if (isFirebaseMode) {
    const live = (await callTenantFunction("getAccountWorkspace", {})) || {};
    return { ...normalizeLive(sampleAccount, live), user: live.user || null, permissions: live.permissions || {} };
  }
  return request("GET", "/account");
};
const inviteUser = (data) => (
  isDataFixtureMode()
    ? delay(400).then(() => ({ ok: true, id: `inv_${Date.now()}`, ...data, status: "Pending" }))
    : isFirebaseMode
      ? callTenantFunction("createInvitation", data)
      : request("POST", "/account/users/invite", data)
);
const updateMyProfile = (data) => (isDataFixtureMode() ? delay().then(() => ({ ok: true, profile: data })) : isFirebaseMode ? callTenantFunction("updateMyProfile", data) : request("PATCH", "/account/profile", data));
const updateBusinessProfile = (data) => (isDataFixtureMode() ? delay().then(() => ({ ok: true, businessProfile: data })) : isFirebaseMode ? callTenantFunction("updateTenantProfile", { businessProfile: data }) : request("PATCH", "/account/business", data));
const updateMemberRole = (uid, role) => (isDataFixtureMode() ? delay().then(() => ({ ok: true, uid, role })) : isFirebaseMode ? callTenantFunction("updateMemberRole", { uid, role }) : request("PATCH", `/account/users/${uid}/role`, { role }));
const setMemberStatus = (uid, active) => (isDataFixtureMode() ? delay().then(() => ({ ok: true, uid, active })) : isFirebaseMode ? callTenantFunction("setMembershipStatus", { uid, active }) : request("PATCH", `/account/users/${uid}/status`, { active }));

export const portalAdapter = {
  isPreviewMode,
  isFirebaseMode,
  isBypassMode,
  apiUrl: API_URL,
  auth: { getSession, createSession, verifyMfa, deleteSession, requestRecovery, completeRecovery },
  getDashboard, getLeads, getLead, getAppointments, getReports, getBilling, getInvoice,
  createBillingReview, getDocuments, createDocument, downloadDocument, getSupport, createSupport, addSupportReply,
  getNotifications, updateNotifications, getSecurity, updateSecuritySettings, revokeAllSessions, requestCurrentPasswordReset, getAccount, inviteUser,
  updateMyProfile, updateBusinessProfile, updateMemberRole, setMemberStatus,
};

export default portalAdapter;
