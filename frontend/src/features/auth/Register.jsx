import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { authApi, regToken } from '../../services/authApi.js'
import { normalizeIndianMobile, formatPhone } from '../../utils/phone.js'
import { CITY_SUGGESTIONS, INDIAN_STATES } from '../../utils/indiaGeo.js'
import { describeUsernameError, normalizeUsername } from '../../utils/username.js'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { rememberNext } from '../../utils/redirect.js'
import { useTitle } from '../../hooks/title.js'
import { Alert, AuthShell, Btn, Field, PasswordInput, Spinner, Steps, StrengthMeter, TextInput, passwordChecks } from './ui.jsx'

const maxDob = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 13); return d.toISOString().slice(0, 10) }

export default function Register() {
  useTitle('Create your account')
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [fatal, setFatal] = useState('')

  useEffect(() => {
    if (!regToken.get()) { navigate('/signup', { replace: true }); return }
    authApi.getSession().then((s) => {
      if (s.step === 'done') { regToken.clear(); navigate('/login', { replace: true }); return }
      rememberNext(s.next); setSession(s)
    }).catch((e) => { if (e.status === 401) { regToken.clear(); setFatal('Your signup session expired. Please start again.') } else setFatal(e.message) })
  }, [navigate])

  if (fatal) return <AuthShell><div className="lfa-card lfa-center"><Alert>{fatal}</Alert><Link className="lfa-btn pri" to="/signup">Start again</Link></div></AuthShell>
  if (!session) return <AuthShell><div className="lfa-verifying"><Spinner dark lg /></div></AuthShell>

  const current = session.step === 'personal' ? 1 : session.step === 'otp' ? 2 : 3
  return (
    <AuthShell>
      <Steps current={current} />
      {session.step === 'personal' && <PersonalStep session={session} onDone={setSession} />}
      {session.step === 'otp' && <OtpStep session={session} onVerified={setSession} onChangePhone={setSession} />}
      {session.step === 'credentials' && <CredentialsStep session={session} onChangePhone={setSession} />}
    </AuthShell>
  )
}

const Why = () => (
  <aside className="lfa-aside">
    <h4>Why we need this?</h4>
    <ul>
      <li><span className="lfa-ico">👤</span>Create your Loco profile</li>
      <li><span className="lfa-ico">🏪</span>Connect with local businesses</li>
      <li><span className="lfa-ico">📍</span>Personalized recommendations</li>
      <li><span className="lfa-ico">🔒</span>Your details stay private and are never sold</li>
    </ul>
  </aside>
)

