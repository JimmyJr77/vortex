# OR-02 library mapping

Stage 4 local source audit, 2026-09-12. Reviewable candidates pending operational release. This register supplies source identities and defaults; the OR-02 session owns its instructional doses, clocks and competence decisions. Documentation keys below are not database IDs. No database query, credential read, source mutation, media approval or library approval occurred in this task.

The structured companion is [or02_library_mapping.json](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/or02_library_mapping.json). Existing access findings and reusable records remain in the [exemplar register](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/EXEMPLAR_LIBRARY_MAPPING.md) and its [JSON](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/exemplar_library_mapping.json); unavailable current approval is not evidence of an empty live library.

## New candidate identities

| Documentation key | Exact locally authored identity | Verified local identifiers | Eligibility boundary |
| --- | --- | --- | --- |
| JUMP-STICK | Low-Amplitude Forward Jump to Stick | Legacy source 220; slug `forward-hop-to-stick-low-amplitude`; variant `bilateral-low-amplitude-forward-jump-to-terminal-stick`; authored UUID `22000000-0000-4000-8000-000000000001`; profile `movement-intelligence`, phase `movement_intelligence` | Contract is review/quarantined, with no approvals created. The UUID is source text, not a verified current database record. |
| SNAP-STICK | Snap-Down to Stick | Slug `snap-down-to-stick`; variant `bilateral-tall-reach-stick`; profiles `movement-control` and `landing-preparation`. Historical sources 139/541/1105 are visible in archived baseline mappings; source 217 is later consolidated provenance. | A grounded rapid descent and held position. No live canonical UUID or current approval is verified. Seed `selectable:true` does not establish approval. |

Jump identity and review state: [contract:7](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/forward-hop-to-stick-low-amplitude.v1.json:7), [variant:287](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/forward-hop-to-stick-low-amplitude.v1.json:287), [profile:385](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/forward-hop-to-stick-low-amplitude.v1.json:385), [review gates:446](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/forward-hop-to-stick-low-amplitude.v1.json:446). Snap-down identity/variant: [migration 354:334](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/354_coaching_reactive_landing_pogo_family_completion.sql:334), [archived source mappings:674](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/354_coaching_reactive_landing_pogo_family_completion.sql:674), [variant:813](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/354_coaching_reactive_landing_pogo_family_completion.sql:813).

## JUMP-STICK: one bilateral jump, one held landing

From a declared bilateral floor stance, make one small horizontal jump with two-foot takeoff, land on two feet inside the declared visible target, absorb through ankles/knees/hips, hold the terminal athletic position, then reset. The source default uses a **two-second stick**. No obstacle, unilateral hop, rebound, second takeoff, maximal-distance test or extra recovery step belongs in a successful repetition. A walked return happens after the completed hold, with a separately declared protected route and time.

**Arm action is unspecified in this exact contract.** OR-02 must give a repeatable arm rule and label it a session choice. Do not attribute a hands-on-hips or free-swing rule to source 220. The source also supplies no universal jump distance or target size; those must fit the actual athlete and station.

Prerequisites include a pain-free low bilateral jump/landing, an owned quiet grounded Drop Squat/Snap-Down position, understanding of the two-foot/target/hold/reset rules, and appropriate impact, supervision and time budgets. OR-01 attendance or completing a slow squat does not establish these. An initial supervised qualifying attempt still counts as an actual jump exposure. Stop on symptoms, instability, slip, asymmetry, loud/stiff contact, knee/trunk collapse, missed target, extra step, rebound or failed hold. Do not add repeated attempts merely to reach a successful-repetition quota. [Prerequisites and cues:63](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/forward-hop-to-stick-low-amplitude.v1.json:63), [coach and stop rules:157](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/forward-hop-to-stick-low-amplitude.v1.json:157).

| Source layer | Locally authored dose/time |
| --- | --- |
| Candidate movement-intelligence profile | 2–3 sets × 2–4 valid jumps; rest 45–75 seconds; declared low amplitude without distance chasing. Time model lists setup 45 seconds and effort 5 seconds. |
| Legacy defaults retained inside contract | 2 sets × 3 repetitions; work 8 seconds; rest 60 seconds; estimated set 90 seconds; two-second stick. |

These are source estimates from different fields, not a finished lesson clock. OR-02 can propose a lower instructional volume, but must explicitly assign between-attempt and between-set recovery, demonstration/rehearsal exposure, reset, return and feedback. [Legacy defaults:221](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/forward-hop-to-stick-low-amplitude.v1.json:221), [candidate dose/time:397](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/forward-hop-to-stick-low-amplitude.v1.json:397).

One actual bilateral jump produces **one intentional flight/landing event and two landing-foot contacts**. The source's `landingContactsPerRep:2` counts feet. Invalid attempts still contribute their actual exposure; valid repetitions remain a separate result. [Load profile:325](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/forward-hop-to-stick-low-amplitude.v1.json:325).

The source requires one athlete per clean, dry, level, stable non-slip station with clear forward/lateral landing space, target visibility, protected entry/exit and coach sightlines. Required equipment is none; current optional equipment is video. Numeric spacing and target sizes are not established by this card. [Environment:51](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/forward-hop-to-stick-low-amplitude.v1.json:51).

## SNAP-STICK: grounded fallback with a different result

Stand tall in a declared repeatable bilateral stance with arms overhead or at a declared comfortable reach. Rapidly lower the arms and center of mass to an owned athletic depth, keeping both feet grounded, whole-foot pressure, knees organized over the feet and trunk controlled. Hold still for two seconds, then stand tall and breathe before another repetition. No preparatory jump, takeoff, flight, rebound, external height or extra step is allowed. The later [migration 727:26](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/727_coaching_squat_jump_snap_down_identity_boundary.sql:26) makes this explicit, superseding older “flight not required” phrasing.

