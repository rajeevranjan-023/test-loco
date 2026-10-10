import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PostRequirementModal from '../features/requirement/PostRequirementModal.jsx'
import "../css/body.css"

function CallToAction() {
  const navigate = useNavigate()
  const [showRequirementModal, setShowRequirementModal] = useState(false)

  return (
    <section className="cta">
      <div className="container cta-inner">
        <h2>Post Your Requirement, We'll Find the Best Price</h2>
        <p className="cta-subtext">
          Tell us what you need and we'll match you with nearby shops and professionals.
        </p>
        <div className="cta-buttons">
          <button
            className="btn btn-accent"
            onClick={() => setShowRequirementModal(true)}
          >
            Post Your Requirement
          </button>
          <button
            className="btn btn-outline cta-outline"
            onClick={() => document.getElementById('trending-products')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Find Best Price
          </button>
        </div>
      </div>

      <PostRequirementModal
        open={showRequirementModal}
        onClose={() => setShowRequirementModal(false)}
        onPosted={() => { /* stays open showing the success state until closed */ }}
      />
    </section>
  )
}

export default CallToAction
