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

export type Campaign = { id: number; name: string; created: string; iids: number[] }

export type Region = { state: string; cities: string[] }

export type LocPick = { type: 'city' | 'state'; name: string }
