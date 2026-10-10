import React, { useState, useRef, useEffect } from 'react'

/**
 * A text input that filters a list of options as you type, with a
 * click-to-select dropdown. `options` is [{ value, label, meta }].
 */
function SearchableSelect({ options, value, onChange, placeholder = 'Search…' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="searchable-select" ref={wrapperRef}>
      <input
        type="text"
        value={open ? query : selected?.label || ''}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div className="searchable-select-dropdown">
          {filtered.length === 0 ? (
            <p className="searchable-select-empty">No matches.</p>
          ) : (
            filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                className="searchable-select-option"
                onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
              >
                {o.label}
                {o.meta && <span className="searchable-select-meta">{o.meta}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
