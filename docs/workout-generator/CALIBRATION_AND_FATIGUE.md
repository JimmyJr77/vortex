# Calibration and cumulative fatigue controls

## Calibration workflow

The calibration workspace operates only on published canonical variants. A coach
proposes a 1–100 score for one controlled dimension, assigns it to the nearest
20/40/60/80 anchor tier, and records observable evidence. Every proposal enters
review and cannot become an approved anchor until a different user approves it
with review notes.

Approving a newer anchor supersedes the previously approved anchor for the same
facility, variant, and dimension. Historical proposals remain immutable and
queryable. Approval establishes a calibration reference; it does not silently
rewrite a published card. Card score changes still use the normal revision and
publication workflow.

## Cumulative fatigue budgets

Workout intent includes six session-wide 1–100 ceilings:

- grip
- local muscle
- spinal loading
- eccentric stress
- impact accumulation
- technical fatigue sensitivity

Each candidate contributes its canonical load/fatigue score weighted by its
share of session time. The deterministic selector projects the cumulative total
before selection. It rejects candidates that would cross a ceiling and fails
closed with `unsatisfiable_fatigue_budget` when a required phase cannot be
filled. Final validation independently recomputes every total, and reviewed
workout swaps are subject to the same whole-session check.

Age-aware defaults are conservative for athletes aged 12 and under. Coaches may
lower or raise individual ceilings through structured generator controls, but
all values remain constrained to the canonical 1–100 scale.

## Quadruped Spinal Circles candidate calibration

Source 26 proposes exercise complexity `32` and physical difficulty `12` for
the single fixed-contact global spinal-circle variant; overall `32` is derived
as their maximum. Complexity reflects four observable checkpoints, a continuous
multi-planar path, named direction reversal, fixed-contact monitoring, and
rounded-to-rounded counting. Physical difficulty reflects low external load
with sustained hand, wrist, elbow, shoulder, knee, and shin support plus
controlled weight shift and active spinal range. Both anchors remain in review
and require independent qualified calibration.

Its card-level operational budgets are planning controls, not validated tissue
thresholds: no more than 20 total circles, 10 circles in either direction, 420
seconds of quadruped support, 300 seconds of active spinal range, technical
sensitivity 32, and impact score 1 with zero landing or hand-impact contacts.
Workout generation must also count overlapping wrist/shoulder support and
spinal-range/loading from other prescriptions, recompute actual duration, and
rerun all budgets after any substitution. The card remains unpublished until
the independent calibration, graph, media, and publication gates are complete.

## Side-Lying Open Book candidate calibration

Source 28 proposes exercise complexity `22` and physical difficulty `10` for
the stacked-knee long-arm open-and-return variant; overall `22` is derived as
their maximum. Complexity reflects exact side-lying setup, forward arm stack,
coordinated top-arm and global trunk opening, comparatively stable pelvis and
knees, comfortable endpoint control, hand-restack repetition counting, and
separate-side recording. Physical difficulty reflects low external load with
side-lying floor transfer/contact, sustained bent-knee support, active trunk and
top-shoulder range, and controlled return. Both anchors remain review-only and
require independent qualified calibration.

The operational limits are conservative planning controls, not validated
tissue thresholds or participant classifications. Generation counts complete
repetitions per side, actual time in side lying and active rotation, top-
shoulder exposure, spinal rotation/loading, floor transfers, position-loss
events, and symptom response together with overlapping prescriptions. Any
substitution must reapply equipment, floor-access, position, duration,
cumulative fatigue and impact, stop, and downstream-interference checks. The
card stays unpublished until independent media, graph, calibration, content,
and publication gates are complete.

## Standing Shoulder CAR and Arm Circles candidate calibration

Source 37 proposes exercise complexity / physical difficulty `30/12`, derived
maximum `30`, for the fixed-foot unilateral active Shoulder CAR. Complexity
reflects its full comfortable path, humeral-rotation changes, same-start loop,
side/direction logging, normal scapular motion, and momentum/trunk controls.
Physical difficulty reflects the unloaded long-arm lever, active end-range
shoulder-complex work, and postural control without impact or external load.

