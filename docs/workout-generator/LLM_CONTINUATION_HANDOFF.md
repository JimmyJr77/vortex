# Zero-context LLM continuation handoff: canonical exercise library

Last updated: 2026-08-02 16:34 America/New_York

This document is both the complete instruction set for a replacement LLM and
the live return-handoff ledger. Give the replacement LLM this entire file. It
must read the repository state before acting, update the files identified in
the handoff section, and update the live checkpoint in this file before handing
the work back.

## Exact prompt to give the replacement LLM

> Read `/Users/jimmy_mac/Desktop/code/vortex/docs/workout-generator/LLM_CONTINUATION_HANDOFF.md`
> completely before taking any action. Treat it as your full zero-context job
> specification and live continuation ledger. Reconcile its newest checkpoint
> against the shared Git worktree and disposable PostgreSQL, preserve every
> unrelated or concurrent dirty change, and continue from the exact unfinished
> action at the end of the file. Follow every identity, evidence, media,
> migration, testing, approval-quarantine, and difficulty rule in the file.
> Before handing the work back, append actual results to all six authoritative
> ledgers named in the file, update the top `Last updated` value, and append a
> new authoritative `Return handoff` containing the exact repository/database
> state, work completed, validation evidence, remaining human gates, failures,
> dirty files, and the next executable action. Do not merely summarize the job
> or restart completed work.

This is an append-only working ledger. Historical sections intentionally remain
for traceability. The final dated continuation checkpoint at the end of this
file is the operative state and supersedes every older `Immediate next work`,
`Exact next action`, or draft-migration instruction above it. A replacement LLM
must start at the end, reconcile that checkpoint against Git and PostgreSQL,
and then use the earlier sections for the full contract and history.

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

The complete objective also includes preserving and proving the production-
quality single-workout generator built in this shared tree. For representative
inputs, the final system must demonstrate end to end:

- canonical exercise selection under user needs and hard constraints;
- cumulative fatigue, impact, contact, and downstream-interference budgets;
- equipment, space, station, staffing, setup, transition, and throughput
  logistics;
- dose and duration estimation with observable bounds;
- substitutions that rerun identity, constraint, dose, budget, duration,
  logistics, persistence, and rendering validation;
- fail-closed workout validation and actionable blocking/relaxation details;
- persistence of planned and actual output, versions, substitutions, partial
  or invalid attempts, symptoms, incidents, timing, and cumulative exposure;
- separate, understandable coach and athlete renderings plus support-operation
  context;
- production-grade tests, data-quality reporting, migration/backfill tooling,
  and documentation;
- migrations against disposable PostgreSQL, focused lint, the complete
  platform/backend suite, and a production build.

Do not regress the existing canonical-generator implementation while auditing
cards. The current family-by-family card completion loop is the immediate work;
the broader single-workout proof must remain green at each verified checkpoint.
Machine-authored completeness is necessary but is not publication or rollout
approval. Human content/media/graph/calibration review, pilot evidence,
deployment rehearsal, monitoring, rollback, incident handling, and support
readiness remain separate production gates.

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

Source 21 is complete to machine-authored quarantine through immutable
migration 490. The active next family is legacy source 22, `Crocodile
Breathing`. Follow the newest `Immediate next work` section below.

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

## Immediate next work: source 22 Crocodile Breathing

Source 21 is complete to machine-authored quarantine through immutable
migration 490. Do not edit the registered SQL; use a later correction
migration if new evidence exposes a defect. The exact final source-21
checkpoint is:

- migration filename/checksum/registration:
  `490_coaching_9090_breathing_family_audit_hardening.sql` / `3490270351` /
  `2026-08-02 14:24:10.627994-04`;
- unchanged direct run 1, unchanged direct run 2, normal-runner registration,
  stored/local checksum comparison, normal-runner skip, and exact-file
  re-entry all passed;
- 3 current definitions, 4 variants, 8 profiles, 48 evidence rows, 15 healthy
  candidate media rows, 58 alternates, 20 migration-owned identity decisions,
  10 review-only graph rows, 8 review-only calibrations, and 3 packets with
  only the four standard human blockers;
- registry `2026-08-02.89` / 383 sources; focused `228/228`; full backend
  1,030 pass plus 20 intentional skips; focused lint, ten JSON parses, diff
  integrity, persisted audit, identity report, and production build pass;
- global state: 1,676/1,676 mappings, 1,047 active definitions, 99 machine-
  complete, 948 incomplete, 98 healthy current 3–5-media sets, 627/627
  adjudicated surfaced pairs, zero unresolved pair, zero exact collision,
  734/0 graph review/approved, 947/0 calibration review/approved, and 0
  published;
- release correctly remains blocked at 0/25 published, 0/3 approved depth in
  all seven phases, 0/10 approved relationships, 0/3 approved calibration
  anchors, and 0/20 real coach reviews.

All five append-only audit/review ledgers contain this final source-21 state.
The production build initially exposed a concurrently committed type mismatch
in class-setup copy/paste. The narrow type-only repair changes
`ClassSetupOverviewRow.effectiveCostUnit` from arbitrary `string` to the
existing `CostUnit` union; it passes focused ESLint and the build and does not
change runtime pricing behavior.

### Source-22 baseline audit

Legacy source 22 is:

- ID/name/slug: `22 | Crocodile Breathing | crocodile-breathing`;
- description: `Lie face down with forehead supported and breathe into the
  floor without shrugging or forcing air into the chest.`;
- canonical definition:
  `2e308a8e-6a1d-48d4-b095-fe3dd18803d8`, card version 1, schema 1.0.0,
  status `review`;
- skeletal baseline variant:
  `42909b84-690a-45b5-908a-c085196d1141`;
- current legacy defaults: 1 set, 5 reps, 45 work seconds, 0 rest, 60 estimated
  seconds; unsupported `age_min=6` and `is_published=true` remain and must not
  be copied automatically; exercise skill and linked-skill values are null;
- current legacy score: complexity `20`, physical/load `10`, derived overall
  `20`, coordination `20`, with impact and supervision absent; these are not
  independently calibrated;
- current safety: risk 1, impact 0, no spotting, optional coach supervision,
  null minimum age/skill, generic trunk-bracing readiness/stop language, and
  substitutions that have not been identity-revalidated;
- definition taxonomy, anatomy, constraints, athlete support, coach support,
  support operations, load, fatigue, and programming objects are empty;
- current scope: 1 skeletal variant, 2 skeletal profiles, 0 evidence rows, 4
  unverified legacy media rows, 0 alternate assessments, 2 preexisting
  review-only relationships (1 outgoing and 1 incoming), 0 calibrations, and
  1 audit packet with 20 blockers;
- three new source-21 machine boundaries already distinguish it from supported
  90/90 reach, hands-on-ribs lateral expansion, and hip-lift/ball/balloon.

The two profiles are `legacy-prepare_and_access` and `legacy-restore`. Their
timing/scaling/measurement/support/logistics objects are empty and their coach
language contains unrelated generic bracing, rib-flare, lumbar-sag, and
conditioning claims. Reauthor them from the exact Crocodile repetition rather
than copying that template.

### Source-22 research already completed

1. Functional Movement Systems' current `Crocodile Breathing` exercise page is
   direct technique evidence. It specifies prone position, forehead on stacked
   hands, relaxed chest/arms/neck, slow nasal inhale with abdominal contact
   against the floor, slow nasal exhale, and an optional short-pause cadence.
   The exact cadence must be a delivery decision; it is not a universal safety
   or identity rule.
2. Functional Movement Systems' `Take A Deep Breath` article supplies detailed
   professional instruction and alternate assessment: remain flat rather than
   posted on elbows; use anterior ribs/chest contact; optionally use a lower-
   leg bolster for comfort; do not force an uncomfortable prone position;
   obtain permission before coach touch; and treat coach hands, light cuff
   weights, or a light elastic band as tactile feedback rather than restraint.
   Its movement-screen anecdotes and suggested breath counts do not establish
   universal outcomes, dose, diagnosis, or numeric difficulty.
3. Aliverti et al., `Compartmental analysis of breathing in the supine and
   prone positions by optoelectronic plethysmography`, DOI
   `10.1114/1.1332084`, is adjacent position/chest-wall-kinematics evidence. It
   does not validate the named exercise, cueing, outcome, eligibility, or
   dose.
4. Reuse the registered VA diaphragmatic-breathing source and the 2026
   systematic review PMID `41482169` only for their general instruction and
   heterogeneous evidence/limitations. Reuse YouTube oEmbed documentation only
   for candidate metadata provenance.
5. Hooklying diaphragmatic breathing changes orientation and floor-feedback
   contact and remains a distinct definition, not a Crocodile variant. A
   lower-leg bolster, consented coach tactile feedback, cuff-weight feedback,
   and light elastic-band feedback retain the prone breath-cycle identity but
   change support, assistance, load, or equipment and require explicit variant
   versus delivery decisions. Posting on elbows, adding trunk/limb motion,
   loaded respiratory training, prone press-up/Cobra, Crocodile rocking, and
   prescribed Box-Breath holds must not be silently merged.
6. The working identity disposition retains one `Crocodile Breathing`
   definition and proposes three exact selectable variants: flat prone with
   stacked hands and no external feedback; prone with a lower-leg bolster;
   and prone with a light elastic band used only as lateral tactile feedback.
   Consented light coach touch, optional pauses, cadence, and dose remain
   delivery annotations. Cuff-weight feedback is quarantined as a potential
   future variant because device, mass, placement, migration, and safety are
   underspecified. Hooklying breathing, 90/90 breathing, Box Breath, Med Ball
   Belly breathing, Makarasana as variably taught, elbow-posted prone work,
   Crocodile Rocking, prone press-up/Cobra, and prone swimmer/YTW actions stay
   distinct cards.
7. The controlled-taxonomy audit found existing `breath` and `brace` movement
   keys; `core`, `spine`, and `thoracic_spine` body-region keys; and `none`,
   `mat`, and `bands` equipment keys. The migration must add a controlled
   `bolster` equipment key before using it. Do not invent a cuff-weight
   equipment variant in this checkpoint.
8. The proposed exercise difficulty vectors are flat `18/4/18`, bolster
   `20/3/20`, and band feedback `24/5/24`, expressed as complexity / physical
   difficulty / derived maximum. They are candidate calibration judgments,
   not athlete skill or proficiency levels, and remain review-only.

Six current YouTube IDs returned healthy oEmbed metadata on 2026-08-02:
`2mCwbWPtICI`, `76-Sw5nZ2YI`, `_8f9RHUfE1Q`, `aimIzymb81E`, `XhYrGbEI2c8`,
and `AeqR_Dne9w0`. Select three to five after card-specific assessment; a
reasonable initial five are the four legacy candidates plus `XhYrGbEI2c8`,
with `AeqR_Dne9w0` retained as an alternate assessment. oEmbed proves only
current title/channel/thumbnail/embed-response metadata. Playback, full-video
exactness, captions, accessibility, cue quality, safety, conflicts, reviewer
identity, and approval remain unverified and must stay null/quarantined.

The source-22 research artifacts are now encoded:

- `scripts/data/canonical-research/source-registry.v1.json` is version
  `2026-08-02.90` with 386 registered sources. The three new sources are the
  direct FMS exercise page, the FMS detailed breathing article, and Aliverti
  et al. prone/supine chest-wall kinematics research.
- `scripts/data/canonical-research/batches/crocodile-breathing.v1.json` is the
  authored batch. Its generated artifacts are in
  `scripts/data/canonical-research/generated/crocodile-breathing/`.
- The generated packet contains 16 card-section evidence rows, 5 candidate
  media rows, and 20 alternate assessments. Batch validation and write passed
  against disposable PostgreSQL after correcting the difficulty proposal to
  include the required top-level baseline score plus nested per-variant score
  proposals.
- `backend/platform/__tests__/canonicalResearchBatch.test.js` now pins
  registry `.90` / 386 and checks the Crocodile source quality, evidence,
  media, alternates, proposed variants, distinct Hooklying boundary, derived
  maxima, and absence of athlete age/skill/proficiency classification. The
  research test file passes 75/75. The existing 90/90 batch correctly remains
  at research version `.89`.

### Exact source-22 next execution order

1. Reconcile `HEAD`, `git status`, migration filenames, and disposable
   `schema_migrations`; migration 491 was free at this checkpoint but must be
   rechecked because the repository is shared.
2. Recheck the controlled taxonomy, two preexisting review relationships,
   legacy phase/dose/readiness rows, and adjacent definition UUIDs against the
   current shared database before encoding the already-decided identity
   boundaries. Do not repeat the completed broad audit or research.
3. Author the next free idempotent migration with protected-record guards,
   complete taxonomy/anatomy/difficulty/load/fatigue/constraints/profiles/
   support/persistence content, alternate decisions, review-only graph and
   complexity/physical calibration proposals, legacy age/publication cleanup,
   and one packet containing only the four standard human blockers. The
   intended shape is 1 definition at card/schema version 2, the retired
   skeletal baseline, 3 selectable exact variants, 6 prepare/restore profiles,
   16 evidence rows, 5 media candidates, 20 alternates, 6 complexity/physical
   calibration rows, explicit identity decisions, and review-only
   substitution/equipment-equivalent edges. Assert actual persisted counts.
4. Run the final exact SQL directly twice against disposable PostgreSQL, query
   persisted invariants, add init/static/research tests, and pass focused lint,
   JSON parsing, focused tests, and `git diff --check` before registration.
5. Register with the normal runner, verify checksum and skip, re-enter the exact
   immutable file, run persisted audit/identity/expected-blocked release checks,
   full backend, and production build, then append actual results to all six
   ledgers before selecting source 23.

### Current return handoff — 2026-08-02 14:39 America/New_York

- Branch / HEAD: `main` /
  `f5621272a621c6a39e9d4734377b541e71a70a37`, matching `origin/main`.
- Registered state: migration 490 is immutable at `3490270351`; no source-22
  migration has been created, executed, wired, registered, or represented as
  complete.
