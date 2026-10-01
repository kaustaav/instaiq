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

const AVATAR_COLORS = ['#2E21DE', '#573EBB', '#3488A3', '#007B4D', '#D97706', '#7C2D12', '#18181B']
export const avatarColor = (id: number) => AVATAR_COLORS[(id - 1) % AVATAR_COLORS.length]

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  Jewellery: { bg: '#EEF0FF', fg: '#1D2477' },
  Fashion: { bg: '#EEE9FF', fg: '#3D2F99' },
  Beauty: { bg: '#FEF4E4', fg: '#8B5E00' },
  Food: { bg: '#E7F7EF', fg: '#005E3B' },
  Fitness: { bg: '#E4F3F8', fg: '#1A6480' },
  Travel: { bg: '#E4F5F4', fg: '#1A7070' },
  Lifestyle: { bg: '#F4F4F5', fg: '#3F3F46' },
}
export const categoryColor = (c: string) => CATEGORY_COLORS[c] ?? { bg: '#F4F4F5', fg: '#3F3F46' }

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
      bg: '#E7F7EF', fg: '#005E3B', dot: '#12A363',
    }
  if (d <= 90) return { tier: 'ageing', label: `Updated in ${mo}`, short: mo, bg: '#FEF4E4', fg: '#8B5E00', dot: '#D97706' }
  return { tier: 'stale', label: `Stale · last updated ${mo}`, short: `Stale · ${mo}`, bg: '#FDECEC', fg: '#9F1D1D', dot: '#DC2626' }
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
