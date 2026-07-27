# Canonical exercise-library audit

Audit baseline: 2026-07-26, disposable PostgreSQL 15, facility 1.

## Result

The migration preserves every legacy exercise:

| Measure | Count |
|---|---:|
| Legacy exercise rows | 1,676 |
| Active canonical definitions | 1,280 |
| Archived redundant definitions | 396 |
| Canonical variant rows | 1,823 |
| Contextual delivery profiles | 1,974 |
| Explicit identity resolutions | 634 |
| Relationship proposals | 201 |
| Calibration proposals | 342 |
| Candidate media records | 5,061 |
| Migration coverage | 100% |
| Published canonical definitions | 0 |
| Current quarantined test packets | 1,280 |

No migrated card is treated as production-approved. Migration creates stable
canonical identity and provenance, then leaves the definition, variant, and
delivery profiles in `review`. Migration 246 creates a persisted, versioned test
packet for every card and explicitly marks it `quarantined` until the executable
audit proves all publication gates.

The final audit found four blockers on every active card:

- exact-match demonstration media needs external review;
- progression/regression/substitution edges need coach review;
- score calibration anchors need independent approval;
- publication needs current two-person approval.

The other structural categories are complete on 44 cards and remain incomplete
on 1,236:

- anatomy and biomechanics need human completion;
- environment and population constraints need human completion;
- load and fatigue/recovery profiles need calibration;
- programming, sequencing, timing, dose scaling, and measurement need review;
- athlete, accessibility, coach, and support-operations content need review;

The initial audit found 215 cards participating in potential identity matches,
70 exact-name pairs, and 54 direct database identity pairs. Migration 252
consolidates 83 redundant definitions while preserving every source variant and
delivery profile. Migrations 299 and 300 consolidate six additional abbreviated
identities. Migration 301 consolidates seven ball-slam cards whose differences
are controlled implement, stance, cadence, trajectory, or entry-footwork
variants. Migration 302 consolidates four 90/90 and shin-box cards whose
differences are outcome wording, reach emphasis, equivalent nomenclature, or
continuous-flow delivery. Migration 303 consolidates the spelled-out-degree
duplicate of 180 Jump to Stick and a duplicate planned 180-degree
turn-and-reaccelerate identity whose approach and turn details are controlled
delivery dimensions. Migration 306 consolidates `45-Degree Cut to Stick` into
`45-Degree Cut and Stick` because the connecting word does not change the
planned 45-degree redirection or held terminal outcome. Immediate
reacceleration and the aerial diagonal bound remain separate identities.
Migration 307 consolidates twelve Cossack cards whose differences are range,
tempo, isometric hold, bottom-position motion, terminal pause, reach overlay,
or external implement into `Cossack Squat`. The release/reception wall-ball
composite remains separate and identity-quarantined. Migration 308 consolidates
three adductor rock-back reach and half-kneeling-context cards into
`Adductor Rockback`; incomplete generic-reach and half-kneeling execution
dimensions remain explicitly quarantined. Migration 309 then resolves the
hanging cluster into `Dead Hang`,
`Active Hang`, and `Scapular Pull-Up`, consolidating the exact Active Hang hold
duplicate and archiving the ambiguous passive-or-active compound source.
Migration 310 consolidates four hanging knee/leg-raise source identities into
`Hanging Leg Raise`, with bent-knee, straight-leg, and eccentric-lower variants
and an archived exact tuck-knee duplicate. Migration 311 consolidates the
historical Tuck L-Sit Hold into L-Sit as a short-lever variant, adds explicit
one-leg, straddle, and ring-support variants, and creates a distinct,
unpublished Hanging L-Sit source and canonical definition for overhead
suspension. At the migration-311 checkpoint, the 1,550-definition library preserved all
1,674 source mappings and has zero direct canonical-name, display-name,
alias-to-alias, or alias-to-name collisions. The post-migration-252 audit left
36 name-based similar pairs as non-blocking P2 warnings; later family passes
are adjudicating that historical queue explicitly because modifiers need
movement context rather than an automatic merge. See `IDENTITY_RESOLUTION.md`.

Migration 312 resolves the adjacent grounded- and supported-compression family.
The historical `Straddle Compression Lift` source now represents a broader
four-variant `Seated Compression Lift` identity while retaining its stable
canonical slug and historical aliases. It adds distinct review-only `V-Sit`
and `Manna Hold` exercise definitions because their leg-height, hip-height,
shoulder relationship, support, supervision, fatigue, and exit demands cross
identity boundaries.