- Source-21 task-owned dirty files are migration 490, its init/static/research
  wiring, corrected/generated 90/90 batches, registry `.89`, all six workout-
  generator ledgers, and the new dedicated breathing-family batch/output.
- `src/utils/classSetupOverviewApi.ts` contains the narrow type-only build
  repair described above. `docs/NEEDS_ENGINE_CATEGORY_METRICS.json` changed
  only because the full backend suite refreshed generated-time output; preserve
  it and do not attribute it to source 22.
- Source-22 task-owned changes now include registry `.90` / 386, the authored
  Crocodile batch, generated packet, and research-test coverage. The generated
  packet contains 16 evidence sections, 5 media candidates, and 20 alternate
  assessments; the research test file passes 75/75. No source-22 migration has
  been authored, executed, wired, or registered.
- The current source-22 worktree also contains the source-21 files listed
  above; preserve all of them. The newly added source-22 paths are
  `scripts/data/canonical-research/batches/crocodile-breathing.v1.json` and
  `scripts/data/canonical-research/generated/crocodile-breathing/`, plus
  source-22 edits within the shared registry, research test, and this handoff.
- Exact next action: recheck that migration number 491 remains free, then
  author `backend/migrations/491_coaching_crocodile_breathing_family_audit_hardening.sql`
  from the finalized three-variant identity plan. Use generated UUIDs
  `a041a9a6-a61a-4d14-9969-5eba23fe94fb` (flat),
  `d729bed4-7a61-401e-9e0d-cc0da73cd35e` (bolster), and
  `08396682-5289-4b8c-a9f1-715a56681198` (band) unless a current collision
  check fails. Do not mutate registered migration 490.

## Completed source-21 working record (historical; superseded by the checkpoint above)

Sources 20 and its six newly surfaced similarity neighbors are complete to
machine-authored quarantine through immutable migrations 487 and 489. Do not
edit either registered file. Source 21 has now been audited and researched,
and migration 490 is partially authored. Resume that draft; do not repeat the
audit or restart the migration.

### Current source-21 findings and identity decisions

- Legacy source 21 is `90/90 Breathing with Reach`; its text specifies supine
  feet on a wall, bench, or box; hips and knees near 90 degrees; neutral neck;
  arms toward the ceiling/slightly forward; nasal inhale with lower-rib and
  abdominal expansion; and a slow full exhale without crunching.
- Legacy source 656, `90/90 Breathing with Reach — Mobility`, is materially the
  same reach identity and is a duplicate-consolidation source.
- Legacy source 1404, `90/90 Breathing with Hip Reset`, is too vague to resolve.
  It omits the support, heel-pressure, hip-lift, pelvic-shift, reach,
  ball/balloon, breath-cycle, and valid-completion contract. Keep its source
  variant archived and nonselectable, and change its identity disposition to
  `needs_human_review`; do not guess that it is the ball-and-balloon exercise.
- The surviving reach definition is
  `0ac22398-2eed-482a-aae8-8d26ba888eaf` with two exact variants: bilateral
  reach with feet on a wall, and bilateral reach with the lower legs fully
  supported on a stable bench/box. Neither includes heel pull or hip lift.
- Create a distinct research-authored card, `90/90 Wall-Supported Breathing
  with Lateral Expansion`, for the no-reach, hands-on-lateral-ribs contract.
- Create a distinct research-authored card, `90/90 Hip Lift with Ball and
  Balloon`, for heel pull, small hip lift, ball squeeze, unilateral arm/balloon
  behavior, and its separate breath-cycle contract.
- The inherited `spine_rotation` and shoulder-flexion requirements are not
  supported by the reach source description and must not survive as automatic
  movement requirements.
- Null every exercise-card age, skill/proficiency, and linked-skill
  classification inherited from the legacy rows. Source 21's `age_min=6` and
  all three legacy publication flags are unsupported; all remain unpublished.
- Draft difficulty vectors are complexity / physical / derived maximum:
  reach-wall `26/8/26`, fully-supported reach `22/5/22`, lateral-expansion
  `16/4/16`, and ball-and-balloon `48/20/48`.

The original active skeletal variants are baseline
`cb077d9c-261b-4944-8f3e-6109491c73cd`, source-656
`329f2581-c1b7-4c2b-8a71-8c5c34a59cb1`, and source-1404
`4276c5c7-19d9-4cfc-830f-fb6482b3430c`. The old duplicate definitions are
`3cc260a4-c61c-43bf-abbe-167db83f8814` for source 656 and
`d65d13d0-135c-4593-8de1-fdcd9e057dc0` for source 1404. Archive these rows;
do not delete lineage.

### Current migration-490 draft

The unregistered working file is:

`backend/migrations/490_coaching_9090_breathing_family_audit_hardening.sql`

The SQL authorship is now complete, but the file remains mutable and
unregistered. Do not register it until the one remaining focused static-test
failure is repaired and all focused checks pass. The migration contains
fail-closed guards, controlled taxonomy, lineage/archive operations, three
definitions, four variants, eight delivery profiles, 48 evidence rows, 15
candidate-media rows, alternate assessments, identity boundaries, ten
review-only graph proposals, eight review-only calibration proposals, legacy
cleanup, three quarantined card packets, and final assertions. The
`IDENTITY_GRAPH_CALIBRATION`, `LEGACY_AND_PACKETS`, and `FINAL_ASSERTIONS`
sections are complete.

The exact current local SQL checksum is `3490270351`. The exact SQL bytes
passed a direct `ON_ERROR_STOP=1` run and an unchanged second direct run against
disposable PostgreSQL. Migration 490 is still absent from `schema_migrations`;
it is wired into `backend/platform/initTables.js` but has not passed the normal
runner, registration/skip, stored-checksum comparison, or registered-file
re-entry. Treat the file as mutable until registration and immutable afterward.

Draft UUIDs are:

- lateral-expansion definition:
  `b366c4d4-d75e-4902-915c-4b363e6b6238`;
- ball-and-balloon definition:
  `96d4d5fe-1ad1-4930-9c74-2054764d0c6c`;
- reach-wall variant: `4193b7da-09de-4558-b7a1-1ac9440d19eb`;
- fully-supported reach variant: `e9384c20-f26f-4a12-b9ba-913be80b2d82`;
- lateral-expansion variant: `b5719ed0-5d31-4030-9c11-7ea81aabe254`;
- ball-and-balloon variant: `d4393550-a0b4-485a-8b99-e6bb1b7e71f3`.

Draft profile UUIDs are `02032b70` (reach-wall preparation), `eb20f202`
(reach-wall restoration), `a6752d37` (supported-reach preparation),
`a38d4472` (supported-reach restoration), `f83241ae` (lateral preparation),
`2c3640e1` (lateral restoration), `c68a393a` (balloon preparation), and
`9ca464ff` (balloon restoration); use the full IDs already declared in the SQL.

The direct-run database state persisted one selected source for each of 16
sections on each of the three cards: 48 candidate evidence rows backed by eight
source families. The persisted family totals are 3 definitions, 4 selectable
variants, 8 delivery profiles, 48 evidence rows, 15 candidate-media rows, 58
alternate assessments, 10 review-only graph proposals, 8 review-only
calibration proposals, 20 migration-owned identity rows (18 distinct, 1
duplicate consolidation, and 1 needs-human-review quarantine), and 3 current
packets with exactly the four standard human blockers. Requery after normal
registration and use that output, not these expected checkpoint values, in the
final audit ledgers. The exactness/general evidence set is:

- Functional Movement Systems, `90/90 Breathing with Lateral Expansion`;
- U.S. Department of Veterans Affairs diaphragmatic-breathing instructions;
- 2018 systematic review of slow-breathing psychophysiology, PMID `30245619`;
- 2026 diaphragmatic-breathing systematic review, PMID `41482169`, including
  its heterogeneity, bias, and safety-reporting limitations;
- diaphragm postural-task MRI study, PMID `20705944`, as indirect evidence;
- Boyle et al. clinical suggestion for the 90/90 bridge with ball and balloon,
  PMCID `PMC2971640`, not outcome validation;
- current ACOG guidance restricting prolonged supine exercise after 20 weeks
  of pregnancy;
- YouTube embed/oEmbed documentation only for candidate-link provenance.

There are five metadata-healthy YouTube candidates per definition. These IDs
have oEmbed metadata only; playback, full-video exactness, captions,
accessibility, cue quality, safety, and approval remain unverified and null:

- reach: `GZ6X2M6gRvQ`, `O-cf22YQzAg`, `QN77knnBw8o`, `yFGJI00OZ8k`,
  `kA6AtZkDxmg`;
- no-reach lateral expansion: `AnvRX080sR4`, `V6Zrlo5w7oY`, `xzzJgFbgexc`,
  `K2wKibekVbA`, `8UAOFVQIqYQ`;
- ball and balloon: `4GoqjoEXaAw`, `zL1Hmkt7aJA`, `lcZp3gEz5_s`,
  `U1AG5y81VcQ`, `-zxaq9lANYg`.

The research registry is now `2026-08-02.89` / 383 parsed sources. It adds FMS
90/90 lateral-expansion instruction, the 2026 diaphragmatic-breathing review,
the diaphragm postural-function MRI study, Boyle's 90/90 hip-lift-with-balloon
clinical suggestion, and current ACOG pregnancy/postpartum guidance; it reuses
the existing VA, 2018 slow-breathing review, and YouTube provenance entries.

The mixed batch
`scripts/data/canonical-research/batches/9090-shin-box-foundations.v1.json` is
corrected so all 16 reach-card evidence sections are card-specific and no
shin-box evidence pollutes the reach card. It now contains 5 reach candidates,
classifies the ambiguous Hip Reset source as rejected/quarantined, and does not
create a new reach definition. Its generated packets and manifest were
regenerated. A dedicated new-card batch exists at
`scripts/data/canonical-research/batches/9090-breathing-family.v1.json`; its
generated output is under
`scripts/data/canonical-research/generated/9090-breathing-family/`. Both
batches passed dry-run validation and generation. The new registry and batch
test passes inside the focused suite.

### Exact next execution order

1. Reconcile `HEAD`, `git status`, migration filenames, and the disposable
   ledger again. Preserve all concurrent work.
2. Repair the only currently failing focused assertion in
   `backend/platform/__tests__/exerciseProgrammingDifficultyOnly.test.js`.
   The lower-leg-supported variant's actual tuple begins
   `22,5,3,12,12,22`; the test incorrectly expects `22,5,4,12,12,22` at the
   `reach_support_variant` regex. This is a test expectation defect, not a
   persisted SQL defect. Confirm the remaining source-21 assertions rather
   than weakening them.
3. Rerun the focused three-file suite. The last run was 227/228: every research
   test, the canonical audit tests, and all other static migration tests passed;
   only the tuple assertion above failed. Continue until the suite is entirely
   green.
4. Run focused ESLint on the changed JavaScript files, parse every changed JSON
   file, and run `git diff --check`. Recompute the exact checksum if the SQL
   changes; if any SQL byte changes, directly execute the new exact bytes twice
   and requery persisted invariants before continuing.
5. Register migration 490 with the normal runner against disposable
   PostgreSQL, verify the stored checksum equals the exact local checksum, run
   the normal runner again to prove a clean skip, then directly re-enter the
   exact registered file. Never edit migration 490 after this point; use a new
   correction migration if a defect appears.
6. Run the persisted canonical audit, identity queue report, and
   expected-blocked release check. Resolve any newly surfaced direct identity
   collision or unresolved score-72-or-higher pair before calling the family
   checkpoint complete.
7. Run the full backend suite, production build, focused lint, JSON checks, and
   final diff-integrity check. Preserve unrelated dirty work and record all
   intentional skips and existing warnings accurately.
8. Append actual post-registration results to all five audit/review ledgers and
   add a new dated return handoff here. Only then select the next
   machine-incomplete source family.

### Current worktree and database checkpoint

As of this update, branch `main` is at
`f5621272a621c6a39e9d4734377b541e71a70a37`, matching `origin/main`.
Concurrent class-setup/Admin pricing work was captured by that shared commit;
do not revert or rewrite it. Recheck status because the shared branch and
worktree can move while work is in progress.

The task-owned dirty files are:

- `backend/migrations/490_coaching_9090_breathing_family_audit_hardening.sql`;
- `backend/platform/initTables.js`;
- `backend/platform/__tests__/canonicalResearchBatch.test.js`;
- `backend/platform/__tests__/exerciseProgrammingDifficultyOnly.test.js`;
- `scripts/data/canonical-research/source-registry.v1.json`;
- `scripts/data/canonical-research/batches/9090-shin-box-foundations.v1.json`;
- the regenerated mixed-batch files under
  `scripts/data/canonical-research/generated/`;
- untracked `scripts/data/canonical-research/batches/9090-breathing-family.v1.json`;
- untracked generated directory
  `scripts/data/canonical-research/generated/9090-breathing-family/`;
- this handoff after the present update.

The disposable database is
`postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip`. Its latest registered
exercise migrations are immutable 487 (`2192026862`, registered
`2026-08-02 13:24:48.619779-04`) and 489 (`1326745458`, registered
`2026-08-02 13:28:59.307957-04`). Migration 490 is absent from
`schema_migrations`. Its current exact SQL bytes passed direct execution twice
and persisted family assertions, but normal-runner registration, stored-
checksum proof, post-registration audits, the completely green focused suite,
focused lint, full backend suite, and production build remain outstanding.

Also preserve the concurrent Needs Engine behavior already implemented in the
shared history: full equipment coverage is enforced only for `must_use`;
`use_only` remains an allow-list. Do not regress its structured
`PrescriptionError` details or blocking/suggested-relaxation UI.

### Required return-handoff template

Before yielding this work to any other LLM or back to the original agent,
append a dated `Return handoff` section to this file. It must include:

- branch, exact `HEAD`, `origin/main` relationship, and exact `git status`;
- task-owned versus unrelated/concurrent dirty files and preservation notes;
- last registered migration, timestamp, stored checksum, local checksum, and
  whether direct run 1, unchanged run 2, normal-runner registration/skip, and
  exact-file re-entry each passed;
