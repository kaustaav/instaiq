import type { Influencer, Region } from '../types'
import { digits, initials, inr } from './format'
import { stateOf } from './locations'

/** Add/Edit drawer draft. Numeric fields stay strings while editing. */
export type Draft = {
  id: number | null
  name: string
  handle: string // without "@"
  email: string
  phone: string
  cities: string[]
  states: string[]
  cats: string[]
  langs: string[]
  followers: string
  eng: string
  likes: string
  comments: string
  story: string
  reel: string
  post: string
  bio: string
  tags: string // comma separated
}

export const blankDraft = (): Draft => ({
  id: null, name: '', handle: '', email: '', phone: '',
  cities: [], states: [], cats: [], langs: [],
  followers: '', eng: '', likes: '', comments: '',
  story: '', reel: '', post: '', bio: '', tags: '',
})

export const draftFrom = (i: Influencer): Draft => ({
  id: i.id,
  name: i.name,
  handle: i.handle.replace(/^@/, ''),
  email: i.email === '—' ? '' : i.email,
  phone: i.phone === '—' ? '' : i.phone,
  cities: [...i.cities],
  states: [...i.states],
  cats: [...i.cats],
  langs: [...i.langs],
  followers: String(i.followers),
  eng: String(i.eng),
  likes: String(i.likes),
  comments: String(i.comments),
  story: digits(i.pricing.story),
  reel: digits(i.pricing.reel),
  post: digits(i.pricing.post),
  bio: i.bio,
  tags: i.tags.join(', '),
})

/** First failing rule, or '' when the draft is valid. */
export function validate(f: Draft): string {
  if (!f.name.trim()) return 'Name is required'
  if (!f.handle.trim()) return 'Instagram handle is required'
  if (!f.cities.length && !f.states.length) return 'Add at least one city or state'
  if (!f.cats.length) return 'Pick at least one niche'
  if (!(f.followers.trim() && +f.followers > 0)) return 'Followers is required'
  return ''
}

const num = (v: string) => +digits(v) || 0
const price = (v: string) => (v.trim() ? inr(num(v)) : '—')

/**
 * Builds the saved record. Freshness and rate history rules:
 * - updatedAt changes only when followers/eng/likes/comments change (or on create).
 * - a changed story/reel/post prepends a new dated rate entry; history is never overwritten.
 */
export function toInfluencer(f: Draft, prev: Influencer | undefined, nextId: number, loc: Region[]): Influencer {
  const now = Date.now()
  const pricing = { story: price(f.story), reel: price(f.reel), post: price(f.post) }
  const base = {
    id: prev?.id ?? nextId,
    name: f.name.trim(),
    handle: '@' + f.handle.trim().replace(/^@/, ''),
    cities: f.cities,
    // drop state-only entries already implied by a picked city
    states: f.states.filter(st => !f.cities.some(c => stateOf(loc, c) === st)),
    cats: f.cats,
    langs: f.langs,
    followers: num(f.followers),
    eng: num(f.eng),
    likes: num(f.likes),
    comments: num(f.comments),
    bio: f.bio.trim(),
    email: f.email.trim() || '—',
    phone: f.phone.trim() || '—',
    pricing,
    tags: f.tags.split(/[,\s]+/).filter(Boolean).map(t => (t.startsWith('#') ? t : '#' + t)),
    camps: prev?.camps ?? [],
    av: initials(f.name),
    note: prev?.note ?? '',
  }
  const metricsChanged = !prev || (['followers', 'eng', 'likes', 'comments'] as const).some(k => prev[k] !== base[k])
  const ratesChanged = !prev || (['story', 'reel', 'post'] as const).some(k => prev.pricing[k] !== pricing[k])
  return {
    ...base,
    updatedAt: metricsChanged ? now : prev.updatedAt,
    rates: ratesChanged ? [{ date: now, ...pricing }, ...(prev?.rates ?? [])] : prev.rates,
  }
}
