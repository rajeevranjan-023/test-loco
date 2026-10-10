import React, { useState } from 'react'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import { useFeedback } from '../../hooks/useFeedback.js'
import { useLongPress } from '../../hooks/useLongPress.js'
import { formatPrice } from '../../utils/format.js'
import { ShimmerTable } from '../../components/loading/ShimmerLayouts.jsx'
import FeedbackBanner from '../../components/FeedbackBanner.jsx'
import EditButton from '../../components/common/EditButton.jsx'
import DeleteButton from '../../components/common/DeleteButton.jsx'
import EditCreditModal from './EditCreditModal.jsx'
import Spinner from '../../components/loading/Spinner.jsx'
import '../../css/Dashboard.css'

function CreditCard({ credit, busy, onEdit, onPay, onDelete, onTogglePin, showPay, pinDisabled }) {
  const canLongPressPin = credit.pinned || !pinDisabled
  const longPress = useLongPress(
    () => { if (canLongPressPin) onTogglePin(credit) },
    undefined, // a plain click on the card itself does nothing — actions have their own buttons
  )

  const pinHint = credit.pinned
    ? 'Pinned — press and hold, or use the pin button, to unpin'
    : pinDisabled
      ? 'Pin limit reached (4/4) — unpin another entry first'
      : 'Press and hold, or use the pin button, to pin (up to 4)'

  return (
    <div
      className={'credit-card card ' + (credit.pinned ? 'credit-card-pinned' : '')}
      {...(canLongPressPin ? longPress : {})}
      title={pinHint}
    >
      {credit.pinned && <span className="credit-card-pin-badge">📌 Pinned</span>}
      <button
        type="button"
        className={'credit-card-pin-btn ' + (credit.pinned ? 'active' : '')}
        onClick={() => onTogglePin(credit)}
        disabled={!credit.pinned && pinDisabled}
        aria-label={credit.pinned ? 'Unpin this entry' : 'Pin this entry'}
        title={pinHint}
      >
        📌
      </button>
      <div className="credit-card-top">
        <div>
          <p className="credit-card-name">{credit.customerName}</p>
          {credit.phone && <p className="credit-card-phone">{credit.phone}</p>}
        </div>
        <span className={'badge ' + (credit.paid ? 'badge-success' : 'badge-warning')}>
          {credit.paid ? 'Paid' : 'Unpaid'}
        </span>
      </div>
      <p className="credit-card-amount">{formatPrice(credit.amount)}</p>
      {credit.notes && <p className="credit-card-notes">{credit.notes}</p>}
      <div className="credit-card-actions">
        {busy ? (
          <Spinner size="sm" />
        ) : (
          <>
            <EditButton label={`Edit ${credit.customerName}`} onClick={() => onEdit(credit)} />
            {showPay && (
              <button className="btn btn-outline btn-sm" onClick={() => onPay(credit)}>Mark Paid</button>
            )}
            <DeleteButton label={`Delete ${credit.customerName}`} onClick={() => onDelete(credit)} />
          </>
        )}
      </div>
    </div>
  )
}

function CreditPanel() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [sortMode, setSortMode] = useState('recent')
  const [form, setForm] = useState({ customerName: '', phone: '', amount: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [editingCredit, setEditingCredit] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const { feedback, showSuccess, showError } = useFeedback()

  const { data, loading } = useApiData(
    () => api.get(`/api/seller/credits?sort=${sortMode}`, { requiresAuth: true }),
    [refreshKey, sortMode]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/api/seller/credits', {
        customerName: form.customerName,
        phone: form.phone,
        amount: Number(form.amount),
        notes: form.notes,
      }, { requiresAuth: true })
      showSuccess(`Added ${form.customerName} to the credit ledger.`)
      setForm({ customerName: '', phone: '', amount: '', notes: '' })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const runAction = async (id, action, successMsg) => {
    setBusyId(id)
    try {
      await action()
      showSuccess(successMsg)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const markPaid = (c) => runAction(c._id, () => api.patch(`/api/seller/credits/${c._id}/pay`, {}, { requiresAuth: true }), `Marked ${c.customerName}'s credit as paid.`)
  const remove = (c) => runAction(c._id, () => api.delete(`/api/seller/credits/${c._id}`, { requiresAuth: true }), `Removed ${c.customerName} from the ledger.`)
  const togglePin = (c) => runAction(c._id, () => api.patch(`/api/seller/credits/${c._id}/pin`, {}, { requiresAuth: true }), c.pinned ? `Unpinned ${c.customerName}.` : `Pinned ${c.customerName}.`)

  return (
    <div>
      {!loading && (
        <div className="stat-card card" style={{ marginBottom: 24, maxWidth: 260 }}>
          <span className="stat-label">Total Udhar Due</span>
          <span className="stat-value negative">{formatPrice(data.totalDue)}</span>
        </div>
      )}

      <form className="dashboard-form-row card" style={{ padding: 20 }} onSubmit={handleSubmit}>
        <label style={{ minWidth: 160 }}>
          Customer name
          <input required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
        </label>
        <label style={{ minWidth: 150 }}>
          Phone
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label>
          Amount (₹)
          <input required type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </label>
        <label style={{ flex: 1, minWidth: 160 }}>
          Notes
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What was it for?" />
        </label>
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? <Spinner size="sm" label="Adding…" /> : 'Add Customer'}
        </button>
      </form>

      <FeedbackBanner feedback={feedback} />

      {loading ? (
        <ShimmerTable rows={4} columns={6} />
      ) : (
        <>
          <div className="credit-section-header">
            <h3>⏳ Unpaid ({data.unpaid.length})</h3>
            <div className="requirement-filter-row" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className={`faq-category-tab ${sortMode === 'recent' ? 'active' : ''}`}
                onClick={() => setSortMode('recent')}
              >
                Recent
              </button>
              <button
                type="button"
                className={`faq-category-tab ${sortMode === 'amount' ? 'active' : ''}`}
                onClick={() => setSortMode('amount')}
              >
                Highest Amount
              </button>
            </div>
          </div>
          <p className="credit-pin-hint">📌 Tap the pin icon (or press and hold a card) to pin it — up to 4 at a time. Pinned cards always show first. <strong>{data.pinnedCount}/4 pinned.</strong></p>

          {data.unpaid.length === 0 ? (
            <p className="detail-empty">No unpaid udhar — nice!</p>
          ) : (
            <div className="credit-grid">
              {data.unpaid.map((c) => (
                <CreditCard
                  key={c._id}
                  credit={c}
                  busy={busyId === c._id}
                  onEdit={setEditingCredit}
                  onPay={markPaid}
                  onDelete={remove}
                  onTogglePin={togglePin}
                  pinDisabled={data.pinnedCount >= 4}
                  showPay
                />
              ))}
            </div>
          )}

          <h3 style={{ margin: '32px 0 14px' }}>✅ Paid history ({data.paid.length})</h3>
          {data.paid.length === 0 ? (
            <p className="detail-empty">No payments recorded yet.</p>
          ) : (
            <div className="credit-grid">
              {data.paid.map((c) => (
                <CreditCard
                  key={c._id}
                  credit={c}
                  busy={busyId === c._id}
                  onEdit={setEditingCredit}
                  onDelete={remove}
                  onTogglePin={() => {}}
                  showPay={false}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editingCredit && (
        <EditCreditModal
          credit={editingCredit}
          onClose={() => setEditingCredit(null)}
          onSaved={(msg) => { showSuccess(msg); setEditingCredit(null); setRefreshKey((k) => k + 1) }}
          onError={showError}
        />
      )}
    </div>
  )
}

export default CreditPanel
