export const BUSINESS_TYPES = ['shop', 'service', 'study_center']

// ───────── terminology ─────────
// Keys are the shop-side words used by the shared screens; each schema provides its own. `tx()` (frontend) uses the same table.
const SHOP_TERMS = {
  Customer: 'Customer', customer: 'customer', Customers: 'Customers', customers: 'customers',
  Udhar: 'Udhar', udhar: 'udhar', Dues: 'Udhar', dues: 'udhar',
  DueFrom: 'Due from Customer', businessId: 'Shop ID', owner: 'Owner', business: 'Shop', partner: 'Your Local Business Partner',
}
const STUDY_TERMS = {
  Customer: 'Member', customer: 'member', Customers: 'Members', customers: 'members',
  Udhar: 'Pending Dues', udhar: 'pending dues', Dues: 'Pending Dues', dues: 'pending dues',
  DueFrom: 'Due from Member', businessId: 'Center ID', owner: 'Owner', business: 'Study Center', partner: 'Your Learning Partner',
}

// ───────── navigation ─────────
// key = tab id · sub = URL segment under /@username/ · icon = lucide icon name · requires = capability flag that must be ON
const SHOP_NAV = [
  { key: 'profile', label: 'Profile', sub: '', icon: 'User' },
  { key: 'dashboard', label: 'Dashboard', sub: 'dashboard', icon: 'LayoutDashboard' },
  { key: 'billing', label: 'Billing', sub: 'billing', icon: 'FileText' },
  { key: 'udhar', label: 'Udhar', sub: 'udhar', icon: 'Wallet' },
  { key: 'analytics', label: 'Analytics', sub: 'analytics', icon: 'BarChart3' },
  { key: 'inventory', label: 'Inventory', sub: 'inventory', icon: 'Package' },
  { key: 'customer', label: 'Customer', sub: 'customer', icon: 'Users' },
  { key: 'add', label: 'Add', sub: 'add', icon: 'PlusCircle' },
]
const STUDY_NAV = [
  { key: 'profile', label: 'Profile', sub: '', icon: 'User' },
  { key: 'dashboard', label: 'Dashboard', sub: 'dashboard', icon: 'LayoutDashboard' },
  { key: 'billing', label: 'Billing', sub: 'billing', icon: 'FileText' },
  { key: 'members', label: 'Members', sub: 'members', icon: 'Users' },
  { key: 'courses', label: 'Courses', sub: 'courses', icon: 'GraduationCap' },
  { key: 'seats', label: 'Seats', sub: 'seats', icon: 'Armchair' },
  { key: 'inventory', label: 'Materials', sub: 'inventory', icon: 'Package', requires: 'inventory' }, // only when the centre switches stock tracking on
  { key: 'analytics', label: 'Analytics', sub: 'analytics', icon: 'BarChart3' },
  { key: 'dues', label: 'Pending Dues', sub: 'dues', icon: 'Wallet' },
  { key: 'add', label: 'Add', sub: 'add', icon: 'PlusCircle' },
]

// route key → frontend module. The router renders whatever module the schema names for that URL section;
// a section a schema does not list does not exist for that business (it redirects to the profile).
const SHOP_MODULES = { dashboard: 'orders', billing: 'billing', udhar: 'dues', analytics: 'analytics', inventory: 'inventory', customer: 'people', add: 'billing', bill: 'bill', order: 'bill', products: 'products', offers: 'offers', messages: 'messages', shop: 'shopProfile', settings: 'settings' }
const SERVICE_MODULES = SHOP_MODULES
const STUDY_MODULES = { dashboard: 'studyDashboard', billing: 'billing', members: 'members', member: 'memberDetail', courses: 'courses', seats: 'seats', dues: 'dues', analytics: 'configAnalytics', inventory: 'inventory', add: 'addMenu', bill: 'bill', order: 'bill', shop: 'centerProfile', settings: 'settings', customer: 'members' }

