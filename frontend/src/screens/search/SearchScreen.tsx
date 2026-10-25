import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { BookmarkPlus, LayoutGrid, List, Plus, Search, SearchX, SlidersHorizontal, WifiOff, X } from 'lucide-react'
import { useStore } from '../../store'
import { fmt, freshness } from '../../lib/format'
import { statesOf } from '../../lib/locations'
import { activeFilterCount, searchFromParams, searchToParams, type Filters, type SearchState } from '../../lib/search'
import { useSearchResults } from '../../hooks/useSearchResults'
import { useScrollTopOnChange } from '../../hooks/useScrollTopOnChange'
import { useScrolled } from '../../hooks/useScrolled'
import { useOpenProfile } from '../../hooks/useOpenProfile'
import { Pagination } from '../../components/Pagination'
import type { Influencer } from '../../types'
import { Avatar, CategoryBadges, EmptyState, IgLink, PersonCell, Segmented } from '../../components/ui'
import { FilterPanel } from './FilterPanel'
import './search.css'

type Props = {
  onShortlist: (id: number) => void
  /** "Add all to campaign": every result matching the filters, not just this page. */
  onAddMany: (ids: number[]) => void
}

const locationLine = (i: Influencer) => [...i.cities, ...i.states].join(', ')

/** Search state lives in the URL, so refresh, Back and shared links all restore the same results. */
export function SearchScreen({ onShortlist, onAddMany }: Props) {
  const { loc } = useStore()
  const [params, setParams] = useSearchParams()
  const state = searchFromParams(params)
  const { filters, page, view } = state
  const onOpenProfile = useOpenProfile('Search Results')
  const [filtersOpen, setFiltersOpen] = useState(false) // phones only
  const nFilters = activeFilterCount(filters)

  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFiltersOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersOpen])

  // Discrete changes (chips, pages) add a history entry so Back undoes them;
  // typing replaces the current entry so Back doesn't replay every keystroke.
  const update = (patch: Partial<SearchState>, replace = false) =>
    setParams(searchToParams({ ...state, ...patch }), { replace })
  const onFiltersChange = (f: Filters, replace = false) => update({ filters: f, page: 1 }, replace)
  const onPageChange = (p: number) => update({ page: p })
  const onViewChange = (v: SearchState['view']) => update({ view: v }, true)
  // built-in demo data, or the API when VITE_API_URL is set
  const { results, loading, error, retry, allIds } = useSearchResults(filters, page)
  const scrollRef = useRef<HTMLDivElement>(null)
  useScrollTopOnChange(scrollRef, results.page)
  const scrolled = useScrolled(scrollRef)

  const shortlistBtn = (i: Influencer) => (
    <button type="button" className="btn btn-tint btn-sm" aria-label={`Shortlist ${i.name}`}
      onClick={e => { e.stopPropagation(); onShortlist(i.id) }}>
      <Plus size={12} strokeWidth={2.5} />Shortlist
    </button>
  )

  return (
    <div className="screen">
      <FilterPanel filters={filters} onChange={onFiltersChange} resultCount={results.total}
        mobileOpen={filtersOpen} onMobileClose={() => setFiltersOpen(false)} />

      <div className="screen-col">
        <div className="scroll" ref={scrollRef}>
        {/* frosted toolbar: results scroll underneath it */}
        <div className={scrolled ? 'results-head scrolled' : 'results-head'}>
          <div className="search-box search-box-lg" style={{ flex: 1 }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Search name, bio, hashtag, handle..."
              aria-label="Search influencers"
              value={filters.q}
              onChange={e => onFiltersChange({ ...filters, q: e.target.value }, true)}
            />
            {filters.q && (
              <button type="button" className="icon-btn search-clear" aria-label="Clear search" onClick={() => onFiltersChange({ ...filters, q: '' })}>
                <X size={11} strokeWidth={3} />
              </button>
            )}
          </div>
          <button type="button" className="btn btn-ghost filters-btn" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={14} />Filters
            {nFilters > 0 && <span className="filters-badge">{nFilters}</span>}
          </button>
          {results.total > 0 && (
            <button type="button" className="btn btn-ghost" title="Add every influencer matching these filters to a campaign"
              onClick={() => { allIds().then(onAddMany).catch(() => {}) }}>
              <BookmarkPlus size={14} />Add all to campaign
            </button>
          )}
          <Segmented label="View" value={view} onChange={onViewChange}
            options={[
              { value: 'grid', title: 'Grid view', label: <LayoutGrid size={14} aria-label="Grid view" /> },
              { value: 'list', title: 'List view', label: <List size={14} aria-label="List view" /> },
            ]} />
        </div>

        <div className="results-body" style={{ opacity: loading && results.total ? 0.6 : 1 }}>
          <div className="results-title">
            <h2>Influencers</h2>
            <span className="results-count" aria-live="polite">
              {loading ? 'Searching…' : `${results.total.toLocaleString('en-IN')} result${results.total !== 1 ? 's' : ''}`}
            </span>
          </div>
          {error ? (
            <div className="empty">
              <WifiOff size={32} />
              <div className="empty-title">Couldn’t load influencers</div>
              <div className="empty-sub">{error}</div>
              <button type="button" className="btn btn-ghost" style={{ marginTop: 12 }} onClick={retry}>Try again</button>
            </div>
          ) : results.total === 0 && loading ? (
            <div className="empty"><div className="empty-sub">Searching…</div></div>
          ) : results.total === 0 ? (
            <EmptyState icon={SearchX} title="No influencers match" sub="Try adjusting the filters" />
          ) : view === 'grid' ? (
            <div className="grid">
              {results.items.map(i => {
                const fr = freshness(i.updatedAt)
                return (
                  <div key={i.id} className="inf-card" onClick={() => onOpenProfile(i.id)}>
                    <div className="inf-card-top">
                      <Avatar inf={i} size={44} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="inf-card-name">{i.name}</div>
                          <span title={fr.label} className="dot" style={{ width: 7, height: 7, background: fr.dot }} />
                        </div>
                        <div className="inf-card-meta">
                          <IgLink handle={i.handle} /> · {locationLine(i)}
                        </div>
                        <div style={{ marginTop: 7 }}><CategoryBadges cats={i.cats} /></div>
                      </div>
                    </div>
                    <div className="inf-card-stats">
                      <div><div className="mono">{fmt(i.followers)}</div><div className="stat-label">Followers</div></div>
                      <div><div className="mono up">{i.eng.toFixed(1)}%</div><div className="stat-label">Eng. Rate</div></div>
                      <div><div className="mono">{fmt(i.likes)}</div><div className="stat-label">Avg Likes</div></div>
                    </div>
                    <div className="inf-card-foot">
                      <div className="inf-card-tags">
                        {i.tags.slice(0, 2).map(t => <span key={t} className="hashtag">{t}</span>)}
                      </div>
                      {shortlistBtn(i)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="pin">Influencer</th><th>Location</th><th>Category</th>
                    <th className="r">Followers</th><th className="r">Eng. Rate</th><th>Language</th><th />
                  </tr>
                </thead>
                <tbody>
                  {results.items.map(i => (
                    <tr key={i.id} className="clickable" onClick={() => onOpenProfile(i.id)}>
                      <td className="pin"><PersonCell inf={i} /></td>
                      <td>
                        <div className="sub">{locationLine(i)}</div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{statesOf(loc, i).join(', ')}</div>
                      </td>
                      <td><CategoryBadges cats={i.cats} /></td>
                      <td className="num">{fmt(i.followers)}</td>
                      <td className="num up">{i.eng.toFixed(1)}%</td>
                      <td className="sub">{i.langs.join(', ')}</td>
                      <td className="r">{shortlistBtn(i)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={results} onPage={onPageChange} />
        </div>
        </div>
      </div>
    </div>
  )
}