- family/card names, all stable definition/variant IDs, archived/quarantined
  source identities, difficulty vectors, and exact persisted row counts;
- registry version/count and every source added, removed, or corrected;
- global audit, identity, graph/calibration, media-coverage, and publication
  totals from actual commands;
- release-gate result and every remaining human/pilot/rollout blocker;
- focused tests, lint, JSON checks, diff checks, full backend suite, build, and
  any intentional skips or pre-existing warnings;
- every failed attempt, its exact cause, whether it rolled back, and the repair;
- documents updated, incomplete edits, and one exact next action.

Never write `complete`, `approved`, `verified`, or `production ready` without
the corresponding persisted or qualified-human evidence. If work stops while
490 is still mutable, state exactly which marker or assertion is next and do
not report draft counts as persisted counts.

### Return handoff — 2026-08-02 14:22 America/New_York

- Branch / HEAD: `main` /
  `f5621272a621c6a39e9d4734377b541e71a70a37`, exactly matching
  `origin/main` at this checkpoint. The shared branch can move; reconcile it
  before editing.
- Worktree: the exact task-owned modified/untracked set is listed in `Current
  worktree and database checkpoint` above. It consists only of migration 490,
  its init/test/research wiring, corrected/generated 90/90 research files, the
  new dedicated breathing batch/output, and this handoff. Preserve all
  concurrently committed class-setup work and the Needs Engine `must_use`
  versus `use_only` behavior.
- Last registered exercise migrations: immutable 487 / `2192026862` /
  `2026-08-02 13:24:48.619779-04` and immutable 489 / `1326745458` /
  `2026-08-02 13:28:59.307957-04`. Migration 490 is unregistered. Its current
  local checksum is `3490270351`; direct run 1 and unchanged direct run 2
  passed, but normal-runner registration, skip, stored-checksum comparison,
  and registered exact-file re-entry have not occurred.
- Family state: source 21 `90/90 Breathing with Reach` survives as definition
  `0ac22398-2eed-482a-aae8-8d26ba888eaf` with wall-reach variant
  `4193b7da-09de-4558-b7a1-1ac9440d19eb` at `26/8/26` and fully supported
  variant `e9384c20-f26f-4a12-b9ba-913be80b2d82` at `22/5/22`.
  Research-authored lateral-expansion definition
  `b366c4d4-d75e-4902-915c-4b363e6b6238` has variant
  `b5719ed0-5d31-4030-9c11-7ea81aabe254` at `16/4/16`. Research-authored
  ball-and-balloon definition `96d4d5fe-1ad1-4930-9c74-2054764d0c6c` has
  variant `d4393550-a0b4-485a-8b99-e6bb1b7e71f3` at `48/20/48`. Values are
  complexity / physical difficulty / derived maximum; no athlete skill or age
  level is authored.
- Legacy identity: source 656 is duplicate-consolidated to the reach card.
  Source 1404 remains archived, nonselectable, and `needs_human_review` because
  `90/90 Breathing with Hip Reset` does not specify enough mechanics to merge
  with the reach or ball-and-balloon identity. Legacy age, skill/proficiency,
  linked-skill, and publication fields are cleared; the old duplicate/source
  rows remain as lineage rather than being deleted.
- Direct-run persisted family counts: 3 definitions, 4 variants, 8 profiles,
  48 evidence rows, 15 candidate-media rows, 58 alternates, 10 review-only
  graph proposals, 8 review-only calibration proposals, 20 migration-owned
  identity decisions, and 3 packets with exactly `CARD-MEDIA-01`,
  `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Requery after
  registration before recording final metrics.
- Research: registry `2026-08-02.89` contains 383 sources. Five source families
  were added: FMS lateral-expansion instructions, the 2026 diaphragmatic-
  breathing review, diaphragm postural-function MRI research, Boyle's
  ball-and-balloon clinical suggestion, and ACOG guidance. The mixed
  90/90/shin-box batch was corrected and regenerated; the dedicated breathing-
  family batch and generated output were added. Both generation passes and
  the new research tests succeeded.
- Validation: the current focused run is 227/228. All research-batch and
  canonical-audit coverage passed. The only failure is the new static regex
  expecting `22,5,4,12,12,22`; the SQL correctly contains
  `22,5,3,12,12,22`. Focused lint, final JSON checks, full backend suite,
  production build, post-registration audit, identity detector, and release
  check have not run for source 21. `git diff --check` passes at this handoff.
- Failures and repairs: early direct SQL attempts rolled back transactionally
  for missing delivery-profile fields, a nonexistent safety `updated_at`
  column, an invalid zero legacy-impact value, a missing canonical
  `physicalDifficulty` value, a too-short coach instruction, and the wrong
  `spine_rotation` action key. Each was repaired, temporary diagnostics were
  removed, and final unchanged SQL passed twice. The first focused run exposed
  a parenthesis-sensitive token-regex defect and was repaired. The second
  focused run exposed only the tuple-expectation defect described above.
- Global state: no source-21 post-registration audit exists yet. The last
  authoritative source-20 snapshot remains 1,676/1,676 mappings, 1,045 active,
  96 machine-complete, 949 incomplete, 95 healthy current 3–5-media sets,
  626/626 adjudicated surfaced pairs, zero unresolved, zero direct collision,
  724/0 graph review/approved, 939/0 calibration review/approved, and 0
  published. Do not label expected source-21 deltas as results.
- Release/human gates: the last release check was correctly blocked at 0/25
  published definitions, 0/3 approved depth in every required phase, 0/10
  approved relationships, 0/3 approved calibration anchors, and 0/20 real
  coach reviews. All 15 source-21 YouTube records have metadata/embed-response
  health only. Full playback, exactness, captions, accessibility, cue quality,
  safety, conflicts, content/graph/calibration/media/publication approval,
  pilot evidence, deployment rehearsal, monitoring, rollback, incidents, and
  support readiness remain quarantined human/rollout work.
- Documentation: only this zero-context handoff has been updated for the
  current source-21 in-progress checkpoint. Append to the other five audit and
  review ledgers only after registration and authoritative audits/tests/build.
- Exact next action: change the supported-variant static expectation in
  `backend/platform/__tests__/exerciseProgrammingDifficultyOnly.test.js` from
  `22,5,4,12,12,22` to `22,5,3,12,12,22`, rerun the focused suite, and then
  follow the numbered `Exact next execution order` without skipping checksum,
  registration, persisted audits, full validation, or documentation.

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

### Return handoff — 2026-08-02 15:08 America/New_York

- Branch / HEAD: `main` / `f5621272a621c6a39e9d4734377b541e71a70a37` at
  the last reconciliation. Recheck before editing because this is a shared
  dirty worktree and concurrent commits can move the branch.
- Preserve concurrent work: do not revert the Needs Engine `use_only` versus
  `must_use` equipment fix, typed PrescriptionError response/display changes,
  generated `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`, source-21 work,
  `src/utils/classSetupOverviewApi.ts`, or any unrelated dirty files.
- Registered immutable migrations: source-21 migration 490 checksum
  `3490270351`; source-22 migration 491 checksum `1519177130`, registered
  `2026-08-02 14:52:25.126422-04`; score-floor correction 492 checksum
  `763304095`, registered `2026-08-02 14:55:22.298379-04`. Never edit a
  registered migration; use the next free migration for corrections.
- Source 22 is complete to machine-authored quarantine as `Crocodile
  Breathing` (`2e308a8e-6a1d-48d4-b095-fe3dd18803d8`) with flat
  (`a041a9a6-a61a-4d14-9969-5eba23fe94fb`, `18/4/18`), lower-leg bolster
  (`d729bed4-7a61-401e-9e0d-cc0da73cd35e`, `20/3/20`), and light band-feedback
  (`08396682-5289-4b8c-a9f1-715a56681198`, `24/5/24`) variants. The old
  baseline is archived/nonselectable.
- Persisted family counts: 3 selectable variants, 6 contextual profiles, 16
  evidence rows, 5 current healthy media candidates, 20 alternates, 8 review-
  only graph rows, 6 review-only calibrations, 6 migration-owned identity
  boundaries plus 3 pre-existing 90/90 boundaries, and 1 current packet with
  exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`.
- Registry: current `2026-08-02.91` / 390 parsed sources; the source-22 batch
  itself remains reproducibly pinned to `.90`. Source-22 batch and generated
  packet live under `scripts/data/canonical-research/batches/crocodile-
  breathing.v1.json` and `scripts/data/canonical-research/generated/crocodile-
  breathing/`.
- Global audit: 1,676/1,676 mappings; 1,047 active definitions; 100 machine-
  complete and 947 incomplete cards; 99 current healthy embeddable media sets;
  740/0 graph review/approved; 953/0 calibration review/approved; and zero
  published. All 1,047 remain quarantined.
- Identity: 628/628 surfaced score-72-or-higher pairs adjudicated, zero
  unresolved pair, and zero exact collision.
- Release: expected `blocked`; 0/25 published, zero approved depth in all seven
  phases, 0/10 approved graph edges, 0/3 approved calibration anchors, and
  0/20 real coach reviews. These are genuine human/rollout gates, not failed
  automated authorship.
- Validation: focused suite 231/231; full backend 1,033 pass, 20 intentional
  skips, 0 failures; focused ESLint, changed-JSON parsing, `git diff --check`,
  persisted audit, identity report, and production build pass. Build retains
  only existing browser-data freshness and greater-than-500-kB Admin chunk
  advisories.
- Failures/corrections: migration 491 drafts rolled back on a missing values
  alias, missing delivery column, legacy impact score 0, and legacy difficulty
  load 0.5; each was corrected before registration. The post-registration
  canonical audit then rejected `impactAccumulation=0` on the 1–100 score
  scale. Immutable correction 492 sets impact and impact accumulation to the
  valid floor 1 while preserving no-impact class and zero contacts. A draft
  492 run also rolled back on an ambiguous PL/pgSQL variable and was corrected
  before registration. No approval state changed.
- Human review remaining: watch all five videos fully; verify playback,
  exactness, variant, support/feedback, breath cycle, captions, accessibility,
  cue quality, safety, conflicts, and reviewer/version data; adjudicate
  evidence, alternates, identity boundaries, graph proposals, and score
  anchors; independently review content and publication; establish approved
  phase depth; then run shadow generation, clean deployment rehearsal,
  monitoring/rollback/incident proof, support readiness, and a real coach
  pilot.
- Next family baseline audit and research packet are complete: source 23
  `Full-Body Joint CARs Flow`,
  definition `c6e2b1c7-e42f-47b6-ac34-2549b32f8dd3`, baseline variant
  `f4b3acdd-8a11-48d1-a061-c3dcd859f215`. It currently has schema/card v1,
  empty controlled taxonomy/anatomy/support/load/fatigue/programming data, one
  skeletal delivery profile, zero evidence, four unreviewed media rows, zero
  alternates, zero relationships, zero calibrations, zero identity decisions,
  and 20 blockers. Legacy source incorrectly carries `age_min=8` and
  `is_published=true`; do not copy either classification/claim. The validated
  `.91` batch is `scripts/data/canonical-research/batches/full-body-joint-cars-
  flow.v1.json`; generated packet/manifest are under
  `scripts/data/canonical-research/generated/full-body-joint-cars-flow/`.
  Four new registry sources cover ACE professional CARs guidance, a Kinstretch
  starter pack, a full-body follow-along, and the nonspecific-neck-pain CPG.
  The packet has all 16 required evidence sections, four current oEmbed-
  healthy but unreviewed media candidates, and 20 alternate assessments.
- Source-23 identity decision: keep one exact ordered composite flow rather
  than consolidating joint-specific cards. The legacy neck, shoulders, elbows,
  wrists, spine, hips, knees, ankles order is a proposed Vortex review contract,
  not a universal externally validated standard. Preserve Neck CARs, Hip CARs,
  Wall-Supported Hip CARs, Ankle CARs, Arm Circles / Shoulder CARs, Quadruped
  Shoulder Circles, Cat-Cow, and Quadruped Spinal Circles as distinct. Keep
  clinical assessment/treatment, fast momentum circles, passive stretching,
  yoga flows, and incomplete selected-joint circuits distinct or rejected.
- Source-23 research validation: registry/batch JSON parse, the complete
  canonical-research test file passes 76/76, and the database-backed generator
  wrote one valid packet. Current research-only score proposal is exercise
  complexity / physical difficulty / derived maximum `38/8/38`; it has no
  approval and must enter independent calibration review.
- Exact next action: reconcile Git/DB state, inspect controlled taxonomy and
  exact neighboring variant/profile contracts, then author migration 493 for
  the fixed eight-region composite flow. Specify each joint's observable
  actions and direction, bilateral/alternating rules, standing/support base,
  neutral checkpoints, valid/invalid completion, repetitions/time, transitions,
  compensation, pain/neurologic stops, equipment/space, duration formula,
  logistics, substitutions, graph proposals, calibration proposals, identity
  boundaries, evidence, media candidates, and a four-human-blocker packet.

### Current live continuation — 2026-08-02 15:19 America/New_York

This is the authoritative starting point for the next LLM. It supersedes the
15:08 return handoff and all older next-action text while retaining those
entries as audit history.

- Repository: `/Users/jimmy_mac/Desktop/code/vortex`.
- Branch / HEAD at the last reconciliation: `main` /
  `f5621272a621c6a39e9d4734377b541e71a70a37`. Run `git status --short`,
  `git rev-parse --abbrev-ref HEAD`, and `git rev-parse HEAD` again before any
  edit because this is a shared dirty worktree.
- Preserve every concurrent change listed in `Concurrent work that must remain
  preserved`, including the Needs Engine `use_only`/`must_use` correction,
  typed prescription-error details, UI blocker/relaxation display,
  `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`,
  `src/utils/classSetupOverviewApi.ts`, and all unrelated dirty files. Do not
  commit, push, reset, discard, or deploy.
