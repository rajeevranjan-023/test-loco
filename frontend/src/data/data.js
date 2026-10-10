// ==========================================================
// All static/dummy data for the Local Product & Service Finder
// lives in this single file so components can simply import it.
// No backend, no database — everything is plain JS arrays.
// ==========================================================

// ---------- Categories ----------
export const categories = [
  { id: 1, icon: '⚡', title: 'Electrician', desc: 'Wiring, switches & repairs' },
  { id: 2, icon: '🎨', title: 'Painter', desc: 'Interior & exterior painting' },
  { id: 3, icon: '🔧', title: 'Plumber', desc: 'Pipes, taps & leak fixing' },
  { id: 4, icon: '🪚', title: 'Carpenter', desc: 'Furniture & woodwork' },
  { id: 5, icon: '🚗', title: 'Mechanic', desc: 'Car & bike servicing' },
  { id: 6, icon: '❄️', title: 'AC Repair', desc: 'Installation & maintenance' },
  { id: 7, icon: '💧', title: 'RO Repair', desc: 'Water purifier service' },
  { id: 8, icon: '💻', title: 'Laptop Repair', desc: 'Hardware & software fixes' },
  { id: 9, icon: '📱', title: 'Mobile Repair', desc: 'Screen & battery repair' },
  { id: 10, icon: '🧹', title: 'Home Cleaning', desc: 'Deep cleaning services' },
  { id: 11, icon: '🐜', title: 'Pest Control', desc: 'Safe pest removal' },
  { id: 12, icon: '📷', title: 'CCTV Installation', desc: 'Home & shop security' },
]

// ---------- Products ----------
export const products = [
  { id: 1, name: 'Laptop', price: '₹42,999', availability: 'In Stock', shop: 'Modern Electronics', distance: '1.2 km', rating: 4.5 },
  { id: 2, name: 'Paint (20L)', price: '₹3,499', availability: 'In Stock', shop: 'City Paint House', distance: '0.8 km', rating: 4.2 },
  { id: 3, name: 'Ceiling Fan', price: '₹1,899', availability: 'In Stock', shop: 'Super Furniture', distance: '2.0 km', rating: 4.4 },
  { id: 4, name: 'Keyboard', price: '₹699', availability: 'In Stock', shop: 'Modern Electronics', distance: '1.2 km', rating: 4.3 },
  { id: 5, name: 'Mouse', price: '₹399', availability: 'In Stock', shop: 'Modern Electronics', distance: '1.2 km', rating: 4.1 },
  { id: 6, name: 'Cement (Bag)', price: '₹380', availability: 'Limited Stock', shop: 'ABC Hardware', distance: '1.5 km', rating: 4.0 },
  { id: 7, name: 'Tiles (per sq.ft)', price: '₹65', availability: 'In Stock', shop: 'ABC Hardware', distance: '1.5 km', rating: 4.3 },
  { id: 8, name: 'Water Tank (1000L)', price: '₹5,999', availability: 'In Stock', shop: 'ABC Hardware', distance: '1.5 km', rating: 4.4 },
]

// ---------- Services (Professionals) ----------
export const services = [
  { id: 1, name: 'Ramesh Kumar', profession: 'Electrician', rating: 4.7, experience: '8 yrs', price: '₹250 onwards', location: 'Sector 12', phone: '+91 98765 43210', availability: 'Available Today' },
  { id: 2, name: 'Suresh Yadav', profession: 'Plumber', rating: 4.6, experience: '6 yrs', price: '₹200 onwards', location: 'Sector 15', phone: '+91 98765 12345', availability: 'Available Today' },
  { id: 3, name: 'Anita Sharma', profession: 'Home Cleaner', rating: 4.8, experience: '4 yrs', price: '₹499 onwards', location: 'Model Town', phone: '+91 91234 56789', availability: 'Available Tomorrow' },
  { id: 4, name: 'Vikram Singh', profession: 'Painter', rating: 4.5, experience: '10 yrs', price: '₹3,000 onwards', location: 'Civil Lines', phone: '+91 99887 76655', availability: 'Available Today' },
  { id: 5, name: 'Manoj Verma', profession: 'Mechanic', rating: 4.4, experience: '7 yrs', price: '₹300 onwards', location: 'Station Road', phone: '+91 90909 80808', availability: 'Available Today' },
  { id: 6, name: 'Deepak Joshi', profession: 'AC Technician', rating: 4.6, experience: '5 yrs', price: '₹350 onwards', location: 'Sector 9', phone: '+91 97654 32109', availability: 'Available Tomorrow' },
]

// ---------- Popular Shops ----------
export const shops = [
  { id: 1, name: 'ABC Hardware', rating: 4.5, distance: '1.5 km', address: 'Main Market Road, Sector 10' },
  { id: 2, name: 'Modern Electronics', rating: 4.6, distance: '1.2 km', address: 'Gandhi Chowk, Sector 12' },
  { id: 3, name: 'City Paint House', rating: 4.3, distance: '0.8 km', address: 'Station Road, Near Bus Stand' },
  { id: 4, name: 'Super Furniture', rating: 4.4, distance: '2.0 km', address: 'Furniture Market, Sector 18' },
]

// ---------- Why Choose Us ----------
export const whyChooseUs = [
  { id: 1, icon: '✅', title: 'Verified Shops', desc: 'Every listed shop is checked and verified for authenticity.' },
  { id: 2, icon: '🛠️', title: 'Verified Workers', desc: 'Professionals are background-checked and skill-verified.' },
  { id: 3, icon: '💰', title: 'Affordable Prices', desc: 'Transparent pricing with no hidden charges.' },
  { id: 4, icon: '⚡', title: 'Fast Search', desc: 'Find what you need near you in just a few seconds.' },
]

// ---------- How It Works ----------
export const howItWorks = [
  { id: 1, step: 'Step 1', title: 'Search', desc: 'Type the product or service you need.' },
  { id: 2, step: 'Step 2', title: 'Compare', desc: 'Compare shops, workers, prices & ratings.' },
  { id: 3, step: 'Step 3', title: 'Choose', desc: 'Pick the best option near your location.' },
  { id: 4, step: 'Step 4', title: 'Contact', desc: 'Call, book, or visit directly.' },
]

// ---------- Testimonials ----------
export const testimonials = [
  { id: 1, name: 'Priya Mehta', avatar: '🧕', stars: 5, review: 'Found a great electrician within minutes. Super convenient and reliable service!' },
  { id: 2, name: 'Rohit Malhotra', avatar: '👨', stars: 4, review: 'The price comparison feature helped me save money on paint for my house.' },
  { id: 3, name: 'Sneha Kapoor', avatar: '👩', stars: 5, review: 'Booked a home cleaner in seconds. The whole process was smooth and trustworthy.' },
]
