import React from 'react'
import Section from './Section.jsx'
import Grid from './Grid.jsx'

export default function WhyChoose({ items }) {
  return (
    <Section>
      <h2 className="text-lg font-bold text-gray-900">Why Choose Loco?</h2>
      <p className="mb-4 text-xs text-gray-500">Support local businesses and get the best services in your city.</p>
      <Grid preset="features">
        {items.map((i) => (
          <div key={i.title} className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <span className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${i.tone}`} aria-hidden>{i.icon}</span>
            <h3 className="mt-2 text-sm font-bold text-gray-900">{i.title}</h3>
            <p className="text-xs text-gray-500">{i.desc}</p>
          </div>
        ))}
      </Grid>
    </Section>
  )
}
