import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, LazyMotion, m, useReducedMotion } from 'motion/react'
import { Ellipsis, type LucideIcon } from 'lucide-react'
import { loadFeatures } from '../lib/motionLoader'

export type MenuItem =
  | { label: string; icon?: LucideIcon; onSelect: () => void; disabled?: boolean; danger?: boolean; hint?: string; tag?: string }
  | 'separator'

/**
 * "•••" menu, macOS style: grows out of its button (anchored at the button's corner), arrow keys move,
 * Enter picks, Esc / click outside closes, focus goes back to the button. Destructive items are red.
 *
 * One highlight, which follows whatever you're using: it is the focused item, and hovering moves focus.
 * Opened by mouse, nothing is highlighted until you point at something; opened by keyboard, the first item is.
 *
 * The menu floats above the page (a portal), so scrolling containers like tables can't clip it; it opens upwards
 * when there's no room below, and closes if the page scrolls.
 */
type Pos = { top?: number; bottom?: number; right: number; up: boolean }

export function Menu({ items, label = 'More actions', trigger, small }: { items: MenuItem[]; label?: string; trigger?: ReactNode; small?: boolean }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const openedByKey = useRef(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const reduce = useReducedMotion()

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) btnRef.current?.focus()
  }

  const show = (byKey: boolean) => {
    const r = btnRef.current!.getBoundingClientRect()
    const height = items.length * 34 + 12 // close enough to decide up or down
    const up = r.bottom + height + 12 > window.innerHeight && r.top > height + 12
    setPos(up
      ? { bottom: window.innerHeight - r.top + 6, right: window.innerWidth - r.right, up }
      : { top: r.bottom + 6, right: window.innerWidth - r.right, up })
    openedByKey.current = byKey
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    // keyboard: highlight the first item; mouse: focus the menu itself (no highlight, arrows still work)
    requestAnimationFrame(() => {
      const first = listRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
      if (openedByKey.current) first?.focus()
      else listRef.current?.focus()
    })
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!listRef.current?.contains(t) && !btnRef.current?.contains(t)) close(false)
    }
    // a floating menu would drift away from its button: close on scroll or resize, as macOS does
    const onMove = (e: Event) => { if (!(e.target instanceof Node) || !listRef.current?.contains(e.target)) close(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  const onKey = (e: React.KeyboardEvent) => {
    const all = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])]
    const i = all.indexOf(document.activeElement as HTMLElement)
    const go = (k: number) => { e.preventDefault(); all[(k + all.length) % all.length]?.focus() }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i < 0 ? all.length - 1 : i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(all.length - 1)
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); close() }
  }

  return (
    <div className="menu-wrap">
      <button ref={btnRef} type="button" className={small ? 'btn btn-plain menu-btn menu-btn-sm' : 'btn btn-ghost menu-btn'}
        aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); show(true) }
        }}
        onClick={e => { e.stopPropagation(); if (open) close(false); else show(false) }}>
        {trigger ?? <Ellipsis size={small ? 15 : 16} />}
      </button>
      {createPortal(
      <LazyMotion features={loadFeatures} strict>
        <AnimatePresence>
          {open && (
            <m.div ref={listRef} id={id} role="menu" aria-label={label} className="menu" tabIndex={-1} onKeyDown={onKey}
              onMouseLeave={() => listRef.current?.focus()}
              onClick={e => e.stopPropagation()}
              style={{ ...pos, transformOrigin: pos?.up ? 'bottom right' : 'top right' }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}>
              {items.map((it, k) => it === 'separator' ? <div key={k} className="menu-sep" role="separator" /> : (
                <button key={k} type="button" role="menuitem" className={it.danger ? 'menu-item danger' : 'menu-item'}
                  disabled={it.disabled} title={it.hint} onClick={() => { close(); it.onSelect() }}
                  onMouseEnter={e => e.currentTarget.focus()}>
                  {it.icon && <it.icon size={15} />}
                  <span>{it.label}</span>
                  {it.tag && <span className="soon-pill menu-tag">{it.tag}</span>}
                </button>
              ))}
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>,
      document.body)}
    </div>
  )
}
