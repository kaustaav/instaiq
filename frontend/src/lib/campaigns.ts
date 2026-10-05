/**
 * Campaign rules: state machines, guards and actions (docs/DATA_MODEL.md).
 * Pure functions: every action takes a Campaign and returns a new one, or throws an Error whose message is shown to the user.
 * The backend's campaign service will enforce exactly these rules.
 */
import type {
  Campaign, Payment, CampaignStatus, Compensation, Deliverable, DeliverableType, DisplayStage, Influencer, Member, MemberStage,
} from '../types'

/** Placeholder until auth exists. */
export const CURRENT_USER = 'Aisha Khan'

const now = () => new Date().toISOString()
export const today = () => new Date().toISOString().slice(0, 10)

// ---------- labels ----------
export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: 'Draft', ACTIVE: 'Active', COMPLETED: 'Completed', CANCELLED: 'Cancelled', ARCHIVED: 'Archived',
}
export const STAGE_LABEL: Record<DisplayStage, string> = {
  SHORTLISTED: 'Shortlisted', CONTACTED: 'Contacted', NEGOTIATING: 'Negotiating', IN_PRODUCTION: 'In production',
  LIVE: 'Live', COMPLETED: 'Completed', DECLINED: 'Declined',
}
export const DISPLAY_STAGES: DisplayStage[] = [
  'SHORTLISTED', 'CONTACTED', 'NEGOTIATING', 'IN_PRODUCTION', 'LIVE', 'COMPLETED', 'DECLINED',
]
export const COMPENSATION_LABEL: Record<Compensation, string> = {
  CASH: 'Paid', BARTER: 'Barter (product)', CASH_AND_PRODUCT: 'Paid + product',
}
export const DELIVERABLE_LABEL: Record<DeliverableType, string> = { REEL: 'Reel', STORY: 'Story', POST: 'Post' }

// ---------- derived values ----------
export const amountPaid = (m: Member) => m.payments.reduce((sum, p) => sum + p.amount, 0)

export const isReadOnly = (c: Campaign) => c.status === 'COMPLETED' || c.status === 'CANCELLED' || c.status === 'ARCHIVED'

/** AGREED members move through IN_PRODUCTION → LIVE → COMPLETED based on their deliverables and payment. */
export function displayStage(m: Member): DisplayStage {
  if (m.stage !== 'AGREED') return m.stage
  const allPosted = m.deliverables.length > 0 && m.deliverables.every(d => d.status === 'POSTED')
  if (!allPosted) return 'IN_PRODUCTION'
  return m.paymentStatus === 'PAID' || m.paymentStatus === 'WAIVED' ? 'COMPLETED' : 'LIVE'
}

/**
 * Actual vs target. Confirmed = members whose terms are agreed (in production, live or completed);
 * content counts only what's actually posted; committed = agreed fees.
 * Payable now = full fees of members whose content is all posted; paidOnPayable = what we've paid them, counted up
 * to each fee (so an advance to one influencer can't hide what's due to another).
 */
export function campaignProgress(c: Campaign) {
  const agreed = c.members.filter(m => m.stage === 'AGREED')
  const posted = (t: DeliverableType) => agreed.reduce((n, m) => n + m.deliverables.filter(d => d.type === t && d.status === 'POSTED').length, 0)
  const due = agreed.filter(m => m.agreedFee != null && (displayStage(m) === 'LIVE' || displayStage(m) === 'COMPLETED'))
  return {
    payableNow: due.reduce((sum, m) => sum + (m.agreedFee ?? 0), 0),
    paidOnPayable: due.reduce((sum, m) => sum + Math.min(amountPaid(m), m.agreedFee ?? 0), 0),
    confirmed: agreed.length,
    reels: posted('REEL'),
    stories: posted('STORY'),
    posts: posted('POST'),
    committed: budgetUsed(c),
  }
}

/** Budget used = agreed fees of members whose terms are agreed. */
export const budgetUsed = (c: Campaign) =>
  c.members.reduce((sum, m) => sum + (m.stage === 'AGREED' ? m.agreedFee ?? 0 : 0), 0)

const hasLiveUnpaid = (m: Member) =>
  m.deliverables.some(d => d.status === 'POSTED') && (m.paymentStatus === 'DUE' || m.paymentStatus === 'PARTIALLY_PAID')

export function campaignSummary(c: Campaign) {
  const stages = new Map<DisplayStage, number>()
  c.members.forEach(m => stages.set(displayStage(m), (stages.get(displayStage(m)) ?? 0) + 1))
  const deliverables = c.members.flatMap(m => m.deliverables)
  return {
    stages,
    members: c.members.length,
    inReview: deliverables.filter(d => d.status === 'IN_REVIEW').length,
    posted: deliverables.filter(d => d.status === 'POSTED').length,
    deliverables: deliverables.length,
    unpaid: c.members.filter(hasLiveUnpaid).length,
  }
}

