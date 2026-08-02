# Canonical workout generator completion audit

Audit date: 2026-07-26

## Outcome

The canonical v1 implementation slice is complete behind
`CANONICAL_WORKOUT_GENERATOR_ENABLED`. It does not replace or mutate the legacy
generator. Production enablement still depends on applying migrations, publishing
a reviewed library release, and completing the human coach pilot described in the
rollout plan.

## Required deliverables

| # | Deliverable | Evidence |
|---:|---|---|
| 1 | Current-state audit | `CURRENT_STATE_AND_TARGET.md` |
| 2 | Target architecture | `CURRENT_STATE_AND_TARGET.md#target-architecture` |
| 3 | Canonical exercise-card schema | `schemas/exercise-card.schema.json`, migration 241 |
| 4 | Workout-intent schema | `schemas/workout-intent.schema.json`, `canonicalWorkoutContract.js` |
| 5 | Workout-output schema | `schemas/workout-output.schema.json` |
| 6 | Relationship graph specification | `IMPLEMENTATION_SPECIFICATIONS.md#family-progression-and-substitution-graph`, migration 241 |
| 7 | 1-100 scoring handbook | `IMPLEMENTATION_SPECIFICATIONS.md#1-100-scoring-handbook` |
| 8 | Migration plan and scripts | `IMPLEMENTATION_SPECIFICATIONS.md#legacy-migration-and-calibration`, migrations 240-246, `canonicalLegacyAdapter.js`, `audit-canonical-exercise-library.mjs` |
| 9 | Deterministic generator design | `IMPLEMENTATION_SPECIFICATIONS.md#deterministic-generator`, `canonicalDeterministicEngine.js` |
| 10 | AI intent contract | `IMPLEMENTATION_SPECIFICATIONS.md#ai-intent-contract`, `canonicalAiIntent.js`, `aiService.js` |
| 11 | Safety and constraint policy | `IMPLEMENTATION_SPECIFICATIONS.md#safety-and-constraint-policy` |
| 12 | Group-logistics model | `IMPLEMENTATION_SPECIFICATIONS.md#group-logistics-model` |
| 13 | Needs-engine consolidation plan | `IMPLEMENTATION_SPECIFICATIONS.md#needs-engine-consolidation` |
| 14 | Golden test matrix | `GOLDEN_TEST_MATRIX.md` |
| 15 | Automated suite | `backend/platform/__tests__/canonical*.test.js` |
| 16 | Coach review rubric | `IMPLEMENTATION_SPECIFICATIONS.md#coach-review-rubric`, `canonicalDataQuality.js` |
| 17 | Rollout/feature-flag plan | `IMPLEMENTATION_SPECIFICATIONS.md#rollout-and-feature-flags`, `backend/env.example` |
| 18 | Data-quality report | `canonicalDataQuality.js`, `canonicalLibraryAudit.js`, `LIBRARY_AUDIT.md`, `GET /api/coach/canonical/data-quality` |
| 19 | Dependency-ordered backlog | `IMPLEMENTATION_SPECIFICATIONS.md#dependency-ordered-backlog` |
| 20 | Developer documentation | All files in this directory plus the versioned JSON schemas |

## Executable evidence

- Both deterministic and AI-assisted routes load the same published canonical
  release and invoke the same deterministic generator.
- The AI layer uses schema-constrained structured output and is prohibited from
  returning exercise IDs or prescriptions. Ambiguity and contradictions fail
  closed; service failure falls back to structured deterministic input.
- Publication gates exclude draft, incomplete, and video-incomplete cards.
- Hard filters cover explicit avoids, movement/body-region limits, equipment
  availability and quantity, environment/space, age/training age, cohort
  scaling, difficulty/risk, impact, modifier compatibility, and coach capacity.
- Phase planning, seeded selection, family diversity, contextual delivery
  profiles, dose, cohort challenge, station logistics, duration reconciliation,
  validation, and bounded impact-dose repair are deterministic and traceable.
- Every saved result carries schema, generator, library, rule, seed, intent,
  validation, diagnostics, repair, and quality versions/evidence.
- The evaluator returns all 38 required categories as 1-100 or explicit
  not-applicable values and enforces the hard-constraint ceiling.
- Coach review, athlete-feedback storage, privacy-conscious AI audit, and
  facility/library quality reporting are defined in migration 242 and the
  telemetry module.
- The coach UI exposes structured and AI-assisted input plus coach/athlete
  result views, assumptions, rationale, validation, and diagnostics.
- Canonical card governance provides optimistic-concurrency drafts, immutable
  revisions, version-bound two-person review, exact-match media verification,
  lifecycle publication gates, and reviewed relationship edges. See
  `CARD_GOVERNANCE.md` and migration 243.
- Canonical cards now carry structured anatomy, plane, laterality, external-load,
  impact-contact, and fatigue/recovery profiles. These fields feed publication
  readiness, workout prescriptions, impact budgets, coverage scoring, and the
  data-quality report. See migration 244.
- Coaches can request only reviewed graph substitutions; every swap is
  re-prescribed, revalidated against the complete workout, rescored, traced, and
  persisted as a new immutable generated-workout record.
- AI-assisted card authoring is schema constrained and quarantined: confidence
  is capped, production-authority fields are rejected, prompts are not retained,
  and drafts remain unsaved until a human explicitly saves and reviews them.
- The calibration workspace supports reviewed 20/40/60/80 score anchors with
  independent approval and supersession history. Exercise complexity (stored
  under the legacy `technicalComplexity` field name) and physical difficulty
  are calibrated independently; overall difficulty is derived as their maximum
  and cannot receive a new independent calibration.
  Migrations 245 and 304 store the audit trail without mutating published
  cards.
- Deterministic selection projects cumulative grip, local-muscle, spinal,
  eccentric, impact, and technical-sensitivity costs before accepting a
  candidate. Final validation and reviewed swaps independently enforce the same
  budgets. See `CALIBRATION_AND_FATIGUE.md`.
- Migration 246 and the canonical library audit produce and persist a named
  automated test packet for every migrated exercise. The measured baseline is
  1,676/1,676 legacy sources mapped into 1,331 active canonical definitions, all
  honestly quarantined and none published. See `LIBRARY_AUDIT.md`.
- Generated workouts include distinct coach and athlete projections. The coach
  projection retains logistics, budgets, quality gates, substitutions, and
  coaching detail; the athlete projection contains concise execution and stop
  guidance without internal diagnostics.
- Migration 248 and `canonicalReferenceCard.js` extend cards with sequencing,
  interference, effective and weekly dose, prerequisites, progression criteria,
  complete time models, scaling, measurement, coach decision support, member
  accessibility and pain guidance, and support/change-impact operations. See
  `PRODUCTION_REFERENCE_CARD.md`.

## Verification

On 2026-07-26:

- 832 backend Node tests ran serially: 812 passed, 20 integration-environment tests
  skipped intentionally, and none failed. The focused platform suite separately
  passed all 615 tests. This includes all 25 named golden
  scenarios and the governance, graph-swap, AI-quarantine, anatomy/load,
  difficulty-model, and telemetry suites,
- a 7,000-card deterministic generation test completed in under the five-second
  release ceiling,
- the complete migration chain passed on disposable PostgreSQL,
- all 1,676 legacy exercise sources were audited through their 1,331 active
  canonical definitions, and every active definition remains quarantined
  pending human review,
- the production reference card passed a real repository save/load round trip
  while its missing-media publication gate remained active,
- 345 redundant definitions were consolidated into canonical identities while
  preserving 1,803 canonical variants, 1,934 delivery profiles, and all legacy
  source mappings; direct identity collisions are zero. All score-85-or-higher
  candidate pairs now have deterministic identity decisions and no unresolved
  pair scores 85 or higher. One score-84 source pair remains honestly
  quarantined in `needs_human_review`.
- Focused ESLint passed for the canonical backend, route, and coach UI files.
- `npm run build` completed successfully.
- The canonical release-readiness command correctly exited blocked: zero
  definitions are published, all seven phase pools have zero published depth,
  zero graph edges or calibration anchors are approved, and no real coach-pilot
  review has been recorded. Those are rollout gates, not migration failures.
- The complete staged migration sequence through migration 368 and every add-on
  was applied successfully in disposable PostgreSQL 15. Migration 360 was
  applied to a clean verified migration-359 clone.
  Migrations 304 and 305 were also applied through the normal runner and
  directly rerun; the final migration-305 rerun performed zero inserts and zero
  updates. Migration 306 was applied in both the fresh-chain rehearsal and the
  working audit database, then directly rerun idempotently in the latter. An
  isolated clone with a synthetic human-reviewed duplicate record proved that
  migration 306 aborts before reassignment or archival instead of overriding
  review history.
- Migration 307 was applied through the normal runner on both the fresh-chain
  rehearsal and working review databases, then directly rerun twice
  idempotently in the rehearsal. An isolated clone with a synthetic
  human-reviewed Cossack record proved that it aborts before any reassignment or
  archival. The temporary clone was removed after the guard test.
- Migration 308 was applied through the normal runner in the working review
  database and to the fresh-chain rehearsal, then directly rerun twice
  idempotently. An isolated clone with a synthetic approved calibration proved
  that it aborts before reassigning or archiving adductor rock-back records. The
  temporary clone was removed after the guard test.
- Migration 309 was applied through the normal runner in the working review
  database and directly to the fresh-chain rehearsal, then rerun twice
  idempotently. A disposable clone with a synthetic published target proved
  that it aborts with one protected record before splitting, reassignment, or
  archival. The clone was removed after the guard test. The final records
  preserve Dead Hang, Active Hang, and Scapular Pull-Up as distinct actions,
  keep the historical compound source quarantined, and retain all six source
  mappings.
- Migration 310 was applied through the normal runner in both disposable
  databases, recorded with the final source checksum, and directly rerun
  idempotently. A disposable clone with a synthetic published hanging-knee-raise
  target proved that it aborts with one protected record before reassignment or
  archival. The clone was removed. The final records retain bent-knee,
  straight-leg, and eccentric-lower hanging leg raises as variants, archive the
  exact tuck-knee duplicate, preserve all four source mappings, and create no
  approval.
- Migration 311 was applied through the normal runner in both disposable
  databases, recorded with checksum `517857333`, and directly rerun
  idempotently. A disposable clone with a synthetic published L-Sit target
  proved that it aborts with one protected record before consolidation,
  archival, or creation of Hanging L-Sit; the unchanged clone was verified and
  removed. The final records consolidate Tuck L-Sit Hold into a support
  variant, retain five support L-Sit variants, add a distinct three-variant
  Hanging L-Sit definition, preserve all source mappings, and create no
  approval.
- Migration 312 was applied through the normal runner in both disposable
  databases, recorded with checksum `645394912`, and directly rerun
  idempotently. A disposable clone with one synthetic published compression
  card proved that it aborts with one protected record before changing the
  identity, variants, profiles, or relationships; the sentinel row remained
  unchanged and the clone was removed. The final records broaden the historical
  Straddle Compression Lift source into a four-variant Seated Compression Lift
  family while retaining its stable slug, add separate three-variant V-Sit and
  one-variant Manna Hold definitions, and create no approval. The corresponding
  FIG/USAG skill-library cards and their proficiency levels remain untouched.
- Migrations 313 and 314 were applied through the normal runner in both
  disposable databases, recorded with checksums `2692772273` and `1481122815`,
  and directly rerun idempotently. A disposable clone with a synthetic
  published Active Hang sentinel proved that both migrations abort before
  changing a protected card; the unchanged sentinel was verified and the clone
  removed. Dead Hang, Active Hang, and Scapular Pull-Up now each have six
  scored variants and complete strict athlete, coach, accessibility, support,
  programming, dosage, measurement, logistics, and stop-rule contracts. Their
  only publication-readiness subissues are human approval of an exact-match
  video and completion of media review. No approval was created, and no
  exercise-card skill level was assigned.
- Migrations 315 and 316 were applied through the normal runner and recorded
  with checksums `2333037463` and `823231556`, then directly rerun
  idempotently. Two isolated clones with synthetic published sentinels proved
  that identity consolidation and family completion each abort with one
  protected record before changing human-controlled state; both clones were
  removed. The migrations archive the exact `Depth Jump to Box Jump` and `Box
  Jump with Altitude Landing` duplicates while preserving the reversed
  depth-first and box-first sequences as separate definitions. Each survivor
  has baseline and hands-on-hips variants, two contextual profiles per variant,
  full athlete/coach/support contracts, candidate-only evidence, alternates,
  graph edges, and media. No approval or exercise-card skill level was created.
- Migrations 317 and 318 were applied through the normal runner and recorded
  with checksums `1466800268` and `3525917830`, then rerun idempotently.
  Transaction-only published-card sentinels proved that identity consolidation
  and family completion each abort with one protected record before changing
  human-controlled state. Migration 317 archives the three duplicate tall- and
  half-kneeling chest-pass definitions while preserving all five source
  mappings, aliases, variants, profiles, candidate media, and resolution
  provenance. Migration 318 adds four exact stance-and-return variants, eight
  contextual profiles, 16 evidence sections, five current healthy candidate
  links, 12 alternate assessments, six review-only graph edges, and 12
  review-only score proposals. The two generic sources remain nonselectable
  because stance and return behavior are not recoverable. The strict audit
  leaves only media, graph, calibration, and publication approval blocked; no
  approval or exercise-card proficiency level was created.
- Migrations 319, 320, and 321 were applied to disposable PostgreSQL through the
  normal single-file runner and recorded with checksums `881499997`,
  `566213042`, and `3794906241`. Direct reruns were idempotent. Transaction-only
  published-card sentinels proved that consolidation, family completion, and
  equipment-taxonomy correction each abort with one protected record before
  changing human-controlled state. The migrations consolidate the duplicate
  wall-named rotational throw, preserve both source mappings, add exact
  throw-and-retrieve and rebound-and-catch variants with four contextual
  profiles, and use controlled equipment keys. The strict audit leaves only
  media, graph, calibration, and publication approval blocked; no approval or
  exercise-card proficiency level was created.
- Operational incident: the first two single-file invocations for migrations
  319 and 320 reached the external Render database `vortex_postgres` because
  `run-migration.js` loaded `.env.local` and preferred its `DATABASE_URL` over
  the caller-supplied `DB_URL`. Both migrations succeeded there. They are
  fail-closed and created only review/quarantine state, but the external
  mutation was unintended. No rollback was attempted because that would be a
  separate destructive production decision. `migrationConnection.js` now
  snapshots and prioritizes explicit caller connection variables before dotenv,
  and regression tests cover the precedence. Migration 321 and later family
  validation ran only against disposable PostgreSQL.
- Migrations 322 and 323 were applied through the normal single-file runner and
  recorded with checksums `1204756462` and `3062041882`, then directly rerun
  idempotently inside a transaction. Transaction-only published-card sentinels
  proved that identity consolidation and family completion each abort with one
  protected record before changing human-controlled state. The migrations
  consolidate the duplicate shuffle rotational throw, preserve both source
  mappings, add exact throw-and-retrieve and rebound-and-catch variants with
  four contextual profiles, and keep planned/reactive cueing explicit. The
  strict audit leaves only media, graph, calibration, and publication approval
  blocked; no approval or exercise-card proficiency level was created.
- Migrations 324 and 325 were applied through the normal single-file runner and
  recorded with checksums `4262035219` and `555302137`, then rerun
  idempotently. Isolated published-card sentinels proved that consolidation and
  family completion each abort with one protected record before changing
  human-controlled state. The migrations consolidate the duplicate single-leg
  landing box-jump definition, preserve bilateral and unilateral takeoff as
  exact variants, add four contextual profiles, four review-only graph edges,
  six review-only calibration proposals, candidate evidence, alternates, and
  media, and create no approval or exercise-card skill level.
- Migrations 326 and 327 were applied through the normal single-file runner and
  recorded with checksums `36393550` and `487017811`, then rerun idempotently.
  Isolated published-card sentinels proved that consolidation and family
  completion each abort before changing human-controlled state. The migrations
  consolidate the duplicate lateral line-hop-to-stick identity, retain
  low-amplitude-control and distance-output as exact variants, leave continuous
  rebound line hops separate, add four contextual profiles, four review-only
  graph edges, six review-only calibration proposals, candidate evidence,
  alternates, and media, and create no approval or exercise-card skill level.
- Migrations 328 and 329 were applied through the normal single-file runner and
  recorded with checksums `2795990454` and `2140352562`, then each directly
  rerun twice without changing row counts. Isolated disposable published-card
  sentinels proved that identity consolidation and family completion each abort
  with one protected record before changing human-controlled state; the guard
  databases were removed after verification. The migrations consolidate four
  implement- or breathing-labeled dead-bug pullover definitions, retain five
  exact implement/leg-action variants, add ten contextual profiles, six
  review-only graph edges, 15 review-only calibration proposals, candidate
  evidence, alternates, and media, and create no approval or exercise-card
  skill level.
- Migrations 330 and 331 were applied through the normal runner and recorded
  with checksums `631414807` and `2321430437`, then each directly rerun twice
  without changing row counts. Isolated disposable published-card sentinels
  proved that identity consolidation and family completion each abort with one
  protected record before changing human-controlled state; the two guard
  databases were removed after verification. Migration 330 consolidates six
  implement- or tempo-labeled bilateral Romanian-deadlift definitions into the
  stable `Romanian Deadlift` identity while preserving source mappings,
  aliases, variants, media, and resolution provenance. Migration 331 adds eight
  exact implement/tempo variants, 16 contextual profiles, eight review-only
  graph edges, 24 review-only calibration proposals, 16 candidate evidence
  sections, five candidate videos, and 12 alternate assessments. Exercise
  difficulty is complexity plus physical difficulty with overall derived as
  their maximum; no exercise skill level or human approval is created.
- Migrations 332 and 333 were applied through the normal runner and recorded
  with checksums `3780536681` and `3961694955`, then each directly rerun twice
  without changing row counts. Isolated disposable published-card sentinels
  proved that identity consolidation and family completion each abort with one
  protected record before changing human-controlled state; the two guard
  databases were removed after verification. Migration 332 consolidates the
  dumbbell- and sandbag-labeled cards into the stable
  `Front-Foot-Elevated Split Squat` identity. Migration 333 adds six exact
  support/load variants, 12 contextual profiles, ten review-only graph edges,
  18 review-only calibration proposals, 16 candidate evidence sections, five
  candidate videos, and 12 alternate assessments. Whole-front-foot versus
  rear-foot or heel-only elevation and stationary versus stepping or jumping
  contacts remain explicit identity boundaries. No exercise skill level or
  human approval is created.
- Migrations 334 and 335 consolidate three implement-labeled half-kneeling
  single-arm strict presses into one stable identity and complete six exact
  implement/pressing-side variants. Migration 336 records two deterministic
  identity boundaries for forward versus backward overhead medicine-ball
  projection and for the reversed box/depth contact order. Migration 337
  completes forward and backward overhead projection cards with four exact
  direction/preload variants, candidate-only research and media, and no
  approval.
- Migration 338 records ten additional movement boundaries, including
  two- versus three-point start bases, forward versus lateral crawling,
  bear- versus tall-plank support, box versus floor landing targets, inversion
  versus eversion force, hinge-plus-row versus hinge-only, single versus triple
  hops, and strict versus leg-driven landmine pressing.
- Migration 339 consolidates 148 active synonym-, implement-, load-, assistance-,
  tempo-, cue-, and environment-labeled definitions. Every source mapping and
  alias is retained; legacy variants are archived, nonselectable, and
  identity-quarantined. Existing candidate research is preserved. The migration
  refuses protected review, approval, publication, media, graph, calibration,
  and score records and creates no human decision.
- Migration 340 records 70 deterministic movement boundaries and quarantines
  three under-specified legacy pairs for human identity review: Dead Bug Wall
  Press versus Medicine Ball Dead Bug Press, Lateral Hop to Stick versus
  Single-Leg Lateral Hop to Stick, and Med Ball Countermovement Rotational
  Throw versus Medicine Ball Countermovement Throw. No unresolved score-90
  pair or exact collision remains.
- Migration 341 resolves those three quarantines from exact movement contracts:
  fixed-wall dead-bug press and medicine-ball dead-bug press remain distinct;
  the generic lateral card becomes an explicit bilateral jump-and-stick
  identity distinct from the same-leg unilateral card; and the rotational
  medicine-ball throw remains distinct from forward chest projection.
  Low-amplitude bilateral lateral hop is consolidated as a variant.
- Migration 342 completes the five resulting boundary cards with two exact
  variants and profiles each, 16 candidate evidence sections, five current
  healthy oEmbed metadata candidates, six alternate assessments, review-only
  graph edges, and review-only score proposals. Migration 343 consolidates the
  countermovement chest-pass source into the broader Medicine Ball Chest Pass
  identity and records the tuck-jump/lateral-stick boundary. Migration 344
  repairs the candidate relationship dimensions to the controlled
  `range`/`complexity`/`load` taxonomy and strips obsolete skill-level metadata
  keys library-wide. Fresh invariant queries find zero exercise-card
  skill-level values or JSON keys and retain all 1,112 dedicated skill-library
  level assignments. None creates human, media, graph, calibration, or
  publication approval.

