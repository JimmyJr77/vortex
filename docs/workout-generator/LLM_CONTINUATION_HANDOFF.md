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

Legacy source 20, `Precision Jump`, is complete to machine-authored quarantine
through immutable migrations 487 and 489.

- Source 20 maps as `duplicate_consolidation` to `Broad Jump to Stick`
  (`1260d75e-6807-4c91-859d-7d561a9160a3`, card version 3). Generic source
  definition `6dc5fcf1-6383-4aed-a73b-7465384fd18b` and baseline
  `dd36d133-894b-4562-9cc7-016d1db6f56c` are archived/nonselectable.
- Exact survivor variants are open-surface
  `962d4295-1d84-400f-af24-53ff25813f96` at `44/48/48` and restricted-target
  parkour precision `5cc18072-971f-4f98-bf71-1213341167e4` at `62/54/62`.
- Distinct `Bilateral 360-Degree Jump to Stick`
  (`1101413d-55c7-4585-abc2-6e63484ec434`) contains open-surface variant
  `b365da0f-2779-4883-8152-a5b3c09bee9f` at `78/64/78` and restricted-target
  variant `1101413d-55c7-4585-abc2-6e63484ec435` at `86/68/86`.
- Persisted current scope is 4 selectable variants, 11 profiles, 32 evidence
  sections, 10 healthy candidate media rows, 41 alternates, 12 migration-487
  relationship proposals, 6 new review-only calibrations, 1 duplicate and 12
  distinct migration-owned identity decisions, and 2 current packets. Each
  packet contains exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`.
- Migration 487 checksum is `2192026862`, registered
  `2026-08-02 13:24:48.619779-04`. Migration 489 checksum is `1326745458`,
  registered `2026-08-02 13:28:59.307957-04`. Both passed direct execution
  twice before registration, normal-runner registration and skip, stored/file
  checksum verification, and exact-file re-entry. Do not edit either file.
- Registry `2026-08-02.88` contains 378 sources. Focused tests pass 226/226;
  the full backend suite passes 1,025 with 20 intentional skips; focused lint,
  JSON parsing, diff checks, persisted audit, identity reporting, and the
  production build pass.
- Authoritative global state is 1,676/1,676 mappings, 1,045 active definitions,
  96 machine-complete, 949 incomplete, 95 current healthy embeddable 3–5-media
  sets, 626/626 adjudicated surfaced pairs, zero unresolved pair, zero exact
  collision, 724/0 graph review/approved, 939/0 calibration review/approved,
  and 0 published.
- Release is correctly blocked at 0/25 published definitions, 0/3 approved
  depth in all seven phases, 0/10 approved graph edges, 0/3 approved
  calibration anchors, and 0/20 real coach reviews. No human/media/graph/
  calibration/content/publication approval was fabricated.

The active next family is legacy source 21, `90/90 Breathing with Reach`.
Follow the newest `Immediate next work` section below.

## Prior verified checkpoint: source 19

The last comprehensively verified family is legacy source 19, completed to
machine-authored quarantine as three distinct definitions by immutable
migrations 485 and 486:

- `Two-Bar Lache Transfer to Retained Catch`
  (`abc659bf-ce3c-4b7c-a118-f2b0c761bd07`);
- `Bar Hollow–Arch Tap Swing`
  (`3018f919-8d85-4870-a1d2-ece8fd2af15e`);
- `Lache Precision to Two-Foot Stick`
  (`656028eb-c7d1-4a2f-a216-45763b201796`).

The ambiguous source baseline
`9aedcb37-d32a-43b8-a1d1-0a653d1bcdb5` is archived and nonselectable. The
latest immutable migration is 486,
`coaching_lache_family_canonical_audit_contract_correction`, checksum
`4213002410`, registered `2026-08-02 12:47:09.976476-04`. Migration 485 is
immutable at checksum `376239898`, registered
`2026-08-02 12:39:45.047632-04`. Do not edit either file; use a later
corrective migration if new evidence exposes a defect.

Authoritative post-486 state:

- 1,676 of 1,676 legacy rows are mapped to 1,045 active definitions.
- The surfaced identity detector reports 617 of 617 pairs adjudicated, zero
  unresolved score-72-or-higher pair, and zero exact collision.
- 95 definitions are machine-complete and 950 are machine-incomplete.
- 94 of 1,045 definitions have three to five current healthy embeddable
  candidates for their current card version.
- Graph/calibration queues contain 713/933 review-only rows with zero
  approvals.
- There are zero published definitions, zero approved depth in every required
  phase, and zero of 20 required real coach workout reviews.
- Registry `2026-08-02.87` contains 374 sources.
- Focused validation passes 223 tests; the full backend suite passes 1,022
  tests with 20 intentional skips and zero failures. Focused lint, registry
  JSON parsing, persisted audit, identity reporting, diff integrity, and the
  production build pass.
- The production build retains only existing baseline-browser-mapping and
  caniuse-lite freshness notices plus the greater-than-500-kB Admin chunk
  advisory.
- The release gate is correctly blocked at 0/25 published definitions, phase
  depth 0/3 in all seven required phases, 0/10 approved graph edges, 0/3
  approved calibration anchors, and 0/20 coach reviews.

Persisted source-19 scope is 6 selectable variants, 16 profiles, 48 evidence
rows, 15 healthy candidate media rows, 38 alternate assessments, 11 review-
only graph proposals, 12 review-only calibration proposals, 15 survivor-owned
identity boundaries, and 3 current test packets. Each packet contains exactly
`CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
`CARD-PUBLISH-01`. No media, relationship, calibration, content, publication,
or reviewer approval was created.

The active next family is legacy source 20, `Precision Jump`. Follow
`Immediate next work` below. Its first identity decision must compare it
directly with the already completed `Standing Broad Jump` and `Broad Jump to
Stick` contracts before deciding whether source 20 is a distinct parkour
precision identity, an exact duplicate to consolidate, or an unresolved
identity quarantine.

### Prior verified family: Bar Cast / Cast to Handstand

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

## Historical source-18 draft checkpoint (completed by migration 484)

This section preserves the failure/recovery history that was accurate while
migration 484 was a draft. Do not follow its pending-work instructions; use
the current `Live checkpoint`, the new `Immediate next work` section below, and
the newest return-handoff entry.

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

## Immediate next work

Sources 20 and its six newly surfaced similarity neighbors are complete to
machine-authored quarantine through immutable migrations 487 and 489. Do not
edit either registered file. The active family is legacy source 21:

- legacy identity: `21 | 90/90 Breathing with Reach |
  9090-breathing-with-reach`;
- canonical definition:
  `0ac22398-2eed-482a-aae8-8d26ba888eaf`, card/schema `1`/`1.0.0`, status
  `review`;
- current active variants are baseline
  `cb077d9c-261b-4944-8f3e-6109491c73cd`, source-1404 Hip Reset
  `4276c5c7-19d9-4cfc-830f-fb6482b3430c`, and source-656 Reach
  `329f2581-c1b7-4c2b-8a71-8c5c34a59cb1`;
- all three currently use skeletal `20/10/20` complexity / physical / overall
  JSON, empty requirements, and require complete reassessment;
- current scope is 3 active variants, 4 skeletal profiles, 0 evidence, 4
  unreviewed media rows, 0 alternates, and 0 calibration anchors;
- the current canonical audit packet has 20 blockers;
- legacy text describes supine feet-on-wall/bench/box hip-and-knee 90/90,
  ceiling/forward reach, nasal inhale, lower-rib/abdominal expansion, and slow
  full exhale without crunching, but instructions are empty;
- legacy state improperly retains `age_min=6` and `is_published=true`; skill
  level and linked skill are null. Do not copy the age/publication claims.
- legacy movement requirements currently claim `spine_rotation` despite a
  sagittal/rib-position breathing description. Treat this as a defect to audit,
  not evidence.

Exact next execution order:

1. Reconcile current `HEAD`, worktree, latest coaching/scheduling migration
   filenames, and disposable PostgreSQL ledger. Preserve concurrent scheduling
   and generated metrics changes.
2. Query every source-21 definition/source/variant/profile/score/safety/media/
   relationship/identity/packet row plus source IDs 656 and 1404 and every
   neighboring 90/90 hip-lift, hip-shift, balloon, wall-supported breathing,
   dead-bug breathing, crocodile breathing, and reach identity.
3. Resolve whether `90/90 Breathing with Reach`, `90/90 Breathing with Hip
   Reset`, wall/bench/box support, arm position, heel pressure or hip lift,
   unilateral reach, balloon resistance, and pelvic shift are same identity,
   exact variants, delivery annotations, or distinct cards. Quarantine missing
   limb/support/breath-cycle/end-state facts rather than guessing.
4. Research direct respiratory/rehabilitation or professional instruction,
   relevant biomechanics and physiology with strict sample/task limitations,
   population and symptom constraints, dosage and duration, meaningful
   alternates, and 3–5 current embeddable YouTube candidates for every completed
   definition. Do not make clinical-treatment, posture-correction, or universal
   diaphragmatic-breathing claims from generic evidence.
5. Author the next free idempotent coaching migration only after checking the
   shared tree. Migration 488 is concurrent scheduling work and 489 is the
   immutable Precision-360 identity closure; do not reuse either number.
6. Repeat the complete direct-SQL twice, registry/test/init, checksum,
   production-runner, persisted audit, identity closure, release gate, focused
   and full validation, build, documentation, and return-handoff process.

## Historical source-20 next-work instructions (completed by migrations 487 and 489)

Source 19 is complete to machine-authored quarantine through immutable
migrations 485 and 486. Do not edit either registered file. Migration 485 is
registered at checksum `376239898`; corrective migration 486 is registered at
checksum `4213002410`. The authoritative post-correction checkpoint is 1,676/
1,676 mappings, 1,045 active definitions, 95 machine-complete, 950 incomplete,
94 current healthy embeddable 3–5-media sets, 617/617 adjudicated surfaced
pairs, zero unresolved pair, zero exact collision, 713/0 graph review/approved,
933/0 calibration review/approved, and 0 published. Focused tests pass 223/223;
the full backend suite passes 1,022 with 20 intentional skips; focused lint,
JSON parsing, diff checks, persisted audit, identity reporting, and production
build pass. The release gate remains correctly blocked on human review,
approved phase depth, and coach-pilot evidence.

The active family is legacy source 20:

- legacy identity: `20 | Precision Jump | precision-jump`;
- legacy description: `Controlled jump to a precise landing.`; instructions
  are empty;
- legacy dose is 4 sets of 5, 45 seconds rest, 40 estimated seconds per set;
- unsupported `age_min=8` and `is_published=true` remain and must not be copied
  automatically; exercise skill level and linked skill are already null;
- canonical definition:
  `6dc5fcf1-6383-4aed-a73b-7465384fd18b`, card/schema version `1`/`1.0.0`,
  status `review`;
- active baseline variant:
  `dd36d133-894b-4562-9cc7-016d1db6f56c`;
- the card has empty movement/body/equipment taxonomy, anatomy, environment,
  population, athlete support, coach support, and support operations;
- current baseline has 2 skeletal delivery profiles, 0 evidence rows, 4
  unverified candidate media rows, 0 alternate assessments, 1 preexisting
  review-only relationship, 0 calibration anchors, 3 identity-resolution rows
  created by adjacent completed families, and 20 canonical blockers;
- legacy score is complexity 40, physical/load 10, derived overall 40, and
  coordination 40, with impact/supervision absent; safety is risk 2, impact 1,
  and recommended supervision;
- current media IDs are `9sb4TYNHGio`, `FFgenf0h-3M`, `_b0HCpsuP6c`, and
  `opS9-hg9Rzc`; titles, channels, link health, embedding, playback, exactness,
  captions, accessibility, quality, safety, and approval are unverified.

Exact next execution order:

1. Reconcile `HEAD`, `git status`, the latest migration number, and disposable
   PostgreSQL state. Preserve unrelated `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`
   and all concurrent class-setup, scheduling, and Needs Engine changes.
2. Query every current source-20 row plus neighboring standing broad jump,
   target jump, stick landing, box/platform jump, drop landing, Lache Precision,
   and skill-library identities. Read the three existing identity decisions and
   the one relationship before authoring; do not overwrite adjacent reviewed
   or machine-authored lineage.
3. Research the exact Precision Jump repetition contract from direct parkour
   or governing-body sources. Resolve takeoff stance, arm policy, horizontal
   target, foot placement, target dimensions, height/gap, simultaneous contact,
   stabilization time, overstep/understep, rebound, fall, run-up, turn, and
   connected-action boundaries. Do not copy age or athlete proficiency levels.