Standing Bilateral Arm Circles proposes `16/14`, derived maximum `16`.
Complexity reflects simultaneous small-circle coordination, declared height,
direction, direction change, and time-or-count validity. Physical difficulty
reflects bilateral arm mass held near shoulder height, repeated deltoid and
scapular work, and postural control. All four anchors are review-only and
assess the task, not participant skill, proficiency, age, readiness, or
clinical eligibility.

Generation records the exact card and profile; Shoulder CAR side, direction,
valid loops, range, path, rotation, tempo, pauses, faults, symptoms, and active
seconds; or Arm Circles height, diameter, direction order, valid revolutions
or actual seconds, arm drop, asymmetry, shrugging, trunk faults, and symptoms.
Both record invalid/partial work, stops, rest, actual duration, local and
technical fatigue, and overlapping shoulder, scapular, rotator-cuff, trunk,
pressing, pulling, throwing, climbing, hanging, handstand, and overhead demand.
Landing contacts are zero and impact remains in the non-impact planning class.

Recovery ranges and cumulative budgets are conservative planning controls,
not validated tissue thresholds or rehabilitation prescriptions. Any change
to base, laterality, assistance, load, path, range, lever, circle diameter,
action, sequence, clinical scope, dose, symptoms, space, or downstream demand
must rerun identity, logistics, duration, fatigue/impact, substitution,
persistence, and rendering checks. Both cards remain unpublished until
independent media, graph, calibration, content, comprehension, and publication
gates are complete.

## Inchworm Walkout candidate calibration

Source 29 proposes exercise complexity / physical difficulty `30/24` for the
stationary hands-out-and-back variant and `34/26` for the traveling hands-out/
feet-in variant. Their derived overall scores are therefore `30` and `34`.
Complexity reflects the standing-floor transition, sequential hand steps,
controlled high-plank checkpoint, exact return mode, no-push-up boundary, and
counted standing finish; the traveling variant additionally requires fixed
hands during foot steps, forward locomotion, lane control, and traffic
management. Physical difficulty reflects repeated bodyweight hand support,
trunk bracing, posterior-chain range, standing-floor transitions, and controlled
return without impact or external load. All four anchors remain review-only and
require independent qualified calibration. They assess the exercise, not the
participant.

The operational limits are conservative planning controls, not validated tissue
thresholds or participant classifications. Generation records and aggregates
complete repetitions, hand and foot steps, travel distance, high-plank and
wrist/shoulder-support seconds, standing-floor transitions, technical fatigue,
impact contacts, downstream hand-support demand, invalid attempts, first fault,
symptoms, stops, rests, and actual duration across overlapping prescriptions.
Any substitution or return-mode change must reapply identity, support, added-
action, symptom, floor/lane/traffic, dose, fatigue, impact, duration,
downstream-interference, persistence, and coach/athlete rendering checks. Both
variants remain unpublished until independent media, graph, calibration,
content, and publication gates are complete.

## Wrist Rockers — Palms Down candidate calibration

Source 30 proposes exercise complexity `22` and physical difficulty `16` for
the exact bilateral quadruped palms-down, fingers-forward, forward-and-back
wrist rocker; overall `22` is derived as their maximum. Complexity reflects
the hand-orientation contract, whole-hand contact, organized elbow/shoulder/
scapular/trunk support, controlled comfortable forward endpoint, full return,
and explicit cycle count. Physical difficulty reflects partial-bodyweight wrist
extension, palm/finger pressure, upper-limb and trunk support, floor transfer,
and controlled return without impact or external load. Both anchors remain
review-only and require independent qualified calibration. They assess the
exercise, not the participant.

