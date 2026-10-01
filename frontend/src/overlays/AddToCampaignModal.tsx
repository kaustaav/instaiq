import { useEffect } from 'react'
import { Check } from 'lucide-react'
import { useStore } from '../store'
import { uniq } from '../lib/format'
import './overlays.css'

export function AddToCampaignModal({ infId, onClose }: { infId: number; onClose: () => void }) {
  const { infs, campaigns, addToCampaign, removeFromCampaign } = useStore()
  const inf = infs.find(i => i.id === infId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" style={{ alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="atc-title">
        <div className="modal-head">
          <div id="atc-title" style={{ fontSize: 14, fontWeight: 600 }}>Add to Campaign</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{inf?.name}</div>
        </div>
        <div style={{ padding: 8 }}>
          {campaigns.map(c => {
            const has = c.iids.includes(infId)
            return (
              <button key={c.id} type="button" className="modal-opt" aria-pressed={has}
                style={{ background: has ? 'var(--cs-blueberry-50)' : 'white' }}
                onClick={() => (has ? removeFromCampaign(c.id, infId) : addToCampaign(c.id, infId))}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{uniq(c.iids).length} influencers</div>
                </div>
                {has ? (
                  <span className="pill" style={{ padding: '3px 8px', gap: 3, background: 'var(--cs-blueberry-50)', color: 'var(--cs-blueberry-500)' }}>
                    <Check size={11} />Added
                  </span>
                ) : (
                  <span className="pill" style={{ padding: '3px 8px', border: '1px solid var(--cs-border)', color: 'var(--cs-fg-3)' }}>Add</span>
                )}
              </button>
            )
          })}
        </div>
        <div style={{ padding: '8px 14px 14px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
