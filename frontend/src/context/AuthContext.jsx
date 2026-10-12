import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../services/api.js'
import * as session from '../services/session.js'

const AuthContext = createContext(null)

// Authentication state for this tab. Identity rules (see services/session.js):
//   • the session token is the ONLY thing that makes someone "logged in" — browser history, cached pages and old React state never do;
//   • whenever the identity changes the epoch changes, in-flight requests are aborted, and the whole page tree is re-created
//     (<SessionBoundary>), so nothing the previous account loaded can show up under the new one;
//   • another tab logging in/out, a page restored from the browser's back/forward cache, or a 401 all re-sync this tab to reality.
export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null)
  const [loading, setLoading] = useState(() => !!session.storedToken())
  const [epoch, setEpoch] = useState(() => session.getEpoch())
  const userRef = useRef(null)
  const seq = useRef(0) // identifies the latest profile check; older answers are ignored
  const setUser = (u) => { userRef.current = u; setUserState(u) }

  // Ask the backend who this token really belongs to, and show THAT (never trust what was there before).
  const revalidate = useCallback((token) => {
    const mine = ++seq.current
    return api.get('/api/auth/me', { requiresAuth: true }).then((d) => {
      if (mine !== seq.current || token !== session.getToken()) return userRef.current
      if (userRef.current && String(userRef.current.id) !== String(d.user.id)) setEpoch(session.beginIdentity()) // the token belongs to someone else than what we showed
      setUser(d.user); setLoading(false)
      return d.user
    }).catch((e) => {
      if (e.canceled || mine !== seq.current) return userRef.current
      if (e.status !== 401) setLoading(false) // network trouble: keep what we have; a 401 is handled by the unauthorized handler (ends the session)
      return userRef.current
    })
  }, [])

  // Leave the session: forget the token, wipe account-specific state, new epoch.
  const endSession = useCallback(({ clearStorage }) => {
    seq.current++
    session.setToken(null, { persist: clearStorage })
    if (clearStorage) session.clearAccountStorage()
    setEpoch(session.beginIdentity())
    setUser(null); setLoading(false)
  }, [])

  // Another tab (or a restored page) changed which account is logged in: become that account, from scratch.
  const resync = useCallback((token) => {
    seq.current++
    session.setToken(token, { persist: false }) // localStorage already holds it
    setEpoch(session.beginIdentity())
    setUser(null); setLoading(true)
    revalidate(token)
  }, [revalidate])

  const adopt = useCallback((token, nextUser) => {
    const changed = token !== session.getToken() || String(nextUser?.id) !== String(userRef.current?.id)
    session.setToken(token)
    if (changed) setEpoch(session.beginIdentity())
    setUser(nextUser); setLoading(false)
    revalidate(token) // confirm with the backend; replaces the login payload with the real profile
    return nextUser
  }, [revalidate])

  useEffect(() => {
    session.setUnauthorizedHandler((usedToken) => { if (usedToken === session.getToken()) { session.flagSessionExpired(); endSession({ clearStorage: true }) } })
    const stored = session.storedToken()
    if (stored !== session.getToken()) session.setToken(stored, { persist: false }) // a (re)mounted app always starts from what the browser holds
    const token = session.getToken()
    if (token) revalidate(token); else setLoading(false)

    const check = (persisted) => {
      const stored = session.storedToken(), mine = session.getToken()
      if (stored !== mine) stored ? resync(stored) : endSession({ clearStorage: false }) // another tab changed / ended the session
      else if (persisted && mine) revalidate(mine)                                         // restored from the back/forward cache: prove it is still valid
      else if (mine && !userRef.current) revalidate(mine)                                  // we hold a token but could not reach the server earlier (offline / DB down): try again now that something woke us
    }
    const onStorage = (e) => { if (e.key === 'lf_token' || e.key === null) check(false) }
    const onPageShow = (e) => check(!!e.persisted)
    const onVisible = () => { if (document.visibilityState === 'visible') check(false) }
    window.addEventListener('storage', onStorage)
    const onOnline = () => check(false) // the browser got its connection back
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      session.setUnauthorizedHandler(null)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [revalidate, endSession, resync])

  // identifier = email OR username
  const login = async (identifier, password) => {
    const data = await api.post('/api/auth/login', { identifier, password })
    return establishSession(data.token, data.user)
  }

  // Used by every way of getting a session: password login, Google, account linking, finished registration.
  const establishSession = (token, nextUser) => adopt(token, nextUser)

  const refreshUser = async () => {
    const token = session.getToken()
    const data = await api.get('/api/auth/me', { requiresAuth: true })
    if (token === session.getToken()) setUser(data.user)
    return data.user
  }

  const logout = () => {
    const token = session.getToken()
    // end the session on the server too (this token only), best effort — the local logout never waits for it
    if (token) api.post('/api/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    endSession({ clearStorage: true })
  }

  // "Start Yours" — the logged-in consumer becomes a seller.
  const startSellerAccount = async (payload) => {
    const data = await api.post('/api/seller/start', payload, { requiresAuth: true })
    setUser(data.user) // now role: 'seller', sellerType: 'shop' | 'service' | 'study_center'
    return data.account
  }

  // Lets any screen that just updated the user's account (profile settings,
  // username change, etc) push the fresh copy into context without a reload.
  const updateUser = (nextUser) => setUser(nextUser)

  const value = {
    user,
    loading,
    epoch,
    isAuthenticated: !!user,
    isSeller: user?.role === 'seller',
    isAdmin: user?.role === 'admin',
    login,
    establishSession,
    refreshUser,
    logout,
    startSellerAccount,
    updateUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
