import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../../services/authApi.js'
import { useTitle } from '../../hooks/title.js'
import { Alert, AuthShell, Btn, Field, PasswordInput, StrengthMeter, TextInput } from './ui.jsx'

export function ForgotPassword() {
  useTitle('Forgot password')
  const [idf, setIdf] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true)
    try { setMsg((await authApi.forgotPassword(idf.trim())).message) } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }
  return (
    <AuthShell>
      <div className="lfa-card lfa-center" style={{ maxWidth: 460 }}>
        <h2>Forgot your password?</h2>
        <p className="c">Enter your email or username and we&apos;ll send you a reset link.</p>
        <Alert>{err}</Alert><Alert kind="info">{msg}</Alert>
        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <Field id="fp-id" label="Email or username"><TextInput id="fp-id" autoCapitalize="none" value={idf} onChange={(e) => setIdf(e.target.value)} autoFocus /></Field>
          <Btn busy={busy} type="submit" disabled={!idf.trim()}>Send reset link</Btn>
        </form>
        <div className="lfa-foot"><Link to="/login">Back to login</Link></div>
      </div>
    </AuthShell>
  )
}

export function ResetPassword() {
  useTitle('Reset password')
  const [params] = useSearchParams(); const navigate = useNavigate()
  const token = params.get('token') || ''
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [err, setErr] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (pw !== pw2) { setErr('Passwords do not match.'); return }
    setBusy(true)
    try { await authApi.resetPassword({ token, password: pw, confirmPassword: pw2 }); setDone(true); setTimeout(() => navigate('/login'), 1800) } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }
  return (
    <AuthShell>
      <div className="lfa-card lfa-center" style={{ maxWidth: 460 }}>
        <h2>Choose a new password</h2>
        <Alert>{err}</Alert><Alert kind="info">{done ? 'Password updated. Taking you to login…' : ''}</Alert>
        {!token ? <Alert>This reset link is invalid.</Alert> : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 14 }}>
            <Field id="rp-1" label="New password"><PasswordInput id="rp-1" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><StrengthMeter password={pw} /></Field>
            <Field id="rp-2" label="Confirm password"><PasswordInput id="rp-2" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
            <Btn busy={busy} type="submit" disabled={!pw || done}>Update password</Btn>
          </form>
        )}
        <div className="lfa-foot"><Link to="/login">Back to login</Link></div>
      </div>
    </AuthShell>
  )
}