The local source permits hands-at-chest as an arm-start/access modifier; choosing it still requires explicit hand action and a controlled rapid descent. It does not create an approved new variant. A slow squat-to-hold can be useful instructional practice, but must be logged as a modified action and does not qualify the rapid snap-down or jump. Stable hand support is another setup change requiring variant review.

Prerequisites are a comfortable bodyweight squat to the assigned depth, safe rapid descent, a held bilateral athletic stance without an extra step, stop-signal understanding and direct coach observation. This fallback is appropriate only when its own prerequisites fit. Symptoms do not authorize continuing through a fallback. [Prerequisites, corrections and support limits:350](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/354_coaching_reactive_landing_pogo_family_completion.sql:350), [exact variant:813](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/354_coaching_reactive_landing_pogo_family_completion.sql:813).

| Candidate profile | Source purpose | Source dose/rest |
| --- | --- | --- |
| `movement-control` | Primary movement intelligence: controlled rapid descent and stable finish | 1–3 sets (target 2), 3–5 reps (target 4), two-second stick, 30–75 seconds rest (target 45), full reset each rep |
| `landing-preparation` | Secondary Prepare and Access: a few low-fatigue shape rehearsals | 1 set, 2–4 reps (target 3), two-second stick, 20–60 seconds rest (target 30), full reset each rep |

Lower OR-02 teaching doses must remain explicit overrides. There are **zero intentional flight/landing events**; count grounded descent/stick attempts separately. Completing the fallback logs “jump not observed,” not a successful jump. [Profiles:1260](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/354_coaching_reactive_landing_pogo_family_completion.sql:1260).

The source definition requires a 1.5 m clear radius, overhead clearance, one athlete per station and separation from jump/sprint lanes. Its profile later lists a 2 × 2 m footprint, 20-second setup and 15-second transition. Preserve this inconsistency: do not silently choose the smaller space. A centered 3 × 3 m personal bay accommodates the larger nominal radius, subject to actual athlete reach, adjacent traffic and coach circulation. [Definition clearance:345](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/354_coaching_reactive_landing_pogo_family_completion.sql:345), [profile footprint:1579](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/354_coaching_reactive_landing_pogo_family_completion.sql:1579).

## Reused OR-01 mappings

Reuse exact mechanics and remaining gates by reference; this audit does not approve new variants or carry OR-01 doses into OR-02.

| Key and register reference | OR-02 boundary retained |
| --- | --- |
| [HINGE-BW](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/exemplar_library_mapping.json:587) | Soft knees, hips back, organized trunk, declared hands across chest or behind head, stand/reset. This unloaded hip-dominant hinge differs from the rapid ankle/knee/hip descent of snap-down. Wall contact, forward-reach check and loaded RDL are not hidden equivalents. |
| [SQUAT-BW](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/exemplar_library_mapping.json:730) | Tempo Bodyweight Squat: three-count lowering, brief pause, controlled stand; no mandatory box. Slow squat control does not equal rapid position acquisition or jump competence. |
| [INCLINE-PUSH](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/exemplar_library_mapping.json:296) | Retain stable support, declared height, body line and actual push-up mechanics. |
| [SUPPORTED-ROW](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/exemplar_library_mapping.json:351) | Bench-supported dumbbell row requires opposite hand **and knee** support, individual equipment fit and both-side accounting. |
| [HEEL-TAP](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/exemplar_library_mapping.json:462) | Fixed vertical arms, owned tabletop, alternating bent-leg heel contact/return. Strength placement remains a proposed contextual use of a Prepare and Access profile. State one-side rep versus paired cycle explicitly; no silent heel-slide substitution. |

## Source conflicts and release gates

- **Forward-jump payload drift:** current contract prohibits obstacles and only lists video as optional equipment. [Generated migration 728:5](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/728_coaching_low_amplitude_forward_jump_stick_candidate_materialization.sql:5) retains older optional hurdle equipment, a hurdle media candidate and alternate classifications. Use the current contract for this document's identity; reconcile generated payload, media and relationships before import or release.
- **Snap-down duplicate history:** [migration 726:29](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/726_coaching_drop_squat_snap_down_identity_consolidation.sql:29) consolidates source 217 Drop Squat into the survivor and archives duplicate variants/profiles. Older research calling it a separate definition does not restore a separately approved fallback.
- **Approval and media:** both remain locally authored candidates. Jump review gates require media, relationship, calibration and publication review; snap-down's [migration:769](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/354_coaching_reactive_landing_pogo_family_completion.sql:769) clears approvals/media and [media note:1906](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/354_coaching_reactive_landing_pogo_family_completion.sql:1906) says metadata is not playback or exact-variant approval.
- **Session mapping:** resolve exact current canonical owner/variant/profile; declare arms, stance, distance/target, hold, bounded actual attempts, recovery/reset, failed-attempt response and fallback purpose. Verify individual readiness, actual floor/equipment/coach capacity and downstream demand. The session may be reviewed while those operational gates remain explicit.
- **Methods:** use the inherited [method register](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/EXEMPLAR_LIBRARY_MAPPING.md) for technical practice and fully reset quality attempts. Source dose or software circuit capability does not justify conditioning density here. Root owns the final method choice and complete clock.

No app code or existing source was edited. Source references describe inspectable repository content; they do not establish that migrations ran or that records are currently approved.