4. Research and classify meaningful alternates. Create distinct cards for
   identity-changing standing/running, unilateral/bilateral, height, turn,
   rebound, obstacle, bar-release, or connected actions; use exact variants
   only when the repetition remains the same; reserve delivery annotations for
   non-identity dose or validated target-distance changes.
5. Validate or replace the four media candidates and produce 3–5 current
   healthy privacy-enhanced candidates for every definition authored. oEmbed
   health is metadata only; keep every human review and approval field null.
6. Author the next free idempotent migration (expected 487 only after checking
   the shared repository), update the research registry and static tests, run
   direct SQL twice, focused validation, normal registration, checksum and re-
   entry proof, persisted family/global audits, identity and release reports,
   full backend, lint, and production build.
7. Append actual results to all five audit/review ledgers and this handoff.
   Never report expected row counts as persisted proof or machine completion as
   qualified human approval.

## Completed source-19 implementation record (historical)

Source 18 is complete to machine-authored quarantine. Do not edit immutable
migration 484 or repeat its research unless new mechanics evidence requires a
later corrective migration.

The active family is legacy source 19. Its research and SQL authorship are now
complete as an unregistered draft, but migration registration, static contract
coverage, persisted reporting, full validation, and documentation are not.
Do not repeat the completed source audit or rewrite the draft from scratch.
First reconcile the shared worktree, then finish the exact ordered checklist
under `Exact next execution order`.

Current implementation state:

- unregistered migration:
  `backend/migrations/485_coaching_lache_transfer_tap_swing_precision_family_audit_hardening.sql`;
- current exact-file checksum: `376239898` (recompute after every edit);
- the exact current SQL bytes have passed an `ON_ERROR_STOP=1` direct run and
  an unchanged second direct run against disposable PostgreSQL; both completed
  with `DO`, and all earlier failed attempts rolled back transactionally;
- migration 485 is not in `backend/platform/initTables.js`, is not registered
  in `schema_migrations`, and does not yet have a static family-contract test;
- the research registry is already updated to `2026-08-02.87` with 374 parsed
  sources, and `canonicalResearchBatch.test.js` contains the source-19 registry
  assertions, but the test has not run;
- no source-19 global audit, identity report, release gate, focused suite, full
  backend suite, lint pass, or production build may be reported yet;
- the five append-only audit/review documents still describe only the last
  registered family and must be updated only after authoritative post-
  registration results exist.

The source identity is:

- legacy ID/name/slug: `19 | Lache Swing | lache-swing`;
- current description: `Swinging release-and-catch on bars.`;
- legacy state still includes `age_min=8` and `is_published=true`, which are
  unsupported and must not be preserved automatically;
- canonical definition: `abc659bf-ce3c-4b7c-a118-f2b0c761bd07`;
- source baseline variant: `9aedcb37-d32a-43b8-a1d1-0a653d1bcdb5`;
- current definition/variant version and status: card version 1, schema 1.0.0,
  `review`, with empty taxonomy, anatomy, constraints, support, difficulty,
  load, fatigue, programming, and variant requirements;
- before migration 485, the source baseline had two skeletal profiles
  (`movement_intelligence` and `output`), no difficulty score, no evidence,
  four unreviewed media rows, no alternates, no relationships, no
  calibrations, no explicit boundaries, and one packet with 20 blockers;
- legacy safety is only risk `2`, impact `1`, and recommended supervision; all
  other safety fields are empty;
- no direct Lache, tap-swing, or bar-swing card was found in `coaching.skill`;
  do not create an exercise-card skill level to compensate;
- adjacent exercise definitions already present include Dead Hang
  (`0973b1ff-410a-4c97-b85d-84fec7ad0182`), Active Hang
  (`77602a12-d58b-4d41-b84e-713a4b8c3011`), Scapular Pull-Up
  (`0c7d9348-f563-4a42-a31a-248d657901c1`), Flexed Arm Hang
  (`424de579-d93c-462e-b94f-4e849e89e03e`), Front Support Bar Cast
  (`6915611f-7382-448b-b3eb-d8dd08f10ee7`), and Cast to Handstand
  (`d8b03d69-0840-40b0-adba-21d855d3db3e`).

The source audit, controlled-taxonomy queries, research, identity decisions,
and SQL authorship are complete. Recheck `git status`, `HEAD`, migration
registration, and database state before editing because the repository is
shared. Never invent a controlled value from prose.

### Source-19 research already completed

Use these sources only for the claims their scope supports, and add them to the
registry only after checking for an existing key/URL:

1. World Gymnastics/FIG, *Parkour Age Group Development & Competition Program*,
   first edition 2021:
   `https://www.gymnastics.sport/site/pages/education/agegroup-pk-manual-e.pdf`.
   Pages 36–38 distinguish basic swing initiation, swing plus half turn,
   swing plus Lache Precision, run-up/catch/swing composites, flyaway, front-
   flip dismount, and back-cast dismount. Use it for identity/taxonomy and
   neighboring-boundary evidence only. Do not copy its age or acquisition
   levels into an exercise card.
2. World Gymnastics/FIG, *Parkour Table of Tricks 2025*:
   `https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202025.pdf`.
   It separately classifies Swing Moves and basics such as Tap Swing/Dyno. It
   supports distinct-identity boundaries, not a complete Lache-transfer card.
3. UrbanLeap, *Parkour Trainer Handbook*:
   `https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf`.
   Pages 151–154 define a Lache as a dynamic transfer from one bar or rail to
   another from an active hang, using a controlled hollow/arch tap swing,
   mostly horizontal projection, compact flight, a two-arm target reach, and a
   controlled catch with active scapular absorption. The handbook supports
   prerequisites, short-gap/higher/lower-target progressions, common faults,
   and apparatus/lane/grip/supervision safeguards. Treat it as a professional
   Erasmus+ project handbook whose disclaimer assigns the views to its
   authors, not as EU, FIG, or universal medical approval. It does not prove a
   universal dose, recovery interval, eligibility rule, or numeric difficulty.
4. Gervais and Baudin, *The Identification of Release on the Horizontal Bar*:
   `https://ojs.ub.uni-konstanz.de/cpa/article/download/2969/2815`. It supports
   the narrow adjacent point that flight is largely determined at release. It
   is a small horizontal-bar gymnastics study, not direct Lache evidence.
5. The Kovacs release/regrasp biomechanics paper,
   DOI `10.1016/j.jbiomech.2016.11.048`, is adjacent evidence from two elite
   male gymnasts. Do not generalize its release window or regrasp findings into
   a universal Lache rule.
