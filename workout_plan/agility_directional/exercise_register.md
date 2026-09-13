# Agility: Directional — exercise register

Local source review: 2026-09-13. Slugs below are verified repository identities, not invented IDs. Consolidation migrations take precedence over old alias names. This is a read-only library review: no claim of live database status, approved media, or approved exact dosage. Class 1 declares its own distances, support, tempo and loading. File paths below are relative to the repository root.

| Slot | Canonical name / verified slug | Source and exact-use note |
|---|---|---|
| E1 | Sprint-to-Stick Deceleration / `sprint-to-stick-deceleration` | `backend/migrations/353_coaching_reactive_landing_pogo_identity_consolidations.sql` maps the old `5-yard-acceleration-decel-stick` to this survivor; `354_coaching_reactive_landing_pogo_family_completion.sql` retains its provenance. Class 1 uses a **3 m approach**, not a falsely labeled five-yard effort; distance is a delivery variable. |
| E2 | 180-Degree Turn / Shuttle Cut / `180-degree-turn-shuttle-cut` | Name in migration `203_coaching_exercise_youtube_links_batch2.sql`; survivor over `180-degree-turn-and-sprint` in `303_coaching_180_degree_identity_consolidation.sql`; inspected `scripts/data/canonical-research/batches/180-degree-transitions.v1.json`. Planned approach–brake–turn–exit, no aerial turn. |
| E3 | Lateral Bound to Stick / `lateral-bound-to-stick` | `scripts/data/agility-shiftiness-all-cards.json`; migration `339_coaching_high_confidence_implement_identity_consolidation.sql` consolidates `lateral-skater-bound-stick`. Inspected the latter's identity in `scripts/data/canonical-research/batches/landing-braking-progressions.v1.json`: single-leg takeoff to opposite-leg landing with 2 s hold. No rebound or two-foot landing. |
| E4 | Lateral Shuffle Decel Stick / `lateral-shuffle-decel-stick` | Migration `339_coaching_high_confidence_implement_identity_consolidation.sql` maps `lateral-shuffle-to-braking-stick` and `lateral-shuffle-to-stick` to this survivor. Exact class distance/hold supplied separately. |
| E5 | Planned Lateral Shuffle Reversal / **proposed addition; no verified identifier** | No exact matching identity was verified in the reviewed agility/cone sources and consolidation searches. Defined here as a known 2 m lateral entry, one planted return without changing facing, 2 m exit and final stop. It is not E4 renamed: an immediate return replaces E4's terminal hold. No database addition performed. |
| E6 | Crossover Step and Go / `crossover-step-and-go` | `scripts/data/agility-shiftiness-all-cards.json`; migrations `355_coaching_score_84_identity_boundaries.sql` and `385_coaching_score_77_identity_boundaries.sql` distinguish crossover-first running exit from drop-step entry and crossover-to-bound. Class 1 preserves those boundaries. |
| S1 | Lateral Step-Down / `lateral-step-down` | Name in migration `203_coaching_exercise_youtube_links_batch2.sql`; migration `339_coaching_high_confidence_implement_identity_consolidation.sql` absorbs the balance alias. Class version is low support, light and slow, not a heavy eccentric test. |
| S2 | Short-Foot Drill / `short-foot-drill` | Name/slug inspected in migration `204_coaching_exercise_youtube_links_batch3.sql`. Class specifies supported active arch holds; it does not use toe clawing or passive balance alone. |
| P1 | Split Squat / `split-squat`; variant `two-dumbbell-suitcase` | `scripts/data/canonical-research/batches/split-squat-family.v1.json`; `backend/migrations/370_coaching_split_squat_family_completion.sql` explicitly defines **Split Squat — Two Dumbbells**. Both feet remain on floor; not rear-foot elevated. |
| P2 | Romanian Deadlift / `romanian-deadlift` | `scripts/data/canonical-research/batches/romanian-deadlift-family.v1.json` defines bilateral loaded standing hinge and implement as a variant. Class declares two dumbbells, stable bilateral stance and 2 s lowering. |
| P3 | Lateral Lunge / `lateral-lunge` | `339_coaching_high_confidence_implement_identity_consolidation.sql` maps loaded, kettlebell and barbell lateral-lunge aliases to this survivor. Class uses one goblet dumbbell, step-out and push-back; no rotational reach. |
| P4 | Glute Bridge Iso Hold / `glute-bridge-iso-hold`; long-lever hamstring variant | `448_coaching_floor_bridge_identity_and_family_completion.sql` explicitly retains **Long-Lever Hamstring Bridge Iso Hold** as a variant. It preserves a static bilateral floor bridge; no sliding curl or dynamic hip-thrust rep is implied. |
| P5 | Copenhagen Side Plank / `copenhagen-side-plank`; short-lever variant | `382_coaching_score_79_variant_identity_consolidations.sql` maps `copenhagen-plank-short-lever` to `copenhagen-side-plank`. Knee/thigh support, assistance, load and hold are declared delivery variables. |
| P6 | Bent-Knee Soleus Raise / `bent-knee-soleus-raise`; seated variant | `376_coaching_score_82_variant_identity_consolidations.sql` maps `seated-soleus-raise-bent-knee-calf-raise` to this survivor. Class specifies seated bilateral support, floor forefeet and external thigh loading. |

