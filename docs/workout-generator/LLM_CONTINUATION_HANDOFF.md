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

## Current worktree and migration 478 state

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

## Immediate next work

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

## Concurrent work that must remain preserved

Do not regress these previously shared fixes:

- `phaseAwarePrescription.js` requires full equipment coverage only for
  `must_use`; `use_only` is an allow-list, not a requirement to use everything.
- `phaseAwarePrescription.v2.test.js` contains regression coverage for that
  behavior.
- Prescription-error route responses include `{ code, ...details }`.
- `NeedsEnginePanel` displays blocking requirements and suggested relaxations.

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

No replacement-LLM return entry has been added yet. The live checkpoint above is
the authoritative handoff from the current LLM.
