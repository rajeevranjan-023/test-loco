import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import './auth.css'

export function AuthShell({ children, showLogin = false, next }) {
  return (
    <div className="lfa">
      <header className="lfa-head">
        <Link to="/" className="lfa-logo" aria-label="Loco home"><img src="/logo.png" alt="" />Loco</Link>
        <nav className="lfa-head-links">
          <Link to="/faq">Help</Link>
          {showLogin && <span className="hide-sm">Already have an account? <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Login</Link></span>}
        </nav>
      </header>
      <main className="lfa-main">{children}</main>
    </div>
  )
}

const STEP_LABELS = ['Personal Info', 'Verify Mobile', 'Account Setup', 'Complete']
export function Steps({ current }) {
  return (
    <ol className="lfa-steps" aria-label="Signup progress" style={{ listStyle: 'none', padding: 0 }}>
      {STEP_LABELS.map((l, i) => {
        const n = i + 1; const cls = n < current ? 'done' : n === current ? 'on' : ''
        return (
          <li key={l} className={`lfa-step ${cls}`} aria-current={n === current ? 'step' : undefined}>
            <span className="lfa-dot">{n < current ? '✓' : n}</span><span className="lbl">{l}</span>
          </li>
        )
      })}
    </ol>
  )
}

export const Spinner = ({ dark, lg }) => <span className={`lfa-spin${dark ? ' dark' : ''}${lg ? ' lg' : ''}`} role="status" aria-label="Loading" />

export function Field({ id, label, required, error, hint, children, className = '' }) {
  return (
    <div className={`lfa-field ${className}`}>
      {label && <label htmlFor={id}>{label}{required && <span className="req"> *</span>}</label>}
      {children}
      {error ? <span className="lfa-err" role="alert">{error}</span> : hint ? <span className="lfa-hint">{hint}</span> : null}
    </div>
  )
}

export function TextInput({ id, error, prefix, suffix, locked, ...rest }) {
  return (
    <div className={`lfa-in${error ? ' bad' : ''}${locked ? ' locked' : ''}`}>
      {prefix}
      <input id={id} aria-invalid={!!error} readOnly={locked} {...rest} />
      {suffix}
    </div>
  )
}

export function PasswordInput({ id, error, ...rest }) {
  const [show, setShow] = useState(false)
  return (
    <div className={`lfa-in${error ? ' bad' : ''}`}>
      <input id={id} type={show ? 'text' : 'password'} aria-invalid={!!error} {...rest} />
      <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? '🙈' : '👁'}</button>
    </div>
  )
}

export function Btn({ kind = 'pri', busy, children, ...rest }) {
  return <button className={`lfa-btn ${kind}`} disabled={busy || rest.disabled} {...rest}>{busy ? <span className="lfa-spin" /> : null}{children}</button>
}

export const Alert = ({ kind = 'err', children }) => (children ? <div className={`lfa-alert ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>{children}</div> : null)

export const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.7 7l7.3 5.7c4.3-4 6.8-9.8 6.8-17.2z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.9 2.3-8.6 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
)

export function GoogleButton({ onClick, label = 'Continue with Google', busy }) {
  return <button type="button" className="lfa-btn google" onClick={onClick} disabled={busy}><span className="lfa-gmark"><GoogleG /></span>{label}</button>
}

// Password strength (0-4) — advisory only; the server enforces the real policy.
export function passwordChecks(pw, username = '') {
  const bare = username.replace(/^@/, '').toLowerCase()
  return [
    { ok: pw.length >= 8, text: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), text: 'Use letters and numbers' },
    { ok: /[^A-Za-z0-9]/.test(pw), text: 'Use a special character' },
    { ok: pw.length > 0 && !/^(password|12345678|qwerty)/i.test(pw) && !(bare.length >= 5 && pw.toLowerCase().includes(bare)), text: 'Avoid common passwords' },
  ]
}
export function StrengthMeter({ password, username }) {
  const c = passwordChecks(password, username)
  const score = !password ? 0 : Math.min(4, c.filter((x) => x.ok).length - (c[0].ok && c[1].ok ? 0 : 1))
  const label = ['', 'Weak', 'Fair', 'Good', 'Strong'][Math.max(0, score)]
  return (
    <div className="lfa-meter" aria-live="polite">
      {[1, 2, 3, 4].map((n) => <i key={n} className={score >= n ? `on s${score}` : ''} />)}
      <b style={{ color: score >= 3 ? 'var(--ok)' : score === 2 ? '#d97706' : '#dc2626' }}>{label}</b>
    </div>
  )
}
