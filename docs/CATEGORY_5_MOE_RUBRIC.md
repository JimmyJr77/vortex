# Category 5 — MOE rubric (Age splits)

Manual assessments. **Not CI-blocking.**

## C5-MOE-05 — One session, two groups workable

**Binary:** coach can run both age splits in one session without rewriting the plan. Pass = Yes.

**Review packet:** `category5_moe_review_packet` (split labels, age bands, caps, completeness rate).

**Checklist:**

1. Each split has a distinct cap-appropriate variant on high-intent items (Output/Capacity/Resilience).
2. Progressions appear only on the older/higher-cap split (Split 2).
3. Scaling notes are actionable per split when variants differ.
4. Equipment and space allow parallel coaching of both groups.
5. No item forces the coach to stop and substitute mid-session for one group only.

---

## C5-MOE-03 — Progressions coach-credible

**Partial automation:** Cat 7 `progression_lane_{phase}` strict checks when enabled.

**Manual remainder:** coach confirms progression pairs feel like same movement lane (≥ 80% target).

---

## Automated informational MOE

| Check ID | Metric |
|----------|--------|
| `split_differentiation_moe` | C5-MOE-01 — ≥ 30% items differ by exercise or variant type Split1 vs Split2 |
| `split2_cap_exploitation_moe` | C5-MOE-02 — Mean D Split2 − Split1 ≥ 1.5 in Output/Capacity |
| `split_scaling_guidance_diff_moe` | C5-MOE-04 — ≥ 50% same-variant pairs have split-specific guidance |
| `split1_substituted_rate_moe` | C5-MOE-06 — Split 1 substituted rate ≤ 25% |
| `split1_same_scaled_share_moe` | C5-MOE-07 — Split 1 same+scaled share ≥ 60% |

Log manual scores with prefix `moe:cat5` in eval notes.
