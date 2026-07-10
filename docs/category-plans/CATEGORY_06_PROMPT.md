# Category 6 — Prerequisite-backed implementation prompt

You are a **process engineer + backend implementer** for the Vortex Needs Engine quality system.

### Objective

For **Category 6 — Split progressions** only, produce an **implementation plan** that closes the gap between **measurement prerequisites** and **runnable MOP/MOE/MOS/MOR/KPI assessments**.

The plan must specify what to **build, wire, or instrument** so each Category 6 metric can actually be measured — not just whether it passes today.

Do **not** implement other categories. Do **not** mark the category complete until every metric row has: prerequisite status → build action → check id → blocking vs informational.

### Scope and boundaries

| Category | Owns | Delegates to |
|----------|------|--------------|
| **6** Split progressions | Progression phase allowlist, highest-cap split placement, totals, headroom, ID/slug hygiene, relaxSplit policy, fallback rate, progression scaling guidance | **5:** split definitions / `split1_no_progressions` emit; **7–9:** lane, reuse, ΔD (strict checks registered in KPI only) |
| **7** Lane | `sameProgressionLane` / pattern-family credibility | C6 does not re-implement lane checks |
| **8–9** Reuse / ΔD | `progression_reuse_*`, `progression_difficulty_*` | Strict evaluator owns; Cat 6 KPI registers ids |

**Sources:** `resolvePerSplitVariants`, `pickSplitProgression`, `shouldRelaxSplitGate`, `phaseUsedProgressionIds` in [`phaseAwarePrescription.js`](../../backend/platform/phaseAwarePrescription.js).

**30 metrics:** 19 MOP, 6 MOE, 2 MOS, 2 MOR, 1 KPI (+ synthetic `category6_kpi`).

### Body-driven assessment (mandatory)

Do **not** hard-code workout-type or age-band regex as the primary split selector.

| Policy | Implementation |
|--------|----------------|
| Progression split | Highest `caps.maxOverall` label(s) from `result.audience_splits` (or prescribe body when result empty) |
| Younger split | Lowest-cap label(s) from same source |
| Regex fallback | `isSplit2Label` / `isSplit1Label` only when caps absent |

Test 3 uses Split 1 (cap 6) and Split 2 (cap 10) — the **cap ordering** drives labels, not the literal `11–14` string.

### Test 3 anchors (golden scenario)

| Input / policy | Expected behavior |
|----------------|-------------------|
| `audienceSplits` | 2 splits: younger (cap 6), older (cap 10) |
| Progression phases | Output, Capacity, Resilience only |
| Low-intent phases | 0 progressions (`no_progression_*` including `sustained_capacity`) |
| Split-2 progression mins | Output ≥3, Capacity ≥2, Resilience ≥1 (strict) |
| Split-2 total | ≥6 session-wide (cat6 blocking) |
| Younger split | 0 progressions (`split1_no_progressions`) |
| Headroom | Progression D > primary D on every pair |
| `shouldRelaxSplitGate` | false in Output/Capacity/Resilience |
| `scaling_guidance` on progressions | ≥80% (engine `resolveSplitScalingGuidance` fallback) |

### Prerequisite-first workflow (Phase 0 before wiring)

**Do not assume prior wiring is correct.** For each Category 6 metric:

