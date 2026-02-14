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

