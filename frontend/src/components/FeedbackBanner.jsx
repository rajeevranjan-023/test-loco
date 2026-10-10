import React from 'react'

function FeedbackBanner({ feedback }) {
  if (!feedback) return null
  return (
    <p
      style={{
        color: feedback.type === 'success' ? '#15803d' : '#e0455f',
        fontSize: '0.88rem',
        fontWeight: 600,
        marginBottom: 16,
      }}
    >
      {feedback.type === 'success' ? '✅ ' : '⚠️ '}
      {feedback.message}
    </p>
  )
}

export default FeedbackBanner
