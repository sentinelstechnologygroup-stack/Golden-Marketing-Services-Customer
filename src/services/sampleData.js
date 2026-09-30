// Centralized preview data for the Golden Marketing Services customer portal.
// This module is ONLY used when VITE_CUSTOMER_PORTAL_API_URL is not configured.
// Every shape here mirrors the production adapter contract so the UI is unchanged
// when the real API is connected.

export const sampleSession = {
  preview: true,
  user: {
    id: "usr_northstar_001",
    name: "Alex Morgan",
    email: "alex.morgan@northstarhomeservices.com",
    role: "Owner",
    initials: "AM",
  },
  company: {
    name: "Northstar Home Services",
    programStatus: "Active",
    reportingPeriod: "Sep 1 – Sep 12, 2026",
    market: "Greater Denver Metro & Front Range",
    owner: "Alex Morgan",
    programManager: "Danielle Reyes — Golden Marketing Services",
    since: "March 2024",
  },
};

export const sampleDashboard = {
  greeting: "Good morning, Alex",
  programStatus: "Active",
  reportingPeriod: "Sep 1 – Sep 12, 2026",
  previousPeriod: "Aug 20 – Aug 31, 2026",
  metrics: {
    leadsReceived: { value: 156, change: 12.4 },
    conversations: { value: 103, change: 8.1 },
    qualifiedOpportunities: { value: 64, change: 14.6 },
    appointmentsAndTransfers: { value: 49, change: 6.5 },
    contactRate: { value: 66.0, change: 3.2 },
    qualificationRate: { value: 62.1, change: 4.8 },
    handoffRate: { value: 76.6, change: 2.1 },
    showRate: { value: 81.6, change: -1.4 },
    avgResponseMinutes: { value: 4.2, change: -18.0, lowerIsBetter: true },
  },
  sevenDay: [
    { date: "Sep 6", conversations: 12, qualified: 7 },
    { date: "Sep 7", conversations: 9, qualified: 6 },
    { date: "Sep 8", conversations: 15, qualified: 9 },
    { date: "Sep 9", conversations: 11, qualified: 8 },
    { date: "Sep 10", conversations: 14, qualified: 10 },
    { date: "Sep 11", conversations: 18, qualified: 11 },
    { date: "Sep 12", conversations: 16, qualified: 13 },
  ],
  funnel: [
    { stage: "Lead received", value: 156 },
    { stage: "Rapid response", value: 149 },
    { stage: "Human conversation", value: 103 },
    { stage: "Qualification", value: 64 },
    { stage: "Appointment / transfer", value: 49 },
    { stage: "Sales-team handoff", value: 44 },
    { stage: "Customer outcome", value: 38 },
  ],
  sources: [
    { name: "Google LSAs", value: 58 },
    { name: "Website form", value: 41 },
    { name: "Angi", value: 27 },
    { name: "Referral", value: 18 },
    { name: "Outbound callback", value: 12 },
  ],
  responseTime: {
    under5: 118,
    fiveTo15: 24,
    over15: 14,
    avgMinutes: 4.2,
  },
  recentLeads: [
    { id: "ld_1042", name: "Marcus Bell", source: "Google LSAs", campaign: "HVAC Install", stage: "Qualified", received: "2026-09-12T14:32:00Z", rep: "T. Okafor" },
    { id: "ld_1041", name: "Priya Shah", source: "Website form", campaign: "Roofing Estimate", stage: "Appointment set", received: "2026-09-12T13:05:00Z", rep: "L. Mendez" },
    { id: "ld_1040", name: "Derek Nolan", source: "Angi", campaign: "Plumbing Repair", stage: "Live transfer", received: "2026-09-12T11:48:00Z", rep: "T. Okafor" },
    { id: "ld_1039", name: "Hana Whitfield", source: "Referral", campaign: "HVAC Install", stage: "Conversation", received: "2026-09-12T10:14:00Z", rep: "L. Mendez" },
    { id: "ld_1038", name: "Owen Castellano", source: "Google LSAs", campaign: "Roofing Estimate", stage: "Disqualified", received: "2026-09-11T18:22:00Z", rep: "T. Okafor" },
  ],
  upcomingAppointments: [
    { id: "ap_220", prospect: "Priya Shah", type: "On-site estimate", when: "2026-09-14T15:00:00Z", tz: "America/Denver", salesperson: "R. Kim", status: "Confirmed" },
    { id: "ap_219", prospect: "Marcus Bell", type: "Live transfer", when: "2026-09-13T17:30:00Z", tz: "America/Denver", salesperson: "J. Patel", status: "Confirmed" },
    { id: "ap_218", prospect: "Sara Lin", type: "Phone consult", when: "2026-09-15T19:00:00Z", tz: "America/Denver", salesperson: "R. Kim", status: "Pending confirmation" },
  ],
  outcome: {
    accepted: 38,
    refused: 6,
    pending: 5,
    closedWon: 11,
    closedLost: 4,
    inProgress: 23,
  },
};