6. Parkour injury survey PMID `23860830` is a retrospective online survey of
   266 respondents and reports an upper-extremity injury distribution. It is
   not Lache-specific, causal, or a basis for thresholds.
7. Check the existing registry before duplicating useful adjacent sources such
   as `pullup_scapular_kinematics`, `hangboard_grip_endurance_training`,
   `gymnastics_upper_extremity_injuries_return_review`, and
   `crossfit_bar_hanging_positions`.

Fifteen selected YouTube IDs returned current oEmbed metadata on 2026-08-02:

- two-bar transfer: `3o0NrxeRCsk`, `FuNZG4yF1jo`, `NrC-TbmShKQ`,
  `HMGZNRRTV4s`, and `PmGur4Nfzfc`;
- Tap Swing: `SYdukm1xvEY`, `8epKPyb1e4g`, `rCe1Z0C9WnI`, `lcAyqMk4l7w`,
  and `yl2IawdA00o`;
- Lache Precision: `s0Xbm2An7W4`, `FHwls3YJ1_U`, `EDnsNRgcggo`,
  `zpVjQTemsJk`, and `4I5ZJ1-qSH0`.

That check proves metadata/embed-response health only. Migration 485 persists
them as privacy-enhanced `candidate` rows with captions, exactness, quality,
reviewer, rationale, timestamp, and approval fields null. Do not upgrade their
state without complete qualified human review of playback, exact identity,
variant, side, support, action, captions, accessibility, cue quality, safety,
conflicts, and card-version match.

### Implemented source-19 identity decision

Migration 485 separates three distinct machine-authored working identities:

1. `Two-Bar Lache Transfer to Retained Catch`, existing definition
   `abc659bf-ce3c-4b7c-a118-f2b0c761bd07`;
2. `Bar Hollow–Arch Tap Swing`, new definition
   `3018f919-8d85-4870-a1d2-ece8fd2af15e`;
3. `Lache Precision to Two-Foot Stick`, new definition
   `656028eb-c7d1-4a2f-a216-45763b201796`.

All remain machine-authored working specifications pending qualified human
review. The ambiguous legacy baseline is archived as a nonselectable source-
identity quarantine. A conservative bilateral closed-overgrip contract and
finite endpoints are explicit working constraints, not claims of a universal
standard.

Selectable exact variants and authored complexity/physical/derived-overall
scores are:

- same-height independent retained catch
  `29c4fb69-e9c3-4106-b09d-9a0732946da9`: `82 / 78 / 82`;
- higher-target independent retained catch
  `2b733b32-477c-4987-ba3b-fcd14cb183d6`: `88 / 84 / 88`;
- lower-target independent retained catch
  `53616483-e26c-4e32-90dc-1db96a7db5b0`: `86 / 82 / 86`;
- same-height coach-secured catch
  `a2f5e5c7-dcd1-4ed6-921d-60e8409a57d5`: `76 / 72 / 76`;
- bilateral-overgrip full-cycle Tap Swing
  `c0717c68-366c-4039-93e6-be44febe8978`: `68 / 64 / 68`;
- low-target bilateral two-second Lache Precision stick
  `612fc5a8-a343-4609-9463-b891ebeaf104`: `86 / 82 / 86`.

Migration assertions require 6 selectable variants, 16 delivery profiles, 48
evidence sections, 15 media candidates, 38 alternate assessments, 11 review-
only graph proposals, 12 review-only calibration proposals, 15 identity
boundaries, and 3 current test packets with exactly the four standard human
blockers each. Treat these as authored/direct-run-asserted counts until normal
runner registration and separate persisted queries reconfirm them.

Two-bar-transfer repetition contract:

- start in an active bilateral hang on the source horizontal bar with the
  target horizontal bar declared ahead in the swing plane;
- generate a controlled hollow/arch tap swing, project forward, fully release
  both hands from the source, travel without a declared turn or flip, and catch
  the target with both hands;
- completion requires retaining the two-hand target catch through a declared
  first post-catch swing checkpoint without re-release, slip, unintended
  contact, rescue, or loss of the selected assistance contract;
- continued transfers or another connected action begin a new repetition or a
  distinct sequence card.

Do not silently choose grip orientation, target geometry, clearance, bar
diameter, gap, release direction, catch checkpoint, miss/bailout method, or
assistance behavior. Declare and persist each identity-bearing constraint,
and quarantine the variant if professional evidence and controlled taxonomy do
not support a sufficiently exact value. Gap within an already validated
station range is a measured delivery scalar; higher/lower target geometry and
qualified coach-secured assistance are potential exact variants because they
materially alter trajectory, loading, logistics, and revalidation.

At minimum assess these distinct identities and do not merge them into the
two-bar transfer:

- bar Tap Swing without release;
- same-bar release and regrasp;
- Lache Precision to feet or an obstacle;
- Lache with half turn;
- release to wall/cat/arm-jump contact;
- flyaway or flipping dismount;
- simple swing dismount to feet;
- run or hop to catch the source bar before the swing;
- chained multiple transfers;
- one-arm or off-axis catch;
- Dyno, Pole Swing, Underbar, Giant, Bar Cast, and Cast to Handstand.

The user requires a separate exercise card when identity changes. Tap Swing
and Lache Precision have therefore received complete distinct working cards in
this batch. The other neighboring identities remain explicit alternate
assessments and must become distinct definitions in later batches when their
own full card contracts can be authored; do not silently merge them or treat
an alternate-assessment row as permanent completion.

### Exact next execution order

1. Run `git status --short`, `git rev-parse HEAD`, and query
   `schema_migrations` for 485. If another process registered, renumbered, or
   edited it, reconcile before touching shared files. Preserve the unrelated
   metrics diff and every concurrent Needs Engine/scheduling/class-setup edit.
2. Add
   `'485_coaching_lache_transfer_tap_swing_precision_family_audit_hardening.sql',`
   to `backend/platform/initTables.js` immediately after migration 484.
3. In
   `backend/platform/__tests__/exerciseProgrammingDifficultyOnly.test.js`, add
   a `readFileSync` constant for migration 485 and a comprehensive static test
   modeled on the source-18 family test. Pin all three definition UUIDs, all
   six variant UUIDs and score vectors, the exact identity boundaries, 16/48/
   15/38/11/12/15/3 counts, four blockers per packet, legacy skill/age removal,
   `linked_skill_id=NULL`, human-review quarantine, null media-human-review
   fields, protected-row fail-closed behavior, and the absence of athlete
   proficiency classifications or fabricated approvals.
