import React, { useState } from 'react'
import ShopWizard from './ShopWizard.jsx'
import ServiceWizard from './ServiceWizard.jsx'
import StudyCenterWizard from './StudyCenterWizard.jsx'
import '../../css/ShopService.css'

// Entry point for "Start Yours". 
function StartYours() {
  const [step, setStep] = useState('choose') // 'choose' | 'shop' | 'service' | 'study_center'

  if (step === 'shop') return <ShopWizard onBack={() => setStep('choose')} />
  if (step === 'service') return <ServiceWizard onBack={() => setStep('choose')} />
  if (step === 'study_center') return <StudyCenterWizard onBack={() => setStep('choose')} />

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 960 }}>
        <div className="section-heading">
          <h2>Start Yours</h2>
          <p>Set up your business on Local Finder in a couple of minutes.</p>
        </div>

        <div className="grid" style={{ gap: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <button
            type="button"
            className="card"
            style={{ padding: 32, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setStep('shop')}
          >
            <span style={{ fontSize: '2rem' }}>🏬</span>
            <h3 style={{ marginTop: 12 }}>I run a Shop</h3>
            <p style={{ color: 'var(--color-text-light)' }}>
              List products, track stock, and manage sales and profit.
            </p>
          </button>

          <button
            type="button"
            className="card"
            style={{ padding: 32, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setStep('service')}
          >
            <span style={{ fontSize: '2rem' }}>🛠️</span>
            <h3 style={{ marginTop: 12 }}>I'm a Service Provider</h3>
            <p style={{ color: 'var(--color-text-light)' }}>
              Electrician, plumber, painter — get discovered nearby.
            </p>
          </button>

          <button
            type="button"
            className="card"
            style={{ padding: 32, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setStep('study_center')}
          >
            <span style={{ fontSize: '2rem' }}>📚</span>
            <h3 style={{ marginTop: 12 }}>I run a Study Center / Library</h3>
            <p style={{ color: 'var(--color-text-light)' }}>
              Seats, memberships, courses, members and fees — all in one place.
            </p>
          </button>
        </div>
      </div>
    </section>
  )
}

export default StartYours
