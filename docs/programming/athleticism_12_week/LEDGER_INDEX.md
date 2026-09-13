# Progression and workload record index

The complete outline and the detailed prescriptions describe different planning stages. Read them together; a blank numeric field in the preserved outline is not the current dose when a detailed entry exists.

| Record | Authority and use |
|---|---|
| `anchor_progression_ledger.json` | The audited Stage 2 map of 420 planned anchor/entry-branch opportunities. It fixes family roles, prior/next offered exposures and decisions. Its null numeric doses mean “not prescribed at outline stage.” |
| `workload_exposure_ledger.json` | The audited Stage 2 map of 60 main offerings and their adjacent-demand/attendance rules. No actual completion is inferred. |
| `detailed_anchor_ledger.json` | Current written exercise doses and set purposes for authored sessions. Day 1's six training anchors link back through `outline_anchor_key`; targeted preparation has its own entries. Instructional entries refer to their separate map session. Exact alternatives remain in the session and detailed workload scenarios. |
| `detailed_workload_ledger.json` | Recalculated age/mode/alternative scenarios for the authored exemplars. Select one eligible scenario, never add scenarios together. Main six-effort routes require actual compatible history. Mixed instructional groups explicitly remove a second brace bout where the slower alternative schedule requires it. |
| `prescriptions/standard_preparation.json` | Exact base doses, count units, contact categories, within-age overrides and complete group clocks. Sessions embed this reference so their exported prescription can be read independently. |
| `instructional_on_ramp/week_01/or_02_anchor_ledger.json` | Eight individually authored OR-02 task records with prior/current/next decisions, conditional source identities and unknown actual evidence. |
| `instructional_on_ramp/week_01/or_02_workload_ledger.json` | OR-02's 240 eligible age/mode/landing/support/history scenarios. An actual prior-one-set or unknown hip history selects its one-set hold, even when a second set fits the clock. |
| `instructional_on_ramp/week_01/or_03_anchor_ledger.json` | Eight OR-03 task records, exact local source pointers, selected alternatives and prior/current/next stance/stopping decisions. Actual work remains unknown. |
| `instructional_on_ramp/week_01/or_03_workload_ledger.json` | OR-03's 504 eligible age/mode/travel/stance/support scenarios. Walking, jogging, position and standing are recorded separately; split entries/holds reflect the selected history route. Known approach metres exclude unknown actual braking/exit/return distances. |
| `instructional_on_ramp/week_01/or_04_anchor_ledger.json` | Nine OR-04 task records, including the counted E0 whole-corridor orientation. Exact conditional source pointers and prior/current/next decisions retain distinct rhythm, walking and running results. |
| `instructional_on_ramp/week_01/or_04_workload_ledger.json` | OR-04's 480 eligible age/mode/preparation/travel/support choices. Whole-corridor walks, short starts, easy upright segments, runoff and returns remain distinct; compressed L has no extra E1 bout. |
| `written_session_index.json` | Inventory of the reviewed written athletic sessions and distinct ledger files. Counts are derived from saved files; shared exemplar ledgers are counted once. |

For an athlete, retrieve the latest productive actual exposure and any more recent lighter/review exposure. Select the current session's precise eligible dose, record a justified deviation if history differs, and preserve the next planned anchor decision. Planned exercises and expected results do not populate actual fields. No athlete histories have been supplied; actual completion, actual load and response remain unknown.

The exemplar ledgers are derived by `prescriptions/check_exemplars.py`; OR-02, OR-03 and OR-04 have separate session-specific checkers in `prescriptions/`. These checkers do not choose exercises or create subsequent days. They write their own ledgers only after the relevant numeric checks pass and include source fingerprints. The per-session ledgers preserve later work when an earlier exemplar is checked again. If an outline relationship changes, revise the outline and reconcile affected sessions before regenerating. Do not regenerate the Stage 2 outline merely to erase detailed work.

Contact categories stay separate: an intentional bilateral landing is one event involving two feet; ordinary steps/support contacts are different. Unknown timed jogging/ankling contacts remain null. Sprint target metres exclude runoff and return travel. Breathing practice is distinguished from moving-limb brace practice. Separate tumbling doses remain unknown until their precise program is available.
