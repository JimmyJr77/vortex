# Category 5 — Prerequisite-backed implementation prompt

You are a **process engineer + backend implementer** for the Vortex Needs Engine quality system.

### Objective

For **Category 5 — Age splits** only, produce an **implementation plan** that closes the gap between **measurement prerequisites** and **runnable MOP/MOE/MOS/MOR/KPI assessments**.

The plan must specify what to **build, wire, or instrument** so each Category 5 metric can actually be measured — not just whether it passes today.

Do **not** implement other categories. Do **not** mark the category complete until every metric row has: prerequisite status → build action → check id → blocking vs informational.

### Scope and boundaries

| Category | Owns | Delegates to |
|----------|------|--------------|
| **5** Age splits | Split definitions, `per_split` completeness, variant types, split caps echo, split-level MOE | **6–9:** progression presence, lane, reuse, ΔD (strict checks only) |
| **4** Audience | Session/split cap derivation (`mergeCapsMax`) | C5-MOP-04, C5-MOP-18 overlap |
| **7** Lane | Movement-lane credibility on progressions | C5-MOE-03 partial |

**Sources:** `audience_splits`, `items[].per_split`, `buildSplitProfiles` / `resolvePerSplitVariants` in [`phaseAwarePrescription.js`](../../backend/platform/phaseAwarePrescription.js).

**31 metrics:** 22 MOP, 7 MOE, 1 MOS, 1 MOR (+ synthetic `category5_kpi`).

### Test 3 anchors (golden scenario)

| Input / policy | Expected behavior |
|----------------|-------------------|
| `audienceSplits` | 2 splits: Split 1 (8–10, cap 6), Split 2 (11–14, cap 10) |
| Session ages | 8–14; split union covers full range (10 < 11 gap OK) |
| `per_split` completeness | Policy ≥95%; golden often ~82% (engine gap → informational) |
| Split 1 progressions | Policy 0; golden may show Split-1 progressions (engine gap → informational) |
| Split 2 progressions | Output ≥3, Capacity ≥2, Resilience ≥1 (strict; golden often 4+4+N) |
| `split_variant_warnings` | ≤1 strict; 0 ideal (golden: 0) |
| `variant_type === 'missing'` | 0 session-wide |

### Prerequisite-first workflow (Phase 0 before wiring)

**Do not assume prior wiring is correct.** For each of the 31 Category 5 metrics:

1. Read the metric row + `**C5-*-##** — Requires:` bullets in [`docs/NEEDS_ENGINE_QUALITY_CHECK.md`](../NEEDS_ENGINE_QUALITY_CHECK.md) (Category 5, ~lines 716–818).
2. Classify prerequisites per layer as **Available | Partial | Missing | TBD** against live code:

   | Layer | Status to verify | Cat 5 dependency |
   |-------|------------------|------------------|
   | **Session requirements** | prescribe `audienceSplits[]` (label, ageMin/Max, `difficultyOverride`) | C5-MOP-01–04, C5-MOS-01, C5-MOP-17–18 |
   | **Prescription output** | `result.audience_splits[]`, `items[].per_split[]`, `split_variant_warnings` | C5-MOP-05–07, C5-MOP-13, C5-MOP-19–20 |
   | **Per-split variant fields** | `split_label`, `variant_type`, `difficulty`, `difficulty_cap`, `scaling_guidance` | C5-MOP-14–15, C5-MOP-21–22 |
   | **Strict evaluator** | `prescriptionQualityChecks.js` progression + warning checks | C5-MOP-08–12, C5-MOP-13 |
   | **Cat 5 evaluator** | `evaluateCategory5Splits()` in `categoryEvaluatorsExtended.js` | C5-MOP-01–02, 05–06, 16–17, MOE info |
   | **Policy / engine replay** | `buildSplitProfiles`, `resolvePerSplitVariants`, `isSplit2Label` | C5-MOP-04, C5-MOP-18, C5-MOP-20 |
   | **Eval context** | `expectedBody.audienceSplits` vs `result.audience_splits`; `exercise_scaling_profile` for guidance | C5-MOP-21 |
   | **Coach review (MOE)** | Operational two-group session review | C5-MOE-05 only |