export const sampleLeads = [
  {
    id: "ld_1042", name: "Marcus Bell", email: "m.bell@example.com", phone: "(303) 555-0142",
    source: "Google LSAs", campaign: "HVAC Install", service: "HVAC", location: "Denver, CO",
    stage: "Qualified", qualification: "Qualified", score: 86, handoffType: "Appointment",
    disposition: "Open", received: "2026-09-12T14:32:00Z", firstResponseMinutes: 3.1,
    outreachAttempts: 2, rep: "T. Okafor", salesRecipient: "R. Kim",
    customerAcceptance: "Accepted", billingEligible: true, disputeStatus: "None",
    qualificationAnswers: [
      { q: "Homeowner?", a: "Yes" },
      { q: "Decision maker?", a: "Yes" },
      { q: "Timeline", a: "Within 2 weeks" },
      { q: "Budget confirmed", a: "Yes — $6k–$9k" },
    ],
    notes: "Interested in high-efficiency system. Two prior quotes.",
    appointment: { id: "ap_219", when: "2026-09-13T17:30:00Z", type: "Live transfer", salesperson: "J. Patel", status: "Confirmed" },
    liveTransfer: null,
    timeline: [
      { at: "2026-09-12T14:32:00Z", event: "Lead received" },
      { at: "2026-09-12T14:35:00Z", event: "First response — outbound call" },
      { at: "2026-09-12T14:51:00Z", event: "Conversation completed" },
      { at: "2026-09-12T15:08:00Z", event: "Qualified — score 86" },
      { at: "2026-09-12T15:20:00Z", event: "Live transfer scheduled to J. Patel" },
    ],
    events: [
      { at: "2026-09-12T14:32:00Z", action: "Lead created", actor: "System" },
      { at: "2026-09-12T14:35:00Z", action: "Outreach attempt #1", actor: "T. Okafor" },
      { at: "2026-09-12T15:20:00Z", action: "Handoff scheduled", actor: "T. Okafor" },
    ],
  },
  {
    id: "ld_1041", name: "Priya Shah", email: "priya.shah@example.com", phone: "(303) 555-0188",
    source: "Website form", campaign: "Roofing Estimate", service: "Roofing", location: "Boulder, CO",
    stage: "Appointment set", qualification: "Qualified", score: 91, handoffType: "Appointment",
    disposition: "Open", received: "2026-09-12T13:05:00Z", firstResponseMinutes: 2.4,
    outreachAttempts: 1, rep: "L. Mendez", salesRecipient: "R. Kim",
    customerAcceptance: "Accepted", billingEligible: true, disputeStatus: "None",
    qualificationAnswers: [
      { q: "Homeowner?", a: "Yes" },
      { q: "Decision maker?", a: "Yes" },
      { q: "Timeline", a: "ASAP" },
      { q: "Insurance claim", a: "Filed" },
    ],
    notes: "Hail damage from recent storm. Insurance filed.",
    appointment: { id: "ap_220", when: "2026-09-14T15:00:00Z", type: "On-site estimate", salesperson: "R. Kim", status: "Confirmed" },
    liveTransfer: null,
    timeline: [
      { at: "2026-09-12T13:05:00Z", event: "Lead received" },
      { at: "2026-09-12T13:08:00Z", event: "First response" },
      { at: "2026-09-12T13:22:00Z", event: "Conversation completed" },
      { at: "2026-09-12T13:40:00Z", event: "Qualified — score 91" },
      { at: "2026-09-12T13:52:00Z", event: "Estimate scheduled — Sep 14" },
    ],
    events: [
      { at: "2026-09-12T13:05:00Z", action: "Lead created", actor: "System" },
      { at: "2026-09-12T13:52:00Z", action: "Appointment set", actor: "L. Mendez" },
    ],
  },
  {
    id: "ld_1040", name: "Derek Nolan", email: "d.nolan@example.com", phone: "(720) 555-0110",
    source: "Angi", campaign: "Plumbing Repair", service: "Plumbing", location: "Aurora, CO",
    stage: "Live transfer", qualification: "Qualified", score: 78, handoffType: "Live transfer",
    disposition: "Open", received: "2026-09-12T11:48:00Z", firstResponseMinutes: 5.2,
    outreachAttempts: 3, rep: "T. Okafor", salesRecipient: "J. Patel",
    customerAcceptance: "Accepted", billingEligible: true, disputeStatus: "None",
    qualificationAnswers: [
      { q: "Homeowner?", a: "Yes" },
      { q: "Emergency?", a: "Yes — active leak" },
      { q: "Timeline", a: "Today" },
    ],
    notes: "Active leak, transferred live to on-call plumber.",
    appointment: null,
    liveTransfer: { connectedAt: "2026-09-12T12:01:00Z", durationSec: 542, recipient: "J. Patel", outcome: "Connected" },
    timeline: [
      { at: "2026-09-12T11:48:00Z", event: "Lead received" },
      { at: "2026-09-12T11:53:00Z", event: "First response" },
      { at: "2026-09-12T11:58:00Z", event: "Qualified — emergency" },
      { at: "2026-09-12T12:01:00Z", event: "Live transfer connected" },
    ],
    events: [
      { at: "2026-09-12T11:48:00Z", action: "Lead created", actor: "System" },
      { at: "2026-09-12T12:01:00Z", action: "Live transfer", actor: "T. Okafor" },
    ],
  },
  {
    id: "ld_1039", name: "Hana Whitfield", email: "hana.w@example.com", phone: "(303) 555-0177",
    source: "Referral", campaign: "HVAC Install", service: "HVAC", location: "Denver, CO",
    stage: "Conversation", qualification: "In progress", score: null, handoffType: null,
    disposition: "Open", received: "2026-09-12T10:14:00Z", firstResponseMinutes: 1.8,
    outreachAttempts: 1, rep: "L. Mendez", salesRecipient: null,
    customerAcceptance: "Pending", billingEligible: false, disputeStatus: "None",
    qualificationAnswers: [],
    notes: "Referred by existing customer. Scheduling callback.",
    appointment: null, liveTransfer: null,
    timeline: [
      { at: "2026-09-12T10:14:00Z", event: "Lead received" },
      { at: "2026-09-12T10:16:00Z", event: "First response" },
      { at: "2026-09-12T10:31:00Z", event: "Conversation in progress" },
    ],
    events: [
      { at: "2026-09-12T10:14:00Z", action: "Lead created", actor: "System" },
    ],
  },
  {
    id: "ld_1038", name: "Owen Castellano", email: "o.cast@example.com", phone: "(720) 555-0199",
    source: "Google LSAs", campaign: "Roofing Estimate", service: "Roofing", location: "Lakewood, CO",
    stage: "Disqualified", qualification: "Disqualified", score: 22, handoffType: null,
    disposition: "Disqualified — out of area", received: "2026-09-11T18:22:00Z", firstResponseMinutes: 4.0,
    outreachAttempts: 2, rep: "T. Okafor", salesRecipient: null,
    customerAcceptance: "N/A", billingEligible: false, disputeStatus: "None",
    qualificationAnswers: [
      { q: "Homeowner?", a: "Yes" },
      { q: "Service area", a: "Outside coverage" },
    ],
    notes: "Outside service area. Logged for referral partner.",
    appointment: null, liveTransfer: null,
    timeline: [
      { at: "2026-09-11T18:22:00Z", event: "Lead received" },
      { at: "2026-09-11T18:26:00Z", event: "First response" },
      { at: "2026-09-11T18:39:00Z", event: "Disqualified — out of area" },
    ],
    events: [
      { at: "2026-09-11T18:22:00Z", action: "Lead created", actor: "System" },
      { at: "2026-09-11T18:39:00Z", action: "Disqualified", actor: "T. Okafor" },
    ],
  },
  {
    id: "ld_1037", name: "Sara Lin", email: "sara.lin@example.com", phone: "(303) 555-0123",
    source: "Website form", campaign: "Plumbing Repair", service: "Plumbing", location: "Denver, CO",
    stage: "Appointment set", qualification: "Qualified", score: 83, handoffType: "Appointment",
    disposition: "Open", received: "2026-09-11T16:02:00Z", firstResponseMinutes: 3.6,
    outreachAttempts: 1, rep: "L. Mendez", salesRecipient: "R. Kim",
    customerAcceptance: "Accepted", billingEligible: true, disputeStatus: "None",
    qualificationAnswers: [
      { q: "Homeowner?", a: "Yes" },
      { q: "Timeline", a: "This week" },
    ],
    notes: "Recurring drain issue. Phone consult scheduled.",
    appointment: { id: "ap_218", when: "2026-09-15T19:00:00Z", type: "Phone consult", salesperson: "R. Kim", status: "Pending confirmation" },
    liveTransfer: null,
    timeline: [
      { at: "2026-09-11T16:02:00Z", event: "Lead received" },
      { at: "2026-09-11T16:06:00Z", event: "First response" },
      { at: "2026-09-11T16:21:00Z", event: "Qualified — score 83" },
      { at: "2026-09-11T16:35:00Z", event: "Consult scheduled — Sep 15" },
    ],
    events: [
      { at: "2026-09-11T16:02:00Z", action: "Lead created", actor: "System" },
    ],
  },
  {
    id: "ld_1036", name: "Tomas Reyes", email: "tomas.reyes@example.com", phone: "(720) 555-0144",
    source: "Angi", campaign: "HVAC Install", service: "HVAC", location: "Thornton, CO",
    stage: "Handed off", qualification: "Qualified", score: 88, handoffType: "Appointment",
    disposition: "Closed — won", received: "2026-09-10T15:40:00Z", firstResponseMinutes: 2.9,
    outreachAttempts: 1, rep: "T. Okafor", salesRecipient: "J. Patel",
    customerAcceptance: "Accepted", billingEligible: true, disputeStatus: "None",
    qualificationAnswers: [
      { q: "Homeowner?", a: "Yes" },
      { q: "Timeline", a: "Within 1 week" },
      { q: "Budget", a: "Confirmed" },
    ],
    notes: "Estimate completed, system sold. Closed-won.",
    appointment: { id: "ap_210", when: "2026-09-11T16:00:00Z", type: "On-site estimate", salesperson: "J. Patel", status: "Completed" },
    liveTransfer: null,
    timeline: [
      { at: "2026-09-10T15:40:00Z", event: "Lead received" },
      { at: "2026-09-10T15:43:00Z", event: "First response" },
      { at: "2026-09-10T15:58:00Z", event: "Qualified — score 88" },
      { at: "2026-09-10T16:10:00Z", event: "Estimate scheduled" },
      { at: "2026-09-11T16:00:00Z", event: "Estimate completed — sold" },
    ],
    events: [
      { at: "2026-09-10T15:40:00Z", action: "Lead created", actor: "System" },
      { at: "2026-09-11T16:00:00Z", action: "Marked closed-won", actor: "J. Patel" },
    ],
  },
  {
    id: "ld_1035", name: "Greta Olsen", email: "greta.o@example.com", phone: "(303) 555-0166",
    source: "Referral", campaign: "Roofing Estimate", service: "Roofing", location: "Denver, CO",
    stage: "No contact", qualification: "Not qualified", score: null, handoffType: null,
    disposition: "Open — awaiting callback", received: "2026-09-10T12:11:00Z", firstResponseMinutes: null,
    outreachAttempts: 4, rep: "L. Mendez", salesRecipient: null,
    customerAcceptance: "Pending", billingEligible: false, disputeStatus: "None",
    qualificationAnswers: [],
    notes: "Four outreach attempts, no response. Voicemail left.",
    appointment: null, liveTransfer: null,
    timeline: [
      { at: "2026-09-10T12:11:00Z", event: "Lead received" },
      { at: "2026-09-10T12:15:00Z", event: "Outreach attempt #1 — no answer" },
      { at: "2026-09-10T15:00:00Z", event: "Outreach attempt #2 — voicemail" },
      { at: "2026-09-11T10:00:00Z", event: "Outreach attempt #3 — no answer" },
      { at: "2026-09-11T17:30:00Z", event: "Outreach attempt #4 — voicemail" },
    ],
    events: [
      { at: "2026-09-10T12:11:00Z", action: "Lead created", actor: "System" },
    ],
  },
];

