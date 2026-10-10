import React from 'react'

function FAQItem({ question, answer, isOpen, onToggle }) {
  return (
    <div className={`faq-item ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="faq-question"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        <span className="faq-toggle-icon" aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>
      <div className="faq-answer" role="region">
        <p>{answer}</p>
      </div>
    </div>
  )
}

export default FAQItem
