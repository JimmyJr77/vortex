# Vortex workout generator: current state and target

> Historical baseline (2026-07-25), retained for migration rationale only.
> Do not use this document for current implementation or rollout status.
> Current authority is:
>
> - [`TAXONOMY_V2_ARCHITECTURE.md`](./TAXONOMY_V2_ARCHITECTURE.md) for the
>   normative v2 architecture and current implementation state;
> - [`PRODUCTION_ROLLOUT.md`](./PRODUCTION_ROLLOUT.md) for current release
>   evidence and the intentionally unmet human rollout gates;
> - [`COMPLETION_AUDIT.md`](./COMPLETION_AUDIT.md) for chronological migration
>   evidence; and
> - [`FUTURE_DIRECTION.md`](./FUTURE_DIRECTION.md) for deferred roadmap work.

Status at this historical point: audit baseline and first reversible canonical
slice (2026-07-25).

## Current architecture

The system is already a substantial database-backed rules engine, not an empty
generator. `backend/platform/phaseAwarePrescription.js` is the deterministic
selection entry point. It loads phase profiles, tags, dosage, safety, difficulty,
equipment, progression, and scaling records, creates candidates, scores them,
selects phase items, and emits diagnostics. `backend/platform/phaseArchitect.js`
allocates minutes in canonical order. `backend/platform/requirementsContract.js`
compiles structured inputs into traceable P0/P1 requirements. Validation and
bounded repair live in `workoutValidation.js`, `prescriptionQualityChecks.js`,
`categoryQualityEvaluators.js`, `categoryEvaluatorsExtended.js`, and
`prescriptionRepairLoop.js`.

The React coach surface uses `src/coach/types.ts`, `phasePlan.ts`,
`exerciseCard.ts`, and the builder/needs-engine stores. The API is registered
through `backend/platform/coachPortalRoutes.js` and
`coachProgrammingRoutes.js`. PostgreSQL migrations 011-229 define the coaching
taxonomy, exercise library, workout storage, AI tables, card v2, phase profiles,
difficulty, progression, requirements, and needs-engine data.

## Competing sources of truth

1. Phase templates exist independently in backend `phaseArchitect.js`, frontend
   `phasePlan.ts`, session-template rows, and regimen templates.
2. The base `coaching.exercise` row remains overloaded while card-v2 JSON fields,
   phase-profile rows, dosage rows, safety rows, scaling rows, and programming
   methods provide partly overlapping context.
3. Difficulty is a 1-10 `exercise_difficulty_profile`, while phase fit, fatigue,
   impact, tag weights, and technical complexity commonly use 1-5 or ambiguous
   scales.
4. Static exercise purpose/default dosage coexists with phase-specific profiles,
   so delivery context is not a first-class identity.
5. Frontend and backend maintain parallel types/constants and normalize aliases
   at multiple boundaries.
6. Quality checks are extensive but distributed across the legacy validator,
   category evaluators, strict quality checks, requirement mapping, and repair.

## Scale migration matrix

| Current field/source | Current scale | Canonical destination | Initial conversion |
|---|---:|---|---|
| difficulty `technical/load/complexity/overall` | 1-10 | exercise base difficulty dimensions | ×10 |
| phase profile `fit_weight` | usually 1-10 | phase suitability relevance | ×10, review |
| phase profile `impact_level` | 0-5 | impact | 0→null/1 by meaning; 1-5→×20 |
| phase profile `fatigue_cost/sensitivity` | 0-5 | fatigue/tissue demand | 0→null/1; 1-5→×20 |
| phase profile `technical_complexity` | commonly 1-10 | technical complexity | ×10 |
| exercise tag `weight` | commonly 1-5 | tenet/method/objective relevance | ×20 |
| RPE and wellness inputs | 1-10 | keep as named physiological RPE/wellness input; expose normalized score separately | no silent rewrite |
| needs-engine/evaluation indices | mixed counts/percent/points | quality score | explicit per-metric normalization |