export const sampleAppointments = [
  { id: "ap_220", prospect: "Priya Shah", leadId: "ld_1041", type: "On-site estimate", when: "2026-09-14T15:00:00Z", tz: "America/Denver", salesperson: "R. Kim", confirmation: "Confirmed", attendance: "Upcoming", reschedule: "None", cancellation: null, liveTransfer: null, acceptance: "Accepted", followUp: "Confirm materials list" },
  { id: "ap_219", prospect: "Marcus Bell", leadId: "ld_1042", type: "Live transfer", when: "2026-09-13T17:30:00Z", tz: "America/Denver", salesperson: "J. Patel", confirmation: "Confirmed", attendance: "Upcoming", reschedule: "None", cancellation: null, liveTransfer: { connectedAt: "2026-09-12T15:20:00Z", outcome: "Scheduled" }, acceptance: "Accepted", followUp: "Pre-call brief sent" },
  { id: "ap_218", prospect: "Sara Lin", leadId: "ld_1037", type: "Phone consult", when: "2026-09-15T19:00:00Z", tz: "America/Denver", salesperson: "R. Kim", confirmation: "Pending confirmation", attendance: "Upcoming", reschedule: "None", cancellation: null, liveTransfer: null, acceptance: "Pending", followUp: "Send confirmation link" },
  { id: "ap_210", prospect: "Tomas Reyes", leadId: "ld_1036", type: "On-site estimate", when: "2026-09-11T16:00:00Z", tz: "America/Denver", salesperson: "J. Patel", confirmation: "Confirmed", attendance: "Show", reschedule: "None", cancellation: null, liveTransfer: null, acceptance: "Accepted", followUp: "Closed-won — invoice" },
  { id: "ap_205", prospect: "Renee Cole", leadId: "ld_1030", type: "On-site estimate", when: "2026-09-09T15:30:00Z", tz: "America/Denver", salesperson: "R. Kim", confirmation: "Confirmed", attendance: "No-show", reschedule: "Rescheduled to Sep 16", cancellation: null, liveTransfer: null, acceptance: "Accepted", followUp: "Re-engage prospect" },
  { id: "ap_198", prospect: "Liam Foster", leadId: "ld_1024", type: "Live transfer", when: "2026-09-08T18:00:00Z", tz: "America/Denver", salesperson: "J. Patel", confirmation: "Confirmed", attendance: "Show", reschedule: "None", cancellation: null, liveTransfer: { connectedAt: "2026-09-08T18:00:00Z", outcome: "Connected" }, acceptance: "Accepted", followUp: "Estimate pending" },
];

