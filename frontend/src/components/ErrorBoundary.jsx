import React from 'react'
import { useLocation } from 'react-router-dom'

// React Error Boundary: a component that CRASHES WHILE RENDERING (or in a lifecycle method) shows a friendly page instead of a white
// screen. It does NOT catch errors in event handlers, timers or promises — those are handled where they happen (try/catch around the
// API call → ApiError with a safe message, see services/apiError.js) — nor errors in the boundary itself.
//
// The fallback never prints the exception: the details go to the browser console only. It uses plain <a>/<button> (no router or context)
// so the outermost boundary still works when a provider is what crashed.
export function ErrorFallback({ onRetry, compact = false }) {
  return (
    <section className="section" role="alert">
      <div className="container detail-not-found" style={compact ? { padding: '40px 0' } : undefined}>
        <h2>Something went wrong</h2>
        <p>This part of the page couldn't be displayed. Your data is safe. You can try again, or head back to the home page.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button>}
          <a href="/" className="btn btn-outline">Back to Home</a>
          <button type="button" className="btn btn-outline" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    </section>
  )
}

export class ErrorBoundary extends React.Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error, info) {
    console.error('[ui] a component crashed while rendering:', error, info?.componentStack) // console only — never rendered
  }
  componentDidUpdate(prev) {
    // Navigating somewhere else (resetKey changes) gives the new page a clean slate.
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }
  reset = () => this.setState({ failed: false })
  render() {
    return this.state.failed ? <ErrorFallback onRetry={this.reset} compact={this.props.compact} /> : this.props.children
  }
}

// Section-level boundary for pages rendered inside a layout: the header / footer / menus stay usable and only the page is replaced.
export function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname} compact>{children}</ErrorBoundary>
}

export default ErrorBoundary
