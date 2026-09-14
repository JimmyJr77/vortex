# Athleticism Accelerator collection integration

The Coach Portal collection includes **Upper Body Force Generation — 12 Classes**, program key `upper-body-force`.

The finalized class Markdown remains the exercise source. The portal reads all twelve classes through `scripts/build-athleticism-accelerator.mjs` and `scripts/lib/build-upper-body-force.mjs`; the structured workload files supply timing, per-side recovery and load-preparation doses. The displayed working rows retain the exact names, doses, execution cues and replacements. Existing Access & Prepare 1 is referenced without creating a sequence.

The class view includes the six explosive, two resilience and six primary-strength entries. Coaching dialogs retain common phase instructions and progression criteria. Primary-exercise dialogs show the separate preparation sets, and delivery/setup dialogs retain timing limits and replacement conditions. Free rope pulls are labeled as loose-rope work, and controlled projection steps are not classified as equipment boxes.

Rebuild with `node scripts/build-athleticism-accelerator.mjs`. Check synchronization with `node scripts/build-athleticism-accelerator.mjs --check` and verify this course with `node scripts/verify-upper-body-force-program.mjs`. Browser coverage is in `tests/e2e/upper-body-force.spec.ts`.

This adds the course to the local application collection. It does not record athlete completion, assign the program to athletes or publish a production deployment.

Verification completed: source synchronization and all 168 exercise rows passed; TypeScript passed; the new course browser test passed across all 12 classes, including desktop/mobile coaching dialogs, load preparation, timing and paired-repetition recovery. Local screenshots were visually inspected. No production deployment was performed.
