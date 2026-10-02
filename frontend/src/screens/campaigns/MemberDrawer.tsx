import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ExternalLink, Lock, X } from 'lucide-react'
import { useStore } from '../../store'
import { inr } from '../../lib/format'
import {
  agreeTerms, changeFee, COMPENSATION_LABEL, DELIVERABLE_LABEL, displayStage, isReadOnly, markPosted, recordPayment,
  removeBlocker, removeMember, reviewDraft, setMemberNotes, setStage, STAGE_LABEL, stageMoves, submitDraft, suggestedFee,
  today, writeOffPayment, type Terms,
} from '../../lib/campaigns'
import { DELIVERABLE_STATUS_LABEL, DELIVERABLE_TONE, fmtDate, PAYMENT_LABEL, PAYMENT_TONE, STAGE_TONE } from '../../lib/campaignUi'
import type { Campaign, Compensation, Deliverable, Influencer, Member, MemberStage } from '../../types'
import { Avatar, IgLink, Pill } from '../../components/ui'
import { ReasonDialog } from '../../components/ReasonDialog'
import '../../overlays/overlays.css'

type Props = { campaign: Campaign; member: Member; influencer?: Influencer; onClose: () => void }

type Confirm = { title: string; reasonLabel?: string; confirmLabel: string; danger?: boolean; run: (reason: string) => string }

