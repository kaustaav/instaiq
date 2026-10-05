import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { LogOut, ShieldX } from 'lucide-react'
import { apiEnabled, apiGet, ApiError } from '../api/client'
import { useStore } from '../store'
import { GOOGLE_CLIENT_ID, loadGoogle } from './google'
import { markExpired, signOut, useSession, type Session } from './session'
import './auth.css'

export type SignedInUser = Pick<Session, 'email' | 'name' | 'picture'> & { signOut: () => void }

const UserContext = createContext<SignedInUser | null>(null)

/** The signed-in person (API mode), or null in demo mode. */
// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider
export const useSignedInUser = () => useContext(UserContext)

/** Renew this long before the token expires (Google tokens last 1 hour). */
const RENEW_EARLY_MS = 2 * 60 * 1000

/**
 * API mode: nothing shows until you're signed in with Google and the server says you're allowed (GET /api/me).
 * Demo mode: no sign-in at all (built-in data, no server).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  return apiEnabled() ? <ApiAuthGate>{children}</ApiAuthGate> : <>{children}</>
}

function ApiAuthGate({ children }: { children: ReactNode }) {
  const { session, expired } = useSession()
  const { dataChanged } = useStore()
  const [loadError, setLoadError] = useState('')
  // the server's answer for an email: allowed, or not (checked once per person, not per token)
  const [access, setAccess] = useState<{ email: string; allowed: boolean } | null>(null)

  useEffect(() => {
    loadGoogle().catch(e => setLoadError(e instanceof Error ? e.message : 'Couldn’t load Google sign-in'))
  }, [])

  // a different token (first sign-in, re-sign-in, renewal): reload once, so anything refused without it comes back.
  // Compared with the last token seen, not the first: dataChanged() changes on every reload, and comparing with
  // the first would reload forever.
  const token = session?.token
  const lastToken = useRef(token)
  useEffect(() => {
    if (token && token !== lastToken.current) dataChanged()
    lastToken.current = token
  }, [token, dataChanged])

  // ask the server whether this person may use the app
  const email = session?.email
  useEffect(() => {
    if (!email) return
    const controller = new AbortController()
    apiGet('/me', controller.signal)
      .then(() => setAccess({ email, allowed: true }))
      .catch(e => {
        if ((e as Error).name === 'AbortError') return
        if (e instanceof ApiError && e.status === 403) setAccess({ email, allowed: false })
        else if (e instanceof ApiError && e.status === 401) signOut() // token refused: start again
      })
    return () => controller.abort()
  }, [email])

  // quiet renewal shortly before expiry; if that doesn't happen, ask to sign in again when it runs out
  const expiresAt = session?.expiresAt
  useEffect(() => {
    if (!expiresAt) return
    const renew = setTimeout(() => window.google?.accounts.id.prompt(), Math.max(0, expiresAt - Date.now() - RENEW_EARLY_MS))
    const expire = setTimeout(markExpired, Math.max(0, expiresAt - Date.now()))
    return () => { clearTimeout(renew); clearTimeout(expire) }
  }, [expiresAt])

  if (!GOOGLE_CLIENT_ID || loadError) {
    return <Centered><h1>Sign-in unavailable</h1><p>{loadError || 'VITE_GOOGLE_CLIENT_ID is not set.'}</p></Centered>
  }
  if (!session) return <SignInScreen />
  if (!access || access.email !== session.email) return <Centered><p>Checking your access…</p></Centered>
  if (!access.allowed) {
    return (
      <Centered>
        <ShieldX size={28} />
        <h1>No access</h1>
        <p><b>{session.email}</b> isn’t allowed to use InfluenceIQ. Use your company account, or ask the admin to add you.</p>
        <button type="button" className="btn btn-ghost" onClick={doSignOut}><LogOut size={13} />Use another account</button>
      </Centered>
    )
  }
  return (
    <UserContext.Provider value={{ email: session.email, name: session.name, picture: session.picture, signOut: doSignOut }}>
      {children}
      {expired && (
        // on top of the page, so unsaved work stays where it is
        <div className="overlay auth-overlay" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
          <div className="modal auth-card">
            <h1 id="reauth-title">Session expired</h1>
            <p>Sign in again to carry on. Anything you were typing is still here; save it again afterwards.</p>
            <GoogleButton />
          </div>
        </div>
      )}
    </UserContext.Provider>
  )
}

function doSignOut() {
  window.google?.accounts.id.disableAutoSelect() // don't sign straight back in
  signOut()
}

function SignInScreen() {
  useEffect(() => { loadGoogle().then(id => id.prompt()).catch(() => {}) }, []) // One Tap: returning users can skip the button
  return (
    <Centered>
      <div className="auth-brand">InfluenceIQ</div>
      <h1>Sign in</h1>
      <p>Use your company Google account.</p>
      <GoogleButton />
    </Centered>
  )
}

/** Google's own "Sign in with Google" button, drawn by their script. */
function GoogleButton() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let alive = true
    loadGoogle().then(id => {
      if (alive && ref.current) id.renderButton(ref.current, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill' })
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  return <div ref={ref} className="auth-button" />
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="auth-page"><div className="auth-card">{children}</div></main>
}
