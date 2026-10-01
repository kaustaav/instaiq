import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { MapPin } from 'lucide-react'
import { useStore } from '../store'
import { uniq } from '../lib/format'
import { locSearch, stateOf, type LocMatch } from '../lib/locations'

type Props = {
  cities: string[]
  states: string[]
  onChange: (cities: string[], states: string[]) => void
  onError: (msg: string) => void
}

/**
 * Drawer location input. On focus it opens a nested state → cities list; typing filters it
 * (a matching state keeps all its cities). Unknown cities can be added under a chosen state.
 */
export function LocationPicker({ cities, states, onChange, onError }: Props) {
  const { loc, addCity } = useStore()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [customState, setCustomState] = useState('')
  const blurTimer = useRef<number>(undefined)
  useEffect(() => () => clearTimeout(blurTimer.current), [])

  const q = query.trim().toLowerCase()
  const matches = locSearch(loc, query, cities, states)
  const rank = (n: string) => {
    const s = n.toLowerCase()
    return !q ? 0 : s.startsWith(q) ? 0 : s.includes(q) ? 1 : 9
  }

  const tree = loc
    .map(l => {
      const stateMatches = rank(l.state) < 9
      const shown = l.cities.filter(c => stateMatches || rank(c) < 9)
      if (!stateMatches && !shown.length) return null
      return { ...l, shown, r: Math.min(rank(l.state), ...shown.map(rank)) }
    })
    .filter(x => x !== null)
    .sort((a, b) => a.r - b.r)

  const exact = loc.some(l => l.state.toLowerCase() === q || l.cities.some(c => c.toLowerCase() === q))
  const typed = query.trim().replace(/\b\w/g, x => x.toUpperCase())
  const showCustom = q.length > 1 && !exact && matches.length < 3

  const pick = (m: Pick<LocMatch, 'type' | 'name'>) => {
    onError('')
    if (m.type === 'city') onChange(uniq([...cities, m.name]), states)
    else onChange(cities, uniq([...states, m.name]))
    setQuery('')
  }

  // mousedown + preventDefault keeps focus in the input so the list stays open
  const toggleLoc = (type: 'city' | 'state', name: string) => (e: MouseEvent) => {
    e.preventDefault()
    onError('')
    if (type === 'city') onChange(cities.includes(name) ? cities.filter(x => x !== name) : [...cities, name], states)
    else onChange(cities, states.includes(name) ? states.filter(x => x !== name) : [...states, name])
  }

  const addCustom = () => {
    if (!customState) return onError('Choose a state for ' + typed)
    const err = addCity(customState, typed)
    if (err) return onError(err)
    pick({ type: 'city', name: typed })
    setCustomState('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (matches[0]) pick(matches[0])
    } else if (e.key === 'Escape') {
      e.stopPropagation() // don't close the drawer
      setQuery('')
      setOpen(false)
      e.currentTarget.blur()
    }
  }

  const tags = [
    ...cities.map(c => {
      const st = stateOf(loc, c)
      return { key: 'c:' + c, name: c, sub: st && st !== c ? st : '', remove: () => onChange(cities.filter(x => x !== c), states) }
    }),
    ...states.map(st => ({ key: 's:' + st, name: st, sub: 'any city', remove: () => onChange(cities, states.filter(x => x !== st)) })),
  ]

  return (
    <>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tags.map(t => (
            <span key={t.key} className="form-loc-tag">
              {t.name}
              {t.sub && <span style={{ fontWeight: 400, color: 'var(--iq-fg-3)' }}>{t.sub}</span>}
              <button type="button" aria-label={`Remove ${t.name}`} title="Remove" onClick={t.remove}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <div className="search-box" style={{ background: 'white', padding: '0 10px' }}>
          <MapPin size={13} />
          <input
            type="text"
            value={query}
            autoComplete="off"
            placeholder="City or state"
            aria-label="Search a city or state"
            style={{ padding: '7px 0' }}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => { clearTimeout(blurTimer.current); setOpen(true) }}
            onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150) }}
          />
        </div>
        {(open || q.length > 0) && (
          <div className="loc-tree">
            {tree.map(g => {
              const statePicked = states.includes(g.state)
              const nPicked = g.cities.filter(c => cities.includes(c)).length
              return (
                <div key={g.state}>
                  <div className="loc-tree-state" style={{ background: statePicked ? 'var(--iq-brand-50)' : 'var(--iq-gray-25)' }}
                    onMouseDown={toggleLoc('state', g.state)}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{g.state}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: statePicked || nPicked ? 'var(--iq-brand-500)' : 'var(--iq-fg-3)' }}>
                      {statePicked ? '✓ Whole state' : nPicked ? `${nPicked} selected` : 'Select whole state'}
                    </span>
                  </div>
                  {g.shown.map(c => {
                    const picked = cities.includes(c)
                    return (
                      <div key={c} className="loc-tree-city" style={{ background: picked ? 'var(--iq-brand-50)' : 'white' }}
                        onMouseDown={toggleLoc('city', c)}>
                        <span style={{ fontSize: 13, color: picked ? 'var(--iq-brand-500)' : 'var(--iq-fg-1)' }}>{c}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--iq-brand-500)' }}>{picked ? '✓' : ''}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {!tree.length && <div className="loc-none" style={{ padding: '8px 12px' }}>No matching city or state</div>}
            {showCustom && (
              // the list stays visible while there's a query, so focusing the select is safe
              <div className="loc-custom">
                <div style={{ fontSize: 12, color: 'var(--iq-fg-2)' }}>Can't find "{typed}"? Add it under a state:</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select className="input input-sm" value={customState} aria-label="State for new city"
                    onChange={e => setCustomState(e.target.value)}>
                    <option value="">Choose state…</option>
                    {loc.map(l => <option key={l.state} value={l.state}>{l.state}</option>)}
                  </select>
                  <button type="button" className="btn btn-ghost" style={{ fontWeight: 400 }} onClick={addCustom}>
                    Add city
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
