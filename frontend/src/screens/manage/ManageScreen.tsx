import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Archive, Pencil, Search, Tags, Trash2, Upload, UserPlus } from 'lucide-react'
import { useStore } from '../../store'
import { OptionsDrawer } from '../../overlays/OptionsDrawer'
import { apiEnabled, ApiError } from '../../api/client'
import { changeStatus } from '../../api/influencers'
import { useApiSearchPage, useTierCounts } from '../../hooks/useApiSearchPage'
import { fmt, freshness, mon, type FreshTier } from '../../lib/format'
import { statesOf } from '../../lib/locations'
import type { Influencer } from '../../types'
import { CategoryBadges, FreshPill, PersonCell, Soon } from '../../components/ui'
import { Pagination } from '../../components/Pagination'
import { paginate } from '../../lib/paginate'
import { useScrollTopOnChange } from '../../hooks/useScrollTopOnChange'
import { useOpenProfile } from '../../hooks/useOpenProfile'

const PAGE_SIZE = 50

type Props = {
  onAdd: () => void
  onEdit: (inf: Influencer) => void
}

type TierFilter = 'all' | FreshTier

const TIER_CHIPS: { key: TierFilter; label: string; dot: string }[] = [
  { key: 'all', label: 'All', dot: 'var(--iq-gray-300)' },
  { key: 'fresh', label: 'Fresh', dot: '#12A363' },
  { key: 'ageing', label: 'Ageing', dot: '#D97706' },
  { key: 'stale', label: 'Stale', dot: '#DC2626' },
]

