# AGENTS.md

## Cursor Cloud specific instructions

### Product overview
This repo is a single product: **BisLoot / Dark and Darker Market Tracker**, a Next.js 15 (App Router) + React 19 web app that tracks the in-game marketplace. The live app is entirely the workspace at `client/`; the frontend and its backend API route handlers (`/api/*`) are served by the same Next.js process. The `server/` directory is a legacy standalone Express backend that is NOT part of the npm workspace and is NOT used by the product — ignore it for normal development.

### Services

| Service | Location | Run (dev) | Port | Required |
| --- | --- | --- | --- | --- |
| Next.js app (frontend + API routes) | `client/` | `npm run dev` (from repo root; proxies to the `client` workspace) | 3000 | Yes |
| Legacy Express API | `server/` | not needed; not in workspace | 3001 | No |

Standard commands (from repo root, proxy to the `client` workspace): `npm run dev`, `npm run build`, `npm run start`. See `package.json` and `client/package.json`.

### External data dependency (important)
All market/items/prices/alerts/crafting data comes from the external **DarkerDB API** (`https://api.darkerdb.com`) and requires the `DARKERDB_API_KEY` environment variable (scopes `darkerdb.data` + `darkerdb.live`). Without it, the app UI still loads but every data endpoint returns `{"error":"DARKERDB_API_KEY is not set..."}`. Set `DARKERDB_API_KEY` as a Cloud Agent secret so it is injected as an env var (no `.env.local` needed; secrets are read from `process.env`). `DARKERDB_ORIGIN` defaults to `https://www.bisloot.website` in code and must match an Origin allowlisted on the key. The Watchers feature additionally needs `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `AUTH_SECRET`; it is optional for core functionality.

### Lint / type-check caveat
There is no committed ESLint config, so `npm run lint` (`next lint`) drops into an interactive setup prompt and cannot run non-interactively. Use `npx tsc --noEmit` (from `client/`) for a type-check instead.

### Quick health check
`GET /api/health` returns `{"status":"ok",...}` and does NOT require the API key — use it to confirm the dev server is up independent of DarkerDB credentials.
