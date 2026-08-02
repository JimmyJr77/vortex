# Canonical exercise identity resolution

## Score-72 queue completion (2026-07-27)

Migrations 391–396 complete the configured canonical name-similarity queue
through score 72. The pass audits source-card movement contracts, records
mechanical boundaries, and consolidates only controlled variants:

| Migration | Decision type | Count |
|---|---|---:|
| 391 | Score-74 boundaries/quarantines | 65 |
| 392 | Score-74 variant consolidations | 21 |
| 393 | Score-73 boundaries/quarantines | 98 |
| 394 | Score-73 variant consolidations | 26 |
| 395 | Score-72 boundaries/quarantines | 85 |
| 396 | Score-72 variant consolidations | 26 |

The final disposable-PostgreSQL audit has 1,099 active definitions and 577
archived source identities. It finds 621 raw score-72+ name-similarity pairs:
569 are adjudicated as mechanically distinct, 52 are explicitly quarantined
as `needs_human_review`, zero remain unclassified, and zero are exact
collisions. The 52 quarantines preserve missing facts such as foot count,
contact order, stance, hand count, force direction, or repetition boundary;
automation does not guess them.

All 73 consolidations in this pass preserve the legacy source mapping, aliases,
candidate evidence and media, and archived source variants. The surviving
cards and transferred records remain in review. No migration creates a card,
media, relationship, calibration, or publication approval.

Exercise cards contain no skill/proficiency level. Their difficulty model is
exercise complexity plus physical difficulty, with overall difficulty equal to
the maximum. Formal levels remain on the 1,112 `coaching.skill` library cards.

## Result

Migration 252 consolidates 83 redundant canonical definitions into surviving
identities. Migration 299 then consolidates the abbreviated Single-Leg RDL
identity, and migration 300 consolidates five `Med Ball` abbreviations into
their full-name `Medicine Ball` identities. Migration 301 consolidates seven
slam-ball implement, stance, cadence, trajectory, and entry-footwork variants
into their five materially distinct slam identities. Migration 302 consolidates
four 90/90 and shin-box cards whose differences are outcome wording, a reach
overlay, equivalent nomenclature, or continuous-flow delivery. Migration 303
then consolidates a numeric-wording duplicate of 180 Jump to
Stick and a duplicate planned 180-degree turn-and-reaccelerate card whose
approach and turn details are delivery dimensions. Migration 306 consolidates
the duplicate `45-Degree Cut to Stick` wording into `45-Degree Cut and Stick`;
the planned held finish remains distinct from immediate reacceleration and from
an aerial diagonal bound. Migration 307 consolidates twelve Cossack range,
tempo, hold, reach, and implement cards into `Cossack Squat`; the wall-ball
release/reception composite remains separate. Migration 308 consolidates the
generic-reach, explicit T-spine-reach, and half-kneeling-context adductor
rock-back cards into `Adductor Rockback`, with incomplete reach and
half-kneeling execution details explicitly quarantined. Migration 309 resolves
the hanging cluster into distinct `Dead Hang`, `Active Hang`, and
`Scapular Pull-Up` identities, consolidates the exact `Active Hang Scapular
Hold` duplicate, and archives the historical passive-or-active compound source
without making its ambiguous variant selectable. Migration 310 then
consolidates `Hanging Knee Raise`, `Hanging Straight-Leg Raise`, `Hanging Knee
Raise Eccentric Lower`, and the exact tuck-knee duplicate into one `Hanging Leg
Raise` identity. Bent-knee, straight-leg, and eccentric-lower executions remain
explicit variants; the exact tuck duplicate remains archived provenance.
Migration 311 consolidates `Tuck L-Sit Hold` into the straight-arm support
`L-Sit` identity as its short-lever variant, adds one-leg, straddle, and
ring-support variants, and creates a separate review-only `Hanging L-Sit`
definition because overhead suspension changes the primary support action,
grip, shoulder position, equipment, mount, fatigue, and exit.
Migration 312 then resolves the adjacent support-compression boundary. The
historical `Straddle Compression Lift` source becomes the stable survivor for
the broader `Seated Compression Lift` identity; bent-knee, unilateral pike,
bilateral pike, and bilateral straddle executions are explicit variants because
they retain grounded dynamic hip flexion without suspending bodyweight through
the hands. The legacy slug remains stable and the broader name plus historical
names are retained as aliases. `V-Sit` and `Manna Hold` are separate
review-only exercise definitions because the above-horizontal V position and
the Manna hip/leg-to-shoulder relationship materially change range, shoulder
mechanics, balance, strength, supervision, fatigue, and exit. Existing
FIG/USAG V-sit and Manna skill-library records retain their formal proficiency
levels; the exercise definitions contain difficulty dimensions only.

Migrations 313 and 314 complete the already-separated Dead Hang, Active Hang,
and Scapular Pull-Up cards without changing those identities. Each exercise has
baseline, foot-assisted, band-assisted, ring, weighted, and single-arm
variants. Selectable taxonomy is limited to the controlled `hang`, `pull`, and
`brace` keys; grip, scapular position, suspension, elbow constraint, and related
mechanics are retained as movement qualifiers. The cards use only exercise
complexity and physical difficulty, with overall difficulty mechanically
derived as their maximum. No exercise-card skill level is assigned.

Migration 315 resolves the final order-sensitive box/depth cluster without
collapsing two materially different sequences. `Depth Jump to Box Jump` is an
exact semantic duplicate of `Depth Drop to Box Jump`: step from a drop box,
contact the floor, immediately jump to a target box, stabilize, and step down.
`Box Jump with Altitude Landing` is an exact semantic duplicate of `Box Jump to
Depth Drop`: jump from the floor to a box, stabilize, deliberately step off,
and stick the floor landing. Those two duplicate definitions are archived with
their sources, aliases, media, variants, profiles, and resolution provenance
preserved. The surviving depth-first and box-first identities remain separate
because reversing contact order changes the initial task, reactive demand,
landing outcome, equipment layout, dosage, coaching, and substitution rules.
Migration 316 completes both survivors with baseline and hands-on-hips variants
and two contextual profiles per variant. It assigns no exercise-card skill
level and creates no approval.

Migration 317 resolves the kneeling medicine-ball chest-pass cluster.
`Tall-Kneeling Medicine Ball Chest Pass`, `Tall-Kneeling Chest Pass to Wall`,
and `Half-Kneeling Chest Pass to Wall` consolidate into the stable `Kneeling
Medicine Ball Chest Pass` survivor because all retain the same two-hand
horizontal projection from the chest. Tall versus half kneeling changes stance
and anti-rotation demand; throw-only versus rebound-and-catch changes return
tracking and absorption. Migration 318 therefore models the cross-product as
four exact variants rather than separate exercise identities.

The consolidation does not infer missing source content. The two generic
legacy kneeling sources do not declare tall versus half kneeling or whether a
catch is required, so their source variants and profiles remain archived,
nonselectable provenance. The explicit tall- and half-kneeling sources remain
traceable through source mappings and aliases. Seated, supine, standing,
rotational, unilateral shot-put, and overhead throws remain separate
definitions because their base, primary action, projection, laterality, or
stimulus changes.

Migration 319 resolves the next high-similarity pair. `Medicine Ball Rotational
Wall Throw` consolidates into the stable `Medicine Ball Rotational Throw`
survivor because both legacy cards describe the same standing two-hand
rotational medicine-ball projection into a wall. The wall is a target contract,
not a separate exercise identity. Migration 320 creates exact
throw-and-retrieve and predictable-rebound-and-catch variants; neither legacy
source declares that return behavior, so both original source variants remain
archived and nonselectable. Half-kneeling, step-behind, scoop, slam, unilateral
shot-put, and forward chest-pass tasks remain separate definitions or proposed
variants because they change the base, approach, path, laterality, or primary
action. Migration 321 only corrects the new family's equipment arrays to
controlled taxonomy keys.

Migration 322 resolves `Med Ball Shuffle-to-Rotation Throw` as the same
identity as `Shuffle-to-Rotational Medicine Ball Throw`. Both sources prescribe
a lateral shuffle or crow-hop into a controlled plant and two-hand rotational
medicine-ball projection; name order and seed-score drift are not movement
boundaries. Migration 323 creates exact throw-only and rebound-catch variants
while preserving shuffle count, approach distance, target, ball specification,
and planned/reactive cueing as declared modifiers. Static, step-behind, bound,
scoop, slam, shot-put, and partner-reactive tasks remain separate reviewed
variants or definitions where their mechanics or operations cross a boundary.

Migration 324 consolidates `Single-Leg Box Jump to Single-Leg Landing` into the
stable `standing-box-jump-to-single-leg-landing` definition and renames the
survivor `Box Jump to Single-Leg Landing`. A single-leg landing is the defining
terminal action; bilateral versus unilateral takeoff is an exact variant
boundary, not a second identity. Migration 325 creates bilateral-takeoff and
same-leg-unilateral-takeoff variants with exercise-complexity/physical-
difficulty scores of `62/60` and `74/72`; overall is mechanically `62` and `74`.
It adds four delivery profiles, four review-only graph edges, and six
review-only calibration proposals without assigning a skill level or creating
an approval.

Migration 326 consolidates `Lateral Line Hop to Single-Leg Stick` into
`Single-Leg Lateral Hop to Stick`. The line is a target constraint and the
controlled single-leg stick is the terminal action; continuous rebound line
hops remain a different exercise. Ambiguous legacy execution remains archived
and nonselectable rather than being inferred. Migration 327 creates exact
low-amplitude-control and distance-output variants with exercise-complexity/
physical-difficulty scores of `42/36` and `50/48`; overall is mechanically `42`
and `50`. It adds four delivery profiles, four review-only graph edges, and six
review-only calibration proposals, with all media and human decisions still
quarantined.

Migration 328 resolves the loaded dead-bug pullover family. `Dumbbell Dead Bug
Pullover`, `Band-Resisted Dead Bug Pullover`, `Medicine Ball Dead Bug
Pullover`, and `Dead Bug Pullover with Exhale` consolidate into the stable
`Dead Bug Pullover` survivor. The four labels preserve the same supine
bilateral pullover and trunk anti-extension task; implement, anchor, load, leg
action, range, breathing emphasis, and delivery intent are explicit variant or
profile dimensions. Legacy sources that do not declare the complete exact
contract remain archived and nonselectable. Migration 329 creates dumbbell,
medicine-ball, and band tabletop-hold variants plus dumbbell and band
contralateral-leg-extension variants. Their exercise-complexity/physical-
difficulty values are `34/30`, `32/28`, `36/30`, `46/40`, and `48/40`; overall
is mechanically `34`, `32`, `36`, `46`, and `48`. No exercise skill level or
human approval is inferred.

