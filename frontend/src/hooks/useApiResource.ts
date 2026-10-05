import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { useStore } from '../store'

export type Resource<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }

/**
 * Loads one API resource. `key` null = don't load (demo mode). `fetcher` must be a stable (module-level) function.
 * Loads again on retry and after any write (store.dataRev); a reload of the same key keeps showing the old data
 * until the new data arrives, so saves don't flash a "Loading…" screen.
 */
export function useApiResource<T>(
  key: string | null,
  fetcher: (key: string, signal: AbortSignal) => Promise<T>,
): Resource<T> & { retry: () => void } {
  const { dataRev } = useStore()
  const [attempt, setAttempt] = useState(0)
  const rev = `${dataRev}#${attempt}`
  const [settled, setSettled] = useState<{ key: string; state: Resource<T> } | null>(null)

  useEffect(() => {
    if (key == null) return
    const controller = new AbortController()
    fetcher(key, controller.signal)
      .then(data => setSettled({ key, state: { kind: 'ready', data } }))
      .catch(e => {
        if ((e as Error).name === 'AbortError') return
        setSettled({
          key,
          state: e instanceof ApiError && (e.status === 404 || e.status === 400)
            ? { kind: 'not-found' }
            : { kind: 'error', message: e instanceof Error ? e.message : 'Could not load' },
        })
      })
    return () => controller.abort()
  }, [key, rev, fetcher])

  const retry = useCallback(() => setAttempt(a => a + 1), [])
  const state: Resource<T> = settled && settled.key === key ? settled.state : { kind: 'loading' }
  return { ...state, retry }
}
