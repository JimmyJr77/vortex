# Category 20 — MOE rubric (Constraint report health)

Manual assessments. **Not CI-blocking.**

## C20-MOE-01 — Engine failure explainable

**Binary:** coach or engineer can read `constraint_report` and understand why a phase pool is thin. Pass = Yes.

**Review packet:** `category20_moe_review_packet` (`constraint_report`, `thin_pool_phases`, `session_skip_ratio`).

**Checklist:**

1. Each `phase_fill` row shows plausible `pool_size`, `skipped_candidates`, and `split_rejects`.
2. `empty_phase_reasons` (if any) use taxonomy labels the reader recognizes.
3. Avoid sub-reports explain exclusions when avoid filters are active.

---

## C20-MOE-06 — Root-cause time bounded

**Binary:** engineer diagnoses a prescribe failure from `constraint_report` alone in < 5 minutes. Pass = Yes.

**Review packet:** full `constraint_report` from `category20_moe_review_packet`.

**Timed drill:** given a marginal scenario export, record minutes-to-root-cause. Target < 5.

---

## Automated informational MOE

| Check ID | Metric |
|----------|--------|
| `category20_moe_underfill_masking` | C20-MOE-02 — ≤ 1 phase with single item AND fill < 80% |
| `category20_moe_pool_empty_stability` | C20-MOE-03 — 0 `pool_empty` in 5/5 consecutive strict eval runs |

## TBD stubs (informational, non-blocking)

| Check ID | Metric |
|----------|--------|
| `category20_tbd_split_reject_codes` | C20-MOE-04 — split reject reason codes in report |
| `category20_tbd_pool_playbook` | C20-MOE-05 — library team thin-pool playbook |
| `category20_tbd_skip_breakdown` | C20-MOE-07 — dedup/stretch/split/avoid skip driver breakdown |

Log manual scores with prefix `moe:cat20` in eval notes.
