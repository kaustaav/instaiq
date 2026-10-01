import { useEffect, type RefObject } from 'react'

/** Scrolls a list container back to the top whenever `key` changes (e.g. the page number). */
export function useScrollTopOnChange(ref: RefObject<HTMLElement | null>, key: unknown) {
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 })
  }, [ref, key])
}
