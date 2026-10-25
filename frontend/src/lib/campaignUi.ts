import type { Campaign, CampaignStatus, DeliverableStatus, DisplayStage, PaymentStatus } from '../types'
import { budgetUsed, campaignSummary } from './campaigns'
import { TONE, type Tone } from './palette'

export type { Tone } from './palette'
const GRAY = TONE.gray
const MUTED = TONE.muted
const BLUE = TONE.blue
const NAVY = TONE.indigo
const PURPLE = TONE.purple
const TEAL = TONE.teal
const AMBER = TONE.orange
const GREEN = TONE.green
const RED = TONE.red

export const CAMPAIGN_TONE: Record<CampaignStatus, Tone> = { DRAFT: GRAY, ACTIVE: BLUE, COMPLETED: GREEN, CANCELLED: RED, ARCHIVED: MUTED }
export const STAGE_TONE: Record<DisplayStage, Tone> = {
  SHORTLISTED: GRAY, CONTACTED: TEAL, NEGOTIATING: AMBER, IN_PRODUCTION: PURPLE, LIVE: NAVY, COMPLETED: GREEN, DECLINED: RED,
}
export const PAYMENT_TONE: Record<PaymentStatus, Tone> = { NOT_DUE: GRAY, DUE: AMBER, PARTIALLY_PAID: AMBER, PAID: GREEN, WAIVED: MUTED }
export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  NOT_DUE: 'Not due', DUE: 'Due', PARTIALLY_PAID: 'Part paid', PAID: 'Paid', WAIVED: 'Waived',
}
export const DELIVERABLE_TONE: Record<DeliverableStatus, Tone> = {
  AWAITING_DRAFT: GRAY, IN_REVIEW: PURPLE, CHANGES_REQUESTED: AMBER, APPROVED: BLUE, POSTED: GREEN,
}
export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  AWAITING_DRAFT: 'Awaiting draft', IN_REVIEW: 'In review', CHANGES_REQUESTED: 'Changes requested', APPROVED: 'Approved', POSTED: 'Posted',
}

/** "2026-10-05" or an ISO date-time → "5 Oct 2026" */
export const fmtDate = (iso?: string) =>
  iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const fmtRange = (a?: string, b?: string) => (a || b ? `${fmtDate(a)} → ${fmtDate(b)}` : 'Dates not set')

/** What a campaign card (list, add-to-campaign popup) shows. Built from a full campaign (demo) or an API summary. */
export type CampaignCard = {
  id: number
  name: string
  brand: string
  status: CampaignStatus
  startDate?: string
  endDate?: string
  budget: number | null
  budgetUsed: number
  targetInfluencers: number
  members: number
  stages: Map<DisplayStage, number>
  deliverables: number
  posted: number
  inReview: number
  unpaid: number
  createdAt: string
}

export function cardFromCampaign(c: Campaign): CampaignCard {
  const s = campaignSummary(c)
  return {
    id: c.id, name: c.name, brand: c.brand, status: c.status, startDate: c.startDate, endDate: c.endDate, budget: c.budget,
    budgetUsed: budgetUsed(c), targetInfluencers: c.targetInfluencers, members: s.members, stages: s.stages, deliverables: s.deliverables, posted: s.posted,
    inReview: s.inReview, unpaid: s.unpaid, createdAt: c.createdAt,
  }
}
