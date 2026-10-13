import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useViewMode } from '../../context/ViewModeContext.jsx'
import { useLocationContext } from '../../context/LocationContext.jsx'
import StepIndicator from '../../components/StepIndicator.jsx'
import UsernameField from '../../components/UsernameField.jsx'
import LocationPicker from '../../components/LocationPicker.jsx'

const STEPS = ['Basic Info', 'Media & Description', 'Location', 'Facilities & Timing', 'Preview']
const FACILITIES = ['Free Wi-Fi', 'Air Conditioned', 'Lockers', 'Charging Points', 'Power Backup', 'CCTV', 'Drinking Water', 'Discussion Room', 'Parking']

// The owner only chooses "Study Center" here. Seats, zones, time slots, membership plans, charge types and billing are
function StudyCenterWizard({ onBack }) {
  const [step, setStep] = useState(0)
  const [usernameValid, setUsernameValid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { startSellerAccount } = useAuth()
  const { setViewMode } = useViewMode()
  const { coords } = useLocationContext()
  const navigate = useNavigate()
  const [form, setForm] = useState({ centerName: '', ownerName: '', phone: '', email: '', username: '', logoUrl: '', bannerUrl: '', description: '', studyEnvironment: '', address: '', state: '', district: '', area: '', features: [], openTime: '06:00', closeTime: '22:00', openDays: 'All Week' })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const toggle = (name) => set({ features: form.features.includes(name) ? form.features.filter((x) => x !== name) : [...form.features, name] })
  const canProceed = () => (step === 0 ? form.centerName && form.ownerName && form.phone && usernameValid : step === 2 ? form.address : true)
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const back = () => (step === 0 ? onBack() : setStep((s) => s - 1))

  const submit = async () => {
    setError(''); setSubmitting(true)
    try {
      await startSellerAccount({ sellerType: 'study_center', ...form, lat: coords?.lat, lng: coords?.lng })
      setViewMode('seller'); navigate('/', { replace: true })
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="section-heading"><h2>Set up your Study Center</h2><p>This becomes your public profile at localfinder.app/{form.username || '@yourname'}</p></div>
        <StepIndicator steps={STEPS} currentIndex={step} />
        <div className="detail-body card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {step === 0 && (<>
            <label>Study center name<input required value={form.centerName} onChange={(e) => set({ centerName: e.target.value })} /></label>
            <label>Owner name<input required value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} /></label>
            <label>Mobile number<input required value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
            <label>Email (optional)<input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></label>
            <UsernameField value={form.username} onChange={(v) => set({ username: v })} onValidityChange={setUsernameValid} />
          </>)}
          {step === 1 && (<>
            <label>Logo (image URL)<input value={form.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://..." /></label>
            <label>Banner image (image URL)<input value={form.bannerUrl} onChange={(e) => set({ bannerUrl: e.target.value })} placeholder="https://..." /></label>
            <label>About your center<textarea rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })} /></label>
            <label>Study environment<input value={form.studyEnvironment} onChange={(e) => set({ studyEnvironment: e.target.value })} placeholder="Silent zone · 24x7 power backup · CCTV" /></label>
          </>)}
          {step === 2 && (<>
            <label>Address<input required value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Street, locality, city" /></label>
            <div className="grid grid-2" style={{ gap: 16 }}>
              <label>State<input value={form.state} onChange={(e) => set({ state: e.target.value })} /></label>
              <label>District<input value={form.district} onChange={(e) => set({ district: e.target.value })} /></label>
            </div>
            <label>Area (local)<input value={form.area} onChange={(e) => set({ area: e.target.value })} /></label>
            <label>Location (auto or pick a city)<LocationPicker /></label>
          </>)}
          {step === 3 && (<>
            <div><div style={{ marginBottom: 8 }}>Facilities</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{FACILITIES.map((f) => <button key={f} type="button" onClick={() => toggle(f)} className={form.features.includes(f) ? 'btn btn-primary' : 'btn btn-outline'} style={{ padding: '6px 12px' }}>{f}</button>)}</div></div>
            <div className="grid grid-2" style={{ gap: 16 }}>
              <label>Opens<input type="time" value={form.openTime} onChange={(e) => set({ openTime: e.target.value })} /></label>
              <label>Closes<input type="time" value={form.closeTime} onChange={(e) => set({ closeTime: e.target.value })} /></label>
            </div>
            <label>Open days<input value={form.openDays} onChange={(e) => set({ openDays: e.target.value })} /></label>
          </>)}
          {step === 4 && (<div>
            <h3>{form.centerName}</h3><p>{form.ownerName} · {form.phone}</p><p>{form.address}{form.area ? `, ${form.area}` : ''}</p><p>{form.openTime} – {form.closeTime} · {form.openDays}</p>{form.features.length > 0 && <p>{form.features.join(' · ')}</p>}
            <p style={{ marginTop: 12, color: 'var(--color-text-light)' }}>Your seats, zones, time slots, membership plans and billing are set up automatically — you can change them any time from the Seats and Add tabs.</p>
          </div>)}
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-outline" onClick={back}>Back</button>
            {step < STEPS.length - 1 ? <button type="button" className="btn btn-primary" disabled={!canProceed()} onClick={next}>Next</button> : <button type="button" className="btn btn-primary" disabled={submitting} onClick={submit}>{submitting ? 'Creating…' : 'Create my Study Center'}</button>}
          </div>
        </div>
      </div>
    </section>
  )
}
export default StudyCenterWizard
