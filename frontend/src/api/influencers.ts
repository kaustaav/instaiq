/**
 * Influencer endpoints, and the mapping from the API's shapes to the UI's existing Influencer type,
 * so the screens don't need to know where the data came from.
 */
import type { Influencer, InfluencerStatus, Pricing, RateEntry, Region } from '../types'
import { digits, initials, inr } from '../lib/format'
import type { Draft } from '../lib/influencerForm'
import { stateOf } from '../lib/locations'
import { apiGet, apiPost, apiPut } from './client'

// ---------- API shapes (mirror the backend records) ----------
type Status = InfluencerStatus

export type ApiSummary = {
  id: number
  handle: string
  name: string
  cities: string[]
  states: string[] // the cities' states + state-only entries
  categories: string[]
  languages: string[]
  hashtags: string[]
  followers: number
  engagementRate: number | null
  avgLikes: number | null
  metricsUpdatedAt: string
  status: Status
  reelInr: number | null
}

type ApiRates = { storyInr: number | null; reelInr: number | null; postInr: number | null; effectiveFrom: string }

export type ApiProfile = Omit<ApiSummary, 'followers' | 'engagementRate' | 'avgLikes' | 'metricsUpdatedAt' | 'reelInr'> & {
  bio: string | null
  email: string | null
  statusReason: string | null
  discoverySource: string | null
  version: number
  phone: string | null
  metrics: { followers: number; engagementRate: number | null; avgLikes: number | null; avgComments: number | null; updatedAt: string }
  currentRates: ApiRates | null
  rateHistory: ApiRates[]
  notes: string | null
}

export type ApiPage<T> = { items: T[]; page: number; size: number; total: number; totalPages: number }

// ---------- calls ----------
/** `params` = the UI's own search URL params (same contract as the backend). */
export const searchInfluencers = (params: URLSearchParams, signal?: AbortSignal) =>
  apiGet<ApiPage<ApiSummary>>(`/influencers?${params}`, signal)

export const searchInfluencerIds = (params: URLSearchParams) => apiGet<number[]>(`/influencers/ids?${params}`)

export const getInfluencer = (id: number | string, signal?: AbortSignal) =>
  apiGet<ApiProfile>(`/influencers/${encodeURIComponent(String(id))}`, signal)

/** Body of POST/PUT /influencers (backend InfluencerRequest). */
type InfluencerRequest = {
  handle: string; name: string; bio: string | null; email: string | null; phone: string | null
  discoverySource: string | null
  cities: string[]; stateOnly: string[]; categories: string[]; languages: string[]; hashtags: string[]
  followers: number; engagementRate: number | null; avgLikes: number | null; avgComments: number | null
  storyInr: number | null; reelInr: number | null; postInr: number | null
  version: number | null
}

const text = (v: string) => v.trim() || null
const whole = (v: string) => (v.trim() ? Math.round(Number(digits(v))) : null) // "₹2,000" -> 2000; blank -> null

/** The drawer's draft as the API expects it. `editing` = the loaded profile (its version and discovery source). */
export function draftToRequest(f: Draft, editing: Influencer | null): InfluencerRequest {
  return {
    handle: f.handle.trim(),
    name: f.name.trim(),
    bio: text(f.bio),
    email: text(f.email),
    phone: text(f.phone),
    discoverySource: editing?.api?.discoverySource ?? null, // not on the form yet; keep what's stored
    cities: f.cities,
    stateOnly: f.states,
    categories: f.cats,
    languages: f.langs,
    hashtags: f.tags.split(/[,\s]+/).map(t => t.replace(/^#/, '')).filter(Boolean),
    followers: whole(f.followers) ?? 0,
    engagementRate: f.eng.trim() ? Number(f.eng) : null,
    avgLikes: whole(f.likes),
    avgComments: whole(f.comments),
    storyInr: whole(f.story),
    reelInr: whole(f.reel),
    postInr: whole(f.post),
    version: editing?.api?.version ?? null,
  }
}

export const createInfluencer = (body: InfluencerRequest) => apiPost<ApiProfile>('/influencers', body)
export const updateInfluencer = (id: number, body: InfluencerRequest) => apiPut<ApiProfile>(`/influencers/${id}`, body)
export const updateNotes = (id: number, notes: string) => apiPut<ApiProfile>(`/influencers/${id}/notes`, { notes })
/** A reason is required for anything but ACTIVE. */
export const changeStatus = (id: number, status: InfluencerStatus, reason?: string) =>
  apiPut<ApiProfile>(`/influencers/${id}/status`, { status, reason })

// ---------- mapping to the UI's Influencer ----------
const price = (v: number | null): string => (v == null ? '—' : inr(v))
const toPricing = (r: ApiRates | null): Pricing => ({ story: price(r?.storyInr ?? null), reel: price(r?.reelInr ?? null), post: price(r?.postInr ?? null) })

/** The UI keeps only *state-only* entries in `states`; the API returns cities' states too. */
export const stateOnly = (cities: string[], states: string[], loc: Region[]) =>
  states.filter(s => !cities.some(c => stateOf(loc, c) === s))

function base(a: ApiSummary | ApiProfile, loc: Region[]): Omit<Influencer, 'followers' | 'eng' | 'likes' | 'comments' | 'pricing' | 'rates' | 'updatedAt'> {
  return {
    id: a.id,
    name: a.name,
    handle: '@' + a.handle,
    cities: a.cities,
    states: stateOnly(a.cities, a.states, loc),
    cats: a.categories,
    langs: a.languages,
    tags: a.hashtags.map(t => '#' + t),
    bio: '',
    email: '—',
    phone: '—',
    camps: [], // pre-InfluenceIQ history isn't in the API; real campaign history comes from campaigns
    av: initials(a.name),
    note: '',
  }
}

/** A search result. Fields the summary doesn't carry (bio, contacts, full prices) are blank; cards don't use them. */
export function summaryToInfluencer(a: ApiSummary, loc: Region[]): Influencer {
  const updatedAt = Date.parse(a.metricsUpdatedAt)
  const pricing = { story: '—', reel: price(a.reelInr), post: '—' }
  return {
    ...base(a, loc),
    followers: a.followers,
    eng: a.engagementRate ?? 0,
    likes: a.avgLikes ?? 0,
    comments: 0,
    pricing,
    rates: [{ date: updatedAt, ...pricing }],
    updatedAt,
  }
}

/** The full profile. */
export function profileToInfluencer(a: ApiProfile, loc: Region[]): Influencer {
  const updatedAt = Date.parse(a.metrics.updatedAt)
  const rates: RateEntry[] = a.rateHistory.map(r => ({ date: Date.parse(r.effectiveFrom), ...toPricing(r) }))
  return {
    ...base(a, loc),
    bio: a.bio ?? '',
    email: a.email ?? '—',
    phone: a.phone ?? '—',
    note: a.notes ?? '',
    followers: a.metrics.followers,
    eng: a.metrics.engagementRate ?? 0,
    likes: a.metrics.avgLikes ?? 0,
    comments: a.metrics.avgComments ?? 0,
    pricing: toPricing(a.currentRates),
    // the profile always shows a "current" rate; with no prices on record, show dashes dated at the metrics date
    rates: rates.length ? rates : [{ date: updatedAt, ...toPricing(null) }],
    updatedAt,
    api: { version: a.version, status: a.status, statusReason: a.statusReason, discoverySource: a.discoverySource },
  }
}