- Source 23 research is complete for `Full-Body Joint CARs Flow`, legacy source
  ID 23, canonical definition
  `c6e2b1c7-e42f-47b6-ac34-2549b32f8dd3`. Registry version is
  `2026-08-02.91` with 390 parsed sources. The batch is
  `scripts/data/canonical-research/batches/full-body-joint-cars-flow.v1.json`;
  generated evidence, media, alternates, manifest, and packet are under
  `scripts/data/canonical-research/generated/full-body-joint-cars-flow/`.
- Migration 493,
  `backend/migrations/493_coaching_full_body_joint_cars_flow_audit_hardening.sql`,
  is registered and immutable. Stored checksum: `3758480733`; registered at
  `2026-08-02 15:15:10.588696-04`. Never edit 493. It passed unchanged direct
  execution twice before registration, pre-registration no-persist canonical
  audit, production-runner registration, runner skip, and exact registered-file
  re-entry.
- Migration 493 archives baseline variant
  `f4b3acdd-8a11-48d1-a061-c3dcd859f215` and creates independent standing
  variant `c3eea4b0-3dfd-420c-b7ca-dcdf6a96b21c` at `38/8/38` and
  wall-supported-lower-body-segments variant
  `627e9509-da11-4e18-8e6a-e67eea115dad` at `42/6/42`. Scores are complexity /
  physical difficulty / derived maximum. It persists 4 profiles, 16 evidence
  rows, 4 current oEmbed-healthy but unreviewed media candidates, 20 alternate
  assessments, 6 review-only graph proposals, 4 review-only calibrations, 8
  identity boundaries, and one quarantined test packet. It clears the legacy
  `age_min=8` classification and false `is_published=true` state; do not
  reintroduce either.
- The authoritative post-493 audit found two machine-contract defects despite
  the migration's static checks: all four athlete instructions were 333
  characters where the canonical maximum is 240, and four regression edges
  used descriptive `mobility` and `duration` dimensions rather than the
  controlled graph vocabulary. Those defects caused `CARD-INSTRUCTION-01` and
  `CARD-GRAPH-01` and left five packet blockers. The remaining four intended
  blockers are the honest human gates: `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`.
- An unregistered corrective draft now exists at
  `backend/migrations/494_coaching_full_body_joint_cars_audit_contract_correction.sql`.
  Current local checksum: `3916243330`; current length: 91 lines. It shortens
  the athlete text to 238 characters, changes the four regression dimensions
  to controlled `range`, `stability`, and `complexity`, preserves descriptive
  mobility/duration facts in rationale metadata, restores the packet to the
  four honest human blockers, refuses to touch human-reviewed state, and
  creates no approval. Migration 494 is already listed after 493 in
  `backend/platform/initTables.js`; its static contract test is already present
  in `backend/platform/__tests__/exerciseProgrammingDifficultyOnly.test.js`.
- Migration 494 has not yet been executed, registered, or validated. Treat its
  checksum and contents as mutable until its exact bytes pass the required
  draft checks. After it is registered, record the stored checksum/timestamp
  and never edit it; use migration 495 for any later correction.

Exact continuation order:

1. Reconcile Git status/HEAD, inspect all task-owned diffs, and confirm no
   concurrent edit overlaps migration 494, `initTables.js`, or the static test.
2. Run the targeted difficulty/static contract test, focused ESLint, JSON
   parsing, and `git diff --check`. Fix draft-only defects without touching
   immutable migrations.
3. Against disposable PostgreSQL
   `postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip` with
   `DATABASE_SSL=false`, execute the exact current migration-494 file using
   `psql -v ON_ERROR_STOP=1 -f ...` twice. Both runs must pass unchanged.
   Database access may require sandbox escalation; request it rather than
   substituting an unverified database.
4. Run the canonical audit in no-persist mode. Prove the Source-23 instruction
   and graph machine issues are gone and that its packet has exactly the four
   human-only blockers. A release gate may remain blocked; an audit error may
   not.
5. Register the unchanged 494 bytes using the production migration runner:
   `DB_URL=postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip
   DATABASE_SSL=false npm run migrate:all`. Run the production runner again to
   prove skip behavior. Query `schema_migrations` for the exact filename,
   checksum, and timestamp, compare the stored/local checksum, and execute the
   exact registered file once more to prove safe re-entry. Never edit it after
   registration.
6. Run the authoritative persistent canonical audit, identity report, and
   release check. Query exact Source-23 counts and invariants instead of relying
   on expected totals or static string tests.
7. Expected values to verify, not blindly report: 1,676/1,676 legacy mappings;
   1,047 active definitions; 101 machine-complete and 946 incomplete cards; 100
   current healthy 3-to-5-candidate media sets; 628/628 score-72-or-higher
   identity pairs adjudicated with zero unresolved and zero direct collision;
   746 graph rows in review and zero approved; 957 calibration rows in review
   and zero approved; zero published definitions; and exactly four Source-23
   packet blockers. Report actual query output if any value differs.
8. Run the complete focused platform set, the full backend/platform suite,
   focused lint, changed-JSON parsing, `git diff --check`, and the production
   build. Source 22's previous verified baseline was 231/231 focused and 1,033
   pass plus 20 intentional skips in the full backend suite. Source 23 added
   research, migration-493, and migration-494 tests, so 234 focused and 1,036
   full passes are plausible only as estimates; record actual counts.
9. Append the final Source-23 checkpoint, including both immutable checksums,
   timestamps, failures/corrections, exact family/global counts, validations,
   and remaining human gates, to all six authoritative files named in
   `Authoritative documentation and how to update it`. Do not rewrite history
   or promote candidate/review data to approved/published state.
10. Only after Source 23 is fully documented and green, begin the baseline
    audit for source 24 `Neck CARs`, canonical definition
    `ee59b220-042c-482a-b7b5-5923d644c800`. Query its mapping, source payload,
    canonical definition, variants, profiles, evidence, media, alternates,
    graph, calibration, identity, and packet before research or editing. Do not
    infer an athlete age, skill, or proficiency classification.

Human work remains deliberately unresolved. A qualified reviewer must still
watch all Source-23 videos fully and record playback, exact flow/variant,
joint order, support, bilateral/directional behavior, captions, accessibility,
cue quality, safety, conflicts, reviewer identity, rationale, timestamp, and
card-version match. Qualified reviewers must adjudicate the evidence,
alternates, identity boundaries, graph proposals, and independent complexity /
physical-difficulty anchors, then separately approve content and publication.
Library-wide rollout still requires approved phase depth, shadow generation,
clean deployment rehearsal, monitoring, rollback and incident proof, support
readiness, and a real coach pilot. None of those approvals may be synthesized
from successful automation.

Before returning control, append a new dated `Return handoff` entry using the
template above and update all six authoritative ledgers with actual evidence.
The next LLM must leave this file sufficiently current that a zero-context LLM
can resume without rereading chat history or guessing whether a migration was
registered.

### Return handoff — 2026-08-02 15:27 America/New_York

This is now the authoritative continuation point and supersedes the 15:19
draft checkpoint above.

- Branch / HEAD: `main` / `f5621272a621c6a39e9d4734377b541e71a70a37` at
  final reconciliation. Recheck immediately because the worktree is shared.
- Worktree: task-owned changes include canonical research/static tests,
  `backend/platform/initTables.js`, immutable uncommitted migrations 490–494,
  source-21/source-22/source-23 batch/generated artifacts, registry `.91`, the
  five append-only audit/review ledgers, and this handoff. Preserve unrelated
  `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`. Concurrent class-setup work is
  present in `src/components/classSetup/overviewColumns.ts` and
  `src/utils/classSetupOverviewApi.ts`; the latter also retains the prior
  `CostUnit` compatibility repair. The successful build required retaining
  `active` as a legacy edit-key type and exporting `expandScheduleLines`; do
  not remove the concurrent row-expanded layout. Run `git status --short` for
  the complete current list. Do not commit, push, reset, discard, or deploy.
- Last registered migration / checksum: immutable
  `494_coaching_full_body_joint_cars_audit_contract_correction.sql` /
  `3916243330`, registered `2026-08-02 15:22:32.216772-04`. Immutable
  prerequisite 493 is `3758480733`, registered
  `2026-08-02 15:15:10.588696-04`. Never edit 493 or 494; use migration 495 for
  a later correction.
- Unregistered migration state: none for Source 23. Migration 494 passed exact
  direct execution twice before registration, no-persist canonical audit,
  production-runner registration, runner skip, stored/local checksum match,
  exact registered-file re-entry, persisted audit, and invariant queries.
- Family completed: source 23 `Full-Body Joint CARs Flow`, definition
  `c6e2b1c7-e42f-47b6-ac34-2549b32f8dd3`, is machine-complete and human-review
  quarantined. Archived baseline:
  `f4b3acdd-8a11-48d1-a061-c3dcd859f215`. Selectable review variants are
  independent standing `c3eea4b0-3dfd-420c-b7ca-dcdf6a96b21c` at `38/8/38`
  and wall-supported lower-body segments
  `627e9509-da11-4e18-8e6a-e67eea115dad` at `42/6/42`. Scores mean exercise
  complexity / physical difficulty / derived maximum; no athlete skill,
  proficiency, or age classification exists.
- Persisted family counts: 2 selectable variants, 4 contextual profiles, 16
  candidate evidence rows, 4 current oEmbed-healthy but unreviewed media
  candidates, 20 alternate assessments, 6 review-only relationships, 4
  review-only complexity/physical-difficulty calibrations, 8 identity
  boundaries, and 1 packet with exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Maximum athlete-instruction
  length is 238 and invalid controlled-dimension regression count is zero.
- Registry version / count: `2026-08-02.91` / 390 parsed sources. Batch:
  `scripts/data/canonical-research/batches/full-body-joint-cars-flow.v1.json`.
  Generated packet/manifest:
  `scripts/data/canonical-research/generated/full-body-joint-cars-flow/`.
- Global audit snapshot: 1,676/1,676 legacy mappings, 1,047 active definitions,
  101 machine-complete, 946 machine-incomplete, 100 current healthy
  embeddable 3–5-candidate sets, 746/0 graph review/approved, 957/0 calibration
  review/approved, and zero published. All 1,047 remain quarantined.
- Identity snapshot: 628/628 score-72-or-higher pairs adjudicated, zero
  unresolved pair, and zero exact collision. The composite eight-region flow
  remains distinct from all joint-specific CARs cards and from fast circles,
  passive stretching, yoga flows, and clinical assessment/treatment.
- Release gate: correctly `blocked`. Coverage is 14.71% score, 14.52% anatomy,
  11.65% load, 12.03% fatigue, 14.52% support, 14.71% operational, 14.52%
  candidate-research cards, and 9.55% current healthy embeddable sets. Release
  still has 0/25 published, zero approved depth in all seven phases, 0/10
  approved graph edges, 0/3 approved calibration anchors, and 0/20 real coach
  reviews.
- Focused tests: 234/234 pass, zero skips/failures.
- Full backend: 1,036 pass, 20 intentional skips, zero failures.
- Lint / data integrity: focused ESLint, four Source-23 JSON parses, static
  checksum/instruction-length checks, persisted/no-persist audits, Source-23
  invariant queries, identity report, and `git diff --check` pass.
- Build: production build passes. Existing browser-data/caniuse-lite freshness
  and greater-than-500-kB Admin chunk advisories remain nonblocking.
- Failures and corrections: post-493 audit discovered 333-character athlete
  text and uncontrolled `mobility`/`duration` graph dimensions; immutable 494
  corrected them to 238 characters and `range`/`stability`/`complexity` while
  preserving human gates. One read-only invariant query used invalid JSONPath
  escaping and was rerun with `jsonb_array_elements`; no data changed. The
  first production build failed because concurrent row-layout code referenced
  `expandScheduleLines` while older editor/copy code still typed `active`.
  The compatibility additions described above restored the build without
  reverting either behavior.
- Human review remaining: watch all four videos completely and record playback,
  exact flow/variant, order, actions, sides, support, captions, accessibility,
  cue quality, safety, conflicts, reviewer identity, rationale, timestamp, and
  card version. Adjudicate 16 evidence applications, 20 alternates, 8 identity
  boundaries, 6 graph proposals, and 4 score anchors; independently approve
  content and publication. Library-wide work still requires approved phase
  depth, shadow generation, clean deployment rehearsal, monitoring/rollback/
  incident proof, support readiness, a real coach pilot, and exact authorship
  for 946 machine-incomplete cards.
- Documentation updated: all five append-only workout-generator ledgers and
  this handoff now contain the final Source-23 metrics, validation, failures,
  corrections, and remaining gates.
- Exact next action: baseline-audit source 24 `Neck CARs`, canonical definition
  `ee59b220-042c-482a-b7b5-5923d644c800`. Query its legacy source mapping and
  payload, definition, variants, profiles, evidence, media, alternates,
  relationships, calibrations, identity decisions, and packet before editing.
  Then research exact cervical CAR identity, controlled joint actions, support
  variants, clinical-scope boundaries, dosage limitations, and 3–5 current
  YouTube candidates. Do not infer age, readiness, skill, or proficiency; do
  not treat the full-body composite, generic neck circles, clinical assessment,
  passive stretching, or symptom-provoking motion as aliases.

### Return handoff — 2026-08-02 15:35 America/New_York

This is the authoritative continuation point. It supersedes every older
`Immediate next work`, `Exact next action`, `Current live continuation`, and
`Return handoff` section above. The earlier sections remain the complete
mission, quality contract, operating procedure, command reference, and audit
history. A zero-context replacement LLM must read this entire file, begin with
the reconciliation steps below, and update this file plus the five other
authoritative ledgers before returning control.

#### Repository and safety state

- Work only in `/Users/jimmy_mac/Desktop/code/vortex`.
- Branch / HEAD at reconciliation: `main` /
  `f5621272a621c6a39e9d4734377b541e71a70a37`. Re-run `git status --short`,
  `git rev-parse --abbrev-ref HEAD`, and `git rev-parse HEAD` before editing;
  the worktree is shared and dirty.
- Do not commit, push, deploy, reset, checkout, discard, rewrite, or broadly
  format existing work. Preserve every unrelated or concurrent change.
