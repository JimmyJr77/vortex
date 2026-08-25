# Flip & Fit Deterministic Implementation Report

This artifact is generated from `generateFlipFitProgram('2026-08-24')`. It has no current-time input, and every displayed collection is kept in generator order or sorted explicitly so the same source produces the same report.

> **Reconciliation boundary:** Reused, alias, new, and review below are generator-planned statuses from exercise seed metadata. They are not evidence that a live facility database was queried, matched, or mutated. Live facility reconciliation remains facility-scoped runtime work.

## Coach access route and tab

| Surface | Implemented location |
| --- | --- |
| Authenticated portal route | The app selects the coach portal shell in `src/App.tsx` when the signed-in account has an active `coach` portal. It is portal state, not a standalone React Router pathname. |
| Coach tab | Tab key `flip-fit`, label **Flip & Fit**, rendered by the `case 'flip-fit'` branch in `src/components/coach/CoachLayout.tsx`. |
| Panel | Lazy-loaded `src/components/coach/FlipFitSchedulePanel.tsx`. |
| Portal configuration | `src/utils/portalTabConfig.ts` and `backend/platform/portalSettings.js` register the tab for ordering, visibility, labels, and the coach home card. |
| Public route distinction | `/fit-and-flip` is the public Strength & Fitness marketing route; it is not the authenticated Flip & Fit schedule tab. |

## Implementation topology

| Layer | Files | Responsibility |
| --- | --- | --- |
| Portal shell and navigation | `src/App.tsx`; `src/components/CoachDashboard.tsx`; `src/components/coach/CoachLayout.tsx`; `src/utils/portalTabConfig.ts`; `backend/platform/portalSettings.js` | Select the authenticated coach portal, expose the configurable `flip-fit` tab, and mount the schedule panel. |
| Schedule UI | `src/components/coach/FlipFitSchedulePanel.tsx` | Generate and filter the calendar; choose age band and athlete set; edit objectives/notes; display validation and stress evidence; load/save facility state; request card reconciliation. |
| Exercise-card UI | `src/components/coach/FlipFitExerciseModal.tsx` | Show the active age prescription, all three scaling avenues, concrete scheduled dose, allocation fit, coaching cues, safety, and canonical-reference context. |
| Deterministic curriculum data | `src/coach/flipFitProgram.ts` | Generate stable weeks, sessions, phases, cards, age scaling, derived stress, coverage, and generator-planned reconciliation statuses from a Monday anchor. |
| Scheduled prescriptions | `src/coach/flipFitPrescription.ts` | Translate each scheduled exercise and age band into concrete continuous, distance, duration, attempts, or repetitions work/rest and validate it against station allocation. |
| Coach overrides | `src/coach/flipFitOverrides.ts` | Normalize stable session-ID overrides, bound editable objective/notes text, and immutably apply overrides to both flat sessions and weekly day references. |
| Reference view model | `src/coach/flipFitCardReferences.ts` | Merge live facility reference results over generator-planned statuses and summarize effective counts for the UI. |
| Schedule persistence | `backend/platform/flipFitScheduleRoutes.js`; `backend/platform/flipFitScheduleRepository.js` | Expose facility-scoped schedule reads/writes, validate the Monday anchor, require remap confirmation, and enforce optimistic concurrency with `expectedUpdatedAt`. |
| Canonical reconciliation | `backend/platform/flipFitCardRoutes.js`; `backend/platform/flipFitCardRepository.js` | Load facility references; normalize program cards; compare facility canonical identities; classify direct, alias, review, or new outcomes; create unmatched canonical drafts; update the reconciliation ledger. |
| Route registration | `backend/server.js`; `backend/platform/coachPortalRoutes.js` | Mount the coach route group, register both Flip & Fit route modules inside it, and attach authentication/permission middleware. |
| Database schema | `backend/migrations/760_coaching_flip_fit_schedule.sql`; `backend/migrations/761_coaching_flip_fit_card_references.sql`; `backend/platform/initTables.js` | Create and register the facility schedule row and canonical-reference ledger migrations. |
| Focused verification | `scripts/verify-flip-fit-program.mjs`; `scripts/verify-flip-fit-overrides.mjs`; `scripts/verify-flip-fit-prescriptions.mjs`; `backend/platform/__tests__/flipFitScheduleRepository.test.js`; `backend/platform/__tests__/flipFitCardRepository.test.js`; `tests/e2e/flip-fit-schedule.spec.ts` | Exercise deterministic generation, overrides, prescription fit, repository/permission behavior, and the browser schedule workflow. Measured outcomes are recorded below. |

### Persistence approach

