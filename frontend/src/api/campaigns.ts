/**
 * Campaign endpoints, and the mapping from the API's shapes to the UI's existing Campaign/Influencer types,
 * so the campaign screens and rules (lib/campaigns.ts) work the same on both data sources.
 */
import type {
  Campaign, CampaignStatus, Compensation, Deliverable, DeliverableStatus, DeliverableType, DisplayStage, Influencer, Member,
  MemberStage, PaymentStatus, Region,
} from '../types'
import type { CampaignInput, Terms } from '../lib/campaigns'
import type { CampaignCard } from '../lib/campaignUi'
import { initials, inr } from '../lib/format'
import { apiDelete, apiGet, apiPost, apiPut } from './client'
import { stateOnly } from './influencers'

// ---------- API shapes (mirror the backend records) ----------
type ApiBrief = {
  id: number; handle: string; name: string; followers: number; engagementRate: number | null
  status: string; cities: string[]; states: string[]; categories: string[]
  rates: { storyInr: number | null; reelInr: number | null; postInr: number | null } | null
}

type ApiRevision = {
  round: number; draftUrl: string; submittedAt: string; submittedBy: string
  decision: 'APPROVED' | 'CHANGES_REQUESTED' | null; feedback: string | null; reviewedAt: string | null; reviewedBy: string | null
}

type ApiDeliverable = {
  id: number; type: DeliverableType; seq: number; status: DeliverableStatus
  liveUrl: string | null; postedAt: string | null; revisions: ApiRevision[]
}

type ApiMember = {
  influencer: ApiBrief
  stage: MemberStage
  displayStage: DisplayStage
  stageReason: string | null
  stageUpdatedAt: string
  stageUpdatedBy: string
  compensation: Compensation
  agreedFeeInr: number | null
  paymentStatus: PaymentStatus
  paymentWriteOffReason: string | null
  amountPaidInr: number
  payments: { id: number; amountInr: number; paidAt: string; receiptUrl: string; recordedAt: string; recordedBy: string }[]
  notes: string | null
  addedAt: string
  addedBy: string
  deliverables: ApiDeliverable[]
}

type ApiTargets = { influencers: number; reels: number | null; stories: number | null; posts: number | null }

export type ApiCampaign = {
  id: number; name: string; brand: string; brief: string | null
  startDate: string | null; endDate: string | null; budgetInr: number | null; budgetUsedInr: number; targets: ApiTargets
  status: CampaignStatus; archivedFrom: 'COMPLETED' | 'CANCELLED' | null
  statusReason: string | null; statusChangedAt: string; statusChangedBy: string
  createdAt: string; createdBy: string; updatedAt: string; version: number
  members: ApiMember[]
}

type ApiCampaignSummary = {
  id: number; name: string; brand: string; status: CampaignStatus
  startDate: string | null; endDate: string | null; budgetInr: number | null; budgetUsedInr: number; targets: ApiTargets
  memberCount: number; stageCounts: Partial<Record<DisplayStage, number>>
  deliverables: number; posted: number; inReview: number; unpaid: number; createdAt: string
}

export type AddResult = {
  added: number
  alreadyIn: number
  notAdded: { influencerId: number; name: string | null; reason: string }[]
  onHold: string[] // names: added, but on hold
}

export type ApiInfluencerCampaign = {
  campaignId: number; name: string; brand: string; startDate: string | null; endDate: string | null
  campaignStatus: CampaignStatus; stage: MemberStage; displayStage: DisplayStage
  deliverables: number; posted: number; removable: boolean
}

// ---------- calls ----------
const body = (i: CampaignInput, version?: number) => ({
  name: i.name, brand: i.brand, brief: i.brief, startDate: i.startDate ?? null, endDate: i.endDate ?? null,
  budgetInr: i.budget, targetInfluencers: i.targetInfluencers, targetReels: i.targetReels, targetStories: i.targetStories,
  targetPosts: i.targetPosts, version,
})

export const listCampaigns = (_key: string, signal: AbortSignal) =>
  apiGet<ApiCampaignSummary[]>('/campaigns', signal).then(list => list.map(cardFromSummary))
