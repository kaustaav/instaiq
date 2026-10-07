import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AlertTriangle, ArrowLeft, Copy, Download, Lock, Pencil, UserPlus, Users, WifiOff } from 'lucide-react'
import { useStore } from '../../store'
import { apiEnabled, errorText } from '../../api/client'
import {
  agreeTermsApi, changeCampaignStatusApi, changeFeeApi, duplicateCampaignApi, markPostedApi, recordPaymentApi, removeMemberApi,
  reviewDraftApi, setMemberNotesApi, setMemberStageApi, submitDraftApi, updateCampaignApi, writeOffPaymentApi,
} from '../../api/campaigns'
import { useCampaignDetail } from '../../hooks/useCampaigns'
import { fmt, igUrl, inr } from '../../lib/format'
import {
  ACTION_LABEL, ACTION_NEEDS_REASON, amountPaid, budgetUsed, CAMPAIGN_STATUS_LABEL, changeStatus, COMPENSATION_LABEL, DISPLAY_STAGES,
  displayStage, editCampaign, isReadOnly, STAGE_LABEL, STATUS_ACTIONS, statusBlockers, type StatusAction,
} from '../../lib/campaigns'
import { CAMPAIGN_TONE, fmtDate, fmtRange, PAYMENT_LABEL, PAYMENT_TONE, STAGE_TONE } from '../../lib/campaignUi'
import { paginate } from '../../lib/paginate'
import { useScrollTopOnChange } from '../../hooks/useScrollTopOnChange'
import type { Campaign, DisplayStage, Influencer, Member } from '../../types'
import { EmptyState, PersonCell, Pill } from '../../components/ui'
import { Pagination } from '../../components/Pagination'
import { ReasonDialog } from '../../components/ReasonDialog'
import { CampaignFormDrawer } from './CampaignFormDrawer'
import { MemberDrawer } from './MemberDrawer'
import { TargetsChart } from './TargetsChart'
import './campaigns.css'

