export const categories = [
  ['Kirana','kirana.png'],
  ['Fruits & Veg','fruits-veg.png'],
  ['Dairy & Eggs','dairy.png'],
  ['Snacks','snacks.png'],
  ['Electronics','electronics.png'],
  ['Mobiles','mobile.png'],
  ['Home & Kitchen','home-kitchen.png'],
  ['Fashion','fashion.png'],
  ['Beauty','beauty.png'],
  ['Hardware','hardware.png'],
  ['Medical','medical.png'],
  ['Education','education.png'],
  ['Home Services','home-services.png'],
  ['Repairs','repair.png'],
  ['Vehicles','vehicles.png'],
].map(([name, img]) => ({ name, img }));

export const bestPrices = [
  { name: 'Milk (1L)', price: '₹48 - ₹52', shops: 6, best: '₹48', img: 'milk.png' },
  { name: 'Bread', price: '₹30 - ₹35', shops: 4, best: '₹30', img: 'bread.png' },
  { name: 'Parle-G Biscuit 100g', price: '₹9 - ₹12', shops: 7, best: '₹9', img: 'parle-g.png' },
  { name: 'Tomato (1kg)', price: '₹18 - ₹25', shops: 5, best: '₹18', img: 'tomato.png' },
  { name: 'Onion (1kg)', price: '₹20 - ₹28', shops: 4, best: '₹20', img: 'onion.png' },
  { name: 'Sunflower Oil (1L)', price: '₹120 - ₹135', shops: 5, best: '₹120', img: 'sunflower-oil.png' },
]

export const shops = [
  { name: 'Gupta Kirana Store', rating: 4.5, reviews: 120, km: 0.8, tags: ['Kirana','Dairy','Snacks'], img: 'shops-1.png' },
  { name: 'Sharma Electronics', rating: 4.2, reviews: 98, km: 1.2, tags: ['Mobiles','Electronics'], img: 'shops-2.png' },
  { name: 'Fresh Mart', rating: 4.0, reviews: 67, km: 1.5, tags: ['Fruits & Veg','Dairy'], img: 'shops-3.png' },
]

export const popularCategories = [
  ['Groceries', 'kirana.png'],
  ['Electronics', 'electronics.png'],
  ['Home & Kitchen', 'home-kitchen.png'],
  ['Fashion', 'fashion.png'],
  ['Beauty & Care', 'beauty.png'],
  ['Medical', 'medical.png']
].map(([name, img]) => ({ name, img }));

export const services = [
  ['Electrician', 200, 'electrician.png'],
  ['Plumber', 250, 'plumber.png'],
  ['AC Repair', 300, 'ac-repair.png'],
  ['Home Cleaning', 200, 'home-cleaning.png'],
  ['Car/Bike Repair', 200, 'vehicle-repair.png'],
  ['Laptop Repair', 250, 'laptop-repair.png'],
].map(([name, from, img]) => ({ name, from, img }));
export const trending = [
  ['Parle-G Biscuit','100g',9,10,10,'parle-g.png'],
  ['Amul Taaza Milk','1L',48,50,5,'amul-milk.png'],
  ['Maggi Noodles','70g',12,14,12,'maggi.png'],
  ['Surf Excel Detergent','1kg',110,120,8,'surf-excel.png'],
  ['Aashirvaad Atta','1kg',56,66,15,'aashirvaad-atta.png'],
  ['Coca-Cola','750ml',40,46,10,'coca-cola.png'],
].map(([name, unit, price, mrp, off, img]) => ({
  name, unit, price, mrp, off, img
}));

export const cities = ['Bhopal','Indore','Jabalpur','Gwalior','Ujjain','Sagar','Rewa','Ratlam']
export const heroChips = ['Milk','Biscuit','Electrician','Laptop','Plumber','Kirana Shop']


/* ---------- Loco homepage v2 (dummy data, placeholders only) ---------- */
export const gridCategories = [
  { name: 'Shops', img: 'category-shops.png', desc: 'Kirana, Electronics, Clothing & more', icon: '🏪', tone: 'bg-orange-50' },
  { name: 'Services', img: 'category-services.png', desc: 'Electrician, Plumber, Salon & more', icon: '🔧', tone: 'bg-green-50' },
  { name: 'Libraries', img: 'category-libraries.png', desc: 'Study spaces, Book rental', icon: '📖', tone: 'bg-violet-50' },
  { name: 'Transport', img: 'category-transport.png', desc: 'Auto, Cab, Bus, Travel & more', icon: '🚌', tone: 'bg-sky-50' },
  { name: 'PG / Hostels', img: 'category-pg-hostels.png', desc: 'Rooms, PG, Hostels', icon: '🏠', tone: 'bg-rose-50' },
  { name: 'Food & Beverages', img: 'category-food-beverages.png', desc: 'Restaurants, Cafes & more', icon: '🍴', tone: 'bg-amber-50' },
  { name: 'Healthcare', img: 'category-healthcare.png', desc: 'Clinics, Pharmacies, Diagnostic centers', icon: '➕', tone: 'bg-emerald-50' },
  { name: 'More', img: 'category-more.png', desc: 'Education, Repair, Events, Others', icon: '⋯', tone: 'bg-gray-100' },
]

export const heroChipsV2 = ['Kirana', 'Electronics', 'Plumber', 'Salon', 'Library', 'AC Repair', 'Home Cleaning']

