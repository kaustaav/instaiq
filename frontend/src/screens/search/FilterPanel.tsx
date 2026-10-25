import { useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../../store'
import { categoryColor, collapse, toggle } from '../../lib/format'
import { MoreChip, Segmented } from '../../components/ui'
import { emptyFilters, hasActiveFilters, type Filters } from '../../lib/search'
import { FollowersSlider } from './FollowersSlider'
import { LocationFilter } from './LocationFilter'

const CAT_VISIBLE = 4
const LANG_VISIBLE = 5
const ENG_OPTIONS = [
  { label: 'Any', v: 0 },
  { label: '3%+', v: 3 },
  { label: '5%+', v: 5 },
  { label: '7%+', v: 7 },
]

/** `replace` = update the URL without a new history entry (continuous inputs like the slider). */
type Props = {
  filters: Filters
  onChange: (f: Filters, replace?: boolean) => void
  /** Phones: the panel is a full-screen sheet. Changes apply live; "Show results" just closes it. */
  mobileOpen: boolean
  onMobileClose: () => void
  resultCount: number
}

export function FilterPanel({ filters: f, onChange, mobileOpen, onMobileClose, resultCount }: Props) {
  const { cats, langs } = useStore()
  const [catMore, setCatMore] = useState(false)
  const [langMore, setLangMore] = useState(false)
  const set = (patch: Partial<Filters>, replace = false) => onChange({ ...f, ...patch }, replace)

  const catList = collapse(cats, f.cats, CAT_VISIBLE, catMore)
  const langList = collapse(langs, f.langs, LANG_VISIBLE, langMore)

  const inkChip = (active: boolean) => ({
    background: active ? 'var(--iq-navy)' : 'white',
    color: active ? 'white' : 'var(--iq-fg-1)',
    boxShadow: active ? 'none' : 'var(--iq-shadow-1)',
  })

  return (
    <div className={mobileOpen ? 'filters open' : 'filters'} aria-label="Filters">
      <div className="filters-head">
        <h3>Filters</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {hasActiveFilters(f) && (
            <button type="button" className="btn btn-plain btn-sm" style={{ color: 'var(--iq-brand-500)', padding: '2px 6px' }}
              onClick={() => onChange({ ...emptyFilters(), q: f.q })}>
              Clear all
            </button>
          )}
          <button type="button" className="icon-btn filters-close" aria-label="Close filters" onClick={onMobileClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      <LocationFilter value={f.loc} onChange={loc => set({ loc })} />

      <div>
        <div className="label" style={{ marginBottom: 6 }}>Category</div>
        <div className="chips">
          {catList.shown.map(c => {
            const on = f.cats.includes(c)
            const cc = categoryColor(c)
            return (
              <button key={c} type="button" className="chip" aria-pressed={on}
                style={{ background: on ? cc.bg : 'white', color: on ? cc.fg : 'var(--iq-fg-1)', boxShadow: on ? `inset 0 0 0 1.5px ${cc.fg}` : 'var(--iq-shadow-1)' }}
                onClick={() => set({ cats: toggle(f.cats, c) })}>
                {c}
              </button>
            )
          })}
          {catList.canToggle && <MoreChip expanded={catMore} hiddenCount={catList.hiddenCount} onToggle={() => setCatMore(!catMore)} />}
        </div>
      </div>

      <FollowersSlider min={f.fMin} max={f.fMax} onChange={(fMin, fMax) => set({ fMin, fMax }, true)} />

      <div>
        <div className="label" style={{ marginBottom: 6 }}>Minimum engagement</div>
        <Segmented label="Minimum engagement rate" className="seg-fill" value={String(f.eMin)}
          onChange={v => set({ eMin: Number(v) })}
          options={ENG_OPTIONS.map(o => ({ value: String(o.v), label: o.label }))} />
      </div>

      <div>
        <div className="label" style={{ marginBottom: 6 }}>Language</div>
        <div className="chips">
          {langList.shown.map(l => (
            <button key={l} type="button" className="chip" aria-pressed={f.langs.includes(l)}
              style={inkChip(f.langs.includes(l))}
              onClick={() => set({ langs: toggle(f.langs, l) })}>
              {l}
            </button>
          ))}
          {langList.canToggle && <MoreChip expanded={langMore} hiddenCount={langList.hiddenCount} onToggle={() => setLangMore(!langMore)} />}
        </div>
      </div>
      <button type="button" className="btn btn-blue filters-done" onClick={onMobileClose}>
        Show {resultCount} influencer{resultCount !== 1 ? 's' : ''}
      </button>
    </div>
  )
}
