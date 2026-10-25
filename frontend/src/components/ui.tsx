import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { avatarColor, categoryColor, type Freshness, igUrl } from '../lib/format'
import type { Influencer } from '../types'

export function Avatar({ inf, size }: { inf: Pick<Influencer, 'id' | 'av'>; size: number }) {
  const fontSize = Math.round(size * 0.36)
  return (
    <div className="avatar" style={{ width: size, height: size, backgroundColor: avatarColor(inf.id), fontSize }}>
      {inf.av}
    </div>
  )
}

export function CategoryBadges({ cats, large }: { cats: string[]; large?: boolean }) {
  return (
    <div className="badges" style={large ? { gap: 5 } : undefined}>
      {cats.map(c => {
        const { bg, fg } = categoryColor(c)
        return (
          <span
            key={c}
            className="badge"
            style={{ background: bg, color: fg, ...(large && { padding: '3px 10px', fontSize: 12 }) }}
          >
            {c}
          </span>
        )
      })}
    </div>
  )
}

const stop = (e: MouseEvent) => e.stopPropagation()

/** Handle link that never also triggers the parent card/row click. */
export function IgLink({ handle, className, style }: { handle: string; className?: string; style?: React.CSSProperties }) {
  return (
    <a href={igUrl(handle)} target="_blank" rel="noopener" onClick={stop} className={className} style={style}>
      {handle}
    </a>
  )
}

export function FreshPill({ fr, short }: { fr: Freshness; short?: boolean }) {
  return (
    <span className="pill" title={fr.label} style={{ background: fr.bg, color: fr.fg }}>
      <span className="dot" style={{ background: fr.dot }} />
      {short ? fr.short : fr.label}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub: string }) {
  return (
    <div className="empty">
      <Icon size={32} />
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
    </div>
  )
}

export function PersonCell({ inf, onView }: { inf: Influencer; onView?: () => void }) {
  return (
    <div className="person">
      <Avatar inf={inf} size={28} />
      <div>
        <div className={onView ? 'person-name clickable' : 'person-name'} onClick={onView}>
          {inf.name}
        </div>
        <IgLink handle={inf.handle} className="person-handle" />
      </div>
    </div>
  )
}

/** "+N more" / "Show less" link for collapsed chip lists. */
export function MoreChip({ expanded, hiddenCount, onToggle }: { expanded: boolean; hiddenCount: number; onToggle: () => void }) {
  return (
    <button type="button" className="chip" aria-expanded={expanded}
      style={{ color: 'var(--iq-link)', background: 'transparent', paddingInline: 6 }}
      onClick={onToggle}>
      {expanded ? 'Show less' : `+${hiddenCount} more`}
    </button>
  )
}

/** Coloured status pill (campaign status, stage, payment, deliverable). */
export function Pill({ tone, children, title }: { tone: { bg: string; fg: string }; children: ReactNode; title?: string }) {
  return <span className="pill" title={title} style={{ background: tone.bg, color: tone.fg }}>{children}</span>
}

export function Soon({ children }: { children?: ReactNode }) {
  return <span className="soon-pill">{children ?? 'Soon'}</span>
}

export type SegOption<T extends string> = { value: T; label: ReactNode; title?: string }

/**
 * Segmented control (iOS / macOS): one choice from a few. A white thumb slides to the chosen option
 * on a spring; arrow keys move the choice. Behaves as a radio group for screen readers.
 */
export function Segmented<T extends string>({ options, value, onChange, label, className }: {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null)
  const [ready, setReady] = useState(false) // no slide on the first paint, only on changes

  useLayoutEffect(() => {
    const el = refs.current[value]
    if (!el) return
    const measure = () => setThumb({ x: el.offsetLeft, w: el.offsetWidth })
    measure()
    // fonts loading or counts changing resize the buttons: keep the thumb on its option
    const ro = new ResizeObserver(measure)
    ro.observe(el.parentElement!)
    return () => ro.disconnect()
  }, [value, options.length])

  useLayoutEffect(() => {
    if (thumb && !ready) requestAnimationFrame(() => setReady(true))
  }, [thumb, ready])

  const onKey = (e: KeyboardEvent) => {
    const i = options.findIndex(o => o.value === value)
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = options[(i + step + options.length) % options.length].value
    onChange(next)
    refs.current[next]?.focus()
  }

  return (
    <div className={className ? `seg ${className}` : 'seg'} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {thumb && (
        <span className="seg-thumb" aria-hidden="true"
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)`, transition: ready ? undefined : 'none' }} />
      )}
      {options.map(o => {
        const on = o.value === value
        return (
          <button key={o.value} ref={el => { refs.current[o.value] = el }} type="button" className="seg-btn"
            role="radio" aria-checked={on} tabIndex={on ? 0 : -1} title={o.title} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