/** Suggested fee from the influencer's current rate card. */
export function suggestedFee(inf: Influencer, n: Record<DeliverableType, number>): number | null {
  const price = (v: string) => (/\d/.test(v) ? +v.replace(/[^0-9]/g, '') : null)
  const rates = { REEL: price(inf.pricing.reel), STORY: price(inf.pricing.story), POST: price(inf.pricing.post) }
  let total = 0
  for (const t of ['REEL', 'STORY', 'POST'] as const) {
    if (!n[t]) continue
    if (rates[t] == null) return null // a needed price is unknown
    total += rates[t]! * n[t]
  }
  return total || null
}

// ---------- campaign status machine ----------
export type StatusAction = 'activate' | 'complete' | 'cancel' | 'reopen' | 'archive' | 'unarchive'

export const STATUS_ACTIONS: Record<CampaignStatus, StatusAction[]> = {
  DRAFT: ['activate', 'cancel'],
  ACTIVE: ['complete', 'cancel'],
  COMPLETED: ['reopen', 'archive'],
  CANCELLED: ['reopen', 'archive'],
  ARCHIVED: ['unarchive'],
}
export const ACTION_LABEL: Record<StatusAction, string> = {
  activate: 'Activate', complete: 'Mark completed', cancel: 'Cancel campaign', reopen: 'Reopen',
  archive: 'Archive', unarchive: 'Unarchive',
}
/** Actions that must record why. */
export const ACTION_NEEDS_REASON: Record<StatusAction, boolean> = {
  activate: false, complete: false, cancel: true, reopen: true, archive: false, unarchive: true,
}

/** Everything that stops an action, in words. Empty = allowed. */
export function statusBlockers(c: Campaign, action: StatusAction, nameOf: (id: number) => string): string[] {
  if (!STATUS_ACTIONS[c.status].includes(action)) return [`Can't ${ACTION_LABEL[action].toLowerCase()}: the campaign is ${c.status.toLowerCase()}`]
  const out: string[] = []
  if (action === 'activate') {
    if (!c.name.trim()) out.push('Add a name')
    if (!c.brand.trim()) out.push('Add a brand')
    if (!c.startDate || !c.endDate) out.push('Set start and end dates')
    if (!c.members.length) out.push('Add at least one influencer')
  }
  if (action === 'complete') {
    for (const m of c.members) {
      const s = displayStage(m)
      if (s === 'DECLINED' || s === 'COMPLETED') continue
      const who = nameOf(m.influencerId)
      if (s === 'LIVE') out.push(`${who}: not paid yet`)
      else if (s === 'IN_PRODUCTION') {
        const left = m.deliverables.filter(d => d.status !== 'POSTED').length
        out.push(`${who}: ${left} deliverable${left > 1 ? 's' : ''} not posted`)
      } else out.push(`${who}: still ${STAGE_LABEL[s].toLowerCase()} (decline or agree terms)`)
    }
  }
  if (action === 'cancel') {
    c.members.filter(hasLiveUnpaid).forEach(m => out.push(`${nameOf(m.influencerId)}: content is live but unpaid (pay or write off first)`))
  }
  return out
}

export function changeStatus(c: Campaign, action: StatusAction, reason: string, nameOf: (id: number) => string): Campaign {
  const blockers = statusBlockers(c, action, nameOf)
  if (blockers.length) throw new Error(blockers.join('\n'))
  if (ACTION_NEEDS_REASON[action] && !reason.trim()) throw new Error('A reason is required')
  const next: Record<StatusAction, CampaignStatus> = {
    activate: 'ACTIVE', complete: 'COMPLETED', cancel: 'CANCELLED', reopen: 'ACTIVE', archive: 'ARCHIVED',
    unarchive: c.archivedFrom ?? 'COMPLETED',
  }
  return {
    ...c,
    status: next[action],
    archivedFrom: action === 'archive' ? (c.status as 'COMPLETED' | 'CANCELLED') : undefined,
    statusReason: reason.trim() || undefined,
    statusChangedAt: now(),
    statusChangedBy: CURRENT_USER,
  }
}

// ---------- campaign details ----------
export type CampaignInput = Pick<Campaign,
  'name' | 'brand' | 'brief' | 'startDate' | 'endDate' | 'budget' | 'targetInfluencers' | 'targetReels' | 'targetStories' | 'targetPosts'>