Migrations 313 and 314 then finish the three hang-family cards without changing
their resolved identities. Each card now has baseline, foot-assisted,
band-assisted, ring, weighted, and single-arm variants with complete
difficulty, load, fatigue, programming, dosage, timing, measurement, athlete,
coach, accessibility, and support contracts. Dead Hang also retains its
breathing-context restore profile. Detailed mechanics remain qualifiers while
the selectable definitions use controlled `hang`, `pull`, and `brace`
taxonomy.

Migration 315 archives two final exact semantic duplicates while keeping the
reversed sequences distinct. `Depth Jump to Box Jump` consolidates into `Depth
Drop to Box Jump`; `Box Jump with Altitude Landing` consolidates into `Box Jump
to Depth Drop`. Migration 316 completes both survivors with exact ordered
contacts, anatomy and biomechanics, baseline and hands-on-hips difficulty
scores, load/fatigue/recovery contracts, equipment and population constraints,
two contextual profiles per variant, athlete and coach instructions, stop
rules, support operations, candidate relationships, and quarantined card test
packets. The migration creates no publication, review, calibration,
relationship, or media approval.

Migration 317 then consolidates `Tall-Kneeling Medicine Ball Chest Pass`,
`Tall-Kneeling Chest Pass to Wall`, and `Half-Kneeling Chest Pass to Wall`
under the stable `Kneeling Medicine Ball Chest Pass` identity. Migration 318
adds four exact selectable variants: tall- and half-kneeling, each with
throw-only and rebound-and-catch delivery. The two generic legacy sources never
declared stance or catch behavior, so their variants remain archived,
nonselectable provenance rather than being assigned by assumption. The
explicit wall sources also lose unrelated squat, overhead-reach, and
triple-extension requirements.

The completed card has 16 candidate evidence sections, five currently healthy
oEmbed candidates, 12 alternate assessments, four scored variants, eight
contextual profiles, six review-only relationship edges, and 12 review-only
calibration proposals. Video exact match, graph approval, independent
calibration, and publication remain human gates. No exercise-card proficiency
level, media approval, relationship approval, calibration approval, or
publication state is created.

Migration 319 then consolidates `Medicine Ball Rotational Wall Throw` into the
stable `Medicine Ball Rotational Throw` identity. The wall is a delivery
target, not a different primary action. Because neither source declares whether
the athlete retrieves the ball or catches a rebound, both source variants
remain archived and nonselectable. Migration 320 adds exact
throw-and-retrieve and rebound-and-catch variants with output and technique
profiles, side-balanced dosage, cumulative fatigue budgets, instructions,
support operations, stop rules, candidate graph edges, calibration proposals,
and evidence. Migration 321 maps card and profile equipment to controlled keys
while retaining detailed wall, target, tracking, and feedback requirements in
contextual JSON.

The completed rotational card has 16 candidate evidence sections, five current
healthy oEmbed candidates, 12 alternate assessments, two scored variants, four
contextual profiles, two review-only relationship edges, and six review-only
calibration proposals. Exact-match media review, graph approval, independent
calibration, and publication remain human gates.

Migration 322 then consolidates `Med Ball Shuffle-to-Rotation Throw` into
`Shuffle-to-Rotational Medicine Ball Throw`. Both source cards define the same
lateral shuffle or crow-hop, plant, pivot, and two-hand rotational medicine-ball
projection; their 40-versus-50 seed difference was not an identity boundary.
Migration 323 completes the survivor with exact throw-and-retrieve and
predictable-rebound-and-catch variants, two contextual profiles per variant,
controlled equipment, approach and plant logistics, cumulative lateral-contact
and rotational-throw budgets, support contracts, candidate graph edges,
calibration proposals, and a quarantined test packet. Planned versus reactive
cueing remains an explicit modifier and is never silently introduced.

The completed shuffle rotational card has 16 candidate evidence sections, five
current healthy oEmbed candidates, 12 alternate assessments, two scored
variants, four contextual profiles, four review-only relationship edges, and
six review-only calibration proposals. Full-video exact-match and safety
review, captions/accessibility review, graph approval, independent calibration,
and publication remain human gates.

Migration 324 consolidates `Single-Leg Box Jump to Single-Leg Landing` into the
stable `standing-box-jump-to-single-leg-landing` definition and names the
survivor `Box Jump to Single-Leg Landing`. Migration 325 adds exact
bilateral-takeoff and same-leg-unilateral-takeoff variants, two profiles per
variant, controlled box and optional setup equipment, complete anatomy,
load/fatigue/recovery and support contracts, four review-only graph edges, six
review-only calibration proposals, 16 evidence sections, five current oEmbed
candidates, 12 alternate assessments, and a quarantined test packet.

