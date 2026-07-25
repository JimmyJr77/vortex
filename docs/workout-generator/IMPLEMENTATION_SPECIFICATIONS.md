# Canonical workout generator implementation specifications

This document is normative for canonical generator v1. The JSON schemas and
runtime contracts take precedence when examples differ.

## Family, progression, and substitution graph

Every node identifies an exercise definition or variant by stable ID. Every edge
has `fromId`, `toId`, `relationship`, `similarityScore` (1-100), `dimensions`,
`reason`, `conditions`, `reviewStatus`, and version/audit fields.

Allowed relationships are `regression`, `progression`, `lateral_substitution`,
`equipment_equivalent`, `phase_equivalent`, `compatible_pairing`, and
`contraindicated_pairing`. Progression dimensions are controlled values: load,
leverage, range, speed, stability, complexity, impact, decision demand, and
fatigue. A progression edge without at least one dimension and a reviewed reason
is invalid. Substitutions must preserve the delivery profile's phase role,
quality gate, and hard constraints; name similarity never creates an edge.

## 1-100 scoring handbook

All model scores are integers from 1 through 100; `null` means not applicable or
not reviewed. Zero is invalid. Bands are descriptive, never safety gates.

| Anchor | Technical | Load | Impact | Supervision | Overall |
|---|---:|---:|---:|---:|---:|
| Crocodile breathing | 10 | 1 | 1 | 5 | 8 |
| Incline push-up | 20 | 25 | 10 | 15 | 25 |
| Standard push-up | 30 | 45 | 10 | 20 | 42 |
| Strict pull-up | 35 | 75 | 10 | 25 | 68 |
| Countermovement jump to stick | 40 | 20 | 55 | 35 | 48 |
| Barbell back squat, coached moderate load | 60 | 65 | 25 | 65 | 65 |
| Olympic lift from floor | 85 | prescription-dependent | 35 | 85 | 82 |

Overall difficulty does not replace component scores. `predictedChallengeScore`
is recalculated from athlete and prescription context. `technicalRiskScore`
separately reflects complexity, supervision, spotting, and failure consequence.
Candidate score components are phase suitability 40%, objective relevance 30%,
athlete compatibility 20%, and methodology alignment 10%. Weights are versioned.

Legacy 1-5 values initially map to 20/40/60/80/100. Legacy 1-10 values initially
map by ×10. These are low-confidence backfills, not coach approval.

## Legacy migration and calibration

Migration 240 creates parallel canonical scores, stores the complete source row,
assigns confidence 40, and queues review. It never overwrites legacy columns.
Calibration proceeds by dimension: select anchor cards; blind-score with at
least two qualified coaches; resolve material disagreement; approve scores;
measure distribution drift; then enable reads for that dimension. Rollback is a
feature-flag change because legacy columns remain available. Saved workouts
retain schema, generator, library, rule, and model versions.

## Deterministic generator

The pipeline is:

1. Normalize and reject contradictory intent.
2. Produce the objective vector.
3. Select phases in canonical order and allocate exact target minutes.
4. Build phase slots.
5. Filter candidates through publication, delivery-profile, age, training-age,
   difficulty, risk, equipment, limitation, movement, region, environment, and
   space gates.
6. Score eligible candidates with observable components and seeded tie-breaking.
7. Select diverse explicit families without weakening specialization.
8. Prescribe dose for the phase time budget.
9. Recalculate cohort challenge and technical risk.
10. Resolve station capacity, equipment quantity, queue, demonstration, and
    transition time.
11. Validate and perform only bounded, traceable repairs.
12. Emit the versioned workout and diagnostic report.

No network or LLM call occurs in this path. Seeded output must compare deeply
equal when intent, library, and rule versions are equal.

## AI intent contract

AI output includes original request, interpreted objective, hard constraints,
soft preferences, athlete and facility profiles, phase preferences,
uncertainties, assumptions, per-field confidence, and clarification state. It
cannot contain exercise IDs, prescriptions, or a production workout.
`canonicalAiIntent.js` validates this output, then invokes the exact deterministic
intent normalizer. Ambiguity requests clarification; invalid or contradictory
output fails closed. Service failure returns the deterministic form workflow.