Its operational values are conservative planning controls, not validated
tissue thresholds or participant classifications. Generation records complete
cycles, wrist-extension seconds, hand-support seconds, forward-range exposure,
palm/finger and elbow/shoulder support faults, floor transfers, technical
faults, symptoms, invalid/partial attempts, stops, rests, and actual duration.
It aggregates overlapping tumbling, handstand, cartwheel, crawling, pressing,
overhead, grip, and forearm loading before selection and after substitution.
Any hand-surface, direction, base, support-height, path, hold, force, dose,
symptom, or downstream-demand change must rerun identity, logistics, duration,
fatigue/impact, persistence, and coach/athlete rendering validation. The card
remains unpublished until independent media, graph, calibration, content, and
publication gates are complete.

## Wrist Rockers — Backs of Hands Down / Wrist-Flexion Bias candidate calibration

Source 31 proposes exercise complexity `26` and physical difficulty `18` for
the exact bilateral quadruped backs-of-hands-down, palms-up,
fingers-toward-knees backward-and-forward wrist rocker; overall `26` is
derived as their maximum. Complexity reflects exact dorsal-hand orientation,
very-light-pressure control, organized elbow/shoulder/scapular/trunk support,
a comfortable backward endpoint, full forward return, and explicit cycle
count. Physical difficulty reflects partial-bodyweight wrist flexion,
dorsal-hand and finger pressure, upper-limb and trunk support, floor transfer,
and controlled return without impact or external load. Both anchors remain
review-only and require independent qualified calibration. They assess the
exercise, not the participant.

Its operational values are conservative planning controls, not validated
tissue thresholds or participant classifications. Generation records complete
cycles, wrist-flexion and dorsal-hand-support seconds, backward-range exposure,
pressure and elbow/shoulder/trunk faults, floor transfers, technical faults,
symptoms, invalid or partial attempts, stops, rests, actual duration, and
overlapping wrist/hand-support work. Any hand-surface, finger direction, base,
support height, path, hold, padding, force, dose, symptom, or downstream-demand
change must rerun identity, logistics, duration, fatigue/impact, persistence,
and coach/athlete rendering validation. The card remains unpublished until
independent media, graph, calibration, content, and publication gates are
complete.

## Finger Pulses / Palm Lifts candidate calibration

Source 32 proposes exercise complexity / physical difficulty `24/18` for the
exact bilateral quadruped Finger Pulse and `28/22` for the exact bilateral
quadruped Palm Lift. Their derived overall scores are therefore `24` and `28`.
Finger Pulse complexity reflects retained whole-hand contact, first-knuckle
position, graded finger-pressure increase and release, no-bounce control, and
an explicit cycle count. Palm Lift complexity reflects retained finger and
distal-palm contact, simultaneous palm-heel lift, quiet complete lower, and the
moving-contact boundary against finger lifts. Physical difficulty reflects
partial-bodyweight hand and wrist support, local finger or palm action,
organized upper-limb and trunk support, floor transfer, and controlled work
without impact or external load. All four anchors remain review-only and
require independent qualified calibration. They assess the exercise, not the
participant.

The operational limits are conservative planning controls, not validated
tissue thresholds or participant classifications. Generation records exact
variant, complete repetitions, finger-pressure or palm-lift seconds,
hand/wrist/support seconds, required contacts, pressure/range/control faults,
floor transfers, symptoms, invalid or partial attempts, stops, rests, actual
duration, and overlapping grip, hanging, climbing, tumbling, handstand,
crawling, pressing, and other downstream hand-support work. Any moving contact,
base, laterality, support height, path, hold, external force, dose, symptom, or
downstream-demand change must rerun identity, logistics, duration,
fatigue/impact, substitution, persistence, and coach/athlete rendering checks.
Both variants remain unpublished until independent media, graph, calibration,
content, and publication gates are complete.

## Quadruped Shoulder Circles candidate calibration

Source 34 proposes exercise complexity / physical difficulty `30/18` for the
exact bilateral fixed-palm-and-knee, straight-arm, continuous scapular circle;
the derived maximum is `30`. Complexity reflects the four-checkpoint path,
declared first vertical direction, return-to-start count, bilateral fixed
contacts, elbow extension, scapular-versus-spinal or humeral motion boundary,
trunk control, and completion in both directions. Physical difficulty reflects
partial-bodyweight hand support, wrist/shoulder/scapular/trunk demand, floor
transfer, continuous controlled range, and support duration without impact or
external load. Both anchors remain review-only and require independent
qualified calibration. They assess the exercise, not participant proficiency,
skill level, or age.

