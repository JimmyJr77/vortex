# Category 4 — MOE rubric (Audience profile)

Manual assessments. **Not CI-blocking.**

## C4-MOE-01 — Session difficulty feels right (8–14 intermediate)

**Likert 1–5.** Pass ≥ 4/5.

**Automated signals:** `primary_age_fit_distribution`, `session_age_fit_warnings`, `audience_cap_overall`, `category4_moe_cap_utilization`

**Review packet:** `category4_moe_review_packet` (audience profile + age-fit summary)

---

## C4-MOE-04 — Caps not exceeded in practice

**Binary:** coach would not stop session for safety on first rep. Pass = Yes.

**Automated signals:** `primary_over_cap_count`, `session_age_fit_warnings`, `category4_moe_split1_headroom`

**Review packet:** `category4_moe_review_packet`

---

## Automated informational MOE

| Check ID | Metric |
|----------|--------|
| `category4_moe_output_emphasis` | C4-MOE-02 — Output minutes / total ≥ 30% |
| `category4_moe_cap_utilization` | C4-MOE-03 — Mean primary D / session cap ≥ 70% |
| `category4_moe_scaling_guidance` | C4-MOE-05 — ≥80% same/scaled variants have `scaling_guidance` |
| `category4_moe_pool_filter` | C4-MOE-06 — Sum of `phase_fill[].split_rejects` = 0 |
| `category4_moe_split1_headroom` | C4-MOE-07 — Split 1 cap minus max Split 1 variant D ≥ 0 |
| `audience_skill_level_adherence` | C4-MOP-11 — ≥95% items null or matching audience skill |

Log manual scores with `moe:cat4` in [`NEEDS_ENGINE_CATEGORY_LOOP.log`](NEEDS_ENGINE_CATEGORY_LOOP.log).
