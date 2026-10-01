import { useRef } from 'react'
import { useSearchParams } from 'react-router'
import { LayoutGrid, List, Plus, Search, SearchX, X } from 'lucide-react'
import { useStore } from '../../store'
import { fmt, freshness } from '../../lib/format'
import { statesOf } from '../../lib/locations'
import { applyFilters, SEARCH_PAGE_SIZE, searchFromParams, searchToParams, type Filters, type SearchState } from '../../lib/search'
import { paginate } from '../../lib/paginate'
import { useScrollTopOnChange } from '../../hooks/useScrollTopOnChange'
import { useOpenProfile } from '../../hooks/useOpenProfile'
import { Pagination } from '../../components/Pagination'
import type { Influencer } from '../../types'
import { Avatar, CategoryBadges, EmptyState, IgLink, PersonCell } from '../../components/ui'
import { FilterPanel } from './FilterPanel'
import './search.css'

type Props = { onShortlist: (id: number) => void }

const locationLine = (i: Influencer) => [...i.cities, ...i.states].join(', ')

/** Search state lives in the URL, so refresh, Back and shared links all restore the same results. */
export function SearchScreen({ onShortlist }: Props) {
  const { infs, loc } = useStore()
  const [params, setParams] = useSearchParams()
  const state = searchFromParams(params)
  const { filters, page, view } = state
  const onOpenProfile = useOpenProfile('Search Results')

  // Discrete changes (chips, pages) add a history entry so Back undoes them;
  // typing replaces the current entry so Back doesn't replay every keystroke.
  const update = (patch: Partial<SearchState>, replace = false) =>
    setParams(searchToParams({ ...state, ...patch }), { replace })
  const onFiltersChange = (f: Filters, replace = false) => update({ filters: f, page: 1 }, replace)
  const onPageChange = (p: number) => update({ page: p })
  const onViewChange = (v: SearchState['view']) => update({ view: v }, true)
  const results = paginate(applyFilters(infs, filters, loc), page, SEARCH_PAGE_SIZE)
  const scrollRef = useRef<HTMLDivElement>(null)
  useScrollTopOnChange(scrollRef, results.page)

  const shortlistBtn = (i: Influencer) => (
    <button type="button" className="btn btn-ghost btn-sm" style={{ gap: 3 }}
      onClick={e => { e.stopPropagation(); onShortlist(i.id) }}>
      <Plus size={11} />Shortlist
    </button>
  )

  return (
    <div className="screen">
      <FilterPanel filters={filters} onChange={onFiltersChange} />

      <div className="screen-col">
        <div className="results-head">
          <div className="search-box" style={{ flex: 1 }}>
            <Search size={13} />
            <input
              type="text"
              placeholder="Search name, bio, hashtag, handle..."
              aria-label="Search influencers"
              value={filters.q}
              onChange={e => onFiltersChange({ ...filters, q: e.target.value }, true)}
            />
            {filters.q && (
              <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => onFiltersChange({ ...filters, q: '' })}>
                <X size={13} />
              </button>
            )}
          </div>
          <div className="results-count">{results.total} influencer{results.total !== 1 ? 's' : ''}</div>
          <div className="view-toggle" role="group" aria-label="View">
            <button type="button" aria-label="Grid view" aria-pressed={view === 'grid'} className={view === 'grid' ? 'on' : ''} onClick={() => onViewChange('grid')}>
              <LayoutGrid size={14} />
            </button>
            <button type="button" aria-label="List view" aria-pressed={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => onViewChange('list')}>
              <List size={14} />
            </button>
          </div>
        </div>

        <div className="scroll" ref={scrollRef} style={{ padding: '14px 16px' }}>
          {results.total === 0 ? (
            <EmptyState icon={SearchX} title="No influencers match" sub="Try adjusting the filters" />
          ) : view === 'grid' ? (
            <div className="grid">
              {results.items.map(i => {
                const fr = freshness(i.updatedAt)
                return (
                  <div key={i.id} className="inf-card" onClick={() => onOpenProfile(i.id)}>
                    <div className="inf-card-top">
                      <Avatar inf={i} size={38} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="inf-card-name">{i.name}</div>
                          <span title={fr.label} className="dot" style={{ width: 7, height: 7, background: fr.dot }} />
                        </div>
                        <div className="inf-card-meta">
                          <IgLink handle={i.handle} /> · {locationLine(i)}
                        </div>
                        <div style={{ marginTop: 5 }}><CategoryBadges cats={i.cats} /></div>
                      </div>
                    </div>
                    <div className="inf-card-stats">
                      <div><div className="mono">{fmt(i.followers)}</div><div className="stat-label">Followers</div></div>
                      <div><div className="mono up">{i.eng.toFixed(1)}%</div><div className="stat-label">Eng. Rate</div></div>
                      <div><div className="mono">{fmt(i.likes)}</div><div className="stat-label">Avg Likes</div></div>
                    </div>
                    <div className="inf-card-foot">
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', minWidth: 0, overflow: 'hidden' }}>
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
                    <th>Influencer</th><th>Location</th><th>Category</th>
                    <th className="r">Followers</th><th className="r">Eng. Rate</th><th>Language</th><th />
                  </tr>
                </thead>
                <tbody>
                  {results.items.map(i => (
                    <tr key={i.id} className="clickable" onClick={() => onOpenProfile(i.id)}>
                      <td><PersonCell inf={i} /></td>
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
  )
}
