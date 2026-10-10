import React, { useState } from 'react'
import AnalyticsPanel from '../../features/seller/AnalyticsPanel.jsx'
import ProductsPanel from '../../features/seller/ProductsPanel.jsx'
import SalesPanel from '../../features/seller/SalesPanel.jsx'
import CreditPanel from '../../features/seller/CreditPanel.jsx'

const TABS = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'products', label: 'Products' },
  { key: 'sales', label: 'Sales' },
  { key: 'credit', label: 'Udhar / Credit' },
]

function AnalyticsSection() {
  const [tab, setTab] = useState('analytics')

  return (
    <div>
      <div className="dashboard-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={'dashboard-tab ' + (tab === t.key ? 'active' : '')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && <AnalyticsPanel />}
      {tab === 'products' && <ProductsPanel />}
      {tab === 'sales' && <SalesPanel />}
      {tab === 'credit' && <CreditPanel />}
    </div>
  )
}

export default AnalyticsSection
