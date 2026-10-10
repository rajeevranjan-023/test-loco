import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Container from './Container.jsx'
import Img from '../../../components/Img.jsx'
import SearchSuggest from './SearchSuggest.jsx'
import { profilePath } from '../../../utils/username.js'

// Full-width banner; text left, image right, both inside the centered container.
// The right-hand image is a rotating set of REAL seller banners (featured shops first, then newest) — see GET /api/home.
export default function HeroSection({ chips = [], slides = [], onSearch, city = '' }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)

  useEffect(() => setI(0), [slides])
  useEffect(() => {
    if (slides.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 5000)
    return () => clearInterval(t)
  }, [slides])
  const slide = slides[i]

  return (
    <section className="mb-8 w-full overflow-hidden bg-gradient-to-r from-orange-50 via-white to-sky-50">
      <Container className="grid items-center gap-8 py-10 md:grid-cols-2 lg:py-14">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold leading-tight text-gray-900 sm:text-4xl lg:text-5xl">
            Find Nearby <br /><span className="text-orange-500">Shops &amp; Services</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-gray-600">Groceries, Electronics, Home Needs, Local Services and more — all from verified local businesses in your city.</p>
          <div className="relative mt-6">
            <form onSubmit={(e) => { e.preventDefault(); onSearch(q) }} className="flex w-full items-center rounded-full bg-white p-1.5 shadow-md ring-1 ring-gray-100">
              <span className="pl-3 text-gray-400" aria-hidden>🔍</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" autoComplete="off" placeholder="Search shops, services, libraries..." className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none" />
              <button type="submit" className="shrink-0 rounded-full bg-orange-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-orange-600">Search</button>
            </form>
            <SearchSuggest query={q} city={city} onSearch={onSearch} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((c) => <button key={c} type="button" onClick={() => onSearch(c)} className="rounded-full bg-white px-3 py-1 text-xs text-gray-700 ring-1 ring-gray-200 transition hover:bg-orange-50 hover:text-orange-600">{c}</button>)}
          </div>
        </div>
        <div className="relative min-w-0">
          {slide ? (
            <Link to={profilePath(slide.username)} aria-label={`Visit ${slide.name}`} className="block">
              <Img key={slide.id} src={slide.image} alt={slide.name} eager placeholder="initial" className="h-52 w-full rounded-2xl shadow-md sm:h-64 md:h-72" />
              <span className="absolute bottom-3 left-3 max-w-[60%] truncate rounded-lg bg-black/55 px-3 py-1.5 text-xs font-semibold text-white">{slide.name}</span>
            </Link>
          ) : (
            <div className="h-52 w-full rounded-2xl bg-gray-100 shadow-md sm:h-64 md:h-72" aria-hidden />
          )}
          {city && <span className="absolute bottom-3 right-3 rounded-lg bg-white px-3 py-1.5 text-xs font-bold shadow">📍 {city}</span>}
          {slides.length > 1 && (
            <div className="absolute right-3 top-3 flex gap-1.5">
              {slides.map((s, n) => <button key={s.id} type="button" aria-label={`Show ${s.name}`} onClick={() => setI(n)} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />)}
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}
