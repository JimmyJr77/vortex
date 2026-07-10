# Category 25 — MOE rubric (Library & pool coverage)

Manual and lagging assessments. **Not CI-blocking** unless noted.

## C25-MOE-02 / C25-MOE-08 — Thin pool diagnosable / focus starvation

**Binary:** engineer can list top 3 missing card types and attribute thin Output pool to tenet vs equipment vs avoid.

**Review packet:** `category25_moe_review_packet` (`constraint_report.phase_fill`, `candidates_snapshot`, `thin_pool_phases`).

**Checklist:**

1. Each phase below floor has `pool_size`, `skipped_candidates`, and `split_rejects` in `phase_fill`.
2. Output Speed focus: verify tenet-3 tagged candidates vs total pool (`library_speed_tenet_pool`).
3. Equipment use/avoid sub-reports explain shrink when configured.
4. HIIT Sustained pool has methodology-1169 candidates (`library_hiit_methodology_pool`).
5. Actionable backlog item named (pattern, equipment, or progression lane).

---

## C25-MOE-01 — Library supports strict loop

**Partial automation:** `category25_moe_strict_loop_stability` over eval history (5/5 strict PASS).

**Manual remainder:** confirm no content-card edits between runs.

---

## C25-MOE-03 — Focus targets not over-constraining

**Partial automation:** `category25_moe_speed_pattern_diversity` — ≥ 5 distinct Output patterns.

**Manual remainder:** coach confirms Output block still feels like speed session, not generic conditioning.

---

## Automated informational MOE

| Check ID | Metric |
|----------|--------|
| `category25_moe_thin_pool_diagnosable` | C25-MOE-02 — thin phases flagged vs floors |
| `category25_moe_focus_starvation` | C25-MOE-04/08 — speed share + eligible count |
| `category25_moe_speed_pattern_diversity` | C25-MOE-03 — Output pattern count |
| `category25_moe_duration_stress` | C25-MOE-05 — 60 vs 120 min A/B (pending matrix) |
| `category25_moe_facility_parity` | C25-MOE-06 — staging vs prod library diff (pending) |
| `category25_moe_migration_guard` | C25-MOE-07 — pool_empty stability post-migration |
| `category25_moe_strict_loop_stability` | C25-MOE-01 — strict PASS streak |

Log manual scores with prefix `moe:cat25` in eval notes.