- Migrations 345 and 346 consolidate eleven Pallof synonyms or controlled
  variants into the stable Pallof Press and Pallof Step-Out identities, then
  complete both cards with 12 exact variants and profiles, 32 evidence
  sections, ten current oEmbed metadata candidates, 20 alternate assessments,
  14 review-only graph proposals, and 24 review-only calibration proposals.
  No candidate media or human decision is treated as approved.
- Migration 347 removes the enumerated skill/proficiency fields from every
  exercise-card surface while leaving the skill library intact. Migration 350
  closes broader historical spellings recursively, adds database check
  constraints to every exercise JSON surface, and leaves non-neutral protected
  classifications fail-closed. The clean replay has zero exercise, scaling, or
  safety-profile level values, zero matching keys at any exercise-card JSON
  depth, zero difficulty-formula mismatches, and 1,112 retained skill-library
  level assignments. Canonical authoring and research validation use the same
  semantic prohibition.
- Migrations 348 and 349 consolidate `Stir-the-Pot Plank` into the stable
  `Stir-the-Pot` identity and complete the survivor with three exact
  support-base/circle-size variants, six contextual profiles, 16 evidence
  sections, four candidate media records, ten alternate assessments, five
  review-only graph proposals, and nine review-only calibration proposals.
  Candidate media remain unviewed/unapproved and no human-controlled state is
  inferred.
- Migrations 351 and 352 consolidate three direct synonym collisions:
  `Quadruped Thread-the-Needle Rotation` into
  `Quadruped Thread-the-Needle`, `Single-Leg Tripod Balance` into
  `Single-Leg Tripod Balance Hold`, and `Split Squat Iso Hold` into
  `Split Squat Isometric Hold`. The three survivors contain eight exact
  selectable variants, 16 contextual profiles, 48 section-evidence records,
  12 candidate YouTube links, 23 alternate assessments, 13 review-only graph
  proposals, and 24 review-only calibration proposals. Support base, sensory
  input, heel-sit position, depth, load, and duration remain variant or
  delivery dimensions. No exercise skill/proficiency level or human approval
  is created. The normal runner recorded checksums `167629815` and
  `3035058632`; direct reruns were idempotent. After the persisted audit, all
  three packets have exactly four intended blockers: media review, graph
  approval, independent calibration, and publication approval.
- Migrations 353 and 354 consolidate nine redundant definitions into four
  stable identities: `Snap-Down to Stick`, `Mirror Shuffle`,
  `Sprint-to-Stick Deceleration`, and `Single-Leg Pogo`. The completion
  migration adds eight exact selectable variants, 16 contextual profiles, 64
  section-evidence records, 16 candidate YouTube records, 45 persisted
  alternate assessments, 12 review-only graph proposals, and 24 review-only
  calibration proposals. The four source research packets contain 46 alternate
  assessments because `Single-Leg Pogo Hold-to-Hop` is also recorded as an
  explicit distinct-identity boundary. Candidate videos have public oEmbed
  metadata only; playback, full-video exact match, captions, cue quality,
  accessibility, and human approval remain unresolved. No exercise
  skill/proficiency field or approval is created.
- The normal runner recorded migrations 353 and 354 with checksums `2791168556`
  and `2475934959` on a fresh migration-352 clone. A second runner invocation
  skipped both as already applied. The persisted audit reproduced 1,354 active
  definitions, 322 archived definitions, 1,785 variants, 1,898 delivery
  profiles, 1,676 source mappings, 419 identity resolutions, 153 graph edges,
  and 228 review-only calibrations. Each of the four completed packets has
  exactly four intended blockers: media, graph, calibration, and publication.
  A separate disposable clone with a pre-existing `human_review` distinct
  decision for Single-Leg Pogo versus Hold-to-Hop retained its source and
  rationale; migration 353 inserted no deterministic replacement.
- Migration 355 records ten additional score-84 candidates as distinct
  movement contracts without modifying exercise cards or creating approval.
  The normal runner recorded checksum `2413835711`; a second invocation skipped
  the migration as already applied. The resulting audit reports 429 identity
  resolutions, 843 unresolved score-72-or-higher pairs, 201 unresolved
  score-80-or-higher pairs, and zero exact or score-85-or-higher collisions.
  All ten new rows are quarantined and have no reviewer. A separate disposable
  fixture preserved an existing `human_review` source, rationale, and evidence
  for the 180-degree-versus-90-degree pair and inserted deterministic rows only
  for the other nine pairs.
- Migration 356 archives twelve researched duplicate definitions under the
  stable `Drop Jump`, `Depth Jump`, and `Falling Start Sprint` identities and
  records five adjacent movement boundaries. The normal runner recorded
  checksum `1852495431`; runner and direct SQL reruns were idempotent. The
  persisted audit reports 1,342 active definitions, 334 archived definitions,
  446 identity resolutions, 928 raw similarity pairs, 828 unresolved
  score-72-or-higher pairs, 195 unresolved score-80-or-higher pairs, and zero
  exact or score-85-or-higher collisions. All 1,676 source mappings, 1,785
  variants, and 1,898 profiles remain present. A synthetic disposable
  `human_review` decision made the migration fail before changing any row.
- Migration 357 records five additional mechanics-based distinct decisions
  and one honest `needs_human_review` quarantine for the under-specified
  Single-Leg Line Hop and Stick source. It creates no reviewer or approval. The
  normal runner recorded checksum `1161327212`; runner and direct SQL reruns
  were idempotent. The persisted audit reports 452 identity resolutions, 823
  unresolved score-72-or-higher pairs, 190 unresolved score-80-or-higher pairs,
  105 adjudicated distinct similarity pairs, one explicit unreviewed identity
  quarantine, and zero exact or score-85-or-higher collisions.
- Migration 358 consolidates the angle-labelled Reactive Hop-to-Cut and the
  implement-labelled Seated Overhead Press source definitions. The normal
  runner recorded checksum `295775030`; direct SQL rerun was idempotent. The
  migrated state has 1,340 active definitions, 336 archived definitions, and
  preserves all 1,676 source mappings, 1,785 variants, and 1,898 profiles.
  Both survivors retain aliases and exact variant dimensions, while the
  under-specified legacy baseline variants remain archived and nonselectable.
  A disposable `human_review` distinct decision caused the migration to abort
  before changing any of the four definitions.
- Migration 359 records the marked-approach Reactive 45-Degree Cut and the
  discrete-hop Reactive Hop-to-Cut as distinct ordered-contact identities. The
  normal runner recorded checksum `2712597092`; direct SQL rerun was
  idempotent. The resulting audit reports 455 identity resolutions, 926 raw
  similarity pairs, 821 unresolved score-72-or-higher pairs, 188 unresolved
  score-80-or-higher pairs, one explicit unreviewed identity quarantine, and
  zero exact or score-85-or-higher collisions.
- Migration 360 completes the consolidated Reactive Hop-to-Cut and Seated
  Overhead Press survivors with six exact selectable variants, 12 contextual
  profiles, 32 candidate evidence sections, eight retained oEmbed-healthy
  media candidates, 20 alternate assessments, eight controlled review-only
  graph proposals, and 18 review-only calibration proposals. The normal runner
  recorded checksum `1751488238`; a direct SQL rerun was idempotent. A
  synthetic review timestamp in a separate disposable clone caused the
  migration to fail before changing either card. The persisted audit now has
  39 structurally complete candidates and 1,301 incomplete candidates. Each
  completed survivor has exactly four honest blockers: media, graph,
  calibration, and publication. The library has 1,791 variants, 1,910
  profiles, 161 review-only graph edges, 246 review-only calibrations, no
  approvals, and no published definitions. A recursive key-aware audit found
  zero exercise-level or proficiency-classification metadata keys while all
  1,112 skill-library level assignments remain intact.
- Migration 361 consolidates five Hip Thrust sources whose differences are
  implement, load handling, resistance profile, or laterality into the stable
  `distance-jump-hip-thrust` survivor, canonically named `Hip Thrust`. It keeps
  floor-supported Glute Bridge distinct and creates deterministic
  `needs_human_review` records for Feet-Elevated Hip Thrust and the mixed
  bench-or-floor eccentric source because their upper-body support geometry is
  unresolved. All source mappings, aliases, variants, evidence, and candidate
  media remain traceable. The normal runner recorded checksum `1327784462`,
  skipped the migration on a second invocation, and the direct rerun was
  idempotent. A synthetic
  `human_review` distinct decision caused the migration to abort before
  changing either source.
- Migration 362 completes the Hip Thrust survivor with eight exact selectable
  variants, 16 contextual profiles, 16 candidate evidence sections, five
  oEmbed-healthy media candidates, 14 alternate assessments, 12 review-only
  graph proposals, and 24 review-only calibration proposals. The normal runner
  recorded checksum `652761332`, skipped the migration on a second invocation,
  and the direct rerun was idempotent. A separate clone with a synthetic review
  timestamp caused completion to abort before changing the card. The persisted
  audit reports 40 structurally complete candidates and 1,295 incomplete
  candidates. Hip Thrust passes every
  structural generation, anatomy, load/fatigue, logistics, athlete-support,
  coach-support, and provenance check. Its only failures are the intended
  media, graph, calibration, and publication human gates.
- The migration-362 disposable state has 1,335 active and 341 archived
  definitions, 1,799 variants, 1,926 profiles, 462 identity resolutions, 173
  review-only graph edges, 270 review-only calibrations, all 1,676 source
  mappings, zero published definitions, and zero direct identity collisions.
  The conservative queue contains 920 raw and 815 unresolved
  score-72-or-higher pairs, including 186 score-80-or-higher pairs and none at
  score 85 or higher. Recursive database checks find zero level-classification
  keys on definitions, variants, or profiles, zero legacy exercise level
  values, and all 1,112 dedicated skill-library assignments intact.
- Migration 363 consolidates `Partner Tennis Ball Drop Sprint` into the stable
  `ball-drop-reaction-sprint` identity and records six distinct ordered-task
  boundaries across cone completion, required-hop, second-cue, catch-to-cut,
  and cue-selected-gate executions. All source mappings, aliases, candidate
  media, evidence, variants, and profiles remain traceable. The normal runner
  recorded checksum `366911576`; direct SQL application and rerun were
  idempotent. A protected review-state clone failed closed before source
  movement or archival.
- Migration 364 records `Reaction Ball Drop Catch to Cut` and `Reaction Ball
  Drop to Hop and Go` as distinct because capture-then-cut and
  hop-then-acceleration have different ordered contacts, terminal actions,
  impact, and coaching contracts. The normal runner recorded checksum
  `923720790`; direct SQL application and rerun were idempotent.
- Migration 365 completes `Partner Ball-Drop Chase and Catch` with two exact
  implement variants, four contextual delivery profiles, 16 evidence sections,
  five metadata/oEmbed-healthy candidate videos, 12 alternate assessments,
  four review-only graph edges, and six review-only difficulty calibrations.
  The normal runner recorded checksum `1368659813`; direct SQL application and
  rerun were idempotent. A protected review timestamp caused the migration to
  fail before changing the card. The exercise carries complexity and physical-
  difficulty scores only; overall is their maximum and no exercise proficiency
  level is introduced. Full-video exact-match, caption, accessibility, graph,
  score, and publication review remain quarantined.
- The migration-365 disposable state has 1,334 active and 342 archived
  definitions, 1,801 variants, 1,930 profiles, 470 identity resolutions, 177
  review-only graph edges, 276 review-only calibrations, all 1,676 source
  mappings, zero published definitions, and zero direct identity collisions.
  The persisted audit reports 41 structurally complete candidates and 1,293
  incomplete candidates. The conservative queue contains 919 raw and 807
  unresolved score-72-or-higher pairs, including 185 score-80-or-higher pairs
  and none at score 85 or higher. Recursive database checks find zero exercise
  level assignments while all 1,112 dedicated skill-library assignments remain
  intact.
- Migrations 366 and 368 consolidate the mixed-projection, generic, and
  height-emphasis Alternating Bounds definitions into the stable
  `alternate-leg-bound-for-distance` survivor. Migration 367 completes that
  survivor as `Alternating Bounds` with traditional and sprint-oriented exact
  variants, four contextual profiles, 16 evidence sections, five
  oEmbed-healthy candidate videos, 12 alternate assessments, two review-only
  graph proposals, and six review-only difficulty calibrations. Eight inherited
  lateral-, scissor-jump-, or same-leg-bound links remain traceable mismatches.
  Exercise difficulty contains complexity and physical difficulty only, with
  overall equal to their maximum; the exercise carries no skill-library level.
- The normal runner recorded migrations 366–368 with checksums `623752536`,
  `1694429056`, and `3242120071`; a second invocation skipped all three.
  Direct SQL reruns were idempotent. Separate disposable clones with protected
  review timestamps caused migrations 367 and 368 to abort before changing
  card content or identity state.
- The migration-368 disposable state has 1,331 active and 345 archived
  definitions, 1,803 variants, 1,934 delivery profiles, 473 identity
  resolutions, 179 review-only graph edges, 282 review-only calibrations, all
  1,676 source mappings, zero published definitions, and zero direct identity
  collisions. The persisted audit reports 42 structurally complete candidates
  and 1,289 incomplete candidates. The conservative queue contains 913 raw and
  807 unresolved score-72-or-higher pairs, including 185 score-80-or-higher
  pairs and none at score 85 or higher. Database checks find zero exercise
  level values or prohibited proficiency keys and all 1,112 dedicated
  skill-library level assignments intact.
- Migration 369 consolidates six load/tempo-specific stationary Split Squat
  definitions into the stable `split-squat` survivor and consolidates
  `landmine-handle-grip-split-squat` into `landmine-split-squat`. It records
  nine direct support, stance, contraction, or ordered-action boundaries as
  distinct and leaves the broader landmine card in `needs_human_review`
  because its source permits both a stationary split squat and a stepping
  reverse lunge. No human decision is inferred.
- Migration 370 completes `split-squat` and `bulgarian-split-squat`, now
  canonically named `Rear-Foot-Elevated Split Squat`, with 14 exact variants,
  28 contextual delivery profiles, 32 evidence sections, ten current
  oEmbed-metadata-only media candidates, 24 alternate assessments, 12
  review-only relationship proposals, 42 review-only calibration proposals,
  and two quarantined automated card-test packets. Floor rear-forefoot support
  and rear-foot elevation remain separate stable identities. Every variant
  stores exercise complexity and physical difficulty only; overall difficulty
  is their maximum. No exercise proficiency or skill-library level is stored.
- The normal runner recorded migrations 369 and 370 with checksums
  `3926893406` and `247855041`; a second invocation skipped both. Direct SQL
  reruns were idempotent. Separate disposable clones proved that migration 369
  aborts before consolidating a reviewed source and migration 370 aborts
  before overwriting a reviewed survivor. The protected card versions,
  statuses, provenance, and identity state remained unchanged.
- The migration-370 disposable state has 1,324 active and 352 archived
  definitions, 1,817 variants, 1,962 delivery profiles, 490 identity
  resolutions, 191 review-only graph edges, 324 review-only calibrations, all
  1,676 source mappings, zero published definitions, and zero direct identity
  collisions. The persisted audit reports 44 structurally complete candidates
  and 1,280 incomplete candidates. The conservative queue contains 906 raw and
  787 unresolved score-72-or-higher pairs, including 176
  score-80-or-higher pairs and none at score 85 or higher. Recursive database
  checks find zero exercise level values and zero prohibited skill/proficiency
  keys across definition, variant, delivery-profile, legacy-source, score, and
  alternate JSON while all 1,112 dedicated skill-library level assignments
  remain intact.
- Both completed Split Squat cards pass all automated structural, taxonomy,
  anatomy, difficulty, load, fatigue, constraint, delivery, dosage,
  instruction, user-support, coach-support, operations, and graph-integrity
  checks. They remain quarantined only for real full-video exact-match review,
  approved graph coverage, independent score calibration, and publication
  approval. The production release gate remains correctly blocked at zero
  published definitions, zero approved graph edges, zero approved
  calibrations, and zero completed coach pilots.
- Migration 371 records 25 score-83 mechanics-based distinct decisions and
  three unreviewed ambiguity quarantines. Migration 372 consolidates ten
  duplicate or controlled-variant definitions while preserving source
  mappings, aliases, candidate evidence, media, alternate assessments, and
  archived legacy execution. Separate disposable sentinels proved that
  migration 371 preserves an existing human decision and migration 372 aborts
  before changing a published source.
- Migration 373 completes Hamstring Slider Curl with six exact variants, 12
  contextual profiles, 16 evidence sections, five oEmbed-healthy candidate
  videos, 11 alternate assessments, ten review-only relationship proposals,
  18 review-only calibration proposals, and one quarantined automated packet.
  The six variants use complexity/physical-difficulty pairs of `28/32`,
  `34/44`, `38/48`, `44/52`, `50/62`, and `52/66`; overall is their maximum.
  Every load and fatigue score is an integer from 1 to 100, while the
  non-jumping landing-contact count correctly remains zero. A disposable
  published-card sentinel proved that the migration aborts before overwriting
  human-controlled state.
- Migration 374 removes 251 neutral skill/proficiency audit keys from exercise
  identity evidence without changing any identity decision, rationale,
  provenance, reviewer state, or timestamp. It adds a database constraint for
  that surface. A synthetic non-neutral `ADVANCED` assignment made the
  migration abort and left the record unchanged. The final recursive audit
  checks 38 exercise JSON columns and three scalar columns: all report zero
  level classifications. All 1,112 dedicated skill-library level assignments
  remain intact.
- Migration 375 records 31 score-82 mechanics-based distinct decisions and one
  unreviewed ambiguity quarantine. Migration 376 consolidates 19 exact
  implement, support, lever, terminal-landing, contraction, distance, target,
  load, or contextual-delivery variants. Every source mapping, alias, candidate
  evidence record, candidate media record, and archived legacy variant remains
  traceable. No reviewer or approval state is synthesized.
- Disposable negative-path tests proved migration 375 aborts and rolls back all
  decisions when an endpoint is archived without a matching historical
  resolution. Migration 376 aborts before changing any source when a synthetic
  protected media state is present. A direct migration run, a production-order
  clean bootstrap, and a second normal initializer pass all completed; the
  second pass skipped both migrations.
- The normal runner recorded migrations 371–376 with checksums `3525352483`,
  `2196858359`, `3019395498`, `1957102287`, `1133059338`, and `4145321007`.
  The clean migration-376 disposable state has 1,295 active and 381 archived
  definitions, 1,823 variants, 1,974 delivery profiles, 580 identity decisions,
  201 unapproved relationship proposals, 342 unapproved calibrations, 5,061
  unapproved media candidates, all 1,676 source mappings, zero published
  definitions, and zero direct identity collisions.
- The migration-376 canonical audit reports 865 raw and 693 unresolved
  score-72-or-higher pairs, 91 unresolved score-80-or-higher pairs, five
  unresolved score-82-or-higher pairs, four unresolved score-83-or-higher
  pairs, and none at score 85 or higher. All five score-82-or-higher pairs have
  explicit unreviewed `needs_human_review` records. Forty-five cards meet the
  automated structural contract; the remaining 1,250 require additional card
  backfill. No card passes release readiness because human media, graph,
  calibration, and publication approvals have not occurred.
- Migration 377 records 35 score-81 mechanics-based distinct decisions and
  four unreviewed ambiguity quarantines. The missing facts are dumbbell load
  position, line-pogo direction, landmine support stance, and line-hop
  direction/contact count. Migration 378 consolidates 15 exact route,
  implement, support, orientation, countermovement, tempo, obstacle,
  contraction, box-target, terminal-wording, or foot-exchange variants.
- Consolidation exposed Medicine Ball Chest Pass versus Rotational Throw and
  dynamic Goblet Squat versus its bottom isometric hold. Migration 377 records
  both as mechanically distinct. The score-81 queue then contains only nine
  explicit unreviewed `needs_human_review` records and no unclassified pair.
- Disposable negative-path tests proved migration 377 aborts and rolls back all
  decisions for an unexplained archived endpoint, while migration 378 aborts
  before changing a source with synthetic protected media state. Direct SQL,
  production-order clean bootstrap, normal-runner registration, and second-run
  skip paths all passed.
- The normal runner recorded migrations 377 and 378 with checksums
  `3945179680` and `328478309`. The clean migration-378 state has 1,280 active
  and 396 archived definitions, 1,823 variants, 1,974 delivery profiles, 634
  identity decisions, 201 unapproved relationships, 342 unapproved
  calibrations, 5,061 unapproved media candidates, all 1,676 source mappings,
  zero published definitions, and zero direct identity collisions.
- The final canonical audit reports 843 raw and 638 unresolved
  score-72-or-higher pairs, 43 unresolved score-80-or-higher pairs, nine
  unresolved score-81-or-higher pairs, and none at score 85 or higher. All nine
  score-81-or-higher pairs have explicit unreviewed `needs_human_review`
  records. Forty-four cards meet the automated structural contract; the
  remaining 1,236 require additional card backfill. No card passes release
  readiness because human media, graph, calibration, and publication approvals
  have not occurred.
- Migration 379 records 24 score-80 mechanics-based distinct decisions and one
  unreviewed Line Hops versus Line Pogo Hops ambiguity quarantine. It also
  records the three transitive boundaries exposed by alias consolidation:
  dynamic Bench Press versus Bench Press Pin Iso, unified Bench Press versus
  floor-seated Dumbbell Z-Press, and the unified short sprint versus Falling
  Start. No human decision or approval is inferred.
