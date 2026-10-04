import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Campaign, Influencer, Region, SeedInfluencer } from './types'
import {
  GEO, METRICS_AGE_DAYS, RATES_AGE_DAYS, SEED_CATEGORIES, SEED_INFLUENCERS, SEED_LANGUAGES, SEED_NOTE,
} from './data/seed'
import { SEED_CAMPAIGNS } from './data/seed-campaigns'
import GENERATED from './data/generated-influencers.json'
import { DAY } from './lib/format'
import { parseGeo, stateOf } from './lib/locations'
import { toInfluencer, type Draft } from './lib/influencerForm'
import { addMembers, duplicateCampaign, newCampaign, type CampaignInput } from './lib/campaigns'

const ago = (days: number) => Date.now() - days * DAY
const scalePrice = (p: string, f: number) => {
  const n = +String(p).replace(/[^0-9]/g, '')
  return '₹' + (Math.round((n * f) / 100) * 100).toLocaleString('en-IN')
}

/** The 20 prototype profiles plus synthetic ones from scripts/generate-influencers.mjs. */
const SEED: SeedInfluencer[] = [
  ...SEED_INFLUENCERS.map((i, k) => ({ ...i, metricsAgeDays: METRICS_AGE_DAYS[k], ratesAgeDays: RATES_AGE_DAYS[k] })),
  ...(GENERATED as SeedInfluencer[]),
]

/** Attaches relative dates and a synthetic rate history, as the prototype does. */
function hydrate({ metricsAgeDays, ratesAgeDays, ...i }: SeedInfluencer): Influencer {
  const cur = { date: ago(ratesAgeDays), ...i.pricing }
  const rates = [cur]
  const older = (days: number, f: number) => ({
    date: ago(ratesAgeDays + days),
    story: scalePrice(cur.story, f),
    reel: scalePrice(cur.reel, f),
    post: scalePrice(cur.post, f),
  })
  // older, cheaper rate cards for some profiles (none when rates were never shared)
  const k = i.id - 1
  if (cur.reel !== '—') {
    if (k % 3 !== 2) rates.push(older(180, 0.8))
    if (k % 4 === 0) rates.push(older(420, 0.65))
  }
  return { ...i, updatedAt: ago(metricsAgeDays), rates, note: i.id === 1 ? SEED_NOTE : '' }
}

type Store = {
  infs: Influencer[]
  campaigns: Campaign[]
  loc: Region[]
  cats: string[]
  langs: string[]
  /** API mode: bumped after every successful write, so screens showing server data fetch again. */
  dataRev: number
  dataChanged: () => void
  /**
   * Applies a rule function from lib/campaigns.ts to one campaign.
   * Returns '' on success or the rule's error message (nothing changes on error).
   */
  runCampaign: (id: number, action: (c: Campaign) => Campaign) => string
  createCampaign: (input: CampaignInput) => Campaign | string
  duplicateCampaign: (id: number) => Campaign
  /** Adds influencers at SHORTLISTED; already-present ones are skipped. */
  addToCampaign: (id: number, influencerIds: number[]) => { added: number; skipped: number } | string
  saveInfluencer: (draft: Draft) => Influencer
  deleteInfluencer: (id: number) => void
  setNote: (id: number, note: string) => void
  /** Adds a city under a state. Returns an error message, or '' on success. */
  addCity: (state: string, name: string) => string
  /** Adds a niche/language if new (case-insensitive). Returns the canonical value. */
  addCategory: (name: string) => string
  addLanguage: (name: string) => string
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [infs, setInfs] = useState(() => SEED.map(hydrate))
  const [campaigns, setCampaigns] = useState<Campaign[]>(SEED_CAMPAIGNS)
  const [loc, setLoc] = useState(() => parseGeo(GEO))
  const [cats, setCats] = useState(SEED_CATEGORIES)
  const [langs, setLangs] = useState(SEED_LANGUAGES)
  const [dataRev, setDataRev] = useState(0)

  const store = useMemo<Store>(() => {
    const addTo = (list: string[], set: (v: string[]) => void, raw: string) => {
      const v = raw.trim()
      const existing = list.find(x => x.toLowerCase() === v.toLowerCase())
      if (existing) return existing
      set([...list, v])
      return v
    }
    return {
      infs, campaigns, loc, cats, langs,
      dataRev,
      dataChanged: () => setDataRev(r => r + 1),
      runCampaign: (id, action) => {
        const c = campaigns.find(x => x.id === id)
        if (!c) return 'Campaign not found'
        try {
          const next = action(c)
          setCampaigns(cs => cs.map(x => (x.id === id ? next : x)))
          return ''
        } catch (e) {
          return e instanceof Error ? e.message : String(e)
        }
      },
      createCampaign: input => {
        try {
          const c = newCampaign(Math.max(0, ...campaigns.map(x => x.id)) + 1, input)
          setCampaigns(cs => [c, ...cs])
          return c
        } catch (e) {
          return e instanceof Error ? e.message : String(e)
        }
      },
      duplicateCampaign: id => {
        const src = campaigns.find(x => x.id === id)!
        const c = duplicateCampaign(src, Math.max(0, ...campaigns.map(x => x.id)) + 1)
        setCampaigns(cs => [c, ...cs])
        return c
      },
      addToCampaign: (id, ids) => {
        const c = campaigns.find(x => x.id === id)
        if (!c) return 'Campaign not found'
        try {
          const r = addMembers(c, ids)
          setCampaigns(cs => cs.map(x => (x.id === id ? r.campaign : x)))
          return { added: r.added, skipped: r.skipped }
        } catch (e) {
          return e instanceof Error ? e.message : String(e)
        }
      },
      saveInfluencer: draft => {
        const prev = draft.id != null ? infs.find(i => i.id === draft.id) : undefined
        const rec = toInfluencer(draft, prev, Math.max(0, ...infs.map(i => i.id)) + 1, loc)
        setInfs(prev ? infs.map(i => (i.id === rec.id ? rec : i)) : [...infs, rec])
        return rec
      },
      deleteInfluencer: id => {
        setInfs(xs => xs.filter(i => i.id !== id))
        // prototype only: the real app archives influencers instead of deleting them
        setCampaigns(cs => cs.map(c => ({ ...c, members: c.members.filter(m => m.influencerId !== id) })))
      },
      setNote: (id, note) => setInfs(xs => xs.map(i => (i.id === id ? { ...i, note } : i))),
      addCity: (state, raw) => {
        const name = raw.trim()
        if (!name) return ''
        const owner = stateOf(loc, name)
        if (owner && owner !== state) return `${name} already belongs to ${owner}`
        if (!owner) setLoc(ls => ls.map(l => (l.state === state ? { ...l, cities: [...l.cities, name] } : l)))
        return ''
      },
      addCategory: raw => addTo(cats, setCats, raw),
      addLanguage: raw => addTo(langs, setLangs, raw),
    }
  }, [infs, campaigns, loc, cats, langs, dataRev])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider
export function useStore() {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore must be used inside <StoreProvider>')
  return s
}
