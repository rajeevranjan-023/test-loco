import Shop from '../models/Shop.js'
import ServiceProvider from '../models/ServiceProvider.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { haversineKm, parseLatLng } from '../utils/geo.js'

// GET /api/shops?lat=&lng=  (public — nearby shops section on the homepage)
export const listShops = asyncHandler(async (req, res) => {
  const here = parseLatLng(req.query)
  const shops = await Shop.find().limit(50)
  let profiles = shops.map((s) => s.toPublicProfile())  // define in model to remove pvt data

  if (here) {  
    profiles = profiles
      .map((p) => ({
        ...p,
        distanceKm:
          p.location?.lat != null && p.location?.lng != null
            ? haversineKm(here.lat, here.lng, p.location.lat, p.location.lng)
            : null,
      }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  }

  res.json(profiles.slice(0, 20))
})

// GET /api/services?lat=&lng=  (public — common services section)
export const listServices = asyncHandler(async (req, res) => {
  const here = parseLatLng(req.query)
  const services = await ServiceProvider.find().limit(50)
  let profiles = services.map((s) => s.toPublicProfile())

  if (here) { 
    profiles = profiles
      .map((p) => ({
        ...p,
        distanceKm:
          p.location?.lat != null && p.location?.lng != null
            ? haversineKm(here.lat, here.lng, p.location.lat, p.location.lng)
            : null,
      }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  }

  res.json(profiles.slice(0, 20))
})