3. Only after Phase 0 audit: write the full matrix in [`CATEGORY_05_PLAN.md`](CATEGORY_05_PLAN.md):

   | Metric | Prerequisites | Prerequisite status | Build / instrument | Existing hook | Gap | Assessment action | check_id | Blocking? |

4. Implement builds marked **Partial | Missing** before adding new assessment checks.
5. Cross-check every id in `CATEGORY5_KPI_CHECK_IDS` against checks **actually emitted** on golden `npm run needs-engine:eval` — flag orphans and duplicates.

### Target metric → check_id routing (verify against code)

Use this as the acceptance checklist when writing `CATEGORY_05_PLAN.md`. Update rows where audit finds gaps.

| Metric | Target check_id(s) | Blocking? | Owner |
|--------|----------------------|-----------|-------|
| C5-MOP-01 | `audience_split_count_parity` | yes | cat5 |
| C5-MOP-02 | `split_label_parity` | yes | cat5 |
| C5-MOP-03 | `split_age_band_parity` *(build if missing)* | yes | cat5 |
| C5-MOP-04 | `split_cap_parity` *(build if missing)* | yes | cat5 |
| C5-MOP-05 | `per_split_completeness` | info (engine gap) | cat5 |
| C5-MOP-06 | `split_missing_variant_count` | yes | cat5 |
| C5-MOP-07 | `split_variant_distribution_*` *(info/doc per phase)* | info | cat5 |
| C5-MOP-08 | `split2_progressions_output` | yes | strict |
| C5-MOP-09 | `split2_progressions_capacity` | yes | strict |
| C5-MOP-10 | `split2_progressions_resilience` | yes | strict |
| C5-MOP-11 | `progression_reuse_output`, `progression_reuse_capacity`, `progression_reuse_resilience` | yes | strict |
| C5-MOP-12 | `progression_difficulty_output`, `progression_difficulty_capacity`, `progression_difficulty_resilience` | yes | strict |
| C5-MOP-13 | `split_variant_warnings` | yes | strict |
| C5-MOP-14 | `split1_cap_adherence` *(build if missing)* | yes | cat5 |
| C5-MOP-15 | `split2_cap_adherence` *(build if missing)* | yes | cat5 |
| C5-MOP-16 | `split_age_coverage` | yes | cat5 |
| C5-MOP-17 | `split_younger_first_order` | yes/info | cat5 |
| C5-MOP-18 | `split_cap_dimensions_parity` *(build if missing)* | yes | cat5 |
| C5-MOP-19 | `per_split_label_valid` *(build if missing)* | yes | cat5 |
| C5-MOP-20 | `split1_no_progressions` | info (engine gap) | cat5 |
| C5-MOP-21 | `category5_tbd_scaling_guidance` | TBD | cat5 |
| C5-MOP-22 | `per_split_difficulty_cap_echo` *(build if missing)* | yes | cat5 |
| C5-MOS-01 | `audience_splits_mos_valid` *(or reuse prescribe MOS + split extension)* | yes | cat5/MOS |
| C5-MOE-01 | `split_differentiation_moe` | info | cat5 |
| C5-MOE-02 | `split2_cap_exploitation_moe` *(build if missing)* | info | cat5 |
| C5-MOE-03 | `progression_lane_*` (Cat 7) + manual | partial/MOE | cat7 |
| C5-MOE-04 | `split_scaling_guidance_diff_moe` *(build if missing)* | info | cat5 |
| C5-MOE-05 | — | MOE | coach rubric optional |
| C5-MOE-06 | `split1_substituted_rate` *(info)* | info | cat5 |
| C5-MOE-07 | `split1_same_scaled_share` *(info)* | info | cat5 |
| C5-MOR-01 | `split_missing_variant_count` + high-intent phase filter | yes | cat5 |
| C5-KPI-01 | `category5_kpi` | yes | aggregate |

**Current `CATEGORY5_KPI_CHECK_IDS` (11 — must all emit on golden):**

`audience_split_count_parity`, `split_missing_variant_count`, `split_age_coverage`, `split_variant_warnings`, `split2_progressions_output`, `split2_progressions_capacity`, `split2_progressions_resilience`, `progression_reuse_output`, `progression_reuse_capacity`, `progression_difficulty_output`, `progression_difficulty_capacity`

Expand KPI list when new blocking checks are added (e.g. `split_label_parity`, `split_cap_parity`).

