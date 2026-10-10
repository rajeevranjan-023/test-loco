// Presentation config only — NOT business data. Copy for the static "Why Choose Loco" block and footer links.
export const whyLoco = [
  { icon: '🛡️', title: 'Verified Businesses', desc: 'Trusted and verified local shops and service providers.', tone: 'bg-indigo-50' },
  { icon: '₹', title: 'Best Prices', desc: 'Compare prices and get the best local deals.', tone: 'bg-orange-50' },
  { icon: '▦', title: 'Wide Categories', desc: 'Everything you need in one place.', tone: 'bg-violet-50' },
  { icon: '❤️', title: 'Support Local', desc: 'Help local businesses and grow your community.', tone: 'bg-rose-50' },
]

export const footerCols = [
  ['Explore', [['Home', '/'], ['Search', '/search'], ['Analytics', '/start-yours'], ['Shops', '/search'], ['Services', '/search'], ['Libraries', '/search'], ['Offers', '/search']]],
  ['For Sellers', [['Create Seller Account', '/start-yours'], ['Manage Shop', '/start-yours'], ['Analytics', '/start-yours'], ['Grow Business', '/start-yours']]],
  ['Company', [['About Us', '/about'], ['Contact & Support', '/contact'], ['Terms & Conditions', '/terms'], ['Privacy Policy', '/privacy'], ['FAQs', '/faq']]],
]

// The database stores a tone KEY; the full class strings live here so Tailwind can see them at build time.
export const TILE_TONES = {
  orange: 'bg-orange-50', green: 'bg-green-50', violet: 'bg-violet-50', sky: 'bg-sky-50', rose: 'bg-rose-50',
  amber: 'bg-amber-50', emerald: 'bg-emerald-50', gray: 'bg-gray-100',
}
export const PROMO_TONES = {
  sky: 'from-sky-50 to-orange-50', orange: 'from-orange-50 to-amber-50', rose: 'from-rose-50 to-orange-50',
  green: 'from-green-50 to-orange-50', violet: 'from-violet-50 to-orange-50',
}
