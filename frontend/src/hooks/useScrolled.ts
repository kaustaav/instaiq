import { useEffect, useState, type RefObject } from 'react'

/**
 * True once the container has scrolled. Frosted toolbars use it to show their bottom hairline only when
 * content is actually underneath them (Apple's "scroll edge" effect), instead of a line that's always there.
 */
/**
 * `ready`: pass false while the scrolling element isn't rendered yet (e.g. a skeleton is showing).
 * `after`: an element above a sticky toolbar (e.g. the large title); then "scrolled" means it has scrolled out of
 * view, i.e. the toolbar has pinned. (Measured on the title because a sticky element reports its stuck position.)
 */
export function useScrolled(ref: RefObject<HTMLElement | null>, ready = true, after?: RefObject<HTMLElement | null>) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const a = after?.current
      setScrolled(el.scrollTop > (a ? a.offsetTop + a.offsetHeight : 0) + 2)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ref, ready, after])
  return scrolled
}