- In particular, preserve the Needs Engine `use_only` versus `must_use`
  equipment fix, typed prescription-error details and UI blocker/relaxation
  display, `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`, the concurrent
  row-expanded class-setup changes, the `CostUnit` and
  `expandScheduleLines` compatibility exports in
  `src/utils/classSetupOverviewApi.ts`, and the legacy `active` edit-key type
  compatibility in `src/components/classSetup/overviewColumns.ts`.
- Migrations 493 and 494 are registered and immutable. Migration 493 checksum
  is `3758480733`, registered `2026-08-02 15:15:10.588696-04`. Migration 494
  checksum is `3916243330`, registered
  `2026-08-02 15:22:32.216772-04`. Never edit them. The next free migration is
  495.
- Source 23 `Full-Body Joint CARs Flow` is fully machine-complete and honestly
  human-review quarantined. Its final counts and validation results are in the
  immediately preceding handoff. Do not repeat that work.
- The last authoritative global snapshot remains 1,676/1,676 legacy mappings,
  1,047 active definitions, 101 machine-complete, 946 machine-incomplete, 100
  current healthy 3–5-candidate media sets, 628/628 surfaced identity pairs
  adjudicated, zero unresolved pair, zero direct collision, 746/0 graph
  review/approved, 957/0 calibration review/approved, and zero published.
  These are pre-Source-24 implementation values; query actual values after
  migration 495 rather than treating them as expected constants.

#### Source 24 baseline audit and identity decisions already completed

- Legacy source 24 is `Neck CARs`.
- Survivor canonical definition:
  `ee59b220-042c-482a-b7b5-5923d644c800`.
- Skeletal survivor baseline variant:
  `444a2645-e29e-473f-8956-1bb624a771b4`.
- Skeletal survivor profile:
  `94b35854-ed3a-4952-8cc2-00189c18f20e`.
- The survivor is schema/card version 1 with empty controlled taxonomy,
  anatomy, load, fatigue, constraints, support, and programming data; one
  skeletal profile; zero evidence; four legacy unverified media rows; zero
  alternates; zero calibration; one incoming review-only relationship from
  the completed full-body flow; one existing full-body distinct-identity
  boundary; and 20 blockers.
- Legacy source 24 incorrectly has `age_min=6` and `is_published=true`. Clear
  both. Do not migrate or reinterpret either as an athlete classification or
  approval.
- Legacy source 897 is `Neck CARs with Tall Posture`, definition
  `b0142272-15c6-4c52-bc27-c715a0fc41a8`, baseline variant
  `fce891ab-7041-4edb-92b6-b464ce6a5d64`. It is a direct duplicate of source
  24: tall stacked posture is required setup/quality for the same complete
  cervical CAR path, not a different repetition contract. Consolidate source
  897 into the source-24 survivor, archive its definition and variant, and
  remap source 897 to the survivor while preserving duplicate lineage. It also
  has unsupported `age_min=8` and `is_published=true`; clear/archive them.
- Legacy source 898 `Wall Cervical Rotation + Chin Nod`, definition
  `9f724fc9-6861-49a0-8f2d-f279543ca303`, variant
  `adf40d54-16bb-454f-9b75-ceb557afd2ec`, remains distinct. It ends after a
  chin nod plus side-to-side axial rotation against wall feedback and does not
  perform the full cervical CAR path.
- `Full-Body Joint CARs Flow` remains distinct. Chin nod, rotation-only,
  isometric, resisted, passive, manual-assisted, vestibular, generic neck roll,
  clinical assessment/treatment, and incomplete selected-joint tasks also
  remain distinct or identity-quarantined. Fast, forced, uncontrolled, or
  symptom-provoking neck circles are rejected.
- Range, tempo, circle count, rest, and voluntary tension are delivery
  annotations when the full path and exact base remain unchanged. Supine CARs
  remains a proposed exact-variant identity quarantine until its gravity,
  support, range, and exit contract is separately authored.

#### Source 24 research state already completed

- Registry version is `2026-08-02.92` with 391 parsed sources.
- Batch:
  `scripts/data/canonical-research/batches/neck-cars.v1.json`.
- Generated packet:
  `scripts/data/canonical-research/generated/neck-cars/neck-cars.v1.json`.
- Generated manifest:
  `scripts/data/canonical-research/generated/neck-cars/neck-cars-v1.manifest.json`.
- The generated manifest proves 16 required evidence sections, five media
  candidates, and 20 alternate assessments. The full canonical-research test
  file passes 77/77 after the five-candidate update.
- One wording defect remains in the batch: the
  `assessmentSummary.calibrationEvidence.basis` string says `four current
  oEmbed candidates`, but the final packet contains five. Change that word to
  `five`, regenerate the packet/manifest, and rerun the 77-test research file
  before using the packet in migration 495.
- Direct research sources already registered and read:
  - ACE professional CARs guidance:
    `https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/`;
  - Kinstretch starter material:
    `https://markowtrainingsystems.com/wp-content/uploads/2020/02/2020KinstretchStarterPack.pdf`;
  - 2025 nonspecific-neck-pain guideline:
    `https://pmc.ncbi.nlm.nih.gov/articles/PMC12620902/`;
  - 2019 cervical range and compensatory-strategy study:
    `https://pmc.ncbi.nlm.nih.gov/articles/PMC6341704/`.
- These sources support slow deliberate active pain-free motion without
  momentum, the observable cervical action planes, compensation monitoring,
  exercise-professional scope limits, example-only dosage, and symptom/red-
  flag escalation. They do not establish one universal range/path, universal
  dose/frequency/recovery, eligibility, outcome, injury prevention,
  progression order, or Vortex difficulty score.
- Five candidates currently return YouTube oEmbed metadata:
  `J3tkQ4pk_Sc`, `c-zu1t-NsSo`, `iIt5_T8HM_Q`, `4wV_Jkk34ho`, and
  `xqBwoN7AglQ`. This proves metadata/embed response health only. It does not
  prove playback, exact path/variant, captions, accessibility, cue quality,
  safety, reviewer identity, or approval. Keep every media row `candidate`
  with human-only fields null.

#### Exact Source 24 implementation to continue

No migration 495 exists yet. Do not assume Source 24 is implemented or
registered. Continue in this order:

1. Reconcile Git/HEAD and inspect overlapping diffs. Correct the stale
   four-versus-five wording in the batch, regenerate with
   `backend/scripts/build-canonical-research-batch.mjs --write`, and rerun
   `backend/platform/__tests__/canonicalResearchBatch.test.js`.
2. Inspect the live schema and controlled taxonomy in disposable PostgreSQL
   before authoring. In particular, identify the authoritative equipment table
   and controlled key for a chair/seated support; do not invent an equipment
   key. Read recent immutable family migrations for exact JSON shapes, enum
   values, profile roles, graph types/dimensions, calibrations, and packet
   assertions.
3. Author
   `backend/migrations/495_coaching_neck_cars_identity_and_family_audit_hardening.sql`.
   Reserve these exact selectable review variants:
   - standing independent Neck CARs:
     `e66a4cc2-c8ac-4242-9340-948fd0329394`, proposed difficulty
     `28/4/28`;
   - seated supported Neck CARs:
     `d55e8b63-019a-448d-af26-9b8a5a21cd68`, proposed difficulty
     `24/3/24`.
   Scores are exercise complexity / physical difficulty / their derived
   maximum. Every normalized score field must remain within 1–100; for a
   no-impact exercise use the valid score floor where the schema requires it
   while retaining impact class `none` and contacts `0`.
4. Migration 495 must fail closed on prerequisite drift and on any human-
   reviewed or approved survivor/duplicate content. It must supersede only
   candidate/review state; archive both skeletal baselines; archive the source-
   897 duplicate definition; preserve and update both legacy mappings and
   provenance; clear unsupported legacy ages/publication; upgrade the survivor
   to card version 2; and persist complete controlled taxonomy, anatomy,
   actions, planes, laterality, exact repetition boundaries, load, fatigue,
   recovery, constraints, stop rules, coach/athlete/support content,
   programming, persistence, and revalidation contracts.
5. Persist two contextual delivery profiles per selectable variant, for four
   total, using only controlled roles and phase keys. Include full dose,
   duration model and bounds, quality gates, symptoms/stops, measurements,
   setup/transition/reset, equipment quantities, space, throughput,
   supervision, coach prompts, athlete prompts, support/incident prompts, and
   substitution revalidation. The standing variant should require no
   equipment; the seated variant must use the verified controlled chair key.
6. Persist exactly the research packet's 16 current candidate evidence
   applications, five candidate media rows, and 20 alternate assessments, all
   at card version 2 with honest limitations and no approval. Add the explicit
   source-897 duplicate consolidation, the source-898 distinct boundary, and
   preserve the full-body distinct boundary without creating conflicting
   duplicate identity rows.
7. Add review-only graph proposals between standing and seated variants and
   narrowly relevant distinct neighbors. Use only controlled relationship
   types and controlled dimensions such as `load`, `leverage`, `range`,
   `speed`, `stability`, `complexity`, `impact`, `decision_demand`, and
   `fatigue`; do not use descriptive terms as graph dimensions. Descriptive
   mobility, duration, equipment, or clinical facts belong in rationale and
   revalidation metadata.
8. Add four review-only calibration proposals: complexity and physical
   difficulty for each exact variant. Overall is derived and must not be
   independently calibrated. Create one current automated packet containing
   only the four honest human gates `CARD-MEDIA-01`, `CARD-GRAPH-03`,
   `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Assert exact family counts,
   identity disposition, score formulas, controlled dimensions, absence of
   approvals, and absence of athlete skill/proficiency/age classifications.
9. Register migration 495 in numeric order in
   `backend/platform/initTables.js`. Add comprehensive static contract coverage
   to `exerciseProgrammingDifficultyOnly.test.js` and retain the Source-24
   research coverage in `canonicalResearchBatch.test.js`.
10. Apply the exact draft to disposable PostgreSQL twice with
    `ON_ERROR_STOP=1`; run the no-persist canonical audit; fix draft defects;
    and repeat both unchanged executions after every byte change. Then compute
    the platform checksum, register the exact file with the normal migration
    runner, prove runner skip, query the stored checksum/timestamp, compare it
    with the local bytes, and directly re-enter the exact registered file.
    Once registered, migration 495 is immutable.
11. Run exact Source-24 invariant queries, the persisted canonical audit,
    identity report, and release check. A release block is correct; a migration,
    audit, identity, or packet error is not. Record actual global deltas rather
    than guessing them because duplicate consolidation changes the active-
    definition count.
12. Run focused tests and ESLint, changed-JSON parsing, `git diff --check`, the
    complete backend/platform suite, and the production build. Preserve and
    report existing browser-data freshness and large Admin-chunk advisories
    separately from real failures.
13. Append actual Source-24 results to
    `COMPLETION_AUDIT.md`, `IDENTITY_RESOLUTION.md`, `LIBRARY_AUDIT.md`,
    `PRODUCTION_ROLLOUT.md`, and `RESEARCH_REVIEW_PROGRAM.md`. Then append a new
    dated authoritative `Return handoff` here with exact filenames, UUIDs,
    checksums, registration time, family/global counts, test totals, failures
    and corrections, human gates, worktree state, and the exact next
    machine-incomplete family. Never replace historical ledger entries.

#### Work still outside automated authority

Qualified humans must watch all five Source-24 candidates fully and record
playback, exact path and variant, base, directions, range policy, captions,
accessibility, cue quality, safety, conflicts, reviewer identity, rationale,
timestamp, and card-version match. Qualified reviewers must adjudicate the 16
evidence applications, 20 alternates, identity decisions, graph proposals,
and four score anchors, then independently approve content and publication.
Do not synthesize any of those approvals from passing tests or oEmbed health.

The overall library objective remains active after Source 24. At the last
verified checkpoint, 946 active definitions still lacked complete exact
authorship. Production rollout also still needs approved phase depth, shadow
generation, clean deployment rehearsal, monitoring, rollback and incident
proof, support readiness, and a real coach pilot. Continue one exact family at
a time and keep the complete single-workout generator flow green; do not mark
the goal complete after one card family or one passing build.

### Return handoff — 2026-08-02 15:55 America/New_York

This is the authoritative continuation point. It supersedes every older
`Immediate next work`, `Exact next action`, `Current live continuation`, and
`Return handoff` section above. A zero-context replacement LLM must read this
entire file before acting. The earlier sections remain the complete mission,
card contract, identity/research/migration procedures, safety rules, command
reference, and history.

#### Repository and safety state

- Work only in `/Users/jimmy_mac/Desktop/code/vortex`.
- Branch / HEAD at final reconciliation: `main` /
  `c4f5fee9d446c16372479b109ee6dfec760f05a1`. Re-run `git status --short`,
  `git rev-parse --abbrev-ref HEAD`, and `git rev-parse HEAD` before editing;
  the repository is shared and dirty.
- Do not commit, push, deploy, reset, checkout, discard, rewrite history, or
  broadly format files. Preserve unrelated work and inspect overlapping diffs.
  Specifically preserve the Needs Engine `use_only`/`must_use` fix, typed
  prescription-error details and UI blocker/relaxation display,
  `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`, concurrent class-setup row layout,
  `CostUnit`/`expandScheduleLines` compatibility, and legacy `active` edit-key
  compatibility.
- A concurrent update advanced `main` from `f5621272` to `c4f5fee9` and now
  tracks the Source-21-through-24 implementation, research, tests, migrations,
  and class-setup compatibility work. At this checkpoint only the six
  authoritative workout-generator Markdown ledgers are dirty. Do not assume
  that remains true; reconcile again before acting.
- Migrations 490–495 are tracked and registered. Migration 495 is immutable at
  checksum `303191298`, registered
  `2026-08-02 15:51:41.167193-04`. Never edit it; use the next free migration
  496 for any later correction.

#### Work completed through Source 24

- Source 24 `Neck CARs`, survivor
  `ee59b220-042c-482a-b7b5-5923d644c800`, is machine-complete at card/schema
  version 2 and honestly quarantined for human review. Archived source-24
  baseline: `444a2645-e29e-473f-8956-1bb624a771b4`.
- Source 897 `Neck CARs with Tall Posture` is a deterministic duplicate.
  Definition `b0142272-15c6-4c52-bc27-c715a0fc41a8` and variant
  `fce891ab-7041-4edb-92b6-b464ce6a5d64` are archived; the source mapping now
  points to the source-24 survivor with duplicate-consolidation provenance.
- Source 898 `Wall Cervical Rotation + Chin Nod`, definition
  `9f724fc9-6861-49a0-8f2d-f279543ca303`, variant
  `adf40d54-16bb-454f-9b75-ceb557afd2ec`, remains distinct. The full-body CARs
  flow remains distinct.
- Selectable variants are standing independent
  `e66a4cc2-c8ac-4242-9340-948fd0329394` at `28/4/28` and seated supported
  `d55e8b63-019a-448d-af26-9b8a5a21cd68` at `24/3/24`. Scores mean exercise
  complexity / physical difficulty / derived maximum. No exercise skill,
  proficiency, readiness, or age classification exists.
- Persisted family counts: 2 selectable variants, 4 delivery profiles, 16
  candidate evidence rows, 5 current healthy oEmbed-only media candidates, 20
  alternate assessments, 5 controlled-dimension review-only relationships, 4
  review-only score calibrations, 2 survivor-owned identity decisions, and one
  packet with exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
  `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Maximum athlete instruction is
  229 characters; invalid graph dimensions and approvals are zero.
