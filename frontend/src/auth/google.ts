/**
 * Google's own sign-in widget ("Google Identity Services"). Loaded only in API mode, from Google, when needed.
 * It gives us a signed ID token for the person; we never see their password.
 * Docs: https://developers.google.com/identity/gsi/web
 */
type GoogleId = {
  initialize: (o: Record<string, unknown>) => void
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
  prompt: () => void
  disableAutoSelect: () => void
}
declare global {
  interface Window { google?: { accounts: { id: GoogleId } } }
}

import { signIn } from './session'

export const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined

let ready: Promise<GoogleId> | null = null

/**
 * Loads the script once and sets it up once. Every new sign-in token (button, One Tap, quiet renewal) goes to
 * signIn().
 */
export function loadGoogle(): Promise<GoogleId> {
  ready ??= new Promise<GoogleId>((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) return reject(new Error('VITE_GOOGLE_CLIENT_ID is not set'))
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onerror = () => { ready = null; reject(new Error('Couldn’t load Google sign-in. Check your connection.')) }
    s.onload = () => {
      const id = window.google!.accounts.id
      id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r: { credential: string }) => signIn(r.credential),
        auto_select: true, // returning users get a token without clicking (renewals, next visit)
        use_fedcm_for_prompt: true, // the browser's built-in sign-in prompt, where supported
        cancel_on_tap_outside: false,
      })
      resolve(id)
    }
    document.head.appendChild(s)
  })
  return ready
}
