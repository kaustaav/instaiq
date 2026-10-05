/**
 * Campaign data for the screens: the built-in demo campaigns, or the API when VITE_API_URL is set.
 * Screens use these hooks and don't care which.
 */
import { useMemo } from 'react'
import { apiEnabled } from '../api/client'
import { getCampaign, getInfluencerCampaigns, listCampaigns, toCampaign } from '../api/campaigns'
import { cardFromCampaign, type CampaignCard } from '../lib/campaignUi'
import { displayStage } from '../lib/campaigns'
import { useStore } from '../store'
import type { Campaign, CampaignStatus, DisplayStage, Influencer } from '../types'
import { useApiResource, type Resource } from './useApiResource'

const noop = () => {}

/** Every campaign, as cards. */
export function useCampaignCards(): Resource<CampaignCard[]> & { retry: () => void } {
  const { campaigns } = useStore()
  const api = apiEnabled()
  const remote = useApiResource(api ? 'all' : null, listCampaigns)
  const local = useMemo(() => (api ? null : campaigns.map(cardFromCampaign)), [api, campaigns])
  return local ? { kind: 'ready', data: local, retry: noop } : remote
}

export type CampaignDetail = { campaign: Campaign; infOf: (id: number) => Influencer | undefined }

/** One campaign with its members' influencers. */
export function useCampaignDetail(id: string | undefined): Resource<CampaignDetail> & { retry: () => void } {
  const { campaigns, infs, loc } = useStore()
  const api = apiEnabled()
  const remote = useApiResource(api && id ? id : null, getCampaign)
  const remoteData = remote.kind === 'ready' ? remote.data : null
  const mapped = useMemo(() => {
    if (!remoteData) return null
    const { campaign, influencers } = toCampaign(remoteData, loc)
    return { campaign, infOf: (iid: number) => influencers.get(iid) }
  }, [remoteData, loc])

  if (!api) {
    const campaign = campaigns.find(c => String(c.id) === id)
    return campaign
      ? { kind: 'ready', data: { campaign, infOf: (iid: number) => infs.find(i => i.id === iid) }, retry: noop }
      : { kind: 'not-found', retry: noop }
  }
  return mapped ? { kind: 'ready', data: mapped, retry: remote.retry } : (remote as Resource<CampaignDetail> & { retry: () => void })
}

/** Where one influencer is, in every campaign they're in (profile history, add-to-campaign popup). */
export type Membership = {
  campaignId: number
  name: string
  brand: string
  startDate?: string
  campaignStatus: CampaignStatus
  stage: DisplayStage
  removable: boolean // still an untouched shortlist entry
  posted: number
  deliverables: number
}

export function useInfluencerCampaigns(influencerId: number | null): Resource<Membership[]> & { retry: () => void } {
  const { campaigns } = useStore()
  const api = apiEnabled()
  const remote = useApiResource(api && influencerId != null ? String(influencerId) : null, getInfluencerCampaigns)
  const local = useMemo(() => {
    if (api || influencerId == null) return null
    return campaigns
      .flatMap(c => c.members.filter(m => m.influencerId === influencerId).map(m => ({ c, m })))
      .sort((a, b) => (b.c.startDate ?? b.c.createdAt).localeCompare(a.c.startDate ?? a.c.createdAt))
      .map(({ c, m }): Membership => ({
        campaignId: c.id, name: c.name, brand: c.brand, startDate: c.startDate, campaignStatus: c.status, stage: displayStage(m),
        removable: m.stage === 'SHORTLISTED' && !m.payments.length && !m.deliverables.some(d => d.revisions.length || d.status === 'POSTED'),
        posted: m.deliverables.filter(d => d.status === 'POSTED').length, deliverables: m.deliverables.length,
      }))
  }, [api, campaigns, influencerId])
  const remoteData = remote.kind === 'ready' ? remote.data : null
  const mapped = useMemo(() => remoteData?.map((r): Membership => ({
    campaignId: r.campaignId, name: r.name, brand: r.brand, startDate: r.startDate ?? undefined, campaignStatus: r.campaignStatus,
    stage: r.displayStage, removable: r.removable, posted: r.posted, deliverables: r.deliverables,
  })) ?? null, [remoteData])

  if (local) return { kind: 'ready', data: local, retry: noop }
  if (influencerId == null) return { kind: 'ready', data: [], retry: noop }
  return mapped ? { kind: 'ready', data: mapped, retry: remote.retry } : (remote as Resource<Membership[]> & { retry: () => void })
}
