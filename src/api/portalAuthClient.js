import { portalAdapter } from "@/services/portalAdapter"

const TOKEN_KEY = "portal_access_token"

const setToken = (value) => {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(TOKEN_KEY, value)
  else window.localStorage.removeItem(TOKEN_KEY)
}

const getToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

const appPublicSettings = {
  id: "golden-marketing-services-customer",
  public_settings: {},
}

const portalAuthClient = {
  app: {
    getPublicSettings: async () => appPublicSettings,
  },
  auth: {
    getToken,
    setToken,
    me: async () => portalAdapter.auth.getSession(),
    loginViaEmailPassword: async (email, password) => {
      const result = await portalAdapter.auth.createSession({ email, password })
      if (result && result.access_token) setToken(result.access_token)
      return result
    },
    loginWithProvider: (provider, returnTo) => {
      const target = returnTo && returnTo.startsWith("http")
        ? returnTo
        : `${window.location.origin}/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`
      window.location.href = target
    },
    register: async ({ email, password }) => {
      return portalAdapter.auth.createSession({ email, password })
    },
    verifyOtp: async ({ email, otpCode }) => {
      return portalAdapter.auth.verifyMfa({ code: otpCode, method: "email", trustDevice: false })
    },
    setToken,
    resendOtp: async () => ({ ok: true }),
    resetPasswordRequest: async (email) => portalAdapter.auth.requestRecovery({ email }),
    resetPassword: async ({ resetToken, newPassword }) =>
      portalAdapter.auth.completeRecovery({ token: resetToken, password: newPassword }),
    logout: async (redirectUrl) => {
      await portalAdapter.auth.deleteSession()
      setToken("")
      if (redirectUrl) window.location.href = redirectUrl
    },
    redirectToLogin: (returnTo) => {
      const returnParam = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""
      window.location.href = `/login${returnParam}`
    },
  },
}

export { portalAuthClient }

