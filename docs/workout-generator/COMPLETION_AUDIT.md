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
  independent approval and supersession history. Technical complexity and
  physical difficulty are calibrated independently; overall difficulty is
  derived as their maximum and cannot receive a new independent calibration.
  Migrations 245 and 304 store the audit trail without mutating published
  cards.
- Deterministic selection projects cumulative grip, local-muscle, spinal,
  eccentric, impact, and technical-sensitivity costs before accepting a
  candidate. Final validation and reviewed swaps independently enforce the same
  budgets. See `CALIBRATION_AND_FATIGUE.md`.
- Migration 246 and the canonical library audit produce and persist a named
  automated test packet for every migrated exercise. The measured baseline is
  1,676/1,676 legacy sources mapped into 1,366 active canonical definitions, all
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

- 808 backend Node tests ran serially: 788 passed, 20 integration-environment tests
  skipped intentionally, and none failed. The focused platform suite separately
  passed all 591 tests. This includes all 25 named golden
  scenarios and the governance, graph-swap, AI-quarantine, anatomy/load,
  difficulty-model, and telemetry suites,
- a 7,000-card deterministic generation test completed in under the five-second
  release ceiling,
- the complete migration chain passed on disposable PostgreSQL,
- all 1,676 legacy exercise sources were audited through their 1,366 active
  canonical definitions, and every active definition remains quarantined
  pending human review,
- the production reference card passed a real repository save/load round trip
  while its missing-media publication gate remained active,
- 310 redundant definitions were consolidated into canonical identities while
  preserving 1,769 canonical variants, 1,866 delivery profiles, and all legacy
  source mappings; direct identity collisions are zero. All score-85-or-higher
  candidate pairs now have deterministic identity decisions, no pair remains
  in `needs_human_review`, and no unresolved pair scores 85 or higher.
- Focused ESLint passed for the canonical backend, route, and coach UI files.
- `npm run build` completed successfully.
- The canonical release-readiness command correctly exited blocked: zero
  definitions are published, all seven phase pools have zero published depth,
  zero graph edges or calibration anchors are approved, and no real coach-pilot
  review has been recorded. Those are rollout gates, not migration failures.
- The complete migration sequence through migration 350 and every add-on was
  applied successfully from a blank disposable PostgreSQL 15 database.
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
- A blank disposable PostgreSQL 15 database successfully ran the complete
  migration chain through migration 350 and reproduced 1,366 active
  definitions, 310 archived definitions, 1,769 variants, 1,866 delivery
  profiles, 1,676 source mappings, 406 identity resolutions, 128 graph edges,
  and 180 review-only calibrations. Migrations 345–350 reran idempotently in
  disposable rehearsal databases.
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
- All 267 canonical-research JSON artifacts pass the exercise-difficulty
  invariant. The normalization tool corrected 278 historical candidate-summary
  overall scores across 164 files so overall now equals the greater of
  technical complexity and physical or absolute-load demand; non-core
  dimensions remain separately available to planning.
- The duplicate-candidate audit now builds and reuses one normalized identity
  index. Its indexed results are regression-tested against the direct matcher,
  and the complete 1,366-card audit avoids rebuilding identity terms inside
  every pairwise comparison. Thirty cards now pass every structural category
  and remain quarantined only on
  explicit human calibration, graph-review, media-review, and publication
  gates.
- Golden quality evaluation is at least 90/100 with safety and logistics at
  100/100.

## Operational release gates

These are deployment and evidence gates, not code-completion claims:

1. Apply the complete migration sequence through migration 350 in a
   non-production environment.
2. Run the full library audit; review anatomy, constraints, scores, media,
   relationships, and calibration evidence card by card.
3. Publish a versioned library release only from cards whose stored packet
   passes and whose independent review is current.
4. Run the documented internal-coach pilot and measure the 90% keep/minor-edit,
   sub-10% swap, and sub-15% dose-edit targets.
5. Enable the feature flag by rollout stage only after its quantitative gates
   pass. Keep the legacy path available for immediate rollback.
