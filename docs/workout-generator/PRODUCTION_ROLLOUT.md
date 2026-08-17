# Canonical workout generation production rollout

## Current authoritative snapshot (2026-08-11)

The current disposable-PostgreSQL release report covers 206 active canonical
definitions and 1,676 source-covered legacy rows. All 206 are deliberately in
`review`; zero are published. Candidate contract coverage is 100% for scores,
anatomy, load, fatigue, support, operations, research sections, alternates, and
a three-to-five media-candidate set; 99.51% have three to five healthy embeddable
metadata records. This does not constitute
external media verification or clinical/coach approval.

The release command remains correctly blocked at 0/25 published cards, zero
published phase depth in all seven phases, 0/10 approved graph edges, 0/3
approved calibration anchors, and 0/20 coach-pilot reviews. Historic snapshots
below are evidence of the migration path only; do not use their counts for a
release decision.

## Automated release gate

Run:

```sh
cd backend
npm run check:canonical-release -- --facility=<facility-id>
```

The command exits non-zero until the published pool, per-phase substitution
depth, approved relationship graph, calibration anchors, media governance, and
coach-pilot outcomes meet the controlled thresholds in
`canonicalOperationalReadiness.js`. A blocked result is expected before the
human review program finishes. It always emits a JSON result: unavailable
database configuration, unavailable canonical schema, and malformed facility
input are explicit non-human blocked failures rather than an ambiguous stack
trace.

Use the stricter deployment check immediately before enabling coach generation:

```sh
cd backend
npm run check:canonical-release -- --facility=<facility-id> --require-coach-opt-in
```

The normal command establishes whether the library and human-evidence cohort
are ready to enroll. The stricter command additionally blocks until the named
facility has a valid explicit coach rollout configuration.

## Facility-scoped rollout gate

`CANONICAL_WORKOUT_GENERATOR_ENABLED` remains a global emergency kill switch.
Even when it is true, canonical generation and swaps are fail-closed unless the
facility has an explicit row in
`coaching.canonical_generator_facility_rollout_v1`. The row is created disabled
by default; migration 755 does not enroll or enable any facility.

The rollout controls are intentionally separate:

- `canonical_contract_read`
- `canonical_score_shadow`
- `canonical_generator_shadow`
- `canonical_generator_coach_opt_in`
- `canonical_ai_intent`
- `canonical_generator_default`

Coach generation and swaps require `canonical_generator_coach_opt_in` in
addition to the global switch. AI intent also requires `canonical_ai_intent`.
This permits shadow and coach-pilot work without accidentally exposing the
generator to every facility. Change the row only through an audited operational
runbook; retain the disabled/default state until the applicable release gates
are met. If application code arrives before migration 755, the generator fails
closed with `rollout_schema_unavailable`; it never falls back to global
enablement.

## Human-reviewed cohort

Start with at least 25 independently approved definitions and at least three
eligible cards in every required phase. Every card must have:

- current-version, exact-match media review;
- an approver who did not author the revision;
- complete coach, athlete, accessibility, programming, measurement, and support
  content;
- approved calibration evidence and reviewed substitution/progression edges;
- no unresolved identity collision, safety issue, or support escalation.

Automated or AI-generated suggestions remain draft evidence. They cannot set
review status, approval identity, media verification, or calibration approval.

## Coach pilot

Collect at least 20 structured workout reviews across different ages, group
sizes, objectives, equipment constraints, and session lengths. Release targets:

- keep or minor-edit rate at least 85%;
- exercise swap rate no more than 15%;
- dose-edit rate no more than 20%;
- no unresolved safety incident.

Record actual execution duration, setup delay, substitutions, stop events,
equipment conflicts, clarity score, and athlete feedback. Do not enter synthetic
reviews to satisfy the gate.

## Member and accessibility study

Test the cohort on supported phone and desktop layouts with representative
members. Include reading-level comprehension, captions, transcript, still-image
sequence, audio description, hearing support, cognitive support, pain
escalation, and localization review. Machine validation confirms only that the
required fields exist; human comprehension testing remains mandatory.

## Staged enablement

1. Apply all migrations to staging and run the complete library audit.
2. Run the release gate and retain its JSON result as release evidence.
3. Generate shadow workouts without showing them to members.
4. Compare selected cards, duration, fatigue, equipment, and substitutions with
   the coach-authored workout.
5. Enroll one approved pilot facility with `canonical_generator_coach_opt_in`.
6. Enable member rendering only after coach acceptance and accessibility gates.
7. Expand the published cohort gradually while monitoring rejection, latency,
   swaps, dose edits, duration error, support reports, and stop events.

## Rollback

Disable the facility feature flag, retain generated-workout records for audit,
and quarantine affected card releases. Safety changes invalidate the active
release; instruction changes create a new card version; media changes invalidate
the media review; score changes revalidate saved templates. Database migrations
are additive and should not be rolled back destructively during an incident.

## Current automated gate snapshot after migration 440

- Canonical identity is fully classified at the configured score-72 threshold:
  569 raw pairs, 569 adjudicated-distinct pairs, zero unresolved pairs, and zero
  exact collisions across 1,050 active definitions.
- The legacy Needs Engine data-quality audit is 1,567/1,567 passing after the
  provisional difficulty and exact dosage backfill.
- Canonical release remains blocked by design: zero published definitions,
  zero released phase depth, zero approved relationships, zero independently
  approved calibration anchors, and zero coach-pilot reviews.
- Candidate availability is not approval. Current three-to-five-link coverage
  is 70.19%, three-to-five embeddable-candidate coverage is 4.19%, and approved
  exact-match media coverage is zero.
- The next executable activity is a controlled human cohort: review and approve
  at least 25 complete cards, including at least three eligible cards in each
  required phase, then approve the graph/calibration minimums and run the
  20-workout coach pilot. Do not populate reviewer or approval evidence with
  synthetic values.

## Automated gate snapshot after migration 442

- The identity queue remains fully closed after completing the Box Jump, Drop
  Jump, and Depth Jump baselines: 569 raw score-72+ pairs, 569 adjudicated
  pairs, zero unresolved pairs, and zero exact collisions.
- Candidate completeness is now 9.71% for score/operations, 9.52% for anatomy,
  support, candidate research, and alternates, 6.48% for load, 6.95% for
  fatigue, 70.48% for three-to-five media candidates, and 4.48% for healthy
  embeddable candidates. These changes do not create a release cohort.
- Release is still blocked by zero published canonical definitions, zero phase
  depth, zero approved graph edges, zero independently approved calibration
  anchors, and zero real coach-pilot reviews. All 1,050 active definitions stay
  quarantined.
- Migrations 441 and 442 passed disposable PostgreSQL, platform boot checksum
  registration, focused lint and tests, the complete backend suite, and the
  production build. Automated success is not a substitute for the media,
  accessibility, score, graph, coach, and publication gates above.

## Automated gate snapshot after migration 444

- Squat Jump, Countermovement Jump, and Countermovement Jump Rebound now pass
  every machine-verifiable canonical-card gate. Each remains quarantined for
  exactly four human gates: current-version exact media review, coach graph
  approval, independent difficulty calibration, and publication approval.
- Each card has 16 candidate evidence sections, five healthy embeddable title-
  level candidates, five alternate assessments, contextual dosage and time
  models, cumulative fatigue/contact/impact budgets, substitution validation,
  persistence, and separate coach/member rendering. None of those candidates
  is represented as verified or approved.
- Identity remains closed at 569 raw pairs, 569 adjudications, zero unresolved
  pairs, and zero exact collisions. Needs Engine remains 1,567/1,567 passing.
  All 1,050 canonical definitions remain quarantined; graph/calibration review
  queues are 437/663 and approved counts are zero.
- Release work is therefore unchanged in kind: qualified media and card review,
  independent scoring, coach-reviewed graph edges, accessible member
  comprehension, a minimum viable approved phase cohort, real shadow workouts,
  the 20-workout coach pilot, staged feature-flag rollout, and monitoring. The
  new cards are technically ready for that review process, not production-
  published.

## Automated gate snapshot after migration 445

- Standing Broad Jump, Broad Jump to Stick, Repeated Broad Jump, and Triple
  Broad Jump pass every machine-verifiable canonical-card gate and remain
  quarantined for the same four human gates: exact media review, graph
  approval, independent difficulty calibration, and publication approval.
- Migration 445 supplies exact measured/stick/flexible-repeated/exact-three
  contracts, controlled tape-measure taxonomy, eight contextual profiles, 64
  evidence rows, 20 candidate videos, 20 alternate decisions, cumulative
  contact/fatigue/impact budgets, measurement validity, substitutions,
  duration, persistence, and coach/member support. It creates no approval.
- Identity is closed at 572 raw pairs, 572 adjudications, zero unresolved
  pairs, and zero exact collisions. All 1,050 definitions remain quarantined;
  review-only graph/calibration queues are 443/671 and approved counts are
  zero.
- Production rollout still requires qualified playback and accessibility
  review, two-person card review, independent score calibration, coach graph
  approval, a minimum approved phase cohort, shadow workouts, the 20-workout
  coach pilot, staged feature flags, monitoring, and rollback evidence.

## Automated gate snapshot after migration 446

- Bilateral and single-leg drop-landing-to-stick cards pass all machine-
  verifiable content gates and remain quarantined for exact media review,
  graph approval, independent difficulty calibration, and publication
  approval. Ten healthy embed candidates are discovery records only.
- Identity is closed at 577 raw pairs, 577 adjudications, zero unresolved
  pairs, and zero exact collisions. All 1,051 active definitions remain
  quarantined; review-only graph/calibration queues are 448/675 and approved
  counts remain zero.
- The established canonical-snapshot upgrade path passes disposable
  PostgreSQL application, idempotent re-entry, audit, boot registration,
  focused and full tests, and production build. Migration 446 is registered
  with checksum `2335192458`.
- A separate empty-database rehearsal exposed a pre-existing release blocker:
  `node run-migration.js --all` stops at
  `426_drop_in_notification_tracking.sql` because `drop_in_registration` is
  absent, while clean canonical backfill UUIDs differ from the stable IDs used
  by later completion migrations. Migration 446 now reports a precise missing-
  identity guard rather than a foreign-key failure, but fresh-environment
  bootstrap is not validated and must be repaired and rehearsed before
  production rollout.
- Remaining rollout work is still qualified full-playback/accessibility
  review, independent score calibration, coach graph approval, two-person card
  approval, an approved phase-depth cohort, shadow workouts, the 20-workout
  coach pilot, staged feature flags, monitoring, rollback evidence, and now an
  empty-database bootstrap gate in CI.

## Automated gate snapshot after migration 447

- Barbell Front Squat, Goblet Squat, Double Front-Rack Squat, and Single-
  Kettlebell Front-Rack Squat now pass every machine-verifiable card gate. They
  remain quarantined for exactly current-version media review, graph approval,
  independent difficulty calibration, and publication approval. Twenty
  healthy embed candidates are discovery records only.
- Exercise cards use no athlete proficiency levels. The 11 exact variants use
  exercise complexity and physical difficulty, with overall derived as their
  maximum. All 16 affected legacy exercise and safety skill fields are null;
  dedicated skill-library card levels are unchanged.
- Identity remains closed after restoring the exact support interfaces: 588
  raw score-72+ pairs, 588 adjudications, zero unresolved pairs, and zero exact
  collisions across 1,051 active definitions. All definitions remain
  quarantined; graph/calibration queues are 459/697 review-only and approved
  counts remain zero.
- The executable release gate remains correctly blocked: 0 / 25 published
  definitions, zero substitution depth in all seven phases versus three
  required per phase, 0 / 10 approved graph edges, 0 / 3 independently
  approved calibration anchors, and 0 / 20 real coach-pilot reviews.
- The remaining card-authoring backlog is still large. The independent audit
  reports 978 incomplete anatomy packets, 973 load gaps, 968 fatigue/recovery
  gaps, 941 difficulty and equipment gaps, 939 delivery gaps, and 938 broad
  constraint/support/generation gaps. Migration 447 completes one high-
  leverage family; it does not create a production release cohort.
- Migration 447 passed disposable PostgreSQL, persisted audit reporting,
  idempotent repository-runner registration with checksum `1154198368`, 160
  focused tests, 712 platform tests, 983 backend tests, CI smoke/syntax checks,
  and a production build. The pre-existing clean-database bootstrap blocker
  described above remains unresolved and is still a production gate.
- Production rollout therefore still requires the remaining card migrations,
  qualified full-playback and accessibility review, independent score
  calibration, coach-reviewed graph edges, two-person card approval, minimum
  phase depth, real shadow generation, the 20-workout coach pilot, staged
  feature flags, monitoring, and rollback evidence. None may be replaced with
  synthetic review data.

## Automated gate snapshot after migration 448

- Glute Bridge, Glute Bridge Iso Hold, Single-Leg Glute Bridge, and Single-Leg
  Glute Bridge Iso Hold pass every machine-verifiable canonical gate after the
  prior contraction/laterality consolidation is corrected. They remain
  quarantined for exactly media review, coach graph approval, independent
  difficulty calibration, and publication approval.
- Nine exact variants use exercise complexity and physical difficulty only;
  overall is their maximum. The 12 affected source rows contain no exercise
  skill or minimum-skill classification. Skill-library levels are untouched.
- Identity remains closed at 594 raw pairs, 594 adjudications, zero unresolved
  pairs, and zero exact collisions across 1,054 active definitions. Review-only
  graph/calibration queues are 470/715; approved counts remain zero.
- Candidate media coverage rises to 750/1,054 cards, but only 64/1,054 have
  three to five currently healthy embeddable candidates, and none has approved
  exact-match media. Candidate discovery is not rollout approval.
- Migration 448 passed disposable PostgreSQL direct and idempotent execution,
  independent audit, production-runner checksum registration
  (`3918717137`), focused lint/JSON validation, 161 focused tests, all 713
  platform tests, and the complete backend suite with 964 passes, 20
  intentional skips, and zero failures. Twelve management checks, ten launch
  checks, syntax checks, and the production build also pass.
- Production rollout still requires the remaining card migrations, repair and
  CI rehearsal of the pre-existing empty-database bootstrap blocker,
  qualified full-playback and accessibility review, independent score
  calibration, coach-reviewed graph edges, two-person card approval, minimum
  approved phase depth, real shadow generation, the 20-workout coach pilot,
  staged feature flags, monitoring, and rollback evidence. No review gate may
  be satisfied with synthetic data.

## Automated gate snapshot after migration 449

- The Single-Leg Romanian Deadlift family passes every machine-verifiable card
  gate with one stable identity, ten active exact variants, 13 contextual
  profiles, complete workout-generation/support data, and an automated packet.
  It remains quarantined for exactly media review, coach graph approval,
  independent difficulty calibration, and publication approval.