Migration 330 resolves the bilateral Romanian-deadlift family.
`Dumbbell Romanian Deadlift`, `Kettlebell Romanian Deadlift`, `Double
Kettlebell Romanian Deadlift`, `Sandbag Romanian Deadlift`, `Landmine Romanian
Deadlift`, and `Romanian Deadlift Eccentric` consolidate into the stable
`Romanian Deadlift` identity. Implement, implement quantity, grip, mass
distribution, free or fixed load path, range, and tempo change the execution
contract without changing the bilateral standing loaded hip hinge. Migration
331 creates barbell, two-dumbbell, one-kettlebell, two-kettlebell,
front-held-sandbag, two-hand-landmine, slow-eccentric barbell, and
slow-eccentric dumbbell variants. Their exercise-complexity/physical-difficulty
scores are `42/58`, `38/48`, `36/42`, `40/52`, `40/50`, `42/54`, `48/60`, and
`44/52`; overall is mechanically `58`, `48`, `42`, `52`, `50`, `54`, `60`, and
`52`. Single-leg and staggered-stance RDLs, RDL-to-row, conventional
from-floor deadlifts, good mornings, and ballistic swings remain separate
identities. No exercise skill level or human approval is inferred.

Migration 332 resolves the front-foot-elevated split-squat family.
`Front-Foot-Elevated Dumbbell Split Squat` and `Front-Foot-Elevated Sandbag
Split Squat` consolidate into the stable `Front-Foot-Elevated Split Squat`
identity. All three sources retain a stationary side-specific split stance,
whole lead-foot platform support, rear-foot floor contact, controlled descent,
and lead-leg-biased ascent. Implement, quantity, load position, support, load,
range, platform height, and tempo are exact variant or modifier dimensions.
Migration 333 creates unsupported bodyweight, supported bodyweight, bilateral
suitcase-dumbbell, contralateral single-dumbbell, ipsilateral single-dumbbell,
and front-held-sandbag variants. Their exercise-complexity/physical-difficulty
scores are `38/32`, `32/28`, `42/50`, `46/44`, `44/44`, and `42/48`; overall
is mechanically `38`, `32`, `50`, `46`, `44`, and `48`. Rear-foot elevation,
heel-only elevation, stepping lunges, and jumping split squats remain separate
identities. No exercise skill level or human approval is inferred.

Migrations 369 and 370 resolve the remaining stationary Split Squat cluster.
The following source definitions consolidate into `split-squat` because they
preserve stationary front- and rear-foot floor contact, controlled descent,
lead-leg-biased ascent, and return to the same split stance:

- `barbell-split-squat`
- `bodyweight-split-squat`
- `front-rack-kettlebell-split-squat`
- `sandbag-split-squat-strength`
- `slow-eccentric-split-squat`
- `split-squat-eccentric-to-pause`

Implement, implement quantity, grip, load position, external load, hand
support, eccentric duration, and pause duration are exact variant dimensions.
`landmine-handle-grip-split-squat` likewise consolidates into
`landmine-split-squat` because the handle is an attachment and grip dimension.
The landmine survivor remains `needs_human_review`: its current source allows
either stationary split-stance repetitions or a stepping reverse lunge, so its
primary ordered action cannot be assigned safely by automation.

`split-squat` and `bulgarian-split-squat` remain distinct. The former keeps the
rear forefoot on the floor; the latter, now canonically named
`Rear-Foot-Elevated Split Squat`, places the rear foot on a stable declared
support. Rear-foot elevation changes support geometry, balance, setup,
rear-limb contribution, entry and exit, failure modes, logistics, and
substitution behavior. Front-foot elevation, bilateral parallel-stance or sumo
squats, box contact, dynamic versus isometric contraction, perturbation,
takeoff/flight/landing, and terminal stick requirements also remain explicit
identity boundaries.

Migration 370 creates eight floor-based and six rear-foot-elevated exact
variants. Every variant stores exercise complexity and physical difficulty;
overall difficulty is `max(exerciseComplexity, physicalDifficulty)`. Exercise
cards carry no athlete proficiency or skill-library level. All new evidence,
media, alternate assessments, graph edges, calibrations, and test packets
remain candidate or review-only records with no fabricated approval.

Migrations 345 and 346 resolve and complete the Pallof family. Ten fixed-stance
press definitions consolidate into the stable `pallof-press-pallof-hold`
survivor, now named `Pallof Press`; two step-out definitions consolidate into
`Pallof Step-Out`. Band versus cable, stance, repetition versus isometric hold,
slow return, reach length, and a declared supervised partner anchor are exact
variant or delivery dimensions. Lateral travel is a separate step-out identity.
Marching, diagonal press-lift, row, pulldown, landmine press, and mini-band
lateral walk cards remain distinct because their primary action, locomotor
contract, or force path changes.

Migrations 348 and 349 consolidate `Stir-the-Pot Plank` into the stable
`Stir-the-Pot` definition and complete the survivor. The two source cards
prescribe the same forearms-on-stability-ball circular plank. The word “plank”
and a throwing-athlete programming context are not identity boundaries.
Knee-supported small circles, toe-supported small circles, and toe-supported
large circles are exact variants. Static planks, linear roll-outs, body saws,
pikes, unilateral support, and reactive perturbations remain separate actions
or proposals requiring dedicated review.

Migrations 351 and 352 consolidate three direct synonym pairs without changing
their movement contracts:

- `Quadruped Thread-the-Needle Rotation` resolves to
  `Quadruped Thread-the-Needle`; reach-under followed by open rotation is the
  shared defining action.
- `Single-Leg Tripod Balance` resolves to
  `Single-Leg Tripod Balance Hold`; static single-leg tripod contact and
  controlled posture are the shared action and outcome.
- `Split Squat Iso Hold` resolves to `Split Squat Isometric Hold`; `iso` is an
  abbreviation and both cards hold the same declared split-squat position.

Heel-sit position, hand support, visual input, stance, depth, goblet load, and
hold duration remain exact variant, modifier, or delivery dimensions. Loaded
or ballistic thoracic rotation, balance reaching or perturbation, rear-foot
elevation, dynamic split squats, and split-squat perturbation remain separate
definitions. The migration records deterministic candidate decisions only and
creates no human approval.

Together, the migrations
preserve:

- all 1,676 legacy source IDs through `exercise_definition_source_v1`;
- all 1,823 canonical variants and their difficulty, equipment, load, and fatigue
  data;
- all 1,974 contextual delivery profiles;
- provenance and an explicit resolution record for every consolidation.

The resulting library contains 1,280 active canonical definitions, 396 archived
redundant definitions, 634 explicit identity-resolution records, and zero
direct canonical-name, display-name, or alias-to-name collisions. Consolidated
source definitions are archived and remain traceable; they are not deleted.
The quality report expands and normalizes every canonical name, display name,
and alias before matching definition pairs, so an alias equal to another card's
name can no longer escape the collision gate.

## Similar names that remain distinct

The 36 name-based high-similarity pairs identified after migration 252 are
warnings, not automatic identity collisions. Their qualifiers require explicit
content review and must not be silently combined:

- start versus sprint-start; call-out versus cut; turn versus open turn;
- rebound versus pogo or broad rebound;
- bear-plank versus balance, and free movement versus ladder or box;
- two-point versus three-point starts;
- floor versus box, single versus double, and regular versus bottoms-up loading;
- lateral, rotational, forward/backward, inversion, and eversion directions;
- generic kneeling, tall-kneeling, and half-kneeling positions;
- line, low-line, on-cue, split-stance, triple-hop, and wall-target constraints;
- overhead versus overhead-back projection;
- squat-clean versus wall-ball-shot completion;
- press, push press, Z-press, arc press, press-out, deadlift-to-row, and
  180-degree rotation;
- countermovement versus non-countermovement;
- depth drop, depth jump, box jump, and their different execution order.

After migration 368, the indexed queue contains 913 raw potential pairs at the
conservative score-72 threshold. Explicit identity decisions remove every
high-similarity movement-boundary pair from the unresolved queue. The
remaining queue contains 807 score-72-or-higher pairs and 185
score-80-or-higher pairs. The unresolved score-85 queue is empty. One score-84
pair remains explicitly quarantined as `needs_human_review` because the legacy
Single-Leg Line Hop and Stick source does not declare the takeoff leg, landing
leg, contact count, or terminal behavior. Two additional lower-similarity
Hip Thrust boundaries are quarantined because the sources do not resolve
upper-body support geometry. None is a direct identity collision.
The two score-100 warnings are “Depth Drop to Box Jump” versus “Box Jump to
Depth Drop” and “Dead Hang” versus “Active Hang.” Both were already adjudicated
as materially different ordered sequences or scapular actions. The old bigram
score ignores word order and can also maximize across aliases, so these remain
documented nonblocking warnings. Migration 315 preserves both order-specific
identities while consolidating each
of their actual semantic duplicates, and exact collision detection compares
normalized identities directly. The meaningful order difference therefore no
longer blocks either card or leaves a direct identity collision.

Migrations 334–339 resolve the former half-kneeling press and overhead
medicine-ball warnings, the Bulgarian split-squat/RFESS alias collision, and
148 synonym or exact-variant source definitions. Migration 340 explicitly
adjudicates the remaining mechanically clear high-similarity pairs and
quarantines three under-specified names. Migrations 341–343 then resolve those
three using exact movement contracts and consolidate the two newly exposed
variant-level duplicates. No unresolved score-85-or-higher pair remains.

## Migrations 334–362

Migrations 334 and 335 consolidate dumbbell, kettlebell, and band
half-kneeling single-arm strict presses under one stable definition and model
implement, anchor, rack, pressing-side relationship, load, range, and tempo as
exact variants. Migration 336 records the forward/backward overhead
medicine-ball projection boundary and the order-sensitive depth/box boundary.
Migration 337 completes forward and backward overhead projection cards without
collapsing their opposite directions.

Migration 338 records ten additional mechanics-based boundaries. Migration 339
then consolidates 148 active definitions whose differing labels are exact
synonyms or controlled variant/profile dimensions: implement and quantity,
load/rack position, assistance, tempo or hold, cueing, partner/sport context,
setup markers, amplitude, and other declared modifiers. Every legacy source,
alias, candidate evidence row, media candidate, and alternate assessment is
retained. Source variants become archived and nonselectable instead of being
silently reinterpreted.

Migration 340 records 70 deterministic distinct-exercise boundaries using
direction, support base, added actions, contact count, landing contract,
contraction type, and force strategy. It records three `needs_human_review`
decisions where the source content is insufficient. Those records have no
reviewer and do not claim that human review occurred.

Migration 341 resolves that prior queue without claiming human review:

- Dead Bug Wall Press remains distinct from Medicine Ball Dead Bug Press
  because a fixed bilateral wall press and a contralateral movable-ball press
  change the fixed point, available limbs, coordination, and equipment
  contract;
- Lateral Hop to Stick is made explicit as a bilateral takeoff-and-landing
  identity, distinct from Single-Leg Lateral Hop to Stick. Its low-amplitude
  source is consolidated as a variant;
- Med Ball Countermovement Rotational Throw remains distinct from forward
  medicine-ball chest projection because stance, plane, target direction, and
  release action differ.

Migration 342 creates complete review-only card contracts for those five
survivors. Migration 343 consolidates Countermovement Medicine-Ball Chest Pass
as an exact preload variant of Medicine Ball Chest Pass and records Bilateral
Lateral Jump to Stick versus Tuck Jump to Lateral Stick as distinct action
sequences. Migration 344 enforces the controlled progression dimension
taxonomy and removes obsolete exercise skill-level metadata keys.

