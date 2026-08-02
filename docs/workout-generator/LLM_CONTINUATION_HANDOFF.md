# Zero-context LLM continuation handoff: canonical exercise library

Last updated: 2026-08-02

This document is both the complete instruction set for a replacement LLM and
the live return-handoff ledger. Give the replacement LLM this entire file. It
must read the repository state before acting, update the files identified in
the handoff section, and update the live checkpoint in this file before handing
the work back.

## Role and mission

Work in the existing Vortex repository at:

`/Users/jimmy_mac/Desktop/code/vortex`

Continue the existing, persistent objective; do not redefine it as a smaller
task:

> Audit all 1,500-plus legacy exercise cards and every active canonical
> definition. Reassess identity, accuracy, every planning field, exercise
> complexity, physical difficulty, variants, substitutions, research,
> instructions, support content, and media. Create a separate card when a
> change alters exercise identity; use a variant when the repetition contract
> remains the same but identity-bearing constraints change; use a delivery
> annotation only for non-identity programming changes. Build the most
> comprehensive generator-ready exercise library possible. Each completed
> card must have three to five current embeddable YouTube candidates, without
> fabricating human review or approval.

The work is a production data-engineering, exercise-science, workout-planning,
coach-support, athlete-support, provenance, and validation task. It is not a
bulk copy-editing exercise. Continue one exact exercise family at a time until
the whole library meets the canonical requirements.

Do not mark the overall objective complete merely because one migration, one
family, the infrastructure, or the test suite is complete. Current evidence
shows that most active definitions still require full card authorship.

## Non-negotiable user decisions

1. Exercise cards must not contain athlete skill levels, proficiency levels,
   rankings, or age-derived classifications.
2. Skill levels belong only to dedicated `coaching.skill` or skill-library
   cards. An exercise may reference related skill-card identifiers for lineage
   or workout intent, but it must not copy their levels into exercise data.
3. Exercise difficulty has exactly two authored meanings:
   - exercise complexity;
   - physical difficulty.
4. Overall exercise difficulty is derived as the maximum of complexity and
   physical difficulty. Do not independently author or calibrate overall.
5. Athlete readiness is a workout-generation input, not an exercise-card
   proficiency field.
6. Never fabricate content approval, media approval, graph approval,
   calibration approval, reviewer identity, review timestamp, publication
   authority, playback verification, caption verification, accessibility
   verification, or exact-video-match verification.
7. Successful YouTube oEmbed metadata proves only current metadata and embed
   response health. It does not prove full playback, exact variant match,
   captions, cue quality, accessibility, safety, or approval.
8. Anything needing human expertise stays visibly quarantined with a precise
   blocker and an actionable review packet.
9. Preserve unrelated and concurrent dirty work. Never reset, discard,
   overwrite, or silently reformat user changes. Do not commit, push, publish,
   deploy, or edit production data unless the user explicitly authorizes it.
10. The longer-term roadmap in `docs/workout-generator/FUTURE_DIRECTION.md` is
    intentionally deferred. Do not substitute roadmap work for the active
    single-workout/library-completion objective.

## Required card contract

A family is not machine-complete until the authoritative persisted audit proves
the applicable fields below. A migration merely containing plausible text is
not proof.

### Stable identity and lineage

- Stable canonical UUID, canonical name, display name, slug, and useful aliases.
- Every legacy source row mapped and traceable.
- Ambiguous source representations archived as nonselectable identity
  quarantines, not guessed into selectable specifications.
- Exact repetition boundary: setup, start, action sequence, valid completion,
  invalidating events, stop, and exit.
- Explicit decisions for similarly named or adjacent exercises.
- No silent merge based on name similarity, shared tags, shared muscles, or a
  generic movement family.

### Controlled taxonomy and biomechanics

- Controlled family, movement patterns, body regions, equipment, and phase
  keys that exist in the platform taxonomy tables.
- Prime movers, secondary muscles, stabilizers, joints, joint actions, planes,
  laterality, support/contact sequence, posture/orientation, and locomotion or
  static-action contract.
- All taxonomy and relationship dimensions must pass database constraints.

### Difficulty, loading, fatigue, and recovery

- 1-100 exercise-complexity score with a reasoned dimension vector.
- 1-100 physical-difficulty score with a reasoned dimension vector.
- Derived overall equals `max(complexity, physicalDifficulty)`.
- Load method, support/loading distribution without invented precision,
  external load, leverage, range, eccentric demand, joint stress, spinal load,
  grip, inversion, impact, contacts, and effective load drivers.
- Local, technical, grip, metabolic, and impact fatigue where applicable.
- Recovery estimate clearly labeled as a planning estimate when evidence does
  not establish a universal interval.
- Same-session cumulative budgets and downstream interference rules.

### Constraints and delivery

- Required/optional equipment, quantities, surface, space, footprint, lane,
  ceiling, wall, anchor, station throughput, sightline, setup/reset/transition,
  and supervision or spotting contract.
- Environment, population, exclusion, symptom, fear, and accessibility
  constraints without clinical diagnosis or invented universal eligibility.
- Context-specific delivery profiles, phase suitability, purpose, dose, rest,
  duration formula and bounds, quality gates, stop rules, scaling order,
  measurements, substitutions, logistics, coach prompts, athlete prompts, and
  support/incident prompts.
- Any substitution must trigger revalidation of identity, constraints, dose,
  cumulative budgets, duration, logistics, persistence, and both renderings.

### Coach, athlete, and support operations

- Coach setup, observation, cues, faults, corrections, group-management rules,
  assistance classification, escalation, and incident recording.
- Athlete purpose, concise instructions, self-checks, expected versus
  unexpected sensations, symptom stop, accessibility, and understandable
  output.
