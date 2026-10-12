import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import { formatPrice } from '../../utils/format.js'
import SkeletonCard from '../../components/SkeletonCard.jsx'
import ErrorState from '../../components/ErrorState.jsx'

const SORTS = [
  { key: 'sales', label: 'Highest Selling' },
  { key: 'profit', label: 'Highest Profit' },
  { key: 'lowest', label: 'Lowest Performing' },
]

function AnalyticsPanel() {
  const [sort, setSort] = useState('sales')
  const { data, loading, error, retry } = useApiData(
    () => api.get(`/api/seller/analytics?sort=${sort}`, { requiresAuth: true }),
    [sort]
  )

  if (loading) {
    return (
      <div className="grid grid-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (error) {
    return <ErrorState error={error} onRetry={retry} title="Couldn't load analytics: " />
  }

  const { totals, products } = data

  const chartData = products.slice(0, 8).map((p) => ({
    name: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name,
    'Units Sold': p.unitsSold,
    'Profit (₹)': p.profit,
  }))

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: 32 }}>
        <div className="stat-card card">
          <span className="stat-label">Total Sales</span>
          <span className="stat-value">{formatPrice(totals.totalSales)}</span>
        </div>
        <div className="stat-card card">
          <span className="stat-label">Online / Offline</span>
          <span className="stat-value" style={{ fontSize: '1.1rem' }}>
            {formatPrice(totals.totalSalesOnline)} / {formatPrice(totals.totalSalesOffline)}
          </span>
        </div>
        <div className="stat-card card">
          <span className="stat-label">Total Profit</span>
          <span className="stat-value">{formatPrice(totals.totalProfit)}</span>
        </div>
        <div className="stat-card card">
          <span className="stat-label">Total Loss</span>
          <span className={`stat-value ${totals.totalLoss > 0 ? 'negative' : ''}`}>
            {formatPrice(totals.totalLoss)}
          </span>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 32 }}>
          <h3 style={{ marginBottom: 16 }}>Units Sold vs Profit by Product</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Units Sold" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Profit (₹)" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="pill-tabs">
        {SORTS.map((s) => (
          <button key={s.key} className={sort === s.key ? 'active' : ''} onClick={() => setSort(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="detail-empty">No sales recorded yet — log a sale from the Sales tab to see analytics.</p>
      ) : (
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Units Sold</th>
              <th>Revenue</th>
              <th>Profit</th>
              <th>Sales Share</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.productId}>
                <td>{p.icon} {p.name}</td>
                <td>{p.unitsSold}</td>
                <td>{formatPrice(p.revenue)}</td>
                <td className={p.profit < 0 ? 'stat-value negative' : ''} style={{ fontSize: 'inherit', fontWeight: 600 }}>
                  {formatPrice(p.profit)}
                </td>
                <td>{p.salesSharePercent}%</td>
                <td style={{ textTransform: 'capitalize' }}>{p.performance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default AnalyticsPanel
