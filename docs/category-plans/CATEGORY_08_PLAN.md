# Category 8 — Progression reuse — Implementation Plan

Full prerequisite → build → assessment matrix (2026-07-09). Scoped to Category 8 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR/KPI** | 17 | Per-phase + session reuse, diversity, entropy, telemetry parity |
| **Informational MOE / backlog** | 7 | Variety, pattern proxy, justified reuse, clarity packet, stability, primary-as-prog, pattern-slot |
| **Manual MOE** | 2 | C8-MOE-01, C8-MOE-04 via rubric + automated proxies |
| **Synthetic KPI** | 1 | `category8_kpi` — 17 blocking ids + diversity index factor |

**Assessment readiness:** All 25 metrics assessable; golden Test 3 strict **Cat 8 checks PASS**.

## Prerequisite → assessment matrix (25 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C8-MOP-01 | Reuse per phase (exercise_id) | `per_split`, `maxProgressionReusePerPhase` | yes | `progression_reuse_output/capacity/resilience` | yes |
| C8-MOP-02 | Reuse session-wide | All progression ids session-wide | yes | `progression_reuse_session_wide` | yes |
| C8-MOP-03 | Reuse by normalized name | `normalizeExerciseName`, progression names | yes | `progression_reuse_normalized_name` | yes |
| C8-MOP-04 | Reuse by movement family | `movement_family` on progression exercise | yes | `progression_reuse_family_per_phase` | yes |
| C8-MOP-05 | Reuse by pattern tag | Primary pattern facet_ids | yes | `progression_reuse_pattern_per_phase` | yes (info) |
| C8-MOP-06 | phaseUsedProgressionIds cardinality | `phase_fill.phase_progression_ids` | yes | `progression_phase_ids_cardinality` | yes |
| C8-MOP-07 | Cross-phase same progression | Phase labels per progression id | yes | `progression_cross_phase_reuse` | yes |
| C8-MOP-08 | Primary as progression elsewhere | Primary + progression id cross-ref | yes | `progression_primary_as_progression` | yes (info) |
| C8-MOP-09 | Substituted id reuse as progression | `variant_type === 'substituted'` | yes | `progression_substituted_reuse` | yes |
| C8-MOP-10 | Reuse after backfill | `fill_pass` on items | yes | `progression_backfill_reuse` | yes |
| C8-MOP-11 | Progression diversity ratio | distinct ids / total slots | yes | `progression_diversity_ratio` | yes |
| C8-MOP-12 | Session progression entropy | Shannon entropy on id distribution | yes | `progression_session_entropy` | yes |
| C8-MOP-13 | usedExerciseIds includes progressions | Session dedup set from output | yes | `progression_used_ids_tracked` | yes |
| C8-MOP-14 | Unrelated-pattern reuse | Primary pattern tags per slot | yes | `progression_unrelated_pattern_reuse` | yes |
| C8-MOS-01 | Reuse threshold configured | golden `maxProgressionReusePerPhase` | yes | `progression_reuse_threshold_configured` | yes |
| C8-MOR-01 | Triple-phase reuse | Progression id → phases ≥ 3 | yes | `progression_triple_phase_reuse` | yes |
| C8-MOR-02 | High-adjScore progression monopoly | Usage / eligible primaries per phase | yes | `progression_adjscore_monopoly` | yes |
| C8-MOE-01 | Session variety perception | Coach Likert + review packet | yes | `category8_moe_variety_review_packet` | partial (manual) |
| C8-MOE-02 | Unique pattern per progression slot | Output pattern facet_ids | yes | `progression_unique_pattern_output` | yes (info) |
| C8-MOE-03 | Justified reuse | Pattern/family on reuse pairs | yes | `progression_justified_reuse_proxy` | yes (info) |
| C8-MOE-04 | Athlete confusion risk | Station names + scaling | yes | `category8_moe_station_clarity_packet` | partial (manual) |
| C8-MOE-05 | Reuse stability (lagging) | Eval history ≥5 runs | yes | `progression_reuse_stability` | yes (info) |
| C8-KPI-01 | Progression diversity index | Composite from MOP-01/11 | yes | `category8_kpi` | yes |

## KPI check ids (17 blocking)

`progression_reuse_output`, `progression_reuse_capacity`, `progression_reuse_resilience`, `progression_reuse_session_wide`, `progression_reuse_normalized_name`, `progression_reuse_family_per_phase`, `progression_phase_ids_cardinality`, `progression_cross_phase_reuse`, `progression_substituted_reuse`, `progression_backfill_reuse`, `progression_diversity_ratio`, `progression_session_entropy`, `progression_used_ids_tracked`, `progression_unrelated_pattern_reuse`, `progression_reuse_threshold_configured`, `progression_triple_phase_reuse`, `progression_adjscore_monopoly`

## MOE check ids (7 informational)

`category8_moe_variety_review_packet`, `progression_unique_pattern_output`, `progression_justified_reuse_proxy`, `progression_primary_as_progression`, `progression_reuse_pattern_per_phase`, `category8_moe_station_clarity_packet`, `progression_reuse_stability`

## Data & engine builds

| Build | File | Unblocks |
|-------|------|----------|
| `phase_progression_ids` on `phase_fill` | `phaseAwarePrescription.js` | C8-MOP-06 |
| `fill_pass` on items | `phaseAwarePrescription.js` | C8-MOP-10 |
| Eval history `cat8ProgressionIds` | `evalHistory.js`, `evaluate-prescription-quality.mjs` | C8-MOE-05 |
| Strict reuse thresholds | `golden-prescription-scenario.json`, `prescriptionQualityChecks.js` | C8-MOP-01, MOS-01 |

## Engine backlog (promote informational → blocking)

| Metric | Golden signal | Action |
|--------|---------------|--------|
| C8-MOP-08 | Primary id 3169 cross-used | Tighten session `usedExerciseIds` before progression pick |
| C8-MOP-05 | Output shared pattern slots | Promote when pool supports ≤1 progression per pattern facet |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Manual MOE: [`CATEGORY_8_MOE_RUBRIC.md`](../CATEGORY_8_MOE_RUBRIC.md)

## Status

**Complete assessable implementation** (2026-07-09).