export const getCampaign = (id: string, signal: AbortSignal) => apiGet<ApiCampaign>(`/campaigns/${encodeURIComponent(id)}`, signal)
export const getInfluencerCampaigns = (influencerId: string, signal: AbortSignal) =>
  apiGet<ApiInfluencerCampaign[]>(`/influencers/${encodeURIComponent(influencerId)}/campaigns`, signal)

export const createCampaignApi = (i: CampaignInput) => apiPost<ApiCampaign>('/campaigns', body(i))
export const updateCampaignApi = (id: number, i: CampaignInput, version: number | undefined) =>
  apiPut<ApiCampaign>(`/campaigns/${id}`, body(i, version))
export const duplicateCampaignApi = (id: number) => apiPost<ApiCampaign>(`/campaigns/${id}/duplicate`, {})
export const addMembersApi = (id: number, influencerIds: number[]) => apiPost<AddResult>(`/campaigns/${id}/members`, { influencerIds })
/** action: the UI's lowercase name ('activate', 'cancel'…); the API uses ACTIVATE, CANCEL… */
export const changeCampaignStatusApi = (id: number, action: string, reason: string) =>
  apiPost<ApiCampaign>(`/campaigns/${id}/status`, { action: action.toUpperCase(), reason: reason.trim() || null })
export const setMemberStageApi = (id: number, influencerId: number, stage: MemberStage, reason: string) =>
  apiPut<ApiCampaign>(`/campaigns/${id}/members/${influencerId}/stage`, { stage, reason: reason.trim() || null })
export const setMemberNotesApi = (id: number, influencerId: number, notes: string) =>
  apiPut<ApiCampaign>(`/campaigns/${id}/members/${influencerId}/notes`, { notes })
export const agreeTermsApi = (id: number, influencerId: number, t: Terms) =>
  apiPost<ApiCampaign>(`/campaigns/${id}/members/${influencerId}/terms`, {
    compensation: t.compensation, feeInr: t.fee, reels: t.counts.REEL, stories: t.counts.STORY, posts: t.counts.POST,
  })
const deliverablePath = (id: number, influencerId: number, d: Deliverable, action: string) =>
  `/campaigns/${id}/members/${influencerId}/deliverables/${d.apiId}/${action}`
export const submitDraftApi = (id: number, influencerId: number, d: Deliverable, draftUrl: string) =>
  apiPost<ApiCampaign>(deliverablePath(id, influencerId, d, 'drafts'), { draftUrl })
export const reviewDraftApi = (id: number, influencerId: number, d: Deliverable, decision: 'APPROVED' | 'CHANGES_REQUESTED', feedback: string) =>
  apiPost<ApiCampaign>(deliverablePath(id, influencerId, d, 'review'), { decision, feedback: feedback.trim() || null })
export const markPostedApi = (id: number, influencerId: number, d: Deliverable, liveUrl: string, postedAt: string) =>
  apiPost<ApiCampaign>(deliverablePath(id, influencerId, d, 'posted'), { liveUrl, postedAt: postedAt || null })
export const recordPaymentApi = (id: number, influencerId: number, amount: number, paidAt: string, receiptUrl: string) =>
  apiPost<ApiCampaign>(`/campaigns/${id}/members/${influencerId}/payments`, {
    amountInr: Number.isFinite(amount) ? amount : null, paidAt: paidAt || null, receiptUrl,
  })
export const writeOffPaymentApi = (id: number, influencerId: number, reason: string) =>
  apiPost<ApiCampaign>(`/campaigns/${id}/members/${influencerId}/payments/write-off`, { reason })
export const changeFeeApi = (id: number, influencerId: number, fee: number, reason: string) =>
  apiPut<ApiCampaign>(`/campaigns/${id}/members/${influencerId}/fee`, { feeInr: Number.isFinite(fee) ? fee : null, reason })
export const removeMemberApi = (id: number, influencerId: number) => apiDelete<ApiCampaign>(`/campaigns/${id}/members/${influencerId}`)

// ---------- mapping ----------
const opt = <T,>(v: T | null): T | undefined => v ?? undefined

