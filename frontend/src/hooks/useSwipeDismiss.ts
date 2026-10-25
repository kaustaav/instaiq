import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * Swipe to dismiss (touch and pen only; a mouse keeps normal text selection). Tracks the finger 1:1 from where it
 * grabbed, commits to the gesture only after ~10px of clearly sideways movement (so vertical scrolling still works),
 * resists progressively when pulled the wrong way, and on release reports the offset and the finger's velocity.
 * The caller animates: use `shouldDismiss` to decide, and hand the velocity to the spring so there's no seam.
 *
 * `offset` and `velocity` are measured in the dismiss direction: positive = towards closing.
 */
type Options = {
  direction: 'left' | 'right'
  /** The element's size along the swipe, for rubber-banding and the dismiss threshold. */
  size: () => number
  onMove: (offset: number) => void
  onEnd: (offset: number, velocity: number) => void
}

const SLOP = 10 // px before deciding between "swipe" and "scroll"

/** Apple's momentum projection: where a flick at `velocity` px/s would come to rest (decay rate 0.998). */
export const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate)

/**
 * Close when the gesture, carried forward by its momentum, would end past 40% of the way out, capped at 200px
 * so tall sheets don't need an extra-long throw.
 */
export const shouldDismiss = (offset: number, velocity: number, size: number) =>
  offset + project(velocity) > Math.min(size * 0.4, 200)

/**
 * Release velocity in px/s from recent (time, position) samples. Uses the last ~100ms; if events arrived
 * bunched up and that window holds no movement, falls back to the last movement within 300ms.
 */
export function velocityAt(samples: { t: number; at: number }[], endT: number, endAt: number) {
  const pick = (window: number) => samples.find(p => endT - p.t <= window && p.at !== endAt)
  const from = pick(100) ?? pick(300)
  return from ? ((endAt - from.at) / Math.max(1, endT - from.t)) * 1000 : 0
}

/** Resistance past a boundary: the further you pull, the less it follows (Apple's rubber-band curve). */
export const rubberband = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over))

/** True if something between the target and the swipe surface scrolls sideways, or is a control that drags. */
function startsInside(target: HTMLElement, surface: HTMLElement) {
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-no-swipe]')) return true
  for (let el: HTMLElement | null = target; el && el !== surface; el = el.parentElement) {
    const ox = getComputedStyle(el).overflowX
    if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) return true
  }
  return false
}

export function useSwipeDismiss({ direction, size, onMove, onEnd }: Options) {
  const sign = direction === 'right' ? 1 : -1
  const g = useRef<{ id: number; x0: number; y0: number; state: 'pending' | 'drag'; offset: number; samples: { t: number; at: number }[] } | null>(null)

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' || !e.isPrimary) return
    if (startsInside(e.target as HTMLElement, e.currentTarget)) return
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, state: 'pending', offset: 0, samples: [{ t: e.timeStamp, at: e.clientX }] }
    const surface = e.currentTarget

    const move = (ev: PointerEvent) => {
      const s = g.current
      if (!s || ev.pointerId !== s.id) return
      const dx = ev.clientX - s.x0
      const dy = ev.clientY - s.y0
      if (s.state === 'pending') {
        if (Math.hypot(dx, dy) < SLOP) return
        // vertical, or the wrong way at the start: it's a scroll, not a swipe
        if (Math.abs(dy) > Math.abs(dx) || dx * sign < 0) return finish(ev, false)
        s.state = 'drag'
        surface.setPointerCapture(s.id)
      }
      const raw = dx * sign
      s.offset = raw >= 0 ? raw : rubberband(raw, size())
      s.samples.push({ t: ev.timeStamp, at: ev.clientX })
      if (s.samples.length > 6) s.samples.shift()
      onMove(s.offset)
    }

    const finish = (ev: PointerEvent, release = true) => {
      const s = g.current
      if (!s || ev.pointerId !== s.id) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      g.current = null
      if (s.state !== 'drag' || !release) return
      // in px/s, in the dismiss direction
      const velocity = velocityAt(s.samples, ev.timeStamp, ev.clientX) * sign
      // a drag ends without a click on whatever was under the finger
      surface.addEventListener('click', stop, { capture: true, once: true })
      setTimeout(() => surface.removeEventListener('click', stop, { capture: true }), 0)
      onEnd(s.offset, velocity)
    }
    const up = (ev: PointerEvent) => finish(ev)
    const cancel = (ev: PointerEvent) => finish(ev)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  return { onPointerDown }
}

const stop = (e: Event) => { e.stopPropagation(); e.preventDefault() }