Migration 345 consolidates the Pallof press and Pallof step-out synonyms and
controlled variants, while persisting the adjacent movement boundaries.
Migration 346 completes both survivors without granting human approval.
Migration 347 removes the enumerated obsolete exercise-card level fields across
canonical and legacy exercise surfaces. Migration 350 then removes broader
historical spellings recursively and adds database constraints that reject any
future skill/proficiency classification key at any exercise-card JSON depth.
All exercise, scaling, and safety-profile level columns are null. Exercise
difficulty remains exercise complexity plus physical difficulty, with overall
derived as their maximum. The 1,112 dedicated skill-library level assignments
are intentionally untouched.

Migration 348 records the Stir-the-Pot duplicate decision and preserves both
legacy sources and aliases. Migration 349 supplies exact support-base and
circle-size variants, complete planning/support contracts, candidate evidence
and media, alternate decisions, and review-only graph and calibration
proposals. It creates no human approval.

Migrations 351 and 352 consolidate the direct Thread-the-Needle, Single-Leg
Tripod Balance, and Split-Squat Isometric synonym collisions and complete the
three survivors with exact variants and contextual delivery contracts.

Migration 353 consolidates nine more redundant definitions into four stable
identities:

- `Snap-Down to Athletic Stick`, `Snapdown Landing Stick`, and the control
  version resolve to the no-flight, no-rebound `Snap-Down to Stick`;
- `Mirror Shuffle Drill` and `Partner Mirror Shuffle` resolve to the live,
  noncontact lateral leader-follower `Mirror Shuffle`;
- both five-yard accel/decel cards resolve to distance variants of
  `Sprint-to-Stick Deceleration`;
- `Single-Leg Pogo in Place` and `Single-Leg Pogo Jumps` resolve to
  `Single-Leg Pogo`.

The same migration records `Single-Leg Pogo Hold-to-Hop` as distinct because
its declared balance hold, short contact bout, and terminal stick/reset change
the action sequence and finish. Migration 354 completes the four survivors with
eight selectable variants, 16 contextual profiles, candidate evidence, media,
alternate assessments, and review-only graph and calibration proposals.
Support, distance, travel direction, cadence, amplitude, lane, speed, and dose
remain variant or delivery dimensions. Flight, rebound, terminal sticks,
crossovers, cuts, reactive cues, resistance, obstacles, and linked actions
remain explicit identity boundaries. Neither migration assigns an exercise
skill/proficiency level or grants human approval.

Migration 355 adjudicates the next ten score-84 warnings as distinct movement
contracts. The boundaries are half-turn versus quarter-turn; required terminal
deceleration-and-stick versus a sprint exit; bilateral lateral flight versus a
stepping rhythm; linear, curved, and frontal-plane bound projections; elevated
terminal landing versus an immediate second takeoff; reversed broad-jump/drop
sequences; rear-foot versus front-foot elevation; a lateral unilateral Cossack
shift versus a bilateral fixed-path landmine squat; and crossover-first versus
drop-step-then-crossover footwork. The migration changes no card content,
difficulty, media, relationships, calibration, or publication state. All ten
rows require human review before release, and an existing human identity
decision takes precedence over the deterministic queue decision.

Migration 356 consolidates six short-contact vertical rebound sources into
`Drop Jump`, two countermovement vertical rebound sources into `Depth Jump`,
and four distance-labelled sources into `Falling Start Sprint`. Low-box height,
quarter-squat wording, rebound height, exact sprint distance, units, finish
markers, timing, and run-out remain variant or delivery dimensions. Drop Jump
and Depth Jump remain separate because their declared contact strategy and
quality metric differ. Landing-only drops, horizontal or lateral rebounds, and
the single-step Falling Start Position Hold remain separate actions. The
migration preserves all source mappings and archived source variants, creates
no approval, and assigns no exercise skill/proficiency level.

Migration 357 records five newly exposed name-similarity pairs as distinct
using diagonal cable direction, ladder contact order, landmine support/path,
and floor-origin versus standing top-down hinge contracts. A sixth distinct
landmine boundary already existed and is preserved. The Single-Leg Line Hop and
Stick source remains `needs_human_review` because it does not identify takeoff
leg, landing leg, contact count, or whether the finish is a stick or
reacceleration. That quarantine has no reviewer and is not presented as a
human decision.

Migration 358 consolidates the two remaining mechanically supported score-84
variant duplicates. `Reactive 45-Degree Hop-to-Cut` resolves to
`Reactive Hop-to-Cut`; cut angle, direction, cue, hop direction, approach,
exit, terminal action, and dose remain declared variant or delivery
dimensions. `Seated Dumbbell Overhead Press` resolves to the stable
`seated-barbell-overhead-press` definition, now named `Seated Overhead Press`;
barbell versus dumbbell, grip, rack, independent-arm demand, bench support,
range, load, spotting, pickup, and set-down remain exact variant dimensions.
All aliases and source mappings are retained. The under-specified legacy
baseline variants are archived and nonselectable, and neither survivor gains
approval or an exercise skill/proficiency level.

Migration 359 records the newly exposed `Reactive 45-Degree Cut` versus
`Reactive Hop-to-Cut` boundary as distinct. The former uses a marked approach,
cue-driven plant, and controlled exit; the latter adds a discrete hop and
presents the cue during flight or landing so the landing contact becomes the
transition into the cut. Takeoff, flight, impact count, ordered contacts, cue
window, load, fatigue, coaching, regressions, and stop rules therefore differ.
The decision changes identity-queue state only and remains quarantined.

Migration 360 completes the two survivors consolidated by migration 358 without
changing any identity decision. `Reactive Hop-to-Cut` now has exact bilateral
hop-to-reactive-45-degree-cut and hop-to-reactive-90-degree-cut variants.
`Seated Overhead Press` now has unsupported and back-supported barbell variants
plus neutral- and pronated-grip back-supported dumbbell variants. The generic
legacy baselines are archived and nonselectable. Cut angle, cue modality,
response side, lane geometry, implement, grip, bench support, range, load,
tempo, spotting, pickup, and set-down remain explicit variant or delivery
dimensions. Exercise cards contain only complexity and physical-difficulty
assessment; the dedicated skill library retains its level assignments.
Evidence, media, alternate, graph, and calibration artifacts remain
candidate/review only, so the identity queue is unchanged.

Migration 361 consolidates five implement-, load-, or laterality-labelled
sources into the stable `distance-jump-hip-thrust` definition, whose canonical
name is `Hip Thrust`. Band, barbell, dumbbell, kettlebell, plate, sandbag,
bodyweight, bilateral, and single-leg configurations remain exact variants.
The composite `Hip Thrust / Loaded Glute Bridge` source is consolidated only
because its instructions explicitly place the upper back on a bench; this does
not merge floor-supported Glute Bridge. Every source mapping, alias, legacy
variant, evidence row, and media candidate remains traceable. The migration
also records `Feet-Elevated Hip Thrust` and `Hip Thrust Eccentric Lower` as
`needs_human_review` boundaries because their sources do not resolve whether
the shoulders are floor- or bench-supported.

Migration 362 completes the Hip Thrust survivor with eight exact selectable
variants and 16 contextual profiles. It supplies anatomy, load, fatigue,
recovery, logistics, duration, cumulative budgets, equipment and population
constraints, athlete instructions, coach fault correction, support
operations, 16 candidate evidence sections, five oEmbed-healthy media
candidates, 14 alternate assessments, 12 review-only graph proposals, and 24
review-only calibration proposals. Exercise cards contain only exercise
complexity and physical difficulty, with overall derived as their maximum.
Media playback/content, identity boundaries, graph edges, calibration scores,
and publication still require human review.

Migration 363 consolidates `Partner Tennis Ball Drop Sprint` into the stable
`ball-drop-reaction-sprint` identity. Both sources require a partner to release
a ball and the athlete to accelerate and secure it before the second bounce;
implement specificity belongs to an exact variant rather than a second
exercise identity. Point-and-sprint cone completion, a required hop before
acceleration, a second late direction cue, capture followed by a called cut,
and cue-selected gate running remain separate identities because they change
the terminal task, ordered contacts, cue timing, or capture requirement.
Migration 364 separately records the catch-to-cut versus hop-and-go boundary.
Neither migration grants review or publication approval.

Migration 365 completes the surviving `Partner Ball-Drop Chase and Catch` card
with tennis-ball and reaction-ball exact variants and technique and reactive-
acceleration delivery profiles for each. Exercise difficulty is assessed only
as exercise complexity and physical difficulty, with overall mechanically
derived as their maximum; no proficiency or skill-library level is attached to
the exercise. The card includes anatomy, load, fatigue/recovery, impact,
equipment, environment, population, logistics, duration, dosage, athlete and
coach support, evidence, five candidate media records, alternates, and
review-only relationship and calibration proposals. Metadata and oEmbed health
were checked, but no full-video exact-match, captions, accessibility, reviewer,
approval, or publication state was fabricated.

Migrations 366 and 368 consolidate `Alternate Bounds for Height and Distance`,
generic `Alternating Bounds`, and `Alternating Bounds for Height` into the
stable `alternate-leg-bound-for-distance` identity, now named `Alternating
Bounds`. Each source retains the same consecutive alternating unilateral
forward-bound action. Projection emphasis, contact-time intent, start leg,
distance, contacts, effort, and measurement are exact variant or delivery
dimensions rather than separate exercises or athlete proficiency categories.
The already archived `Alternating Bounds for Distance` source remains
traceable under the same survivor.

Migration 367 creates traditional mixed height-distance and sprint-oriented
distance/rhythm exact variants. Each receives separate exercise-complexity and
physical-difficulty scores; overall is derived as their maximum. Eight
inherited links for lateral, scissor-jump, or same-leg mechanics are retained
as explicit mismatches. Five title-matched Alternating Bounds candidates retain
oEmbed metadata only and still require full human playback, exact-variant,
instruction, safety, caption, accessibility, and approval review. No identity,
media, graph, calibration, card, or publication approval is inferred.

Migrations 371 and 372 complete the score-83 identity batch exposed after the
Split Squat consolidations. Migration 371 records 25 mechanics-based
`distinct_exercises` decisions and three honest `needs_human_review`
decisions. Migration 372 consolidates ten duplicate or controlled-variant
definitions into stable survivors:

- `double-pogo-to-box-jump` into `pogo-to-box-jump`;
- `feet-elevated-ring-row-strength` into `feet-elevated-inverted-row`;
- `sliding-hamstring-curl-eccentric` into `hamstring-slider-curl`;
- `landmine-ball-grip-squat-to-press` into
  `landmine-squat-to-press`;
- `landmine-hinge-to-row` into
  `landmine-romanian-deadlift-to-row`;
- `skater-bound-to-stick` into `lateral-bound-to-stick`;
- `low-hurdle-quick-hop` into `low-hurdle-hops`;
- `wall-ball-shot-put-throw-to-wall` into
  `medicine-ball-shot-put-throw`;
- `repeated-broad-jump-elastic` into `repeated-broad-jump`; and
- `wall-facing-handstand-hold` into `wall-handstand-hold`.

