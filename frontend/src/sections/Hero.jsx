import React from 'react'
import { useNavigate } from 'react-router-dom'
import SearchBar from '../components/SearchBar.jsx'
import '../css/Hero.css'

function Hero() {
  const navigate = useNavigate()

  return (
    <section className="hero">
      <div className="container hero-inner">
        <span className="hero-eyebrow">Find Products, Shops, and Trusted Local Professionals Near You.</span>
        <h1>Find Anything Near You</h1>
        <p className="hero-text">
          Products, services, and best prices around you.
        </p>

        <SearchBar
          placeholder="Search Product or Service..."
          showLocation
        />

        <div className="hero-buttons">
          <button className="btn btn-primary" onClick={() => document.getElementById('trending-products')?.scrollIntoView({ behavior: 'smooth' })}>
            Search
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/search?type=service')}>
            Explore Services
          </button>
        </div>
      </div>
    </section>
  )
}

export default Hero