- The browser keeps a device fallback under `vortex_flip_fit_schedule_v1`; the authenticated facility row is authoritative when its API is available.
- The backend persists the calendar anchor and coach-authored configuration, not 60 materialized session rows. The deterministic client generator rebuilds those sessions from the stored Monday.
- A schedule save carries `startDate`, settings such as the selected age band, normalized session overrides, `confirmRemap`, and `expectedUpdatedAt`. A changed Monday anchor needs explicit remap confirmation; when the last-seen timestamp is supplied, a stale value returns a conflict instead of silently overwriting another coach. The repository permits the token to be omitted, while this UI sends it after load/save.
- Stable IDs such as `flip-fit-w01-d1` preserve objective and coach-note overrides when the calendar is remapped to another Monday.

### Reconciliation approach

- The reconciliation POST normalizes the submitted inventory, rejects duplicate/slug-colliding IDs, and processes the complete facility batch inside one canonical-card transaction guarded by the facility advisory lock. Taxonomy, canonical definitions, existing references, new drafts, and reference upserts use the same transaction client; an error rolls back the batch.
- Exact identity plus compatible semantics can become a live `reused` or `alias` result. Multiple/potential matches, unresolved or conflicting semantics, generator review flags, archived deterministic cards, and unavailable prior references stay `review`. A truly unmatched eligible card becomes a canonical `draft` and a live `new` ledger result; nothing is auto-published.
- Payload hashes support idempotency without trusting stale semantics: unchanged active links are revalidated, unresolved reviews are retried, and a still-valid prior `new` link avoids another canonical revision. These decisions depend on the authenticated facility’s current taxonomy, canonical definitions, archive state, and prior ledger; generator-planned counts cannot predict the live result.

### Generator, override, and prescription approach

- The curriculum generator is pure from the Monday anchor: it constructs 12 weeks and 60 stable weekday sessions, reuses immutable card payloads by card ID, derives stress from scheduled evidence, and emits planned card-match metadata.
- Overrides are deliberately narrow: only valid 12-week session IDs, objectives up to 2,000 characters, and coach notes up to 4,000 characters survive normalization. Curriculum structure and card identity are not editable through this override channel.
- Scheduled prescriptions use phase, exercise identity, allocation, and age band to select a concrete dose mode. Fit is computed as total work plus between-set rest and must remain within the scheduled station seconds.

### Database migrations

| Migration | Table and purpose | Key integrity boundaries |
| --- | --- | --- |
| 750 | `coaching.flip_fit_schedule` — one deterministic calendar anchor and coach-authored state row per facility. | Primary key `facility_id`; Monday-only `start_date`; `end_date = start_date + 81`; object-only settings and overrides JSON; creator/updater audit fields. |
| 751 | `coaching.flip_fit_card_reference` — facility reconciliation ledger from stable program card key to canonical exercise definition. | Composite primary key `(facility_id, program_card_key)`; optional canonical-definition FK; constrained match status/score; payload hash and JSON snapshot; reconciler audit field; partial canonical-definition index. |

### Coach API and permission boundaries

| Method and endpoint | Permission | Facility/auth boundary | Purpose |
| --- | --- | --- | --- |
| GET `/api/coach/flip-fit-schedule` | `library.view` | Facility ID comes from `req.platformAuth.user.facility_id`. | Load the current facility schedule row or `null`. |
| PUT `/api/coach/flip-fit-schedule` | `training_programs.manage` | Facility and actor IDs come from the authenticated user; the request cannot select another facility. | Create/update the schedule, settings, and session overrides with remap and optimistic-concurrency guards. |
| GET `/api/coach/flip-fit-card-references` | `library.view` | Query is restricted to the authenticated user’s facility. | Load live facility reconciliation references for display over planned statuses. |
| POST `/api/coach/flip-fit-card-references/reconcile` | `library.manage` | Facility and reconciler IDs come from the authenticated user; payload is limited to 1–500 unique program cards. | Compare the submitted program inventory with that facility’s canonical library and persist facility-specific results. |

A coach with view permission can inspect schedule/reference state. Schedule mutation and library reconciliation are separately gated. Newly created reconciliation candidates remain canonical drafts rather than being auto-published. The resulting live counts, IDs, match reasons, and review queue depend on the authenticated facility’s library and are not derivable from this fixed generator report.

### Operational and reporting boundaries

- Each `can(...)` guard authenticates the coach request before checking permission; inactive/unauthenticated users receive 401 and missing permission receives 403. Facility and actor identity come from the authenticated user, never a client-selected facility field.
- Tenant isolation for these tables is enforced by application queries; migrations 750/751 do not add PostgreSQL row-level security. The reference foreign key identifies a canonical definition but is not a composite facility FK, so direct database writers must preserve the same-facility invariant that the API enforces.
- Migration files being registered in `backend/platform/initTables.js` does not prove they are applied in any deployed database. This report does not query schema migration state.
- Reconciliation upserts submitted cards but does not delete older ledger rows omitted from a later request. Unchanged active links are revalidated against current identity, taxonomy, and semantics; valid prior `new` links retain their history without another revision, and unlinked reviews are retried. A returned live `new` status can therefore be historical rather than inserted during that request.
- Schedule JSON receives server-side object/serializability checks; the stable session-ID and allowed objective/coach-note semantics are normalized by the frontend data layer before save.

