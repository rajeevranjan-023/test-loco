import React from 'react'

function QuantityStepper({ value, onChange, min = 1 }) {
  const dec = () => onChange(Math.max(min, Number(value || min) - 1))
  const inc = () => onChange(Number(value || 0) + 1)

  return (
    <div className="qty-stepper">
      <button type="button" className="qty-stepper-btn" onClick={dec} aria-label="Decrease quantity">−</button>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="qty-stepper-input"
      />
      <button type="button" className="qty-stepper-btn" onClick={inc} aria-label="Increase quantity">+</button>
    </div>
  )
}

export default QuantityStepper
