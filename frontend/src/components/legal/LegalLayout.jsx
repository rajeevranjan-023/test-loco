import React from 'react'
import '../../css/Legal.css'

function LegalLayout({ lastUpdated, sections }) {
  const renderPiece = (piece, key) => {
    if (typeof piece === 'string') {
      return <p key={key}>{piece}</p>
    }
    if (piece?.type === 'list') {
      return (
        <ul className="legal-list" key={key}>
          {piece.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )
    }
    return null
  }

  const renderBody = (body) => {
    if (Array.isArray(body)) {
      return body.map((piece, i) => renderPiece(piece, i))
    }
    return renderPiece(body, 'single')
  }

  return (
    <div className="container legal-layout">
      <aside className="legal-toc">
        <p className="legal-toc-label">On this page</p>
        <ul>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ul>
      </aside>

      <div className="legal-content">
        {lastUpdated && <p className="legal-updated">Last updated: {lastUpdated}</p>}
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="legal-section">
            <h2>{section.title}</h2>
            {renderBody(section.body)}
          </section>
        ))}
      </div>
    </div>
  )
}

export default LegalLayout