- Research registry `2026-08-02.92` contains 391 parsed sources. Batch:
  `scripts/data/canonical-research/batches/neck-cars.v1.json`. Packet and
  manifest: `scripts/data/canonical-research/generated/neck-cars/`.
- Migration 495 draft failures were transactional and corrected before
  registration: a malformed JSON constructor, a 254-character athlete
  instruction, and a legacy `SMALLINT` projection mismatch. Temporary
  diagnostics were removed; final bytes passed twice unchanged before
  registration and exact re-entry. No partial data or approval was created.
- Global state: 1,676/1,676 mappings, 1,046 active definitions, 102
  machine-complete, 944 machine-incomplete, 101 current healthy 3–5-candidate
  media sets, 628/628 surfaced identity pairs adjudicated, zero unresolved pair
  or direct collision, 750/0 graph review/approved, 961/0 calibration
  review/approved, zero published, and all 1,046 quarantined.
- Release coverage is 14.82% score, 14.63% anatomy, 11.76% load, 12.14%
  fatigue, 14.63% support, 14.82% operational, 14.63% candidate research, and
  9.66% current healthy embeddable sets. Release correctly remains `blocked`:
  0/25 published, zero approved phase depth, 0/10 approved relationships, 0/3
  approved calibration anchors, and 0/20 real coach reviews.
- Validation is green: focused canonical-audit/research/difficulty tests
  236/236; full backend 1,038 pass plus 20 intentional skips; focused ESLint;
  four changed JSON categories; `git diff --check`; disposable-PostgreSQL
  direct runs, runner registration/skip, checksum match and re-entry; family
  invariants; persisted/no-persist audits; identity report; release check; and
  production build. Existing browser-data/caniuse-lite freshness and 855.69-kB
  Admin chunk warnings are nonblocking.

#### Exact next work

1. Reconcile the shared worktree and database; do not repeat Source 24 or edit
   migration 495.
2. Baseline-audit legacy source 25 `Cat-Cow`, canonical definition
   `29f1f054-8700-4233-9866-63810e69242e`. It is currently card version 1 with
   the baseline `canonical-card-audit-v1` packet and 20 blockers. Query its
   source payload and mapping, definition, variants, profiles, evidence, media,
   alternates, relationships, calibrations, identity decisions, and packet
   before research or editing.
3. Audit adjacent likely identities, including source 26 `Quadruped Spinal
   Circles` (`c8a4e447-0b65-4c0b-985b-7f5466fc07ec`), rather than merging by
   shared quadruped/spinal labels. Treat support base, spinal action sequence,
   repetition boundary, direction, locomotion, loading, and intended output as
   identity-bearing facts.
4. Research and author Source 25 using the complete procedures earlier in this
   file. Verify every controlled key and schema shape from live PostgreSQL.
   Reserve migration 496 only after checking no concurrent process has taken
   it. Never fabricate approval or full-video verification.
5. Keep difficulty task-only: exercise complexity and physical difficulty,
   with overall derived as their maximum. Do not add athlete skill,
   proficiency, readiness, or age categories to exercise cards.
6. Run direct draft idempotency, no-persist audit, normal registration/skip,
   checksum/re-entry, persisted audit, identity/release reports, focused tests
   and lint, changed-data parsing, `git diff --check`, the complete backend
   suite, and production build. A human-gate release block is correct; an audit
   or data-contract error is not.

#### Required handoff-back update protocol

Before returning control, append a dated Source-25 section with actual evidence
to all six authoritative ledgers; never replace historical entries:

1. `docs/workout-generator/COMPLETION_AUDIT.md` — migration/checksum,
   machine-complete requirements, failures/corrections, tests, exact family and
   global totals, and remaining gates.
2. `docs/workout-generator/IDENTITY_RESOLUTION.md` — every merge/distinct/
   variant/annotation/quarantine decision, stable UUIDs, lineage, detector
   totals, collisions, and unresolved cases.
3. `docs/workout-generator/LIBRARY_AUDIT.md` — the authored card contract,
   variant/profile/evidence/media/alternate/graph/calibration/packet counts,
   controlled taxonomy, generator support, and global coverage.
4. `docs/workout-generator/PRODUCTION_ROLLOUT.md` — database/test/build proof,
   release-gate result, deployment/pilot/monitoring/rollback/support gaps, and
   exact remaining machine work.
5. `docs/workout-generator/RESEARCH_REVIEW_PROGRAM.md` — source scope and
   limitations, every video ID, exact human viewing checklist, evidence,
   identity, graph, score, content, and publication adjudication queues.
6. `docs/workout-generator/LLM_CONTINUATION_HANDOFF.md` — update the top `Last
   updated` value and append the newest authoritative `Return handoff` with
   branch/HEAD, complete dirty-worktree warnings, immutable migrations and
   timestamps, UUIDs, actual metrics, validation totals, failures/corrections,
   human gates, and one exact next family/action.

The replacement LLM must label reported values as queried facts, estimates, or
human-review requirements. It must never convert machine completeness, oEmbed
health, candidate evidence, review-only relationships/calibrations, or passing
tests into content, media, graph, calibration, publication, or rollout
approval.

#### Work outside automated authority

Qualified humans still must watch the five Source-24 videos fully, adjudicate
16 evidence applications, 20 alternates, the identity decisions, 5 graph
proposals, 4 score anchors, content, and publication. Library-wide rollout
still requires approved phase depth, shadow generation, representative
substitution/failure testing, clean deployment rehearsal, staged flags,
monitoring, rollback and incident proof, support readiness, and a real coach
pilot. The overall objective remains active with 944 machine-incomplete active
definitions; do not mark it complete after one family or one green build.

### Return handoff — 2026-08-02 16:17 America/New_York

This is the authoritative continuation point. It supersedes every older
`Immediate next work`, `Exact next action`, `Current live continuation`, and
`Return handoff` section above. A zero-context replacement LLM must read this
entire file before acting. Source 25 is in progress but is not validated,
registered, immutable, or machine-complete. Do not restart Source 25 and do not
mistake the untracked draft for applied database state.

#### Repository and safety state

- Work only in `/Users/jimmy_mac/Desktop/code/vortex`.
- Branch / HEAD at this checkpoint: `main` /
  `c4f5fee9d446c16372479b109ee6dfec760f05a1`. Re-run `git status --short`,
  `git rev-parse --abbrev-ref HEAD`, and `git rev-parse HEAD` before acting.
- Preserve every existing dirty file. At this checkpoint the six authoritative
  workout-generator ledgers and the research source registry are modified;
  migration 496, the Cat-Cow batch, and its generated directory are untracked.
  Concurrent changes may appear after this checkpoint.
- Continue preserving the Needs Engine `use_only`/`must_use` fix, typed
  prescription-error details and UI blocker/relaxation display,
  `docs/NEEDS_ENGINE_CATEGORY_METRICS.json`, concurrent class-setup row layout,
  `CostUnit`/`expandScheduleLines` compatibility, and legacy `active` edit-key
  compatibility. Do not reset, discard, checkout, commit, push, deploy, publish,
  broadly format, or edit production data.
- Migrations 490–495 are tracked, registered, and immutable. Migration 495 has
  checksum `303191298` and registration timestamp
  `2026-08-02 15:51:41.167193-04`. Migration 496 is an editable, unregistered
  draft until PostgreSQL and the platform migration ledger prove otherwise.

#### Source-25 work already performed

- Baseline identity and adjacent-family audit was completed for legacy source
  25 `Cat-Cow`, survivor definition
  `29f1f054-8700-4233-9866-63810e69242e`; source 889 `Cat-Cow Segmental Wave`,
  duplicate definition `366ca335-c637-4f44-b0f3-616e8db8ee76`; source 26
  `Quadruped Spinal Circles`, distinct definition
  `c8a4e447-0b65-4c0b-985b-7f5466fc07ec`; source 27 `Thread-the-Needle`,
  distinct definition `1032ba98-fa48-4960-a039-2d11b2a492cc`; and the existing
  full-body flow boundary, definition
  `c6e2b1c7-e42f-47b6-ac34-2549b32f8dd3`.
- The intended identity decision is to consolidate source 889 into source 25
  while preserving its mandatory ordered pelvis-to-spine sequencing as an
  exact variant. Standard Cat-Cow is coordinated global quadruped spinal
  flexion/extension. Quadruped Spinal Circles remains distinct because it adds
  lateral shift/flexion and a circular path. Non-quadruped, thoracic-only,
  cervical-only, hover, limb-lift, loaded/manual, and multi-pose flows remain
  distinct. Breath phase, range, phase hold, tempo, cycle count, rest, and an
  optional mat are delivery annotations when the scored repetition is
  unchanged. Neutral-wrist and elevated-hands candidates remain proposed exact
  variants in identity quarantine and were not authored as selectable variants.
- The exact counted-repetition contract is neutral quadruped to flexion, reverse
  through neutral to extension, then return to neutral, retaining all four
  contacts. The segmental variant adds the ordered segmental sequence without
  changing that complete cycle boundary.
- Controlled taxonomy was checked. The relevant existing movement-pattern key
  is `brace`; there is no controlled mobility/flexion/extension pattern key.
  Mobility and spinal actions belong in purpose/anatomy. The intended body
  regions are `spine`, `thoracic_spine`, `neck`, `rib_cage`, `pelvis`, `core`,
  `scapula`, `shoulder`, `wrist`, and `knee`; equipment uses `none` and
  `mat_optional` where applicable.
- Research was completed without claiming approval. Added registry sources are
  `ace_cat_cow_exercise_library`, `aopt_low_back_pain_cpg_2021`,
  `pan_imu_spine_rehabilitation_2024`, `nasm_beginner_cat_cow_program`, and
  `special_olympics_cat_cow_cooldown`. The registry is now draft version
  `2026-08-02.93` with 396 sources. Scope and limitations are encoded in the
  batch; no source establishes a universal safety, dose, recovery, readiness,
  or outcome claim.
- All nine inherited YouTube IDs returned current oEmbed metadata during
  research. The five selected candidates are `1Y0YjXS9sKI`, `8kUU_odEY3o`,
  `T0MsxeAROUQ`, `d_k1g-SJR-4`, and `bKYGb1TgS6o`. This proves metadata/embed
  response health only. Playback, exact variant, captions, accessibility, cue
  quality, safety, conflicts, and approval remain null human-review fields.
- Research artifacts exist and parse as JSON:
  `scripts/data/canonical-research/batches/cat-cow.v1.json`,
  `scripts/data/canonical-research/generated/cat-cow/cat-cow.v1.json`, and
  `scripts/data/canonical-research/generated/cat-cow/cat-cow-v1.manifest.json`.
  The batch contains 16 evidence sections, five selected media candidates, and
  20 alternate assessments. Regeneration succeeded before this checkpoint,
  but the canonical research tests have not yet been rerun.
- An unregistered 1,047-line draft exists at
  `backend/migrations/496_coaching_cat_cow_identity_and_family_audit_hardening.sql`.
  Its beginning, end, and `git diff --check` were inspected after creation, but
  it has not been applied, audited, registered, checksum-locked, or tested.
  It is not yet listed in `backend/platform/initTables.js`, and Source-25 static
  coverage has not yet been added to
  `exerciseProgrammingDifficultyOnly.test.js` or
  `canonicalResearchBatch.test.js`.

#### Intended Source-25 persisted contract

- Selectable standard variant
  `3d36d51f-99e0-43db-91a4-da04a49647d5` at proposed `24/10/24`; selectable
  ordered-segmental variant `8fb77631-0365-471f-a1ce-eb17320b6b99` at proposed
  `34/10/34`. Scores mean exercise complexity / physical difficulty / derived
  maximum. Do not add athlete skill, proficiency, readiness, or age categories.
- Intended profiles are standard prepare
  `bb41b865-48d9-4731-8301-5c8697e6f03d`, standard restore
  `d658764d-60e6-4032-b2f5-c1758761444b`, segmental prepare
  `383a4087-acbb-4b90-aee4-3b0f47d7ad7b`, and segmental restore
  `8cb3770b-c2ee-46fc-adef-be94e402e148`.
