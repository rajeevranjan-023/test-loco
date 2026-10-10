import React from 'react'
import { Link } from 'react-router-dom'
import Modal from '../../components/common/Modal.jsx'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import { ShimmerList } from '../../components/loading/ShimmerLayouts.jsx'
import { profilePath } from '../../utils/username.js'

// mode: 'followers' (needs targetType+targetId) | 'following' (needs userId)
function FollowListModal({ open, onClose, mode, targetType, targetId, userId, title }) {
  const { data, loading } = useApiData(() => {
    if (!open) return Promise.resolve([])
    return mode === 'followers'
      ? api.get(`/api/follow/followers?targetType=${targetType}&targetId=${targetId}`)
      : api.get(`/api/follow/following/${userId}`)
  }, [open, mode, targetType, targetId, userId])

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {loading ? (
        <ShimmerList count={4} />
      ) : !data || data.length === 0 ? (
        <p className="detail-empty">{mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p>
      ) : (
        <div className="follow-list">
          {data.map((entry) => {
            const isFollowEntry = mode === 'following'
            const href = entry.username ? profilePath(entry.username) : null
            const avatar = isFollowEntry ? entry.imageUrl : entry.avatarUrl
            const name = entry.name

            const row = (
              <div className="follow-list-row" key={entry.id}>
                <span className="follow-list-avatar">
                  {avatar ? <img src={avatar} alt="" /> : (name || '?').charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="follow-list-name">{name}</p>
                  {entry.username && <p className="follow-list-username">{entry.username}</p>}
                </div>
              </div>
            )

            return href ? <Link to={href} key={entry.id} onClick={onClose} className="follow-list-link">{row}</Link> : row
          })}
        </div>
      )}
    </Modal>
  )
}

export default FollowListModal
