// Link Marketing Services — Customer Portal Service Adapter
// ----------------------------------------------------------------------------
// This is the ONLY layer that talks to a backend. Every page and component
// imports from here; nothing in the portal calls Base44 or any data source
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

const API_URL = (import.meta.env && import.meta.env.VITE_CUSTOMER_PORTAL_API_URL) || "";
export const isPreviewMode = !API_URL;

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
  // Base44/interface previews open directly into the sample customer workspace.
  // A configured production API still requires its real secure session and MFA.
  if (isPreviewMode) { await delay(120); return sampleSession; }
  try { return await request("GET", "/auth/session"); } catch (e) { if (e.status === 401) return null; throw e; }
}

async function createSession({ email, password, trustDevice }) {
  if (isPreviewMode) {
    await delay(500);
    // Preview never authenticates against a real identity service. We return a
    // pending-MFA state so the reviewer can walk the full flow with sample data.
    return { status: "mfa_required", methods: ["authenticator", "email"], email, trustDevice };
  }
  return request("POST", "/auth/session", { email, password, trustDevice });
}

async function verifyMfa({ code, method, trustDevice }) {
  if (isPreviewMode) {
    await delay(500);
    if (!/^\d{6}$/.test(code || "")) throw new PortalApiError(422, "Invalid code");
    return { ...sampleSession, trustDevice: !!trustDevice };
  }
  return request("POST", "/auth/mfa/verify", { code, method, trustDevice });
}

async function deleteSession() {
  if (isPreviewMode) { await delay(120); return { ok: true }; }
  return request("DELETE", "/auth/session");
}

async function requestRecovery({ email }) {
  if (isPreviewMode) { await delay(400); return { ok: true }; }
  return request("POST", "/auth/recovery/request", { email });
}

async function completeRecovery({ token, password }) {
  if (isPreviewMode) {
    await delay(400);
    if (!token || password.length < 8) throw new PortalApiError(422, "Invalid or expired recovery token");
    return { ok: true };
  }
  return request("POST", "/auth/recovery/complete", { token, password });
}

// ---- Data -----------------------------------------------------------------
const getDashboard = () => (isPreviewMode ? delay().then(() => sampleDashboard) : request("GET", "/dashboard"));

function getLeads(params = {}) {
  if (isPreviewMode) {
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
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v && v !== "all")).toString();
  return request("GET", `/leads${qs ? `?${qs}` : ""}`);
}

const getLead = (id) => (isPreviewMode ? delay().then(() => sampleLeads.find((l) => l.id === id) || null) : request("GET", `/leads/${id}`));
const getAppointments = () => (isPreviewMode ? delay().then(() => sampleAppointments) : request("GET", "/appointments"));
const getReports = (params) => (isPreviewMode ? delay().then(() => sampleReports) : request("GET", `/reports${params?.range ? `?range=${params.range}` : ""}`));
const getBilling = () => (isPreviewMode ? delay().then(() => sampleBilling) : request("GET", "/billing"));
const getInvoice = (id) => (isPreviewMode ? delay().then(() => sampleInvoice) : request("GET", `/billing/invoices/${id}`));
const createBillingReview = (data) => (isPreviewMode ? delay().then(() => ({ ok: true, id: `rev_${Date.now()}`, ...data, status: "Submitted" })) : request("POST", "/billing/reviews", data));
const getDocuments = () => (isPreviewMode ? delay().then(() => sampleDocuments) : request("GET", "/documents"));
const createDocument = (formData) => (isPreviewMode ? delay(400).then(() => ({ ok: true, id: `doc_${Date.now()}` })) : request("POST", "/documents", formData));
const getSupport = () => (isPreviewMode ? delay().then(() => sampleSupport) : request("GET", "/support"));
const createSupport = (data) => (isPreviewMode ? delay(400).then(() => ({ ok: true, id: `sr_${Date.now()}`, ...data, status: "Open" })) : request("POST", "/support", data));
const getNotifications = () => (isPreviewMode ? delay().then(() => sampleNotifications) : request("GET", "/notifications"));
const updateNotifications = (prefs) => (isPreviewMode ? delay().then(() => ({ ok: true, preferences: prefs })) : request("PATCH", "/notifications/preferences", { preferences: prefs }));
const getSecurity = () => (isPreviewMode ? delay().then(() => sampleSecurity) : request("GET", "/security"));
const getAccount = () => (isPreviewMode ? delay().then(() => sampleAccount) : request("GET", "/account"));
const inviteUser = (data) => (isPreviewMode ? delay(400).then(() => ({ ok: true, id: `inv_${Date.now()}`, ...data, status: "Pending" })) : request("POST", "/account/users/invite", data));

export const portalAdapter = {
  isPreviewMode,
  apiUrl: API_URL,
  auth: { getSession, createSession, verifyMfa, deleteSession, requestRecovery, completeRecovery },
  getDashboard, getLeads, getLead, getAppointments, getReports, getBilling, getInvoice,
  createBillingReview, getDocuments, createDocument, getSupport, createSupport,
  getNotifications, updateNotifications, getSecurity, getAccount, inviteUser,
};

export default portalAdapter;