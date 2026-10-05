import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Check } from 'lucide-react'
import { useStore } from '../store'
import { apiEnabled, errorText } from '../api/client'
import { addMembersApi, addResultText, removeMemberApi } from '../api/campaigns'
import { CAMPAIGN_STATUS_LABEL, removeMember, STAGE_LABEL } from '../lib/campaigns'
import { CAMPAIGN_TONE } from '../lib/campaignUi'
import { useCampaignCards, useInfluencerCampaigns } from '../hooks/useCampaigns'
import { useInfluencerProfile } from '../hooks/useInfluencerProfile'
import { Pill } from '../components/ui'
import './overlays.css'

/**
 * Adds one influencer (card / profile "+ Shortlist") or many (search "Add all to campaign") to an open campaign.
 * New members start at SHORTLISTED; people already in a campaign are skipped.
 */
export function AddToCampaignModal({ influencerIds, onClose }: { influencerIds: number[]; onClose: () => void }) {
  const { addToCampaign, runCampaign, dataChanged } = useStore()
  const api = apiEnabled()
  const [message, setMessage] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null) // campaign id being changed
  const single = influencerIds.length === 1
  const profile = useInfluencerProfile(single ? String(influencerIds[0]) : undefined)
  const name = profile.kind === 'ready' ? profile.inf.name : 'This influencer'
  const cards = useCampaignCards()
  const open = cards.kind === 'ready' ? cards.data.filter(c => c.status === 'DRAFT' || c.status === 'ACTIVE') : []
  // single mode: which campaigns they're already in (to show "Added" / their stage)
  const memberships = useInfluencerCampaigns(single ? influencerIds[0] : null)
  const where = new Map(memberships.kind === 'ready' ? memberships.data.map(m => [m.campaignId, m]) : [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const say = (cid: number, msg: string) => setMessage(p => ({ ...p, [cid]: msg }))

  const add = async (cid: number) => {
    if (!api) {
      const r = addToCampaign(cid, influencerIds)
      return say(cid, typeof r === 'string' ? r : single ? '' : `Added ${r.added}${r.skipped ? ` · ${r.skipped} already in` : ''}`)
    }
    setBusy(cid)
    try {
      const r = await addMembersApi(cid, influencerIds)
      say(cid, addResultText(r, single))
      dataChanged()
    } catch (e) {
      say(cid, errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const undo = async (cid: number) => {
    if (!api) return say(cid, runCampaign(cid, x => removeMember(x, influencerIds[0])))
    setBusy(cid)
    try {
      await removeMemberApi(cid, influencerIds[0])
      say(cid, '')
      dataChanged()
    } catch (e) {
      say(cid, errorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="overlay" style={{ alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="atc-title" style={{ width: 420 }}>
        <div className="modal-head">
          <div id="atc-title" style={{ fontSize: 14, fontWeight: 600 }}>Add to campaign</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {single ? name : `${influencerIds.length} influencers from your search`} · added as <b>Shortlisted</b>
          </div>
        </div>
        <div style={{ padding: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {cards.kind === 'loading' && <div className="muted" style={{ padding: 12, fontSize: 13 }}>Loading campaigns…</div>}
          {cards.kind === 'error' && <div role="alert" style={{ padding: 12, fontSize: 13, color: 'var(--iq-down)' }}>{cards.message}</div>}
          {cards.kind === 'ready' && open.length === 0 && <div className="muted" style={{ padding: 12, fontSize: 13 }}>No open campaigns. <Link to="/campaigns" onClick={onClose}>Create one</Link>.</div>}
          {open.map(c => {
            const m = single ? where.get(c.id) : undefined
            // in single mode, only an untouched shortlist entry can be undone from here
            const canUndo = m && m.removable
            return (
              <div key={c.id} className="modal-opt" style={{ background: m ? 'var(--iq-brand-50)' : 'white', cursor: 'default' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                    {c.brand} · {c.members} influencers <Pill tone={CAMPAIGN_TONE[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Pill>
                  </div>
                  {message[c.id] && <div style={{ fontSize: 11, marginTop: 3, color: 'var(--iq-fg-2)', whiteSpace: 'pre-line' }}>{message[c.id]}</div>}
                </div>
                {m ? (
                  canUndo ? (
                    <button type="button" className="btn btn-sm" style={{ background: 'var(--iq-brand-50)', color: 'var(--iq-brand-500)', gap: 3 }}
                      title="Click to remove" disabled={busy === c.id} onClick={() => undo(c.id)}>
                      <Check size={11} />Added
                    </button>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>In campaign · {STAGE_LABEL[m.stage]}</span>
                  )
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy === c.id} onClick={() => add(c.id)}>
                    {busy === c.id ? 'Adding…' : single ? 'Add' : `Add ${influencerIds.length}`}
                  </button>
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