function PersonalStep({ session, onDone }) {
  const p = session.profile
  const [f, setF] = useState({ fullName: p.fullName, phone: p.phone, dob: p.dob, gender: p.gender, city: p.city, state: p.state || '', country: 'India', avatarUrl: p.avatarUrl })
  const [errors, setErrors] = useState({}); const [top, setTop] = useState(''); const [busy, setBusy] = useState(false); const [upBusy, setUpBusy] = useState(false)
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })) }
  const cities = useMemo(() => CITY_SUGGESTIONS[f.state] || [], [f.state])

  const validate = () => {
    const e = {}
    if (f.fullName.trim().length < 2) e.fullName = 'Enter your full name.'
    if (!normalizeIndianMobile(f.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number.'
    if (!f.dob) e.dob = 'Select your date of birth.'; else if (f.dob > maxDob()) e.dob = 'You must be at least 13 years old.'
    if (!f.city.trim()) e.city = 'Select your city.'
    if (!f.state) e.state = 'Select your state.'
    return e
  }
  const submit = async (ev) => {
    ev.preventDefault(); setTop('')
    const e = validate(); setErrors(e); if (Object.keys(e).length) return
    setBusy(true)
    try { onDone(await authApi.submitPersonal({ ...f, phone: normalizeIndianMobile(f.phone) })) }
    catch (ex) { setErrors(ex.data?.errors || {}); setTop(ex.message) } finally { setBusy(false) }
  }
  const upload = async (file) => {
    if (!file) return; setUpBusy(true); setTop('')
    try { const r = await authApi.uploadAvatar(file); setF((s) => ({ ...s, avatarUrl: r.url })) } catch (ex) { setTop(ex.message) } finally { setUpBusy(false) }
  }

  return (
    <div className="lfa-two">
      <form className="lfa-card" onSubmit={submit} noValidate>
        <div className="lfa-titlerow">
          <div><h1>Tell us about yourself</h1><p className="sub-text" style={{ margin: 0 }}>{session.kind === 'google' ? 'We got some details from your Google account. Please complete the remaining information.' : 'Please fill in your details to continue.'}</p></div>
          <div className="lfa-avatar">
            {f.avatarUrl ? <img src={f.avatarUrl} alt="Profile" referrerPolicy="no-referrer" /> : <div className="ph">🙂</div>}
            <label title="Add profile picture (optional)">{upBusy ? '…' : '📷'}<input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} /></label>
          </div>
        </div>
        <Alert>{top}</Alert>
        <div className="lfa-grid">
          <Field id="p-name" label="Full Name" required error={errors.fullName} className="full"><TextInput id="p-name" autoComplete="name" value={f.fullName} onChange={set('fullName')} error={errors.fullName} maxLength={80} /></Field>
          <Field id="p-email" label={session.emailVerified ? 'Email (from Google)' : 'Email'} className="full">
            <TextInput id="p-email" value={session.email} locked suffix={session.emailVerified ? <span className="tag ok">✓ Verified</span> : null} />
          </Field>
          <Field id="p-phone" label="Mobile Number" required error={errors.phone} className="full">
            <TextInput id="p-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={f.phone} onChange={set('phone')} error={errors.phone} prefix={<span className="pre">+91</span>} maxLength={16} />
          </Field>
          <Field id="p-dob" label="Date of Birth" required error={errors.dob}><TextInput id="p-dob" type="date" max={maxDob()} value={f.dob} onChange={set('dob')} error={errors.dob} /></Field>
          <Field label="Gender (optional)">
            <div className="lfa-radios" role="radiogroup" aria-label="Gender">
              {[['male', 'Male'], ['female', 'Female'], ['other', 'Other']].map(([v, l]) => <label key={v}><input type="radio" name="gender" checked={f.gender === v} onChange={() => setF((s) => ({ ...s, gender: s.gender === v ? '' : v }))} onClick={() => f.gender === v && setF((s) => ({ ...s, gender: '' }))} />{l}</label>)}
            </div>
          </Field>
          <Field id="p-state" label="State" required error={errors.state}>
            <div className={`lfa-in${errors.state ? ' bad' : ''}`}><select id="p-state" value={f.state} onChange={set('state')}><option value="">Select state</option>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select>⌄</div>
          </Field>
          <Field id="p-city" label="City" required error={errors.city}>
            <TextInput id="p-city" list="p-cities" autoComplete="address-level2" placeholder="e.g. Bhopal" value={f.city} onChange={set('city')} error={errors.city} maxLength={80} />
            <datalist id="p-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field id="p-country" label="Country" required error={errors.country}>
            <div className="lfa-in locked"><select id="p-country" value="India" onChange={() => {}} disabled><option>India</option></select></div>
          </Field>
        </div>
        <div className="lfa-actions"><Btn busy={busy} type="submit">Continue</Btn></div>
      </form>
      <Why />
    </div>
  )
}

