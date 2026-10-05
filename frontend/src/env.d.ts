/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the backend API, e.g. "/api" (local, via the Vite proxy) or "https://api.example.com/api".
   * Unset = demo mode: the UI uses its built-in data and never calls a server.
   */
  readonly VITE_API_URL?: string
  /** Google sign-in client ID (Google Cloud console); needed in API mode. Not secret, but kept out of git. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
