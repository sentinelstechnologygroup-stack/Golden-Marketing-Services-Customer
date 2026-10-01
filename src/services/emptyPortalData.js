// Empty production response contracts. No fictional customer records or identities.
// Test-only fixtures stay separate and must never be imported by the live adapter.

export const emptyAccount = {
  "businessProfile": {
    "legalName": "",
    "dba": "",
    "website": "",
    "phone": "",
    "address": ""
  },
  "program": {
    "name": "",
    "startDate": "",
    "status": "",
    "services": [],
    "pricingModel": "",
    "rate": 0
  },
  "primaryMarket": "",
  "accountOwner": "",
  "programManager": "",
  "billingContact": {
    "name": "",
    "email": "",
    "phone": ""
  },
  "notificationContacts": [],
  "salesRoutingContacts": [],
  "users": [],
  "invitations": [],
  "activity": []
};

export const emptyAppointments = [];

export const emptyBilling = {
  "balance": 0,
  "period": "",
  "periodStart": "",
  "periodEnd": "",
  "billedCount": 0,
  "ratePerQualified": 0,
  "credits": 0,
  "adjustments": 0,
  "paymentStatus": "",
  "paymentMethod": "",
  "autoPay": false,
  "billingContact": {
    "name": "",
    "email": ""
  },
  "invoices": [],
  "transactions": [],
  "reviews": []
};

export const emptyDashboard = {
  "greeting": "",
  "programStatus": "",
  "reportingPeriod": "",
  "previousPeriod": "",
  "metrics": {
    "leadsReceived": {
      "value": 0,
      "change": 0
    },
    "conversations": {
      "value": 0,
      "change": 0
    },
    "qualifiedOpportunities": {
      "value": 0,
      "change": 0
    },
    "appointmentsAndTransfers": {
      "value": 0,
      "change": 0
    },
    "contactRate": {
      "value": 0,
      "change": 0
    },
    "qualificationRate": {
      "value": 0,
      "change": 0
    },
    "handoffRate": {
      "value": 0,
      "change": 0
    },
    "showRate": {
      "value": 0,
      "change": 0
    },
    "avgResponseMinutes": {
      "value": 0,
      "change": 0,
      "lowerIsBetter": false
    }
  },
  "sevenDay": [],
  "funnel": [],
  "sources": [],
  "responseTime": {
    "under5": 0,
    "fiveTo15": 0,
    "over15": 0,
    "avgMinutes": 0
  },
  "recentLeads": [],
  "upcomingAppointments": [],
  "outcome": {
    "accepted": 0,
    "refused": 0,
    "pending": 0,
    "closedWon": 0,
    "closedLost": 0,
    "inProgress": 0
  }
};

export const emptyDocuments = [];

export const emptyInvoice = {
  "id": "",
  "number": "",
  "period": "",
  "date": "",
  "amount": 0,
  "status": "",
  "qualified": 0,
  "ratePerQualified": 0,
  "subtotal": 0,
  "credits": 0,
  "adjustments": 0,
  "total": 0,
  "lineItems": [],
  "lineItemsTotal": 0
};

export const emptyLeads = [];

export const emptyNotifications = {
  "preferences": {
    "newQualifiedOpportunity": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "appointmentScheduled": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "appointmentChanged": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "liveTransferOutcome": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "followUpMilestone": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "customerActionRequest": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "weeklySummary": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "invoiceIssued": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "paymentProcessed": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "paymentFailed": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "billingReviewUpdate": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "documentUploaded": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "supportRequestUpdate": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "newDeviceSignIn": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "passwordChange": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "mfaChange": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    },
    "permissionChange": {
      "email": false,
      "sms": false,
      "browser": false,
      "portal": false,
      "locked": false
    }
  },
  "recent": []
};

export const emptyReports = {
  "range": "",
  "comparison": "",
  "metrics": {
    "leadVolume": {
      "value": 0,
      "change": 0
    },
    "contactRate": {
      "value": 0,
      "change": 0
    },
    "qualificationRate": {
      "value": 0,
      "change": 0
    },
    "appointmentRate": {
      "value": 0,
      "change": 0
    },
    "liveTransferRate": {
      "value": 0,
      "change": 0
    },
    "acceptanceRate": {
      "value": 0,
      "change": 0
    },
    "showRate": {
      "value": 0,
      "change": 0
    }
  },
  "responseDistribution": {
    "under5": 0,
    "fiveTo15": 0,
    "over15": 0
  },
  "sourcePerformance": [],
  "campaignPerformance": [],
  "servicePerformance": [],
  "repPerformance": [],
  "outcome": {
    "accepted": 0,
    "refused": 0,
    "pending": 0,
    "closedWon": 0,
    "closedLost": 0,
    "inProgress": 0
  },
  "trend": []
};

export const emptySecurity = {
  "mfaEnabled": false,
  "mfaMethods": [],
  "recoveryCodes": [],
  "recoveryViewed": false,
  "sessions": [],
  "trustedDevices": [],
  "recentSignIns": [],
  "events": [],
  "securityScore": 0,
  "idleTimeoutMinutes": 0
};

export const emptySession = {
  "preview": false,
  "user": {
    "id": "",
    "name": "",
    "email": "",
    "role": "",
    "initials": ""
  },
  "company": {
    "name": "",
    "programStatus": "",
    "reportingPeriod": "",
    "market": "",
    "owner": "",
    "programManager": "",
    "since": ""
  }
};

export const emptySupport = {
  "requests": []
};

