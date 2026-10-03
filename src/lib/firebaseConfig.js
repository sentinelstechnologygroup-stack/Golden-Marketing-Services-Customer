const isNode = typeof window === "undefined"

const clean = (value) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

const parseBoolean = (value, fallback = false) => {
  const normalized = clean(value).toLowerCase()
  if (!normalized) return fallback
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false
  return fallback
}

const parseList = (value) => {
  const normalized = clean(value)
  if (!normalized) return []
  return normalized.split(",").map((entry) => entry.trim()).filter(Boolean)
}

const getEnvValue = (name) => {
  if (isNode) return ""
  return import.meta.env[name] || ""
}

const getProjectConfig = (targetPrefix, serviceEnv) => {
  const envValue = (suffix) => {
    const scoped = getEnvValue(`VITE_FIREBASE_${targetPrefix}_${serviceEnv}_${suffix}`)
    if (scoped) return scoped
    return getEnvValue(`VITE_FIREBASE_${targetPrefix}_${suffix}`)
  }

  return {
    projectId: clean(envValue("PROJECT_ID")),
    apiKey: clean(envValue("API_KEY")),
    authDomain: clean(envValue("AUTH_DOMAIN")),
    storageBucket: clean(envValue("STORAGE_BUCKET")),
    messagingSenderId: clean(envValue("MESSAGING_SENDER_ID")),
    projectNumber: clean(envValue("PROJECT_NUMBER")),
    appId: clean(envValue("APP_ID")),
    services: {
      auth: parseBoolean(envValue("SERVICES_AUTH"), true),
      firestore: parseBoolean(envValue("SERVICES_FIRESTORE"), true),
      functions: parseBoolean(envValue("SERVICES_FUNCTIONS"), true),
      storage: parseBoolean(envValue("SERVICES_STORAGE"), true),
      hosting: parseBoolean(envValue("SERVICES_HOSTING"), true),
    },
    rawServices: clean(envValue("SERVICES")),
  }
}

const getFirebaseEnvironment = () => {
  const explicit = clean(getEnvValue("VITE_FIREBASE_ENV"))
  if (explicit) return explicit.toLowerCase()
  if (import.meta.env.DEV) return "development"
  return import.meta.env.PROD ? "production" : "development"
}

const getFirebaseTarget = () => {
  return clean(
    getEnvValue("VITE_FIREBASE_TARGET") ||
      getEnvValue("VITE_FIREBASE_APP") ||
      "customer_portal"
  )
}

export const FIREBASE_TARGETS = {
  website: "WEBSITE",
  agentPortal: "AGENT_CRM",
  customerPortal: "CUSTOMER_PORTAL",
}

const normalizeTarget = (target) => {
  switch ((target || "").toLowerCase()) {
    case "website":
    case "gms-website":
    case "site":
    case "web":
      return FIREBASE_TARGETS.website
    case "agent":
    case "agent_crm":
    case "agentcrm":
    case "agent-portal":
    case "agent_portal":
    case "crm":
      return FIREBASE_TARGETS.agentPortal
    case "customer":
    case "customer_portal":
    case "portal":
    case "customerportal":
      return FIREBASE_TARGETS.customerPortal
    default:
      return FIREBASE_TARGETS.customerPortal
  }
}

const hydrateServices = (config) => {
  if (config.rawServices) {
    const normalized = parseList(config.rawServices).map((item) => item.toLowerCase())
    const allEnabled = normalized.includes("all")
    const services = {
      auth: allEnabled,
      firestore: allEnabled,
      functions: allEnabled,
      storage: allEnabled,
      hosting: allEnabled,
    }
    normalized.forEach((service) => {
      if (service === "all") return
      if (service.startsWith("-")) {
        const key = service.slice(1)
        if (services.hasOwnProperty(key)) services[key] = false
      } else if (services.hasOwnProperty(service)) {
        services[service] = true
      }
    })
    return { ...config, services }
  }

  return config
}

export const getFirebaseConfig = () => {
  const environment = getFirebaseEnvironment()
  const target = normalizeTarget(getFirebaseTarget())
  const rawConfig = getProjectConfig(target, environment.toUpperCase())
  const merged = hydrateServices(rawConfig)
  return {
    target,
    environment,
    ...merged,
    services: {
      auth: Boolean(merged.services.auth),
      firestore: Boolean(merged.services.firestore),
      functions: Boolean(merged.services.functions),
      storage: Boolean(merged.services.storage),
      hosting: Boolean(merged.services.hosting),
    },
  }
}

export const getFirebaseTargetDisplayName = () => {
  const active = normalizeTarget(getFirebaseTarget())
  if (active === FIREBASE_TARGETS.website) return "Website"
  if (active === FIREBASE_TARGETS.agentPortal) return "Agent CRM"
  return "Customer Portal"
}

