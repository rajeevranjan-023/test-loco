import React, { useState } from 'react'
import Modal from '../../components/common/Modal.jsx'
import MediaUploadField from '../../components/common/MediaUploadField.jsx'
import PriceInput from '../../components/common/PriceInput.jsx'
import Spinner from '../../components/loading/Spinner.jsx'
import { api } from '../../services/api.js'

function ProductForm({ initial, onSubmit, submitting, submitLabel }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    price: initial?.price ?? '',
    priceUnit: initial?.priceUnit || 'unit',
    costPrice: initial?.costPrice ?? '',
    costPriceUnit: initial?.costPriceUnit || 'unit',
    stock: initial?.stock ?? '',
    icon: initial?.icon || '📦',
    imageUrl: initial?.imageUrl || '',
    videoUrl: initial?.videoUrl || '',
    description: initial?.description || '',
  })

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  return (
    <form
      id="product-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
    >
      <MediaUploadField label="Product photo" value={form.imageUrl} onChange={(imageUrl) => set({ imageUrl })} folder="products" kind="image" />
      <MediaUploadField label="Showcase video" value={form.videoUrl} onChange={(videoUrl) => set({ videoUrl })} folder="products" kind="video" />

      {!form.imageUrl && (
        <label>
          Fallback icon (emoji)
          <input value={form.icon} onChange={(e) => set({ icon: e.target.value })} style={{ width: 70 }} />
        </label>
      )}

      <label>
        Product name
        <input required value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </label>

      <div className="lf-modal-field-row">
        <PriceInput
          label="Price"
          amount={form.price}
          unit={form.priceUnit}
          onAmountChange={(price) => set({ price })}
          onUnitChange={(priceUnit) => set({ priceUnit })}
        />
        <PriceInput
          label="Cost Price"
          amount={form.costPrice}
          unit={form.costPriceUnit}
          onAmountChange={(costPrice) => set({ costPrice })}
          onUnitChange={(costPriceUnit) => set({ costPriceUnit })}
        />
      </div>

      <label>
        Stock
        <input type="number" min="0" value={form.stock} onChange={(e) => set({ stock: e.target.value })} />
      </label>

      <label>
        Description (optional)
        <textarea rows="3" value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </label>

      {submitting !== undefined && (
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting} style={{ display: 'none' }}>
          {submitLabel}
        </button>
      )}
    </form>
  )
}

export function EditProductModal({ product, onClose, onSaved, onError }) {
  const [saving, setSaving] = useState(false)
  const [pendingForm, setPendingForm] = useState(null)

  const handleSubmit = async (form) => {
    setPendingForm(form)
    setSaving(true)
    try {
      await api.put(`/api/seller/products/${product._id}`, {
        name: form.name,
        price: Number(form.price),
        priceUnit: form.priceUnit,
        costPrice: Number(form.costPrice),
        costPriceUnit: form.costPriceUnit,
        stock: Number(form.stock),
        icon: form.icon || '📦',
        imageUrl: form.imageUrl,
        videoUrl: form.videoUrl,
        description: form.description,
      }, { requiresAuth: true })
      onSaved(`"${form.name}" updated.`)
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
      title={`Edit ${product.name}`}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="product-form" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? <Spinner size="sm" label="Saving…" /> : 'Save changes'}
          </button>
        </>
      }
    >
      <ProductForm initial={product} onSubmit={handleSubmit} submitting={saving} />
    </Modal>
  )
}

export function AddProductModal({ open, onClose, onAdded, onError }) {
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (form) => {
    setSaving(true)
    try {
      await api.post('/api/seller/products', {
        name: form.name,
        price: Number(form.price),
        priceUnit: form.priceUnit,
        costPrice: Number(form.costPrice),
        costPriceUnit: form.costPriceUnit,
        stock: Number(form.stock) || 0,
        icon: form.icon || '📦',
        imageUrl: form.imageUrl,
        videoUrl: form.videoUrl,
        description: form.description,
      }, { requiresAuth: true })
      onAdded(`"${form.name}" added to your shop.`)
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Product"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="product-form" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? <Spinner size="sm" label="Adding…" /> : 'Add Product'}
          </button>
        </>
      }
    >
      <ProductForm onSubmit={handleSubmit} submitting={saving} />
    </Modal>
  )
}

export default EditProductModal
