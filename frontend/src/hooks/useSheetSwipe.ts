import { useEffect, useRef, type RefObject } from 'react'
import { rubberband, shouldDismiss, velocityAt } from './useSwipeDismiss'

/**
 * Swipe down to close a full-screen bottom sheet that also scrolls (the phone filter sheet), as iPhone sheets do:
 * from the handle area a downward swipe always moves the sheet; inside the content it does only when the content
 * is already scrolled to the top, otherwise it scrolls. The sheet follows the finger; on release it closes if the
 * gesture, carried forward by its momentum, would end far enough down (see shouldDismiss), else it springs back.
 *
 * Native touch events (not pointer events) because the browser's scrolling must be stopped once the sheet is
 * being dragged, which needs a non-passive touchmove. The CSS transition on the sheet does the final movement,
 * continuing from wherever the finger let go.
 */
export function useSheetSwipe(ref: RefObject<HTMLElement | null>, { enabled, handle, onDismiss }: {
  enabled: boolean
  /** CSS selector for the always-draggable top area. */
  handle: string
  onDismiss: () => void
}) {
  const dismiss = useRef(onDismiss)
  useEffect(() => { dismiss.current = onDismiss })

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let s: { x0: number; y0: number; fromHandle: boolean; atTop: boolean; state: 'pending' | 'drag' | 'none'; offset: number; samples: { t: number; at: number }[] } | null = null

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [data-no-swipe]')) return
      const p = e.touches[0]
      s = { x0: p.clientX, y0: p.clientY, fromHandle: !!t.closest(handle), atTop: el.scrollTop <= 0, state: 'pending', offset: 0, samples: [{ t: e.timeStamp, at: p.clientY }] }
    }
    const move = (e: TouchEvent) => {
      if (!s || s.state === 'none') return
      const p = e.touches[0]
      const dx = p.clientX - s.x0
      const dy = p.clientY - s.y0
      if (s.state === 'pending') {
        const downward = dy > 0 && Math.abs(dy) >= Math.abs(dx) && (s.fromHandle || s.atTop)
        // claim a downward touch from the first pixel, before the browser starts scrolling or bouncing
        if (downward && e.cancelable) e.preventDefault()
        if (Math.hypot(dx, dy) < 10) return
        // a clear downward swipe, from the handle or from content already at the top: move the sheet
        s.state = dy > 0 && Math.abs(dy) > Math.abs(dx) && (s.fromHandle || s.atTop) ? 'drag' : 'none'
        if (s.state === 'none') return
        el.style.transition = 'none'
      }
      e.preventDefault() // the sheet moves, the content doesn't scroll
      s.offset = dy >= 0 ? dy : rubberband(dy, el.offsetHeight)
      s.samples.push({ t: e.timeStamp, at: p.clientY })
      if (s.samples.length > 6) s.samples.shift()
      el.style.transform = `translateY(${s.offset}px)`
    }
    const end = (e: TouchEvent) => {
      if (!s) return
      const g = s
      s = null
      if (g.state !== 'drag') return
      const velocity = velocityAt(g.samples, e.timeStamp, e.changedTouches[0].clientY)
      // hand back to the CSS transition: it runs from where the finger let go
      el.style.transition = ''
      el.style.transform = ''
      if (shouldDismiss(g.offset, velocity, el.offsetHeight)) dismiss.current()
    }

    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [ref, enabled, handle])
}