4. Parse the registry JSON and run focused tests at minimum:

   ```sh
   node --test backend/platform/__tests__/canonicalResearchBatch.test.js \
     backend/platform/__tests__/exerciseProgrammingDifficultyOnly.test.js \
     backend/platform/__tests__/canonicalLibraryAudit.test.js
   ```

   Run focused ESLint for changed JavaScript files and `git diff --check`.
5. Recompute the migration checksum. Through the normal runner, execute and
   register exact migration 485 against disposable PostgreSQL at
   `postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip`. Confirm the stored
   checksum equals the local checksum. Rerun the normal runner to prove skip/
   re-entry, then run the exact file directly once more unchanged with
   `ON_ERROR_STOP=1`.
6. Use separate authoritative persisted queries for definition states, legacy
   exercise/safety state, each per-card evidence/media/alternate count,
   profiles, relationships, calibrations, boundaries, packets/blockers, score
   vectors, null review/approval fields, and source-baseline quarantine. Do
   not rely only on migration assertions or expected totals.
7. Rerun the persisted canonical library audit, identity detector, release
   gate, full backend suite, and production build. Record exact pass/fail/skip
   counts and existing warnings; never copy the prior checkpoint as if it were
   post-485 evidence.
8. Append the authoritative source-19 results to `COMPLETION_AUDIT.md`,
   `IDENTITY_RESOLUTION.md`, `LIBRARY_AUDIT.md`, `PRODUCTION_ROLLOUT.md`, and
   `RESEARCH_REVIEW_PROGRAM.md`. Append a new dated return entry to this file.
   Then move to the next unmigrated legacy source only if the entire 485
   checkpoint is clean. Do not report machine completeness as human approval.

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

### Return handoff — 2026-08-02 12:07 America/New_York

- Branch / HEAD: `main` /
  `aca76739fe6f3d9b4a71d00dfa5c56d541690736`. Concurrent commits renumbered
  the coaching migration to 484, registered the scheduling migration as 483,
  and fixed the scheduling TypeScript build error without changing the exercise
  family contract.
- Worktree: task-owned dirty files are the five append-only workout-generator
  audit/review documents and this handoff. The full backend test regenerated
  only `generated_at` in unrelated
  `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`; preserve it. No migration, test,
  registry, or init file is currently dirty because concurrent commits captured
  those exact task changes.
- Last registered migration / checksum: migration 484 /
  `4224855249`, registered in disposable PostgreSQL at
  `2026-08-02 12:01:33.321697-04`; stored and exact-file checksums match.
- Unregistered migration state: none. Final committed migration-484 bytes
  passed direct run 1, unchanged direct run 2, production runner, normal-
  runner skip, and exact-file direct re-entry.
- Family completed or in progress: source 18 is completed to machine-authored
  quarantine as `Handstand Snap-Down to Feet-Together Stick`, definition
  `60f5b21a-991c-4ce8-9068-3c42b2043021`; archived source baseline
  `064e650c-28e8-4820-b0da-7043bb509c2c`; wall variant
  `68c16da0-414f-4932-97f4-1d8b236af8dd`; independent variant
  `68a0499b-34b0-4621-b798-b49ffd8ed1a1`.
- Persisted family counts: 2 selectable variants, 4 profiles, 16 evidence
  sections, 4 healthy candidate media rows, 24 alternate assessments, 8
  review-only graph proposals, 4 review-only calibrations, 8 identity
  boundaries, and one current packet with exactly 4 human blockers.
- Registry version / count: `2026-08-02.86` / 368. Four new unique sources are
  USA Gymnastics compulsory Round-Off/snap-down material, Masaryk Roundoff
  technique, Masaryk didactic guidelines, and Special Olympics coaching; the
  existing CanJump source was reused.
- Global audit snapshot: 1,676/1,676 mappings, 1,043 active definitions, 92
  machine-complete, 951 machine-incomplete, 91 current healthy 3–5-media sets,
  702/0 graph review/approved, 921/0 calibration review/approved, and 0
  published definitions.
- Identity snapshot: 617/617 surfaced pairs adjudicated, 0 unresolved score-
  72-or-higher pair, and 0 exact collision.
- Release gate: expected `blocked`; 0/25 published, zero versus three approved
  depth in all seven phases, 0/10 approved graph edges, 0/3 approved
  calibration anchors, and 0/20 real coach reviews.
- Focused tests: 220/220 pass.
- Full backend: 1,019 pass, 20 intentional skips, 0 failures.
- Lint: focused ESLint, registry JSON parsing, and `git diff --check` pass.
- Build: production build passes after concurrent commit `aca7673` removed its
  unrelated unused scheduling prop. Existing baseline-browser-mapping,
  caniuse-lite freshness, and greater-than-500-kB chunk warnings remain.
- Failures and corrections: draft SQL run 1 rolled back on the prohibited
  `athleteSkillOrProficiencyClassification` key and exposed misaligned numeric
  variant tuples; the key was removed and both 22-field vectors corrected.
  Draft run 2 rolled back on uncontrolled discovery method
  `legacy_research_revalidated_by_oembed`; it became controlled
  `manual_research`. An initial focused test run failed when a concurrent
  commit renamed the untracked migration from 483 to 484; HEAD reconciliation
  showed the file and test-path correction were safely committed, then exact
  484 bytes were revalidated. The first production build failed on an
  unrelated unused scheduling prop; its owner committed the fix, and rerun
  passed.
- Human review remaining: watch all four media candidates in full and verify
  exactness/playback/captions/accessibility/quality/safety; adjudicate 24
  alternates, 8 graph proposals, 4 calibration anchors, and 8 boundaries;
  independently review content and approve publication; establish phase depth;
  run shadow generation and coach pilot; rehearse clean deployment; and prove
  staged flags, monitoring, rollback, incident, and support operations.
- Documentation updated: all five append-only audit/review documents and this
  handoff contain the source-18 completion, authoritative metrics, human gates,
  and test/build evidence.
- Exact next action: audit source 19 `Lache Swing`, definition
  `abc659bf-ce3c-4b7c-a118-f2b0c761bd07`, source baseline
  `9aedcb37-d32a-43b8-a1d1-0a653d1bcdb5`. Start with the exact DB and neighbor
  queries in `Immediate next work`; do not infer same-bar, bar-to-bar, distance,
  release, catch, terminal hang, or continued-swing identity from the legacy
  label.

