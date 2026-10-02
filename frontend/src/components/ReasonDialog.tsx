import { useEffect, useState } from 'react'
import '../overlays/overlays.css'

type Props = {
  title: string
  message?: string
  /** When set, a reason is collected and required. */
  reasonLabel?: string
  confirmLabel: string
  danger?: boolean
  onConfirm: (reason: string) => string // returns an error message, or '' to close
  onClose: () => void
}

/** Small confirm dialog that can also ask "why?". Errors from the rule layer are shown inline. */
export function ReasonDialog({ title, message, reasonLabel, confirmLabel, danger, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const confirm = () => {
    const err = onConfirm(reason)
    if (err) setError(err)
    else onClose()
  }

  return (
    <div className="overlay" style={{ alignItems: 'center', justifyContent: 'center', zIndex: 260 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rd-title" style={{ width: 400 }}>
        <div className="modal-head">
          <div id="rd-title" style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          {message && <div className="muted" style={{ fontSize: 12, marginTop: 4, whiteSpace: 'pre-line' }}>{message}</div>}
        </div>
        {reasonLabel && (
          <div style={{ padding: '12px 18px 0' }}>
            <label className="field">
              <span>{reasonLabel}</span>
              <textarea className="input" rows={3} autoFocus value={reason} onChange={e => setReason(e.target.value)} />
            </label>
          </div>
        )}
        {error && <div role="alert" style={{ padding: '10px 18px 0', fontSize: 12, color: 'var(--cs-down)', whiteSpace: 'pre-line' }}>{error}</div>}
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-blue" style={danger ? { background: 'var(--cs-down)' } : undefined} onClick={confirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
