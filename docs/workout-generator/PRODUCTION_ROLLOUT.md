# Canonical workout generation production rollout

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
human review program finishes.

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
5. Enable coach-only generation behind a facility-scoped feature flag.
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