The operational values are conservative planning controls, not validated
tissue thresholds, rehabilitation prescriptions, or participant
classifications. Generation records exact variant and profile, declared first
direction, planned and completed circles per direction, valid checkpoints,
support seconds, range, tempo, pauses, required contacts, elbow/trunk/scapular
faults, symptoms, invalid attempts, stops, rests, actual duration, floor
transfers, technical fatigue, and overlapping pressing, crawling, handstand,
tumbling, hanging, climbing, overhead, wrist, shoulder, scapular, and trunk-
support work. Landing contacts are zero; impact remains a non-impact planning
classification, while local support and technical fatigue still accumulate.

Any change to support height, contacts, laterality, planted or moving hand,
elbow mode, path, checkpoint order, discrete versus continuous execution,
external force, instability, range, dose, symptoms, or downstream demand must
rerun identity, logistics, duration, cumulative fatigue/impact, substitution,
persistence, and coach/athlete rendering checks. The exact variant remains
unpublished until independent media, graph, calibration, content, and
publication gates are complete.

## Scapular Push-Up candidate calibration

Source 33 proposes exercise complexity / physical difficulty `24/18` for the
exact quadruped dynamic cycle, `32/30` for the high-plank dynamic cycle,
`22/18` for the quadruped protraction hold, and `28/30` for the high-plank
protraction hold. Their derived maximums are `24`, `32`, `22`, and `30`.
Complexity reflects exact base contacts, straight-elbow control, scapular
retraction/protraction or maintained protraction, trunk and body-line control,
and the declared repetition or actual-valid-seconds rule. Physical difficulty
reflects partial- or full-bodyweight hand support, shoulder/scapular and trunk
demand, leverage, sustained support, and controlled work without impact or
external load. All eight anchors remain review-only and require independent
qualified calibration. They assess the exercise, not the participant.

The operational values are conservative planning controls, not validated
tissue thresholds or participant classifications. Generation records exact
variant, complete cycles or valid hold seconds, hand-support and high-plank
seconds, required contacts, scapular range, elbow/body-line/breathing faults,
floor transfers, symptoms, invalid or partial work, stops, rests, actual
duration, technical fatigue, and overlapping pressing, crawling, handstand,
tumbling, hanging, climbing, overhead, wrist, shoulder, scapular, and trunk
demand. Any base, contact, laterality, support height, contraction/count mode,
elbow motion, instability, resistance, dose, symptom, or downstream-demand
change must rerun identity, logistics, duration, fatigue/impact, substitution,
persistence, and coach/athlete rendering checks. All four variants remain
unpublished until independent media, graph, calibration, content, and
publication gates are complete.

## Wall Slides with Lift-Off candidate calibration

Source 35 proposes exercise complexity / physical difficulty `30/16`, with a
derived maximum of `30`, for the exact bilateral fixed-foot forearm wall slide
and required terminal full-arm lift-off. Complexity reflects the prescribed
forearm setup and retained contact, coordinated upward slide, terminal
straight-arm lift-off, replacement, full return-to-start count, trunk control,
and separation from supported reach, hands-only lift, foam-roller, wall-angle,
and prone-raise tasks. Physical difficulty reflects unloaded standing arm
elevation, forearm-wall friction, shoulder/scapular and rotator-cuff demand,
terminal lift-off, controlled range, and repeated overhead time without impact
or meaningful external load. Both anchors remain review-only and require
independent qualified calibration. They assess the exercise, not participant
skill, proficiency, age, readiness, or clinical eligibility.

These operational values are conservative planning controls, not validated
tissue thresholds or rehabilitation prescriptions. Generation records the
exact variant and profile; valid full cycles; arm-elevation, wall-contact, and
lift-off time; range and lift amplitude; tempo and pauses; required contacts;
feet, trunk, lumbar, elbow, and forearm faults; symptoms; invalid or partial
work; stops; rests; actual duration; local and technical fatigue; and overlap
with overhead, pressing, throwing, handstand, shoulder, scapular, rotator-cuff,
and trunk work. Landing contacts are zero and impact stays in the non-impact
planning class, while local shoulder/scapular and technical fatigue still
accumulate.

