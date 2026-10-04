/** Backend base URL; undefined = demo mode (built-in data, no server). Set at build time via VITE_API_URL. */
export const API_URL: string | undefined = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || undefined

export const apiEnabled = () => API_URL !== undefined

/** An error response from the API (RFC 9457 problem details), or a network failure (status 0). */
export class ApiError extends Error {
  readonly status: number
  readonly errors: string[]

  constructor(status: number, message: string, errors: string[] = []) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

/** GET a JSON resource. `signal` lets callers cancel stale requests (e.g. the user typed again). */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!API_URL) throw new Error('API is not configured (VITE_API_URL is unset)')
  let res: Response
  try {
    res = await fetch(API_URL + path, { signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Can’t reach the server. Is the backend running?')
  }
  if (!res.ok) {
    const problem = await res.json().catch(() => ({})) as { title?: string; detail?: string; errors?: string[] }
    throw new ApiError(res.status, problem.detail ?? problem.title ?? `Request failed (${res.status})`, problem.errors ?? [])
  }
  return res.json() as Promise<T>
}