- Migration 380 consolidates 14 exact start, assistance, bar-position, pause,
  tempo, implement, pin-height, rebound-direction, apparatus, load-shape,
  eccentric, isometric, and mobility-sequence variants. It retains all 1,676
  source mappings, aliases, candidate evidence, candidate media, and archived
  nonselectable legacy variants. Barbell and Dumbbell Bench Press now share the
  stable `Bench Press` identity while implement, independent-arm demand, setup,
  spotting, range, load, and dose remain exact variant dimensions.
- Disposable negative-path tests prove migration 379 aborts and rolls back all
  decisions for an unexplained archived endpoint. Migration 380 aborts before
  changing a source with synthetic protected media state and separately aborts
  for an archived duplicate without its required identity resolution. Direct
  SQL execution and rerun are idempotent. The normal platform runner records
  migrations 379 and 380 with checksums `1642176101` and `2572935333`, and a
  second invocation skips them.
- Migration 381 records 42 score-79 and transitive mechanics boundaries and
  five unreviewed ambiguity quarantines. Migration 382 consolidates 25 exact
  implement, grip, stance, support, direction, tempo, range, contraction, and
  dosage variants. The migration refused to override three earlier landmine
  boundaries during development; the final decisions preserve ball-grip,
  drop-step, and fixed split-stance identities as distinct.
- Disposable negative-path tests prove migration 381 aborts atomically for an
  unexplained archived endpoint. Migration 382 aborts atomically for synthetic
  protected media state and separately for an archived duplicate without its
  required resolution. Direct SQL execution and rerun are idempotent. The
  normal platform runner records migrations 381 and 382 with checksums
  `4219887321` and `3232381782`, and a second invocation skips them.
- The migration-382 canonical state has 1,241 active and 435 archived
  definitions, 1,823 variants, 1,974 delivery profiles, 745 identity
  resolutions, 201 unapproved relationships, 342 unapproved calibrations,
  5,061 unapproved media candidates, all 1,676 source mappings, zero published
  definitions, and zero direct identity collisions. The identity queue has 773
  raw and 514 unresolved score-72-or-higher pairs, 247 score-75-or-higher
  pairs, 15 score-79-or-higher pairs, ten score-80-or-higher pairs, and none at
  score 85 or higher. Every score-79-or-higher pair is an explicit unreviewed
  `needs_human_review` quarantine.
- The complete migration-382 audit has one-to-one migration coverage and
  quarantines all 1,241 cards. Forty-three cards pass every non-human automated
  content check; Hamstring Slider Curl is otherwise complete but retains
  explicit taxonomy and graph-integrity blockers, while 1,197 cards still need
  broad structural backfill. Of 1,442 active variants, 1,430 have complete
  complexity/physical-difficulty records and zero derived-overall formula
  violations. The recursive audit finds zero prohibited level keys across 38
  exercise JSON columns, zero assignments across three exercise scalar level
  columns, six active database guards, and all 1,112 dedicated skill-library
  level assignments intact.
- Migration 383 records 32 score-78 and transitive mechanics boundaries and
  seven honest missing-fact quarantines. Migration 384 consolidates 18
  implement, rack, support, unilateral/bilateral, dynamic/isometric,
  entry-speed, contraction-emphasis, target, and dosage variants. Repeated
  queue regeneration resolves every alias-induced score-78 comparison; the
  remaining 22 score-78-or-higher pairs all have explicit unreviewed
  `needs_human_review` decisions.
- A rollback-only validation exposed duplicate candidate-media keys on the
  sprint-entry deceleration source. The final consolidation moves one
  representative candidate per duplicate key and keeps the remaining rows
  attached to the archived source for provenance. Direct SQL and normal-runner
  execution are idempotent. Human-decision sentinels make both migrations abort
  atomically rather than overwrite protected identity state.
- The normal runner records migrations 383 and 384 with checksums `390844992`
  and `2663346848`. The migration-384 state has 1,223 active and 453 archived
  definitions, 1,823 variants, 1,974 delivery profiles, 802 identity
  resolutions, 201 unapproved relationships, 342 unapproved calibrations,
  5,061 unapproved media candidates, all 1,676 source mappings, zero published
  definitions, and zero exact identity collisions.
- The migration-384 queue contains 750 raw and 467 unresolved
  score-72-or-higher pairs, 206 score-75-or-higher pairs, 22
  score-78-or-higher pairs, 15 score-79-or-higher pairs, ten
  score-80-or-higher pairs, and none at score 85 or higher. All 22
  score-78-or-higher pairs are explicit unreviewed quarantines. The library
  audit quarantines all 1,223 active cards and identifies 1,180 with broad
  structural backfill still required.
- Migration 385 records 47 score-77 and transitive mechanics boundaries and
  three honest missing-fact quarantines. Migration 386 consolidates 16
  high-bar, band-row, pause-box-jump, landmine grip/attachment/hand-count,
  loaded-jump, strict-ring-dip, roll-to-stand, sandbag-load-position, and
  tuck-jump terminal variants. Repeated queue regeneration resolves every
  alias-induced comparison through score 77.
- Direct SQL applies and reruns both score-77 migrations idempotently. The
  normal runner records checksums `3748979599` and `1641379975` and skips both
  on a second invocation. Rollback-only negative tests prove migration 385
  refuses to overwrite a simulated human identity decision and migration 386
  refuses to consolidate a simulated published definition; both leave the
  disposable database unchanged.
- The migration-386 state has 1,207 active and 469 archived definitions, 1,823
  variants, 1,974 delivery profiles, 868 identity resolutions, 201 unapproved
  relationships, 342 unapproved calibrations, 5,061 unapproved media
  candidates, all 1,676 source mappings, zero published definitions, and zero
  exact identity collisions. The queue has 741 raw and 418 unresolved
  score-72-or-higher pairs, 158 score-75-or-higher pairs, 25
  score-77-or-higher pairs, 22 score-78-or-higher pairs, 15
  score-79-or-higher pairs, ten score-80-or-higher pairs, and none at score 85
  or higher. All 25 score-77-or-higher pairs are explicit unreviewed
  quarantines.
- The migration-386 library audit has complete one-to-one source coverage and
  quarantines all 1,207 active cards. Forty-three cards avoid the broad
  structural-backfill bucket while 1,164 still require anatomy, difficulty,
  load, fatigue, constraints, delivery, athlete, coach, or support-operations
  completion. Of 1,409 non-archived variants, 1,397 have populated
  complexity/physical-difficulty records and none violates the derived-overall
  formula.
- Exercise difficulty remains exercise complexity plus physical difficulty,
  with overall equal to their maximum. The final database check finds zero
  level-classification keys on exercise definition, variant, delivery, or
  identity surfaces, zero deprecated exercise scalar assignments, zero derived
  overall formula violations, and all 1,112 skill-library level assignments
  intact.
- The production release gate remains correctly blocked: zero published cards,
  zero approved relationship edges, zero approved calibration anchors, zero
  phase depth in the published selection pool, and zero real coach-pilot
  reviews. Candidate URLs and oEmbed metadata remain unapproved; no external
  playback, exact-match media review, caption review, accessibility review, or
  human approval is claimed.
- Migration 387 records 50 score-76 and transitive-survivor mechanics
  boundaries and seven honest missing-fact quarantines. Migration 388
  consolidates 21 exact implement, base, grip, hand-count, laterality,
  contraction, tempo, stance, terminal, balance-overlay, route, and dosage
  variants. Queue regeneration includes direct decisions against final
  survivors rather than relying on decisions whose endpoints were archived.
- Direct SQL applies and reruns both score-76 migrations idempotently. The
  normal runner records checksums `331675051` and `1035641523` and skips both
  on a second invocation. A pristine replay caught and corrected an
  intermediate-survivor idempotency defect in the kneeling chop chain; both
  kneeling sources now resolve directly to `cable-band-chop`.
- Rollback-only negative tests prove migration 387 refuses to overwrite a
  simulated human-owned decision and leaves zero migration rows behind.
  Migration 388 refuses to consolidate a simulated published definition and
  rolls back an earlier successful loop iteration, leaving every source active
  and unchanged.
- The migration-388 state has 1,186 active and 490 archived definitions, 1,823
  variants, 1,974 delivery profiles, 946 identity resolutions, 201 unapproved
  relationships, 342 unapproved calibrations, 5,061 unapproved media
  candidates, all 1,676 source mappings, zero published definitions, and zero
  exact identity collisions. The queue has 715 raw and 356 unresolved
  score-72-or-higher pairs, 95 score-75-or-higher pairs, 30
  score-76-or-higher pairs, 24 score-77-or-higher pairs, 21
  score-78-or-higher pairs, 15 score-79-or-higher pairs, ten
  score-80-or-higher pairs, and none at score 85 or higher. All 30
  score-76-or-higher pairs are explicit unreviewed quarantines.
- The migration-388 library audit has complete one-to-one source coverage and
  quarantines all 1,186 active cards. Forty-three cards avoid the broad
  structural-backfill bucket while 1,143 still require anatomy, difficulty,
  load, fatigue, constraints, delivery, athlete, coach, or support-operations
  completion. Of 1,381 active variants, 1,370 have populated
  complexity/physical-difficulty records and none violates the derived-overall
  formula.
- Exercise cards still contain zero scalar or JSON skill/proficiency
  classifications; all 1,112 skill-library level assignments remain intact.
  Zero definitions, media candidates, relationships, or calibration anchors
  are approved. The release gate remains blocked at zero published phase
  depth, zero approved graph/calibration evidence, and zero real coach-pilot
  reviews.
- Migrations 389 and 390 complete the score-75 tranche and its survivor-name
  transitive closure. Migration 389 records 50 mechanical
  `distinct_exercises` boundaries and ten `needs_human_review` quarantines for
  sources that do not declare support state, contact sequence, stance, path,
  entry, or projection direction. Migration 390 consolidates 14 exact
  implement, load-position, contraction, tempo, stance, target, and dosage
  source variants without merging the already protected landmine
  half-kneeling, tall-kneeling, square-stance, split-stance, or Z-press
  identities.
- Clean direct SQL applies and reruns both migrations idempotently. The normal
  runner records checksums `1370840546` and `2673412815` and skips both on a
  second invocation. Fail-closed negative tests prove migration 389 preserves
  a simulated human-owned decision with zero partial rows, while migration
  390 refuses a simulated published duplicate and rolls back every earlier
  loop operation.
- The migration-390 state has 1,172 active and 504 archived definitions, 1,823
  variants, 1,974 delivery profiles, 1,020 identity resolutions, 201
  unapproved relationships, 342 unapproved calibrations, 5,061 unapproved
  media candidates, all 1,676 source mappings, zero published definitions,
  and zero exact collisions. The regenerated queue has 699 raw and 299
  unresolved score-72-or-higher pairs, 39 score-75-or-higher pairs, 29
  score-76-or-higher pairs, 23 score-77-or-higher pairs, 20
  score-78-or-higher pairs, 14 score-79-or-higher pairs, nine
  score-80-or-higher pairs, and none at score 85 or higher. Every remaining
  score-75-or-higher pair is an explicit unreviewed quarantine; none is
  unclassified.
- The persisted migration-390 audit has complete one-to-one source coverage
  and quarantines all 1,172 active cards. Forty-three cards avoid the broad
  structural-backfill bucket while 1,129 still require anatomy, difficulty,
  load, fatigue, constraints, delivery, athlete, coach, or support-operations
  completion. Of 1,369 active variants, 1,358 have populated
  complexity/physical-difficulty records, 11 remain quarantined for missing
  values, and none violates
  `overall = max(exercise complexity, physical difficulty)`.
- Exercise definitions, variants, delivery profiles, and identity evidence
  contain zero JSON skill/proficiency classifications, deprecated exercise
  scalar assignments remain zero, and all 1,112 dedicated skill-library level
  assignments remain intact. The release gate remains correctly blocked:
  zero published cards or phase depth, zero approved graph edges, zero
  approved calibration anchors, zero exact-match media approvals, and zero
  real coach-pilot reviews.
- A blank disposable PostgreSQL 15 database successfully ran the complete
  migration chain through migration 350; exact-source migrations 351 and 352
  were replayed on a clean clone, and migrations 353–360 were then applied
  through the normal runner on clean clones. Migrations 361 and 362 were
  applied to clean migration-360 and migration-361 clones respectively.
  Migrations 345–390 have
  direct or runner-level idempotency evidence in disposable rehearsal
  databases.
- Migration 305 used traceable legacy difficulty profiles to populate physical
  difficulty for 287 previously incomplete variants and mechanically derived
  overall difficulty for every supported variant. The resulting coverage is
  1,663/1,676 legacy exercises with consistent technical, physical, and
  derived-overall scores. The 13 source exercises with no assessment remain in
  `review` with
  explicit quarantine provenance; no score approval or publication was
  created. The migration fails closed rather than changing a published variant,
  current approved card review, or approved score record.
- Deterministic repeat tests use deep equality with the same seed.
- All 299 canonical-research JSON artifacts pass the exercise-difficulty
  invariant. The normalization tool corrected 278 historical candidate-summary
  overall scores across 164 files so overall now equals the greater of exercise
  complexity and physical difficulty. The legacy storage names remain
  `technicalComplexity` and `absoluteLoadDemand`; non-core dimensions remain
  separately available to planning.
- The duplicate-candidate audit now builds and reuses one normalized identity
  index. Its indexed results are regression-tested against the direct matcher,
  and the complete 1,266-card audit avoids rebuilding identity terms inside
  every pairwise comparison. Forty-three cards pass every non-human automated
  content check and remain quarantined on explicit human calibration,
  graph-review, media-review, and publication gates.
- Golden quality evaluation is at least 90/100 with safety and logistics at
  100/100.
- Migrations 391–396 finish the configured score-74 through score-72
  deterministic identity pass. Migration 397 completes the standing strict
  Landmine Press card and consolidates the two-hand, square-stance one-arm,
  and split-stance one-arm source definitions into three exact variants while
  preserving all three legacy mappings and archived source variants.
- Migration 397 adds five difficulty-only review variants, ten contextual
  delivery profiles, 16 candidate evidence rows, five oEmbed-healthy media
  candidates, 12 candidate alternate assessments, six review-only graph
  proposals, 15 review-only calibration proposals, and a quarantined
  automated test packet. It makes no publication, media, graph, calibration,
  or human-review approval claim.
- The migration directly applies and reruns idempotently. The normal platform
  runner records checksum `3276759652`, skips the migration on its second
  invocation, and leaves Landmine Press at card version 2. A rollback-only
  negative test marks the square-stance source published; migration 397
  refuses the protected record and leaves all four definitions and all
  migration-397 identity rows unchanged.
- The migration-397 audit has complete coverage for all 1,676 legacy source
  rows, 1,096 active and 580 archived definitions, 1,828 variants, 1,984
  delivery profiles, 1,347 identity decisions, 5,066 unapproved media
  candidates, 207 unapproved relationships, 357 unapproved calibration
  anchors, and zero approved or published records.
- The score-72 identity queue falls from 52 to 47 unresolved pairs. All 47 are
  explicit `needs_human_review` quarantines, none is unclassified, and no exact
  collision remains. The ambiguous one-arm landmine arc press stays
  quarantined rather than being guessed.
- Forty-two active cards now avoid the broad structural-backfill bucket and
  1,054 remain. Every populated active/review difficulty record derives
  overall as the maximum of exercise complexity and physical difficulty.
  Canonical classification checks find zero exercise skill/proficiency
  metadata and preserve all 1,112 dedicated skill-library level assignments.
- Migration 398 completes the structural research packet for the
  half-kneeling, tall-kneeling, floor, and Z-position one-arm landmine presses.
  It adds seven exact review variants, 12 selectable delivery profiles, 80
  section-evidence rows, 25 oEmbed-healthy media candidates, 30 alternate
  assessments, eight review-only relationships, 14 review-only calibrations,
  and five quarantined test packets while preserving all six legacy source
  mappings.
- The underspecified One-Arm Landmine Arc Press remains a seventh,
  non-selectable `identity-review-only` variant with one blocked review
  profile. Conflicting public usages are preserved as review evidence rather
  than being converted into an invented executable identity.
- Migration 398 stores no athlete skill or proficiency classification on an
  exercise card. Its scores are exercise complexity and physical difficulty,
  with overall derived as their maximum. It creates no publication, media,
  relationship, calibration, card-review, variant, or delivery approval.
- Migration 398 now has final fresh-database and clean re-entry evidence. The
  complete chain through migration 404 applied from zero in disposable
  PostgreSQL 14.18, and migrations 398 and 401–404 then executed directly over
  their completed state without changing their fail-closed invariants.
- Migration 401 completes the research and migration implementation for
  Landmine Push Press, One-Arm Landmine Split Jerk, and Landmine
  Squat-to-Press. It preserves migration 388's two-hand push-press
  consolidation and models hand count and fixed stance as exact variants while
  retaining the split receive and full-squat action as separate identities.
- The batch adds seven difficulty-only review variants, 14 delivery profiles,
  48 evidence rows, 11 unverified non-embeddable YouTube candidates, 18 alternate
  assessments, eight review-only relationships, 14 review-only calibrations,
  and three quarantined packets. It creates no media, graph, calibration,
  card-review, variant, profile, or publication approval and stores no exercise
  skill/proficiency classification.
- Migration 401's research-packet, static fail-closed, database-application,
  and direct clean-re-entry invariants are now verified. Current focused tests,
  platform tests, focused ESLint, CI smoke/syntax checks, and the production
  build are green; the current aggregate results are recorded below.
- Migration 402 completes candidate structure for Landmine Front Squat,
  Landmine Hack Squat, Landmine Split Squat, and Landmine Reverse Lunge to
  Press. It preserves migration 369's archived handle-grip source mapping and
  the unresolved human-review boundary between the re-authored stationary
  landmine split squat and the broader legacy split-squat source.
- The batch adds eight exact difficulty-only review variants, 16 contextual
  delivery profiles, 64 evidence rows, 14 unverified non-embeddable YouTube
  candidates, 24 alternate assessments, 14 review-only relationships, 16
  review-only calibrations, and four quarantined card-test packets. It creates
  no approval state. The split-squat packet carries an additional
  `CARD-IDENTITY-02` blocker.
- Migration 402 stores no athlete skill or proficiency classification. Its
  difficulty dimensions are exercise complexity and physical difficulty, with
  overall derived as their maximum. Media discovery is not treated as
  playback, exact-match, embedding, accessibility, reviewer, or approval
  verification.
- Disposable PostgreSQL exposed and the migration now fixes three contract
  defects that static SQL review had missed: the handle-grip source is legacy
  ID 1452 rather than the unrelated rotational-row ID 1453, the controlled
  phase key is `resilience` rather than `control_resilience`, and a near-zero
  impact-accumulation score is stored as the contract minimum 1 rather than 0.
  Migration 402 applies from zero, directly re-enters cleanly, and the complete
  1,096-card audit now normalizes every card instead of aborting on that score.
- Migration 403 completes the consolidated Cossack Squat candidate card and
  preserves Cossack Shift to Wall Ball Toss as a distinct, nonselectable
  identity quarantine. All 12 migration-307 duplicate consolidations and all
  15 legacy source mappings are guarded rather than silently recreated: 14 on
  Cossack Squat plus the distinct wall-toss source.
- The Cossack family adds 13 difficulty-only review variants: ten selectable
  exact Cossack variants, two nonselectable Cossack variants with unresolved
  reach or load identity, and one nonselectable wall-toss protocol. It also
  adds 23 contextual or blocked delivery profiles, 32 evidence rows, ten
  unverified non-embeddable YouTube candidates, 22 alternate assessments, 16
  review-only relationships, 24 review-only calibrations, and two quarantined
  card-test packets. The unspecified loaded variant deliberately has no
  fabricated difficulty score.
- Migration 403 stores no athlete skill or proficiency classification.
  Difficulty is exercise complexity plus physical difficulty with overall
  derived as their maximum. The wall-toss card remains blocked until throw
  direction, target height, ball path, ball behavior, reception or retrieval,
  side order, reset, and lane are independently authored and reviewed.
- A schema-contract audit corrected migrations 401–403 to use the candidate
  media table's allowed `unverified` link state. PostgreSQL then confirmed the
  Cossack survivor set has 15, not 14, legacy mappings. Migration 403 applies
  from zero and directly re-enters cleanly.
- Migration 404 completes Adductor Rockback without guessing unresolved reach
  or kicking identities. It retains all four legacy mappings and three prior
  duplicate consolidations; adds five review variants, five contextual or
  blocked profiles, 16 evidence rows, five unverified non-embeddable media
  candidates, 11 alternate assessments, six review-only relationships, six
  review-only calibrations, and one quarantined test packet. Three variants
  carry exercise-complexity and physical-difficulty scores; two unresolved
  variants deliberately remain nonselectable and unscored.
- A second database created from zero successfully applied the complete
  migration sequence through 404, every add-on migration, and runtime schema
  compatibility. Direct execution of migrations 398 and 401–404 over the
  completed database returned five successful `DO` blocks. A rollback-only
  sentinel set `last_reviewed_at` on Adductor Rockback; migration 404 refused
  to overwrite the protected card and the transaction left the card unchanged.
- Migration 405 closes 18 recent-family similarity warnings whose authored
  contracts already prove distinct support, stance, action order, release, or
  fixed-pivot mechanics. It deliberately leaves Arc Press, general Split Squat,
  and underspecified deadlift comparisons in `needs_human_review`. The
  migration applies normally, directly re-enters cleanly, and a rollback-only
  conflicting-decision sentinel proves it will not overwrite later review
  state. It creates no card, media, graph, calibration, or publication approval.
