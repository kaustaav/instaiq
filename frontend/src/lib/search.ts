import type { Influencer, LocPick, Region } from '../types'
import { statesOf } from './locations'

export const F_LO = 1000
export const F_HI = 10_000_000

/** Matches the search API's page size (100 results per call). */
export const SEARCH_PAGE_SIZE = 100

export type Filters = {
  q: string
  loc: LocPick[]
  cats: string[]
  langs: string[]
  fMin: number
  fMax: number
  eMin: number
}

export const emptyFilters = (): Filters => ({ q: '', loc: [], cats: [], langs: [], fMin: F_LO, fMax: F_HI, eMin: 0 })

export const hasActiveFilters = (f: Filters) =>
  f.loc.length + f.cats.length + f.langs.length > 0 || f.eMin > 0 || f.fMin > F_LO || f.fMax < F_HI

export type ViewMode = 'grid' | 'list'

/** Everything the search screen keeps in the URL. */
export type SearchState = { filters: Filters; page: number; view: ViewMode }

/*
 * URL contract (also the planned GET /api/influencers/search params). Defaults are omitted.
 *   q=bridal  loc=city:Chandigarh  loc=state:Punjab  cat=Jewellery  lang=Hindi
 *   fmin=2000  fmax=20000  er=5  page=2  view=list
 * Multi-value filters repeat the key, so names never need escaping and Spring binds them to List<String>.
 */
const num = (v: string | null, fallback: number, lo: number, hi: number) => {
  const n = Number(v)
  return v != null && v !== '' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
}

export function searchFromParams(p: URLSearchParams): SearchState {
  const loc = p
    .getAll('loc')
    .map(v => {
      const [type, ...rest] = v.split(':')
      return { type, name: rest.join(':') }
    })
    .filter((l): l is LocPick => (l.type === 'city' || l.type === 'state') && !!l.name)
  return {
    filters: {
      q: p.get('q') ?? '',
      loc,
      cats: p.getAll('cat'),
      langs: p.getAll('lang'),
      fMin: num(p.get('fmin'), F_LO, F_LO, F_HI),
      fMax: num(p.get('fmax'), F_HI, F_LO, F_HI),
      eMin: num(p.get('er'), 0, 0, 100),
    },
    page: Math.floor(num(p.get('page'), 1, 1, Number.MAX_SAFE_INTEGER)),
    view: p.get('view') === 'list' ? 'list' : 'grid',
  }
}

export function searchToParams({ filters: f, page, view }: SearchState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  f.loc.forEach(l => p.append('loc', `${l.type}:${l.name}`))
  f.cats.forEach(c => p.append('cat', c))
  f.langs.forEach(l => p.append('lang', l))
  if (f.fMin > F_LO) p.set('fmin', String(f.fMin))
  if (f.fMax < F_HI) p.set('fmax', String(f.fMax))
  if (f.eMin > 0) p.set('er', String(f.eMin))
  if (page > 1) p.set('page', String(page))
  if (view === 'list') p.set('view', 'list')
  return p
}

/** Within a group values are OR'ed; groups are AND'ed. */
export function applyFilters(infs: Influencer[], f: Filters, loc: Region[]): Influencer[] {
  const q = f.q.toLowerCase()
  return infs.filter(i => {
    if (q && ![i.name, i.handle, i.bio, ...i.tags].some(s => s.toLowerCase().includes(q))) return false
    if (f.loc.length && !f.loc.some(l => (l.type === 'city' ? i.cities.includes(l.name) : statesOf(loc, i).includes(l.name))))
      return false
    if (f.cats.length && !f.cats.some(c => i.cats.includes(c))) return false
    if (f.fMin > F_LO && i.followers < f.fMin) return false
    if (f.fMax < F_HI && i.followers > f.fMax) return false
    if (i.eng < f.eMin) return false
    if (f.langs.length && !f.langs.some(l => i.langs.includes(l))) return false
    return true
  })
}

/** Slider position 0–1000 ↦ 10^(3 + 4p/1000), snapped to 2 significant digits. */
export function posToFollowers(p: number): number {
  const v = Math.pow(10, 3 + (4 * p) / 1000)
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1)
  return Math.min(F_HI, Math.max(F_LO, Math.round(v / mag) * mag))
}

export const followersToPos = (v: number) =>
  Math.round(((Math.log10(Math.min(F_HI, Math.max(F_LO, v))) - 3) / 4) * 1000)
