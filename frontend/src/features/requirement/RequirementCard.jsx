import React from 'react'
import Badge from '../../components/Badge.jsx'

function RequirementCard({ requirement, actions }) {
  const posted = new Date(requirement.createdAt).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="requirement-card card">
      {requirement.imageUrl && (
        <img src={requirement.imageUrl} alt="" className="requirement-card-image" />
      )}
      <div className="requirement-card-body">
        <div className="requirement-card-top">
          <Badge tone="neutral">{requirement.category}</Badge>
          {requirement.status === 'closed'
            ? <Badge tone="neutral">Closed</Badge>
            : requirement.respondedByMe
              ? <Badge tone="success">You responded</Badge>
              : <Badge tone="deal">New</Badge>}
        </div>
        <h3>{requirement.title}</h3>
        <p className="requirement-card-desc">{requirement.description}</p>
        <div className="requirement-card-meta">
          <span>📞 {requirement.phone}</span>
          <span>✉️ {requirement.email}</span>
          <span>🗓️ {posted}</span>
        </div>
        {actions && <div className="requirement-card-actions">{actions}</div>}
      </div>
    </div>
  )
}

export default RequirementCard