- All variant scores are exercise complexity and physical difficulty, with
  overall derived as their maximum. The twelve legacy source rows have no
  exercise skill or safety minimum-skill classification; skill-library levels
  are unaffected.
- Identity remains closed at 594 raw pairs, 594 adjudications, zero unresolved
  pairs, and zero exact collisions across 1,054 active definitions. Review-only
  graph/calibration queues are 488/735; approved counts remain zero.
- Three-to-five currently healthy candidate links now cover 65/1,054 cards.
  The five target candidates are discovery records only: full playback,
  exactness, safety, captions, accessibility, quality, and qualified reviewer
  approval still require human review.
- Migration 449 passed disposable PostgreSQL direct, idempotent, audit, and
  production-runner execution with checksum `271198898`; focused lint and 162
  focused tests, all 714 platform tests, 965 passing backend tests plus 20
  intentional skips, CI smoke/syntax checks, and the production build pass.
- Release remains blocked by the large remaining machine-completeness backlog,
  zero approved media/graph/calibration/publication queues, insufficient
  approved phase depth, and the absent real 20-workout coach pilot. Production
  rollout still requires the remaining card migrations, qualified full-media
  review, independent score calibration, coach-reviewed graph edges, two-
  person publication approval, shadow generation, staged flags, monitoring,
  rollback evidence, and repair/rehearsal of the pre-existing empty-database
  bootstrap blocker. Synthetic records cannot satisfy any review gate.

## Automated gate snapshot after migration 450

- Cossack Squat now passes every machine-verifiable canonical gate with 14
  legacy mappings, 11 active exact variants, 22 delivery profiles, complete
  generation/support data, and a persisted automated packet. Two under-
  specified legacy placeholders are preserved but archived and unselectable.
- Exercise scores use only complexity and physical difficulty, with overall
  derived as their maximum. Source exercise/safety proficiency fields are null;
  skill-library proficiency levels are unaffected.
- Five current candidate videos have healthy oEmbed metadata only. Full
  playback, exact movement/variant match, captions, accessibility, safety,
  demonstration quality, reviewer identity, and approval remain unresolved.
- Identity remains closed at 594/594 adjudicated score-72+ pairs, zero
  unresolved pairs, and zero exact collisions. Global graph/calibration queues
  are 490/737 review-only rows with zero approvals; healthy three-to-five-link
  coverage is 66/1,054 definitions.
- Migration 450 passed direct and idempotent disposable PostgreSQL execution,
  internal assertions, persisted audit, and production-runner registration
  with checksum `3032492193`. The focused packet tests, all 716 platform tests,
  967 passing backend tests plus 20 intentional skips, focused lint, smoke and
  syntax checks, and the production build are green.
- Release remains blocked by 975 incomplete anatomy packets and the associated
  whole-library load/fatigue/difficulty/equipment/delivery/support backlog,
  zero human approvals, insufficient approved phase depth, absent real shadow
  generation and 20-workout coach pilot, and the pre-existing empty-database
  bootstrap rehearsal issue. Staged flags, monitoring, and rollback evidence
  are still required; synthetic records cannot satisfy review gates.

## Automated gate snapshot after migration 451

- Floor Press now passes every machine-verifiable canonical gate for nine
  legacy mappings, nine stable exact variants, 18 contextual delivery
  profiles, and complete generation/support data. Migration 451 is registered
  by the production runner with checksum `2720709609`.
- Difficulty is exercise complexity plus physical difficulty, with overall
  derived as their maximum. Exercise and safety records carry no athlete skill
  or proficiency level; skill-library levels are unchanged.
- Five current candidate videos have healthy oEmbed metadata only. Exact
  movement/variant match, full playback, captions, accessibility, safety,
  demonstration quality, reviewer identity, and approval remain unresolved.
- Identity is closed at 598/598 adjudicated score-72+ pairs, zero unresolved
  pairs, and zero exact collisions. Global graph/calibration queues contain
  506/755 review-only rows with zero approvals; candidate three-to-five-link
  media coverage is 67/1,054 definitions.
- Floor Press remains quarantined by exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Qualified reviewers must watch
  the media, approve relationships, independently calibrate scores, and
  complete two-person publication review.
- Direct and idempotent disposable-PostgreSQL execution, persisted audit,
  focused lint, registry parsing, 166 focused tests, all 718 platform tests,
  the full backend suite (969 passed, 20 intentionally skipped, zero failed),
  12 management checks, 10 launch checks, backend syntax checks, and the
  production build are green.
- Machine completion does not authorize rollout. The remaining whole-library
  canonical backlog, zero approved review queues, insufficient approved phase
  depth, absent real shadow generation and 20-workout coach pilot, the known
  empty-database bootstrap rehearsal issue, staged flags, monitoring, and
  rollback evidence still block production.

## Automated gate snapshot after migration 452

- Rotational Ball Slam passes every machine-verifiable canonical gate for five
  legacy mappings, three active exact variants, two archived traceable legacy
  variants, nine contextual profiles, and complete generation/support data.
  Migration 452 is registered by the production runner with checksum
  `2592677774`.
- Difficulty is exercise complexity plus physical difficulty, with overall
  derived as their maximum. Exercise and safety records carry no athlete skill
  or proficiency level; skill-library levels are unchanged.
