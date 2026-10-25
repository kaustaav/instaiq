import { createContext, useContext, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { LazyMotion, m, useMotionValue, useReducedMotion, type Transition } from 'motion/react'
import { shouldDismiss, useSwipeDismiss } from '../hooks/useSwipeDismiss'
import { loadFeatures, motionCode } from '../lib/motionLoader'

/**
 * Drawers and dialogs. The dim layer fades; the panel moves on a spring (no bounce: these open from a click,
 * not a flick). Drawers enter from the right and leave the same way; dialogs scale up from slightly smaller.
 * Springs start from wherever the panel is, so closing mid-way simply reverses. With "Reduce motion" on,
 * everything cross-fades instead.
 *
 * Exit animations need the parent to render the overlay inside <AnimatePresence>.
 */
type Kind = 'drawer' | 'dialog'

const SPRING: Transition = { type: 'spring', bounce: 0, visualDuration: 0.34 }
const DIALOG_SPRING: Transition = { type: 'spring', bounce: 0, visualDuration: 0.24 }

const Dismiss = createContext<() => void>(() => {})

export function Overlay({ kind, z, onDismiss, children }: { kind: Kind; z: number; onDismiss: () => void; children: ReactNode }) {
  return (
    <Dismiss.Provider value={onDismiss}>
    {/* LazyMotion + m: only the animation features we use, fetched as a separate file after the page appears */}
    <LazyMotion features={loadFeatures} strict>
    <div className={`layer layer-${kind}`} style={{ zIndex: z }}>
      <m.div className="layer-dim" onClick={onDismiss} aria-hidden="true"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} />
      {children}
    </div>
    </LazyMotion>
    </Dismiss.Provider>
  )
}

export function Panel({ kind, labelledBy, className, style, children }: {
  kind: Kind
  labelledBy: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  // focus moves into the panel when it opens and back to whatever opened it when it closes
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    if (ref.current && !ref.current.contains(document.activeElement)) ref.current.focus({ preventScroll: true })
    return () => { if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])

  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 } }
    : kind === 'drawer'
      ? { initial: { x: '110%' }, animate: { x: 0 }, exit: { x: '110%' }, transition: SPRING }
      : { initial: { opacity: 0, scale: 0.94 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.97, transition: { duration: 0.14 } }, transition: DIALOG_SPRING }

  const panel = (
    <m.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy}
      className={className ?? (kind === 'drawer' ? 'drawer' : 'modal')} style={style} {...motionProps}>
      {children}
    </m.div>
  )
  return kind === 'drawer' ? <SwipeTrack>{panel}</SwipeTrack> : panel
}

/**
 * Drawers on touch screens: drag right to close. The track follows the finger; on release it either springs
 * out (carrying the finger's speed, then the drawer is dismissed) or springs back, with a little bounce
 * because the gesture had momentum.
 */
function SwipeTrack({ children }: { children: ReactNode }) {
  const onDismiss = useContext(Dismiss)
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const ref = useRef<HTMLDivElement>(null)
  const width = () => ref.current?.offsetWidth ?? 400
  const swipe = useSwipeDismiss({
    direction: 'right',
    size: width,
    onMove: offset => x.set(offset),
    onEnd: (offset, velocity) => {
      // already fetched by the time anyone swipes (see loadFeatures), so this resolves at once
      void motionCode().then(({ animate }) => {
        if (shouldDismiss(offset, velocity, width())) {
          animate(x, width() + 16, reduce ? { duration: 0.15 } : { type: 'spring', bounce: 0, visualDuration: 0.28, velocity })
            .then(onDismiss)
        } else {
          animate(x, 0, reduce ? { duration: 0.15 } : { type: 'spring', bounce: 0.18, visualDuration: 0.38, velocity })
        }
      })
    },
  })
  return <m.div ref={ref} className="drawer-track" style={{ x }} onPointerDown={swipe.onPointerDown}>{children}</m.div>
}
