import React from 'react'

function PriceInput({ label, amount, unit, onAmountChange, onUnitChange }) {
  return (
    <label className="price-input-field">
      {label}
      <div className="price-input-combo">
        <span className="price-input-symbol">₹</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0"
        />
        <span className="price-input-divider">/</span>
        <select value={unit} onChange={(e) => onUnitChange(e.target.value)}>
          <option value="unit">unit</option>
          <option value="kg">kg</option>
        </select>
      </div>
    </label>
  )
}

export default PriceInput
