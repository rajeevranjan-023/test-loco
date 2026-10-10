import React from 'react'
import PageHero from '../components/PageHero.jsx'
import { useTitle } from '../hooks/title.js'
import '../css/StaticPages.css'

const features = [
  {
    icon: '📍',
    title: 'Hyper-local discovery',
    desc: 'Find products, shops and service providers actually near you, ranked by distance and relevance — not generic search noise.',
  },
  {
    icon: '💰',
    title: 'Transparent price comparison',
    desc: 'See the same product across multiple local shops side by side, so you always know who has the best deal.',
  },
  {
    icon: '🧰',
    title: 'On-demand services',
    desc: 'Book trusted electricians, plumbers, cleaners and other local professionals in a few taps.',
  },
  {
    icon: '📊',
    title: 'Seller & analytics dashboard',
    desc: 'Sellers get an easy-to-use dashboard to manage products, track sales and understand their customers.',
  },
  {
    icon: '⭐',
    title: 'Ratings you can trust',
    desc: 'Real reviews and star ratings on every shop, product and service to help you decide with confidence.',
  },
  {
    icon: '🌓',
    title: 'Modern, accessible design',
    desc: 'A clean, fast, fully responsive experience with light and dark mode — built for every device.',
  },
]

const audience = [
  {
    icon: '🧑‍🤝‍🧑',
    title: 'Everyday Users',
    desc: 'Discover the best local products and services near you, compare prices, and connect directly with sellers — no middleman markups.',
  },
  {
    icon: '🏪',
    title: 'Shop Owners',
    desc: 'List your shop and products, reach nearby customers actively searching for what you sell, and manage everything from one dashboard.',
  },
  {
    icon: '🛠️',
    title: 'Service Providers',
    desc: 'Get discovered by people who need your skills right now — plumbers, electricians, tutors, cleaners and more — and manage bookings easily.',
  },
]

const benefits = [
  'Free to join as a buyer, shop or service provider',
  'Hyper-local results instead of generic marketplace listings',
  'Direct connection between buyers and sellers — no hidden middlemen',
  'Simple, guided onboarding to get your business listed in minutes',
  'Real-time analytics so sellers understand what is actually working',
  'Clean, distraction-free interface that works great on mobile',
]

function About() {
  useTitle('About Us')

  return (
    <div className="static-page about-page">
      <PageHero
        eyebrow="About SERVOP"
        title="Your neighborhood, online."
        subtitle="SERVOP connects people with the shops, products and service providers right around them — making local commerce as easy as a search."
      />

      <section className="section">
        <div className="container">
          <div className="about-intro grid grid-2">
            <div>
              <h2>What is SERVOP?</h2>
              <p>
                SERVOP (Local Product &amp; Service Finder) is a platform built to close the gap
                between local businesses and the people who need them. Instead of scrolling
                through unrelated national listings, you get results from shops and professionals
                that are actually near you — with live pricing, ratings and contact details.
              </p>
              <p>
                Whether you&apos;re hunting for the cheapest laptop in town, booking a plumber for
                a leaking pipe, or trying to get your own small shop discovered online, SERVOP is
                built to make that connection instant.
              </p>
            </div>
            <div className="about-card card">
              <h3>🎯 Our Mission</h3>
              <p>
                To make every local business — big or small — as easy to discover online as a
                global brand, and to help every buyer find what they need without overpaying or
                over-searching.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-heading">
            <h2>The problem we solve</h2>
            <p>
              Local shops and service providers are often invisible online, while buyers waste
              time and money searching through irrelevant results or relying on word of mouth.
              SERVOP bridges that gap with one focused, hyper-local platform.
            </p>
          </div>

          <div className="grid grid-2 vision-grid">
            <div className="about-card card">
              <h3>😕 Before SERVOP</h3>
              <p>
                Buyers scroll through generic marketplaces or ask around for recommendations.
                Local sellers rely on foot traffic and word of mouth, with no easy way to reach
                new customers or showcase what they offer.
              </p>
            </div>
            <div className="about-card card">
              <h3>🚀 With SERVOP</h3>
              <p>
                Buyers search once and instantly see nearby shops, products and services with
                prices and ratings. Sellers get a free, guided listing and a dashboard to track
                everything — turning local discovery into a two-way win.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <h2>Key features</h2>
            <p>Everything you need to find, compare and connect — all in one place.</p>
          </div>
          <div className="grid grid-3">
            {features.map((f) => (
              <div className="about-card card feature-card" key={f.title}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-heading">
            <h2>Who is SERVOP for?</h2>
            <p>Built for everyone on both sides of a local transaction.</p>
          </div>
          <div className="grid grid-3">
            {audience.map((a) => (
              <div className="about-card card" key={a.title}>
                <div className="feature-icon">{a.icon}</div>
                <h3>{a.title}</h3>
                <p>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid grid-2 why-grid">
            <div>
              <h2>Why choose SERVOP?</h2>
              <p>
                We&apos;re focused on one thing — making local commerce simple, transparent and
                fast — instead of trying to be everything to everyone.
              </p>
              <ul className="benefits-list">
                {benefits.map((b) => (
                  <li key={b}>
                    <span className="benefit-check" aria-hidden="true">✔</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="about-card card founder-card">
              <h3>👋 Built by people who love local business</h3>
              <p>
                SERVOP started as a simple idea: local businesses deserve the same discoverability
                as big brands, and buyers deserve a faster way to find them. Our small team is
                dedicated to building tools that make that connection effortless for everyone —
                one search at a time.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About