Migration 326 consolidates `Lateral Line Hop to Single-Leg Stick` into
`Single-Leg Lateral Hop to Stick`; a line is a target constraint, while the
terminal controlled stick defines the card. Migration 327 adds exact
low-amplitude-control and distance-output variants, two profiles per variant,
controlled optional setup equipment, complete anatomy, load/fatigue/recovery
and support contracts, four review-only graph edges, six review-only
calibration proposals, 16 evidence sections, five current oEmbed candidates,
12 alternate assessments, and a quarantined test packet. Continuous rebound
line hops remain a distinct exercise. Neither family migration pass assigned an
exercise-card skill level or created an approval.

Migration 328 consolidates `Dumbbell Dead Bug Pullover`,
`Band-Resisted Dead Bug Pullover`, `Medicine Ball Dead Bug Pullover`, and
`Dead Bug Pullover with Exhale` into the stable `Dead Bug Pullover` identity.
Implement, declared leg action, load, range, breathing emphasis, and phase
intent are variant or delivery dimensions; the rotation-resist pulldown,
dead-bug presses, and ordinary unloaded dead bug remain separate actions.
Migration 329 adds five exact implement/leg-action variants, ten contextual
profiles, six review-only graph edges, 15 review-only calibration proposals,
16 evidence sections, five current oEmbed candidates, 12 alternate
assessments, and a quarantined test packet. Overall difficulty is the maximum
of exercise complexity and physical difficulty. No exercise-card skill level
or approval is created.

Migration 330 consolidates `Dumbbell Romanian Deadlift`, `Kettlebell Romanian
Deadlift`, `Double Kettlebell Romanian Deadlift`, `Sandbag Romanian Deadlift`,
`Landmine Romanian Deadlift`, and `Romanian Deadlift Eccentric` into the stable
`Romanian Deadlift` identity. Implement type and quantity, grip, mass
distribution, load path, range, and tempo are exact variant dimensions of the
same bilateral standing loaded hip hinge. Single-leg and staggered-stance
RDLs, RDL-to-row, conventional deadlifts, good mornings, and swings remain
separate.

Migration 331 adds eight exact implement/tempo variants, 16 contextual
profiles, eight review-only graph edges, 24 review-only calibration proposals,
16 evidence sections, five current oEmbed candidates, 12 alternate
assessments, and a quarantined test packet. Overall difficulty is mechanically
derived from exercise complexity and physical difficulty. No exercise-card
skill level, media approval, relationship approval, calibration approval, or
publication state is created.

Migration 332 consolidates `Front-Foot-Elevated Dumbbell Split Squat` and
`Front-Foot-Elevated Sandbag Split Squat` into the stable
`Front-Foot-Elevated Split Squat` identity. All three legacy cards preserve the
same stationary split stance, whole lead-foot platform support, rear-foot
floor contact, descent, and ascent. Migration 333 adds unsupported and
supported bodyweight, two-dumbbell suitcase, contralateral and ipsilateral
single-dumbbell, and front-held-sandbag variants, 12 contextual profiles, ten
review-only graph edges, 18 review-only calibration proposals, 16 evidence
sections, five current oEmbed candidates, 12 alternate assessments, and a
quarantined test packet.

Rear-foot elevation, heel-only elevation, stepping lunges, and jumping split
squats remain distinct exercise boundaries. Overall difficulty is mechanically
derived from exercise complexity and physical difficulty. No exercise-card
skill level, media approval, relationship approval, calibration approval, or
publication state is created.

Migrations 341–344 resolve the last three score-85 identity quarantines and
complete the five resulting cards. Fixed-wall and medicine-ball dead-bug
presses remain distinct constraint/action contracts. The generic lateral
hop-to-stick is made explicit as bilateral and remains distinct from both the
same-leg unilateral hop and the tuck-jump-to-lateral-stick action sequence; its
low-amplitude source is retained as a variant. Countermovement forward chest
projection is consolidated into Medicine Ball Chest Pass, while transverse
countermovement rotational projection remains separate.

Each of the five active cards has two exact variants, two delivery profiles,
16 candidate evidence sections, five current healthy oEmbed metadata
candidates, six alternate assessments, review-only progression/regression and
conditional-substitution proposals, and review-only calibration proposals.
Migration 344 confines graph dimensions to the controlled
`range`/`complexity`/`load` vocabulary. Their automated packets have no
structural failure; only media viewing/approval, graph approval, independent
calibration, and publication review remain. Candidate link metadata is not a
claim that a human watched or approved a demonstration.

