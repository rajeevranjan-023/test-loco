import React, { useState } from 'react'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import { useFeedback } from '../../hooks/useFeedback.js'
import { formatPrice } from '../../utils/format.js'
import { ShimmerList } from '../../components/loading/ShimmerLayouts.jsx'
import FeedbackBanner from '../../components/FeedbackBanner.jsx'
import EditButton from '../../components/common/EditButton.jsx'
import SearchableSelect from '../../components/common/SearchableSelect.jsx'
import QuantityStepper from '../../components/common/QuantityStepper.jsx'
import EditSaleModal from './EditSaleModal.jsx'
import Spinner from '../../components/loading/Spinner.jsx'
import '../../css/Dashboard.css'

const emptyLine = () => ({ key: Math.random().toString(36).slice(2), productId: '', quantity: 1 })

function SalesPanel() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [lines, setLines] = useState([emptyLine()])
  const [channel, setChannel] = useState('offline')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMode, setPaymentMode] = useState('full') // 'full' | 'custom'
  const [amountPaid, setAmountPaid] = useState('')
  const [addRemainingToUdhar, setAddRemainingToUdhar] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingSale, setEditingSale] = useState(null)
  const { feedback, showSuccess, showError } = useFeedback()

  const { data: products } = useApiData(() => api.get('/api/seller/products', { requiresAuth: true }), [refreshKey])
  const { data: sales, loading: loadingSales } = useApiData(
    () => api.get('/api/seller/sales', { requiresAuth: true }),
    [refreshKey]
  )
  const { data: bills } = useApiData(() => api.get('/api/seller/bills', { requiresAuth: true }), [refreshKey])

  const productOptions = (products || []).map((p) => ({
    value: p._id,
    label: p.icon + ' ' + p.name,
    meta: '₹' + p.price + '/' + p.priceUnit + ' · ' + p.stock + ' left',
  }))
  const productById = new Map((products || []).map((p) => [p._id, p]))
  const billByBillId = new Map((bills || []).map((b) => [b.billId, b]))

  const updateLine = (key, patch) => {
    setLines((ls) => {
      const next = ls.map((l) => (l.key === key ? { ...l, ...patch } : l))
      const idx = next.findIndex((l) => l.key === key)
      const isLastRow = idx === next.length - 1
      if (isLastRow && patch.productId) {
        next.push(emptyLine())
      }
      return next
    })
  }
  const removeLine = (key) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls))

  const activeLines = lines.filter((l) => l.productId && l.quantity > 0)
  const totalAmount = activeLines.reduce((sum, l) => {
    const product = productById.get(l.productId)
    return sum + (product ? product.price * Number(l.quantity) : 0)
  }, 0)
  const paidValue = paymentMode === 'full' ? totalAmount : Number(amountPaid) || 0
  const unpaidValue = Math.max(0, Math.round((totalAmount - paidValue) * 100) / 100)

  const resetForm = () => {
    setLines([emptyLine()])
    setCustomerName('')
    setCustomerPhone('')
    setPaymentMode('full')
    setAmountPaid('')
    setAddRemainingToUdhar(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const items = activeLines
    if (items.length === 0) {
      showError('Add at least one product with a quantity.')
      return
    }
    if (unpaidValue > 0 && addRemainingToUdhar && !customerName.trim()) {
      showError('Enter a customer name to add the remaining balance to Udhar.')
      return
    }

    setSubmitting(true)
    try {
      const result = await api.post('/api/seller/sales', {
        items: items.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
        channel,
        customerName,
        customerPhone,
        paymentMode,
        amountPaid: paymentMode === 'custom' ? Number(amountPaid) || 0 : undefined,
        addRemainingToUdhar,
      }, { requiresAuth: true })

      if (result.credit) {
        showSuccess('Bill saved. ' + formatPrice(result.bill.unpaidAmount) + " added to " + customerName + "'s Udhar.")
      } else if (result.bill.paymentStatus === 'paid') {
        showSuccess('Bill saved — fully paid.')
      } else {
        showSuccess('Bill saved — ' + formatPrice(result.bill.unpaidAmount) + ' left unpaid.')
      }
      resetForm()
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const groupedBills = []
  const billMap = new Map()
  for (const s of sales || []) {
    const key = s.billId || s._id
    if (!billMap.has(key)) {
      const bill = { key, createdAt: s.createdAt, channel: s.channel, customerName: s.customerName, items: [] }
      billMap.set(key, bill)
      groupedBills.push(bill)
    }
    billMap.get(key).items.push(s)
  }

  return (
    <div>
      <form className="sale-bill-form card" onSubmit={handleSubmit}>
        <h3 style={{ marginBottom: 14 }}>Record a bill</h3>

        <div className="lf-modal-field-row">
          <label>
            Customer Name <span className="field-optional">(optional)</span>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in customer" />
          </label>
          <label>
            Phone Number <span className="field-optional">(optional)</span>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="98765 43210" />
          </label>
        </div>

        <p className="sale-section-label">Products</p>
        {lines.map((line, idx) => {
          const product = productById.get(line.productId)
          const isEmptyTrailingRow = idx === lines.length - 1 && !line.productId
          return (
            <div className="sale-line-row" key={line.key}>
              <SearchableSelect
                options={productOptions}
                value={line.productId}
                onChange={(productId) => updateLine(line.key, { productId })}
                placeholder="Select product…"
              />
              <QuantityStepper value={line.quantity} onChange={(quantity) => updateLine(line.key, { quantity })} />
              <span className="sale-line-unit">{product?.priceUnit || ''}</span>
              {!isEmptyTrailingRow && (
                <button type="button" className="icon-btn" onClick={() => removeLine(line.key)} aria-label="Remove line">✕</button>
              )}
            </div>
          )
        })}
        <p className="sale-line-hint">A new row appears automatically once you pick a product.</p>

        <div className="lf-modal-field-row" style={{ marginTop: 4 }}>
          <label>
            Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
            </select>
          </label>
          <div className="sale-total-preview">
            <span>Bill Total</span>
            <strong>{formatPrice(totalAmount)}</strong>
          </div>
        </div>

        <p className="sale-section-label">Payment</p>
        <div className="payment-mode-toggle">
          <button
            type="button"
            className={'payment-mode-btn ' + (paymentMode === 'full' ? 'active' : '')}
            onClick={() => { setPaymentMode('full'); setAddRemainingToUdhar(false) }}
          >
            ✅ Mark as Paid
          </button>
          <button
            type="button"
            className={'payment-mode-btn ' + (paymentMode === 'custom' ? 'active' : '')}
            onClick={() => setPaymentMode('custom')}
          >
            ✍️ Enter Amount Paid
          </button>
        </div>

        {paymentMode === 'custom' && (
          <label>
            Amount Paid (₹)
            <input
              type="number"
              min="0"
              max={totalAmount}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0"
            />
          </label>
        )}

        {unpaidValue > 0 && (
          <div className="unpaid-callout">
            <p>Unpaid Amount = <strong>{formatPrice(unpaidValue)}</strong></p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={addRemainingToUdhar}
                onChange={(e) => setAddRemainingToUdhar(e.target.checked)}
              />
              Add remaining to Udhar?
            </label>
            {addRemainingToUdhar && !customerName.trim() && (
              <p className="lf-modal-error" style={{ marginTop: 8 }}>⚠️ Add a customer name above to send this to Udhar.</p>
            )}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting} style={{ marginTop: 16 }}>
          {submitting ? <Spinner size="sm" label="Saving bill…" /> : 'Save as Bill'}
        </button>
      </form>

      <FeedbackBanner feedback={feedback} />

      <h3 style={{ margin: '28px 0 14px' }}>Recent bills</h3>

      {loadingSales ? (
        <ShimmerList count={3} />
      ) : groupedBills.length === 0 ? (
        <p className="detail-empty">No sales logged yet.</p>
      ) : (
        <div className="bill-list">
          {groupedBills.map((bill) => {
            const total = bill.items.reduce((sum, s) => sum + s.priceAtSale * s.quantity, 0)
            const billInfo = billByBillId.get(bill.key)
            return (
              <div className="bill-card card" key={bill.key}>
                <div className="bill-card-top">
                  <div>
                    <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{bill.channel}</span>
                    {bill.customerName && <span className="bill-card-customer"> · {bill.customerName}</span>}
                    {billInfo && (
                      <span className={'badge ' + (billInfo.paymentStatus === 'paid' ? 'badge-success' : billInfo.paymentStatus === 'partial' ? 'badge-deal' : 'badge-warning')} style={{ marginLeft: 8, textTransform: 'capitalize' }}>
                        {billInfo.paymentStatus}
                      </span>
                    )}
                  </div>
                  <span className="bill-card-date">{new Date(bill.createdAt).toLocaleString()}</span>
                </div>
                <ul className="bill-card-items">
                  {bill.items.map((s) => (
                    <li key={s._id}>
                      <span>{s.productId?.icon} {s.productId?.name || 'Deleted product'} × {s.quantity} {s.unit}</span>
                      <span className="bill-card-item-actions">
                        {formatPrice(s.priceAtSale * s.quantity)}
                        <EditButton label="Edit line" onClick={() => setEditingSale(s)} />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="bill-card-total">
                  Total: {formatPrice(total)}
                  {billInfo && billInfo.unpaidAmount > 0 && (
                    <span className="bill-card-unpaid"> · Unpaid: {formatPrice(billInfo.unpaidAmount)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSaved={(msg) => { showSuccess(msg); setEditingSale(null); setRefreshKey((k) => k + 1) }}
          onError={showError}
        />
      )}
    </div>
  )
}

export default SalesPanel
