import { inr } from '../../lib/format'
import { campaignProgress } from '../../lib/campaigns'
import type { Campaign } from '../../types'

type Row = {
  label: string
  actual: number
  target: number | null // null = no target set
  /** Darker part of the bar (budget: paid out of committed). */
  inner?: number
  fmt: (n: number) => string
  /** Going over is bad (budget), not just "more than planned". */
  overIsBad?: boolean
}

const count = (n: number) => String(n)

/**
 * Targets vs actual in one chart: one bar per measure, each scaled to its own target (100% = target met), so
 * influencers, content and money line up despite different units. The light track is the target, the fill is
 * what's done; past the target the bar stays full and says by how much.
 */
export function TargetsChart({ c }: { c: Campaign }) {
  const p = campaignProgress(c)
  const rows: Row[] = [
    { label: 'Influencers confirmed', actual: p.confirmed, target: c.targetInfluencers, fmt: count },
    { label: 'Reels posted', actual: p.reels, target: c.targetReels, fmt: count },
    { label: 'Stories posted', actual: p.stories, target: c.targetStories, fmt: count },
    { label: 'Posts posted', actual: p.posts, target: c.targetPosts, fmt: count },
    { label: 'Budget committed', actual: p.committed, target: c.budget, inner: p.paid, fmt: inr, overIsBad: true },
  ]
  // content rows with no target and nothing posted say nothing; leave them out
  const shown = rows.filter(r => r.target != null || r.actual > 0)

  return (
    <div className="tchart" role="group" aria-label="Targets vs actual">
      <div className="tchart-head">
        <span className="label">Targets vs actual</span>
        <span className="tchart-legend">
          <span><i className="tchart-swatch" style={{ background: 'var(--iq-brand-500)' }} />Done</span>
          <span><i className="tchart-swatch" style={{ background: 'var(--iq-gray-100)' }} />Target</span>
          <span><i className="tchart-swatch" style={{ background: '#1D2477' }} />Paid</span>
        </span>
      </div>
      {shown.map(r => {
        const hasTarget = r.target != null && r.target > 0
        const pct = hasTarget ? (r.actual / r.target!) * 100 : 0
        const met = hasTarget && r.actual >= r.target!
        const over = hasTarget && r.actual > r.target!
        const fill = over && r.overIsBad ? 'var(--iq-down)' : met ? '#12A363' : 'var(--iq-brand-500)'
        const value = hasTarget ? `${r.fmt(r.actual)} / ${r.fmt(r.target!)}` : `${r.fmt(r.actual)} · no target`
        const extra = hasTarget ? r.fmt(r.actual - r.target!) : ''
        const note = !hasTarget ? '' : !over ? `${Math.round(pct)}%` : r.overIsBad ? `over by ${extra}` : `+${extra} over`
        return (
          <div key={r.label} className="tchart-row">
            <div className="tchart-label">{r.label}</div>
            <div className="tchart-track" title={value}>
              <div className="tchart-fill" style={{ width: `${Math.min(100, pct)}%`, background: fill }} />
              {r.inner != null && hasTarget && r.inner > 0 && (
                <div className="tchart-fill" style={{ width: `${Math.min(100, (r.inner / r.target!) * 100)}%`, background: over ? '#7F1414' : '#1D2477' }}
                  title={`Paid ${r.fmt(r.inner)}`} />
              )}
            </div>
            <div className="tchart-value mono">
              {value}
              {note && <span className="tchart-note" style={{ color: over && r.overIsBad ? 'var(--iq-down)' : met ? '#0B7A4B' : undefined }}>{note}</span>}
              {r.inner != null && r.inner > 0 && <span className="tchart-note">paid {r.fmt(r.inner)}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
