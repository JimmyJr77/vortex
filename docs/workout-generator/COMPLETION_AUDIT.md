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
