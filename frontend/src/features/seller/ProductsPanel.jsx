import React, { useState } from 'react'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import { useFeedback } from '../../hooks/useFeedback.js'
import { formatPrice } from '../../utils/format.js'
import { ShimmerTable } from '../../components/loading/ShimmerLayouts.jsx'
import FeedbackBanner from '../../components/FeedbackBanner.jsx'
import EditButton from '../../components/common/EditButton.jsx'
import DeleteButton from '../../components/common/DeleteButton.jsx'
import { EditProductModal, AddProductModal } from './EditProductModal.jsx'
import Spinner from '../../components/loading/Spinner.jsx'
import '../../css/Dashboard.css'

function ProductsPanel() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const { feedback, showSuccess, showError } = useFeedback()

  const { data: products, loading } = useApiData(
    () => api.get('/api/seller/products', { requiresAuth: true }),
    [refreshKey]
  )

  const handleDelete = async (id, name) => {
    setDeletingId(id)
    try {
      await api.delete(`/api/seller/products/${id}`, { requiresAuth: true })
      showSuccess(`"${name}" deleted.`)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="panel-toolbar">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          + Add Product
        </button>
      </div>

      <FeedbackBanner feedback={feedback} />

      {loading ? (
        <ShimmerTable rows={4} columns={7} />
      ) : products.length === 0 ? (
        <p className="detail-empty">No products yet — add your first one above.</p>
      ) : (
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Cost Price</th>
              <th>Stock</th>
              <th>Sold</th>
              <th>Profit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p._id}>
                <td className="dashboard-table-product-cell">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="dashboard-table-thumb" /> : <span>{p.icon}</span>}
                  {p.name}
                </td>
                <td>{formatPrice(p.price)} /{p.priceUnit}</td>
                <td>{formatPrice(p.costPrice)} /{p.costPriceUnit}</td>
                <td>
                  {p.stock === 0
                    ? <span className="badge badge-warning">Out of stock</span>
                    : p.stock}
                </td>
                <td>{p.sold}</td>
                <td>{formatPrice(p.realizedProfit ?? 0)}</td> {/* real, batch-wise profit from actual sales (not latest cost × sold) */}
                <td style={{ display: 'flex', gap: 6 }}>
                  <EditButton label={`Edit ${p.name}`} onClick={() => setEditingProduct(p)} />
                  {deletingId === p._id ? (
                    <Spinner size="sm" />
                  ) : (
                    <DeleteButton label={`Delete ${p.name}`} onClick={() => handleDelete(p._id, p.name)} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddProductModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={(msg) => { showSuccess(msg); setShowAdd(false); setRefreshKey((k) => k + 1) }}
        onError={showError}
      />

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={(msg) => { showSuccess(msg); setEditingProduct(null); setRefreshKey((k) => k + 1) }}
          onError={showError}
        />
      )}
    </div>
  )
}

export default ProductsPanel
