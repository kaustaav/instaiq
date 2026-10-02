import type { CampaignStatus, DeliverableStatus, DisplayStage, PaymentStatus } from '../types'

export type Tone = { bg: string; fg: string }
const GRAY: Tone = { bg: '#F4F4F5', fg: '#3F3F46' }
const MUTED: Tone = { bg: '#E8E8EA', fg: '#71717A' }
const BLUE: Tone = { bg: '#EBEBFF', fg: '#0000C8' }
const NAVY: Tone = { bg: '#EBEBFF', fg: '#00007A' }
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
