import React from 'react'
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { render, act, fireEvent } from '@testing-library/react'
import { installBackend, tick } from './fakeBackend.js'

export const backend = installBackend()
const { AuthProvider, useAuth } = await import('../../src/context/AuthContext.jsx')
const { ViewModeProvider } = await import('../../src/context/ViewModeContext.jsx')
const { default: SessionBoundary } = await import('../../src/components/SessionBoundary.jsx')
const { default: ProtectedRoute } = await import('../../src/components/ProtectedRoute.jsx')
const { default: Navbar } = await import('../../src/components/Navbar.jsx')
const { default: PersonalActivityPage } = await import('../../src/features/activity/PersonalActivityPage.jsx')

export const live = { auth: null, nav: null, loc: null }
const Probe = () => { live.auth = useAuth(); live.nav = useNavigate(); live.loc = useLocation(); return null }
const LoginPage = () => {
  const { login } = useAuth(), navigate = useNavigate(), [email, setEmail] = React.useState(''), [pw, setPw] = React.useState('')
  return <form onSubmit={async (e) => { e.preventDefault(); await login(email, pw); navigate('/activity') }}><input aria-label="email" value={email} onChange={(e) => setEmail(e.target.value)} /><input aria-label="password" value={pw} onChange={(e) => setPw(e.target.value)} /><button type="submit">Sign in</button></form>
}
const Page = ({ name }) => <div>page:{name}</div>

// A small copy of the real route table: public pages with the real Navbar, the real ProtectedRoute and the real personal activity page.
export async function mountApp(path = '/') {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><ViewModeProvider><Probe />
        <SessionBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<><Navbar /><main><RoutesOutlet /></main></>}>
              <Route path="/" element={<Page name="home" />} />
              <Route path="/search" element={<Page name="search" />} />
              <Route path="/faq" element={<Page name="faq" />} />
              <Route path="/settings" element={<Page name="settings" />} />
              <Route path="/start-yours" element={<ProtectedRoute><Page name="start-yours" /></ProtectedRoute>} />
              <Route path="/activity" element={<ProtectedRoute><PersonalActivityPage /></ProtectedRoute>} />
              <Route path="/:username/dashboard" element={<ProtectedRoute><Page name="merchant-dashboard" /></ProtectedRoute>} />
              <Route path="/:username" element={<Page name="profile" />} />
            </Route>
          </Routes>
        </SessionBoundary>
      </ViewModeProvider></AuthProvider>
    </MemoryRouter>)
  await act(async () => { await tick(10) })
  return view
}
import { Outlet } from 'react-router-dom'
const RoutesOutlet = () => <Outlet />
export const settle = (ms = 15) => act(async () => { await tick(ms) })
export const signInAs = async (view, email, pw) => {
  await act(async () => { live.nav('/login'); await tick(5) })
  fireEvent.change(view.getByLabelText('email'), { target: { value: email } }); fireEvent.change(view.getByLabelText('password'), { target: { value: pw } })
  await act(async () => { fireEvent.submit(view.getByText('Sign in').closest('form')); await tick(30) })
}
// a real click on a menu button: browsers fire mousedown before click, and the "outside press" logic listens to mousedown
export const press = (el) => { fireEvent.mouseDown(el); fireEvent.click(el) }
export { act, fireEvent, tick }