Migrations 345 and 346 resolve the Pallof press cluster into two stable
identities. `Pallof Press` owns fixed-stance press, hold, implement, stance,
slow-return, and supervised partner-anchor variants. `Pallof Step-Out` owns
the side-anchored lateral travel variants. Marches, diagonal press-lifts, rows,
pulldowns, landmine presses, and mini-band lateral walks remain distinct
because they add a primary limb action, locomotor contract, or force path.
Eleven redundant definitions are archived without deleting their sources.
The two completed cards add 12 exact scored variants, 12 contextual delivery
profiles, 32 candidate evidence sections, ten current healthy oEmbed metadata
candidates, 20 alternate assessments, 14 review-only graph proposals, and 24
review-only calibration proposals. Candidate metadata is not a claim that a
human viewed or approved a video.

Migrations 348 and 349 consolidate `Stir-the-Pot Plank` into `Stir-the-Pot`.
Both source records describe the same forearms-on-stability-ball circular plank;
the added word “plank” and the throwing-athlete framing do not add a movement
action. Knee versus toe support and small versus large circles are exact
variants. Static stability-ball planks, linear roll-outs, body saws, pikes,
unilateral support, and reactive perturbations remain separate exercise or
review boundaries.

The completed survivor has three exact variants, six contextual profiles, 16
candidate evidence sections, four current healthy oEmbed metadata candidates,
ten alternate assessments, five review-only graph proposals, and nine
review-only calibration proposals. Candidate metadata is not evidence that a
human viewed or approved a video.

Migrations 351 and 352 resolve three additional direct synonyms:

- `Quadruped Thread-the-Needle Rotation` consolidates into
  `Quadruped Thread-the-Needle`; heel-sit position is an exact variant and
  shortened range is a modifier.
- `Single-Leg Tripod Balance` consolidates into
  `Single-Leg Tripod Balance Hold`; support and visual input are exact variants,
  while reaching, unstable surfaces, load, and perturbation remain separate.
- `Split Squat Iso Hold` consolidates into `Split Squat Isometric Hold`; hand
  support and goblet load are exact variants, while rear-foot elevation,
  dynamic repetitions, and perturbation remain separate.

The three completed cards add eight selectable variants, 16 contextual
profiles, 48 candidate evidence sections, 12 oEmbed-metadata-only media
candidates, 23 alternate assessments, 13 review-only graph proposals, and 24
review-only calibrations. Their packets pass every automated structural
category and remain blocked only by exact-match media review, coach graph
approval, independent score calibration, and publication approval.

Migrations 353 and 354 resolve nine more redundant definitions:

- three Athletic/Landing/Control Snap-Down labels consolidate into the
  no-flight, no-rebound `Snap-Down to Stick`;
- two Mirror Shuffle labels consolidate into the live, noncontact partner
  leader-follower task;
- both five-yard accel/decel sources become exact distance variants of
  `Sprint-to-Stick Deceleration`;
- two in-place/jumps labels consolidate into `Single-Leg Pogo`.

The four survivors add eight selectable variants, 16 contextual profiles, 64
candidate evidence sections, 16 oEmbed-metadata-only media candidates, 45
persisted alternate assessments, 12 review-only graph proposals, and 24
review-only calibrations. The packet source has 46 alternates because it also
documents `Single-Leg Pogo Hold-to-Hop` as a distinct hold-entry and
terminal-stick sequence. Exact video playback/content review and every
human-controlled approval remain unresolved.

After migration 368, the 1,331-definition library preserves all 1,676 source
mappings, 1,803 variant rows, and 1,934 delivery profiles and still has zero direct
canonical-name, display-name, alias-to-alias, or alias-to-name collisions.

Migration 347 removes the enumerated legacy skill- and proficiency-level keys
from every canonical definition, variant, delivery-profile, score, and legacy
exercise JSON surface and nulls the deprecated relational exercise-level
columns. Migration 350 closes the broader historical-spelling gap
(`exercise_skill_level`, `skill_level_applicable`, and
`proficiencyClassification`), removes matching keys recursively, and adds
database constraints that reject future spellings anywhere in exercise-card
JSON. Non-neutral classifications on protected reviewed state fail closed;
neutral `null`/`false` markers can be removed without changing the movement or
difficulty contract. Neither migration updates `coaching.skill`.

