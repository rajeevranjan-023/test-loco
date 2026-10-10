
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371                                       //radius of the earth in km  
  const dLat = ((lat2 - lat1) * Math.PI) / 180         //difference in latitude in radians
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =                                            // give accurate angular distance
    Math.sin(dLat / 2) ** 2 +                          // on earth as curve
    Math.cos((lat1 * Math.PI) / 180) * 
    Math.cos((lat2 * Math.PI) / 180) * 
    Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) //covert angular distance -> linear distance
  return Math.round(R * c * 10) / 10                    //round to 1 decimal place
} 

export function parseLatLng(query) {                    // lat/lng return in num
  const lat = Number(query.lat)
  const lng = Number(query.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return null                                            // if not vlid, return null
}
