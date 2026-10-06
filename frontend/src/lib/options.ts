/**
 * Custom niches and languages: the same rules as the backend (ReferenceDataService), so demo mode behaves like
 * the real thing. Built-in values (the seed lists) can't be renamed or deleted.
 */
import type { Influencer } from '../types'

export type OptionKind = 'cats' | 'langs'
export type CustomOption = { value: string; usedBy: number }
export type Renamed = { value: string; merged: boolean; influencersUpdated: number }

export const KIND_LABEL: Record<OptionKind, string> = { cats: 'Niche', langs: 'Language' }

const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N} &'./-]{0,39}$/u

/** "home   &  decor" -> "Home & Decor" (words already capitalized, like "DIY", are kept), or an error message. */
export function normalizeOption(kind: OptionKind, raw: string): { value: string } | { error: string } {
  const value = raw.trim().replace(/\s+/g, ' ').split(' ')
    .map(w => (w && w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
  return ALLOWED.test(value) ? { value } : { error: `${KIND_LABEL[kind]} must be 1-40 characters: letters, numbers, spaces and & ' . / -` }
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** The existing value a new name would merge into (case-insensitive), if any other than `from`. */
export const mergeTarget = (list: string[], from: string, to: string) => list.find(v => same(v, to) && !same(v, from))

/** Replace `from` by `to` in one influencer's list, keeping the order and never duplicating. */
export function replaceIn(values: string[], from: string, to: string): string[] {
  if (!values.includes(from)) return values
  return values.includes(to) ? values.filter(v => v !== from) : values.map(v => (v === from ? to : v))
}

export const usage = (infs: Influencer[], kind: OptionKind, value: string) => infs.filter(i => i[kind].includes(value)).length
