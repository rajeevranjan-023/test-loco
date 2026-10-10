import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { authApi, regToken } from '../../services/authApi.js'
import { destinationAfterAuth, rememberNext } from '../../utils/redirect.js'
import { useTitle } from '../../hooks/title.js'
import { Alert, AuthShell, Btn, Field, PasswordInput, Spinner } from './ui.jsx'

// Landing page for Google's redirect. The backend has already verified the Google identity; we hold only a one-time ticket.
export default function GoogleCallback() {
  useTitle('Signing in')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { establishSession } = useAuth()
  const ticket = params.get('ticket')
  const started = useRef(false)
  const [state, setState] = useState({ phase: 'verifying', error: '', link: null })

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!ticket) { setState({ phase: 'error', error: 'This sign-in link is not valid.' }); return }
    authApi.googleExchange(ticket).then((r) => {
      if (r.status === 'authenticated') { const u = establishSession(r.token, r.user); navigate(destinationAfterAuth(u, r.next), { replace: true }) }
      else if (r.status === 'register') { regToken.set(r.registrationToken); rememberNext(r.next); navigate('/register', { replace: true }) }
      else if (r.status === 'link_required') setState({ phase: 'link', link: r })
      else setState({ phase: 'error', error: 'Unexpected response. Please try again.' })
    }).catch((e) => setState({ phase: 'error', error: e.message }))
  }, [ticket]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthShell>
      {state.phase === 'verifying' && (
        <div className="lfa-card lfa-center lfa-verifying">
          <div className="lfa-pin">📍</div>
          <h1>Verifying your Google account…</h1>
          <p className="sub-text">This will only take a few seconds. Please wait…</p>
          <Spinner dark lg />
        </div>
      )}
      {state.phase === 'error' && (
        <div className="lfa-card lfa-center" style={{ maxWidth: 460 }}>
          <h2>We couldn&apos;t sign you in</h2>
          <Alert>{state.error}</Alert>
          <Link className="lfa-btn pri" to="/login">Back to login</Link>
        </div>
      )}
      {state.phase === 'link' && <LinkAccount ticket={ticket} info={state.link} />}
    </AuthShell>
  )
}

function LinkAccount({ ticket, info }) {
  const navigate = useNavigate()
  const { establishSession } = useAuth()
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const r = await authApi.googleLink(ticket, pw)
      const u = establishSession(r.token, r.user); navigate(destinationAfterAuth(u, r.next), { replace: true })
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }
  return (
    <div className="lfa-card lfa-center" style={{ maxWidth: 480 }}>
      <h2>Link your Google account</h2>
      <p className="c">A Loco account already exists for <b>{info.maskedEmail}</b>. To protect it, confirm it&apos;s yours by entering that account&apos;s password. We&apos;ll then link Google for faster sign-in.</p>
      <Alert>{err}</Alert>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <Field id="lk-pw" label="Loco password"><PasswordInput id="lk-pw" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></Field>
        <Btn busy={busy} type="submit" disabled={!pw}>Link &amp; continue</Btn>
      </form>
      <div className="lfa-foot"><Link to="/forgot-password">Forgot password?</Link> · <Link to="/login">Cancel</Link></div>
    </div>
  )
}
