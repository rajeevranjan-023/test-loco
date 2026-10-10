import React from 'react'
import { useNavigate } from 'react-router-dom'

function CategoryCard({ category }) {
  const navigate = useNavigate()
  const { icon, title, desc, path } = category

  return (
    <button type="button" className="quick-category-card" onClick={() => navigate(path)}>
      <span className="quick-category-icon">{icon}</span>
      <span className="quick-category-title">{title}</span>
      {desc && <span className="quick-category-desc">{desc}</span>}
    </button>
  )
}

export default CategoryCard
