import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('lf_token')
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get('/api/auth/me', { requiresAuth: true })
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('lf_token')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // identifier = email OR username
  const login = async (identifier, password) => {
    const data = await api.post('/api/auth/login', { identifier, password })
    return establishSession(data.token, data.user)
  }

  // Used by every way of getting a session: password login, Google, account linking, finished registration.
  const establishSession = (token, nextUser) => {
    localStorage.setItem('lf_token', token)
    setUser(nextUser)
    return nextUser
  }

  const refreshUser = async () => {
    const data = await api.get('/api/auth/me', { requiresAuth: true })
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('lf_token')
    localStorage.removeItem('lf_view_mode')
    setUser(null)
  }

  // "Start Yours" — the logged-in consumer becomes a seller.
  const startSellerAccount = async (payload) => {
    const data = await api.post('/api/seller/start', payload, { requiresAuth: true })
    setUser(data.user) // now role: 'seller', sellerType: 'shop' | 'service'
    return data.account
  }

  // Lets any screen that just updated the user's account (profile settings,
  // username change, etc) push the fresh copy into context without a reload.
  const updateUser = (nextUser) => setUser(nextUser)

  const value = {
    user,
    loading,
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
