// Demo campaigns covering every state in docs/DATA_MODEL.md. Brands are fictional. Influencer ids refer to seed.ts.
import type { Campaign, Compensation, Deliverable, DeliverableStatus, DeliverableType, Member, MemberStage, Revision } from '../types'

const STAFF = 'Aisha Khan'
const at = (date: string) => `${date}T10:00:00.000Z`

/** A revision round. `review` = [decision, feedback?] once reviewed. */
const rev = (round: number, date: string, review?: ['APPROVED' | 'CHANGES_REQUESTED', string?]): Revision => ({
  round, draftUrl: `https://drive.example.com/drafts/${date}-r${round}`, submittedAt: at(date), submittedBy: STAFF,
  ...(review && { decision: review[0], feedback: review[1], reviewedAt: at(date), reviewedBy: STAFF }),
})

const del = (type: DeliverableType, n: number, status: DeliverableStatus, revisions: Revision[] = [], posted?: string): Deliverable => ({
  id: `${type.toLowerCase()}-${n}`, type, status, revisions,
  ...(posted && { liveUrl: `https://www.instagram.com/${type === 'STORY' ? 'stories' : 'reel'}/demo${n}${posted.replaceAll('-', '')}/`, postedAt: posted }),
})

type MemberOpts = Partial<Pick<Member, 'stageReason' | 'notes' | 'amountPaid' | 'paidAt' | 'paymentRef' | 'paymentStatus'>> & {
  compensation?: Compensation
  fee?: number | null
  deliverables?: Deliverable[]
}

const mem = (influencerId: number, stage: MemberStage, added: string, o: MemberOpts = {}): Member => {
  const compensation = o.compensation ?? 'CASH'
  const agreed = stage === 'AGREED'
  return {
    influencerId, stage, stageReason: o.stageReason, stageUpdatedAt: at(added), stageUpdatedBy: STAFF, compensation,
    agreedFee: agreed && compensation !== 'BARTER' ? o.fee ?? null : null,
    paymentStatus: o.paymentStatus ?? (!agreed ? 'NOT_DUE' : compensation === 'BARTER' ? 'WAIVED' : 'DUE'),
    amountPaid: o.amountPaid ?? 0, paidAt: o.paidAt, paymentRef: o.paymentRef, notes: o.notes ?? '',
    deliverables: o.deliverables ?? [], addedAt: at(added), addedBy: STAFF,
  }
}

/** A finished, fully paid member (for completed campaigns). */
const done = (id: number, date: string, fee: number, types: DeliverableType[]) =>
  mem(id, 'AGREED', date, {
    fee, amountPaid: fee, paymentStatus: 'PAID', paidAt: date, paymentRef: `UTR${id}${date.replaceAll('-', '')}`,
    deliverables: types.map((t, k) => del(t, k + 1, 'POSTED', [rev(1, date, ['APPROVED'])], date)),
  })

const camp = (c: Omit<Campaign, 'statusChangedBy' | 'createdBy' | 'statusChangedAt' | 'createdAt'> & { created: string; changed?: string }): Campaign => {
  const { created, changed, ...rest } = c
  return { ...rest, createdAt: at(created), createdBy: STAFF, statusChangedAt: at(changed ?? created), statusChangedBy: STAFF }
}

