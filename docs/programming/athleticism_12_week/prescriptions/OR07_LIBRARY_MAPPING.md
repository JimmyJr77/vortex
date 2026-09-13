# OR-07 library mapping

Stage4 local source audit and complete teaching proposal, 2026-09-13. The session author supplied the final proposed mechanics, opportunity ceilings and route/time model below. They are reviewable authored content, not current canonical approval, measured facility fit or athlete outcomes. No database query, app/source edit or approval occurred.

Structured companion: [or07_library_mapping.json](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/or07_library_mapping.json). Complete existing-schema card: [complete paused-exit teaching proposal](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/proposals/or07_paused_exit_teaching_candidate.json). Mapping keys and `proposal:` labels identify local documents only. The whole paused-exit sequence has **null exact source, legacy and current canonical/profile IDs**. Related source UUIDs in the JSON retain provenance only; they are not its identity. All task difficulty/confidence scores remain null. Profile fit70 is explicitly the author's provisional fit judgment, required by the existing schema, not calibration or participant probability.

## Identity and source decision

**PAUSED-EXIT-TEACH — Straight Stop, Pause and Announced Walking Exit — Teaching Proposal** retains an actually controlled straight stop, waits in balance, then introduces a preannounced ordinary walking exit. Search covered stop–pause–exit, planned-step redirect, walking/step turns, opening steps, Walk-to-Stick, Step-In to Stick, cut-and-stick/to-stick, cut-and-reaccelerate and Decel-to-Reaccelerate Gate across local contracts, research, migrations and legacy cone records. No inspected completed record gives the exact whole sequence. This finding does not mean the live library is empty.

| Inspected source | Verified identity and boundary |
| --- | --- |
| [155: Submaximal Linear Deceleration to Stick](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/jog-to-stick-linear-deceleration.v1.json:21) | `jog-to-stick-linear-deceleration` / `submaximal-linear-multistep-deceleration-to-bilateral-stick`: straight gentle-jog approach, early multistep braking and terminal bilateral stick. Turn/cut/reacceleration are excluded. Use as related stopping mechanics or the retained stop-only component; its UUID/profile cannot identify the new complete sequence. |
| [Walk-to-Stick research](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/generated/jog-to-stick-linear-deceleration.v1.json:410) | Proposed `new_variant` with walking approach. The current completed155 contract still requires jogging. The existing OR03 WALK-STOP is explicitly authored instruction with null exact IDs. |
| [223: Step-In to Stick](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/step-in-to-stick.v1.json:19) | `deceleration-step-down-stop-step-stick` / `low_speed_single_step_horizontal_deceleration_to_terminal_stick`: one low-speed step into a terminal split/athletic hold, no cut/reacceleration. Programming/safety include existing single-step stop control. It does not supply a first complete paused-exit teaching profile. |
| [283: 45-Degree Cut and Reaccelerate](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/45-degree-cut-and-reaccelerate.v1.json:11) | `planned-45-degree-sidestep-cut-immediate-exit`: immediate sidestep cut-and-acceleration, with no hesitation; prior exact cut-and-stick in both directions is required. Its submaximal profile also preserves immediate exit. |
| [45-Degree Cut-and-Stick research](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/generated/45-degree-cut-and-stick.v1.json:6) and [later identity boundary](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/391_coaching_score_74_identity_boundaries.sql:440) | Redirect first, then hold the terminal balance position. Research still identifies an unresolved historical held-contact interpretation. Neither the later boundary nor generic legacy cone prose establishes a full straight stop before an ordinary walking exit. |

Source defaults are **not OR07 prescriptions**:155 MI is2–3 sets×2–3 valid stops with60–90s rest;223 MI is2–3×3–5 per declared side/direction with30–60s;283 MI is2–3×2 per direction with45–75s. Its Output profile is2–4×1–3 per direction with45–90s between repetitions and120–180s between sets. Those profiles preserve their own identity and prerequisites. [155 profiles](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/jog-to-stick-linear-deceleration.v1.json:409), [223 profile](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/step-in-to-stick.v1.json:382), [283 profiles](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/45-degree-cut-and-reaccelerate.v1.json:31).

## Exact authored mechanics

1. Before release, announce LEFT or RIGHT and identify the matching outside return. Use the actual qualified OR03/direct-equivalent **walking2m approach** or **gentle-jog5m approach**, retaining intent and geometry. Walking brake zone is2.5–3m and stop zone3–4m; jogging brake zone is6–8m and stop zone8–10m. Begin braking before the brake zone with several comfortable contacts. No prescribed braking-foot quota or one hard reaching stop.
2. Achieve quiet **bilateral balance for a full2s** before any new opening or turning step. An uncontrolled stop ends the redirect part of that opportunity.
3. Unload and place the **exit-side foot** in a small opening step toward the announced45° route. Lift and replant the other foot; turn feet and body together through small ordinary steps. The **2m exit includes opening steps**. Arms move naturally and comfortably. No fixed-foot pivot, crossover, cut, support assistance, sprint or immediate plant-and-accelerate action.
4. Finish the2m exit in comfortable quiet bilateral standing for **2s**, separate from the earlier pause. Then walk outward to the matching segregated return and rejoin the rear holding area by the declared route.

