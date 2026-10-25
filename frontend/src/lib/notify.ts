/**
 * In-app notices (shown by components/Toasts.tsx) instead of browser alert boxes. Use them for errors and for
 * completed actions that otherwise give no visible feedback; offer Undo where an action can be reversed.
 * Successes clear after a few seconds, errors stay longer and can be closed.
 *
 *   notify({ kind: 'success', text: 'Archived Priya', action: { label: 'Undo', run: () => … } })
 */
export type NoticeKind = 'success' | 'error' | 'info'
export type Notice = { id: number; kind: NoticeKind; text: string; action?: { label: string; run: () => void } }

let notices: Notice[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export const subscribeNotices = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const currentNotices = () => notices

export function notify(n: Omit<Notice, 'id'>) {
  const id = ++seq
  notices = [...notices, { ...n, id }].slice(-3) // at most three at once
  emit()
  window.setTimeout(() => dismissNotice(id), n.kind === 'error' ? 7000 : n.action ? 6000 : 4000)
  return id
}

export function dismissNotice(id: number) {
  if (!notices.some(n => n.id === id)) return
  notices = notices.filter(n => n.id !== id)
  emit()
}
