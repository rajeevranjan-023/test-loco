import React, { useState } from 'react'
import FAQItem from './FAQItem.jsx'
import faqData from '../../data/faq.json'
import '../../css/FAQ.css'

function FAQAccordion() {
  const [activeCategory, setActiveCategory] = useState(faqData[0].category)
  const [openQuestion, setOpenQuestion] = useState(null)

  const currentCategory = faqData.find((cat) => cat.category === activeCategory)

  const handleCategoryChange = (category) => {
    setActiveCategory(category)
    setOpenQuestion(null)
  }

  const toggleQuestion = (question) => {
    setOpenQuestion((prev) => (prev === question ? null : question))
  }

  return (
    <div className="faq-wrapper">
      <div className="faq-categories" role="tablist" aria-label="FAQ categories">
        {faqData.map((cat) => (
          <button
            key={cat.category}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat.category}
            className={`faq-category-tab ${activeCategory === cat.category ? 'active' : ''}`}
            onClick={() => handleCategoryChange(cat.category)}
          >
            <span className="faq-category-icon" aria-hidden="true">{cat.icon}</span>
            {cat.category}
          </button>
        ))}
      </div>

      <div className="faq-list">
        {currentCategory.questions.map((item) => (
          <FAQItem
            key={item.q}
            question={item.q}
            answer={item.a}
            isOpen={openQuestion === item.q}
            onToggle={() => toggleQuestion(item.q)}
          />
        ))}
      </div>
    </div>
  )
}

export default FAQAccordion