- Intended exact family totals are two selectable review variants, four review
  profiles, 16 current candidate evidence applications, five candidate media
  rows, 20 alternate assessments, five review-only controlled-dimension graph
  proposals, four review-only complexity/physical-difficulty calibrations, two
  survivor-owned identity decisions, and one quarantined test packet with
  exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`. These are intentions until PostgreSQL queries prove them.
- Proposed graph dimensions must be limited to `load`, `leverage`, `range`,
  `speed`, `stability`, `complexity`, `impact`, `decision_demand`, and
  `fatigue`. Overall difficulty must not have an independent calibration.
- The migration is intended to fail closed on prerequisite drift and protected
  human-reviewed state; supersede candidate/review state only; archive skeletal
  source-25/source-889 variants and profiles; remap source 889 to the survivor
  with duplicate-consolidation provenance; archive the duplicate definition;
  clear unsupported legacy ages, skill, and publication state; upgrade the
  survivor to card version 2; and create no approval. Verify all of that from
  the actual SQL and database rather than trusting this summary.

#### Exact resume order

1. Reconcile Git, the dirty files, migration numbering, disposable PostgreSQL,
   and `schema_migrations`. If another process has registered or changed 496,
   stop treating it as an editable draft and reconcile exact bytes/checksum
   before any edit.
2. Read migration 496 completely. Check every SQL/JSON shape against the live
   schema and recent immutable migrations. Check instruction lengths, score
   projections, controlled taxonomy, enum values, relationship dimensions,
   idempotency, protected-state guards, lineage, profile completeness, exact
   counts, and absence of approvals and exercise-card level fields.
3. Parse all four changed JSON artifacts and run
   `node --test backend/platform/__tests__/canonicalResearchBatch.test.js`.
   Correct only the editable registry/batch/generated artifacts as needed;
   regenerate with `backend/scripts/build-canonical-research-batch.mjs --write`
   and rerun the test after any byte change.
4. Register migration 496 in numeric order in
   `backend/platform/initTables.js`. Add comprehensive Source-25 static contract
   tests to `exerciseProgrammingDifficultyOnly.test.js` and explicit Cat-Cow
   batch/manifest expectations to `canonicalResearchBatch.test.js`.
5. Apply the draft to disposable PostgreSQL twice unchanged with
   `ON_ERROR_STOP=1`. Run the no-persist canonical audit. If either fails, fix
   the still-unregistered draft and repeat both unchanged direct executions
   after every byte change. A failed transactional draft is not completion.
6. Only after direct idempotency and the audit pass, compute the platform
   checksum and register the exact file with the normal migration runner. Prove
   runner skip, query the stored filename/checksum/timestamp, compare with local
   bytes, and directly re-enter the exact registered file. After registration,
   migration 496 is immutable; any correction requires the next free migration.
7. Query exact Source-25 invariants and actual global totals. Run the persisted
   canonical audit, identity report, and release check. The prior expected
   post-consolidation totals were 1,676 mappings, 1,045 active definitions, 103
   machine-complete, 942 machine-incomplete, and 102 healthy media sets, but
   these are estimates only; report queried facts and investigate differences.
8. Run focused canonical-audit/research/difficulty tests, focused ESLint, all
   changed-JSON parsing, `git diff --check`, the complete backend/platform test
   suite, and the production build. Preserve and report known browser-data
   freshness and large Admin-chunk advisories separately from real failures.
9. Append actual Source-25 results to the six ledgers using the required
   handoff-back protocol immediately above. Update the top `Last updated` value
   and append, never replace, a new authoritative `Return handoff` here with
   exact UUIDs, migration checksum/timestamp, family/global totals, tests,
   failures/corrections, dirty-tree state, remaining human gates, and the next
   queried machine-incomplete exact family.

#### Work still outside automated authority

Qualified humans must fully watch and adjudicate all five Cat-Cow candidates;
review the 16 evidence applications, 20 alternates, identity decisions, five
graph proposals, four score anchors, content, and publication; and record real
reviewer identity, rationale, timestamps, and card-version match. Passing SQL,
tests, builds, oEmbed checks, and automated packets cannot create those
approvals. Library-wide rollout still requires approved phase depth, shadow
generation, representative substitution/failure testing, clean deployment
rehearsal, staged flags, monitoring, rollback and incident proof, support
readiness, and a real coach pilot. The overall goal remains active.

### Return handoff — 2026-08-02 16:30 America/New_York

This is the authoritative continuation point. It supersedes every older
`Immediate next work`, `Exact next action`, `Current live continuation`, and
`Return handoff` section above. A zero-context replacement LLM must read this
entire file before acting. Source 25 is complete at the automated machine layer
and remains honestly quarantined for human review. Continue with Source 26; do
not repeat Source 25 or edit immutable migration 496.

#### Repository and safety state

- Work only in `/Users/jimmy_mac/Desktop/code/vortex`.
- Branch / HEAD at final reconciliation: `main` /
  `c4f5fee9d446c16372479b109ee6dfec760f05a1`. Re-run `git status --short`,
  `git rev-parse --abbrev-ref HEAD`, and `git rev-parse HEAD` before acting
  because this is a shared dirty tree.
- At this checkpoint the task-owned dirty files are migration 496,
  `backend/platform/initTables.js`, both canonical research/difficulty test
  files, registry `.93`, the Cat-Cow batch and generated directory, and the six
  authoritative workout-generator ledgers. Preserve all other current or
  future changes. The production build's timestamp-only change to
  `docs/NEEDS_ENGINE_CATEGORY_METRICS.json` was restored, so that unrelated
  file is clean at this checkpoint.
- Continue preserving the Needs Engine `use_only`/`must_use` fix, typed
  prescription-error details and UI blocker/relaxation display, concurrent
  class-setup row layout, `CostUnit`/`expandScheduleLines` compatibility, and
  legacy `active` edit-key compatibility. Do not reset, discard, checkout,
  commit, push, deploy, publish, broadly format, or edit production data.
- Migrations 490–496 are registered and immutable. Migration 496 is checksum
  `2147238365`, registered `2026-08-02 16:24:07.458606-04`. Never edit its
  bytes; use the next free migration 497 for a later correction.
- The disposable PostgreSQL data directory is
  `/private/tmp/vortex-pg-skip-6z6qpa/data` and the connection is
  `postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip`. It required an
  out-of-sandbox restart because PostgreSQL shared memory and local TCP were
  sandbox-blocked. Recheck availability before relying on it.

#### Source-25 completed state

- Source 25 `Cat-Cow` survives at definition
  `29f1f054-8700-4233-9866-63810e69242e`, schema/card version 2. Archived
  Source-25 skeletal variant:
  `dd378c3e-51cd-44d5-bc26-34e562543f85`.
- Source 889 `Cat-Cow Segmental Wave`, definition
  `366ca335-c637-4f44-b0f3-616e8db8ee76` and skeletal variant
  `77182da9-ca9b-4bbf-ba9f-8d234c19bead`, is a deterministically consolidated
  duplicate. Its legacy mapping points to the survivor with
  `duplicate_consolidation` provenance, while its mandatory ordered sequence
  remains an exact selectable survivor variant.
- Source 26 `Quadruped Spinal Circles`, definition
  `c8a4e447-0b65-4c0b-985b-7f5466fc07ec`, remains distinct because it adds
  lateral shift/flexion and a circular multi-planar path. Source 27
  `Thread-the-Needle` and the full-body CARs flow also remain distinct.
- Selectable standard coordinated variant
  `3d36d51f-99e0-43db-91a4-da04a49647d5` is `24/10/24`; selectable ordered
  segmental variant `8fb77631-0365-471f-a1ce-eb17320b6b99` is `34/10/34`.
  Values mean exercise complexity / physical difficulty / derived maximum.
  No exercise skill, proficiency, readiness, or age classification exists.
- Review profiles are standard prepare
  `bb41b865-48d9-4731-8301-5c8697e6f03d`, standard restore
  `d658764d-60e6-4032-b2f5-c1758761444b`, segmental prepare
  `383a4087-acbb-4b90-aee4-3b0f47d7ad7b`, and segmental restore
  `8cb3770b-c2ee-46fc-adef-be94e402e148`. Their athlete instructions are 202
  and 220 characters, equipment is `none`, each has nine stop rules, and each
  has a 360-second without-review ceiling.
- Persisted current family counts are 2 selectable review variants, 4 review
  profiles, 16 candidate evidence applications, 5 current healthy oEmbed-only
  media candidates, 20 alternate assessments, 5 controlled-dimension
  review-only relationships, 4 review-only complexity/physical-difficulty
  calibrations, and 2 survivor-owned identity decisions. Definition, media,
  graph, and calibration approval-row counts are all zero.
- The current automated packet contains exactly `CARD-MEDIA-01`,
  `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01`. Both legacy
  rows have null skill/age fields and false publication state; Source 889 is
  archived and Source 25 remains active review-only.
- Registry `2026-08-02.93` contains 396 parsed sources. Batch:
  `scripts/data/canonical-research/batches/cat-cow.v1.json`. Packet and
  manifest: `scripts/data/canonical-research/generated/cat-cow/`. The five
  candidate IDs are `1Y0YjXS9sKI`, `8kUU_odEY3o`, `T0MsxeAROUQ`,
  `d_k1g-SJR-4`, and `bKYGb1TgS6o`. oEmbed health is not full playback,
  exactness, captions, accessibility, quality, safety, or approval.
- Migration 496 passed its first and second unchanged direct executions; it
  needed no SQL correction. The first focused research run exposed 34 stale
  registry `.92` expectations, which were updated to `.93`; explicit Cat-Cow
  research and migration contract tests were added. Registration, runner skip,
  stored/local checksum equality, and exact registered-file re-entry passed.

#### Authoritative validation and global state

- Focused canonical-audit/research/difficulty tests: 238/238 pass. Full backend
  suite: 1,040 pass, 20 intentional skips, zero failures. Focused ESLint, four
  changed-JSON parses, `git diff --check`, direct and runner PostgreSQL checks,
  no-persist and persisted audits, family queries, identity report, release
  check, and production build pass.
- Existing nonblocking advisories remain: stale baseline-browser/caniuse-lite
  data and the 855.69-kB minified Admin chunk. Do not report these as failures
  or silently update unrelated dependencies.
- Queried global state: 1,676/1,676 legacy mappings, 1,045 active definitions,
  103 machine-complete, 942 machine-incomplete, 102 current healthy
  embeddable 3–5-candidate sets, 628/628 surfaced identity pairs adjudicated,
  zero unresolved pair, zero direct collision, 755/0 graph review/approved,
  965/0 calibration review/approved, zero published, and all 1,045 active cards
  quarantined.
- Release coverage is 14.93% score, 14.74% anatomy, 11.87% load, 12.25%
  fatigue, 14.74% support, 14.93% operational, 14.74% candidate-research
  cards, and 9.76% healthy embeddable candidate sets. Release correctly remains
  `blocked`: 0/25 published, zero approved depth in all seven phases, 0/10
  approved relationships, 0/3 approved calibration anchors, and 0/20 real
  coach reviews.

#### Exact next work: Source 26 Quadruped Spinal Circles

1. Reconcile Git/HEAD, current dirty files, PostgreSQL, and the next free
   migration. Do not edit migrations 490–496. Reserve 497 only after checking
   that no concurrent work has claimed it.
2. Baseline Source 26 `Quadruped Spinal Circles`, survivor definition
   `c8a4e447-0b65-4c0b-985b-7f5466fc07ec`, legacy mapping source kind
   `legacy_migration`, and skeletal baseline variant
   `b274f28a-6d80-4ecf-bbff-4fa426f789b4`. At this checkpoint it is schema/card
   version 1, status review, empty controlled taxonomy/equipment, one skeletal
   delivery profile, zero evidence, four legacy candidate media rows, zero
   alternates, zero calibrations, no survivor-owned identity decision, and a
   20-blocker packet. Its legacy row has unsupported `age_min=8` and
   `is_published=true`; clear unsupported classifications/approval rather than
   carrying them forward.
3. Preserve and inspect all three incoming distinct boundaries: Cat-Cow
   `29f1f054-8700-4233-9866-63810e69242e`, full-body CARs
   `c6e2b1c7-e42f-47b6-ac34-2549b32f8dd3`, and definition
   `51ca966b-7d25-419a-8629-7961e45933c0`. Query the last definition and every
   adjacent spinal-circle/hip-circle/shoulder-circle/pelvic-clock/rock-back/
   thread-the-needle representation before deciding identity.
4. Establish an exact repetition boundary: quadruped support, initiation,
   ordered anterior/lateral/posterior/lateral path, direction contract, one
   circle versus both directions, return point, moving regions, valid
   completion, invalidating rotation/locomotion/limb lift/support loss, stop,
   reset, and exit. Do not merge it into sagittal Cat-Cow merely because both
   use a quadruped spinal-mobility label.
5. Research direct technique, relevant biomechanics/clinical scope, example
   programming, inclusive support, and every alternate. Recheck all inherited
   media through current metadata and select three to five exact title-relevant
   candidates without claiming playback or approval. Create new definition,
   exact variant, delivery annotation, or identity quarantine according to the
   procedures earlier in this file.
6. Verify live controlled taxonomy and schema shapes before authoring. Build
   complete anatomy, exercise complexity and physical difficulty, derived
   maximum, load, fatigue/recovery, cumulative budgets, constraints, contextual
   profiles, duration, logistics, substitutions, coach/athlete/support content,
   evidence, media, alternates, graph, calibrations, lineage, and an honest
   four-human-gate packet. Do not add athlete skill/proficiency/readiness/age
   levels to the exercise card.
7. Generate the research packet, add Source-26 static/data tests, author the
   fail-closed migration, apply it twice unchanged before registration, run the
   no-persist audit, register/checksum/skip/re-enter, query exact family/global
   state, persist the audit, and run identity/release reports. Then run focused
   tests/lint/JSON/diff checks, the complete backend suite, and production build.
8. Append actual Source-26 results to all six ledgers under the required
   handoff-back protocol. Record real failures/corrections, immutable checksum
   and timestamp, UUIDs, family/global totals, validation totals, worktree
   state, human gates, and the next queried machine-incomplete family. Never
   replace historical entries.

#### Work still outside automated authority

Qualified humans must fully watch all five Cat-Cow videos and adjudicate 16
evidence applications, 20 alternates, the identity decisions, five graph
proposals, four score anchors, content, and publication with real reviewer
identity, rationale, timestamps, and card-version match. Library-wide rollout
still requires approved phase depth, shadow generation, representative
substitution/failure testing, clean deployment rehearsal, staged flags,
monitoring, rollback and incident proof, support readiness, and a real coach
pilot. Passing SQL, tests, builds, oEmbed checks, or automated packets cannot
create those approvals. The overall objective remains active with 942
machine-incomplete definitions.

### Return handoff — 2026-08-02 16:34 America/New_York

This is the newest authoritative continuation point and supersedes every older
`Immediate next work`, `Exact next action`, `Current live continuation`, and
`Return handoff` section above. The full mission, non-negotiable user choices,
card contract, identity procedure, research/media rules, migration procedure,
verification commands, documentation protocol, and historical evidence remain
mandatory and are defined earlier in this file. Source 25 is complete at the
automated layer. Source 26 has been baseline-audited and partly researched, but
no Source-26 research artifacts, tests, or migration have been authored yet.

#### Repository, database, and preservation state

- Repository: `/Users/jimmy_mac/Desktop/code/vortex`.
- Last reconciled branch / HEAD: `main` /
  `c4f5fee9d446c16372479b109ee6dfec760f05a1`. Re-run `git status --short`,
  `git rev-parse --abbrev-ref HEAD`, and `git rev-parse HEAD` before acting.
- Current known dirty state is task-owned and must be preserved:
  `backend/platform/__tests__/canonicalResearchBatch.test.js`,
  `backend/platform/__tests__/exerciseProgrammingDifficultyOnly.test.js`,
  `backend/platform/initTables.js`, all six authoritative workout-generator
  ledgers, research registry `.93`, untracked immutable migration 496, the
  Cat-Cow batch, and its generated directory. Reconcile for newer concurrent
  changes before editing.
- Continue preserving the concurrent Needs Engine `use_only` versus `must_use`
  fix, typed prescription-error details, UI blocker/relaxation display,
  class-setup row layout, `CostUnit`/`expandScheduleLines` compatibility,
  legacy `active` edit-key compatibility, and every unrelated dirty file.
- Do not commit, push, deploy, publish, reset, checkout, discard, rewrite
  history, broadly format, or edit production data without explicit user
  authorization.
- Migrations 490 through 496 are registered and immutable. Migration 496 is
  checksum `2147238365`, registered
  `2026-08-02 16:24:07.458606-04`; never edit it. Migration 497 is the next
  candidate number only after rechecking the tree and migration ledger.
- Disposable PostgreSQL was last available at
  `postgresql://jimmy_mac@127.0.0.1:55434/vortex_skip`, data directory
  `/private/tmp/vortex-pg-skip-6z6qpa/data`. Local TCP/shared-memory access may
  require the normal approved out-of-sandbox execution path. Recheck the
  server and `schema_migrations` rather than assuming availability or state.

