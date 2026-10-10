import React from 'react'
import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero.jsx'
import FAQAccordion from '../features/faq/FAQAccordion.jsx'
import { useTitle } from '../hooks/title.js'
import '../css/StaticPages.css'

function FAQ() {
  useTitle('FAQ')

  return (
    <div className="static-page faq-page">
      <PageHero
        eyebrow="Frequently Asked Questions"
        title="Got questions? We've got answers."
        subtitle="Browse by category, or search the topic you need. Can't find what you're looking for?"
      />

      <section className="section">
        <div className="container">
          <FAQAccordion />

          <div className="contact-faq-cta">
            <p>Still need help?</p>
            <Link to="/contact" className="btn btn-primary">Contact Support →</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default FAQ
