import React from 'react'
import { useRequireAuth } from '../hooks/useRequireAuth.js'

function ContactButton({ phone, className = 'btn btn-primary btn-sm' }) {
  const requireAuth = useRequireAuth()

  const handleClick = () => {
    // Logged out → login/signup, then straight back to this page (the visitor taps Contact again; a phone call is never auto-dialled).
    if (!requireAuth()) return
    window.location.href = `tel:${phone.replace(/\s/g, '')}`
  }

  if (!phone) return null

  return (
    <button type="button" className={className} onClick={handleClick}>
      📞 Contact
    </button>
  )
}

export default ContactButton