### Known gaps to explicitly address

| Gap | Metric(s) | Action |
|-----|-----------|--------|
| `per_split` completeness ~82% vs 95% target | C5-MOP-05 | **informational** until `resolvePerSplitVariants` fills all slots |
| Split 1 progressions on golden | C5-MOP-20 | **informational** (`split1_no_progressions`) until engine policy fixed |
| Split age/cap/difficulty_cap parity vs body | C5-MOP-03, 04, 18, 22 | Build replay vs `expectedBody.audienceSplits` + `buildSplitProfiles` |
| `scaling_guidance` + DB scaling profiles | C5-MOP-21 | `category5_tbd_scaling_guidance` + eval context loader |
| Progression metrics double-counted | C5-MOP-08–12 | Register in Cat 5 KPI only; Cat 6–9 own lane/reuse/ΔD depth |
| Split 1/2 cap per variant | C5-MOP-14–15 | Replay stretch policy + split caps (may share helpers with Cat 4/10) |

### Primary references (read in order)

1. [`docs/NEEDS_ENGINE_QUALITY_CHECK.md`](../NEEDS_ENGINE_QUALITY_CHECK.md) — Category 5 metric table + Measurement prerequisites
2. [`docs/NEEDS_ENGINE_CATEGORY_IMPLEMENTATION_LOOP.md`](../NEEDS_ENGINE_CATEGORY_IMPLEMENTATION_LOOP.md) — loop phases + gap table schema
3. [`docs/category-plans/CATEGORY_05_PLAN.md`](CATEGORY_05_PLAN.md) — replace stub with full 31-row matrix after Phase 0
4. [`backend/platform/categoryEvaluatorsExtended.js`](../../backend/platform/categoryEvaluatorsExtended.js) — `evaluateCategory5Splits`, `CATEGORY5_KPI_CHECK_IDS`, `computeCategory5Kpi`
5. [`backend/platform/prescriptionQualityChecks.js`](../../backend/platform/prescriptionQualityChecks.js) — `split2_progressions_*`, `progression_reuse_*`, `progression_difficulty_*`, `isSplit2Label`, `isSplit1Label`, `allPerSplitVariants`
6. [`backend/platform/phaseAwarePrescription.js`](../../backend/platform/phaseAwarePrescription.js) — `buildSplitProfiles`, `resolvePerSplitVariants`, `pickSplitProgression`
7. [`backend/platform/categoryQualityEvaluators.js`](../../backend/platform/categoryQualityEvaluators.js) — `buildSplitProfiles` replay (overlap Cat 4 pool cap)
8. [`scripts/evaluate-prescription-quality.mjs`](../../scripts/evaluate-prescription-quality.mjs) — golden eval CLI; `context.expectedBody`
9. [`scripts/golden-prescription-scenario.json`](../../scripts/golden-prescription-scenario.json) — Test 3 frozen body with `audienceSplits`

### Category boundary rules

- Implement **only** Category 5 metrics (`C5-MOP-*`, `C5-MOE-*`, `C5-MOS-*`, `C5-MOR-*`).
- Reuse strict evaluator checks for C5-MOP-08–12, C5-MOP-11–12, C5-MOP-13; register ids in `CATEGORY5_KPI_CHECK_IDS`.
- **Blocking?** values: `yes` | `info` | `MOE` | `TBD`.
- If golden Test 3 fails a new **blocking** check due to an engine/library gap, downgrade to **informational** and document the engine fix — do not silently drop the metric.

### MOP / MOS / MOR rules

- Every automatable MOP/MOS/MOR must map to a **concrete check_id** or an explicit **engine build** before the check can exist.
- Rows marked *(build if missing)* in the routing table are Phase 0 deliverables unless audit proves they already exist under another id.

### MOE rules

- Automatable MOE: emit with `detail.informational: true` — excluded from `category5_kpi` scored set.
- **C5-MOE-05** (coach two-group workable): manual only; add [`CATEGORY_5_MOE_RUBRIC.md`](../CATEGORY_5_MOE_RUBRIC.md) if ≥3 manual MOE warrant a rubric.
- **C5-MOE-03**: delegate lane signal to Cat 7 `progression_lane_*`; document manual remainder.

### Implementation phases (plan must include all)

