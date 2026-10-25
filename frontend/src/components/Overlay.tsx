import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { LazyMotion, m, useReducedMotion, type Transition } from 'motion/react'

/**
 * Drawers and dialogs. The dim layer fades; the panel moves on a spring (no bounce: these open from a click,
 * not a flick). Drawers enter from the right and leave the same way; dialogs scale up from slightly smaller.
 * Springs start from wherever the panel is, so closing mid-way simply reverses. With "Reduce motion" on,
 * everything cross-fades instead.
 *
 * Exit animations need the parent to render the overlay inside <AnimatePresence>.
 */
type Kind = 'drawer' | 'dialog'

const loadFeatures = () => import('../lib/motionFeatures').then(r => r.default)
// fetch them shortly after start-up, so even the first drawer animates without waiting
window.setTimeout(() => void loadFeatures(), 1500)

const SPRING: Transition = { type: 'spring', bounce: 0, visualDuration: 0.34 }
const DIALOG_SPRING: Transition = { type: 'spring', bounce: 0, visualDuration: 0.24 }

export function Overlay({ kind, z, onDismiss, children }: { kind: Kind; z: number; onDismiss: () => void; children: ReactNode }) {
  return (
    // LazyMotion + m: only the animation features we use, fetched as a separate file after the page appears
    <LazyMotion features={loadFeatures} strict>
    <div className={`layer layer-${kind}`} style={{ zIndex: z }}>
      <m.div className="layer-dim" onClick={onDismiss} aria-hidden="true"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} />
      {children}
    </div>
    </LazyMotion>
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

  return (
    <m.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy}
      className={className ?? (kind === 'drawer' ? 'drawer' : 'modal')} style={style} {...motionProps}>
      {children}
    </m.div>
  )
}
