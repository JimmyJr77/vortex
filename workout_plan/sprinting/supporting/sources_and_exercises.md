# Sprinting — source, assumption and exercise register

**Reviewed:** 2026-09-13. These are sources for constrained programming decisions and local identity evidence, not a claim that the exact class is experimentally validated, OTA-authored or published in the live library. No exercise database records were changed.

## External evidence and style sources

| Source | What it contributes | Limit on interpretation |
|---|---|---|
| [Overtime Athletes — Soccer Speed Drills for Acceleration and Max Velocity](https://blog.overtimeathletes.com/soccer-speed-drills/) | Style inspiration from start practice, horizontal/unilateral plyometrics and upright skipping mechanics; the article distinguishes acceleration and maximum velocity. | Marketing and coaching guidance, not research validating a session. Its longer routes, repeated jumps and advice to vary stimuli are not imported. Stationary A-skip and local doses are our adaptations. |
| [Overtime Athletes — Strength Training for Basketball](https://blog.overtimeathletes.com/strength-training-for-basketball/) | Public two-point-start example and organization of speed work with gym training. | Not a prescription for this cohort or 10 m lane. Its 10-yard run prescription is not used. |
| [Weyand et al. (2000), Faster top running speeds are achieved with greater ground forces not more rapid leg movements](https://pubmed.ncbi.nlm.nih.gov/11053354/) | Primary research supporting the relevance of force during ground contact to maximum running speed. | Does not show that pogos, calves or this class cause faster sprints, and is not a Class 1 youth intervention. No numerical speed prediction is made. |
| [Dorn, Schache and Pandy (2012), Muscular strategy shift in human running: dependence of running speed on hip and ankle muscle performance](https://journals.biologists.com/jeb/article/215/11/1944/10883/Muscular-strategy-shift-in-human-running) | Primary study combining measured running data with musculoskeletal modeling; gives a rationale for considering hip muscles as well as ankle plantarflexors as running speed changes. | Model-based muscle roles, not evidence for one exact hip-flexion exercise or a universal speed threshold in 12–14-year-olds. No study threshold is used as an athlete target. |
| [NSCA (Faigenbaum et al., 2009), Youth resistance training position statement](https://dxpprod.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf) | Official specialist guidance on qualified supervision, individual competence and appropriately prescribed resistance, technique and recovery for youth. | General guidance; does not establish readiness, confirm a safe total dose or validate the fixed fourteen-entry template. The 2–3 technical RIR target is supplied by the user's specification. |

The design inference is deliberately limited: strengthen and rehearse relevant capacities in the space available, then judge actual response. A drill's intended mechanical role is not a demonstrated sprint-performance outcome. No source justifies pretending upright gym drills are maximum-velocity running. No quoted marketing outcome, injury-prevention guarantee or precise cross-drill transfer percentage is used.

## Local identity evidence

The repository's [`docs/exercise-difficulty-review.csv`](../../../docs/exercise-difficulty-review.csv) was searched by name/slug. These are local identities, not verified current live IDs, approval status or athlete eligibility. Later canonical contracts were checked where consequential: the traveling A-skip explicitly excludes stationary skipping, and the standing-calf baseline does not automatically authorize an unsupported loaded bilateral variant.

| Slot | Class name / local identity evidence | Mapping boundary |
|---|---|---|
| E1 | Two-point start — two-step projection; related local `2-point-acceleration-start`, `two-point-start-to-5-10-yard-sprint` | **Proposed short-step prescription; no exact canonical ID asserted.** The related library distances are longer; do not bind the two-step task to an incompatible sprint-distance card. |
| E2 | Paused Broad Jump to Stick, hands on hips | **Proposed addition/variant.** Related `broad-jump-to-stick` exists; the exact paused, no-arm task is explicitly authored here. |
| E3 | Single-leg Broad Jump to Two-foot Landing | **Proposed addition.** Do not map to a same-leg hop-and-stick or repeated single-leg broad jump. |
| E4 | Ankle Pogo in Place — `ankle-pogo-in-place` | Name/slug verified locally; low bilateral in-place execution is explicit. Canonical contract is available, but no live binding is claimed. |
| E5 | Stationary A-Skip | **Proposed distinct drill.** The inspected `a-skip` contract defines traveling step-hop cycles and expressly excludes stationary skipping. This plan declares its own stationary cycle count and does not pretend to use that exact canonical card. |
| E6 | Kettlebell Swing — `kettlebell-swing` | Migration 472 confirms canonical name and two-/one-hand family boundaries. Declare two hands, one bell, chest-height ceiling, hip-driven float and controlled park; current live variant publication unverified. |
| S1 | Short-Foot Drill — `short-foot-drill` | Name/slug verified. Both feet supported, one target foot's arch hold, long toes. Class hold time and light intent are authored dosage. |
| S2 | Side-Lying Hip Abduction | **Proposed addition; no exact local binding verified.** Plain bodyweight lateral-hip strengthening, not a clamshell or balance test. |
| P1 | Split Squat — `split-squat`; local `dumbbell-split-squat` also exists | Use canonical common name with explicit two-DB-at-sides, floor split stance. No elevated rear foot or lunge travel. Exact live variant binding unverified. |
| P2 | Romanian Deadlift — `romanian-deadlift`; local `dumbbell-romanian-deadlift` also exists | Common name plus explicit two-DB implement and class tempo/range. No single-leg or floor-deadlift substitution is silently inferred. |
| P3 | Seated Dumbbell Hip Flexion | **Proposed addition; no invented slug or ID.** Related `banded-hip-flexor-march` exists, but seated distal-thigh DB loading is different and uses no band anchor. Hands secure the implement rather than lift it. |
| P4 | Glute Bridge Walkout — `glute-bridge-walkout` | Name/slug verified locally. Four steps out/four back and the leverage/RIR criterion are session details; not a plain bridge or a Nordic curl. |
| P5 | Standing Dumbbell Calf Raise — local `standing-dumbbell-calf-raise` | **Explicit loaded bilateral floor variant; exact current binding unverified.** The inspected standing-calf research identifies a supported unloaded baseline and treats unsupported/loaded execution as separate variants. Do not claim that baseline validates this variant. |
| P6 | Bent-Knee Soleus Raise — `bent-knee-soleus-raise` | Migration 544 identifies seated DB calf work as part of the canonical knee-flexed plantarflexion identity rather than a separate surviving Seated Dumbbell Calf Raise record. Use explicit seated bilateral execution; no live UUID asserted. |

**Replacement identities:** One-step start is a proposed change to E1's short-step task. Hands-on-hips Countermovement Jump to Stick is an explicitly named unloaded dynamic vertical replacement; no exact live variant binding is claimed. P5's supported single-leg calf has local name `Single-Leg Calf Raise`, slug `single-leg-calf-raise`, but its support/load are declared session conditions. A fitted box instead of a bench changes equipment support, not the exercise slot. Seated short-foot is a stated support regression, not extra work.

## Files and records actually consulted

- Supplied Downloads specification, retained verbatim as [local snapshot](VORTEX_12_CLASS_CURRICULUM_SPEC.md).
- Root workout-plan inventory and existing per-focus class/state layout; no Sprinting progress found at initial review.
- Relevant adjacent athlete-feedback files: Vertical Jumps, Horizontal Jumps, directional Agility, reactive/anticipation Agility, force-absorption/elastic-rebound Jumps. They record no supplied actual observations.
- Selected neighboring progression/workload excerpts and Horizontal Jumps exercise register, used for overlap and local provenance, not as performed-work evidence.
- [`docs/programming/FACILITY_AND_EQUIPMENT.md`](../../../docs/programming/FACILITY_AND_EQUIPMENT.md), including the conflicting 12 m/eight-tenet/booking language; current user/spec architecture and 10 m footprint take priority here.
- Athleticism week-two attendance/workload JSON status and structure: `PASS_BOUNDED_WRITTEN_WEEK2_AUDIT`; these are modeled paths. Its presence is not evidence of real attendance or completion.
- Local exercise CSV and [`a-skip` identity contract](../../../scripts/data/canonical-research/contracts/a-skip.v1.json).
- Relevant identity excerpts from [`standing-calf-raise.v1.json`](../../../scripts/data/canonical-research/batches/standing-calf-raise.v1.json), [`acceleration-starts.v1.json`](../../../scripts/data/canonical-research/batches/acceleration-starts.v1.json), [KB swing migration 472](../../../backend/migrations/472_coaching_kettlebell_swing_family_audit_hardening.sql) and [seated calf identity migration 544](../../../backend/migrations/544_coaching_seated_dumbbell_calf_raise_direct_identity_collision_closure.sql).

## Unresolved facts

No actual athlete attendance, loads, readiness, recovery or test results. No verified preparation contents/duration. No confirmed booking, group size, coach count, lane width, waiting route or equipment quantities/load ranges/bench dimensions. No timing-gate or force-plate feature assumptions. The newer user instruction changes future drill selection, not these unknowns. All results remain prescription-only until feedback is supplied.