- Five current candidate videos have healthy oEmbed metadata only. Exact
  identity/variant match, complete playback, captions, accessibility, safety,
  quality, reviewer identity, and approval are unresolved. The packet remains
  quarantined by exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`.
- Identity is closed at 605/605 adjudicated score-72+ pairs, zero unresolved
  pairs, and zero exact collisions. Global graph/calibration queues contain
  512/761 review-only rows with zero approvals.
- Direct and idempotent disposable-PostgreSQL execution, internal assertions,
  the persisted audit, focused lint, registry parsing, 168 focused tests, all
  720 platform tests, the backend suite (971 passed, 20 intentionally skipped,
  zero failed), 12 management checks, 10 launch checks, syntax checks, and the
  production build are green.
- Machine completion does not authorize rollout. Remaining card migrations,
  qualified full-media review, coach graph approval, independent difficulty
  calibration, two-person publication approval, adequate approved phase depth,
  real shadow generation, the 20-workout coach pilot, empty-database bootstrap
  repair/rehearsal, staged flags, monitoring, and rollback evidence still
  block production.

## Automated gate snapshot after migration 453

- One-Arm Row passes every machine-verifiable gate for nine corrected source
  mappings, four selectable exact variants, five archived/remapped traceability
  variants, eight contextual profiles, and complete generation/support data.
  Migration 453 is registered by the production runner with checksum
  `1965315103`.
- Difficulty is exercise complexity plus physical difficulty, with overall
  equal to their maximum. Exercise and safety records carry no athlete skill or
  proficiency level; the skill library remains the only owner of skill levels.
- Five candidate videos have healthy oEmbed metadata only. Full playback,
  exact identity/variant match, captions, accessibility, safety, quality,
  reviewer identity, and approval remain unresolved. Two internally
  underspecified legacy rows stay archived rather than being guessed.
- Identity is closed at 605/605 adjudicated score-72+ pairs, zero unresolved
  pairs, and zero exact collisions. Global graph/calibration queues contain
  520/769 review-only rows with zero approvals; current healthy three-to-five-
  link media coverage is 69/1,054 definitions.
- Direct and idempotent disposable-PostgreSQL execution, internal assertions,
  persisted audit, production-runner registration, focused lint, registry
  parsing, 170 focused tests, all 722 platform tests, the backend suite (973
  passed, 20 intentionally skipped, zero failed), 12 management checks, 10
  launch checks, syntax checks, and the production build are green.
- Machine completion does not authorize rollout. The remaining 933-plus-card
  taxonomy/support/generation backlog, qualified media review, coach graph
  approval, independent calibration, two-person publication approval, approved
  phase depth, real shadow generation, the 20-workout coach pilot, empty-
  database bootstrap repair/rehearsal, staged flags, monitoring, and rollback
  evidence still block production.

## Automated gate snapshot after migration 454

- Short Acceleration Sprint now passes every machine-verifiable current-card
  gate across 20 source mappings, six selectable exact variants, two preserved
  nonselectable provisional variants, and the existing contextual delivery,
  research, relationship, calibration, and test packets. Migration 454 is
  registered by the production runner with checksum `941216242`.
- Controlled taxonomy, anatomy laterality, athlete/coach/support operations,
  programming, and relationship dimensions are normalized. Difficulty remains
  exercise complexity plus physical difficulty only; exercise and safety
  records carry no athlete skill or proficiency level.
- Migration 454 creates no evidence or approval. Candidate videos still require
  full playback and exact-variant, caption, accessibility, safety, quality, and
  reviewer checks. Relationship proposals, score anchors, and publication also
  remain review-only.
- Identity remains closed at 605/605 adjudicated score-72+ pairs, zero
  unresolved pair, and zero exact collision. Global graph/calibration queues
  remain 520/769 review-only rows with zero approvals, and current healthy
  three-to-five-link candidate media coverage remains 69/1,054 definitions.
- Direct and idempotent disposable-PostgreSQL execution, internal assertions,
  persisted audit, production-runner registration, focused lint, registry
  parsing, 170 focused tests, all 722 platform tests, the backend suite (973
  passed, 20 intentionally skipped, zero failed), 12 management checks, 10
  launch checks, syntax checks, and the production build are green.
- Machine completion does not authorize rollout. Short Acceleration remains
  quarantined by exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. The wider library backlog,
  qualified review queues, approved phase depth, real shadow generation,
  20-workout coach pilot, empty-database bootstrap repair/rehearsal, staged
  flags, monitoring, and rollback evidence still block production.

## Automated gate snapshot after migration 455

- Push-Up passes every machine-verifiable current-card gate across 14 canonical
  source mappings, 11 selectable exact variants, two archived tempo modifier
  annotations, one archived duplicate variant, one quarantined ambiguous
  one-arm source, and 22 contextual delivery profiles. Migration 455 is
  registered by the production runner with checksum `2540177092`.
- Difficulty contains exercise complexity and physical difficulty only, with
  overall equal to their maximum. Exercise and safety skill/proficiency fields
  are null. The separate skill library remains the sole owner of skill levels.
- Five YouTube candidates have current healthy oEmbed metadata and remain
  unapproved. Qualified reviewers must still verify complete playback, exact
  identity and variant, captions, accessibility, safety, conflicting advice,
  demonstration quality, reviewer identity, reason, and timestamp.
- Identity is closed at 604/604 adjudicated score-72+ pairs, zero unresolved
  pairs, and zero exact collisions across 1,048 active definitions. Global
  graph/calibration queues contain 542/791 review-only rows and zero approvals;
  healthy three-to-five-link candidate coverage is 70/1,048.
- Direct and repeated disposable-PostgreSQL application, internal assertions,
  persisted independent audit, production-runner registration, 172 focused
  tests, all 724 platform tests, the backend suite (975 passed, 20 intentionally
  skipped, zero failed), focused lint, registry parsing, 12 management checks,
  10 launch checks, syntax/diff checks, and the production build are green.
- Machine completion does not authorize rollout. Push-Up still requires the
  media, coach-graph, independent-calibration, and two-person-publication human
  gates. The wider 926-plus-card taxonomy/support/generation backlog, approved
  phase depth, real shadow generation, 20-workout coach pilot, empty-database
  bootstrap repair/rehearsal, staged flags, monitoring, and rollback evidence
  also remain production blockers.

## Automated gate snapshot after migration 456

- Reverse Lunge passes every machine-verifiable current-card gate across nine
  source mappings, three selectable exact variants, one duplicate archive, one
  slow-eccentric modifier annotation, four identity-quarantined load-position
  sources, and six contextual delivery profiles. Migration 456 is registered
  by the production runner with checksum `2213004666`.
- Difficulty contains exercise complexity and physical difficulty only, with
  overall equal to their maximum. Exercise and safety skill/proficiency fields
  are null; athlete readiness remains workout-selection context, and skill
  levels remain exclusive to the skill library.
- Five YouTube candidates have current healthy oEmbed metadata and remain
  unapproved. Qualified reviewers must verify full playback, exact identity and
  variant, captions, accessibility, safety, conflicting advice, demonstration
  quality, reviewer identity, reason, and timestamp. Six graph proposals and
  six score anchors also remain review-only.
- Identity is closed at 604/604 adjudicated score-72+ pairs, zero unresolved
  pair, and zero exact collision across 1,048 active definitions. Global graph/
  calibration queues contain 548/797 review-only rows and zero approvals;
  healthy three-to-five-link candidate coverage is 71/1,048.
- Direct and repeated disposable-PostgreSQL application, internal assertions,
  persisted independent audit, production-runner registration, 174 focused
  tests, all 726 platform tests, the backend suite (977 passed, 20 intentionally
  skipped, zero failed), focused lint, registry parsing, CI checks, diff checks,
  and the production build are green.
- Machine completion does not authorize rollout. Reverse Lunge still requires
  media, coach-graph, independent-calibration, and two-person-publication human
  gates. The wider 925-plus-card taxonomy/support/generation backlog, approved
  phase depth, real shadow generation, 20-workout coach pilot, empty-database
  bootstrap repair/rehearsal, staged flags, monitoring, and rollback evidence
  also remain production blockers.

## Automated gate snapshot after migration 457

- Lateral Lunge passes every machine-verifiable current-card gate across eight
  original source records, seven retained Lateral Lunge mappings, one
  deterministic move to the Cossack Squat family, one selectable exact variant,
  one slow-eccentric modifier annotation, six identity-quarantined ambiguous
  sources, and two contextual delivery profiles. Migration 457 is registered
  by the production runner with checksum `2132631705`.
- Difficulty contains exercise complexity and physical difficulty only, with
  overall equal to their maximum. Exercise and safety skill/proficiency fields
  are null; athlete readiness remains workout-selection context and skill
  levels remain exclusive to the skill library.
- Five YouTube candidates have current healthy oEmbed metadata and remain
  unapproved. Qualified reviewers must verify full playback, exact bodyweight
  step-out identity, side/step/stance/return contract, captions, accessibility,
  safety, conflicting advice, demonstration quality, reviewer identity,
  reason, and timestamp. Six graph proposals and two score anchors remain
  review-only.
- Identity is closed at 604/604 adjudicated score-72+ pairs, zero unresolved
  pair, and zero exact collision across 1,048 active definitions. Global graph/
  calibration queues contain 554/799 review-only rows and zero approvals;
  healthy three-to-five-candidate coverage is 72/1,048.
- Direct and repeated disposable-PostgreSQL application, internal assertions,
  persisted independent audit, production-runner registration, 176 focused
  tests, all 728 platform tests, the backend suite (979 passed, 20 intentionally
  skipped, zero failed), focused lint, registry parsing, CI checks, diff checks,
  and the production build are green.
- Machine completion does not authorize rollout. Lateral Lunge still requires
  media, coach-graph, independent-calibration, and two-person-publication human
  gates. The wider 924-plus-card taxonomy/support/generation backlog, approved
  phase depth, real shadow generation, 20-workout coach pilot, empty-database
  bootstrap repair/rehearsal, staged flags, monitoring, and rollback evidence
  also remain production blockers.

## Automated gate snapshot after migration 458

- Medicine Ball Shot-Put passes every machine-verifiable current-card gate
  across seven source mappings, seven identity-quarantined source variants, one
  selectable review-only research-authored working specification, and two
  Output delivery profiles. Migration 458 is registered by the production
  runner with checksum `3889874252`.
- The exact working specification is static side-on, rear-shoulder/upper-chest
  start, declared pivot, unilateral wall release, balanced finish, no catch,
  safe retrieval, full reset, and balanced sides. Difficulty is exercise
  complexity plus physical difficulty only at `60/56/60`; exercise and safety
  skill/proficiency fields are null.
- Five YouTube candidates have current healthy oEmbed metadata and remain
  unapproved. Qualified reviewers must verify full playback, exact stance,
  orientation, ball position, foot/pivot action, target, release, return,
  finish, sides, captions, accessibility, safety, conflicts, quality, reviewer,
  reason, and timestamp. Four graph proposals and two score anchors remain
  review-only.
- Identity is closed at 605/605 adjudicated score-72+ pairs, zero unresolved
  pair, and zero exact collision across 1,048 active definitions. The newly
  surfaced Rollout false positive is explicitly distinct. Global graph/
  calibration queues contain 558/801 review-only rows with zero approvals;
  current healthy three-to-five-embeddable-candidate coverage is 79/1,048.
- Direct and repeated disposable-PostgreSQL application, internal assertions,
  persisted and non-persisting independent audits, production-runner
  registration, 177 focused tests, all 729 platform tests, the backend suite
  (980 passed, 20 intentionally skipped, zero failed), focused lint, registry
  parsing, CI checks, diff checks, and the production build are green.
- Machine completion does not authorize rollout. Shot-Put still requires media,
  coach-graph, independent-calibration, and two-person-publication human gates.
  The wider 923-plus-card taxonomy/support/generation backlog, approved phase
  depth, real shadow generation, 20-workout coach pilot, empty-database
  bootstrap repair/rehearsal, staged flags, monitoring, and rollback evidence
  also remain production blockers.

## Automated gate snapshot after migration 459

- Suitcase Carry passes every machine-verifiable current-card gate across seven
  source mappings, seven identity-quarantined source variants, three selectable
  review-only working specifications, and six contextual delivery profiles.
  Migration 459 is registered by the production runner with checksum
  `2184062840`.
- The active variants are straight-lane dumbbell (`40/50/50`), straight-lane
  kettlebell (`42/50/50`), and dumbbell single-line walk (`54/46/54`) for
  exercise complexity, physical difficulty, and overall. Overall is their
  maximum; exercise and safety skill/proficiency values are null.
- Five YouTube candidates have current healthy oEmbed metadata and remain
  unapproved. Qualified reviewers must verify full playback, exact implement,
  hand, pickup, route, foot rule, turn, pace, posture, finish, set-down, sides,
  captions, accessibility, safety, conflicts, quality, reviewer, reason, and
  timestamp. Eight graph proposals and six score anchors remain review-only.
- Identity remains closed at 605/605 adjudicated score-72+ pairs, zero
  unresolved pair, and zero exact collision across 1,048 active definitions.
  Global graph/calibration queues contain 566/807 review-only rows with zero
  approvals; the current healthy three-to-five-embeddable-candidate query
  covers 89/1,048 definitions.
- Direct and repeated disposable-PostgreSQL application, internal assertions,
  persisted and non-persisting independent audits, production-runner
  registration, 179 focused tests, all 731 platform tests, the backend suite
  (982 passed, 20 intentionally skipped, zero failed), focused lint, registry
  parsing, CI checks, diff checks, and the production build are green.
- Machine completion does not authorize rollout. Suitcase Carry still requires
  media, coach-graph, independent-calibration, and two-person-publication human
  gates. The wider 922-plus-card taxonomy/support/generation backlog, approved
  phase depth, real shadow generation, 20-workout coach pilot, empty-database
  bootstrap repair/rehearsal, staged flags, monitoring, and rollback evidence
  also remain production blockers.

## Automated gate snapshot after migration 460

- Bent-Knee Soleus Raise passes every machine-verifiable current-card gate
  across seven source mappings, seven identity-quarantined source variants,
  three selectable review-only research-authored working specifications, and
  six contextual delivery profiles. The source-432 direct definition collision
  is consolidated. Migration 460 is registered by the production runner with
  checksum `4019890797`.
- The variants are bilateral seated bodyweight floor (`32/24/32`), unilateral
  seated machine (`40/50/50`), and single-leg seated dumbbell floor
  (`48/44/48`) for exercise complexity, physical difficulty, and overall.
  Overall is their maximum. Exercise and safety skill/proficiency values are
  null; athlete readiness stays in workout selection and skill levels stay in
  the skill library.
- Five YouTube candidates have current healthy oEmbed metadata and remain
  unapproved. Qualified reviewers must verify playback, exact support, knee
  angle, laterality, implement/count/contact, surface, range, tempo, return,
  side dose, captions, accessibility, safety, conflicts, quality, reviewer,
  reason, and timestamp. Ten graph proposals and six score anchors remain
  review-only.
- Identity remains closed at 605/605 adjudicated score-72+ pairs, zero
  unresolved pair, and zero exact collision across 1,047 active definitions.
  Global graph/calibration queues contain 576/813 review-only rows with zero
  approvals. The precise current-card/distinct-video/healthy/embeddable query
  finds three to five candidates for 75/1,047 active definitions.
- Direct and repeated disposable-PostgreSQL application, internal assertions,
  persisted and non-persisting independent audits, production-runner
  registration, 181 focused tests, all 733 platform tests, the backend suite
  (984 passed, 20 intentionally skipped, zero failed), focused lint, registry
  parsing, 12 management checks, 10 launch checks, syntax checks, and the
  production build are green.
- Machine completion does not authorize rollout. Bent-Knee Soleus Raise still
  requires media, coach-graph, independent-calibration, and two-person-
  publication human gates. The wider 920-plus-card taxonomy/support/generation
  backlog, approved phase depth, real shadow generation, 20-workout coach
  pilot, empty-database bootstrap repair/rehearsal, staged flags, monitoring,
  and rollback evidence also remain production blockers.

## Automated gate snapshot after migration 461

- Back Squat passes all machine-verifiable current-card gates across five
  identity-quarantined legacy sources, two research-authored review-only
  variants, and four Capacity profiles. Migration 461 is production-runner
  registered at checksum `4070429771`.
- High-bar difficulty is `64/72/72`; low-bar is `68/76/76`, representing
  exercise complexity, physical difficulty, and derived overall. Exercise and
  safety skill/proficiency fields are null.
- Five oEmbed-healthy videos, eight graph proposals, and four score anchors
  remain unapproved. Qualified humans must verify full content, exact rack and
  movement contract, accessibility, safety, scoring, and publication.
- Identity is closed at 608/608 pairs, zero unresolved and zero exact collision
  across 1,047 active definitions. Graph/calibration queues are 584/817 with
  zero approvals; precise current-card 3–5-video coverage is 76/1,047.
- Direct/repeated PostgreSQL, persisted/non-persisting audits, production runner,
  183 focused tests, 735 platform tests, backend 986 passes plus 20 skips,
  focused lint, registry parsing, 12 management checks, 10 launch checks,
  syntax/diff checks, and production build are green.
- Machine completion does not authorize rollout. Back Squat still needs media,
  coach-graph, independent-calibration, and two-person-publication review. The
  wider 919-plus-card backlog, approved phase depth, real shadow generation,
  20-workout coach pilot, empty-database bootstrap rehearsal, staged flags,
  monitoring, and rollback evidence remain production blockers.

## Automated gate snapshot after migration 462

- Box Jump passes every machine-verifiable P0/P1 gate across nine archived
  source representations, four research-authored review-only working variants,
  and eight Movement Intelligence/Output profiles. Migration 462 is registered
  by the production runner with checksum `3490248206`.
- Difficulty vectors are `48/46/48` for stationary countermovement/natural
  arms, `54/46/54` for paused static/hands on hips, `50/46/50` for stationary
  countermovement/hands on hips, and `58/50/58` for one-step bilateral gather.
  They represent exercise complexity, physical difficulty, and derived overall.
  Exercise and safety proficiency fields are null; readiness is evaluated by
  workout selection and proficiency categories remain in skill-library cards.
- Five carried-forward oEmbed-healthy candidates remain unapproved, and the
  failed fresh fetch is explicitly not verification. Qualified reviewers must
  verify playback, exact approach/preload/arm/box/landing/exit contract,
  captions, accessibility, safety, conflicts, quality, reviewer identity, and
  timestamp. Ten graph proposals and eight score anchors remain review-only.
- Identity remains closed at 608/608 pairs, zero unresolved pair, and zero exact
  collision across 1,047 active definitions. Global graph/calibration queues
  contain 594/825 review-only rows and zero approvals; precise current-card
  3–5-video coverage remains 76/1,047.
- Atomic/repeated disposable PostgreSQL, persisted/non-persisting audits,
  production runner, 185 focused tests, 737 platform tests, backend 988 passes
  plus 20 skips, focused lint, registry `.75`/293 parsing, 12 management checks,
  10 launch checks, syntax/diff checks, and production build are green.
- Machine completion does not authorize rollout. Box Jump still requires media,
  coach-graph, independent-calibration, and two-person publication review. The
  wider 919-card support/generation backlog, approved phase depth, real shadow
  generation, 20-workout coach pilot, empty-database bootstrap rehearsal,
  staged flags, monitoring, and rollback evidence remain production blockers.

## Automated gate snapshot after migration 463

- Depth Jump passes every machine-verifiable P0/P1 gate across three archived
  source representations, two research-authored review-only working variants,
  and four Movement Intelligence/Output profiles. Migration 463 is registered
  by the production runner at checksum `2334448762`.
- Difficulty vectors are `64/72/72` for hands on hips and `68/72/72` for free
  coordinated arms, representing exercise complexity, physical difficulty, and
  derived overall. Exercise and safety proficiency fields are null; readiness
  remains a workout-selection concern and skill levels remain in skill cards.
- Five carried-forward oEmbed-healthy candidates remain unapproved; fresh
  fetches returned cache misses. Qualified humans must verify playback, exact
  platform/lead/arm/contact/rebound/landing contract, captions, accessibility,
  safety, conflicts, quality, reviewer identity, and timestamp. Eight graph
  proposals and four score anchors remain review-only.
- Identity is closed at 610/610 surfaced pairs, zero unresolved pair, and zero
  exact collision across 1,047 active definitions. Graph/calibration queues are
  600/827 review-only rows with zero approvals; precise current-card 3–5-video
  coverage remains 76/1,047.
- Atomic/repeated disposable PostgreSQL, nonpersisting/persisted audits,
  production runner, 187 focused tests, 739 platform tests, backend 990 passes
  plus 20 skips, focused lint, registry `.75`/293 parsing, 12 management checks,
  10 launch checks, syntax/sitemap-diff checks, and production build are green.
- Machine completion does not authorize rollout. Depth Jump still requires
  media, coach-graph, independent-calibration, and two-person publication
  review. The wider 919-card support/generation backlog, approved phase depth,
  real shadow generation, 20-workout coach pilot, empty-database bootstrap
  rehearsal, staged flags, monitoring, and rollback evidence remain blockers.

## Automated gate snapshot after migrations 464–466

- Nordic Hamstring Curl passes every machine-verifiable P0/P1 gate across three
  archived source representations, four research-authored review-only working
  variants, and eight Capacity/Resilience profiles. Migrations 464–466 are
  production-runner registered at checksums `2244701705`, `1500429394`, and
  `2749332346`.
- Difficulty vectors are `46/72/72` for eccentric catch/reset, `58/64/64` for
  band-assisted full cycle, `58/88/88` for unassisted full cycle, and `62/76/76`
  for the 30-degree-incline K30/H0 hold. These are exercise complexity, physical
  difficulty, and derived overall. Exercise and safety proficiency fields are
  null; readiness remains a workout-selection concern and skill levels remain
  in skill-library cards.
- Five current oEmbed-healthy, privacy-enhanced candidates remain unapproved.
  Qualified humans must verify playback, exact anchor/contraction/assistance/
  range/angle/tempo/catch/return contract, captions, accessibility, safety,
  conflicts, quality, reviewer identity, and timestamp. Ten graph proposals and
  eight score anchors remain review-only.
- Nordic and Reverse Nordic are explicitly distinct, and identity is closed at
  611/611 surfaced pairs with zero unresolved pair and zero exact collision
  across 1,047 active definitions. Global graph/calibration queues are 610/835
  review-only rows with zero approvals; precise current-card 3–5-video coverage
  is 77/1,047.
- Atomic/repeated disposable PostgreSQL, nonpersisting/persisted audits,
  production runner, 191 focused tests, 743 platform tests, backend 994 passes
  plus 20 skips, focused lint, registry `.76`/298 parsing, 12 management checks,
  10 launch checks, syntax/sitemap-diff checks, and production build are green.
- Machine completion does not authorize rollout. Nordic still requires media,
  coach-graph, independent-calibration, and two-person publication review. The
  wider backlog remains material: 955 anatomy, 951 load, 947 fatigue, 920
  difficulty/equipment, and 918-plus taxonomy/support/generation failures, plus
  approved phase depth, real shadow generation, a 20-workout coach pilot,
  empty-database bootstrap rehearsal, staged flags, monitoring, and rollback
  evidence.

## Automated gate snapshot after migrations 467–468

- Front Plank passes every machine-verifiable P0/P1 gate across four archived
  source representations, three review-only working variants, and six
  Resilience/Capacity delivery profiles. Migrations 467–468 are runner-
  registered at checksums `390303331` and `3371349113`.
- Difficulty vectors are `30/36/36` for standard forearm/toes, `44/58/58` for
  long-lever posterior tilt, and `40/68/68` for RKC high tension: exercise
  complexity, physical difficulty, and derived overall. Exercise and safety
  proficiency fields are null; readiness remains a workout-selection concern.
- PMID `32707142` has been removed from current plank provenance because it is
  a prone-CPR review. Registry `.77`/304 supplies 16 limited evidence sections.
  Five current oEmbed-healthy, privacy-enhanced candidates remain unapproved;
  qualified humans must verify playback, exact mechanics, captions,
  accessibility, safety, conflicts, quality, reviewer identity, and timestamp.
- Plank Hold and RKC are consolidated variants. Bear Plank, Glute Bridge, and
  Side Plank are explicitly distinct. Identity is closed at 613/613 surfaced
  pairs, zero unresolved pair, and zero exact collision across 1,045 active
  definitions. Graph/calibration queues are 617/841 review-only rows with zero
  approvals; precise current-card 3–5-video coverage is 78/1,045.
- Atomic/repeated disposable PostgreSQL, nonpersisting/persisted audits,
  production runner, 194 focused tests, 746 platform tests, backend 997 passes
  plus 20 skips, focused lint, registry parsing, 12 management checks, 10 launch
  checks, syntax/sitemap-diff checks, and production build are green.
- Machine completion does not authorize rollout. Front Plank still requires
  media, coach-graph, independent-calibration, and two-person publication
  review. The wider active backlog remains material: 952 anatomy, 948 load, 944
  fatigue, 917 difficulty/equipment, 916 delivery, and 915 support/generation/
  constraint/taxonomy failures, plus approved phase depth, real shadow
  generation, a 20-workout coach pilot, empty-database bootstrap rehearsal,
  staged flags, monitoring, and rollback evidence.

## Automated gate snapshot after migration 470

- Migration 470 passes direct and repeat disposable-PostgreSQL execution and is
  registered by the production runner at checksum `3586300106`.
- Focused canonical audit, research, and difficulty validation passes `200/200`;
  focused ESLint passes.
- The persisted library audit maps all 1,676 legacy rows to 1,044 active
  definitions, adjudicates 614/614 surfaced identity pairs, and reports zero
  unresolved exact collision. Machine-complete cards are 80; 964 still have at
  least one machine-authored-content blocker. Current 3–5-video candidate
  coverage is 79/1,044.
- Dead Bug itself has two exact working variants, six profiles, 16 evidence
  sections, 32 alternate decisions, four oEmbed-healthy candidates, four graph
  proposals, and four calibration proposals. Its independent packet retains
  only media, graph, calibration, and publication human gates.
- No rollout authorization follows from machine completion. All 1,044 active
  cards remain quarantined until qualified media, relationship, calibration,
  content, and publication review occurs; no such approval was fabricated.

## Automated gate snapshot after migration 471

- Migration 471 passes direct and repeat disposable-PostgreSQL execution and is
  production-runner registered at checksum `3237436721`.
- Focused canonical audit, research, and difficulty validation passes
  `201/201`; the persisted whole-library audit passes migration coverage.
- All 1,676 legacy rows remain mapped to 1,044 active definitions. All 614
  surfaced identity pairs are adjudicated, with zero unresolved exact
  collision. Machine-complete cards are 81; 963 retain at least one machine-
  authored-content blocker. Exact current-card 3–5-video candidate coverage is
  80/1,044.
- World's Greatest Stretch has two exact working variants, six delivery
  profiles, 16 evidence sections, 28 alternate decisions, four current
  oEmbed-healthy candidates, four graph proposals, and four calibration
  proposals. Its independent packet contains only media, graph, calibration,
  and publication human gates.
- This is not rollout authorization. All 1,044 active cards remain quarantined;
  the qualified-media, coach-graph, independent-calibration, content-review,
  separate-approval, shadow-generation, pilot, monitoring, and rollback queues
  remain external work.

## Automated gate snapshot after migrations 472 and 474

- Migration 472 creates exact shoulder-height and full-overhead Kettlebell
  Swing definitions with four difficulty-only working variants and eight
  Output/Capacity profiles. Migration 474 corrects the initially uncontrolled
  body-region and optional-equipment keys without changing identity, scores,
  dose, review state, or approval state. Production-runner checksums are
  `3340443758` and `1490465970`.
- Difficulty vectors are `56/58/58`, `64/60/64`, `66/62/66`, and `74/64/74`
  for exercise complexity, physical difficulty, and derived overall. Exercise
  and safety proficiency fields are null; readiness remains a deterministic
  workout-selection concern and skill levels remain in skill-library cards.
- Eight current healthy, privacy-enhanced media candidates remain unapproved.
  Qualified humans must verify full playback, exact definition and variant,
  hand count, side, bell count and mass, terminal height, style, start, return,
  cadence, park, captions, accessibility, safety, conflicts, cue quality,
  reviewer identity, and timestamp. Eight graph proposals and eight score
  anchors remain review-only.
- Direct and repeated disposable PostgreSQL, the independent persisted audit,
  production-runner registration, focused `204/204`, backend 1,003-pass/
  20-skip, focused lint, diff checks, registry `.79`/315 parsing, and the
  production build pass.
- The current library maps all 1,676 legacy rows to 1,045 active definitions.
  Identity is closed at 617/617 surfaced pairs with zero unresolved pair and
  zero exact collision. Machine-complete cards are 83 and machine-incomplete
  cards are 962. Exact current-card healthy embeddable 3–5-video coverage is
  82/1,045. All 1,045 definitions remain quarantined; both swing cards retain
  only media, graph, calibration, and publication human blockers.
- Machine completion does not authorize rollout. Global graph/calibration
  queues remain 610/813 review-only rows with zero approvals. The remaining
  authored-content backlog, qualified media and relationship review,
  independent score calibration, content review, two-person publication,
  approved phase depth, real shadow generation, a 20-workout coach pilot,
  empty-database bootstrap rehearsal, staged flags, monitoring, and rollback
  evidence remain production blockers.

## Automated gate snapshot after migration 475

- Pull-Up / Chin-Up now exposes seven exact difficulty-only variants and
  fourteen complete Capacity profiles. The exercise scores describe complexity
  and physical difficulty only; athlete readiness remains a deterministic
  selection input, and skill levels remain exclusive to skill-library cards.
- Direct and repeated disposable-PostgreSQL execution, production-runner
  registration, registry validation, focused `206/206`, backend 1,005-pass/
  20-skip, focused lint, persisted audit, diff checks, and production build are
  green. Migration checksum is `2352809545`.
- The current library maps all 1,676 legacy rows to 1,042 active definitions.
  Identity is closed at 616/616 surfaced pairs with zero unresolved pair and
  zero exact collision. Machine-complete cards are 84 and machine-incomplete
  cards are 958. Exact current-card healthy embeddable 3–5-video coverage is
  83/1,042. All 1,042 definitions remain quarantined; Pull-Up / Chin-Up retains
  only media, graph, calibration, and publication human blockers.
- This is not rollout authorization. Global graph/calibration queues are
  645/871 review-only rows with zero approvals. Qualified media and relationship
  review, independent score calibration, content review, separate publication
  approval, approved profile depth, real shadow generation, a 20-workout coach
  pilot, empty-database bootstrap rehearsal, staged flags, monitoring, and
  rollback evidence remain required.

## Automated gate snapshot after migration 476

- Hollow Body Hold exposes six static, exact difficulty-only variants and 12
  complete Movement Intelligence/Capacity profiles. A fixed implement remains
  a load variant; any rock, flutter, roll, lower, pullover, throw, catch, or
  exchange is a distinct action contract. Athlete readiness remains a workout-
  selection input, while skill levels remain exclusive to skill-library cards.
- Direct and repeated disposable-PostgreSQL execution, exact-file re-entry,
  production-runner registration, registry validation, focused `208/208`,
  backend 1,007-pass/20-skip, focused lint, persisted audit, diff integrity, and
  production build are green. Migration checksum is `1754451518`.
- Five current healthy privacy-enhanced media candidates remain unapproved.
  Qualified reviewers must verify full playback, exact static definition and
  variant, lever, side, implement and position, entry, breathing, stop, exit,
  captions, accessibility, cue quality, safety, conflicts, reviewer identity,
  timestamp, and card-version match. Twelve graph proposals and 12 complexity/
  physical-difficulty anchors remain review-only.
- The current library maps all 1,676 legacy rows to 1,042 active definitions.
  Identity remains closed at 616/616 surfaced pairs with zero unresolved pair
  and zero exact collision. Machine-complete cards are 85 and machine-
  incomplete cards are 957. Exact current-card healthy embeddable 3–5-video
  coverage is 84/1,042. All definitions remain quarantined; Hollow Body Hold
  retains only media, graph, calibration, and publication human blockers.
- This is not rollout authorization. Global graph/calibration queues are
  657/883 review-only rows with zero approvals. The remaining authored-content
  backlog, qualified media and relationship review, independent score
  calibration, content review, separate publication approval, approved phase
  depth, real shadow generation, the 20-workout coach pilot, empty-database
  bootstrap rehearsal, staged flags, monitoring, and rollback evidence remain
  required.

## 2026-08-09 — Source 44 rollout checkpoint

- Migration 520 is registered in the real platform runner at checksum
  `745227028` and passes immutable re-entry. It replaces the conflicting
  Standing Calf Raise rows with one review-only Source 44 specification while
  retaining all nine legacy family source variants as archived provenance.
  Source 44 remains unpublished; eight duplicate or unresolved legacy family
  rows are archived and unpublished. No approval or review authority was
  fabricated.
- The selectable review variant includes exact support, start, rise,
  checkpoint, return, count, task-only difficulty, anatomy, load, fatigue,
  recovery, cumulative budgets, logistics, duration, substitution
  revalidation, persistence, and distinct coach/member rendering. Step,
  unilateral, alternating, unsupported, loaded, sustained-isometric,
  eccentric-only, fast-elastic, bent-knee, seated, compound, clinical, and
  sport tasks do not enter this variant silently.
- Its packet retains exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Five healthy oEmbed responses
  prove current metadata and embedding availability only; playback, exact
  mechanics, captions, accessibility, demonstration quality, safety, scope,
  reviewer identity, card-version match, and approval remain human work.
- The research/migration slice passes 277/277, the single-workout full-story
  slice passes 65/65, the platform suite passes 829/829, and the backend suite
  passes 1,083 with 20 intentional skips out of 1,103. Focused lint, generated
  packet validation, diff integrity, and the production build pass; the build
  reports only stale browser-data and greater-than-500-kB bundle advisories.
- Machine coverage is now 10.88% for scores, anatomy, support, complete
  candidate research packets, candidate evidence-section coverage, and
  alternates; 11.07% for operational profiles; 8.44% for load; 8.91% for
  fatigue; 69.98% for candidate media sets; and 5.82% for embeddable candidate
  sets. Reviewed research, approved media, approved graph, approved
  calibration, and publication coverage remain zero.
- Production release remains correctly blocked: 0 published canonical
  definitions, zero phase depth, 0/490 approved relationships, 0/699 approved
  calibration anchors, and 0 coach-pilot reviews. Qualified review,
  clean-bootstrap repair for historical failed migrations, shadow generation,
  staged rollout, monitoring, rollback, incident response, and support
  rehearsal remain required.

## Automated gate snapshot after migration 477

- Freestanding and wall-supported Handstand Holds now expose four exact
  difficulty-only variants and eight Movement Intelligence/Capacity profiles.
  Support, contact, orientation, surface, entry, timer, stop, and exit are
  explicit selection facts. Exercise scores describe complexity and physical
  difficulty only; athlete readiness remains a workout input and skill levels
  remain exclusive to skill-library cards.
- Direct and repeated disposable-PostgreSQL execution, production-runner
  registration, exact-file re-entry, registry validation, focused `206/206`,
  backend 1,009-pass/20-skip, focused lint, persisted audit, diff integrity, and
  production build are green. Migration checksum is `913966457`; registry
  version `.82` contains 340 sources.
- Ten current healthy privacy-enhanced media candidates remain unapproved.
  Qualified humans must verify full playback, exact definition and variant,
  support, orientation, contact, line, gaze, entry, timer boundary, stop, exit,
  captions, accessibility, cue quality, safety, conflicts, reviewer identity,
  timestamp, and card-version match. Eight graph proposals and eight exercise-
  difficulty anchors remain review-only.
- The current library maps all 1,676 legacy rows to 1,042 active definitions.
  Identity remains closed at 616/616 surfaced pairs with zero unresolved pair
  and zero exact collision. Machine-complete cards are 87 and machine-incomplete
  cards are 955. Exact current-card healthy embeddable 3–5-video coverage is
  86/1,042. All definitions remain quarantined; both Handstand cards retain only
  media, graph, calibration, and publication human blockers.
- The operational release check remains intentionally blocked: 0 published
  definitions, 0 approved graph edges, 0 approved calibration anchors, zero
  approved depth in every required phase, and 0/20 real coach reviews. Global
  graph/calibration queues are 665/891 review-only rows. Remaining card
  authorship, qualified review, shadow generation, the coach pilot, clean-
  database rehearsal, staged flags, monitoring, and rollback evidence remain
  production requirements.

## Automated gate snapshot after migration 482

- Bar Cast and Cast to Handstand now expose seven exact difficulty-only
  variants and 14 Prepare & Access/Movement Intelligence profiles. Rail, grip,
  mount, start support, technique, assistance, peak or terminal state, return
  or exit, valid repetition, stop behavior, logistics, duration, substitutions,
  budgets, and coach/athlete rendering are generator inputs. Athlete skill
  levels remain exclusive to skill-library cards.
- Final migration bytes pass repeated direct disposable-PostgreSQL execution,
  production-runner registration, checksum comparison, and exact registered-
  file re-entry at `229324910`. Registry `.85` contains 364 sources. Focused
  tests pass `218/218`; the full backend suite passes 1,017 tests with 20
  intentional skips. Focused lint, JSON parsing, persisted audit, identity
  reporting, diff integrity, and production build pass with only the existing
  stale browser-data and >500 kB chunk advisories.
- Six current healthy privacy-enhanced media candidates remain unapproved.
  Qualified humans must verify full playback, exact definition/variant, rail,
  grip, start, peak or vertical tolerance, body technique, assistance, return
  or exit, captions, accessibility, cue quality, safety, conflicts, reviewer,
  timestamp, and card version. Fourteen graph and 14 calibration proposals also
  remain review-only.
- The library maps all 1,676 legacy rows to 1,043 active definitions. Identity
  is closed at 617/617 surfaced pairs, with no unresolved pair or exact
  collision. Machine-complete cards are 91 and incomplete cards are 952;
  current 3–5 healthy candidate-media coverage is 90/1,043. Graph/calibration
  queues are 695/917 review-only rows with zero approvals. All definitions
  remain quarantined.
- Release remains intentionally blocked at 0/25 published definitions, phase
  depth 0/3, 0/10 approved graph edges, 0/3 approved calibration anchors, and
  0/20 real coach reviews. Qualified card review, shadow generation, coach
  pilot, clean-database rehearsal, staged flags, monitoring, and rollback
  evidence remain production work.

## Automated gate snapshot after migrations 479–481

- Gymnastics Back Bridge Hold now has three exact difficulty-only static-hold
  variants and six Prepare & Access/Movement Intelligence profiles. Supine
  entry, palm and foot support, low-step height, side/free-leg position, head
  clearance, valid seconds, first fault, and controlled exit are generator and
  persistence inputs. Dynamic Backbend, Kickover and Walkover performance and
  skill levels remain separate skill-library content.
- Migrations 479, 480 and 481 pass repeated direct execution, normal-runner
  registration, and exact-file re-entry at checksums `4176817151`,
  `2984990515`, and `722794694`. The two corrective migrations preserve
  immutable history while fixing a normalized score-shape/zero-impact defect
  and canonical anatomy-key aliases exposed by the persisted audit.
- Registry `.84` contains 357 sources. Focused tests pass `216/216`; the full
  backend suite passes 1,015 tests with 20 intentional skips. Focused lint,
  registry parsing, persisted audit, identity report, diff integrity, and the
  production build pass. Existing stale browser-data and >500 kB chunk
  warnings remain advisory.
- The library maps all 1,676 legacy rows to 1,042 active definitions. Identity
  is closed at 617/617 surfaced pairs with zero unresolved pair or exact
  collision. Machine-complete cards are 89 and machine-incomplete cards are
  953; exact current-card healthy embeddable 3–5-video coverage is 88/1,042.
  Graph/calibration queues are 681/903 review-only rows with zero approvals.
- Back Bridge media remains four candidate rows with only current oEmbed
  metadata. Qualified humans must verify full playback, exact definition and
  variant, entry, every support point, height, side, free-leg geometry, head
  clearance, hold and exit, captions, accessibility, cue quality, safety,
  conflicts, reviewer identity, timestamp, and card version. Graph,
  calibration, content, and publication decisions remain unapproved.
- Release remains intentionally blocked: 0/25 published definitions, depth 0
  versus 3 required in every phase, 0/10 approved graph edges, 0/3 approved
  calibration anchors, and 0/20 real coach reviews. Card authorship, qualified
  review, shadow generation, coach pilot, clean-database rehearsal, staged
  flags, monitoring, and rollback evidence remain production work.

## Automated gate snapshot after migration 478

- Cartwheel Hand-Placement Line Drill now exposes three exact difficulty-only
  variants and six Prepare & Access/Movement Intelligence profiles. Side,
  start, markers, hand orientation, support, wall contact, full turnover,
  terminal foot order, finish, and stop/exit behavior are generator inputs.
  Full Cartwheel skill levels remain exclusive to the skill library.
- Direct and repeated disposable-PostgreSQL execution, production-runner
  registration, exact-file re-entry, registry validation, focused `212/212`,
  backend 1,011-pass/20-skip, focused lint, persisted audit, identity report,
  diff integrity, and production build are green. Migration checksum is
  `1161560817`; registry version `.83` contains 348 sources.
- Five current healthy privacy-enhanced media candidates remain unapproved.
  Qualified humans must verify full playback, exact card and variant, side,
  start, hand orientation, five marks, support, wall/spotter contact, turnover,
  foot order, finish, captions, accessibility, cue quality, safety, conflicts,
  reviewer identity, timestamp, and card-version match. Eight graph proposals
  and six exercise-difficulty anchors remain review-only.
- The library maps all 1,676 legacy rows to 1,042 active definitions. Identity
  remains closed at 616/616 surfaced pairs with zero unresolved pair and zero
  exact collision. Machine-complete cards are 88 and machine-incomplete cards
  are 954. Exact current-card healthy embeddable 3–5-video coverage is
  87/1,042. All definitions remain quarantined; Cartwheel retains only media,
  graph, calibration, and publication human blockers.
- The operational release check remains intentionally blocked: 0 published
  definitions, 0 approved graph edges, 0 approved calibration anchors, zero
  approved depth in every required phase, and 0/20 real coach reviews. Global
  graph/calibration queues are 673/897 review-only rows. Remaining card
  authorship, qualified review, shadow generation, the coach pilot, clean-
  database rehearsal, staged flags, monitoring, and rollback evidence remain
  production requirements.

## Automated gate snapshot after migration 484

- Handstand Snap-Down source 18 is machine-complete at card version 2 with two
  exact difficulty-only variants, four operational profiles, full planning and
  support fields, 16 candidate evidence sections, four current media
  candidates, 24 alternate assessments, eight explicit identity boundaries,
  eight graph proposals, four calibration anchors, and one audit packet. It
  remains quarantined for exactly media, graph, calibration, and publication
  human gates.
- Migration `484_coaching_handstand_snap_down_family_audit_hardening.sql`
  passes repeated direct disposable-PostgreSQL execution, production-runner
  registration, stored/file checksum comparison, normal-runner skip, and
  exact-file re-entry at checksum `4224855249`. Registry JSON, focused ESLint,
  `git diff --check`, focused `220/220`, full backend 1,019-pass/20-skip,
  persisted audit, identity report, and production build pass. Existing stale
  browser-data and large-chunk warnings remain advisory.
- The library now has 1,676/1,676 mappings, 1,043 active definitions, 92
  machine-complete and 951 machine-incomplete cards, and 91/1,043 exact
  current-card healthy embeddable 3–5-candidate sets. Identity is closed at
  617/617 surfaced pairs with zero unresolved pair and zero exact collision.
  Graph/calibration queues are 702/921 review-only rows with zero approvals.
- Release status remains correctly `blocked`: 0 of 25 required definitions are
  published; all seven required phases have zero approved depth versus three;
  approved relationships are 0/10; approved calibration anchors are 0/3; and
  real coach reviews are 0/20. Registry `2026-08-02.86` contains 368 sources.
- Qualified reviewers must still watch every media candidate in full; verify
  exact starts, supports, wall contact, action, hand release, simultaneous
  feet, no-rebound stick, captions, accessibility, safety, cues, and conflicts;
  adjudicate evidence, alternates, relationships, and difficulty anchors;
  perform independent content review and approval; establish published phase
  depth; run shadow generation and real coach pilot; rehearse on a clean
  database; and prove staged flags, monitoring, rollback, incident, and support
  operations before production authorization.

## Automated gate snapshot after migrations 485–486

- Source 19 now yields three machine-complete, publication-quarantined cards:
  Two-Bar Lache Transfer to Retained Catch, Bar Hollow–Arch Tap Swing, and
  Lache Precision to Two-Foot Stick. Together they provide 6 exact
  difficulty-only variants, 16 operational profiles, 48 evidence sections, 15
  current media candidates, 38 alternate assessments, 15 identity boundaries,
  11 relationship proposals, and 12 calibration proposals. Each current audit
  packet has only media, graph, calibration, and publication human gates.
- Migration 485 passes repeated direct disposable-PostgreSQL execution,
  production registration, stored/local checksum comparison, normal-runner
  skip, and exact-file re-entry at checksum `376239898`. Independent audit
  detected missing canonical load/provenance keys; corrective migration 486
  passed the same gate sequence at checksum `4213002410` and reduced all three
  cards to human-only blockers. This correction did not create an approval or
  alter identity or difficulty.
- Registry JSON `2026-08-02.87`/374, focused ESLint, JSON parsing,
  `git diff --check`, focused `223/223`, full backend 1,022-pass/20-skip,
  persisted audit, identity report, and production build pass. Existing stale
  browser-data and large-chunk warnings remain advisory.
- Global state is 1,676/1,676 mappings, 1,045 active definitions, 95 machine-
  complete and 950 incomplete cards, and 94/1,045 exact current healthy
  embeddable 3–5-candidate sets. Identity remains 617/617 adjudicated surfaced
  pairs with zero unresolved pair or exact collision. Graph/calibration queues
  contain 713/933 review-only rows and zero approvals.
- Release is correctly `blocked`: 0/25 published, 0/3 approved depth in each
  of seven phases, 0/10 approved relationships, 0/3 approved calibration
  anchors, and 0/20 real coach reviews. The release report shows 1,045 cards in
  review, 0 media failures, 713 relationships in review, 933 calibrations in
  review, and 0 connected approved variants.
- Production authorization still requires qualified full-video review,
  evidence and identity review, independent score calibration, graph
  adjudication, separate content review and publication approval, sufficient
  published phase depth, shadow generation, representative substitutions and
  failure testing, a real coach pilot, clean-database rehearsal, staged flags,
  monitoring, rollback, incident response, and user/coach support readiness.

## Source-20 / full-turn checkpoint after migrations 487 and 489

- Automated family authorship now passes for `Broad Jump to Stick` card 3 and
  `Bilateral 360-Degree Jump to Stick` card 1. Both current packets contain
  only media, graph, calibration, and publication human gates; neither card is
  published or approved.
- Migration 487 is registered at checksum `2192026862`; six surfaced neighbor
  pairs were then closed by immutable migration 489 at checksum `1326745458`.
  The identity queue is 626/626 adjudicated with zero unresolved pair and zero
  exact collision.
- Registry `.88`, focused validation, focused lint, JSON/diff checks, two-pass
  direct SQL, production-runner registration/skip/re-entry, persisted audit,
  the 1,025-pass backend suite, and the production build are green. Existing
  browser-data freshness and large Admin-chunk notices remain advisories.
- Library state is 1,676/1,676 mappings, 1,045 active definitions, 96 machine-
  complete and 949 machine-incomplete cards, 95 healthy current embeddable
  media sets, 724 review-only graph edges, 939 review-only calibration rows,
  and zero approvals or publications.
- Release is correctly `blocked`: 0/25 published, 0/3 approved depth in every
  required phase, 0/10 approved relationships, 0/3 approved calibration
  anchors, and 0/20 real coach reviews. Full-video review, evidence/identity/
  alternate review, independent difficulty calibration, graph adjudication,
  content review, separate publication approval, phase depth, shadow exercise
  selection, substitutions and failure testing, clean deployment rehearsal,
  a representative coach pilot, monitoring/rollback/incident proof, and coach/
  athlete support readiness remain production requirements.

## Source-21 / full-turn checkpoint after migration 490

- Automated family authorship now passes for supported bilateral-reach 90/90
  breathing, wall-supported lateral-expansion breathing, and the exact 90/90
  hip-lift/ball/balloon sequence. All three current packets contain only
  media, graph, calibration, and publication human gates; none is published or
  approved.
- Migration 490 is registered at checksum `3490270351` and passed unchanged
  direct execution twice, normal-runner registration/skip, stored/local
  checksum comparison, exact-file re-entry, family assertions, and global
  audit. Registry `.89` has 383 sources; focused validation is 228/228; full
  backend validation is 1,030 pass plus 20 intentional skips; focused lint,
  JSON/diff checks, identity reporting, and production build are green.
- Library state is 1,676/1,676 mappings, 1,047 active definitions, 99 machine-
  complete and 948 machine-incomplete cards, 98 healthy current embeddable
  3–5-media sets, 734 review-only graph edges, 947 review-only calibration
  rows, and zero approvals or publications. The identity detector is 627/627
  adjudicated with zero unresolved pair and zero collision.
- Release is correctly `blocked`: 0/25 published, 0/3 approved depth in all
  seven phases, 0/10 approved relationships, 0/3 approved calibration anchors,
  and 0/20 real coach reviews. The blocked result is a valid human/rollout gate,
  not an automated validation failure.
- Production authorization still requires qualified full-video review;
  evidence, identity, alternate, graph, and difficulty adjudication; separate
  content review and publication approval; published phase depth; shadow
  generation; representative substitution/failure testing; a clean-database
  deployment rehearsal; a real coach pilot; staged flags; monitoring,
  rollback, and incident proof; and coach/athlete/support readiness. The 948
  remaining machine-incomplete cards also require the same family-by-family
  authorship process before comprehensive library rollout.

## Source-22 Crocodile Breathing checkpoint after migrations 491–492

- Automated family authorship now passes for the three exact Crocodile
  Breathing support/feedback variants. Its current packet contains only media,
  graph, calibration, and publication human gates; the card remains in review
  and unpublished.
- Migration 491 is registered at checksum `1519177130`. The authoritative
  audit caught a canonical score-floor incompatibility that SQL constraints did
  not expose; corrective migration 492 is registered at checksum `763304095`.
  Both passed repeated direct execution, normal-runner registration/skip,
  checksum comparison, exact re-entry, family assertions, and global audit.
- Registry `.90` has 386 sources; focused validation is 231/231; full backend
  validation is 1,033 pass plus 20 intentional skips; focused lint, JSON/diff
  checks, identity reporting, and production build are green.
- Library state is 1,676/1,676 mappings, 1,047 active definitions, 100 machine-
  complete and 947 machine-incomplete cards, 99 healthy current embeddable
  3–5-media sets, 740 review-only graph edges, 953 review-only calibration
  rows, and zero approvals or publications. The identity detector is 628/628
  adjudicated with zero unresolved pair and zero collision.
- Release remains correctly `blocked`: 0/25 published, zero approved phase
  depth, 0/10 approved relationships, 0/3 approved calibration anchors, and
  0/20 real coach reviews. Production authorization still requires qualified
  full-video review; evidence, identity, alternate, graph, and difficulty
  adjudication; separate content/publication approval; phase depth; shadow
  generation; representative substitution/failure tests; clean-database
  rehearsal; staged flags; monitoring/rollback/incident proof; support
  readiness; and a representative real coach pilot. The remaining 947
  machine-incomplete cards still require family-by-family authorship.

## 2026-08-02 — Source 23 rollout checkpoint

- Immutable migrations 493 (`3758480733`, registered
  `2026-08-02 15:15:10.588696-04`) and 494 (`3916243330`, registered
  `2026-08-02 15:22:32.216772-04`) pass disposable-PostgreSQL idempotency,
  production registration/skip, checksum comparison, exact-file re-entry, and
  authoritative audit. Migration 494 corrects only the 240-character athlete-
  instruction contract and controlled graph dimensions; it creates no review
  or approval state.
- Source 23 contributes one machine-complete composite card, two exact review
  variants, four operational profiles, one current 4-video candidate set, and
  review packets for evidence, alternates, identity, graph, calibration,
  content, and publication. It remains nonselectable for a published pool until
  those human gates are completed.
- Global automated coverage is 1,676/1,676 mappings, 1,047 cards in review, 101
  machine-complete / 946 machine-incomplete, 100 healthy embeddable 3–5-media
  sets, 746 review-only graph edges, 957 review-only calibration rows, 628/628
  surfaced identity pairs adjudicated, zero unresolved collision, and zero
  approvals or publications. Coverage metrics are 14.71% score complete,
  14.52% anatomy, 11.65% load, 12.03% fatigue, 14.52% support, 14.71%
  operational, 14.52% candidate research cards, and 9.55% healthy embeddable
  candidate sets.
- Focused tests pass 234/234, the full backend passes 1,036 with 20 intentional
  skips, and lint, JSON parsing, diff integrity, persisted audit, identity
  reporting, and production build pass. A concurrent class-setup row-layout
  type mismatch was repaired compatibly before the successful build; no
  exercise or scheduling behavior was removed.
- Release remains correctly `blocked`: 0/25 published, zero approved phase
  depth, 0/10 approved relationships, 0/3 approved calibration anchors, and
  0/20 real coach reviews. Production authorization still requires qualified
  full-video and content review; evidence/alternate/identity/graph/difficulty
  adjudication; separate publication approval; shadow generation; representative
  substitution and failure tests; clean deployment rehearsal; staged flags;
  monitoring, rollback, and incident proof; support readiness; and a real
  coach pilot. The remaining 946 machine-incomplete cards still require exact
  family-by-family authorship.

## 2026-08-02 — Source 24 rollout checkpoint

- Immutable migration 495 (`303191298`, registered
  `2026-08-02 15:51:41.167193-04`) passes unchanged direct execution,
  production-runner registration/skip, stored/local checksum comparison,
  exact-file re-entry, family invariants, and authoritative audit. It creates
  no human review or approval state.
- Source 24 contributes one machine-complete survivor, two exact review
  variants, four operational profiles, one current five-video candidate set,
  and quarantined evidence, alternate, identity, graph, calibration, content,
  and publication packets. Source 897 is an archived duplicate, reducing the
  active-definition count by one without losing legacy mapping or provenance.
- Global automated coverage is 1,676/1,676 mappings, 1,046 active definitions,
  102 machine-complete / 944 machine-incomplete, 101 healthy current
  embeddable 3–5-media sets, 750 review-only graph edges, 961 review-only
  calibration rows, 628/628 surfaced identity pairs adjudicated, zero
  unresolved collision, and zero approvals or publications. Coverage is
  14.82% score, 14.63% anatomy, 11.76% load, 12.14% fatigue, 14.63% support,
  14.82% operational, 14.63% candidate-research cards, and 9.66% healthy
  embeddable sets.
- Focused tests pass 236/236, the full backend passes 1,038 with 20 intentional
  skips, and lint, JSON parsing, diff integrity, persisted/no-persist audits,
  identity reporting, release checks, and production build pass.
- Release remains correctly `blocked`: 0/25 published, zero approved phase
  depth, 0/10 approved relationships, 0/3 approved calibration anchors, and
  0/20 real coach reviews. Production authorization still requires qualified
  full-video and content review; evidence/alternate/identity/graph/difficulty
  adjudication; separate publication approval; published phase depth; shadow
  generation; representative substitutions and failure tests; clean deployment
  rehearsal; staged flags; monitoring, rollback, and incident proof; support
  readiness; and a real coach pilot. The remaining 944 machine-incomplete
  cards still require exact family-by-family authorship.

## 2026-08-02 — Source 25 rollout checkpoint

- Immutable migration 496 (`2147238365`, registered
  `2026-08-02 16:24:07.458606-04`) passes two unchanged direct executions,
  production-runner registration and skip, stored/local checksum comparison,
  exact-file re-entry, persisted/no-persist audits, family assertions, identity
  reporting, and release checking. It creates no human review or approval.
- Source 25 contributes one machine-complete survivor, two exact review
  variants, four operational profiles, one current five-video candidate set,
  and quarantined evidence, alternate, identity, graph, calibration, content,
  and publication packets. Source 889 is an archived duplicate with its ordered
  segmental sequence preserved as an exact survivor variant, reducing active
  definitions by one without losing legacy mapping or provenance.
- Global automated coverage is 1,676/1,676 mappings, 1,045 active definitions,
  103 machine-complete / 942 machine-incomplete, 102 current healthy
  embeddable 3–5-media sets, 755 review-only graph edges, 965 review-only
  calibration rows, 628/628 surfaced identity pairs adjudicated, zero
  unresolved collision, and zero approvals or publications. Release coverage
  is 14.93% score, 14.74% anatomy, 11.87% load, 12.25% fatigue, 14.74%
  support, 14.93% operational, 14.74% candidate-research cards, and 9.76%
  healthy embeddable sets.
- Focused tests pass 238/238; the full backend passes 1,040 with 20 intentional
  skips; focused ESLint, four changed-JSON parses, diff integrity, PostgreSQL
  proofs, audits, identity/release reports, and production build pass. Existing
  browser-data freshness and the 855.69-kB Admin chunk warning are nonblocking.
- Release remains correctly `blocked`: 0/25 published, zero approved phase
  depth, 0/10 approved relationships, 0/3 approved calibration anchors, and
  0/20 real coach reviews. Production authorization still requires full-video,
  evidence, alternate, identity, graph, difficulty, content, and publication
  review; published phase depth; shadow generation; representative
  substitutions and failure tests; clean deployment rehearsal; staged flags;
  monitoring, rollback, and incident proof; support readiness; and a real
  coach pilot. The remaining 942 machine-incomplete cards continue with Source
  26 `Quadruped Spinal Circles`.

## 2026-08-09 — Source 26 rollout checkpoint

- Migration 497 (`3770465916`) passes two unchanged direct executions,
  normal-runner registration/third idempotent execution, immutable skip, exact
  family assertions, per-card canonical audit, focused and full tests, and
  production build. It creates no human review or approval state.
- Source 26 contributes one machine-complete review card, one exact
  fixed-contact variant, two contextual profiles, one current five-video
  candidate set, and candidate-only evidence, alternates, identity, graph,
  calibration, content, and publication records. Its per-card audit contains
  only media, graph, calibration, and publication human gates. Source 27 is
  already at the same machine-complete/human-gated state; Source 28
  `Side-Lying Open Book` is the next machine-incomplete family.
- Validation passes 236 focused tests, 788 platform tests, and 1,042 backend
  tests with 20 intentional skips. Focused lint, JSON parsing, generated
  packet/manifest checks, diff integrity, canonical coverage, the 1,592/1,592
  published-legacy Needs Engine audit, and production build pass. Existing
  browser-data freshness and large Admin-chunk warnings remain advisory.
- Release remains correctly `blocked`: the disposable reconstruction has zero
  published canonical definitions and phase depth, 0/10 approved
  relationships, 0/3 approved calibration anchors, and 0/20 real coach
  reviews. Source 26 additionally requires full-video, evidence, alternate,
  identity, graph, difficulty, content, comprehension, and separate
  publication review. No approval may be inferred from machine completeness or
  oEmbed health.
- A clean-database rollout is not yet proven. The full numbered migration path
  currently orders `426_drop_in_notification_tracking.sql` before the
  unnumbered prerequisite that creates `drop_in_registration`. Later family-
  audit migrations also reference UUIDs that migration 243 generates
  nondeterministically on a fresh database. Source 26 was validated using a
  disposable-only faithful Source-23-through-25 reconstruction; production
  rollout must repair the bootstrap order/identity determinism and then rerun
  the entire database from empty without normalization shortcuts.
- Production authorization still requires the human gates above, sufficient
  reviewed/published phase depth, shadow generation, representative
  substitution and failure tests, clean-database rehearsal, staged flags,
  monitoring, rollback, incident proof, support readiness, and a real coach
  pilot meeting the configured acceptance/edit thresholds.

## 2026-08-09 — Source 28 rollout checkpoint

- Migration 498 (`18231930`) passes two unchanged direct executions,
  normal-runner registration and immutable skip, family assertions, focused
  and full suites, audits, and the production build. It creates no human review
  or approval state.
- Source 28 contributes one machine-complete survivor, one exact review
  variant, two operational profiles, one five-video candidate set, and
  candidate-only evidence, alternates, identity decisions, graph proposals,
  calibrations, content, and publication records. Sources 891 and 1306 are
  archived exact duplicates with mappings and lineage preserved. The Source 28
  packet has only media, graph, calibration, and publication human gates.
- Validation passes 238 focused tests, 790 platform tests, and 1,044 backend
  tests with 20 intentional skips. Focused lint, JSON/generated artifacts,
  diff integrity, repeated PostgreSQL application, runner registration/skip,
  family invariants, the 1,589/1,589 published-legacy Needs Engine audit,
  canonical and release reporting, and the production build pass. Browser-
  compatibility data freshness and the greater-than-500-kB Admin bundle remain
  nonblocking advisories.
- Release remains correctly `blocked`: zero canonical definitions and phase
  depth are published, 0/10 relationships and 0/3 calibration anchors are
  approved, and 0/20 real coach reviews exist. Qualified reviewers must still
  watch the five videos, adjudicate all evidence, alternates, identities,
  graph and difficulty proposals, review coach/athlete/support content, test
  comprehension, and provide separate publication approval.
- Clean-database rollout remains unproven because migration 426 precedes its
  unnumbered `drop_in_registration` prerequisite and later family migrations
  depend on migration-243 UUIDs that are nondeterministic on a fresh database.
  These are explicit production blockers; the Source 28 migration itself was
  validated on the disposable faithful reconstruction without modifying
  unrelated scheduling work.
- Production authorization additionally requires enough reviewed/published
  phase depth, shadow generation, representative substitution and failure
  tests, a repaired empty-database rehearsal, staged flags, monitoring,
  rollback and incident proof, support readiness, and a coach pilot that meets
  the configured acceptance and edit thresholds. Source 29 `Inchworm Walkout`
  is the next machine-incomplete family.

## 2026-08-09 — Source 29 rollout checkpoint

- Migrations 499 (`1634112643`) and 500 (`546720287`) pass repeated direct
  execution, normal-runner registration and immutable skip, family and identity
  assertions, focused and full suites, audits, and the production build. They
  create no human review or approval state.
- Source 29 contributes one stable machine-complete definition, two exact
  review variants, four operational profiles, one five-video candidate set,
  and candidate-only evidence, alternates, identity decisions, graph proposals,
  calibrations, content, and publication records. Its packet contains only the
  four intended media, graph, calibration, and publication human gates.
- Validation passes 241 focused tests, 793 platform tests, and 1,047 backend
  tests with 20 intentional skips. Focused lint, JSON/generated artifacts,
  diff integrity, repeated PostgreSQL application, runner checks, persisted
  invariants, the 1,588/1,588 published-legacy Needs Engine audit, canonical
  and release reporting, and the production build pass. Browser-data freshness,
  the greater-than-500-kB Admin bundle, and clean-bootstrap defects remain
  advisories or explicit blockers as already classified.
- Release remains correctly `blocked`: zero canonical definitions and phase
  depth are published, graph and calibration proposals remain unapproved, and
  no real coach-pilot review exists. Qualified reviewers must still watch all
  five videos, adjudicate evidence, alternates, identities, graph and score
  proposals, review coach/athlete/support content, test comprehension, and
  provide separate publication approval.
- Clean-database rollout remains unproven because migration 426 precedes its
  unnumbered `drop_in_registration` prerequisite and later family migrations
  depend on nondeterministic migration-243 UUIDs. No production data or
  unrelated scheduling work was changed to conceal those defects.
- Production authorization additionally requires sufficient reviewed and
  published phase depth, shadow generation, representative substitution and
  failure tests, a repaired empty-database rehearsal, staged flags, monitoring,
  rollback and incident proof, support readiness, and a coach pilot meeting the
  configured thresholds. Source 30 `Wrist Rockers — Palms Down` is next.

## 2026-08-09 — Source 30 rollout checkpoint

- Migration 501 (`3818017833`) passes repeated direct execution, production-
  runner registration and immutable skip, family assertions, focused and full
  suites, audits, and the production build. It creates no human review or
  approval state.
- Source 30 contributes one stable machine-complete definition, one exact
  review variant, two operational profiles, one five-video candidate set, and
  candidate-only evidence, alternates, identity decisions, graph proposals,
  calibrations, content, and publication records. After correcting one
  uncontrolled body-region label and two graph dimensions, the persisted card
  packet contains only media, graph, calibration, and publication human gates.
- Validation passes 243 focused tests, 795 platform tests, and 1,049 backend
  tests with 20 intentional skips. Focused lint, JSON/generated artifacts,
  diff integrity, repeated PostgreSQL application, runner checks, persisted
  invariants, the 1,587/1,587 published-legacy Needs Engine audit, canonical
  and identity audits, expected blocked release reporting, and the production
  build pass. Browser-data freshness and the greater-than-500-kB Admin bundle
  remain nonblocking advisories.
- Release remains correctly `blocked`: 0 canonical definitions and phase depth
  are published, 0/438 graph edges and 0/661 calibration anchors are approved,
  and 0 real coach-pilot reviews exist. Qualified reviewers must still watch
  all five videos, adjudicate evidence, alternates, identities, graph and score
  proposals, review coach/athlete/support content, test comprehension, and
  provide separate publication approval.
- Clean-database rollout remains unproven because migration 426 precedes its
  unnumbered `drop_in_registration` prerequisite and later family migrations
  depend on nondeterministic migration-243 UUIDs. No production data or
  unrelated scheduling work was changed to conceal those defects.
- Production authorization additionally requires at least 25 reviewed and
  published definitions, depth of 3 in every required phase, 10 approved graph
  edges, 3 independently approved calibration anchors, shadow generation,
  substitution/failure rehearsals, repaired empty-database migration, staged
  flags, monitoring, rollback/incident/support proof, and at least 20 real
  coach reviews meeting the configured acceptance and edit thresholds. Source
  31 `Wrist Rockers — Palms Up / Flexor Bias` is next.

## 2026-08-09 — Source 31 rollout checkpoint

- Migration 502 (`436621732`) passes repeated direct execution, production-
  runner registration and immutable skip, family assertions, focused and full
  suites, audits, and the production build. It creates no human review or
  approval state.
- Source 31 contributes one stable machine-complete definition, one exact
  review variant, two operational profiles, one five-video current candidate
  set, and candidate-only evidence, alternates, identity decisions, graph
  proposals, calibrations, content, and publication records. Its clarified
  display name states the backs-of-hands-down wrist-flexion task while
  preserving the legacy palms-up/flexor-bias alias. The persisted audit packet
  contains only media, graph, calibration, and publication human gates.
- Validation passes 245 focused tests, 797 platform tests, and 1,051 backend
  tests with 20 intentional skips. Focused lint, JSON/generated artifacts,
  migration and runner checks, persisted invariants, the 1,586/1,586
  published-legacy Needs Engine audit, canonical and identity audits, expected
  blocked release reporting, and the production build pass. Browser-data
  freshness and the greater-than-500-kB Admin bundle remain nonblocking
  advisories.
- Release remains correctly `blocked`: 0 canonical definitions and phase depth
  are published, 0/442 graph edges and 0/663 calibration anchors are approved,
  and 0 real coach-pilot reviews exist. Qualified reviewers must still watch
  all five videos, adjudicate evidence, alternates, identities, graph and score
  proposals, review coach/athlete/support content, test comprehension, and
  provide separate publication approval.
- Clean-database rollout remains unproven because migration 426 precedes its
  unnumbered `drop_in_registration` prerequisite and later family migrations
  depend on nondeterministic migration-243 UUIDs. No production data, handoff
  record, or unrelated scheduling work was changed to conceal those defects.
- Production authorization additionally requires at least 25 reviewed and
  published definitions, depth of 3 in every required phase, 10 approved graph
  edges, 3 independently approved calibration anchors, shadow generation,
  substitution/failure rehearsals, repaired empty-database migration, staged
  flags, monitoring, rollback/incident/support proof, and at least 20 real
  coach reviews meeting the configured acceptance and edit thresholds. Source
  32 `Finger Pulses / Palm Lifts` is next.

## 2026-08-09 — Source 32 rollout checkpoint

- Migration 503 (`2010872005`) passes repeated direct execution, production-
  runner registration and immutable skip, family assertions, focused and full
  suites, audits, and the production build. It creates no human review or
  approval state.
- Source 32 contributes one stable machine-complete definition, two exact
  review variants, four operational profiles, one four-video current candidate
  set, and candidate-only evidence, alternates, identity decisions, graph
  proposals, calibrations, content, and publication records. It replaces an
  ambiguous combined skeleton with explicit Finger Pulse and Palm Lift action,
  contact, count, logistics, duration, fatigue, substitution, persistence, and
  rendering contracts. The persisted packet contains only media, graph,
  calibration, and publication human gates.
- Validation passes 247 focused tests, 799 platform tests, and 1,053 backend
  tests with 20 intentional skips. Focused lint, JSON/generated artifacts,
  migration and runner checks, persisted invariants, the 1,585/1,585
  published-legacy Needs Engine audit, canonical and identity audits, expected
  blocked release reporting, and the production build pass. Browser-data
  freshness and the greater-than-500-kB Admin bundle remain nonblocking
  advisories.
- Release remains correctly `blocked`: 0 canonical definitions and phase depth
  are published, 0/447 graph edges and 0/667 calibration anchors are approved,
  and 0 real coach-pilot reviews exist. Qualified reviewers must still watch
  all four videos, adjudicate evidence, alternates, identities, graph and score
  proposals, review coach/athlete/support content, test comprehension, and
  provide separate publication approval.
- Clean-database rollout remains unproven because migration 426 precedes its
  unnumbered `drop_in_registration` prerequisite and later family migrations
  depend on nondeterministic migration-243 UUIDs. No production data, handoff
  record, or unrelated scheduling work was changed to conceal those defects.
- Production authorization additionally requires at least 25 reviewed and
  published definitions, depth of 3 in every required phase, 10 approved graph
  edges, 3 independently approved calibration anchors, shadow generation,
  substitution/failure rehearsals, repaired empty-database migration, staged
  flags, monitoring, rollback/incident/support proof, and at least 20 real
  coach reviews meeting the configured acceptance and edit thresholds. Source
  33 is next.

## 2026-08-09 — Source 33 rollout checkpoint

- Migrations 504 (`3861180580`) and 505 (`2304250950`) pass repeated direct
  execution, production-runner registration and immutable skip, family and
  duplicate-closure assertions, focused and full suites, audits, and the
  production build. They create no human review or approval state.
- Source 33 contributes one stable machine-complete definition, four exact
  review variants, eight operational profiles, one five-video current
  candidate set, and candidate-only evidence, alternates, identity decisions,
  graph proposals, calibrations, content, and publication records. Source 900
  is consolidated as an exact quadruped-dynamic duplicate and archived. The
  persisted packet contains only media, graph, calibration, and publication
  human gates.
- Validation passes 250 focused tests, 802 platform tests, and 1,056 backend
  tests with 20 intentional skips out of 1,076. Focused lint, registry/batch
  and generated artifacts, migration/runner checks, persisted invariants, the
  1,583/1,583 published-legacy Needs Engine audit, canonical and identity
  audits, expected blocked release reporting, diff integrity, and the
  production build pass. Browser-data freshness and the greater-than-500-kB
  Admin bundle remain nonblocking advisories.
- Release remains correctly `blocked`: 0 canonical definitions and phase depth
  are published, 0/453 graph edges and 0/675 calibration anchors are approved,
  and 0 real coach-pilot reviews exist. Qualified reviewers must still watch
  all five videos, adjudicate evidence, alternates, identities, graph and score
  proposals, review coach/athlete/support content, test comprehension, and
  provide separate publication approval.
- Clean-database rollout remains unproven because migration 426 precedes its
  unnumbered `drop_in_registration` prerequisite and later family migrations
  depend on nondeterministic migration-243 UUIDs. No production data, handoff
  record, or unrelated dirty work was changed to conceal those defects.
- Production authorization additionally requires at least 25 reviewed and
  published definitions, depth of 3 in every required phase, 10 approved graph
  edges, 3 independently approved calibration anchors, shadow generation,
  substitution/failure rehearsals, repaired empty-database migration, staged
  flags, monitoring, rollback/incident/support proof, and at least 20 real
  coach reviews meeting the configured acceptance and edit thresholds. Source
  34 is next.

## 2026-08-09 — Source 34 rollout checkpoint

- Migration 506 is registered in disposable PostgreSQL at checksum
  `3738284647`, timestamp `2026-08-09 16:53:54.541567-04`. Direct execution,
  runner registration and immutable skip, persisted invariants, focused lint,
  generated packet checks, full test suites, and the production build pass.
  The migration creates no human review or approval state.
- Source 34 contributes one stable machine-complete definition, one exact
  review variant, two operational review profiles, a five-video current
  candidate set, and candidate-only evidence, alternates, identity decisions,
  graph proposals, calibrations, content, and publication records. One source
  skeleton and its profile are archived. The persisted packet contains exactly
  four blockers: media, graph, calibration, and publication.
- Validation passes 252 focused tests, 804 platform tests, and 1,058 backend
  tests with 20 intentional skips out of 1,078. The refreshed Needs Engine
  audit passes 1,582/1,582 published legacy exercises. The canonical audit has
  1,070 definitions, 29 unresolved high-similarity pairs, and zero exact
  collision. Browser-data freshness and the greater-than-500-kB Admin bundle
  remain nonblocking build advisories.
- Release remains correctly `blocked`: 0 canonical definitions are published,
  every required phase has zero published depth, 0/457 graph edges and 0/677
  calibration anchors are approved, and 0 real coach-pilot reviews exist.
  Qualified reviewers must watch and match all five videos, adjudicate
  evidence, alternates, identity boundaries, graph and difficulty proposals,
  review coach/athlete/accessibility/support content, test comprehension, and
  provide separate publication approval.
- Source 1311 Quadruped Scapular Clock remains quarantined and distinct until
  exact planted/moving-hand, path, checkpoint, and count mechanics are
  established. No unresolved mechanics were promoted to production authority.
- Clean-database rollout remains unproven because migration 426 precedes its
  unnumbered `drop_in_registration` prerequisite and later family migrations
  depend on nondeterministic migration-243 UUIDs. Production authorization
  still requires repaired empty-database migration, the configured library and
  phase-depth floors, approved graph and calibration depth, shadow generation,
  substitution/failure rehearsals, staged flags, monitoring,
  rollback/incident/support proof, and at least 20 qualifying real coach
  reviews.

## 2026-08-09 — Source 35 rollout checkpoint

- Migration 507 is registered in disposable PostgreSQL at checksum
  `939129674`, timestamp `2026-08-09 17:18:51.59162-04`. Direct and repeated
  execution, application-runner registration and immutable skip, persisted
  invariants, focused lint, generated packet checks, full test suites, and the
  production build pass. The migration creates no human approval state.
- Source 35 contributes one stable machine-complete definition, one exact
  review variant, two operational review profiles, a five-video current
  candidate set, and candidate-only evidence, alternates, identity decisions,
  graph proposals, calibrations, content, and publication records. Source 899
  is consolidated as an exact legacy duplicate. Source 1309 is restored to an
  archived identity quarantine rather than merged by name. Three source
  variants and profiles are archived. The packet retains exactly four
  blockers: media, graph, calibration, and publication.
- Validation passes 254 focused tests, 806 platform tests, and 1,060 backend
  tests with 20 intentional skips out of 1,080. The Needs Engine audit passes
  1,579/1,579 still-published legacy exercises. The canonical audit has 1,070
  definitions, 629 raw potential pairs, 600 adjudicated-distinct pairs, 29
  unresolved high-similarity pairs, and zero exact collision. Browser-data
  freshness and the 863.70-kB Admin chunk remain nonblocking build advisories.
- Machine coverage is 10.09% score and operational profiles, 9.91% anatomy,
  support, and candidate research packets, 7.48% load profiles, 7.94% fatigue
  profiles, 69.81% three-to-five candidate media sets, and 4.86% embeddable
  candidate sets. Reviewed research, approved media, and publication coverage
  remain zero.
- Release is correctly `blocked`: 0 canonical definitions are published,
  every required phase has zero published depth, 0/461 graph edges and 0/679
  calibration anchors are approved, and 0 real coach-pilot reviews exist.
  Qualified reviewers must watch and match all five videos, adjudicate
  evidence, alternates, identities, graph and score proposals, review coach,
  athlete, accessibility, and support content, test comprehension, and provide
  separate publication approval.
- Clean-database rollout remains unproven because existing migration-order and
  nondeterministic legacy-UUID prerequisites predate Source 35. Production
  authorization still requires a repaired empty-database migration path, at
  least 25 reviewed and published definitions, depth of 3 in every required
  phase, 10 approved graph edges, 3 approved calibration anchors, shadow
  generation, substitution and failure rehearsals, staged flags, monitoring,
  rollback, incident and support proof, and at least 20 qualifying real coach
  reviews.

## 2026-08-09 — Source 36 rollout checkpoint

- Migration 508 is registered in disposable PostgreSQL at checksum
  `2642450056`, timestamp `2026-08-09 17:40:55.159597-04`. Direct and repeated
  execution, application-runner registration and immutable skip, checksum
  equality, persisted invariants, focused lint, packet validation, full test
  suites, and the production build pass. No human approval state is created.
- Source 36 contributes one stable machine-complete definition, one exact
  review variant, two operational review profiles, five current media
  candidates, and candidate-only evidence, alternates, identity decisions,
  graph proposals, calibrations, content, and publication records. Its source
  skeleton and profile are archived. Source 1348 remains an unresolved direct
  identity collision rather than being merged by name. The packet retains
  exactly four blockers: media, graph, calibration, and publication.
- Validation passes 256 focused tests, 808 platform tests, and 1,062 backend
  tests with 20 intentional skips out of 1,082. The Needs Engine audit passes
  1,578/1,578 still-published legacy exercises. The canonical audit has 1,070
  definitions, 630 raw pairs, 601 adjudicated-distinct pairs, 29 unresolved
  high-similarity pairs, and zero exact collision. Browser-data freshness and
  the 863.70-kB Admin chunk remain nonblocking build advisories.
- Machine coverage is 10.19% score and operational profiles, 10.00% anatomy,
  support, and candidate research packets, 7.57% load profiles, 8.04% fatigue
  profiles, 69.81% candidate media sets, and 4.95% embeddable candidate sets.
  Reviewed research, approved media, and publication coverage remain zero.
- Release is correctly `blocked`: 0 canonical definitions are published,
  every required phase has zero published depth, 0/465 graph edges and 0/681
  calibration anchors are approved, and 0 real coach-pilot reviews exist.
  Qualified reviewers must watch and match all five videos, resolve the Source
  1348 collision, adjudicate evidence, alternates, graph and score proposals,
  test coach/athlete/accessibility/support content, and provide separate
  publication approval.
- Clean-database rollout remains unproven because existing migration-order and
  nondeterministic legacy-UUID prerequisites predate Source 36. Production
  authorization still requires a repaired empty-database path, at least 25
  reviewed and published definitions, depth of 3 in every required phase, 10
  approved graph edges, 3 approved calibration anchors, shadow generation,
  substitution and failure rehearsals, staged flags, monitoring, rollback,
  incident and support proof, and at least 20 qualifying real coach reviews.

## 2026-08-09 — Source 37 rollout checkpoint

- Migration 509 is registered in disposable PostgreSQL at checksum
  `3691112942`, timestamp `2026-08-09 18:12:28.636467-04`. Finalized direct
  execution, application-runner registration and immutable skip, persisted
  invariants, packet regeneration, focused lint, full suites, audits, and the
  production build pass. No human review or approval state is created.
- Source 37 is split into exact review-only `Standing Single-Arm Shoulder CAR`
  and `Standing Bilateral Arm Circles` definitions. They contribute 2 exact
  variants, 3 operational profiles, 32 candidate evidence sections, 9 media
  candidates, 43 alternates, 6 graph proposals, 4 calibration proposals, and
  7 deterministic identity decisions. The conflated skeleton is archived.
- Validation passes 258 focused tests, 810 platform tests, and 1,064 backend
  tests with 20 intentional skips out of 1,084. The Needs Engine audit passes
  1,577/1,577 published exercises. The canonical audit has 1,071 definitions,
  631 raw pairs, 602 adjudicated-distinct pairs, 29 unresolved high-similarity
  pairs, and zero exact collision. The Shoulder CAR/Neck CAR false positive is
  explicitly closed.
- Machine coverage is 10.36% score and operational profiles, 10.18% anatomy,
  support, and candidate research packets, 7.75% load profiles, 8.22% fatigue
  profiles, 69.84% candidate media sets, and 5.14% embeddable candidate sets.
  Reviewed research, approved media, and publication coverage remain zero.
- Release is correctly `blocked`: 0 canonical definitions are published,
  every required phase has zero published depth, 0/469 graph edges and 0/685
  calibration anchors are approved, and 0 real coach-pilot reviews exist.
  Qualified reviewers must watch and exactly match all nine videos, adjudicate
  evidence, alternates, identity, graph and score proposals, test coach,
  athlete, accessibility and support content, and separately approve release.
- Existing clean-bootstrap blockers remain outside Source 37. Production still
  requires the repaired empty-database path, configured library and phase-depth
  floors, approved graph and calibration depth, shadow generation,
  substitution/failure rehearsals, staged flags, monitoring, rollback,
  incident/support proof, and at least 20 qualifying real coach reviews.

## 2026-08-09 — Source 38 rollout checkpoint

- Migration 510 is registered in disposable PostgreSQL at checksum
  `1098400606`, timestamp `2026-08-09 18:31:20.658721-04`. The application
  runner applies it once and skips it immutably thereafter; generated packet,
  persisted invariants, focused lint, full suites, audits, and the production
  build pass. No human review or approval state is created.
- Source 38 contributes one exact review variant, two contextual profiles, 16
  candidate evidence sections, 5 media candidates, 24 alternates, 4 graph
  proposals, 2 calibration proposals, and 5 identity decisions. Source 38's
  skeleton is archived. Source 912 is restored to its own archived definition
  and remains an explicit human identity gate rather than an inferred exact
  duplicate. The packet retains five blockers: media, identity, graph,
  calibration, and publication.
- Validation passes 260 focused tests, 812 platform tests, and 1,066 backend
  tests with 20 intentional skips out of 1,086. The Needs Engine audit passes
  1,575/1,575 published exercises. The canonical audit has 1,071 definitions,
  631 raw pairs, 602 adjudicated-distinct pairs, 29 unresolved high-similarity
  pairs, and zero exact collision.
- Machine coverage is 10.36% score, 10.27% anatomy and support, 10.46%
  operational profiles, 7.84% load profiles, 8.31% fatigue profiles, 10.27%
  complete candidate research packets, 69.84% candidate media sets, and 5.23%
  embeddable candidate sets. Reviewed research, approved media, and
  publication coverage remain zero.
- Release is correctly `blocked`: 0 canonical definitions are published,
  every required phase has zero published depth, 0/473 graph edges and 0/687
  calibration anchors are approved, and 0 real coach-pilot reviews exist.
  Qualified reviewers must watch and exactly match all five candidates,
  resolve Source 912, adjudicate evidence, alternates, graph and score
  proposals, test coach/athlete/accessibility/support content, and separately
  approve release.
- Existing clean-bootstrap blockers remain outside Source 38. Production still
  requires a repaired empty-database path, at least 25 reviewed and published
  definitions, depth of 3 in every required phase, 10 approved graph edges, 3
  approved calibration anchors, shadow generation, substitution and failure
  rehearsals, staged flags, monitoring, rollback, incident and support proof,
  and at least 20 qualifying real coach reviews.

## 2026-08-09 — Source 39 rollout checkpoint

- Source 39, Source 675 Plank to Pike, and Source 795 Rocking Plank to Down
  Dog now resolve to one exact review-only definition. Duplicate legacy cards
  are unpublished and archived; the canonical Source 39 projection is also
  unpublished until qualified review.
- Migration 511 passed rolled-back PostgreSQL validation, application-runner
  apply and immutable re-entry checks, focused lint and JSON checks, 262
  focused tests, 814 platform tests, the 1,068-pass/20-skip full backend suite,
  diff integrity, and the production build. It creates no approval state.
- Machine coverage is now 10.37% score, anatomy, support, and complete
  candidate research packets; 10.56% operational profiles; 7.94% load; 8.41%
  fatigue; 69.91% candidate media sets; and 5.33% embeddable candidate sets.
  Reviewed research, approved media, approved graph, approved calibration, and
  publication coverage remain zero.
- Release correctly remains `blocked`: 0 canonical definitions are published,
  every required phase has zero published depth, 0/476 graph edges and 0/689
  calibration anchors are approved, and no real coach-pilot review exists.
  Qualified reviewers must watch and exactly match all five media candidates,
  adjudicate evidence, alternates, graph and score proposals, test
  coach/athlete/accessibility/support content, and separately approve release.

## 2026-08-09 — Source 40 rollout checkpoint

- Migrations 512–514 are registered in disposable PostgreSQL at checksums
  `1469215636`, `4053192554`, and `1242308153`. Rolled-back validation, normal
  platform-runner application, checksum registration, and immutable re-entry
  pass. No human review or approval state is created.
- Sources 40, 875, and 1359 now resolve to one standing knee-to-wall
  forward-and-return identity with one exact review variant and two contextual
  profiles. Duplicate definitions and three skeletal variants are archived;
  five deterministic decisions preserve the half-kneeling, isometric, CAR,
  and foot-control action boundaries.
- The Source 40 packet passes all machine-owned checks after explicit
  normalized-score and complete task-difficulty corrections. It retains only
  `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`. Metadata health for five media candidates is not playback,
  exact-match, accessibility, quality, safety, or approval evidence.
- Validation passes 266 focused tests, 818 platform tests, and 1,072 backend
  tests with 20 intentional skips out of 1,092. The Needs Engine audit passes
  1,569/1,569 published legacy exercises. The canonical audit has 1,069
  definitions, 29 unresolved high-similarity pairs, and zero exact collision.
  The production build passes with only the existing stale browser-data and
  greater-than-500-kB bundle advisories.
- Machine coverage is 10.48% score, anatomy, support, and complete candidate
  research packets; 10.66% operational profiles; 8.04% load; 8.51% fatigue;
  69.97% candidate media sets; and 5.43% embeddable candidate sets. Reviewed
  research, approved media, approved graph, approved calibration, and
  publication coverage remain zero.
- Production release remains correctly `blocked`: 0 canonical definitions are
  published, every required phase has zero published depth, 0/480 graph edges
  and 0/691 calibration anchors are approved, and no real coach-pilot review
  exists. Qualified reviewers must complete exact media review, evidence and
  alternate adjudication, graph and calibration review, coach and athlete
  comprehension testing, and separate publication approval. The known clean-
  bootstrap, shadow-generation, staged-rollout, monitoring, rollback,
  incident-response, and support proofs also remain required.

## 2026-08-09 — Source 41 rollout checkpoint

- Migration 515 is registered in disposable PostgreSQL at checksum
  `2816286728`. Transactional rollback validation, normal platform-runner
  application, persisted assertions, generated research artifacts, and the
  focused 269-test slice pass. No human review or approval state is created.
- Source 41 now has one exact rear-knee-supported end-range pulse, Prepare &
  Access and Restore profiles, complete constraints and budgets, and explicit
  standing, full-return, isometric, banded, loaded, elevated, activation,
  calf, and clinical boundaries. Exercise difficulty remains task-only.
- The packet retains only `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Five healthy oEmbed responses
  prove metadata and iframe availability only. They do not prove playback,
  exact mechanics, captions, accessibility, quality, safety, or approval.
