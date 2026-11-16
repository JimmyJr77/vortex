# Unified Vortex page preview

Open `http://localhost:5173/newpage`. This standalone preview keeps the existing homepage and portal flows available. It is marked `noindex, nofollow` while being evaluated.

The page brings Gymnastics and Fit & Flip together around Strength, Explosiveness, and Body Control. Program details, the goal-based program finder, inquiries, and video open on the same page. On phones, dialogs become scrollable bottom sheets. Enrollment links open all available classes in the existing catalog; login uses the existing portal flow.

## Local services

- Frontend: `npm run dev` (port 5173).
- Backend: use the existing local setup, `npm run dev` from `backend/` (port 3001), or the repository's documented Docker development command. Keep the database configuration local.

## Media

`public/newpage/training-loop.mp4` is a muted, 24-second, approximately 1.7 MB version of the existing Vortex training footage. The background loads only when visible, pauses offscreen or behind a dialog, and respects reduced-motion and data-saving preferences. A poster remains available if playback fails.

Optional frontend environment variables in `.env.local` (restart Vite after changing them):

- `VITE_NEWPAGE_VIDEO_URL`: a public, browser-compatible video URL replacing the bundled clip in the background and training-film popup.
- `VITE_NEWPAGE_LIVE_EMBED_URL`: an HTTPS provider embed URL for an actual live stream. When configured, the film popup offers a **Watch live** action. The embedded player only loads after that action. No live stream is advertised by default.

The inquiry form posts to the existing `/api/registrations` endpoint, identifies its source as `/newpage`, and sets newsletter enrollment to false. It only displays success after the server confirms the save.

The current local seed has no sport assignments on its programs. The enrollment CTA explicitly uses `sportFilter=all` so the preview can show the available local classes instead of applying an unsupported sport filter.
