# Full Body Force Generation — collection integration

The local Athleticism Accelerator collection now includes Full Body Force Generation as a grouped 36-class program (id: full-body-force). Twelve stages combine all original upper/lower force classes and both rotational regions in every class. No weekly calendar is implied.

The coach view exposes all 36 classes, four phase tabs, each class's main effort and quality marker, three adjacent explosive connections, source references, full exercise instructions, sets/reps, recovery, replacements, six same-lift preparation notes and the complete progression rationale. Source wording directs coaches to the current combined prescription; reduced rotational doses are not described as unchanged originals.

Verification completed locally on September 13, 2026:

- Source verification: all 36 classes, 504 rows, 336 original force prescriptions and 234 checks pass, including exact portal-session equality.
- Collection build check: 15 programs, 276 classes and 3,864 exercise prescriptions agree with source files.
- TypeScript build: npx tsc -b passes.
- Browser test: tests/e2e/full-body-force.spec.ts passes in 54.1 seconds (57.8 seconds including setup). It checks every class's 6/2/6 counts, source proportions, all 216 primary preparation dialogs, original Class 1 doses, reduced Class 16 rotation, reference quality notes, 36-class overview and navigation.
- All 36 classes fit a 390 px viewport without horizontal page overflow; mobile quality and preparation dialogs fit and scroll. No page errors were recorded in the test.
- The agent-browser preview check loaded meaningful content without a framework error overlay or reported page errors. Desktop and mobile screenshots were visually inspected and are saved in visual_checks/.

The browser used a local preview and a mocked coach account/API response to test the existing portal layout. This verifies the local interface and curriculum data; it is not a production authentication or backend integration test. No deployment or external publication was performed.

All curriculum classes and workload/audit/feedback state are in this folder. The reusable source adapter, verifier and collection builder live in scripts/; the UI registration is in src/coach/athleticismAccelerator.ts. Athlete observations remain unknown.
