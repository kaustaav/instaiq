import { useEffect, useState } from 'react'
import { apiEnabled, ApiError } from '../api/client'
import { getInfluencer, profileToInfluencer } from '../api/influencers'
import { useStore } from '../store'
import type { Influencer } from '../types'

export type ProfileState =
  | { kind: 'loading' }
  | { kind: 'ready'; inf: Influencer }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }

/** One influencer: from the built-in data (demo mode) or GET /api/influencers/{id}. */
export function useInfluencerProfile(id: string | undefined): ProfileState {
  const { infs, loc, dataRev } = useStore()
  const api = apiEnabled()
  // the last finished load, tagged with its id; while the id differs we're loading (derived, not stored).
  // After a save (dataRev changes) the same id reloads quietly: the old profile stays until the new one arrives.
  const [settled, setSettled] = useState<{ id: string; state: ProfileState } | null>(null)

  useEffect(() => {
    if (!api || !id) return
    const controller = new AbortController()
    getInfluencer(id, controller.signal)
      .then(p => setSettled({ id, state: { kind: 'ready', inf: profileToInfluencer(p, loc) } }))
      .catch(e => {
        if ((e as Error).name === 'AbortError') return
        const state: ProfileState = e instanceof ApiError && (e.status === 404 || e.status === 400)
          ? { kind: 'not-found' }
          : { kind: 'error', message: e instanceof Error ? e.message : 'Could not load this profile' }
        setSettled({ id, state })
      })
    return () => controller.abort()
  }, [api, id, loc, dataRev])

  if (!api) {
    const inf = infs.find(i => String(i.id) === id)
    return inf ? { kind: 'ready', inf } : { kind: 'not-found' }
  }
  return settled && settled.id === id ? settled.state : { kind: 'loading' }
}
