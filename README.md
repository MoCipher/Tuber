# Tuber — private YouTube frontend

Features
- Subscribe to channels locally (no Google account)
- Fetch public YouTube RSS feeds via a small CORS proxy
- Save videos to "Watch Later" (localStorage)
- Watch videos via YouTube embed

Run locally
1. Install deps: `npm install`
2. Start proxy server: `npm run server` (runs on port 4000)
3. In another terminal run: `npm run dev` (Vite dev server)

Notes
- This is a local, client-side-only app; subscriptions and saved videos are stored in browser `localStorage`.
- For user/custom channel URLs that don't expose channel ID, try entering the channel's username or channel ID (starts with `UC`).
- You may see console warnings from embedded YouTube players (ads, Content-Security-Policy messages, or unreachable code warnings). These come from YouTube/ads third-party scripts and are expected when embedding videos. Enable **Privacy** mode in the app (uses `youtube-nocookie.com`) to reduce tracking and some third-party ad scripts; note that some warnings are outside the app's control.
- The Vite connecting/connected messages and the React DevTools suggestion are normal dev-time messages and not errors.
- If you see console messages about Content-Security-Policy, unreachable code, or cross-origin requests related to embedded YouTube players (ads and tracking), that originates from YouTube's third-party scripts. Use the **Privacy** toggle in the app to use the `youtube-nocookie` embed which reduces some of these scripts and tracking; however, some warnings are expected and come from external providers (ads/doubleclick) and cannot be fully silenced by the app.

Features you may want to try
- Upload a local Lottie JSON via the **Upload Lottie** button in the sidebar (or drop a `src/animations/custom.json` file and the app will auto-use it). This replaces the onboarding animation.
- Use **Mark all as seen** to clear "New" badges, or **Clear seen** to reset.
- Export/import subscriptions with the buttons next to the controls.

## Local development (dev & tests)

- Dev servers
  - Backend API (fixtures): `TEST_FIXTURES=1 PORT=4001 npm run server` — serves test fixtures and dev-only debug endpoints.
  - Frontend (Vite): `npm run dev` — serves app at `http://localhost:5173` and proxies `/api` → `http://localhost:4001` (see `vite.config.ts`).

- Tests
  - Unit tests: `npm test`
  - Playwright (visual + E2E): `npm run test:visual`
  - Update visual GOLDENs: `npm run test:visual:update`

- Useful debug endpoints (available when `TEST_FIXTURES=1`)
  - `POST /api/__fixtures` — install server fixtures for deterministic E2E
  - `POST /api/debug/backoff/set` and `/api/debug/backoff/clear` — control discover backoff (test-only)
  - `GET /api/debug/backoff` — inspect backoff state

- Troubleshooting
  - "Uncaught ReferenceError: require is not defined" in browser → remove Vite cache and restart: `rm -rf node_modules/.vite && npm run dev`.
  - UI cannot reach API → confirm backend is running on port **4001** and Vite proxy (`vite.config.ts`) is present.

- Notes
  - Playwright global-setup will reuse a healthy API server on `TEST_API_PORT` (defaults to `4001`) to avoid spawn races.
  - Legacy React `.jsx` files and the `/archive/legacy-react-backup` folder were removed in recent cleanup PRs (#1, #3).

