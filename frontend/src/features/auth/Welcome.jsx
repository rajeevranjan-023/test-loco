import React, { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLocationContext } from '../../context/LocationContext.jsx'
import { authApi } from '../../services/authApi.js'
import { uploadMedia } from '../../services/media.js'
import { EXAMPLE_CITIES } from '../../utils/cities.js'
import { consumeNext } from '../../utils/redirect.js'
import { profilePath } from '../../utils/username.js'
import { useTitle } from '../../hooks/title.js'
import { Alert, AuthShell, Btn, Field, Spinner, Steps, TextInput } from './ui.jsx'

const TYPES = [
  { id: 'shop', icon: '🏪', title: 'Shop / Seller', text: 'Sell products, manage your shop, reach local customers.', biz: true },
  { id: 'service', icon: '🛠️', title: 'Service Provider', text: 'Offer services like electrician, plumber, tutor, etc.', biz: true },
  { id: 'study', icon: '📖', title: 'Study Center', text: 'Manage your study center, members, seats and courses.', biz: true },
  { id: 'consumer', icon: '🙋', title: "I'm a Consumer", text: 'Just explore and use Loco.' },
]
const INTERESTS = [
  ['shopping', '🛍️', 'Shopping'], ['services', '🔧', 'Services'], ['study-centers', '📖', 'Study Center'], ['food-beverages', '🍔', 'Food & Beverages'],
  ['home-services', '🏠', 'Home Services'], ['education', '🎓', 'Education'], ['health-wellness', '💙', 'Health & Wellness'], ['electronics', '📱', 'Electronics'],
  ['fashion', '👗', 'Fashion'], ['daily-needs', '🧺', 'Daily Needs'], ['automotive', '🚗', 'Automotive'], ['other', '⋯', 'Other'],
]
const SHOP_CATEGORIES = ['Grocery', 'Electronics', 'Medical', 'Hardware', 'Fashion', 'Furniture', 'Mobile Store', 'Bakery', 'Paint', 'Food & Beverages', 'Healthcare', 'Other']
const STEP_FROM_SERVER = { 'account-type': 'type', business: 'business', interests: 'interests', location: 'location', done: 'done' }