function cardFromSummary(s: ApiCampaignSummary): CampaignCard {
  return {
    id: s.id, name: s.name, brand: s.brand, status: s.status, startDate: opt(s.startDate), endDate: opt(s.endDate),
    budget: s.budgetInr, budgetUsed: s.budgetUsedInr, targetInfluencers: s.targets.influencers, members: s.memberCount,
    stages: new Map(Object.entries(s.stageCounts) as [DisplayStage, number][]),
    deliverables: s.deliverables, posted: s.posted, inReview: s.inReview, unpaid: s.unpaid, createdAt: s.createdAt,
  }
}

const price = (v: number | null | undefined) => (v == null ? '—' : inr(v))

/** Enough of an Influencer for campaign screens (avatar, name, handle, CSV columns, suggested fee). */
function briefToInfluencer(b: ApiBrief, loc: Region[]): Influencer {
  const now = Date.now()
  const pricing = { story: price(b.rates?.storyInr), reel: price(b.rates?.reelInr), post: price(b.rates?.postInr) }
  return {
    id: b.id, name: b.name, handle: '@' + b.handle, cities: b.cities, states: stateOnly(b.cities, b.states, loc),
    cats: b.categories, langs: [], tags: [], followers: b.followers, eng: b.engagementRate ?? 0, likes: 0, comments: 0,
    bio: '', email: '—', phone: '—', pricing, rates: [{ date: now, ...pricing }], updatedAt: now,
    camps: [], av: initials(b.name), note: '',
  }
}

function toMember(m: ApiMember): Member {
  return {
    influencerId: m.influencer.id, stage: m.stage, stageReason: opt(m.stageReason), stageUpdatedAt: m.stageUpdatedAt,
    stageUpdatedBy: m.stageUpdatedBy, compensation: m.compensation, agreedFee: m.agreedFeeInr,
    paymentStatus: m.paymentStatus,
    payments: m.payments.map(p => ({ amount: p.amountInr, paidAt: p.paidAt, receiptUrl: p.receiptUrl, recordedAt: p.recordedAt, recordedBy: p.recordedBy })),
    paymentReason: opt(m.paymentWriteOffReason), notes: m.notes ?? '',
    deliverables: m.deliverables.map(toDeliverable), addedAt: m.addedAt, addedBy: m.addedBy,
  }
}

function toDeliverable(d: ApiDeliverable): Deliverable {
  return {
    id: `${d.type.toLowerCase()}-${d.seq}`, apiId: d.id, type: d.type, status: d.status, liveUrl: opt(d.liveUrl),
    postedAt: opt(d.postedAt),
    revisions: d.revisions.map(r => ({
      round: r.round, draftUrl: r.draftUrl, submittedAt: r.submittedAt, submittedBy: r.submittedBy,
      decision: opt(r.decision), feedback: opt(r.feedback), reviewedAt: opt(r.reviewedAt), reviewedBy: opt(r.reviewedBy),
    })),
  }
}

/** The campaign in the UI's shape, plus its members' influencers by id. */
export function toCampaign(a: ApiCampaign, loc: Region[]): { campaign: Campaign; influencers: Map<number, Influencer> } {
  return {
    campaign: {
      id: a.id, name: a.name, brand: a.brand, brief: a.brief ?? '', startDate: opt(a.startDate), endDate: opt(a.endDate),
      budget: a.budgetInr, targetInfluencers: a.targets.influencers, targetReels: a.targets.reels,
      targetStories: a.targets.stories, targetPosts: a.targets.posts, status: a.status, statusReason: opt(a.statusReason), statusChangedAt: a.statusChangedAt,
      statusChangedBy: a.statusChangedBy, archivedFrom: opt(a.archivedFrom), createdAt: a.createdAt, createdBy: a.createdBy,
      members: a.members.map(toMember), version: a.version,
    },
    influencers: new Map(a.members.map(m => [m.influencer.id, briefToInfluencer(m.influencer, loc)])),
  }
}

/** One line for the add-to-campaign popup. */
export function addResultText(r: AddResult, single: boolean): string {
  const parts: string[] = []
  if (!single || r.added === 0) parts.push(r.added ? `Added ${r.added}` : 'Nothing added')
  if (r.alreadyIn) parts.push(`${r.alreadyIn} already in`)
  r.notAdded.forEach(n => parts.push(`${n.name ?? '#' + n.influencerId}: ${n.reason.toLowerCase()}`))
  if (r.onHold.length) parts.push(`on hold: ${r.onHold.join(', ')}`)
  return parts.join(' · ')
}
