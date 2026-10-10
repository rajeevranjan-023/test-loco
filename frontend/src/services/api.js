import axios from 'axios'

const BASE_URL = 'http://localhost:5000' 

const client = axios.create({ baseURL: BASE_URL })

// Admin "view as": while an admin browses /:username/*, every authenticated request carries that username so the
// backend serves that shop's data. The backend ignores this header for anyone who is not an admin.
let viewAs = null
export const setViewAs = (username) => { viewAs = username || null }

client.interceptors.request.use((config) => {
  if (config.requiresAuth) {
    const token = localStorage.getItem('lf_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    if (viewAs) config.headers['x-view-as'] = viewAs
  }
  return config
})


client.interceptors.response.use(
  (res) => res.data,
  (err) => {
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
