import axios from 'axios'
import { getToken, getEpoch, trackRequest, onIdentityReset, notifyUnauthorized } from './session.js'

const BASE_URL = 'http://localhost:5000' 

const client = axios.create({ baseURL: BASE_URL })

// Admin "view as": while an admin browses /:username/*, every authenticated request carries that username so the
// backend serves that shop's data. The backend ignores this header for anyone who is not an admin.
let viewAs = null
export const setViewAs = (username) => { viewAs = username || null }
onIdentityReset(() => { viewAs = null }) // an admin's "view as" belongs to the account that set it

client.interceptors.request.use((config) => {
  if (config.requiresAuth) {
    const token = getToken() // the session this tab is showing (see services/session.js)
    if (token) config.headers.Authorization = `Bearer ${token}`
    if (viewAs) config.headers['x-view-as'] = viewAs
    // Request identity: remember which session sent this, and make it abortable when the identity changes.
    config.__epoch = getEpoch()
    config.__token = token
    if (!config.signal) { const c = new AbortController(); config.signal = c.signal; config.__untrack = trackRequest(c) }
  }
  return config
})

const canceled = () => Object.assign(new Error('Request cancelled (the account changed).'), { canceled: true, status: 0 })

client.interceptors.response.use(
  (res) => {
    res.config.__untrack?.()
    // A late answer to a request sent under a previous account must never reach the screen of the current one.
    if (res.config.requiresAuth && res.config.__epoch !== getEpoch()) return Promise.reject(canceled())
    return res.data
  },
  (err) => {
    err.config?.__untrack?.()
    if (axios.isCancel(err) || err.code === 'ERR_CANCELED') return Promise.reject(canceled())
    if (err.config?.requiresAuth && err.config.__epoch !== getEpoch()) return Promise.reject(canceled())
    if (err.response?.status === 401 && err.config?.requiresAuth && err.config.__token && err.config.__token === getToken()) {
      notifyUnauthorized(err.config.__token) // the session this tab uses is no longer valid (logged out elsewhere / expired) → AuthContext ends it
    }
    if (err.response) {
      const e = new Error(err.response.data?.message || `Request failed with status ${err.response.status}`)
      e.status = err.response.status       // lets callers react to 401/409/429 …
      e.data = err.response.data           // and read field-level `errors`, `code`, `attemptsLeft` …
      return Promise.reject(e)
    }
    return Promise.reject(
      new Error(`Could not reach the API at ${BASE_URL}. Is the backend running? (${err.message})`)
    )
  }
)

export const api = {
  get: (path, opts) => client.get(path, opts),
  post: (path, body, opts) => client.post(path, body, opts),
  put: (path, body, opts) => client.put(path, body, opts),
  patch: (path, body, opts) => client.patch(path, body, opts),
  delete: (path, opts) => client.delete(path, opts),
}

export { BASE_URL }
