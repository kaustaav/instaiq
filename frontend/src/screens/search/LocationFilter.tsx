import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { MapPin } from 'lucide-react'
import { useStore } from '../../store'
import { locSearch, type LocMatch } from '../../lib/locations'
import type { LocPick } from '../../types'

type Props = { value: LocPick[]; onChange: (v: LocPick[]) => void }

/** Keyboard-accessible combobox: ↑↓ Home End Enter Esc, Backspace removes the last tag. */
export function LocationFilter({ value, onChange }: Props) {
  const { loc } = useStore()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const blurTimer = useRef<number>(undefined)

  useEffect(() => () => clearTimeout(blurTimer.current), [])

  const matches = locSearch(
    loc,
    query,
    value.filter(l => l.type === 'city').map(l => l.name),
    value.filter(l => l.type === 'state').map(l => l.name),
  )
  const open = focused && query.trim().length > 0
  const idx = Math.min(active, Math.max(0, matches.length - 1))

  const pick = (m: LocMatch) => {
    if (!value.some(l => l.type === m.type && l.name === m.name)) onChange([...value, { type: m.type, name: m.name }])
    setQuery('')
    setActive(0)
  }

  const moveTo = (i: number) => {
    setActive(i)
    requestAnimationFrame(() => {
      const el = document.getElementById('locopt-' + i)
      const p = listRef.current
      if (!el || !p) return
      if (el.offsetTop < p.scrollTop) p.scrollTop = el.offsetTop
      else if (el.offsetTop + el.offsetHeight > p.scrollTop + p.clientHeight)
        p.scrollTop = el.offsetTop + el.offsetHeight - p.clientHeight
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = matches.length
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !focused) {
      e.preventDefault()
      setFocused(true)
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (n) moveTo((idx + 1) % n)
        break
      case 'ArrowUp':
        e.preventDefault()
        if (n) moveTo((idx - 1 + n) % n)
        break
      case 'Home':
        if (n && query) { e.preventDefault(); moveTo(0) }
        break
      case 'End':
        if (n && query) { e.preventDefault(); moveTo(n - 1) }
        break
      case 'Enter':
        e.preventDefault()
        if (open && matches[idx]) pick(matches[idx])
        else setFocused(true)
        break
      case 'Escape':
        e.preventDefault()
        // first Esc closes the list, second clears the text
        if (open) setFocused(false)
        else { setQuery(''); setActive(0) }
        break
      case 'Backspace':
        if (!query && value.length) onChange(value.slice(0, -1))
        break
    }
  }

  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>Location</div>
      <div style={{ position: 'relative' }}>
        <div className="search-box" style={{ padding: '0 8px', gap: 6 }}>
          <MapPin size={12} />
          <input
            type="text"
            value={query}
            placeholder="City or state"
            role="combobox"
            aria-label="Filter by city or state"
            aria-autocomplete="list"
            aria-controls="loc-listbox"
            aria-expanded={open}
            aria-activedescendant={open && matches.length ? 'locopt-' + idx : undefined}
            style={{ padding: '6px 0', fontSize: 12 }}
            onChange={e => { setQuery(e.target.value); setActive(0); setFocused(true) }}
            onKeyDown={onKeyDown}
            onFocus={() => { clearTimeout(blurTimer.current); setFocused(true) }}
            onBlur={() => { blurTimer.current = window.setTimeout(() => setFocused(false), 120) }}
          />
        </div>
        {open && (
          <div id="loc-listbox" role="listbox" aria-label="Locations" ref={listRef} className="loc-list">
            {matches.map((m, k) => (
              <div
                key={m.type + m.name}
                id={'locopt-' + k}
                role="option"
                aria-selected={k === idx}
                className="loc-opt"
                style={{ background: k === idx ? 'var(--cs-ink-100)' : 'white' }}
                onMouseDown={e => { e.preventDefault(); pick(m) }}
                onMouseEnter={() => k !== active && setActive(k)}
              >
                <span style={{ fontWeight: m.type === 'state' ? 600 : 400 }}>{m.name}</span>
                <span className="loc-opt-sub">{m.sub}</span>
              </div>
            ))}
            {!matches.length && <div className="loc-none">No matching city or state</div>}
          </div>
        )}
      </div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {value.map(l => (
            <span key={l.type + l.name} className="loc-tag">
              {l.type === 'state' ? `${l.name} (state)` : l.name}
              <button
                type="button"
                aria-label={`Remove ${l.name} filter`}
                title="Remove"
                onClick={() => onChange(value.filter(x => !(x.type === l.type && x.name === l.name)))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
