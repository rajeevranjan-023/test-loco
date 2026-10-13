import React, { createContext, useContext, useMemo } from 'react'

export const SHOP_BUSINESS = {
  type: 'shop', terms: { Customer: 'Customer', customer: 'customer', Customers: 'Customers', customers: 'customers', Udhar: 'Udhar', udhar: 'udhar', Dues: 'Udhar', dues: 'udhar', DueFrom: 'Due from Customer', businessId: 'Shop ID', owner: 'Owner', business: 'Shop', partner: 'Your Local Business Partner' },
  nav: [
    { key: 'profile', label: 'Profile', sub: '', icon: 'User' }, { key: 'dashboard', label: 'Dashboard', sub: 'dashboard', icon: 'LayoutDashboard' }, { key: 'billing', label: 'Billing', sub: 'billing', icon: 'FileText' },
    { key: 'udhar', label: 'Udhar', sub: 'udhar', icon: 'Wallet' }, { key: 'analytics', label: 'Analytics', sub: 'analytics', icon: 'BarChart3' }, { key: 'inventory', label: 'Inventory', sub: 'inventory', icon: 'Package' },
    { key: 'customer', label: 'Customer', sub: 'customer', icon: 'Users' }, { key: 'add', label: 'Add', sub: 'add', icon: 'PlusCircle' },
  ],
  modules: { dashboard: 'orders', billing: 'billing', udhar: 'dues', analytics: 'analytics', inventory: 'inventory', customer: 'people', add: 'billing', bill: 'bill', order: 'bill', products: 'products', offers: 'offers', messages: 'messages', shop: 'shopProfile', settings: 'settings' },
  addMenu: null, capabilities: {}, brand: { icon: 'Store', tagline: '' }, footerLinks: [['Dashboard', 'dashboard'], ['Analytics', 'analytics'], ['Inventory', 'inventory']], userMenu: null,
  billing: { partyLabel: 'Customer', labels: {}, addLabels: {}, txnLabels: { sale: 'Sale', service: 'Service', labour: 'Labour', mixed: 'Mixed' } },
}

const Ctx = createContext({ business: SHOP_BUSINESS, ready: false })

export function makeTx(terms) {
  const map = [['Customers', terms.Customers], ['customers', terms.customers], ['Customer', terms.Customer], ['customer', terms.customer], ['Udhar', terms.Udhar], ['udhar', terms.udhar]]
  return (s) => (typeof s === 'string' ? map.reduce((out, [from, to]) => (to && to !== from ? out.replace(new RegExp(`\\b${from}\\b`, 'g'), to) : out), s) : s)
}

export function BusinessProvider({ business, children }) {
  const value = useMemo(() => {
    const b = business || SHOP_BUSINESS
    return { business: b, ready: !!business, tx: makeTx(b.terms), t: b.terms, isStudy: b.type === 'study_center', has: (mod) => !!b.modules?.[mod], cap: (k) => !!b.capabilities?.[k] }
  }, [business])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const useBusiness = () => {
  const v = useContext(Ctx)
  return v.tx ? v : { ...v, tx: (s) => s, t: SHOP_BUSINESS.terms, isStudy: false, has: () => true, cap: () => false }
}