#### Phase 0 — Prerequisite builds (do this first)

| Build | File(s) | Unblocks |
|-------|---------|----------|
| Split body ↔ result parity replay | `categoryEvaluatorsExtended.js` | C5-MOP-02–04, 17–18, 22 |
| `per_split` label validation | `categoryEvaluatorsExtended.js` | C5-MOP-19 |
| Split 1/2 cap adherence scanners | `categoryEvaluatorsExtended.js` + age-fit policy | C5-MOP-14–15 |
| `exercise_scaling_profile` in eval context | `evaluate-prescription-quality.mjs` | C5-MOP-21 |
| Variant distribution telemetry (optional) | evaluator info checks | C5-MOP-07 |

#### Phase A — Evaluator (`evaluateCategory5Splits`)

- Blocking: parity, coverage, missing variants, cap echo (as built in Phase 0)
- Informational: completeness, Split-1 progressions, differentiation MOE, substituted rate
- TBD stub: `category5_tbd_scaling_guidance`

#### Phase B — KPI (`CATEGORY5_KPI_CHECK_IDS` + `computeCategory5Kpi`)

- KPI references only check ids that **emit** on golden eval
- `computeCategory5Kpi` excludes `detail.informational` and `detail.tbd` (mirror Cat 3)

#### Phase C — Docs + status

- Update Category 5 **Auto** column per metric in `NEEDS_ENGINE_QUALITY_CHECK.md`
- Add strict-evaluator ↔ metric map rows for Cat 5 (mirror Cat 3 block ~lines 270–289)
- Engine backlog rows in plan + optional `DATABASE_ARCHITECTURE.md` §10 for `resolvePerSplitVariants` completeness

#### Phase D — Tests + verify

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

- Unit test: all `CATEGORY5_KPI_CHECK_IDS` present when `expectedBody` + splits in mock result
- Failure path: e.g. split count mismatch → `audience_split_count_parity` fails; or `split_age_coverage` fails when gap in ages

### Deliverables

1. **Phase 0 audit** — prerequisite layer status table + executive summary counts in `CATEGORY_05_PLAN.md`
2. **Full 31-row matrix** in `CATEGORY_05_PLAN.md` (prerequisite → build → assessment)
3. **`evaluateCategory5Splits()`** updates for any Phase 0 gaps
4. **`CATEGORY5_KPI_CHECK_IDS`** expanded to match all blocking checks
5. **`computeCategory5Kpi()`** — blocking-only aggregate
6. Unit tests for KPI presence + one failure path
7. Doc sync: Auto column, strict map, loop status if re-audit completes wiring

### Implementation pattern

```text
Phase 0 audit        → prerequisite matrix (Available/Partial/Missing/TBD)
Prerequisite build   → split/cap replay; scaling profile loader; per_split label validation
Strict evaluator     → split2_progressions_*, progression_reuse_*, progression_difficulty_*, split_variant_warnings
Cat 5 evaluator      → audience_split_count_parity, split_age_coverage, split_missing_variant_count, …
Informational        → per_split_completeness, split1_no_progressions, split_differentiation_moe, …
TBD stubs            → category5_tbd_scaling_guidance (excluded from KPI)
KPI aggregate        → category5_kpi over CATEGORY5_KPI_CHECK_IDS (blocking only)
```

### Gap-closure mode

When re-auditing existing wiring, prepend to the task:

> Category 5 is partially wired; diff `evaluateCategory5Splits` + `CATEGORY5_KPI_CHECK_IDS` against the target routing table and plan only **remaining** builds.

### Output format (required in `CATEGORY_05_PLAN.md`)

1. Executive summary — counts: MOP automated / MOE informational / MOE manual / TBD / engine builds required
2. Prerequisite layer status table
3. Prerequisite → Build → Assessment matrix (all 31 metrics)
4. Phase 0 build list (ordered; file paths)
5. Phase A–D checklist
6. Verification commands + expected golden result
7. Open backlog — engine items (`per_split` fill, Split-1 progression policy, scaling_guidance loader)

### Verification

Golden Test 3 strict tier must **PASS** after wiring (or document intentional informational downgrades with metric ids in the plan matrix).

All `CATEGORY5_KPI_CHECK_IDS` must appear in eval output when `expectedBody` is set and Test 3 splits are active.

---