- Migration 406 closes the last two unclassified score-72-or-higher pairs. Box
  Squat and Split Squat are recorded as distinct because bilateral box support
  and a stationary fore-aft split stance are different identity contracts.
  Squat-to-Press versus the unresolved Arc Press is stored as
  `needs_human_review`, not guessed. Normal apply, direct re-entry, and a
  rollback-only conflicting-decision sentinel pass.
- Migration 407 completes the Backpedal-to-Sprint Turn and
  Backpedal-to-Sprint-to-Stick candidate cards while preserving the terminal
  action boundary between sprint-through and controlled stick. It guards all
  four legacy mappings and both prior duplicate consolidations; adds nine
  difficulty-only variants, 17 delivery profiles, 32 evidence rows, ten
  unverified non-embeddable media candidates, ten alternate assessments, 16
  review-only relationships, 16 review-only calibrations, and two quarantined
  test packets. Eight variants are selectable. The underspecified
  free-deceleration/no-hold form remains nonselectable and unscored.
- Migration 407 also records the authored boundary between Open Turn and
  Backpedal Turn to Hop-and-Go: the latter requires an intervening hop contact
  and controlled landing before reacceleration. It stores no athlete skill or
  proficiency classification. Difficulty is exercise complexity plus physical
  difficulty, with overall derived as their maximum. All media and graph,
  calibration, card, and publication state remains unapproved.
- PostgreSQL 14.18 applied migration 407 normally with final checksum
  `1946080963` and directly re-entered it without changes. Rollback-only
  sentinels prove it refuses both a reviewed card and a conflicting identity
  decision, leaving the protected state unchanged.
- Migration 408 completes the research/governance packet for Dead Hang, Active
  Hang, and Scapular Pull-Up while preserving their passive-position,
  active-isometric, and repeated-scapular-motion identities. The existing 18
  exact variants and 19 delivery profiles are retained. The new card versions
  add 48 section-evidence rows, 15 unverified non-embeddable YouTube candidates
  (five per card), 33 alternate assessments, 17 inverse regression proposals
  alongside the 17 existing progression proposals, 36 review-only
  complexity/physical-difficulty calibrations, and three quarantined packets.
- All six hang-family legacy mappings remain guarded. The ambiguous historical
  passive-or-active source is deliberately unscored; exact Active Hang aliases
  share the same queued baseline score. Migration 408 stores no athlete skill
  or proficiency classification and creates no media, graph, calibration,
  reviewer, card, or publication approval.
- PostgreSQL applied migration 408 normally with checksum `865725329` and
  directly re-entered it without changes. Rollback-only sentinels prove it
  refuses a reviewed card or reviewed relationship and leaves the version-4
  candidate state unchanged.
- Migration 409 completes the research/governance packet for Seated Compression
  Lift, V-Sit, and Manna Hold while preserving grounded dynamic compression,
  above-horizontal straight-arm support, and hips-and-legs-beyond-shoulders
  Manna as separate identities. It retains all eight exact variants and eight
  contextual delivery profiles; adds 48 section-evidence rows, 15 unverified
  non-embeddable YouTube candidates (five per card), 24 alternate assessments,
  seven inverse graph proposals alongside eight existing proposals, 16
  review-only complexity/physical-difficulty calibrations, and three
  quarantined packets.
- Migration 409 guards all three legacy mappings and four support-compression
  identity boundaries. Difficulty remains exercise complexity plus physical
  difficulty with overall derived as their maximum. The cards contain no
  athlete skill/proficiency classification and create no media, graph,
  calibration, reviewer, card, or publication approval.
- PostgreSQL applied the revised migration 409 with checksum `1389319406`.
  Two direct re-entries produced the same deterministic graph-content hash,
  proving authored and inverse lateral-substitution edges remain stable.
  Rollback-only sentinels prove it refuses both a reviewed definition and a
  conflicting identity decision; the protected candidate state remains
  unchanged.
- Migration 410 completes the research/governance packets for Hanging Leg
  Raise, L-Sit, and Hanging L-Sit without collapsing dynamic overhead-suspended
  hip flexion, static straight-arm push support, and static overhead suspension.
  It preserves 11 exact variants and 11 delivery profiles; adds 48 evidence
  rows, 15 unverified non-embeddable YouTube candidates (five per card), 36
  alternate assessments, four authored and 11 inverse graph proposals, 22
  review-only complexity/physical-difficulty calibrations, three deterministic
  identity boundaries, and three quarantined packets.
- All seven migration-310/311 legacy mappings remain guarded. Migration 410
  contains no athlete skill/proficiency classification and creates no media,
  graph, calibration, reviewer, card, or publication approval. PostgreSQL
  recorded checksum `952600727`; direct and normal-runner re-entry remained
  graph-content stable. Rollback-only sentinels prove reviewed definitions and
  conflicting identity decisions fail closed.
- Migration 411 audits all 12 A-series source cards and reduces them to seven
  active canonical definitions without discarding source lineage. Migration
  394's A-March Linear consolidation remains intact; arm-sweep A-March,
  A-Skip Rhythm Punch, A-Skip Snap Down, and A-Skip for Approach Rhythm are now
  archived source identities represented by searchable aliases and four
  contextual delivery profiles on the A-March or A-Skip baseline.
- A-March and A-Skip are the only structurally complete selectable identities
  in this tranche. A-March to Projection, A-Skip Pogo Rhythm, A-Skip Through
  Cone Gates, A-Skip Through Ladder, and High-Knee A-March Ladder retain active
  candidate definitions but have `avoid` profiles, suitability 1, explicit
  selection blocks, `needs_human_review` boundaries, and identity blockers
  until their exact ordered contacts, equipment rules, and finishes are
  authored and approved. A-March versus A-Skip is recorded as distinct because
  the latter adds a step-hop sequence, flight, landings, and impact.
- The seven version-2 packets add 112 evidence rows, 35 unverified
  non-embeddable YouTube candidates, 35 alternate assessments, six authored
  and six inverse graph proposals, 14 review-only complexity/physical-
  difficulty calibrations, 12 delivery profiles, and seven quarantined test
  packets. Difficulty overall remains the maximum of exercise complexity and
  physical difficulty; no exercise skill/proficiency classification or media,
  graph, calibration, reviewer, card, or publication approval is created.
- Disposable PostgreSQL applied migration 411 through the production runner
  with checksum `2200245960`. Direct re-entry retained the 12-edge graph hash
  `4b23b21573ff4aaa3c77a4fe41e1d9cd`. Rollback-only reviewed-card and
  identity-conflict sentinels both failed closed, then verified zero review or
  version drift and the same graph hash.
- Migration 412 corrects the ankling/low-pogo source lineage rather than
  preserving earlier overbroad name-based consolidations. Low Pogos now maps to
  the stationary bilateral Ankle Pogo identity; Wall Ankling Pogo is restored
  as an active but nonselectable identity quarantine because body angle,
  support, laterality, ordered contacts, flight, displacement, dose unit, and
  finish remain undeclared. The redundant exact-name source-1109 baseline is
  archived. Ankling Walk and Ankling / Dribble March are consolidated into
  identity-preserving learning-cadence profiles of traveling Ankling Drill.
  Straight-Leg Bound March is correctly displayed as no-flight Straight-Leg
  March while every historic alias and all 14 legacy mappings remain traceable.
- Migration 413 completes nine version-2 candidate packets: Ankle Pogo,
  Ankling Drill, Straight-Leg March, Straight-Leg Bound, and Straight-Leg
  Bounds to Sprint are structurally selectable only after approval. Ankling
  Pogo, Fast Ankling Pogo March, Straight-Leg Ankling Ladder, and Wall Ankling
  Pogo retain `avoid` profiles, suitability 1, explicit selection blocks, and
  `needs_human_review` identity contracts.
- The nine packets add 144 candidate evidence rows, 45 unverified
  non-embeddable YouTube candidates (five per card), 45 alternate assessments,
  eight authored and eight inverse graph proposals, 18 review-only
  complexity/physical-difficulty calibrations, 13 active delivery profiles,
  queued score evidence for all 14 sources, and nine quarantined test packets.
  Three new contextual profiles preserve Low Pogos, dribble-march cadence, and
  walking cadence without manufacturing separate exercise identities.
- Neither migration stores athlete skill/proficiency on an exercise card.
  Overall difficulty is always the maximum of exercise complexity and physical
  difficulty. No external media verification, embed approval, exact-match
  decision, reviewer assignment, card approval, relationship approval,
  calibration approval, or publication is fabricated.
- Disposable PostgreSQL recorded production-runner checksums `789468044` and
  `2423351331` for migrations 412 and 413. Direct re-entry of each migration,
  including 412 after 413, preserves the 16-edge graph-content hash
  `8fd38c857faf64ccdc1ff1b402ca33ae`. Rollback-only human-identity and
  reviewed-card sentinels fail closed and leave review dates, card versions,
  identity state, and graph content unchanged.
- Migration 414 prepares the skipping/fast-leg family without merging unlike
  exercises. Ordinary step-hop skipping, horizontal Power Skip, and a
  designated-leg Fast-Leg Cycle are recorded as distinct identity contracts.
  Cone spacing and ball-toss constraints remain explicit human-review
  boundaries. The exact duplicate source-1137 Power Skip baseline and profile
  are archived, while the cadence-change source remains an identity-preserving
  context of ordinary skipping rather than another exercise card.
- Migration 415 completes five version-2 candidate packets. Ordinary Skipping
  Rhythm Drill and Power Skip for Distance are structurally selectable only
  after approval. Cone Skip Rhythm Build, Skipping Rhythm Change with Ball
  Toss, and Fast-Leg Cycle retain `avoid` profiles, suitability 1, explicit
  selection blocks, and unresolved ordered-contract requirements.
- The five packets add 80 candidate evidence rows, 25 unverified
  non-embeddable YouTube candidates, 25 alternate assessments, five authored
  and five inverse graph proposals, ten review-only complexity/physical-
  difficulty calibrations, six active delivery profiles, queued score evidence
  for all seven source cards, and five quarantined test packets. The sixth
  profile preserves cadence-change delivery without creating another identity.
  No athlete proficiency, external verification, exact-match decision,
  reviewer, or approval is fabricated.
- Migration 416 restores Low and High Dribble Run as controlled recovery-height
  variants of one Dribble Run definition and keeps Dribble Build to Sprint as a
  distinct compound exercise with a terminal free-sprint segment. Migration
  417 completes both active cards: 32 candidate evidence rows, ten unverified
  non-embeddable media candidates, ten alternate assessments, three exact
  delivery profiles, six review-only relationship edges, six review-only
  complexity/physical-difficulty calibrations, three queued source-score
  packets, and two quarantined card tests. No exercise proficiency or approval
  state is created.
- Migration 418 closes the two similarity pairs exposed by those lineage
  corrections. Historic Fast Low Pogos source 135 is consolidated into the
  stationary bilateral Ankle Pogo definition; fast cadence, low amplitude,
  contact cap, duration, rest, and phase intent remain delivery/dosage
  modifiers. Traveling no-flight Ankling Drill and cyclic recovery-height
  Dribble Run are explicitly distinct ordered movement contracts. The
  migration preserves aliases and source traceability and creates no review or
  publication approval.
- Migration 419 consolidates 20 audited legacy short-acceleration sources into
  one stable definition with six exact selectable start variants and two
  identity-blocked provisional variants. Migration 420 adds eight contextual
  profiles, 24 unique candidate evidence rows spanning all 16 sections, four
  unverified non-embeddable media candidates, 37 alternate assessments, 14
  review-only relationship proposals, 16 review-only calibration proposals,
  20 queued source-score packets, one quarantined version-2 card test, and a
  candidate-only legacy difficulty compatibility row for source 6.
- Migration 421 records three newly exposed stable identity boundaries: level
  versus incline-resisted acceleration, single acceleration versus ordered
  braking and re-acceleration, and a simple go signal versus a multi-option
  choice-reaction start. It creates no human decision or approval.
- A blank disposable PostgreSQL database applied the complete migration history
  through 421. The production runner recorded checksums `591027751`,
  `2828558425`, and `1278625798` for migrations 419–421. Direct clean re-entry
  produced no drift. Rollback-only reviewed-card and human-identity sentinels
  failed closed and restored clean candidate state.
- The refreshed whole-library audit covers all 1,676 legacy exercises and all
  1,081 active canonical definitions. Migration coverage is complete; zero
  exact collisions remain. Of 627 raw name-similarity pairs, 576 are
  adjudicated distinct and 51 remain unresolved. All 51 are explicit
  `needs_human_review` quarantines; zero are unclassified, two are score 85 or
  higher, and none is score 90 or higher. All 1,081 cards remain correctly
  quarantined and zero are published because human media, relationship,
  calibration, card, and pilot approvals have not occurred.
- Score and operational-profile coverage is now 7.86%; complete research,
  alternate-assessment, athlete/coach support, and support-operations coverage
  is 7.68%; anatomy is 7.59%, load profile 5.27%, fatigue profile 5.74%, and
  complete media-candidate-set coverage 69.20%. The graph contains 372
  review-only edges and calibration contains 585 review-only proposals.
  Approved counts remain zero. The separate Needs Engine audit improves to 31
  failures: 12 missing difficulty and 19 missing dosage.
- Final automated verification passes 141/141 focused research/difficulty and
  billing-regression tests, plus the full backend/platform suite with 920
  passed, 20 intentionally skipped, and zero failed. Focused ESLint, 12
  management smoke checks, 10 launch smoke checks, CI syntax checks, and the
  production build also pass.
- Migration 422 completes the Hill Sprint Acceleration candidate card while
  preserving the migration-339 consolidation of legacy sources 126 and 332.
  The stable definition now has exact two-point and controlled falling-start
  shallow-grade variants; measured uniform positive grade, distance and unit,
  markers, lead side, timing, intent, effort count, recovery, surface, and
  footwear remain delivery variables. Steep grinding, long conditioning,
  stairs, treadmill, external sled or band, downhill overspeed, uphill
  bounding, and shuttle or sprinted-descent tasks remain separate and are not
  silently selected through this card.
- The version-2 card adds two contextual Output profiles, 16 current candidate
  evidence sections, three unverified non-embeddable media candidates, seven
  alternate assessments, four review-only progression/regression/substitution
  relationships, four review-only complexity/physical-difficulty calibrations,
  two queued source-score packets, and one quarantined automated card packet.
  Two-point difficulty is 52 complexity / 72 physical / 72 derived overall;
  falling-start difficulty is 56 / 72 / 72. No exercise-card proficiency
  field, media verification, exact-match decision, reviewer, or approval is
  created.
- Disposable PostgreSQL applied migration 422 directly, re-entered it cleanly,
  and recorded production-runner checksum `1254677506`. A transaction-scoped
  `in_review` source-score sentinel made the migration fail closed and rolled
  back. The refreshed audit remains at 1,676 legacy exercises, 1,081 active
  canonical definitions, 51 explicit unresolved identity pairs, and zero exact
  collisions. Coverage is now 7.96% for score and operational profiles, 7.77%
  for research/support/alternate packets, 7.68% anatomy, 5.37% load, 5.83%
  fatigue, and 69.20% complete media candidate sets. The graph has 376
  review-only edges and calibration has 589 review-only proposals; approved
  counts remain zero. The independent Needs Engine audit remains at 31
  failures (12 difficulty, 19 dosage).

## Operational release gates

These are deployment and evidence gates, not code-completion claims:

The complete sequence through migration 421 and the full audit have now run in
disposable PostgreSQL. The remaining gates are:

1. Review anatomy, constraints, scores, media,
   relationships, and calibration evidence card by card.
2. Publish a versioned library release only from cards whose stored packet
   passes and whose independent review is current.
3. Run the documented internal-coach pilot and measure the 90% keep/minor-edit,
   sub-10% swap, and sub-15% dose-edit targets.
4. Enable the feature flag by rollout stage only after its quantitative gates
   pass. Keep the legacy path available for immediate rollback.

## Migration 423 completion record

- Legacy `180-turn-wall-ball-catch-and-throw` remains stable but is explicitly
  nonselectable: its source does not define a coherent exact exercise contract.
  It cannot enter a workout, substitution list, station, dose, demonstration,
  or athlete rendering until a human identity decision maps an exact task.
- A distinct exact review-only card records the documented through-the-legs
  wall throw, grounded 180-degree turn, visual reacquisition, and two-hand
  rebound catch. Its standardized assessment and scaled non-normative rehearsal
  are difficulty-scored variants; no athlete skill/proficiency classification
  is stored on either exercise card.
- Both cards have complete fail-closed generation and support contracts. The
  exact card's publication-readiness detail contains only missing approved
  media and exact-match media review. Relationship and calibration failures
  are explicit human gates; no approval was fabricated.
- The candidate packet contributes 16 evidence sections, three unverified
  adjacent media links, six alternate assessments, two graph proposals, six
  calibration proposals, and two automated quarantine packets. It also records
  a deterministic distinct-identity boundary that resolves the generated pair
  without creating a human-review claim.
- Whole-library audit totals are now 1,676 legacy exercises, 1,082 active
  definitions, 628 raw pairs, 577 adjudicated-distinct pairs, 51 unresolved
  pairs, and zero exact collisions. All 1,082 remain quarantined. There are 378
  review-only graph edges and 595 review-only calibrations, with zero approved.
- Disposable PostgreSQL passed direct execution, re-entry, production-runner
  execution, and rollback-only protected-state testing. Migration 423 is
  registered with checksum `1847350634`.

## Migration 424 completion record

- The false one-arm Landmine Arc identity is retired. Legacy rows 1413 and
  1414 now retain source-level traceability to standard Landmine Press; the
  latter records eccentric tempo as a modifier rather than a new exercise.
- A new review-only two-hand shoulder-to-shoulder Landmine Arc card defines
  exact tall- and half-kneeling variants, one-way crossing dosage, full
  planning/support contracts, 16 evidence sections, five automated
  oEmbed-healthy candidate videos, eight alternate decisions, two relationship
  proposals, four calibration proposals, four contextual profiles, and a
  quarantined card test. Athlete proficiency is absent; difficulty contains
  exercise complexity, physical difficulty, and their derived maximum only.
- No approval was inferred from research or link health. Exact video matching,
  complete human media review, graph approval, calibration approval, two-person
  card review, pilot evidence, and publication remain quarantined gates.
- Whole-library totals are now 1,676 legacy exercises, 1,082 active canonical
  definitions, 627 raw similarity pairs, 580 adjudicated-distinct pairs, 47
  unresolved pairs, one unresolved pair at score 85 or higher, and zero exact
  collisions or unresolved pairs at score 90 or higher. All definitions remain
  quarantined and zero are published.
- Migration 424 passed direct execution, clean re-entry, production-runner
  execution, and protected published-state rollback testing in disposable
  PostgreSQL. Its registered checksum is `2520926649`.
- Final automated verification passes 131/131 focused tests and the full
  backend suite with 925 passed, 20 intentionally skipped, and zero failed.
  Focused ESLint, 12 management checks, 10 launch checks, CI syntax checks, and
  the production build also pass.

## Migration 425 completion record

- Ambiguous `ankling-pogo-hop` and `wall-ankling-pogo` cards are archived and
  nonselectable. Their legacy sources remain traceable and are not falsely
  mapped to an exact laterality or contact sequence.
- `single-leg-pogo` version 3 adds an exact wall-lean stationary variant:
  intentional two-hand wall pressure, declared forward body line, repeated
  same-leg contacts, held opposite-leg recovery position, one landing per
  counted contact, controlled two-foot exit, and a reset before side change.
- The variant includes exercise complexity 48, physical difficulty 52, derived
  overall 52, complete planning and support contracts, 16 evidence sections,
  five oEmbed-healthy candidate demonstrations, nine alternate decisions, two
  profiles, one relationship proposal, two calibration proposals, and an
  automated quarantined test packet. It contains no athlete proficiency field.
- Exact media matching, complete human playback and safety review, calibration,
  graph approval, two-person card review, pilot evidence, and publication all
  remain explicit human gates. No approval was inferred from oEmbed metadata,
  titles, search results, or automated visual observation.
- Whole-library totals are now 1,676 legacy exercises, 1,080 active canonical
  definitions, 623 raw similarity pairs, 579 adjudicated-distinct pairs, 44
  unresolved pairs, and zero exact collisions. No unresolved pair scores 85 or
  higher; all active cards remain quarantined and zero are published.
- Migration 425 passed direct execution, clean re-entry, the production runner,
  and protected published-state rollback testing in disposable PostgreSQL. Its
  registered checksum is `4272711159`.
- Final verification passes 133/133 focused tests and the full backend suite
  with 927 passed, 20 intentionally skipped, and zero failed. Focused ESLint,
  12 management smoke checks, 10 launch smoke checks, CI syntax checks, and the
  production build also pass.

## Migration 426 completion record

- `bound-to-stick` now has the exact display identity `Opposite-Leg Forward
  Bound to Stick`; `lateral-bound` now has `Opposite-Leg Lateral Bound to
  Stick`. Both stable slugs and legacy-source mappings are preserved.