// "Add" menu of a study centre (the shop's Add tab is the billing screen, as before)
const STUDY_ADD_MENU = [
  { key: 'member', label: 'Add Member', hint: 'Register a student / member', icon: 'UserPlus', action: 'member' },
  { key: 'course', label: 'Add Course', hint: 'Name, duration and fee', icon: 'GraduationCap', action: 'course' },
  { key: 'plan', label: 'Add Membership Plan', hint: '1 Month, 3 Months, 6 Months …', icon: 'BadgePercent', action: 'plan' },
  { key: 'seat', label: 'Add Seat', hint: 'One seat or a whole block with your own naming', icon: 'Armchair', action: 'seat' },
  { key: 'zone', label: 'Add Seat Zone', hint: 'Main Hall, Cabin, Reading Room …', icon: 'LayoutGrid', action: 'zone' },
  { key: 'slot', label: 'Add Time Slot', hint: '08:00 AM – 12:00 PM, Full Day …', icon: 'Clock', action: 'slot' },
  { key: 'material', label: 'Add Study Material', hint: 'Books, notes, stationery you bill', icon: 'BookOpen', action: 'material' },
  { key: 'charge', label: 'Add Fine / Charge Type', hint: 'Late fee, lost book, registration …', icon: 'Receipt', action: 'charge' },
]

// ───────── billing item types ─────────
// `order` is the order of the "+ Add …" buttons; `labels` / `addLabels` name each item type for THIS business.
const SHOP_BILLING = { order: ['product', 'service', 'material', 'labour', 'other'], labels: {}, addLabels: {}, partyLabel: 'Customer', idPrefix: '#ORD' }
const STUDY_BILLING = {
  order: ['membership', 'book', 'course', 'fine', 'other', 'registration', 'seat', 'product', 'material'],
  labels: { membership: 'Membership', book: 'Book / Material', course: 'Course Fee', fine: 'Fine', registration: 'Registration Fee', seat: 'Seat Fee', other: 'Other Charge', product: 'Product', material: 'Material' },
  addLabels: { membership: 'Add Membership', book: 'Add Book/Material', course: 'Add Course Fee', fine: 'Add Fine', registration: 'Add Registration', seat: 'Add Seat Fee', other: 'Add Other Charge', product: 'Add Product', material: 'Add Material' },
  partyLabel: 'Member', idPrefix: '#BILL',
}

// what a bill is called in the "Type" column of recent bills
export const STUDY_TXN_LABEL = { membership: 'Membership', course: 'Course Fee', book: 'Book Issue', fine: 'Fine', mixed: 'Mixed', service: 'Other Charge', sale: 'Sale', labour: 'Labour' }
export const SHOP_TXN_LABEL = { sale: 'Sale', service: 'Service', labour: 'Labour', mixed: 'Mixed' }