- Validation passes 269 focused tests, 821/821 platform tests, and 1,075
  backend tests with 20 intentional skips out of 1,095. Focused lint,
  JSON/generated-artifact validation, diff integrity, and the production build
  pass. The build reports only the existing stale browser-data and
  greater-than-500-kB bundle advisories.
- Machine coverage is now 10.57% for score, anatomy, support, and complete
  candidate research packets; 10.76% operational profiles; 8.14% load; 8.61%
  fatigue; 69.97% candidate media sets; and 5.52% embeddable candidate sets.
  Reviewed research, approved media, approved graph, approved calibration,
  and publication coverage remain zero.
- Production release remains correctly blocked: 0 canonical definitions are
  published, every phase has zero published depth, 0/483 graph edges and
  0/693 calibration anchors are approved, and no real coach pilot exists.
  Clean-bootstrap, shadow-generation, staged rollout, monitoring, rollback,
  incident-response, and support proofs remain required in addition to the
  qualified card reviews.

## 2026-08-09 — Source 42 rollout checkpoint

- Migrations 516–518 are registered in disposable PostgreSQL at checksums
  `1682906775`, `2211057671`, and `2204393135`. Rolled-back validation, normal
  platform-runner application, immutable re-entry, persisted assertions,
  generated artifacts, and automated audit regeneration pass. No human review
  or approval state is created.
