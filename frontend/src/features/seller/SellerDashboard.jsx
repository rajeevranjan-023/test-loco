import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import StarRating from '../../components/StarRating.jsx'
import { formatPrice } from '../../utils/format.js'
import AnalyticsPanel from './AnalyticsPanel.jsx'
import ProductsPanel from './ProductsPanel.jsx'
import SalesPanel from './SalesPanel.jsx'
import CreditPanel from './CreditPanel.jsx'
import '../../css/Home.css'

const TABS = [
  { key: 'analytics', label: '📊 Analytics' },
  { key: 'products', label: '📦 Products' },
  { key: 'sales', label: '🧾 Sales' },
  { key: 'credit', label: '💳 Udhar / Credit' },
]

function SellerDashboard() {
  const [tab, setTab] = useState('analytics')
  const { data, loading, error } = useApiData(() => api.get('/api/seller/me', { requiresAuth: true }), [])

  if (loading) {
    return <section className="section"><div className="container detail-empty">Loading your dashboard...</div></section>
  }

  if (error || !data) {
    return (
      <section className="section">
        <div className="container detail-empty">Couldn't load your seller account.</div>
      </section>
    )
  }

  const { sellerType, account } = data

  if (sellerType === 'service') {
    return <ServiceSellerSummary account={account} />
  }

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading" style={{ textAlign: 'left' }}>
          <h2>{account.name} - Dashboard</h2>
          <p>
            Your public profile is at{' '}
            <Link to={'/' + account.username} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              localfinder.app/{account.username}
            </Link>
          </p>
        </div>

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
    </section>
  )
}

function ServiceSellerSummary({ account }) {
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="section-heading" style={{ textAlign: 'left' }}>
          <h2>{account.name} - Your Profile</h2>
          <p>Analytics, product tracking, and the credit ledger are built for shop accounts.</p>
        </div>

        <div className="detail-body card">
          <StarRating rating={account.rating} reviews={account.reviewCount} />
          <p style={{ margin: '12px 0' }}>{account.description || 'No description yet.'}</p>
          <p className="service-price" style={{ fontSize: '1.1rem' }}>
            Starting at <strong>{formatPrice(account.price ? account.price.amount : null)}</strong> / {account.price ? account.price.unit : ''}
          </p>
          <p style={{ color: 'var(--color-text-light)' }}>Serves {account.serviceArea || 'your area'}</p>

          <Link to={'/' + account.username} className="btn btn-primary" style={{ marginTop: 20 }}>
            View my public profile
          </Link>
        </div>
      </div>
    </section>
  )
}

export default SellerDashboard