- Both definitions require one declared takeoff leg, direction-specific
  projection, opposite-leg landing, a terminal stable hold, and full reset.
  Diagonal, rotational, same-leg, continuous, approach, and reactive tasks are
  kept separate. Four nearby similarity pairs are recorded as mechanically
  distinct without claiming human review.
- Each card has complete generation, dosage, cumulative-budget, logistics,
  athlete-support, coach-support, operations, evidence, provenance, alternate,
  and test-packet contracts. Exercise difficulty is 56 complexity / 64
  physical / 64 overall forward and 60 / 66 / 66 lateral. Exercise-card skill
  or proficiency levels are absent.
- Each card has 16 current evidence sections, five candidate-only oEmbed-
  healthy videos, nine alternate assessments, two contextual profiles, a
  bidirectional review-only substitution proposal, and two review-only
  calibrations. No exact-match, reviewer, relationship, calibration, card, or
  publication approval was manufactured.
- Both card packets fail only the intended human gates for exact media review,
  an approved relationship, approved calibration, and publication. Whole-
  library totals are 1,676 legacy exercises, 1,080 active definitions, 624 raw
  similarity pairs, 583 adjudicated-distinct pairs, 41 unresolved pairs, and
  zero exact collisions or unresolved score-85-or-higher pairs. Needs Engine
  failures improve to 30 (11 difficulty, 19 dosage).
- Disposable PostgreSQL passed direct execution, clean re-entry, production-
  runner execution, and rollback-only protected-state testing. Migration 426
  is registered with checksum `1732038496`.
- Final verification passes 135/135 focused tests and the full backend suite
  with 932 passed, 20 intentionally skipped, and zero failed. Focused ESLint,
  12 management smoke checks, 10 launch smoke checks, CI syntax checks, and the
  production build also pass.

## Migrations 428–430 completion record

- Migration 428 retires the undefined single-leg line-hop source rather than
  inferring direction, foot sequence, contacts, or terminal outcome. It remains
  source-traceable, nonselectable, unscored, and human-review quarantined.
- Migration 429 retires the mixed standing/seated eccentric dumbbell press and
  completes explicit standing and seated strict-press variants, including
  normal and 4–6-second eccentric options. Full-cycle action and equipment
  operations are required; eccentric wording alone never creates an
  eccentric-only exercise.
- Migration 430 retires the mixed standing-or-kneeling kettlebell source family
  while preserving legacy mappings 490 and 491. The standing strict press gains
  an exact bilateral two-kettlebell front-rack variant with complete generation,
  fatigue, impact, recovery, logistics, dosage, instruction, support, and stop
  contracts.
- All difficulty records assess exercise complexity and physical difficulty,
  with overall difficulty derived as their maximum. Exercise-card skill and
  proficiency fields are absent; no migration changes skill-library levels.
- Media link health and titles are candidate evidence only. Exact-match,
  demonstration quality, captions/accessibility, reviewer identity, graph,
  calibration, card, pilot, and publication approval all remain human gates.
- The current disposable-database audit has 1,676 legacy exercises, 1,077
  active definitions, complete migration coverage, 616 raw similarity pairs,
  583 adjudicated-distinct pairs, 33 unresolved pairs, zero exact collisions,
  and no unresolved pair scoring 85 or higher. All active cards remain
  quarantined and zero are published.
- Needs Engine readiness is 1,581/1,611 published legacy cards; the remaining
  30 blockers are 11 missing difficulty profiles and 19 missing dosage
  profiles.
- The production runner recorded checksums `4051154404`, `989893497`, and
  `3711801288` for migrations 428, 429, and 430. Migration 430 passed direct
  execution, clean re-entry, runner execution, and rollback-only protected-
  state testing. Focused lint, 141 focused tests, the full suite (940 passed,
  20 skipped), management/launch smoke checks, CI syntax checks, and the
  production build pass.

## Migration 431 completion record

- `lateral-line-pogo` and `line-pogo-forward-back` are now exact bilateral,
  simultaneous-foot, low-amplitude, direction-specific line-crossing exercises.
  Every bilateral landing is one contact and every set has a controlled
  two-foot finish. Their direction and plane are a hard identity boundary.
- Generic sources `line-pogo-hops`, `line-hops`, and
  `forward-back-line-hops` are archived and unscored because their executable
  contact contracts are incomplete. They retain aliases, source mappings,
  evidence, media candidates, alternates, and human-review decisions. No
  direct mapping or approval was invented.
- Seven ambiguous or redundant published legacy rows are archived; exact
  primary rows 975 and 1083 remain published with complete dose, duration,
  logistics, cumulative-impact, instruction, quality, stop, support, and
  difficulty profiles.
- Lateral difficulty is 44 complexity / 48 physical / 48 overall and forward-
  back is 46 / 48 / 48. Overall is derived by `max`. Exercise and safety cards
  contain no athlete skill or proficiency classification; skill levels remain
  exclusive to skill-library cards.
- The batch contributes 80 current candidate evidence sections, 19 automated
  oEmbed-healthy and embeddable candidate links, 37 alternate assessments,
  four delivery profiles, two review-only substitution proposals, four review-
  only calibration proposals, and five quarantined test packets. Exact media
  match, quality, reviewer, graph, calibration, card, pilot, and publication
  approval remain unset and human-gated.
- The current whole-library audit reports 1,676 legacy exercises, 1,074 active
  canonical definitions, 613 raw pairs, 583 adjudicated-distinct pairs, 30
  unresolved pairs, zero exact collisions, and no unresolved score-85-or-
  higher pair. The remaining 30-pair queue is not permission to infer missing
  facts.
- Canonical release readiness remains deliberately blocked: zero canonical
  cards, graph edges, or calibration anchors are approved or published, every
  phase has zero published pool depth, and no coach pilot has occurred. The
  independent legacy Needs Engine surface is 1,574/1,604 passing; its 30
  remaining failures are 11 missing difficulty and 19 missing dosage profiles.
- Disposable PostgreSQL passed direct execution, deterministic repeated re-
  entry, production-runner execution, exact rationale-idempotency inspection,
  and rollback-only protected-approval testing. The final checksum is
  `3118654911`. Focused lint, 143 focused tests, the full suite with 942 passed
  and 20 intentionally skipped, management and launch checks, CI syntax checks,
  and the production build pass.

## Migration 432 completion record

- The ambiguous `90-degree-hop-to-stick` and
  `90-degree-jump-turn-to-stick` definitions are archived without a fabricated
  mapping or difficulty score. Legacy exercises 1489 and 1512 are archived,
  unpublished, and free of exercise-card skill levels.
- Two exact review-only definitions now cover stationary bilateral and
  stationary same-leg unilateral quarter-turn tasks. Both declare takeoff and
  landing support, exact 90-degree rotation, minimal displacement, landing leg,
  turn direction, terminal hold, reset, side accounting, dose, duration,
  logistics, cumulative fatigue and impact budgets, rendering, athlete and
  coach support, quality gates, stop rules, and substitution behavior.
- Bilateral difficulty is 58 complexity / 56 physical / 58 overall; unilateral
  difficulty is 68 / 64 / 68. Overall is derived with `max`. Exercise-card
  skill and proficiency classifications are absent and remain exclusive to the
  skill library.
- The research packet contains 64 candidate evidence sections, 16 oEmbed-
  healthy candidate videos, 30 alternate assessments, four profiles, two
  review-only relationship proposals, four review-only calibration proposals,
  and four quarantined test packets. No exact-match media, demonstration-
  quality, reviewer, relationship, calibration, card, pilot, or publication
  approval is inferred.
- Nine deterministic `distinct_exercises` decisions prevent the two exact
  cards from colliding with each other, the 180-degree card, vertical and
  lateral hops, the speed cut, triple hop, and tuck/lateral landing task. The
  old source-to-exact mapping remains explicitly unresolved for human review.
- The whole-library audit now reports 1,676 legacy exercises, 1,074 active
  canonical definitions, 617 raw name-similarity pairs, 588 adjudicated-
  distinct pairs, 29 unresolved pairs, zero exact collisions, and no unresolved
  pair at score 85 or higher. Every active canonical card is quarantined and
  zero is published.
- Release readiness is still intentionally blocked by human and operational
  gates. The independent legacy Needs Engine audit is 1,572/1,602 passing; its
  30 remaining failures are 11 missing difficulty and 19 missing dosage.
- Disposable PostgreSQL passed direct application, clean repeated re-entry,
  production-runner registration, and a rollback-only simulated-approval
  sentinel. The final checksum is `2001418406`. Focused lint, 148 targeted
  tests, the full backend suite (944 passed, 20 skipped, zero failed), 12
  management checks, 10 launch checks, CI syntax checks, and the production
  build pass.

## Migration 433 completion record

- `medicine-ball-scoop-toss` is now the exact standing two-hand forward
  free-flight task. Its one selectable review variant declares stance, ball
  start, hinge and extension, release vector, no-step/no-jump rule, lane,
  throw-only return, balanced finish, retrieval, and reset. Difficulty is 50
  complexity / 32 physical / 50 derived overall.
- The rotational scoop does not become a duplicate definition. It is an exact
  review variant of the existing `medicine-ball-rotational-throw` survivor,
  with a static side-on start, two-hand low back-hip load, pivot, wall target,
  throw-only finish, reset, and per-side dose. Difficulty is 58 / 34 / 58.
- The contradictory `countermovement-medicine-ball-scoop-toss` source is
  archived, unscored, unpublished, and not mapped by guesswork. Legacy rows
  355, 1153, and 1322 are archived; row 732 remains the exact forward legacy
  source. Exercise and safety skill-level classifications are null.
- The tranche adds 48 candidate evidence records, 13 oEmbed-healthy candidate
  media rows, 23 alternate assessments, four delivery profiles, two
  bidirectional review-only substitution edges, four review-only calibration
  anchors, and three quarantined test packets. Exact media match, quality,
  reviewer, card, graph, calibration, pilot, and publication approvals remain
  unset.
- The whole-library audit now reports 1,676 legacy exercises, 1,073 active
  canonical definitions, 614 raw name-similarity pairs, 586 adjudicated-
  distinct pairs, 28 unresolved pairs, zero exact collisions, and no unresolved
  score at 85 or higher.
- Release readiness remains intentionally blocked. Canonical coverage is 8.76%
  score/operations, 8.57% anatomy/support/research/alternates, 6.15% load,
  6.62% fatigue, 69.80% media-candidate sets, and 3.54% embeddable-candidate
  sets. There are 403 review-only graph edges and 635 review-only calibration
  proposals, with zero approvals or published cards.
- The independent legacy Needs Engine audit is 1,569/1,599 passing; the same 30
  failures remain: 11 missing difficulty and 19 missing dosage.
- Disposable PostgreSQL passed direct execution, repeated clean re-entry,
  production-runner registration, and a fail-closed protected-approval
  sentinel. Checksum `345872612`, focused lint, 153 targeted tests, the full
  backend suite (946 passed, 20 skipped, zero failed), 12 management checks, 10
  launch checks, CI syntax checks, and the production build all pass.

## Migration 434 completion record

- `low-hurdle-lateral-hop-to-stick` is archived, unscored, unpublished, and
  nonselectable because its source does not declare takeoff foot count,
  landing foot count or leg, obstacle dimensions, contact count, direction
  relative to stance, landing zone, hold, exit, or reset. Legacy row 1500 is
  archived without a guessed direct replacement.
- Two exact review-only definitions now cover the stationary bilateral and
  stationary same-leg lateral low-hurdle contracts. Both define the measured
  collapsible hurdle, takeoff and landing zones, one clearance, landing
  support, terminal hold, safe exit, full reset, dosage, duration, logistics,
  cumulative impact and fatigue budgets, rendering, athlete support, coach
  support, measurement, quality gates, stop rules, and substitution behavior.
- Bilateral difficulty is 48 exercise complexity / 44 physical difficulty /
  48 derived overall. Same-leg difficulty is 60 / 52 / 60. The database-wide
  verification found zero non-null exercise `skill_level` values and zero
  non-null exercise-safety `minimum_skill_level` values. Athlete proficiency
  remains exclusive to skill-library cards.
- The tranche adds 48 candidate evidence sections, 13 oEmbed-healthy candidate
  media rows, 25 alternate assessments, four delivery profiles, six
  review-only progression/regression edges, four review-only calibration
  proposals, and three quarantined test packets. Exact media match, quality,
  captions, accessibility, reviewer, graph, calibration, card, pilot, and
  publication approval remain unset.
- Six new similarity neighbors are recorded as mechanically distinct. The
  older generic `low-hurdle-hop-to-stick` remains in human review against both
  exact lateral cards because its direction and foot contract are missing.
  The final audit has 1,676 legacy exercises, 1,074 active definitions, 623 raw
  pairs, 594 adjudicated-distinct pairs, 29 unresolved pairs, zero exact
  collisions, and no unresolved score at 85 or higher.
- Canonical coverage is 8.94% score/operations, 8.75% anatomy/support/candidate
  research/alternates, 6.33% load, 6.80% fatigue, 69.83% media-candidate sets,
  and 3.72% embeddable-candidate sets. There are 409 review-only graph edges
  and 639 review-only calibrations, with zero approvals or published cards.
- The independent legacy Needs Engine audit is 1,568/1,598 passing. Its 30
  remaining blockers are unchanged: 11 missing difficulty and 19 missing
  dosage profiles.
- Disposable PostgreSQL passed direct execution, clean repeated re-entry,
  runner registration, final checksum verification, generated-packet
  validation, and a protected-field tamper test that failed closed. The
  checksum is `1852353026`. Focused ESLint and 145 targeted tests pass; the full
  backend suite reports 948 passed, 20 intentionally skipped, and zero failed.
  Twelve management checks, ten launch checks, CI syntax checks, and the
  production build also pass.

## Migrations 435–436 completion record

- `rotational-bound-to-stick` and `rotational-broad-jump-to-stick` are archived,
  unscored, unpublished, and nonselectable because their sources omit support,
  landing-leg relationship, exact turn, projection heading, contacts,
  approach, landing orientation, hold, exit, and reset. Legacy rows 726, 1378,
  and 1488 are archived without a guessed canonical mapping.
- Two exact review-only cards now cover the stationary opposite-leg
  90-degree rotational bound and the stationary bilateral 90-degree rotational
  broad jump. Both define exact support, one flight, projection, whole-body
  turn, landing target and heading, hold, exit, reset, dosage, duration,
  logistics, cumulative fatigue and impact budgets, substitutions, persistence,
  user support, coach support, athlete rendering, quality gates, and stop rules.
- Opposite-leg difficulty is 68 exercise complexity / 66 physical difficulty /
  68 derived overall. Bilateral broad-jump difficulty is 64 / 60 / 64. Overall
  is `max(complexity, physical)`. Database-wide verification found zero non-null
  exercise `skill_level` values and zero non-null exercise-safety
  `minimum_skill_level` values; athlete levels remain exclusive to skill cards.
- The research tranche adds 64 candidate evidence records, 16 oEmbed-healthy
  candidate videos, 32 alternate assessments, four contextual profiles, six
  review-only graph edges, four review-only score calibrations, and four
  migration-time automated card packets. No exact-match, quality, caption,
  accessibility, reviewer, media, graph, calibration, pilot, or publication
  approval was inferred.
- Four ambiguous source-to-exact comparisons remain human-review decisions.
  Three exact boundaries plus migration 436's two surfaced-neighbor boundaries
  are deterministic and identity-only. The exact bilateral broad jump is
  distinct from a minimal-displacement two-foot quarter turn because it
  requires purposeful displaced horizontal projection; it is distinct from a
  180-degree jump because the turn angle and finish heading differ.
- The whole-library audit now reports 1,676 legacy exercises, 1,074 active
  canonical definitions, 620 raw pairs, 592 adjudicated-distinct pairs, 28
  unresolved pairs, zero exact collisions, and no unresolved score at 85 or
  higher. All active cards remain quarantined and zero are published.
- Canonical coverage is 9.12% score/operations, 8.94%
  anatomy/support/candidate research/alternates, 6.33% load, 6.80% fatigue,
  69.93% media-candidate sets, and 3.91% embeddable-candidate sets. There are
  415 review-only graph edges and 643 review-only calibrations, with zero
  approvals and zero phase depth.
- The legacy Needs Engine surface is 1,565/1,595 passing; the unchanged 30
  blockers are 11 missing difficulty and 19 missing dosage profiles. Release
  remains blocked by publication depth, human media review, graph approval,
  independent calibration, and a real coach pilot.
- Disposable PostgreSQL passed direct execution, clean repeated re-entry,
  runner registration, generated-packet validation, exact row-count and global
  level-absence checks, and rollback-only protected-state sentinels. Checksums
  are `3046399054` and `1185337150`. Focused lint and 148 targeted tests pass;
  the full backend suite reports 951 passed, 20 skipped, and zero failed.
  Management, launch, CI syntax, and production-build checks also pass.

## Migrations 437–440 completion record

- Migration 437 retires the direction-ambiguous `single-leg-hop-to-stick` and
  contact-ambiguous `single-leg-pogo-hold-stick` sources. It adds exact
  stationary same-leg vertical and forward hop-to-stick definitions and an
  exact stationary repeated single-leg pogo-to-terminal-stick variant. The
  cards declare projection, support, flights and contacts, terminal action,
  exit, reset, anatomy, laterality, load, fatigue, recovery, cumulative impact,
  duration, logistics, substitutions, persistence, coach support, athlete
  support, quality gates, and stop rules.
- Proposed complexity / physical / derived-overall difficulty is 42 / 40 / 42
  for the vertical hop, 44 / 42 / 44 for the low-amplitude forward hop,
  50 / 50 / 50 for the moderate-distance forward hop, and 50 / 56 / 56 for
  the terminal-stick pogo. Overall is always the maximum of exercise
  complexity and physical difficulty; no athlete skill level is assigned.
- The research packet adds 80 candidate section-evidence rows, 21 candidate-
  only oEmbed-healthy media rows, 35 alternate assessments, eight delivery
  profiles, ten review-only graph proposals, eight review-only calibration
  proposals, and five quarantined card packets. Automated checks establish
  link/embed health only. Exact movement match, playback, safety, instruction
  quality, captions, accessibility, demonstration quality, reviewer identity,
  and approval remain unset.
- Migration 438 closes six surfaced exact boundaries: one flight versus three,
  vertical projection versus lateral hurdle clearance, no turn versus a
  90-degree turn, and same-leg forward landing versus opposite-leg bounding.
  It archives `single-leg-rebound-hop` because direction, amplitude, contact
  count, landing sequence, repetition boundary, terminal action, exit, and
  reset are absent. The prior pogo/rebound comparison remains a historical
  `needs_human_review` decision; no guessed mapping is created.
- Migration 439 audits the final 23 score-72+ pairs. It records the completed
  Landmine Split Squat and general Split Squat as distinct because the fixed
  pivot, diagonal bar path, rack, orientation, pickup, and rerack contracts
  differ. Twenty-three underspecified legacy labels are archived with their
  exact missing-fact lists and nonprescribable test packets. This includes the
  ambiguous A-Skip/Pogo hybrid, mixed-base hip-flexor hold, generic hurdle and
  hurdle-to-box labels, underspecified hamstring curls, reactive cut, build-up
  sprint, three-bound series, balance/catch, bear-position tap, rebound broad-
  jump compound, continuous hurdle, landmine handle deadlift, generic landing,
  triple-line hop, rope/towel pull, eccentric external rotation, ladder/two-
  foot hop, and band-assisted/resisted rebound sources.
- The resulting whole-library audit covers all 1,676 legacy rows and 1,050
  active canonical definitions. All 569 raw score-72+ name-similarity pairs are
  adjudicated distinct; unresolved pairs and exact collisions are both zero.
  All active cards remain quarantined pending their real human gates. The
  disposable database verifies zero exercise `skill_level` values, zero
  exercise-safety `minimum_skill_level` values, and zero exercise-scaling skill
  levels, while all 1,112 skill-library cards retain their formal levels.
- Migration 440 closes the separate legacy Needs Engine data-quality backlog:
  11 published exercises receive provisional complexity/physical difficulty
  profiles and 19 receive exact default dosage units, timing, rest, RPE ranges,
  load notes, duration estimates, contact accounting, and stop conditions. The
  Needs Engine audit is now 1,567/1,567 passing. These are generation-ready
  legacy profiles that still require program/calibration review; they are not
  canonical card, media, calibration, or publication approvals.
- Canonical release readiness remains intentionally blocked: zero definitions,
  variants, delivery profiles, graph edges, and calibration anchors are
  approved or published, every phase has zero released pool depth, and no real
  coach pilot exists. Current candidate coverage is 9.43% score/operations,
  9.24% anatomy/support/research/alternates, 6.48% load, 6.95% fatigue,
  70.19% three-to-five media candidates, and 4.19% three-to-five embeddable
  candidates. There are 425 review-only graph edges and 651 review-only score
  proposals.
- Disposable PostgreSQL passed direct application, deterministic repeated
  re-entry, normal platform boot, and checksum registration. Checksums are
  `1814671578`, `2398239591`, `3141799399`, and `4142429527`. Focused ESLint,
  104 difficulty/identity tests, the full platform suite (705 passed), the full
  backend suite (956 passed, 20 intentionally skipped, zero failed), 12
  management checks, 10 launch checks, backend syntax checks, and the
  production build pass.

## Box, Drop, and Depth Jump baseline completion (migrations 441–442)

