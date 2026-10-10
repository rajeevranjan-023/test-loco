// Mirrors backend/utils/authHelpers.js → normalizeIndianMobile (the server is still the authority).
export function normalizeIndianMobile(raw) {
  let d = String(raw ?? '').replace(/[\s\-().]/g, '')
  if (d.startsWith('+')) { if (!d.startsWith('+91')) return null; d = d.slice(3) }
  else if (d.startsWith('0091')) d = d.slice(4)
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? d : null
}
export const formatPhone = (national) => (national && national.length === 10 ? `+91 ${national.slice(0, 5)} ${national.slice(5)}` : national || '')
