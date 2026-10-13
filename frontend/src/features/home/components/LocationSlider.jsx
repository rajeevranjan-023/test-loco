import React from 'react'
import Section from './Section.jsx'
import SectionHeader from './SectionHeader.jsx'
import Img from '../../../components/Img.jsx'

export default function LocationSlider({ cities = [], active, onSelect }) {
  if (!cities.length) return null
  return (
    <Section>
      <div className="mb-3"><SectionHeader icon="📍" title="Explore by Location" subtitle="Find businesses in your area" action="More Cities" /></div>
      <div className="flex w-full snap-x gap-3 overflow-x-auto pb-2">
        {cities.map((c) => (
          <button key={c.id} type="button" aria-pressed={active === c.name} onClick={() => onSelect(c.name)} className={`w-[120px] shrink-0 snap-start rounded-2xl bg-white p-1.5 text-center shadow-sm ring-2 transition hover:shadow-md ${active === c.name ? 'ring-orange-500' : 'ring-transparent'}`}>
            <Img src={c.image} alt={c.name} placeholder="initial" className="h-20 w-full rounded-xl" />
            <div className="truncate py-1.5 text-xs font-semibold text-gray-800">{c.name}</div>
          </button>
        ))}
      </div>
    </Section>
  )
}
