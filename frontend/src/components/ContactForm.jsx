import React, { useState } from 'react'

/**
 * Reusable Name / Email / Message contact form.
 * No backend endpoint exists for this yet, so it validates client-side
 * and shows a success state — swap handleSubmit for a real API call
 * (e.g. POST /api/contact) whenever that route is added on the backend.
 */
function ContactForm() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!formData.name.trim()) nextErrors.name = 'Please enter your name.'
    if (!formData.email.trim()) {
      nextErrors.email = 'Please enter your email.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = 'Please enter a valid email address.'
    }
    if (!formData.message.trim()) nextErrors.message = 'Please enter a message.'
    else if (formData.message.trim().length < 10) nextErrors.message = 'Message should be at least 10 characters.'
    return nextErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    // Simulated send — replace with a real API call once /api/contact exists.
    await new Promise((resolve) => setTimeout(resolve, 700))
    setSubmitting(false)
    setSubmitted(true)
    setFormData({ name: '', email: '', message: '' })
  }

  if (submitted) {
    return (
      <div className="contact-form">
        <h3>Send us a message</h3>
        <p className="form-success">
          ✅ Thanks for reaching out! We&apos;ve received your message and will get back to you within 24–48 hours.
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setSubmitted(false)}>
          Send another message
        </button>
      </div>
    )
  }

  return (
    <div className="contact-form">
      <h3>Send us a message</h3>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="name">Full Name</label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="Your name"
          value={formData.name}
          onChange={handleChange}
        />
        {errors.name && <p className="form-error">{errors.name}</p>}

        <label htmlFor="email">Email Address</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={handleChange}
        />
        {errors.email && <p className="form-error">{errors.email}</p>}

        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          rows="5"
          placeholder="How can we help?"
          value={formData.message}
          onChange={handleChange}
        />
        {errors.message && <p className="form-error">{errors.message}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send Message'}
        </button>
      </form>
    </div>
  )
}

export default ContactForm