## Program and calendar summary

| Measure | Deterministic result |
| --- | --- |
| Program | Flip & Fit v1 |
| Fixed generator input | 2026-08-24 |
| Inclusive calendar | 2026-08-24 through 2026-11-13 |
| Weeks / weekday sessions | 12 / 60 |
| Days per week | 5 |
| Athletic / tumbling / athlete total | 90 / 30 / 120 minutes per session |
| Total scheduled athlete time | 7,200 minutes |
| Exercise-card inventory | 301 unique generator cards |

### All dates and 12 movement functions

| Week | Monday | Tuesday | Wednesday | Thursday | Friday | Primary movement function | Capacity focus |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-08-24 | 2026-08-25 | 2026-08-26 | 2026-08-27 | 2026-08-28 | Balance and Body Control | Unilateral strength and trunk stability |
| 2 | 2026-08-31 | 2026-09-01 | 2026-09-02 | 2026-09-03 | 2026-09-04 | Rotation, Tumbling and Inversion | Overhead support, scapular strength, and trunk position |
| 3 | 2026-09-07 | 2026-09-08 | 2026-09-09 | 2026-09-10 | 2026-09-11 | Locomotion and Running | Single-leg gait strength and foot/ankle capacity |
| 4 | 2026-09-14 | 2026-09-15 | 2026-09-16 | 2026-09-17 | 2026-09-18 | Starts and Acceleration | Horizontal force and hip-extension strength |
| 5 | 2026-09-21 | 2026-09-22 | 2026-09-23 | 2026-09-24 | 2026-09-25 | Max-Velocity Sprinting | Posterior-chain and upright sprint support |
| 6 | 2026-09-28 | 2026-09-29 | 2026-09-30 | 2026-10-01 | 2026-10-02 | Deceleration and Stopping | Unilateral braking-force reserve |
| 7 | 2026-10-05 | 2026-10-06 | 2026-10-07 | 2026-10-08 | 2026-10-09 | Change of Direction | Lateral and multiplanar strength |
| 8 | 2026-10-12 | 2026-10-13 | 2026-10-14 | 2026-10-15 | 2026-10-16 | Landing and Force Absorption | Force acceptance through the ankle, knee, and hip |
| 9 | 2026-10-19 | 2026-10-20 | 2026-10-21 | 2026-10-22 | 2026-10-23 | Jumping and Takeoff | Vertical and horizontal force production |
| 10 | 2026-10-26 | 2026-10-27 | 2026-10-28 | 2026-10-29 | 2026-10-30 | Traversal and Upper-Body Locomotion | Pulling, grip, and shoulder-girdle capacity |
| 11 | 2026-11-02 | 2026-11-03 | 2026-11-04 | 2026-11-05 | 2026-11-06 | Object Interaction | Whole-body force transfer |
| 12 | 2026-11-09 | 2026-11-10 | 2026-11-11 | 2026-11-12 | 2026-11-13 | Perception, Reaction and Adaptation | Integrated total-body strength and reassessment |

## Session timing and athlete sets

| Athletic phase | Per-session minutes | Sessions containing phase | Program minutes |
| --- | --- | --- | --- |
| Prepare & Access | 10 | 60 | 600 |
| Movement Intelligence | 20 | 60 | 1200 |
| Output | 20 | 60 | 1200 |
| Capacity slot | 25 | 60 | 1500 |
| Resilience | 10 | 60 | 600 |
| Restore | 5 | 60 | 300 |
| Shared tumbling | 30 | 60 | 1800 |

Every generated session has the athletic order `Prepare & Access → Movement Intelligence → Output → Capacity slot → Resilience → Restore`. The athletic block totals 90 minutes, the separate tumbling block totals 30 minutes, and athlete participation totals 120 minutes.

| Athlete set | Order | Total |
| --- | --- | --- |
| Athlete Set 1 | 1. Athletic workout (90 min) → 2. Shared tumbling (30 min) | 120 min |
| Athlete Set 2 | 1. Shared tumbling (30 min) → 2. Athletic workout (90 min) | 120 min |

### Capacity-slot rotation

| Week parity | Monday | Tuesday | Wednesday | Thursday | Friday |
| --- | --- | --- | --- | --- | --- |
| Odd weeks (A) | Capacity | Capacity | Sustained Capacity | Sustained Capacity | Sustained Capacity |
| Even weeks (B) | Sustained Capacity | Sustained Capacity | Capacity | Capacity | Capacity |

## Age scaling and equipment avenues