The fresh-database audit now finds zero matching keys at any JSON depth, zero
relational exercise-level values, and 1,112 retained skill-library level
assignments. Canonical authoring, research review, and workout-contract
validation use the same recursive semantic boundary, so later drafts or
research packets cannot reintroduce a level classification.

Migrations 304 and 305 complete the enforceable two-axis exercise difficulty
contract. Exercise complexity (stored under the legacy `technicalComplexity`
field name) and physical difficulty are assessed independently, and overall
difficulty is derived as their maximum. Existing
traceable difficulty profiles supplied complete core scores for 1,663 of 1,676
legacy exercises; the other 13 have no source assessment and remain explicitly
quarantined. Overall-difficulty calibration is no longer independently
proposable, and no approval or publication state was created by the backfill.

After migration 368 and the full persisted audit, 42 cards have complete
automated structure and are blocked only by honest human gates:
exact-match media approval, coach-approved graph relationships, approved
difficulty calibration, and publication approval. All 1,331 definitions remain
quarantined and none are published.

The all-library audit now precomputes normalized identity names and bigrams once.
The same indexed all-card duplicate semantics avoid rebuilding identity terms
inside every pairwise comparison. The 1,331-card disposable audit retains that
optimization.

Migration 360 completes the consolidated `Reactive Hop-to-Cut` and
`Seated Overhead Press` survivors. It adds six exact selectable variants, 12
contextual delivery profiles, 32 candidate evidence sections, eight retained
oEmbed-healthy media candidates, 20 alternate assessments, eight review-only
graph proposals, and 18 review-only calibration proposals. The three reactive
videos are explicitly comparison-only because title metadata does not show the
complete hop-to-cut sequence. The five seated-press videos are title-level
candidates but have not received full-video, exact-configuration, cue, safety,
caption, accessibility, or approval review. Both packets pass every automated
structural category and retain exactly four blockers: media review, graph
approval, calibration approval, and publication approval.

Migrations 361 and 362 resolve and complete the Hip Thrust family. Five
implement-, load-, or laterality-labelled sources consolidate into the stable
`distance-jump-hip-thrust` definition, now canonically named `Hip Thrust`.
Floor-supported Glute Bridge remains a separate exercise. Feet-Elevated Hip
Thrust and the mixed bench-or-floor eccentric source remain active and
`needs_human_review` because their support geometry is unresolved.

The completed survivor has eight exact selectable variants, 16 contextual
profiles, 16 candidate evidence sections, five current oEmbed-healthy media
candidates, 14 alternate assessments, 12 review-only graph proposals, and 24
review-only calibration proposals. Its packet passes every structural
category. The only blockers are exact-match media review, coach graph approval,
independent score calibration, and publication approval. The two unresolved
source identities remain a separate explicit human gate.

Migrations 363 and 364 resolve the Ball Drop cluster. `Partner Tennis Ball Drop
Sprint` consolidates into the stable `ball-drop-reaction-sprint` survivor
because both sources require a partner release, acceleration, and securing the
ball before its second bounce. Cone run-through/stick completion, a required
hop, a second late direction cue, capture followed by a called cut, and
cue-selected gate running remain distinct ordered tasks. Migration 365
completes the survivor as `Partner Ball-Drop Chase and Catch` with two exact
implement variants, four contextual delivery profiles, 16 candidate evidence
sections, five current oEmbed-healthy media candidates, 12 alternate
assessments, four review-only graph proposals, and six review-only difficulty
calibrations. It carries exercise-complexity and physical-difficulty scores
only. Full-video exact-match, caption, accessibility, graph, score, and
publication review remain quarantined human gates.

Migrations 366 and 368 consolidate three additional Alternating Bounds
definitions into the stable `alternate-leg-bound-for-distance` identity, now
displayed as `Alternating Bounds`. Generic wording, mixed height-and-distance
emphasis, vertical emphasis, distance, contacts, start leg, effort, and
measurement remain aliases, exact variants, or delivery dimensions. The source
variants are archived and nonselectable; every source mapping, alias, evidence
record, and media candidate remains traceable. Eight inherited media links are
explicitly quarantined as title-level movement mismatches: three show lateral
bounds or a scissor jump and five show same-leg bounds.

