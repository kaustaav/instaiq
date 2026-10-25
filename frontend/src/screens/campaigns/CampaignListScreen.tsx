import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ChevronRight, Megaphone, Plus, Search, WifiOff } from 'lucide-react'
import { useStore } from '../../store'
import { CAMPAIGN_STATUS_LABEL } from '../../lib/campaigns'
import { CAMPAIGN_TONE, fmtRange, type CampaignCard } from '../../lib/campaignUi'
import { apiEnabled, errorText } from '../../api/client'
import { createCampaignApi } from '../../api/campaigns'
import { useCampaignCards } from '../../hooks/useCampaigns'
import { paginate } from '../../lib/paginate'
import { useScrollTopOnChange } from '../../hooks/useScrollTopOnChange'
import { useScrolled } from '../../hooks/useScrolled'
import type { CampaignStatus } from '../../types'
import { EmptyState, Pill, Segmented } from '../../components/ui'
import { Pagination } from '../../components/Pagination'
import { CampaignFormDrawer } from './CampaignFormDrawer'
import './campaigns.css'
import { AnimatePresence } from 'motion/react'
import { CampaignCardsSkeleton } from '../../components/Skeletons'

const PAGE_SIZE = 50
const STATUS_FILTERS: ('ALL' | CampaignStatus)[] = ['ALL', 'DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED']
// open work first, then newest
const STATUS_ORDER: Record<CampaignStatus, number> = { ACTIVE: 0, DRAFT: 1, COMPLETED: 2, CANCELLED: 3, ARCHIVED: 4 }

/** /campaigns?q=&status=&brand=&page= */
export function CampaignListScreen() {
  const { createCampaign, dataChanged } = useStore()
  const cards = useCampaignCards() // built-in campaigns, or the API
  const campaigns = cards.kind === 'ready' ? cards.data : []
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLElement>(null)
  const stuck = useScrolled(scrollRef, true, titleRef)

  const q = params.get('q') ?? ''
  const statusParam = params.get('status')
  const status = STATUS_FILTERS.find(s => s === statusParam) ?? 'ALL'
  const brand = params.get('brand') ?? ''
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const go = (next: { q?: string; status?: string; brand?: string; page?: number }, replace = false) => {
    const v = { q, status, brand, page, ...next }
    const p = new URLSearchParams()
    if (v.q) p.set('q', v.q)
    if (v.status !== 'ALL') p.set('status', v.status)
    if (v.brand) p.set('brand', v.brand)
    if (v.page > 1) p.set('page', String(v.page))
    setParams(p, { replace })
  }

  // "All" hides archived campaigns, like archived influencers
  const inStatus = (c: CampaignCard) => (status === 'ALL' ? c.status !== 'ARCHIVED' : c.status === status)
  const count = (s: (typeof STATUS_FILTERS)[number]) => campaigns.filter(c => (s === 'ALL' ? c.status !== 'ARCHIVED' : c.status === s)).length
  const brands = [...new Set(campaigns.map(c => c.brand))].sort()
  const ql = q.toLowerCase()
  const rows = paginate(
    campaigns
      .filter(inStatus)
      .filter(c => !brand || c.brand === brand)
      .filter(c => !ql || c.name.toLowerCase().includes(ql) || c.brand.toLowerCase().includes(ql))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt)),
    page,
    PAGE_SIZE,
  )
  useScrollTopOnChange(scrollRef, rows.page)

  return (
    <div className="screen-col">
      <div className="scroll" ref={scrollRef}>
        <header ref={titleRef} className="list-title">
          <div>
            <h1>Campaigns</h1>
            <div className="page-title-meta">{count('ACTIVE')} active · {count('DRAFT')} draft</div>
          </div>
          <div className="list-title-actions">
            <button type="button" className="btn btn-blue" onClick={() => setCreating(true)}><Plus size={14} />New campaign</button>
          </div>
        </header>

        <div className={stuck ? 'list-toolbar scrolled' : 'list-toolbar'}>
          <div className="search-box" style={{ flex: 1, maxWidth: 320, minWidth: 200 }}>
            <Search size={14} />
            <input type="text" autoComplete="off" placeholder="Find campaign or brand" aria-label="Find campaign or brand" value={q}
              onChange={e => go({ q: e.target.value, page: 1 }, true)} />
          </div>
          <Segmented label="Campaign status" className="seg-scroll" value={status} onChange={s => go({ status: s, page: 1 })}
            options={STATUS_FILTERS.map(s => ({
              value: s,
              label: <>{s === 'ALL' ? 'All' : CAMPAIGN_STATUS_LABEL[s]} <span className="seg-count">{count(s)}</span></>,
            }))} />
          <select className="select-pill" aria-label="Brand" value={brand} onChange={e => go({ brand: e.target.value, page: 1 })}>
            <option value="">All brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="list-body">
          {cards.kind === 'error' ? (
            <div style={{ textAlign: 'center' }}>
              <EmptyState icon={WifiOff} title="Couldn’t load campaigns" sub={cards.message} />
              <button type="button" className="btn btn-ghost" onClick={cards.retry}>Try again</button>
            </div>
          ) : cards.kind === 'loading' ? (
            <CampaignCardsSkeleton />
          ) : rows.total === 0 ? (
            <EmptyState icon={Megaphone} title="No campaigns match" sub={campaigns.length ? 'Try another filter' : 'Create your first campaign'} />
          ) : (
            <div className="camp-list">
              {rows.items.map(c => <CampaignRow key={c.id} c={c} />)}
            </div>
          )}
          <Pagination page={rows} onPage={p => go({ page: p })} noun="campaigns" />
        </div>
      </div>

      <AnimatePresence>
      {creating && (
        <CampaignFormDrawer
          key="new"
          editing={null}
          onClose={() => setCreating(false)}
          onSubmit={async input => {
            let id: number
            if (apiEnabled()) {
              try {
                id = (await createCampaignApi(input)).id
                dataChanged()
              } catch (e) {
                return errorText(e)
              }
            } else {
              const r = createCampaign(input)
              if (typeof r === 'string') return r
              id = r.id
            }
            setCreating(false)
            navigate(`/campaigns/${id}`)
            return ''
          }}
        />
      )}
      </AnimatePresence>
    </div>
  )
}

/** One campaign as a list row (Mail-style): name and status, brand and dates. The rest is on its own page. */
function CampaignRow({ c }: { c: CampaignCard }) {
  return (
    <Link to={`/campaigns/${c.id}`} className="camp-row">
      <div className="camp-row-main">
        <div className="camp-row-title">
          <span className="camp-row-name">{c.name}</span>
          <Pill tone={CAMPAIGN_TONE[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Pill>
        </div>
        <div className="camp-row-meta">{c.brand} · {fmtRange(c.startDate, c.endDate)}</div>
      </div>
      <ChevronRight size={16} className="camp-row-chevron" />
    </Link>
  )
}
