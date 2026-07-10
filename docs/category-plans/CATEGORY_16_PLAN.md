# Category 16 — Phase-appropriate primaries — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 16 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR (own)** | 15 | Containment, profile-role, ceilings, item minimums, programming kind, taxonomy |
| **Blocking (reused, earlier evaluators)** | 9 | `no_progression_*` ×4 (global), Cat 3 restore ×3, Cat 15 sustained/HIIT ×2 |
| **Informational MOP proxies** | 5 | Soft max-items, affinity, subrole share, conditional rate, single-item fill |
| **Informational MOE proxies** | 5 | Warmup read, MI quality, sustained conditioning, fatigue arc, prepare→output bridge |
| **Manual MOE** | 6 | C16-MOE-01, 02, 03, 05, 06, 08 → `category16_moe_review_packet` + rubric |
| **Synthetic KPI** | 1 | `category16_kpi` over `CATEGORY16_KPI_CHECK_IDS` (24 ids, min 95%) |

**Assessment readiness:** All 38 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (38 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C16-MOP-01 | No progressions in low-intent phases | `per_split[]` + phase filter | yes | `no_progression_prepare_and_access` / `_movement_intelligence` / `_sustained_capacity` / `_restore` | yes |
| C16-MOP-02 | Phase profile role valid | `exercise_phase_profile` role per assigned phase | yes | `phase_profile_role_not_avoid`, `phase_primary_role_alignment` | yes |
| C16-MOP-03 | No output-primary in Restore | Restore items + `primary_phase_key` | yes | `restore_no_output_primary` (Cat 3 reuse) | yes |
| C16-MOP-04 | No sustained-primary outside Sustained | non-Sustained items + `primary_phase_key` | yes | `sustained_primary_containment` | yes |
| C16-MOP-05 | Prepare impact ceiling | prepare-phase profile `impact_level` | yes | `prepare_impact_ceiling` (blocks ≥ 3; `impact=2` count in detail) | yes |
| C16-MOP-06 | Prepare methodology gate | methodology tags + prepare profile role/impact | yes | `prepare_methodology_gate` | yes |
| C16-MOP-07 | MI heavy-load ceiling (youth) | MI items + `difficulty.load` + ageMax | yes | `mi_heavy_load_youth` (load ≥ 7 → 0) | yes |
| C16-MOP-08 | Restore restoreCandidateExcluded | `restoreCandidateExcluded` replay | yes | `restore_candidate_policy_pass` (Cat 3 reuse) | yes |
| C16-MOP-09 | Sustained HIIT eligibility | `sustainedCapacityCandidateEligible(strict)` + `intentKeyById` | yes | `sustained_strict_hiit_gate` (Cat 15 reuse), `category16_moe_sustained_conditioning` | yes |
| C16-MOP-10 | Programming kind match | `exercise.programming_kind` + body `workMode` | yes | `programming_kind_matches_work_mode` | yes |
| C16-MOP-11 | Phase min items met | `minItemsForPhase` + resolved phase targets | yes | `phase_min_items_met` | yes |
| C16-MOP-12 | Phase max items respected | `maxItemsForPhase` (soft cap — engine backfills past it) | yes | `category16_mop_phase_max_items` | yes (info) |
| C16-MOP-13 | Order slot phase fit | profile `order_slot` + `phase_order_slot` taxonomy loader | yes | `order_slot_phase_taxonomy` | yes |
| C16-MOP-14 | No capacity-primary in low-intent phases | Prepare/MI/Restore items + `primary_phase_key` | yes | `capacity_primary_low_intent_leak` | yes |
| C16-MOP-15 | No resilience-primary outside Resilience | non-Resilience items + `primary_phase_key` | yes | `resilience_primary_containment` | yes |
| C16-MOP-16 | Prepare primary-phase affinity | prepare profile role share ≥ 80% | yes | `category16_mop_prepare_primary_affinity` | yes (info) |
| C16-MOP-17 | MI subrole coherence | `exercise.phase_subrole` in eval context | yes | `category16_mop_mi_subrole_coherence` | yes (info) |
| C16-MOP-18 | Low-intent difficulty ceiling | `difficulty.overall` + max(session, split) cap | yes | `low_intent_difficulty_ceiling` | yes |
| C16-MOP-19 | Conditional role rate | profile `role === 'conditional'` share per phase | yes | `category16_mop_conditional_role_rate` | yes (info) |
| C16-MOP-20 | HIIT methodology leak (non-Sustained) | methodology tags per phase | yes | `hiit_not_leaked_other_phases` (Cat 15 reuse) | yes |
| C16-MOP-21 | Sustained exclusion in other phases | strict gate + containment | yes | `sustained_strict_hiit_gate`, `sustained_primary_containment` | yes |
| C16-MOP-22 | Skill drill in exercise workMode | `programming_kind === 'skill_drill'` leak | yes | `programming_kind_matches_work_mode` | yes |
| C16-MOP-23 | Oversize single-item phase fill | single-item working-phase proxy | yes | `category16_mop_single_item_fill` | yes (info) |
| C16-MOS-01 | Phase profiles exist for library | non-avoid profile coverage ≥ 95% | yes | `phase_profile_coverage` | yes |
| C16-MOS-02 | Canonical phase keys in plan | `phasePlan[].phaseKey` vs `SESSION_PHASE_ORDER` + `other` | yes | `phase_plan_keys_canonical` | yes |
| C16-MOE-01 | Prepare reads as warmup | coach rubric; difficulty/arousal proxy | yes | `category16_moe_prepare_warmup` + `category16_moe_review_packet` | partial (manual) |
| C16-MOE-02 | MI reads as movement quality | coach rubric; HIIT/load proxy | yes | `category16_moe_mi_quality` + packet | partial (manual) |
| C16-MOE-03 | High-intent block intent clear | coach per-phase coherence rubric | yes | `category16_moe_review_packet` | partial (manual) |
| C16-MOE-04 | Sustained is conditioning block | strict eligibility share proxy | yes | `category16_moe_sustained_conditioning` | yes (info) |
| C16-MOE-05 | Restore is downshift only | coach rubric; Cat 3 arousal proxy | yes | `category3_moe_arousal_downshift` (Cat 3) + packet | partial (manual) |
| C16-MOE-06 | Fatigue arc readable | mean-difficulty arc proxy + coach rubric | yes | `category16_moe_fatigue_arc` + packet | partial (manual) |
| C16-MOE-07 | Prepare primes Output patterns | `sharesPatternOrFamily` bridge count | yes | `category16_moe_prepare_output_bridge` | yes (info) |
| C16-MOE-08 | Phase labels match floor execution | coach floor-execution parity | yes | `category16_moe_review_packet` | partial (manual) |
| C16-MOR-01 | Heavy load in youth MI | same detector as C16-MOP-07 | yes | `mi_heavy_load_youth` | yes |
| C16-MOR-02 | High-arousal methodology in Restore | restore methodology exclusion replay | yes | `restore_excluded_methodology` (Cat 3 reuse) | yes |
| C16-MOR-03 | Progression in low-intent phase | same detectors as C16-MOP-01 | yes | `no_progression_*` (4 ids) | yes |
| C16-MOR-04 | Output-primary in Prepare/MI (youth) | `primary_phase_key` + ageMax ≤ 14 | yes | `youth_output_primary_low_intent` | yes |
| C16-KPI-01 | Phase role fit index | blocking pass rate ≥ 95% | yes | `category16_kpi` | yes |

## KPI check ids (`CATEGORY16_KPI_CHECK_IDS` — 24 blocking)

Reused (run before Category 16): `no_progression_prepare_and_access`, `no_progression_movement_intelligence`, `no_progression_sustained_capacity`, `no_progression_restore`, `restore_no_output_primary`, `restore_candidate_policy_pass`, `restore_excluded_methodology`, `sustained_strict_hiit_gate`, `hiit_not_leaked_other_phases`.

Own: `phase_primary_role_alignment`, `phase_profile_role_not_avoid`, `phase_profile_coverage`, `sustained_primary_containment`, `capacity_primary_low_intent_leak`, `resilience_primary_containment`, `prepare_impact_ceiling`, `prepare_methodology_gate`, `mi_heavy_load_youth`, `youth_output_primary_low_intent`, `low_intent_difficulty_ceiling`, `phase_min_items_met`, `programming_kind_matches_work_mode`, `order_slot_phase_taxonomy`, `phase_plan_keys_canonical`.

## MOE check ids (`CATEGORY16_MOE_CHECK_IDS` — 11 informational)

`category16_mop_prepare_primary_affinity`, `category16_mop_mi_subrole_coherence`, `category16_mop_conditional_role_rate`, `category16_mop_single_item_fill`, `category16_mop_phase_max_items`, `category16_moe_prepare_warmup`, `category16_moe_mi_quality`, `category16_moe_sustained_conditioning`, `category16_moe_fatigue_arc`, `category16_moe_prepare_output_bridge`, `category16_moe_review_packet`.

## Threshold decisions (validated against golden Test 3)

| Decision | Rationale |
|----------|-----------|
| `prepare_methodology_gate` exempts curated low-impact elastic | Jump-rope easy bounce / line hops / A-march carry `plyometrics` tags but have primary/secondary prepare profiles with impact < 3 — legitimate speed-session warmup. `hiit`/`neural_output` always block. |
| `prepare_impact_ceiling` blocks at impact ≥ 3 (not the plan's ≥ 2) | Aligns with Cat 17 `youth_prepare_mi_impact_ceiling`; impact = 2 count surfaced in check detail. |
| `low_intent_difficulty_ceiling` uses max(session, split) cap | Shared primaries are sized to the highest-cap split; Split 1 receives scaled `per_split` variants. |
| C16-MOP-12 informational | `maxItemsForPhase` is a soft cap: engine backfill passes `maxItems: null` on time-underfill, so exceeding it is engine-intended (golden: Prepare 8/6, Resilience 6/3). |

## Engine backlog (document only)

| Metric | Backlog item | Tracking |
|--------|--------------|----------|
| C16-MOP-12 | Decide whether `maxItemsForPhase` should hard-cap backfill | `category16_mop_phase_max_items` informational band ≤ 2 |
| C16-MOP-19 | Conditional-role share exceeds 15% on some phases (golden 33%) | `category16_mop_conditional_role_rate` informational |
| C16-MOP-23 | Per-item minute telemetry for true ≥70% single-item fill detection | `category16_mop_single_item_fill` item-count proxy |

## Eval context additions (scripts/evaluate-prescription-quality.mjs)

- `phase_subrole` added to the exercise SELECT (C16-MOP-17)
- `intentKeyById` loader (`coaching.exercise_intent`) for strict sustained gate replay
- `phaseOrderSlotKeysByPhase` loader (`coaching.phase_order_slot` × `session_phase`) for C16-MOP-13

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3 strict PASS; `category16_kpi` 100% (24/24). Manual MOE: [`CATEGORY_16_MOE_RUBRIC.md`](../CATEGORY_16_MOE_RUBRIC.md).