### Return handoff — 2026-08-02 12:12 America/New_York

- Branch / HEAD: `main` /
  `aca76739fe6f3d9b4a71d00dfa5c56d541690736`.
- Worktree: task-owned dirty files remain the five append-only workout-
  generator audit/review documents and this handoff. Unrelated
  `docs/NEEDS_ENGINE_CATEGORY_METRICS.json` remains dirty from generated-time
  output and must be preserved. No migration, platform test, registry, or init
  file is dirty at this checkpoint.
- Last registered migration / checksum: immutable migration 484 /
  `4224855249`; stored and local checksums matched at the last authoritative
  check.
- Unregistered migration state: none. No source-19 SQL has been authored,
  executed, registered, or represented as complete.
- Family completed or in progress: source 19 `Lache Swing`, canonical
  definition `abc659bf-ce3c-4b7c-a118-f2b0c761bd07`, source baseline
  `9aedcb37-d32a-43b8-a1d1-0a653d1bcdb5`, is audited and initially researched.
  The provisional working identity is a two-bar Lache transfer to a retained
  bilateral catch; the ambiguous legacy baseline must remain a nonselectable
  identity quarantine. Exact apparatus/grip/catch/assistance constraints and
  which adjacent distinct cards are included still require resolution before
  authoring.
- Persisted family counts: current pre-migration source-19 state remains one
  incomplete source baseline, 2 skeletal profiles, 0 difficulty rows, 0
  evidence rows, 4 unreviewed legacy media rows, 0 alternates, 0 graph rows, 0
  calibration rows, 0 explicit boundaries, and 1 packet with 20 blockers.
- Registry version / count: unchanged last authoritative value
  `2026-08-02.86` / 368. Source-19 research has not yet been added.
- Global audit snapshot: unchanged last authoritative values are 1,676/1,676
  mappings, 1,043 active definitions, 92 machine-complete, 951 incomplete, 91
  current healthy three-to-five-media sets, 702/0 graph review/approved,
  921/0 calibration review/approved, and 0 published.
- Identity snapshot: unchanged last authoritative detector is 617/617 surfaced
  pairs adjudicated, 0 unresolved score-72-or-higher pair, and 0 exact
  collision.
- Release gate: unchanged expected block is 0/25 published, zero approved depth
  versus three required in all seven phases, 0/10 graph approvals, 0/3
  calibration approvals, and 0/20 real coach reviews.
- Focused tests: last completed family checkpoint remains 220/220; no
  source-19 tests exist or have run.
- Full backend: last completed checkpoint remains 1,019 pass, 20 intentional
  skips, 0 failures; do not attribute it to source 19.
- Lint: last completed family checkpoint passed; no source-19 implementation
  exists to lint.
- Build: last completed checkpoint passed with existing browser-data freshness
  and greater-than-500-kB chunk advisories; no source-19 implementation build
  has run.
- Failures and corrections: no source-19 migration failure exists because no
  SQL has been written or run. The controlled-taxonomy query was interrupted
  by the handoff request and must be rerun narrowly before SQL authorship.
- Human review remaining: the working identity and every final instruction,
  evidence application, media candidate, alternate, graph edge, calibration
  anchor, difficulty score, and publication state need qualified review. The
  four YouTube IDs have current oEmbed metadata only, not playback, exactness,
  captions, accessibility, cue quality, safety, or approval.
- Documentation updated: this handoff now contains the complete zero-context
  job instructions plus the full source-19 audit/research checkpoint and exact
  resume order. The other five audit/review documents must receive source-19
  entries only after authoritative migration/test/audit results exist.
- Exact next action: run current Git/DB and controlled-taxonomy checks, then
  resolve the exact grip, apparatus geometry, catch checkpoint, miss/bailout,
  assistance, measurement, and distinct-neighbor-card decisions described in
  `Immediate next work`; only then author the next free coaching migration.

### Return handoff — 2026-08-02 12:37 America/New_York

- Branch / HEAD: `main` /
  `aca76739fe6f3d9b4a71d00dfa5c56d541690736`.
- Worktree: source-19 task-owned changes are untracked migration 485, the
  research registry, `canonicalResearchBatch.test.js`, and this handoff. The
  five append-only workout-generator audit/review documents remain dirty from
  the prior completed source-18 checkpoint and must later receive authoritative
  source-19 results. Preserve unrelated generated
  `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`. Current `initTables.js` and
  `exerciseProgrammingDifficultyOnly.test.js` are clean because their required
  source-19 edits have not been made.
- Last registered migration / checksum: immutable migration 484 /
  `4224855249`; the last authoritative stored/local check matched.
- Unregistered migration state:
  `485_coaching_lache_transfer_tap_swing_precision_family_audit_hardening.sql`
  / current checksum `376239898`. Exact final bytes passed a direct
  `ON_ERROR_STOP=1` run and an unchanged second direct run against disposable
  PostgreSQL. It is not registered, is absent from `initTables.js`, and has no
  static family-contract test yet.
- Family completed or in progress: source 19 implementation is authored but
  not fully validated. It preserves archived baseline
  `9aedcb37-d32a-43b8-a1d1-0a653d1bcdb5` and separates `Two-Bar Lache Transfer
  to Retained Catch` (`abc659bf-ce3c-4b7c-a118-f2b0c761bd07`), `Bar Hollow–
  Arch Tap Swing` (`3018f919-8d85-4870-a1d2-ece8fd2af15e`), and `Lache
  Precision to Two-Foot Stick` (`656028eb-c7d1-4a2f-a216-45763b201796`).
- Persisted family counts: migration assertions and the successful direct runs
  prove 6 selectable exact variants, 16 profiles, 48 evidence sections, 15
  healthy candidate media rows, 38 alternate assessments, 11 review-only
  graph proposals, 12 review-only calibration proposals, 15 identity
  boundaries, and 3 packets with exactly 4 blockers. Normal-runner
  registration and separate persisted reporting are still required before
  these become the final release checkpoint.
- Registry version / count: `2026-08-02.87` / 374 parsed sources. Six new
  entries cover World Gymnastics parkour bar elements, its 2025 trick table,
  the UrbanLeap trainer handbook, horizontal-bar release identification,
  Kovacs release/regrasp biomechanics, and a parkour injury survey. The JSON
  parses; its updated test has not run.