export const SEED_CAMPAIGNS: Campaign[] = [
  camp({
    id: 1, name: 'Diwali Bridal Push', brand: 'Kesar Jewels', status: 'ACTIVE', created: '2026-09-15', changed: '2026-09-28',
    brief: 'Festive bridal sets for Diwali–wedding season. Tricity + Jaipur creators, polki and kundan focus. Reels must show the set worn, not flat-lay.',
    startDate: '2026-10-05', endDate: '2026-11-08', budget: 150000,
    members: [
      mem(1, 'AGREED', '2026-09-16', {
        fee: 12000, amountPaid: 6000, paymentStatus: 'PARTIALLY_PAID', paidAt: '2026-09-30', paymentRef: 'UTR20260930PS', notes: '50% advance paid on signing.',
        deliverables: [
          del('REEL', 1, 'POSTED', [rev(1, '2026-09-29', ['CHANGES_REQUESTED', 'Show the clasp close-up; music is too loud over the voiceover.']), rev(2, '2026-10-01', ['APPROVED'])], '2026-10-02'),
          del('REEL', 2, 'IN_REVIEW', [rev(1, '2026-10-01')]),
          del('STORY', 1, 'AWAITING_DRAFT'),
        ],
      }),
      mem(16, 'AGREED', '2026-09-16', {
        fee: 5000, amountPaid: 5000, paymentStatus: 'PAID', paidAt: '2026-10-01', paymentRef: 'UTR20261001MK',
        deliverables: [
          del('REEL', 1, 'POSTED', [rev(1, '2026-09-27', ['APPROVED'])], '2026-09-30'),
          del('STORY', 1, 'POSTED', [rev(1, '2026-09-27', ['APPROVED'])], '2026-09-30'),
        ],
      }),
      mem(4, 'AGREED', '2026-09-17', {
        compensation: 'BARTER', notes: 'Keeps the kundan set (₹14k retail) in exchange for 1 reel.',
        deliverables: [del('REEL', 1, 'CHANGES_REQUESTED', [rev(1, '2026-09-30', ['CHANGES_REQUESTED', 'Brand tag missing; add #KesarDiwali in the first 3 seconds.'])])],
      }),
      mem(13, 'NEGOTIATING', '2026-09-18', { notes: 'Asked ₹9,000 for 2 reels; we countered at ₹7,500.' }),
      mem(6, 'CONTACTED', '2026-09-20', { notes: 'DM sent 22 Sep, follow up on WhatsApp.' }),
      mem(10, 'SHORTLISTED', '2026-09-25'),
      mem(17, 'SHORTLISTED', '2026-09-25'),
      mem(20, 'DECLINED', '2026-09-18', { stageReason: 'Exclusive with another jeweller until December.' }),
    ],
  }),
  camp({
    id: 2, name: 'Winter Fitness Reset', brand: 'FitDesi Studio', status: 'ACTIVE', created: '2026-09-20', changed: '2026-09-26',
    brief: 'New-year-ready home workouts using the FitDesi resistance band kit.', startDate: '2026-10-01', endDate: '2026-12-15', budget: 40000,
    members: [
      mem(5, 'AGREED', '2026-09-21', { fee: 8000, deliverables: [del('REEL', 1, 'IN_REVIEW', [rev(1, '2026-10-01')]), del('POST', 1, 'APPROVED', [rev(1, '2026-09-30', ['APPROVED'])])] }),
      mem(14, 'NEGOTIATING', '2026-09-21', { notes: 'Wants product + cash; checking budget.' }),
    ],
  }),
  camp({
    id: 3, name: 'Chandigarh Food Fest', brand: 'Masala Box', status: 'DRAFT', created: '2026-09-28',
    brief: 'Sector 17 food festival, 3-day event. Looking for local food creators for on-ground coverage.', startDate: '2026-11-14', endDate: '2026-11-30', budget: 60000,
    members: [mem(2, 'SHORTLISTED', '2026-09-28'), mem(7, 'SHORTLISTED', '2026-09-28'), mem(12, 'SHORTLISTED', '2026-09-28'), mem(18, 'SHORTLISTED', '2026-09-28')],
  }),
  camp({
    id: 4, name: 'Bridal Jewellery Q2 2025', brand: 'Noor Adornments', status: 'COMPLETED', created: '2025-05-12', changed: '2025-07-02',
    brief: 'Summer bridal collection launch.', startDate: '2025-05-20', endDate: '2025-06-30', budget: 50000,
    members: [done(1, '2025-06-10', 9000, ['REEL', 'STORY']), done(4, '2025-06-12', 6000, ['REEL']), done(6, '2025-06-14', 7500, ['REEL']), done(13, '2025-06-15', 7000, ['REEL']), done(16, '2025-06-18', 4000, ['STORY', 'STORY'])],
  }),
  camp({
    id: 5, name: 'Monsoon Beauty Edit', brand: 'Blush Bazaar', status: 'CANCELLED', created: '2026-06-02', changed: '2026-06-20',
    statusReason: 'Brand paused marketing spend for the quarter.',
    brief: 'Humidity-proof makeup routines.', startDate: '2026-07-01', endDate: '2026-08-15', budget: 45000,
    members: [mem(3, 'CONTACTED', '2026-06-03'), mem(8, 'SHORTLISTED', '2026-06-03'), mem(19, 'SHORTLISTED', '2026-06-03')],
  }),
  camp({
    id: 6, name: 'Summer Travel Diaries 2025', brand: 'Pahadi Stays', status: 'ARCHIVED', archivedFrom: 'COMPLETED', created: '2025-04-01', changed: '2025-08-01',
    brief: 'Weekend stays in Himachal.', startDate: '2025-04-15', endDate: '2025-06-15', budget: 30000,
    members: [done(9, '2025-05-10', 6000, ['REEL', 'STORY']), done(20, '2025-05-20', 5500, ['REEL'])],
  }),
]