1. Read the metric row + `**C6-*-##** — Requires:` bullets in [`docs/NEEDS_ENGINE_QUALITY_CHECK.md`](../NEEDS_ENGINE_QUALITY_CHECK.md) (Category 6, ~lines 984–1081).
2. Classify prerequisites per layer as **Available | Partial | Missing | TBD**:

   | Layer | Status to verify | Cat 6 dependency |
   |-------|------------------|------------------|
   | **Session requirements** | prescribe `audienceSplits[]` length ≥ 2 | C6-MOS-02 |
   | **Prescription output** | `per_split` progressions, `split_fallback_used`, `audience_splits` | C6-MOP-02–05, 08–10, 14–16 |
   | **Strict evaluator** | `no_progression_*`, `split2_progressions_*` | C6-MOP-03–05, low-intent allowlist |
   | **Cat 6 evaluator** | `evaluateCategory6Progressions()` | C6-MOP-01–02, 09–10, 13–16, 18 |
   | **Engine** | `resolvePerSplitVariants`, scaling guidance, relaxSplit | C6-MOP-06–12, 17–18 |
   | **Eval context** | `exerciseById`, `phaseProfileMap`, `scalingProfileByExerciseId` | C6-MOP-15, 18–19 |
   | **Cat 5 overlap** | `split1_no_progressions` | C6-MOP-08 — register, do not duplicate |

3. Only after Phase 0 audit: write the full matrix in [`CATEGORY_06_PLAN.md`](CATEGORY_06_PLAN.md).
4. Implement builds marked **Partial | Missing** before adding blocking checks.
5. Cross-check every id in `CATEGORY6_KPI_CHECK_IDS` against checks **actually emitted** on `npm run needs-engine:eval`.

### Target metric → check_id routing (verify against code)

| Metric | Target check_id(s) | Blocking? | Owner |
|--------|----------------------|-----------|-------|
| C6-MOP-01 | `progression_phase_allowlist` | yes | cat6 |
| C6-MOP-02 | `split2_total_progressions` | yes | cat6 |
| C6-MOP-03 | `split2_progressions_output` | yes | strict |
| C6-MOP-04 | `split2_progressions_capacity` | yes | strict |
| C6-MOP-05 | `split2_progressions_resilience` | yes | strict |
| C6-MOP-06/07 | `category6_tbd_eligibility` | TBD | stub |
| C6-MOP-08 | `split1_no_progressions` | yes | cat5/cat6 |
| C6-MOP-09 | `split2_progressions_label_only` | yes | cat6 |
| C6-MOP-10 | `progression_headroom_valid` | yes | cat6 |
| C6-MOP-11 | — | no | engine replay backlog |
| C6-MOP-12 | — | no | engine replay backlog |
| C6-MOP-13 | `progression_relax_split_off` | yes | cat6 |
| C6-MOP-14 | `split_fallback_used_rate` | yes | cat6 |
| C6-MOP-15 | `progression_slug_unique` | yes | cat6 |
| C6-MOP-16 | `progression_primary_id_distinct` | yes | cat6 |
| C6-MOP-17 | `category6_tbd_phase_prog_ids` | TBD | stub |
| C6-MOP-18 | `progression_scaling_guidance_rate` | yes | cat6 + engine |
| C6-MOP-19 | `progression_phase_profile_role` | conditional | cat6 |
| C6-MOS-01 | `split_cap_differential` | yes | cat6 |
| C6-MOS-02 | `audience_splits_active` | yes | cat6 |
| C6-MOR-01/02 | — | TBD | backlog |
| C6-MOE-02 | `category6_moe_progression_arc` | info | cat6 |
| C6-MOE-03 | `category6_moe_split2_policy` | info | cat6 |
| C6-MOE-04 | `category6_moe_pool_reject_signal` | info | cat6 |
| C6-MOE-01/05/06 | — | MOE/TBD | manual / backlog |
| C6-KPI-01 | `category6_kpi` | yes | aggregate |

**Current `CATEGORY6_KPI_CHECK_IDS` (19 — must all emit on golden when splits active):**

`progression_phase_allowlist`, `no_progression_prepare_and_access`, `no_progression_movement_intelligence`, `no_progression_sustained_capacity`, `no_progression_restore`, `split2_progressions_output`, `split2_progressions_capacity`, `split2_progressions_resilience`, `split2_total_progressions`, `split1_no_progressions`, `split2_progressions_label_only`, `progression_headroom_valid`, `progression_primary_id_distinct`, `progression_slug_unique`, `split_fallback_used_rate`, `split_cap_differential`, `audience_splits_active`, `progression_relax_split_off`, `progression_scaling_guidance_rate`

