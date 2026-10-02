import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { validateCampaign, type CampaignInput } from '../../lib/campaigns'
import type { Campaign } from '../../types'
import '../../overlays/overlays.css'

type Props = {
  editing: Campaign | null // null = new
  onSubmit: (input: CampaignInput) => string // '' on success, else an error to show
  onClose: () => void
}

export function CampaignFormDrawer({ editing, onSubmit, onClose }: Props) {
  const [f, setF] = useState({
    name: editing?.name ?? '',
    brand: editing?.brand ?? '',
    brief: editing?.brief ?? '',
    startDate: editing?.startDate ?? '',
    endDate: editing?.endDate ?? '',
    budget: editing?.budget != null ? String(editing.budget) : '',
  })
  const [error, setError] = useState('')
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    const input: CampaignInput = {
      name: f.name, brand: f.brand, brief: f.brief, startDate: f.startDate || undefined, endDate: f.endDate || undefined,
      budget: f.budget.trim() ? Math.round(+f.budget) : null,
    }
    const err = validateCampaign(input) || onSubmit(input)
    if (err) setError(err)
  }

  return (
    <div className="overlay" style={{ justifyContent: 'flex-end', zIndex: 210 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="cf-title" style={{ width: 480 }}>
        <div className="drawer-head">
          <div id="cf-title" style={{ fontSize: 14, fontWeight: 600 }}>{editing ? 'Edit campaign' : 'New campaign'}</div>
          <button type="button" className="btn btn-plain" aria-label="Close" style={{ padding: 4, color: 'var(--cs-fg-3)' }} onClick={onClose}><X size={16} /></button>
        </div>
        <div className="drawer-body">
          <label className="field"><span>Campaign name *</span>
            <input className="input" autoComplete="off" placeholder="e.g. Diwali Bridal Push" value={f.name} onChange={set('name')} autoFocus />
          </label>
          <label className="field"><span>Brand *</span>
            <input className="input" autoComplete="off" placeholder="Brand name" value={f.brand} onChange={set('brand')} />
          </label>
          <label className="field"><span>Brief</span>
            <textarea className="input" rows={4} placeholder="What the brand wants, must-haves, do’s and don’ts" value={f.brief} onChange={set('brief')} />
          </label>
          <div className="form-grid-2">
            <label className="field"><span>Start date</span><input type="date" className="input" value={f.startDate} onChange={set('startDate')} /></label>
            <label className="field"><span>End date</span><input type="date" className="input" value={f.endDate} onChange={set('endDate')} /></label>
          </div>
          <label className="field"><span>Budget (₹)</span>
            <input type="number" min={0} className="input mono" placeholder="0" value={f.budget} onChange={set('budget')} />
            <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>Going over budget shows a warning; it doesn’t block.</span>
          </label>
          {!editing && <div className="muted" style={{ fontSize: 12 }}>New campaigns start as <b>Draft</b>. Activate once dates are set and at least one influencer is added.</div>}
        </div>
        <div className="drawer-foot">
          <div role="alert" style={{ flex: 1, fontSize: 12, color: 'var(--cs-down)' }}>{error}</div>
          <button type="button" className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-blue" style={{ padding: '7px 14px', fontSize: 13 }} onClick={save}>{editing ? 'Save changes' : 'Create campaign'}</button>
        </div>
      </div>
    </div>
  )
}
