import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Archive, ArrowUpRight, Ban, BookmarkPlus, ChevronLeft, CircleCheck, CirclePause, Languages, Mail, MapPin, Pencil, Phone } from 'lucide-react'
import { useStore } from '../../store'
import { ApiError } from '../../api/client'
import { changeStatus, updateNotes } from '../../api/influencers'
import { dstr, fmt, freshness, igUrl, mon } from '../../lib/format'
import { stateOf } from '../../lib/locations'
import type { Influencer, InfluencerStatus } from '../../types'
import { Avatar, CategoryBadges, FreshPill, Pill } from '../../components/ui'
import { CAMPAIGN_STATUS_LABEL, STAGE_LABEL } from '../../lib/campaigns'
import { useInfluencerCampaigns } from '../../hooks/useCampaigns'
import { fmtDate, STAGE_TONE } from '../../lib/campaignUi'
import './profile.css'
import { RowsSkeleton } from '../../components/Skeletons'
import { notify } from '../../lib/notify'
import { ReasonDialog } from '../../components/ReasonDialog'
import { AnimatePresence } from 'motion/react'
import { Menu, type MenuItem } from '../../components/Menu'
import { useScrolled } from '../../hooks/useScrolled'

type Props = {
  inf: Influencer
  backLabel: string
  onBack: () => void
  onEdit: () => void
  onAddToCampaign: () => void
}

const STATUS_LABEL: Record<InfluencerStatus, string> = { ACTIVE: 'Active', ON_HOLD: 'On hold', BANNED: 'Banned', ARCHIVED: 'Archived' }
const STATUS_TONE: Record<InfluencerStatus, { bg: string; fg: string }> = {
  ACTIVE: { bg: '#E5F5E9', fg: '#1D7A35' },
  ON_HOLD: { bg: '#FFF1E0', fg: '#A04A00' },
  BANNED: { bg: '#FDE8E7', fg: '#C4161C' },
  ARCHIVED: { bg: 'var(--iq-gray-100)', fg: 'var(--iq-fg-2)' },
}

const message = (e: unknown) => (e instanceof ApiError ? [e.message, ...e.errors].join(' ') : 'Something went wrong')

