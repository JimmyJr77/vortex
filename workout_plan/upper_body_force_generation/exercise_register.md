# Exercise identity register — Classes 1–12

The Class 1 identities appear below. Every later class has a complete per-slot identity and exact-execution table in its linked audit; proposed rapid variants remain explicitly labeled. No new library records or approval identifiers were created.

[Class 2](class_02_audit.md) · [Class 3](class_03_audit.md) · [Class 4](class_04_audit.md) · [Class 5](class_05_audit.md) · [Class 6](class_06_audit.md) · [Class 7](class_07_audit.md) · [Class 8](class_08_audit.md) · [Class 9](class_09_audit.md) · [Class 10](class_10_audit.md) · [Class 11](class_11_audit.md) · [Class 12](class_12_audit.md)

## Class 1 identities

Checked local repository sources on 2026-09-13. Names/slugs identify local definitions or source records, **not live publication, exercise approval or athlete suitability**. Numeric card positions are not invented database IDs. No exercise record was created or modified. Exact class annotations govern the coaching prescription; library defaults and old generic templates are not imported.

Paths below are relative to the repository root `/Users/jimmy_mac/Desktop/code/vortex`.

| Slot | Verified local identity | Source and exact execution boundary |
|---|---|---|
| E1 | Medicine Ball Chest Pass — `medicine-ball-chest-pass` | `scripts/data/canonical-research/generated/medicine-ball-chest-pass.v1.json`; `backend/migrations/343_coaching_chest_pass_variant_consolidation_and_tuck_boundary.sql`. Stationary, bilateral, paused, no catch is the declared execution. |
| E2 | Two-Hand Landmine Bent-Over Row — `two-hand-landmine-bent-over-row` | `scripts/data/landmine-exercise-cards-all-50.json`, card 34; migrations 199, 453 and 548 preserve the two-hand row boundary. Fast concentric, paused long-arm start, no hip drive/release is a **proposed exact delivery**, not a verified published ballistic profile. |
| E3 | Plyo Push-Up — `plyo-push-up` | `backend/migrations/382_coaching_score_79_variant_identity_consolidations.sql` consolidates `incline-plyo-push-up` into the plyometric identity with elevated hand support. Both hands briefly leave and receive on the same support. |
| E4 | Medicine Ball Chest Pass — `medicine-ball-chest-pass` | Same source as E1; shallow countermovement is a distinct preload variant/job, not a second canonical identity. No flight, step or rotation. |
| E5 | Band Row — `band-row` | `scripts/data/resistance-band-body-resistance-all-cards.json`; `backend/migrations/178_coaching_resistance_band_body_resistance_cards.sql`. Seated, self-foot-anchored, fast pull is a **proposed exact delivery**, not confirmed selectable library variant. Do not use the separate ambiguous source-196 band/cable baseline quarantined by migration 613. |
| E6 | Medicine Ball Shot Put Throw — `medicine-ball-shot-put-throw` | `scripts/data/canonical-research/generated/medicine-ball-shot-put-throw.v1.json` explicitly defines forward-facing unilateral projection without side-on hip preload. Record both arms; do not substitute the rotational shot-put identity. |
| S1 | Scapular Push-Up — `scapular-push-up` | `scripts/data/canonical-research/generated/scapular-push-up/scapular-push-up.v1.json`; migrations 504/505. Choose quadruped dynamic retraction/protraction, not a high-plank hold or full elbow-bending push-up. |
| S2 | Bilateral Band External Rotation — `band-external-rotation` | `scripts/data/canonical-research/generated/bilateral-band-external-rotation/band-external-rotation.v1.json`; migration 508. Standing bilateral unanchored band, elbows at sides; no overhead or externally anchored variant implied. |
| P1 | Floor Press — canonical name verified | `backend/migrations/451_coaching_floor_press_family_completion.sql` consolidates floor-limited press variants. Two dumbbells, simultaneous neutral grip and floor pause are explicit here. No UUID or unverified survivor slug asserted. |
| P2 | One-Arm Row — `one-arm-dumbbell-row` | `backend/migrations/453_coaching_one_arm_row_family_completion.sql` sets canonical name One-Arm Row. Dumbbell, bench support and tucked-elbow path declared; no rotational or renegade-row mapping. |
| P3 | Push-Up — `push-up` | `backend/migrations/455_coaching_push_up_identity_and_family_completion.sql`. Complete controlled elbow-flexion/extension cycle; elevation or band loading changes resistance, not the one-exercise count. Distinct from E3's hand-flight execution. |
| P4 | Dumbbell Rear-Delt Row — `dumbbell-rear-delt-row` | `scripts/data/loaded-strength-all-cards.json`; migration 150; migrations 391/393 and one-arm family migration 453 retain the wider-elbow shoulder-action boundary. Bilateral hinged execution declared. |
| P5 | Dumbbell Skull Crusher — `dumbbell-skull-crusher` | `scripts/data/loaded-strength-all-cards.json`; migration 150. Floor support, simultaneous neutral grips and beside-ear path are **proposed exact execution annotations**, not claimed published profile approval. |
| P6 | Dumbbell Hammer Curl — `dumbbell-hammer-curl` | `scripts/data/loaded-strength-all-cards.json`; migration 150. Simultaneous bilateral cycles with no swing; no alternating-rep ambiguity. |

The non-flight incline push-up replacement belongs to continuous-contact pressing rather than plyometric hand landing. The fast band chest presses, self-anchored unilateral band press, two-hand kettlebell paused row and specific alternate band/support setups are **proposed replacement executions; no exact canonical IDs or live variant approvals asserted**. They are listed only to replace a slot when necessary, never as extra prescribed entries. No registration task was requested.