export function validateCampaign(i: CampaignInput): string {
  if (!i.name.trim()) return 'Name is required'
  if (!i.brand.trim()) return 'Brand is required'
  if (i.startDate && i.endDate && i.endDate < i.startDate) return 'End date is before start date'
  if (i.budget != null && i.budget < 0) return 'Budget can’t be negative'
  if (!(Number.isInteger(i.targetInfluencers) && i.targetInfluencers >= 1)) return 'Number of influencers is required (at least 1)'
  for (const [label, v] of [['reels', i.targetReels], ['stories', i.targetStories], ['posts', i.targetPosts]] as const) {
    if (v != null && !(Number.isInteger(v) && v >= 0)) return `Number of ${label} must be a whole number, 0 or more`
  }
  return ''
}

const targets = (i: CampaignInput) => ({
  targetInfluencers: i.targetInfluencers, targetReels: i.targetReels, targetStories: i.targetStories, targetPosts: i.targetPosts,
})

export function newCampaign(id: number, i: CampaignInput): Campaign {
  const err = validateCampaign(i)
  if (err) throw new Error(err)
  const t = now()
  return {
    id, name: i.name.trim(), brand: i.brand.trim(), brief: i.brief.trim(), startDate: i.startDate || undefined,
    endDate: i.endDate || undefined, budget: i.budget, ...targets(i), status: 'DRAFT', statusChangedAt: t, statusChangedBy: CURRENT_USER,
    createdAt: t, createdBy: CURRENT_USER, members: [],
  }
}

export function editCampaign(c: Campaign, i: CampaignInput): Campaign {
  assertEditable(c)
  const err = validateCampaign(i)
  if (err) throw new Error(err)
  return { ...c, name: i.name.trim(), brand: i.brand.trim(), brief: i.brief.trim(), startDate: i.startDate || undefined, endDate: i.endDate || undefined, budget: i.budget, ...targets(i) }
}

/** Same setup, empty pipeline. */
export const duplicateCampaign = (c: Campaign, id: number): Campaign =>
  newCampaign(id, { name: `${c.name} (copy)`, brand: c.brand, brief: c.brief, startDate: undefined, endDate: undefined, budget: c.budget, ...targets(c) })

// ---------- members ----------
function assertEditable(c: Campaign) {
  if (isReadOnly(c)) throw new Error(`This campaign is ${c.status.toLowerCase()} and read-only. Reopen it to make changes.`)
}

function updateMember(c: Campaign, infId: number, fn: (m: Member) => Member): Campaign {
  assertEditable(c)
  const m = c.members.find(x => x.influencerId === infId)
  if (!m) throw new Error('Influencer is not in this campaign')
  return { ...c, members: c.members.map(x => (x.influencerId === infId ? fn(x) : x)) }
}

export function addMembers(c: Campaign, ids: number[]): { campaign: Campaign; added: number; skipped: number } {
  assertEditable(c)
  const existing = new Set(c.members.map(m => m.influencerId))
  const fresh = [...new Set(ids)].filter(id => !existing.has(id))
  const t = now()
  const added: Member[] = fresh.map(influencerId => ({
    influencerId, stage: 'SHORTLISTED', stageUpdatedAt: t, stageUpdatedBy: CURRENT_USER, compensation: 'CASH',
    agreedFee: null, paymentStatus: 'NOT_DUE', payments: [], notes: '', deliverables: [], addedAt: t, addedBy: CURRENT_USER,
  }))
  return { campaign: { ...c, members: [...c.members, ...added] }, added: added.length, skipped: ids.length - added.length }
}

export function removeBlocker(m: Member): string {
  if (m.payments.length) return 'They have been paid; decline them instead'
  if (m.deliverables.some(d => d.revisions.length || d.status === 'POSTED')) return 'They have submitted content; it must stay on record'
  return ''
}

export function removeMember(c: Campaign, infId: number): Campaign {
  assertEditable(c)
  const m = c.members.find(x => x.influencerId === infId)
  if (!m) return c
  const blocker = removeBlocker(m)
  if (blocker) throw new Error(blocker)
  return { ...c, members: c.members.filter(x => x.influencerId !== infId) }
}

const ORDER: MemberStage[] = ['SHORTLISTED', 'CONTACTED', 'NEGOTIATING', 'AGREED']

