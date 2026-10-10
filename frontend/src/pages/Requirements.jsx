import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useApiData } from '../hooks/useApiData.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useFeedback } from '../hooks/useFeedback.js'
import { useTitle } from '../hooks/title.js'
import RequirementCard from '../features/requirement/RequirementCard.jsx'
import PostRequirementModal from '../features/requirement/PostRequirementModal.jsx'
import { ShimmerList } from '../components/loading/ShimmerLayouts.jsx'
import FeedbackBanner from '../components/FeedbackBanner.jsx'
import Spinner from '../components/loading/Spinner.jsx'
import '../css/Requirement.css'

function Requirements() {
  useTitle('Messages & Requests')
  const { user, isAuthenticated, isSeller } = useAuth()
  const [statusFilter, setStatusFilter] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [busyId, setBusyId] = useState(null)
  const [showPostModal, setShowPostModal] = useState(false)
  const { feedback, showSuccess, showError } = useFeedback()

  const endpoint = isSeller ? '/api/requirements/inbox' : '/api/requirements/mine'
  const query = isSeller && statusFilter !== 'all' ? `?status=${statusFilter}` : ''

  const { data, loading } = useApiData(
    () => api.get(`${endpoint}${query}`, { requiresAuth: true }),
    [refreshKey, statusFilter, isSeller]
  )

  const requirements = isSeller ? data?.requirements : data

  const respond = async (id) => {
    setBusyId(id)
    try {
      await api.patch(`/api/requirements/${id}/respond`, {}, { requiresAuth: true })
      showSuccess('Marked as responded — the buyer can see your contact details.')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const closeRequirement = async (id) => {
    setBusyId(id)
    try {
      await api.patch(`/api/requirements/${id}/close`, {}, { requiresAuth: true })
      showSuccess('Requirement closed.')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <section className="section">
        <div className="container detail-not-found">
          <h2>Log in to view your messages</h2>
          <p>Requirements you post — or receive as a seller — show up here.</p>
          <Link to="/login?next=%2Frequirements" className="btn btn-primary">Log In</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="container">
        <div className="requirement-page-header">
          <div>
            <h2>{isSeller ? '📥 Requirement Inbox' : '📨 My Requirements'}</h2>
            <p className="requirement-page-sub">
              {isSeller
                ? `Buyer requirements matching your category${data?.category ? ` (${data.category})` : ''}.`
                : 'Requirements you\'ve posted, and their status.'}
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setShowPostModal(true)}>
            + Post Requirement
          </button>
        </div>

        {isSeller && (
          <div className="requirement-filter-row">
            {['all', 'open', 'closed'].map((f) => (
              <button
                key={f}
                type="button"
                className={`faq-category-tab ${statusFilter === f ? 'active' : ''}`}
                onClick={() => setStatusFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Closed'}
              </button>
            ))}
          </div>
        )}

        <FeedbackBanner feedback={feedback} />

        {loading ? (
          <ShimmerList count={3} />
        ) : !requirements || requirements.length === 0 ? (
          <p className="detail-empty">
            {isSeller ? 'No requirements in your category yet.' : "You haven't posted any requirements yet."}
          </p>
        ) : (
          <div className="requirement-list">
            {requirements.map((r) => (
              <RequirementCard
                key={r._id}
                requirement={r}
                actions={
                  busyId === r._id ? (
                    <Spinner size="sm" />
                  ) : isSeller ? (
                    r.respondedByMe ? (
                      <span className="requirement-responded-note">You've already responded — contact them directly.</span>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => respond(r._id)}>Mark as Responded</button>
                    )
                  ) : (
                    r.status === 'open' && (
                      <button className="btn btn-outline btn-sm" onClick={() => closeRequirement(r._id)}>Close Requirement</button>
                    )
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      <PostRequirementModal
        open={showPostModal}
        onClose={() => setShowPostModal(false)}
        onPosted={() => setRefreshKey((k) => k + 1)}
      />
    </section>
  )
}

export default Requirements