## Safety and constraint policy

P0 hard gates include explicit avoids, unavailable or insufficient equipment,
age/training-age exclusions, risk and difficulty caps, prohibited impact or
movement, environment/space infeasibility, missing cohort variants, publication
or video failure, invalid delivery profile, phase order, and duration tolerance.
They cannot be overridden by AI or a candidate score.

P1 warnings require coach acknowledgement and rationale. P2 findings are quality
repairs. P3 findings are informational. Repairs may swap only across reviewed
graph edges or remove an optional phase item; they cannot relax P0 constraints.
Pain, neurological symptoms, unsafe anchors/surfaces, collision risk, loss of
quality, and spotting failures are stop conditions, not coaching challenges.
The system does not diagnose injury.

## Group logistics model

For each prescription calculate athlete count, station capacity, station count,
equipment per station, total quantity, work/rest cadence, demonstration time,
setup/teardown, transition, footprint, lane, queue risk, and coach sightline.
A required quantity shortfall is P0. Station work intervals must be
synchronizable within 15 seconds or receive an explicit stagger plan. Coach
capacity is constrained by the highest simultaneous supervision demand, not
only athlete-to-coach ratio. Total duration includes all logistics time.

## Needs-engine consolidation

The canonical validator becomes the registry for check ID, category, P-level,
evidence paths, threshold scale, repair authority, and owner. Existing
`workoutValidation`, category evaluators, strict quality checks, and requirements
mapping remain adapters until every check has one registry entry. Duplicate
checks are measured in shadow mode, compared, then retired. Counts and raw
measures remain raw; only defined normalized indices become 1-100 scores.

## Coach review rubric

Reviewers rate safety, objective fidelity, phase intent, dose, age/readiness fit,
scaling, logistics, clarity, and overall keepability from 1-100. Any safety or
explicit-constraint failure forces rejection. Outcomes are `keep`, `minor_edit`,
`major_edit`, or `reject`. Every swap and dose edit requires a reason code:
objective mismatch, phase mismatch, readiness, safety, equipment, logistics,
variety, recent exposure, unclear instruction, dosage, or coach preference.
Pilot acceptance requires at least 90% keep/minor-edit, median swaps below 10%,
and median dose edits below 15%.

## Rollout and feature flags

Flags are `canonical_contract_read`, `canonical_score_shadow`,
`canonical_generator_shadow`, `canonical_generator_coach_opt_in`,
`canonical_ai_intent`, and `canonical_generator_default`. Rollout advances
development → internal coach → limited facility → 25% → 100%. Each stage requires
P0=0, deterministic stability, quality ≥90, safety/logistics=100, acceptable
latency, and coach rubric targets. Any P0 regression disables the newest flag.

## Data-quality report

The report groups total cards by lifecycle state and measures: canonical score
coverage, approved score coverage, delivery-profile coverage, graph connectivity,
dosage completeness, scaling coverage, approved-video validity, safety-field
coverage, alias collisions, orphan taxonomy keys, and generator pool depth per
phase/cohort/equipment profile. Each metric is a numerator, denominator, percent,
trend, and list of failing stable IDs. No aggregate may hide a zero-depth pool.

## Dependency-ordered backlog

1. Complete canonical normalized tables and reviewed anchor calibration.
2. Build the database loader for canonical cards and versioned library snapshot.
3. Expand all 25 golden fixtures with floor-execution assertions.
4. Add cohort-specific dose/challenge and explicit graph substitution.
5. Consolidate P0-P3 validation and bounded repair registry.
6. Add the feature-flagged API route and shadow comparison telemetry.
7. Add deterministic and AI-assisted coach input workflows.
8. Add coach/athlete output views, rationale, diagnostics, and swap controls.
9. Add card review/publication and media verification workflows.
10. Add edit-reason telemetry and the data-quality dashboard.
11. Pilot, calibrate thresholds, document decisions, and progressively roll out.