/** Stage moves available to people (AGREED is reached through agreeTerms). */
export function stageMoves(m: Member): { to: MemberStage; label: string; needsReason: boolean }[] {
  const moves: { to: MemberStage; label: string; needsReason: boolean }[] = []
  const i = ORDER.indexOf(m.stage)
  if (m.stage === 'DECLINED') return [{ to: 'SHORTLISTED', label: 'Re-shortlist', needsReason: true }]
  if (m.stage === 'SHORTLISTED') moves.push({ to: 'CONTACTED', label: 'Mark contacted', needsReason: false })
  if (m.stage === 'CONTACTED') moves.push({ to: 'NEGOTIATING', label: 'Start negotiating', needsReason: false })
  // stepping back from AGREED drops the deliverables, so only offer it before any content or payment
  const canStepBack = i > 0 && (m.stage !== 'AGREED' || !removeBlocker(m))
  if (canStepBack) moves.push({ to: ORDER[i - 1], label: `Back to ${STAGE_LABEL[ORDER[i - 1] as DisplayStage].toLowerCase()}`, needsReason: true })
  if (m.stage !== 'AGREED') moves.push({ to: 'DECLINED', label: 'Decline', needsReason: false })
  return moves
}

export function setStage(c: Campaign, infId: number, to: MemberStage, reason: string): Campaign {
  return updateMember(c, infId, m => {
    const move = stageMoves(m).find(x => x.to === to)
    if (!move) throw new Error(`Can't move from ${m.stage.toLowerCase()} to ${to.toLowerCase()}`)
    if (move.needsReason && !reason.trim()) throw new Error('A reason is required')
    if (m.stage === 'AGREED') {
      // un-agreeing drops the deliverables, so only allowed before any work or money
      const blocker = removeBlocker(m)
      if (blocker) throw new Error(`Can't reopen terms: ${blocker.toLowerCase()}`)
      return { ...m, stage: to, stageReason: reason.trim(), stageUpdatedAt: now(), stageUpdatedBy: CURRENT_USER,
        deliverables: [], paymentStatus: 'NOT_DUE', paymentReason: undefined }
    }
    return { ...m, stage: to, stageReason: reason.trim() || undefined, stageUpdatedAt: now(), stageUpdatedBy: CURRENT_USER }
  })
}

export type Terms = { compensation: Compensation; fee: number | null; counts: Record<DeliverableType, number> }

export function termsError(t: Terms): string {
  const n = t.counts.REEL + t.counts.STORY + t.counts.POST
  if (n < 1) return 'Add at least one deliverable'
  if (Object.values(t.counts).some(v => v < 0 || !Number.isInteger(v))) return 'Deliverable counts must be whole numbers'
  if (t.compensation !== 'BARTER' && !(t.fee && t.fee > 0)) return 'Agreed fee is required for paid collaborations'
  return ''
}

export function agreeTerms(c: Campaign, infId: number, t: Terms): Campaign {
  return updateMember(c, infId, m => {
    if (m.stage !== 'NEGOTIATING') throw new Error('Terms are agreed from the negotiating stage')
    const err = termsError(t)
    if (err) throw new Error(err)
    const deliverables: Deliverable[] = (['REEL', 'STORY', 'POST'] as const).flatMap(type =>
      Array.from({ length: t.counts[type] }, (_, k) => ({
        id: `${type.toLowerCase()}-${k + 1}`, type, status: 'AWAITING_DRAFT' as const, revisions: [],
      })),
    )
    return {
      ...m, stage: 'AGREED', stageReason: undefined, stageUpdatedAt: now(), stageUpdatedBy: CURRENT_USER,
      compensation: t.compensation, agreedFee: t.compensation === 'BARTER' ? null : t.fee,
      paymentStatus: t.compensation === 'BARTER' ? 'WAIVED' : 'DUE', deliverables,
    }
  })
}

const paymentFor = (m: Member, fee: number | null): Member['paymentStatus'] => {
  if (m.paymentStatus === 'WAIVED') return 'WAIVED'
  if (fee != null && amountPaid(m) >= fee) return 'PAID'
  return m.payments.length ? 'PARTIALLY_PAID' : 'DUE'
}

/** Fee change after agreement: needs a reason; payment status follows the new fee. */
export function changeFee(c: Campaign, infId: number, fee: number, reason: string): Campaign {
  return updateMember(c, infId, m => {
    if (m.stage !== 'AGREED' || m.compensation === 'BARTER') throw new Error('Fee can be changed only on agreed, paid collaborations')
    if (m.paymentStatus === 'WAIVED') throw new Error('The payment was written off; the fee is settled')
    if (!(fee > 0)) throw new Error('Fee must be more than 0')
    if (!reason.trim()) throw new Error('A reason is required to change an agreed fee')
    return { ...m, agreedFee: fee, stageReason: `Fee changed: ${reason.trim()}`, paymentStatus: paymentFor(m, fee) }
  })
}

