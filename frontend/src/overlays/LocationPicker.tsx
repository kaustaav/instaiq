import { useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { MapPin } from 'lucide-react'
import { useStore } from '../store'
import { apiEnabled } from '../api/client'
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
 * Keyboard (same as the search filter): ↑↓ Home End move, Enter toggles, Esc closes (again: clears the text),
 * Backspace on an empty input removes the last pick. Leaving the picker closes the list but keeps the text.
 */
export function LocationPicker({ cities, states, onChange, onError }: Props) {
  const { loc, addCity } = useStore()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0) // highlighted row (keyboard)
  const [customState, setCustomState] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

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
  // the rows in screen order (state, its cities, next state…), for arrow keys
  const rows: Pick<LocMatch, 'type' | 'name'>[] = tree.flatMap(g => [
    { type: 'state' as const, name: g.state },
    ...g.shown.map(c => ({ type: 'city' as const, name: c })),
  ])
  const idx = Math.min(active, Math.max(0, rows.length - 1))
  const rowIndex = (type: 'city' | 'state', name: string) => rows.findIndex(r => r.type === type && r.name === name)

  const exact = loc.some(l => l.state.toLowerCase() === q || l.cities.some(c => c.toLowerCase() === q))
  const typed = query.trim().replace(/\b\w/g, x => x.toUpperCase())
  // adding cities isn't in the API yet (the city list is reference data)
  const showCustom = q.length > 1 && !exact && matches.length < 3 && !apiEnabled()

  const pick = (m: Pick<LocMatch, 'type' | 'name'>) => {
    onError('')
    if (m.type === 'city') onChange(uniq([...cities, m.name]), states)
    else onChange(cities, uniq([...states, m.name]))
    setQuery('')
  }

  const toggle = (type: 'city' | 'state', name: string) => {
    onError('')
    if (type === 'city') onChange(cities.includes(name) ? cities.filter(x => x !== name) : [...cities, name], states)
    else onChange(cities, states.includes(name) ? states.filter(x => x !== name) : [...states, name])
  }
  // mousedown + preventDefault keeps focus in the input so the list stays open
  const toggleLoc = (type: 'city' | 'state', name: string) => (e: MouseEvent) => {
    e.preventDefault()
    toggle(type, name)
  }

  const moveTo = (i: number) => {
    setActive(i)
    requestAnimationFrame(() => document.getElementById('locpick-' + i)?.scrollIntoView({ block: 'nearest' }))
  }

  // focus left the whole picker (input, list and the "add city" controls): close, keep the text
  const onBlur = (e: FocusEvent) => {
    if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
  }

  const addCustom = () => {
    if (!customState) return onError('Choose a state for ' + typed)
    const err = addCity(customState, typed)
    if (err) return onError(err)
    pick({ type: 'city', name: typed })
    setCustomState('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = rows.length
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
      e.preventDefault()
      setOpen(true)
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
        if (open && n) { e.preventDefault(); moveTo(0) }
        break
      case 'End':
        if (open && n) { e.preventDefault(); moveTo(n - 1) }
        break
      case 'Enter':
        e.preventDefault()
        if (!open) setOpen(true)
        else if (rows[idx]) {
          toggle(rows[idx].type, rows[idx].name)
          if (query) { setQuery(''); setActive(0) } // ready for the next one
        }
        break
      case 'Escape':
        // first Esc closes the list, second clears the text; only then does Esc reach the drawer (and close it)
        if (open) { e.stopPropagation(); setOpen(false) }
        else if (query) { e.stopPropagation(); setQuery(''); setActive(0) }
        break
      case 'Backspace':
        if (!query && (cities.length || states.length)) {
          e.preventDefault()
          // tags show cities first, then states: remove the last one shown
          if (states.length) onChange(cities, states.slice(0, -1))
          else onChange(cities.slice(0, -1), states)
        }
        break
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
      <div ref={rootRef} style={{ position: 'relative' }} onBlur={onBlur}>
        <div className="search-box" style={{ background: 'white', padding: '0 10px' }}>
          <MapPin size={13} />
          <input
            type="text"
            value={query}
            autoComplete="off"
            placeholder="City or state"
            aria-label="Search a city or state"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="locpick-list"
            aria-expanded={open}
            aria-activedescendant={open && rows.length ? 'locpick-' + idx : undefined}
            style={{ padding: '7px 0' }}
            onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true) }}
            onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)}
          />
        </div>
        {open && (
          <div className="loc-tree" id="locpick-list" role="listbox" aria-label="Cities and states" aria-multiselectable="true">
            {tree.map(g => {
              const statePicked = states.includes(g.state)
              const nPicked = g.cities.filter(c => cities.includes(c)).length
              const si = rowIndex('state', g.state)
              return (
                <div key={g.state} role="group" aria-label={g.state}>
                  <div id={'locpick-' + si} role="option" aria-selected={statePicked}
                    className={'loc-tree-state' + (si === idx ? ' active' : '')}
                    style={{ background: statePicked ? 'var(--iq-brand-50)' : 'var(--iq-gray-25)' }}
                    onMouseEnter={() => setActive(si)} onMouseDown={toggleLoc('state', g.state)}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{g.state}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: statePicked || nPicked ? 'var(--iq-brand-500)' : 'var(--iq-fg-3)' }}>
                      {statePicked ? '✓ Whole state' : nPicked ? `${nPicked} selected` : 'Select whole state'}
                    </span>
                  </div>
                  {g.shown.map(c => {
                    const picked = cities.includes(c)
                    const ci = rowIndex('city', c)
                    return (
                      <div key={c} id={'locpick-' + ci} role="option" aria-selected={picked}
                        className={'loc-tree-city' + (ci === idx ? ' active' : '')}
                        style={{ background: picked ? 'var(--iq-brand-50)' : 'white' }}
                        onMouseEnter={() => setActive(ci)} onMouseDown={toggleLoc('city', c)}>
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
              // focus moving here stays inside the picker, so the list stays open
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