Migration 367 completes the survivor with traditional mixed-projection and
sprint-oriented distance/rhythm variants, four contextual delivery profiles,
16 evidence sections, five current oEmbed-healthy candidate links, 12
alternate assessments, two review-only relationship proposals, and six
review-only difficulty calibrations. Difficulty is exercise complexity plus
physical difficulty, with overall equal to their maximum; no athlete skill
level is attached to the exercise. The card passes every automated structural
category and remains blocked only by exact-match media review, coach graph
approval, independent calibration, and publication approval.

Migrations 369 and 370 resolve and complete the stationary Split Squat family.
`Barbell Split Squat`, `Bodyweight Split Squat`, `Front-Rack Kettlebell Split
Squat`, `Sandbag Split Squat`, `Slow Eccentric Split Squat`, and `Split Squat
Eccentric to Pause` consolidate into `split-squat`; implement, quantity, load
position, support, and tempo become exact variants. `Landmine Handle-Grip Split
Squat` consolidates into `landmine-split-squat`, but the survivor remains
identity-quarantined because its source permits both a stationary split squat
and a stepping reverse lunge.

Floor-based Split Squat and Rear-Foot-Elevated Split Squat remain separate
stable definitions because rear-foot elevation changes support geometry,
balance, setup, rear-limb contribution, entry, exit, and failure handling.
Migration 370 completes both cards with 14 exact variants, 28 contextual
profiles, 32 candidate evidence sections, ten current oEmbed-metadata-only
media candidates, 24 alternate assessments, 12 review-only relationship
proposals, and 42 review-only difficulty calibrations. Both cards pass every
automated structural category and remain blocked only by full-video exact-match
review, approved relationship coverage, independent calibration, and
publication approval.

Difficulty on these cards is strictly an exercise assessment. Each exact
variant stores exercise complexity and physical difficulty, and overall
difficulty is mechanically the greater of the two. Athlete proficiency and
skill-library levels are absent from exercise definitions, variants, profiles,
research packets, and test packets. The phrase “Beginner to Advanced” is
retained only as the unmodified title of one quarantined video candidate and
does not create exercise metadata.

## High-similarity identity review after migration 370

The clean persisted audit reports:

| Duplicate-review measure | Count |
|---|---:|
| Raw score-72-or-higher pairs | 906 |
| Unresolved score-72-or-higher pairs | 787 |
| Unresolved score-80-or-higher pairs | 176 |
| Unresolved score-85-or-higher pairs | 0 |
| Unresolved score-90-or-higher pairs | 0 |
| Exact identity collisions | 0 |
| Adjudicated distinct high-similarity pairs | 119 |
| Explicit human-review identity quarantines | 2 |

Migration 339 consolidated 148 active synonym or exact-variant definitions.
Migration 340 adjudicated 70 mechanics-based distinct pairs and temporarily
quarantined three under-specified pairs without assigning a reviewer.
Migrations 341–343 resolve those three and consolidate the low-amplitude
bilateral lateral hop and countermovement chest-pass sources as exact variants.
Migration 345 then resolves the Pallof family and removes eight additional
lower-confidence warnings from the unresolved queue. Migration 348 removes the
redundant Stir-the-Pot Plank pair. Migration 351 removes the three direct
static-control synonyms. Migrations 353 and 354 remove nine additional
redundant definitions and document the Single-Leg Pogo versus Hold-to-Hop
boundary. Migration 355 then resolves ten score-84 warnings using explicit
rotation, contact-order, support-geometry, projection, terminal-action, stance,
and footwork boundaries. Migration 356 consolidates twelve researched
Drop/Depth Jump and Falling Start duplicates and records the contact-strategy,
projection, landing-only, and no-sprint-hold boundaries. Migration 357 records
five more mechanics-based distinct pairs and quarantines the under-specified
Single-Leg Line Hop and Stick source without assigning a reviewer. Migration
358 consolidates the angle-labelled Reactive Hop-to-Cut and implement-labelled
Seated Overhead Press sources as controlled variants. Migration 359 records the
marked-approach Reactive 45-Degree Cut and discrete-hop Reactive Hop-to-Cut as
distinct ordered-contact identities. Migration 360 completes both survivors
without modifying the identity queue. Migration 361 then consolidates five Hip
Thrust source definitions and routes two support-geometry ambiguities to human
review; migration 362 completes the survivor without changing those identity
decisions. Migration 363 consolidates the exact Partner Tennis Ball Drop Sprint
identity and records six mechanics-based Ball Drop boundaries; migration 364
records the catch-to-cut versus hop-and-go boundary; migration 365 completes
the survivor without changing identity state. Migrations 366 and 368 then
consolidate the mixed-projection, generic, and height-emphasis Alternating
Bounds sources; migration 367 completes the survivor without changing any
human-controlled review state. The remaining 807
score-72-to-84 pairs form an intentionally conservative review queue and are
not direct-collision claims.

