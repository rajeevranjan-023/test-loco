import React, { useState } from 'react'
import Modal from '../../components/common/Modal.jsx'
import Spinner from '../../components/loading/Spinner.jsx'
import { api } from '../../services/api.js'

function EditCreditModal({ credit, onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    customerName: credit.customerName,
    phone: credit.phone || '',
    amount: credit.amount,
    notes: credit.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch(`/api/seller/credits/${credit._id}`, {
        customerName: form.customerName,
        phone: form.phone,
        amount: Number(form.amount),
        notes: form.notes,
      }, { requiresAuth: true })
      onSaved(`${form.customerName}'s credit entry updated.`)
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
      title={`Edit credit — ${credit.customerName}`}
      footer={
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" label="Saving…" /> : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="lf-modal-field-row">
        <label>
          Customer name
          <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
      </div>
      <label>
        Amount (₹)
        <input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </label>
      <label>
        Notes
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What was it for?" />
      </label>
    </Modal>
  )
}

export default EditCreditModal
