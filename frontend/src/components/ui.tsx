import type { MouseEvent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { avatarColor, categoryColor, type Freshness, igUrl } from '../lib/format'
import type { Influencer } from '../types'

export function Avatar({ inf, size }: { inf: Pick<Influencer, 'id' | 'av'>; size: number }) {
  const fontSize = size >= 58 ? 18 : size >= 38 ? 12 : 10
  return (
    <div className="avatar" style={{ width: size, height: size, background: avatarColor(inf.id), fontSize }}>
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

/** Dashed "+N more" / "Show less" chip for collapsed chip lists. */
export function MoreChip({ expanded, hiddenCount, onToggle }: { expanded: boolean; hiddenCount: number; onToggle: () => void }) {
  return (
    <button type="button" className="chip" aria-expanded={expanded}
      style={{ color: 'var(--cs-blueberry-500)', border: '1px dashed var(--cs-border)' }}
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
