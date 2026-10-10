import React from 'react'
import '../css/StaticPages.css'

/**
 * Reusable header banner for static/info pages (About, Contact, FAQ, Privacy, Terms).
 * Keeps every one of those pages visually consistent.
 */
function PageHero({ eyebrow, title, subtitle }) {
  return (
    <section className="static-hero">
      <div className="container static-hero-inner">
        {eyebrow && <span className="static-hero-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </section>
  )
}

export default PageHero