function OtpStep({ session, onVerified, onChangePhone }) {
  const len = session.otp.length
  const [digits, setDigits] = useState(Array(len).fill(''))
  const [err, setErr] = useState(''); const [bad, setBad] = useState(false); const [busy, setBusy] = useState(false); const [resending, setResending] = useState(false)
  const [left, setLeft] = useState(0); const [info, setInfo] = useState('')
  const refs = useRef([])

  useEffect(() => { refs.current[0]?.focus() }, [])
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft((s) => s - 1), 1000); return () => clearTimeout(t) }, [left])
  useEffect(() => { setLeft(Math.max(0, Math.round(((session.otp.resendAvailableAt ? new Date(session.otp.resendAvailableAt).getTime() : 0) - Date.now()) / 1000))) }, [session.otp.resendAvailableAt])

  const setAt = (i, v) => {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) { // paste / autofill
      const next = Array(len).fill('').map((_, k) => clean[k] || ''); setDigits(next); refs.current[Math.min(clean.length, len) - 1]?.focus(); return
    }
    setDigits((d) => { const n = [...d]; n[i] = clean; return n }); setBad(false); setErr('')
    if (clean && i < len - 1) refs.current[i + 1]?.focus()
  }
  const onKey = (i, e) => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus(); if (e.key === 'Enter') verify() }
  const code = digits.join('')

  const verify = async () => {
    if (code.length !== len) { setErr(`Enter the ${len}-digit code.`); setBad(true); return }
    setBusy(true); setErr('')
    try { onVerified(await authApi.verifyOtp(code)) }
    catch (ex) { setErr(ex.message); setBad(true); setDigits(Array(len).fill('')); refs.current[0]?.focus() } finally { setBusy(false) }
  }
  const resend = async () => {
    setResending(true); setErr(''); setInfo('')
    try { const r = await authApi.resendOtp(); setDigits(Array(len).fill('')); setLeft(Math.max(0, Math.round((new Date(r.otp.resendAvailableAt) - Date.now()) / 1000))); setInfo('A new code has been sent.') }
    catch (ex) { setErr(ex.message); if (ex.data?.retryAfter) setLeft(ex.data.retryAfter) } finally { setResending(false) }
  }
  const change = async () => { try { onChangePhone(await authApi.changePhone()) } catch (ex) { setErr(ex.message) } }
  const mm = String(Math.floor(left / 60)).padStart(2, '0'); const ss = String(left % 60).padStart(2, '0')

  return (
    <div className="lfa-two">
      <div className="lfa-card">
        <h1>Verify your mobile number</h1>
        <p className="sub-text" style={{ marginBottom: 6 }}>We&apos;ve sent a verification code to</p>
        <div className="lfa-phonebig">+91 {session.profile.phone.slice(0, 5)} {session.profile.phone.slice(5)}</div>
        {session.otp.devMode && <Alert kind="dev">Development mode: no SMS is sent. Use the development test code configured for this server.</Alert>}
        <Alert>{err}</Alert><Alert kind="info">{info}</Alert>
        <div className={`lfa-otp${bad ? ' bad' : ''}`} role="group" aria-label="Verification code">
          {digits.map((d, i) => (
            <input key={i} ref={(el) => (refs.current[i] = el)} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${i + 1}`} maxLength={i === 0 ? len : 1}
              onChange={(e) => setAt(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} />
          ))}
        </div>
        <div style={{ textAlign: 'center', margin: '14px 0 4px' }}>
          <div className="sub-text" style={{ margin: '0 0 6px' }}>Didn&apos;t receive the code?</div>
          {left > 0 ? <span className="lfa-timer">Resend OTP in {mm}:{ss}</span> : <button type="button" className="lfa-link" onClick={resend} disabled={resending}>{resending ? 'Sending…' : 'Resend OTP'}</button>}
          <div style={{ marginTop: 10 }}><button type="button" className="lfa-link" onClick={change}>Change Mobile Number</button></div>
        </div>
        <div className="lfa-actions"><Btn busy={busy} type="button" onClick={verify} disabled={code.length !== len}>Verify OTP</Btn></div>
      </div>
      <aside className="lfa-aside">
        <h4>Secure Verification</h4>
        <ul>
          <li><span className="lfa-ico">🛡️</span>Keeps your account safe</li>
          <li><span className="lfa-ico">👥</span>Prevents fake accounts</li>
          <li><span className="lfa-ico">✅</span>Required to complete registration</li>
        </ul>
      </aside>
    </div>
  )
}

function useRegUsername(raw) {
  const [st, setSt] = useState({ status: 'empty', message: '' })
  const d = useDebouncedValue(raw, 350)
  useEffect(() => {
    if (!d.trim()) { setSt({ status: 'empty', message: '' }); return }
    const local = describeUsernameError(d)
    if (local) { setSt({ status: 'invalid', message: local }); return }
    let cancel = false; setSt({ status: 'checking', message: '' })
    authApi.checkUsername(normalizeUsername(d)).then((r) => !cancel && setSt(r.available ? { status: 'available', message: '' } : { status: 'taken', message: r.message || 'That username is already taken.' }))
      .catch((e) => !cancel && setSt({ status: 'error', message: e.message }))
    return () => { cancel = true }
  }, [d])
  return st
}

function CredentialsStep({ session, onChangePhone }) {
  const navigate = useNavigate(); const { establishSession } = useAuth()
  const [u, setU] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [errors, setErrors] = useState({}); const [top, setTop] = useState(''); const [busy, setBusy] = useState(false)
  const un = useRegUsername(u)
  const checks = passwordChecks(pw, u)
  const match = pw2.length > 0 && pw === pw2

  const submit = async (e) => {
    e.preventDefault(); setTop(''); const er = {}
    if (un.status !== 'available') er.username = un.message || 'Choose an available username.'
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) er.password = 'Use at least 8 characters with letters and numbers.'
    if (pw !== pw2) er.confirmPassword = 'Passwords do not match.'
    setErrors(er); if (Object.keys(er).length) return
    setBusy(true)
    try {
      const r = await authApi.complete({ username: normalizeUsername(u), password: pw, confirmPassword: pw2 })
      regToken.clear(); rememberNext(r.next); establishSession(r.token, r.user); navigate('/welcome', { replace: true })
    } catch (ex) {
      setErrors(ex.data?.errors || {}); setTop(ex.message)
      if (ex.data?.code === 'OTP_REQUIRED') onChangePhone(await authApi.getSession())
      if (ex.data?.code === 'EMAIL_EXISTS' || ex.data?.code === 'PHONE_EXISTS') setTop(`${ex.message}`)
    } finally { setBusy(false) }
  }

  return (
    <div className="lfa-two">
      <form className="lfa-card" onSubmit={submit} noValidate>
        <h1>Create your Loco account</h1>
        <p className="sub-text">Set a username and password to complete your registration.</p>
        <Alert>{top}</Alert>
        <div style={{ display: 'grid', gap: 16 }}>
          <Field id="c-user" label="Username" required error={errors.username || ((un.status === 'invalid' || un.status === 'taken' || un.status === 'error') && un.message)} hint="This will be your unique identity on Loco.">
            <TextInput id="c-user" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" placeholder="e.g. rajeev236" maxLength={21} value={u} onChange={(e) => { setU(e.target.value); setErrors((x) => ({ ...x, username: '' })) }}
              error={errors.username || un.status === 'taken' || un.status === 'invalid'} suffix={un.status === 'available' ? <span className="tag ok">✓ Available</span> : un.status === 'checking' ? <span className="lfa-spin dark" /> : null} />
          </Field>
          <Field id="c-pw" label="Password" required error={errors.password}>
            <PasswordInput id="c-pw" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setErrors((x) => ({ ...x, password: '' })) }} error={errors.password} />
            <StrengthMeter password={pw} username={u} />
          </Field>
          <Field id="c-pw2" label="Confirm Password" required error={errors.confirmPassword}>
            <PasswordInput id="c-pw2" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErrors((x) => ({ ...x, confirmPassword: '' })) }} error={errors.confirmPassword} />
            {match && <span className="lfa-okmsg">✓ Passwords match</span>}
          </Field>
        </div>
        <div className="lfa-actions"><Btn busy={busy} type="submit">Create Account</Btn></div>
      </form>
      <aside className="lfa-aside">
        <h4>Password Tips</h4>
        <ul>{checks.map((c) => <li key={c.text}><span className={`lfa-ico ${c.ok ? 'ok' : 'bad'}`}>{c.ok ? '✓' : '•'}</span>{c.text}</li>)}</ul>
      </aside>
    </div>
  )
}
