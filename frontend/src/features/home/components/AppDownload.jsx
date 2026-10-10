import React from 'react'
import Section from './Section.jsx'
import StoreButtons from './StoreButtons.jsx'
import Img from '../../../components/Img.jsx'

// Background image (footer-banner.png) + text/buttons left, mockup centered. Stacks & centers on mobile.
export default function AppDownload() {
  return (
    <Section className="relative isolate overflow-hidden rounded-2xl bg-gray-100 shadow-sm ring-1 ring-gray-100">
      <Img src="footer-banner.png" alt="" className="absolute inset-0 -z-10 h-full w-full !items-end !justify-end p-2" />
      <div className="absolute inset-0 -z-10 bg-white/40" aria-hidden />
      <div className="grid items-center gap-6 p-6 text-center sm:p-8 md:grid-cols-[1fr_auto_1fr] md:text-left">
        <div className="min-w-0 md:justify-self-start">
          <h2 className="text-xl font-bold text-gray-900">Get the Loco App</h2>
          <p className="mb-4 mt-1 text-sm text-gray-700">Shop and book services on the go.</p>
          <div className="flex justify-center md:justify-start"><StoreButtons /></div>
        </div>
        <Img src="app-mockup.png" alt="Loco app" className="mx-auto h-56 w-32 rounded-3xl border-4 border-gray-800 shadow-lg" />
        <div className="hidden md:block" aria-hidden />
      </div>
    </Section>
  )
}