| Age band | Required role | Cards covered | Cards with loaded-equipment avenue | Equipment available in generated prescriptions |
| --- | --- | --- | --- | --- |
| 9-11 | regression | 301/301 | 48 | Ball, Balls, Battle rope, Bench, Blocks, Bodyweight, Box, Cable, Colored cones, Cones, Dumbbell, Floor, Floor line, Floor markers, High bar, Jump mat, Jump target, Kettlebell, Landmine, Light dumbbell, Light hammer, Light plate, Low bar, Low beam, Low block, Low box, Low obstacles, Low plate, Medicine ball, Mini band, Mini hurdles, Nordic anchor, Pad, Panel mat, Partner, Program stations, Pull-up bar, Rack, Resistance band, Rings, Rope, Slam ball, Sled, Sliders, Soft ball, Spotting block, Spring floor, Sprint assistance, Support, Tape measure, Target, Target mat, Targets, Tib bar, Timing gates, Towel, Vault block, Wall, Wedge mat, Weight vest, Youth barbell or technique bar |
| 12-14 | foundation | 301/301 | 64 | Ball, Balls, Barbell, Battle rope, Bench, Blocks, Bodyweight, Box, Cable, Colored cones, Cones, Dumbbell, Floor, Floor line, Floor markers, High bar, Jump mat, Jump target, Kettlebell, Landmine, Light dumbbell, Light hammer, Light plate, Low bar, Low beam, Low block, Low box, Low obstacles, Low plate, Medicine ball, Mini band, Mini hurdles, Nordic anchor, Pad, Panel mat, Partner, Program stations, Pull-up bar, Rack, Resistance band, Rings, Rope, Slam ball, Sled, Sliders, Soft ball, Spotting block, Spring floor, Sprint assistance, Support, Tape measure, Target, Target mat, Targets, Tib bar, Timing gates, Towel, Trap bar, Vault block, Wall, Wedge mat, Weight belt, Weight vest |
| 15-18 | progression | 301/301 | 64 | Ball, Balls, Barbell, Battle rope, Bench, Blocks, Bodyweight, Box, Cable, Colored cones, Cones, Dumbbell, Floor, Floor line, Floor markers, High bar, Jump mat, Jump target, Kettlebell, Landmine, Light dumbbell, Light hammer, Light plate, Low bar, Low beam, Low block, Low box, Low obstacles, Low plate, Medicine ball, Mini hurdles, Nordic anchor, Pad, Panel mat, Partner, Program stations, Pull-up bar, Rack, Resistance band, Rings, Rope, Slam ball, Sled, Sliders, Soft ball, Spotting block, Spring floor, Sprint assistance, Support, Tape measure, Target, Target mat, Targets, Tib bar, Timing gates, Towel, Trap bar, Vault block, Wall, Wedge mat, Weight belt, Weight vest |

- **12–14 foundation:** Ages 12–14 may use the full facility inventory when the selected load, setup, and technique meet the athlete’s readiness.
- **9–11 regression avenue:** Ages 9–11 may still use appropriately sized free weights and barbells; scale the variation, load, range, and decision demand before removing equipment by default.
- **15–18 progression avenue:** Ages 15–18 progress through quality, load, speed, range, or complexity—never through fatigue alone.
- **Younger than 9:** Youth-size barbells are available for athletes younger than 9. They are an equipment option, not automatic load permission; use a separate readiness-based prescription with direct qualified supervision.
- **Under-9 note coverage:** 52/52 cards meeting the generator's loaded-card criterion include the separate readiness/supervision note.

### Deterministic scheduled-prescription fit

| Measure | Derived result |
| --- | --- |
| Scheduled exercise occurrences | 900 |
| Selectable age bands | 3 (9-11, 12-14, 15-18) |
| Allocation-fit evaluations | 900 occurrences × 3 bands = 2700 |
| Evaluations fitting their station | 2700 |
| Allocation overflows | 0 |
| Concrete dose modes | attempts: 834; continuous: 540; distance: 309; duration: 619; repetitions: 398 |

The fixed program therefore produces **900 scheduled occurrences × 3 age bands with 0 overflow(s)**. This is a deterministic allocation calculation, not a claim that every athlete is ready for the listed progression or load.

## Output and capacity summary

| Phase | Sessions | Scheduled exercise occurrences | Allocated minutes | Unique cards | Methodology (occurrences) |
| --- | --- | --- | --- | --- | --- |
| Output | 60 | 120 | 1200 | 60 | Assisted — Speed/Power Application: 2; Ballistic: 64; Overspeed: 12; Plyometric: 40; Resisted — Speed/Power Application: 2 |
| Capacity | 30 | 90 | 750 | 43 | Concentric-Focused: 2; Isometric — Strength Application: 6; Resisted — Strength Application: 80; Tempo-Controlled: 2 |
| Sustained Capacity | 30 | 90 | 750 | 5 | Carry circuit: 18; Simple interval: 54; Tempo locomotion: 18 |

Output stays in the high-velocity method set. Capacity stays in strength-application methods. Sustained Capacity uses simple intervals, tempo locomotion, and carry circuits. Counts above describe scheduled occurrences, so a reused card can appear more than once.