Source mappings, aliases, candidate evidence, media, alternates, and archived
legacy variants remain traceable. No human decision, media approval, score
approval, or publication state is inferred. Two alias-driven pairs became
visible only after consolidation: Landmine Ball-Grip Press remains distinct
from Landmine Squat to Press because the former has no squat action; Bound to
Stick versus Lateral Bound to Stick remains quarantined because the generic
source does not declare direction.

At score 83 or higher, exactly four unresolved pairs remain and all four have
explicit unreviewed `needs_human_review` records:

- Bound to Stick versus Lateral Bound to Stick: direction is missing;
- Single-Leg Lateral Hop to Stick versus Single-Leg Line Hop and Stick:
  takeoff leg, landing leg, contact count, and finish are missing;
- Dumbbell Overhead Press Eccentric versus Strict Overhead Press: stance,
  implement, tempo, and reset are not jointly declared; and
- Landmine Press versus Two-Hand Landmine Press: hand contract, stance, and
  press path are not fully declared.

Migration 373 completes the consolidated Hamstring Slider Curl survivor with
six exact bilateral, alternating, single-leg, full-cycle, eccentric-only, and
assisted-return variants. Each variant has exercise complexity and physical
difficulty; overall is mechanically their maximum. The card adds 12 contextual
delivery profiles, 16 evidence sections, five oEmbed-healthy candidate videos,
11 alternate assessments, ten review-only relationship proposals, 18
review-only calibration proposals, and a quarantined automated test packet.
Candidate metadata is not a full-video or exact-match approval.

Migration 374 removes neutral skill/proficiency audit markers from identity
evidence and constrains that JSON surface against future reintroduction. It
does not alter any identity decision, rationale, provenance, reviewer state, or
timestamp. The completed database audit finds zero skill/proficiency
classification keys across all 38 exercise JSON columns and zero values across
all three exercise scalar level columns, while all 1,112 dedicated
skill-library level assignments remain intact.

Migrations 375 and 376 complete the score-82 batch exposed after the score-83
consolidations. Migration 375 records 31 mechanics-based
`distinct_exercises` decisions and quarantines Single-Leg Hop to Stick versus
Single-Leg Line Hop and Stick because the line-hop source does not declare
direction, line crossing, or contact count. Migration 376 consolidates 19
duplicate or exact-variant sources:

- `sandbag-good-morning-strength` into `banded-good-morning`;
- `seated-soleus-raise-bent-knee-calf-raise` into
  `bent-knee-soleus-raise`;
- `dumbbell-bent-over-row` into `bent-over-barbell-row`;
- `clock-reach-balance` and
  `single-leg-balance-reach-clock-control` into
  `single-leg-balance-clock`;
- `close-grip-dumbbell-floor-press` and
  `kettlebell-crush-grip-floor-press` into
  `dumbbell-kettlebell-floor-press`;
- `copenhagen-plank-long-lever` into
  `copenhagen-plank-short-lever`;
- `countermovement-jump-to-stick` into `countermovement-jump`;
- `deep-squat-jump-to-box` into `static-squat-jump-to-box`;
- `dumbbell-bench-press-eccentric` into `dumbbell-bench-press`;
- `kettlebell-z-press` into `dumbbell-z-press`;
- `flying-20` into `flying-10`;
- `heels-elevated-goblet-squat` into `goblet-squat`;
- `medicine-ball-hollow-body-hold` into `hollow-body-hold`;
- `kettlebell-suitcase-deadlift` into `kettlebell-deadlift`;
- `low-box-step-off-to-horizontal-stick` into
  `low-box-step-off-to-stick`;
- `moving-target-medicine-ball-chest-pass` into
  `medicine-ball-chest-pass`; and
- `medicine-ball-front-rack-breathing-squat` into
  `medicine-ball-front-squat`.

These are implement, support, lever, terminal-landing, contraction, distance,
target, external-load, or contextual-delivery dimensions. The migration keeps
their source mappings, aliases, candidate evidence, candidate media, and
archived nonselectable legacy variants. It does not infer media verification or
any card, graph, calibration, or publication approval.

After migration 376 the indexed queue has 865 raw and 693 unresolved
score-72-or-higher pairs, 91 unresolved score-80-or-higher pairs, five at score
82 or higher, four at score 83 or higher, none at score 85 or higher, and zero
exact collisions. Every score-82-or-higher pair has an explicit unreviewed
`needs_human_review` record. The library has 1,295 active definitions, 381
archived definitions, and 580 traceable identity decisions.

Migrations 377 and 378 complete the next score-81 batch. Migration 377 records
35 mechanics-based `distinct_exercises` decisions, including the two
alias-driven pairs exposed by consolidation, and four
`needs_human_review` decisions. The quarantines preserve missing dumbbell load
position, line-pogo direction, landmine support stance, and line-hop
direction/contact facts. Migration 378 consolidates 15 exact-variant sources:

- `5-10-5-pro-agility-shuttle` into `pro-agility-5-10-5`;
- `barbell-t-bar-row` into `bent-over-barbell-row`;
- `box-pike-handstand-push-up` into `pike-push-up`;
- `chest-to-wall-handstand-hold` into `wall-handstand-hold`;
- `med-ball-countermovement-rotational-throw` into
  `medicine-ball-rotational-throw`;
- `tempo-front-squat` into `front-squat`;
- `kettlebell-goblet-squat-iso-hold` into
  `goblet-squat-bottom-iso-hold`;
- `lateral-lunge-shift` into `lateral-lunge`;
- `shuffle-to-stick` into `lateral-shuffle-decel-stick`;
- `low-cone-hop-to-stick` into `low-hurdle-hop-to-stick`;
- `one-arm-eccentric-landmine-press` into
  `one-arm-landmine-arc-press`;
- `pistol-squat-to-box` into `pistol-squat`;
- `reverse-lunge-negative` into `reverse-lunge`;
- `sprint-to-balance-deceleration` into
  `sprint-to-stick-deceleration`; and
- `switch-step-up-jump` into `step-up-jump`.

After migration 378 the indexed queue has 843 raw and 638 unresolved
score-72-or-higher pairs, 43 unresolved score-80-or-higher pairs, nine at score
81 or higher, none at score 85 or higher, and zero exact collisions. All nine
score-81-or-higher pairs are explicit unreviewed `needs_human_review` records.
The library has 1,280 active definitions, 396 archived definitions, and 634
traceable identity decisions.

Migrations 379 and 380 complete the score-80 batch and its transitive
alias checks. Migration 379 records 24 mechanics-based
`distinct_exercises` decisions and one new `needs_human_review` decision.
The Line Hops versus Line Pogo Hops source pair remains quarantined because the
sources do not jointly declare direction, line crossing, or foot-contact
contract. The migration also records the alias-driven boundaries exposed by
consolidation: Falling Start remains distinct from the unified short sprint;
Bench Press Pin Iso remains distinct from dynamic Bench Press; and the unified
Bench Press remains distinct from the floor-seated vertical Dumbbell Z-Press.

Migration 380 consolidates 14 duplicate or controlled-variant definitions:

- `two-point-start-to-5-10-yard-sprint` into `10-yard-sprint`;
- `assisted-pistol-squat` into `pistol-squat`;
- `low-bar-back-squat`, `pause-back-squat`, and `tempo-back-squat` into
  `back-squat`;
- `bench-pin-press`, `dumbbell-bench-press`, and `paused-bench-press` into
  `barbell-bench-press`, now displayed canonically as `Bench Press`;
- `depth-drop-to-horizontal-rebound` into `drop-jump`;
- `ring-row-trx-row` into `ring-row`;
- `sandbag-zercher-squat-strength` into `zercher-squat`;
- `single-leg-rdl-negative` into `single-leg-romanian-deadlift`;
- `tibialis-iso-toe-up-hold` into `tibialis-raise-iso-hold`; and
- `worlds-greatest-stretch-with-rotation` into
  `worlds-greatest-stretch`.

Start stance, assistance, bar position, pause, tempo, implement, independent
arm demand, pin height, rebound direction, suspension apparatus, load shape,
eccentric emphasis, support, hold duration, mobility sequence, and dosage
remain exact variant or delivery dimensions. Every source mapping, alias,
candidate evidence record, candidate media record, and archived legacy variant
remains traceable. No review, media verification, relationship approval,
calibration approval, or publication state is inferred.

After migration 380 the indexed audit has 820 raw and 595 unresolved
score-72-or-higher pairs, 313 at score 75 or higher, ten at score 80 or higher,
none at score 85 or higher, and zero exact collisions. All ten score-80-or-
higher pairs have explicit unreviewed `needs_human_review` records; there is no
unclassified pair in that range. The library has 1,266 active definitions, 410
archived definitions, and 673 traceable identity decisions: 251 distinct
boundaries, 409 consolidations, and 13 honest review quarantines.

### Score-79 adjudication

Migrations 381 and 382 resolve the complete score-79 tranche plus every
score-79-or-higher pair exposed transitively by the resulting aliases.
Migration 381 records 42 distinct mechanics boundaries and five
`needs_human_review` decisions. The quarantines retain quarter-turn,
medicine-ball countermovement, landmine arc, low-hurdle lateral-hop, and
rotational bound comparisons whose source cards do not declare enough
laterality, projection, arm, or path facts for safe consolidation.

Migration 382 consolidates 25 traceable source cards beneath stable identities:

- 90/90 external rotation, Box Squat, Bent-Over Row, pull-up/chin-up isometric,
  Copenhagen Side Plank, floor press, lateral leg swing, Icky Shuffle, and
  Plyo Push-Up implement, grip, lever, support, or direction variants;
- lateral-lunge eccentric, low-box step-off, single-leg hop, single-leg RDL,
  snap-down rebound, step-up jump, three-point start, and wall-march variants;
- rotational medicine-ball throw and shot-put throw release, return, stance,
  and partner variants; and
- prone push-up start, Zercher carry, and sandbag or other implement variants.

An initial attempt to place ball-grip, drop-step, and split-stance rotational
landmine sources under the generic rotational press was rejected by the
protected-decision guard. The final migrations preserve those earlier
mechanics boundaries and directly adjudicate the score-79 comparisons instead
of overriding them.

After migration 382 the indexed audit has 773 raw and 514 unresolved
score-72-or-higher pairs, 247 at score 75 or higher, 15 at score 79 or higher,
ten at score 80 or higher, none at score 85 or higher, and zero exact
collisions. All 15 score-79-or-higher pairs are explicit unreviewed
`needs_human_review` records. The library has 1,241 active definitions, 435
archived definitions, and 745 traceable identity decisions: 293 distinct
boundaries, 434 consolidations, and 18 honest review quarantines.

### Score-78 adjudication

Migrations 383 and 384 complete the score-78 tranche and repeatedly re-run the
queue after alias expansion until no unclassified score-78-or-higher pair
remains. Migration 383 records 32 mechanics-based `distinct_exercises`
boundaries and seven `needs_human_review` quarantines. The quarantines preserve
missing takeoff/landing laterality, line-hop foot count and contact posture,
landmine stance/path, landing entry, and pogo contact/finish facts.

Migration 384 consolidates 18 traceable source cards beneath stable identities:

- rhythm-based alternating bounds beneath `alternate-leg-bound-for-distance`;
- barbell loading beneath the canonical `Floor Press`;
- double-dumbbell and single-kettlebell racks beneath `front-squat`;
- front/back dynamic leg swings beneath `leg-swings-front-back`;
- bilateral isometric, single-leg dynamic, and single-leg isometric deliveries
  beneath `glute-bridge`;
- low-hurdle series, lateral Icky, and sprint-float naming variants beneath
  their stable footwork and sprint identities;
- low-speed, eccentric-emphasis, and sprint-entry linear braking beneath
  `Linear Deceleration to Stick`;
- ring and eccentric deliveries beneath `push-up`;
- the cone-target prone start beneath `push-up-prone-start-sprint`;
- eccentric seated soleus work beneath `seated-soleus-raise`; and
- the loaded-intent source beneath `triple-broad-jump`.

The consolidation retains source mappings, aliases, candidate evidence,
candidate media, alternate assessments, and archived nonselectable variants.
Candidate rows with duplicate source keys are deduplicated only for the move;
the remaining source rows stay attached to the archived definition for
traceability. No reviewer, media approval, graph approval, calibration
approval, or publication state is created.

After migration 384 the indexed audit has 750 raw and 467 unresolved
score-72-or-higher pairs, 206 at score 75 or higher, 22 at score 78 or higher,
15 at score 79 or higher, ten at score 80 or higher, none at score 85 or
higher, and zero exact collisions. All 22 score-78-or-higher pairs are explicit
unreviewed `needs_human_review` records. The library has 1,223 active
definitions, 453 archived definitions, and 802 traceable identity decisions:
325 distinct boundaries, 452 consolidations, and 25 honest review
quarantines.

### Score-77 adjudication

Migrations 385 and 386 complete the score-77 tranche and every comparison
exposed transitively by the resulting canonical display names. Migration 385
records 47 mechanics-based `distinct_exercises` boundaries and three
`needs_human_review` quarantines. The three quarantines retain A-skip contact
order, hip-flexor march base/motion, and hurdle-to-box direction and foot
contact facts that the source cards do not jointly declare.

Migration 386 consolidates 16 traceable source cards beneath stable identities:

- High-Bar Back Squat beneath `back-squat`;
- Band Row beneath `band-cable-row`;
- Pause Box Jump beneath `box-jump`;
- ball-grip press beneath `landmine-press`;
- ball-grip, Meadows, Gorilla, Suitcase, neutral-handle T-bar, and V-handle
  T-bar rows beneath `one-arm-landmine-row`, now displayed canonically as
  `Landmine Row`;
- Loaded Squat Jump beneath `squat-jump`;
- Strict Ring Dip beneath `ring-dip`;
- Squat Roll to Stand beneath `rock-and-roll-to-stand`;
- shoulder-loaded and bear-hug sandbag squats beneath
  `sandbag-front-loaded-squat-strength`, displayed canonically as
  `Sandbag Squat`; and
- Tuck Jump to Stick beneath `tuck-jump`.

Attachment, grip, hand count, stance, torso angle, load position and symmetry,
terminal action, pause, tempo, range, load, rest, and dosage remain explicit
variant dimensions. The row consolidation preserves Landmine Press as a push,
Landmine Romanian Deadlift to Row as an active hinge-plus-row sequence, and
Romanian Deadlift as an active hinge without a required row.

Repeated queue regeneration exposed and resolved name-only comparisons against
Split Squat, Cossack Squat, Zercher Squat, rotational landmine pressing,
horizontal and rotational jumps, and press/row/hinge families. After migration
386 the indexed audit has 741 raw and 418 unresolved score-72-or-higher pairs,
158 at score 75 or higher, 25 at score 77 or higher, 22 at score 78 or higher,
15 at score 79 or higher, ten at score 80 or higher, none at score 85 or
higher, and zero exact collisions. All 25 score-77-or-higher pairs are explicit
unreviewed `needs_human_review` records; none is unclassified.

The library has 1,207 active definitions, 469 archived definitions, and 868
traceable identity decisions: 372 distinct boundaries, 468 consolidations, and
28 honest review quarantines. All 1,676 legacy sources remain mapped. No
reviewer, media approval, relationship approval, calibration approval, or
publication state was created.

### Score-76 adjudication

Migrations 387 and 388 complete the score-76 tranche and repeat the queue after
every survivor rename and archival until no unclassified score-76-or-higher
pair remains. Migration 387 records 50 mechanics-based
`distinct_exercises` boundaries and seven `needs_human_review` quarantines.
The quarantines preserve source gaps for hamstring-curl body orientation and
implement retention, generic-bound projection direction, eccentric overhead
press base and return, reactive-cut stimulus, sprint-float zone sequencing,
three-bound foot-contact order, and generic-bound versus lateral-bound
direction.

Migration 388 consolidates 21 traceable source cards beneath final stable
identities:

- Slam-Ball Bear-Hug Carry beneath the Atlas Stone/D-Ball bear-hug carry;
- Barbell Good Morning beneath `banded-good-morning`, displayed canonically as
  `Good Morning`;
- straight-knee and single-leg calf isometric holds plus Single-Leg Calf Raise
  beneath `distance-jump-standing-calf-raise`, whose stable display name
  remains `Standing Calf Raise`;
- Chin-Up and Pull-Up beneath `pull-up-chin-up`;
- feet-elevated and eccentric-negative rows beneath `inverted-row`;
- Half-Kneeling and Tall-Kneeling Cable/Band Chop beneath
  `cable-band-chop`;
- Slider Hamstring Eccentric Slow Lower beneath `hamstring-slider-curl`;
- Head-Turn Single-Leg Balance beneath
  `single-leg-balance-hold-tripod-foot`;
- Lateral Bound to Stick and Skater Hop to Stick beneath `lateral-bound`;
- tennis-ball tracking beneath `medicine-ball-over-shoulder-track-and-catch`,
  displayed as `Over-Shoulder Track and Catch`;
- Two-Hand Landmine Push Press beneath `one-arm-landmine-push-press`,
  displayed as `Landmine Push Press`;
- Tempo Bodyweight Squat beneath `pause-bodyweight-squat`, displayed as
  `Bodyweight Squat`;
- Staggered-Stance Rotational Box Jump beneath `rotational-box-jump`;
- Step-Off to Single-Leg Stick beneath `single-leg-depth-drop-to-stick`; and
- Suitcase Carry Line Walk beneath `suitcase-carry`.

Implement, grip, hand count, base, stance, direction, laterality, balance,
hold, contraction mode, tempo, route, range, load, rest, and dosage remain
explicit variant dimensions. Both kneeling chop sources resolve directly to
the final generic Cable/Band Chop survivor; no intermediate archived identity
is required for idempotency.

After migration 388 the indexed audit has 715 raw and 356 unresolved
score-72-or-higher pairs, 95 at score 75 or higher, 30 at score 76 or higher,
24 at score 77 or higher, 21 at score 78 or higher, 15 at score 79 or higher,
ten at score 80 or higher, none at score 85 or higher, and zero exact
collisions. All 30 score-76-or-higher pairs are explicit unreviewed
`needs_human_review` records; none is unclassified.

The library has 1,186 active definitions, 490 archived definitions, and 946
traceable identity decisions: 422 distinct boundaries, 489 consolidations, and
35 honest review quarantines. All 1,676 legacy sources remain mapped. No
reviewer, media approval, relationship approval, calibration approval, or
publication state was created.

### Score-75 adjudication

Migrations 389 and 390 complete the score-75 tranche and repeat the queue after
all survivor aliases and archives until no unclassified score-75-or-higher
pair remains. Migration 389 records 50 mechanics-based
`distinct_exercises` boundaries and ten `needs_human_review` quarantines. The
quarantines preserve missing source facts for balance support-foot count, bear
position knee contact, reactive rebound contacts, hurdle count and direction,
landmine arc path and base, landmine deadlift stance and attachment geometry,
single-leg landing entry, and line-hop contact/direction contracts.

Migration 390 consolidates 14 traceable source cards beneath stable identities:

- Bear-Hug Sandbag Carry beneath the Atlas Stone/D-Ball carry, displayed as
  `Bear-Hug Carry`;
- Dead Bug Heel Tap / Dead Bug Progression beneath `dead-bug-heel-tap`;
- Deep Squat Pry with Reach beneath `deep-squat-pry`;
- Dumbbell Hollow-Body Pullover Hold beneath `hollow-body-hold`;
- Sandbag Floor Press beneath `dumbbell-kettlebell-floor-press`, displayed as
  `Floor Press`;
- Goblet Squat beneath `front-squat`;
- Split-Stance Rotational Landmine Press beneath
  `landmine-ball-grip-rotational-press`;
- Neutral-Handle Landmine Press beneath `landmine-press`;
- Wall Ball Squat-to-Press Pattern beneath
  `med-ball-squat-press-hiit-fitness`, displayed as
  `Medicine Ball Squat to Press`;
- Slam Ball Clean to Front Squat beneath `medicine-ball-clean-to-squat`;
- Tempo Push-Up and Tempo / Eccentric Push-Up beneath `push-up`; and
- Quadruped Scapular Push-Up Hold and Scapular Push-Up Plus Iso Hold beneath
  `scapular-push-up`.

Implement, material, grip, load position, arm position, stance, attachment,
target/release, contraction mode, tempo, range, load, rest, and dosage remain
explicit variant dimensions. Existing identity decisions remain authoritative:
half-kneeling, tall-kneeling, square-stance, split-stance, and Z-press landmine
bases are not flattened into one card. The fail-closed consolidation guard
caught that conflict during disposable rehearsal before any row committed.

After migration 390 the indexed audit has 699 raw and 299 unresolved
score-72-or-higher pairs, 39 at score 75 or higher, 29 at score 76 or higher,
23 at score 77 or higher, 20 at score 78 or higher, 14 at score 79 or higher,
nine at score 80 or higher, none at score 85 or higher, and zero exact
collisions. All 39 score-75-or-higher pairs are explicit unreviewed
`needs_human_review` records; none is unclassified.

The library has 1,172 active definitions, 504 archived definitions, and 1,020
traceable identity decisions: 472 distinct boundaries, 503 consolidations, and
45 honest review quarantines. All 1,676 legacy sources remain mapped. No
reviewer, media approval, relationship approval, calibration approval, or
publication state was created.

## Governance

Deterministic consolidation never grants publication approval. Every surviving
card remains in review and retains its media, content, relationship, calibration,
and two-person approval gates. A future coach may decide to model one of the
remaining similar pairs as variants of one definition, but that is a card-content
revision—not an unresolved identity collision.

## Front-loaded squat correction

Migration 447 supersedes the earlier decision to consolidate every anteriorly
loaded squat beneath Front Squat. Implement wording alone is not the boundary;
the load-support interface, implement count, symmetry, entry, exit, and failure
contract are. The active identities are therefore:

- Barbell Front Squat: one bar across both anterior shoulders;
- Goblet Squat: one free object supported at center chest by both hands;
- Double Front-Rack Squat: two independently racked implements; and
- Single-Kettlebell Front-Rack Squat: one unilateral upper rack with bilateral
  lower-body support and explicit side dose.

