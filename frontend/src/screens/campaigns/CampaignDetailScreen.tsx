import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AlertTriangle, Archive, ChevronLeft, CircleX, Copy, Download, Lock, Pencil, RotateCcw, UserPlus, Users, WifiOff } from 'lucide-react'
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
import { useScrolled } from '../../hooks/useScrolled'
import { Menu, type MenuItem } from '../../components/Menu'
import type { Campaign, DisplayStage, Influencer, Member } from '../../types'
import { EmptyState, PersonCell, Pill } from '../../components/ui'
import { Pagination } from '../../components/Pagination'
import { ReasonDialog } from '../../components/ReasonDialog'
import { CampaignFormDrawer } from './CampaignFormDrawer'
import { MemberDrawer } from './MemberDrawer'
import { TargetsChart } from './TargetsChart'
import './campaigns.css'
import { AnimatePresence } from 'motion/react'
import { CampaignDetailSkeleton } from '../../components/Skeletons'
import { notify } from '../../lib/notify'

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
  const scrolled = useScrolled(scrollRef, detail.kind === 'ready')

  if (detail.kind === 'loading') {
    return <CampaignDetailSkeleton />
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
      notify({ kind: 'success', text: 'Campaign duplicated' })
    } catch (e) {
      notify({ kind: 'error', text: errorText(e) })
    }
  }

  // one main action (the natural next step); everything else in the ••• menu, destructive last
  const [primary, ...otherActions] = STATUS_ACTIONS[c.status]
  const ACTION_ICON = { cancel: CircleX, archive: Archive, reopen: RotateCcw, unarchive: RotateCcw, activate: RotateCcw, complete: RotateCcw }
  const menuItems: MenuItem[] = [
    { label: 'Edit campaign', icon: Pencil, onSelect: () => setEditing(true), disabled: readOnly, hint: readOnly ? 'Read-only: reopen it first' : undefined },
    { label: 'Duplicate', icon: Copy, onSelect: duplicate, hint: 'Same setup, no influencers' },
    { label: 'Export CSV', icon: Download, onSelect: () => exportCsv(c, infOf), disabled: !c.members.length },
    ...(otherActions.length ? ['separator' as const] : []),
    ...otherActions.map(a => ({ label: ACTION_LABEL[a], icon: ACTION_ICON[a], danger: a === 'cancel', onSelect: () => openAction(a) })),
  ]
  const primaryIsBlue = primary === 'complete' || primary === 'activate'

  return (
    <div className="screen-col">
      <div className="scroll" ref={scrollRef}>
        {/* frosted bar: back, a compact title once the big one scrolls away, the main action and ••• */}
        <div className={scrolled ? 'page-bar scrolled' : 'page-bar'}>
          <Link to="/campaigns" className="btn btn-plain page-back"><ChevronLeft size={17} />Campaigns</Link>
          <div className="page-bar-title" aria-hidden={!scrolled}>{c.name}</div>
          <div className="page-bar-actions">
            {primary && (
              <button type="button" className={primaryIsBlue ? 'btn btn-blue' : 'btn btn-ghost'} onClick={() => openAction(primary)}>
                {ACTION_LABEL[primary]}
              </button>
            )}
            <Menu items={menuItems} label="Campaign actions" />
          </div>
        </div>

        <div className="camp-detail">
          <header className="page-title">
            <div className="page-title-row">
              <h1>{c.name}</h1>
              <Pill tone={CAMPAIGN_TONE[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Pill>
            </div>
            <div className="page-title-meta">{c.brand} · {fmtRange(c.startDate, c.endDate)}</div>
            {c.statusReason && (
              <div className="page-title-meta" title={`by ${c.statusChangedBy}, ${fmtDate(c.statusChangedAt)}`}>
                {CAMPAIGN_STATUS_LABEL[c.status]} · “{c.statusReason}”
              </div>
            )}
          </header>

          {readOnly && (
            <div className="camp-readonly"><Lock size={13} />This campaign is {CAMPAIGN_STATUS_LABEL[c.status].toLowerCase()} and read-only. Reopen it to make changes.</div>
          )}

          <section className="card camp-section">
            <h3>Targets</h3>
            <TargetsChart c={c} />
            {over && <div className="camp-warn"><AlertTriangle size={13} />Over budget by {inr(used - (c.budget ?? 0))}</div>}
          </section>

          {c.brief && (
            <section className="card camp-section">
              <h3>Brief</h3>
              <p className="camp-brief">{c.brief}</p>
            </section>
          )}

          <div className="camp-members-head">
            <h2>Influencers <span className="count">{c.members.length}</span></h2>
            {!readOnly && (
              <Link to="/search" className="btn btn-tint" title="Use “+ Shortlist” or “Add all to campaign” on the search page"><UserPlus size={14} />Add influencers</Link>
            )}
          </div>
          {c.members.length > 0 && (
            <div className="chips stage-filter" role="group" aria-label="Filter by stage">
              {[null, ...DISPLAY_STAGES.filter(s => counts.get(s))].map(s => {
                const on = stage === s
                return (
                  <button key={s ?? 'all'} type="button" className={on ? 'chip on' : 'chip'} aria-pressed={on}
                    onClick={() => setParam({ stage: s, page: null })}>
                    {s ? STAGE_LABEL[s] : 'All'} <span className="chip-count">{s ? counts.get(s) : c.members.length}</span>
                  </button>
                )
              })}
            </div>
          )}

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

      <AnimatePresence>
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
      </AnimatePresence>

      <AnimatePresence>
      {editing && (
        <CampaignFormDrawer key="edit" editing={c} onClose={() => setEditing(false)}
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
      </AnimatePresence>

      <AnimatePresence>
      {dialog && (dialog.blockers.length ? (
        <ReasonDialog key="blocked" title={`Can’t ${ACTION_LABEL[dialog.action].toLowerCase()} yet`} message={dialog.blockers.map(b => `• ${b}`).join('\n')}
          confirmLabel="OK" onConfirm={() => ''} onClose={() => setDialog(null)} />
      ) : (
        <ReasonDialog
          key="confirm"
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
      </AnimatePresence>
    </div>
  )
}