Fresh-database invariant queries found zero exercise, scaling, or safety
skill-level values; zero skill-level-shaped keys at any depth in canonical
definition, variant, delivery-profile, score, or legacy-exercise JSON; 1,112
retained level assignments in the dedicated skill library; zero
overall-difficulty mismatches where both core dimensions are present; and zero
fabricated card, media, graph, or calibration approvals.

## Score-81 audit and final score-80 migration-380 completion

Migrations 371–380 supersede the migration-370 queue snapshot above.
Migrations 371–374 completed the score-83 batch and the recursive
exercise-card/skill-library boundary. Migrations 375 and 376 then adjudicated
all 51 newly exposed score-82 pairs: 31 were recorded as mechanically distinct,
one was honestly quarantined because the line-hop source omits identity facts,
and 19 duplicate or controlled-variant definitions were consolidated into
stable survivors. Migrations 377 and 378 adjudicated all 52 newly exposed
score-81 pairs plus two alias-driven pairs that appeared after consolidation:
35 were recorded as mechanically distinct, four were honestly quarantined,
and 15 duplicate or controlled-variant definitions were consolidated. The
remaining high-similarity queue is:

| Duplicate-review measure | Count |
|---|---:|
| Active canonical definitions | 1,280 |
| Raw score-72-or-higher pairs | 843 |
| Unresolved score-72-or-higher pairs | 638 |
| Unresolved score-80-or-higher pairs | 43 |
| Unresolved score-81-or-higher pairs | 9 |
| Unresolved score-82-or-higher pairs | 5 |
| Unresolved score-83-or-higher pairs | 4 |
| Unresolved score-85-or-higher pairs | 0 |
| Unresolved score-90-or-higher pairs | 0 |
| Exact identity collisions | 0 |
| Adjudicated distinct similarity pairs | 205 |

All nine score-81-or-higher pairs are explicit unreviewed
`needs_human_review` records, not unclassified collisions. The four new
score-81 cases are Dumbbell Sumo Squat versus Goblet Squat, Lateral Line Pogo
versus Line Pogo Hops, One-Arm Landmine Arc Press versus Square-Stance One-Arm
Landmine Press, and Single-Leg Line Hop and Stick versus Triple-Line Hop and
Stick. The five prior cases remain quarantined for missing direction, contact,
stance, hand, or reset facts.

The final disposable audit contains 1,676 legacy source mappings, 1,280 active
and 396 archived canonical definitions, 1,823 variants, 1,974 delivery
profiles, 634 identity decisions, 201 review-only relationship proposals, 342
review-only calibration proposals, and 5,061 unapproved media candidates.
Forty-four cards meet the automated structural contract; 1,236 still need one
or more structural backfills. No card is releasable yet because all 1,280
remain quarantined behind human media,
relationship, calibration, and publication gates.

Migration 373 completes Hamstring Slider Curl with six exact variants, 12
profiles, 16 candidate evidence sections, five oEmbed-healthy but unapproved
media candidates, 11 alternate assessments, ten review-only relationships, 18
review-only calibrations, and one quarantined test packet. Migration 374 then
removes neutral level-classification audit keys from identity evidence and
adds the sixth database-level no-level constraint.

Migration 375 persists 31 mechanics-based distinct decisions and one
`needs_human_review` decision. Migration 376 consolidates 19 sources whose
differences are exact implement, support, lever, terminal-landing, range,
distance, target, external-load, or contextual-delivery dimensions. Source
mappings, aliases, candidate evidence, candidate media, and legacy execution
remain traceable; migrated legacy variants are archived and nonselectable.
Neither migration creates a reviewer, approval, or publication state.

Migration 377 persists 35 mechanics-based distinct decisions and four
`needs_human_review` decisions. Migration 378 consolidates 15 sources whose
differences are exact route naming, implement or pivot, support height,
wall orientation, countermovement, tempo, continuous shifting, obstacle,
contraction emphasis, box target, terminal wording, or airborne foot exchange.
Two post-consolidation alias pairs—Medicine Ball Chest Pass versus Rotational
Throw and dynamic Goblet Squat versus its bottom isometric hold—are explicitly
recorded as distinct. No human-controlled state is inferred.

