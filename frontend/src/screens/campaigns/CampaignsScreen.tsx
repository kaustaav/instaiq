import { useRef } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { Bookmark, Download, History, Plus, Share2, Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import { fmt, igUrl, uniq } from '../../lib/format'
import { statesOf } from '../../lib/locations'
import type { Campaign, Influencer, Region } from '../../types'
import { EmptyState, PersonCell, Soon } from '../../components/ui'
import { Pagination } from '../../components/Pagination'
import { paginate } from '../../lib/paginate'
import { useScrollTopOnChange } from '../../hooks/useScrollTopOnChange'
import { useOpenProfile } from '../../hooks/useOpenProfile'
import './campaigns.css'

const PAGE_SIZE = 50

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`

function exportCsv(c: Campaign, rows: Influencer[], loc: Region[]) {
  const header = 'Name,Handle,Instagram URL,Cities,States,Categories,Followers,Eng Rate,Languages,Reel Rate'
  const lines = rows.map(r =>
    [
      r.name, r.handle, igUrl(r.handle), r.cities.join('/'), statesOf(loc, r).join('/'),
      r.cats.join('/'), fmt(r.followers), r.eng + '%', r.langs.join('/'), r.pricing.reel,
    ].map(csvCell).join(','),
  )
  const url = URL.createObjectURL(new Blob([[header, ...lines].join('\n')], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${c.name}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

/** /campaigns redirects to the first campaign. */
export function CampaignsIndex() {
  const { campaigns } = useStore()
  return campaigns.length ? <Navigate to={`/campaigns/${campaigns[0].id}`} replace /> : <CampaignsScreen />
}

/** /campaigns/:id?page=2 */
export function CampaignsScreen() {
  const { campaigns, infs, loc, removeFromCampaign } = useStore()
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const setPage = (p: number) => setParams(p > 1 ? { page: String(p) } : {})
  const scrollRef = useRef<HTMLDivElement>(null)
  const active = campaigns.find(c => String(c.id) === id)
  const onOpenProfile = useOpenProfile(active?.name ?? 'Campaigns')
  // one influencer appears once per campaign, even if the data says otherwise
  const members = active
    ? uniq(active.iids).map(id => infs.find(i => i.id === id)).filter((i): i is Influencer => !!i)
    : []
  const rows = paginate(members, page, PAGE_SIZE)
  useScrollTopOnChange(scrollRef, `${active?.id}:${rows.page}`)

  return (
    <div className="screen">
      <div className="camp-list">
        <div className="camp-list-head">
          <div style={{ fontSize: 13, fontWeight: 600 }}>Campaigns</div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ fontWeight: 400 }} title="Coming soon">
            <Plus size={11} />New
          </button>
        </div>
        <div className="scroll" style={{ padding: 6 }}>
          {campaigns.map(c => (
            <Link key={c.id} to={`/campaigns/${c.id}`} className={c.id === active?.id ? 'camp-item on' : 'camp-item'}
              aria-current={c.id === active?.id ? 'page' : undefined}>
              <div className="camp-item-name">{c.name}</div>
              <div className="camp-item-meta">{uniq(c.iids).length} influencers · {c.created}</div>
            </Link>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--iq-border)', padding: '10px 14px 12px' }}>
          <div className="camp-prev" title="Previous campaigns are coming soon" aria-disabled="true">
            <History size={13} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>Previous campaigns</span>
            <Soon />
          </div>
        </div>
      </div>

      <div className="screen-col" style={{ background: 'var(--iq-gray-50)' }}>
        <div className="screen-head">
          <div>
            <div className="screen-title">{active?.name ?? 'Campaigns'}</div>
            {active && <div className="screen-sub">{members.length} influencers · {active.created}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" className="btn btn-ghost" title="Coming soon"><Share2 size={12} />Share</button>
            <button type="button" className="btn btn-blue" disabled={!active} onClick={() => active && exportCsv(active, members, loc)}>
              <Download size={12} />Export CSV
            </button>
          </div>
        </div>

        <div className="scroll" ref={scrollRef} style={{ padding: '14px 18px' }}>
          {members.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th><th>Influencer</th><th>Location</th><th>Category</th>
                    <th className="r">Followers</th><th className="r">Eng. Rate</th><th>Languages</th><th />
                  </tr>
                </thead>
                <tbody>
                  {rows.items.map((i, idx) => (
                    <tr key={i.id}>
                      <td className="muted" style={{ fontSize: 11, paddingBlock: 10 }}>{rows.from + idx}</td>
                      <td><PersonCell inf={i} onView={() => onOpenProfile(i.id)} /></td>
                      <td>
                        <div className="sub">{[...i.cities, ...i.states].join(', ')}</div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{statesOf(loc, i).join(', ')}</div>
                      </td>
                      <td className="sub">{i.cats.join(', ')}</td>
                      <td className="num">{fmt(i.followers)}</td>
                      <td className="num up">{i.eng.toFixed(1)}%</td>
                      <td className="sub">{i.langs.join(', ')}</td>
                      <td className="r">
                        <button type="button" className="btn btn-plain btn-sm" style={{ color: 'var(--iq-down)', fontWeight: 400, gap: 3 }}
                          onClick={() => removeFromCampaign(active!.id, i.id)}>
                          <Trash2 size={11} />Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : active ? (
            <EmptyState icon={Bookmark} title="Campaign is empty" sub="Add influencers from Search" />
          ) : (
            <EmptyState icon={Bookmark} title="Campaign not found" sub="Pick a campaign from the list" />
          )}
          <Pagination page={rows} onPage={setPage} />
        </div>
      </div>
    </div>
  )
}