- Migration 441 completes the active Box Jump, Drop Jump, and Depth Jump
  baselines. Box Jump is a stationary bilateral countermovement floor-to-box
  jump with a whole-foot top landing and step-down reset. Drop Jump is the
  short-contact bounce strategy. Depth Jump is a platform step-off followed by
  one continuous countermovement that prioritizes maximal rebound height.
- Proposed exercise complexity / physical difficulty / derived overall is
  42 / 44 / 44 for Box Jump, 58 / 64 / 64 for Drop Jump, and 60 / 68 / 68 for
  Depth Jump. Overall is the maximum of exercise complexity and physical
  difficulty. No exercise card receives an athlete skill or proficiency level.
- Each card now has complete controlled taxonomy, anatomy, joint actions,
  planes and laterality, equipment/environment/population gates, load and
  fatigue profiles, cumulative contact and impact accounting, duration,
  substitutions, persistence, coach and athlete support, quality gates, and
  stop rules. The active baselines have four contextual delivery profiles in
  total, six review-only relationship proposals, six review-only calibration
  proposals, and three automated quarantine packets.
- Each card has all 16 candidate evidence sections, five oEmbed-healthy media
  candidates, and five alternate assessments. oEmbed establishes link and
  iframe health only. Exact strategy match, full playback, instruction and
  safety quality, captions, accessibility, reviewer identity, and approval are
  deliberately unset.
- Migration 442 closes the seven similarity neighbors exposed by the clearer
  names: Box Jump versus lateral, jump-over, Depth Jump, and single-leg lateral
  box work; Countermovement Jump and Countermovement Jump Rebound versus Depth
  Jump; and Drop Jump versus Jump Rope Bounce. Each decision is based on
  action order, support, direction, equipment, contacts, landing surface, or
  terminal action and creates no content or approval authority.
- The final audit remains 1,676 legacy rows and 1,050 active canonical
  definitions, with all 569 score-72+ name-similarity pairs adjudicated,
  zero unresolved pairs, and zero exact collisions. Needs Engine remains
  1,567/1,567 passing. Candidate coverage is now 9.71% score/operations,
  9.52% anatomy/support/research/alternates, 6.48% load, 6.95% fatigue,
  70.48% media sets, and 4.48% embeddable media sets. Graph and calibration
  queues contain 431 and 657 review-only records, respectively.
- Disposable PostgreSQL passed direct migration application, database
  assertions, platform boot registration, and checksum validation. Checksums
  are `2724476034` and `1187494205`. Focused ESLint and 155 targeted tests pass;
  the complete backend suite reports 958 passed, 20 intentionally skipped,
  and zero failed. The production build passes.

## Squat Jump, Countermovement Jump, and CMRJ completion (migrations 443–444)

- Migration 443 completes the three stable active identities rather than
  restoring their archived duplicate cards. Squat Jump is a motionless
  hands-on-hips partial-squat start with no preparatory dip. Countermovement
  Jump is one stationary natural-arm dip-and-drive, one flight, a controlled
  bilateral floor landing, and reset. Countermovement Jump Rebound is one high
  active floor CMJ linked to exactly one immediate vertical rebound, followed
  by a controlled final landing; it has exactly two flights and two landings.
- Proposed exercise complexity / physical difficulty / derived overall is
  40 / 44 / 44, 42 / 46 / 46, and 54 / 58 / 58 respectively. Overall remains
  the maximum of exercise complexity and physical difficulty. Exercise cards
  receive no athlete proficiency level; all 1,112 skill-library cards retain
  their formal levels.
- Each card has 16 current candidate evidence sections, five current
  oEmbed-healthy title-level media candidates, five alternate assessments,
  exact identity and readiness requirements, contextual dosage, duration,
  cumulative contact/fatigue/impact budgets, substitution revalidation,
  persistence, separate coach and athlete rendering, and a quarantined test
  packet. There are five contextual profiles, six new review-only graph
  proposals, and six new review-only calibration proposals across the cohort.
- Migration 444 aligns those records with the independent
  `canonical-card-audit-v1` field contract: controlled taxonomy keys, array-
  shaped joint actions, canonical planes/laterality, explicit load and recovery
  fields, bodyweight equipment sentinel, weekly exposure and sequencing,
  member support, coach corrections and group management, support escalation,
  retention/change-impact policy, and controlled graph dimensions.
- The independent audit now leaves exactly four blockers on each card:
  `CARD-MEDIA-01`, `CARD-PUBLISH-01`, `CARD-GRAPH-03`, and
  `CARD-CALIBRATION-01`. Those are intentionally human gates. Exact media
  match, full playback, captions, quality, reviewer identity, graph approval,
  calibration approval, and publication remain unset.
- The full identity audit remains 569 raw score-72+ pairs, 569 adjudicated,
  zero unresolved, and zero exact collisions. The legacy Needs Engine audit
  remains 1,567/1,567 passing. The graph and calibration queues now contain
  437 and 663 review-only records; approved and published counts remain zero.
- Disposable PostgreSQL passed both migrations, internal invariants,
  independent canonical audit, platform registration, and checksums
  `2596367278` and `2362638888`. The final validation run passed focused
  ESLint, 157 targeted canonical/difficulty tests, all 709 platform tests, and
  the full backend suite with 960 passes and 20 intentional skips. The
  production build also passed; its only output was non-blocking dependency
  freshness and bundle-size warnings.

## Bilateral horizontal-jump foundations (migration 445)

- Standing Broad Jump, Broad Jump to Stick, Repeated Broad Jump, and Triple
  Broad Jump retain their stable definition IDs and slugs but now have exact
  version-2 contracts. They respectively mean one maximal measured jump, one
  quality-first jump with a held landing, a flexible two-or-more linked-jump
  training series, and exactly three maximal linked measured jumps.
- The duplicate active Broad Jump to Stick source variant is archived under
  the stable baseline. A controlled `tape_measure` equipment key is added for
  measured profiles; definition and profile logistics distinguish a measured
  lane from a bodyweight training lane.
- Complexity/physical/overall scores are 46/52/52, 44/48/48, 54/62/62, and
  58/66/66. Overall is the maximum of exercise complexity and physical
  difficulty. No athlete skill or proficiency classification is present.
- Every card has 16 candidate evidence sections, five current title-level
  oEmbed-healthy media candidates, five alternate assessments, two contextual
  profiles, complete dosage/time/measurement/support data, review-only graph
  and calibration proposals, and a quarantined automated test packet.
- The independent `canonical-card-audit-v1` leaves only `CARD-MEDIA-01`,
  `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` on each card.
  Full playback, exact match, captions, accessibility, demonstration quality,
  reviewer identity, score approval, graph approval, and publication remain
  unset.
- The new aliases surfaced two low-score neighbors; explicit bilateral versus
  unilateral and one-flight versus exact-three-flight boundaries close both.
  The full audit is now 572 raw score-72+ pairs, 572 adjudicated, zero
  unresolved, and zero exact collisions. Review-only graph/calibration queues
  are 443/671; approved and published counts remain zero.
- Disposable PostgreSQL passed direct application, a second idempotent
  application, independent audit assertions, and real platform boot
  registration. Migration 445 is registered with checksum `846816454`.
  Focused ESLint, JSON registry validation, 158 targeted research/difficulty
  tests, all 710 platform tests, and the complete backend suite with 961
  passes, 20 intentional database-gated skips, and zero failures all pass.
  The production build passes with only non-blocking dependency-freshness,
  browsers-data, and bundle-size warnings.

## Drop-landing terminal-stick foundations (migration 446)

- `Drop Landing to Stick` remains the stable bilateral elevated step-off,
  one-flight, first-contact terminal-stick identity. The archived stable
  `Single-Leg Drop Landing to Stick` definition is restored as a separate
  active card; legacy sources 1494 and 1542 return to that unilateral lineage.
  Duplicate active baselines are archived.
- Platform height, lead foot, landing side, hold, attempts, and recovery are
  explicit modifiers or dose. No-flight snap-downs, lateral travel, active
  floor hops, kicking-recovery landings, and immediate rebound drop jumps are
  separate identities. Eight deterministic boundaries cover the principal
  neighbors and the four low-score pairs surfaced by reactivation.
- Bilateral complexity/physical/overall difficulty is 46/52/52; unilateral is
  58/62/62. Overall is the maximum of exercise complexity and physical
  difficulty. All nine affected legacy exercise and safety rows have no
  athlete skill or proficiency level.
- Each card has two contextual delivery profiles, 16 candidate evidence
  sections, five currently oEmbed-healthy media candidates, five alternate
  decisions, two review-only calibration anchors, exact dose/time/contact and
  fatigue-impact budgets, substitution revalidation, persistence, athlete
  support, coach support, and a quarantined automated packet. Six graph
  proposals remain review-only. No media, score, graph, or publication
  approval was created.
- The independent audit reports 1,676/1,676 legacy mappings, 1,051 active
  definitions, 577 raw score-72+ identity pairs, 577 adjudications, zero
  unresolved pairs, and zero exact collisions. Each target card has only the
  four human blockers: `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`.
- Disposable PostgreSQL passed direct application, idempotent re-entry,
  internal assertions, independent audit, and real boot registration with
  checksum `2335192458`. Focused lint and JSON validation, 159 targeted tests,
  all 711 platform tests, and the complete backend suite with 962 passes and
  20 intentional skips pass. The production build passes with the existing
  non-blocking dependency-freshness and large-chunk warnings.

## Front-loaded squat identity and family completion (migration 447)

- Migration 447 corrects the prior flattening of barbell, Goblet, double
  independent front rack, and single unilateral kettlebell rack squats. Four
  stable active cards now carry exact support, implement-count, symmetry,
  pickup, set-down/re-rack, safe-failure, dose, duration, fatigue, logistics,
  substitution, persistence, athlete, coach, and support-operation contracts.
- Eleven exact variants are difficulty-scored using exercise complexity and
  physical difficulty only. Overall is always their maximum. The migration
  explicitly clears all 16 affected legacy exercise skill values and safety
  minimum-skill values and rejects proficiency classification in definition,
  variant, or source payloads.
- The broad implement umbrella, separate heels-elevated definition, and
  separate slow-eccentric Goblet definition are archived. Heel support is an
  exact variant; tempo is dosage. Goblet, double-rack, and single-rack cards
  are restored, with legacy-source distribution 5 / 8 / 2 / 1.
- Each card has 16 candidate evidence rows, five oEmbed-healthy media
  candidates, five alternate decisions, and a quarantined automated packet.
  There are 11 review-only contextual profiles, 11 review-only graph edges,
  and 22 review-only difficulty anchors. Automated link/embed health creates
  no playback, exactness, captions, quality, reviewer, or approval evidence.
- Nine name-similarity neighbors surfaced after restoration and are closed as
  distinct using action, support, stance, travel, load-path, and laterality
  boundaries. The resulting independent audit reports 1,676/1,676 legacy
  mappings, 1,051 active definitions, 588 raw pairs, 588 adjudications, zero
  unresolved pairs, and zero exact collisions. All 1,051 cards remain
  quarantined; graph and calibration queues are 459 and 697 review-only rows.
- Disposable PostgreSQL passed rollback rehearsal, direct application,
  idempotent repair, persisted and read-only audits, exact row assertions, and
  production-runner registration. Migration 447 is registered with checksum
  `1154198368`. Focused lint/JSON checks and 160 focused tests pass, as do all
  712 platform tests and the full backend suite with 963 passes, 20 intentional
  skips, and zero failures. Twelve management checks, ten launch checks,
  backend syntax checks, and the production build pass. Build output retains
  only the existing dependency-freshness and large-chunk warnings.

## Floor-bridge identity and family completion (migration 448)

- Migration 448 restores four stable cards: bilateral dynamic Glute Bridge,
  bilateral Glute Bridge Iso Hold, dynamic Single-Leg Glute Bridge, and
  Single-Leg Glute Bridge Iso Hold. Contraction mode and lower-body support
  count are hard identity boundaries because they change repetition, duration,
  laterality, side dose, fatigue, validity, and stop contracts.
- Five bilateral dynamic variants preserve bodyweight, barbell, dumbbell,
  kettlebell, and sandbag loading. Two bilateral hold variants preserve
  standard and long-lever setups. The two single-leg cards each retain one
  exact bodyweight baseline. Difficulty is exercise complexity plus physical
  difficulty only, and overall is their maximum; no exercise proficiency level
  is created.
- Legacy mapping is 6 / 3 / 1 / 2 across bilateral dynamic, bilateral
  isometric, unilateral dynamic, and unilateral isometric definitions. Three
  redundant variants and three redundant definitions remain archived with
  stable survivor provenance.
- The cohort includes 64 evidence rows, 20 currently oEmbed-healthy media
  candidates, 20 alternate decisions, nine contextual delivery profiles, 11
  review-only graph proposals, 18 review-only score anchors, four automated
  packets, complete fatigue/time/logistics/measurement/substitution data, and
  separate athlete, coach, and support-operation rendering. No playback,
  exact-match, caption, quality, reviewer, graph, score, card, or publication
  approval is fabricated.
- Disposable PostgreSQL passed direct application, repeated idempotent
  application, internal assertions, persisted independent audit, zero-pair
  identity reporting, and production-runner checksum registration. Migration
  448 is registered with checksum `3918717137`; focused lint and JSON
  validation, 161 focused research/difficulty tests, all 713 platform tests,
  and the full backend suite with 964 passes, 20 intentional database-gated
  skips, and zero failures all pass. Twelve management checks, ten launch
  checks, backend syntax checks, and the production build pass with only the
  existing dependency-freshness and large-chunk warnings.
- The resulting audit reports 1,676/1,676 legacy mappings, 1,054 active
  definitions, 594 raw and adjudicated score-72+ pairs, zero unresolved pairs,
  and zero exact collisions. Graph/calibration review queues are 470/715 with
  zero approvals. Every target card has exactly the four required human
  blockers: media review, graph approval, independent calibration, and
  publication approval.

## Single-Leg Romanian Deadlift family completion (migration 449)

- Twelve legacy source records now resolve to one stable Single-Leg Romanian
  Deadlift definition. Ten active and two archived exact variants preserve
  support, reach, implement, loading side/symmetry, barbell loading, and the
  slow-eccentric assisted-return prescription without creating duplicate
  cards. Three sport labels are contextual profiles rather than identities.
- All active variants are assessed with exercise complexity and physical
  difficulty only; overall is their maximum. No exercise card, source payload,
  or safety payload retains an athlete proficiency level. Skill-library cards
  are outside this migration and remain unchanged.
- The completed packet includes 16 evidence sections, five currently oEmbed-
  healthy discovery candidates, five alternate assessments, 13 delivery
  profiles, 18 review-only relationship proposals, 20 review-only difficulty
  anchors, complete generation/support contracts, and one quarantined
  automated test packet. Automated link health does not claim playback,
  exactness, captions, quality, reviewer, or approval.
- Provenance now explicitly supersedes PMID 24978835 because it studies stiff-
  leg deadlift versus leg curl rather than Single-Leg Romanian Deadlift. Five
  direct research/technique sources were added to source-registry version
  `2026-08-02.63`.
- Disposable PostgreSQL passed direct application, repeated idempotent
  application, internal assertions, independent audit, and production-runner
  registration. Migration 449 is registered with checksum `271198898`.
  Focused lint and registry validation pass, as do 162 focused tests, all 714
  platform tests, and the full backend suite with 965 passes, 20 intentional
  database-gated skips, and zero failures. Twelve management checks, ten launch
  checks, backend syntax checks, and the production build pass; the build
  retains only dependency-freshness and large-chunk warnings.
- The global audit remains intentionally quarantined: 1,054 active definitions,
  594/594 adjudicated similarity pairs, zero unresolved pairs, zero exact
  collisions, 488 review-only graph rows, 735 review-only calibration rows,
  and no approvals. The target packet has exactly the media, graph,
  calibration, and publication human-review blockers.

## Cossack Squat current-contract completion (migration 450)

- Migration 450 preserves one Cossack Squat identity and all 14 legacy source
  mappings/aliases. It retains ten prior selectable exact variants, creates the
  omitted stable-hand-supported variant, and archives two nonselectable legacy
  placeholders whose reach direction or implement/load position is unknown.
- Eleven active variants now satisfy anatomy, controlled taxonomy, difficulty,
  load, fatigue/recovery, equipment, contextual delivery, generation, athlete,
  coach, and support-operation contracts. Twenty-two delivery profiles, 18
  candidate evidence rows, 17 outgoing review-only graph edges, 22 active
  review-only calibration anchors, and one quarantined packet remain.
- Difficulty is exercise complexity and physical difficulty only. Overall is
  always their maximum. All 14 source exercise skill fields and their safety
  minimum-skill fields are null; dedicated skill-library levels are unchanged.
- Source-registry version `2026-08-02.64` adds wide-stance/foot-angle squat
  biomechanics and a direct Monash Cossack technique guide. Five current
  YouTube candidates passed oEmbed metadata checks. No full-playback, exactness,
  captions, accessibility, quality, reviewer, graph, calibration, card, or
  publication approval is claimed.
- Disposable PostgreSQL passed direct application, repeated idempotent repair,
  internal assertions, persisted independent audit, and production-runner
  execution. Migration 450 is registered with checksum `3032492193`. Focused
  research/difficulty validation passes 164 tests; all 716 platform tests pass,
  and the full backend suite reports 967 passes, 20 intentional database-gated
  skips, and zero failures. Focused lint, registry parsing, 12 management
  checks, 10 launch checks, backend syntax checks, and the production build
  pass; only the existing dependency-freshness and large-chunk warnings remain.
- The global audit remains at 1,054 quarantined definitions with 594/594
  adjudicated similarity pairs, no unresolved pair, and no exact collision.
  Review-only graph/calibration queues are 490/737 with zero approvals. The
  Cossack packet has exactly the four legitimate media, graph, independent-
  calibration, and publication gates.

## Floor Press current-contract completion (migration 451)

- Migration 451 consolidates nine legacy records under one stable identity,
  preserves all source mappings and aliases, and reuses nine stable exact-
  variant UUIDs. All nine variants satisfy the anatomy, taxonomy, difficulty,
  load, fatigue/recovery, equipment, environment/population, contextual
  delivery, generation, athlete, coach, and support-operation contracts.
- The family contains 18 active delivery profiles, 16 candidate evidence
  rows, five media candidates, 12 alternate-definition assessments, 16
  outgoing review-only graph edges, 18 review-only calibration anchors, and
  one quarantined automated packet. All legacy exercise and safety skill-level
  fields are null; difficulty means complexity and physical difficulty only.
- Source-registry version `2026-08-02.65` contains 256 provenance entries and
  corrects PMID 23096062 as unrelated shoulder-press evidence. The five
  YouTube candidates passed oEmbed link/title/channel checks only. No full-
  playback, exactness, captions, accessibility, quality, reviewer, graph,
  calibration, card, or publication approval is claimed.
- Disposable PostgreSQL passed direct application, repeated idempotent repair,
  internal assertions, persisted independent audit, and production-runner
  registration. Migration 451 is registered with checksum `2720709609`.
  Focused research/difficulty validation passes 166 tests; all 718 platform
  tests pass, and the full backend suite reports 969 passes, 20 intentional
  database-gated skips, and zero failures. Focused lint, registry parsing, 12
  management checks, 10 launch checks, backend syntax checks, and the
  production build pass; only the existing dependency-freshness and large-
  chunk warnings remain.
- The global persisted audit remains at 1,054 quarantined definitions with
  598/598 adjudicated score-72+ pairs, no unresolved pair, and no exact
  collision. Review-only graph/calibration queues are 506/755 with zero
  approvals; healthy three-to-five-link candidate coverage is 67/1,054.
  Floor Press has exactly the four legitimate media, graph, independent-
  calibration, and publication gates.

## Rotational Ball Slam current-contract completion (migration 452)

- Migration 452 consolidates five legacy records beneath one stable identity,
  preserves their aliases and mappings, retains three active exact variants,
  and archives two stable legacy variants that are delivery-only or duplicate.
- Each active variant satisfies anatomy, controlled taxonomy, difficulty, load,
  fatigue/recovery, equipment, environment/population, delivery, generation,
  athlete, coach, and support-operation contracts. Nine active profiles cover
  output and capped capacity use, with explicit duration, lane, traffic,
  substitution, persistence, fatigue, and ball-impact accounting.
- Difficulty contains only exercise complexity and physical difficulty; overall
  is their maximum. Exercise and safety skill fields are null, while the
  separate skill library is unchanged. Ball-to-floor impacts are tracked
  separately from athlete landing contacts.
- The packet contains 16 evidence rows, five candidate media records, 12
  alternate assessments, six outgoing review-only graph rows, six review-only
  calibration anchors, and one quarantined automated packet. oEmbed health
  establishes only current link/title/channel/embed metadata.
- Source-registry version `2026-08-02.66` contains 257 entries. Direct dynamic
  floor-slam evidence is sparse; adjacent rotational-throw and upper-body
  plyometric evidence is marked as adjacent and cannot be treated as direct
  validation or approval.
- Disposable PostgreSQL passed direct application, repeated idempotent
  application, internal assertions, persisted independent audit, and
  production-runner registration. Migration 452 is registered with checksum
  `2592677774`. Focused validation passes 168 tests; all 720 platform tests
  pass, and the backend suite reports 971 passes, 20 intentional skips, and
  zero failures. Focused lint, 12 management checks, 10 launch checks, syntax
  checks, and the production build pass; existing dependency-age and large-
  chunk warnings remain.