Migrations 379 and 380 finish the score-80 batch. Migration 379 records 24
mechanically distinct boundaries and quarantines Line Hops versus Line Pogo
Hops because direction, crossing, and foot-contact facts are missing.
Migration 380 consolidates 14 start, assistance, bar-position, pause, tempo,
implement, pin-height, rebound-direction, apparatus, load-shape, eccentric,
isometric, and mobility-sequence variants. The post-consolidation pass also
resolves all alias-driven score-80-or-higher pairs, including the stable
Bench Press identity versus Bench Press Pin Iso and Dumbbell Z-Press, and the
unified short sprint versus Falling Start.

The migration-380 disposable audit reports:

| Measure | Count |
|---|---:|
| Legacy exercises and source mappings | 1,676 |
| Active canonical definitions | 1,266 |
| Archived canonical definitions | 410 |
| Variants | 1,823 |
| Delivery profiles | 1,974 |
| Identity decisions | 673 |
| Distinct identity boundaries | 251 |
| Duplicate consolidations | 409 |
| Explicit identity-review quarantines | 13 |
| Candidate media records | 5,061 |
| Review-only relationship proposals | 201 |
| Review-only calibration proposals | 342 |
| Raw score-72-or-higher similarity pairs | 820 |
| Unresolved score-72-or-higher pairs | 595 |
| Unresolved score-75-or-higher pairs | 313 |
| Unresolved score-80-or-higher pairs | 10 |
| Unresolved score-85-or-higher pairs | 0 |
| Exact identity collisions | 0 |

All ten score-80-or-higher pairs are explicit unreviewed
`needs_human_review` records. The automated audit has complete one-to-one
migration coverage and quarantines all 1,266 active cards. Forty-three cards
pass every non-human automated content check. One otherwise-complete Hamstring
Slider Curl card still has explicit taxonomy and graph-integrity blockers, and
1,222 cards still need broad anatomy, difficulty, load, fatigue, constraints,
delivery, athlete, coach, and operations backfill. No card is published.

The recursive final invariant audit checks all 38 JSON columns and all three
scalar skill/proficiency columns on exercise-related base tables. It reports
zero level keys, zero scalar assignments, and zero
`overall != max(complexity, physical difficulty)` violations. Of 1,476 active
canonical variants, 1,464 have populated difficulty records; the remaining 12
stay quarantined for backfill. All 1,663 legacy score rows are populated and
formula-consistent. All 1,112 dedicated skill-library level assignments remain
intact.

## Run the audit

Apply all migrations, then run:

```sh
DATABASE_URL=postgresql://... DATABASE_SSL=false \
  npm --prefix backend run audit:canonical-library -- --facility=1
```

Use `--json` for the complete per-card packet and `--no-persist` for a read-only
run. The command exits nonzero when one-to-one migration coverage is broken.
Quarantined content is expected and does not make the audit command fail.

Use the reusable unresolved-pair queue instead of reading the full per-card
packet when selecting the next identity cluster:

```sh
DATABASE_URL=postgresql://... DATABASE_SSL=false \
  npm --prefix backend run report:canonical-identity-queue -- \
  --facility=1 --threshold=72 --limit=50
```

The report returns each unresolved pair once in descending similarity order,
excludes explicit distinct/consolidated decisions, and separately reports
exact collisions. Add `--json` for automation.

After the audit, run `npm --prefix backend run check:canonical-release --
--facility=1`. This second command intentionally exits nonzero while library,
governance, calibration, media, or real coach-pilot gates remain incomplete.

Each stored packet contains named P0–P2 checks for:

- identity, aliases, controlled taxonomy, and duplicate candidates;
- muscles, joints, actions, planes, and laterality;
- difficulty, load, fatigue, impact, and recovery;
- equipment, environment, and population constraints;
- contextual purpose, dosage, logistics, instructions, quality gates, and stop
  rules;
- exact-match media review for the current card version;
- reviewed graph relationships and calibration evidence;
- confidence, source provenance, migration coverage, and publication readiness.

## Human-review protocol

Do not bulk-publish migrated rows. For each card:

1. Resolve duplicate/alias candidates and controlled taxonomy.
2. Complete anatomy, constraints, load, fatigue, and contextual delivery fields.
3. Review scores against approved calibration anchors.
4. Add and independently approve graph relationships.
5. Verify a healthy HTTPS demonstration is an exact match for the current card
   version. Record the reviewer and evidence; do not infer approval from a URL.
6. Run the audit, resolve every P0/P1 blocker, complete two-person card review,
   and publish only into an explicit versioned library release.

Re-running the audit replaces the current packet for that exact card version
without erasing immutable card, media, relationship, or calibration history.
