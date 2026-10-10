import React, { useState } from 'react'
import Badge from '../Badge.jsx'
import Modal from '../common/Modal.jsx'
import { formatPrice } from '../../utils/format.js'
import { EditProductModal, AddProductModal } from '../../features/seller/EditProductModal.jsx'
import { useFeedback } from '../../hooks/useFeedback.js'
import FeedbackBanner from '../FeedbackBanner.jsx'

function ProductsSection({ profile, isOwner, onChanged }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const { feedback, showSuccess, showError } = useFeedback()

  const products = profile.products || []

  const handleSaved = (msg) => {
    showSuccess(msg)
    setEditingProduct(null)
    setShowAdd(false)
    onChanged?.()
  }

  return (
    <div className="ig-products-section">
      <FeedbackBanner feedback={feedback} />

      <div className="ig-products-toolbar">
        <p className="ig-products-count">{products.length} item{products.length === 1 ? '' : 's'}</p>
        {isOwner && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + Add Product
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <p className="detail-empty">No products listed yet.</p>
      ) : (
        <div className="ig-product-grid">
          {products.map((p) => (
            <div key={p.id} className={'ig-product-tile ' + (p.mostSelling ? 'ig-product-tile-highlight' : '')}>
              <div className="ig-product-tile-media">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <span className="ig-product-tile-icon">{p.icon}</span>}
                {p.mostSelling && <span className="ig-product-tile-badge">🔥 Best seller</span>}
                {p.videoUrl && (
                  <button
                    type="button"
                    className="ig-product-tile-video-badge"
                    aria-label={`Play ${p.name} video`}
                    onClick={() => setVideoPreview(p)}
                  >
                    ▶ Video
                  </button>
                )}
                {isOwner && (
                  <button
                    type="button"
                    className="ig-product-tile-edit"
                    aria-label={`Edit ${p.name}`}
                    onClick={() => setEditingProduct(p)}
                  >
                    ✏️
                  </button>
                )}
              </div>
              <div className="ig-product-tile-body">
                <h3>{p.name}</h3>
                <p className="ig-product-tile-price">{formatPrice(p.price)} <span>/{p.priceUnit}</span></p>
                <Badge tone={p.available ? 'success' : 'warning'}>
                  {p.available ? 'In Stock' : 'Out of Stock'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOwner && (
        <>
          <AddProductModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={handleSaved} onError={showError} />
          {editingProduct && (
            <EditProductModal
              product={editingProduct}
              onClose={() => setEditingProduct(null)}
              onSaved={handleSaved}
              onError={showError}
            />
          )}
        </>
      )}

      <Modal open={!!videoPreview} onClose={() => setVideoPreview(null)} title={videoPreview?.name || 'Product video'} size="lg">
        {videoPreview && <video src={videoPreview.videoUrl} controls autoPlay style={{ width: '100%', borderRadius: 8 }} />}
      </Modal>
    </div>
  )
}

export default ProductsSection