export const shopList = [
  { name: 'Gupta Kirana Store', img: 'kirana.png', category: 'Kirana Store', rating: 4.5, reviews: 120, location: 'Civil Line, Bhopal' },
  { name: 'Fresh Mart', img: 'fruits-veg.png', category: 'Fruits & Vegetables', rating: 4.2, reviews: 85, location: 'Moti Nagar, Bhopal' },
  { name: 'Sharma Electronics', img: 'electronics.png', category: 'Electronics', rating: 4.6, reviews: 92, location: 'Indrapuri, Bhopal' },
  { name: 'Style Hub', img: 'fashion.png', category: 'Clothing & Fashion', rating: 4.3, reviews: 60, location: 'Sadar Bazar, Bhopal' },
]
export const serviceList = [
  { name: 'Ravi Electrician', img: 'electrician.png', category: 'Electrician', rating: 4.8, reviews: 45, location: 'Sagar City, Bhopal' },
  { name: 'FastFix Plumbing', img: 'plumber.png', category: 'Plumber', rating: 4.6, reviews: 38, location: 'Bhopal, MP' },
  { name: 'City Salon', img: 'beauty.png', category: 'Salon & Grooming', rating: 4.4, reviews: 72, location: 'New Market, Bhopal' },
  { name: 'Home Care Services', img: 'home-cleaning.png', category: 'Cleaning Services', rating: 4.3, reviews: 51, location: 'Arera Colony, Bhopal' },
]
export const libraryList = [
  { name: 'City Central Library', img: 'city-central-library.png', category: 'Public Library', rating: 4.3, reviews: 90, location: 'Maharana Pratap Nagar' },
  { name: 'Knowledge Hub', img: 'knowledge-hub.png', category: 'Study Space', rating: 4.3, reviews: 64, location: '10 No. Market, Bhopal' },
  { name: 'Scholars Library', img: 'scholars-library.png', category: 'Book Rental', rating: 4.5, reviews: 72, location: 'Indrapuri, Bhopal' },
  { name: 'Readers Point', img: 'readers-point.png', category: 'Study Space', rating: 4.2, reviews: 58, location: 'Bittan Market, Bhopal' },
]
export const transportList = [
  { name: 'City Auto Service', img: 'city-auto-service.png', category: 'Auto Service', rating: 4.4, reviews: 110, location: 'Bhopal, MP' },
  { name: 'MP Travels', img: 'mp-travels.png', category: 'Bus Service', rating: 4.5, reviews: 88, location: 'ISBT, Bhopal' },
  { name: 'RideNow Cabs', img: 'ridenow-cabs.png', category: 'Cab Service', rating: 4.3, reviews: 95, location: 'Bhopal, MP' },
  { name: 'City Bike Rentals', img: 'city-bike-rentals.png', category: 'Bike Rental', rating: 4.1, reviews: 48, location: 'New Market, Bhopal' },
]

export const promos = {
  shops: { img: 'promo-shops.png', tone: 'from-sky-50 to-orange-50', title: 'Need a Shop?', highlight: 'Explore Verified Local Shops', points: ['Grocery Stores', 'Electronics', 'Clothing & Fashion', 'Daily Essentials', 'and more...'], cta: 'Explore Shops', query: 'Shops' },
  services: { img: 'promo-services.png', tone: 'from-orange-50 to-amber-50', title: 'Need a Service?', highlight: 'Find Trusted Local Experts', points: ['Electrician', 'Plumber', 'AC Repair', 'Home Cleaning', 'Salon & Grooming', 'and more...'], cta: 'Book a Service', query: 'Services' },
  libraries: { img: 'promo-libraries.png', tone: 'from-orange-50 to-amber-50', title: 'Find a Library?', highlight: 'Study · Read · Grow', points: ['Study Spaces', 'Book Rentals', 'Quiet Environment', 'Student Friendly', 'and more...'], cta: 'Explore Libraries', query: 'Library' },
  transport: { img: 'promo-transport.png', tone: 'from-rose-50 to-orange-50', title: 'Need to Travel?', highlight: 'Local Transport Options', points: ['Auto & Rickshaw', 'Cab Services', 'Bus Services', 'Bike Rentals', 'and more...'], cta: 'Explore Transport', query: 'Transport' },
}

export const browseCities = ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Rewa', 'Ratlam'].map((name) => ({ name, img: `${name.toLowerCase()}.png` }))

export const whyLoco = [
  { icon: '🛡️', title: 'Verified Businesses', desc: 'Trusted and verified local shops and service providers.', tone: 'bg-indigo-50' },
  { icon: '₹', title: 'Best Prices', desc: 'Compare prices and get the best local deals.', tone: 'bg-orange-50' },
  { icon: '▦', title: 'Wide Categories', desc: 'Everything you need in one place.', tone: 'bg-violet-50' },
  { icon: '❤️', title: 'Support Local', desc: 'Help local businesses and grow your community.', tone: 'bg-rose-50' },
]

export const footerCols = [
  ['Explore', [['Home', '/'], ['Search', '/search'], ['Analytics', '/start-yours'], ['Shops', '/search'], ['Services', '/search'], ['Libraries', '/search'], ['Transport', '/search'], ['Offers', '/search']]],
  ['For Sellers', [['Create Seller Account', '/start-yours'], ['Manage Shop', '/start-yours'], ['Analytics', '/start-yours'], ['Grow Business', '/start-yours']]],
  ['Company', [['About Us', '/about'], ['Contact & Support', '/contact'], ['Terms & Conditions', '/terms'], ['Privacy Policy', '/privacy'], ['FAQs', '/faq']]],
]
