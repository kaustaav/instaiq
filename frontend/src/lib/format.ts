import { AVATAR, DOT, TONE } from './palette'

export const DAY = 864e5

/** <1000 raw; K / M with one decimal below 100 (8.4K, 120K, 1.2M). */
export function fmt(n: number): string {
  const t = (v: number, u: string) => (v >= 100 ? Math.round(v) : +v.toFixed(1)) + u
  return n >= 1e6 ? t(n / 1e6, 'M') : n >= 1000 ? t(n / 1000, 'K') : String(n)
}

export const mon = (ts: number) => new Date(ts).toLocaleString('en-GB', { month: 'short', year: 'numeric' })
export const dstr = (ts: number) =>
  new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN')
export const digits = (v: string) => String(v || '').replace(/[^0-9.]/g, '')

export const igUrl = (handle: string) => 'https://www.instagram.com/' + handle.replace(/^@/, '') + '/'

export const initials = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()

export const avatarColor = (id: number) => AVATAR[(id - 1) % AVATAR.length]

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  Jewellery: TONE.indigo,
  Fashion: TONE.purple,
  Beauty: TONE.pink,
  Food: TONE.orange,
  Fitness: TONE.green,
  Travel: TONE.teal,
  Lifestyle: TONE.gray,
}
export const categoryColor = (c: string) => CATEGORY_COLORS[c] ?? TONE.gray

export type FreshTier = 'fresh' | 'ageing' | 'stale'
export type Freshness = { tier: FreshTier; label: string; short: string; bg: string; fg: string; dot: string }

/** ≤30d fresh · 31–90d ageing · >90d stale. */
export function freshness(ts: number): Freshness {
  const d = Math.max(0, Math.floor((Date.now() - ts) / DAY))
  const mo = mon(ts)
  if (d <= 30)
    return {
      tier: 'fresh',
      label: d === 0 ? 'Updated today' : d === 1 ? 'Updated yesterday' : `Updated ${d} days ago`,
      short: d === 0 ? 'Today' : `${d}d ago`,
      ...TONE.green, dot: DOT.green,
    }
  if (d <= 90) return { tier: 'ageing', label: `Updated in ${mo}`, short: mo, ...TONE.orange, dot: DOT.orange }
  return { tier: 'stale', label: `Stale · last updated ${mo}`, short: `Stale · ${mo}`, ...TONE.red, dot: DOT.red }
}

export const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
export const uniq = <T,>(arr: T[]) => [...new Set(arr)]

/** Chip-list collapse: the first `visible` items plus anything selected, unless expanded. */
export function collapse<T>(all: T[], selected: T[], visible: number, expanded: boolean) {
  const hiddenCount = all.filter((v, k) => k >= visible && !selected.includes(v)).length
  return {
    shown: expanded ? all : all.filter((v, k) => k < visible || selected.includes(v)),
    hiddenCount,
    canToggle: expanded || hiddenCount > 0,
  }
}