export const sampleReports = {
  range: "Sep 1 – Sep 12, 2026",
  comparison: "Aug 20 – Aug 31, 2026",
  metrics: {
    leadVolume: { value: 156, change: 12.4 },
    contactRate: { value: 66.0, change: 3.2 },
    qualificationRate: { value: 62.1, change: 4.8 },
    appointmentRate: { value: 31.4, change: 2.0 },
    liveTransferRate: { value: 19.2, change: 1.1 },
    acceptanceRate: { value: 76.6, change: 2.1 },
    showRate: { value: 81.6, change: -1.4 },
  },
  responseDistribution: { under5: 118, fiveTo15: 24, over15: 14 },
  sourcePerformance: [
    { source: "Google LSAs", leads: 58, qualified: 27, rate: 46.6 },
    { source: "Website form", leads: 41, qualified: 19, rate: 46.3 },
    { source: "Angi", leads: 27, qualified: 11, rate: 40.7 },
    { source: "Referral", leads: 18, qualified: 5, rate: 27.8 },
    { source: "Outbound callback", leads: 12, qualified: 2, rate: 16.7 },
  ],
  campaignPerformance: [
    { campaign: "HVAC Install", leads: 64, qualified: 30, appointments: 22 },
    { campaign: "Roofing Estimate", leads: 51, qualified: 22, appointments: 17 },
    { campaign: "Plumbing Repair", leads: 41, qualified: 12, appointments: 10 },
  ],
  servicePerformance: [
    { service: "HVAC", leads: 64, qualified: 30, rate: 46.9 },
    { service: "Roofing", leads: 51, qualified: 22, rate: 43.1 },
    { service: "Plumbing", leads: 41, qualified: 12, rate: 29.3 },
  ],
  repPerformance: [
    { rep: "T. Okafor", leads: 84, qualified: 38, rate: 45.2 },
    { rep: "L. Mendez", leads: 72, qualified: 26, rate: 36.1 },
  ],
  outcome: { accepted: 38, refused: 6, pending: 5, closedWon: 11, closedLost: 4, inProgress: 23 },
  trend: [
    { date: "Sep 6", leads: 22, qualified: 7 },
    { date: "Sep 7", leads: 18, qualified: 6 },
    { date: "Sep 8", leads: 26, qualified: 9 },
    { date: "Sep 9", leads: 20, qualified: 8 },
    { date: "Sep 10", leads: 24, qualified: 10 },
    { date: "Sep 11", leads: 28, qualified: 11 },
    { date: "Sep 12", leads: 18, qualified: 13 },
  ],
};