export function MemberDrawer({ campaign: c, member: m, influencer: inf, onClose }: Props) {
  const { runCampaign } = useStore()
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const readOnly = isReadOnly(c)
  const stage = displayStage(m)
  const name = inf?.name ?? `Influencer #${m.influencerId}`

  /** Runs a rule; shows its error in the drawer. */
  const run = (fn: (x: Campaign) => Campaign) => {
    const err = runCampaign(c.id, fn)
    setError(err)
    return err
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !confirm && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, confirm])

  const moveTo = (to: MemberStage, label: string, needsReason: boolean) =>
    setConfirm({
      title: `${label}: ${name}`,
      reasonLabel: needsReason ? 'Reason *' : to === 'DECLINED' ? 'Reason (optional)' : undefined,
      confirmLabel: label,
      danger: to === 'DECLINED',
      run: reason => runCampaign(c.id, x => setStage(x, m.influencerId, to, reason)),
    })

  const blocker = removeBlocker(m)

  return (
    <div className="overlay" style={{ justifyContent: 'flex-end', zIndex: 220 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="md-title">
        <div className="drawer-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {inf && <Avatar inf={inf} size={32} />}
            <div style={{ minWidth: 0 }}>
              <div id="md-title" style={{ fontSize: 14, fontWeight: 600 }}>
                {inf ? <Link to={`/influencers/${inf.id}`} state={{ backLabel: c.name }} style={{ color: 'inherit' }}>{name}</Link> : name}
              </div>
              <div style={{ fontSize: 11 }}>{inf && <IgLink handle={inf.handle} />} <span className="muted">· {c.name}</span></div>
            </div>
          </div>
          <button type="button" className="btn btn-plain" aria-label="Close" style={{ padding: 4, color: 'var(--cs-fg-3)' }} onClick={onClose}><X size={16} /></button>
        </div>

        <div className="drawer-body">
          {readOnly && <div className="camp-readonly"><Lock size={12} />Campaign is read-only. Reopen it to make changes.</div>}

          {/* ---- Stage ---- */}
          <section className="md-section">
            <div className="label">Stage</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Pill tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Pill>
              <span className="muted" style={{ fontSize: 11 }}>since {fmtDate(m.stageUpdatedAt)} · {m.stageUpdatedBy}</span>
            </div>
            {m.stageReason && <div className="md-quote">“{m.stageReason}”</div>}
            {!readOnly && (
              <div className="md-actions">
                {stageMoves(m).map(mv => (
                  <button key={mv.to} type="button" className={mv.to === 'DECLINED' ? 'btn btn-ghost md-danger' : 'btn btn-ghost'} onClick={() => moveTo(mv.to, mv.label, mv.needsReason)}>
                    {mv.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ---- Terms ---- */}
          {m.stage === 'NEGOTIATING' && !readOnly && inf && <TermsForm inf={inf} onAgree={t => run(x => agreeTerms(x, m.influencerId, t))} />}
          {m.stage === 'AGREED' && (
            <section className="md-section">
              <div className="label">Agreed terms</div>
              <div className="md-terms">
                <span>{COMPENSATION_LABEL[m.compensation]}</span>
                {m.agreedFee != null && <span className="mono">{inr(m.agreedFee)}</span>}
                <span className="muted">{(['REEL', 'STORY', 'POST'] as const).map(t => {
                  const n = m.deliverables.filter(d => d.type === t).length
                  return n ? `${n} ${DELIVERABLE_LABEL[t].toLowerCase()}${n > 1 ? 's' : ''}` : ''
                }).filter(Boolean).join(' · ')}</span>
              </div>
              {!readOnly && m.compensation !== 'BARTER' && <FeeChanger fee={m.agreedFee} onChange={(fee, reason) => run(x => changeFee(x, m.influencerId, fee, reason))} />}
            </section>
          )}

          {/* ---- Deliverables ---- */}
          {m.stage === 'AGREED' && (
            <section className="md-section">
              <div className="label">Deliverables</div>
              {m.deliverables.map(d => (
                <DeliverableCard key={d.id} d={d} readOnly={readOnly}
                  onSubmit={url => run(x => submitDraft(x, m.influencerId, d.id, url))}
                  onReview={(decision, feedback) => run(x => reviewDraft(x, m.influencerId, d.id, decision, feedback))}
                  onPosted={(url, date) => run(x => markPosted(x, m.influencerId, d.id, url, date))} />
              ))}
            </section>
          )}

          {/* ---- Payment ---- */}
          {m.stage === 'AGREED' && (
            <section className="md-section">
              <div className="label">Payment</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                <Pill tone={PAYMENT_TONE[m.paymentStatus]}>{PAYMENT_LABEL[m.paymentStatus]}</Pill>
                {m.compensation === 'BARTER'
                  ? <span className="muted">Barter: no cash payment</span>
                  : <span className="mono">{inr(m.amountPaid)} <span className="muted">of {m.agreedFee != null ? inr(m.agreedFee) : '—'}</span></span>}
                {m.paidAt && <span className="muted">last paid {fmtDate(m.paidAt)} · {m.paymentRef}</span>}
              </div>
              {m.paymentReason && <div className="md-quote">Written off: “{m.paymentReason}”</div>}
              {!readOnly && (m.paymentStatus === 'DUE' || m.paymentStatus === 'PARTIALLY_PAID') && (
                <PaymentForm remaining={Math.max(0, (m.agreedFee ?? 0) - m.amountPaid)}
                  onPay={(amount, date, ref) => run(x => recordPayment(x, m.influencerId, amount, date, ref))}
                  onWriteOff={() => setConfirm({
                    title: `Write off payment: ${name}`, reasonLabel: 'Reason *', confirmLabel: 'Write off', danger: true,
                    run: reason => runCampaign(c.id, x => writeOffPayment(x, m.influencerId, reason)),
                  })} />
              )}
            </section>
          )}

          {/* ---- Notes ---- */}
          <section className="md-section">
            <div className="label">Notes</div>
            <NotesEditor value={m.notes} readOnly={readOnly} onSave={v => run(x => setMemberNotes(x, m.influencerId, v))} />
          </section>

          {!readOnly && (
            <section className="md-section">
              <button type="button" className="btn btn-ghost md-danger" disabled={!!blocker} title={blocker || undefined}
                onClick={() => setConfirm({
                  title: `Remove ${name} from ${c.name}?`, confirmLabel: 'Remove', danger: true,
                  run: () => {
                    const err = runCampaign(c.id, x => removeMember(x, m.influencerId))
                    if (!err) onClose()
                    return err
                  },
                })}>
                Remove from campaign
              </button>
              {blocker && <div className="muted" style={{ fontSize: 11 }}>Can’t remove: {blocker.toLowerCase()}.</div>}
            </section>
          )}
        </div>

        {error && <div className="drawer-foot"><div role="alert" style={{ fontSize: 12, color: 'var(--cs-down)', whiteSpace: 'pre-line' }}>{error}</div></div>}
      </div>

      {confirm && (
        <ReasonDialog title={confirm.title} reasonLabel={confirm.reasonLabel} confirmLabel={confirm.confirmLabel} danger={confirm.danger}
          onConfirm={confirm.run} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}

function TermsForm({ inf, onAgree }: { inf: Influencer; onAgree: (t: Terms) => string }) {
  const [compensation, setCompensation] = useState<Compensation>('CASH')
  const [counts, setCounts] = useState({ REEL: 1, STORY: 0, POST: 0 })
  const [fee, setFee] = useState('')
  const suggestion = suggestedFee(inf, counts)
  const setCount = (t: keyof typeof counts) => (e: { target: { value: string } }) => setCounts(p => ({ ...p, [t]: Math.max(0, Math.floor(+e.target.value || 0)) }))

  return (
    <section className="md-section">
      <div className="label">Agree terms</div>
      <div className="form-grid-3">
        {(['REEL', 'STORY', 'POST'] as const).map(t => (
          <label key={t} className="field"><span>{DELIVERABLE_LABEL[t]}s</span>
            <input type="number" min={0} className="input mono" value={counts[t]} onChange={setCount(t)} />
          </label>
        ))}
      </div>
      <div className="form-grid-2">
        <label className="field"><span>Compensation</span>
          <select className="input" value={compensation} onChange={e => setCompensation(e.target.value as Compensation)}>
            {(Object.keys(COMPENSATION_LABEL) as Compensation[]).map(k => <option key={k} value={k}>{COMPENSATION_LABEL[k]}</option>)}
          </select>
        </label>
        {compensation !== 'BARTER' && (
          <label className="field"><span>Agreed fee (₹)</span>
            <input type="number" min={0} className="input mono" placeholder="₹" value={fee} onChange={e => setFee(e.target.value)} />
          </label>
        )}
      </div>
      {compensation !== 'BARTER' && suggestion != null && (
        <button type="button" className="btn btn-plain btn-sm" style={{ color: 'var(--cs-blueberry-500)', alignSelf: 'flex-start', fontWeight: 400 }} onClick={() => setFee(String(suggestion))}>
          Use rate card: {inr(suggestion)}
        </button>
      )}
      <div className="md-actions">
        <button type="button" className="btn btn-blue" onClick={() => onAgree({ compensation, fee: fee.trim() ? +fee : null, counts })}>Agree terms</button>
      </div>
    </section>
  )
}

function FeeChanger({ fee, onChange }: { fee: number | null; onChange: (fee: number, reason: string) => string }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(fee != null ? String(fee) : '')
  const [reason, setReason] = useState('')
  if (!open) return <button type="button" className="btn btn-plain btn-sm" style={{ alignSelf: 'flex-start', fontWeight: 400 }} onClick={() => setOpen(true)}>Change fee…</button>
  return (
    <div className="md-box">
      <div className="form-grid-2">
        <label className="field"><span>New fee (₹)</span><input type="number" min={0} className="input mono" value={value} onChange={e => setValue(e.target.value)} /></label>
        <label className="field"><span>Reason *</span><input className="input" autoComplete="off" value={reason} onChange={e => setReason(e.target.value)} /></label>
      </div>
      <div className="md-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="btn btn-blue" onClick={() => { if (!onChange(+value, reason)) setOpen(false) }}>Save fee</button>
      </div>
    </div>
  )
}

function DeliverableCard({ d, readOnly, onSubmit, onReview, onPosted }: {
  d: Deliverable
  readOnly: boolean
  onSubmit: (url: string) => string
  onReview: (decision: 'APPROVED' | 'CHANGES_REQUESTED', feedback: string) => string
  onPosted: (url: string, date: string) => string
}) {
  const [url, setUrl] = useState('')
  const [feedback, setFeedback] = useState('')
  const [date, setDate] = useState(today())
  const clear = (err: string) => { if (!err) { setUrl(''); setFeedback('') } }
  const n = d.id.split('-')[1]

  return (
    <div className="md-box">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <b style={{ fontSize: 13 }}>{DELIVERABLE_LABEL[d.type]} {n}</b>
        <Pill tone={DELIVERABLE_TONE[d.status]}>{DELIVERABLE_STATUS_LABEL[d.status]}</Pill>
      </div>

      {d.revisions.length > 0 && (
        <ol className="md-revisions">
          {d.revisions.map(r => (
            <li key={r.round}>
              <div>
                <span className="muted">Round {r.round} · {fmtDate(r.submittedAt)} · </span>
                <a href={r.draftUrl} target="_blank" rel="noopener">draft <ExternalLink size={10} /></a>
                {r.decision && <span className="muted"> · {r.decision === 'APPROVED' ? 'approved' : 'changes requested'} by {r.reviewedBy}</span>}
              </div>
              {r.feedback && <div className="md-quote">“{r.feedback}”</div>}
            </li>
          ))}
        </ol>
      )}

      {d.status === 'POSTED' && d.liveUrl && (
        <div style={{ fontSize: 12 }}>Live {fmtDate(d.postedAt)} · <a href={d.liveUrl} target="_blank" rel="noopener">view post <ExternalLink size={10} /></a></div>
      )}

      {!readOnly && (d.status === 'AWAITING_DRAFT' || d.status === 'CHANGES_REQUESTED') && (
        <div className="md-inline">
          <input className="input input-sm" autoComplete="off" placeholder="Draft link (Drive, Dropbox, Instagram preview…)" value={url} onChange={e => setUrl(e.target.value)} />
          <button type="button" className="btn btn-blue" onClick={() => clear(onSubmit(url))}>{d.revisions.length ? 'Resubmit draft' : 'Submit draft'}</button>
        </div>
      )}

      {!readOnly && d.status === 'IN_REVIEW' && (
        <>
          <textarea className="input input-sm" rows={2} placeholder="Feedback (required to request changes)" value={feedback} onChange={e => setFeedback(e.target.value)} />
          <div className="md-actions">
            <button type="button" className="btn btn-ghost" onClick={() => clear(onReview('CHANGES_REQUESTED', feedback))}>Request changes</button>
            <button type="button" className="btn btn-blue" onClick={() => clear(onReview('APPROVED', feedback))}>Approve</button>
          </div>
        </>
      )}

      {!readOnly && d.status === 'APPROVED' && (
        <div className="md-inline">
          <input className="input input-sm" autoComplete="off" placeholder="Live post link (instagram.com/…)" value={url} onChange={e => setUrl(e.target.value)} />
          <input type="date" className="input input-sm" style={{ width: 'auto' }} aria-label="Date posted" value={date} onChange={e => setDate(e.target.value)} />
          <button type="button" className="btn btn-blue" onClick={() => clear(onPosted(url, date))}>Mark posted</button>
        </div>
      )}
    </div>
  )
}

function PaymentForm({ remaining, onPay, onWriteOff }: { remaining: number; onPay: (amount: number, date: string, ref: string) => string; onWriteOff: () => void }) {
  const [amount, setAmount] = useState(remaining ? String(remaining) : '')
  const [date, setDate] = useState(today())
  const [ref, setRef] = useState('')
  return (
    <div className="md-box">
      <div className="form-grid-3">
        <label className="field"><span>Amount (₹)</span><input type="number" min={0} className="input mono" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <label className="field"><span>Paid on</span><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="field"><span>Reference</span><input className="input" autoComplete="off" placeholder="UTR / UPI id" value={ref} onChange={e => setRef(e.target.value)} /></label>
      </div>
      <div className="md-actions">
        <button type="button" className="btn btn-ghost md-danger" onClick={onWriteOff}>Write off…</button>
        <button type="button" className="btn btn-blue" onClick={() => { if (!onPay(+amount, date, ref)) setRef('') }}>Record payment</button>
      </div>
    </div>
  )
}

function NotesEditor({ value, readOnly, onSave }: { value: string; readOnly: boolean; onSave: (v: string) => string }) {
  const [draft, setDraft] = useState(value)
  if (readOnly) return <p style={{ margin: 0, fontSize: 12, color: 'var(--cs-fg-2)', whiteSpace: 'pre-wrap' }}>{value || <span className="muted">No notes</span>}</p>
  return (
    <>
      <textarea className="input" rows={3} placeholder="Negotiation notes, contact preferences…" value={draft} onChange={e => setDraft(e.target.value)} />
      {draft !== value && (
        <div className="md-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setDraft(value)}>Discard</button>
          <button type="button" className="btn btn-blue" onClick={() => onSave(draft)}>Save notes</button>
        </div>
      )}
    </>
  )
}
