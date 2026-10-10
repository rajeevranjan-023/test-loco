import React from 'react'
import Section from './Section.jsx'
import SectionHeader from './SectionHeader.jsx'
import Grid from './Grid.jsx'
import Card from './Card.jsx'
import PromoCard from './PromoCard.jsx'

// Header on top, then cards + promo on the SAME row (xl+), so the promo is exactly as tall as the cards.
// Below xl the promo stacks under the cards. `promoSide` alternates left/right.
// No promo configured → the cards simply take the full width.
export default function ContentRow({ icon, title, subtitle, items = [], promo, promoSide = 'right', searchQuery, city, emptyLabel, loading, onSearch, onView, onCall, onWhatsApp }) {
  const left = promoSide === 'left'
  const cols = promo ? (left ? 'xl:grid-cols-[260px_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(0,1fr)_260px]') : ''
  const main = promo ? (left ? 'xl:col-start-2' : 'xl:col-start-1') : ''
  const side = left ? 'xl:col-start-1' : 'xl:col-start-2'
  const query = promo?.query || searchQuery
  return (
    <Section className={`grid gap-x-4 gap-y-3 ${cols}`}>
      <div className={`min-w-0 xl:row-start-1 ${main}`}>
        <SectionHeader icon={icon} title={title} subtitle={subtitle} onAction={() => onSearch(query)} />
      </div>
      {items.length > 0 ? (
        <Grid className={`xl:row-start-2 ${main} ${loading ? 'opacity-60 transition-opacity' : ''}`}>
          {items.map((it) => <Card key={it.id} item={it} onView={onView} onCall={onCall} onWhatsApp={onWhatsApp} />)}
        </Grid>
      ) : (
        <div className={`flex min-h-[200px] items-center justify-center rounded-xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100 xl:row-start-2 ${main}`}>
          {loading ? 'Loading…' : `No ${emptyLabel} listed${city ? ` in ${city}` : ''} yet.`}
        </div>
      )}
      {promo && (
        <div className={`min-w-0 xl:row-start-2 ${side}`}>
          <PromoCard promo={promo} onClick={() => onSearch(query)} />
        </div>
      )}
    </Section>
  )
}