export function ManageScreen({ onAdd, onEdit }: Props) {
  const { infs, loc, deleteInfluencer, dataChanged } = useStore()
  const api = apiEnabled()
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const onOpenProfile = useOpenProfile('Manage Data')

  // URL: /manage?q=&tier=stale&page=2 (defaults omitted)
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const tierParam = params.get('tier')
  const tier: TierFilter = TIER_CHIPS.some(c => c.key === tierParam) ? (tierParam as TierFilter) : 'all'
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const go = (next: { q?: string; tier?: TierFilter; page?: number }, replace = false) => {
    const v = { q, tier, page, ...next }
    const p = new URLSearchParams()
    if (v.q) p.set('q', v.q)
    if (v.tier !== 'all') p.set('tier', v.tier)
    if (v.page > 1) p.set('page', String(v.page))
    setParams(p, { replace })
  }
  const scrollRef = useRef<HTMLDivElement>(null)

  // ---------- API mode: the server filters and pages (q here is the same text search as the Search screen) ----------
  const apiParams = new URLSearchParams()
  if (q) apiParams.set('q', q)
  if (tier !== 'all') apiParams.set('fresh', tier)
  if (page > 1) apiParams.set('page', String(page))
  apiParams.set('size', String(PAGE_SIZE))
  const remote = useApiSearchPage(api ? apiParams.toString() : null)
  const counts = useTierCounts(api)

  // ---------- demo mode: filter the built-in data ----------
  const tiers = new Map(infs.map(i => [i.id, freshness(i.updatedAt).tier]))
  const localCount = (t: TierFilter) => (t === 'all' ? infs.length : infs.filter(i => tiers.get(i.id) === t).length)
  const ql = q.toLowerCase()
  const rows = api ? remote.page : paginate(
    infs
      .filter(i => tier === 'all' || tiers.get(i.id) === tier)
      .filter(i => !ql || i.name.toLowerCase().includes(ql) || i.handle.toLowerCase().includes(ql)),
    page,
    PAGE_SIZE,
  )
  const count = (t: TierFilter) => (!api ? localCount(t) : counts ? counts[t] : '…')
  useScrollTopOnChange(scrollRef, rows.page)

  // API mode never hard-deletes: the record is archived (hidden from search, history kept)
  const remove = async (id: number) => {
    setConfirmId(null)
    if (!api) return deleteInfluencer(id)
    try {
      await changeStatus(id, 'ARCHIVED', 'Archived from Manage data')
      dataChanged()
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : 'Could not archive')
    }
  }
  const removeVerb = api ? 'Archive' : 'Delete'

  return (
    <div className="screen-col" style={{ background: 'var(--iq-gray-50)' }}>
      <div className="screen-head">
        <div>
          <div className="screen-title">Manage data</div>
          <div className="screen-sub">{count('all')} influencers · {count('stale')} with stale metrics</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div className="btn btn-soon" title="CSV import is coming soon" aria-disabled="true" style={{ gap: 5 }}>
            <Upload size={12} />Import CSV<Soon />
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setOptionsOpen(true)}><Tags size={12} />Niches &amp; languages</button>
          <button type="button" className="btn btn-blue" onClick={onAdd}><UserPlus size={12} />Add influencer</button>
        </div>
      </div>

      <div className="scroll" ref={scrollRef} style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div className="search-box" style={{ background: 'white', flex: 1, maxWidth: 360, minWidth: 200 }}>
            <Search size={13} />
            <input type="text" placeholder="Find by name or handle" aria-label="Find by name or handle" value={q} onChange={e => go({ q: e.target.value, page: 1 }, true)} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {TIER_CHIPS.map(c => {
              const on = tier === c.key
              return (
                <button key={c.key} type="button" className="chip" aria-pressed={on}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: on ? 'var(--iq-gray-800)' : 'white', color: on ? 'white' : 'var(--iq-fg-2)', borderColor: 'var(--iq-border)' }}
                  onClick={() => go({ tier: c.key, page: 1 })}>
                  <span className="dot" style={{ background: c.dot }} />{c.label} {count(c.key)}
                </button>
              )
            })}
          </div>
        </div>

        {api && remote.error && (
          <div role="alert" style={{ fontSize: 12, color: 'var(--iq-danger)', marginBottom: 8 }}>
            {remote.error} <button type="button" className="btn btn-plain btn-sm" onClick={remote.retry}>Retry</button>
          </div>
        )}
        <div className="table-wrap" style={api && remote.loading ? { opacity: 0.6 } : undefined}>
          <table className="table">
            <thead>
              <tr>
                <th className="pin">Influencer</th><th>Cities</th><th>States</th><th>Niches</th><th>Languages</th>
                <th className="r">Followers</th><th>Last updated</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.items.map(i => (
                <tr key={i.id}>
                  <td className="pin"><PersonCell inf={i} onView={() => onOpenProfile(i.id)} /></td>
                  <td className="sub" style={i.cities.length ? undefined : { color: 'var(--iq-fg-3)' }}>
                    {i.cities.join(', ') || 'Not known'}
                  </td>
                  <td className="sub">{statesOf(loc, i).join(', ')}</td>
                  <td><CategoryBadges cats={i.cats} /></td>
                  <td className="sub">{i.langs.join(', ')}</td>
                  <td className="num">{fmt(i.followers)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <FreshPill fr={freshness(i.updatedAt)} short />
                    {/* search results don't carry the rate date; it's on the profile */}
                    {!api && <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>Rates: {mon(i.rates[0].date)}</div>}
                  </td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    {confirmId === i.id ? (
                      <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        <span className="muted" style={{ fontSize: 11 }}>{removeVerb}?</span>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '3px 8px', fontWeight: 400 }} onClick={() => setConfirmId(null)}>No</button>
                        <button type="button" className="btn btn-sm" style={{ padding: '3px 8px', fontWeight: 400, background: 'var(--iq-danger)', color: 'white' }}
                          onClick={() => remove(i.id)}>
                          Yes
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'inline-flex', gap: 2 }}>
                        <button type="button" className="btn btn-plain" title="Edit" aria-label={`Edit ${i.name}`} style={{ padding: '5px 7px' }} onClick={() => onEdit(i)}>
                          <Pencil size={12} />
                        </button>
                        <button type="button" className="btn btn-plain" title={removeVerb} aria-label={`${removeVerb} ${i.name}`} style={{ padding: '5px 7px', color: 'var(--iq-danger)' }} onClick={() => setConfirmId(i.id)}>
                          {api ? <Archive size={12} /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={rows} onPage={p => go({ page: p })} />
      </div>
      {optionsOpen && <OptionsDrawer onClose={() => setOptionsOpen(false)} />}
    </div>
  )
}
