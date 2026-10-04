import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { searchInfluencers, summaryToInfluencer } from '../api/influencers'
import type { Page } from '../lib/paginate'
import { useStore } from '../store'
import type { Influencer } from '../types'

export type ApiSearchPage = {
  page: Page<Influencer>
  loading: boolean
  error: string | null
  retry: () => void
}

const EMPTY: Page<Influencer> = { items: [], page: 1, totalPages: 1, total: 0, from: 0, to: 0 }
const TYPING_DELAY_MS = 250

/**
 * One page of GET /api/influencers?{query}. `query` null = don't fetch (demo mode).
 * Fetches again when the query changes, on retry, and after any write (store.dataRev).
 */
export function useApiSearchPage(query: string | null): ApiSearchPage {
  const { loc, dataRev } = useStore()
  const [attempt, setAttempt] = useState(0) // bumping this re-runs the request (retry)
  const key = `${query}#${attempt}#${dataRev}`
  // The last finished request, tagged with the key it was for. "Loading" is derived (key differs) rather than
  // stored, so we never set state synchronously inside the effect.
  const [settled, setSettled] = useState<{ key: string; page: Page<Influencer> | null; error: string | null } | null>(null)

  useEffect(() => {
    if (query == null) return
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
  }, [query, key, loc])

  const retry = useCallback(() => setAttempt(a => a + 1), [])
  const loading = settled?.key !== key
  return {
    page: settled?.page ?? EMPTY, // keep showing the previous results while the next ones load
    loading,
    error: loading ? null : settled.error,
    retry,
  }
}

export type TierCounts = { all: number; fresh: number; ageing: number; stale: number }

/** Totals per metrics-freshness tier (4 tiny requests: size=1, only `total` is used). `enabled` false = demo mode. */
export function useTierCounts(enabled: boolean): TierCounts | null {
  const { dataRev } = useStore()
  const [settled, setSettled] = useState<{ rev: number; counts: TierCounts } | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const total = (fresh?: string) =>
      searchInfluencers(new URLSearchParams(fresh ? { fresh, size: '1' } : { size: '1' }), controller.signal).then(p => p.total)
    Promise.all([total(), total('fresh'), total('ageing'), total('stale')])
      .then(([all, fresh, ageing, stale]) => setSettled({ rev: dataRev, counts: { all, fresh, ageing, stale } }))
      .catch(() => { /* counts are a nice-to-have; the list shows its own errors */ })
    return () => controller.abort()
  }, [enabled, dataRev])

  return settled?.counts ?? null // the previous counts stay up while new ones load
}
