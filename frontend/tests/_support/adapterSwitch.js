// Lets a test replace the transport for the REAL api.js client. axios.create() copies axios.defaults when api.js is first imported, so
// this must be imported BEFORE anything that imports services/api.js (fakeBackend.js assigns defaults.adapter; we sit in front of it).
import axios from 'axios'
let base = axios.defaults.adapter
let override = null
const switching = (config) => (override ? override(config) : base(config))
Object.defineProperty(axios.defaults, 'adapter', { configurable: true, enumerable: true, get: () => switching, set: (fn) => { base = fn } })
export const setOverride = (fn) => { override = fn }
