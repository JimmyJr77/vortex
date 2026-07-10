# Category 1 — MOE rubric (Session structure & phasing)

Manual assessments for coach-facing quality. **Not CI-blocking.**

## C1-MOE-01 — Vortex flow coherence

**Scale (Likert 1–5)**

| Score | Criteria |
|-------|----------|
| 5 | Full canonical phase sequence; no gaps; transitions feel intentional |
| 4 | Sequence complete; one minor reorder would not change session |
| 3 | Sequence mostly coherent; one phase feels misplaced |
| 2 | Multiple phases feel out of order or redundant |
| 1 | Session does not read as warmup → skill → power → strength → resilience → conditioning → cooldown |

**Pass:** ≥ 4/5

**Inputs:** `blocks[]` phase order, labels, item lists (prescription output or builder view)

**Record:** reviewer name, date, session/scenario id, score, notes (1 line)

---

## C1-MOE-07 — Session reads as one arc

**Checklist (binary per phase)**

| Phase | Coach would run as labeled? | Notes |
|-------|----------------------------|-------|
| Prepare & Access | ☐ Yes ☐ No | |
| Movement Intelligence | ☐ Yes ☐ No | |
| Output | ☐ Yes ☐ No | |
| Capacity | ☐ Yes ☐ No | |
| Resilience | ☐ Yes ☐ No | |
| Sustained Capacity | ☐ Yes ☐ No | |
| Restore | ☐ Yes ☐ No | |

**Pass:** all phases Yes; Restore is last working downshift

---

## Automated informational MOE (eval script)

These run when `expectedBody` is passed to the strict evaluator; they **do not fail CI**:

| Check ID | Metric | Notes |
|----------|--------|-------|
| `category1_moe_high_intent_ratio` | C1-MOE-03 | High-intent minutes / total; band ≥ 75% |
| `category1_moe_prepare_share` | C1-MOE-04 | Prepare / total; band ≤ 12% |
| `category1_moe_mi_proportion` | C1-MOE-08 | MI / total; speed_priority 120m band 8–15% |
| `category1_moe_restore_prepare_ratio` | C1-MOE-09 | Restore / Prepare; band ≥ 0.30 |
| `category1_moe_restore_last` | C1-MOE-05 | Restore present and last block index |
| `category1_moe_review_packet` | C1-MOE-01, C1-MOE-07 | Phase list for coach manual review |
| `category1_moe_objective_template_proportions` | C1-MOE-02 | Per-phase % vs `buildPhasePlan` template; ≤1 phase outside ±5% |

Log manual scores with prefix `moe:cat1` in eval notes. Automated review packet: `category1_moe_review_packet`.
