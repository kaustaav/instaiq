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

/** Profile: page bar, hero, metrics, then the two columns. */
export function ProfileSkeleton() {
  return (
    <div className="screen-col">
      <div className="scroll">
        <div className="page-bar">
          <Bone w={130} h={14} style={{ marginLeft: 8 }} />
          <div style={{ flex: 1 }} />
          <Bone w={150} h={30} r={999} /><Bone w={30} h={30} r={999} />
        </div>
        <Loading label="Loading profile" className="profile">
          <div className="profile-hero">
            <Circle size={76} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
              <Bone w={240} h={26} r={8} /><Bone w={120} h={13} /><Bone w={300} h={12} />
              <div style={{ display: 'flex', gap: 6 }}><Bone w={74} h={22} r={999} /><Bone w={64} h={22} r={999} /></div>
            </div>
          </div>
          <div className="card profile-card">
            <Bone w={80} h={14} />
            <div className="profile-stats">
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Bone w={60} h={24} /><Bone w={70} h={10} />
                </div>
              ))}
            </div>
          </div>
          <div className="profile-cols">
            <div className="card profile-card"><Bone w={70} h={14} /><Bone h={12} /><Bone w="92%" h={12} /><Bone w="60%" h={12} /></div>
            <div className="card profile-card"><Bone w={70} h={14} /><Bone w="80%" h={12} /><Bone w="55%" h={12} /></div>
          </div>
        </Loading>
      </div>
    </div>
  )
}

/** Campaign list: rows. */
export function CampaignCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Loading label="Loading campaigns" className="camp-list">
      {Array.from({ length: count }, (_, k) => (
        <div key={k} className="camp-row">
          <div className="camp-row-main" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', gap: 8 }}><Bone w={W[k % W.length]} h={15} style={{ maxWidth: 260 }} /><Bone w={52} h={18} r={999} /></div>
            <Bone w={200} h={11} />
          </div>
        </div>
      ))}
    </Loading>
  )
}

/** Campaign detail: page bar, large title, target tiles, then the member table. */
export function CampaignDetailSkeleton() {
  return (
    <div className="screen-col">
      <div className="scroll">
        <div className="page-bar">
          <Bone w={110} h={14} style={{ marginLeft: 8 }} />
          <div style={{ flex: 1 }} />
          <Bone w={130} h={30} r={999} /><Bone w={30} h={30} r={999} />
        </div>
        <Loading label="Loading campaign" className="camp-detail">
          <div className="page-title" style={{ gap: 10 }}>
            <Bone w={300} h={28} r={8} /><Bone w={220} h={13} />
          </div>
          <div className="card camp-section">
            <Bone w={70} h={14} />
            <div className="targets">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="target" style={{ gap: 9 }}>
                  <Bone w="60%" h={10} /><Bone w="45%" h={20} /><Bone h={6} r={999} /><Bone w="30%" h={10} />
                </div>
              ))}
            </div>
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
