import { api } from './api.js'

// The registration token is an opaque secret issued by the backend. It lives in sessionStorage only so a page refresh
// doesn't lose progress; it proves nothing by itself — every step is re-validated on the server.
const KEY = 'lf_reg_token'
export const regToken = {
  get: () => { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } },
  set: (t) => { try { sessionStorage.setItem(KEY, t) } catch { /* ignore */ } },
  clear: () => { try { sessionStorage.removeItem(KEY) } catch { /* ignore */ } },
}
const withReg = () => ({ headers: { 'x-registration-token': regToken.get() } })

export const authApi = {
  googleExchange: (ticket) => api.post('/api/auth/google/exchange', { ticket }),
  googleLink: (ticket, password) => api.post('/api/auth/google/link', { ticket, password }),
  emailStart: (email) => api.post('/api/auth/register/email/start', { email }),
  getSession: () => api.get('/api/auth/register/session', withReg()),
  submitPersonal: (body) => api.post('/api/auth/register/personal', body, withReg()),
  resendOtp: () => api.post('/api/auth/register/otp/resend', {}, withReg()),
  verifyOtp: (code) => api.post('/api/auth/register/otp/verify', { code }, withReg()),
  changePhone: () => api.post('/api/auth/register/otp/change-phone', {}, withReg()),
  checkUsername: (username) => api.get(`/api/auth/register/check-username?username=${encodeURIComponent(username)}`, withReg()),
  complete: (body) => api.post('/api/auth/register/complete', body, withReg()),
  uploadAvatar: (file) => { const f = new FormData(); f.append('file', file); return api.post('/api/auth/register/avatar', f, { ...withReg(), timeout: 120000 }) },
  updateOnboarding: (body) => api.patch('/api/auth/onboarding', body, { requiresAuth: true }),
  forgotPassword: (identifier) => api.post('/api/auth/forgot-password', { identifier }),
  resetPassword: (body) => api.post('/api/auth/reset-password', body),
}