- Persistence requirements for planned and actual work, invalid/partial/
  assisted/incident attempts, first fault, symptoms, substitutions, timing,
  contacts, cumulative exposure, and rendering/library/generator versions.

### Evidence, media, graph, calibration, and tests

- Candidate evidence for all applicable card sections with source URL, title,
  publisher, kind, supported claim, scope, limitations, quality, provenance,
  confidence, review status, and card version.
- Prefer governing bodies, professional standards, official technical
  resources, peer-reviewed research, and direct expert instruction. Separate
  exact identity/technique evidence from adjacent biomechanics or general
  training evidence.
- State when evidence does not establish a universal technique, safety rule,
  readiness rule, dose, recovery interval, outcome, progression order, or
  numeric difficulty.
- Three to five current healthy privacy-enhanced YouTube candidates for the
  exact family, kept as `candidate` with exactness, captions, quality, reviewer,
  and approval fields null until a qualified human verifies them.
- Explicit alternate assessments: exact variant, annotation, distinct card, or
  unresolved quarantine.
- Review-only progression, regression, and substitution proposals using only
  controlled relationship types and dimensions.
- Review-only complexity and physical-difficulty calibration anchors. Never
  infer athlete proficiency from them.
- A quarantined automated card test packet with every outstanding human gate.

## Identity decision procedure

For every candidate alternate, answer these questions in order and record the
rationale:

1. Does it retain the same scored action and repetition boundary?
2. Does it retain the same start, support/contact sequence, orientation,
   laterality contract, implement behavior, path, terminal state, and intended
   output?
3. Does the change only affect dose, rest, tempo within the same action,
   marker spacing, a declared side, or another non-identity delivery setting?
4. Does it add or remove a joint action, locomotion, release/catch, external
   contact, wall/partner support, obstacle, dynamic entry, rebound, static hold,
   eccentric-only boundary, unilateral contract, or different finish?

Use these dispositions:

- `delivery annotation`: the exact exercise and repetition contract are
  unchanged; only programming delivery changes.
- `exact variant`: the canonical definition remains the same, but the generator
  must select and persist a materially different exact constraint such as
  support interface, declared range, stance, side, implement, or assistance.
- `distinct definition/card`: the scored action, support/contact contract,
  repetition boundary, entry, exit, release/catch, locomotion, static/dynamic
  state, or intended output changes.
- `identity quarantine`: the source is too ambiguous to select safely. Preserve
  lineage and enumerate missing facts; do not guess.

Graph proximity does not mean identity. A progression or substitution can and
usually should connect distinct exercise definitions.

## Research and media procedure

1. Audit the existing source card, canonical definition, variants, profiles,
   evidence, media, alternates, graph edges, calibration, and test packet before
   researching.
2. Search for exact technique or governing-body material first. Then add
   peer-reviewed biomechanics, loading, motor-learning, or intervention
   evidence only for the narrow claims it supports.
3. Read the source. Do not cite a title, abstract fragment, or search result as
   if it proves the whole card.
4. Record sample, population, task, methods, and important limitations. Do not
   extrapolate a small acute study into universal safety, injury prevention,
   dose, or readiness claims.
5. Remove unrelated or miscited sources rather than retaining them for volume.
6. Research meaningful alternate forms and adjacent exercises. Classify every
   one using the identity procedure above.
7. Find three to five useful YouTube candidates. Check current oEmbed metadata
   and store privacy-enhanced embed URLs, but leave human-only fields null.
8. Media candidates must remain quarantined until a qualified person watches
   the entire video and records exact card/variant, side, support, action,
   captions, accessibility, safety, cue quality, conflicts, reviewer identity,
   rationale, timestamp, and card-version match.
9. Never describe oEmbed health as playback or external-media verification.

## Migration and verification procedure for every family

1. Run `git status --short` and inspect overlapping diffs before editing.
2. Read the relevant schema constraints and recent completed family migrations.
   Do not invent enum values, relationship types, roles, or JSON shapes.
3. Query the disposable database for the current family and adjacent identities.
4. Research, define exact boundaries, and write one idempotent migration.
5. The migration must fail closed when prerequisites drift or reviewed/
   published records would be overwritten.
6. Apply the draft migration directly to disposable PostgreSQL with
   `ON_ERROR_STOP=1`. PostgreSQL `DO` blocks are transactional; repair the exact
   error rather than partially patching database state.
7. Apply the unchanged migration a second time and prove idempotency.
8. Query exact persisted counts and invariants. Do not rely only on static tests.
9. Update the canonical research registry and its version. Add tests that prove
   every new source key, URL, kind, publisher, and minimum quality.
10. Register the migration in `backend/platform/initTables.js` in numeric order.
11. Add comprehensive static safeguards in
    `backend/platform/__tests__/exerciseProgrammingDifficultyOnly.test.js` and
    research-registry coverage in
    `backend/platform/__tests__/canonicalResearchBatch.test.js`.
12. Run focused tests and lint before checksum registration. If the migration
    changes afterward, repeat direct execution and idempotency from the new
    exact bytes.
13. Compute the exact migration checksum using the same 31-based unsigned hash
    as `backend/run-migration.js`.
14. Run the normal single-file migration runner against disposable PostgreSQL.
    Verify `schema_migrations.filename`, checksum, and timestamp.
15. Once registered, treat that exact migration file as immutable. If a later
    correction is needed, add a new migration rather than rewriting history.
16. Directly reapply the exact registered file once more.
17. Run and persist the canonical library audit. Run the identity report and
    release check. Use actual post-migration values; do not assume expected
    deltas.
18. Update all five audit/review documents and this live handoff ledger.
19. Run focused lint, the full backend test suite, JSON parsing/quality checks,
    diff-integrity checks, and the production build.