#### Last fully verified automated checkpoint

- Source 25 `Cat-Cow` is complete at schema/card version 2 through immutable
  migration 496 and remains quarantined for qualified human review.
- Its exact persisted family state is 2 selectable variants, 4 complete
  profiles, 16 candidate evidence applications, 5 healthy oEmbed-only media
  candidates, 20 alternate assessments, 5 review-only graph proposals, 4
  review-only complexity/physical-difficulty anchors, 2 survivor-owned
  identity decisions, zero approvals, and one packet with exactly
  `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
  `CARD-PUBLISH-01`.
- Focused tests pass 238/238; the full backend suite passes 1,040 with 20
  intentional skips; focused lint, changed-JSON parsing, `git diff --check`,
  direct/runner PostgreSQL checks, audits, identity report, release check, and
  production build pass. Existing browser-data/caniuse-lite freshness and
  855.69-kB Admin-chunk notices are nonblocking advisories.
- Queried global state remains 1,676/1,676 mappings, 1,045 active definitions,
  103 machine-complete, 942 machine-incomplete, 102 current healthy 3-to-5
  media sets, 628/628 surfaced pairs adjudicated, zero unresolved pair, zero
  direct collision, 755/0 graph review/approved, 965/0 calibration
  review/approved, zero published, and every active definition quarantined.
- Release is correctly blocked at 0/25 published definitions, zero approved
  phase depth, 0/10 approved graph edges, 0/3 approved score anchors, and 0/20
  real coach reviews. These values are the last queried facts, not approval.

#### Source-26 baseline already audited

- Legacy source 26 is `Quadruped Spinal Circles`. Its active skeletal canonical
  definition is `c8a4e447-0b65-4c0b-985b-7f5466fc07ec`; baseline variant is
  `b274f28a-6d80-4ecf-bbff-4fa426f789b4`; skeletal profile is
  `5bb53912-38a7-4767-91fd-027d61ac2f7d`.
- Current state is schema/card version 1, status `review`, family `Spinal
  mobility`, source mapping kind `legacy_migration`, one skeletal selectable
  variant at `20/10/20`, one incomplete prepare profile, zero evidence, four
  inherited unverified media rows, zero alternates, zero calibrations, no
  survivor-owned identity decision, and a 20-blocker packet. Values mean
  exercise complexity / physical difficulty / derived maximum.
- The legacy description prescribes hands and knees, circling the spine and
  pelvis through rounding, lateral shift, arching, the opposite lateral shift,
  repetition, and reversal. Its defaults are one set, five repetitions, 45
  work seconds, zero rest seconds, and 45 estimated seconds.
- Unsupported `age_min=8` and `is_published=true` must be cleared. Do not
  introduce exercise skill, proficiency, readiness, or age classifications.
- The legacy row currently claims spinal rotation plus lateral flexion,
  flexion, and extension. Reassess the rotation claim: do not convert coupled
  motion into a separately required axial-rotation contract unless exact
  evidence establishes it.
- Existing incoming reviewed distinct-identity decisions must be preserved:
  Cat-Cow survivor `29f1f054-8700-4233-9866-63810e69242e`; Full-Body CARs
  survivor `c6e2b1c7-e42f-47b6-ac34-2549b32f8dd3`; and Quadruped Shoulder
  Circles survivor `51ca966b-7d25-419a-8629-7961e45933c0` are distinct from
  Source 26.
- Existing Source-25 graph proposals connect Cat-Cow standard to the skeletal
  spinal-circle variant as progression/regression. If the skeletal variant is
  archived and replaced, migration 497 must safely repoint or recreate only
  unapproved review-state relationships and preserve protected reviewed or
  approved state.
- Adjacent active definitions already identified include Thread-the-Needle
  `1032ba98-fa48-4960-a039-2d11b2a492cc`, Quadruped Shoulder Circles
  `51ca966b-7d25-419a-8629-7961e45933c0`, and Arm Circles/Shoulder CARs
  `32610be3-19c7-4eed-8752-5f49bcbbf276`. Query all adjacent spinal-, pelvic-,
  hip-, and shoulder-circle representations before final identity decisions.

#### Source-26 research already completed

- Direct exact professional source: GMB, `Daily Diagnostic Joint Mobility
  Routine`, `https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf`.
  It specifies wrists under shoulders, knees under hips, a neutral/core start,
  small circles in one direction, comfortable range expansion, reversal, slow
  motion, and no forcing of uncomfortable positions. Its example dose is five
  repetitions for two sets in each direction; treat this as source-specific
  programming, not a universal dose or outcome.
- Supporting direct page: GMB, `Joint Mobility Exercises for Health, Function,
  and Workout Preparation`, `https://gmb.io/joint-mobility/`. It explicitly
  lists Quadruped Spinal Circles separately from Cat/Cow, Quadruped Shoulder
  Circles, and sidebending, and describes a low-intensity mobility/check-in use
  case. Do not generalize promotional outcomes beyond the supported claim.
- Existing peer-reviewed registry source:
  `thoracic_exercise_prescription_review`,
  `https://pmc.ncbi.nlm.nih.gov/articles/PMC7173996/`. It supports multi-planar
  thoracic exercise classification and the limitation that effectiveness and
  optimal dose are not established; it does not prove the exact drill.
- Existing clinical-scope registry source: `aopt_low_back_pain_cpg_2021`,
  `https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/`. Use only for
  individualized exercise, symptom/red-flag, and neurologic escalation scope;
  it is not exact spinal-circle technique evidence.
- Adjacent professional source: NAPA,
  `https://napacenter.org/quadruped-exercises/`. It distinguishes sagittal
  quadruped flexion/extension from thread-the-needle rotation and explains the
  support demands. Use it only for adjacent identity/accessibility boundaries.
- Vimeo `https://vimeo.com/312214017`, `Quadruped Global Spinal CARs With
  Lateral Flexion`, walks the hands to prescribed lateral-flexion positions and
  then articulates flexion/extension. Treat it as a distinct definition, not
  exact technique evidence for the fixed-contact circle.
- The four inherited YouTube IDs are `hhwEGxlKoUg`, `TlrD9HjYkGg`,
  `4kXCxpomK5c`, and `P92nex6vCTA`. They remain unverified candidates with null
  titles/channels/embedding fields in PostgreSQL. Browser inspection identified
  `4kXCxpomK5c` as a general 23-minute full-body joint-mobility routine, not an
  exact-title primary candidate; no timestamp or full-video verification has
  occurred. Do not call any inherited video healthy, exact, playable,
  captioned, accessible, safe, or approved until the applicable evidence and
  human review exist.
- A final web search for exact-title YouTube candidates was started but its
  result was not captured before this checkpoint. Re-run narrow exact-title
  searches and record three to five current title-relevant candidates. Current
  metadata/oEmbed response health, if obtained, still does not prove playback,
  exact variant, captions, cue quality, accessibility, safety, or approval.

#### Provisional identity and authorship decisions requiring completion

- The likely canonical identity is a fixed-contact quadruped global spinal
  circle. One repetition is one complete 360-degree loop in one declared
  direction, returning to the declared start phase while both hands and knees
  remain in contact. Direction must be persisted or otherwise unambiguously
  declared. A balanced profile may prescribe equal circles in both directions,
  but one circle in one direction is still the repetition boundary.
- The exact phase order and valid start point must be resolved from direct
  evidence rather than guessed. The legacy anterior/lateral/posterior/lateral
  description and GMB neutral-start wording must be reconciled in the authored
  instructions and test assertions.
- Clockwise/counterclockwise direction, direction order, comfortable range,
  tempo, counts, rest, and optional mat are likely delivery annotations when
  the repetition contract remains unchanged. Do not create extra variants only
  to inflate coverage.
- Cat-Cow, Thread-the-Needle, Quadruped Shoulder Circles, pelvic/hip circles,
  lateral-flexion-only tail wag, nonquadruped spinal circles, hover/limb-lift,
  loaded/manual/unstable/support-assisted forms, rock-back flows, and the
  hand-walk Global Spinal CARs sequence are distinct exercises unless exact
  evidence proves otherwise.
- A single exact fixed-contact variant may be more accurate than inventing a
  second variant. A provisional score considered during research was
  `32/12/32`, but this is not persisted or approved and must be independently
  calibrated against existing anchors. Overall remains derived as the maximum.
- Likely complete profiles are prepare and restore for the exact variant, with
  complete dose, duration, logistics, constraints, scaling, stop, quality,
  coach, athlete, support, and persistence contracts. Final counts and UUIDs
  must come from authored artifacts and persisted queries, not this proposal.

#### Exact resume and completion order

1. Reconcile Git/HEAD/status, next migration number, PostgreSQL availability,
   and `schema_migrations`; inspect overlapping diffs before editing.
2. Re-query Source 26 and every adjacent identity, including all inherited
   graph edges and identity decisions. Read recent immutable family migrations,
   live schema constraints, controlled taxonomy, and test shapes.
3. Finish narrow exact-title media research. Do not fabricate external checks
   or human review. Decide the exact repetition boundary, direction contract,
   anatomy/actions/planes, variants versus annotations, adjacent distinct
   definitions, profiles, graph proposals, and score anchors.
4. Advance the registry from `.93` only after reconciliation. Add the exact GMB
   source and any genuinely distinct supporting source with narrow claims and
   limitations. Create the Source-26 research batch and generated packet; parse
   and test all JSON.
5. Author fail-closed migration 497 only if still free. Clear unsupported
   publication/age state; supersede only mutable candidate/review rows; preserve
   lineage and protected state; author full generator, coach, athlete, support,
   evidence, media, alternate, graph, calibration, and test-packet contracts;
   create zero approvals.
6. Register migration 497 in `backend/platform/initTables.js` and add explicit
   Source-26 contract/research tests to both existing task-owned test files.
7. Apply the exact draft twice unchanged to disposable PostgreSQL with
   `ON_ERROR_STOP=1`; run no-persist audit. Repair transactional draft failures
   and restart two-run proof after every byte change. Only then register it with
   the normal runner, prove skip, stored/local checksum equality, exact
   registered-file re-entry, and immutability.
8. Query exact family/global invariants; run persisted/no-persist audits,
   identity report, and release check. Run focused tests, focused lint,
   changed-JSON parsing, `git diff --check`, the complete backend suite, and
   production build. A human-gate release block is correct; migration, schema,
   data-contract, audit, identity, test, lint, or build failure is not.
9. Append actual Source-26 results to
   `COMPLETION_AUDIT.md`, `IDENTITY_RESOLUTION.md`, `LIBRARY_AUDIT.md`,
   `PRODUCTION_ROLLOUT.md`, `RESEARCH_REVIEW_PROGRAM.md`, and this file. Update
   the top timestamp and append a new authoritative handoff with immutable
   checksum/timestamp, exact UUIDs/counts, queried global metrics, commands and
   results, failures/corrections, dirty-tree state, remaining human gates, and
   the next exact machine-incomplete family. Never rewrite historical entries.

#### Work outside automated authority remains unchanged

Qualified humans must still watch all candidate media in full and adjudicate
exactness, variants, captions, accessibility, cue quality, conflicts, safety,
evidence applications, alternate classifications, identity boundaries, graph
edges, complexity/physical-difficulty anchors, content, and publication with
real reviewer identity, rationale, timestamp, and card-version match.
Library-wide rollout still requires approved phase depth, shadow generation,
representative success/substitution/failure testing, clean deployment
rehearsal, staged flags, monitoring, rollback and incident proof, support
readiness, and a real coach pilot. Passing automation must not create or imply
any approval, and the overall objective remains active.
