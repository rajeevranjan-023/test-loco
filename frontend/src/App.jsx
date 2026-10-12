import React from 'react'
import { Routes, Route } from 'react-router-dom'
import SiteChrome from './components/SiteChrome.jsx'
import ProfileFrame from './components/ProfileFrame.jsx'
import Home from './pages/Home.jsx'
import './css/Pages.css'
import AuthPage from './features/auth/AuthPage.jsx'
import GoogleCallback from './features/auth/GoogleCallback.jsx'
import Register from './features/auth/Register.jsx'
import Welcome from './features/auth/Welcome.jsx'
import { ForgotPassword, ResetPassword } from './features/auth/PasswordReset.jsx'
import SearchResultsPage from './pages/SearchResultsPage.jsx'
import StartYours from './features/seller/StartYours.jsx'
import { Module } from './features/modules.jsx'
import UnifiedProfilePage from './features/profile/UnifiedProfilePage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import SessionBoundary from './components/SessionBoundary.jsx'
import { RouteErrorBoundary } from './components/ErrorBoundary.jsx'
import ConnectionBanner from './components/ConnectionBanner.jsx'
import PersonalActivityPage from './features/activity/PersonalActivityPage.jsx'
import { UsernameShell, RedirectToProfile } from './components/UsernameRoute.jsx'
import LegacyOwnerRedirect from './components/LegacyOwnerRedirect.jsx'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import FAQ from './pages/FAQ.jsx'
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import Requirements from './pages/Requirements.jsx'
import Settings from './pages/Settings.jsx'

function App() {
  return (
    <div className="app-wrapper">
      <ConnectionBanner />
      <SessionBoundary>
      <RouteErrorBoundary>
      <Routes>
        {/* Authentication & onboarding: full-page experience with its own header (no site Navbar/Footer) */}
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/auth/callback" element={<GoogleCallback />} />
        <Route path="/register" element={<Register />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Public site pages — Navbar + Footer frame */}
        <Route element={<SiteChrome />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/requirements" element={<Requirements />} />
          <Route path="/settings" element={<Settings />} />
          {/* Personal activity / analytics for accounts without a business (business owners keep their merchant analytics) */}
          <Route path="/activity" element={<ProtectedRoute><PersonalActivityPage /></ProtectedRoute>} />
          {/* Legacy global dashboard URLs: never rendered, only forwarded to /@username/… (or /login). */}
          <Route path="/analytics/*" element={<LegacyOwnerRedirect />} />
          <Route path="/customer/*" element={<LegacyOwnerRedirect />} />
          <Route path="/bill/*" element={<LegacyOwnerRedirect />} />
          <Route path="/order/*" element={<LegacyOwnerRedirect />} />
          <Route path="/start-yours" element={<ProtectedRoute><StartYours /></ProtectedRoute>} />
        </Route>

        {/* Instagram-style identity routes (/@username/…). Static routes above always win over :username.
            ONE parent layout (ProfileFrame) owns the header + tabs for the profile AND every owner page, so nothing remounts
            or shifts when the tab changes. Viewers only ever get the public profile (index); anything else redirects back to it. */}
        <Route path="/:username" element={<UsernameShell />}>
          <Route element={<ProfileFrame />}>
            <Route index element={<UnifiedProfilePage />} />
            {/* Every owner section is rendered by the module the business schema assigns to it (features/modules.jsx). */}
            <Route path="dashboard" element={<Module name="dashboard" />} />
            <Route path="billing" element={<Module name="billing" />} />
            <Route path="udhar" element={<Module name="udhar" />} />
            <Route path="dues" element={<Module name="dues" />} />
            <Route path="analytics" element={<Module name="analytics" />} />
            <Route path="inventory" element={<Module name="inventory" />} />
            <Route path="customer" element={<Module name="customer" />} />
            <Route path="customer/:id" element={<Module name="customer" detail />} />
            <Route path="members" element={<Module name="members" />} />
            <Route path="members/:id" element={<Module name="members" detail />} />
            <Route path="courses" element={<Module name="courses" />} />
            <Route path="seats" element={<Module name="seats" />} />
            <Route path="add" element={<Module name="add" />} />
            <Route path="bill/:id" element={<Module name="bill" detail />} />
            <Route path="order/:id" element={<Module name="order" detail />} />
            {/* secondary pages from the account menu */}
            <Route path="products" element={<Module name="products" />} />
            <Route path="offers" element={<Module name="offers" />} />
            <Route path="messages" element={<Module name="messages" />} />
            <Route path="shop" element={<Module name="shop" />} />
            <Route path="settings" element={<Module name="settings" />} />
            <Route path="*" element={<RedirectToProfile />} />
          </Route>
        </Route>
      </Routes>
      </RouteErrorBoundary>
      </SessionBoundary>
    </div>
  )
}

export default App