const STATUS_COLORS = {
  Completed: { bg: '#E5F5E9', fg: '#1D7A35' },
  Ongoing: { bg: '#FFF1E0', fg: '#A04A00' },
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const scrolled = useScrolled(scrollRef, true, heroRef) // the name moves into the bar once the big one has scrolled away

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

  // anything but Active needs a reason, asked in our own dialog
  const [statusAsk, setStatusAsk] = useState<InfluencerStatus | null>(null)
  const applyStatus = async (status: InfluencerStatus, reason?: string) => {
    await changeStatus(inf.id, status, reason)
    dataChanged()
    notify({ kind: 'success', text: status === 'ACTIVE' ? `${inf.name} is active again` : `${inf.name} marked ${STATUS_LABEL[status].toLowerCase()}` })
  }
  const setStatus = async (status: InfluencerStatus) => {
    if (status !== 'ACTIVE') return setStatusAsk(status)
    setBusy(true)
    try {
      await applyStatus(status)
    } catch (e) {
      notify({ kind: 'error', text: message(e) })
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

  // ••• (API mode only): every status this influencer isn't in; the risky ones last, in red
  const STATUS_ITEM: Record<InfluencerStatus, MenuItem> = {
    ACTIVE: { label: 'Mark active', icon: CircleCheck, onSelect: () => void setStatus('ACTIVE') },
    ON_HOLD: { label: 'Put on hold…', icon: CirclePause, onSelect: () => void setStatus('ON_HOLD') },
    ARCHIVED: { label: 'Archive…', icon: Archive, onSelect: () => void setStatus('ARCHIVED') },
    BANNED: { label: 'Ban…', icon: Ban, danger: true, onSelect: () => void setStatus('BANNED') },
  }
  const menuItems: MenuItem[] = inf.api
    ? (['ACTIVE', 'ON_HOLD', 'ARCHIVED', 'BANNED'] as const).filter(st => st !== inf.api!.status && !busy).map(st => STATUS_ITEM[st])
    : []

  return (
    <div className="screen-col">
      <div className="scroll" ref={scrollRef}>
        <div className={scrolled ? 'page-bar scrolled' : 'page-bar'}>
          <button type="button" className="btn btn-plain page-back" onClick={onBack}><ChevronLeft size={17} />{backLabel}</button>
          <div className="page-bar-title" aria-hidden={!scrolled}>{inf.name}</div>
          <div className="page-bar-actions">
            <button type="button" className="btn btn-ghost" aria-label="Edit" onClick={onEdit}><Pencil size={14} /><span className="hide-mobile">Edit</span></button>
            <button type="button" className="btn btn-blue" onClick={onAddToCampaign}><BookmarkPlus size={14} />Add to Campaign</button>
            {menuItems.length > 0 && <Menu items={menuItems} label="Status" />}
          </div>
        </div>

        <div className="profile">
          <header ref={heroRef} className="profile-hero">
            <Avatar inf={inf} size={76} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 className="profile-name">{inf.name}</h1>
              <a className="profile-handle" href={igUrl(inf.handle)} target="_blank" rel="noopener">{inf.handle}</a>
              <div className="profile-loc">
                <span><MapPin size={13} />{locStr}</span>
                {inf.langs.length > 0 && <span><Languages size={13} />{inf.langs.join(', ')}</span>}
              </div>
              <div style={{ marginTop: 10 }}><CategoryBadges cats={inf.cats} large /></div>
              {/* the ways to reach them, right under the name (as in Contacts) */}
              <div className="profile-reach">
                <a className="btn btn-tint" href={igUrl(inf.handle)} target="_blank" rel="noopener">Instagram<ArrowUpRight size={15} /></a>
                {inf.email
                  ? <a className="btn btn-ghost" href={`mailto:${inf.email}`}><Mail size={14} />Email</a>
                  : <span className="btn btn-ghost" aria-disabled="true" title="No email on file" style={{ opacity: 0.4, cursor: 'default' }}><Mail size={14} />Email</span>}
                {inf.phone
                  ? <a className="btn btn-ghost" href={`tel:${inf.phone.replace(/\s+/g, '')}`}><Phone size={14} />Call</a>
                  : <span className="btn btn-ghost" aria-disabled="true" title="No phone on file" style={{ opacity: 0.4, cursor: 'default' }}><Phone size={14} />Call</span>}
              </div>
              {inf.api && inf.api.status !== 'ACTIVE' && (
                <div className="profile-status">
                  <Pill tone={STATUS_TONE[inf.api.status]}>{STATUS_LABEL[inf.api.status]}</Pill>
                  {inf.api.statusReason && <span>“{inf.api.statusReason}”</span>}
                </div>
              )}
            </div>
          </header>

          <section className="card profile-card">
            <div className="profile-card-head">
              <h3>Metrics</h3>
              <span className="profile-card-aside"><FreshPill fr={fr} /> {dstr(inf.updatedAt)}</span>
            </div>
            <div className="profile-stats">
              {stats.map(s => (
                <div key={s.label}>
                  <div className={s.up ? 'mono up' : 'mono'}>{s.value}</div>
                  <div className="profile-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </section>

          <div className="profile-cols">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <section className="card profile-card">
                <h3>About</h3>
                <p className="profile-bio">{inf.bio || <span className="muted">No bio yet</span>}</p>
              </section>

              <section className="card profile-card">
                <h3>Campaigns</h3>
                {history.length ? (
                  <ul className="hist-list">
                    {history.map(h => (
                      <li key={h.campaignId}>
                        <div className="hist-main">
                          <Link to={`/campaigns/${h.campaignId}?member=${inf.id}`} className="hist-name">{h.name}</Link>
                          <div className="hist-meta">{h.brand} · {fmtDate(h.startDate)}{h.campaignStatus !== 'ACTIVE' && ` · ${CAMPAIGN_STATUS_LABEL[h.campaignStatus]}`}</div>
                        </div>
                        <div className="hist-side">
                          <Pill tone={STAGE_TONE[h.stage]}>{STAGE_LABEL[h.stage]}</Pill>
                          {h.deliverables > 0 && <span className="hist-meta">{h.posted}/{h.deliverables} posted</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : memberships.kind === 'loading' ? (
                  <RowsSkeleton rows={2} label="Loading campaign history" />
                ) : (
                  <div className="muted" style={{ fontSize: 13 }}>
                    {memberships.kind === 'error' ? 'Couldn’t load campaign history' : 'Not in any campaign yet'}
                  </div>
                )}
                {inf.camps.length > 0 && (
                  <>
                    <div className="label" style={{ marginTop: 6 }}>Before InfluenceIQ</div>
                    <ul className="hist-list">
                      {inf.camps.map(c => (
                        <li key={c.name + c.date}>
                          <div className="hist-main">
                            <div className="hist-name plain">{c.name}</div>
                            <div className="hist-meta">{c.brand} · {c.date} · {c.del}</div>
                          </div>
                          <div className="hist-side"><Pill tone={STATUS_COLORS[c.status]}>{c.status}</Pill></div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <section className="card profile-card">
                <h3>Contact</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {inf.email ? <a className="contact-row" href={`mailto:${inf.email}`}><Mail size={14} />{inf.email}</a>
                    : <div className="contact-row muted"><Mail size={14} />No email</div>}
                  {inf.phone ? <a className="contact-row" href={`tel:${inf.phone.replace(/\s+/g, '')}`}><Phone size={14} />{inf.phone}</a>
                    : <div className="contact-row muted"><Phone size={14} />No phone</div>}
                </div>
              </section>

              <section className="card profile-card">
                <div className="profile-card-head">
                  <h3>Pricing</h3>
                  <span className="profile-card-aside" title={rateFr.label} style={{ color: rateFr.fg }}>
                    <span className="dot" style={{ background: rateFr.dot }} />as of {mon(inf.rates[0].date)}
                  </span>
                </div>
                <div>
                  {(['story', 'reel', 'post'] as const).map(k => (
                    <div key={k} className="price-row">
                      <span>{k[0].toUpperCase() + k.slice(1)}</span>
                      <span className="mono">{inf.pricing[k] || '—'}</span>
                    </div>
                  ))}
                </div>
                {inf.rates.length > 1 && (
                  <>
                    <button type="button" className="btn btn-plain btn-sm link-btn" aria-expanded={histOpen} onClick={() => setHistOpen(!histOpen)}>
                      {histOpen ? 'Hide rate history' : `Rate history (${inf.rates.length - 1} earlier)`}
                    </button>
                    {histOpen && (
                      <div className="rate-hist">
                        <div className="rate-hist-row rate-hist-head">
                          <span>From</span><span>Story</span><span>Reel</span><span>Post</span>
                        </div>
                        {inf.rates.map((r, k) => (
                          <div key={r.date} className="rate-hist-row mono" style={{ color: k === 0 ? 'var(--iq-fg-1)' : 'var(--iq-fg-3)' }}>
                            <span>{mon(r.date)}{k === 0 && ' · now'}</span>
                            <span>{r.story}</span><span>{r.reel}</span><span>{r.post}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>

              {inf.tags.length > 0 && (
                <section className="card profile-card">
                  <h3>Top hashtags</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                    {inf.tags.map(t => <span key={t} className="hashtag" style={{ fontSize: 13 }}>{t}</span>)}
                  </div>
                </section>
              )}

              <section className="card profile-card">
                <div className="profile-card-head">
                  <h3>Notes</h3>
                  {noteDraft != null ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNoteDraft(null); setNoteError('') }}>Cancel</button>
                      <button type="button" className="btn btn-blue btn-sm" disabled={busy} onClick={() => saveNote(noteDraft)}>{busy ? 'Saving…' : 'Save'}</button>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-plain btn-sm link-btn" style={{ margin: 0 }} onClick={() => setNoteDraft(inf.note)}>Edit</button>
                  )}
                </div>
                {noteDraft != null ? (
                  <textarea className="input" rows={4} autoFocus aria-label="Notes" value={noteDraft}
                    style={{ minHeight: 80, lineHeight: 1.55 }} onChange={e => setNoteDraft(e.target.value)} />
                ) : (
                  <p className="profile-note">{inf.note || <span className="muted">No notes yet</span>}</p>
                )}
                {noteError && <div role="alert" style={{ fontSize: 12, color: 'var(--iq-danger)' }}>{noteError}</div>}
              </section>
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {statusAsk && (
          <ReasonDialog key="status"
            title={`Mark ${inf.name} as ${STATUS_LABEL[statusAsk].toLowerCase()}?`}
            message={statusAsk === 'BANNED' ? 'Banned influencers are hidden from search and can’t be added to campaigns.' : undefined}
            reasonLabel="Reason *"
            confirmLabel={`Mark ${STATUS_LABEL[statusAsk].toLowerCase()}`}
            danger={statusAsk === 'BANNED'}
            onConfirm={async reason => {
              if (!reason.trim()) return 'Please give a reason'
              try {
                await applyStatus(statusAsk, reason.trim())
                return ''
              } catch (e) {
                return message(e)
              }
            }}
            onClose={() => setStatusAsk(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