export const sampleBilling = {
  balance: 6430.0,
  period: "September 2026",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  billedCount: 64,
  ratePerQualified: 95.0,
  credits: 380.0,
  adjustments: -190.0,
  paymentStatus: "Auto-pay scheduled",
  paymentMethod: "Card ending 0042 (via payment provider)",
  autoPay: true,
  billingContact: { name: "Alex Morgan", email: "billing@northstarhomeservices.com" },
  invoices: [
    { id: "inv_2026_09", number: "NS-2026-09", period: "September 2026", date: "2026-10-01", amount: 6080.0, status: "Scheduled", qualified: 64 },
    { id: "inv_2026_08", number: "NS-2026-08", period: "August 2026", date: "2026-09-01", amount: 5415.0, status: "Paid", qualified: 57 },
    { id: "inv_2026_07", number: "NS-2026-07", period: "July 2026", date: "2026-08-01", amount: 4940.0, status: "Paid", qualified: 52 },
    { id: "inv_2026_06", number: "NS-2026-06", period: "June 2026", date: "2026-07-01", amount: 4655.0, status: "Paid", qualified: 49 },
  ],
  transactions: [
    { id: "tx_091", date: "2026-09-01", description: "Payment — NS-2026-08", amount: -5415.0, method: "Card ••0042" },
    { id: "tx_082", date: "2026-08-01", description: "Payment — NS-2026-07", amount: -4940.0, method: "Card ••0042" },
    { id: "tx_073", date: "2026-07-01", description: "Payment — NS-2026-06", amount: -4655.0, method: "Card ••0042" },
  ],
  reviews: [
    { id: "rev_003", invoice: "NS-2026-08", reason: "Disputed qualified lead (ld_0998)", status: "Approved", credit: 95.0, submitted: "2026-09-04", resolved: "2026-09-08", note: "Lead did not meet criteria — credit issued." },
    { id: "rev_002", invoice: "NS-2026-08", reason: "Duplicate lead", status: "Denied", credit: 0, submitted: "2026-09-03", resolved: "2026-09-06", note: "Confirmed unique prospect — no credit." },
  ],
};

