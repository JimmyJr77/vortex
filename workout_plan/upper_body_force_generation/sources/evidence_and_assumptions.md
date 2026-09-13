# Evidence, source scope and assumptions

**Reviewed 2026-09-13.** The user's current request authorizes the supplemental specification as the detailed programming brief. Its Vertical Jumps reference is an example, not this plan's focus or exercise list. The request's `workout_plan` destination overrides the spec's default docs path. No unrelated application/library/database changes are authorized by this programming task.

## External primary/specialist sources

| Source | Limited use here | What it does not establish |
|---|---|---|
| [Overtime Athletes — Ballistics Training for Athletes](https://blog.overtimeathletes.com/ballistics-training-for-athletes-how-to-build-total-body-explosiveness-power/) | OTA includes chest passes and kneeling chest throws in its anterior-power examples. This supports the requested stylistic reference for forceful forward projection. | No validation of this 14-entry session, selected age group, load, outcome or progression. OTA's other directional examples are not a reason to add unrelated throws. |
| [Overtime Athletes — Upper Body Training for Baseball Athletes](https://blog.overtimeathletes.com/upper-body-training-for-baseball-athletes/) | Public example combining upper-body ball work with strength. | The article describes an MLB-group workout and timed repeated throws. This plan does not inherit its athlete readiness, timed density, rotational work or catch demands. |
| [Overtime Athletes — Top 5 Row Variations to Build Strength for Athletes](https://blog.overtimeathletes.com/top-5-row-variations-to-build-strength-for-athletes/) | Inspiration for supported row foundations and purposeful progression of the task. | More instability is not assumed to improve this day's force goal; the exact support, load and tempo remain individualized. |
| [Overtime Athletes — Ballistic Sled Row](https://blog.overtimeathletes.com/ballistic-sled-row-best-row-variation-for-athletes/) | Shows OTA's use of a rapid pulling task. | A sled is not confirmed here. The selected landmine row is not a mechanically identical substitute, and deliberately omits the example's hip-driven integration to emphasize arm pulling. |
| [Overtime Athletes — Bodyweight Training for Athletes](https://blog.overtimeathletes.com/bodyweight-training-for-athletes/) | Includes pushing/pulling and plyometric push-ups in bodyweight training discussion. | Does not establish individual hand-flight readiness or this session's dose. |
| [NSCA — Youth Resistance Training: Updated Position Statement, 2009](https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf) | Supports qualified supervision, individualized progression, controlled technique, low-repetition quality power work with resets and recovery matched to task demands. Discusses nonconsecutive training and recovery context; see S69–S73. | This older specialist position statement is broad guidance, not a study of this class. It does not prove the specific 6/2/6 architecture, reserve estimates, throw count, timing or transfer to passing. No maximal-load testing or universal percentage progression is inferred. |

The 2–3 technical-RIR target, baseline ages, exact exercise counts, equipment list and one-class run boundary come from the user-adopted spec. Specific mechanical jobs, dosage allocation and the provisional map are coaching judgments. A movement resembling part of a pass is not evidence of a measured improvement in passing speed. Scapular/external-rotation work is prescribed as strengthening, not treatment or a guarantee against injury.

## Local sources reviewed

- `/Users/jimmy_mac/Downloads/VORTEX_12_CLASS_CURRICULUM_SPEC.md`, copied verbatim alongside this file for reproducibility.
- `docs/programming/FACILITY_AND_EQUIPMENT.md`: inventory and explicit source conflict. It reports 12 m lanes and an older framework/booking. Current curriculum uses the user-adopted seven categories, four sections and conservative 10 m planning length. No 60/90-minute booking has been confirmed for this focus.
- Existing `workout_plan` focus files, especially `vertical_jumps/progress.json`, `vertical_jumps/athlete_feedback.md`, `vertical_jumps/exercise_register.md` and `jumps_force_absorption_elastic_rebound/progression_ledger.md`. Those are other focus prescriptions, not previous upper-body class numbers or completion evidence.
- `docs/programming/athleticism_12_week/progress.json`, `anchor_progression_ledger.json` and `workload_exposure_ledger.json`: source status checked; no actual athlete response is established. The anchor ledger explicitly reports no actual data supplied.
- Local exercise records and migrations listed in `../exercise_register.md`. Research/candidate metadata, legacy card indices and source provenance are not live publication or coaching observations. No live database queries or edits were performed.

## Unconfirmed planning facts

The cohort's actual training history, attendance, symptoms, readiness, strength loads, recent/upcoming exposure and recovery are unknown. Class duration, group size and staff are unknown. Preparation content/time is unknown. Equipment categories are confirmed by the spec, but counts, load increments, bar minimums, ball dimensions/masses, bench geometry, surface suitability, band anchoring instructions and throwing containment require actual inspection.

The baseline assumes athletes can perform the relevant basic patterns under supervision; the first prescribed efforts determine the appropriate execution, with same-slot regressions when needed. The timing model assumes access to equipment without additional group queues. The intended ball-release session requires an inspected contained throw arrangement; band replacements introduce a stated release-practice gap. No device measurement capability is assumed or required.

Only one class is finalized. Future map entries remain revisable intentions, and a saved document is never evidence of completed training.


## Subsequent owner clarification

“Try to force unique drills; while strength lifts may recur as needed for progressions.” This is a direct user preference, not a claim from the external sources. It supersedes automatic recurring-drill language in the original plan. Updated the curriculum, progression note, ledger and resume instructions and added a drill-use register. Strength lifts may recur with rationale; new drills still require direct relevance and a workload/readiness audit. The verbatim supplemental file is retained unchanged as source history. This clarification supplies no athlete completion or recovery evidence.


## Completion instruction and additional checks

The later owner instruction to “continue to finish all 12 days” superseded the original one-class stop boundary. Classes 2–12 were reviewed, written, audited and saved in sequence. The source specification remains an unchanged record. “Days” continues to mean numbered exposures, not consecutive calendar days.

[OTA’s upper-body programming article](https://blog.overtimeathletes.com/how-to-program-upper-body-training-for-athletes/) supplies style inspiration: brief rapid work before strength, purposeful push/pull selection and direct elbow support. Its adult loading, set ranges and supersets were not adopted. [OTA’s landmine press description](https://blog.overtimeathletes.com/use-landmine-press-to-build-vertical-push-power/) supports the angled pressing example; its broad safety and sport-transfer assertions do not validate this prescription. The [NSCA 2009 youth resistance-training position statement](https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf) remains the specialist reference for supervision, individualization and recovery. These sources were rechecked during final review; none establishes the complete 14-entry class as a tested protocol.

Identity checks confirmed the local band chest press, lat pulldown, straight-arm pulldown, face pull and assisted pull-up definitions in `scripts/data/resistance-band-body-resistance-all-cards.json`; landmine row/push-press entries in `scripts/data/landmine-exercise-cards-all-50.json`; and generated chest-pass, kneeling chest-pass, overhead-throw/slam, shot-put, landmine-press and scapular-pull-up families. Exact rapid, receiving, stepping, alternating and partial-start tasks remain proposed coaching executions unless explicitly verified. The full class audits carry slot-level boundaries; no new database IDs or approvals were invented.

Final authoring did not resolve athlete readiness or site facts. Overhead attachment ratings, ball size/rebound/containment, support fit, minimum loads, actual preparation, booking, staffing, queues and outside workload must be checked for delivery. Same-slot regressions preserve a meaningful task but may remove the intended receiving, projection or vertical-pull practice; record that gap.