Migration 240 creates parallel canonical columns, preserves source values, assigns
low migration confidence, and queues human review. It does not overwrite legacy
data.

## Ten largest output risks

1. A base exercise can supply static purpose/dose across incompatible contexts.
2. Phase and template definitions can drift between frontend, backend, and data.
3. Mixed scales distort candidate scoring and difficulty caps.
4. Item-time estimation omits realistic demonstration, transition, water, setup,
   and teardown time.
5. Equipment presence is modeled better than quantity, station throughput, and
   synchronized rotations.
6. Exercise-level relevance can win without whole-session movement/fatigue
   coherence.
7. Progression inference still falls back to shared tags/family when explicit
   graph edges are incomplete.
8. Cohort variants can lack equivalent delivery profiles and dose-specific
   challenge/risk recalculation.
9. Published-card completeness and video validity are not one universal candidate
   gate.
10. The very large evaluation surface contains overlapping metrics whose
    thresholds are not consistently 1-100.

## Missing canonical card data

Stable definition, explicit variant identity, delivery-profile identity,
versioned lifecycle/provenance, relationship graph with dimension/reason,
multidimensional 1-100 difficulty, prescription-dependent challenge and risk,
equipment quantity/footprint/queue/sightline data, context dosage ranges,
quality gates and stop rules, approved-video verification state, confidence,
review audit, and coach edit reason telemetry are not yet unified.

## Existing but incompletely connected capabilities

Phase architecture, hard equipment avoids, age/difficulty caps, audience splits,
progression lanes, preflight satisfiability, requirements traceability, category
evaluation, deterministic repair, exercise-card v2, programming methods, and
coach/athlete copy all exist. They do not yet consume one versioned intent/card/
delivery/prescription contract, and AI does not yet have a single fail-closed
intent boundary shared with deterministic generation.

## Target architecture

`WorkoutIntent v1` is normalized once. AI may only propose that intent. A
deterministic planner selects a phase template, creates slots, filters published
definition + variant + delivery-profile candidates, scores on 1-100 components,
selects a coherent session, prescribes dose, resolves cohorts and stations, then
runs one consolidated validator/repair loop. The output is `WorkoutOutput v1`
with versions, seed, assumptions, score breakdowns, rejection counts, repairs,
and unmet preferences. PostgreSQL stores normalized stable layers and immutable
generation snapshots; adapters preserve legacy API compatibility.

## Staged dependency plan

1. Freeze/audit current fixtures and metrics.
2. Land pure canonical constants, score conversion, intent normalization, and
   publication gate (this slice).
3. Add parallel canonical tables and reviewed backfill; never mutate legacy
   scores in place.
4. Add definition, variant, delivery-profile, relationship, and prescription
   schemas with adapters from existing rows.
5. Route the existing deterministic engine through canonical intent and 1-100
   score adapters behind a feature flag.
6. Consolidate P0-P3 validation and repair evidence.
7. Add all 25 golden scenarios and deterministic repeat assertions.
8. Add schema-constrained AI interpretation; AI failure falls back to the
   deterministic form.
9. Cut over coach/athlete UI, publication workflow, telemetry, and dashboard.

## Risks

Linear conversion is traceability scaffolding, not physiological calibration.
Old saved workouts must retain their generator/library/rule versions. Existing
approved media must be linked, not recreated. SQL backfill must be rehearsed
against real cardinalities and constraint violations. Feature flags and adapters
must allow independent rollback. RPE is conventionally 1-10 and must not be
confused with generic model scores.

## First implementation slice

`canonicalWorkoutContract.js` establishes the shared phase order, strict 1-100
score semantics, traceable legacy conversion, deterministic intent
normalization, and a published-card gate. Migration 240 performs a non-destructive
parallel backfill with confidence and human review. Tests cover scale boundaries,
contradiction handling, phase order, provenance, and publication safety.
