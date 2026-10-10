import { api } from './api.js'

// Everything the homepage shows, in one request: hero slides, chips, categories, cities, promo cards, rows.
export const fetchHome = (city) => api.get('/api/home', { params: city ? { city } : {} })

// Live search-as-you-type (shops + services + products).
export const fetchSuggestions = (q, city) => api.get('/api/home/suggest', { params: { q, ...(city ? { city } : {}) } })
