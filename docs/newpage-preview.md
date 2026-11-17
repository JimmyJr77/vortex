# Unified Vortex website

Open `http://localhost:5173/`. The design originally developed at `/newpage` is now the public homepage. `/newpage` redirects to `/`, and the homepage is indexable with canonical URL `https://vortexathletics.com/`.

Both `vortex-gymnastics.com` and `www.vortex-gymnastics.com` redirect into the primary Vortex Athletics site. Retired marketing URLs lead to the relevant homepage sections; enrollment, registration, member links, and query parameters retain their destinations. The existing admin, coach, and member portal components and login flow are unchanged by this homepage promotion. Other sport domains keep their existing behavior. Camp inquiry and thank-you pages remain available on the primary site.

The page brings Gymnastics and Fit & Flip together around Strength, Explosiveness, and Body Control. Program details, the goal-based program finder, inquiries, and video open on the same page. On phones, dialogs become scrollable bottom sheets. Enrollment links open all available classes in the existing catalog; login uses the existing portal flow.

## Local services

- Frontend: `npm run dev` (port 5173).
- Backend: use the existing local setup, `npm run dev` from `backend/` (port 3001), or the repository's documented Docker development command. Keep the database configuration local.

## Media

`public/newpage/training-loop.mp4` is a muted, 24-second, approximately 1.2 MB version of the existing Vortex training footage. The background starts loading after the visible poster paints, pauses offscreen or behind a dialog, and respects reduced-motion and data-saving preferences. A poster remains available if playback fails.

Optional frontend environment variables in `.env.local` (restart Vite after changing them):

- `VITE_NEWPAGE_VIDEO_URL`: a public, browser-compatible video URL replacing the bundled clip in the background and training-film popup.
- `VITE_NEWPAGE_LIVE_EMBED_URL`: an HTTPS provider embed URL for an actual live stream. When configured, the film popup offers a **Watch live** action. The embedded player only loads after that action. No live stream is advertised by default.

The inquiry form posts to the existing `/api/registrations` endpoint, identifies its source as the current pathname, and sets newsletter enrollment to false. It only displays success after the server confirms the save.

The current local seed has no sport assignments on its programs. The enrollment CTA explicitly uses `sportFilter=all` so the preview can show the available local classes instead of applying an unsupported sport filter.

## Free trials

The new page includes a free-trial section and header action. The same-page flow uses the actual schedule and attendance data from `/api/public/free-trials`; it shows confirmed athlete counts separately from places reserved by pending registrations.

- Fit & Flip: ages 8–11 or 12–15 see their matching Cyclones group.
- Gymnastics, ages 2–3: Mommy & Me requires potty training. The parent or guardian must confirm it again during registration.
- Gymnastics, ages 4–5: choose a preschool class.
- Gymnastics, ages 6–17, no experience: choose a Tornadoes class.
- Gymnastics, ages 6–17, prior experience: choose a Trial Assessment or call for placement.

New families complete parent, child, and waiver steps. Existing families sign in, select an authorized child, and complete the current required waivers. The server validates the child's actual age on the selected date, guardian authority, capacity, and lifetime trial eligibility before atomically confirming a `free_trial` booking at $0. The flow does not create recurring enrollment, annual membership fees, or a Stripe checkout.

Migrations 859 and 860 create the **Trial Assessment** class and restrict it to free-trial bookings. Its initial schedule is Saturday noon–1 pm, capacity 8, ages 6–17. Assessment availability comes from the scheduler, so staff changes are reflected in the public picker. Existing settings are preserved if migrations are rerun. Admins can edit it in the class schedule; coaches have a dedicated Trial Assessments schedule screen.

The current local database includes preschool fixtures and the new Trial Assessment. It does not yet contain the live Cyclones, Mommy & Me, or Tornadoes catalog, so those paths correctly show no local dates. The production public catalog was checked for the real class names and age ranges. Rollback-only database verification covered both Cyclones age groups and full assessment registration without sending notifications or leaving test bookings.