The whole action is an authored teaching composite. No previous successful complete redirect is needed to enter instruction. Actual corresponding stop control and comfortable ordinary walking/standing/small step-turn components must already be present before adding the exit. P2 may establish the **walking** stop component in a counted attempt; it grants neither easy-jog ability nor a jogging-stop pass. A first jogging-stop acquisition does not accompany the new exit. A supported split hold supplies no locomotor-exit qualification. [155 prerequisites](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/jog-to-stick-linear-deceleration.v1.json:70), [OR03 current readiness](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/instructional_on_ramp/week_01/or_03.json:15).

## Proposed route and time model

The planning station is **one shared6m-wide×15m-long fan**, centre±3m, with the two adjacent former straight lanes closed. Preserve straight overrun to15m. The two outside one-way returns are each1m wide, centred±4m, with separate rear holding banks and feeding behind the start. One athlete is active in the fan; two qualified coaches are assumed. Verify actual body/fall fit, surface, turn and finish space, markers, sightlines, returns and feeding paths. No planning dimension proves safety or equipment availability.

A2m45° exit adds approximately1.414m lateral and1.414m forward travel. Outward clearing allows **at most3.1m** additional lateral walking. Check it from the athlete's actual pause and exit position: the ideal required distance to the matching return centre is `4 − (signed pause x + √2)` metres. The3.1m allowance does not fit every possible pause location across a6m fan. Body/path clearance and actual opening steps also matter; reconfigure or omit when the actual route does not fit.

| Context | Counted20s active/clearance envelope |
| --- | --- |
| Walking |2s approach +3s braking +2s balanced pause +4s opening/2m exit +2s terminal finish +7s ordinary outward clearance |
| Retained gentle jog |3s approach +3s braking +2s balanced pause +4s opening/2m exit +2s terminal finish +6s ordinary outward clearance |

Return uses a separate **45s allowance**: up to35m ordinary walking within40s, then5s rejoin. These are planning allowances, never required walking speed or a forced cadence. A slower action, instruction or return delays/omits work; no shortcut or rushed release.

Root's15-athlete model releases one athlete every25s at offsets0…350. Standard round starts are20/27/34min; compressed starts15/22min. Corresponding round starts are420s apart; after20s work/clearance and45s return,355s remain. **Minimum recovery is60s after full work and return.** A single opportunity has no between-repeat interval, but the60s minimum still applies before a later role adds physical demand. The parent author verifies that transition in the full session.

The saved session adds an actual pause-position bound of±0.5m for this route model: `4 + 0.5 − √2 ≈ 3.086m`, within the3.1m clearing allowance. This is not a forced foot-placement quota. P2 uses three separate preparation returns while the main area is closed; all preparation returners clear before the opening five-minute main setup closes those paths and establishes the two main returns. Markers are prepositioned; the five-second release gap contains no relocation.

Coach1 has a separate2×3m observation pad centred approximately(-6,7)m, outside the fan/return strip, with additional verified access and sightlines to either finish. The narrow gap beside a return is not a coach station. Rear banks are nominally x[-3.5,-0.5] and[0.5,3.5], y[-9.5,-2], each able to fit all15 if everyone returns that side. Entry is at the rear near y=-10; front feeds reach on-deck near y=-1 without crossing rear arrivals. The next athlete's up-to8m ordinary staging transfer has10s behind the start, beginning19:50 standard/14:50 compressed for the first athlete. Coach2 may supervise two returners and one staging athlete; actual visibility/spacing governs release.

## Proposed dose and counted preparation

All three age bands—9–11,12–14,15–18—use the same listed ceilings; actual competence, current recovery and route fit choose the context. Age does not grant running or turning readiness.

| Mode | Main opportunities | Direction order |
| --- | --- | --- |
| Standard D |3 | First, opposite, first |
| Standard L |2 | First, opposite |
| Compressed D |2 | First, opposite |
| Compressed L |1 | First only |

Record actual first side as LEFT or RIGHT. Smaller caps1/2 apply `min(reference ceiling, cap)` and remove later attempts, preserving the direction prefix. With3 or1 attempts, side counts are intentionally unequal. There is no unobserved-side debt, same-day bilateral-pass assumption or catch-up attempt. Preserve the actual qualified approach; L uses the independently eligible lower-demand walking context.

**P1 retains OR03 supported stance** at the actual support/contact/depth and recent completed dose. **P2 is walking stop only**, with a counted10s action and15s return; it contains no announced exit. The first full exit is counted in **E1**. Root must reconcile the preserved P2 exit-purpose wording with this detailed stop-only preparation and fit both targets into180s; no athlete walkthrough is hidden outside the count.

