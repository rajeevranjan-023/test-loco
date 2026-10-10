import React, { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { BASE_URL } from '../../services/api.js'
import { authApi, regToken } from '../../services/authApi.js'
import { destinationAfterAuth, rememberNext, safeNext } from '../../utils/redirect.js'
import { useTitle } from '../../hooks/title.js'
import { Alert, AuthShell, Btn, Field, GoogleButton, PasswordInput, TextInput } from './ui.jsx'

const ERRORS = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_failed: 'We could not verify your Google account. Please try again.',
  google_not_configured: 'Google sign-in is not set up on this server yet. Use email instead, or ask the site admin to configure it.',
  google_email_unverified: 'Your Google email address is not verified, so we cannot use it.',
  invalid_state: 'That sign-in attempt expired or was invalid. Please try again.',
  email_linked_to_other_google: 'That email is already linked to a different Google account.',
}

export const startGoogle = (next) => window.location.assign(`${BASE_URL}/api/auth/google/start?next=${encodeURIComponent(safeNext(next))}`)

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login'
  useTitle(isLogin ? 'Login' : 'Sign up')
  const [params] = useSearchParams()
  const location = useLocation()
  const { isAuthenticated, loading, user } = useAuth()
  const next = safeNext(params.get('next') || location.state?.from || '/')
  const urlError = ERRORS[params.get('error')] || ''

  if (!loading && isAuthenticated) return <Navigate to={destinationAfterAuth(user, next)} replace />

  return (
    <AuthShell showLogin={!isLogin} next={next === '/' ? '' : next}>
      {isLogin ? <LoginCard next={next} urlError={urlError} /> : <SignupLanding next={next} urlError={urlError} />}
    </AuthShell>
  )
}

function SignupLanding({ next, urlError }) {
  const navigate = useNavigate()
  const [emailMode, setEmailMode] = useState(false)
  const [email, setEmail] = useState('')
  const [err, setErr] = useState(urlError)
  const [busy, setBusy] = useState(false)
  useEffect(() => setErr(urlError), [urlError])

  const emailStart = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const r = await authApi.emailStart(email.trim())
      regToken.set(r.registrationToken); rememberNext(next)
      navigate('/register')
    } catch (ex) { setErr(ex.data?.code === 'EMAIL_EXISTS' ? 'An account with this email already exists. Please log in.' : ex.message) } finally { setBusy(false) }
  }

  return (
    <div className="lfa-hero">
      <div>
        <h1>Your Local <em>Ecosystem</em></h1>
        <p className="lead">Find shops, services, study centers and more in your city.</p>
        <ul className="lfa-bullets"><li>Local Shops</li><li>Trusted Services</li><li>Study Centers &amp; Education</li><li>Everything in One Place</li></ul>
        <img className="lfa-hero-art" src="/hero.png" alt="" />
      </div>
      <div className="lfa-card">
        <h2>Create your account</h2>
        <p className="c">Join Loco and explore your local world.</p>
        <Alert>{err}</Alert>
        <GoogleButton onClick={() => startGoogle(next)} />
        <div className="lfa-or">or</div>
        {!emailMode ? (
          <button type="button" className="lfa-btn sec" onClick={() => setEmailMode(true)}>Sign up with Email</button>
        ) : (
          <form onSubmit={emailStart} noValidate>
            <Field id="su-email" label="Email address" required>
              <TextInput id="su-email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </Field>
            <div className="lfa-actions"><Btn busy={busy} type="submit">Continue</Btn></div>
            <div className="lfa-foot" style={{ marginTop: 10 }}>We&apos;ll verify your mobile number next.</div>
          </form>
        )}
        <div className="lfa-foot">Already have an account? <Link to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`}>Login</Link></div>
        <div className="lfa-foot" style={{ marginTop: 8 }}><Link to="/faq">Need help?</Link></div>
      </div>
    </div>
  )
}

function LoginCard({ next, urlError }) {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [idf, setIdf] = useState(''); const [pw, setPw] = useState('')
  const [err, setErr] = useState(urlError); const [busy, setBusy] = useState(false)
  useEffect(() => setErr(urlError), [urlError])

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (!idf.trim() || !pw) { setErr('Enter your email or username and your password.'); return }
    setBusy(true)
    try {
      const u = await login(idf.trim(), pw)
      navigate(destinationAfterAuth(u, next), { replace: true })
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <div className="lfa-card lfa-center" style={{ maxWidth: 460 }}>
      <h2>Welcome back</h2>
      <p className="c">Log in to continue to Loco.</p>
      <Alert>{err}</Alert>
      <GoogleButton onClick={() => startGoogle(next)} />
      <div className="lfa-or">or log in with your Loco account</div>
      <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
        <Field id="li-id" label="Email or username"><TextInput id="li-id" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@example.com or @username" value={idf} onChange={(e) => setIdf(e.target.value)} /></Field>
        <Field id="li-pw" label="Password"><PasswordInput id="li-pw" autoComplete="current-password" placeholder="Your password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <div style={{ textAlign: 'right', marginTop: -6 }}><Link to="/forgot-password" style={{ fontSize: '.84rem' }}>Forgot password?</Link></div>
        <Btn busy={busy} type="submit">Login</Btn>
      </form>
      <div className="lfa-foot">New to Loco? <Link to={next === '/' ? '/signup' : `/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></div>
    </div>
  )
}