Any change to stance, base, wall interface, forearm or hand contacts, elbow
path, laterality, kneeling or seated posture, lift-off mode, resistance,
instability, range, dose, symptoms, or downstream demand must rerun identity,
logistics, duration, cumulative fatigue and impact, substitution, persistence,
and coach and athlete rendering checks. The exact variant remains unpublished
until independent media, graph, calibration, content, and publication gates
are complete.

## Bilateral Band External Rotation candidate calibration

Source 36 proposes exercise complexity / physical difficulty `26/18`, with a
derived maximum of `26`, for the exact bilateral fixed-foot standing,
unanchored-band, elbows-at-sides outward-and-return cycle. Complexity reflects
bilateral coordination, retained elbow position, organized wrists and trunk,
symmetric comfortable range, controlled return, exact count, band inspection,
and release control. Physical difficulty reflects light elastic resistance,
posterior rotator-cuff and shoulder demand, scapular stabilization, grip, time
under tension, and postural control without impact. Both anchors remain
review-only and require independent qualified calibration. They assess the
exercise, not participant skill, proficiency, age, readiness, or clinical
eligibility.

These operational values are conservative planning controls, not validated
tissue thresholds, rehabilitation prescriptions, or universal recovery rules.
Generation records exact variant and profile; band identifier, condition, and
tension; grip and initial spacing; valid cycles; range, tempo, and hold; elbow,
wrist, symmetry, trunk, and release faults; symptoms; invalid or partial work;
stops; rests; time under tension; actual duration; local and technical fatigue;
and overlap with external rotation, pulling, throwing, climbing, hanging,
handstand, pressing, overhead, shoulder, scapular, rotator-cuff, and grip work.
Landing contacts are zero and impact stays in the non-impact planning class.

Any change to base, laterality, band attachment, shoulder angle, contraction,
required scapular action, action sequence, clinical scope, count, tension,
range, dose, symptoms, or downstream demand must rerun identity, logistics,
duration, cumulative fatigue and impact, substitution, persistence, and coach
and athlete rendering checks. Source 1348 remains unresolved until its exact
eccentric mechanics are established. The Source 36 variant remains
unpublished until independent identity, media, graph, calibration, content,
and publication gates are complete.

## Bear Crawl Rock-Back candidate calibration

Source 38 proposes exercise complexity / physical difficulty `30/24`, with a
derived maximum of `30`, for the exact stationary fixed-palm-and-forefoot,
continuous-knee-hover, backward-and-forward return cycle. Complexity reflects
controlled floor entry and exit, four fixed contacts, one-to-two-inch knee
clearance, long-arm support, active palm pressure, level pelvis, organized
trunk, comfortable backward range, same-start return, breathing, quality
gates, and valid cycle counting. Physical difficulty reflects shared
bodyweight support through both palms and forefeet, sustained knee hover,
closed-chain shoulder/scapular work, trunk and pelvic stabilization, hip and
knee motion, wrist extension, and forefoot support without impact or external
load. Both anchors remain review-only and assess the exercise task, not
participant skill, proficiency, age, readiness, or clinical eligibility.

The operational fatigue and recovery values are conservative planning
controls, not validated tissue thresholds. Generation records the exact
variant and profile; valid cycles; hover and support seconds; range, tempo,
pauses, and rest; contacts and knee clearance; arm, pelvic, trunk, and
breathing faults; symptoms; invalid, partial, and symptom-limited attempts;
floor-transfer and exit time; actual duration; and overlap with wrist,
shoulder, trunk, hip, knee, ankle, crawl, plank, push, handstand, climbing,
hanging, and floor-support work. Any contact, knee-support, hand-height,
surface, limb-action, locomotion, path, load, dose, symptom, or downstream-
demand change reruns identity, logistics, duration, cumulative fatigue and
impact, substitution, persistence, and coach/athlete rendering checks.
Source 912 remains archived and unscored pending human identity review because
it permits knee contact and omits exact start, endpoint, contact continuity,
and count.