export const setMemberNotes = (c: Campaign, infId: number, notes: string) => updateMember(c, infId, m => ({ ...m, notes }))

// ---------- deliverables: draft review loop ----------
const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/.test(v.trim())

function updateDeliverable(c: Campaign, infId: number, delId: string, fn: (d: Deliverable, m: Member) => Deliverable): Campaign {
  return updateMember(c, infId, m => {
    const d = m.deliverables.find(x => x.id === delId)
    if (!d) throw new Error('Deliverable not found')
    return { ...m, deliverables: m.deliverables.map(x => (x.id === delId ? fn(x, m) : x)) }
  })
}

export const submitDraft = (c: Campaign, infId: number, delId: string, url: string) =>
  updateDeliverable(c, infId, delId, d => {
    if (d.status !== 'AWAITING_DRAFT' && d.status !== 'CHANGES_REQUESTED') throw new Error('This deliverable isn’t waiting for a draft')
    if (!isUrl(url)) throw new Error('Enter a valid draft link (https://…)')
    const round = d.revisions.length + 1
    return { ...d, status: 'IN_REVIEW', revisions: [...d.revisions, { round, draftUrl: url.trim(), submittedAt: now(), submittedBy: CURRENT_USER }] }
  })

export const reviewDraft = (c: Campaign, infId: number, delId: string, decision: 'APPROVED' | 'CHANGES_REQUESTED', feedback: string) =>
  updateDeliverable(c, infId, delId, d => {
    if (d.status !== 'IN_REVIEW') throw new Error('No draft is waiting for review')
    if (decision === 'CHANGES_REQUESTED' && !feedback.trim()) throw new Error('Tell them what to change')
    const revisions = d.revisions.map((r, k) =>
      k === d.revisions.length - 1 ? { ...r, decision, feedback: feedback.trim() || undefined, reviewedAt: now(), reviewedBy: CURRENT_USER } : r,
    )
    return { ...d, status: decision, revisions }
  })

export const markPosted = (c: Campaign, infId: number, delId: string, liveUrl: string, postedAt: string) => {
  const url = liveUrl.trim()
  if (!isUrl(url)) throw new Error('Enter a valid live link (https://…)')
  if (!postedAt) throw new Error('Enter the date it went live')
  const taken = c.members.some(m => m.deliverables.some(d => d.liveUrl === url))
  if (taken) throw new Error('That link is already used in this campaign')
  return updateDeliverable(c, infId, delId, d => {
    if (d.status !== 'APPROVED') throw new Error('Only an approved draft can be posted')
    return { ...d, status: 'POSTED', liveUrl: url, postedAt }
  })
}

// ---------- payments ----------
/** Each payment needs a date and a link to proof of payment (receipt / screenshot in Drive). */
export const recordPayment = (c: Campaign, infId: number, amount: number, paidAt: string, receiptUrl: string) =>
  updateMember(c, infId, m => {
    if (m.stage !== 'AGREED') throw new Error('Payments are recorded after terms are agreed')
    if (m.compensation === 'BARTER') throw new Error('Barter collaborations have no cash payment')
    if (m.paymentStatus === 'PAID' || m.paymentStatus === 'WAIVED') throw new Error('Nothing left to pay')
    if (!(amount > 0)) throw new Error('Amount must be more than 0')
    if (!paidAt) throw new Error('Enter the payment date')
    if (!isUrl(receiptUrl)) throw new Error('Add a link to the payment receipt (https://…)')
    const payment: Payment = { amount, paidAt, receiptUrl: receiptUrl.trim(), recordedAt: now(), recordedBy: CURRENT_USER }
    const paid = { ...m, payments: [...m.payments, payment] }
    return { ...paid, paymentStatus: paymentFor(paid, m.agreedFee) }
  })

/**
 * The rest won't be paid in cash (settled with product). The deal changes so the budget shows what's really spent:
 * nothing paid → Barter, no fee; partly paid → Paid + product, fee = what was paid.
 */
export const writeOffPayment = (c: Campaign, infId: number, reason: string) =>
  updateMember(c, infId, m => {
    if (m.paymentStatus !== 'DUE' && m.paymentStatus !== 'PARTIALLY_PAID') throw new Error('Nothing is outstanding')
    if (!reason.trim()) throw new Error('A reason is required to write off a payment')
    const paid = amountPaid(m)
    return {
      ...m, paymentStatus: 'WAIVED', paymentReason: reason.trim(),
      compensation: paid ? 'CASH_AND_PRODUCT' : 'BARTER', agreedFee: paid || null,
    }
  })
