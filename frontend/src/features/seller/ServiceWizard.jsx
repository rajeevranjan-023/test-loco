import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useViewMode } from '../../context/ViewModeContext.jsx'
import { useLocationContext } from '../../context/LocationContext.jsx'
import StepIndicator from '../../components/StepIndicator.jsx'
import UsernameField from '../../components/UsernameField.jsx'
import LocationPicker from '../../components/LocationPicker.jsx'

const STEPS = ['Basic Info', 'Media & Description', 'Areas & Pricing', 'Availability', 'Location', 'Preview']

function ServiceWizard({ onBack }) {
  const [step, setStep] = useState(0)
  const [usernameValid, setUsernameValid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { startSellerAccount } = useAuth()
  const { setViewMode } = useViewMode()
  const { coords, label: locationLabel } = useLocationContext()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '', phone: '', email: '', username: '',
    bannerUrl: '', description: '', workType: '',
    areas: [{ state: '', district: '', area: '' }],
    priceAmount: '', priceUnit: 'hour',
    workingDays: 'Mon-Sat', timeSlots: '', availability: 'Available Today',
  })

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const updateArea = (index, patch) => {
    setForm((f) => ({
      ...f,
      areas: f.areas.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }))
  }
  const addArea = () => setForm((f) => ({ ...f, areas: [...f.areas, { state: '', district: '', area: '' }] }))
  const removeArea = (index) => setForm((f) => ({ ...f, areas: f.areas.filter((_, i) => i !== index) }))

  const canProceed = () => {
    if (step === 0) return form.name && form.phone && usernameValid
    if (step === 1) return form.workType
    if (step === 2) return form.priceAmount
    return true
  }

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const back = () => (step === 0 ? onBack() : setStep((s) => s - 1))

  const serviceAreaSummary = form.areas
    .filter((a) => a.area || a.district)
    .map((a) => a.area || a.district)
    .join(' - ')

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      await startSellerAccount({
        sellerType: 'service',
        ...form,
        priceAmount: Number(form.priceAmount),
        serviceArea: serviceAreaSummary,
        lat: coords ? coords.lat : undefined,
        lng: coords ? coords.lng : undefined,
      })
      setViewMode('seller')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="section-heading">
          <h2>Set up your Service Profile</h2>
          <p>This becomes your public profile at localfinder.app/{form.username || '@yourname'}</p>
        </div>

        <StepIndicator steps={STEPS} currentIndex={step} />

        <div className="detail-body card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {step === 0 && (
            <>
              <label>Your name
                <input required value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label>Mobile number
                <input required value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </label>
              <label>Email (optional)
                <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </label>
              <UsernameField
                value={form.username}
                onChange={(v) => set({ username: v })}
                onValidityChange={setUsernameValid}
              />
            </>
          )}

          {step === 1 && (
            <>
              <label>Work type
                <input required placeholder="Electrician, Plumber, ..." value={form.workType} onChange={(e) => set({ workType: e.target.value })} />
              </label>
              <label>Banner image (image URL)
                <input value={form.bannerUrl} onChange={(e) => set({ bannerUrl: e.target.value })} placeholder="https://..." />
              </label>
              <label>Work description
                <textarea rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })} />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <label style={{ marginBottom: 0 }}>Areas of service (add as many as you cover)</label>
              {form.areas.map((a, i) => (
                <div key={i} className="grid grid-3" style={{ gap: 10, alignItems: 'end' }}>
                  <label>State
                    <input value={a.state} onChange={(e) => updateArea(i, { state: e.target.value })} />
                  </label>
                  <label>District
                    <input value={a.district} onChange={(e) => updateArea(i, { district: e.target.value })} />
                  </label>
                  <label>Area
                    <input value={a.area} onChange={(e) => updateArea(i, { area: e.target.value })} />
                  </label>
                  {form.areas.length > 1 && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => removeArea(i)} style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>
                      Remove this area
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm" onClick={addArea} style={{ alignSelf: 'start' }}>
                + Add another area
              </button>

              <div className="grid grid-2" style={{ gap: 16, marginTop: 8 }}>
                <label>Price
                  <input required type="number" min="0" value={form.priceAmount} onChange={(e) => set({ priceAmount: e.target.value })} />
                </label>
                <label>Pricing type
                  <select value={form.priceUnit} onChange={(e) => set({ priceUnit: e.target.value })}>
                    <option value="hour">Per hour</option>
                    <option value="day">Per day</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </label>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <label>Working days
                <select value={form.workingDays} onChange={(e) => set({ workingDays: e.target.value })}>
                  <option value="Mon-Sat">Mon - Sat</option>
                  <option value="All Week">All Week</option>
                </select>
              </label>
              <label>Time slots
                <input value={form.timeSlots} onChange={(e) => set({ timeSlots: e.target.value })} placeholder="e.g. 9 AM - 6 PM" />
              </label>
              <label>Availability
                <select value={form.availability} onChange={(e) => set({ availability: e.target.value })}>
                  <option>Available Today</option>
                  <option>Available Tomorrow</option>
                  <option>Busy</option>
                </select>
              </label>
            </>
          )}

          {step === 4 && (
            <label>Location (auto or pick a city — helps you show up in "nearby" results)
              <LocationPicker />
            </label>
          )}

          {step === 5 && (
            <div>
              <h3 style={{ marginBottom: 16 }}>Preview your profile</h3>
              <div className="detail-header card" style={{ marginBottom: 20 }}>
                <span className="detail-icon">🛠️</span>
                <div>
                  <h1 style={{ fontSize: '1.4rem' }}>{form.name || 'Your Name'}</h1>
                  <p className="detail-address">{form.username || '@yourname'}</p>
                  <p style={{ color: 'var(--color-text-light)' }}>{form.workType}</p>
                </div>
              </div>
              <ul className="detail-list">
                <li>Phone: {form.phone}{form.email ? ' - ' + form.email : ''}</li>
                <li>Serves: {serviceAreaSummary || 'Not specified'}</li>
                <li>Price: {form.priceAmount ? '₹' + form.priceAmount + ' / ' + form.priceUnit : 'Not specified'}</li>
                <li>Availability: {form.availability} ({form.workingDays}{form.timeSlots ? ', ' + form.timeSlots : ''})</li>
                {locationLabel && <li>Location: {locationLabel}</li>}
                {form.description && <li>Description: {form.description}</li>}
              </ul>
            </div>
          )}

          {error && <p style={{ color: '#e0455f' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-outline" onClick={back}>Back</button>
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary" onClick={next} disabled={!canProceed()}>
                Next
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Service Profile'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ServiceWizard
