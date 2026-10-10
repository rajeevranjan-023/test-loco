import React from 'react'
import { Link } from 'react-router-dom'
import { Facebook, Instagram, MessageCircle, Youtube } from 'lucide-react'
import Img from './Img.jsx'
import { footerCols } from '../features/home/config.js'

const EXPLORE = [['Home', '/'], ['Search', '/search'], ['Analytics', '/start-yours'], ['Shops', '/search'], ['Services', '/search'], ['Libraries', '/search']]
const COMPANY = footerCols.find(([h]) => h === 'Company')?.[1] || []
const SOCIAL = [[Facebook, 'bg-blue-600'], [Instagram, 'bg-gradient-to-br from-fuchsia-500 to-orange-400'], [MessageCircle, 'bg-green-500'], [Youtube, 'bg-red-600']]

function StoreBadge({ top, name }) {
  return <button type="button" className="rounded-lg border border-gray-600 bg-black px-3 py-1.5 text-left leading-tight text-white"><span className="block text-[8px] uppercase text-gray-300">{top}</span><span className="text-sm font-semibold">{name}</span></button>
}

// Dark site footer (matches the shop-profile design).
export default function Footer() {
  return (
    <footer className="mt-8 bg-[#0b1220] text-gray-300">
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-5 py-9 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.5fr]">
        <div>
          <div className="flex items-center gap-2">
            <Img src="logo.png" alt="Loco" className="h-10 w-10 rounded-full !bg-transparent" />
            <span className="leading-none"><span className="block text-xl font-semibold text-orange-500">Loco</span><span className="text-[10px] text-gray-400">Local Finder</span></span>
          </div>
          <p className="mt-3 max-w-[260px] text-xs text-gray-400">Support local shops and services in your city. Better prices, better community.</p>
          <div className="mt-4 flex gap-2.5" aria-label="Social links">
            {SOCIAL.map(([Icon, bg], i) => <span key={i} className={`grid h-8 w-8 place-items-center rounded-full text-white ${bg}`}><Icon size={15} /></span>)}
          </div>
        </div>
        {[['Explore', EXPLORE], ['Company', COMPANY]].map(([h, links]) => (
          <div key={h}>
            <h4 className="mb-3 text-sm font-semibold text-white">{h}</h4>
            <ul className="space-y-2 text-xs text-gray-400">{links.map(([l, to]) => <li key={l}><Link to={to} className="hover:text-orange-400">{l}</Link></li>)}</ul>
          </div>
        ))}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">Get the Loco App</h4>
          <div className="flex flex-wrap gap-2"><StoreBadge top="Get it on" name="Google Play" /><StoreBadge top="Download on the" name="App Store" /></div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-2 px-5 py-4 text-[11px] text-gray-400">
          <span>© {new Date().getFullYear()} Loco. All rights reserved.</span>
          <span className="flex gap-5"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Service</Link><Link to="/contact">Refund Policy</Link></span>
        </div>
      </div>
    </footer>
  )
}