## 2026-08-09 — Plank to Down Dog calibration and cumulative-load contract

Migration 511 replaces the inherited `20/20/20` skeleton with one exact
fixed-palm and forefoot high-plank to comfortable inverted-V and same-plank
return cycle. The review-only vector is exercise complexity `30`, physical
difficulty `28`, and overall `30` by maximum. The two anchors describe the
task only. They do not create a participant skill, proficiency, age,
readiness, clearance, or clinical classification.

Generation counts actual valid cycles; palm and forefoot support seconds;
high-plank seconds; head-below-heart seconds; pike range; knee position; heel
height; stance; tempo; pauses; rest; first fault; symptoms; invalid, partial,
or symptom-limited attempts; transfer, station-reset, and exit time; and
overlap with wrist, shoulder, trunk, hip, hamstring, calf, ankle, plank, push,
handstand, crawl, climbing, hanging, and floor-support work. The candidate
budgets and `8–24`-hour recovery range are conservative planning controls,
not validated tissue thresholds. Any support, endpoint, added action,
equipment, symptom, dose, or downstream-demand change reruns identity,
duration, logistics, fatigue, impact, substitution, persistence, and rendered
instruction checks.

## 2026-08-09 — Knee-to-Wall Ankle Rocker calibration and load contract

Source 40 uses a review-only task vector of exercise complexity `18`, physical
difficulty `12`, and overall `18` by maximum. Coordination is `16`;
supervision, failure consequence, and work-capacity demand are `12`; impact is
the normalized scale floor `1`. These values describe the exact standing
knee-forward and return task only. They are not participant skill,
proficiency, age, readiness, clearance, diagnosis, or approved calibration.

Migration 513 preserves semantic zeroes while correcting normalized score
fields: grip demand, grip fatigue, and impact accumulation use the valid
1–100 floor of `1`, while landing contacts per repetition, hand-impact
contacts per repetition, and planned cumulative impact remain `0`, and the
physical impact class remains `none`. Migration 514 completes the required
task-difficulty dimensions without changing the independently reviewed
`18/12/18` core proposal.

Generation tracks side and order; valid complete cycles; weight-bearing
dorsiflexion seconds; foot distance and comfortable range; heel, tripod, foot
rotation, knee-path, pelvis, trunk, balance, and return faults; tempo, pauses,
rest, first fault, symptoms, invalid or partial attempts, duration, station
reset, and exit; and overlapping foot, ankle, Achilles, calf, knee, lunge,
squat, landing, sprint, cut, kick, and balance exposure. The candidate `4–18`
hour recovery range and all cumulative budgets are conservative planning
controls, not tissue thresholds or clinical prescriptions. Any support,
force, load, action, range, symptom, dose, environment, or downstream-demand
change reruns identity, logistics, duration, fatigue, impact, substitution,
persistence, and rendered instruction checks.

## 2026-08-09 — Half-Kneeling Ankle Dorsiflexion Pulse calibration and load contract

Source 41 uses a review-only task vector of exercise complexity `22`, physical
difficulty `14`, and overall `22` by maximum. Coordination is `20`;
supervision, failure consequence, and work-capacity demand are `14`; impact is
the normalized floor `1`. These values describe the exact padded half-kneeling
partial-retreat pulse only. They do not express participant skill,
proficiency, age, readiness, clearance, diagnosis, or approved calibration.

Load fields use grip demand `1`, joint stress `14`, spinal loading `4`, and
eccentric stress `8`; fatigue uses local `14`, grip `1`, technical sensitivity
`22`, impact accumulation `1`, and an estimated `4–18`-hour recovery range.
Physical landing contacts, hand-impact contacts, and planned cumulative impact
remain `0`, with `impactClass=none`. The nonzero score floor is not a claim
that impacts occur.

