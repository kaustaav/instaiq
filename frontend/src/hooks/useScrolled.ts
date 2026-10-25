import { useEffect, useState, type RefObject } from 'react'

/**
 * True once the container has scrolled. Frosted toolbars use it to show their bottom hairline only when
 * content is actually underneath them (Apple's "scroll edge" effect), instead of a line that's always there.
 */
export function useScrolled(ref: RefObject<HTMLElement | null>) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 2)
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ref])
  return scrolled
}
