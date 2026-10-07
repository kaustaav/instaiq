import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, BookmarkPlus, ChevronRight, ExternalLink, Languages, Mail, MapPin, Pencil, Phone } from 'lucide-react'
import { useStore } from '../../store'
import { ApiError } from '../../api/client'
import { changeStatus, updateNotes } from '../../api/influencers'
import { dstr, fmt, freshness, igUrl, mon } from '../../lib/format'
import { stateOf } from '../../lib/locations'
import type { Influencer, InfluencerStatus } from '../../types'
import { Avatar, CategoryBadges, FreshPill, Pill } from '../../components/ui'
import { CAMPAIGN_STATUS_LABEL, STAGE_LABEL } from '../../lib/campaigns'
import { useInfluencerCampaigns } from '../../hooks/useCampaigns'
import { CAMPAIGN_TONE, fmtDate, STAGE_TONE } from '../../lib/campaignUi'
import './profile.css'

type Props = {
  inf: Influencer
  backLabel: string
  onBack: () => void
  onEdit: () => void
  onAddToCampaign: () => void
}

const STATUS_LABEL: Record<InfluencerStatus, string> = { ACTIVE: 'Active', ON_HOLD: 'On hold', BANNED: 'Banned', ARCHIVED: 'Archived' }
const STATUS_TONE: Record<InfluencerStatus, { bg: string; fg: string }> = {
  ACTIVE: { bg: '#E7F7EF', fg: '#005E3B' },
  ON_HOLD: { bg: '#FEF4E4', fg: '#8B5E00' },
  BANNED: { bg: '#FDECEC', fg: '#A11D1D' },
  ARCHIVED: { bg: 'var(--iq-gray-100)', fg: 'var(--iq-fg-2)' },
}

const message = (e: unknown) => (e instanceof ApiError ? [e.message, ...e.errors].join(' ') : 'Something went wrong')

const STATUS_COLORS = {
  Completed: { bg: '#E7F7EF', fg: '#005E3B' },
  Ongoing: { bg: '#FEF4E4', fg: '#8B5E00' },
}

