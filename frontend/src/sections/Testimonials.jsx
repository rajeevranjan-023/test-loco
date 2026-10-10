import React from 'react'
import { testimonials } from '../data/data.js'
import StarRating from '../components/StarRating.jsx'

function Testimonials() {
  return (
    <section className="section testimonials">
      <div className="container">
        <div className="section-heading">
          <h2>What Our Customers Say</h2>
          <p>Real experiences from people who found what they needed.</p>
        </div>

        <div className="grid grid-3 testimonial-grid">
          {testimonials.map((t) => (
            <div className="testimonial-card card" key={t.id}>
              <StarRating rating={t.stars} size="sm" showValue={false} />
              <p className="testimonial-review">"{t.review}"</p>
              <div className="testimonial-user">
                <span className="testimonial-avatar">{t.avatar}</span>
                <span className="testimonial-name">{t.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Testimonials
