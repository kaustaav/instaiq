import type { Campaign, CampaignStatus, DeliverableStatus, DisplayStage, PaymentStatus } from '../types'
import { budgetUsed, campaignSummary } from './campaigns'

export type Tone = { bg: string; fg: string }
const GRAY: Tone = { bg: '#F4F4F5', fg: '#3F3F46' }
const MUTED: Tone = { bg: '#E8E8EA', fg: '#71717A' }
const BLUE: Tone = { bg: '#EEF0FF', fg: '#2E39C2' }
const NAVY: Tone = { bg: '#EEF0FF', fg: '#1D2477' }
const PURPLE: Tone = { bg: '#EEE9FF', fg: '#3D2F99' }
const TEAL: Tone = { bg: '#E4F3F8', fg: '#1A6480' }
const AMBER: Tone = { bg: '#FEF4E4', fg: '#8B5E00' }
const GREEN: Tone = { bg: '#E7F7EF', fg: '#005E3B' }
const RED: Tone = { bg: '#FDECEC', fg: '#9F1D1D' }

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
    budgetUsed: budgetUsed(c), members: s.members, stages: s.stages, deliverables: s.deliverables, posted: s.posted,
    inReview: s.inReview, unpaid: s.unpaid, createdAt: c.createdAt,
  }
}
