import { api } from './api.js'

export const fetchHome = (city) => api.get('/api/home', { params: city ? { city } : {} })

export const fetchSuggestions = (q, city) => api.get('/api/home/suggest', { params: { q, ...(city ? { city } : {}) } })
