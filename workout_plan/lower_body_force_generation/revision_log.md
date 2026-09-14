# Revision record

Before Week 6 design, independent review prompted larger per-repetition time allowances for holds, box step-down and step-up reset; all affected class/audit/workload estimates were recalculated. Working doses and rest did not change. Week 1 ball fallback changed to grounded loaded quarter-squat force, and Week 4 box fallback changed to a settled-start jump, to preserve different jobs within the class. Week 3 lane layout now reserves the starting stance inside 10 m and identifies unmeasured slowing/return exposure.

Workload reviewed_source_hashes preserve the files as reviewed at original design time. Later revisions intentionally do not rewrite those historical snapshots; the final verification manifest records current files.

## Full-sequence cue-count reconciliation

An independent scan of all twelve classes found hard-coded execution counts carried forward after the prescribed dose was reduced. The class Markdown and corresponding workload JSON were corrected without changing any table dose, nominal workload or timing:

- Week 8 E3 and Week 10 E6 now cue three continuous swings, parking after the third; their separated-swing replacements also contain three repetitions.
- Week 11 E2 now cues one scoop throw per lead leg, with two total replacement throws or grounded hip-hinge returns.
- Week 11 E3 now cues one complete step-down/step-up repetition per lead leg.
- Week 12 E5 now prescribes two quarter-squat replacement rises, matching its two-throw slot.

The dose tables, actual-observation fields and nominal arithmetic were already correct. No other hard-coded repetition-count conflicts were found in the reviewed cues, rests or preparation descriptions.

Full-sequence review also changed Week 7 E1's fallback to bilateral settled-start takeoffs, separating it from E3's grounded single-leg rise. Multiple-regression collision handling is explicit in every class: do not pad a modified session with duplicate rows or report it as the complete prescription. Week 8 E2 and Week 9 E6 replacements now state 10-second reset gaps and record their added actual time. Nominal doses are unchanged.
