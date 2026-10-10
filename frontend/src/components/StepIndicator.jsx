import React from 'react'

function StepIndicator({ steps, currentIndex }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
      {steps.map((label, i) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.82rem',
            fontWeight: 600,
            color: i === currentIndex ? 'var(--color-primary)' : i < currentIndex ? '#15803d' : 'var(--color-text-light)',
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.72rem',
              background: i === currentIndex ? 'var(--color-primary)' : i < currentIndex ? '#dcfce7' : '#e2e8f0',
              color: i === currentIndex ? '#fff' : i < currentIndex ? '#15803d' : 'var(--color-text-light)',
            }}
          >
            {i < currentIndex ? '✓' : i + 1}
          </span>
          {label}
          {i < steps.length - 1 && <span style={{ color: 'var(--color-border)' }}>—</span>}
        </div>
      ))}
    </div>
  )
}

export default StepIndicator
