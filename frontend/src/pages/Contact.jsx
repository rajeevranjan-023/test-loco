import React from 'react'
import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero.jsx'
import ContactForm from '../components/ContactForm.jsx'
import { useTitle } from '../hooks/title.js'
import '../css/StaticPages.css'

const helpTopics = [
  {
    icon: '🧾',
    title: 'Orders & Bookings',
    desc: 'Questions about a product order or a service booking you made through SERVOP.',
  },
  {
    icon: '🏪',
    title: 'Seller Support',
    desc: 'Help setting up your shop or service listing, or managing your dashboard.',
  },
  {
    icon: '🔐',
    title: 'Account & Security',
    desc: 'Login issues, password resets, or anything related to keeping your account safe.',
  },
  {
    icon: '🐞',
    title: 'Report a Bug',
    desc: 'Something not working right? Let us know exactly what happened so we can fix it.',
  },
]

const socialLinks = [
  { label: 'Twitter / X', href: 'https://twitter.com', icon: '🐦' },
  { label: 'Instagram', href: 'https://instagram.com', icon: '📷' },
  { label: 'LinkedIn', href: 'https://linkedin.com', icon: '💼' },
  { label: 'Facebook', href: 'https://facebook.com', icon: '📘' },
]

function Contact() {
  useTitle('Contact & Support')

  return (
    <div className="static-page contact-page">
      <PageHero
        eyebrow="We're here to help"
        title="Contact & Support"
        subtitle="Have a question, ran into an issue, or want to partner with us? Reach out — we typically respond within 24–48 hours."
      />

      <section className="section">
        <div className="container">
          <div className="grid grid-2 contact-grid">
            <div className="contact-info card">
              <h3>Get in touch</h3>
              <p>📧 Support email: <a href="mailto:support@servop.com">support@servop.com</a></p>
              <p>📞 Phone: <a href="tel:+919876543210">+91 98765 43210</a></p>
              <p>📍 Location: Sector 12, New Delhi, India</p>

              <div className="contact-hours">
                <h4>⏱️ Response time</h4>
                <p>
                  Our support team replies within <strong>24–48 hours</strong> on business days.
                  Urgent account or payment issues are prioritized.
                </p>
              </div>

              <div className="contact-hours">
                <h4>🕘 Support hours</h4>
                <p>Monday – Saturday, 9:00 AM – 7:00 PM IST</p>
              </div>

              <div className="contact-social">
                <h4>Follow us</h4>
                <div className="social-links">
                  {socialLinks.map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                      <span aria-hidden="true">{s.icon}</span> {s.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <ContactForm />
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-heading">
            <h2>What can we help with?</h2>
            <p>Browse common support topics, or check our FAQ for instant answers.</p>
          </div>
          <div className="grid grid-4">
            {helpTopics.map((t) => (
              <div className="about-card card" key={t.title}>
                <div className="feature-icon">{t.icon}</div>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
              </div>
            ))}
          </div>
          <div className="contact-faq-cta">
            <p>Looking for a quick answer instead?</p>
            <Link to="/faq" className="btn btn-outline">Visit our FAQ page →</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Contact
