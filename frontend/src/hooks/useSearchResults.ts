import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiEnabled, ApiError } from '../api/client'
import { searchInfluencerIds, searchInfluencers, summaryToInfluencer } from '../api/influencers'
import { applyFilters, SEARCH_PAGE_SIZE, searchToParams, type Filters } from '../lib/search'
import { paginate, type Page } from '../lib/paginate'
import { useStore } from '../store'
import type { Influencer } from '../types'

export type SearchResults = {
  results: Page<Influencer>
  loading: boolean
  error: string | null
  retry: () => void
  /** Ids of every match (not just this page), for "Add all to campaign". */
  allIds: () => Promise<number[]>
}

const EMPTY: Page<Influencer> = { items: [], page: 1, totalPages: 1, total: 0, from: 0, to: 0 }
const TYPING_DELAY_MS = 250

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
  // The query string is the cache key: same filters + page = same request. ("view" isn't a search input.)
  const query = searchToParams({ filters, page, view: 'grid' }).toString()
  const [attempt, setAttempt] = useState(0) // bumping this re-runs the request (retry)
  const key = `${query}#${attempt}`
  // The last finished request, tagged with the key it was for. "Loading" is derived (key differs) rather than
  // stored, so we never set state synchronously inside the effect.
  const [settled, setSettled] = useState<{ key: string; page: Page<Influencer> | null; error: string | null } | null>(null)

  useEffect(() => {
    if (!api) return
    const controller = new AbortController()
    // wait a moment so typing "bridal" sends one request, not six
    const timer = setTimeout(() => {
      searchInfluencers(new URLSearchParams(query), controller.signal)
        .then(p => {
          const from = p.total ? (p.page - 1) * p.size + 1 : 0
          setSettled({
            key,
            error: null,
            page: {
              items: p.items.map(i => summaryToInfluencer(i, loc)),
              page: p.page, totalPages: p.totalPages, total: p.total, from, to: from ? from + p.items.length - 1 : 0,
            },
          })
        })
        .catch(e => {
          if ((e as Error).name === 'AbortError') return // a newer request replaced this one
          setSettled(prev => ({ key, page: prev?.page ?? null, error: e instanceof ApiError ? e.message : 'Something went wrong while searching' }))
        })
    }, TYPING_DELAY_MS)
    // cleanup runs when the query changes or the screen closes: cancel the pending/in-flight request
    return () => { clearTimeout(timer); controller.abort() }
  }, [api, query, key, loc])

  const retry = useCallback(() => setAttempt(a => a + 1), [])
  const allIds = useCallback(async () => {
    if (local) return local.ids
    const params = new URLSearchParams(query)
    params.delete('page')
    return searchInfluencerIds(params)
  }, [local, query])

  if (local) return { results: local.page, loading: false, error: null, retry, allIds }
  const loading = settled?.key !== key
  return {
    results: settled?.page ?? EMPTY, // keep showing the previous results while the next ones load
    loading,
    error: loading ? null : settled.error,
    retry,
    allIds,
  }
}
