# OR-03 library mapping

Stage 4 local source audit, 2026-09-12. These are reviewable source candidates and explicit gaps, not operationally approved prescriptions. Root owns OR-03's instructional doses, age/context scaling, clock and competency decisions. No database query, secret read, app/source edit or approval occurred.

The structured companion is [or03_library_mapping.json](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/or03_library_mapping.json). Existing access findings remain in the [exemplar register](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/EXEMPLAR_LIBRARY_MAPPING.md). Documentation keys are not database IDs, and inaccessible approval does not imply an empty live library.

## Exact stopping identity and walking boundary

**DECEL-LINEAR** maps to **Submaximal Linear Deceleration to Stick**, slug `jog-to-stick-linear-deceleration`, legacy source **155**. Exact candidate variant: `submaximal-linear-multistep-deceleration-to-bilateral-stick`; authored UUID `15500000-0000-4000-8000-000000000001`. It has `movement-intelligence` and conditional `output` delivery profiles. All are source content in review/quarantine; no current canonical UUID or approval is verified. Other numbers in its provenance—156, 224, 277, 545 and 783—are historical source references, not separately approved options. [Identity and provenance](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/jog-to-stick-linear-deceleration.v1.json:7), [variant](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/jog-to-stick-linear-deceleration.v1.json:303).

The exact action is a declared **5–10 m submaximal straight jogging approach**, braking initiated **before the marked brake zone**, multiple controlled braking contacts, a stop inside the protected finish zone, and a balanced **bilateral athletic stick**. Legacy tempo specifies a **two-second hold**. Walk back by the declared protected route after the held finish and recover. The task has no cut, turn, reacceleration, reactive cue, maximal sprint or prescribed single-leg finish. Arm action is not fixed by this contract; an explicit arm rule is a session choice.

The lane requirement is **15–30 m total protected clear lane**, including approach, braking, finish and protected runoff, with a separately declared walking-return/waiting arrangement. Approach length is not total required space. The source does not establish universal lane width, braking/finish-zone dimensions, runoff allocation or contact count. One athlete uses the protected lane; the next release waits until the finish and walking-return route are clear. A 3 m preparation bay cannot silently become source155's jog lane. [Environment/prerequisites](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/jog-to-stick-linear-deceleration.v1.json:53), [coaching and traffic](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/jog-to-stick-linear-deceleration.v1.json:174), [requirements](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/jog-to-stick-linear-deceleration.v1.json:325).

Prerequisites explicitly include **pain-free easy jogging and a controlled walking stop**, a demonstrated bilateral athletic stance, an understood stop signal, and fitting braking/impact/supervision/time budgets. OR-01/OR-02 attendance is not a substitute. Late braking, overrun, one hard reaching stop, collapse, imbalance or an added turn invalidates the attempt; actual distance and contacts still count. Stop for symptoms or unsafe conditions.

The source does **not** explicitly require a previously successful jog-stop. An observed walking stop can establish the walking/bilateral-finish prerequisite before a first gentle jogging stop when pain-free easy-jog ability is independently known or observed and the remaining gates fit. Walking practice alone does not establish easy-jog ability or count as a passed jog-stop. Unknown required readiness stays on the walking instructional route.

| Source layer | Authored dose and timing |
| --- | --- |
| Movement intelligence, primary | 2–3 sets × 2–3 valid stops; rest 60–90 s; declared 50–65% easy-jog context. Setup estimate 90 s, effort 10 s, walking return 25 s. |
| Output, conditional | 1–2 sets × 2 valid stops; rest 90–120 s; declared 60–70% only after clean movement-intelligence performance. Not an automatic OR-03 progression. |
| Legacy defaults | 2 sets × 3 reps; work 10 s, rest 75 s, estimated set 120 s, two-second stick. |

These fields are not a completed lesson clock. Root must declare actual easy intent, bounded attempts, between-attempt/set recovery and teaching/reset time. Source percentages are contextual estimates unless a measurement basis is declared; they do not require a maximal sprint test. [Defaults](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/jog-to-stick-linear-deceleration.v1.json:235), [profiles](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/jog-to-stick-linear-deceleration.v1.json:409).

The source gives `landingContactsPerRep:0` alongside an authored braking-contact estimate of 8–28 per set, default 15. **Zero jump/landing events is not zero running/braking impact.** Track actual approaches, distance/context and braking contacts; do not present source estimates as observed contacts or universal limits. [Contact model](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/contracts/jog-to-stick-linear-deceleration.v1.json:343).

**WALK-STOP** is an honest mapping gap: [local research:410](/Users/jimmy_mac/Desktop/code/vortex/scripts/data/canonical-research/generated/jog-to-stick-linear-deceleration.v1.json:410) names “Walk-to-Stick” as a proposed `new_variant`; [legacy scaling:670](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/118_coaching_output_decel_cod_cards.sql:670) also mentions walking. No completed exact walking variant/profile/dose was verified. The current contract explicitly requires jogging.

