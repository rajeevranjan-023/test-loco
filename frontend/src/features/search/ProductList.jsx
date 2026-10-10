import React from 'react'
import ProductCard from '../shops/ProductCard.jsx'

function ProductList({ products }) {
  if (!products || products.length === 0) {
    return <p className="detail-empty">No matching products.</p>
  }

  return (
    <div className="grid grid-4 product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} highlight={product.cheapest} />
      ))}
    </div>
  )
}

export default ProductList