20. Only after that checkpoint is green should you select the next
    machine-incomplete source family.

## Useful local commands

Disposable PostgreSQL connection:

`postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip`

Draft direct execution:

```sh
psql postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip \
  -v ON_ERROR_STOP=1 \
  -f backend/migrations/<migration>.sql
```

Production-style registration of one migration:

```sh
DB_URL=postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip \
  node backend/run-migration.js <migration>.sql
```

Focused tests for the current family:

```sh
node --test \
  backend/platform/__tests__/canonicalResearchBatch.test.js \
  backend/platform/__tests__/exerciseProgrammingDifficultyOnly.test.js \
  backend/platform/__tests__/canonicalLibraryAudit.test.js
```

Focused lint should name only the files changed for the family. The broad
commands are:

```sh
npm --prefix backend test
npm run build
```

Persisted canonical audit and release gate:

```sh
DB_URL=postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip \
  DATABASE_SSL=false \
  npm --prefix backend run audit:canonical-library -- --facility=1 --json

DB_URL=postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip \
  DATABASE_SSL=false \
  npm --prefix backend run report:canonical-identity-queue -- --facility=1

DB_URL=postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip \
  DATABASE_SSL=false \
  npm --prefix backend run check:canonical-release -- --facility=1
```

The release check is expected to remain blocked until qualified review and
pilot work occur. A blocked release gate is correct; a failing migration, test,
audit, or build is not.

## Authoritative documentation and how to update it

Do not replace historical entries or rewrite earlier measurements. Append a
dated, migration-specific section using actual query/test output.

1. `docs/workout-generator/COMPLETION_AUDIT.md`
   - Record exact family scope, UUIDs, variants, profiles, evidence, media,
     alternates, graph, calibration, packet blockers, checksum, idempotency,
     test counts, lint, backend suite, build, and global audit totals.
2. `docs/workout-generator/IDENTITY_RESOLUTION.md`
   - Record every merge, archive, exact variant, distinct boundary, unresolved
     quarantine, source mapping, and the post-migration identity detector.
3. `docs/workout-generator/LIBRARY_AUDIT.md`
   - Record the complete card contract, difficulty vectors, load/fatigue/
     logistics behavior, media-candidate coverage, machine-complete and
     incomplete totals, and all remaining blockers.
4. `docs/workout-generator/PRODUCTION_ROLLOUT.md`
   - Record what automated gates now pass and what still prevents rollout.
     Never turn machine completeness into rollout authorization.
5. `docs/workout-generator/RESEARCH_REVIEW_PROGRAM.md`
   - Add the exact human-review packet: evidence limitations, videos to watch,
     alternates, graph edges, calibration anchors, content review, and separate
     publication approval.
6. This file, `docs/workout-generator/LLM_CONTINUATION_HANDOFF.md`
   - Update the `Live checkpoint`, `Current worktree`, `Immediate next work`,
     and `Return-handoff template` sections. Include exact filenames, database
     state, checksums, commands, results, failures, remaining edits, and the next
     source family so the returning LLM does not repeat work or assume a draft
     was registered.

`docs/workout-generator/CURRENT_STATE_AND_TARGET.md` is an architectural
baseline dated 2026-07-25, not the live family-by-family ledger. Update it only
when the architecture or target changes; do not use it to overwrite the five
append-only audit histories above.

## Live checkpoint: completed work

The last comprehensively verified family is Bar Cast / Cast to Handstand,
implemented by immutable migration 482.

- 1,676 of 1,676 legacy rows are mapped to 1,043 active definitions.
- The surfaced identity detector reports 617 of 617 pairs adjudicated, zero
  unresolved score-72-or-higher pair, and zero exact collision.
- 91 definitions are machine-complete and 952 are machine-incomplete.
- 90 of 1,043 definitions have exactly three to five current healthy
  embeddable candidates for their current card version.
- Graph/calibration queues contain 695/917 review-only rows with zero
  approvals.
- There are zero published definitions, zero approved depth in every required
  phase, and zero of 20 required real coach workout reviews.
- Registry `2026-08-02.85` contains 364 sources.
- Focused validation passes 218 tests; the full backend suite passes 1,017
  tests with 20 intentional skips and zero failures. Focused lint, JSON
  parsing, persisted audit, identity reporting, diff integrity, and the
  production build pass.
- The production build retains only existing stale browser-data and >500 kB
  chunk advisories.
- The release gate is correctly blocked at 0/25 published definitions, phase
  depth 0/3, 0/10 approved graph edges, 0/3 approved calibration anchors, and
  0/20 coach reviews.

Latest immutable registered migration:

- 482 `coaching_bar_cast_family_audit_hardening`, checksum `229324910`,
  registered `2026-08-02 11:36:31.016626-04`.

Its exact registered file passes normal-runner re-entry. Do not edit migration
482; add a later migration if another correction is required. Migrations
479–481 remain immutable at checksums `4176817151`, `2984990515`, and
`722794694`.

Bar Cast family state:

- Bar Cast definition: `6915611f-7382-448b-b3eb-d8dd08f10ee7`, card version 2;
- Cast to Handstand definition: `d8b03d69-0840-40b0-adba-21d855d3db3e`, card
  version 1;