Heel elevation, rack/grip option, exact free implement, tempo, pause, range,
load, and side order are variants or delivery modifiers when the ordered squat
action remains unchanged. Clean-to-squat compounds, carries, presses, rows,
Landmine arcs, Zercher support, bottom isometrics, sumo or split stances, and
unilateral lower-body support remain separate identities.

The new explicit names surfaced nine score-73–77 neighbors. Each is closed as
`distinct_exercises`: One-Arm Row, Landmine Front Squat, Medicine Ball Squat to
Press, Barbell Hack Squat, Cossack Squat, Front-Rack Carry, Medicine Ball Clean
to Squat, and Single-Leg Squat differ in ordered action, anchored/free load
path, support, stance, travel, terminal state, or lower-body laterality. The
post-migration queue contains 588 classified pairs, no unresolved pair, and no
exact collision. These deterministic records carry no reviewer or approval.

## Floor-bridge contraction and support correction

Migration 448 supersedes the earlier decision to consolidate dynamic,
isometric, bilateral, and unilateral floor bridges beneath one `Bridge` card.
The four active identities are:

- Glute Bridge: bilateral support and repeated lift-lower cycles;
- Glute Bridge Iso Hold: bilateral support and one timed terminal hold;
- Single-Leg Glute Bridge: named unilateral support and repeated lift-lower
  cycles; and
- Single-Leg Glute Bridge Iso Hold: named unilateral support and one timed
  terminal hold.

These boundaries change contraction, repetition termination, duration,
laterality, side accounting, load symmetry, pelvic-control demand, fatigue,
validity, and stop rules. Long-lever and standard-lever holds remain variants
of the bilateral isometric card. Barbell, dumbbell, kettlebell, and sandbag
loading remain variants of the bilateral dynamic card. Foot distance, knee
angle, ankle position, free-leg position, load, tempo, repetitions, hold time,
side order, and rest are explicit variant or delivery data.

The combined Hamstring Bridge ISO / Long-Lever definition and its exact-title
duplicate consolidate beneath Glute Bridge Iso Hold. The second Single-Leg
Glute Bridge Iso Hold title consolidates beneath the stable unilateral hold
definition. Glute Bridge March, Glute Bridge Walkout, Adductor Squeeze Bridge
Hold, Back Bridge, and elevated-support Hip Thrust remain distinct based on
added actions, spinal-extension support, required adduction, or upper-trunk
support geometry.

After source remapping and explicit boundary decisions, the queue contains 594
classified score-72+ pairs across 1,054 active definitions, with zero
unresolved pair and zero exact collision. All decisions remain deterministic,
unreviewed records; they grant no content, graph, media, calibration, or
publication approval.

## Single-Leg Romanian Deadlift exact-variant closure

Migration 449 resolves twelve legacy titles beneath one stable Single-Leg
Romanian Deadlift identity. Bodyweight, target reach, external hand support,
loading implement, load side relative to the stance leg, bilateral handheld
load, barbell load, and the slow-eccentric assisted-return prescription are
explicit variants. Distance Jump, Throwing, and Kicking describe delivery
context and therefore remain profiles rather than identities or variants.

The identity requires unilateral stance, a controlled hip hinge with the free
leg extending behind, and return to the declared finish. Bilateral Romanian
Deadlift, staggered-stance Romanian Deadlift, Airplane, Reach and Catch,
Single-Leg Squat to Box, Single-Leg Cone Reach and Stick, and Kettlebell Swing
remain separate because their support count, ordered actions, knee strategy,
terminal contract, implement trajectory, or ballistic intent differs.

Difficulty belongs to exact variants and consists only of exercise complexity
and physical difficulty. It is not athlete proficiency. The post-migration
queue remains closed at 594 classified score-72+ pairs, zero unresolved pair,
and zero exact collision across 1,054 active definitions. These deterministic
identity decisions confer no content, graph, calibration, media, or publication
approval.

## Cossack unresolved-placeholder closure

Migration 450 preserves Cossack Squat as the fixed-wide-stance lateral squat
identity. Range, a bottom hold or pry, terminal stick, tempo, declared thoracic
reach, stable hand support, exact implement, load position, and side dose are
variant/delivery dimensions while the same working-side squat, contralateral
long-leg action, and controlled return or transfer remain required.

The previously active `reach-overlay` and `loaded-unspecified-implement`
records are archived rather than guessed: one lacks reach direction, and the
other lacks both implement and load position. The explicit stable-hand-
supported variant fills the genuine accessibility gap. Cossack Shift to Wall
Ball Toss, stepping Lateral Lunge, and other release/reception or start-position
changes remain separate definitions.

All consolidated legacy aliases are retained, so the independent score-72+
queue remains 594/594 adjudicated pairs with zero unresolved pair and zero
exact collision. These are deterministic identity/variant decisions only and
do not create media, graph, calibration, content, or publication approval.

## Floor Press identity closure

Migration 451 consolidates Floor Press source records 188, 402, 433, 435, 487,
488, 489, 495, and 1021 under canonical UUID
`243e3f71-47ec-4b6a-ac52-3cc68b120f36`. The identity is a supine floor-based
horizontal press whose floor contact supplies the lower range boundary. All
legacy aliases and source maps remain intact.

Implement, implement count, unilateral/bilateral/alternating arm pattern, and
close-neutral or crush grip are exact-variant dimensions. Knee position,
leg-extension preference, pause, tempo, pain-free range ceiling, and optional
bands or chains are modifiers or delivery annotations. Concentric dead-start
pin press, isometric Floor Press testing, glute-bridge Floor Press, dead-bug
Floor Press, and floor fly require new-definition review because their start
contract, measurement intent, concurrent lower-body/trunk task, or joint
action differs.

Bench Press, Close-Grip Bench Press, Push-Up, Half-Kneeling Single-Arm Press,
Z Press, One-Arm Landmine Floor Press, One-Arm Row, and kettlebell crush curl
remain distinct based on support surface, body orientation, force direction,
ordered action, implement path, or terminal contract. The independent audit
also resolved three newly surfaced fuzzy pairs—Floor Press versus Close-Grip
Bench Press, Half-Kneeling Single-Arm Press, and One-Arm Row—as mechanically
distinct.

The queue now contains 598/598 adjudicated score-72+ pairs, zero unresolved
pair, and zero exact collision across 1,054 active definitions. These identity
decisions confer no media, graph, calibration, content, or publication
approval.

## Rotational Ball Slam identity closure

Migration 452 consolidates legacy source records 1162, 1163, 1165, 1168, and
1483 under canonical UUID `1af84588-3b81-4008-be73-e2995280769f`. The identity
is a standing, two-hand ballistic movement that coordinates foot and hip pivot,
trunk rotation, and an overhead or large-arc ball path before a side-directed
release into a marked floor zone.

Stationary diagonal, stationary rainbow arc, and step-behind diagonal remain
exact variants because trajectory and entry materially alter coordination,
range, space, momentum, and deceleration. Alternating sides is a delivery and
laterality prescription, not another movement variant. Dead-ball retrieval
versus an assigned rebound catch is declared ball/recovery behavior. The old
side-to-side variant and duplicate overhead-to-side variant remain stable and
traceable but archived rather than selectable.

Straight overhead slams, wall or free-flight rotational throws, rebound-slam
catch tests, interval-reset slams, scoop slams, tall-kneeling slams, combined
slam-to-throw, slam-to-sprint, and sprawl-to-slam sequences remain distinct.
Six newly surfaced fuzzy comparisons—shot-put throw, forward overhead throw,
rotational catch-and-stick, shuffle-to-rotational throw, rotational toss to
lateral bound, and side toss with step—were also classified as distinct by
release target, received versus projected load, approach, added athlete flight,
or terminal sequence.

The independent queue now contains 605/605 adjudicated score-72+ pairs, zero
unresolved pair, and zero exact collision across 1,054 active definitions.
These deterministic identity decisions create no media, graph, calibration,
content, or publication approval.

## One-Arm Row identity correction

Migration 453 separates a legacy cluster that had been over-consolidated into
One-Arm Row. Canonical UUID `e768f302-a920-4aeb-8627-957fd7a96f00` now owns only
the actual unilateral dumbbell, kettlebell, standard landmine, and landmine
suitcase sources: 195, 496, 1436, and 1438. Implement, declared support,
stance/orientation, handle, pull target, and trunk policy are exact-variant
dimensions beneath this identity; pause, tempo, range, load, and straps remain
modifiers or delivery annotations.

Landmine Meadows Row source 1434 maps to existing Meadows Row UUID
`d3ca1c93-ae41-4eb0-bf44-caa5fab6d0b7`. Bilateral V-handle and neutral-handle
T-bar sources 1435 and 1450 map to existing Two-Hand Landmine Bent-Over Row UUID
`cd973ec2-00ed-4f69-baf1-b4a152d359b5`. Those identities differ by named
perpendicular sleeve setup or bilateral hand count and one shared repetition;
they are not generic unilateral-row variants.

The legacy Landmine Gorilla Row source 1441 contradicts its alternating-row
claim by declaring one fixed landmine and a double handle without an executable
hand/load sequence. Landmine Ball-Grip Row source 1448 omits hand count, support
orientation, and attachment geometry. Both keep their stable archived records
and remain nonselectable until original authoritative specifications resolve
the missing facts. No inferred variant was created.

The corrected aliases surfaced two additional fuzzy comparisons. Landmine
Press versus Two-Hand Landmine Bent-Over Row is a fixed-diagonal press versus a
bilateral fixed-arc pull. Landmine Romanian Deadlift to Row versus Meadows Row
is a dynamic hinge-then-row sequence versus a held staggered perpendicular
unilateral pull. Both are explicitly distinct. The independent queue remains
605/605 adjudicated score-72+ pairs with zero unresolved pair and zero exact
collision; these deterministic resolutions confer no human approval.

## Short Acceleration Sprint identity preservation

Migration 454 does not reopen or alter the 20-source identity decisions made
by migrations 419 through 421. The six exact start variants remain selectable,
while the walk-in two-point and build-up three-point variants remain stable,
traceable, and nonselectable until direct evidence resolves their boundaries.

The migration only normalizes current-auditor fields. Start geometry, signal
mode, lead side, distance, effort, and finish/run-out remain declared variant
or delivery facts; they are not athlete proficiency levels. No source mapping,
alias, similarity adjudication, exact collision, graph approval, calibration
approval, media approval, or publication decision is created. The independent
queue therefore remains 605/605 adjudicated score-72+ pairs with zero
unresolved pair and zero exact collision.

## Push-Up identity completion

Migration 455 makes Push-Up the stable family identity for legacy sources 185,
186, 187, 579, 580, 581, 582, 583, 584, 769, 770, 815, 816, and 1048. Sources
580 and 816 are the same feet-elevated closed-chain press and collapse to one
exact variant. Stable support height, body angle, hand base, range, tempo,
load, repetitions, and rest remain declared delivery facts.

The family owns 11 executable exact variants: standard floor, hands-elevated,
feet-elevated, stable deficit, close-grip, ring suspension, archer lateral
shift, pseudo-planche forward lean, weighted vest, floor eccentric-only, and
ring eccentric-only. Full-cycle tempo does not alter the task identity, so
sources 187 and 579 are archived modifier annotations. Eccentric-only delivery
does alter the repetition and assisted-return contract and therefore remains
an exact variant.

