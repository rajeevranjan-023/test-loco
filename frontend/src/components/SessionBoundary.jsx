import React from 'react'
import { useAuth } from '../context/AuthContext.jsx'

// Re-creates everything below it whenever the logged-in identity changes (login as someone else, logout, switched in another tab,
// session ended). Component state, fetched data and effects of the previous account are discarded — nothing is "kept and patched",
// so no private data can survive an account change. Router state (the URL / history) is NOT touched: Back/Forward still work.
export default function SessionBoundary({ children }) {
  const { epoch } = useAuth()
  return <React.Fragment key={epoch}>{children}</React.Fragment>
}
