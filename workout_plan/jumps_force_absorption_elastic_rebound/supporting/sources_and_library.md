# Sources, assumptions and exercise-library record

Reviewed September 13, 2026. Sources inform style and general programming principles. None validates the exact fourteen-exercise session, its contact count, its coaching gates or an individual athlete's suitability. Exercise jobs are intended mechanical contributions; no performance outcome or injury reduction is promised.

## External sources checked

1. [Overtime Athletes — Create a Plyometric Training Program](https://blog.overtimeathletes.com/create-plyometric-training-program/). Style source: absorption emphasis, connected low-level jumps and unilateral practice in multiple directions. The present class uses short counted sets and individualized readiness; it does not adopt the source's marketing claims or impose a mandatory three-phase progression.
2. [Faigenbaum et al., 2009 — NSCA Youth Resistance Training position statement](https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf). Official specialist guidance supporting qualified supervision, individualized progression, technically controlled loading, low-fatigue power practice and recovery matched to the exercise and athlete. Pages S71–S72 discuss rest and nonconsecutive exposures. The document supports general choices, not the specific RIR estimate or the entire prescribed dose. The age of this publication is explicit; it is not presented as a new study.
3. [NSCA Coach 8.1 — Integrating Plyometric Training for High School Soccer Athletes, Part 2](https://www.nsca.com/contentassets/2412bbb8e4474f3e9e8e31fe28ceb9f8/coach-8.1.2-integrating-plyometric-training-for-high-school-soccer-athletes-part-2.pdf). Official applied guidance, especially the discussion of recovery and short power efforts on PDF page 7. Used to support recovered sets and accounting for cumulative youth workload. Its sport, age distribution and program differ from this class; the current time and dose are coaching prescriptions rather than reproduced research results.

## Local records reviewed

Paths below are relative to the repository root, not additional files created by this run.

- `workout_plan/vertical_jumps/classes/class_01.md`: separate written focus, reviewed for overlap, not treated as completed training or modified.
- `docs/programming/FACILITY_AND_EQUIPMENT.md`: conflicting 12 m lane reference and older booking/template context. This curriculum follows the current supplied 10 m constraint and records the conflict.
- `docs/programming/athleticism_12_week/progress.json`, `detailed_anchor_ledger.json`, `anchor_progression_ledger.json`, `workload_exposure_ledger.json`: broader earlier program, written progress and planned exposures; no usable actual athlete response established.
- `docs/programming/athleticism_12_week/instructional_on_ramp/week_03/or_12_anchor_ledger.json` and `or_12_workload_ledger.json`: conditional planned options/scenarios, actual result fields null.
- `docs/programming/athleticism_12_week/instructional_on_ramp/week_02/week_02_attendance_workload_ledger.json`: hypothetical attendance/workload paths, reviewed actual-result fields null.
- The supplied specification, preserved alongside this file, provides the current exact taxonomy, age baseline, 6/2/6 architecture, equipment inventory and iterative run boundary. Older application taxonomy labels do not override it.

## Exercise identities

These are verified names/slugs in **local library authoring sources**, not a claim that a current production database ID has been resolved. Numeric `id` values in these particular source card arrays are local card numbers and are **not used as global exercise identifiers**. E/P/S labels are class slots only. No existing exercise records were changed.

| Class slot | Local canonical name / identifier | Authoring source and prescription distinction |
|---|---|---|
| E1 | Countermovement Jump to Stick / `countermovement-jump-to-stick` | `scripts/data/jumping-height-exercise-library-all-50.json`; controlled height and 2 s hold specified for this class. |
| E2 | Ankle Pogo in Place / `ankle-pogo-in-place` | `scripts/data/plyometrics-all-cards.json`; low-amplitude eight-jump dose. |
| E3 | Repeated Vertical Jump / `repeated-vertical-jump` | Same plyometrics source; three connected jumps, controlled final landing and six observation opportunities across three sets. |
| E4 | Broad Jump to Stick / `broad-jump-to-stick` | Same plyometrics source; modest distance, not a maximal-distance test. |
| E5 | Lateral Bound / `lateral-bound` | Same plyometrics source; each bound ends with a 2 s stop. |
| E6 | Single-Leg Pogo in Place / `single-leg-pogo-in-place` | Same plyometrics source; five hops per side. Light-hand-support execution is a class replacement variant. |
| S1 | Short-Foot Drill / `short-foot-drill` | `scripts/data/lower-leg-access-cards-21-30.mjs`; supported single-leg, actively held bodyweight loading. Its library home is foot activation; the actual light strengthening dose and job determine its role here. |
| S2 | **Proposed addition: Side-lying hip adduction** | No matching exact card was found in the inspected relevant local sources. No canonical identifier is assigned. The class supplies full execution and dose. |
| P1 | Goblet Squat / `goblet-squat` | `scripts/data/loaded-strength-all-cards.json`; two working sets at a controlled eccentric tempo. The optional double-dumbbell front-rack replacement is a proposed execution variant here, not a newly asserted database binding. |
| P2 | Dumbbell Romanian Deadlift / `dumbbell-romanian-deadlift` | Same loaded-strength source; bilateral hinge. |
| P3 | Dumbbell Split Squat / `dumbbell-split-squat` | Same loaded-strength source; stationary stance, one working set per lead leg. |
| P4 | **Proposed loaded variant: Goblet lateral lunge** | Related verified card: Bodyweight Lateral Lunge / `bodyweight-lateral-lunge` in `scripts/data/resistance-band-body-resistance-all-cards.json`. That identifier belongs to the bodyweight exercise and is not assigned to this loaded proposal. |
| P5 | Standing Dumbbell Calf Raise / `standing-dumbbell-calf-raise` | `scripts/data/loaded-strength-all-cards.json`; supported single-leg execution specified in the class. |
| P6 | Seated Dumbbell Calf Raise / `seated-dumbbell-calf-raise` | Same loaded-strength source; bilateral bent-knee execution. Standing bent-knee replacement is recorded as a changed variant if used. |

**Library quality finding:** The loaded-strength source describes the two calf raises generically as trunk-stiffness exercises. That wording does not accurately identify their primary mechanical task. The class uses the verified names but gives specific plantarflexion jobs; it does not repeat the generic benefit claim or modify the source library. Library presence alone is not evidence of efficacy.

**Evidence limits:** Qualitative landing observation does not quantify absorbed force, loading rate, tendon properties or contact time. Bent- and straight-knee calf work has different joint-position demands, but this does not prove a specific jump improvement. No precise percentage progression, test threshold derived from research, or guaranteed twelve-class outcome is asserted.


## Addition checked for Class 6

**Repeated Broad Jump / `repeated-broad-jump`** was verified in `scripts/data/plyometrics-all-cards.json`. The local description explicitly covers two or three connected broad jumps. Class 6 uses two at modest displacement with full recovery. The existing CMJ-to-stick, vertical-rebound and lateral-bound identities are retained; changed class-slot numbers do not create new exercise identifiers.


## Addition defined for Class 7

**Two connected out-and-back lateral bounds** is a proposed continuous execution variant of the verified local Lateral Bound family. No exact new library identifier is asserted. Every sequence has two flight/landing events, one lateral reversal and one final stop; starting from each leg balances the receiving-leg task. The proposal is fully prescribed and gated in Class 7 rather than inserted into the source library.