const PAGE_SIZE = 50
const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`

function exportCsv(c: Campaign, infOf: (id: number) => Influencer | undefined) {
  const header = ['Name', 'Handle', 'Instagram URL', 'Stage', 'Compensation', 'Agreed fee', 'Paid', 'Payment', 'Receipts', 'Deliverables', 'Live links', 'Cities', 'Categories', 'Followers']
  const lines = c.members.map(m => {
    const i = infOf(m.influencerId)
    const posted = m.deliverables.filter(d => d.status === 'POSTED')
    return [
      i?.name ?? '', i?.handle ?? '', i ? igUrl(i.handle) : '', STAGE_LABEL[displayStage(m)], COMPENSATION_LABEL[m.compensation],
      m.agreedFee != null ? String(m.agreedFee) : '', String(amountPaid(m)), PAYMENT_LABEL[m.paymentStatus],
      m.payments.map(p => p.receiptUrl).join(' '),
      `${posted.length}/${m.deliverables.length}`, posted.map(d => d.liveUrl).join(' '), i?.cities.join('/') ?? '',
      i?.cats.join('/') ?? '', i ? fmt(i.followers) : '',
    ].map(csvCell).join(',')
  })
  const url = URL.createObjectURL(new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' }))
  Object.assign(document.createElement('a'), { href: url, download: `${c.name}.csv` }).click()
  URL.revokeObjectURL(url)
}

/** Short progress line for a member's deliverables. */
function deliverableSummary(m: Member) {
  if (!m.deliverables.length) return '—'
  const n = (s: string) => m.deliverables.filter(d => d.status === s).length
  const parts = [`${n('POSTED')}/${m.deliverables.length} posted`]
  if (n('IN_REVIEW')) parts.push(`${n('IN_REVIEW')} to review`)
  if (n('CHANGES_REQUESTED')) parts.push(`${n('CHANGES_REQUESTED')} awaiting changes`)
  return parts.join(' · ')
}

type Dialog = { action: StatusAction; blockers: string[] }

/** /campaigns/:id?stage=&member=&page= */
export function CampaignDetailScreen() {
  const { runCampaign, duplicateCampaign, dataChanged } = useStore()
  const { id } = useParams()
  const api = apiEnabled()
  const detail = useCampaignDetail(id) // built-in campaigns, or the API
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const c = detail.kind === 'ready' ? detail.data.campaign : undefined
  const stageParam = params.get('stage')
  const stage = DISPLAY_STAGES.find(s => s === stageParam) ?? null
  const memberId = Number(params.get('member')) || null
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const setParam = (patch: Record<string, string | null>, replace = false) => {
    const p = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
    setParams(p, { replace })
  }

  const filtered = c ? c.members.filter(m => !stage || displayStage(m) === stage) : []
  const rows = paginate(filtered, page, PAGE_SIZE)
  useScrollTopOnChange(scrollRef, rows.page)

  if (detail.kind === 'loading') {
    return <div className="screen-col" style={{ justifyContent: 'center' }}><div className="empty"><div className="empty-sub">Loading campaign…</div></div></div>
  }
  if (detail.kind === 'error') {
    return (
      <div className="screen-col" style={{ justifyContent: 'center' }}>
        <EmptyState icon={WifiOff} title="Couldn’t load this campaign" sub={detail.message} />
        <div style={{ textAlign: 'center' }}><button type="button" className="btn btn-ghost" onClick={detail.retry}>Try again</button></div>
      </div>
    )
  }
  if (!c || detail.kind !== 'ready') {
    return (
      <div className="screen-col" style={{ justifyContent: 'center' }}>
        <EmptyState icon={Users} title="Campaign not found" sub="It may have been removed, or the link is wrong." />
        <div style={{ textAlign: 'center' }}><Link to="/campaigns">Back to campaigns</Link></div>
      </div>
    )
  }

  const infOf = detail.data.infOf
  const nameOf = (iid: number) => infOf(iid)?.name ?? `Influencer #${iid}`
  const readOnly = isReadOnly(c)
  const used = budgetUsed(c)
  const over = c.budget != null && used > c.budget
  const counts = new Map<DisplayStage, number>()
  c.members.forEach(m => counts.set(displayStage(m), (counts.get(displayStage(m)) ?? 0) + 1))
  const member = memberId != null ? c.members.find(m => m.influencerId === memberId) : undefined

  const openAction = (action: StatusAction) => setDialog({ action, blockers: statusBlockers(c, action, nameOf) })

  /** API mode: run one write, refresh everything on success; '' or the error text (for dialogs and drawers). */
  const save = async (call: () => Promise<unknown>) => {
    try {
      await call()
      dataChanged()
      return ''
    } catch (e) {
      return errorText(e)
    }
  }

  const duplicate = async () => {
    if (!api) return navigate(`/campaigns/${duplicateCampaign(c.id).id}`)
    try {
      const copy = await duplicateCampaignApi(c.id)
      dataChanged()
      navigate(`/campaigns/${copy.id}`)
    } catch (e) {
      window.alert(errorText(e))
    }
  }

  return (
    <div className="screen-col" style={{ background: 'var(--iq-gray-50)' }}>
      <div className="crumbs">
        <Link to="/campaigns" className="btn btn-plain" style={{ fontSize: 13, fontWeight: 400, padding: '4px 8px' }}><ArrowLeft size={13} />Campaigns</Link>
      </div>

      <div className="scroll" ref={scrollRef}>
        <div className="camp-detail">
          <section className="card camp-head">
            <div className="camp-head-top">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="camp-card-title">
                  <h1 className="camp-head-name">{c.name}</h1>
                  <Pill tone={CAMPAIGN_TONE[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Pill>
                </div>
                <div className="camp-card-meta">{c.brand} · {fmtRange(c.startDate, c.endDate)}</div>
                {c.statusReason && (
                  <div className="camp-card-meta" title={`by ${c.statusChangedBy}, ${fmtDate(c.statusChangedAt)}`}>
                    {CAMPAIGN_STATUS_LABEL[c.status]} · “{c.statusReason}”
                  </div>
                )}
              </div>
              <div className="camp-actions">
                {STATUS_ACTIONS[c.status].map(a => (
                  <button key={a} type="button" className={a === 'complete' || a === 'activate' ? 'btn btn-blue' : 'btn btn-ghost'} onClick={() => openAction(a)}>
                    {ACTION_LABEL[a]}
                  </button>
                ))}
                <button type="button" className="btn btn-ghost" disabled={readOnly} title={readOnly ? 'Read-only' : undefined} onClick={() => setEditing(true)}><Pencil size={12} />Edit</button>
                <button type="button" className="btn btn-ghost" title="Same setup, no influencers" onClick={duplicate}><Copy size={12} />Duplicate</button>
                <button type="button" className="btn btn-ghost" disabled={!c.members.length} onClick={() => exportCsv(c, infOf)}><Download size={12} />CSV</button>
              </div>
            </div>

            <div>
              <TargetsChart c={c} />
              {over && <div className="camp-warn"><AlertTriangle size={12} />Over budget by {inr(used - (c.budget ?? 0))}</div>}
            </div>

            {c.brief && <p className="camp-brief">{c.brief}</p>}
            {readOnly && (
              <div className="camp-readonly"><Lock size={12} />This campaign is {CAMPAIGN_STATUS_LABEL[c.status].toLowerCase()} and read-only. Reopen it to make changes.</div>
            )}
          </section>

          <div className="camp-members-head">
            <div className="chips">
              <button type="button" className="chip" aria-pressed={!stage}
                style={{ background: !stage ? 'var(--iq-navy)' : 'white', color: !stage ? 'white' : 'var(--iq-fg-2)', borderColor: 'var(--iq-border)', padding: '4px 10px' }}
                onClick={() => setParam({ stage: null, page: null })}>
                All {c.members.length}
              </button>
              {DISPLAY_STAGES.filter(s => counts.get(s)).map(s => (
                <button key={s} type="button" className="chip" aria-pressed={stage === s}
                  style={{ background: stage === s ? 'var(--iq-navy)' : 'white', color: stage === s ? 'white' : 'var(--iq-fg-2)', borderColor: 'var(--iq-border)', padding: '4px 10px' }}
                  onClick={() => setParam({ stage: s, page: null })}>
                  {STAGE_LABEL[s]} {counts.get(s)}
                </button>
              ))}
            </div>
            {!readOnly && (
              <Link to="/search" className="btn btn-ghost" title="Use “+ Shortlist” or “Add all to campaign” on the search page"><UserPlus size={12} />Add influencers</Link>
            )}
          </div>

          {c.members.length === 0 ? (
            <EmptyState icon={Users} title="No influencers yet" sub="Add them from Search with “+ Shortlist” or “Add all to campaign”" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th className="pin">Influencer</th><th>Stage</th><th>Deliverables</th><th className="r">Fee</th><th>Payment</th></tr>
                </thead>
                <tbody>
                  {rows.items.map(m => {
                    const inf = infOf(m.influencerId)
                    const s = displayStage(m)
                    return (
                      <tr key={m.influencerId} className="clickable" onClick={() => setParam({ member: String(m.influencerId) })}>
                        <td className="pin">{inf ? <PersonCell inf={inf} /> : nameOf(m.influencerId)}</td>
                        <td><Pill tone={STAGE_TONE[s]} title={m.stageReason}>{STAGE_LABEL[s]}</Pill></td>
                        <td className="sub">{deliverableSummary(m)}</td>
                        <td className="num">{m.stage !== 'AGREED' ? '—' : m.compensation === 'BARTER' ? 'Barter' : m.agreedFee != null ? inr(m.agreedFee) : '—'}</td>
                        <td>{m.stage === 'AGREED' ? <Pill tone={PAYMENT_TONE[m.paymentStatus]}>{PAYMENT_LABEL[m.paymentStatus]}</Pill> : <span className="muted">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={rows} onPage={p => setParam({ page: String(p) })} />
        </div>
      </div>

      {member && (
        <MemberDrawer key={member.influencerId} campaign={c} member={member} influencer={infOf(member.influencerId)}
          onClose={() => setParam({ member: null })}
          api={api ? {
            agree: t => save(() => agreeTermsApi(c.id, member.influencerId, t)),
            submitDraft: (d, url) => save(() => submitDraftApi(c.id, member.influencerId, d, url)),
            review: (d, decision, feedback) => save(() => reviewDraftApi(c.id, member.influencerId, d, decision, feedback)),
            posted: (d, url, date) => save(() => markPostedApi(c.id, member.influencerId, d, url, date)),
            pay: (amount, date, receipt) => save(() => recordPaymentApi(c.id, member.influencerId, amount, date, receipt)),
            writeOff: reason => save(() => writeOffPaymentApi(c.id, member.influencerId, reason)),
            changeFee: (fee, reason) => save(() => changeFeeApi(c.id, member.influencerId, fee, reason)),
            setStage: (to, reason) => save(() => setMemberStageApi(c.id, member.influencerId, to, reason)),
            setNotes: notes => save(() => setMemberNotesApi(c.id, member.influencerId, notes)),
            remove: () => save(() => removeMemberApi(c.id, member.influencerId)),
          } : undefined} />
      )}

      {editing && (
        <CampaignFormDrawer editing={c} onClose={() => setEditing(false)}
          onSubmit={async input => {
            let err = ''
            if (api) {
              try {
                await updateCampaignApi(c.id, input, c.version)
                dataChanged()
              } catch (e) {
                err = errorText(e)
              }
            } else err = runCampaign(c.id, x => editCampaign(x, input))
            if (!err) setEditing(false)
            return err
          }} />
      )}

      {dialog && (dialog.blockers.length ? (
        <ReasonDialog title={`Can’t ${ACTION_LABEL[dialog.action].toLowerCase()} yet`} message={dialog.blockers.map(b => `• ${b}`).join('\n')}
          confirmLabel="OK" onConfirm={() => ''} onClose={() => setDialog(null)} />
      ) : (
        <ReasonDialog
          title={`${ACTION_LABEL[dialog.action]}: ${c.name}?`}
          message={dialog.action === 'complete' ? 'Every influencer is done and paid. The campaign becomes read-only.' : undefined}
          reasonLabel={ACTION_NEEDS_REASON[dialog.action] ? 'Reason *' : undefined}
          confirmLabel={ACTION_LABEL[dialog.action]}
          danger={dialog.action === 'cancel'}
          onConfirm={reason => (api
            ? save(() => changeCampaignStatusApi(c.id, dialog.action, reason))
            : runCampaign(c.id, x => changeStatus(x, dialog.action, reason, nameOf)))}
          onClose={() => setDialog(null)} />
      ))}
    </div>
  )
}