A short straight walking lesson may therefore be authored as prerequisite rehearsal: declared walking pace and route, gradual slowing over several comfortable steps, a visible two-foot finish zone, declared hold, and safe reset. Root must supply its actual dimensions, cues, hold, arm rule, bounded attempts, rest, teaching and stop criteria. Log walking control only. Do not attach source155's exact variant UUID/profile or claim jogging-brake competence.

## Supported split-stance choices

Both options below keep **two feet supported** with lead-leg bias. Neither is a true single-leg balance hold. Plan and record each lead side separately.

| Key | Exact locally authored identity | What the athlete actually does |
| --- | --- | --- |
| SPLIT-BW-SUP | `split-squat` / `supported-bodyweight-standard` | Stationary dynamic split squat: whole lead foot and rear forefoot stay on the floor; lower both knees through owned range, then drive through the lead leg back to the same split stance without stepping. |
| SPLIT-ISO-SUP | `split-squat-isometric-hold` / `supported-bodyweight-mid-range`; legacy source 212 | Enter a declared comfortable mid-range split-squat depth, retain front-foot contact and rear-knee hover, hold with normal breathing and controlled pelvis/trunk, then exit. No repeated lowering/rising during the hold. |

Dynamic source: [identity, readiness and mechanics](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/370_coaching_split_squat_family_completion.sql:248), [supported variant](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/370_coaching_split_squat_family_completion.sql:498). Static source: [identity/readiness](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/352_coaching_static_control_family_completion.sql:478), [source212 archive mapping](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/352_coaching_static_control_family_completion.sql:579), [supported variant](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/352_coaching_static_control_family_completion.sql:746). Both are review candidates; no exact live variant/profile UUID or approval was verified.

**Support side and height are session decisions.** The dynamic candidate requires stable hand support but does not fix which hand, numerical height, grip/contact or contact force. Its variant equipment lists rack, while the definition and legacy scaling also mention wall. The static variant explicitly allows stable wall/rack and requires declared support height; its profiles list wall and require light stable support without unplanned bodyweight transfer. Neither source fixes same-side versus opposite-side hand relative to the lead leg.

Root must prescribe the actual stable structure, chosen hand relative to lead leg, comfortable contact height/reach, contact strategy, side-change arrangement and support inspection. Record these as contextual choices, not source-fixed facts. Reconcile wall versus rack with the exact profile. A mobile chair/bench or partner hold was not verified as equivalent support. Both feet remain on the floor; rear-foot elevation changes the exercise.

| Candidate profile | Source dose/rest | OR-03 limitation |
| --- | --- | --- |
| Dynamic `capacity-strength`, Capacity primary | 2–4 sets × 4–10 reps/side; bodyweight rest 90–180 s; controlled standard tempo with at least two quality reps remaining | Reduced teaching reps/rest need an explicit override. |
| Dynamic `resilience-control`, Resilience secondary | 2–3 sets × 4–8 reps/side; rest 60–150 s; light/moderate position priority | Does not supply a dedicated instructional or preparation profile. |
| Static `resilience-position`, Resilience primary | 2 sets × 10–30 s/side, target 20; rest 45–90 s, target 60 | Shorter teaching holds can be proposed; retain actual depth and exit criteria. |
| Static `capacity-quality`, Capacity secondary | 2–4 sets × 15–40 s/side, targets 3 × 25; rest 60–120 s, target 75 | These are capacity doses, not required on-ramp volume. |

[Dynamic dose/time](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/370_coaching_split_squat_family_completion.sql:754), [static profiles](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/352_coaching_static_control_family_completion.sql:859). Dynamic time model estimates six seconds per repetition, four-second reset, 20-second side change and 45-second bodyweight setup. Legacy dynamic tempo is 2-0-1-0; do not combine source estimates into an incoherent count. Root supplies a complete intentional cadence and both-side clock.

Dynamic prerequisites include a comfortable stationary stance and controlled lower/return without stepping, with foot/knee/pelvis/trunk/breath control. Static prerequisites include controlled descent and safe exit from the assigned depth with normal breathing. A **tall stance-only hold is not the exact mid-range static variant**; label that simpler teaching action if selected. Rear-knee resting, repeated reps, elevated foot, perturbation and jumps are different actions. Shorten or stop when depth/position/breath changes; successful clock completion does not prove quality.

Source212 does not require a previously completed hold of a fixed duration. A first brief hold is compatible with the source readiness wording once comfortable stance, controlled entry, safe exit and breathing are established. A later bilateral exit-and-hold appended to that split hold is an explicitly authored composite, not part of the complete source212 identity.

Dynamic source footprint is 2.5 × 1.5 m per stationary athlete, without cross traffic. Static source has `clearExitAreaMeters:1.5`, controlled traffic and one athlete per support station; that field does not define a radius or square. Verify actual stance reach, support locations, exit and coach access rather than treating the numbers as a proven room layout.

