/** Reference lists (niches, languages) and adding custom values. Locations stay built in for now. */
import { apiGet, apiPost } from './client'

export type ApiReference = { categories: string[]; languages: string[] }
/** `value` is the stored spelling ("jewellery" -> "Jewellery"); created = false when it already existed. */
export type Added = { value: string; created: boolean }

export const getReference = (signal?: AbortSignal) => apiGet<ApiReference>('/reference', signal)
export const addCategoryApi = (value: string) => apiPost<Added>('/reference/categories', { value })
export const addLanguageApi = (value: string) => apiPost<Added>('/reference/languages', { value })
