import React from 'react'
import { useRequireAuth } from '../hooks/useRequireAuth.js'

function ContactButton({ phone, className = 'btn btn-primary btn-sm' }) {
  const requireAuth = useRequireAuth()

  const handleClick = () => {
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
