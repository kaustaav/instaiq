import { getToken, markExpired } from '../auth/session'

/** Backend base URL; undefined = demo mode (built-in data, no server). Set at build time via VITE_API_URL. */
export const API_URL: string | undefined = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || undefined

export const apiEnabled = () => API_URL !== undefined

/** RFC 9457 problem details, plus our extra fields (errors, existingId). */
type Problem = { title?: string; detail?: string; errors?: string[]; existingId?: number }

/** An error response from the API (problem details), or a network failure (status 0). */
export class ApiError extends Error {
  readonly status: number
  readonly errors: string[]
  /** 409 duplicate: the influencer that already has this handle. */
  readonly existingId: number | undefined

  constructor(status: number, message: string, errors: string[] = [], existingId?: number) {
    super(message)
    this.status = status
    this.errors = errors
    this.existingId = existingId
  }
}

/** One JSON request. `signal` lets callers cancel stale requests (e.g. the user typed again). */
async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  if (!API_URL) throw new Error('API is not configured (VITE_API_URL is unset)')
  const token = getToken()
  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }), // the Google sign-in token; the server checks it
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Can’t reach the server. Is the backend running?')
  }
  if (res.status === 401 && token) markExpired() // signed in, but the server no longer accepts the token
  if (!res.ok) {
    const p = await res.json().catch(() => ({})) as Problem
    throw new ApiError(res.status, p.detail ?? p.title ?? `Request failed (${res.status})`, p.errors ?? [], p.existingId)
  }
  return res.json() as Promise<T>
}

/** Text for showing an error to a person: every problem the server listed, one per line. */
export const errorText = (e: unknown, fallback = 'Something went wrong') =>
  e instanceof ApiError ? (e.errors.length ? e.errors.join('\n') : e.message) : fallback

export const apiGet = <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal)
export const apiPost = <T>(path: string, body: unknown) => request<T>('POST', path, body)
export const apiPut = <T>(path: string, body: unknown) => request<T>('PUT', path, body)
export const apiDelete = <T>(path: string) => request<T>('DELETE', path)
