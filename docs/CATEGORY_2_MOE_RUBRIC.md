# Category 2 — MOE rubric (Phase time fill)

Manual assessments for coach-facing fill quality. **Not CI-blocking.**

## C2-MOE-01 — Phase feels full, not padded

**Scale (Likert 1–5)** — Output and Capacity blocks

| Score | Criteria |
|-------|----------|
| 5 | No obvious dead time; dose and rest support quality reps |
| 4 | Minor pacing tweak possible; still coachable as-is |
| 3 | One phase feels thin or padded |
| 2 | Multiple phases feel under-filled or artificially stretched |
| 1 | Athletes would finish early or repeat drills to fill time |

**Pass:** ≥ 4/5 per reviewed phase

**Inputs:** Output/Capacity `items[]` with sets, rest, work_seconds; `estimated_minutes` vs `target_minutes`

**Automated signal:** `phase_underfill_gap` (informational), `phase_fill_*`

---

## C2-MOE-06 — Transition time realistic

**Checklist**

| Phase | Item count | Est. transition load | Coachable? |
|-------|------------|----------------------|------------|
| Prepare | | | ☐ |
| MI | | | ☐ |
| Output | | | ☐ |
| Capacity | | | ☐ |
| Resilience | | | ☐ |
| Sustained | | | ☐ |

**Pass:** all phases Yes; transitions ~30–90s between stations reasonable for youth

---

## C2-MOE-07 — No single drill dominates phase

**Pass:** coach would not rewrite block because one exercise consumes the phase

**Automated signal:** `phase_item_dominance` (≤35% of phase seconds per item, except Sustained intervals)

---

## Automated informational MOE (eval script)

| Check ID | Metric | Notes |
|----------|--------|-------|
| `category2_moe_prepare_density` | C2-MOE-02 | Prepare items/min; youth band 0.6–1.0 items/min |
| `category2_moe_sustained_conditioning_focus` | C2-MOE-03 | Sustained fill ≥80% AND ≥2 conditioning-tagged items when Sustained has conditioning focus |
| `category2_moe_fatigue_curve` | C2-MOE-05 | Pre-Sustained minutes / total ≥ 55% |
| `category2_moe_chronic_underfill` | C2-MOE-04 | No phase <70% fill in last 5 strict eval runs |
| `category2_fill_stability` | C2-MOP-14 | Per-phase fill_pct σ ≤ 3% over 5 runs |
| `phase_backfill_contribution` | C2-MOP-10 | Backfill item minutes share per phase |
| `phase_backfill_item_share` | C2-MOP-17 | Alert when backfill items > 50% of phase |
| `category2_moe_review_packet` | C2-MOE-01, 06, 07 | Output/Capacity review payload for coach rubric |

Log manual scores in [`NEEDS_ENGINE_CATEGORY_LOOP.log`](NEEDS_ENGINE_CATEGORY_LOOP.log) with `moe:cat2` prefix.