- legacy source: 17;
- archived source baseline: `aa63fb72-5cab-413a-89d3-4eb865424c21`;
- below-horizontal return: `6d6f938d-d399-4c4a-92f7-e56b72b6eeaf`;
- horizontal return: `2a92d86f-3006-4da7-a809-d4bdce39cbd4`;
- above-horizontal return: `8c27e24d-7d1f-4739-93ff-4225bbe22b8d`;
- assisted straddle handstand: `750a945c-9407-4bd2-b47b-9478b3d6bfff`;
- assisted straight handstand: `d7a94de1-52a9-4b17-8d8c-072d3b0ed317`;
- independent straddle handstand: `3ffdbc7b-cc31-44ae-9840-4840ca58cf51`;
- independent straight handstand: `be865d38-135a-4a42-9d3f-d2ecd4f34d3b`;
- 7 selectable variants, 14 profiles, 32 evidence sections, 6 media
  candidates, 28 alternate assessments, 14 graph proposals, 14 calibration
  proposals, 5 explicit boundaries, and 2 current packets;
- difficulty vectors are `56/54/56`, `64/62/64`, `72/70/72`, `82/74/82`,
  `86/80/86`, `86/82/86`, and `90/88/90` for exercise complexity / physical
  difficulty / their maximum;
- each current packet contains exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`.

The first direct migration-482 run failed transactionally only because its
final assertion used an ambiguous per-definition alias; no data persisted.
The assertion was qualified, the corrected bytes passed direct execution and
idempotent re-entry, the temporary diagnostic notice was removed, and the
final diagnostic-free bytes passed two direct runs before registration. The
normal runner then registered checksum `229324910`; stored and local checksums
match exactly, and subsequent normal-runner re-entry skips cleanly.

Six Bar Cast-family media candidates have current YouTube oEmbed metadata only:

- Bar Cast: `0e0CAHk57IY`, `H9HXXXTGXuI`, `RGdJYHGA_n0`;
- Cast to Handstand: `NBqHxIRKJZI`, `NrVhnMiYg7w`, `jiHZCy1lLvY`.

Do not claim full playback, exactness, captions, accessibility, safety,
quality, reviewer identity, or approval for these candidates.

## Prior checkpoint: migration 478 (superseded)

The last fully registered and comprehensively verified family is migration 478,
Cartwheel Hand-Placement Line Drill.

- 1,676 of 1,676 legacy rows are mapped.
- There are 1,042 active canonical definitions.
- The current surfaced identity detector reports 616 of 616 pairs adjudicated,
  zero unresolved score-72-or-higher pair, and zero exact collision.
- 88 definitions are machine-complete and 954 are machine-incomplete.
- 87 of 1,042 definitions have exactly three to five current healthy embeddable
  candidates for their current card version.
- The global graph queue contains 673 review-only rows and zero approvals.
- The global calibration queue contains 897 review-only rows and zero approvals.
- There are zero published definitions, zero approved depth in every required
  phase, and zero of 20 required real coach workout reviews.
- Migration 478 is registered in disposable PostgreSQL at checksum
  `1161560817`.
- Registry `2026-08-02.83` contains 348 sources.
- Focused validation passed 212 tests; the full backend suite passed 1,011 tests
  with 20 intentional skips; focused lint, JSON validation, persisted audit,
  identity reporting, diff integrity, and the production build passed.
- The release check returned its expected blocked status because publication,
  approved graph/calibration depth, phase depth, and coach-pilot evidence remain
  absent.
- Existing build advisories are dependency-freshness and large-chunk warnings,
  not migration failures.

These values are a checkpoint, not permanent expectations. Replace them in the
live checkpoint only with authoritative post-migration audit output.

The original potential-duplicate and direct-collision work is complete at the
current detector threshold. Do not reopen adjudicated pairs without new
mechanics evidence, but rerun the detector after every family because new exact
variants or boundaries can surface new pairs.

## Prior migration 478 worktree state (historical; do not use as current)

Branch and repository at the time of this handoff:

- branch: `main`;
- `HEAD` and `origin/main`: `57df2c2`;
- task-owned dirty files include migration 478, its two platform test files,
  research registry, five audit/review documents, and this handoff file;
- `docs/NEEDS_ENGINE_CATEGORY_METRICS.json` is unrelated concurrent/build state
  and must be preserved.

Important: commit `57df2c2` captured an incomplete copy of migration 478 while
it was being authored. The dirty working copy contains the missing completion
logic and SQL corrections. Do not checkout, reset, discard, or replace this
file with the committed copy.

Migration 478 targets legacy source 15, Cartwheel Hand-Placement Line Drill:

- canonical definition: `847bebc6-1eb0-4a61-835d-56ea156b4fca`;
- archived source baseline: `b6c55d93-4ad8-4be1-aa08-2d31978dac0b`;
- standing exact variant: `db4013cd-9047-498b-be80-48e89e1c285f`;
- half-kneeling exact variant: `ce85fdb7-ca80-49b6-9408-48d9cb879ebd`;
- wall-assisted exact variant: `77548a95-23b7-4dcb-bd4f-75239739ca8f`.

The current dirty migration was applied directly to disposable PostgreSQL
twice, unchanged, before registration, after repairing:

- a missing `impact` value/alias in each variant tuple;
- an invalid delivery-profile suitability alias;
- the invalid delivery-profile role `rehearsal`, now controlled `secondary`;
- invalid relationship type `substitution`, now controlled
  `lateral_substitution`;
- uncontrolled relationship dimension `equipment`, removed from graph
  dimensions while retained in the rationale and revalidation contract;
- legacy `scalable_variables` JSON assigned to a `TEXT[]` column, now a
  controlled text array;
- prohibited skill-level-shaped JSON keys, replaced with language that states
  the exercise card does not classify athletes.

Both pre-registration direct executions returned `DO`. The production runner
then registered the exact file at checksum `1161560817`, and exact-file direct
re-entry returned `DO`. The migration is now immutable even though Git still
shows it dirty relative to the incomplete copy captured by commit `57df2c2`.
Do not edit it; add a later migration if a correction becomes necessary.

Current persisted family counts after direct execution:

- 1 canonical definition at card version 2;
- 3 selectable `review` variants;
- 6 `review` delivery profiles;
- 16 candidate evidence sections;
- 5 current healthy candidate media rows;
- 32 candidate alternate assessments;
- 8 review-only graph proposals;
- 6 review-only calibration proposals;
- 7 explicit distinct-identity boundaries;
- 1 quarantined test packet with exactly 4 human blockers.

Difficulty vectors are complexity / physical / derived overall:

- half-kneeling: `56 / 50 / 56`;
- standing: `64 / 58 / 64`;
- wall-assisted: `58 / 54 / 58`.

Legacy exercise 15 has null `skill_level`, `age_min`, `age_max`, and
`linked_skill_id`; it is not published. Related Cartwheel skill cards keep their
own skill-library levels.

The four packet blockers are exactly:

- `CARD-MEDIA-01`;
- `CARD-GRAPH-03`;
- `CARD-CALIBRATION-01`;
- `CARD-PUBLISH-01`.

Migration 478 is registered in `schema_migrations` at checksum `1161560817` and
timestamp `2026-08-02 10:18:25.769134-04`. `backend/platform/initTables.js`
lists it in numeric order. Research registry, tests, five audit documents, and
this handoff have been updated.

Current research registry state:

- version `2026-08-02.83`;
- 348 sources.

Migration 478 added these eight exact source families:

- Masaryk University Safe Gymnastics Cartwheel markers and technique;
- USASF Preschool FUNdamentals Tumbling Cartwheel PT.14;
- PMID `29343188`, Cartwheel/Round-Off hand position and elbow/wrist loading;
- DOI `10.1080/14763141.2021.1876755`, skill complexity and upper-limb loading;
- PMCID `PMC11235812`, foundation tumbling upper/lower-limb impact loading;
- PMID `12929780`, blocked versus alternating Cartwheel practice;
- International Journal of Sport Psychology manual-guidance experiments;
- DOI `10.26858/cpjok.v18i1.524`, floor-tape Cartwheel learning study.

Current YouTube candidates, checked only through current oEmbed metadata on
2026-08-02, are:

- `J4DISL56-kI` — Lakes Area Gymnastics;
- `tc6EYwsUaws` — TYG;
- `kdPlscoyYO8` — Back Handspring Academy;
- `dFkTY-ZOSpU` — Gymnastics Tools;
- `CZb-afEMaIc` — Mismo Gymnastics Staff.

Do not claim full playback or approval for these videos.

## Prior next-work note (completed by migrations 479–481)

The next planned source is legacy source 16, Back Bridge. Audit it from current
data before assuming its identity, variants, or research needs:

1. Recheck Git state and current database registration because shared commits
   can land between turns.
2. Query source 16, its canonical definition/source mapping, source variant,
   card version, statuses, profiles, evidence, media, alternates, graph,
   calibration, packet blockers, legacy exercise/safety fields, and related
   definitions returned by name/mechanics search.
3. Determine whether “Back Bridge” means a static supported arch hold, entry or
   kick-over skill, rocking/dynamic repetition, shoulder-opening drill,
   elevated bridge, single-leg variant, or another exact contract. Quarantine
   ambiguous lineage instead of guessing.
4. Research governing-body/professional technique, direct biomechanics or
   loading evidence, population/contraindication limitations, motor-learning
   evidence where relevant, meaningful alternates, and three to five current
   embeddable YouTube candidates.
5. Author the next numbered migration only after stable identity boundaries,
   difficulty-only vectors, delivery profiles, evidence limitations, media
   quarantine, graph/calibration proposals, and a complete test packet are
   explicit.

## Immediate next work

Legacy source 18 has now been audited and researched. A migration is drafted
but has **not** passed its first direct database run and has **not** been
registered. Do not restart the source audit and do not treat the draft as
complete.

Current draft:

- file:
  `backend/migrations/484_coaching_handstand_snap_down_family_audit_hardening.sql`;
- current unregistered checksum: `1789278012` (this changes after any repair);
- legacy row: `18 | Round-Off Snap-Down Shape Drill | round-off`;
- canonical definition: `60f5b21a-991c-4ce8-9068-3c42b2043021`;
- archived source baseline: `064e650c-28e8-4820-b0da-7043bb509c2c`;
- exact wall-start variant: `68c16da0-414f-4932-97f4-1d8b236af8dd`;
- exact independent-start variant: `68a0499b-34b0-4621-b798-b49ffd8ed1a1`;
- intended family identity: `Handstand Snap-Down to Feet-Together Stick`, not
  a full Round-Off;
- intended authored counts: 2 variants, 4 profiles, 16 evidence sections, 4
  media candidates, 24 alternate assessments, 8 graph proposals, 4
  calibration proposals, 8 identity boundaries, and 1 packet with the four
  standard human blockers;
- intended difficulty vectors are `70/62/70` for the back-to-wall exact
  variant and `82/70/82` for the independent exact variant.

The exact repetition begins only after the selected inverted two-hand start is
established. The athlete pushes tall, keeps the legs joined, snaps the legs
down, releases the hands before simultaneous two-foot contact, and finishes an
upright hollow feet-together stick with arms by the ears. A rebound, extra
step, fall, turn, connection, wrong start, unexpected contact, asynchronous
feet, or loss of the selected support contract invalidates the repetition.
Full Round-Off, Round-Off rebound, connected Round-Off/back-handspring,
back-handspring snap-down, snap-down to rebound or back landing, standing
snap-down, Donkey Kick, hand pop, static Handstand, Handstand Kick-Up,
Cartwheel, hurdle entry, and unilateral landing remain distinct identities.

The first direct SQL execution failed transactionally, so no migration-483
changes persisted. PostgreSQL rejected the variant rows under
`exercise_variant_no_level_classification_check` because `difficulty_json`
contains the prohibited key
`athleteSkillOrProficiencyClassification`, even though its value is null. The
failure detail also exposed a numeric `VALUES` alignment error: `wallContact`
received a number. Repair both issues before rerunning:

1. Remove the entire
   `'athleteSkillOrProficiencyClassification', NULL` key/value pair.
2. Replace the 22 numeric fields from complexity through recovery hours with
   exactly these sequences:
   - wall variant:
     `70,62,68,72,70,72,78,48,42,46,36,50,54,24,82,78,76,38,68,24,84,24`;
   - independent variant:
     `82,70,76,80,84,84,88,58,50,52,42,58,62,30,88,86,80,58,78,30,92,30`.
3. Recompute the draft checksum and run the exact repaired file directly with
   `ON_ERROR_STOP=1`.
4. Fix any further schema/assertion errors transactionally, then run the final
   unchanged bytes directly a second time to prove idempotency.
5. Query authoritative family/global counts before updating tests or docs.

After the SQL passes twice, complete the following in order:

1. Advance the research registry from `2026-08-02.85` / 364 sources to the
   actual new version/count, expected `2026-08-02.86` / 367 if exactly these
   three sources are added: USA Gymnastics current compulsory Round-Off and
   snap-down material, Masaryk Safe Gymnastics Roundoff technique, and Special
   Olympics handstand/snap-down coaching. Reuse the already-registered CanJump
   manual instead of duplicating it.
2. Update `canonicalResearchBatch.test.js` for the exact new registry version,
   count, source keys, URLs, publishers, kinds, and quality floors.
3. Register the coaching migration after 482 in
   `backend/platform/initTables.js`. A concurrent, unrelated file named
   `backend/migrations/483_class_active_dates_from_offerings.sql` is scheduling
   work. Preserve it and its registration; the filenames are distinct, but
   inspect both init paths and `schema_migrations` before assuming numbering
   behavior.
4. Add the complete migration-483 static contract to
   `exerciseProgrammingDifficultyOnly.test.js`, including exact UUIDs,
   boundaries, counts, vectors, no age/skill classification, candidate-only
   media, no fabricated approvals, protected-record fail-closed behavior, and
   the four packet blockers.
5. Run focused tests, focused lint, JSON validation, and `git diff --check`.
6. Run the normal migration runner, verify stored versus local checksum, prove
   exact-file re-entry, then run persisted audit, identity report, expected-
   blocked release check, full backend suite, and production build.
7. Append actual post-run evidence to all five audit/review documents and this
   file. Only then query and select source 19.

Research already completed for this draft includes the current USA Gymnastics
compulsory replacement material, Masaryk Safe Gymnastics Roundoff technique,
the existing CanJump manual, the Special Olympics artistic-gymnastics guide,
handstand and upper-extremity research already in the registry, and four
YouTube oEmbed metadata checks. The candidate video IDs are `7r-UOQi8YvE`,
`BnnX00Hlqpk`, `D6bbi5bv0TY`, and `dqEZV4DW8aU`. They have metadata health
only; playback, exactness, captions, accessibility, cue quality, safety, and
approval remain unverified and must stay null/quarantined.

## Concurrent work that must remain preserved

Do not regress these previously shared fixes:

- `phaseAwarePrescription.js` requires full equipment coverage only for
  `must_use`; `use_only` is an allow-list, not a requirement to use everything.
- `phaseAwarePrescription.v2.test.js` contains regression coverage for that
  behavior.
- Prescription-error route responses include `{ code, ...details }`.
- `NeedsEnginePanel` displays blocking requirements and suggested relaxations.
- Preserve unrelated concurrent edits currently visible in
  `docs/ADMIN_PORTAL_ROADMAP.md`, `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`,
  `src/components/classSetup/AdminClassSetupOverviewCellEditor.tsx`,
  `src/components/classSetup/AdminClassSetupOverviewTable.tsx`, and
  `src/components/classSetup/classSetupCopyPaste.ts`.
- Also preserve all current scheduling/class-active-date work in
  `backend/scheduling/handlers.js`, `backend/scheduling/initTables.js`,
  `backend/scheduling/registerRoutes.js`,
  `backend/migrations/483_class_active_dates_from_offerings.sql`,
  `src/components/scheduling/AdminSchedulingSlots.tsx`,
  `src/components/scheduling/ClassActiveDatesEditor.tsx`,
  `src/components/classSetup/overviewColumns.tsx`, and
  `src/utils/schedulingApi.ts`. This work appeared concurrently after the
  prior checkpoint and is not part of the exercise-library task.

Inspect current files before touching them because shared commits may land at
any time.

## Return-handoff requirements

Before stopping or handing control back, append a dated entry below. Do not
delete the previous entry. The return entry must contain:

1. Exact branch, `HEAD`, and `git status --short`.
2. Every file changed and whether it belongs to this task or concurrent work.
3. The last immutable registered migration and checksum.
4. Any unregistered migration, its current checksum, and whether direct run 1,
   direct run 2, production runner, and exact-file re-entry passed.
5. Exact family UUIDs, source IDs, variant IDs, and persisted row counts.
6. Exact research-registry version and source count.
7. Exact audit totals: legacy mappings, active definitions, machine-complete,
   machine-incomplete, media coverage, identity pairs/unresolved/collisions,
   graph review/approved, calibration review/approved, published definitions,
   phase depth, and coach-pilot progress.
8. Exact focused-test, full-backend, lint, audit, release-check, and build
   results, including intentional skips and existing warnings.
9. Every failure encountered, whether it rolled back, and the correction made.
10. Human-review work that remains. Never report candidate rows as approvals.
11. The exact next source/family and the first commands or queries to run.
12. Whether any docs or metrics still need updating.

Use this template:

```md
### Return handoff — YYYY-MM-DD HH:MM timezone