## Eight-tenet coverage

| Tenet | Unique cards tagged | Scheduled occurrences | Sessions containing tenet | Rolling two-week windows covered |
| --- | --- | --- | --- | --- |
| Strength | 111 | 310 | 60 | 11/11 |
| Explosiveness | 66 | 132 | 60 | 11/11 |
| Speed | 91 | 182 | 60 | 11/11 |
| Agility | 49 | 98 | 37 | 11/11 |
| Flexibility and Mobility | 76 | 362 | 60 | 11/11 |
| Balance | 254 | 748 | 60 | 11/11 |
| Coordination | 194 | 540 | 60 | 11/11 |
| Body Control | 301 | 900 | 60 | 11/11 |

Weekly percentages are the percentage of the five sessions in which each tenet appears:

| Week | Strength | Explosiveness | Speed | Agility | Flexibility and Mobility | Balance | Coordination | Body Control |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 100% | 100% | 100% | 40% | 100% | 100% | 100% | 100% |
| 2 | 100% | 100% | 100% | 40% | 100% | 100% | 100% | 100% |
| 3 | 100% | 100% | 100% | 60% | 100% | 100% | 100% | 100% |
| 4 | 100% | 100% | 100% | 40% | 100% | 100% | 100% | 100% |
| 5 | 100% | 100% | 100% | 40% | 100% | 100% | 100% | 100% |
| 6 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| 7 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| 8 | 100% | 100% | 100% | 40% | 100% | 100% | 100% | 100% |
| 9 | 100% | 100% | 100% | 40% | 100% | 100% | 100% | 100% |
| 10 | 100% | 100% | 100% | 80% | 100% | 100% | 100% | 100% |
| 11 | 100% | 100% | 100% | 60% | 100% | 100% | 100% | 100% |
| 12 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |

## Derived stress summary

| Metric | Level 1 / low | Level 2 / moderate | Level 3 / high | Evidence total |
| --- | --- | --- | --- | --- |
| Impact | 20 | 35 | 5 | 800 moderate/high-impact min (0 high-impact) |
| Freshness | 0 | 60 | 0 | 1200 high-freshness min |
| Eccentric demand | 37 | 22 | 1 | 50 explicit eccentric min; 546 tempo min |
| Effective volume | 0 | 30 | 30 | 3,474 weighted min |
| Restore | — | — | — | 300 min |

Program-wide derived region load, descending: Trunk 737.2; Hip 671.1; Shoulder 437.4; Ankle 434.7; Foot 248.9; Wrist 245.1; Knee 222.2; Back 175.9; Grip 120; Chest 92.2; Calf 82; Hamstring 16.2; Forearm 10.4; Adductor 7.6; Shin 4.6; Quadriceps 2.4; Hand 2.

### Weekly stress evidence

| Week | Leading three body regions (load / days / peak) | Impact days L/M/H | Impact exposure min | High freshness / eccentric / volume days | Restore min |
| --- | --- | --- | --- | --- | --- |
| 1 | Trunk 62.6/5/14.3; Hip 60/5/13; Ankle 39.8/5/9.4 | 0/5/0 | 60 | 0/0/2 | 25 |
| 2 | Trunk 61.5/5/14; Shoulder 55.1/5/13; Hip 49/5/10.5 | 1/4/0 | 40 | 0/0/3 | 25 |
| 3 | Trunk 60.3/5/14; Hip 56.2/5/12.2; Ankle 43.2/5/10.9 | 2/3/0 | 40 | 0/0/2 | 25 |
| 4 | Trunk 61.7/5/12.8; Hip 57.7/5/12.6; Ankle 46.3/5/11.2 | 3/2/0 | 20 | 0/0/3 | 25 |
| 5 | Trunk 62.8/5/16; Hip 61.2/5/14; Ankle 39.8/5/9.3 | 0/5/0 | 104 | 0/0/2 | 25 |
| 6 | Trunk 66.5/5/15; Hip 65.9/5/15.3; Ankle 39.7/5/9.2 | 0/4/1 | 104 | 0/0/3 | 25 |
| 7 | Trunk 62.3/5/14.3; Hip 58.2/5/13; Ankle 40.7/5/9.2 | 5/0/0 | 0 | 0/0/2 | 25 |
| 8 | Trunk 63/5/14.4; Hip 61.7/5/14.4; Ankle 44.7/5/10.6 | 0/4/1 | 120 | 0/1/3 | 25 |
| 9 | Trunk 64.7/5/15; Hip 59.5/5/13; Ankle 39.5/5/8.5 | 0/2/3 | 232 | 0/0/2 | 25 |
| 10 | Shoulder 57.2/5/12.7; Trunk 56.7/5/12.7; Hip 42.8/5/9.9 | 3/2/0 | 20 | 0/0/3 | 25 |
| 11 | Trunk 52.9/5/12.1; Shoulder 50.1/5/12.8; Hip 45.3/5/9.9 | 5/0/0 | 0 | 0/0/2 | 25 |
| 12 | Trunk 62.2/5/13.6; Hip 53.6/5/12.7; Ankle 38.5/5/8.1 | 1/4/0 | 60 | 0/0/3 | 25 |