export function ProfileScreen({ inf, backLabel, onBack, onEdit, onAddToCampaign }: Props) {
  const { loc, setNote, dataChanged } = useStore()
  // every campaign they're in, newest first (built-in campaigns, or the API)
  const memberships = useInfluencerCampaigns(inf.id)
  const history = memberships.kind === 'ready' ? memberships.data : []
  const [histOpen, setHistOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState<string | null>(null) // null = not editing
  const [noteError, setNoteError] = useState('')
  const [busy, setBusy] = useState(false)

  // inf.api is set only when the profile came from the server: then writes go to the API
  const saveNote = async (note: string) => {
    if (!inf.api) {
      setNote(inf.id, note)
      return setNoteDraft(null)
    }
    setBusy(true)
    try {
      await updateNotes(inf.id, note)
      dataChanged()
      setNoteDraft(null)
      setNoteError('')
    } catch (e) {
      setNoteError(message(e))
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (status: InfluencerStatus) => {
    let reason: string | undefined
    if (status !== 'ACTIVE') {
      const r = window.prompt(`Why is ${inf.name} ${STATUS_LABEL[status].toLowerCase()}? (required)`)
      if (r == null) return // cancelled
      reason = r
    }
    setBusy(true)
    try {
      await changeStatus(inf.id, status, reason)
      dataChanged()
    } catch (e) {
      window.alert(message(e))
    } finally {
      setBusy(false)
    }
  }

  const fr = freshness(inf.updatedAt)
  const rateFr = freshness(inf.rates[0].date)
  // "Pune, Maharashtra" — but don't repeat when city and state share a name (Chandigarh, Delhi)
  const locStr = [
    ...inf.cities.map(c => {
      const st = stateOf(loc, c)
      return st && !st.startsWith(c) ? `${c}, ${st}` : c
    }),
    ...inf.states.map(st => `${st} (city not known)`),
  ].join(' · ')

  const stats = [
    { label: 'Followers', value: fmt(inf.followers) },
    { label: 'Eng. Rate', value: inf.eng.toFixed(1) + '%', up: true },
    { label: 'Avg Likes', value: fmt(inf.likes) },
    { label: 'Avg Comments', value: String(inf.comments) },
  ]

  return (
    <div className="screen-col">
      <div className="crumbs">
        <button type="button" className="btn btn-plain" style={{ fontSize: 13, fontWeight: 400, padding: '4px 8px' }} onClick={onBack}>
          <ArrowLeft size={13} />{backLabel}
        </button>
        <ChevronRight size={13} className="muted" />
        <span style={{ fontSize: 13, fontWeight: 500 }}>{inf.name}</span>
      </div>

      <div className="scroll" style={{ background: 'var(--iq-gray-50)' }}>
        <div className="profile">
          <div className="card profile-head">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
              <Avatar inf={inf} size={58} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="profile-name">{inf.name}</span>
                  <a href={igUrl(inf.handle)} target="_blank" rel="noopener" style={{ fontSize: 13 }}>{inf.handle}</a>
                </div>
                <div className="profile-loc">
                  <MapPin size={11} />
                  <span>{locStr}</span>
                  <span style={{ margin: '0 3px' }}>·</span>
                  <Languages size={11} />
                  <span>{inf.langs.join(', ')}</span>
                </div>
                <div style={{ marginTop: 8 }}><CategoryBadges cats={inf.cats} large /></div>
                {inf.api && inf.api.status !== 'ACTIVE' && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <span className="badge" style={{ padding: '2px 8px', background: STATUS_TONE[inf.api.status].bg, color: STATUS_TONE[inf.api.status].fg }}>
                      {STATUS_LABEL[inf.api.status]}
                    </span>
                    {inf.api.statusReason && <span className="muted" style={{ marginLeft: 6 }}>{inf.api.statusReason}</span>}
                  </div>
                )}
              </div>
              <div className="profile-actions">
                {inf.api && (
                  <select className="input input-sm" aria-label="Status" value={inf.api.status} disabled={busy}
                    style={{ width: 'auto' }} onChange={e => setStatus(e.target.value as InfluencerStatus)}>
                    {(Object.keys(STATUS_LABEL) as InfluencerStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                )}
                <button type="button" className="btn btn-ghost" onClick={onEdit}><Pencil size={12} />Edit</button>
                <a className="btn btn-ghost" href={igUrl(inf.handle)} target="_blank" rel="noopener">
                  <ExternalLink size={12} />View on Instagram
                </a>
                <button type="button" className="btn btn-blue" onClick={onAddToCampaign}>
                  <BookmarkPlus size={12} />Add to Campaign
                </button>
              </div>
            </div>

            <div className="profile-stats">
              {stats.map(s => (
                <div key={s.label}>
                  <div className={s.up ? 'mono up' : 'mono'}>{s.value}</div>
                  <div className="profile-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 11 }}>Metrics</span>
              <FreshPill fr={fr} />
              <span className="muted mono" style={{ fontSize: 11 }}>{dstr(inf.updatedAt)}</span>
            </div>
          </div>

          <div className="profile-cols">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <section className="card" style={{ padding: 16 }}>
                <div className="label" style={{ marginBottom: 8 }}>About</div>
                <p className="profile-bio">{inf.bio}</p>
              </section>
              <section className="card" style={{ padding: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>Campaign History</div>
                {history.length ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="camp-table">
                      <thead>
                        <tr><th>Campaign</th><th>Brand</th><th>Start</th><th>Stage</th><th>Posts</th><th>Campaign</th></tr>
                      </thead>
                      <tbody>
                        {history.map(h => (
                          <tr key={h.campaignId}>
                            <td style={{ fontWeight: 500 }}><Link to={`/campaigns/${h.campaignId}?member=${inf.id}`}>{h.name}</Link></td>
                            <td className="sub">{h.brand}</td>
                            <td className="muted mono" style={{ fontSize: 11 }}>{fmtDate(h.startDate)}</td>
                            <td><Pill tone={STAGE_TONE[h.stage]}>{STAGE_LABEL[h.stage]}</Pill></td>
                            <td className="sub">{h.deliverables ? `${h.posted}/${h.deliverables}` : '—'}</td>
                            <td><Pill tone={CAMPAIGN_TONE[h.campaignStatus]}>{CAMPAIGN_STATUS_LABEL[h.campaignStatus]}</Pill></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="muted" style={{ padding: '12px 0', textAlign: 'center', fontSize: 13 }}>
                    {memberships.kind === 'loading' ? 'Loading…' : memberships.kind === 'error' ? 'Couldn’t load campaign history' : 'Not in any campaign yet'}
                  </div>
                )}
                {inf.camps.length > 0 && (
                  <>
                    <div className="label" style={{ margin: '16px 0 8px' }}>Earlier collaborations <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(before InfluenceIQ)</span></div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="camp-table">
                        <thead>
                          <tr><th>Campaign</th><th>Brand</th><th>Date</th><th>Deliverable</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {inf.camps.map(c => (
                            <tr key={c.name + c.date}>
                              <td style={{ fontWeight: 500 }}>{c.name}</td>
                              <td className="sub">{c.brand}</td>
                              <td className="muted mono" style={{ fontSize: 11 }}>{c.date}</td>
                              <td className="sub">{c.del}</td>
                              <td>
                                <span className="badge" style={{ padding: '2px 8px', background: STATUS_COLORS[c.status].bg, color: STATUS_COLORS[c.status].fg }}>
                                  {c.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <section className="card side-card">
                <div className="label" style={{ marginBottom: 10 }}>Contact</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div className="contact-row"><Mail size={12} className="muted" /><span>{inf.email}</span></div>
                  <div className="contact-row"><Phone size={12} className="muted" /><span>{inf.phone}</span></div>
                </div>
              </section>

              <section className="card side-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <div className="label">Pricing (INR)</div>
                  <span title={rateFr.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: rateFr.fg }}>
                    <span className="dot" style={{ background: rateFr.dot }} />as of {mon(inf.rates[0].date)}
                  </span>
                </div>
                {(['story', 'reel', 'post'] as const).map((k, idx) => (
                  <div key={k} className="price-row" style={idx < 2 ? { borderBottom: '1px solid var(--iq-border)' } : undefined}>
                    <span>{k[0].toUpperCase() + k.slice(1)}</span>
                    <span className="mono">{inf.pricing[k]}</span>
                  </div>
                ))}
                {inf.rates.length > 1 && (
                  <>
                    <button type="button" className="btn btn-plain btn-sm" aria-expanded={histOpen}
                      style={{ marginTop: 8, marginLeft: -6, padding: '3px 6px', color: 'var(--iq-brand-500)', fontWeight: 400 }}
                      onClick={() => setHistOpen(!histOpen)}>
                      {histOpen ? 'Hide rate history' : `Show rate history (${inf.rates.length - 1} earlier)`}
                    </button>
                    {histOpen && (
                      <div className="rate-hist">
                        <div className="rate-hist-row rate-hist-head">
                          <span>From</span><span>Story</span><span>Reel</span><span>Post</span>
                        </div>
                        {inf.rates.map((r, k) => (
                          <div key={r.date} className="rate-hist-row mono" style={{ color: k === 0 ? 'var(--iq-fg-1)' : 'var(--iq-fg-3)' }}>
                            <span style={{ fontFamily: 'var(--iq-font-sans)' }}>{mon(r.date)}{k === 0 && ' · now'}</span>
                            <span>{r.story}</span><span>{r.reel}</span><span>{r.post}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>

              <section className="card side-card">
                <div className="label" style={{ marginBottom: 8 }}>Top Hashtags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {inf.tags.map(t => <span key={t} className="hashtag" style={{ fontSize: 12, padding: '3px 8px' }}>{t}</span>)}
                </div>
              </section>

              <section className="card side-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="label">Notes</div>
                  {noteDraft != null ? (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 7px', fontWeight: 400 }} onClick={() => { setNoteDraft(null); setNoteError('') }}>Cancel</button>
                      <button type="button" className="btn btn-blue btn-sm" style={{ padding: '2px 7px', fontWeight: 400 }} disabled={busy}
                        onClick={() => saveNote(noteDraft)}>
                        {busy ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-plain btn-sm" style={{ padding: '2px 6px', gap: 3, color: 'var(--iq-fg-3)', fontWeight: 400 }}
                      onClick={() => setNoteDraft(inf.note)}>
                      <Pencil size={10} />Edit
                    </button>
                  )}
                </div>
                {noteDraft != null ? (
                  <textarea className="input" rows={4} autoFocus aria-label="Notes" value={noteDraft}
                    style={{ fontSize: 12, minHeight: 72, lineHeight: 1.55 }}
                    onChange={e => setNoteDraft(e.target.value)} />
                ) : (
                  <p className="profile-note">{inf.note || <span className="muted">No notes yet</span>}</p>
                )}
                {noteError && <div role="alert" style={{ fontSize: 12, color: 'var(--iq-danger)', marginTop: 6 }}>{noteError}</div>}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