**Critical id fix:** Use `no_progression_sustained_capacity` — not `no_progression_sustained`.

### Known gaps to explicitly address

| Gap | Metric(s) | Action |
|-----|-----------|--------|
| Wrong phase key `sustained` vs `sustained_capacity` | low-intent `no_progression_*` | Canonical key from `prescriptionQualityChecks.js` |
| Regex-only Split 2 label | C6-MOP-02, 09 | **Body-driven** `highestCapSplitLabels()` |
| `split2_total_progressions` informational | C6-MOP-02 | **Blocking** ≥6 when splits active |
| Progression `scaling_guidance` sparse | C6-MOP-18 | Engine `resolveSplitScalingGuidance` fallback |
| Eligibility/coverage telemetry | C6-MOP-06/07 | `category6_tbd_eligibility` stub |
| `phaseUsedProgressionIds` not exported | C6-MOP-17 | `category6_tbd_phase_prog_ids` stub |
| Lane/reuse/ΔD double implementation | — | Register strict ids in KPI; Cat 7–9 own depth |

### Primary references (read in order)

1. [`docs/NEEDS_ENGINE_QUALITY_CHECK.md`](../NEEDS_ENGINE_QUALITY_CHECK.md) — Category 6 metric table + Measurement prerequisites
2. [`backend/platform/categoryEvaluatorsExtended.js`](../../backend/platform/categoryEvaluatorsExtended.js) — `evaluateCategory6Progressions`, `CATEGORY6_KPI_CHECK_IDS`
3. [`backend/platform/prescriptionQualityChecks.js`](../../backend/platform/prescriptionQualityChecks.js) — strict `no_progression_*`, `split2_progressions_*`
4. [`backend/platform/phaseAwarePrescription.js`](../../backend/platform/phaseAwarePrescription.js) — progression assignment + scaling guidance
5. [`scripts/evaluate-prescription-quality.mjs`](../../scripts/evaluate-prescription-quality.mjs) — eval context loaders
6. [`docs/category-plans/CATEGORY_05_PLAN.md`](CATEGORY_05_PLAN.md) — split boundary reference
7. [`docs/NEEDS_ENGINE_CATEGORY_IMPLEMENTATION_LOOP.md`](../NEEDS_ENGINE_CATEGORY_IMPLEMENTATION_LOOP.md) — body-driven rule

### Deliverables

1. **`evaluateCategory6Progressions()`** in `categoryEvaluatorsExtended.js` — all automatable blocking checks
2. **`CATEGORY6_KPI_CHECK_IDS`** + **`computeCategory6Kpi()`** — 19-id aggregate
3. Wire via **`runCategoryEvaluators()`** when `context.expectedBody` is set (already in `EXTENDED_CATEGORY_REGISTRY`)
4. Engine fix when golden blocks on output fields (e.g. `scaling_guidance`)
5. Unit tests in `prescriptionQualityChecks.test.js` (KPI presence + one failure path)
6. Full matrix in **`CATEGORY_06_PLAN.md`**
7. Update Category 6 **Auto** column in `NEEDS_ENGINE_QUALITY_CHECK.md`
8. Update `NEEDS_ENGINE_CATEGORY_LOOP_STATUS.json` with `re_audit` note

### Implementation pattern

```text
Pre-prescribe MOS  → audience_splits cap differential + splits active (cat6)
Post-prescribe MOP → strict phase-min checks + cat6 policy scans
Informational MOE  → category6_moe_* checks (detail.informational)
TBD stubs          → category6_tbd_* (detail.tbd, non-blocking)
KPI aggregate      → category6_kpi over CATEGORY6_KPI_CHECK_IDS
```

### Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Golden Test 3 must remain **ALL PASS** after Category 6 wiring.

---