**Replacement identities:** The exact S1 hand-supported shallow single-leg squat and P5 floor side-lying hip-adduction prescriptions are **proposed replacements with no verified identifiers in this review**. They occupy the original slot and need actual dosing/variant logs. Slower/shorter E1/E2/E5 and reduced E3 bound distance are dose changes within the original action. S2 bilateral support and P6 sandbag loading are declared support/implement changes, not additional exercises.

Other inspected records included `landing-braking-foundations.v1.json` and the older agility cards. Their descriptions are exercise-reference data, not permission to import old taxonomies, default rests, intensity settings or unsupported claims into this curriculum.

## Classes 2–12 — expanded register

The table identifies verified local records where found. Exact shortened routes, support policy and dosage are authored class variants; an existing family identifier does not certify that exact profile, current publication or athlete readiness. Entries without a verified matching identity remain proposed additions. Consolidated aliases were corrected for backpedal stops/turns, falling starts and single-leg hops using migrations 339 and 382. The complete movement distinctions are in [drill_index.md](drill_index.md).

| Class / slot | Class name | Verified local identifier and source, or proposal |
|---|---|---|
| 2 / E1 | Lateral Line Pogo | `lateral-line-pogo` — `scripts/data/jumping-height-exercise-library-all-50.json` |
| 2 / E2 | Shuffle-to-Sprint Transition | `shuffle-to-sprint-transition` — `scripts/data/agility-shiftiness-all-cards.json` |
| 2 / E3 | Lateral Open-Step to Sprint | `lateral-open-step-to-sprint` — `scripts/data/speed-sprinters-quick-release-all-cards.json` |
| 2 / E4 | Lateral Hop to Stick — bilateral | `lateral-hop-to-stick-low-amplitude` — `backend/migrations/129_coaching_control_resilience_seed.sql` |
| 2 / E5 | Skater Bound Continuous — one out-and-back pair | `skater-bound-continuous` — `scripts/data/explosiveness-all-cards.json` |
| 2 / E6 | Grounded Lateral Scoop Slam | Proposed exact drill; no verified identifier assigned. |
| 3 / E1 | Paused Split-Stance Diagonal Jump | Proposed exact drill; no verified identifier assigned. |
| 3 / E2 | 45-Degree Cut and Reaccelerate | `45-degree-cut-and-reaccelerate` — `scripts/data/agility-shiftiness-all-cards.json` |
| 3 / E3 | 45-Degree Cut-and-Stick | `45-degree-cut-and-stick` — `scripts/data/cone-drill-exercise-cards-all-50.json` |
| 3 / E4 | Crossover Bound to Stick | `crossover-bound` — `scripts/data/plyometrics-all-cards.json` |
| 3 / E5 | Split-Step to Diagonal Sprint | Proposed exact drill; no verified identifier assigned. |
| 3 / E6 | Single-Leg Diagonal Hop to Stick | Proposed exact drill; no verified identifier assigned. |
| 4 / E1 | Forward-Back Line Hops | `forward-back-line-hops` — `scripts/data/agility-shiftiness-all-cards.json` |
| 4 / E2 | Deceleration Re-Acceleration Sprint | `deceleration-re-acceleration-sprint` — `scripts/data/explosiveness-all-cards.json` |
| 4 / E3 | Falling Start Acceleration — short exit | `falling-start-to-10-yards` — `scripts/data/neural-training-all-cards.json` |
| 4 / E4 | Forward Run to Lateral Shuffle | Proposed exact drill; no verified identifier assigned. |
| 4 / E5 | Forward Hop to Stick — bilateral | `forward-hop-to-stick-low-amplitude` — `backend/migrations/129_coaching_control_resilience_seed.sql` |
| 4 / E6 | Single-Leg Forward Hop to Stick | `single-leg-hop-to-stick` — `scripts/data/jumping-distance-all-cards.json` |
| 5 / E1 | Quarter-Turn Jump to Stick — bilateral | Proposed exact drill; no verified identifier assigned. |
| 5 / E2 | 90-Degree Speed Cut | `90-degree-speed-cut` — `scripts/data/agility-shiftiness-all-cards.json` |
| 5 / E3 | Shuffle-to-Backpedal Corner | Proposed exact drill; no verified identifier assigned. |
| 5 / E4 | Single-Leg Lateral Hop to Stick | `single-leg-lateral-hop-to-stick` — `scripts/data/high-impact-level-3-4-exercise-cards-all-50.json` |
| 5 / E5 | Lateral Bound to Forward Sprint | Proposed exact drill; no verified identifier assigned. |
| 5 / E6 | Three-Point Diagonal Start | Proposed exact drill; no verified identifier assigned. |
| 6 / E1 | Backpedal-to-Stick | `backpedal-to-stick` — `scripts/data/cone-drill-exercise-cards-all-50.json` |
| 6 / E2 | Backpedal-to-Forward Reversal | Proposed exact drill; no verified identifier assigned. |
| 6 / E3 | Sprint-to-Backpedal Transition | `sprint-to-backpedal-transition` — `scripts/data/agility-shiftiness-all-cards.json` |
| 6 / E4 | Backward Two-Foot Jump to Stick | Proposed exact drill; no verified identifier assigned. |
| 6 / E5 | Drop-Step Crossover Go | `drop-step-crossover-go` — `scripts/data/neural-training-all-cards.json` |
| 6 / E6 | Backpedal-to-Sprint Turn — open, same travel heading | `backpedal-to-sprint-turn` — `scripts/data/neural-training-all-cards.json` |
| 7 / E1 | Split-Stance Pogo | `split-stance-pogo` — `scripts/data/jumping-height-exercise-library-all-50.json` |
| 7 / E2 | 135-Degree Running Cut | Proposed exact drill; no verified identifier assigned. |
| 7 / E3 | Drop-Step Decel Cone Box | `drop-step-decel-cone-box` — `scripts/data/cone-drill-exercise-cards-all-50.json` |
| 7 / E4 | Crossover Run to Stick | `crossover-run-to-stick` — `scripts/data/agility-shiftiness-all-cards.json` |
| 7 / E5 | Curved Run Decel | `curved-run-decel` — `scripts/data/agility-shiftiness-all-cards.json` |
| 7 / E6 | Rotational Bound to Stick | `rotational-bound-to-stick` — `scripts/data/explosiveness-all-cards.json` |
| 8 / E1 | Lateral Skip — two cycles | Proposed exact drill; no verified identifier assigned. |
| 8 / E2 | Curved Run to Cut | `curved-run-to-cut` — `backend/migrations/112_coaching_output_seed.sql` |
| 8 / E3 | Figure-8 Cone Run | `figure-8-cone-run` — `scripts/data/agility-shiftiness-all-cards.json` |
| 8 / E4 | Carioca Quick Hips | `carioca-quick-hips` — `scripts/data/agility-shiftiness-all-cards.json` |
| 8 / E5 | Diagonal-to-Lateral Bound Pattern | Proposed exact drill; no verified identifier assigned. |
| 8 / E6 | Shuffle Arc to Running Exit | Proposed exact drill; no verified identifier assigned. |
| 9 / E1 | W Drill Forward Cuts — short three-leg route | `w-drill-forward-cuts` — `scripts/data/cone-drill-exercise-cards-all-50.json` |
| 9 / E2 | Z Route — Two Square Corners | Proposed exact drill; no verified identifier assigned. |
| 9 / E3 | Triangle Shuffle-Sprint Drill | `triangle-shuffle-sprint-drill` — `scripts/data/cone-drill-exercise-cards-all-50.json` |
| 9 / E4 | U-Drill Turn-and-Go | `u-drill-turn-and-go` — `scripts/data/cone-drill-exercise-cards-all-50.json` |
| 9 / E5 | Forward Zigzag Bounds — two flights | Proposed exact drill; no verified identifier assigned. |
| 9 / E6 | Split-Stance Rotational Scoop Slam | Proposed exact drill; no verified identifier assigned. |
| 10 / E1 | W Drill Backpedal Cuts — short route | `w-drill-backpedal-cuts` — `scripts/data/cone-drill-exercise-cards-all-50.json` |
| 10 / E2 | Box Drill — Sprint, Shuffle, Backpedal | `box-drill-sprint-shuffle-backpedal` — `scripts/data/cone-drill-exercise-cards-all-50.json` |
| 10 / E3 | X Crossing Route — two obtuse plants | Proposed exact drill; no verified identifier assigned. |
| 10 / E4 | Crossover Run Reversal | Proposed exact drill; no verified identifier assigned. |
| 10 / E5 | Single-Leg Backward Hop to Stick | Proposed exact drill; no verified identifier assigned. |
| 10 / E6 | Quarter-Turn Single-Leg Hop to Stick | Proposed exact drill; no verified identifier assigned. |
| 11 / E1 | Two-Foot Lateral Jump to Single-Leg Landing | Proposed exact drill; no verified identifier assigned. |
| 11 / E2 | Planned Lateral Jab-to-Crossover Exit | Proposed exact drill; no verified identifier assigned. |
| 11 / E3 | V Shuttle to Opposite Diagonal | Proposed exact drill; no verified identifier assigned. |
| 11 / E4 | Two Forward Rebound Jumps | Proposed exact drill; no verified identifier assigned. |
| 11 / E5 | Single Forward Bound to Running Exit | Proposed exact drill; no verified identifier assigned. |
| 11 / E6 | Half-Kneeling Lateral Start | Proposed exact drill; no verified identifier assigned. |
| 12 / E1 | Gathered Stop-to-Diagonal Restart | Proposed exact drill; no verified identifier assigned. |
| 12 / E2 | M-Drill Multidirectional Cut — compact course | `m-drill-multidirectional-cut` — `scripts/data/cone-drill-exercise-cards-all-50.json` |
| 12 / E3 | Five-Cone Compass Route — known three-arm sequence | `5-cone-compass-drill` — `scripts/data/cone-drill-exercise-cards-all-50.json` |
| 12 / E4 | Three-Hop Directional Pattern — same leg | Proposed exact drill; no verified identifier assigned. |
| 12 / E5 | Crossover Run to Backpedal Exit | Proposed exact drill; no verified identifier assigned. |
| 12 / E6 | Single-Leg Lateral Push Jump to Two-Foot Landing | Proposed exact drill; no verified identifier assigned. |

**Recurring strength and light work:** Class 1 slugs remain in the original register. Additional inspected names/records: Reverse Lunge (`reverse-lunge`), Goblet Squat (`goblet-squat`), Single-Leg Romanian Deadlift (`single-leg-romanian-deadlift`), Hip Airplane — Supported (`hip-airplane-supported`), Dumbbell Hip Thrust (`dumbbell-hip-thrust`) and Standing Dumbbell Calf Raise (`standing-dumbbell-calf-raise`) in migration `203_coaching_exercise_youtube_links_batch2.sql`; Mini-Band Lateral Walk (`mini-band-lateral-walk`) in migration `204_coaching_exercise_youtube_links_batch3.sql`. The class uses declared support/load variants. Self-anchored ankle eversion and exact floor adduction alternatives remain proposed setups without invented IDs. No library/database records were modified.