export const sampleInvoice = {
  id: "inv_2026_08",
  number: "NS-2026-08",
  period: "August 2026",
  date: "2026-09-01",
  amount: 5415.0,
  status: "Paid",
  qualified: 57,
  ratePerQualified: 95.0,
  subtotal: 5415.0,
  credits: -285.0,
  adjustments: 0,
  total: 5130.0,
  lineItems: [
    { leadId: "ld_1036", prospect: "Tomas Reyes", outcome: "Qualified", amount: 95.0 },
    { leadId: "ld_1030", prospect: "Renee Cole", outcome: "Qualified", amount: 95.0 },
    { leadId: "ld_1024", prospect: "Liam Foster", outcome: "Qualified — live transfer", amount: 95.0 },
    { leadId: "ld_1020", prospect: "Noah Park", outcome: "Qualified", amount: 95.0 },
    { leadId: "ld_1018", prospect: "Mia Sato", outcome: "Qualified", amount: 95.0 },
  ],
  lineItemsTotal: 57,
};

export const sampleDocuments = [
  { id: "doc_01", name: "Master Services Agreement — Northstar", category: "Service agreement", size: 248000, uploaded: "2026-03-04", updated: "2026-03-04", uploadedBy: "Danielle Reyes", version: "1.0", access: "Owner, Administrator" },
  { id: "doc_02", name: "Approved Call Script — HVAC Install", category: "Approved scripts", size: 64200, uploaded: "2026-03-10", updated: "2026-06-02", uploadedBy: "Danielle Reyes", version: "2.1", access: "Owner, Administrator, Manager" },
  { id: "doc_03", name: "Qualification Criteria — Roofing", category: "Qualification criteria", size: 38900, uploaded: "2026-03-12", updated: "2026-07-18", uploadedBy: "Alex Morgan", version: "1.3", access: "Owner, Administrator" },
  { id: "doc_04", name: "Routing & Calendar Instructions", category: "Routing instructions", size: 51200, uploaded: "2026-03-15", updated: "2026-08-01", uploadedBy: "Danielle Reyes", version: "1.4", access: "Owner, Administrator, Manager" },
  { id: "doc_05", name: "Program Performance — August 2026", category: "Performance reports", size: 184000, uploaded: "2026-09-02", updated: "2026-09-02", uploadedBy: "GMS Reporting", version: "1.0", access: "Owner, Administrator, Manager, Billing, Viewer" },
  { id: "doc_06", name: "Invoice NS-2026-08", category: "Invoices", size: 96000, uploaded: "2026-09-01", updated: "2026-09-01", uploadedBy: "GMS Billing", version: "1.0", access: "Owner, Administrator, Billing" },
  { id: "doc_07", name: "Data Processing & Compliance Addendum", category: "Compliance documents", size: 132000, uploaded: "2026-03-04", updated: "2026-03-04", uploadedBy: "Danielle Reyes", version: "1.0", access: "Owner, Administrator" },
  { id: "doc_08", name: "Northstar Brand Guidelines (uploaded)", category: "Customer-uploaded files", size: 512000, uploaded: "2026-05-20", updated: "2026-05-20", uploadedBy: "Alex Morgan", version: "1.0", access: "Owner, Administrator" },
];

