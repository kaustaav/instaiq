import type { Influencer, LocPick, Region } from '../types'

export const parseGeo = (geo: string): Region[] =>
  geo.split('|').map(x => {
    const [state, c] = x.split(':')
    return { state, cities: c.split(',') }
  })

export const stateOf = (loc: Region[], city: string) => loc.find(l => l.cities.includes(city))?.state ?? null

/** Cities' states plus state-only entries, de-duplicated. */
export const statesOf = (loc: Region[], i: Pick<Influencer, 'cities' | 'states'>) => [
  ...new Set([...i.cities.map(c => stateOf(loc, c)).filter((s): s is string => !!s), ...i.states]),
]

export type LocMatch = LocPick & { sub: string }

/**
 * Ranked search over states and cities (max 8).
 * Ranking: starts-with → contains → cities whose state matches; states before cities on ties.
 */
export function locSearch(loc: Region[], raw: string, excludeCities: string[] = [], excludeStates: string[] = []): LocMatch[] {
  const q = raw.trim().toLowerCase()
  if (!q) return []
  const rank = (n: string) => {
    const s = n.toLowerCase()
    return s.startsWith(q) ? 0 : s.includes(q) ? 1 : 9
  }
  const states = loc
    .filter(l => !excludeStates.includes(l.state) && rank(l.state) < 9)
    .map(l => ({ type: 'state' as const, name: l.state, sub: 'Whole state · any city', r: rank(l.state), t: 0 }))
  const cities = loc
    .flatMap(l =>
      l.cities.map(c => ({
        type: 'city' as const,
        name: c,
        sub: l.state,
        r: Math.min(rank(c), rank(l.state) < 9 ? 3 : 9),
        t: 1,
      })),
    )
    .filter(x => x.r < 9 && !excludeCities.includes(x.name))
  return [...states, ...cities]
    .sort((a, b) => a.r - b.r || a.t - b.t || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map(({ type, name, sub }) => ({ type, name, sub }))
}
