import React from 'react'
import { useNavigate } from 'react-router-dom'

function RecommendationCard({ recommendation }) {
  const navigate = useNavigate()
  const { icon, title, subtitle, cta, query } = recommendation

  return (
    <div className="recommendation-card card">
      <span className="recommendation-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{subtitle}</p>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => navigate(`/search?q=${encodeURIComponent(query || title)}`)}
      >
        {cta}
      </button>
    </div>
  )
}

export default RecommendationCard