export const sampleSupport = {
  requests: [
    { id: "sr_014", type: "Routing or calendar change", subject: "Add R. Kim to roofing routing", priority: "Normal", status: "Open", assigned: "Danielle Reyes", created: "2026-09-10", updated: "2026-09-11", thread: [
      { at: "2026-09-10T15:00:00Z", from: "Alex Morgan", body: "Please add R. Kim to the roofing estimate routing for afternoons." },
      { at: "2026-09-11T09:30:00Z", from: "Danielle Reyes", body: "Confirmed — routing updated effective Sep 13." },
    ], resolution: null },
    { id: "sr_013", type: "Script-change request", subject: "Update HVAC intro to mention financing", priority: "High", status: "Resolved", assigned: "Danielle Reyes", created: "2026-08-28", updated: "2026-09-02", thread: [
      { at: "2026-08-28T11:00:00Z", from: "Alex Morgan", body: "Add financing mention to HVAC script intro." },
      { at: "2026-09-02T14:00:00Z", from: "Danielle Reyes", body: "Script v2.1 published with financing line." },
    ], resolution: "Script updated and approved — v2.1 live." },
    { id: "sr_012", type: "Billing question", subject: "Question on NS-2026-08 line items", priority: "Normal", status: "Resolved", assigned: "GMS Billing", created: "2026-09-03", updated: "2026-09-06", thread: [
      { at: "2026-09-03T10:00:00Z", from: "Alex Morgan", body: "Two leads look duplicated on the August invoice." },
      { at: "2026-09-06T12:00:00Z", from: "GMS Billing", body: "Reviewed — one was a duplicate, $95 credit applied." },
    ], resolution: "Credit of $95 applied to next invoice." },
  ],
};

export const sampleNotifications = {
  preferences: {
    newQualifiedOpportunity: { email: true, sms: false, browser: true, portal: true, locked: false },
    appointmentScheduled: { email: true, sms: true, browser: true, portal: true, locked: false },
    appointmentChanged: { email: true, sms: true, browser: false, portal: true, locked: false },
    liveTransferOutcome: { email: true, sms: true, browser: true, portal: true, locked: false },
    followUpMilestone: { email: true, sms: false, browser: false, portal: true, locked: false },
    customerActionRequest: { email: true, sms: false, browser: true, portal: true, locked: false },
    weeklySummary: { email: true, sms: false, browser: false, portal: true, locked: false },
    invoiceIssued: { email: true, sms: false, browser: false, portal: true, locked: false },
    paymentProcessed: { email: true, sms: false, browser: false, portal: true, locked: false },
    paymentFailed: { email: true, sms: true, browser: true, portal: true, locked: false },
    billingReviewUpdate: { email: true, sms: false, browser: false, portal: true, locked: false },
    documentUploaded: { email: true, sms: false, browser: false, portal: true, locked: false },
    supportRequestUpdate: { email: true, sms: false, browser: false, portal: true, locked: false },
    newDeviceSignIn: { email: true, sms: true, browser: true, portal: true, locked: true },
    passwordChange: { email: true, sms: false, browser: false, portal: true, locked: true },
    mfaChange: { email: true, sms: true, browser: true, portal: true, locked: true },
    permissionChange: { email: true, sms: false, browser: false, portal: true, locked: true },
  },
  recent: [
    { id: "n_01", type: "New qualified opportunity", title: "Marcus Bell qualified (score 86)", at: "2026-09-12T15:08:00Z", read: false },
    { id: "n_02", type: "Appointment scheduled", title: "Estimate set for Priya Shah — Sep 14", at: "2026-09-12T13:52:00Z", read: false },
    { id: "n_03", type: "Live-transfer outcome", title: "Live transfer connected — Derek Nolan", at: "2026-09-12T12:01:00Z", read: true },
    { id: "n_04", type: "Invoice issued", title: "Invoice NS-2026-08 is available", at: "2026-09-01T09:00:00Z", read: true },
  ],
};