- Global audit snapshot: do not use pre-485 metrics as post-485 proof. The last
  registered checkpoint remains 1,676/1,676 mappings, 1,043 active, 92
  machine-complete, 951 incomplete, 91 current healthy 3–5-media sets, 702/0
  graph review/approved, 921/0 calibration review/approved, and 0 published.
- Identity snapshot: last registered checkpoint remains 617/617 surfaced pairs
  adjudicated, 0 unresolved score-72-or-higher pair, and 0 exact collision.
  Rerun after normal registration.
- Release gate: last registered checkpoint remains expected `blocked`: 0/25
  published, zero approved depth versus three required in every phase, 0/10
  graph approvals, 0/3 calibration approvals, and 0/20 real coach reviews.
  Rerun after normal registration.
- Focused tests: last source-18 checkpoint was 220/220; no focused test has run
  against the current source-19 registry or migration.
- Full backend: last source-18 checkpoint was 1,019 pass, 20 intentional skips,
  0 failures; no post-485 full suite has run.
- Lint: registry JSON parsing and current `git diff --check` pass. Focused
  ESLint and source-19 static-contract validation have not run.
- Build: last source-18 production build passed with existing browser-data
  freshness and greater-than-500-kB chunk advisories; no post-485 build has
  run.
- Failures and corrections: the first SQL draft rolled back because
  calibration anchor tier 90 is uncontrolled; it became 80. The next attempt
  rolled back because Tap Swing tier 70 is uncontrolled; it became 60. A later
  final assertion rolled back despite correct 48/15/38 authored counts because
  an `unnest` alias was unqualified; it was qualified, temporary diagnostic
  notices were removed, and the exact current bytes then passed twice.
- Human review remaining: every working identity, instruction, evidence
  application, score, alternate, graph edge, calibration anchor, and boundary
  needs qualified review. All 15 videos have metadata/embed-response health
  only; playback, exactness, captions, accessibility, cue quality, safety, and
  approval remain null/quarantined. Content approval, publication, phase
  depth, clean deployment rehearsal, shadow generation, monitoring/rollback
  evidence, coach pilot, and support operations remain.
- Documentation updated: this zero-context handoff contains the current
  source-19 implementation, research, IDs, counts, failures, exact next edits,
  validation order, and return protocol. The other five documents must not
  claim source-19 completion until the post-registration evidence exists.
- Exact next action: add migration 485 immediately after 484 in
  `backend/platform/initTables.js`, add the comprehensive static contract test
  and migration constant to
  `backend/platform/__tests__/exerciseProgrammingDifficultyOnly.test.js`, then
  follow the numbered `Exact next execution order` above without skipping the
  normal runner, persisted queries, full suite, build, or docs.

### Return handoff — 2026-08-02 12:53 America/New_York

- Branch / HEAD: `main` /
  `bdbcd22d19a7f5a07f78e09419afcc445cb761b9`. Concurrent commit `bdbcd22`
  captured migrations 485–486, registry/tests/init wiring, prior handoff edits,
  and unrelated class-setup/scheduling work. Reconcile before editing because
  the shared branch can move again.
- Worktree: task-owned dirty files are the five workout-generator audit/review
  ledgers and this handoff, now appended with the final source-19 checkpoint.
  Preserve unrelated generated `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`; its
  only current diff is generated-time output from the full backend suite.
- Last registered migration / checksum: correction migration
  `486_coaching_lache_family_canonical_audit_contract_correction.sql` /
  `4213002410`, registered `2026-08-02 12:47:09.976476-04`. Family migration
  485 is immutable at `376239898`, registered
  `2026-08-02 12:39:45.047632-04`. Stored and exact-file checksums match.
- Unregistered migration state: none. Migration 485 and correction 486 each
  passed unchanged direct run 1, unchanged direct run 2, normal-runner
  registration, normal-runner skip, stored/local checksum comparison, and
  exact-file re-entry.
- Family completed or in progress: source 19 is complete to machine-authored
  quarantine as `Two-Bar Lache Transfer to Retained Catch`
  (`abc659bf-ce3c-4b7c-a118-f2b0c761bd07`), `Bar Hollow–Arch Tap Swing`
  (`3018f919-8d85-4870-a1d2-ece8fd2af15e`), and `Lache Precision to Two-Foot
  Stick` (`656028eb-c7d1-4a2f-a216-45763b201796`). Ambiguous baseline
  `9aedcb37-d32a-43b8-a1d1-0a653d1bcdb5` is archived/nonselectable.
- Persisted family counts: 6 selectable variants; 16 profiles split 11/2/3;
  48 evidence rows split 16 each; 15 healthy candidate media rows split 5
  each; 38 alternates split 18/10/10; 11 review-only relationships; 12 review-
  only calibrations split 8/2/2; 15 survivor-owned boundaries split 9/5/1;
  and 3 current canonical packets with exactly `CARD-MEDIA-01`,
  `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`.
- Registry version / count: `2026-08-02.87` / 374 parsed sources.
- Global audit snapshot: 1,676/1,676 mappings, 1,045 active definitions, 95
  machine-complete, 950 machine-incomplete, 94 current healthy embeddable
  3–5-candidate sets, 713/0 graph review/approved, 933/0 calibration
  review/approved, and 0 published definitions. All cards remain quarantined.
- Identity snapshot: 617/617 surfaced pairs adjudicated, 0 unresolved score-
  72-or-higher pair, and 0 exact collision.
- Release gate: expected `blocked`; 0/25 published, 0/3 approved depth in all
  seven phases, 0/10 approved graph edges, 0/3 approved calibration anchors,
  and 0/20 real coach reviews.
- Focused tests: 223/223 pass.
- Full backend: 1,022 pass, 20 intentional skips, 0 failures.
- Lint: focused ESLint, registry JSON parsing, and `git diff --check` pass.
- Build: production build passes; existing baseline-browser-mapping and
  caniuse-lite freshness notices plus the greater-than-500-kB Admin chunk
  advisory remain.
- Failures and corrections: migration 485 draft attempts rolled back on
  uncontrolled calibration tiers 90 and 70 and then an unqualified final-
  count alias; controlled tiers 80/60 and a qualified alias fixed them. The
  first focused test used literal UUID proximity to locate score tuples and
  was corrected to pin UUIDs separately and scores by exact variant key. The
  independent canonical audit then found missing `landingContactsPerRep` and
  new-definition `primaryIdentitySource` keys; migration 486 corrected both.
  Its first direct attempt failed closed on four historical retired media rows;
  the guard was narrowed to exact current card versions, then final bytes
  passed twice. Read-only exploratory queries twice guessed old identity-
  resolution column names and once guessed a legacy duration column; schema
  inspection corrected them without data changes.
