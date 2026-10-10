import React, { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Container from '../features/home/components/Container.jsx'
import HeroSection from '../features/home/components/HeroSection.jsx'
import CategoryGrid from '../features/home/components/CategoryGrid.jsx'
import ContentRow from '../features/home/components/ContentRow.jsx'
import LocationSlider from '../features/home/components/LocationSlider.jsx'
import WhyChoose from '../features/home/components/WhyChoose.jsx'
import AppDownload from '../features/home/components/AppDownload.jsx'
import { whyLoco } from '../features/home/config.js'
import { useHome } from '../hooks/useHome.js'
import { profilePath } from '../utils/username.js'

// Section layout only (titles / which side the promo sits on). All listings, promos, categories and cities
// come from the database via GET /api/home. Promo side alternates right → left → right.
const ROWS = [
  { key: 'shops', icon: '🏪', title: 'Popular Shops Near You', subtitle: 'Verified local shops in your area', emptyLabel: 'shops', searchQuery: 'Shop', promoSide: 'right' },
  { key: 'services', icon: '🔧', title: 'Popular Services Near You', subtitle: 'Find trusted service providers', emptyLabel: 'services', searchQuery: 'Services', promoSide: 'left' },
  { key: 'libraries', icon: '📖', title: 'Libraries Near You', subtitle: 'Study spaces, book rentals and more', emptyLabel: 'libraries', searchQuery: 'Library', promoSide: 'right' },
]

const digits = (p) => String(p || '').replace(/\D/g, '')

export default function Home() {
  const navigate = useNavigate()
  const { data, error, loading, refreshing, city, setCity, retry } = useHome()
  const search = useCallback((t) => navigate(`/search?q=${encodeURIComponent(t || '')}`), [navigate])
  const view = useCallback((it) => navigate(profilePath(it.username)), [navigate])
  const call = useCallback((it) => { if (digits(it.phone)) window.location.href = `tel:${digits(it.phone)}` }, [])
  const whatsapp = useCallback((it) => {
    const n = digits(it.whatsapp || it.phone)
    if (n) window.open(`https://wa.me/${n.length === 10 ? `91${n}` : n}`, '_blank', 'noopener')
  }, [])

  return (
    <div className="w-full overflow-x-hidden pb-4">
      <HeroSection chips={data?.chips} slides={data?.hero} city={city} onSearch={search} />
      <Container>
        {error && !data && (
          <div role="alert" className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
            {error.message} <button type="button" onClick={retry} className="ml-2 font-semibold underline">Try again</button>
          </div>
        )}
        <CategoryGrid items={data?.categories} onSelect={search} />
        {ROWS.map(({ key, ...r }) => (
          <ContentRow key={key} {...r} items={data?.sections?.[key]} promo={data?.promos?.[key]} city={city}
            loading={loading} onSearch={search} onView={view} onCall={call} onWhatsApp={whatsapp} />
        ))}
        <LocationSlider cities={data?.cities} active={city} onSelect={setCity} />
        <WhyChoose items={whyLoco} />
        <AppDownload />
      </Container>
      <span className="sr-only" aria-live="polite">{refreshing ? `Loading ${city}` : ''}</span>
    </div>
  )
}