`One-Arm Push-Up Progression` source 585 is not consolidated. The label does
not specify the working hand, assistance/counterbalance, foot base, hand
position, range, repetition sequence, or return strategy. Its definition and
variant stay stable, archived, traceable, and nonselectable pending original
authoritative evidence.

Two similarity artifacts surfaced after consolidation and are explicitly
distinct. Weighted Vest Pull-Up is an overhead vertical closed-chain pull with
elbow flexion; Push-Up is a prone horizontal closed-chain press with elbow
extension. Close-Grip Bench Press is a supine, open-chain, externally loaded
bench press; Push-Up is a prone bodyweight press against fixed hand support.
Shared words or a close-grip/vest modifier do not erase those biomechanical and
operational boundaries.

The independent queue now contains 604/604 adjudicated score-72+ pairs, zero
unresolved pair, and zero exact collision across 1,048 active definitions.
These machine resolutions remain reviewable and confer no media, graph,
calibration, content, or publication approval.

## Reverse Lunge identity completion

Migration 456 assigns legacy Reverse Lunge sources 172, 380, 381, 421, 473,
565, 753, 1009, and 1301 to stable family UUID
`f5640b99-b702-4747-80bb-b603236bbbc6`. Sources 172 and 565 describe the same
bodyweight full-cycle task and collapse to one exact variant. Source 381 is an
explicit barbell front-rack variant, source 1301 is an explicit medicine-ball
chest-hold variant, and source 753 is a slow-eccentric dosage annotation because
the authored repetition still returns to standing.

The generic barbell source 380 omits rack position; dumbbell source 421 and
kettlebell source 473 omit implement count and carry position; sandbag source
1009 permits an undeclared grip or hug. Each retains a stable archived,
traceable, nonselectable definition and `needs_human_review` disposition. A
label or video title cannot safely supply the missing executable facts.

Walking, forward, lateral, and crossover lunges; stationary split squats; and
lunge-to-press, throw, jump, or sprint sequences remain distinct identities
because they change direction/travel, support or terminal position, plane,
ordered action, or flight. Supported, slider, deficit, front-foot-elevated,
goblet, ipsilateral, and contralateral reverse-lunge versions remain assessed
alternates until their exact contracts and evidence are reviewed.

The independent queue remains fully adjudicated at 604/604 score-72+ pairs,
zero unresolved pair, and zero exact collision across 1,048 active definitions.
These deterministic dispositions confer no media, relationship, calibration,
content, or publication approval.

## Lateral Lunge identity completion

Migration 457 audits sources 63, 174, 385, 475, 752, 1010, 1055, and 1328
against stable Lateral Lunge UUID
`6a58d6cc-4a46-409a-9b89-c4330c3b8d6f`. The completed family retains one
selectable bodyweight step-out full-cycle variant. Stance, lateral step and
return, side-balanced dose, range, tempo, repetitions, rest, and cumulative
exposure remain explicit variant or delivery facts rather than athlete skill.

Source 752 retains Lateral Lunge identity as a slow-eccentric full-cycle
modifier annotation because the authored repetition returns to standing.
Sources 63, 174, 385, 475, 1010, and 1328 retain stable archived definitions
and nonselectable dispositions: their authored records mix fixed-stance and
step-out actions, omit implement count or position, omit rack/carry/hold or
load-side facts, contain extraneous compound instructions, or leave both step
and load protocol unresolved. A generic exercise name or media title cannot
supply those missing identity facts.

Source 1055 is reassigned to stable Cossack Squat UUID
`40f08f99-5977-4e49-8907-02d80330d422` as a low-amplitude shift variant. Its
label says `Bodyweight Lateral Lunge`, but its executable setup establishes a
fixed wide stance and the instructions shift side to side without stepping.
Identity follows that authored contract. The correction is deterministic and
reviewable; it does not imply human approval.

Step-out Lateral Lunge remains distinct from Cossack Squat/fixed-stance side
shift, stationary or walking lunges, reverse/forward/crossover lunges, lateral
step-ups, skater bounds, and lunge-to-press/raise/throw sequences because they
change stance transition, travel direction, support, flight, plane, or ordered
terminal action. Loaded Lateral Lunge versions remain alternate assessments
until implement count, carry/rack/hold, load side, full repetition contract,
and evidence are exact.

The independent queue remains fully adjudicated at 604/604 score-72+ pairs,
zero unresolved pair, and zero exact collision across 1,048 active definitions.
These mappings and deterministic dispositions confer no media, relationship,
calibration, content, or publication approval.

## Medicine Ball Shot-Put identity completion

Migration 458 retains stable Medicine Ball Shot-Put family UUID
`5beb30c6-84d5-4210-8eee-ea29e7032e4e` and the lineage of sources 154, 357,
1002, 1197, 1270, 1318, and 1478. The prior consolidation correctly recognized
the shared unilateral shot-put-style release, but it incorrectly treated
missing orientation, stance, ball position, pivot, target/receiver, return,
catch, and finish facts as executable variant dimensions.

All seven source representations are now identity-quarantined and
nonselectable. Source 154 is generic; sources 357 and 1002 are side-on but omit
or conflict on ball start, pivot, or return; source 1197 adds a partner without
complete role/catch facts; source 1270 permits catch or no catch; source 1318
does not define a full split-stance release; source 1478 is rotational but
omits its exact entry, stance, ball position, target, and return. Each stable
source can be restored only from original authoritative evidence.

The family owns one explicitly research-authored working specification:
static side-on start, rear-shoulder/upper-chest ball position, controlled rear-
hip load, declared natural pivot, ground-up unilateral push to a rated wall,
balanced finish, no catch, safe retrieval, full reset, and balanced side dose.
It is a review candidate, not an assertion that any legacy row or candidate
video has been approved.

Forward-facing, step-behind, shuffle, half-kneeling, seated, split-stance,
partner, rebound-catch, open-lane, velocity-measured, and alternating-side
versions remain variant or delivery proposals when they preserve the
unilateral shoulder-level shot-put release. Bilateral chest pass, bilateral
rotational throw, scoop toss, cable press, overhead/slam actions, and the
competition track-and-field shot put remain distinct definitions because arm
count, grip, implement path, free release, support, action sequence, rules, or
outcome changes.

The alias `Medicine Ball Rollout` exposed a score-72 comparison between Rollout
and Shot-Put. It is explicitly distinct: Rollout is a supported anti-extension
task with the implement moving away and returning without release; Shot-Put is
a standing unilateral ballistic free projection. The queue therefore contains
605/605 adjudicated pairs, zero unresolved pair, and zero exact collision across
1,048 active definitions. No deterministic disposition confers media, graph,
calibration, content, or publication approval.

## Suitcase Carry identity completion

Migration 459 retains stable Suitcase Carry family UUID
`d200b890-4a90-4b00-b0fc-242a688635a7` and the complete lineage of sources
204, 452, 504, 559, 1028, 1340, and 1470. The family identity is one implement
in one loaded hand during locomotion. Implement, handle, load position, hand,
route, foot rule, direction, turn, pace, pickup, terminal action, side order,
and dose remain explicit variant or delivery dimensions.

All seven legacy source representations are nonselectable. Dumbbell source 452
and kettlebell source 504 remain duplicate consolidations at the definition
level, and source 559 remains a consolidated narrow-base route variant, but
their underspecified legacy variants are not executable. Sandbag source 1028,
throwing source 1340, and march source 1470 retain `needs_human_review`
dispositions because grip/position, a complete carry contract, or in-place
versus traveling march mechanics are unresolved.

Three research-authored review variants make the currently supported contracts
explicit: straight-lane dumbbell, straight-lane kettlebell, and dumbbell
single-line walk. Equipment geometry is a variant rather than a new exercise
when the one-hand side carry action is preserved. A single-line foot-centering
constraint is also a route/balance variant. Mass, distance, work time, and
controlled pace are dosage annotations unless they change the task.

Farmer Carry is explicitly distinct because it uses two matched implements and
bilateral loading rather than one loaded hand and side-balanced exposure.
Suitcase Hold is explicitly distinct because it removes locomotion, route,
pace, gait contacts, and moving clearance. Front-rack, overhead, deadlift,
step-up/lunge compound, backward, lateral, stair, obstacle, uneven-surface,
turning, in-place-march, and traveling high-knee versions remain separate
definition or variant assessments according to their mechanics.

The independent queue remains fully adjudicated at 605/605 score-72+ pairs,
zero unresolved pair, and zero exact collision across 1,048 active definitions.
These mappings and deterministic dispositions confer no media, relationship,
calibration, content, or publication approval.

## Bent-Knee Soleus Raise identity resolution (migration 460)

Sources 215, 365, 432, 578, 763, 1151, and 1400 now share stable Bent-Knee
Soleus Raise UUID `6e34d34e-0118-4bce-97a1-5caa1f0ce398`. Migration 460 also
resolves the separate active `Seated Dumbbell Calf Raise` definition attached
to source 432 into this survivor. Six obsolete definitions are archived, their
publication authority is cleared, and all seven source representations remain
mapped and auditable as identity quarantines.

No legacy row is an executable exact variant. The sources variously combine
floor and step surfaces, allow optional load, omit implement count or load
contact, fail to declare seated versus standing support or knee angle, omit
laterality and side order, leave range or reset undefined, or describe only a
sport context. Source 763 additionally leaves its concentric assistance
contract unresolved. These gaps require authoritative source recovery, not
inference from labels or candidate videos.

The migration adds three explicitly research-authored working specifications:
bilateral seated bodyweight floor, unilateral seated machine, and single-leg
seated dumbbell floor. They are review-only content, not source restorations.
Standing straight-knee heel raise remains distinct by knee position and loading
contract; bent-knee isometric hold remains distinct because it removes the
cyclic raise/lower repetition.

The independent identity queue remains fully adjudicated at 605/605 score-72+
pairs, with zero unresolved pair and zero exact collision across 1,047 active
definitions. Identity closure grants no media, graph, calibration, content, or
publication approval.

## Back Squat identity resolution (migration 461)

Sources 1, 367, 368, 370, and 371 share stable Back Squat UUID
`1ad09283-aa35-486f-b6bf-bdbdc1b575ee`. Separate High-Bar, Low-Bar, Pause, and
Tempo definitions are consolidated into the family, while every legacy source
variant stays identity-quarantined because its executable and safety contract
is incomplete. The active high- and low-bar specifications are explicitly
research-authored review candidates, not source restorations.

Back Squat remains distinct from Box Squat by unsupported versus intentional
box-contact reversal; from Split Squat by bilateral parallel versus stationary
split stance and side dose; and from Front Squat by posterior versus anterior
bar interface, grip, torso strategy, failure response, and rerack. These three
new score-72+ pairs are adjudicated distinct, closing the queue at 608/608 with
zero unresolved pair and zero exact collision across 1,047 active definitions.
Identity decisions confer no media, graph, calibration, content, or publication
approval.

## Box Jump identity resolution (migration 462)

