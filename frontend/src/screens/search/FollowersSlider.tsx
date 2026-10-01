import { fmt } from '../../lib/format'
import { F_HI, F_LO, followersToPos, posToFollowers } from '../../lib/search'

type Props = { min: number; max: number; onChange: (min: number, max: number) => void }

const MIN_GAP = 10 // slider steps between thumbs

/** One dual-thumb log slider, 1K → 10M+. Left end = no minimum, right end = no maximum. */
export function FollowersSlider({ min, max, onChange }: Props) {
  const pMin = followersToPos(min)
  const pMax = followersToPos(max)
  const label = min <= F_LO && max >= F_HI ? 'Any' : `${fmt(min)} – ${max >= F_HI ? '10M+' : fmt(max)}`

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="label">Followers</div>
        <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--iq-brand-500)' }}>{label}</div>
      </div>
      <div className="dual">
        <div className="dual-track" />
        <div className="dual-fill" style={{ left: pMin / 10 + '%', width: (pMax - pMin) / 10 + '%' }} />
        <input
          type="range" min={0} max={1000} step={1} value={pMin}
          aria-label="Minimum followers"
          aria-valuetext={fmt(min) + ' followers'}
          // keep the min thumb reachable when both thumbs sit at the right end
          style={{ zIndex: pMin > 900 ? 4 : 2 }}
          onChange={e => {
            const p = Math.min(+e.target.value, pMax - MIN_GAP)
            onChange(p <= 0 ? F_LO : posToFollowers(p), max)
          }}
        />
        <input
          type="range" min={0} max={1000} step={1} value={pMax}
          aria-label="Maximum followers"
          aria-valuetext={max >= F_HI ? '10M or more followers' : fmt(max) + ' followers'}
          style={{ zIndex: 3 }}
          onChange={e => {
            const p = Math.max(+e.target.value, pMin + MIN_GAP)
            onChange(min, p >= 1000 ? F_HI : posToFollowers(p))
          }}
        />
      </div>
      <div className="dual-ticks">
        <span>1K</span><span>10K</span><span>100K</span><span>1M</span><span>10M</span>
      </div>
    </div>
  )
}
