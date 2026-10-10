import React, { useState } from 'react'
import Modal from '../../components/common/Modal.jsx'
import Spinner from '../../components/loading/Spinner.jsx'
import { api } from '../../services/api.js'

function EditSaleModal({ sale, onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    quantity: sale.quantity,
    channel: sale.channel,
    customerName: sale.customerName || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/api/seller/sales/${sale._id}`, {
        quantity: Number(form.quantity),
        channel: form.channel,
        customerName: form.customerName,
      }, { requiresAuth: true })
      onSaved('Bill updated.')
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit bill — ${sale.productId?.name || 'Sale'}`}
      footer={
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" label="Saving…" /> : 'Save changes'}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: 16 }}>
        Changing quantity automatically adjusts this product's stock to match.
      </p>
      <div className="lf-modal-field-row">
        <label>
          Quantity
          <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </label>
        <label>
          Channel
          <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
            <option value="offline">Offline</option>
            <option value="online">Online</option>
          </select>
        </label>
      </div>
      <label>
        Customer (optional)
        <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Walk-in customer" />
      </label>
    </Modal>
  )
}

export default EditSaleModal
