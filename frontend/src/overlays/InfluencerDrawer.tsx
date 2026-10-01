import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store'
import { categoryColor, collapse, freshness, mon, toggle } from '../lib/format'
import { MoreChip } from '../components/ui'
import { blankDraft, draftFrom, validate, type Draft } from '../lib/influencerForm'
import type { Influencer } from '../types'
import { LocationPicker } from './LocationPicker'
import './overlays.css'

type Props = {
  editing: Influencer | null // null = add
  onClose: () => void
  onSaved: (inf: Influencer) => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Section({ title, aside, children, gap = 10 }: { title: string; aside?: string; children: ReactNode; gap?: number }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap }}>
      <div className="label drawer-section-title" style={{ letterSpacing: '0.07em' }}>
        <span>{title}</span>
        {aside && <span className="drawer-section-aside">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

/** Free-text "add a new …" input that appends to a chip list. */
function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('')
  const submit = () => {
    if (!v.trim()) return
    onAdd(v)
    setV('')
  }
  return (
    <div style={{ display: 'flex', gap: 5, maxWidth: 300 }}>
      <input type="text" className="input input-sm" autoComplete="off" placeholder={placeholder} aria-label={placeholder} value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} />
      <button type="button" className="btn btn-ghost" style={{ fontWeight: 400, padding: '5px 10px' }} onClick={submit}>Add</button>
    </div>
  )
}

export function InfluencerDrawer({ editing, onClose, onSaved }: Props) {
  const { cats, langs, saveInfluencer, addCategory, addLanguage } = useStore()
  const [f, setF] = useState<Draft>(() => (editing ? draftFrom(editing) : blankDraft()))
  const [error, setError] = useState('')
  const [langMore, setLangMore] = useState(false)
  const langList = collapse(langs, f.langs, 8, langMore)
  const set = (patch: Partial<Draft>) => setF(prev => ({ ...prev, ...patch }))
  const text = (k: keyof Draft) => ({
    autoComplete: 'off',
    value: f[k] as string,
    onChange: (e: { target: { value: string } }) => set({ [k]: e.target.value }),
  })

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    const err = validate(f)
    if (err) return setError(err)
    onSaved(saveInfluencer(f))
  }

  const metricsAside = editing ? freshness(editing.updatedAt).label : 'Will be dated today'
  const ratesAside = editing ? `Current since ${mon(editing.rates[0].date)} · edits save as a new rate` : 'Will be dated today'

  return (
    <div className="overlay" style={{ justifyContent: 'flex-end', zIndex: 210 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-head">
          <div id="drawer-title" style={{ fontSize: 14, fontWeight: 600 }}>{editing ? 'Edit influencer' : 'Add influencer'}</div>
          <button type="button" className="btn btn-plain" aria-label="Close" style={{ padding: 4, color: 'var(--cs-fg-3)' }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="drawer-body">
          <Section title="Basics">
            <div className="form-grid-2">
              <Field label="Full name *"><input type="text" className="input" placeholder="Full name" {...text('name')} /></Field>
              <Field label="Instagram handle *">
                <div className="input-affix">
                  <span>@</span>
                  <input type="text" placeholder="handle" {...text('handle')} />
                </div>
              </Field>
              <Field label="Email"><input type="email" className="input" placeholder="Email address" {...text('email')} /></Field>
              <Field label="Phone"><input type="tel" className="input" placeholder="Phone number" {...text('phone')} /></Field>
            </div>
          </Section>

          <Section title="Location *" gap={8}>
            <div className="muted" style={{ fontSize: 12 }}>Search a city or a state. If you only know the state, pick the state on its own.</div>
            <LocationPicker cities={f.cities} states={f.states} onChange={(cities, states) => set({ cities, states })} onError={setError} />
          </Section>

          <Section title="Niches *" gap={8}>
            <div className="chips">
              {cats.map(c => {
                const on = f.cats.includes(c)
                const cc = categoryColor(c)
                return (
                  <button key={c} type="button" className="chip" aria-pressed={on}
                    style={{ padding: '4px 10px', background: on ? cc.bg : 'var(--cs-ink-100)', color: on ? cc.fg : 'var(--cs-fg-2)', borderColor: on ? cc.fg : 'transparent' }}
                    onClick={() => set({ cats: toggle(f.cats, c) })}>
                    {c}
                  </button>
                )
              })}
            </div>
            <AddInput placeholder="Add a new niche" onAdd={v => {
              const c = addCategory(v)
              setF(prev => (prev.cats.includes(c) ? prev : { ...prev, cats: [...prev.cats, c] }))
            }} />
          </Section>

          <Section title="Languages" gap={8}>
            <div className="chips">
              {langList.shown.map(l => {
                const on = f.langs.includes(l)
                return (
                  <button key={l} type="button" className="chip" aria-pressed={on}
                    style={{ padding: '4px 10px', background: on ? 'var(--cs-ink-800)' : 'var(--cs-ink-100)', color: on ? 'white' : 'var(--cs-fg-2)' }}
                    onClick={() => set({ langs: toggle(f.langs, l) })}>
                    {l}
                  </button>
                )
              })}
              {langList.canToggle && <MoreChip expanded={langMore} hiddenCount={langList.hiddenCount} onToggle={() => setLangMore(!langMore)} />}
            </div>
            <AddInput placeholder="Add a new language" onAdd={v => {
              const l = addLanguage(v)
              setF(prev => (prev.langs.includes(l) ? prev : { ...prev, langs: [...prev.langs, l] }))
            }} />
          </Section>

          <Section title="Metrics" aside={metricsAside}>
            <div className="form-grid-4">
              <Field label="Followers *"><input type="number" min={0} className="input mono" placeholder="0" {...text('followers')} /></Field>
              <Field label="Eng. rate %"><input type="number" min={0} step={0.1} className="input mono" placeholder="0.0" {...text('eng')} /></Field>
              <Field label="Avg likes"><input type="number" min={0} className="input mono" placeholder="0" {...text('likes')} /></Field>
              <Field label="Avg comments"><input type="number" min={0} className="input mono" placeholder="0" {...text('comments')} /></Field>
            </div>
          </Section>

          <Section title="Pricing (INR)" aside={ratesAside}>
            <div className="form-grid-3">
              <Field label="Story"><input type="number" min={0} className="input mono" placeholder="₹" {...text('story')} /></Field>
              <Field label="Reel"><input type="number" min={0} className="input mono" placeholder="₹" {...text('reel')} /></Field>
              <Field label="Post"><input type="number" min={0} className="input mono" placeholder="₹" {...text('post')} /></Field>
            </div>
          </Section>

          <Section title="Profile">
            <Field label="Bio"><textarea rows={3} className="input" style={{ padding: '8px 10px' }} {...text('bio')} /></Field>
            <Field label="Top hashtags">
              <input type="text" className="input" placeholder="#hashtag, #hashtag" {...text('tags')} />
              <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>Separate with commas</span>
            </Field>
          </Section>
        </div>

        <div className="drawer-foot">
          <div role="alert" style={{ flex: 1, fontSize: 12, color: 'var(--cs-down)' }}>{error}</div>
          <button type="button" className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-blue" style={{ padding: '7px 14px', fontSize: 13 }} onClick={save}>
            {editing ? 'Save changes' : 'Add influencer'}
          </button>
        </div>
      </div>
    </div>
  )
}