export default function Welcome() {
  useTitle('Welcome to Loco')
  const { user, loading, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(null)
  const [types, setTypes] = useState(['consumer'])
  const [skippedBusiness, setSkippedBusiness] = useState(false)
  const [interests, setInterests] = useState([])

  useEffect(() => {
    if (user && step === null) {
      setStep(STEP_FROM_SERVER[user.onboardingStep] || 'type')
      setTypes(user.accountTypes?.length ? user.accountTypes : ['consumer'])
      setInterests(user.interests || [])
    }
  }, [user, step])

  if (loading) return <AuthShell><div className="lfa-verifying"><Spinner dark lg /></div></AuthShell>
  if (!user) return <Navigate to="/login" replace />
  if (user.onboardingCompleted && step === null) return <Navigate to={consumeNext()} replace />
  if (!step) return null

  const go = async (next, body = {}) => { await authApi.updateOnboarding({ ...body, step: next === 'done' ? 'done' : next === 'type' ? 'account-type' : next }); setStep(next) }
  const bizType = types.find((t) => TYPES.find((x) => x.id === t)?.biz)
  const finish = async (toDashboard) => {
    try { await authApi.updateOnboarding({ completed: true }); await refreshUser() } catch { /* completion flag is best-effort; the account already works */ }
    const dest = toDashboard && user.username && user.role === 'seller' ? profilePath(user.username, 'dashboard') : consumeNext()
    navigate(dest, { replace: true })
  }

  return (
    <AuthShell>
      <Steps current={step === 'done' ? 4 : 3} />
      {step === 'type' && <TypeStep types={types} setTypes={setTypes} onNext={async () => {
        const biz = types.find((t) => TYPES.find((x) => x.id === t)?.biz)
        await go(biz ? 'business' : 'interests', { accountTypes: types })
      }} onSkip={() => go('interests', { accountTypes: ['consumer'] }).then(() => setTypes(['consumer']))} />}
      {step === 'business' && bizType && <BusinessStep type={bizType} onDone={() => go('interests')} onSkip={() => { setSkippedBusiness(true); return go('interests') }} />}
      {step === 'business' && !bizType && <Navigate to="/welcome" replace />}
      {step === 'interests' && <InterestsStep value={interests} setValue={setInterests} onNext={() => go('location', { interests })} onSkip={() => go('location')} />}
      {step === 'location' && <LocationStep onDone={() => go('done')} />}
      {step === 'done' && <Success user={user} skippedBusiness={skippedBusiness} onFinish={finish} />}
    </AuthShell>
  )
}

function TypeStep({ types, setTypes, onNext, onSkip }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const toggle = (t) => setTypes((cur) => {
    if (t.id === 'consumer') return cur.includes('consumer') && cur.length > 1 ? cur.filter((x) => x !== 'consumer') : cur.includes('consumer') ? cur : [...cur, 'consumer']
    const without = cur.filter((x) => !TYPES.find((y) => y.id === x)?.biz)           // one business type at a time
    return cur.includes(t.id) ? (without.length ? without : ['consumer']) : [...without, t.id]
  })
  const run = (fn, setB) => async () => { setB(true); setErr(''); try { await fn() } catch (e) { setErr(e.message) } finally { setB(false) } }
  const [sk, setSk] = useState(false)
  return (
    <div className="lfa-wide lfa-card">
      <h1 style={{ textAlign: 'center' }}>What do you want to do on Loco?</h1>
      <p className="sub-text" style={{ textAlign: 'center' }}>You can choose one or more options. You can also skip this and decide later from settings. (One business per account for now.)</p>
      <Alert>{err}</Alert>
      <div className="lfa-choices">
        {TYPES.map((t) => { const on = types.includes(t.id); return (
          <button key={t.id} type="button" className={`lfa-choice${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(t)}>
            <span className="ci">{t.icon}</span><span className="ct"><b>{t.title}</b><small>{t.text}</small></span><span className="box">{on ? '✓' : ''}</span>
          </button>) })}
      </div>
      <div className="lfa-actions"><Btn kind="sec" busy={sk} onClick={run(onSkip, setSk)}>Skip for now</Btn><Btn busy={undefined} onClick={run(onNext, setBusy)} disabled={busy}>{busy ? 'Saving…' : 'Continue'}</Btn></div>
    </div>
  )
}

function BusinessStep({ type, onDone, onSkip }) {
  const { user, startSellerAccount } = useAuth()
  const isService = type === 'service'; const isStudy = type === 'study'
  const label = isService ? 'Service Provider' : isStudy ? 'Study Center' : 'Shop / Seller'
  const [f, setF] = useState({ name: '', description: '', address: user.address?.city ? `${user.address.city}, ${user.address.state}` : '', category: 'Grocery', workType: '', price: '', logoUrl: '', bannerUrl: '' })
  const [errors, setErrors] = useState({}); const [top, setTop] = useState(''); const [busy, setBusy] = useState(false); const [up, setUp] = useState('')
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })) }
  const upload = async (key, file) => {
    if (!file) return; setUp(key); setTop('')
    try { const r = await uploadMedia(file, key === 'logoUrl' ? 'logos' : 'banners'); setF((s) => ({ ...s, [key]: r.url })) } catch (e) { setTop(e.message) } finally { setUp('') }
  }
  const submit = async (e) => {
    e.preventDefault(); const er = {}
    if (!f.name.trim()) er.name = 'Enter a business name.'
    if (isService) { if (!f.workType.trim()) er.workType = 'What service do you offer?'; if (!(Number(f.price) > 0)) er.price = 'Enter a starting price.' }
    else if (!f.address.trim()) er.address = 'Enter your address.'
    setErrors(er); if (Object.keys(er).length) return
    setBusy(true); setTop('')
    try {
      await startSellerAccount(isService
        ? { sellerType: 'service', name: f.name.trim(), workType: f.workType.trim(), priceAmount: Number(f.price), description: f.description, bannerUrl: f.bannerUrl, serviceArea: f.address, areas: user.address?.city ? [user.address.city] : [] }
        : isStudy
          // a Study Center is its own business type (seats · members · courses · pending dues) — everything else is configured by its schema
          ? { sellerType: 'study_center', centerName: f.name.trim(), description: f.description, address: f.address.trim(), state: user.address?.state, district: user.address?.city, logoUrl: f.logoUrl, bannerUrl: f.bannerUrl }
          : { sellerType: 'shop', shopName: f.name.trim(), description: f.description, category: f.category, address: f.address.trim(), state: user.address?.state, district: user.address?.city, logoUrl: f.logoUrl, bannerUrl: f.bannerUrl })
      await onDone()
    } catch (ex) { setTop(ex.message) } finally { setBusy(false) }
  }
  const Up = ({ k, text }) => (
    <label className="lfa-up" title={text}>{f[k] ? <img src={f[k]} alt={text} /> : up === k ? <span className="lfa-spin dark" /> : '+'}<small>{text}</small><input type="file" accept="image/*" hidden onChange={(e) => upload(k, e.target.files?.[0])} /></label>
  )
  return (
    <form className="lfa-wide lfa-card" onSubmit={submit} noValidate>
      <h1>Set up your business <span style={{ fontSize: '.9rem', color: 'var(--muted)', fontWeight: 500 }}>(Optional)</span></h1>
      <p className="sub-text">You can complete this now or later from settings.</p>
      <Alert>{top}</Alert>
      <div className="lfa-grid">
        <Field id="b-name" label="Business Name" required error={errors.name}><TextInput id="b-name" value={f.name} onChange={set('name')} error={errors.name} maxLength={80} placeholder={isStudy ? 'e.g. Bright Study Center' : ''} /></Field>
        <Field id="b-type" label="Business Type" required><div className="lfa-in locked"><select id="b-type" disabled value={type}><option value={type}>{label}</option></select></div></Field>
        {isService ? (<>
          <Field id="b-work" label="Service you offer" required error={errors.workType}><TextInput id="b-work" value={f.workType} onChange={set('workType')} error={errors.workType} placeholder="e.g. Electrician" /></Field>
          <Field id="b-price" label="Starting price (₹ / hour)" required error={errors.price}><TextInput id="b-price" type="number" min="1" inputMode="numeric" value={f.price} onChange={set('price')} error={errors.price} /></Field>
        </>) : !isStudy && (
          <Field id="b-cat" label="Category" className="full"><div className="lfa-in"><select id="b-cat" value={f.category} onChange={set('category')}>{SHOP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>⌄</div></Field>
        )}
        <Field id="b-desc" label="Description" className="full"><div className="lfa-in" style={{ padding: 0 }}><textarea id="b-desc" rows={3} maxLength={400} value={f.description} onChange={set('description')} style={{ width: '100%', border: 0, outline: 0, background: 'transparent', font: 'inherit', padding: 12, resize: 'vertical' }} placeholder="Tell customers about your business" /></div></Field>
        <Field id="b-addr" label={isService ? 'Service area' : 'Address'} required={!isService} error={errors.address} className="full"><TextInput id="b-addr" value={f.address} onChange={set('address')} error={errors.address} prefix="📍" /></Field>
        <div className="full"><div className="lfa-label" style={{ marginBottom: 6 }}>Photos (Optional)</div><div className="lfa-uploads">{!isService && <Up k="logoUrl" text="Logo" />}<Up k="bannerUrl" text="Banner" /></div></div>
      </div>
      <div className="lfa-actions"><Btn kind="sec" type="button" onClick={onSkip}>Skip for now</Btn><Btn busy={busy} type="submit">Save &amp; Continue</Btn></div>
    </form>
  )
}

function InterestsStep({ value, setValue, onNext, onSkip }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const toggle = (id) => setValue((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))
  const run = async (fn) => { setBusy(true); setErr(''); try { await fn() } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  return (
    <div className="lfa-wide lfa-card">
      <h1>What are you interested in?</h1>
      <p className="sub-text">Select categories to personalize your Loco experience. You can also skip this.</p>
      <Alert>{err}</Alert>
      <div className="lfa-tiles">{INTERESTS.map(([id, em, l]) => <button key={id} type="button" className={`lfa-tile${value.includes(id) ? ' on' : ''}`} aria-pressed={value.includes(id)} onClick={() => toggle(id)}><span className="em">{em}</span>{l}</button>)}</div>
      <div className="lfa-actions"><Btn kind="sec" disabled={busy} onClick={() => run(onSkip)}>Skip</Btn><Btn disabled={busy} onClick={() => run(onNext)}>Continue</Btn></div>
    </div>
  )
}

function LocationStep({ onDone }) {
  const { setCoordsFromOnboarding, setManualCity } = useLocationContext()
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [manual, setManual] = useState(false); const [city, setCity] = useState('')
  const proceed = async () => { try { await onDone() } catch (e) { setErr(e.message) } }

  const enable = () => {
    setErr('')
    if (!('geolocation' in navigator)) { setErr('Location is not available on this device. You can pick your city instead.'); setManual(true); return }
    setBusy(true)
    // Requested ONLY now, after the explicit click. Low accuracy is enough for "nearby"; the server also rounds it to ~1 km.
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        try { await authApi.updateOnboarding({ coarseLocation: c }); setCoordsFromOnboarding({ lat: Math.round(c.lat * 100) / 100, lng: Math.round(c.lng * 100) / 100 }) } catch { /* not fatal */ }
        setBusy(false); proceed()
      },
      (e) => { setBusy(false); setManual(true); setErr(e.code === 1 ? 'Location permission was denied. You can choose your city instead, or continue without it.' : e.code === 3 ? 'Finding your location timed out. You can choose your city instead.' : 'We could not determine your location. You can choose your city instead.') },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }
  const saveCity = async () => {
    const c = EXAMPLE_CITIES.find((x) => x.name === city); if (!c) return
    setBusy(true)
    try { await authApi.updateOnboarding({ city: c.name, state: c.state }); setManualCity(c.name); await proceed() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="lfa-center lfa-card" style={{ textAlign: 'center' }}>
      <div className="lfa-map" aria-hidden>📍</div>
      <h1>Enable Location</h1>
      <p className="sub-text">Help us show local shops, services and study centers near you.</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 auto 16px', maxWidth: 300, textAlign: 'left', display: 'grid', gap: 8, fontSize: '.88rem', color: 'var(--muted)' }}>
        <li>✅ Find nearby businesses</li><li>✅ Get better local results</li><li>✅ You can change this later anytime</li>
      </ul>
      <Alert>{err}</Alert>
      {manual && (
        <div style={{ textAlign: 'left', marginBottom: 12 }}>
          <Field id="l-city" label="Choose your city"><div className="lfa-in"><select id="l-city" value={city} onChange={(e) => setCity(e.target.value)}><option value="">Select city</option>{EXAMPLE_CITIES.map((c) => <option key={c.name}>{c.name}</option>)}</select>⌄</div></Field>
          <div className="lfa-actions" style={{ marginTop: 10 }}><Btn kind="blue" onClick={saveCity} disabled={!city || busy}>Use this city</Btn></div>
        </div>
      )}
      <div className="lfa-actions"><Btn kind="sec" disabled={busy} onClick={proceed}>Not Now</Btn><Btn busy={busy} onClick={enable}>Allow Location</Btn></div>
      {!manual && <div className="lfa-foot"><button type="button" className="lfa-link" onClick={() => setManual(true)}>Choose my city instead</button></div>}
    </div>
  )
}

function Success({ user, skippedBusiness, onFinish }) {
  const seller = user.role === 'seller'
  const [busy, setBusy] = useState(false)
  const click = (d) => async () => { setBusy(true); await onFinish(d) }
  return (
    <div className="lfa-center lfa-card lfa-success">
      <div className="lfa-check" aria-hidden>✓</div>
      <h1>Account created successfully!</h1>
      <p className="sub-text">Welcome to Loco 🎉 Your account has been created and you are now logged in.</p>
      <div className="lfa-actions" style={{ flexDirection: 'column' }}>
        <Btn busy={busy} onClick={click(seller)}>{seller ? 'Go to Dashboard' : 'Go to Homepage'}</Btn>
        {(skippedBusiness || !user.interests?.length) && <Btn kind="sec" disabled={busy} onClick={click(false)}>Complete Profile Later</Btn>}
      </div>
    </div>
  )
}
