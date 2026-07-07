# Needs Engine Quality Loop — Strict (Round 3)

Autonomous loop until the golden scenario passes the **strict** evaluator **five times in a row** without human input.

Round 2 (`--tier=baseline`) proved structure (restore, fill, box-avoid). Round 3 demands **coach-credible prescriptions**: lane-valid progressions, no reuse spam, tight phase fill, youth safety, equipment coverage, zero spurious warnings.

## Artifacts

| File | Role |
|------|------|
| [scripts/golden-prescription-scenario.json](../scripts/golden-prescription-scenario.json) | GAD 120-min speed / fitness / youth splits / box-avoid |
| [scripts/evaluate-prescription-quality.mjs](../scripts/evaluate-prescription-quality.mjs) | CLI evaluator (`--tier=strict` default) |
| [backend/platform/prescriptionQualityChecks.js](../backend/platform/prescriptionQualityChecks.js) | Shared check definitions + thresholds |
| [docs/NEEDS_ENGINE_QUALITY_LOOP.log](./NEEDS_ENGINE_QUALITY_LOOP.log) | One line per iteration (local; gitignored) |

## Strict gates (summary)

### P0 — must never fail

| Check id | Requirement |
|----------|-------------|
| `restore_*` | Restore non-empty, no pool_empty, 95–105% of target minutes |
| `restore_not_box_avoid_false_positive` | Box Breathing not in equipment-avoid samples |
| `no_empty_phases` | No phase reports pool_empty |
| `no_duplicate_session_slugs` | No repeated primary exercise in session |

### P1 — phase structure

| Check id | Requirement |
|----------|-------------|
| `phase_fill_*` | Prepare/Output/Capacity/Resilience ≥90%; MI ≥85%; Sustained ≥80% |
| `no_progression_*` | No Split progressions on Prepare, MI, Restore, Sustained |
| `stretch_primaries_*` | Zero stretch primaries in Prepare, MI, Output, Capacity, Resilience |
| `equipment_use_coverage` | Kettlebell, jump rope, and cones each appear in prescribed items |
| `mi_no_handstand_youth` | No handstand/inversion primaries in MI for ages 8–14 |

### P1 — Split 2 progressions (coach quality)

| Check id | Requirement |
|----------|-------------|
| `split2_progressions_output` | ≥3 Split 2 progressions in Output |
| `split2_progressions_capacity` | ≥2 in Capacity |
| `split2_progressions_resilience` | ≥1 in Resilience |
| `progression_reuse_*` | Same progression exercise **at most once per phase** |
| `progression_difficulty_*` | Progression D > primary D |
| `progression_lane_*` | Progression shares **pattern tag or movement_family** with primary |
| `session_age_fit_warnings` | Zero session age-fit warnings |
| `split_variant_warnings` | ≤1 split variant warning |

## One iteration (agent — no user questions)

1. **Pull** — `git pull --ff-only`
2. **Unit tests**
   ```bash
   node --test backend/platform/__tests__/phaseAwarePrescription*.test.js \
     backend/platform/__tests__/restoreSelectionPolicy.test.js \
     backend/platform/__tests__/sustainedCapacityPolicy.test.js \
     backend/platform/__tests__/equipmentAvoidPolicy.test.js \
     backend/platform/__tests__/prescriptionQualityChecks.test.js
   ```
3. **Strict evaluator** (from repo root; `DATABASE_URL` in `backend/.env.local`)
   ```bash
   set -a && source backend/.env.local && set +a
   node scripts/evaluate-prescription-quality.mjs
   ```
   Baseline smoke (optional): `node scripts/evaluate-prescription-quality.mjs --tier=baseline`
4. **Fix failures** — priority: P0 → progression reuse/lane → stretch/youth → fill → warnings

   | Failure id | Typical fix |
   |------------|-------------|
   | `progression_reuse_*` | Per-phase reserved progression IDs in `resolvePerSplitVariants` |
   | `progression_lane_*` | Require pattern match in `sameProgressionLane`; add `exercise_progression` graph |
   | `progression_difficulty_*` | Tighten `pickSplitProgression` sort / min gap |
   | `split2_progressions_*` | Migration 226+ progression cards per pattern/phase |
   | `stretch_primaries_*` | Hard-exclude stretch at primary pick for Prepare/MI; cap-aware scoring |
   | `session_age_fit_warnings` | Split-aware warnings; don't score Split 2 picks against session cap 6 |
   | `mi_no_handstand_youth` | Youth MI slug blocklist or age filter on inversion drills |
   | `equipment_use_coverage` | Equipment-use boost in `buildPoolForPhase` scoring |
   | `phase_fill_*` | `fillPhaseItems` backfill / maxItems (see Round 2) |

5. **Re-run** tests + strict evaluator until exit 0.
6. **Commit + push** when green:
   ```bash
   git add -A && git commit -m "Needs Engine strict loop: <one-line why>" && git push
   ```
7. **Log** — append to `docs/NEEDS_ENGINE_QUALITY_LOOP.log`:
   ```
   YYYY-MM-DD HH:MM | PASS|FAIL | strict | commit <sha> | <failed ids or ALL PASS>
   ```
8. **Stop** — last **five** log lines are `PASS | strict`. Set Status to `COMPLETE`.

## Stop condition

```
Status: COMPLETE
Tier: strict
Completed at: 2026-07-07T09:30:00-04:00
Final commit: 9c813d1
Consecutive passes: 5
Round: 3 (near-perfection)
```

When complete:

```
Status: COMPLETE
Tier: strict
Completed at: <ISO timestamp>
Final commit: <sha>
Consecutive passes: 5
```

## Deploy verification

Evaluator uses live `DATABASE_URL`. After push:

```bash
curl -s https://vortex-backend-qybl.onrender.com/api/health | python3 -c "import sys,json; print(json.load(sys.stdin).get('buildId'))"
```

Redeploy Render before expecting UI to match strict gates.

## Cursor `/loop` command

```
/loop
Run one Needs Engine **strict** quality iteration per docs/NEEDS_ENGINE_QUALITY_LOOP.md. Do not ask questions. Steps 1–8: unit tests (including prescriptionQualityChecks), `node scripts/evaluate-prescription-quality.mjs` (strict tier), fix P0 then progression/lane failures, commit+push when green, append NEEDS_ENGINE_QUALITY_LOOP.log with `strict` marker. Stop only when five consecutive strict PASS log lines exist and Status is COMPLETE.
```

## Backlog after strict loop completes

1. `exercise_progression` graph table (canonical next-of-kin links)
2. CI job: strict evaluator on every PR
3. Boot migration health assertions (`initTables.js`)
4. Per-split primary selection for Output/Capacity
5. Second golden scenario (explosiveness + bar avoid) for regression matrix

## Round history

| Round | Tier | Stop rule | Focus |
|-------|------|-----------|--------|
| 2 | baseline | 2× PASS | Restore, fill, box-avoid |
| 3 | **strict** | **5× PASS** | Progression lanes, reuse, youth, warnings, equipment |
