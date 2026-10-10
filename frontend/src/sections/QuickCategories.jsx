import React from 'react'
import CategoryCard from '../features/home/CategoryCard.jsx'
import HorizontalScroller from '../components/HorizontalScroller.jsx'

const CATEGORIES = [
  { id: 'products', title: 'Products', icon: '🛍️', desc: 'Shop everyday items', path: '/search?type=product' },
  { id: 'services', title: 'Services', icon: '🛠️', desc: 'Book trusted pros', path: '/search?type=service' },
  { id: 'jobs', title: 'Jobs', icon: '💼', desc: 'Local work near you', path: '/search?type=job' },
  { id: 'shops', title: 'Shops', icon: '🏬', desc: 'Explore nearby stores', path: '/search?type=shop' },
]

function QuickCategories() {
  return (
    <section className="section quick-categories">
      <div className="container">
        <div className="section-heading">
          <h2>Browse by Category</h2>
          <p>Everything you need, organized in one place.</p>
        </div>

        <HorizontalScroller className="quick-categories-row">
          {CATEGORIES.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </HorizontalScroller>
      </div>
    </section>
  )
}

export default QuickCategories
