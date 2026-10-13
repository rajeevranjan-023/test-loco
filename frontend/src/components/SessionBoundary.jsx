import React from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function SessionBoundary({ children }) {
  const { epoch } = useAuth()
  return <React.Fragment key={epoch}>{children}</React.Fragment>
}
