import React from 'react'
import '../css/StaticPages.css'

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
