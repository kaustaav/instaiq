import type { CSSProperties, ReactNode } from 'react'

/**
 * Skeleton screens: grey shapes in the layout of the real content while it loads, so the page feels like
 * it's arriving and nothing jumps when it does. Each skeleton reuses the real screen's classes, so the
 * placeholders sit exactly where the content will land.
 *
 * They fade in only after a short delay (CSS), so fast loads never flash. Screen readers hear one
 * "Loading …" message; the shapes themselves are hidden from them.
 */

const Bone = ({ w = '100%', h = 12, r = 6, style }: { w?: number | string; h?: number; r?: number; style?: CSSProperties }) => (
  <span className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />
)
const Circle = ({ size }: { size: number }) => <Bone w={size} h={size} r={999} style={{ flexShrink: 0 }} />

function Loading({ label, className, style, children }: { label: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={className ? `skel-wrap ${className}` : 'skel-wrap'} style={style} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <div aria-hidden="true" style={{ display: 'contents' }}>{children}</div>
    </div>
  )
}

// varied widths so the placeholders don't look stamped out
const W = ['62%', '48%', '70%', '55%', '66%', '44%', '58%', '52%', '68%']

/** Search grid: influencer cards. */
export function CardGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <Loading label="Loading influencers" className="grid">
      {Array.from({ length: count }, (_, k) => (
        <div key={k} className="inf-card skel-card">
          <div className="inf-card-top">
            <Circle size={44} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 3 }}>
              <Bone w={W[k % W.length]} h={14} />
              <Bone w="78%" h={10} />
              <div style={{ display: 'flex', gap: 5 }}><Bone w={58} h={16} r={999} /><Bone w={50} h={16} r={999} /></div>
            </div>
          </div>
          <div className="inf-card-stats">
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Bone w={40} h={14} /><Bone w={52} h={9} />
              </div>
            ))}
          </div>
          <div className="inf-card-foot">
            <Bone w="45%" h={10} />
            <Bone w={84} h={24} r={999} />
          </div>
        </div>
      ))}
    </Loading>
  )
}

/** List views (Search list, Manage): a person column plus plain cells. */
export function TableSkeleton({ rows = 8, cols, label = 'Loading influencers' }: { rows?: number; cols: number; label?: string }) {
  return (
    <Loading label={label} className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th><Bone w={70} h={10} /></th>
            {Array.from({ length: cols }, (_, c) => <th key={c}><Bone w={48} h={10} /></th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <td>
                <div className="person">
                  <Circle size={28} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 130 }}><Bone w={W[r % W.length]} h={12} /><Bone w="60%" h={10} /></div>
                </div>
              </td>
              {Array.from({ length: cols }, (_, c) => <td key={c}><Bone w={W[(r + c) % W.length]} h={11} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </Loading>
  )
}

/** Profile: header card with stats, then the two columns. */
export function ProfileSkeleton() {
  return (
    <div className="screen-col">
      <div className="crumbs"><Bone w={160} h={12} /></div>
      <div className="scroll" style={{ background: 'var(--iq-gray-50)' }}>
        <Loading label="Loading profile" className="profile">
          <div className="card profile-head">
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <Circle size={64} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 6 }}>
                <Bone w={220} h={22} />
                <Bone w={280} h={11} />
                <div style={{ display: 'flex', gap: 6 }}><Bone w={70} h={20} r={999} /><Bone w={60} h={20} r={999} /></div>
              </div>
              <Bone w={150} h={30} r={999} />
            </div>
            <div className="profile-stats">
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Bone w={56} h={22} /><Bone w={70} h={10} />
                </div>
              ))}
            </div>
          </div>
          <div className="profile-cols">
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Bone w={80} h={11} /><Bone h={11} /><Bone w="92%" h={11} /><Bone w="60%" h={11} />
            </div>
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Bone w={70} h={11} /><Bone w="80%" h={11} /><Bone w="55%" h={11} />
            </div>
          </div>
        </Loading>
      </div>
    </div>
  )
}

/** Campaign list: stacked campaign cards. */
export function CampaignCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Loading label="Loading campaigns" className="camp-cards">
      {Array.from({ length: count }, (_, k) => (
        <div key={k} className="camp-card skel-card">
          <div className="camp-card-main" style={{ gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Bone w={W[k % W.length]} h={15} style={{ maxWidth: 260 }} /><Bone w={52} h={18} r={999} /></div>
            <Bone w={220} h={11} />
            <Bone w={170} h={11} />
          </div>
          <div className="camp-card-budget" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Bone w="50%" h={10} /><Bone h={6} r={999} />
          </div>
        </div>
      ))}
    </Loading>
  )
}

/** Campaign detail: header card with target bars, then the member table. */
export function CampaignDetailSkeleton() {
  return (
    <div className="screen-col">
      <div className="crumbs"><Bone w={110} h={12} /></div>
      <div className="scroll" style={{ background: 'var(--iq-gray-50)' }}>
        <Loading label="Loading campaign" className="camp-detail">
          <div className="card camp-head">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Bone w={240} h={20} /><Bone w={200} h={11} /></div>
              <div style={{ display: 'flex', gap: 6 }}><Bone w={130} h={30} r={999} /><Bone w={90} h={30} r={999} /></div>
            </div>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <Bone w={140} h={11} /><Bone w={256} h={8} r={999} /><Bone w={60} h={11} />
              </div>
            ))}
          </div>
          <TableSkeleton rows={6} cols={4} label="Loading influencers in this campaign" />
        </Loading>
      </div>
    </div>
  )
}

/** Small lists inside dialogs and cards (Add to campaign, campaign history, niches). */
export function RowsSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <Loading label={label} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 12px' }}>
      {Array.from({ length: rows }, (_, k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><Bone w={W[k % W.length]} h={12} /><Bone w="40%" h={10} /></div>
          <Bone w={44} h={22} r={999} />
        </div>
      ))}
    </Loading>
  )
}
