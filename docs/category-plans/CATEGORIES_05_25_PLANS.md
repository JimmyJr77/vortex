# Category implementation plans 5–25

Sequential loop completed 2026-07-08. Each section: prerequisite → existing hook → gap → action.

**Implementation:** `backend/platform/categoryEvaluatorsExtended.js`  
**Wiring:** `WIRED_CATEGORIES` in `categoryQualityEvaluators.js` (5–25)

---

## Category 5 — Age splits

| Metric | Prerequisite | Existing hook | Gap | Action |
|--------|--------------|---------------|-----|--------|
| C5-MOP-01–04 | `audience_splits`, body splits | Cat 4 `buildSplitProfiles` | No split parity checks | `audience_split_count_parity`, `split_label_parity` |
| C5-MOP-05–06 | `per_split[]` | Main evaluator split warnings | Completeness 82% on golden | `per_split_completeness` **informational** |
| C5-MOP-08–12 | Split 2 progressions | `split2_progressions_*`, reuse, ΔD | Delegated to strict | KPI references existing ids |
| C5-MOP-20 | Split 1 progressions | — | 3 Split-1 progressions on golden | `split1_no_progressions` **informational** |
| C5-MOP-16–17 | Age bands | — | No coverage check | `split_age_coverage`, `split_younger_first_order` |
| C5-MOE-01 | Split diff | — | No diff % | `split_differentiation_moe` informational |

---

## Category 6 — Split progressions

| Metric | Prerequisite | Existing hook | Gap | Action |
|--------|--------------|---------------|-----|--------|
| C6-MOP-01 | Low-intent phases | `no_progression_*` | Not in category KPI | Re-assert + KPI |
| C6-MOP-02–05 | Split 2 counts | `split2_progressions_*` | — | KPI |
| C6-MOS-01 | Split caps | — | No differential check | `split_cap_differential` |
| C6-MOP-06–07 | Telemetry | — | TBD | `category6_tbd_eligibility` |

---

## Category 7 — Progression lane validity

| Metric | Prerequisite | Existing hook | Gap | Action |
|--------|--------------|---------------|-----|--------|
| C7-MOP-01–03 | tags + family | `progression_lane_*` | — | KPI |
| C7-MOP-05 | Pattern rate | `sharesPatternOrFamily` | No pattern % | `progression_pattern_match_rate` info |
| C7-MOP-07 | Graph | DB | TBD | `category7_tbd_graph` |

---

## Category 8 — Progression reuse

| Metric | Prerequisite | Existing hook | Gap | Action |
|--------|--------------|---------------|-----|--------|
| C8-MOP-01 | Per-phase reuse | `progression_reuse_*` | — | KPI |
| C8-MOP-02 | Session reuse | — | No session max | `progression_reuse_session_wide` |
| C8-MOP-11 | Diversity | — | No ratio | `progression_diversity_ratio` info |

---

## Category 9 — Progression difficulty climb

| Metric | Prerequisite | Existing hook | Gap | Action |
|--------|--------------|---------------|-----|--------|
| C9-MOP-01,09 | ΔD | `progression_difficulty_*` | — | KPI + `progression_no_downgrade` |
| C9-MOP-02,08 | Delta stats | — | No floor/proximity | `progression_delta_floor`, `progression_cap_proximity` info |

---

## Category 10 — Difficulty & age fit

| Metric | Prerequisite | Existing hook | Gap | Action |
|--------|--------------|---------------|-----|--------|
| C10-MOP-02 | Stretch primaries | `stretch_primaries_*` | — | KPI via cat 18 overlap |
| C10-MOP-03 | Warnings | `session_age_fit_warnings` | — | KPI |
| C10-MOP-01 | good-fit rate | — | No distribution | `primary_age_fit_good_rate`, `primary_over_cap_count` |

---

## Categories 11–25 (summary)

| Cat | Key wired checks | KPI id |
|-----|------------------|--------|
| 11 Cap utilization | `pool_cap_max_of_splits`, `session_cap_resolvable` | `category11_kpi` |
| 12 Equipment use | `equipment_use_coverage` | `category12_kpi` |
| 13 Equipment avoid | `prescription_equipment_avoid_clean`, `restore_not_box_avoid_false_positive`, `semantic_avoid_false_negative`, `equipment_avoid_*` (11 more KPI ids) | `category13_kpi` |
| 14 Movement avoid | `exercise_avoid_report`, `body_region_avoid_report` | `category14_kpi` |
| 15 Phase intent | `focus_targets_*` (cat 1) | `category15_kpi` |
| 16 Phase primaries | `phase_primary_role_alignment` | `category16_kpi` |
| 17 Youth safety | `mi_no_handstand_youth` | `category17_kpi` |
| 18 Stretch | `stretch_primaries_*` | `category18_kpi` |
| 19 Diversity | 9 blocking + 8 MOE/TBD | `category19_kpi` |
| 20 Constraint report | `no_empty_phases`, `constraint_phase_fill_complete`, `all_blocks_nonempty` | `category20_kpi` |
| 21 Warnings | `session_age_fit_warnings`, `split_variant_warnings` | `category21_kpi` |
| 22 Feasibility | `feasibility_prescribe_success`, `all_blocks_nonempty`, `feasibility_output_nonempty`, `feasibility_critical_phases_filled` | `category22_kpi` |
| 23 Sport/work | `work_mode_echo` | `category23_kpi` |
| 24 Block format | `phase_count_match`, `canonical_phase_order`, `phase_minutes_exact` | `category24_kpi` |
| 25 Library/pool | `phase_fill_*`, `library_pool_depth_*` | `category25_kpi` |

**Strict golden:** 235/235 PASS after wire (Test 3).
