import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { validateCampaign, type CampaignInput } from '../../lib/campaigns'
import type { Campaign } from '../../types'
import '../../overlays/overlays.css'
import { Overlay, Panel } from '../../components/Overlay'

type Props = {
  editing: Campaign | null // null = new
  onSubmit: (input: CampaignInput) => string | Promise<string> // '' on success, else an error to show
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
    influencers: editing ? String(editing.targetInfluencers) : '',
    reels: editing?.targetReels != null ? String(editing.targetReels) : '',
    stories: editing?.targetStories != null ? String(editing.targetStories) : '',
    posts: editing?.targetPosts != null ? String(editing.targetPosts) : '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const count = (v: string) => (v.trim() ? +v : null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = async () => {
    const input: CampaignInput = {
      name: f.name, brand: f.brand, brief: f.brief, startDate: f.startDate || undefined, endDate: f.endDate || undefined,
      budget: f.budget.trim() ? Math.round(+f.budget) : null,
      targetInfluencers: f.influencers.trim() ? +f.influencers : 0, // 0 fails validation: it's required
      targetReels: count(f.reels), targetStories: count(f.stories), targetPosts: count(f.posts),
    }
    const err = validateCampaign(input)
    if (err) return setError(err)
    setSaving(true)
    setError((await onSubmit(input)) || '')
    setSaving(false)
  }

  return (
    <Overlay kind="drawer" z={210} onDismiss={onClose}>
      <Panel kind="drawer" labelledBy="cf-title" style={{ width: 480 }}>
        <div className="drawer-head">
          <div id="cf-title">{editing ? 'Edit campaign' : 'New campaign'}</div>
          <button type="button" className="btn btn-plain" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="drawer-body grouped">
          <section className="form-group">
            <div className="form-group-head"><h3>Campaign</h3></div>
            <label className="field"><span>Campaign name *</span>
              <input className="input" autoComplete="off" placeholder="e.g. Diwali Bridal Push" value={f.name} onChange={set('name')} autoFocus />
            </label>
            <label className="field"><span>Brand *</span>
              <input className="input" autoComplete="off" placeholder="Brand name" value={f.brand} onChange={set('brand')} />
            </label>
            <label className="field"><span>Brief</span>
              <textarea className="input" rows={4} placeholder="What the brand wants, must-haves, do’s and don’ts" value={f.brief} onChange={set('brief')} />
            </label>
          </section>
          <section className="form-group">
            <div className="form-group-head"><h3>Dates</h3></div>
            <div className="form-grid-2">
              <label className="field"><span>Start date</span><input type="date" className="input" value={f.startDate} onChange={set('startDate')} /></label>
              <label className="field"><span>End date</span><input type="date" className="input" value={f.endDate} onChange={set('endDate')} /></label>
            </div>
          </section>
          <section className="form-group">
            <div className="form-group-head"><h3>Targets</h3></div>
            <div className="form-grid-4">
              <label className="field"><span>Influencers *</span>
                <input type="number" min={1} step={1} className="input mono" placeholder="0" value={f.influencers} onChange={set('influencers')} />
              </label>
              <label className="field"><span>Reels</span><input type="number" min={0} step={1} className="input mono" placeholder="0" value={f.reels} onChange={set('reels')} /></label>
              <label className="field"><span>Stories</span><input type="number" min={0} step={1} className="input mono" placeholder="0" value={f.stories} onChange={set('stories')} /></label>
              <label className="field"><span>Posts</span><input type="number" min={0} step={1} className="input mono" placeholder="0" value={f.posts} onChange={set('posts')} /></label>
            </div>
            <div className="form-hint">How many the brand wants. Reels, stories and posts are optional totals for the whole campaign.</div>
          </section>
          <section className="form-group">
            <div className="form-group-head"><h3>Budget</h3></div>
            <label className="field"><span>Budget (₹)</span>
              <input type="number" min={0} className="input mono" placeholder="0" value={f.budget} onChange={set('budget')} />
              <span className="form-hint">Going over budget shows a warning; it doesn’t block.</span>
            </label>
          </section>
          {!editing && <div className="form-hint" style={{ padding: '0 4px' }}>New campaigns start as <b>Draft</b>. Activate once dates are set and at least one influencer is added.</div>}
        </div>
        <div className="drawer-foot">
          <div role="alert" style={{ flex: 1, fontSize: 12, color: 'var(--iq-danger)', whiteSpace: 'pre-line' }}>{error}</div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-blue" disabled={saving} onClick={save}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create campaign'}</button>
        </div>
      </Panel>
    </Overlay>
  )
}
