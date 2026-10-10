import React from 'react'
import { useSearchParams } from 'react-router-dom'
import SearchResults from '../features/search/SearchResults.jsx'
import SearchBar from '../components/SearchBar.jsx'
import '../css/ShopService.css'

function SearchResultsPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''

  return (
    <section className="section">
      <div className="container">
        <div className="search-results-header">
          <SearchBar placeholder="Search Product or Service..." showLocation={false} />
          {query && (
            <>
              <h1 style={{ marginTop: '32px' }}>Results for "{query}"</h1>
              <p>Comparing prices and providers across Local Finder.</p>
            </>
          )}
        </div>

        <div style={{ marginTop: '32px' }}>
          {query ? (
            <SearchResults query={query} />
          ) : (
            <p className="detail-empty">Start typing above to search products, services and shops.</p>
          )}
        </div>
      </div>
    </section>
  )
}

export default SearchResultsPage
