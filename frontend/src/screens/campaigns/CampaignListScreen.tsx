import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Megaphone, Plus, Search } from 'lucide-react'
import { useStore } from '../../store'
import { inr } from '../../lib/format'
import { budgetUsed, CAMPAIGN_STATUS_LABEL, campaignSummary } from '../../lib/campaigns'
import { CAMPAIGN_TONE, fmtRange } from '../../lib/campaignUi'
import { paginate } from '../../lib/paginate'
import { useScrollTopOnChange } from '../../hooks/useScrollTopOnChange'
import type { Campaign, CampaignStatus } from '../../types'
import { EmptyState, Pill } from '../../components/ui'
import { Pagination } from '../../components/Pagination'
import { CampaignFormDrawer } from './CampaignFormDrawer'
import { BudgetBar } from './BudgetBar'
import './campaigns.css'

const PAGE_SIZE = 50
const STATUS_FILTERS: ('ALL' | CampaignStatus)[] = ['ALL', 'DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED']
// open work first, then newest
const STATUS_ORDER: Record<CampaignStatus, number> = { ACTIVE: 0, DRAFT: 1, COMPLETED: 2, CANCELLED: 3, ARCHIVED: 4 }

/** /campaigns?q=&status=&brand=&page= */
export function CampaignListScreen() {
  const { campaigns, createCampaign } = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

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
  const inStatus = (c: Campaign) => (status === 'ALL' ? c.status !== 'ARCHIVED' : c.status === status)
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
    <div className="screen-col" style={{ background: 'var(--iq-gray-50)' }}>
      <div className="screen-head">
        <div>
          <div className="screen-title">Campaigns</div>
          <div className="screen-sub">{count('ACTIVE')} active · {count('DRAFT')} draft</div>
        </div>
        <button type="button" className="btn btn-blue" onClick={() => setCreating(true)}><Plus size={12} />New campaign</button>
      </div>

      <div className="scroll" ref={scrollRef} style={{ padding: '14px 18px' }}>
        <div className="camp-toolbar">
          <div className="search-box" style={{ background: 'white', flex: 1, maxWidth: 320, minWidth: 200 }}>
            <Search size={13} />
            <input type="text" autoComplete="off" placeholder="Find campaign or brand" aria-label="Find campaign or brand" value={q}
              onChange={e => go({ q: e.target.value, page: 1 }, true)} />
          </div>
          <div className="chips">
            {STATUS_FILTERS.map(s => (
              <button key={s} type="button" className="chip" aria-pressed={status === s}
                style={{ background: status === s ? 'var(--iq-gray-800)' : 'white', color: status === s ? 'white' : 'var(--iq-fg-2)', borderColor: 'var(--iq-border)', padding: '4px 10px' }}
                onClick={() => go({ status: s, page: 1 })}>
                {s === 'ALL' ? 'All' : CAMPAIGN_STATUS_LABEL[s]} {count(s)}
              </button>
            ))}
          </div>
          <select className="input input-sm" style={{ width: 'auto' }} aria-label="Brand" value={brand} onChange={e => go({ brand: e.target.value, page: 1 })}>
            <option value="">All brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {rows.total === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns match" sub={campaigns.length ? 'Try another filter' : 'Create your first campaign'} />
        ) : (
          <div className="camp-cards">
            {rows.items.map(c => {
              const s = campaignSummary(c)
              const live = (s.stages.get('LIVE') ?? 0) + (s.stages.get('COMPLETED') ?? 0)
              return (
                <Link key={c.id} to={`/campaigns/${c.id}`} className="camp-card">
                  <div className="camp-card-main">
                    <div className="camp-card-title">
                      <span className="camp-card-name">{c.name}</span>
                      <Pill tone={CAMPAIGN_TONE[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Pill>
                    </div>
                    <div className="camp-card-meta">{c.brand} · {fmtRange(c.startDate, c.endDate)}</div>
                    <div className="camp-card-meta">
                      {s.members} influencer{s.members !== 1 ? 's' : ''}
                      {s.deliverables > 0 && <> · {s.posted}/{s.deliverables} posts live</>}
                      {s.inReview > 0 && <> · <b style={{ color: '#3D2F99' }}>{s.inReview} draft{s.inReview > 1 ? 's' : ''} to review</b></>}
                      {live > 0 && s.unpaid > 0 && <> · <b style={{ color: '#8B5E00' }}>{s.unpaid} unpaid</b></>}
                    </div>
                  </div>
                  <div className="camp-card-budget">
                    <BudgetBar used={budgetUsed(c)} total={c.budget} />
                    <div className="muted mono" style={{ fontSize: 11, marginTop: 4, textAlign: 'right' }}>
                      {inr(budgetUsed(c))} / {c.budget != null ? inr(c.budget) : 'no budget'}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
        <Pagination page={rows} onPage={p => go({ page: p })} noun="campaigns" />
      </div>

      {creating && (
        <CampaignFormDrawer
          editing={null}
          onClose={() => setCreating(false)}
          onSubmit={input => {
            const r = createCampaign(input)
            if (typeof r === 'string') return r
            setCreating(false)
            navigate(`/campaigns/${r.id}`)
            return ''
          }}
        />
      )}
    </div>
  )
}
