import { inr } from '../../lib/format'
import { campaignProgress } from '../../lib/campaigns'
import type { Campaign } from '../../types'

type Row = {
  label: string
  actual: number
  target: number | null // null = no target set
  fmt: (n: number) => string
  /** Going over is bad (budget), not just "more than planned". */
  overIsBad?: boolean
  /** Shows what's left ("₹6,000 due") instead of a percentage. */
  due?: boolean
  /** Content rows: shown only when the campaign asks for some (target above 0). */
  content?: boolean
}

const count = (n: number) => String(n)

/**
 * Targets vs actual as tiles (like Fitness summaries): one per measure, a big "done" number, "of target", and a bar
 * scaled to its own target (100% = met), so influencers, content and money read the same despite different units.
 * Past the target the bar stays full and the note says by how much; going over budget turns red.
 */
export function TargetsChart({ c }: { c: Campaign }) {
  const p = campaignProgress(c)
  const rows: Row[] = [
    { label: 'Influencers confirmed', actual: p.confirmed, target: c.targetInfluencers, fmt: count },
    { label: 'Reels posted', actual: p.reels, target: c.targetReels, fmt: count, content: true },
    { label: 'Stories posted', actual: p.stories, target: c.targetStories, fmt: count, content: true },
    { label: 'Posts posted', actual: p.posts, target: c.targetPosts, fmt: count, content: true },
    { label: 'Budget committed', actual: p.committed, target: c.budget, fmt: inr, overIsBad: true },
    // only once someone is owed money (all their content posted); before that there's nothing to pay
    ...(p.payableNow > 0 ? [{ label: 'Paid for posted content', actual: p.paidOnPayable, target: p.payableNow, fmt: inr, due: true }] : []),
  ]
  // content the campaign doesn't ask for (no number, or 0) gets no row
  const shown = rows.filter(r => (r.content ? (r.target ?? 0) > 0 : r.target != null || r.actual > 0))

  return (
    <div className="targets" role="group" aria-label="Targets vs actual">
      {shown.map(r => {
        const hasTarget = r.target != null && r.target > 0
        const pct = hasTarget ? (r.actual / r.target!) * 100 : 0
        const met = hasTarget && r.actual >= r.target!
        const over = hasTarget && r.actual > r.target!
        const bad = over && r.overIsBad
        const fill = bad ? 'var(--iq-danger)' : met ? '#34C759' : 'var(--iq-brand-500)'
        const extra = hasTarget ? r.fmt(r.actual - r.target!) : ''
        const note = !hasTarget ? 'No target'
          : r.due ? (met ? 'All paid' : `${r.fmt(r.target! - r.actual)} due`)
          : !over ? `${Math.round(pct)}%` : r.overIsBad ? `Over by ${extra}` : `${extra} over target`
        return (
          <div key={r.label} className="target" title={hasTarget ? `${r.fmt(r.actual)} of ${r.fmt(r.target!)}` : undefined}>
            <div className="target-label">{r.label}</div>
            <div className="target-value">
              <b>{r.fmt(r.actual)}</b><span>{hasTarget ? `of ${r.fmt(r.target!)}` : '\u00a0'}</span>
            </div>
            <div className="target-track"><div className="target-fill" style={{ width: `${Math.min(100, pct)}%`, background: fill }} /></div>
            <div className="target-note" style={{ color: bad ? 'var(--iq-danger)' : met ? '#1D7A35' : r.due ? '#A04A00' : undefined }}>{note}</div>
          </div>
        )
      })}
    </div>
  )
}
