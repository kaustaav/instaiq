# InfluenceIQ frontend

React 19 + TypeScript + Vite + React Router. Icons: `lucide-react`. Styles: plain CSS with the `--iq-*` tokens in
`src/styles/tokens.css`. How each screen looks and behaves: [docs/design/UI_SPEC.md](../docs/design/UI_SPEC.md).

## Two modes
| Mode | When | Data |
|---|---|---|
| **Demo** | `VITE_API_URL` not set | Built-in data (500 fictional influencers, sample campaigns), kept in memory. No server, no sign-in. This is what GitHub Pages serves. |
| **API** | `VITE_API_URL` set | The Spring Boot backend. Sign-in with Google (`VITE_GOOGLE_CLIENT_ID`). |

New UI work must keep working in both modes.

Settings go in `.env.local` (git-ignored); see `.env.example`. Locally `VITE_API_URL=/api` goes through the Vite dev
proxy to `localhost:8080` (`vite.config.ts`).

## Scripts
| Command | What |
|---|---|
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run lint` | Oxlint |
| `npm run build:pages` | Build for GitHub Pages (base `/instaiq/`, `404.html` fallback) |
| `npm run generate:influencers` | Regenerate the demo influencers in `src/data/` |

## Layout
| Path | What |
|---|---|
| `src/screens/` | One folder per screen: search, profile, campaigns, manage |
| `src/overlays/` | Modals and drawers: add/edit influencer, location picker, add to campaign, niches & languages |
| `src/components/` | Shared UI: sidebar, pagination, pills, reason dialog |
| `src/api/` | API client and per-resource calls |
| `src/lib/` | Pure logic: search params, campaigns, formatting, locations |
| `src/data/` | Demo-mode data |
| `src/hooks/`, `src/auth/`, `src/store.tsx` | Data loading, Google sign-in, app state |

Whatever serves the build must fall back to `index.html` for unknown paths, or refreshing a deep link 404s.
