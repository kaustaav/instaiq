import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Archive, Pencil, Search, Tags, Trash2, Upload, User, UserPlus } from 'lucide-react'
import { useStore } from '../../store'
import { OptionsDrawer } from '../../overlays/OptionsDrawer'
import { apiEnabled, ApiError } from '../../api/client'
import { changeStatus } from '../../api/influencers'
import { useApiSearchPage, useTierCounts } from '../../hooks/useApiSearchPage'
import { fmt, freshness, mon, type FreshTier } from '../../lib/format'
import { statesOf } from '../../lib/locations'
import type { Influencer } from '../../types'
import { CategoryBadges, FreshPill, PersonCell, Segmented } from '../../components/ui'
import { Menu } from '../../components/Menu'
import { ReasonDialog } from '../../components/ReasonDialog'
import { useScrolled } from '../../hooks/useScrolled'
import { Pagination } from '../../components/Pagination'
import { paginate } from '../../lib/paginate'
import { useScrollTopOnChange } from '../../hooks/useScrollTopOnChange'
import { useOpenProfile } from '../../hooks/useOpenProfile'
import { AnimatePresence } from 'motion/react'
import { TableSkeleton } from '../../components/Skeletons'
import { notify } from '../../lib/notify'

const PAGE_SIZE = 50

type Props = {
  onAdd: () => void
  onEdit: (inf: Influencer) => void
}

type TierFilter = 'all' | FreshTier

const TIER_CHIPS: { key: TierFilter; label: string; dot: string }[] = [
  { key: 'all', label: 'All', dot: 'var(--iq-gray-300)' },
  { key: 'fresh', label: 'Fresh', dot: '#34C759' },
  { key: 'ageing', label: 'Ageing', dot: '#FF9500' },
  { key: 'stale', label: 'Stale', dot: '#FF3B30' },
]

export function ManageScreen({ onAdd, onEdit }: Props) {
  const { infs, loc, deleteInfluencer, dataChanged } = useStore()
  const api = apiEnabled()
  const [deleteAsk, setDeleteAsk] = useState<{ id: number; name: string } | null>(null) // demo mode only: deleting can't be undone
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
  const titleRef = useRef<HTMLElement>(null)
  const stuck = useScrolled(scrollRef, true, titleRef)

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
    const name = rows.items.find(i => i.id === id)?.name ?? 'Influencer'
    if (!api) return setDeleteAsk({ id, name })
    try {
      await changeStatus(id, 'ARCHIVED', 'Archived from Manage data')
      dataChanged()
      // forgiveness over confirmation: one tap puts it back
      notify({
        kind: 'success', text: `Archived ${name}`,
        action: {
          label: 'Undo',
          run: () => changeStatus(id, 'ACTIVE')
            .then(() => { dataChanged(); notify({ kind: 'info', text: `${name} restored` }) })
            .catch(e => notify({ kind: 'error', text: e instanceof ApiError ? e.message : 'Could not restore' })),
        },
      })
    } catch (e) {
      notify({ kind: 'error', text: e instanceof ApiError ? e.message : 'Could not archive' })
    }
  }

  return (
    <div className="screen-col">
      <div className="scroll" ref={scrollRef}>
        <header ref={titleRef} className="list-title">
          <div>
            <h1>Manage data</h1>
            <div className="page-title-meta">{count('all')} influencers · {count('stale')} with stale metrics</div>
          </div>
          <div className="list-title-actions">
            <button type="button" className="btn btn-blue" onClick={onAdd}><UserPlus size={14} />Add influencer</button>
            <Menu label="More" items={[
              { label: 'Niches & languages', icon: Tags, onSelect: () => setOptionsOpen(true) },
              { label: 'Import CSV', icon: Upload, disabled: true, tag: 'Soon', hint: 'CSV import is coming soon', onSelect: () => {} },
            ]} />
          </div>
        </header>

        {/* pins to the top once the title has scrolled away; hairline only then */}
        <div className={stuck ? 'list-toolbar scrolled' : 'list-toolbar'}>
          <div className="search-box" style={{ flex: 1, maxWidth: 360, minWidth: 200 }}>
            <Search size={14} />
            <input type="text" placeholder="Find by name or handle" aria-label="Find by name or handle" value={q} onChange={e => go({ q: e.target.value, page: 1 }, true)} />
          </div>
          <Segmented label="Metrics freshness" value={tier} onChange={t => go({ tier: t, page: 1 })}
            options={TIER_CHIPS.map(c => ({
              value: c.key,
              label: <>{c.key !== 'all' && <span className="dot" style={{ background: c.dot }} />}{c.label} <span className="seg-count">{count(c.key)}</span></>,
            }))} />
        </div>

        <div className="list-body">
          {api && remote.error && (
            <div role="alert" style={{ fontSize: 13, color: 'var(--iq-danger)', marginBottom: 10 }}>
              {remote.error} <button type="button" className="btn btn-plain btn-sm" onClick={remote.retry}>Retry</button>
            </div>
          )}
          {/* first load: placeholder rows; later loads keep the current rows, dimmed */}
          {api && remote.loading && rows.items.length === 0 ? <TableSkeleton rows={10} cols={6} /> : (
          <div className="table-wrap" style={api && remote.loading ? { opacity: 0.6 } : undefined}>
            <table className="table manage-table">
              <thead>
                <tr>
                  <th className="pin">Influencer</th><th>Location</th><th>Niches</th><th>Languages</th>
                  <th className="r">Followers</th><th>Updated</th><th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.items.map(i => (
                  <tr key={i.id} className="clickable" onClick={() => onOpenProfile(i.id)}>
                    <td className="pin"><PersonCell inf={i} /></td>
                    <td>
                      <div className="sub" style={{ color: i.cities.length ? 'var(--iq-fg-1)' : undefined }}>{i.cities.join(', ') || 'City not known'}</div>
                      {/* states, minus any that are already shown as a city (Chandigarh, Delhi): never print a name twice */}
                      <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{statesOf(loc, i).filter(st => !i.cities.includes(st)).join(', ')}</div>
                    </td>
                    <td><CategoryBadges cats={i.cats} /></td>
                    <td className="sub">{i.langs.join(', ')}</td>
                    <td className="num">{fmt(i.followers)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <FreshPill fr={freshness(i.updatedAt)} short />
                      {/* search results don't carry the rate date; it's on the profile */}
                      {!api && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Rates {mon(i.rates[0].date)}</div>}
                    </td>
                    <td className="r">
                      <Menu small label={`Actions for ${i.name}`} items={[
                        { label: 'Edit', icon: Pencil, onSelect: () => onEdit(i) },
                        { label: 'View profile', icon: User, onSelect: () => onOpenProfile(i.id) },
                        'separator',
                        api
                          ? { label: 'Archive', icon: Archive, onSelect: () => void remove(i.id), hint: 'Hidden from search; history kept' }
                          : { label: 'Delete', icon: Trash2, danger: true, onSelect: () => void remove(i.id) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          <Pagination page={rows} onPage={p => go({ page: p })} />
        </div>
      </div>
      <AnimatePresence>
        {deleteAsk && (
          <ReasonDialog key="delete" title={`Delete ${deleteAsk.name}?`} message="This removes them from the demo data and from every campaign. It can’t be undone."
            confirmLabel="Delete" danger
            onConfirm={() => { deleteInfluencer(deleteAsk.id); notify({ kind: 'success', text: `Deleted ${deleteAsk.name}` }); return '' }}
            onClose={() => setDeleteAsk(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>{optionsOpen && <OptionsDrawer key="options" onClose={() => setOptionsOpen(false)} />}</AnimatePresence>
    </div>
  )
}
