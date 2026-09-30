import { appParams } from '@/lib/app-params';

const apiBaseUrl = (appParams.apiBaseUrl || '/api').replace(/\/$/, '');
const getToken = () => appParams.token || (typeof window !== 'undefined' ? window.localStorage.getItem('token') : null);

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `Request failed (${response.status})`);
  return payload?.data ?? payload;
}

export const gmsClient = {
  app: { getPublicSettings: () => request('/settings/public') },
  auth: {
    me: () => request('/auth/me'),
    loginViaEmailPassword: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    loginWithProvider: (provider, returnTo) => window.location.assign(`${apiBaseUrl}/auth/${provider}?returnTo=${encodeURIComponent(returnTo || window.location.href)}`),
    logout: (returnTo) => { window.localStorage.removeItem('token'); if (returnTo) window.location.assign(returnTo); },
    redirectToLogin: (returnTo) => window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo || window.location.href)}`),
    register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    verifyOtp: (data) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
    resendOtp: (email) => request('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ email }) }),
    setToken: (token) => { window.localStorage.setItem('token', token); },
    resetPassword: (data) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
    resetPasswordRequest: (email) => request('/auth/reset-password-request', { method: 'POST', body: JSON.stringify({ email }) }),
  },
};
