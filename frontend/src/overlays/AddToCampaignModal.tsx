import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Check } from 'lucide-react'
import { useStore } from '../store'
import { CAMPAIGN_STATUS_LABEL, displayStage, removeBlocker, removeMember, STAGE_LABEL } from '../lib/campaigns'
import { CAMPAIGN_TONE } from '../lib/campaignUi'
import { Pill } from '../components/ui'
import './overlays.css'

/**
 * Adds one influencer (card / profile "+ Shortlist") or many (search "Add all to campaign") to an open campaign.
 * New members start at SHORTLISTED; people already in a campaign are skipped.
 */
export function AddToCampaignModal({ influencerIds, onClose }: { influencerIds: number[]; onClose: () => void }) {
  const { infs, campaigns, addToCampaign, runCampaign } = useStore()
  const [message, setMessage] = useState<Record<number, string>>({})
  const single = influencerIds.length === 1
  const inf = single ? infs.find(i => i.id === influencerIds[0]) : undefined
  const open = campaigns.filter(c => c.status === 'DRAFT' || c.status === 'ACTIVE')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const add = (cid: number) => {
    const r = addToCampaign(cid, influencerIds)
    const msg = typeof r === 'string' ? r : single ? '' : `Added ${r.added}${r.skipped ? ` · ${r.skipped} already in` : ''}`
    setMessage(p => ({ ...p, [cid]: msg }))
  }

  return (
    <div className="overlay" style={{ alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="atc-title" style={{ width: 420 }}>
        <div className="modal-head">
          <div id="atc-title" style={{ fontSize: 14, fontWeight: 600 }}>Add to campaign</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {single ? inf?.name : `${influencerIds.length} influencers from your search`} · added as <b>Shortlisted</b>
          </div>
        </div>
        <div style={{ padding: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {open.length === 0 && <div className="muted" style={{ padding: 12, fontSize: 13 }}>No open campaigns. <Link to="/campaigns" onClick={onClose}>Create one</Link>.</div>}
          {open.map(c => {
            const m = single ? c.members.find(x => x.influencerId === influencerIds[0]) : undefined
            // in single mode, only an untouched shortlist entry can be undone from here
            const canUndo = m && m.stage === 'SHORTLISTED' && !removeBlocker(m)
            return (
              <div key={c.id} className="modal-opt" style={{ background: m ? 'var(--cs-blueberry-50)' : 'white', cursor: 'default' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                    {c.brand} · {c.members.length} influencers <Pill tone={CAMPAIGN_TONE[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Pill>
                  </div>
                  {message[c.id] && <div style={{ fontSize: 11, marginTop: 3, color: 'var(--cs-fg-2)' }}>{message[c.id]}</div>}
                </div>
                {m ? (
                  canUndo ? (
                    <button type="button" className="btn btn-sm" style={{ background: 'var(--cs-blueberry-50)', color: 'var(--cs-blueberry-500)', gap: 3 }}
                      title="Click to remove" onClick={() => setMessage(p => ({ ...p, [c.id]: runCampaign(c.id, x => removeMember(x, influencerIds[0])) }))}>
                      <Check size={11} />Added
                    </button>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>In campaign · {STAGE_LABEL[displayStage(m)]}</span>
                  )
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => add(c.id)}>{single ? 'Add' : `Add ${influencerIds.length}`}</button>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ padding: '8px 14px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/campaigns" onClick={onClose} style={{ fontSize: 12 }}>Manage campaigns</Link>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