- Source 42 now has one exact seated thigh-supported active ankle circuit with
  Prepare & Access and Restore profiles, complete constraints and budgets,
  canonical member/coach/support fields, concise athlete rendering, and
  explicit alternate-base, resistance, load, passive, weight-bearing, pump,
  alphabet, calf, clinical, and sport boundaries. Exercise difficulty remains
  task-only.
- The packet retains only `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Five healthy oEmbed responses
  prove metadata and iframe availability only, not playback, exact mechanics,
  captions, accessibility, quality, safety, reviewer identity, or approval.
- Validation passes 272 focused tests, 825/825 platform tests, and 1,079
  backend tests with 20 intentional skips out of 1,099. Focused lint,
  JSON/generated-artifact validation, diff integrity, and the production build
  pass with only the existing stale browser-data and greater-than-500-kB
  bundle advisories.
- Machine coverage is now 10.66% for score, anatomy, support, and complete
  candidate research packets; 10.85% operational profiles; 8.23% load; 8.70%
  fatigue; 69.97% candidate media sets; and 5.61% embeddable candidate sets.
  Reviewed research, approved media, approved graph, approved calibration,
  and publication coverage remain zero.
- Production release remains correctly blocked: 0 canonical definitions are
  published, every phase has zero published depth, 0/484 graph edges and
  0/695 calibration anchors are approved, and no real coach pilot exists.
  Clean-bootstrap, shadow generation, staged rollout, monitoring, rollback,
  incident response, support rehearsal, and qualified card review remain
  required.

## 2026-08-09 — Source 43 rollout checkpoint

- Migration 519 is registered in disposable PostgreSQL at checksum
  `304965183`. Transactional execution, platform-runner application,
  immutable re-entry, persisted assertions, generated artifacts, and
  automated audit regeneration pass without creating review or approval state.
- Source 43 now has one exact wall-supported bilateral heel-planted active
  dorsiflexion lift-and-controlled-return cycle. Prepare & Access and Capacity
  profiles include dosage, duration, logistics, cumulative fatigue/impact
  budgets, substitutions, persistence, and distinct coach/member rendering.
  Difficulty describes only the exercise task.
- Its packet retains exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Five healthy oEmbed responses
  prove current metadata and embedding availability only, not complete
  playback, exact mechanics, captions, accessibility, demonstration quality,
  safety, reviewer identity, version match, or approval.
- The 275-test research/migration slice, 65-test single-workout full-story
  slice, 827/827 platform suite, and full backend suite all pass. Backend
  totals are 1,101 tests, 1,081 passes, 20 intentional skips, and 0 failures.
  Focused lint, JSON/generated artifacts, diff integrity, and the production
  build pass; the build reports only stale browser-data and greater-than-500-
  kB bundle advisories.
- Machine coverage is now 10.76% for scores, anatomy, support, complete
  candidate research packets, candidate evidence-section coverage, and
  alternate assessment; 10.94% for operational profiles; 8.33% for load;
  8.79% for fatigue; 69.97% for candidate media sets; and 5.71% for
  embeddable candidate sets. Reviewed research, approved media, approved
  graph, approved calibration, and publication coverage remain zero.
- Production release remains correctly blocked: 0 published canonical
  definitions, zero depth in all seven phases, 0/487 approved graph edges,
  0/697 approved calibration anchors, and 0 coach-pilot reviews. Qualified
  reviews plus clean-bootstrap, shadow generation, staged rollout,
  monitoring, rollback, incident response, and support rehearsal remain
  required.

## 2026-08-09 — Source 46 rollout checkpoint

- Migration 522 is registered in disposable PostgreSQL at immutable checksum
  `3569596322` and re-enters through the production runner as already applied.
  It creates no human review, media approval, graph approval, calibration
  approval, or publication state.
- Source 46 now has three exact support variants, four contextual delivery
  profiles, task-only difficulty, cumulative repetition/hold/fatigue and
  zero-physical-impact budgets, duration and logistics models, substitution
  revalidation, immutable persistence inputs, and separate coach, athlete,
  accessibility, user-support, and operations rendering. The source is
  unpublished and its prior age floor is removed.
- The generated packet retains exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Five healthy oEmbed records
  prove metadata availability only; playback and content approval remain
  unverified.
- Machine coverage is now 11.08% for score, anatomy, support, complete
  candidate research packets, candidate evidence-section coverage, and
  alternate assessment; 11.27% for operational profiles; 8.64% for load;
  9.11% for fatigue; 69.95% for candidate media sets; and 6.01% for
  embeddable candidate sets. Reviewed research, approved media, approved
  graph, approved calibration, and publication coverage remain zero.
- Release remains correctly blocked: 0 published definitions, zero depth in
  all seven phases, 0/504 approved graph edges, 0/711 approved calibration
  anchors, and 0 coach-pilot reviews. Qualified review plus clean bootstrap,
  shadow generation, staged rollout, monitoring, rollback, incident response,
  and support rehearsal remain required.

## 2026-08-09 — Source 45 rollout checkpoint

- Migration 521 is registered in disposable PostgreSQL at immutable checksum
  `3898034578` and re-enters through the platform runner as already applied.
  It replaces the Source 45 / Source 524 collision with three exact review-
  only support variants and creates no human review or approval state.
- Source 45 now carries one-target-foot action and count semantics, task-only
  difficulty, four contextual delivery profiles, explicit cumulative fatigue
  and zero-physical-impact budgets, logistics and duration models,
  substitution revalidation, immutable persistence inputs, and separate
  coach, athlete, accessibility, user-support, and operations contracts.
  Source 45 is unpublished; duplicate Source 524 is archived and unpublished.
- The packet retains exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Five healthy oEmbed responses
  prove metadata availability only; playback, exact support/action match,
  captions, accessibility, quality, safety, reviewer identity, version match,
  and approval remain unverified.
- Focused validation passes 279/279, the single-workout generation story
  remains covered inside the 831/831 platform suite, and the full backend
  suite passes 1,085 tests with 20 intentional skips out of 1,105. Focused
  lint, generated-artifact validation, diff integrity, and the production
  build pass. The build reports only the existing stale browser-data and
  greater-than-500-kB bundle advisories.
- Machine coverage is 10.99% for score, anatomy, support, complete candidate
  research packets, candidate evidence sections, and alternate assessment;
  11.17% for operational profiles; 8.54% for load; 9.01% for fatigue; 69.95%
  for candidate media sets; and 5.92% for embeddable candidate sets. Reviewed
  research, approved media, approved graph, approved calibration, and
  publication coverage remain zero.
- Production release remains correctly blocked: 0 published canonical
  definitions, zero depth in all seven phases, 0/497 approved graph edges,
  0/705 approved calibration anchors, and 0 coach-pilot reviews. Qualified
  content work plus clean bootstrap, shadow generation, staged rollout,
  monitoring, rollback, incident response, and support rehearsal remain
  required.
