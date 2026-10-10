import React, { useEffect, useRef, useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useRequireAuth } from '../../hooks/useRequireAuth.js'
import { takePendingAction } from '../../utils/redirect.js'
import Spinner from '../../components/loading/Spinner.jsx'

function FollowButton({ targetType, targetId, initialFollowing, onChange }) {
  const { isAuthenticated } = useAuth()
  const requireAuth = useRequireAuth()
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)
  const resumed = useRef(false)

  const doFollow = async () => {
    setBusy(true)
    try {
      const result = await api.post('/api/follow', { targetType, targetId }, { requiresAuth: true })
      setFollowing(result.following)
      onChange?.(result)
    } catch (err) {
      // Silently ignore — the button just stays in its current state.
    } finally {
      setBusy(false)
    }
  }

  // Came back from login/signup after pressing Follow while logged out → finish that follow once.
  useEffect(() => {
    if (!isAuthenticated || resumed.current) return
    resumed.current = true
    const pending = takePendingAction({ type: 'follow', targetType, targetId })
    if (pending && !initialFollowing) doFollow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const handleClick = () => {
    if (!requireAuth({ action: { type: 'follow', targetType, targetId } })) return
    doFollow()
  }

  return (
    <button
      type="button"
      className={`btn btn-sm follow-btn ${following ? 'follow-btn-following' : 'btn-primary'}`}
      onClick={handleClick}
      disabled={busy}
    >
      {busy ? <Spinner size="sm" /> : following ? 'Following' : 'Follow'}
    </button>
  )
}

export default FollowButton
