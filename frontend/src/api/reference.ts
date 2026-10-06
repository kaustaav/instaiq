/** Reference lists (niches, languages) and adding custom values. Locations stay built in for now. */
import { apiDelete, apiGet, apiPost } from './client'

export type ApiReference = { categories: string[]; languages: string[] }
/** `value` is the stored spelling ("jewellery" -> "Jewellery"); created = false when it already existed. */
export type Added = { value: string; created: boolean }

export type CustomOptions = { categories: { value: string; usedBy: number }[]; languages: { value: string; usedBy: number }[] }
export type RenamedApi = { value: string; merged: boolean; influencersUpdated: number }

const path = (kind: 'cats' | 'langs') => (kind === 'cats' ? 'categories' : 'languages')
export const getCustomOptions = (_key: string, signal: AbortSignal) => apiGet<CustomOptions>('/reference/custom', signal)
export const renameOptionApi = (kind: 'cats' | 'langs', from: string, to: string) =>
  apiPost<RenamedApi>(`/reference/${path(kind)}/rename`, { from, to })
export const removeOptionApi = (kind: 'cats' | 'langs', value: string) =>
  apiDelete<void>(`/reference/${path(kind)}?value=${encodeURIComponent(value)}`)

export const getReference = (signal?: AbortSignal) => apiGet<ApiReference>('/reference', signal)
export const addCategoryApi = (value: string) => apiPost<Added>('/reference/categories', { value })
export const addLanguageApi = (value: string) => apiPost<Added>('/reference/languages', { value })
