/** Prices are display strings in INR ("₹2,000") or "—" when unknown. */
export type Pricing = { story: string; reel: string; post: string }
export type RateEntry = Pricing & { date: number }

export type PastCampaign = {
  name: string
  brand: string
  date: string
  del: string
  status: 'Completed' | 'Ongoing'
}

/** Shape of a seed row before dates are attached. */
export type RawInfluencer = {
  id: number
  name: string
  handle: string // stored with leading "@"
  cities: string[]
  states: string[] // state-only entries (city unknown)
  cats: string[]
  langs: string[]
  followers: number
  eng: number
  likes: number
  comments: number
  bio: string
  email: string
  phone: string
  tags: string[] // stored with leading "#"
  pricing: Pricing
  camps: PastCampaign[]
  av: string
}

/** Seed row plus how old its metrics and rates are, so freshness stays relative to today. */
export type SeedInfluencer = RawInfluencer & { metricsAgeDays: number; ratesAgeDays: number }

export type Influencer = RawInfluencer & {
  rates: RateEntry[] // newest first; rates[0] mirrors pricing
  updatedAt: number // epoch ms, changes only when metrics change
  note: string
}

// ---------- Campaigns (see docs/DATA_MODEL.md) ----------
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED'
/** Stages set by people. IN_PRODUCTION / LIVE / COMPLETED are derived from deliverables + payment. */
export type MemberStage = 'SHORTLISTED' | 'CONTACTED' | 'NEGOTIATING' | 'AGREED' | 'DECLINED'
export type DisplayStage = Exclude<MemberStage, 'AGREED'> | 'IN_PRODUCTION' | 'LIVE' | 'COMPLETED'
export type Compensation = 'CASH' | 'BARTER' | 'CASH_AND_PRODUCT'
export type PaymentStatus = 'NOT_DUE' | 'DUE' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED'
export type DeliverableType = 'REEL' | 'STORY' | 'POST'
export type DeliverableStatus = 'AWAITING_DRAFT' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'POSTED'

/** One round of the draft review loop (append-only). */
export type Revision = {
  round: number
  draftUrl: string
  submittedAt: string // ISO date-time
  submittedBy: string
  decision?: 'APPROVED' | 'CHANGES_REQUESTED'
  feedback?: string
  reviewedAt?: string
  reviewedBy?: string
}

export type Deliverable = {
  id: string
  type: DeliverableType
  status: DeliverableStatus
  liveUrl?: string
  postedAt?: string // ISO date
  revisions: Revision[]
}

export type Member = {
  influencerId: number
  stage: MemberStage
  stageReason?: string
  stageUpdatedAt: string
  stageUpdatedBy: string
  compensation: Compensation
  agreedFee: number | null // INR
  paymentStatus: PaymentStatus
  amountPaid: number
  paidAt?: string
  paymentRef?: string
  paymentReason?: string // write-off reason
  notes: string
  deliverables: Deliverable[]
  addedAt: string
  addedBy: string
}

export type Campaign = {
  id: number
  name: string
  brand: string
  brief: string
  startDate?: string // ISO date
  endDate?: string
  budget: number | null // INR
  status: CampaignStatus
  statusReason?: string
  statusChangedAt: string
  statusChangedBy: string
  archivedFrom?: 'COMPLETED' | 'CANCELLED' // where "unarchive" returns to
  createdAt: string
  createdBy: string
  members: Member[]
}

export type Region = { state: string; cities: string[] }

export type LocPick = { type: 'city' | 'state'; name: string }
