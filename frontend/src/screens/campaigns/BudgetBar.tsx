/** Budget used vs total. Over budget turns red (a warning, never a block). */
export function BudgetBar({ used, total }: { used: number; total: number | null }) {
  if (total == null || total <= 0) return <div className="budget-bar"><div style={{ width: 0 }} /></div>
  const pct = Math.min(100, (used / total) * 100)
  const over = used > total
  return (
    <div className="budget-bar" title={over ? `Over budget by ₹${(used - total).toLocaleString('en-IN')}` : `${Math.round(pct)}% of budget`}>
      <div style={{ width: `${pct}%`, background: over ? 'var(--iq-danger)' : pct > 85 ? '#D97706' : 'var(--iq-brand-500)' }} />
    </div>
  )
}