Generation tracks valid pulses, the initial uncounted endpoint, front-foot
position, retreat amplitude, rear-knee and mat contact, heel and tripod,
foot rotation, knee path, endpoint drift, hand loading, pelvis, trunk,
breathing, first fault, symptoms, kneeling and weight-bearing dorsiflexion
seconds, duration, side change, rise, exit, and overlapping ankle, lower-leg,
knee, kneeling, lower-body, landing, sprint, cut, and kick exposure. All
budgets and recovery values remain conservative planning candidates until
independent human calibration.

## 2026-08-09 — Ankle CARs calibration and load contract

Source 42 uses a review-only task vector of exercise complexity `24`, physical
difficulty `12`, and overall `24` by maximum. Coordination is `22`;
supervision and absolute-load demand are `12`; failure consequence and
work-capacity demand are `10`; impact is the normalized score floor `1`.
These numbers describe the exact seated active circuit only, not participant
skill, proficiency, age, readiness, clearance, diagnosis, or approved
calibration.

Load fields use grip demand `1`, joint stress `12`, spinal loading `1`, and
eccentric stress `8`, with no landing or hand-impact contacts and
`impactClass=none`. Fatigue uses local `12`, grip `1`, technical sensitivity
`24`, impact accumulation `1`, and a planning-only six-hour recovery estimate
with a three-to-twelve-hour range.

Cumulative planning budgets track circuits per direction and side, active
ankle-motion seconds, ankle-mobility load, lower-leg exposure, technical
sensitivity, downstream balance/landing/sprint/cut/kick work, and physical
impact separately. The impact budget remains `0`. Two review-only anchors
propose complexity `24` and physical difficulty `12`; independent qualified
calibration remains mandatory.

## 2026-08-09 — Wall-Supported Bilateral Tibialis Raise calibration and load contract

Source 43 uses a review-only task vector of exercise complexity `18`, physical
difficulty `24`, and overall `24` by maximum. Coordination is `16`,
supervision `10`, failure consequence `8`, work-capacity demand `22`, and
impact the normalized score floor `1`. These values assess the exact
wall-supported bilateral lift-and-return task only; they are not participant
skill, proficiency, age, readiness, clearance, diagnosis, or approved
calibration.

Load fields use grip demand `1`, joint stress `18`, spinal loading `4`, and
eccentric stress `20`, with no landing or hand-impact contacts and
`impactClass=none`. Fatigue uses local-muscle fatigue `32`, grip fatigue `1`,
technical sensitivity `18`, impact accumulation `1`, and a planning-only
24-hour recovery estimate with a 12-to-36-hour range. Physical cumulative
impact remains `0`; the nonzero normalized score floor does not claim impact.

Generation tracks actual valid lift-and-return repetitions, simultaneous
forefoot action, wall and heel contacts, active range, knee position, quiet
return, tempo, pauses, breathing, effort, first fault, symptoms, invalid or
partial attempts, setup and exit time, and overlapping anterior-lower-leg,
ankle, calf, sprint, landing, cut, kick, heel-walk, resisted-dorsiflexion, and
foot-control exposure. Every dose, substitution, symptom, wall/floor change,
or downstream-demand change reruns duration, logistics, fatigue, impact,
identity, persistence, and rendering checks. Two review-only anchors propose
the `18/24` core values; independent qualified calibration remains mandatory.

## Source 44 Standing Calf Raise candidate calibration

Source 44 uses a review-only task vector of exercise complexity `22`, physical
difficulty `32`, and overall `32` by maximum. Coordination is `20`,
supervision `12`, failure consequence `10`, work-capacity demand `30`, and
impact the normalized score floor `1`. These numbers assess the exact wall-
supported bilateral flat-floor rise-and-return task; they are not participant
skill, proficiency, age, readiness, clearance, diagnosis, or approved
calibration.

Load fields use grip demand `1`, joint stress `26`, spinal loading `4`, and
eccentric stress `30`, with no landing or hand-impact contacts and
`impactClass=none`. Fatigue uses local-muscle fatigue `40`, grip fatigue `1`,
technical sensitivity `22`, impact accumulation `1`, and a planning-only
24-hour recovery estimate with a 12-to-36-hour range. Physical cumulative
impact is `0`; the normalized score floor does not claim impact.