Sources 2, 1543, 1546, 1547, 1549, 1552, 1556, 1557, and 1558 share stable
Box Jump UUID `aa51dcd1-c8b9-456a-beb2-4abac2c9d9e9`. Eight previously
separate definitions remain consolidated into the family. Every source variant
is archived because its source text leaves at least one approach, preload, arm,
takeoff, box, landing, hold, exit, reset, or dose fact unresolved.

The active stationary countermovement/natural-arm, paused-static/hands-on-hips,
stationary-countermovement/hands-on-hips, and one-step bilateral-gather cards
are explicitly research-authored working specifications rather than source
restorations. Box height, takeoff distance, hold, attempts, and rest are
modifier annotations inside an exact variant. Unilateral takeoff or landing,
lateral or broad projection, obstacles, elevated drop entry, rebound sequences,
external load, far-floor landing, and formal maximum-height testing require
separate variant or definition review. A miss or box strike is an incident, not
a selectable exercise.

The independent identity queue remains closed at 608/608 score-72+ pairs with
zero unresolved pair and zero exact collision across 1,047 active definitions.
Identity resolution confers no media, graph, calibration, content, or
publication approval.

## Depth Jump identity resolution (migration 463)

Sources 3, 725, and 1092 retain stable Depth Jump UUID
`fe5e8eb1-e783-4a37-a1b8-14d970ac1679`. Their source variants are archived:
source 3 mixes vertical or target direction with minimal-contact language, and
the other two still omit the exact platform, entry lead, arm policy,
countermovement strategy, final landing, hold, reset, measurement, and dose.
Authoritative missing mechanics are required before any source-derived variant
can be restored.

The active hands-on-hips and free-arms specifications are explicitly research-
authored review candidates, not source restorations. Arm policy is a variant
because it changes coordination and attainable rebound. Platform height,
step-off lead, target, attempts, rest, contact-time observation, and measurement
method are modifiers inside an exact contract. Bounce Drop Jump, landing-only
Drop Landing, floor Countermovement Jump, nonvertical projection, a second
platform, external load, unilateral contacts, and repeated rebounds remain
separate identity proposals or existing definitions; unstable-surface execution
is rejected.

The independent queue now contains 610/610 adjudicated surfaced pairs, zero
unresolved pair, and zero exact collision across 1,047 active definitions.
Identity decisions create no media, graph, calibration, content, or publication
approval.

## Nordic Hamstring identity resolution (migrations 464–465)

Sources 4, 574, and 839 retain stable Nordic Hamstring Curl UUID
`03894b45-360d-444b-a142-6771ce6df7dd`. Their underspecified baseline,
assisted, and isometric representations are archived rather than silently
mapped to an invented execution. The replacement working specifications fix
contraction mode, assistance interface, support slope, hip and knee position,
range, tempo or hold, catch, and return. Range, band parameters, anchor provider,
sets, repetitions or holds, and rest are modifiers only inside a fixed identity;
different slopes, hip angles, assistance interfaces, external load, testing,
and unilateral execution remain separate variant or definition proposals.

The hardened name surfaced one score-76 pair with Reverse Nordic Curl. Migration
465 records it as distinct using the current authored Nordic contract and legacy
Reverse Nordic source 575: Nordic Hamstring Curl is a forward-fall,
ankle-anchored knee-flexor task with visible knee extension during eccentric
loading; Reverse Nordic Curl is a backward-lean knee-extensor task with visible
knee flexion during eccentric quadriceps loading. Loaded tissues, direction,
anchor, joint motion, muscle action, balance, range, failure response, fatigue,
and substitution differ. Reverse Nordic still requires its own full canonical
audit; this identity decision is not card approval.

The independent queue now contains 611/611 adjudicated surfaced pairs, zero
unresolved pair, and zero exact collision across 1,047 active definitions.
Identity decisions create no media, graph, calibration, content, or publication
approval and contain no exercise skill/proficiency classification.

## Dead Bug identity resolution (migration 470)

The stable survivor is `dead-bug`
(`2a07d4d4-5012-420c-9549-8bdbc64ec675`). `cross-crawl-dead-bug`
(`d1cb006f-094a-4ab9-86d0-f1f327fe2972`) is consolidated because both labels
describe a supine alternating contralateral arm-and-leg pattern under a quiet
rib-pelvis anti-extension contract. Neural or cross-crawl emphasis, cadence,
cueing, dose, and rest are delivery properties. Limb action, lever, range,
terminal contact, and breathing are variant properties.

The generic source representations are not restored as executable variants.
Two exact working variants fix a bent-knee heel contact or a long-leg hover,
with full return before alternation. Heel-tap-only, iso-press, fixed wall press,
loaded bilateral pullover, band-pulldown rotation resistance, legs-only
eccentric lowering, and partner hand press remain distinct exercises because
they change primary action, external force, limb contract, or repetition
boundary.

The canonical similarity audit now reports 614/614 adjudicated surfaced pairs,
zero unresolved pair, and zero exact collision across 1,044 active definitions.
All decisions are identity/traceability records only and create no coach,
media, calibration, card, or publication approval.

## Front Plank identity resolution (migrations 467–468)

Front Plank UUID `4bffab47-a9c6-483e-ac8f-5c73b9641fd3` now owns sources 5,
240, 602, and 827. Generic Plank Hold is the same prone bilateral static
anti-extension family without enough source facts to select a variant. RKC
Plank retains the same forearm-and-toe support identity while changing pelvic
intent, voluntary tension, elbow-to-toe pull, hold, rest, and dose. Standard,
long-lever/posterior-tilt, and RKC high-tension executions are therefore exact
variants. Their legacy representations remain archived until authoritative
missing facts are supplied.

Migration 467 also corrects the prior long-lever consolidation by removing PMID
`32707142`, a prone-CPR review, and recording PMID `25325773` as direct acute
variant-comparison evidence. That study supports preserving lever and pelvic
intent; it does not approve the identity decision, one universal setup, or any
score or dose.

Migration 468 records three distinct neighbors. Bear Plank is a quadruped hand-
and-foot, flexed-knee hover. Glute Bridge is a supine dynamic hip-extension
cycle supported by upper back and feet; the alias “prone bridge” does not make
it a glute bridge. Side Plank uses unilateral lateral support and primarily
resists lateral flexion with per-side dosage. Orientation, contacts, action,
plane, laterality, lever, loaded tissues, repetition boundary, and dose separate
each from Front Plank.

The independent queue now contains 613/613 adjudicated surfaced pairs, zero
unresolved pair, and zero exact collision across 1,045 active definitions.
These decisions create no media, graph, calibration, content, or publication
approval and contain no exercise skill/proficiency classification.

## World's Greatest Stretch identity resolution (migration 471)

World's Greatest Stretch UUID `af147afc-63e9-4944-a5b5-d3b5d2fa6120`
retains sources 10 and 883. Both require the same identity-defining actions: a
long lunge, lead-side elbow or hand toward the instep, ipsilateral thoracic
rotation, hand return, and front-leg hamstring rockback. “With Rotation” is
therefore a redundant label, not another exercise. Rear-knee support, direct or
stationary entry/exit, owned ranges, tempo, breathing, and dose are exact
variant or delivery dimensions.

Three nearby identities remain separate. Spiderman Lunge Hamstring Sweep omits
required thoracic rotation. World's Greatest Stretch to Plank requires a
braced plank return between lunge repetitions. Inchworm to World's Greatest
Stretch adds a standing hinge, hand walk, plank exposure, and return. Adding or
removing these ordered actions changes the repetition boundary, loading,
logistics, duration, and rendering rather than merely renaming the same card.

The independent identity queue remains 614/614 adjudicated, with zero
unresolved pair and zero exact collision across 1,044 active definitions. These
machine decisions remain human-review quarantined and create no approvals.

## Kettlebell Swing identity resolution (migration 472)

The stable `kettlebell-swing` definition requires a ballistic hip hinge and
close hike followed by hip-driven float to a declared chest-to-shoulder height.
Its two-hand and one-hand executions remain variants because they retain the
same terminal-height definition while changing grip, laterality, anti-rotation,
coordination, supervision, and side accounting.

`overhead-kettlebell-swing` is a separate definition. It adds a continuous arc
to a declared full-overhead terminal position, additional shoulder and elbow
control, overhead and ceiling clearance, a different return path, and a higher
failure consequence. Treating it as a height annotation would hide material
selection, environment, fatigue, duration, substitution, and rendering facts.
Its one-hand and two-hand executions are exact variants within that definition.

Both swing definitions remain distinct from Kettlebell Deadlift and Romanian
Deadlift because the latter are controlled strength repetitions without a
continuous ballistic hike/float cycle. The overhead swing remains distinct
from Overhead Carry because the carry stabilizes a held overhead load during
locomotion, and from Standing Strict Overhead Press because the press moves
from rack to overhead without a ballistic backswing. Release/catch, hand-to-
hand, double-bell, dead-stop, staggered-stance, half-kneeling, lateral, and
testing protocols remain explicit alternate decisions rather than aliases.

The newly authored overhead name surfaced similarities with Overhead Carry and
Standing Strict Overhead Press; both are explicitly adjudicated as distinct.
The independent queue now contains 617/617 adjudicated pairs, zero unresolved
pair, and zero exact collision across 1,045 active definitions. These identity
records create no media, graph, calibration, content, or publication approval
and contain no exercise skill/proficiency classification.

## Pull-Up / Chin-Up full-cycle identity

Migration 475 preserves `pull-up-chin-up` as the stable strict full-cycle
vertical-pull identity. Pronated Pull-Up, supinated Chin-Up, neutral-grip
Pull-Up, Archer Pull-Up, Assisted Pull-Up, and Weighted Vest Pull-Up retain the
same bottom-ascent-top-return repetition only when grip, support, assistance
interface, external load, side shift, range, tempo, mount, and exit are exact.
Those facts are variants or delivery dimensions, not athlete skill levels.

Assisted Pull-Up and Weighted Vest Pull-Up definitions consolidate into the
stable survivor. The disjunctive “Chin-Up or Assisted Chin-Up” source also maps
to the survivor for lineage, but its generic representation remains archived
and nonselectable because it does not choose a grip or assistance contract.
Eight legacy source mappings are retained, and the inherited calf-raise PMID
`38156065` is removed from current family source and identity provenance.

Eccentric Pull-Up remains distinct because its repetition starts at the top
and ends after lowering. Isometric Pull-Up Hold remains distinct because it is
duration-based without a dynamic cycle. Scapular Pull-Up remains distinct
because it intentionally minimizes elbow motion. Kipping and butterfly pulls,
One-Arm Pull-Up, Muscle-Up, L-Sit Pull-Up, Pull-Up to Knee Raise, and
clapping/flight tasks require separate definitions. Mixed grip, towels, rope,
rings, material width changes, chest-to-bar range, foot or partner assistance,
and hanging belt load remain exact new-variant queues. Behind-the-neck Pull-Up
is rejected from automatic selection pending an original exact specification
and qualified review.

The post-migration detector contains 616/616 adjudicated surfaced pairs across
1,042 active definitions, zero unresolved pair, and zero exact collision. No
media, graph, calibration, content, or publication approval is inferred.
