# Athleticism Accelerator collection integration

Lower Body Force Generation appears as an individual **12-class program**, with **12 weeks · 1 class per week** cadence. Program ID: `lower-body-force`. This program title maps to the existing jump/acceleration framework; the display category Power does not introduce an eighth performance category.

The source is this curriculum folder. `scripts/lib/build-lower-body-force.mjs` enriches the shared read model with exact recovery, equipment, preparation sets, weekly titles, quality, setup, timing and progression. `scripts/build-athleticism-accelerator.mjs` registers the twelve source classes, and `src/coach/athleticismAccelerator.ts` provides the collection card and plan guidance. The existing class/phase/details UI handles the program without another screen redesign.

Validation completed locally:

- `python3 workout_plan/lower_body_force_generation/verify_plan.py`: source, 168 entries, exact 6/2/6, all event/side/cycle arithmetic, timing, matched reference and source/manual integrity passed.
- `node scripts/verify-lower-body-force-program.mjs`: all twelve source classes match the coach read model, including full instructions/replacements and per-leg preparation.
- `node scripts/build-athleticism-accelerator.mjs --check`: generated collection matches current source.
- `npx tsc -b`: passed.
- `tests/e2e/lower-body-force.spec.ts`: passed. Searched/opened the 12-class card; visited all twelve classes and all three exercise phases; verified counts, preparation cycles and side rest, unknown booking time, midpoint dose, paired reset gaps, final reference, overview and final navigation state. Browser page errors: none.
- Desktop at 1440 px and mobile at 390 px were visually inspected. No horizontal overflow; details dialog fits mobile. See [desktop](visual_checks/lower-force-desktop.png) and [mobile notes](visual_checks/lower-force-mobile-notes.png).

Browser tests use a local mocked coach session and mocked API responses. They verify the local collection interface, not live authentication/backend behavior or publication. No deployment was performed.

Handoff: open Coach Portal → Athleticism Accelerator → Lower Body Force Generation. Review actual preparation, equipment fit, outside training and athlete readiness before delivery; authoring completion never records athlete completion.