- The global persisted audit has 1,054 quarantined definitions, 605/605
  adjudicated score-72+ pairs, zero unresolved pair, and zero exact collision.
  Global graph/calibration queues contain 512/761 review-only rows with zero
  approvals. The target has exactly the media, graph, independent-calibration,
  and publication blockers.

## One-Arm Row current-contract completion (migration 453)

- Migration 453 corrects a nine-source inherited identity cluster. One-Arm Row
  retains sources 195, 496, 1436, and 1438; source 1434 moves to the existing
  Meadows Row; sources 1435 and 1450 move to the existing bilateral Two-Hand
  Landmine Bent-Over Row. Sources 1441 and 1448 remain archived because their
  authored hand/load sequence or attachment/support geometry is insufficient
  to create an executable exercise without guessing.
- Four selectable exact variants now cover bench-supported dumbbell, unsupported
  hinged kettlebell, standard one-arm landmine, and landmine suitcase delivery.
  They have controlled taxonomy and anatomy, difficulty-only scores, load and
  fatigue/recovery profiles, equipment/environment/population constraints,
  eight contextual profiles, duration and cumulative-budget rules, substitution
  revalidation, persistence, and separate coach/athlete/support rendering.
- The packet has 16 evidence rows, five oEmbed-healthy candidate media records,
  12 alternate assessments, eight review-only graph proposals, eight review-
  only complexity/physical-difficulty anchors, and exactly four human blockers.
  Exercise and safety skill fields are null; no skill-library level is copied
  onto the exercise card and no approval is inferred from candidate evidence.
- Source-registry version `2026-08-02.67` contains 263 provenance entries and
  adds six row sources. Direct dumbbell, kettlebell, landmine, and suitcase-row
  technique is kept separate from PMID 19620925, which compares adjacent row
  variants and is not direct dumbbell or landmine validation.
- Disposable PostgreSQL passed direct application, repeated idempotent
  application, internal assertions, the persisted independent audit, and the
  production boot runner. Migration 453 is checksummed as `1965315103`.
  Focused validation passes 170 tests; all 722 platform tests pass; the backend
  suite reports 973 passes, 20 intentional database-gated skips, and zero
  failures. Focused lint, registry parsing, 12 management checks, 10 launch
  checks, syntax checks, and the production build pass. Existing dependency-
  freshness and large-chunk warnings remain non-blocking.
- The global audit maps 1,676/1,676 legacy rows to 1,054 active definitions and
  adjudicates all 605 score-72+ pairs, with zero unresolved pair and zero exact
  collision. Global graph/calibration queues contain 520/769 review-only rows
  and zero approvals; current healthy three-to-five-link coverage is 69/1,054.
  One-Arm Row remains quarantined by `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` only.

## Short Acceleration Sprint audit hardening (migration 454)

- Migration 454 brings the previously completed 20-source Short Acceleration
  Sprint card onto the current independent-auditor contract without changing
  its identity, scores, media state, relationship review state, calibration
  state, selectability, or approval state.
- The existing six selectable exact variants and two nonselectable provisional
  variants now use controlled movement, region, equipment, laterality, and
  relationship-dimension values. Authored start/cue distinctions remain in
  detailed fields rather than being forced into controlled taxonomy keys.
- Canonical athlete, coach, support-operation, and programming fields are
  complete, including prerequisites, completion criteria, sequencing,
  interference, weekly exposure, fatigue/recovery, lane and run-out safety,
  substitution revalidation, persistence, uncertainty, escalation, and stop
  behavior. Exercise and safety skill-level fields remain null.
- The migration fails closed if the 20 sources/eight variants are missing, if
  controlled vocabulary validation fails, if human-reviewed state exists, or
  if any exercise proficiency value or approval would be created. The two
  evidence-limited variants remain nonselectable.
- Disposable PostgreSQL passed direct and repeated application, internal
  assertions, the persisted independent audit, and production-runner
  registration. Migration 454 is checksummed as `941216242`. Focused
  validation remains 170 tests; all 722 platform tests and the full backend
  suite remain green with 973 passes and 20 intentional database-gated skips.
  Focused lint, registry parsing, 12 management checks, 10 launch checks,
  syntax checks, and the production build also pass.
- The global identity and review queues remain unchanged: all 1,676 legacy
  rows map to 1,054 active definitions; all 605 score-72+ pairs are
  adjudicated with zero unresolved pair and zero exact collision; graph and
  calibration queues remain 520/769 review-only rows with zero approvals; and
  healthy three-to-five-link candidate coverage remains 69/1,054. Short
  Acceleration now retains exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`.

## Push-Up identity and family completion (migration 455)

- Migration 455 consolidates 14 executable legacy sources under stable Push-Up
  UUID `46c7611a-e107-4e32-9c81-d688e509fe73`. It closes the direct
  Feet-Elevated/Decline duplicate, moves Deficit, Pseudo-Planche, Close-Grip,
  and Weighted Vest forms beneath the family, and preserves both tempo rows as
  modifier annotations instead of multiplying identities.
- Eleven selectable exact variants cover standard floor, hands-elevated,
  feet-elevated, stable deficit, close-grip, rings, archer lateral shift,
  pseudo-planche forward lean, weighted vest, floor eccentric-only, and ring
  eccentric-only delivery. Exercise complexity and physical difficulty are
  scored independently and overall is their maximum. Exercise and safety
  proficiency fields are null; skill levels remain exclusive to skill cards.
- Generic source 585, `One-Arm Push-Up Progression`, remains archived and
  nonselectable because it omits the working hand, assistance or counterbalance,
  foot base, hand placement, range, repetition sequence, and return strategy.
  No mechanics were guessed. Push-Up versus Weighted Vest Pull-Up and Push-Up
  versus Close-Grip Bench Press are explicitly distinct by orientation, chain,
  action, support, load path, range, setup, and failure response.
- The card contains 22 contextual delivery profiles, 16 evidence sections,
  five current oEmbed-healthy media candidates, 18 alternate assessments, 22
  review-only graph proposals, and 22 review-only complexity/physical-
  difficulty anchors. All five media records remain candidates: playback,
  exact variant, captions, accessibility, safety, quality, reviewer, and
  approval are unset.
- Registry version `2026-08-02.68` contains 269 sources and adds six direct
  Push-Up technique/kinetics/activation sources. PMID 38156065 was removed
  from Push-Up provenance because it is a standing-versus-seated calf-raise
  hypertrophy study, not Push-Up evidence.
- Disposable PostgreSQL passed direct application, repeated idempotent
  application, internal fail-closed assertions, the independent persisted
  audit, and production-runner registration. The final migration checksum is
  `2540177092`. Focused validation passes 172 tests; all 724 platform tests
  pass; the backend suite reports 975 passes, 20 intentional database-gated
  skips, and zero failures. Focused lint, registry parsing, 12 management
  checks, 10 launch checks, syntax checks, diff checks, and the production
  build pass. Existing dependency-age and large-chunk warnings remain.
- The refreshed audit maps 1,676/1,676 legacy exercises to 1,048 active
  definitions and adjudicates all 604 score-72+ similarity pairs, with zero
  unresolved pair and zero exact collision. Global graph/calibration queues
  contain 542/791 review-only rows with zero approvals; current healthy
  three-to-five-link candidate coverage is 70/1,048. Push-Up remains honestly
  quarantined by exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`.

## Reverse Lunge identity and family completion (migration 456)

- Migration 456 consolidates nine source rows under stable Reverse Lunge UUID
  `f5640b99-b702-4747-80bb-b603236bbbc6`. Three executable variants are
  selectable: bodyweight full-cycle (`42/46/46` complexity/physical/overall),
  barbell front-rack (`58/68/68`), and medicine-ball chest-hold (`48/54/54`).
- The duplicate bodyweight row is archived and source 753 remains a
  slow-eccentric full-cycle dosage annotation. Generic barbell, dumbbell,
  kettlebell, and sandbag rows stay archived and nonselectable because their
  exact rack, implement-count, carry, or hold facts are absent. No mechanics
  were inferred from names or media metadata.
- All active variants have controlled taxonomy, anatomy, joint actions, planes,
  laterality, load, fatigue/recovery, equipment, environment/population,
  cumulative budgets, quality gates, stop rules, substitutions, duration,
  persistence, and separate athlete/coach/support rendering. Six contextual
  delivery profiles declare capacity and resilience dosing. Exercise and
  safety skill/proficiency fields are null; difficulty is exercise complexity
  plus physical difficulty, with overall equal to their maximum.
- Registry `2026-08-02.69` contains 274 sources and distinguishes one direct
  reverse-lunge kinetics study from four adjacent loading, trunk, or instruction
  sources. The packet contains 16 evidence sections, five current oEmbed-
  healthy candidate videos, 16 alternate assessments, six review-only graph
  proposals, six review-only calibration anchors, and one automated test
  packet. No playback, content, reviewer, or approval state is claimed.
- Disposable PostgreSQL passed direct and idempotent application, fail-closed
  internal assertions, independent persisted audit, and production-runner
  registration. Migration 456 is checksummed as `2213004666`. Focused tests
  pass 174 assertions; all 726 platform tests pass; the backend suite reports
  977 passes, 20 intentional database-gated skips, and zero failures. Focused
  lint, CI management/launch/syntax checks, diff checks, registry parsing, and
  the production build pass.
- The refreshed global audit maps 1,676/1,676 legacy rows to 1,048 active
  definitions and adjudicates all 604 score-72+ similarity pairs, with zero
  unresolved pair and zero exact collision. Graph/calibration queues contain
  548/797 review-only rows with zero approvals; healthy three-to-five-candidate
  coverage is 71/1,048. Reverse Lunge remains quarantined by exactly
  `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`.

## Lateral Lunge identity and family completion (migration 457)

- Migration 457 audits eight original source records. Seven remain associated
  with stable Lateral Lunge UUID `6a58d6cc-4a46-409a-9b89-c4330c3b8d6f`;
  source 1055 moves to stable Cossack Squat because its executable instructions
  specify a fixed wide stance and lateral weight shift without a step-out.
- One exact bodyweight step-out full-cycle variant is selectable at
  `46/48/48` complexity/physical/overall. Source 752 is a slow-eccentric
  full-cycle modifier annotation. Sources 63, 174, 385, 475, 1010, and 1328
  remain archived and nonselectable because their stance/step protocol,
  implement count, rack/carry/hold, load side, or compound instructions do not
  define a single executable identity. No mechanics were inferred.
- The active card includes controlled squat-and-brace taxonomy, complete
  anatomy, joint actions, plane/laterality, load, fatigue/recovery, equipment,
  environment/population constraints, cumulative fatigue/impact budgets,
  prerequisites, quality gates, stop rules, uncertainty handling,
  substitutions, duration, persistence, and separate athlete/coach/support
  rendering. Two contextual delivery profiles cover capacity and resilience.
- Registry `2026-08-02.70` contains 277 sources and distinguishes direct
  side-lunge loading evidence from adjacent NSCA technique and ACE compound-
  workout instruction. The packet has 16 evidence sections, five oEmbed-
  healthy unapproved candidates, 18 alternate assessments, six review-only
  graph proposals, two review-only calibration anchors, and one automated test
  packet. No playback, content, reviewer, or approval state is claimed.
- Difficulty is exercise complexity plus physical difficulty, with overall
  equal to their maximum. Exercise and safety skill/proficiency values remain
  null; skill levels belong only to skill-library cards.
- Disposable PostgreSQL passed direct and repeated application, fail-closed
  assertions, independent persisted audit, and production-runner registration.
  Migration 457 is checksummed as `2132631705`. Focused tests pass 176
  assertions; all 728 platform tests pass; the backend suite reports 979
  passes, 20 intentional database-gated skips, and zero failures. Focused lint,
  registry parsing, CI management/launch/syntax checks, diff checks, and the
  production build pass.
- The refreshed audit maps all 1,676 legacy exercises to 1,048 active
  definitions and adjudicates all 604 score-72+ pairs with zero unresolved pair
  and zero exact collision. Global graph/calibration queues contain 554/799
  review-only rows with zero approvals; healthy three-to-five-candidate media
  coverage is 72/1,048. Lateral Lunge remains quarantined by exactly
  `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`.

## Medicine Ball Shot-Put identity and family completion (migration 458)

- Migration 458 reassesses all seven sources under stable Medicine Ball
  Shot-Put UUID `5beb30c6-84d5-4210-8eee-ea29e7032e4e`. Sources 154, 357,
  1002, 1197, 1270, 1318, and 1478 remain mapped and traceable but all seven
  source variants are archived and nonselectable because at least one exact
  orientation, stance, ball-position, pivot, target/receiver, release,
  catch/return, finish, or reset fact is absent or permits conflicting choices.
- One research-authored working specification is selectable only in review:
  static side-on stance, rear-shoulder/upper-chest ball start, rear-hip load,
  declared natural pivot, unilateral wall release, balanced finish, no catch,
  safe retrieval, full reset, and balanced sides. Its exercise complexity,
  physical difficulty, and overall scores are `60/56/60`.
- The active variant includes controlled push/rotate/brace/throw taxonomy,
  anatomy, joints/actions/planes/laterality, ballistic load, fatigue/recovery,
  cumulative throw/press/sport budgets, zero athlete-landing impact, equipment,
  environment/population constraints, two Output profiles, quality gates, stop
  rules, uncertainty handling, duration, persistence, substitutions, and
  athlete/coach/support rendering.
- Registry `2026-08-02.70` remains at 277 sources. Sixteen evidence sections
  distinguish direct rotational medicine-ball power evidence from adjacent
  seated, supine, upper-body plyometric, youth-supervision, and track-and-field
  evidence. Five oEmbed-healthy videos remain unreviewed candidates. The packet
  also has 18 alternate assessments, four review-only graph proposals, two
  review-only calibration anchors, and one automated test packet.
- Difficulty is exercise complexity plus physical difficulty, with overall
  equal to their maximum. Exercise and safety skill/proficiency values are
  null; skill levels remain exclusive to skill-library cards.
- Disposable PostgreSQL passed direct and idempotent application, internal
  assertions, independent audit, and production-runner registration. Migration
  458 is checksummed as `3889874252`. Focused tests pass 177 assertions; all
  729 platform tests pass; the backend suite reports 980 passes, 20 intentional
  database-gated skips, and zero failures. Focused lint, registry parsing, 12
  management checks, 10 launch checks, syntax/diff checks, and the production
  build pass.
- A Rollout/Shot-Put score-72 name false positive is now explicitly distinct,
  leaving 605/605 similarity pairs adjudicated, zero unresolved pair, and zero
  exact collision across 1,048 active definitions. Global graph/calibration
  queues contain 558/801 review-only rows with zero approvals; current healthy
  three-to-five-embeddable-candidate coverage is 79/1,048. Shot-Put remains
  quarantined by exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`.

## Suitcase Carry identity and family completion (migration 459)

- Migration 459 reassesses sources 204, 452, 504, 559, 1028, 1340, and 1470
  under stable Suitcase Carry UUID
  `d200b890-4a90-4b00-b0fc-242a688635a7`. All seven source variants are
  archived and nonselectable because they omit or permit alternatives for
  implement, grip/position, loaded-hand order, route, turn, foot rule, pace,
  pickup, finish, set-down, or march travel. No missing mechanic was inferred.
- Three research-authored working specifications are selectable only in review:
  straight-lane dumbbell (`40/50/50` complexity/physical/overall), straight-
  lane kettlebell (`42/50/50`), and dumbbell single-line walk (`54/46/54`).
  Each declares one implement and hand, controlled pickup and still start,
  straight no-turn route, pace, exact foot rule, finish, safe set-down, and
  balanced side dose.
- The active family includes controlled carry/locomote/brace taxonomy, full
  anatomy and laterality, load, fatigue/recovery, walking contacts separated
  from landing impact, cumulative carry/grip/trunk/gait budgets, equipment,
  environment/population constraints, six delivery profiles, quality gates,
  stop rules, uncertainty handling, duration, persistence, relationships, and
  separate athlete/coach/support rendering.
- Registry `2026-08-02.71` contains 281 sources. Sixteen evidence sections
  distinguish direct loaded-carry and unilateral-gait studies from adjacent
  postural-gait, strongman, ACSM, and youth-supervision evidence. Five current
  oEmbed-healthy videos remain unreviewed candidates. The packet also has 21
  alternate assessments, eight review-only graph proposals, six review-only
  calibration anchors, and one automated test packet.
- Difficulty is exercise complexity plus physical difficulty, with overall
  equal to their maximum. Exercise and safety skill/proficiency values are
  null; skill levels remain exclusive to skill-library cards.
- Disposable PostgreSQL passed direct and idempotent application, internal
  assertions, persisted/non-persisting audits, and production-runner
  registration. Migration 459 is checksummed as `2184062840`. Focused tests
  pass 179 assertions; all 731 platform tests pass; the backend suite reports
  982 passes, 20 intentional database-gated skips, and zero failures. Focused
  lint, registry parsing, 12 management checks, 10 launch checks, syntax/diff
  checks, and the production build pass.
- All 605 similarity pairs remain adjudicated with zero unresolved pair and
  zero exact collision across 1,048 active definitions. Global graph/
  calibration queues contain 566/807 review-only rows with zero approvals;
  the current healthy three-to-five-embeddable-candidate query covers
  89/1,048 definitions. Suitcase Carry remains quarantined by exactly
  `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`.

## Bent-Knee Soleus Raise identity and family completion (migration 460)

- Migration 460 reassesses sources 215, 365, 432, 578, 763, 1151, and 1400
  under stable Bent-Knee Soleus Raise UUID
  `6e34d34e-0118-4bce-97a1-5caa1f0ce398`. It resolves source 432's direct
  `Seated Dumbbell Calf Raise` definition collision into this family. All
  seven source variants remain traceable but archived and nonselectable because
  their exact support, knee angle, laterality, implement/count/contact, foot
  surface, range, tempo, repetition, reset, or side-switch contracts are
  incomplete or permit conflicting choices.
- Three research-authored working specifications are selectable only in review:
  bilateral seated bodyweight floor (`32/24/32` exercise complexity/physical
  difficulty/overall), unilateral seated machine (`40/50/50`), and single-leg
  seated dumbbell floor (`48/44/48`). The card describes a soleus-biased task,
  not soleus isolation. Standing straight-knee heel raise and bent-knee
  isometric hold identities remain explicitly distinct.
- The active family includes controlled plantar-flexion taxonomy, complete
  anatomy and laterality, load, fatigue/recovery, zero landing contacts,
  cumulative calf/Achilles/running/sprint/jump budgets, equipment and
  environment/population constraints, six contextual delivery profiles,
  quality gates, stop rules, uncertainty handling, duration, substitutions,
  persistence, and separate athlete/coach/support rendering.
- Registry `2026-08-02.72` contains 286 sources. Sixteen evidence sections
  separate direct knee-position, Achilles-loading, acute-swelling, activation,
  and professional-technique evidence from broader programming guidance. Five
  current oEmbed-healthy videos remain unreviewed candidates. The packet also
  has 24 alternate assessments, ten review-only graph proposals, six review-
  only calibration anchors, and one automated test packet. No playback,
  exactness, caption, accessibility, content, reviewer, or approval state is
  claimed.
- Difficulty is exercise complexity plus physical difficulty, with overall
  equal to their maximum. Exercise and safety skill/proficiency values are
  null; skill levels remain exclusive to skill-library cards.
- Disposable PostgreSQL passed direct and idempotent application, fail-closed
  assertions, persisted and non-persisting audits, and production-runner
  registration. Migration 460 is checksummed as `4019890797`. Focused tests
  pass 181 assertions; all 733 platform tests pass; the backend suite reports
  984 passes, 20 intentional database-gated skips, and zero failures. Focused
  lint, registry parsing, 12 management checks, 10 launch checks, syntax
  checks, and the production build pass.
- The refreshed audit maps all 1,676 legacy rows to 1,047 active definitions
  and keeps all 605 similarity pairs adjudicated, with zero unresolved pair
  and zero exact collision. Global graph/calibration queues contain 576/813
  review-only rows with zero approvals. The precisely defined current-card
  query finds 75/1,047 active definitions with three to five distinct healthy,
  embeddable candidate videos. Bent-Knee Soleus Raise remains quarantined by
  exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`.

## Back Squat family completion (migration 461)

- Migration 461 audits sources 1, 367, 368, 370, and 371 under stable Back
  Squat UUID `1ad09283-aa35-486f-b6bf-bdbdc1b575ee`. All five source variants
  are archived and nonselectable. Source 1 is contaminated by jump/landing
  template language; the remaining sources omit exact grip, stance, depth,
  walkout, tempo or pause duration, rack safeties, failed-rep plan, and rerack.
- Two research-authored specifications are selectable only in review: high-bar
  free-bar parallel target (`64/72/72` complexity/physical/overall) and low-bar
  free-bar parallel target (`68/76/76`). Four Capacity profiles include rack,
  safety, load, depth, fatigue/recovery, duration, persistence, and separate
  athlete/coach/support instructions. Skill/proficiency fields remain null.
- Registry `2026-08-02.73` contains 291 sources. The packet contains 16
  evidence sections, five current oEmbed-healthy unreviewed videos, 24
  alternate assessments, eight review-only graph proposals, four review-only
  score anchors, and one automated test packet. No playback or human approval
  is claimed.
