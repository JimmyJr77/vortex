# Category 3 — Restore phase — MOE rubric

Manual Measures of Effectiveness for Category 3. Automated MOP/MOR checks run in strict eval; these MOE items require coach review.

## When to use

After `npm run needs-engine:eval` passes blocking checks, a coach reviews the restore block in context of the **full session from the prescribe body** (not a fixed workout template).

## C3-MOE-06 — Restore feels like cooldown, not work

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4 |
| Reviewer | Coach familiar with session objective and audience |

**Prompt:** Does the restore block feel like intentional cooldown/recovery rather than additional training load?

## C3-MOE-08 — Post-conditioning downshift credible

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4 |
| Context | Apply when Sustained phase has **conditioning methodology focus** (`hasSustainedConditioningFocus` on prescribe body / result) |

**Prompt:** After the conditioning block, would an athlete feel recovered enough to leave the session—not rushed or still amped?

## Automated signals (non-blocking)

Use alongside manual scores:

| check_id | Metric | Notes |
|----------|--------|-------|
| `restore_high_arousal_after_sustained_conditioning` | C3-MOR-01 | No plyo/speed/neural methodology in restore after Sustained conditioning focus |
| `restore_equipment_avoid_clean` | C3-MOP-10 | Equipment avoid on restore items |
| `category3_moe_post_sustained_conditioning_reset` | C3-MOE-04 | After Sustained conditioning focus: diaphragmatic/positional/breathing match |
| `category3_moe_breathing` | C3-MOE-01 | ≥ 1 breathing-tagged or slug-matched restore item |
| `category3_moe_mobility` | C3-MOE-02 | ≥ 1 mobility/flexibility restore item |
| `category3_moe_arousal_downshift` | C3-MOE-03 | 0 high-arousal proxy signals (slug/methodology/impact heuristics) |
| `category3_moe_youth_hold_ceiling` | C3-MOE-05 | No unscaled holds >60s for youth |
| `category3_moe_bookend_overlap` | C3-MOE-07 | Prepare–Restore tag overlap ≥ 1 |
| `category3_moe_review_packet` | C3-MOE-06, C3-MOE-08 | Restore items + Sustained conditioning context for coach rubric |

## Recording

Log reviewer id, date, session requirements id, and Likert scores. **TBD:** send-to-builder edit telemetry for post-field validation.
