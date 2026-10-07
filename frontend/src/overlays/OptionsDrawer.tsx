import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../store'
import { apiEnabled, errorText } from '../api/client'
import { addCategoryApi, addLanguageApi, getCustomOptions, removeOptionApi, renameOptionApi } from '../api/reference'
import { useApiResource } from '../hooks/useApiResource'
import { KIND_LABEL, mergeTarget, normalizeOption, type CustomOption, type OptionKind } from '../lib/options'
import { ReasonDialog } from '../components/ReasonDialog'
import './overlays.css'

type Confirm = { title: string; message: string; confirmLabel: string; danger?: boolean; run: () => Promise<string> }

/**
 * Manage the niches and languages people added: fix a typo (renames it on every influencer), merge a duplicate
 * into an existing value, or delete one nobody uses. Built-in values aren't listed: they can't be changed.
 */
export function OptionsDrawer({ onClose }: { onClose: () => void }) {
  const { cats, langs, customOptions, renameOption, removeOption, addCategory, addLanguage, dataChanged } = useStore()
  const api = apiEnabled()
  const remote = useApiResource(api ? 'custom' : null, getCustomOptions)
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !confirm && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, confirm])

  const options = (kind: OptionKind): CustomOption[] | null => {
    if (!api) return customOptions(kind)
    if (remote.kind !== 'ready') return null
    return kind === 'cats' ? remote.data.categories : remote.data.languages
  }

  /** Same rules as "Add a new niche" on the influencer form. '' when done, else the error to show. */
  const add = async (kind: OptionKind, raw: string): Promise<string> => {
    setMessage('') // a new action: the previous result no longer applies
    try {
      let value: string
      let created: boolean
      if (api) {
        const r = await (kind === 'cats' ? addCategoryApi(raw) : addLanguageApi(raw))
        value = r.value
        created = r.created
        if (created) dataChanged()
      } else {
        const n = normalizeOption(kind, raw)
        if ('error' in n) return n.error
        const list = kind === 'cats' ? cats : langs
        created = !list.some(v => v.toLowerCase() === n.value.toLowerCase())
        value = kind === 'cats' ? addCategory(n.value) : addLanguage(n.value)
      }
      setMessage(created ? `Added “${value}”` : `“${value}” already exists`)
      return ''
    } catch (e) {
      return errorText(e)
    }
  }

  /** '' when done, else the error to show. */
  const rename = async (kind: OptionKind, from: string, to: string): Promise<string> => {
    setMessage('') // a new action: the previous result no longer applies
    try {
      const r = api ? await renameOptionApi(kind, from, to) : renameOption(kind, from, to)
      if (typeof r === 'string') return r
      if (api) dataChanged()
      setMessage(`${r.merged ? `Merged “${from}” into` : `Renamed “${from}” to`} “${r.value}” · ${r.influencersUpdated} influencer${r.influencersUpdated === 1 ? '' : 's'} updated`)
      return ''
    } catch (e) {
      return errorText(e)
    }
  }

  const remove = async (kind: OptionKind, value: string): Promise<string> => {
    setMessage('') // a new action: the previous result no longer applies
    try {
      const err = api ? (await removeOptionApi(kind, value), '') : removeOption(kind, value)
      if (err) return err
      if (api) dataChanged()
      setMessage(`Deleted “${value}”`)
      return ''
    } catch (e) {
      return errorText(e)
    }
  }

  const askRename = async (kind: OptionKind, from: string, to: string) => {
    const n = normalizeOption(kind, to)
    if ('error' in n) return n.error
    if (n.value === from) return ''
    const into = mergeTarget(kind === 'cats' ? cats : langs, from, n.value)
    if (!into) return rename(kind, from, n.value)
    // merging is harder to undo: confirm first
    setConfirm({
      title: `Merge “${from}” into “${into}”?`,
      message: `Everyone with “${from}” gets “${into}” instead, and “${from}” disappears.`,
      confirmLabel: 'Merge', run: () => rename(kind, from, into),
    })
    return ''
  }

  return (
    <div className="overlay" style={{ justifyContent: 'flex-end', zIndex: 210 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="opt-title" style={{ width: 480 }}>
        <div className="drawer-head">
          <div id="opt-title" style={{ fontSize: 14, fontWeight: 600 }}>Niches &amp; languages</div>
          <button type="button" className="btn btn-plain" aria-label="Close" style={{ padding: 4, color: 'var(--iq-fg-3)' }} onClick={onClose}><X size={16} /></button>
        </div>
        <div className="drawer-body">
          <div className="muted" style={{ fontSize: 12 }}>
            Add new ones here or from the influencer form. Below are the ones your team added: renaming fixes the name on
            every influencer; renaming onto an existing name merges them. Built-in niches and languages can’t be changed.
          </div>
          {message && <div role="status" className="opt-msg">{message}</div>}
          {remote.kind === 'error' && <div role="alert" style={{ color: 'var(--iq-danger)', fontSize: 12 }}>{remote.message}</div>}
          {(['cats', 'langs'] as const).map(kind => {
            const list = options(kind)
            return (
              <section key={kind} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="label">{KIND_LABEL[kind]}s</div>
                {list == null ? <div className="muted" style={{ fontSize: 12 }}>Loading…</div>
                  : list.length === 0 ? <div className="muted" style={{ fontSize: 12 }}>None added yet.</div>
                  : list.map(o => (
                    <OptionRow key={o.value} option={o}
                      onRename={to => askRename(kind, o.value, to)}
                      onDelete={() => setConfirm({
                        title: `Delete “${o.value}”?`, message: 'It disappears from the list. No influencer uses it.',
                        confirmLabel: 'Delete', danger: true, run: () => remove(kind, o.value),
                      })} />
                  ))}
                <AddRow kind={kind} onAdd={raw => add(kind, raw)} />
              </section>
            )
          })}
        </div>
      </div>
      {confirm && (
        <ReasonDialog title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} danger={confirm.danger}
          onConfirm={() => confirm.run()} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}

function OptionRow({ option, onRename, onDelete }: {
  option: CustomOption
  onRename: (to: string) => Promise<string>
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(option.value)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const used = option.usedBy

  const save = async () => {
    setBusy(true)
    const err = await onRename(value)
    setBusy(false)
    setError(err)
    if (!err) setEditing(false)
  }

  return (
    <div className="opt-row">
      {editing ? (
        <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          <input className="input input-sm" autoFocus autoComplete="off" aria-label={`New name for ${option.value}`} value={value}
            style={{ flex: 1, minWidth: 160 }} onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); setEditing(false) } }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setError(''); setValue(option.value) }}>Cancel</button>
          <button type="button" className="btn btn-blue btn-sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          {error && <div role="alert" style={{ flexBasis: '100%', fontSize: 12, color: 'var(--iq-danger)' }}>{error}</div>}
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{option.value}</div>
            <div className="muted" style={{ fontSize: 11 }}>{used ? `Used by ${used} influencer${used === 1 ? '' : 's'}` : 'Not used'}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ gap: 4 }} onClick={() => setEditing(true)}><Pencil size={11} />Rename</button>
          <button type="button" className="btn btn-ghost btn-sm md-danger" style={{ gap: 4 }} disabled={used > 0}
            title={used ? 'In use: rename or merge it instead' : undefined} onClick={onDelete}>
            <Trash2 size={11} />Delete
          </button>
        </>
      )}
    </div>
  )
}

function AddRow({ kind, onAdd }: { kind: OptionKind; onAdd: (raw: string) => Promise<string> }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const label = `Add a new ${KIND_LABEL[kind].toLowerCase()}`

  const submit = async () => {
    if (!value.trim() || busy) return
    setBusy(true)
    const err = await onAdd(value)
    setBusy(false)
    setError(err)
    if (!err) setValue('')
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
      <input className="input input-sm" autoComplete="off" placeholder={label} aria-label={label} value={value}
        style={{ flex: 1, minWidth: 160 }} onChange={e => { setValue(e.target.value); setError('') }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} />
      <button type="button" className="btn btn-ghost btn-sm" style={{ gap: 4 }} disabled={busy || !value.trim()} onClick={submit}>
        <Plus size={11} />{busy ? 'Adding…' : 'Add'}
      </button>
      {error && <div role="alert" style={{ flexBasis: '100%', fontSize: 12, color: 'var(--iq-danger)' }}>{error}</div>}
    </div>
  )
}
