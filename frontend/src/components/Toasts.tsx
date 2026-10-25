import { useSyncExternalStore } from 'react'
import { AnimatePresence, LazyMotion, m, useReducedMotion } from 'motion/react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { loadFeatures } from '../lib/motionLoader'
import { currentNotices, dismissNotice, subscribeNotices } from '../lib/notify'

/** The notices raised with notify() (lib/notify.ts): small frosted cards that spring up at the bottom of the screen. */
const ICON = { success: CircleCheck, error: CircleAlert, info: Info }

export function Toaster() {
  const list = useSyncExternalStore(subscribeNotices, currentNotices)
  const reduce = useReducedMotion()
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 24, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, scale: 0.96, transition: { duration: 0.16 } } }
  return (
    <LazyMotion features={loadFeatures} strict>
      <div className="toasts" role="region" aria-label="Notifications">
        <AnimatePresence initial={false}>
          {list.map(t => {
            const Icon = ICON[t.kind]
            return (
              <m.div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}
                transition={{ type: 'spring', bounce: 0, visualDuration: 0.3 }} {...motionProps}>
                <Icon size={17} className="toast-icon" aria-hidden="true" />
                <span className="toast-text">{t.text}</span>
                {t.action && (
                  <button type="button" className="btn btn-tint btn-sm" onClick={() => { dismissNotice(t.id); t.action!.run() }}>
                    {t.action.label}
                  </button>
                )}
                <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismissNotice(t.id)}>
                  <X size={13} strokeWidth={2.5} />
                </button>
              </m.div>
            )
          })}
        </AnimatePresence>
      </div>
    </LazyMotion>
  )
}