- Branch / HEAD:
- Worktree:
- Last registered migration / checksum:
- Unregistered migration state:
- Family completed or in progress:
- Persisted family counts:
- Registry version / count:
- Global audit snapshot:
- Identity snapshot:
- Release gate:
- Focused tests:
- Full backend:
- Lint:
- Build:
- Failures and corrections:
- Human review remaining:
- Documentation updated:
- Exact next action:
```

## Return-handoff ledger

### Return handoff — 2026-08-02 11:04 America/New_York

- Branch / HEAD: `main` / `87b798df27a9cbaeb5854360ecc093acbab9d07f`.
- Worktree: task-owned edits are platform migration registration/tests, five
  audit documents, this handoff, and untracked migrations 480–481. Preserve
  unrelated `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`.
- Last registered migration / checksum: migration 481 / `722794694`.
- Unregistered migration state: none.
- Family completed or in progress: Gymnastics Back Bridge Hold completed to
  machine-authored quarantine; human review remains.
- Persisted family counts: 3 variants, 6 profiles, 16 evidence, 4 media, 32
  alternates, 8 graph, 6 calibration, 9 boundaries, 4 human blockers.
- Registry version / count: `2026-08-02.84` / 357.
- Global audit snapshot: 1,676/1,676 mappings, 1,042 active, 89 machine-
  complete, 953 incomplete, 88 current healthy 3–5-media sets, 681/0 graph
  review/approved, 903/0 calibration review/approved, 0 published.
- Identity snapshot: 617/617 surfaced pairs adjudicated, 0 unresolved, 0 exact
  collision.
- Release gate: expected blocked status; 0/25 published, 0/3 phase depth,
  0/10 graph approvals, 0/3 calibration approvals, 0/20 coach reviews.
- Focused tests: 216/216 pass.
- Full backend: 1,015 pass, 20 intentional skips, 0 failures.
- Lint: focused lint passes.
- Build: production build passes; stale baseline-browser-mapping/caniuse-lite
  data and >500 kB chunk warnings remain.
- Failures and corrections: calibration tier 70 rolled back and became 80;
  audit crash on score 0 led to migration 480; anatomy audit failure led to
  migration 481. Each failed SQL transaction rolled back fully.
- Human review remaining: media playback/exactness/captions/accessibility/
  quality/safety, graph decisions, calibration, content review, separate
  approval, publication, phase-depth rollout, and coach pilot.
- Documentation updated: all five append-only audit/review documents and this
  handoff.
- Exact next action: audit legacy source 17, Bar Cast, then research and author
  migration 482 only after resolving its action and skill-library boundaries.

### Return handoff — 2026-08-02 11:42 America/New_York

- Branch / HEAD: `main` / `87b798df27a9cbaeb5854360ecc093acbab9d07f`.
- Worktree: task-owned edits are migration registration/tests, research
  registry, five append-only audit/review documents, this handoff, and
  untracked-but-DB-registered migrations 480–482. Preserve unrelated concurrent
  edits in `docs/ADMIN_PORTAL_ROADMAP.md`,
  `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`,
  `AdminClassSetupOverviewCellEditor.tsx`,
  `AdminClassSetupOverviewTable.tsx`, and `classSetupCopyPaste.ts` plus the
  shared Needs Engine fixes listed above.
- Last registered migration / checksum: migration 482 / `229324910`, registered
  `2026-08-02 11:36:31.016626-04`; stored and exact-file checksums match.
- Unregistered migration state: none. Migration 482 final diagnostic-free bytes
  passed direct run 1, unchanged direct run 2, production runner, and normal-
  runner exact-file re-entry; re-entry skipped the registered file.
- Family completed or in progress: Bar Cast / Cast to Handstand completed to
  machine-authored quarantine; human review remains. Definition UUIDs are
  `6915611f-7382-448b-b3eb-d8dd08f10ee7` and
  `d8b03d69-0840-40b0-adba-21d855d3db3e`; source 17 and archived baseline
  `aa63fb72-5cab-413a-89d3-4eb865424c21` remain traceable.
- Persisted family counts: 7 selectable variants (`6d6f938d-d399-4c4a-92f7-e56b72b6eeaf`,
  `2a92d86f-3006-4da7-a809-d4bdce39cbd4`,
  `8c27e24d-7d1f-4739-93ff-4225bbe22b8d`,
  `750a945c-9407-4bd2-b47b-9478b3d6bfff`,
  `d7a94de1-52a9-4b17-8d8c-072d3b0ed317`,
  `3ffdbc7b-cc31-44ae-9840-4840ca58cf51`,
  `be865d38-135a-4a42-9d3f-d2ecd4f34d3b`), 14 profiles, 32 evidence
  sections, 6 media, 28 alternates, 14 graph, 14 calibration, 5 boundaries, 2
  packets, and exactly 4 human blockers per card.
- Registry version / count: `2026-08-02.85` / 364.
- Global audit snapshot: 1,676/1,676 mappings, 1,043 active, 91 machine-
  complete, 952 incomplete, 90 current healthy 3–5-media sets, 695/0 graph
  review/approved, 917/0 calibration review/approved, 0 published.
- Identity snapshot: 617/617 surfaced pairs adjudicated, 0 unresolved, 0 exact
  collision; identity report separately confirms 0 score-72+ unresolved pairs.
- Release gate: expected blocked status; 0/25 published, 0/3 phase depth in all
  seven phases, 0/10 graph approvals, 0/3 calibration approvals, 0/20 coach
  reviews.
- Focused tests: 218/218 pass.
- Full backend: 1,017 pass, 20 intentional skips, 0 failures.
- Lint: focused ESLint passes; JSON parsing and `git diff --check` pass.
- Build: production build passes; stale baseline-browser-mapping/caniuse-lite
  data and >500 kB chunk warnings remain advisory.
- Failures and corrections: the first unregistered direct SQL run rolled back
  because a final assertion used an ambiguous per-definition alias. The alias
  was qualified; authored counts were confirmed; a temporary diagnostic notice
  was removed; final bytes then passed twice before registration. An excluded
  media ID (`wQppaX1KONQ`) returned YouTube oEmbed 401 and was never persisted.
- Human review remaining: full media playback/exactness/captions/accessibility/
  quality/safety, all 14 graph decisions, all 14 calibrations, content review,
  separate approval, publication, phase-depth rollout, shadow generation,
  clean-database rehearsal, monitoring/rollback evidence, and coach pilot.
- Documentation updated: all five append-only audit/review documents and this
  handoff now contain the Bar Cast batch and current metrics.
- Exact next action: audit legacy source 18, Round-Off Snap-Down Shape Drill,
  beginning with current source/mapping/variant/profile/evidence/media/graph/
  calibration/packet and related Round-Off/snap-down/Cartwheel/Handstand/skill-
  library queries; author migration 483 only after resolving the exact ordered
  action and repetition boundary.

### Return handoff — 2026-08-02 11:56 America/New_York

- Branch / HEAD: `main` /
  `87b798df27a9cbaeb5854360ecc093acbab9d07f`.
- Worktree: task-owned tracked edits remain the two platform tests,
  `backend/platform/initTables.js`, the research registry, all five workout-
  generator audit/review documents, and this handoff. Task-owned untracked but
  database-registered immutable files are migrations 480–482. Task-owned
  untracked draft migration 483 is the Handstand Snap-Down family. All admin,
  class-setup, scheduling, class-active-date, metrics, and Needs Engine changes
  identified under `Concurrent work that must remain preserved` are unrelated
  concurrent work and must not be reset, overwritten, renamed, or included in
  exercise-library edits.
- Last registered migration / checksum: migration 482 / `229324910`.
- Unregistered migration state:
  `484_coaching_handstand_snap_down_family_audit_hardening.sql`, current draft
  checksum `1789278012`. Direct run 1 failed transactionally; direct run 2,
  normal runner, and exact-file re-entry have not run. The draft is not in
  `backend/platform/initTables.js`, its research sources are not in the
  registry, and its static tests have not been added.
- Family completed or in progress: source 18 is researched and identity-
  resolved in the draft as `Handstand Snap-Down to Feet-Together Stick`.
  Canonical definition `60f5b21a-991c-4ce8-9068-3c42b2043021`; source
  baseline `064e650c-28e8-4820-b0da-7043bb509c2c`; variants
  `68c16da0-414f-4932-97f4-1d8b236af8dd` and
  `68a0499b-34b0-4621-b798-b49ffd8ed1a1`.
- Persisted family counts: no migration-483 counts are persisted because the
  failed PostgreSQL `DO` block rolled back. Intended draft counts are 2
  variants, 4 profiles, 16 evidence, 4 media, 24 alternates, 8 graph, 4
  calibration, 8 boundaries, and 1 quarantined packet with 4 blockers; prove
  rather than assume them after repair.
- Registry version / count: still `2026-08-02.85` / 364. Expected after the
  planned three source additions is `2026-08-02.86` / 367, but use the actual
  parsed count.
- Global audit snapshot: unchanged last authoritative values are 1,676/1,676
  mappings, 1,043 active, 91 machine-complete, 952 incomplete, 90 current
  healthy 3–5-media sets, 695/0 graph review/approved, 917/0 calibration
  review/approved, and 0 published. Rerun after migration 483.
- Identity snapshot: last authoritative detector is 617/617 adjudicated, 0
  unresolved, 0 exact collision. Rerun after migration 483.
- Release gate: last expected block remains 0/25 published, 0/3 phase depth,
  0/10 graph approvals, 0/3 calibration approvals, and 0/20 coach reviews.
- Focused tests: last completed checkpoint is 218/218; no source-18 tests have
  run.
- Full backend: last completed checkpoint is 1,017 pass, 20 intentional skips,
  0 failures; do not attribute this to the current draft.
- Lint: last completed checkpoint passed; the current draft has not been
  linted or statically validated.
- Build: last completed checkpoint passed with existing dependency-freshness
  and >500 kB chunk advisories; no post-draft build has run.
- Failures and corrections: direct migration-483 run 1 rolled back under
  `exercise_variant_no_level_classification_check` because the prohibited
  `athleteSkillOrProficiencyClassification` key exists even with a null value.
  The failure detail also exposed misaligned numeric variant tuples. Neither
  repair has been applied yet; use the exact repair vectors in `Immediate next
  work`.
- Human review remaining: all four candidate videos need full playback and
  exactness/captions/accessibility/quality/safety review; every evidence claim,
  alternate, graph edge, calibration anchor, instruction set, and working
  identity needs qualified review; content approval, publication, phase depth,
  rollout rehearsal, monitoring/rollback evidence, and coach pilot remain.
- Documentation updated: this zero-context handoff now reflects source-18
  research and the failed draft run. The five append-only audit/review files
  have not received a completed migration-483 entry and must not be updated as
  if the family passed.
- Exact next action: edit only the unregistered coaching migration to remove
  the forbidden key and correct the two numeric vectors, recompute checksum,
  run it directly against disposable PostgreSQL with `ON_ERROR_STOP=1`, and
  continue through the ordered completion checklist in `Immediate next work`.