const SCHEMAS = {
  shop: {
    type: 'shop', label: 'Shop / Seller', terms: SHOP_TERMS, nav: SHOP_NAV, modules: SHOP_MODULES, addMenu: null,
    billing: SHOP_BILLING, txnLabels: SHOP_TXN_LABEL,
    capabilities: { inventory: true, products: true, seatManagement: false, courses: false, members: false },
    brand: { icon: 'Store', tagline: (cat) => `Your Local ${cat || 'Business'} Partner` },
    profile: { layout: 'shop' }, dashboard: { provider: 'orders' }, analytics: { provider: 'shop' },
    footerLinks: [['Dashboard', 'dashboard'], ['Analytics', 'analytics'], ['Inventory', 'inventory']],
    userMenu: [['Products', '/analytics/products'], ['Offers & Discounts', '/analytics/offers'], ['Messages', '/analytics/messages'], ['Shop Details', '/analytics/profile'], ['Settings', '/analytics/settings']],
  },
  service: {
    type: 'service', label: 'Service Provider', terms: SHOP_TERMS, nav: SHOP_NAV, modules: SERVICE_MODULES, addMenu: null,
    billing: SHOP_BILLING, txnLabels: SHOP_TXN_LABEL,
    capabilities: { inventory: true, products: true, seatManagement: false, courses: false, members: false },
    brand: { icon: 'Store', tagline: (cat) => `Your Local ${cat || 'Business'} Partner` },
    profile: { layout: 'service' }, dashboard: { provider: 'orders' }, analytics: { provider: 'shop' },
    footerLinks: [['Dashboard', 'dashboard'], ['Analytics', 'analytics'], ['Inventory', 'inventory']],
    userMenu: [['Products', '/analytics/products'], ['Offers & Discounts', '/analytics/offers'], ['Messages', '/analytics/messages'], ['Shop Details', '/analytics/profile'], ['Settings', '/analytics/settings']],
  },
  study_center: {
    type: 'study_center', label: 'Study Center / Library', terms: STUDY_TERMS, nav: STUDY_NAV, modules: STUDY_MODULES, addMenu: STUDY_ADD_MENU,
    billing: STUDY_BILLING, txnLabels: STUDY_TXN_LABEL,
    // Shop-only features are OFF unless the centre switches them on (account.config.features)
    capabilities: { inventory: false, products: false, seatManagement: true, courses: true, members: true },
    brand: { icon: 'GraduationCap', tagline: () => 'Your Learning Partner' },
    profile: { layout: 'study_center' }, dashboard: { provider: 'study' }, analytics: { provider: 'study' },
    footerLinks: [['Dashboard', 'dashboard'], ['Members', 'members'], ['Courses', 'courses']],
    userMenu: [['Center Details', '/analytics/profile'], ['Settings', '/analytics/settings']],
    // account defaults written when a Study Center account is created — the owner never has to configure these to start
    defaults: {
      operatingHours: { open: '06:00', close: '22:00' },
      zones: [{ key: 'main-hall', name: 'Main Hall' }],
      seatTypes: [{ key: 'regular', name: 'Regular' }, { key: 'premium', name: 'Premium' }, { key: 'cabin', name: 'Cabin' }],
      timeSlots: [
        { key: 'morning', label: 'Morning', start: '06:00', end: '12:00' },
        { key: 'afternoon', label: 'Afternoon', start: '12:00', end: '18:00' },
        { key: 'evening', label: 'Evening', start: '18:00', end: '22:00' },
      ],
      plans: [
        { key: '1m', name: '1 Month', months: 1, price: 1000 },
        { key: '3m', name: '3 Months', months: 3, price: 2800 },
        { key: '6m', name: '6 Months', months: 6, price: 5200 },
        { key: '1y', name: '1 Year', months: 12, price: 9500 },
      ],
      chargeTypes: [{ key: 'late-fee', label: 'Late Fee', kind: 'fine', amount: 50 }, { key: 'lost-book', label: 'Lost Book', kind: 'fine', amount: 300 }, { key: 'registration', label: 'Registration Fee', kind: 'registration', amount: 200 }],
      materials: [],
      features: { inventory: false, products: false },
      memberPrefix: 'STU',
    },
  },
}

export const isBusinessType = (t) => BUSINESS_TYPES.includes(t)
// unknown / missing type → the service schema, exactly what the old `sellerType === 'shop' ? … : service` code did
export const schemaFor = (sellerType) => SCHEMAS[sellerType] || SCHEMAS.service
export const termsFor = (sellerType) => schemaFor(sellerType).terms
export const hasCapability = (sellerType, cap) => !!schemaFor(sellerType).capabilities[cap]

// Capabilities as switched by THIS account (a study centre may explicitly enable inventory / products).
export function capabilitiesOf(sellerType, account) {
  const s = schemaFor(sellerType), flags = account?.config?.features || {}
  const out = { ...s.capabilities }
  for (const [k, v] of Object.entries(flags)) if (typeof v === 'boolean' && k in out) out[k] = v // the owner's explicit switch wins
  return out
}

export const navOf = (sellerType, account) => {
  const caps = capabilitiesOf(sellerType, account)
  return schemaFor(sellerType).nav.filter((n) => !n.requires || caps[n.requires])
}

// ONE object for the frontend. No functions, no secrets.
export function publicBusiness(sellerType, account) {
  const s = schemaFor(sellerType), caps = capabilitiesOf(sellerType, account)
  const category = account?.category || account?.workType || ''
  return {
    type: s.type, label: s.label, terms: s.terms, nav: navOf(sellerType, account), modules: s.modules, addMenu: s.addMenu,
    capabilities: caps, brand: { icon: s.brand.icon, tagline: s.brand.tagline(category) }, profile: s.profile, dashboard: s.dashboard, analytics: s.analytics,
    footerLinks: s.footerLinks, userMenu: s.userMenu, billing: { partyLabel: s.billing.partyLabel, labels: s.billing.labels, addLabels: s.billing.addLabels, txnLabels: s.txnLabels },
  }
}