## Supported higher-stance teaching branch

**SPLIT-STANCE-HIGH-TEACH — Supported High Split-Stance Hold — instructional adaptation** is a local documentation record for P1/S1 when supported split standing is comfortable but source212's controlled mid-range descent/exit gates are unknown or unmet. It has no exact source slug, legacy ID, canonical UUID or approved profile. Source212 is **related mechanics only**, not the identity of this high/shallow hold. [Related support, stance and exit content](/Users/jimmy_mac/Desktop/code/vortex/backend/migrations/352_coaching_static_control_family_completion.sql:478).

Retain the declared stable hand contact, whole lead foot and rear forefoot on the floor, with rear heel raised. Root's proposed hand setup is the front-leg-side hand on the wall at an individually fitting comfortable waist height, free hand at hip; record the actual fit. From supported split standing, choose a small comfortable knee bend and establish controlled entry and return at **that actual shallow depth**. Hold the high position with normal breathing and light stable support, then return under control to supported standing. Do not force mid-range depth or rest the rear knee.

Short **3-second or 5-second holds per lead side** are proposed teaching doses, not source212 defaults. Root owns the final sets, rest, setup, side change and exit clock. If comfortable shallow entry, breathing, support or exit cannot be established, defer this task and record not observed. Completing it records only high-stance control at the actual setup; it earns **no mid-range or dynamic split-squat pass**.

This is an **independent higher branch**, not a universal tall reset. Athletes whose exact mid-range gates are established may use the separate mid-range branch. For P1, the proposed subsequent supported bilateral exit-and-**two-second hold** is an additional orientation action: specify and time the transition and hold separately. The complete P1 composite has no verified single canonical ID and grants no walking/jogging-stop qualification.

## Quiet bilateral standing orientation

**BILATERAL-STAND-TEACH — Quiet Bilateral Standing — orientation teaching task** is a newly authored documentation record with no verified exact source exercise, canonical ID or delivery-profile ID. It is available only when comfortable quiet bilateral standing at the actual location is independently known or observed. Another task being unavailable does not establish this readiness; if comfortable standing is unknown or unavailable, defer and record not observed.

From an already comfortable stationary two-foot stance, remain quietly upright with **arms relaxed and knees unlocked for two seconds**. No step, lowering, squat, split stance, deliberate lean or locomotor approach is prescribed. Release the hold instruction and remain comfortably standing for the reset cue. The **ten-second total setup/hold/reset envelope** includes explanation, this single two-second hold and reset; it does not hide additional movement or repeated holds.

Use this independent branch for **P1 zero-split orientation** when split entry is unknown, or **P2/E1 quiet standing** when locomotor/squat work is unavailable but standing is independently safe. Record quiet-standing observation only: **no braking, walking/jogging-stop, split-stance, mid-range, squat or lowering pass**. Exposure is zero intentional flight/landing events, zero locomotor distance and zero split entries or lowering repetitions. Stop for symptoms, discomfort, balance loss, unsafe conditions or participant request; do not add an unnamed support or movement substitute.

## Honest no-travel options and reused strength

- **SNAP-STICK**, by reference to the [OR-02 mapping](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/or02_library_mapping.json), preserves grounded rapid bilateral position acquisition and a held finish if its own prerequisites fit. It observes no locomotor braking and does not qualify source155. It is not an automatic fallback for symptoms or unqualified rapid descent.
- **SQUAT-BW**, by reference to the [exemplar mapping](/Users/jimmy_mac/Desktop/code/vortex/docs/programming/athleticism_12_week/prescriptions/exemplar_library_mapping.json), preserves the controlled no-travel bilateral tempo squat. A squat or a separately declared static bilateral stance rehearsal cannot be logged as a walking/jogging stop or split-stance result.
- Reuse **HINGE-BW**, **INCLINE-PUSH**, **SUPPORTED-ROW** and **HEEL-TAP** from the same register. Retain exact unloaded hinge hand position; stable incline support; opposite hand **and knee** bench support for the row; and fixed-arm tabletop heel-contact/return with explicit side count. Heel-tap Strength placement remains a labeled contextual adaptation.

## Mapping gates retained

Resolve current canonical owner, exact variant/profile, review/media and approval before operational release. Root must declare complete walking/jogging route and protected space; actual supported stance, hand side/height/contact; dose, hold, rest, side change, failed-attempt limit and every teaching transition. Do not insert unfamiliar split-stance teaching into a reminder-only preparation clock.

Older sprint aliases do not authorize maximal-speed or redirect work. The walking proposal is not a completed card, and dynamic versus static split-squat identities remain distinct. Local seed/migration capabilities do not prove deployed approvals, equipment quantity or athlete history. Existing access and separate tumbling gates remain unchanged.