### Evidence-based validation warnings

The deterministic validator reports **8 warning(s)** across 2 warning code(s): `stress.consecutive_impact`: 1; `stress.consecutive_region`: 7. Warnings are retained as programming-review evidence and are not presented as resolved.

| Code | Session | Date | Finding | Suggested resolution |
| --- | --- | --- | --- | --- |
| stress.consecutive_region | flip-fit-w05-d2 | 2026-09-22 | flip-fit-w05-d2 repeats high Hip load after flip-fit-w05-d1 (12.2 → 14 weighted load). | Reduce allocation or load for one Hip station, substitute a lower-stress card, or rotate the Capacity emphasis. |
| stress.consecutive_region | flip-fit-w06-d4 | 2026-10-01 | flip-fit-w06-d4 repeats high Hip load after flip-fit-w06-d3 (15.3 → 13.5 weighted load). | Reduce allocation or load for one Hip station, substitute a lower-stress card, or rotate the Capacity emphasis. |
| stress.consecutive_region | flip-fit-w06-d5 | 2026-10-02 | flip-fit-w06-d5 repeats high Hip load after flip-fit-w06-d4 (13.5 → 14.2 weighted load). | Reduce allocation or load for one Hip station, substitute a lower-stress card, or rotate the Capacity emphasis. |
| stress.consecutive_region | flip-fit-w07-d2 | 2026-10-06 | flip-fit-w07-d2 repeats high Hip load after flip-fit-w07-d1 (13 → 12 weighted load). | Reduce allocation or load for one Hip station, substitute a lower-stress card, or rotate the Capacity emphasis. |
| stress.consecutive_impact | flip-fit-w09-d2 | 2026-10-20 | flip-fit-w09-d2 follows flip-fit-w09-d1 with 68 then 58 impact-exposure minutes. | Regress or replace one moderate/high-impact Output or tumbling card, or separate the exposures with a recovery day. |
| stress.consecutive_region | flip-fit-w09-d2 | 2026-10-20 | flip-fit-w09-d2 repeats high Hip load after flip-fit-w09-d1 (12.5 → 13 weighted load). | Reduce allocation or load for one Hip station, substitute a lower-stress card, or rotate the Capacity emphasis. |
| stress.consecutive_region | flip-fit-w10-d4 | 2026-10-29 | flip-fit-w10-d4 repeats high Shoulder load after flip-fit-w10-d3 (12.7 → 12.6 weighted load). | Reduce allocation or load for one Shoulder station, substitute a lower-stress card, or rotate the Capacity emphasis. |
| stress.consecutive_region | flip-fit-w10-d5 | 2026-10-30 | flip-fit-w10-d5 repeats high Shoulder load after flip-fit-w10-d4 (12.6 → 12.2 weighted load). | Reduce allocation or load for one Shoulder station, substitute a lower-stress card, or rotate the Capacity emphasis. |

## Generator-planned card reconciliation inventory

| Planned status | Count | Meaning at generation time |
| --- | --- | --- |
| reused | 152 | Seed intends a direct reuse candidate. |
| alias | 3 | Seed intends a normalized alias match candidate. |
| new | 99 | Seed intends a new-card candidate if live lookup finds no match. |
| review | 47 | Seed requires coach/manual resolution before a live mutation. |

The grouped counts total **301**, matching the 301-card generator inventory. Full planned names follow; each group is alphabetical.

### Reused — 152