Generation tracks actual valid full cycles, wall and forefoot contacts, stance,
foot angle, knee position, height, rise and return tempo, checkpoint, effort,
bilateral timing, breathing, first fault, symptoms, invalid or partial
attempts, setup and exit, and overlapping calf, Achilles, foot, ankle,
running, landing, jumping, cutting, and lower-body exposure. Every dose,
surface, support, laterality, knee-angle, contraction, load, symptom,
substitution, or downstream-demand change reruns identity, duration,
logistics, fatigue, impact, persistence, and rendering. Two review-only
anchors propose the `22/32` core values; independent qualified calibration
remains mandatory.

## Source 45 Toe Yoga candidate calibration

Toe Yoga has three review-only task vectors. Standing hands-free uses
exercise complexity `42`, physical difficulty `8`, and overall `42` by
maximum; wall-touch uses `38/7/38`; seated-bench uses `34/5/34`.
Coordination is respectively `44`, `40`, and `36`; supervision is `10`, `9`,
and `8`; failure consequence is `6`, `5`, and `4`; work-capacity demand is
`7`, `6`, and `5`; impact is the normalized score floor `1` for all three.
These values assess exact tasks only and are not participant skill,
proficiency, age, readiness, eligibility, diagnosis, or approved calibration.

Standing hands-free, wall-touch, and seated joint-stress candidates are `9`,
`8`, and `6`; spinal loading is `3`, `3`, and `2`; eccentric stress is `4`
for all; grip demand is the normalized floor `1`. Every variant has zero
landing and hand-impact contacts and `impactClass=none`. Fatigue uses local
values `11`, `10`, and `8`, technical sensitivity `30`, `27`, and `24`, grip
fatigue and impact-accumulation score floors of `1`, and a planning-only
six-hour recovery estimate with a two-to-twelve-hour range. Physical
cumulative impact remains `0`.

Generation tracks valid cycles by foot, active work seconds, support position,
surface and hygiene, toe visibility, heel and metatarsal-head contacts, phase
order, complete returns, active range, tempo, effort, rest, toe curl and non-
target movement, arch/ankle/knee/body faults, first fault, symptoms, invalid,
partial, assisted, or symptom-limited attempts, duration, and overlapping
foot, toe, calf, balance, running, landing, jumping, agility, and lower-body
exposure. Six review-only anchors cover complexity and physical difficulty
for the three variants; independent qualified calibration remains mandatory.

## Source 46 Short-Foot Drill candidate calibration

Standing hands-free uses candidate complexity/physical/overall scores
`44/8/44`; wall-touch uses `40/7/40`; seated bench uses `36/5/36`.
Coordination is `46`, `42`, and `38`; supervision is `11`, `10`, and `9`;
failure consequence is `6`, `5`, and `4`; work-capacity demand is `8`, `7`,
and `6`; impact is the normalized score floor `1`. These are task estimates,
not participant skill, proficiency, age, readiness, eligibility, diagnosis,
or approved calibration.

Standing hands-free, wall-touch, and seated joint-stress candidates are `9`,
`8`, and `6`; spinal loading is `3`, `3`, and `2`; eccentric stress is `3`;
grip demand is the normalized floor `1`. Every variant has zero landing and
hand-impact contacts and `impactClass=none`. Local fatigue candidates are
`12`, `11`, and `9`; technical sensitivity is `32`, `29`, and `26`. Recovery
is a planning-only six-hour estimate with a two-to-twelve-hour review range;
physical cumulative impact remains `0`.

Generation tracks valid repetitions and actual hold seconds by foot, active
work, support, surface and hygiene, visibility, heel/forefoot/long-toe
contacts, arch shortening, toe curl or lift, ankle rotation, range, effort,
rest, hold, full return, first fault, symptoms, invalid/partial/assisted
attempts, duration, and overlapping foot and lower-body exposure. Six
review-only anchors cover complexity and physical difficulty for the three
variants; independent qualified calibration remains mandatory.