- Disposable PostgreSQL passed direct, repeated, persisted/non-persisting
  audit, and production-runner execution. Checksum is `4070429771`; focused
  tests pass 183 assertions, all 735 platform tests pass, and the backend suite
  reports 986 passes, 20 intentional skips, and zero failures. Lint, registry,
  12 management, 10 launch, syntax, diff, and production-build gates pass.
- Three newly surfaced similarities—Back Squat versus Box Squat, Split Squat,
  and Front Squat—are explicitly distinct. All 608/608 pairs are adjudicated,
  with zero unresolved pair or exact collision across 1,047 active definitions.
  Graph/calibration queues contain 584/817 review-only rows and zero approvals;
  current-card distinct healthy embeddable 3–5-video coverage is 76/1,047.
  Back Squat retains exactly the media, graph, calibration, and publication
  human blockers.

## Box Jump family audit hardening (migration 462)

- Migration 462 reassesses sources 2, 1543, 1546, 1547, 1549, 1552, 1556,
  1557, and 1558 under stable Box Jump UUID
  `aa51dcd1-c8b9-456a-beb2-4abac2c9d9e9`. All nine source variants remain
  traceable but archived and nonselectable because at least one exact preload,
  arm, approach, box, landing, hold, exit, reset, or dose fact is missing.
- Four research-authored specifications are selectable only in review:
  stationary countermovement/natural arms (`48/46/48`), paused static/hands on
  hips (`54/46/54`), stationary countermovement/hands on hips (`50/46/50`),
  and one-step bilateral gather (`58/50/58`) for exercise complexity, physical
  difficulty, and derived overall. Eight Movement Intelligence/Output profiles
  define setup, dose, contacts, cumulative impact/fatigue budgets, duration,
  logistics, substitutions, persistence, and athlete/coach/support rendering.
  Exercise and safety proficiency fields remain null.
- Registry `2026-08-02.75` contains 293 sources. Sixteen evidence sections
  preserve cohort and protocol limits. Five card-v2 oEmbed-healthy candidates
  are carried to card v3 as unapproved metadata only; the attempted fresh fetch
  did not succeed and is not claimed as verification. Thirty alternate/source
  assessments, ten review-only graph proposals, eight review-only score
  anchors, and one automated packet are present.
- Disposable PostgreSQL passed atomic application after two rolled-back
  validation corrections, repeated execution, persisted/non-persisting audit,
  and production-runner registration. Migration 462 checksum is `3490248206`.
  Focused tests pass 185 assertions, all 737 platform tests pass, and the
  backend suite reports 988 passes, 20 intentional skips, and zero failures.
  Focused lint, registry parsing, syntax/diff checks, 12 management checks, 10
  launch checks, and the production build pass.
- All 608/608 similarity pairs remain adjudicated, with zero unresolved pair
  and zero exact collision across 1,047 active definitions. Global graph and
  calibration queues contain 594/825 review-only rows with zero approvals;
  exact current-card healthy embeddable 3–5-video coverage remains 76/1,047.
  Box Jump passes every machine-verifiable P0/P1 gate and remains quarantined
  by exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`.

## Nordic Hamstring family audit hardening (migrations 464–466)

- Migration 464 reassesses legacy sources 4, 574, and 839 under stable Nordic
  Hamstring Curl UUID `03894b45-360d-444b-a142-6771ce6df7dd`. All three source
  variants are archived identity quarantines because they omit exact anchor,
  assistance, contraction, range, tempo or hold, angle, catch, return, or dose
  facts. Inherited PMID `38156065` is explicitly removed because it is a calf-
  raise study, not Nordic evidence.
- Four research-authored specifications are selectable only in review:
  five-second eccentric/catch/reset (`46/72/72`), band-assisted declared-range
  full cycle (`58/64/64`), unassisted declared-range full cycle (`58/88/88`),
  and 30-degree-incline K30/H0 five-second hold/catch/reset (`62/76/76`) for
  exercise complexity, physical difficulty, and derived overall. Eight
  Capacity/Resilience profiles define equipment, cumulative hamstring exposure,
  dose, duration, substitutions, persistence, and athlete/coach/support output.
  Exercise and safety proficiency fields remain null.
- Registry `2026-08-02.76` contains 298 sources, including four direct Nordic
  reviews/studies and the 2025 dose-response meta-regression. Sixteen evidence
  sections preserve small acute samples, programme-level injury findings,
  heterogeneity, and low-to-very-low dose certainty. Thirty-one alternates, ten
  review-only graph proposals, eight review-only score anchors, and five current
  oEmbed-healthy candidates remain human-gated; no playback, exactness,
  captions, accessibility, quality, reviewer, or approval is claimed.
- Migration 465 adjudicates Nordic Hamstring Curl and Reverse Nordic Curl as
  distinct: forward ankle-anchored knee-flexor loading versus backward kneeling
  knee-extensor loading. Migration 466 records zero lower-body landing contacts
  while preserving the planned hand catch as separately tracked exposure.
  Production-runner checksums are `2244701705`, `1500429394`, and `2749332346`.
- Direct and repeated disposable PostgreSQL, nonpersisting and persisted audits,
  and the production runner pass. Focused tests pass 191 assertions, all 743
  platform tests pass, and the backend suite reports 994 passes, 20 intentional
  skips, and zero failures. Focused lint, registry parsing, 12 management checks,
  10 launch checks, syntax/sitemap-diff checks, and the production build pass.
- All 611/611 surfaced identity pairs are adjudicated, with zero unresolved pair
  and zero exact collision across 1,047 active definitions. Global graph and
  calibration queues contain 610/835 review-only rows and zero approvals;
  exact current-card healthy embeddable 3–5-video coverage is 77/1,047. Nordic
  passes every machine-verifiable P0/P1 gate and remains quarantined by exactly
  `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`.

## Depth Jump family audit hardening (migration 463)

- Migration 463 reassesses legacy sources 3, 725, and 1092 under stable Depth
  Jump UUID `fe5e8eb1-e783-4a37-a1b8-14d970ac1679`. Source 3 conflates
  vertical or target output with minimal contact; sources 725 and 1092 omit
  exact platform, lead, arm, contact-strategy, final-landing, measurement, and
  dose facts. All three source variants are traceable identity quarantines and
  are nonselectable.
- Two research-authored working specifications are selectable only in review:
  countermovement vertical rebound with hands on hips (`64/72/72`) and with
  free coordinated arms (`68/72/72`) for exercise complexity, physical
  difficulty, and derived overall. Four Movement Intelligence/Output profiles
  define platform and lead, two contacts per attempt, cumulative fatigue and
  impact, duration, measurement, logistics, substitutions, persistence, and
  athlete/coach/support rendering. Exercise and safety proficiency remain null.
- Registry `2026-08-02.75` still contains 293 sources. The card has 16 evidence
  sections, 24 alternate/source assessments, eight review-only graph proposals,
  four review-only score anchors, and five card-v2 oEmbed-healthy candidates
  carried to card v3. Fresh oEmbed fetches returned cache misses; playback,
  exact arm-policy match, captions, accessibility, quality, and approval are
  not claimed.
- Disposable PostgreSQL passed atomic application, repeat application,
  nonpersisting and persisted independent audits, and production-runner
  registration at checksum `2334448762`. Focused tests pass 187 assertions,
  all 739 platform tests pass, and the backend suite reports 990 passes, 20
  intentional skips, and zero failures. Focused lint, registry parsing, 12
  management checks, 10 launch checks, syntax, sitemap-diff, and production
  build gates pass.
- All 610/610 surfaced identity pairs are adjudicated, with zero unresolved
  pair and zero exact collision across 1,047 active definitions. Global graph
  and calibration queues contain 600/827 review-only rows and zero approvals;
  exact current-card healthy embeddable 3–5-video coverage remains 76/1,047.
  Depth Jump passes every machine-verifiable P0/P1 gate and remains quarantined
  by exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`.

## Front Plank family audit hardening (migrations 467–468)

- Migration 467 consolidates generic Plank Hold source 5 and RKC Plank source
  602 into stable Front Plank UUID `4bffab47-a9c6-483e-ac8f-5c73b9641fd3`,
  alongside already-consolidated sources 240 and 827. All four source variants
  remain traceable but archived because they omit or conflate exact support,
  lever, pelvic/tension intent, entry, exit, or quality-terminated dose facts.
- The inherited PMID `32707142` was removed from current plank provenance and
  identity evidence because it is a prone-CPR review. Registry
  `2026-08-02.77` contains 304 sources, including six direct or adjacent plank
  studies. Sixteen evidence sections preserve acute-EMG, endurance-test,
  surface, method, transfer, and direct-RKC-evidence limits.
- Three research-authored working specifications are review-selectable:
  stable-floor standard forearm/toes (`30/36/36`), long-lever posterior tilt
  (`44/58/58`), and RKC high tension (`40/68/68`) for exercise complexity,
  physical difficulty, and derived overall. Six Resilience/Capacity profiles
  provide exact dosage, cumulative isometric/high-tension/shoulder-support
  budgets, logistics, duration, substitutions, persistence, and athlete/coach/
  support rendering. Exercise and safety proficiency fields remain null.
- Five current YouTube oEmbed candidates are metadata-healthy and use privacy-
  enhanced embed URLs, but playback, exactness, captions, accessibility,
  safety, quality, reviewer identity, and approval remain unverified. Thirty-two
  alternates, eight graph proposals, and six calibration anchors are review-only.
- Migration 468 separates Front Plank from Bear Plank, Glute Bridge, and Side
  Plank by orientation, contacts, joint action, plane, laterality, lever, and
  dose. The independent queue is closed at 613/613 surfaced pairs, zero
  unresolved pair, and zero exact collision across 1,045 active definitions.
- Direct/repeated disposable PostgreSQL, production-runner registration,
  nonpersisting/persisted audit, focused 194, platform 746, backend 997-pass/
  20-skip, lint, registry, 12 management checks, 10 launch checks, sitemap diff,
  and production build pass. Checksums are `390303331` and `3371349113`.
  Front Plank retains exactly the media, graph, calibration, and publication
  human gates.

## Dead Bug family audit hardening (migration 470)

- Consolidates `cross-crawl-dead-bug` into the stable `dead-bug` family because
  both use a supine alternating contralateral arm-and-leg action. Cross-crawl
  remains an alias and delivery emphasis; its incomplete source representation
  is archived rather than treated as a selectable specification.
- Replaces both generic source variants with two exact review-only working
  specifications: bent-knee contralateral arm plus heel tap (`34` complexity,
  `24` physical, `34` overall) and long-lever contralateral arm plus leg hover
  (`42`, `38`, `42`). Overall is the maximum; no exercise proficiency field is
  present.
- Adds six contextual delivery profiles, complete anatomy/load/fatigue/
  recovery and planning contracts, 16 candidate evidence sections, 32
  alternate assessments, four review-only graph edges, four review-only score
  anchors, and four privacy-enhanced YouTube candidates whose oEmbed metadata
  was healthy on 2026-08-02. Playback, exact match, captions, accessibility,
  quality, reviewer identity, and approval remain unresolved.
- Records distinct identity boundaries for heel tap, iso press, wall press,
  loaded pullover, band-pulldown rotation resistance, eccentric leg lower, and
  partner hand press. Neighbor canonical audits remain required.
- Direct and repeated disposable PostgreSQL application pass. The independent
  persisted audit leaves exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Focused research/audit/
  difficulty tests pass `200/200`; migration 470 is runner-registered at
  checksum `3586300106`.
- The whole-library snapshot is now 1,676/1,676 mapped legacy rows, 1,044 active
  definitions, 614/614 adjudicated surfaced pairs, zero unresolved exact
  collision, 80 machine-complete cards, and 79 cards with 3–5 current healthy
  embeddable candidates. All active cards remain human-review quarantined.

## World's Greatest Stretch family audit hardening (migration 471)

- Keeps stable definition UUID `af147afc-63e9-4944-a5b5-d3b5d2fa6120` and
  consolidates the archived “with rotation” label because ipsilateral thoracic
  rotation is already required by the base sequence.
- Replaces two generic source variants with exact rear-knee-down (`42`
  complexity, `26` physical, `42` overall) and rear-knee-up (`50`, `34`, `50`)
  review specifications. No exercise skill or proficiency classification is
  present; overall is the maximum of exercise complexity and physical
  difficulty.
- Fixes the repetition contract as long lunge, lead-side instep reach,
  same-side thoracic rotation, hand return, front-leg hamstring rockback, then
  declared reset or switch. Inchworm entry, required plank return, and a
  rotation-free Spiderman hamstring sweep remain distinct definitions.
- Adds six contextual delivery profiles, complete anatomy/load/fatigue/
  recovery and support contracts, 16 candidate evidence sections, 28 alternate
  decisions, four review-only graph edges, four review-only calibration
  anchors, and four current oEmbed-healthy candidate videos. No exact media,
  relationship, calibration, content, or publication approval is inferred.
- Direct and repeated disposable PostgreSQL execution, the persisted whole-
  library audit, and focused `201/201` tests pass. The card retains exactly
  `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`. Migration checksum: `3237436721`.
- The whole-library snapshot remains 1,676 mapped legacy rows and 1,044 active
  definitions with all 614 surfaced identity pairs adjudicated and zero exact
  collision unresolved. Machine-complete cards rise to 81, leaving 963; exact
  current 3–5-candidate coverage rises to 80/1,044.

## Kettlebell Swing family audit hardening and taxonomy closure (migrations 472 and 474)

- Migration 472 preserves stable shoulder-height Kettlebell Swing UUID
  `f0f47f37-e892-4689-99a0-16cba58a3f40` and creates distinct full-overhead
  swing UUID `5c671a58-1beb-44db-9d5b-a0951630fc6f`. The generic source-11
  representation is archived because it does not fix hand count, bell count,
  terminal height, style, start, cadence, load, dose, stop, or park method.
- Four exact review specifications are selectable: two-hand and one-hand
  shoulder-height continuous swings (`56/58/58` and `64/60/64`) and two-hand
  and one-hand overhead continuous swings (`66/62/66` and `74/64/74`) for
  exercise complexity, physical difficulty, and derived overall. Exercise and
  safety proficiency fields are null; athlete readiness remains a workout-
  selection input and skill levels remain exclusive to skill-library cards.
- Eight contextual Output/Capacity profiles provide exact dosage, cumulative
  hinge, power, grip, trunk and applicable overhead budgets, duration,
  clearance, logistics, substitutions, persistence, and separate athlete,
  coach, and support rendering. Sixteen evidence sections per definition,
  54 alternate assessments, eight review-only relationship proposals, eight
  review-only score anchors, and eight current candidate videos are persisted.
- Registry `2026-08-02.79` contains 315 sources. The direct and adjacent swing
  evidence is descriptive, acute, biomechanical, or small-sample and does not
  establish a universal style, load, dose, recovery interval, safety threshold,
  treatment effect, transfer outcome, or difficulty score. oEmbed metadata
  establishes neither playback nor exact movement, captions, accessibility,
  cue quality, safety, reviewer identity, or approval.
- The independent audit discovered three uncontrolled keys on both cards:
  `forearm`, `floor_marker`, and `video_capture`. Migration 474 replaces the
  body-region representation with controlled elbow, wrist, and hand keys and
  uses controlled `line_tape` and `timer` optional equipment; video capture
  remains a workflow capability rather than fabricated required equipment.
- Migrations 472 and 474 pass direct and repeated disposable-PostgreSQL
  execution and production-runner registration at checksums `3340443758` and
  `1490465970`. Focused validation passes `204/204`; the full backend suite
  passes 1,003 tests with 20 intentional skips and zero failures. Focused lint,
  the persisted audit, diff checks, and the production build pass.
- The authoritative whole-library snapshot maps all 1,676 legacy records to
  1,045 active definitions. All 617 surfaced identity pairs are adjudicated,
  with zero unresolved pair and zero exact collision. Machine-complete cards
  rise to 83, leaving 962; exact current-card healthy embeddable 3–5-candidate
  coverage is 82/1,045. Both swing definitions retain exactly
  `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`.

## Pull-Up / Chin-Up identity and family completion (migration 475)

- Preserves stable UUID `03bb53ca-123a-4f38-864f-bb38f4e22bc1` and
  consolidates Assisted Pull-Up, Weighted Vest Pull-Up, and the disjunctive
  Chin-Up or Assisted Chin-Up definition. All eight legacy sources remain
  traceable; generic and disjunctive source baselines are archived and cannot
  be selected without an exact working specification.
- Seven exact review specifications cover pronated, supinated, and neutral
  strict bodyweight pulls; side-specific archer pulls; elastic-band and
  counterweight assistance; and weighted-vest pronated pulls. Their
  complexity/physical/overall vectors are `48/72/72`, `46/68/68`, `44/66/66`,
  `66/86/86`, `54/50/54`, `48/48/48`, and `52/84/84`. No exercise skill or
  proficiency classification is stored; overall is the maximum of the two
  exercise-difficulty dimensions.
- Eccentric-only, isometric-hold, and scapular-only cards remain distinct by
  contraction and repetition boundary. Kipping, butterfly, one-arm,
  muscle-up, L-sit, leg-raise, and flight/regrasp tasks remain separate
  definitions or research queues. Grip width and tempo are annotations unless
  an exact support or action contract materially changes the variant.
- Fourteen Capacity profiles add exact dose, cumulative pull/hang/grip and
  elbow-flexor budgets, equipment and mount/exit logistics, duration,
  substitution revalidation, persistence, and athlete/coach/support output.
  Sixteen evidence sections, 32 alternate assessments, 12 relationship
  proposals, 14 calibration proposals, and five current privacy-enhanced
  candidates are persisted without approval. The unrelated calf-raise PMID
  `38156065` is removed from the current family provenance.
- Migration 475 passes direct and repeated disposable-PostgreSQL execution and
  production-runner registration at checksum `2352809545`. Registry
  `2026-08-02.80` contains 323 sources. Focused validation passes `206/206`;
  the full backend suite passes 1,005 tests with 20 intentional skips and zero
  failures. Focused lint, the persisted audit, diff checks, and the production
  build pass.
- The authoritative library now maps all 1,676 legacy rows to 1,042 active
  definitions. All 616 surfaced identity pairs are adjudicated, with zero
  unresolved pair and zero exact collision. Machine-complete cards rise to 84,
  leaving 958; exact current-card healthy embeddable 3–5-candidate coverage is
  83/1,042. Pull-Up / Chin-Up retains exactly `CARD-MEDIA-01`,
  `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`.

## Hollow Body Hold identity and family completion (migration 476)

- Preserves stable Hollow Body Hold UUID
  `aad3f83d-14ba-45b9-b7fe-a6b52cd0424b` and maps all three traceable legacy
  sources to it. The generic bodyweight, dumbbell, and medicine-ball source
  representations remain archived identity quarantines because their text does
  not establish an exact working position, implement placement, dose, or stop.
- Six selectable static specifications cover tuck arms-forward, side-specific
  one-leg-extended arms-forward, straight-leg arms-forward, straight-leg arms-
  overhead, fixed-overhead dumbbell, and fixed-overhead medicine-ball holds.
  Their complexity/physical/overall vectors are `34/32/34`, `42/44/44`,
  `40/54/54`, `48/66/66`, `58/74/74`, and `54/70/70`. No exercise skill or
  proficiency classification is stored; overall is the maximum of the two
  exercise-difficulty dimensions.
- Hollow Rock, rock-to-freeze, flutter-kick, hollow-to-arch roll, eccentric
  lower, partner medicine-ball exchange, Dead Bug, and L-Sit remain distinct by
  action, support, implement behavior, or repetition boundary. A loaded variant
  is a Hollow Body Hold only when the implement remains fixed throughout the
  timed hold; a pullover, throw, catch, or exchange changes the exercise.
- Twelve contextual Movement Intelligence/Capacity profiles persist exact dose,
  duration, load and fatigue budgets, logistics, substitutions, coach/athlete/
  support output, and failure-state persistence. Sixteen candidate evidence
  sections, 32 alternate assessments, 12 review-only graph edges, 12 review-
  only calibration anchors, and five current oEmbed-healthy media candidates
  are stored without approval.
- The research packet removes unrelated CPR PMID `32707142` and rowing PMID
  `19620925`; dynamic pullover boundary evidence uses PMID `21975179`.
  Abdominal-hollowing and leg-lowering studies remain adjacent evidence and do
  not prove the exact gymnastics shape, a universal dose, recovery interval,
  safety threshold, transfer outcome, or numeric difficulty score.
- Migration 476 passes direct and repeated disposable-PostgreSQL execution,
  production-runner registration, and exact-file re-entry at checksum
  `1754451518`. Registry `2026-08-02.81` contains 331 sources. Focused validation
  passes `208/208`; the full backend suite passes 1,007 tests with 20 intentional
  skips and zero failures. Focused lint, registry parsing, persisted audit, diff
  integrity, and the production build pass.
- The authoritative library remains 1,676/1,676 mapped legacy rows and 1,042
  active definitions. All 616 surfaced identity pairs are adjudicated, with
  zero unresolved pair and zero exact collision. Machine-complete cards rise to
  85, leaving 957; exact current-card healthy embeddable 3–5-candidate coverage
  is 84/1,042. Hollow Body Hold retains exactly `CARD-MEDIA-01`,
  `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`.