- 45-degree cut and reaccelerate
- 45-degree cut rehearsal
- A-march mechanics
- A-run rhythm
- Adductor side plank
- Ankle inversion-eversion band control
- Arch body hold
- Barbell back squat
- Barbell Romanian deadlift
- Bear crawl line
- Bear crawl tempo lanes
- Bear-plank shoulder tap support
- Bent-knee calf raise
- Bent-knee soleus raise
- Bilateral band external rotation
- Broad jump
- Broad jump to stick
- Cable row
- Carry medley
- Cartwheel hand-placement line
- Cartwheel hand-placement rehearsal
- Cartwheel to finish lunge
- Chase-and-evade boundary game
- Controlled step-down
- Copenhagen plank short lever
- Cossack squat
- Countermovement vertical jump
- Crossover step-up
- Dead bug cross press
- Dead bug heel tap
- Dead bug press-down
- Drop jump to braking hold
- Drop squat stick
- External-rotation band hold
- Falling start hold
- Falling-start sprint
- Farmer carry
- Farmer carry tempo lanes
- Fast skip burst
- Finger pulses and palm lifts
- Flying sprint
- Foot and ankle control circuit
- Forearm plank body saw
- Forearm pronation-supination
- Forward jump landing rehearsal
- Forward jump to target stick
- Front support shoulder tap
- Front-foot elevated split squat
- Front-loaded squat
- Front-rack carry
- Glute bridge march
- Half-kneeling hip-flexor isometric
- Half-kneeling landmine press support
- Hamstring bridge walkout
- Hamstring slider eccentric
- Handstand line to snap-down
- Handstand snap-down pathway
- Handstand snap-down rebound
- Handstand snap-down to stick
- Hip airplane support
- Hip airplane with support
- Hollow body breathing hold
- Hollow body hold
- Hollow hang knee raise
- Hollow-to-arch roll
- Hop to stick
- Inverted row strength support
- Landing calf isometric
- Landing shape circuit
- Landing snap-down series
- Landmine press
- Lateral band walk
- Lateral bound to stick
- Lateral hop to stick
- Lateral lunge
- Lateral shuffle posture
- Lateral step-down
- Linear deceleration stick
- Low box drop to stick
- Low box step-up intervals
- Medicine-ball overhead slam
- Medicine-ball scoop toss jump
- Medicine-ball shot-put throw
- Mirror movement drill
- Nordic hamstring lower
- One-arm dumbbell row
- One-arm row strength support
- Pallof step-out hold
- Patellar tendon split-squat hold
- Pogo landing isometric
- Prone swimmer
- Prone Y-T raise
- Pull-up
- Pull-up quality set
- Push-up
- Push-up plus
- Push-up quality set
- Push-up strength support
- Rear support table hold
- Rear-foot supported split squat
- Reverse lunge
- Reverse Nordic short range
- Rhythm bound
- Rotational scoop toss
- Scapular control circuit
- Scapular pull-up
- Scapular push-up
- Scapular push-up hold
- Seated soleus raise
- Short-foot drill
- Side plank reach-through control
- Side plank short lever
- Single-leg box squat
- Single-leg calf raise hold
- Single-leg landing isometric
- Single-leg Romanian deadlift
- Single-leg Romanian deadlift reach
- Single-leg snap-down
- Skipping rhythm drill
- Sled march intervals
- Sled push
- Slider hamstring curl
- Snap-down to athletic hold
- Soleus isometric hold
- Spanish squat hold
- Split-squat eccentric lower
- Split-squat isometric
- Split-stance isometric
- Split-stance Pallof hold
- Sprint to stick
- Squat isometric against pins
- Standing cable hip-flexor lift
- Standing calf raise
- Step-down control
- Step-up
- Step-up with knee drive
- Tempo goblet squat
- Tempo rope-pull and walk
- Tempo split squat
- Tibialis raise
- Toe yoga
- Trap-bar deadlift
- Trunk control circuit
- Tuck roll to stand
- Wall acceleration march
- Wall handstand body line
- Wall handstand line drill
- Wall slide with lift-off
- Wicket sprint
- Wicket walk-run
- Wrist extension eccentric
- Wrist rocker series

### Alias — 3

- Crocodile breathing and mobility reset
- Dead hang
- Single-leg clock reach

### New — 99

- 180-degree turn mechanics
- 90-degree plant and go
- Active hang rhythm
- Ankle dribble series
- Approach jump
- Backward roll to push support
- Balance and Body Control access primer
- Ball carry to roll
- Broad jump projection drill
- Build-up sprint
- Cartwheel direction choice
- Cartwheel entry acceleration
- Cartwheel finish control
- Cartwheel over panel mat
- Cartwheel rhythm lane
- Cartwheel speed line
- Change of Direction access primer
- Choice jump
- Color-call cut choice
- Color-call movement choice
- Countermovement jump rehearsal
- Crossover cut burst
- Deceleration and Stopping access primer
- Directional roll choice
- Drop-step braking rehearsal
- Explosive bear crawl burst
- Fast hurdle cartwheel
- Fast-relaxed stride
- Forward roll exit landing
- Forward roll from lunge
- Forward roll shape series
- Forward roll to controlled stop
- Forward roll to lunge
- Half-kneeling cross-body reach
- Handstand lunge entry
- Handstand target taps
- Hurdle step to lunge
- Instep kick to target
- Jump-stick-rebound contrast
- Jumping and Takeoff access primer
- Kicking plant-foot control
- Landing and Force Absorption access primer
- Landing direction call
- Light sled acceleration
- Locomotion and Running access primer
- Low obstacle vault rehearsal
- Low vault pop-over
- Low-beam walk and freeze
- Max-Velocity Sprinting access primer
- Medicine-ball catch posture
- Mirror locomotion call
- Multi-angle stop series
- Multi-signal reaction grid
- Object Interaction access primer
- Partner mirror cut
- Partner perturbation recover
- Perception, Reaction and Adaptation access primer
- Pro-agility quality rep
- Punch jump shapes
- Quarter-turn landing series
- Quick-feet to balance freeze
- Reaction chase burst
- Reactive cadence call
- Reactive crossover start
- Reactive fly-in
- Reactive inversion entry
- Reactive landing call
- Reactive locomotion burst
- Reactive medicine-ball action
- Reactive object call
- Reactive obstacle escape
- Reactive sprint or stick
- Reactive sprint-stop
- Reactive start direction call
- Reactive stop signal
- Reactive takeoff call
- Reactive takeoff direction
- Reactive target throw
- Reactive traversal route
- Rotation, Tumbling and Inversion access primer
- Run-hurdle landing shapes
- Shuffle stop mechanics
- Shuffle to lateral stick
- Single-leg takeoff step
- Split-stance acceleration
- Split-stance start rehearsal
- Starts and Acceleration access primer
- Step-and-throw sequence
- Stride rhythm relay
- Target cartwheel
- Three-angle cut series
- Three-start quality series
- Traversal and Upper-Body Locomotion access primer
- Traversal power route
- Tuck jump quarter turn to stick
- Tumbling landing shapes
- Tumbling wrist, ankle, and body-shape preparation
- Vault hand-support shapes
- Vortex locomotor RAMP sequence

