/**
 * The signed-in session: the Google sign-in token (an ID token, a JWT) and who it says you are.
 * Kept in sessionStorage so a page refresh doesn't ask you to sign in again; closing the tab forgets it.
 * (Not localStorage: a token that outlives the tab is a bigger prize if the page is ever compromised.)
 * The server re-checks the token on every request; nothing here is trusted by the backend.
 */
import { useSyncExternalStore } from 'react'

export type Session = { token: string; email: string; name: string; picture: string | null; expiresAt: number }
type Snapshot = { session: Session | null; expired: boolean }

const KEY = 'iiq-google-token'

/** Reads the JWT's middle part (the claims). Display only: the signature is checked by the server, not here. */
function fromToken(token: string): Session | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))))
    return { token, email: claims.email, name: claims.name ?? claims.email, picture: claims.picture ?? null, expiresAt: claims.exp * 1000 }
  } catch {
    return null
  }
}

function load(): Session | null {
  try {
    const s = fromToken(sessionStorage.getItem(KEY) ?? '')
    return s && s.expiresAt > Date.now() ? s : null
  } catch {
    return null
  }
}

let snapshot: Snapshot = { session: load(), expired: false }
const listeners = new Set<() => void>()
const set = (next: Snapshot) => { snapshot = next; listeners.forEach(l => l()) }

export const getToken = () => snapshot.session?.token ?? null

export function signIn(token: string) {
  const session = fromToken(token)
  if (!session) return
  try { sessionStorage.setItem(KEY, token) } catch { /* private mode: lasts until refresh */ }
  set({ session, expired: false })
}

/** The server said 401 (or the token ran out) while signed in: ask to sign in again, keeping the page as it is. */
export function markExpired() {
  if (snapshot.session && !snapshot.expired) set({ ...snapshot, expired: true })
}

export function signOut() {
  try { sessionStorage.removeItem(KEY) } catch { /* nothing stored */ }
  set({ session: null, expired: false })
}

export function useSession(): Snapshot {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => listeners.delete(l) },
    () => snapshot,
  )
}