export const sampleSecurity = {
  mfaEnabled: true,
  mfaMethods: [
    { id: "mfa_auth", type: "Authenticator app", name: "Authy — iPhone 15", added: "2026-03-04", primary: true },
    { id: "mfa_email", type: "Email code", name: "alex.morgan@northstarhomeservices.com", added: "2026-03-04", primary: false },
  ],
  recoveryCodes: ["NS7K-2Q9P", "LM4X-8RT2", "9D3V-6YH1", "KP5W-0ZM7", "2J8N-4FQ3", "RC1T-7B6S", "X9H2-5VLD", "3M6Q-8WNE"],
  recoveryViewed: false,
  sessions: [
    { id: "ses_01", device: "MacBook Pro — Chrome", location: "Denver, CO", lastActive: "2026-09-13T04:10:00Z", current: true, trusted: true },
    { id: "ses_02", device: "iPhone 15 — Safari", location: "Denver, CO", lastActive: "2026-09-12T22:40:00Z", current: false, trusted: true },
    { id: "ses_03", device: "Windows — Edge", location: "Boulder, CO", lastActive: "2026-09-08T16:20:00Z", current: false, trusted: false },
  ],
  trustedDevices: [
    { id: "td_01", name: "MacBook Pro (office)", added: "2026-03-04", expires: "2026-10-04" },
    { id: "td_02", name: "iPhone 15 (mobile)", added: "2026-03-05", expires: "2026-10-05" },
  ],
  recentSignIns: [
    { at: "2026-09-13T04:10:00Z", device: "MacBook Pro — Chrome", location: "Denver, CO", result: "Success", mfa: "Authenticator" },
    { at: "2026-09-12T08:02:00Z", device: "iPhone 15 — Safari", location: "Denver, CO", result: "Success", mfa: "Trusted device" },
    { at: "2026-09-11T21:14:00Z", device: "Unknown — Firefox", location: "Unknown", result: "Blocked — MFA required", mfa: "—" },
  ],
  events: [
    { at: "2026-09-11T21:14:00Z", event: "Sign-in blocked — MFA required", severity: "Warning" },
    { at: "2026-09-10T15:00:00Z", event: "Support request submitted", severity: "Info" },
    { at: "2026-09-01T09:00:00Z", event: "Invoice issued — NS-2026-08", severity: "Info" },
    { at: "2026-08-20T11:30:00Z", event: "Recovery codes regenerated", severity: "Warning" },
    { at: "2026-07-18T10:00:00Z", event: "Qualification criteria updated", severity: "Info" },
  ],
  securityScore: 82,
  idleTimeoutMinutes: 30,
};

export const sampleAccount = {
  businessProfile: {
    legalName: "Northstar Home Services LLC",
    dba: "Northstar Home Services",
    website: "northstarhomeservices.com",
    phone: "(303) 555-0100",
    address: "1840 Blake St, Denver, CO 80202",
  },
  program: {
    name: "Lead Response & Appointment Setting",
    startDate: "2024-03-01",
    status: "Active",
    services: ["HVAC", "Roofing", "Plumbing"],
    pricingModel: "Per qualified opportunity",
    rate: 95.0,
  },
  primaryMarket: "Greater Denver Metro & Front Range",
  accountOwner: "Alex Morgan",
  programManager: "Danielle Reyes",
  billingContact: { name: "Alex Morgan", email: "billing@northstarhomeservices.com", phone: "(303) 555-0100" },
  notificationContacts: [
    { name: "Alex Morgan", email: "alex.morgan@northstarhomeservices.com" },
    { name: "Ops Desk", email: "ops@northstarhomeservices.com" },
  ],
  salesRoutingContacts: [
    { name: "J. Patel", role: "HVAC lead", email: "j.patel@northstarhomeservices.com" },
    { name: "R. Kim", role: "Roofing lead", email: "r.kim@northstarhomeservices.com" },
  ],
  users: [
    { id: "u_01", name: "Alex Morgan", email: "alex.morgan@northstarhomeservices.com", role: "Owner", status: "Active", lastActive: "2026-09-13T04:10:00Z" },
    { id: "u_02", name: "Priya Anand", email: "priya.anand@northstarhomeservices.com", role: "Administrator", status: "Active", lastActive: "2026-09-12T19:30:00Z" },
    { id: "u_03", name: "Marcus Lee", email: "marcus.lee@northstarhomeservices.com", role: "Manager", status: "Active", lastActive: "2026-09-11T17:00:00Z" },
    { id: "u_04", name: "Dana Cole", email: "dana.cole@northstarhomeservices.com", role: "Billing", status: "Active", lastActive: "2026-09-09T11:00:00Z" },
    { id: "u_05", name: "Owen Park", email: "owen.park@northstarhomeservices.com", role: "Viewer", status: "Active", lastActive: "2026-09-06T09:00:00Z" },
  ],
  invitations: [
    { id: "inv_02", email: "field.ops@northstarhomeservices.com", role: "Manager", status: "Pending", sent: "2026-09-10" },
  ],
  activity: [
    { at: "2026-09-12T15:20:00Z", event: "Priya Anand viewed lead ld_1042", actor: "Priya Anand" },
    { at: "2026-09-10T15:00:00Z", event: "Support request sr_014 submitted", actor: "Alex Morgan" },
    { at: "2026-09-09T11:00:00Z", event: "Dana Cole downloaded invoice NS-2026-08", actor: "Dana Cole" },
    { at: "2026-09-01T09:00:00Z", event: "Owen Park invited as Viewer", actor: "Alex Morgan" },
  ],
};