### Review — 47

- Assisted cadence run
- Athlete-choice tumbling routine
- Backward roll incline
- Backward tumbling landing prep
- Backward tumbling snap-down
- Balance shape assessment
- Cartwheel finish landing
- Cartwheel-roundoff pathway check
- Change-of-direction assessment
- Deceleration quality assessment
- First-three-step assessment
- Forward tumbling punch shape
- Forward tumbling takeoff
- Forward-backward pathway check
- Front squat reassessment set
- Handstand kick-up station
- Handstand obstacle line
- Handstand pirouette prep
- Inversion shape assessment
- Joint-control reassessment circuit
- Jump takeoff assessment
- Lache tap-swing release target
- Landing quality assessment
- Movement-function reassessment
- Object-and-tumble circuit
- Object-skill assessment
- Output reassessment choice
- Roll and inversion choice
- Roundoff entry rebound
- Roundoff hurdle rehearsal
- Roundoff line correction
- Roundoff rebound height
- Roundoff rebound rhythm
- Roundoff rebound to stick
- Roundoff run-in shapes
- Roundoff shape pathway
- Roundoff snap-down landing
- Roundoff target line
- Running rhythm assessment
- Swing-to-landing shapes
- Traversal route assessment
- Traversal tumbling circuit
- Tumbling direction circuit
- Tumbling shape reassessment
- Tumbling speed-control lane
- Tumbling takeoff circuit
- Upright sprint mechanics check

## Planned versus live reconciliation

| Layer | What this report establishes | What it does not establish |
| --- | --- | --- |
| Generator-planned | Deterministic status and complete name inventory for 301 generated cards. | No facility lookup, canonical-card ID, or database write result. |
| Live facility reconciliation | Not captured by this artifact. | Whether each candidate was actually reused, alias-matched, created, or held for review in a particular facility. |

A live result must come from the authenticated, facility-scoped reconciliation workflow. Until that workflow returns and its mutations are verified, the planned status must not be relabeled as an actual facility result.

## Deterministic facts and final-verification handoff

| Check | Recorded state in this artifact |
| --- | --- |
| Fixed-date generator validation | Valid; 1429 checks, 0 errors, 8 evidence-based warnings |
| Validation errors | None |
| Scheduled-prescription allocation | 900 occurrences × 3 age bands = 2700 evaluations; 0 overflows |
| Report regeneration command | `node scripts/generate-flip-fit-implementation-report.mjs` |
| Final report freshness outcome | Passed: `node scripts/generate-flip-fit-implementation-report.mjs --check`. |
| Flip & Fit test suite | Passed 40/40 with `npm run test:flip-fit`. |
| Canonical-card regression suite | Passed 22/22 across canonical authoring and repository tests. |
| Coach portal configuration suite | Passed 5/5, including Flip & Fit tab exposure and ordering. |
| Typecheck / focused lint / production build | Passed. The production build retained only dependency-data freshness notices and the existing large-chunk advisory. |
| Full repository lint boundary | The repository-wide lint command remains non-green with 45 errors and 20 warnings in pre-existing files outside the focused Flip & Fit change; every touched Flip & Fit file passes the focused lint command. |
| Browser / responsive verification | Passed 5/5 Playwright scenarios. Manual desktop, exercise-modal, and 390×844 checks found no horizontal overflow, Vite error overlay, or browser-reported error. |
| Live facility reconciliation | Pending an authenticated facility-scoped run; no live result claimed here. |

### Source boundary

- Program generator: `src/coach/flipFitProgram.ts`
- Deterministic report generator: `scripts/generate-flip-fit-implementation-report.mjs`
- Generated report: `docs/FLIP_FIT_IMPLEMENTATION_REPORT.md`