- Human review remaining: watch all 15 media candidates fully; verify playback,
  exact definition/variant, grip, apparatus geometry, action, release/contact,
  endpoint, captions, accessibility, cue quality, safety, and conflicts;
  adjudicate all evidence, 38 alternates, 15 boundaries, 11 graph proposals,
  and 12 score anchors; independently review content and approve publication;
  establish approved phase depth; run shadow generation, clean deployment
  rehearsal, monitoring/rollback proof, support readiness, and real coach
  pilot.
- Documentation updated: all five append-only audit/review documents and this
  handoff contain the final source-19 counts, correction history, validation,
  global metrics, and human gates.
- Exact next action: source 20 `Precision Jump`, definition
  `6dc5fcf1-6383-4aed-a73b-7465384fd18b`, baseline
  `dd36d133-894b-4562-9cc7-016d1db6f56c`. It has 2 skeletal profiles, 0
  evidence, 4 unverified media IDs, 0 alternates, 1 existing relationship, 0
  calibrations, 3 adjacent identity decisions, and 20 blockers. Follow the new
  `Immediate next work` section; do not infer stance, target, distance, height,
  contact, stick duration, rebound, run-up, turn, or connection identity from
  the generic label.

### Return handoff — 2026-08-02 13:31 America/New_York

- Branch / HEAD: `main` /
  `aa20937e8793a78ba9d0fc0d3a868ca473cfbd50`. Concurrent commit `aa20937`
  captured migration 487, registry `.88`, its research/static tests, the
  initial source-20 audit documentation, and unrelated scheduling work while
  final validation was running. Reconcile again before editing.
- Worktree: task-owned dirty files are new migration 489,
  `backend/platform/initTables.js`,
  `backend/platform/__tests__/exerciseProgrammingDifficultyOnly.test.js`, the
  five workout-generator audit/review ledgers, and this handoff. Preserve the
  unrelated generated `docs/NEEDS_ENGINE_CATEGORY_METRICS.json` diff.
- Registered migrations: immutable 487 checksum `2192026862`, timestamp
  `2026-08-02 13:24:48.619779-04`; immutable 489 checksum `1326745458`,
  timestamp `2026-08-02 13:28:59.307957-04`. Both passed unchanged direct
  execution twice before registration, production-runner registration and
  skip, stored/local checksum comparison, and exact-file re-entry. Do not edit
  either; use a later corrective migration.
- Completed family: source 20 is duplicate-consolidated into `Broad Jump to
  Stick` card 3 with open and restricted-target variants. Generic source
  definition/baseline are archived. Distinct `Bilateral 360-Degree Jump to
  Stick` card 1 has open and restricted-target variants.
- Persisted family counts: 4 selectable variants; 11 review profiles split
  5/6; 32 candidate evidence rows split 16/16; 10 current healthy candidate
  media rows split 5/5; 41 alternates split 24/17; 12 migration-487 review-only
  relationships; 6 new review-only calibrations; 1 duplicate and 12 distinct
  migration-owned identity decisions; and 2 packets with exactly
  `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`.
- Difficulty vectors: no-turn open `44/48/48`, no-turn restricted
  `62/54/62`, 360 open `78/64/78`, and 360 restricted `86/68/86`, expressed
  as exercise complexity / physical difficulty / derived maximum. No exercise
  athlete level or age classification remains.
- Registry: `2026-08-02.88` / 378 parsed sources.
- Global audit: 1,676/1,676 mappings, 1,045 active definitions, 96 machine-
  complete, 949 incomplete, 95 current healthy embeddable 3–5-candidate sets,
  724/0 graph review/approved, 939/0 calibration review/approved, and 0
  published. All 1,045 cards remain quarantined.
- Identity: 626/626 surfaced score-72+ pairs adjudicated, 0 unresolved, 0 exact
  collision. The first post-487 audit surfaced six neighbors; migration 489
  closes all six distinct-action boundaries.
- Release gate: expected `blocked`; 0/25 published, 0/3 approved depth in all
  seven phases, 0/10 approved relationships, 0/3 approved calibration anchors,
  and 0/20 real coach reviews.
- Validation: focused suite 226/226; full backend 1,025 pass, 20 intentional
  skips, 0 failures; focused ESLint, registry JSON parsing, `git diff --check`,
  persisted audit, identity report, and production build pass. Build retains
  only existing baseline-browser-mapping/caniuse-lite freshness and greater-
  than-500-kB Admin chunk advisories.
- Failures and corrections: before the first SQL run, an invalid string
  `'NULL'::BIGINT` and an athlete-classification-shaped score key were removed.
  The first 487 run rolled back because the 360 alternate count was 17 while
  the stale assertion expected 16; the valid assessment was retained and the
  assertion corrected. A focused static test initially looked for one missing
  token and then for tuple-shaped JSON scores; both test defects were repaired.
  A stale packet alternate count was corrected from 16 to 17, after which final
  bytes passed twice. The audit then surfaced six similarity pairs; immutable
  489 closed them. Read-only verification queries guessed one obsolete mapping
  table and two legacy columns; schema inspection corrected the queries without
  data changes.
- Human review remaining: watch all 10 videos fully and verify playback,
  exactness, contact, target, direction/rotation, endpoint, captions,
  accessibility, quality, safety, and conflicts; adjudicate 32 evidence
  applications, 41 alternates, 13 identity decisions, 12 graph proposals, and
  all relevant score anchors; independently review content and publication;
  establish approved phase depth; run shadow generation, clean deployment
  rehearsal, monitoring/rollback/incident proof, support readiness, and a real
  coach pilot.
- Documentation updated: all five append-only workout-generator ledgers and
  this zero-context handoff contain final source-20/360 metrics, identity
  closure, test/build evidence, and remaining gates.
- Exact next action: audit source 21 `90/90 Breathing with Reach`, definition
  `0ac22398-2eed-482a-aae8-8d26ba888eaf`, using the newest `Immediate next
  work` section. Resolve the three current source variants and the erroneous
  inherited `spine_rotation` requirement before authoring; do not copy
  `age_min=6` or `is_published=true`.
