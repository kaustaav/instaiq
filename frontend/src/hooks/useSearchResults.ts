import { useCallback, useMemo } from 'react'
import { apiEnabled } from '../api/client'
import { searchInfluencerIds } from '../api/influencers'
import { applyFilters, SEARCH_PAGE_SIZE, searchToParams, type Filters } from '../lib/search'
import { paginate, type Page } from '../lib/paginate'
import { useStore } from '../store'
import type { Influencer } from '../types'
import { useApiSearchPage } from './useApiSearchPage'

export type SearchResults = {
  results: Page<Influencer>
  loading: boolean
  error: string | null
  retry: () => void
  /** Ids of every match (not just this page), for "Add all to campaign". */
  allIds: () => Promise<number[]>
}

/**
 * Search results from the built-in data (demo mode) or from the API (when VITE_API_URL is set).
 * Screens use this and don't care which.
 */
export function useSearchResults(filters: Filters, page: number): SearchResults {
  const { infs, loc } = useStore()
  const api = apiEnabled()

  // ---------- demo mode: filter in the browser, as before ----------
  const local = useMemo(() => {
    if (api) return null
    const matches = applyFilters(infs, filters, loc)
    return { page: paginate(matches, page, SEARCH_PAGE_SIZE), ids: matches.map(i => i.id) }
  }, [api, infs, filters, loc, page])

  // ---------- API mode ----------
  // The UI's own URL params are the API's contract. ("view" isn't a search input.)
  const query = searchToParams({ filters, page, view: 'grid' }).toString()
  const remote = useApiSearchPage(api ? query : null)

  const allIds = useCallback(async () => {
    if (local) return local.ids
    const params = new URLSearchParams(query)
    params.delete('page')
    return searchInfluencerIds(params)
  }, [local, query])

  if (local) return { results: local.page, loading: false, error: null, retry: remote.retry, allIds }
  return { results: remote.page, loading: remote.loading, error: remote.error, retry: remote.retry, allIds }
}
