import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useViewMode } from '../../context/ViewModeContext.jsx'
import { useLocationContext } from '../../context/LocationContext.jsx'
import StepIndicator from '../../components/StepIndicator.jsx'
import UsernameField from '../../components/UsernameField.jsx'
import LocationPicker from '../../components/LocationPicker.jsx'

const STEPS = ['Basic Info', 'Media & Description', 'Location', 'Category & Business', 'Timing', 'Preview']

const CATEGORIES = ['Grocery', 'Electronics', 'Medical', 'Hardware', 'Fashion', 'Furniture', 'Mobile Store', 'Bakery', 'Paint', 'Library', 'PG / Hostel', 'Food & Beverages', 'Healthcare', 'Education', 'Other']

function ShopWizard({ onBack }) {
  const [step, setStep] = useState(0)
  const [usernameValid, setUsernameValid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { startSellerAccount } = useAuth()
  const { setViewMode } = useViewMode()
  const { coords, label: locationLabel } = useLocationContext()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    shopName: '', ownerName: '', phone: '', email: '', username: '',
    logoUrl: '', bannerUrl: '', description: '',
    address: '', state: '', district: '', area: '',
    category: 'Grocery', businessType: 'Retail', homeDelivery: false,
    openTime: '09:00', closeTime: '21:00', openDays: 'Mon-Sat',
  })

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const canProceed = () => {
    if (step === 0) return form.shopName && form.ownerName && form.phone && usernameValid
    if (step === 2) return form.address
    return true
  }

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const back = () => (step === 0 ? onBack() : setStep((s) => s - 1))

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      await startSellerAccount({
        sellerType: 'shop',
        ...form,
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
          <h2>Set up your Shop</h2>
          <p>This becomes your public profile at localfinder.app/{form.username || '@yourname'}</p>
        </div>

        <StepIndicator steps={STEPS} currentIndex={step} />

        <div className="detail-body card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {step === 0 && (
            <>
              <label>Shop name
                <input required value={form.shopName} onChange={(e) => set({ shopName: e.target.value })} />
              </label>
              <label>Owner name
                <input required value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} />
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
              <label>Shop logo (image URL)
                <input value={form.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://..." />
              </label>
              <label>Banner image (image URL)
                <input value={form.bannerUrl} onChange={(e) => set({ bannerUrl: e.target.value })} placeholder="https://..." />
              </label>
              <label>Shop description
                <textarea rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })} />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <label>Address (manual)
                <input required value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Street, locality, city" />
              </label>
              <div className="grid grid-2" style={{ gap: 16 }}>
                <label>State
                  <input value={form.state} onChange={(e) => set({ state: e.target.value })} />
                </label>
                <label>District
                  <input value={form.district} onChange={(e) => set({ district: e.target.value })} />
                </label>
              </div>
              <label>Area (local)
                <input value={form.area} onChange={(e) => set({ area: e.target.value })} />
              </label>
              <label>Location (auto or pick a city)
                <LocationPicker />
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <label>Category
                <select value={form.category} onChange={(e) => set({ category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Business type
                <select value={form.businessType} onChange={(e) => set({ businessType: e.target.value })}>
                  <option>Retail</option>
                  <option>Wholesale</option>
                  <option>Both</option>
                </select>
              </label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.homeDelivery} onChange={(e) => set({ homeDelivery: e.target.checked })} style={{ width: 'auto' }} />
                Home delivery available
              </label>
            </>
          )}

          {step === 4 && (
            <>
              <div className="grid grid-2" style={{ gap: 16 }}>
                <label>Opening time
                  <input type="time" value={form.openTime} onChange={(e) => set({ openTime: e.target.value })} />
                </label>
                <label>Closing time
                  <input type="time" value={form.closeTime} onChange={(e) => set({ closeTime: e.target.value })} />
                </label>
              </div>
              <label>Open days
                <select value={form.openDays} onChange={(e) => set({ openDays: e.target.value })}>
                  <option value="Mon-Sat">Mon - Sat</option>
                  <option value="All Week">All Week</option>
                </select>
              </label>
            </>
          )}

          {step === 5 && (
            <div>
              <h3 style={{ marginBottom: 16 }}>Preview your profile</h3>
              <div className="detail-header card" style={{ marginBottom: 20 }}>
                <span className="detail-icon">🏬</span>
                <div>
                  <h1 style={{ fontSize: '1.4rem' }}>{form.shopName || 'Your Shop Name'}</h1>
                  <p className="detail-address">{form.username || '@yourname'}</p>
                  <p style={{ color: 'var(--color-text-light)' }}>{form.address}</p>
                </div>
              </div>
              <ul className="detail-list">
                <li>Owner: {form.ownerName}</li>
                <li>Phone: {form.phone}{form.email ? ' - ' + form.email : ''}</li>
                <li>Category: {form.category} ({form.businessType})</li>
                <li>Home delivery: {form.homeDelivery ? 'Yes' : 'No'}</li>
                <li>Hours: {form.openTime} - {form.closeTime} ({form.openDays})</li>
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
                {submitting ? 'Creating...' : 'Create Shop Profile'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ShopWizard
