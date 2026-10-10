import React from 'react'
import Section from './Section.jsx'
import Grid from './Grid.jsx'
import Img from '../../../components/Img.jsx'
import { TILE_TONES } from '../config.js'

export default function CategoryGrid({ items = [], onSelect }) {
  if (!items.length) return null
  return (
    <Section>
      <Grid preset="categories">
        {items.map((c) => (
          <button key={c.id} type="button" onClick={() => onSelect(c.query || c.name)} className={`flex h-full w-full min-w-0 items-center gap-3 rounded-2xl p-3 text-left shadow-sm ring-1 ring-gray-100 transition duration-200 hover:-translate-y-1 hover:shadow-md ${TILE_TONES[c.tone] || TILE_TONES.gray}`}>
            <Img src={c.image} alt={c.name} placeholder="initial" className="h-14 w-14 shrink-0 rounded-xl" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-gray-900">{c.name}</span>
              <span className="line-clamp-2 text-xs leading-snug text-gray-500">{c.description}</span>
            </span>
          </button>
        ))}
      </Grid>
    </Section>
  )
}
