/**
 * Campaign endpoints, and the mapping from the API's shapes to the UI's existing Campaign/Influencer types,
 * so the campaign screens and rules (lib/campaigns.ts) work the same on both data sources.
 */
import type {
  Campaign, CampaignStatus, Compensation, DisplayStage, Influencer, Member, MemberStage, PaymentStatus, Region,
} from '../types'
import type { CampaignInput } from '../lib/campaigns'
import type { CampaignCard } from '../lib/campaignUi'
import { initials } from '../lib/format'
import { apiDelete, apiGet, apiPost, apiPut } from './client'
import { stateOnly } from './influencers'

// ---------- API shapes (mirror the backend records) ----------
type ApiBrief = {
  id: number; handle: string; name: string; followers: number; engagementRate: number | null
  status: string; cities: string[]; states: string[]; categories: string[]
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
  notes: string | null
  addedAt: string
  addedBy: string
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
  memberCount: number; stageCounts: Partial<Record<DisplayStage, number>>; createdAt: string
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
export const removeMemberApi = (id: number, influencerId: number) => apiDelete<ApiCampaign>(`/campaigns/${id}/members/${influencerId}`)

// ---------- mapping ----------
const opt = <T,>(v: T | null): T | undefined => v ?? undefined

function cardFromSummary(s: ApiCampaignSummary): CampaignCard {
  return {
    id: s.id, name: s.name, brand: s.brand, status: s.status, startDate: opt(s.startDate), endDate: opt(s.endDate),
    budget: s.budgetInr, budgetUsed: s.budgetUsedInr, targetInfluencers: s.targets.influencers, members: s.memberCount,
    stages: new Map(Object.entries(s.stageCounts) as [DisplayStage, number][]),
    // deliverables and payments arrive in later steps; until then there's nothing to count
    deliverables: 0, posted: 0, inReview: 0, unpaid: 0, createdAt: s.createdAt,
  }
}

const NO_PRICE = { story: '—', reel: '—', post: '—' }

/** Enough of an Influencer for campaign screens (avatar, name, handle, CSV columns). */
function briefToInfluencer(b: ApiBrief, loc: Region[]): Influencer {
  const now = Date.now()
  return {
    id: b.id, name: b.name, handle: '@' + b.handle, cities: b.cities, states: stateOnly(b.cities, b.states, loc),
    cats: b.categories, langs: [], tags: [], followers: b.followers, eng: b.engagementRate ?? 0, likes: 0, comments: 0,
    bio: '', email: '—', phone: '—', pricing: NO_PRICE, rates: [{ date: now, ...NO_PRICE }], updatedAt: now,
    camps: [], av: initials(b.name), note: '',
  }
}

function toMember(m: ApiMember): Member {
  return {
    influencerId: m.influencer.id, stage: m.stage, stageReason: opt(m.stageReason), stageUpdatedAt: m.stageUpdatedAt,
    stageUpdatedBy: m.stageUpdatedBy, compensation: m.compensation, agreedFee: m.agreedFeeInr,
    paymentStatus: m.paymentStatus, payments: [], paymentReason: opt(m.paymentWriteOffReason), notes: m.notes ?? '',
    deliverables: [], addedAt: m.addedAt, addedBy: m.addedBy,
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