Record attempts, actual stop/pause, opening/exit direction, final finish, clearing/return, cue needs, faults and response separately. Planned flight and jump-landing events are0; **actual braking/walking contacts and total travel remain null until observed**. Failed or partial actions still contribute actual exposure. Zero jumping is not zero braking/contact exposure.

## Retained strength and honest alternatives

Reuse the exact inspected records by reference to [OR03 mapping](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/or03_library_mapping.json) and [exemplar mapping](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/exemplar_library_mapping.json):

- **SPLIT-ISO-SUP**: source212 `supported-bodyweight-mid-range`, whole front foot/rear forefoot supported, rear heel raised/knee hovering, light stable wall/rack contact, recorded mid-range and continuous breathing. Actual controlled descent and safe exit are prerequisites. Source Resilience defaults2×10–30s/side with45–90s rest; OR03's much shorter teaching holds are explicit overrides. Preserve the actual recent dose rather than automatically restoring defaults. [Source entry gates](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/352_coaching_static_control_family_completion.sql:496), [supported variant](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/352_coaching_static_control_family_completion.sql:746), [source profiles](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/352_coaching_static_control_family_completion.sql:859).
- **SPLIT-STANCE-HIGH-TEACH** remains an independent shallow teaching identity with null exact IDs. Preserve the actual comfortable shallow entry/exit; it earns no mid-range or dynamic pass. OR03's front-leg-side wall hand at comfortable waist height/free hand at hip is authored context, not a universal source-fixed side/height.
- A source212 controlled rise/step-out is an ordinary supported set exit, not proof of the unsupported45° walking sequence. Removing support requires its own safe unsupported exit/control; dynamic split-squat repetitions require controlled lower/return without stepping. Neither change is part of this retained day. [Support-removal gate](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/352_coaching_static_control_family_completion.sql:1387), [dynamic identity/gates](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/370_coaching_split_squat_family_completion.sql:248).
- **HINGE-BW, SQUAT-BW, INCLINE-PUSH, SUPPORTED-ROW, HEEL-TAP** retain the actual familiar variant, setup, range and recent dose. Preserve arm-crossed unloaded hinge; supported row's opposite hand **and knee**; heel-tap tabletop/fixed-arm laterality. **BREATH-9090-ALT** is the exact inspected supported breathing/reach alternative when independently appropriate, not a newly invented generic brace.
- **DECEL-LINEAR/WALK-STOP** can retain the independently eligible stop-only role and record no exit. **BILATERAL-STAND-TEACH** is quiet standing only when separately comfortable; no braking, turning or split-squat pass follows. Unavailable readiness never supplies alternative eligibility.

## Saved-session continuity addendum

The actual OR07 draft deliberately uses **one unloaded hinge set** even when the most recent OR06 work used two dumbbells. That is an explicit unloading/variant decision. D references3/4/4 reps and L2/3/3 for9–11/12–14/15–18; each rep is3s back/1s stand, with5s setup/exit, at least5RIR and60s rest. Explicit1/2/3-rep caps use the lower of the reference and actual smaller cap. Unknown compatible history uses a counted two-rep teaching set, or a smaller eligible count; no additional loaded or screening trial.

Supported stance caps1/2/3s apply to **both P1 and S1** using `min(reference, cap)`. The separate P1 bilateral hold remains2s. Capped P1 takes `19 + 2h` seconds; S1 takes `25 + 2h` seconds including its10s side change and15s entry/setup/exit. The explicit `learn_high` branch uses quiet standing in P1 and teaches the first high-stance entry during counted S1 under direct coaching. It does not require a prior successful high entry, but actual entry/exit must be controlled before a valid hold is credited. An unsuitable entry ends the set; source212 mid-range gates remain unchanged.

The bounded comparison verified18 eligible approach/age/mode rows,36 first-side direction orders,36 main-count caps,36 hip caps and216 stance-role cap combinations against the saved session. This is source/dose-context review, not a whole-session or operational PASS. Current P2 notes and geometry explicitly separate the logistical side gate, terminal-stop E1 reset and the new composite E1 exit; no core source-placement mismatch remains in this bounded review.

## Approval and release boundaries

The complete proposal uses the [existing card schema](/Users/jimmy_mac/Desktop/code/vortex/docs/workout-generator/schemas/exercise-card.schema.json), with athlete/coach/support content, mechanics, readiness, dose/time, geometry, load/fatigue, source relations, media gaps and review packet. It is not import-ready or publish-ready. The exact owner/variant/profile, human identity/difficulty/media review and current approval remain unresolved. No source video is claimed to demonstrate this new whole sequence.

The spec requires an approved substitute before final release when a new card is unresolved. Current approval for the whole sequence or substitutes was not verified by this local audit; named alternatives remain transparent candidates with independent gates. Actual facility fit, athlete history, final integrated daily review and separate tumbling details remain the parent's release inputs. [Spec9](/Users/jimmy_mac/Desktop/code/vortex/docs/VORTEX_ATHLETICISM_BLOCK_PROGRAMMING_SPEC.md:305).
