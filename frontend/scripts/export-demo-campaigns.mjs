// Exports the UI's demo campaigns (src/data/seed-campaigns.ts) for the backend's demo loader:
//   node scripts/export-demo-campaigns.mjs  ->  ../backend/src/main/resources/demo/campaigns.json
// Members are referenced by Instagram handle (ids differ between the UI and a database). Needs Node 23.6+
// (runs the .ts file directly by stripping types).
import { readFileSync, writeFileSync } from 'node:fs'
import { SEED_CAMPAIGNS } from '../src/data/seed-campaigns.ts'

const influencers = JSON.parse(readFileSync(new URL('../../backend/src/main/resources/demo/influencers.json', import.meta.url)))
// the demo influencers are in seed order: UI id N = entry N-1
const handleOf = id => {
  const h = influencers[id - 1]?.handle
  if (!h) throw new Error(`No demo influencer for UI id ${id}`)
  return h.replace(/^@/, '')
}

const out = SEED_CAMPAIGNS.map(c => ({
  name: c.name, brand: c.brand, brief: c.brief, startDate: c.startDate ?? null, endDate: c.endDate ?? null, budgetInr: c.budget,
  targetInfluencers: c.targetInfluencers, targetReels: c.targetReels, targetStories: c.targetStories, targetPosts: c.targetPosts,
  status: c.status, statusReason: c.statusReason ?? null, archivedFrom: c.archivedFrom ?? null,
  members: c.members.map(m => ({
    handle: handleOf(m.influencerId), stage: m.stage, stageReason: m.stageReason ?? null, notes: m.notes || null,
    compensation: m.compensation, feeInr: m.agreedFee, paymentWriteOffReason: m.paymentReason ?? null,
    // numbered per type in creation order (Reel 1, Reel 2, Story 1...), as agreeing terms numbers them
    deliverables: m.deliverables.map((d, k) => ({
      type: d.type, seq: m.deliverables.slice(0, k + 1).filter(x => x.type === d.type).length, status: d.status, liveUrl: d.liveUrl ?? null, postedAt: d.postedAt ?? null,
      revisions: d.revisions.map(r => ({ draftUrl: r.draftUrl, decision: r.decision ?? null, feedback: r.feedback ?? null })),
    })),
    payments: m.payments.map(p => ({ amountInr: p.amount, paidAt: p.paidAt, receiptUrl: p.receiptUrl })),
  })),
}))

const file = new URL('../../backend/src/main/resources/demo/campaigns.json', import.meta.url)
writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
console.log(`Wrote ${out.length} campaigns, ${out.reduce((n, c) => n + c.members.length, 0)} members -> ${file.pathname}`)
