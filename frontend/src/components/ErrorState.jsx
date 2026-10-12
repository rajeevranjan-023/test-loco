import React from 'react'

// Inline "this section failed to load" state (the failure counterpart of the existing loading / empty states).
// `error` is an ApiError: its message is already safe. "Try again" is offered ONLY when repeating is safe (error.retryable — GET
// requests failing for transient reasons), never to blindly replay a write.
export default function ErrorState({ error, onRetry, title = '', className = 'detail-empty' }) {
  const canRetry = !!onRetry && (error?.retryable ?? true)
  return (
    <div role="alert" className={className}>
      <p>{title}{error?.message || 'Something went wrong. Please try again.'}</p>
      {canRetry && <button type="button" className="btn btn-outline" style={{ marginTop: 12 }} onClick={onRetry}>Try again</button>}
    </div>
  )
}
