# Canonical exercise research and media review

Status: active library-review program, 2026-07-26.

## Current authoritative snapshot (2026-08-11)

The historical batch notes below document prior migrations; they are not the
current library count. The authoritative disposable-PostgreSQL audit reports
1,676 legacy source rows mapped with complete migration coverage to 206 active
canonical definitions, all in `review` and none published. There are 217
name-similarity pairs: 216 adjudicated distinct, one low-score unresolved pair,
and zero unresolved exact identity collisions.

Every active review card has all 16 candidate research sections, at least one
assessed alternate, complete candidate operational contracts, and a three-to-five
candidate YouTube set; 99.51% currently have three to five healthy embeddable
metadata records. These are discovery and research
artifacts—not human approval. The review queue currently contains 206 cards,
829 review-only graph relationships, and 1,380 candidate calibration records.

Migration 748 reauthors Source 1170 as the distinct Medicine Ball Rebound Slam
to Catch candidate. Its mandatory two-hand rebound catch is now consistently
specified across identity, safety, load/fatigue, athlete, and coach contracts;
dead-ball retrieval is an alternate task, not an in-card regression. The five
candidate links have healthy oEmbed metadata only. Exact-match media, identity,
graph, calibration, and publication decisions remain human-gated.

Migration 747 reauthors Source 995 Uphill Bound as a short-duration,
alternating, gentle-to-moderate uphill-bound candidate. Its grade, lane,
traction, weather, walk-down recovery, and cumulative lower-limb exposure are
explicit. Five links have healthy oEmbed metadata only; all identity, media,
graph, calibration, and publication decisions remain human-gated.

Migration 746 reauthors Source 1166's underspecified generic Kneeling Slam
Ball Slam skeleton inside the existing Source 1320 Tall-Kneeling Overhead
Medicine Ball Slam identity. Both legacy source IDs remain traceable. The
candidate has 16 evidence sections and five healthy oEmbed records, while
identity confirmation, media, graph, calibration, and publication remain
explicit human gates; no candidate was approved.

Migration 745 adds Source 1164 Slam Ball Scoop Slam as a provisional exact
candidate with 16 evidence sections and five healthy oEmbed records. It retains
explicit coach identity-confirmation, media, graph, calibration, and publication
gates; no candidate was approved.

Migration 743 reauthored Source 283 as the exact planned 45-Degree Cut and
Reaccelerate candidate, retaining terminal-stick/90-degree/bound boundaries and
all approvals in quarantine. Migration 742 reauthored Source 152 as the exact
standing bilateral
Medicine Ball Overhead Slam candidate. It retains Sources 1161 and 1167 as
archived duplicate-source skeletons, adds 16 candidate evidence sections and
five healthy oEmbed metadata records, and leaves all media, graph, calibration,
and publication decisions quarantined for qualified human review.

Migration 744 deterministically consolidates Source 710 Prone Pop-Up to Sprint
into the existing Ground-Start Sprint fully-prone variant. It preserves the
source lineage and duplicate-resolution record without creating a review,
media, calibration, relationship, or publication approval.

The alternate queue also contains 1,013 candidate `new_definition` decisions.
Some carry an explicit target-definition reference; migration 704 labels those
links as active or as archived/missing references requiring triage. The
remaining decisions need an expert identity determination and a complete
research/media packet before a new candidate card can be created. Do not
bulk-create them from their names or promote an alternate classification to a
verified exercise identity.

Do not use the older card totals or coverage percentages in this document to
make a release decision. Run `check-canonical-release-readiness.mjs` and the
canonical audit against the target facility immediately before any rollout.

Migration 749 records a reviewed disposition for the remaining archived source
records whose legacy text explicitly leaves task-defining facts unresolved. The
archived-source disposition coverage gap is now zero. These records remain
nonselectable lineage and human-review work items; this backfill created no
exercise, media, calibration, graph, or publication approval.

## Scope and current baseline

Identity consolidation and distinct review-only additions leave 1,531 active
canonical exercise definitions and
zero direct canonical-name, display-name, or alias collisions. Those cards
remain in `review`; consolidation did not make their content or media approved.

Every current card version must receive:

- evidence for all 16 controlled review sections;
- an explicit assessment of meaningful alternate versions;
- three to five direct, version-bound YouTube candidates with privacy-enhanced
  embed URLs;
- separate human content and media review before publication.

Exercise cards do not carry skill levels. Skill levels belong only to
skill-library cards. Exercise-card difficulty is assessed directly through
exercise complexity (`technicalComplexity`), physical difficulty
(`absoluteLoadDemand`), coordination,
supervision demand, failure consequence, impact, work-capacity demand, and an
overall difficulty score. Overall difficulty is derived as the greater of
exercise complexity and physical difficulty; coordination,
supervision, consequence, impact, and work capacity remain separate planning
dimensions and do not inflate that core score. Training experience may
constrain a delivery profile or audience, but it must not be stored as an
exercise skill level.

Migration 305 backfills a canonical physical-difficulty value only where an
existing `coaching.exercise_difficulty_profile.load` value supplies traceable
legacy evidence. It then derives overall difficulty from the two core
dimensions. The migration records prior and resulting values in definition
provenance, keeps human review required, and leaves cards without source values
in quarantine rather than inventing scores. It fails closed if a recalculation
would touch a published variant, a current approved card review, or an approved
score record.

After that evidence-only backfill, 12 canonical variants still require direct
human assessment of both core dimensions: 10-Yard Sprint, Back Bridge, Bar
Cast, Box Jump, Dead Bug, Depth Jump, Kettlebell Swing, Lache Swing, Lateral
Bound, Nordic Hamstring Curl, Plank Hold, and Pull-Up. Their definitions carry
an explicit `difficulty_model_quarantine` provenance record and remain in
`review`.

The minimum program therefore contains 24,496 card-section decisions and
4,593–7,655 video candidates. Multiple sources may be required for one section.

The first complete candidate packets are stored in
`scripts/data/canonical-research/`:

- Incline Push-Up: 16 evidence sections, five videos, four alternates;
- 10-Yard Sprint: 16 evidence sections, four videos, five alternates;
- 10-Yard Build-Up to Breakdown: 16 evidence sections, three videos, five
  alternates.

The first source-registry family batch is stored under
`scripts/data/canonical-research/batches/` and its derived packets under
`scripts/data/canonical-research/generated/`:

- 2-Point Acceleration Start: 16 evidence sections, four videos, four
  alternates;
- 3-Point Start (10–20 m): 16 evidence sections, four videos, four alternates;
- Auditory Start Sprint: 16 evidence sections, five videos, five alternates;
- Falling Start (10 m): 16 evidence sections, five videos, four alternates;
- Half-Kneeling Start Sprint: 16 evidence sections, five videos, four
  alternates.

The second source-registry family batch covers max-velocity sprinting:

- Flying 10: 16 evidence sections, five videos, five alternates;
- Flying 10m Sprint: 16 evidence sections, five videos, four alternates;
- Flying 20: 16 evidence sections, five videos, four alternates;
- 20-20-20 Build-Up Sprint: 16 evidence sections, five videos, five
  alternates;
- Wicket Run Max Velocity: 16 evidence sections, five videos, five alternates.

The batch identifies Flying 10 and Flying 10m Sprint as the same candidate
identity, with measurement unit and zone length handled as dosage. This is a
candidate identity decision pending human review; it does not archive either
card automatically.

The sprint review flags its empty difficulty/load/fatigue model, a primary
capacity profile that conflicts with its maximal-acceleration identity, and an
under-specified recovery rule. The deceleration review flags empty taxonomy,
constraint, load, and fatigue fields plus missing impact, supervision, and
failure-consequence scores. These are candidate assessments, not published card
edits. The batch has zero reviewed evidence sections and zero approved videos
or alternates. This is intentional: discovery and research do not confer
approval.

The third source-registry family batch covers landing and braking foundations:

- Drop Squat to Stick: 16 evidence sections, four videos, five alternates;
- Snap-Down to Stick — Control Version: 16 evidence sections, five videos,
  five alternates;
- Forward Hop to Stick — Low Amplitude: 16 evidence sections, four videos,
  five alternates;
- Single-Leg Hop to Stick — Low Amplitude: 16 evidence sections, five videos,
  five alternates;
- Jog-to-Stick Linear Deceleration: 16 evidence sections, five videos, five
  alternates.

This batch separates non-jump landing-position acquisition, bilateral
horizontal jump landings, unilateral same-leg landings, and run-to-stop
horizontal braking. It flags Drop Squat to Stick and Snap-Down to Stick as a
candidate same identity, with overhead arm action handled as a variant or
annotation. It also flags the bilateral Forward Hop card name as ambiguous:
the described two-foot takeoff and landing should be named Forward Jump to
Stick, with the existing name retained only as an alias. Both are candidate
identity decisions pending human review.

The five cards now have structured proposed taxonomy, anatomy, difficulty,
load and fatigue profiles, constraints, dosage, instructions, readiness gates,
stop rules, programming decisions, and alternate classifications. No proposal
has been applied to a published card. All 23 video links returned a current
YouTube oEmbed response, but exact-version, full-content, captions,
demonstration quality, reviewer, and approval gates remain unset.

The fourth source-registry family batch completes the current landing and
braking-control family:

- Deceleration Step-Down / Stop-Step / Stick: 16 evidence sections, five
  videos, five alternates;
- Drop Landing to Lateral Stick: 16 evidence sections, five videos, five
  alternates;
- Lateral Hop to Stick — Low Amplitude: 16 evidence sections, five videos,
  five alternates;
- Lateral Skater Bound + Stick: 16 evidence sections, five videos, five
  alternates;
- Low Box Drop to Stick: 16 evidence sections, five videos, five alternates;
- Single-Leg Snap-Down + Stick: 16 evidence sections, five videos, five
  alternates.

The batch flags three identity problems for human adjudication. The so-called
step-down card is a single-step horizontal deceleration drill and should be
renamed Step-In to Stick; ordinary box step-down strength work is not an
alternate of that identity. The low-amplitude lateral baseline describes
two-foot takeoff and landing and should use *jump*, while the skater bound owns
the unilateral opposite-leg identity. Drop Landing to Lateral Stick remains
quarantined because the legacy card does not say whether lateral displacement
occurs during the elevated drop or after an intermediate landing; those
contact sequences must not be silently combined.

Low Box Drop to Stick is defined as a non-reactive bilateral step-off landing,
and Single-Leg Snap-Down as a non-flight unilateral position-acquisition drill.
Immediate rebounds, subsequent jumps, and reacceleration are separate
definitions or delivery profiles. All 30 candidate links returned current
YouTube oEmbed player metadata, but exact movement match, full-content review,
captions, demonstration quality, reviewer identity, and approval remain unset.

The fifth source-registry batch covers jump-to-stick foundations:

- Squat Jump to Stick: 16 evidence sections, five videos, five alternates;
- Countermovement Jump to Stick: 16 evidence sections, five videos, five
  alternates;
- Broad Jump to Stick: 16 evidence sections, five videos, five alternates;
- Split-Squat Jump to Stick: 16 evidence sections, five videos, five
  alternates;
- Tuck Jump to Stick: 16 evidence sections, five videos, five alternates.

The batch distinguishes a motionless paused-squat initiation from a
countermovement, corrects Broad Jump from a jump-height drill to horizontal
projection and braking, and restricts Tuck Jump to high-quality single
repetitions with full reset and leg re-extension before landing. Split-Squat
Jump is quarantined because the legacy instruction permits either retaining or
switching the lead leg; the proposed base card retains the lead leg and treats
an intentional scissor switch as a separate definition. All 25 links returned
current oEmbed player metadata, but no content or media approval was inferred.

The sixth source-registry batch covers rotational jump-to-stick exercises:

- 180 Jump to Stick: 16 evidence sections, five videos, five alternates;
- 180-Degree Jump to Stick: 16 evidence sections, five videos, five
  alternates;
- 90-Degree Jump Turn to Stick: 16 evidence sections, five videos, five
  alternates;
- 90-Degree Hop to Stick: 16 evidence sections, five videos, five alternates;
- Rotational Bound to Stick: 16 evidence sections, five videos, five
  alternates;
- Lateral Bound to Rotational Stick: 16 evidence sections, five videos, five
  alternates;
- Rotational Broad Jump to Stick: 16 evidence sections, five videos, five
  alternates.

The batch identifies 180 Jump to Stick and 180-Degree Jump to Stick as a
candidate same identity: a bilateral, in-place half-turn jump with bilateral
landing and a deliberate hold. It proposes the 90-degree bilateral jump turn
as the quarter-turn base. Neither decision has been applied; both require human
identity review.

Three under-specified cards remain quarantined. The 90-Degree Hop card must say
whether *hop* means unilateral takeoff and landing, including same- or
opposite-leg contact; otherwise it duplicates the bilateral jump-turn card.
Rotational Bound needs an explicit takeoff leg, landing leg, angle, projection,
and contact sequence. Lateral Bound to Rotational Stick must distinguish one
rotational lateral bound from a two-contact lateral-bound-to-rotational-bound
sequence. Rotational Broad Jump is provisionally a bilateral diagonal or
horizontal jump with approximately 90 degrees of rotation, but its exact turn
angle and laterality also require adjudication.

All 35 per-card links returned current YouTube oEmbed metadata and were
recorded as healthy and embeddable candidates in disposable PostgreSQL. The 25
distinct videos were not promoted: exact movement match, complete viewing,
captions, instructional and safety quality, reviewer identity, and approval
remain unset.

The seventh source-registry batch covers box-jump foundations:

- Box Jump: 16 evidence sections, five videos, five alternates;
- Countermovement Box Jump: 16 evidence sections, five videos, five
  alternates;
- Reset Repetition Box Jump: 16 evidence sections, five videos, five
  alternates;
- Box Jump Step-Down Reset: 16 evidence sections, five videos, five
  alternates;
- Athletic Box Jump for Height Quality: 16 evidence sections, five videos,
  five alternates;
- Arm-Swing Timing Box Jump: 16 evidence sections, five videos, five
  alternates;
- Low Box Jump to Stick: 16 evidence sections, five videos, five alternates;
- Non-Countermovement Box Jump: 16 evidence sections, five videos, five
  alternates;
- Pause Box Jump: 16 evidence sections, five videos, five alternates;
- No-Arm-Swing Box Jump: 16 evidence sections, five videos, five alternates.

The candidate identity model uses one stable bilateral countermovement Box
Jump: natural arm swing, full-foot landing on a stable platform, controlled
stand, step-down exit, and complete reset. Countermovement Box Jump, Reset
Repetition Box Jump, Box Jump Step-Down Reset, Athletic Box Jump for Height
Quality, and Arm-Swing Timing Box Jump are proposed same-identity cards whose
useful language should become aliases, safety requirements, annotations, or
delivery-profile emphasis after human adjudication. No merge has been applied.

Pause Box Jump and Non-Countermovement Box Jump are a second candidate
same-identity pair: one paused-static variant with a repeatable start depth, a
two-to-three-second motionless hold, and no second dip. No-Arm-Swing Box Jump
is a controlled arm-use variant. Low box height and an extended landing hold
are delivery modifiers rather than proof of a new movement identity.

The batch explicitly rejects maximal box height as a jump-height measure.
Platform height can be increased through greater hip flexion and collision
tolerance, while research in recreationally active adults found that changing
the studied platform height generally did not change most propulsive variables
when maximal jump intent was preserved. Difficulty is therefore assessed from
the exercise's technical and physical demands, supervision, collision
consequence, impact, coordination, and fatigue sensitivity—not athlete skill
level or the highest box cleared.

All 50 per-card candidates returned current oEmbed metadata and were recorded
as healthy and embeddable in disposable PostgreSQL. Those 26 distinct videos
remain unapproved pending exact-version viewing, complete content and safety
review, captions and accessibility review, and reviewer attribution.

The eighth source-registry batch covers reactive depth-drop and depth-jump
exercises:

- Depth Drop to Athletic Stick: 16 evidence sections, five videos, five
  alternates;
- Drop Jump: 16 evidence sections, five videos, five alternates;
- Drop Jump — Reactive: 16 evidence sections, five videos, five alternates;
- Depth Drop to Rebound: 16 evidence sections, five videos, five alternates;
- Depth Drop to Vertical Rebound: 16 evidence sections, five videos, five
  alternates;
- Low Box Drop to Vertical Rebound: 16 evidence sections, five videos, five
  alternates;
- Low Box Drop to Quarter-Squat Rebound: 16 evidence sections, five videos,
  five alternates;
- Low Box Rebound Jump: 16 evidence sections, five videos, five alternates;
- Depth Jump: 16 evidence sections, five videos, five alternates;
- Depth Jump to Rebound: 16 evidence sections, five videos, five alternates;
- Depth Jump to Vertical Jump: 16 evidence sections, five videos, five
  alternates.

The candidate identity model separates three exercises by contact sequence and
intent. Depth Drop to Athletic Stick is a landing-only step-off and a candidate
same identity as Low Box Drop to Stick. Drop Jump is the short-contact,
bounce-strategy rebound identity; the reactive, rebound, low-box, and
quarter-squat labels are candidate same-identity names or delivery modifiers.
Depth Jump is the height-priority rebound identity, permitting a deeper
countermovement and longer contact than the bounce strategy; its Rebound and
Vertical Jump names are candidate same identities. No merge has been applied.

This distinction matters for programming and measurement: published research
shows that bounce and countermovement techniques produce materially different
contact-time and rebound-height behavior. Drop height alone is not an exercise
difficulty or training-intensity score; it must be individualized with landing
quality, contact time, rebound output, force or power measures, athlete
readiness, and exposure history. The proposed difficulty models assess
technical complexity and physical demand directly and do not assign exercise
skill levels.

All 55 per-card candidates returned current YouTube oEmbed metadata and were
recorded as healthy and embeddable in disposable PostgreSQL. The 15 distinct
videos remain unapproved pending exact-sequence viewing, complete content and
safety review, captions and accessibility review, reviewer identity, and
approval. The duplicate identities and the under-specified quarter-squat label
remain quarantined for human adjudication.

The ninth source-registry batch covers alternating and same-leg bounds:

- Alternating Bounds: 16 evidence sections, five videos, five alternates;
- Alternate-Leg Bound for Distance: 16 evidence sections, five videos, five
  alternates;
- Alternating Bounds for Distance: 16 evidence sections, five videos, five
  alternates;
- Alternating Bounds for Rhythm: 16 evidence sections, five videos, five
  alternates;
- Alternating Bounds for Height: 16 evidence sections, five videos, five
  alternates;
- Alternate Bounds for Height and Distance: 16 evidence sections, five videos,
  five alternates;
- Single-Leg Bounds: 16 evidence sections, five videos, five alternates;
- Three-Bound Distance Series: 16 evidence sections, five videos, five
  alternates;
- Three-Hop Bound Series: 16 evidence sections, five videos, five alternates;
- Uphill Bound: 16 evidence sections, five videos, five alternates.

Alternating Bounds is the proposed stable identity: continuous forward bounds
that alternate left and right unilateral contacts. Distance and rhythm are
delivery intents, while a deliberate vertical bias and an incline are
controlled variants. Alternate-Leg Bound for Distance and Alternating Bounds
for Distance are candidate same identities. Three-Bound Distance Series is a
three-contact measurement profile rather than a new movement.

Single-Leg Bounds remains distinct because repeated contacts stay on the same
limb, materially increasing unilateral coordination, impact, and stabilization
demand. Three-Hop Bound Series remains quarantined: its title says *hop*, its
description says *bounds*, and the legacy card never states whether the three
contacts alternate or remain on one leg. It should merge with Three-Bound
Distance Series if contacts alternate or become a specifically named same-leg
triple bound if they do not.

The batch replaces generic repetitions with total and per-leg contacts,
attempts, lane length or measurement protocol, terminal action, and full
recovery. It rejects the existing two-second recovery assigned to maximal
height-and-distance bounds. Uphill Bound now requires an inspected grade,
weather and traction checks, a safe return route, and walk-down recovery; an
incline can change normal impact, propulsive work, and internal tissue loading,
so it is not labeled universally safer or easier.

All 50 per-card candidates returned current YouTube oEmbed metadata after one
unavailable result was replaced wherever it appeared. The 23 distinct videos
remain unapproved pending exact contact-pattern and projection review, complete
viewing, captions and accessibility review, instructional and safety review,
reviewer identity, and approval.

The tenth source-registry batch covers ankle-dominant and straight-leg sprint
drills:

- Ankle Pogo in Place: 16 evidence sections, five videos, five alternates;
- Low Pogos / Ankling Bounce: 16 evidence sections, five videos, five
  alternates;
- Ankling Pogo Hop: 16 evidence sections, five videos, five alternates;
- Ankling / Dribble March: 16 evidence sections, five videos, five alternates;
- Ankling Drill: 16 evidence sections, five videos, five alternates;
- Ankling Walk: 16 evidence sections, five videos, five alternates;
- Fast Ankling Pogo March: 16 evidence sections, five videos, five alternates;
- Straight-Leg Bound March — Distance Jump: 16 evidence sections, five videos,
  five alternates;
- Straight-Leg Bound March / Straight-Leg Run Prep: 16 evidence sections, five
  videos, five alternates;
- Straight-Leg Bound — Distance Jump: 16 evidence sections, five videos, five
  alternates;
- Straight-Leg Ankling Ladder: 16 evidence sections, five videos, five
  alternates;
- Straight-Leg Bounds to Sprint: 16 evidence sections, five videos, five
  alternates.

The candidate identity model retains one stationary bilateral low-pogo
definition and proposes Low Pogos as its alias plus low-intensity delivery
profile. It retains Ankling Drill as the traveling alternating short-step
identity and proposes Ankling Walk and the current Ankling / Dribble March as
cadence or teaching profiles unless a separately defined dribble cycle is
approved. These decisions have not been applied to production identities.

Two hybrid labels remain quarantined. Ankling Pogo Hop never states whether
contacts are stationary or traveling, bilateral or alternating. Fast Ankling
Pogo March combines three movement terms, has one ambiguous repetition, and
currently has two simultaneous primary phase profiles. Neither can be
prescribed until a human reviewer resolves its exact sequence and primary
delivery intent.

The two straight-leg march cards are candidate duplicates, while one also
instructs the athlete to “march or bound.” The proposal splits no-flight
straight-leg marching from repeated flight-based straight-leg bounding.
Straight-Leg Bound remains a higher-impact definition, and Straight-Leg Bounds
to Sprint remains a distinct compound definition that requires explicit bound
contacts, transition distance, sprint distance, high-speed recovery, and a
marked deceleration zone. The ladder version remains a controlled external
constraint only after its exact one- or two-contact-per-box pattern is defined.

Every exercise is assessed with technical complexity, physical and
absolute-load demand, coordination, supervision, failure consequence, impact,
work-capacity demand, and overall difficulty. Athlete experience and readiness
appear only as programming context and eligibility checks.

All 60 per-card candidates returned current YouTube oEmbed metadata. The 28
distinct videos remain unapproved: exact movement and variant match, complete
viewing, captions, instructional and safety quality, accessibility, reviewer
identity, and approval remain unset. The ladder set is explicitly quarantined
because only part of the visible-search set demonstrates both the straight-leg
ankling action and the ladder constraint.

The eleventh source-registry batch covers the dribble-run progression:

- Low Dribble Run: 16 evidence sections, five videos, five alternates;
- High Dribble Run: 16 evidence sections, five videos, five alternates;
- Dribble Build to Sprint: 16 evidence sections, five videos, five alternates;
- Wall Ankling Pogo: 16 evidence sections, five videos, five alternates.

Low Dribble Run and High Dribble Run share the compact, cyclic dribble-run
pattern but retain controlled recovery-height variants: the low version cycles
near the ankle or lower shin, while the high version cycles near knee height.
Those height bands must be explicit because cadence, flight, coordination,
projection, and the intended sprint-mechanics constraint change with them.
They are not athlete skill levels and do not imply universal models of
upright sprinting.

Dribble Build to Sprint is retained as a distinct compound definition. It
requires a named low-to-high or fixed-height dribble segment, a clearly marked
blend, a sprint segment, a deceleration zone, high-speed metre accounting, and
full quality recovery. “Dribble Bleed to Sprint” is proposed as an alias.
Direct evidence for transfer from these named drill variants to sprint
performance remains limited, so the packets distinguish established sprint
biomechanics from coach-derived exercise delivery.

Wall Ankling Pogo remains quarantined. The legacy card does not resolve whether
it means a wall-supported single-leg pogo, an alternating wall stride pogo, or
a supported no-flight ankling action. Those patterns have different contact
sequences, dosage, impact, and coaching requirements and must not be collapsed
into one prescribable definition. Its mixed candidate set exists to support
identity adjudication, not to establish an exact media match.

All 20 per-card candidates returned current YouTube oEmbed metadata and were
recorded as healthy and embeddable in disposable PostgreSQL. The 19 distinct
videos remain unapproved pending exact-height or exact-sequence viewing,
complete content and safety review, captions and accessibility review,
reviewer identity, and approval.

The twelfth source-registry batch covers the A-series march and skip family:

- A-March: 16 evidence sections, five videos, five alternates;
- A-March Linear: 16 evidence sections, five videos, five alternates;
- A-March Mobility with Arm Sweep: 16 evidence sections, five videos, five
  alternates;
- A-March to Projection: 16 evidence sections, five videos, five alternates;
- A-Skip: 16 evidence sections, five videos, five alternates;
- A-Skip Pogo Rhythm: 16 evidence sections, five videos, five alternates;
- A-Skip Rhythm Punch: 16 evidence sections, five videos, five alternates;
- A-Skip Snap Down: 16 evidence sections, five videos, five alternates;
- A-Skip Through Cone Gates: 16 evidence sections, five videos, five
  alternates;
- A-Skip Through Ladder: 16 evidence sections, five videos, five alternates;
- A-Skip for Approach Rhythm: 16 evidence sections, five videos, five
  alternates;
- High-Knee A-March Ladder: 16 evidence sections, five videos, five
  alternates.

The proposed stable A-March identity is a traveling, alternating, no-flight
march with controlled single support, an assigned thigh landmark, contact
close beneath the body, and reciprocal arm action. A-March Linear is a
candidate duplicate. The mobility-and-arm-sweep card currently describes
ordinary reciprocal arm action and should become a low-cadence coaching
profile unless a distinct shoulder or thoracic sequence is demonstrated.

The proposed stable A-Skip identity is a traveling alternating step-hop gait
with brief flight, a defined recovery target, and repeatable arm-leg rhythm.
Rhythm Punch, Snap Down, and Approach Rhythm are candidate same identities:
their current cards change cue emphasis or sport context without changing the
contact sequence. They should become aliases, annotations, or delivery
profiles rather than separate exercise definitions.

The candidate packets remove unsupported speed, acceleration, explosiveness,
jump-height, and approach-transfer promises. A 2025 criterion-referenced test
battery reported good overall inter-rater reliability for A-Skip scoring but
found no statistically significant association between A-Skip score and 5 m
or 20 m sprint performance in its sample. A-series drills are therefore
represented as athlete-specific coordination, position, rhythm, or warm-up
constraints unless a transfer outcome is separately measured.

Four cards remain explicitly quarantined. A-March to Projection does not
define whether projection means a wall-supported posture, free acceleration,
march-to-sprint transition, or jump-approach action. A-Skip Pogo Rhythm does
not define whether pogo is a cue, a pogo-skip gait, or an added contact.
A-Skip Through Cone Gates lacks a reproducible contact-to-gate rule and exact
media support. High-Knee A-March Ladder does not say whether contacts are a
no-flight march, one-in ladder run, or two-in ladder run. The ladder A-Skip
card may remain a controlled variant only after one exact cell pattern is
selected.

One unavailable ladder result was replaced before import. All 60 current
per-card candidates then returned successful YouTube oEmbed metadata and were
recorded as healthy and embeddable in disposable PostgreSQL. The 37 distinct
videos remain unapproved pending complete viewing, exact contact-pattern and
constraint review, captions and accessibility review, instructional and safety
review, reviewer identity, and approval.

The thirteenth source-registry batch covers ordinary skipping, constrained
rhythm skipping, power skipping, and fast-leg cycling:

- Skipping Rhythm Drill: 16 evidence sections, five videos, five alternates;
- Skipping Rhythm Change: 16 evidence sections, five videos, five alternates;
- Cone Skip Rhythm Build: 16 evidence sections, five videos, five alternates;
- Skipping Rhythm Change with Ball Toss: 16 evidence sections, five videos,
  five alternates;
- Power Skip for Distance: 16 evidence sections, five videos, five alternates;
- Fast-Leg Cycle Drill: 16 evidence sections, five videos, five alternates.

The proposed stable ordinary-skip identity is a traveling alternating
step-hop gait with light submaximal projection and reciprocal arm action. It is
not an A-skip and does not carry an athlete skill level. Skipping Rhythm Change
is a candidate delivery profile of that base identity until an exact cadence
sequence and cue rule are adopted.

Cone Skip Rhythm Build is a controlled external-spacing variant, but its
current card does not say whether one contact, one complete skip cycle, or some
other unit belongs in each gap. It remains quarantined until that rule and an
individualized spacing method are defined. Skipping Rhythm Change with Ball
Toss is a materially different dual-task variant because ball flight,
interception, hand use, and drop recovery add perception-action and safety
requirements. It also remains quarantined because visible searches found only
separate skipping and toss/catch components, not an exact combined
demonstration.

Power Skip for Distance remains a distinct horizontal plyometric definition.
The two active baseline variants have conflicting doses and must be
consolidated into one total- and per-side-contact prescription. Its difficulty
was reassessed to include maximal projection, unilateral landing, impact,
supervision, and failure consequence instead of the current generic low-load
score.

Fast-Leg Cycle Drill remains provisionally distinct, but the card and visible
candidates use several different support-leg and side-switch patterns. It is
quarantined until stationary versus traveling execution, the support-leg
action, working-leg contact sequence, cycle count, side-change rule, and finish
are explicit.

Peer-reviewed skipping biomechanics informed the load correction: skipping is
not mechanically equivalent to running, successive skipping contacts have
different functions, and lower modeled knee loading at one matched speed does
not make it a globally low-load task because ankle contact force and
plantar-flexor demand can be higher. All 30 per-card candidates returned
successful YouTube oEmbed metadata and were recorded as currently healthy and
embeddable in disposable PostgreSQL. No exact match, demonstration quality,
reviewer identity, or approval was inferred.

The fourteenth source-registry batch resolves the falling-start collision
cluster:

- Falling Start Sprint: 16 evidence sections, five videos, five alternates;
- Falling Start to 10 Meters: 16 evidence sections, five videos, five
  alternates;
- Falling Start to 10 Yards: 16 evidence sections, five videos, five
  alternates;
- Falling Start to 10-Yard Cone: 16 evidence sections, five videos, five
  alternates;
- Falling Start to 5–10 Yard Sprint: 16 evidence sections, five videos, five
  alternates;
- Falling Start Position Hold: 16 evidence sections, five videos, five
  alternates.

The first five are candidate duplicates of the already researched Falling
Start 10m identity. Spelling out metres, changing 10 metres to 10 yards,
providing a 5-to-10-yard range, omitting the distance, or adding a finish cone
changes dosage, measurement, or logistics—not the exercise. Their packets
recommend one surviving identity with aliases and metric or imperial delivery
profiles.

Falling Start Position Hold remains a separate no-sprint definition. The
athlete catches the forward fall in one split-stance recovery step and holds,
which changes the terminal action, impact, physical demand, quality gates, and
programming purpose. Its five reused falling-start videos are explicitly
adjacent candidates; no exact stop-and-hold match is claimed and the card
remains quarantined.

All 30 per-card candidate links returned successful current YouTube oEmbed
responses. The five underlying videos were already present in the researched
falling-start identity, so distinct-library video count did not increase. No
candidate was approved or marked as an exact hold or sprint match.

The fifteenth source-registry batch resolves the two-point-start collision
cluster:

- 2-Point Start 10–20m: 16 evidence sections, four videos, five alternates;
- Two-Point Start to 5–10 Yard Sprint: 16 evidence sections, four videos, five
  alternates;
- Two-Point Start Walk-In: 16 evidence sections, four videos, five alternates.

The first two are candidate duplicates of 2-Point Acceleration Start. Their
distance ranges belong in metric or imperial delivery profiles, while the
static staggered stance, high-intent initiation, and short-acceleration
identity remain the same.

Two-Point Start Walk-In is retained only as a controlled variant. A counted
walking entry and submaximal exit change the start procedure, coordination,
physical demand, and phase placement. The current description permits a
walk-in, lean-in, or static setup, so publication remains quarantined until one
exact entry sequence is selected. Its four static-start videos are adjacent
candidates, not exact walk-in matches.

All 12 reused candidate links returned successful current YouTube oEmbed
responses. The four videos were already present in the stable two-point-start
packet, so distinct-library video count again remained unchanged. No candidate
was approved.

The sixteenth source-registry batch resolves the prone and push-up-start
collision cluster:

- Push-Up / Prone Start Sprint: 16 evidence sections, five videos, five
  alternates;
- Prone Pop-Up to Sprint: 16 evidence sections, five videos, five alternates;
- Push-Up Start 10m: 16 evidence sections, five videos, five alternates;
- Push-Up Start to Cone: 16 evidence sections, five videos, five alternates.

The current stable Push-Up / Prone Start Sprint card conflates two start-contact
states: lying fully prone and holding the bottom of a push-up. The candidate
decision retains one ground-start-to-short-acceleration definition with those
states modeled as explicit controlled variants, but quarantines that decision
until a human reviewer confirms the exact chest, hand, elbow, cue, lead-foot,
transition, distance, and run-out requirements. Its two duplicate baseline rows
must also be consolidated after review.

Prone Pop-Up to Sprint is a candidate fully prone variant or alias of that
definition. Push-Up Start 10m changes dosage, and Push-Up Start to Cone changes
target logistics; neither creates a new exercise identity. All three remain
separate review packets so the merge decision, source provenance, and legacy
aliases are preserved.

The four legacy links previously attached to Push-Up Start to Cone showed a
four-cone drill, build-up sprint, generic sprint-mechanics drills, and generic
agility-cone drills. The candidate import superseded those mismatched links
with exact-title prone- or push-up-start candidates. All 20 per-card links
returned successful current YouTube oEmbed responses. They represent nine new
distinct videos in the researched set. Availability and embedding are metadata
only: no exact movement or controlled-variant match, complete demonstration,
reviewer identity, or approval was inferred.

The seventeenth source-registry batch resolves the three-point-start collision
cluster:

- 3-Point Start 10–20m: 16 evidence sections, four videos, five alternates;
- Three-Point Start Acceleration: 16 evidence sections, four videos, five
  alternates;
- Three-Point Acceleration Build-Up: 16 evidence sections, four videos, five
  alternates.

3-Point Start 10–20m remains the stable static, one-hand-supported
short-acceleration identity. Three-Point Start Acceleration describes the same
start over 5–10 yards, so its name becomes an alias and its imperial target
range becomes dosage.

Three-Point Acceleration Build-Up remains quarantined as a provisional
controlled delivery profile. Its current card mentions a distance-jump run-up
but does not define the supported start, acceleration-zone length, target
intensity, total distance, terminal action, or whether a jump approach follows.
A human reviewer must either specify a materially longer progressive rise or
merge it as another alias of the stable start. A measured approach ending in
takeoff would instead require a distinct long-jump approach identity.

All 12 per-card links returned successful current YouTube oEmbed responses.
They reuse four videos already present in the researched three-point-start
packet. The Build-Up card labels them as adjacent start-component candidates,
not exact progressive build-up or jump-approach demonstrations. No candidate
was approved.

The eighteenth source-registry batch resolves the generic 10-yard-sprint
collision:

- 10-Yard Sprint: 16 evidence sections, four videos, five alternates;
- 10-Yard Sprint Start: 16 evidence sections, four videos, five alternates.

The second card adds the word Start but does not define a different start
position, cue, or movement. It is therefore a candidate duplicate of 10-Yard
Sprint and its title becomes an alias. The surviving identity remains
start-agnostic only if every workout delivery selects and renders an explicit
standing, two-point, three-point, falling, prone, resisted, or reaction-start
variant. A flying entry remains a distinct maximal-velocity definition.

All eight per-card links returned successful current YouTube oEmbed responses.
They reuse four videos already present on 10-Yard Sprint. Several show the
first 10 yards inside a longer sprint or describe a repeated-sprint protocol,
so exact 10-yard effort, selected start, dosage, and complete demonstration
remain human-review gates. No candidate was approved.

The nineteenth source-registry batch resolves Split-Stance 10-Yard
Acceleration:

- Split-Stance 10-Yard Acceleration: 16 evidence sections, four videos, five
  alternates.

The card describes the same static staggered start as 2-Point Acceleration
Start. Split stance is a synonym, 10 yards is dosage, and the start and finish
cones are optional logistics rather than an agility taxonomy. The packet
therefore recommends merging it into the existing two-point identity while
preserving its title as an alias.

Its four inherited links showed a generic four-cone drill, a build-up sprint,
generic sprint-mechanics drills, and generic agility-cone drills. Candidate
import superseded them with the researched two-point-start set. All four
replacement links returned successful current YouTube oEmbed responses. The
standing-start candidate remains adjacent rather than an exact staggered-start
match, and none of the four candidates was approved.

The twentieth source-registry batch resolves the reactive cue sprint-start
family:

- Auditory Start Sprint: 16 evidence sections, five videos, five alternates;
- Split-Stance Auditory Sprint Start: 16 evidence sections, five videos, five
  alternates;
- Light / Visual Cue Sprint Start: 16 evidence sections, four videos, five
  alternates;
- Partner Point Reactive Sprint Start: 16 evidence sections, five videos, five
  alternates.

Auditory Start Sprint remains the simple one-sound-to-one-forward-sprint
identity. Whistle, clap, and verbal go are cue implementations; the start stance
must still be explicit. Split-Stance Auditory Sprint Start is retained as its
controlled staggered-stance variant, but remains quarantined because the
current card implies multiple answer choices and no candidate has yet been
confirmed to show both the exact stance and auditory procedure.

Light / Visual Cue Sprint Start remains quarantined until a reviewer chooses
between one light mapped to one prepared sprint and multiple colors or lights
mapped to different directions. The latter is reactive agility, not a simple
sprint-start reaction. Partner Point Reactive Sprint Start remains a distinct
reactive-agility identity because a live point selects left, right, or forward,
adding perceptual choice, reorientation, direction balance, and braking.

All 19 per-card links returned successful current YouTube oEmbed responses.
Visible search added exact-title candidates for Partner Point Reaction Drill
and Partner Point Reactive Hip Turn to Sprint, plus visual-cue component
candidates. Exact stance, cue mapping, direction, distance, complete
demonstration, captions, safety quality, reviewer identity, and approval remain
human gates. No candidate was approved.

The twenty-first source-registry batch resolves the backpedal-to-sprint family:

- Backpedal to Sprint Turn: 16 evidence sections, five videos, five alternates;
- Backpedal to Sprint Open Turn: 16 evidence sections, five videos, five
  alternates;
- Backpedal to Sprint Turn on Signal: 16 evidence sections, five videos, five
  alternates;
- Backpedal to Sprint to Stick: 16 evidence sections, five videos, five
  alternates.

Turn and open turn are the same exercise identity when backward distance and
speed, turn angle and side, plant, sprint path and distance, and terminal action
match. The candidate decision preserves both names as aliases and models 90-
versus 180-degree turns and left-versus-right turns as controlled delivery
dimensions.

Turn on Signal remains a reactive variant because an unpredictable cue selects
the turn side and adds perception and choice. Its media set contains direct
backpedal-turn components and adjacent reverse-sequence or cue demonstrations;
none is represented as an exact combined match. To Stick remains a distinct
braking-and-balance definition because the required terminal deceleration and
hold change the outcome, loading, supervision, quality gates, and stop rules.
The sprint-through definition is its regression.

The three legacy Open Turn links showed two T-test demonstrations and a
sprint-to-backpedal sequence, so candidate import superseded them. All 20
replacement or retained links returned successful current YouTube oEmbed
responses, adding 12 distinct videos to the researched set. Availability and
embedding do not establish exact movement match, complete viewing, captions,
safety quality, reviewer identity, or approval. No candidate was approved.

The twenty-second source-registry batch resolves the foundational
medicine-ball throw family after abbreviated-name consolidation:

- Medicine Ball Chest Pass: 16 evidence sections, five videos, five alternates;
- Medicine Ball Scoop Toss: 16 evidence sections, five videos, five alternates;
- Medicine Ball Rotational Scoop Toss: 16 evidence sections, five videos, five
  alternates;
- Medicine Ball Shot-Put Throw: 16 evidence sections, five videos, five
  alternates;
- Medicine Ball Rotational Shot Put: 16 evidence sections, five videos, five
  alternates.

The five identities now have controlled release and force-vector boundaries.
Chest pass is a bilateral forward chest-level release. Forward scoop toss is a
bilateral underhand hip-extension projection. Rotational scoop toss is a
bilateral low-side release from a side-on hip load. Forward shot-put throw is a
forward-facing unilateral push without deliberate side-on preload. Rotational
shot put is a side-on unilateral push using transverse hip–trunk sequencing.

The generic Scoop Toss and Shot-Put Throw labels remain quarantined until their
display names are changed to Forward Medicine Ball Scoop Toss and
Forward-Facing Medicine Ball Shot-Put Throw. Without those orientation rules,
they overlap the rotational definitions. Static, seated, supine, kneeling,
step-behind, drop-step, shuffle, two-hop, partner, wall, catch, no-catch,
velocity, distance, and target choices are modeled as variants, annotations, or
delivery dimensions according to whether they preserve the release pattern and
force vector.

Candidate import replaced three overfilled eight- or nine-link legacy sets and
removed rotational or kneeling demonstrations from forward baseline sets. All
25 selected links returned successful current YouTube oEmbed responses. Exact
stance, release, ball mass and type, rebound behavior, complete demonstration,
captions, cue and safety quality, reviewer identity, and approval remain human
gates. No candidate was approved.

The twenty-third source-registry batch resolves foundational ball slams after
implement, stance, cadence, trajectory, and entry-footwork consolidation:

- Medicine Ball Overhead Slam: 16 evidence sections, five videos, five
  alternates;
- Tall-Kneeling Overhead Medicine Ball Slam: 16 evidence sections, five
  videos, five alternates;
- Slam Ball Rotational Slam: 16 evidence sections, five videos, five
  alternates;
- Slam Ball Scoop Slam: 16 evidence sections, five videos, five alternates;
- Medicine Ball Rebound Slam to Catch: 16 evidence sections, five videos, five
  alternates.

The candidate identity model keeps five materially different tasks: a standing
straight overhead-to-floor slam, a tall-kneeling overhead slam, a side-directed
rotational slam, a low-start scoop-to-floor slam, and a reactive slam whose
rebound catch is mandatory. Slam-ball construction, split stance, alternating
cadence, rainbow arc, overhead-to-side nomenclature, and step-behind entry are
controlled variants of the relevant base identity. Wall throws, free-flight
scoop tosses, support-position changes, and mandatory rebound-catch tasks remain
separate when their force vector, terminal outcome, support, or reception demand
changes.

Migration `301_coaching_ball_slam_variant_consolidation.sql` archives seven
variant-only definitions in the canonical layer while preserving aliases,
source mappings, variants, delivery profiles, candidate records, and explicit
identity-resolution provenance. The scoop-slam boundary remains specifically
quarantined because the term is uncommon and candidate media mix pure,
shuffle-entry, and combination versions.

All 25 selected links returned successful current YouTube oEmbed responses.
This verifies current link health and an embed-player response only. Exact
version, complete viewing, ball construction, rebound behavior, captions,
instruction and safety quality, reviewer identity, and approval remain human
gates. No candidate was approved.

The twenty-fourth source-registry batch resolves the foundational 90/90 and
shin-box family after identity consolidation:

- 90/90 Breathing with Reach: 16 evidence sections, four videos, five
  alternates;
- 90/90 Hip Switch: 16 evidence sections, five videos, five alternates;
- Shin Box Get-Up: 16 evidence sections, five videos, five alternates.

Migration `302_coaching_9090_shin_box_identity_consolidation.sql` archives four
duplicate or variant-only definitions while preserving aliases, source
mappings, variants, delivery profiles, candidate records, and explicit
identity-resolution provenance. Supine 90/90 breathing remains distinct from
seated 90/90 hip rotation. Shin box and seated 90/90 are equivalent naming for
the hip-switch identity; a reach is an upper-body overlay, and continuous flow
is delivery cadence rather than a new exercise.

The published Shin Box Get-Up sequence continues from the seated 90/90
transition through tall-kneeling hip extension, half-kneeling, and standing
before reversing. The legacy card stopped at tall kneeling, so its partial
motion is quarantined as a proposed `Shin Box Hip Lift` regression rather than
being retained as the get-up baseline. This is a candidate correction pending
human content review, not an approval.

All 14 selected links returned successful current YouTube oEmbed responses.
This verifies current link health and an embed-player response only. Exact
movement and version, complete viewing, captions, demonstration quality,
reviewer identity, and approval remain human gates. No candidate was approved.

The twenty-fifth source-registry batch covers 180-degree transitions after two
additional identity consolidations:

- 180 Jump Rebound to Sprint-Out: 16 evidence sections, four videos, five
  alternates;
- 180-Degree Turn / Shuttle Cut: 16 evidence sections, five videos, five
  alternates;
- 180-Turn Wall Ball Catch-and-Throw: 16 evidence sections, five videos, five
  alternates.

Migration `303_coaching_180_degree_identity_consolidation.sql` archives the
spelled-out-degree duplicate of 180 Jump to Stick and the duplicate planned
180-degree turn-and-sprint card. It preserves aliases, source mappings,
variants, delivery profiles, candidate records, and explicit resolution
provenance. Modified versus traditional 505 approach, plant side, pivot
strategy, timing, and exit distance are controlled delivery dimensions; an
unpredictable cue or a multi-turn shuttle is a different task.

Two composite cards remain identity-quarantined instead of being filled with
invented detail. The jump/rebound/sprint card does not establish whether
`rebound` means a second flight or a fast first-landing-to-sprint transition.
Its four links are explicitly component candidates, not exact matches. The
wall-ball card makes receiving optional, does not distinguish medicine ball
from wall-ball shot, and does not name the throw pattern. A documented
throw-to-wall, 180-turn, then catch protocol has a different order and cannot
be silently substituted. The candidate packet therefore proposes separate
turn/catch/throw identities for adjudication rather than approving the current
composite.

All 14 selected links returned successful current YouTube oEmbed responses.
This establishes current link health and an embed-player response only. Exact
sequence, complete viewing, captions, cue and safety quality, reviewer identity,
and approval remain human gates. No candidate was approved.

The twenty-sixth source-registry batch covers the 45-degree redirection family
after one additional identity consolidation:

- 45-Degree Cut and Stick: 16 evidence sections, four videos, five alternates;
- 45-Degree Cut and Reaccelerate: 16 evidence sections, five videos, five
  alternates;
- 45-Degree Cut Bound to Stick: 16 evidence sections, four videos, five
  alternates.

Migration `306_coaching_45_degree_cut_identity_consolidation.sql` archives
`45-Degree Cut to Stick` into `45-Degree Cut and Stick` while preserving
aliases, source mappings, variants, candidate-only research, and explicit
resolution provenance. The connecting word does not change the planned
approximately 45-degree redirection or held terminal outcome. The
immediate-reacceleration card remains separate because its exit changes the
terminal outcome and phase demand. The bound card also remains separate because
it introduces flight and a single-leg landing contact sequence.

The exact legacy meaning of `stick`—holding the cut plant versus holding the
first exit step—still requires human adjudication. The bound card is also
identity-quarantined because the legacy phrase `cut bound` may imply a run-in
cut before flight rather than the provisional stationary diagonal bound used
for candidate research. These uncertainties were recorded rather than filled
with invented protocol detail.

All 13 selected links returned successful current YouTube oEmbed responses.
This establishes current link health and an embed-player response only. Exact
sequence and version, complete viewing, captions, cue and safety quality,
reviewer identity, and approval remain human gates. No candidate was approved.

The twenty-seventh source-registry batch covers the complete Cossack family
after twelve additional controlled-variant consolidations:

- Cossack Squat: 16 evidence sections, five videos, 15 alternates;
- Cossack Shift to Wall Ball Toss: 16 evidence sections, five videos, seven
  alternates.

Migration `307_coaching_cossack_variant_consolidation.sql` retains one
`Cossack Squat` definition and converts low-amplitude range, bottom hold, bottom
pry, terminal stick, slow tempo, reach overlays, and kettlebell, landmine,
generic-load, and sandbag implementations into explicit variants. The second
bottom-hold source is an exact duplicate of the selectable bottom-hold outcome
and remains archived as source provenance instead of creating a duplicate
variant. All 1,673 source mappings and source variants remain traceable.

The generic reach variant remains identity-quarantined because the historical
source does not define reach direction. The generic loaded variant remains
identity-quarantined because the source does not define implement or load
position. Neither received a fabricated score or equipment requirement.

`Cossack Shift to Wall Ball Toss` remains a separate definition because ball
release, target interaction, rebound, and reception change the task identity.
Its historical card does not define throw direction, target, ball behavior,
catch-versus-retrieve rule, side order, or reset. The five links are explicitly
adjacent component candidates, not exact matches, and the definition cannot be
published or prescribed until a human resolves that protocol.

All ten selected links returned successful current YouTube oEmbed responses.
This establishes current link health and an embed-player response only. Exact
sequence and version, complete viewing, captions, cue and safety quality,
reviewer identity, and approval remain human gates. No candidate was approved.

The twenty-eighth source-registry batch covers the adductor rock-back family
after three additional controlled-variant consolidations:

- Adductor Rockback: 16 evidence sections, five videos, 11 alternates.

Migration `308_coaching_adductor_rockback_variant_consolidation.sql` retains one
`Adductor Rockback` definition and converts the generic reach, explicit
T-spine-reach, and half-kneeling kicking-context cards into controlled variants.
All four legacy source mappings, source variants, delivery profiles, and the
eight prior legacy media candidates remain traceable.

The generic reach variant remains identity-quarantined because the historical
source does not define reach direction, arm path, timing, or intended trunk
motion. The half-kneeling variant remains identity-quarantined because its
source does not define hand support, working-leg path, external load, or rock
direction. The explicit T-spine-reach variant records thoracic rotation and a
quiet-pelvis constraint without treating the unspecified reach as equivalent.
No unresolved variant received a fabricated score.

All five selected links returned successful current YouTube oEmbed responses.
Three are base rock-back candidates and two are explicit thoracic-rotation
variant candidates. This establishes link health and an embed-player response
only. Exact sequence and version, complete viewing, captions, cue and safety
quality, reviewer identity, and approval remain human gates. No candidate was
approved.

The twenty-ninth source-registry batch resolves the straight-arm hang and
scapular-control collision cluster:

- Dead Hang: 16 evidence sections, five videos, 11 alternates;
- Active Hang: 16 evidence sections, five videos, 11 alternates;
- Scapular Pull-Up: 16 evidence sections, five videos, 11 alternates.

Migration `309_coaching_hang_identity_split_and_consolidation.sql` preserves
three exercise identities. Dead Hang uses the assigned passive scapular
position, Active Hang holds an active scapular position isometrically with
straight elbows, and Scapular Pull-Up repeats scapular depression and controlled
return without elbow flexion. The migration consolidates `Active Hang Scapular
Hold` into Active Hang and archives the historical compound `Dead Hang / Active
Hang` definition after moving source 1074 to Active Hang and retaining
ambiguous source 201 as a non-selectable quarantined source variant under Dead
Hang. The former Dead Hang Breathing Reset becomes a contextual restore
delivery profile, not a separate identity.

Migrations `313_coaching_hang_family_structural_completion.sql` and
`314_coaching_hang_family_contract_completion.sql` complete those three
quarantined cards without revisiting identity. Each now has baseline,
foot-assisted, band-assisted, ring, weighted, and single-arm variants with
complete difficulty, load, fatigue, delivery, programming, dosage, timing,
measurement, athlete, coach, accessibility, support, logistics, and stop-rule
contracts. Dead Hang retains a separate restore/nasal-breathing delivery
profile. Selectable movement taxonomy uses only controlled `hang`, `pull`, and
`brace` keys; granular suspension, grip, scapular, elbow, and posture mechanics
are retained as qualifiers.

The three cards use only exercise complexity and physical difficulty for core
difficulty assessment, with overall equal to their maximum. External video
titles containing audience-level words remain source metadata and do not assign
a level to an exercise card. The future-dated source previously present in the
batch was removed rather than treated as current evidence, and its three
version-bound evidence rows are superseded. Each current card has all 16
evidence sections. All 15 selected links returned successful current
YouTube oEmbed responses. Exact movement and variant match, complete viewing,
captions, cue and safety quality, reviewer identity, and approval remain human
gates. No candidate was approved.

The thirtieth source-registry batch resolves the hanging leg-raise family after
three additional identity consolidations:

- Hanging Leg Raise: 16 evidence sections, five videos, 17 alternates.

Migration `310_coaching_hanging_leg_raise_identity_consolidation.sql` retains
one `Hanging Leg Raise` definition. The legacy Hanging Knee Raise is the
bent-knee baseline, Hanging Straight-Leg Raise is a longer-lever variant, and
Hanging Knee Raise Eccentric Lower is an eccentric-lower variant. The exact Tuck
Hanging Knee Raise duplicate remains archived and traceable. Kipping knee
raises, toes-to-bar, captain's-chair raises, hanging L-sits, windshield wipers,
and pull-up-plus-knee-raise combinations remain separate identity decisions.

The card assesses only exercise complexity and physical difficulty, with
overall equal to their maximum. The direct suspended bilateral-hip-flexion
evidence supports pelvic and femoral contributions that vary with knee
position; the EMG evidence supports hip flexors as movers and abdominal/trunk
control, not a lower-abdominal-isolation claim. Supine eccentric evidence is
labeled adjacent and does not validate hanging dosage or recovery. All five
selected links returned current oEmbed metadata, but exact movement/variant
match, complete viewing, captions, cue and safety quality, reviewer identity,
and approval remain unset. No candidate was approved.

The thirty-first source-registry batch resolves the support and hanging L-sit
family:

- L-Sit: 16 evidence sections, five videos, 11 alternates;
- Hanging L-Sit: 16 evidence sections, five videos, eight alternates.

Migration `311_coaching_l_sit_identity_and_hanging_split.sql` consolidates the
historical Tuck L-Sit Hold into L-Sit as its short-lever variant. One-leg,
full legs-together, straddle, and ring-support versions remain explicit
variants because they change lever, asymmetry, hip position, stability,
difficulty, supervision, or dosage without changing straight-arm push support.
Support height, heel taps, foot assistance, hold time, and rest are delivery
modifiers.

Hanging L-Sit is a separate review-only definition. Replacing straight-arm
push support with two-hand overhead suspension changes grip, shoulder position,
anchor, mount, clearance, fatigue, and safe exit. Dynamic hanging leg raises,
cyclic/kipping versions, one-arm suspension, V-sit, Manna, and seated
compression lifts remain separate identity decisions. The new legacy source is
unpublished and exists only to preserve complete source lineage.

All eight controlled variants derive overall difficulty as the maximum of
exercise complexity and physical difficulty. No athlete or class level is
stored or inferred. All ten selected videos returned current YouTube oEmbed
metadata and an embed-player response, but exact movement/variant match,
complete viewing, captions, cue and safety quality, reviewer identity, and
approval remain unset. No candidate was approved.

The thirty-second source-registry batch resolves grounded compression, V-sit,
and Manna:

- Seated Compression Lift: 16 evidence sections, five videos, eight alternates;
- V-Sit: 16 evidence sections, five videos, eight alternates;
- Manna Hold: 16 evidence sections, five videos, eight alternates.

Migration `312_coaching_support_compression_identity_family.sql` retains the
historical `straddle-compression-lift` slug as the stable source identity but
widens its canonical name and aliases to `Seated Compression Lift`. Bent-knee,
single-leg pike, bilateral pike, and bilateral straddle versions are controlled
variants because all remain grounded dynamic hip-flexion lifts without
suspending bodyweight through the arms. Hand position, stable blocks, lift
height, range, pause, tempo, and dose remain modifiers.

V-Sit is a separate high straight-arm support definition because both extended
legs must remain clearly above horizontal; together, straddle, and ring-support
versions are explicit variants. Manna is separate again because elevating the
hips and carrying the legs beyond the shoulder line materially changes shoulder
extension, trunk, flexibility, balance, assistance, supervision, fatigue, and
exit. The migration does not edit `coaching.skill`: the five matching current
FIG/USAG V-sit and Manna skill-library cards retain their formal proficiency
levels, while all three exercise definitions use only complexity and physical
difficulty.

All eight new or reassessed exercise variants derive overall difficulty as the
maximum of complexity and physical difficulty. All 15 selected videos returned
current YouTube oEmbed metadata and an embed-player response. Exact identity and
variant match, complete viewing, captions, cue and safety quality, reviewer
identity, and approval remain unset. No candidate was approved.

The thirty-third source-registry batch resolves the final order-sensitive
box/depth sequence cluster:

- Depth Drop to Box Jump: 16 evidence sections, three videos, 11 alternates;
- Box Jump to Depth Drop: 16 evidence sections, four videos, 10 alternates.

Migration `315_coaching_depth_box_order_identity_consolidation.sql` consolidates
`Depth Jump to Box Jump` into the depth-first survivor and `Box Jump with
Altitude Landing` into the box-first survivor. It does not merge the two
survivors: drop box to floor to immediate target-box jump is a reactive
depth-first task, while floor to box, stabilization, deliberate step-off, and
held floor landing is a box-first power-and-landing sequence. Source mappings,
aliases, candidate media, variants, delivery profiles, and provenance remain
traceable.

Migration `316_coaching_depth_box_order_family_completion.sql` adds exact
ordered contacts, controlled taxonomy, anatomy and biomechanics, constraints,
dosage, fatigue and impact budgets, baseline and hands-on-hips scores, two
contextual profiles per variant, instructions, quality gates, stop rules, and
candidate-only graph relationships. Overall difficulty is the maximum of
exercise complexity and physical difficulty; neither survivor has an
exercise-card skill level.

All seven selected links returned successful current YouTube oEmbed responses.
This proves current link availability and an embed-player response only.
Exact sequence and version match, full viewing, demonstration quality,
captions, accessibility, reviewer identity, and approval remain human gates.
Two box-first candidates may demonstrate only the terminal landing and remain
explicitly quarantined until full review. No candidate was approved.

The thirty-fourth source-registry batch resolves the kneeling medicine-ball
chest-pass family:

- Kneeling Medicine Ball Chest Pass: 16 evidence sections, five videos, 12
  alternates, and four exact variant score proposals.

Migration `317_coaching_kneeling_chest_pass_identity_consolidation.sql`
consolidates `Tall-Kneeling Medicine Ball Chest Pass`, `Tall-Kneeling Chest Pass
to Wall`, and `Half-Kneeling Chest Pass to Wall` into the stable broad
`Kneeling Medicine Ball Chest Pass` identity. All five legacy source mappings
and historical aliases remain traceable. The two generic kneeling sources do
not declare tall versus half kneeling or throw-only versus rebound-and-catch,
so their source variants and profiles remain archived and nonselectable rather
than being assigned by inference.

Migration `318_coaching_kneeling_chest_pass_family_completion.sql` creates
tall-kneeling throw-only, tall-kneeling rebound-and-catch, half-kneeling
throw-only, and half-kneeling rebound-and-catch variants. Exercise complexity
and physical difficulty are assessed separately at `34/38`, `42/42`, `42/38`,
and `48/42`; overall is mechanically `38`, `42`, `42`, and `48`. Ball mass,
type, target, distance, lead leg, wall or partner, and return contract are
explicit generation inputs. The card also includes anatomy and joint actions,
load and fatigue budgets, constraints, output and technique dosage, timing,
measurement, substitutions, coach and athlete instruction, accessibility,
support operations, quality gates, and stop rules.

All five links returned successful current YouTube oEmbed responses. That
records current link and embed-player availability only. Complete viewing,
exact stance-and-return match, demonstration and safety quality, captions,
accessibility, reviewer identity, and approval remain unresolved. All six graph
edges and 12 calibration proposals remain in `review`, and the card remains
quarantined. No media, relationship, calibration, publication, or exercise-card
proficiency approval was created.

The thirty-fifth source-registry batch resolves the standing medicine-ball
rotational wall-throw family:

- Medicine Ball Rotational Throw: 16 evidence sections, five videos, 12
  alternates, and two exact return-contract score proposals.

Migration `319_coaching_rotational_wall_throw_identity_consolidation.sql`
consolidates `Medicine Ball Rotational Wall Throw` into the stable broad
`Medicine Ball Rotational Throw` identity. Both source descriptions retain the
same standing two-hand rotational projection into a wall; naming the target
does not create another primary action. Neither source states whether the ball
must be retrieved or caught, so both legacy variants and their profiles remain
archived and nonselectable rather than being assigned by inference.

Migration `320_coaching_rotational_wall_throw_family_completion.sql` creates an
athletic-stance wall throw-and-retrieve variant and an athletic-stance
predictable-rebound-and-catch variant. Exercise complexity and physical
difficulty are assessed separately at `42/46` and `50/48`; overall is
mechanically `46` and `50`. Side, ball mass and rebound type, wall, distance,
target, pivot space, flight and return lanes, collection procedure, dosage,
timing, measurement, fatigue budgets, and stop rules are explicit generation
inputs. Migration `321_coaching_rotational_wall_throw_equipment_taxonomy.sql`
then maps the card to controlled `medicine_ball`, `wall`, `line_tape`, `timer`,
and `mirror` keys while preserving descriptive setup requirements in contextual
fields.

All five links returned successful current YouTube oEmbed metadata. This records
link and embed-player availability only. Full viewing, exact stance and return
match, demonstration and safety quality, captions, accessibility, reviewer
identity, and approval remain unresolved. Both graph edges and all six
calibration proposals remain in `review`; the card remains quarantined. No
media, relationship, calibration, publication, or exercise-card proficiency
approval was created.

The thirty-sixth source-registry batch resolves the shuffle-to-rotational
medicine-ball throw family:

- Shuffle-to-Rotational Medicine Ball Throw: 16 evidence sections, five videos,
  12 alternates, and two exact return-contract score proposals.

Migration
`322_coaching_shuffle_rotational_throw_identity_consolidation.sql` consolidates
`Med Ball Shuffle-to-Rotation Throw` into the stable
`Shuffle-to-Rotational Medicine Ball Throw` identity. The cards share the same
lateral shuffle or crow-hop, controlled plant, whole-body rotational two-hand
projection, and balanced finish. Their different word order and historical
40-versus-50 seed scores do not define different primary movements. Both
legacy variants remain archived and nonselectable because neither source fixes
throw-only versus rebound-and-catch delivery.

Migration `323_coaching_shuffle_rotational_throw_family_completion.sql` creates
lateral-shuffle wall throw-and-retrieve and predictable-rebound-and-catch
variants. Exercise complexity and physical difficulty are assessed separately
at `56/52` and `64/54`; overall is mechanically `56` and `64`. Approach and
throw side, shuffle count and distance, plant zone, planned or reactive cue,
ball, wall, target, return contract, dosage, rest, timing, output measurement,
cumulative lateral-contact and rotational-throw budgets, substitutions,
accessibility, support prompts, and stop rules are explicit. The migration
creates four contextual profiles, four review-only graph edges, and six
review-only calibration proposals.

All five links returned successful current YouTube oEmbed metadata. This proves
current title/channel and embed-player availability only. Full viewing, exact
approach and return-contract match, demonstration and safety quality, captions,
accessibility, reviewer identity, and approval remain unresolved. The card
remains quarantined, and no media, relationship, calibration, publication, or
exercise-card proficiency approval was created.

The thirty-seventh source-registry batch resolves the box-jump-to-single-leg-
landing family:

- Box Jump to Single-Leg Landing: 16 evidence sections, five videos, 12
  alternates, and two exact takeoff-contract score proposals.

Migration
`324_coaching_box_jump_single_leg_landing_identity_consolidation.sql`
consolidates `Single-Leg Box Jump to Single-Leg Landing` into the stable
`standing-box-jump-to-single-leg-landing` definition. A single-leg landing is
the terminal action; takeoff laterality is an exact variant dimension.
Migration `325_coaching_box_jump_single_leg_landing_family_completion.sql`
creates bilateral-takeoff and same-leg-unilateral-takeoff variants. Exercise
complexity and physical difficulty are `62/60` and `74/72`; overall is
mechanically `62` and `74`.

All five candidate links returned current YouTube oEmbed metadata. This records
only title/channel and embed-player availability. Full viewing, exact takeoff
and landing match, demonstration and safety quality, captions, accessibility,
reviewer identity, and approval remain unresolved. Four graph edges and six
calibration proposals remain in `review`; the card remains quarantined.

The thirty-eighth source-registry batch resolves the single-leg lateral-hop-to-
stick family:

- Single-Leg Lateral Hop to Stick: 16 evidence sections, five videos, 12
  alternates, and two exact output-contract score proposals.

Migration
`326_coaching_single_leg_lateral_hop_stick_identity_consolidation.sql`
consolidates `Lateral Line Hop to Single-Leg Stick` into the stable
`Single-Leg Lateral Hop to Stick` definition. A line is a target constraint;
the controlled single-leg stick is the terminal action. Continuous rebound
line hops remain separate. Migration
`327_coaching_single_leg_lateral_hop_stick_family_completion.sql` creates
low-amplitude-control and distance-output variants. Exercise complexity and
physical difficulty are `42/36` and `50/48`; overall is mechanically `42` and
`50`.

All five candidate links returned current YouTube oEmbed metadata. This records
only title/channel and embed-player availability. Full viewing, exact amplitude
and stick match, demonstration and safety quality, captions, accessibility,
reviewer identity, and approval remain unresolved. Four graph edges and six
calibration proposals remain in `review`; the card remains quarantined. Neither
batch assigns an exercise-card skill level or creates any approval.

The thirty-ninth source-registry batch resolves the bilateral
Romanian-deadlift family:

- Romanian Deadlift: 16 evidence sections, five videos, 12 alternates, and
  eight exact implement/tempo score proposals.

Migration
`330_coaching_romanian_deadlift_identity_consolidation.sql` consolidates
`Dumbbell Romanian Deadlift`, `Kettlebell Romanian Deadlift`, `Double
Kettlebell Romanian Deadlift`, `Sandbag Romanian Deadlift`, `Landmine Romanian
Deadlift`, and `Romanian Deadlift Eccentric` into the stable `Romanian
Deadlift` identity. Implement type and quantity, grip, mass distribution, free
or fixed load path, range, and tempo are exact variant dimensions. Single-leg
and staggered-stance RDLs, RDL-to-row, conventional-from-floor deadlifts, good
mornings, and ballistic swings remain distinct.

Migration `331_coaching_romanian_deadlift_family_completion.sql` creates
barbell, two-dumbbell, one-kettlebell, two-kettlebell, front-held-sandbag,
two-hand-landmine, slow-eccentric barbell, and slow-eccentric dumbbell
variants. Exercise complexity and physical difficulty are respectively
`42/58`, `38/48`, `36/42`, `40/52`, `40/50`, `42/54`, `48/60`, and `44/52`;
overall is mechanically `58`, `48`, `42`, `52`, `50`, `54`, `60`, and `52`.
The migration creates 16 contextual profiles, eight review-only graph edges,
and 24 review-only calibration proposals.

All five selected candidate links returned current YouTube oEmbed metadata.
This records title, channel, and current player availability only. Full
viewing, exact implement and tempo match, demonstration and safety quality,
captions, accessibility, reviewer identity, and approval remain unresolved.
The card remains quarantined, and no media, relationship, calibration,
publication, or exercise-card skill-level approval was created.

The fortieth source-registry batch resolves the front-foot-elevated
split-squat family:

- Front-Foot-Elevated Split Squat: 16 evidence sections, five videos, 12
  alternates, and six exact support/load score proposals.

Migration
`332_coaching_front_foot_elevated_split_squat_identity_consolidation.sql`
consolidates `Front-Foot-Elevated Dumbbell Split Squat` and
`Front-Foot-Elevated Sandbag Split Squat` into the stable
`Front-Foot-Elevated Split Squat` identity. All three sources retain a
stationary side-specific split stance, whole lead-foot platform support,
rear-foot floor contact, controlled descent, and lead-leg-biased ascent.
Implement, quantity, load position, support, load, range, platform height, and
tempo are exact variant or modifier dimensions. Rear-foot elevation,
heel-only elevation, stepping lunges, and jumping split squats remain
distinct.

Migration
`333_coaching_front_foot_elevated_split_squat_family_completion.sql` creates
unsupported bodyweight, supported bodyweight, bilateral suitcase-dumbbell,
contralateral single-dumbbell, ipsilateral single-dumbbell, and front-held
sandbag variants. Exercise complexity and physical difficulty are respectively
`38/32`, `32/28`, `42/50`, `46/44`, `44/44`, and `42/48`; overall is
mechanically `38`, `32`, `50`, `46`, `44`, and `48`. The migration creates 12
contextual profiles, ten review-only graph edges, and 18 review-only
calibration proposals.

All eight legacy candidates returned successful current oEmbed metadata. Five
were retained for the current card version; three clearly titled dumbbell
candidates, one sandbag Zercher candidate, and one unresolved front-rack family
candidate. Metadata establishes title, channel, and player availability only.
Full viewing, exact platform, stance, implement, load-position, range, tempo
and return match, demonstration and safety quality, captions, accessibility,
reviewer identity, and approval remain unresolved. The card remains
quarantined, and no media, relationship, calibration, publication, or
exercise-card skill-level approval was created.

## Data model

Migration `265_coaching_canonical_research_media_v1.sql` adds:

- `exercise_review_batch_v1` for resumable review batches;
- `exercise_section_evidence_v1` for version-bound claims and provenance;
- `exercise_media_candidate_v1` for three-to-five-video discovery and review;
- `exercise_alternate_assessment_v1` for new-card, variant, annotation,
  same-identity, and rejection decisions.

Migration `266_coaching_canonical_legacy_media_candidates_v1.sql` preserves up
to five distinct direct YouTube links from all legacy source cards attached to
each surviving identity. They are imported as `unverified` candidates with
their legacy exercise and media-field provenance. The migration does not
transfer or infer approval.

Database constraints prevent an approved video unless a reviewer, review time,
exact-version match, healthy link, allowed embedding, and demonstration-quality
score of at least 80 are present. Legacy `approved_video_url` values are
backfilled only as unverified candidates.

## Controlled evidence sections

`canonicalResearchReview.js` owns the list:

1. identity
2. taxonomy
3. anatomy
4. biomechanics
5. difficulty
6. load, fatigue, and recovery
7. equipment, environment, and population constraints
8. dosage
9. coach and athlete instructions
10. safety gates and stop rules
11. programming
12. athlete support
13. coach support
14. accessibility
15. alternate versions
16. media

Evidence records require an HTTPS source, controlled source kind, at least one
specific claim, and a 1–100 evidence-quality score. A complete candidate packet
is ready for human review. It is not ready for publication until every section
is reviewed, every alternate is reviewed or approved, and all three to five
videos pass the media approval gate.

## Resumable workflow

Export the least-complete active cards:

```sh
DATABASE_URL=... DATABASE_SSL=false \
  npm --prefix backend run export:canonical-research-queue -- \
  --facility=1 --limit=100 --offset=0
```

Validate a packet without writing:

```sh
npm --prefix backend run import:canonical-research -- \
  --file=/absolute/path/to/card.v1.json
```

Import it as candidate-only data:

```sh
DATABASE_URL=... DATABASE_SSL=false \
  npm --prefix backend run import:canonical-research -- \
  --file=/absolute/path/to/card.v1.json --write
```

The importer treats a validated packet as the current candidate set: in one
transaction it supersedes stale candidate-only evidence, media, and alternate
records, then writes the packet as `candidate`. If any current-version record
has already been shortlisted, reviewed, approved, or rejected, the entire
import fails without changing data. It never overwrites human review and cannot
be used to fabricate approval.

Build a family batch from the versioned source registry and batch specification:

```sh
DATABASE_URL=... DATABASE_SSL=false \
  npm --prefix backend run build:canonical-research-batch -- \
  --file=/absolute/path/to/scripts/data/canonical-research/batches/acceleration-starts.v1.json \
  --write
```

The batch specification must provide a stable `snapshotAt`. The builder reads
the current card version. A card specification may include three to five
manually discovered direct YouTube candidates; these remain `unverified` and
carry no embedding, exact-match, or quality claim. Otherwise the builder uses
only database candidates whose current state is both `healthy` and embeddable.
It validates every generated packet and writes a manifest. Generated packets
remain candidate proposals.

## Coach review API

The authenticated coach API exposes the same facility-scoped, current-version
workflow:

- `GET /api/coach/canonical/research-queue`
- `GET /api/coach/canonical/cards/:id/research-review`
- `POST /api/coach/canonical/cards/:id/research/evidence/:evidenceId/review`
- `POST /api/coach/canonical/cards/:id/research/media/:mediaCandidateId/review`
- `POST /api/coach/canonical/cards/:id/research/alternates/:alternateAssessmentId/review`

Read routes require `library.view`; review mutations require `library.manage`.
Every mutation binds the facility, active definition, expected card version,
record ID, reviewer ID, and controlled decision. Stale card-version and
cross-facility requests fail closed. Media approval also requires a healthy
link, explicit embedding permission, exact-version match, and demonstration
quality of at least 80; approved media is scheduled for re-review after 90
days.

## YouTube candidate discovery

The YouTube Data API worker searches cards with fewer than three current
candidates, confirms that returned videos are public and API-embeddable, ranks
title relevance, and writes at most five candidates:

```sh
YOUTUBE_API_KEY=... DATABASE_URL=... DATABASE_SSL=false \
  npm --prefix backend run discover:canonical-youtube -- \
  --facility=1 --limit=10
```

Add `--write` only after inspecting the dry-run output. The worker uses one
`search.list` and one `videos.list` call per processed card, limits each run to
25 cards, and resumes from database coverage. API availability and embedding
checks do not establish an exact exercise/version match or safe,
high-quality instruction. Those fields remain pending human review.

Existing candidates can be checked against YouTube's official oEmbed endpoint:

```sh
DATABASE_URL=... DATABASE_SSL=false \
  npm --prefix backend run hydrate:canonical-youtube-oembed -- \
  --facility=1 --slugs=2-point-acceleration-start,3-point-start-10-20m \
  --limit=30
```

Add `--write` only after inspecting the dry run. A successful oEmbed response
records the returned title/channel and current embed availability, but never
sets exact-version match, demonstration quality, reviewer identity, or review
approval. Importing a packet deliberately resets link verification, so oEmbed
must be rerun after import if current availability is required.

## Short-acceleration tranche (migrations 419–421)

Twenty audited legacy sources now resolve to one stable Short Acceleration
Sprint definition. Standing, two-point, three-point, falling, half-kneeling,
and one standardized auditory go-signal are exact start variants. Distance,
units, cones, lead side, intent, recovery, and run-out remain contextual dosage.
The walk-in and longer build-up entries remain nonselectable until a human
authors their exact ordered contracts.

The candidate packet stores 24 unique evidence rows across all 16 controlled
sections, four direct YouTube candidates, 37 alternate decisions, eight
complexity/physical-difficulty assessments, eight delivery profiles, 14 graph
proposals, 16 calibration proposals, and one automated card packet. All media
remain unverified, non-embeddable, without an exact-match decision, and without
a reviewer. Every relationship, calibration, source score, and card remains in
review or quarantine.

The post-consolidation identity audit also distinguishes hill acceleration,
deceleration/re-acceleration, and live multi-gate choice reaction from a level
single short acceleration. These are deterministic identity classifications,
not human approvals. Athlete experience remains selection context only;
exercise-card difficulty is complexity plus physical difficulty with overall
derived as their maximum.

## Hill Sprint Acceleration tranche (migration 422)

Legacy Low-Incline Hill Sprint Acceleration and Hill Sprint Acceleration remain
one stable incline-resisted acceleration identity. The current candidate card
requires one explicit start variant, a measured and declared uniform positive
grade that preserves sprint gait, a marked traction-safe lane, a visible
finish, a safe summit run-out, and a separate controlled non-sprinted walk-back.
The exact selectable starts are static two-point and controlled falling start.

The card does not claim one universal grade or that uphill sprinting is
superior to equal-volume level sprinting. Grade, distance, unit, markers, lead
side, timing, intent, effort count, recovery, surface, and footwear remain
delivery variables. Steep grinding, long hill conditioning, stairs, incline
treadmill work, external sled or band resistance, downhill overspeed, uphill
bounding, shuttles, and sprinted descents require separate cards or human
authorship.

The version-2 packet contains all 16 controlled evidence sections, three public
YouTube discovery candidates, seven alternate assessments, two contextual
delivery profiles, four graph proposals, four calibration proposals, two
queued source-score packets, and one automated test packet. Media remain
`unverified`, non-embeddable, without exact-match or quality scores and without
a reviewer. Difficulty remains exercise complexity plus physical difficulty:
52/72/72 for two-point and 56/72/72 for falling start. Athlete proficiency is
not stored anywhere on the exercise card.

Disposable PostgreSQL recorded checksum `1254677506`; direct and production
runner re-entry passed, and an `in_review` sentinel proved protected state fails
closed. These checks establish migration integrity, not human content,
relationship, calibration, media, pilot, or publication approval.

## Quality reporting

`buildCanonicalDataQualityReport` reports active definitions only and separates:

- complete candidate research packets from fully reviewed packets;
- candidate-section coverage from reviewed-section coverage;
- cards with three to five raw candidates, currently embeddable candidates, and
  approvals as separate measures;
- candidate alternate assessments from reviewed assessments.

As of the post-migration-333 current-version audit and candidate-only legacy
media backfill in disposable PostgreSQL:

- active cards: 1,531;
- exact direct identity collisions: 0;
- candidate-complete research cards: 8 (0.52%), containing 128 current-version
  section decisions, with all candidate evidence still awaiting review;
  older version-bound research
  remains retained for provenance rather than counted as current;
- reviewed research cards: 0;
- cards with three to five candidate videos: 1,165 (76.09%);
- cards with three to five currently healthy and embeddable candidates: 8
  (0.52%);
- cards with no direct video candidate: 356;
- cards with three to five approved videos: 0;
- candidate alternate assessments: 8 cards (0.52%), containing 96 current
  alternate decisions;
- reviewed alternate assessments: 0.

These figures are progress counters, not production-readiness claims.

## Required human review

Content reviewers must compare each claim with its source, reassess every
assigned card value, and either accept, edit, reject, or supersede the evidence.
Media reviewers must watch the entire video, confirm the exact exercise and
version, check cueing and stop rules, verify captions and accessibility,
re-check embedding, and record reviewer identity. Alternate assessments must
create the proposed definition or variant only after identity review.

Publication remains quarantined until these gates and the existing canonical
card, relationship, calibration, and workout-validation gates all pass.

## 180-degree wall-ball identity resolution (migration 423)

Legacy source 1284 remains the stable
`180-turn-wall-ball-catch-and-throw` identity, but it is now an explicit
nonselectable quarantine. Its source permits either receiving or picking up an
unspecified ball before an unnamed wall throw, so sequence, ball, delivery,
catch requirement, throw pattern, target, rebound, miss zone, reset, and valid
terminal outcome cannot be inferred safely.

A separate review-only card,
`through-legs-wall-throw-180-turn-catch`, records the exact Karlsruhe Institute
of Technology protocol: direct through-the-legs throw to a smooth wall,
grounded 180-degree turn, visual reacquisition, and controlled two-hand rebound
catch. The exact card has a standardized 3 m / ten-attempt assessment variant
and a clearly non-normative scaled rehearsal variant. Difficulty is 68
complexity / 30 physical / 68 overall for the assessment and 58 / 22 / 58 for
the rehearsal. These are candidate exercise scores, not athlete skill or
proficiency levels.

The tranche stores 16 candidate evidence sections, three adjacent-component
YouTube discovery links, six alternate assessments, three delivery profiles,
two review-only relationship proposals, six review-only calibration proposals,
one queued legacy source score, and two quarantined automated card packets.
No exact full-sequence YouTube demonstration was located. Every link remains
unverified, non-embeddable, without an exact-match decision, quality score,
reviewer, or approval.

The migration also records a deterministic distinct-identity boundary between
the ambiguous legacy catch-or-pick-up/throw composite and the exact
throw-turn-catch protocol. This closes their generated similarity pair without
claiming human approval and refuses to overwrite any human-reviewed card,
identity, media, relationship, calibration, or score state.

## Landmine Arc identity resolution (migration 424)

Migration 424 removes a mixed-lineage exercise identity. Legacy source 1413,
named `one-arm-landmine-arc-press`, describes an ordinary unilateral fixed
diagonal Landmine Press and is mapped to `landmine-press`. Legacy source 1414
uses the same movement contract with eccentric emphasis and is mapped to that
same definition with eccentric tempo retained as a delivery modifier. The old
mixed card is archived; neither legacy row is treated as the two-hand arc.

The new review-only `two-hand-landmine-shoulder-to-shoulder-arc-press` card is
the bilateral task in which both hands control the landmine end from one
shoulder, through a continuous high arc, to the opposite shoulder. Tall- and
half-kneeling starts are exact selectable variants. Standing, unilateral
presses, push presses or throws, and rotational landmine rainbows remain
separate definitions or unresolved proposals. One repetition is one complete
one-way shoulder-to-opposite-shoulder crossing; the card does not silently
double it into an out-and-back cycle.

The packet contains all 16 candidate evidence sections, five YouTube
candidates whose oEmbed availability and embedding were checked
programmatically, eight alternate assessments, four contextual delivery
profiles, two review-only graph proposals, four review-only calibration
proposals, and one quarantined automated test packet. Programmatic link health
does not establish exercise identity or demonstration quality. Exact-match,
reviewer, quality, approval, and publication fields remain unset.

Tall-kneeling difficulty is 52 complexity / 48 physical / 52 derived overall;
half-kneeling difficulty is 54 / 48 / 54. These are exercise-complexity and
physical-difficulty assessments only. Athlete skill level or proficiency is
not stored on the exercise card.

Disposable PostgreSQL recorded checksum `2520926649`; direct execution,
idempotent re-entry, and the production runner passed. A transaction-scoped
published-card sentinel made the migration fail closed and rolled back. The
card audit now fails only the deliberate human gates for exact-match media,
approved graph relationships, approved calibration, and publication.

## Ankling Pogo retirement and wall-lean variant (migration 425)

Migration 425 retires `ankling-pogo-hop` and `wall-ankling-pogo` as
nonprescribable legacy labels. Source 947 describes generic low-amplitude pogo
work but does not declare support, laterality, displacement, ordered contacts,
dose unit, or finish. Source 1085 adds wall pressure and stacked posture but
still does not say whether contacts are bilateral, alternating, or repeated on
one leg. Both source rows remain traceable to their archived cards and are not
silently mapped to an exact exercise.

The exact wall-lean option is instead a new review-only variant on the existing
`single-leg-pogo` definition. Two hands press an immovable wall or rated rack,
the athlete maintains a declared forward body line, one declared leg performs
the repeated low-amplitude contacts, the opposite thigh holds its prescribed
recovery position, every landing is one contact, and sides change only after a
controlled two-foot reset. Light balance support, alternating wall contacts,
wall marches, wall switches, traveling ankling, and bilateral pogos remain
separate variants or definitions.

The version-3 research packet contains all 16 evidence sections, five current
YouTube oEmbed-healthy and embeddable candidates, nine alternate assessments,
two contextual delivery profiles, one review-only contextual-substitution
edge, two review-only calibration proposals, and a quarantined automated card
packet. One candidate received automated visual inspection of the same-leg
contact pattern; no candidate has an exact-match decision, quality score,
human reviewer, or approval.

Wall-lean variant difficulty is 48 exercise complexity / 52 physical
difficulty / 52 derived overall. No athlete proficiency classification is
stored. Disposable PostgreSQL recorded checksum `4272711159`; direct
execution, clean re-entry, the production runner, and a rollback-only
published-card sentinel passed.

## Opposite-leg bound direction identities (migration 426)

The generic `bound-to-stick` and `lateral-bound` labels now retain their stable
slugs but declare exact movement contracts. The forward card projects from one
leg to the opposite leg in a forward lane; the lateral card crosses from one
leg to the opposite leg in a lateral lane. Both end in a declared stable hold
and full reset. Direction, landing side, and terminal action are identity
fields, not athlete skill classifications.

The research packet uses alternate-leg bounding guidance, direction-specific
jump-landing and single-leg-landing biomechanics, and unilateral plyometric
stabilization evidence. Every claim is scoped to what its source supports; the
card does not infer exact force thresholds, injury prediction, or automatic
sport transfer. Forward difficulty is 56 exercise complexity / 64 physical
difficulty / 64 derived overall. Lateral difficulty is 60 / 66 / 66.

Each card has 16 candidate evidence sections, five candidate YouTube links,
nine alternate assessments, two delivery profiles, one review-only
substitution edge, two review-only calibration proposals, and a quarantined
test packet. Automated oEmbed availability does not establish exact movement
match or demonstration quality. Full playback, exact contact order, cueing,
safety, captions, accessibility, reviewer identity, and every approval remain
human work.

Migration 426 also records the researched forward-versus-lateral boundary and
the adjacent forward-versus-diagonal, forward-versus-rotational, and opposite-
leg-lateral-versus-same-leg-lateral boundaries as distinct exercises. It
refuses to overwrite published or human-reviewed state. Disposable PostgreSQL
recorded checksum `1732038496`; direct execution, clean re-entry, the
production runner, and rollback-only protected-state testing passed.

## Line-hop and overhead-press identity work (migrations 428–430)

The single-leg line-hop research packet does not convert a vague label into an
exercise. Direction, line relationship, takeoff and landing legs, contact
count, terminal action, and repetition boundary are absent from the source, so
the card is archived without a difficulty score or delivery profile. Its media
links remain adjacent candidates and cannot establish the missing contract.

The overhead-press eccentric packet distinguishes a tempo modifier from an
exercise identity. The retired source permits standing or seated execution and
does not declare grip, support, how the overhead position is regained, pickup,
set-down, or a complete repetition. Separate standing and seated survivors
therefore receive exact active-press-and-controlled-return variants; no direct
source mapping is claimed. Research on eccentric resistance training supports
tempo and recovery considerations but does not approve a particular card,
score, or video.

The kettlebell packet likewise preserves uncertainty. The source family says a
stance or kneeling base and mixes generic and explicit double-kettlebell
lineage. It is archived without direct consolidation. The standing survivor
receives a newly authored review-only variant requiring two matched
kettlebells, a bilateral front rack, no deliberate leg drive, independent
paths, an owned overhead finish, controlled return, and declared clean or
handoff and set-down operations.

Each current packet contains all 16 evidence sections and candidate alternate
assessments. Media health was checked through YouTube oEmbed where stated, but
exact exercise matching, full-playback cue and safety review, captions,
accessibility, quality scoring, reviewer identity, and approval remain unset.
Graph and calibration rows are review proposals only. Difficulty comprises
exercise complexity and physical difficulty with derived maximum overall;
athlete proficiency is not an exercise-card field.

Disposable PostgreSQL records checksums `4051154404`, `989893497`, and
`3711801288`. The current audit reports 33 unresolved similarity pairs and no
exact collision. That count is a triage queue, not permission to guess missing
identity facts; unresolved sources must be quarantined or resolved from
authoritative evidence before consolidation.

## Direction-specific line-pogo completion (migration 431)

The research batch distinguishes two executable bilateral pogo tasks. The
lateral card requires simultaneous two-foot contacts crossing a visible line
side to side; the forward-back card crosses the line in the sagittal direction.
Both keep amplitude low, count every bilateral landing as one contact, maintain
repeatable rhythm and alignment, and finish under two-foot control. Direction,
plane-specific control, foot count, contact strategy, contact unit, and finish
cannot be silently converted into dosage modifiers.

The batch uses research on reactive-strength-index plyometric outcomes,
direction-dependent landing stability, hopping contact-time and stiffness
relationships, field contact/flight-time stiffness measurement, and age- and
volume-sensitive plyometric programming. These sources support mechanics,
measurement, dosage caution, and score rationale; they do not validate the
exact authored exercise, prove injury prevention, approve a difficulty score,
or approve media.

The generic `line-pogo-hops`, `line-hops`, and `forward-back-line-hops` labels
remain incomplete source identities. The first does not choose a direction or
complete contact contract, the second also omits foot count and strategy, and
the third declares direction but not bilateral versus unilateral contacts,
mandatory crossing, pogo versus brake-and-pop strategy, dose unit, cadence, or
finish. Each is archived without mapping and retains a human-review path.

The five packets contain all 16 evidence sections per card, 19 oEmbed-healthy
candidate videos, and 37 alternate assessments. The two exact cards have five
candidate links and eight alternates each; each archived source has three links
and seven alternates. Automated availability and title checks are not exact-
match review. Full playback, movement contract, cues, safety, captions,
accessibility, reviewer identity, and approval remain outstanding.

The exact cards add two contextual profiles each, bidirectional review-only
direction-changing substitution proposals, and four review-only score anchors.
Lateral scoring is 44 exercise complexity / 48 physical difficulty / 48
derived overall; forward-back is 46 / 48 / 48. Undefined sources are not
scored. No exercise-card skill or proficiency level is stored.

Disposable PostgreSQL passed direct application, repeated deterministic re-
entry, production-runner registration, rationale-idempotency inspection, and a
rollback-only simulated-approval sentinel. Migration 431 is registered with
checksum `3118654911`. The active queue now contains 30 unresolved pairs and no
exact collision or score-85-or-higher pair. Canonical publication, media,
relationships, calibration, and pilot readiness remain quarantined for human
review.

## Quarter-turn jump/hop identity resolution (migration 432)

The old 90-degree hop and jump-turn sources do not contain enough information
to distinguish bilateral from unilateral takeoff and landing, same-leg from
opposite-leg landing, minimal from horizontal displacement, or a terminal
stick from another exit. They are research evidence about ambiguous labels,
not executable exercise identities, and remain archived without direct mapping.

The authored bilateral card fixes two-foot takeoff and landing, a stationary
start, exactly 90 degrees of aerial turn, minimal horizontal displacement,
declared turn direction, controlled stick, and full reset. The authored
unilateral card fixes one declared takeoff leg, same-leg landing, the same
quarter-turn and terminal contract, and side accounting by leg and direction.
Changing foot support, landing leg, rotation magnitude, approach, displacement,
obstacle, contact count, or terminal action requires identity review; changing
height, attempts, hold, rest, start orientation, or turn direction can be a
delivery modifier only while the exact identity contract remains intact.

The research rationale uses primary literature on unilateral versus bilateral
landing biomechanics, whole-body mid-flight rotation and landing, entry-angle
effects on landing mechanics, unilateral plyometric training, landing feedback,
reactive-strength measurement, and direction-specific single-leg tasks. Those
sources support the mechanics, dosage caution, fatigue/impact accounting, and
difficulty rationale. They do not validate Vortex's exact authored cards,
establish a universal safe dose, approve a score, prove injury prevention, or
approve any video.

Each exact card has five YouTube candidates and eight alternate assessments;
each archived source has three candidates and seven alternates. All 16 links
were availability- and embed-checked through oEmbed when the packet was built.
That automation does not establish exact movement match or demonstration
quality. Full playback, foot sequence, rotation, displacement, landing, cues,
safety, captions, accessibility, reviewer identity, and approval remain human
work. The two exact cards also have four review-only delivery profiles in
total, bidirectional review-only progression/regression proposals, four
review-only score anchors, and quarantined automated test packets.

The resulting whole-library queue has 29 unresolved similarity pairs, zero
exact collision, and no unresolved score at 85 or higher. Migration 432's nine
deterministic boundary decisions are identity-only. Canonical publication,
media approval, graph approval, independent difficulty calibration, coach
pilot evidence, and rollout remain blocked until qualified reviewers complete
their gates. Exercise difficulty is complexity plus physical difficulty with
overall derived as their maximum; athlete skill/proficiency remains a separate
skill-library concept.

## Forward and rotational scoop-toss identity completion (migration 433)

The focused batch preserves two exact movement contracts. The forward card is
a stationary front-facing parallel-stance, two-hand underhand free-flight toss
from a low start with no prescribed step, intentional jump, catch, or rebound.
The rotational scoop is a release variant under the existing two-hand standing
rotational-throw definition: it starts side-on with the ball low near the back
hip, uses a controlled ground-up pivot, targets an inspected wall, finishes
without a required catch, resets, and records dose by side. Forward complexity
/ physical / overall difficulty is 50 / 32 / 50; rotational is 58 / 34 / 58.
Overall is the maximum of exercise complexity and physical difficulty. Athlete
skill or proficiency is not exercise-card metadata.

The old countermovement source is not executable evidence. Its wording omits
the facts needed to choose forward versus rotational projection and therefore
remains archived, unscored, and explicitly unresolved. Migration 433 records a
forward-versus-rotational distinct boundary, preserves the old source review
queue, and adds a second review-required source-versus-rotational boundary. It
does not resurrect the rotational scoop as a duplicate definition.

The primary literature and professional sources support standardized throw
protocols, position- and direction-specific mechanics, measured-output
reliability, trunk demand, low-repetition explosive intent, and controlled
space and equipment. They do not validate the exact Vortex-authored contracts,
approve the proposed scores, establish universal load or fatigue thresholds,
prove injury prevention, or approve media.

The generated batch contains 16 candidate evidence sections per card, five
candidate videos and eight alternate assessments per exact card, and three
adjacent videos plus seven alternates for the archived source. All 13 links
were oEmbed-healthy and embeddable when checked. Full playback, exact movement,
instruction quality, safety, captions, accessibility, reviewer identity, and
approval remain human work. Four contextual profiles, two lateral-substitution
proposals, four score anchors, and three automated card packets also remain in
review or quarantine.

The resulting whole-library queue has 28 unresolved similarity pairs, zero
exact collisions, and no unresolved score at 85 or higher. Publication, exact-
match media review, graph approval, independent score calibration, accessible
member comprehension testing, coach pilot evidence, and staged rollout remain
blocked until qualified reviewers complete their gates.

## Lateral low-hurdle clearance research completion (migration 434)

The research batch separates obstacle identity from support identity. A raised
low hurdle is not a cosmetic annotation on a ground-only jump or hop: it adds a
minimum clearance path, trip exposure, equipment inspection, landing-location
requirements, lane control, and different failure consequences. Bilateral and
same-leg support are also not difficulty labels; they change takeoff and
landing mechanics, load distribution, laterality, side accounting, and
readiness. They therefore receive separate exact definitions.

The evidence set uses primary research on unilateral versus bilateral landing
biomechanics, hurdle-jump training specificity, hurdle-height effects, and
standardized landing assessment, plus professional instruction for lateral
jumping and YouTube's own embedding documentation. These sources support the
identity boundaries, anatomy, constraints, load and fatigue tracking, dosage
caution, observable quality gates, and score rationale. They do not approve
Vortex's authored cards, scores, doses, universal hurdle heights, injury-
prevention claims, or media.

The ambiguous source remains archived and unscored. It may map to the exact
bilateral or same-leg card only if authoritative source evidence supplies the
missing takeoff and landing support, obstacle dimensions, contact count,
landing zone, hold, exit, and reset. The older generic
`low-hurdle-hop-to-stick` likewise remains in human review against both exact
lateral cards because its projection direction and foot contract are absent.
This quarantine is intentional and is not a backlog permission to guess.

The generated three-card packet contains all 16 candidate evidence sections
per card, five oEmbed-healthy title-level candidates per exact card, three
adjacent candidates for the source, and 25 alternate assessments. Automated
availability establishes only link and embed health. Full playback, exact
movement contract, instruction quality, safety, captions, accessibility,
reviewer identity, and media approval remain required. Four calibration rows
and six progression/regression rows remain review-only.

Difficulty is 48 complexity / 44 physical / 48 overall for the bilateral task
and 60 / 52 / 60 for the same-leg task; overall is the maximum of the two
exercise dimensions. Athlete skill or proficiency is not exercise metadata.
Disposable PostgreSQL verifies zero non-null legacy exercise skill levels and
zero non-null exercise-safety minimum-skill levels. Skill levels remain solely
in the skill-card library.

The final queue has 29 unresolved similarity pairs, zero exact collision, and
no score-85-or-higher unresolved pair. Canonical publication, human media
review, approved relationship depth, independent difficulty calibration,
accessible member comprehension testing, coach pilot evidence, and staged
rollout remain blocked until qualified reviewers complete those gates.

## Rotational bound and broad-jump identity completion (migrations 435–436)

The focused research distinguishes support, displacement, turn angle, and
terminal state as identity-bearing facts. An opposite-leg rotational bound is
one declared-leg takeoff followed by an opposite-leg landing. A bilateral
rotational broad jump uses simultaneous two-foot takeoff and landing plus
purposeful horizontal displacement. A bilateral quarter-turn jump in place
shares a 90-degree finish but requires minimal displacement. A half-turn card
names 180 degrees and therefore cannot be treated as a quarter-turn alternate.
These changes are movement definitions, not athlete-level classifications.

The exact opposite-leg card fixes one stationary forward-diagonal flight, a
90-degree whole-body turn, rotated landing target, terminal single-leg hold,
safe exit, and full reset. The exact bilateral card fixes the same angle and
terminal state with a two-foot broad-jump support contract. Their proposed
complexity / physical / overall scores are 68 / 66 / 68 and 64 / 60 / 64.
Overall is derived as the maximum. The two vague legacy sources remain
archived, unscored, and unresolved against all plausible exact mappings.

The evidence set uses primary research on mid-flight whole-body rotation,
rotational versus straight landings, unilateral versus bilateral landings,
direction- and load-dependent single-leg jump landings, jump-entry angle, and
standing broad-jump target control. These sources support the mechanical
boundaries, anatomy, measurement, dosage caution, impact and fatigue tracking,
and score rationale. They do not validate Vortex's exact authored exercises,
approve a score or dose, establish universal safety thresholds, prove injury
prevention, or approve media.

The generated four-card packet has all 16 candidate evidence sections per
card. Each exact card has five current oEmbed-healthy title-level candidates
and nine alternate assessments; each archived source has three adjacent
candidates and seven alternates. Automated oEmbed checks establish link and
iframe availability only. Full playback must verify support, 90-degree angle,
projection, body orientation, contacts, landing, hold, reset, instruction
quality, safety, captions, accessibility, reviewer identity, and demonstration
quality before any candidate can be approved.

Four contextual profiles cover high-quality Output and submaximal Movement
Intelligence delivery. Six progression/regression proposals and four score
anchors remain review-only. Generation support requires exact variant/profile
selection, marked start and finish headings, clear flight/fall/exit space,
side and direction balance, complete attempt/contact accounting, cumulative
impact and technical-fatigue budgets, duration recalculation after every
substitution, validation of replacement identity and logistics, persisted
substitution rationale, and separate coach/athlete rendering.

The final queue has 28 unresolved pairs, zero exact collisions, and no
unresolved score at 85 or higher. The remaining work is deliberately human-
gated: full media review, independent score calibration, graph review,
accessible-member comprehension testing, card approval, a real coach pilot,
published phase depth, and staged rollout. Exercise cards remain free of skill
or proficiency levels; those classifications remain solely in the skill-card
library.

## Single-leg hop and pogo review packet and final queue closure (migrations 437–440)

The focused hop research treats projection direction, support leg, flight and
contact count, intermediate rebound policy, terminal contact, exit, and reset as
identity-bearing facts. Vertical and horizontal single-leg hops are not aliases:
their projection and landing demands differ. A one-flight hop-to-stick is also
not a repeated pogo, and a repeated pogo with a declared final same-leg hold is
not the same delivery as one that exits under control without a terminal stick.

Migration 437 therefore authors exact review candidates for stationary
same-leg vertical and forward hop-to-stick work and an exact terminal-stick
pogo variant. Its five-card batch has all 16 evidence sections per card, 21
candidate links, 35 alternate assessments, eight contextual profiles, ten
relationship proposals, eight score proposals, and five automated quarantine
packets. Current links passed YouTube oEmbed availability when checked; that
does not establish full playback, exact movement match, cue accuracy, safety,
captions, accessibility, or demonstration quality. Every such field and every
reviewer/approval field remains unset.

Migrations 438 and 439 use the accumulated source audits to close the remaining
similarity queue. Exact mechanics are recorded as distinct only when both
contracts supply the differing fact. When a source omits support, direction,
contacts, ordered actions, target, stimulus, terminal action, or reset, the
source is archived and its earlier `needs_human_review` evidence is retained.
No adjacent video, common interpretation, or similar name is used to invent a
mapping. The final score-72+ queue is zero with zero exact collision.

Migration 440 is an operational backfill, not research approval. It supplies
provisional exercise-complexity and physical-difficulty records for 11 legacy
Needs Engine cards and exact default dosage profiles for 19 other published
legacy cards, taking that audit to 1,567/1,567 passing. The records explicitly
require calibration/program review and create no canonical release, media,
graph, or score approval.

Human work remains the limiting factor. All 1,050 active canonical definitions
are quarantined; research-section review, exact media review, alternate review,
independent score calibration, progression/substitution review, accessible
member comprehension, coach approval, a real coach pilot, and published phase
depth are still required before production release.

## Box / Drop / Depth review cohort (migrations 441–442)

Review the three baselines as separate contracts. Box Jump must show a
stationary bilateral floor takeoff, whole-foot box landing, stabilization,
stand, and step-down. Drop Jump must show a true step-off and shallow
short-contact bounce strategy. Depth Jump must show a true step-off and one
continuous countermovement without a pause, with maximal vertical rebound as
the primary outcome. A title containing “drop” or “depth” is not sufficient.

For every one of the five candidates per card, a qualified reviewer must watch
the full item and record exact sequence and strategy, arm policy, platform
relationship, first and final contacts, rebound direction, reset, cue accuracy,
unsafe advice, captions, accessibility, and demonstration quality. The current
healthy oEmbed state is only a discovery and embed-availability check.

Independently calibrate the proposed 42/44, 58/64, and 60/68 complexity/physical
scores against approved anchors. Then review the six graph proposals with
their objective-specific conditions. In particular, Drop Jump and Depth Jump
are not interchangeable for strategy-specific objectives even though a
review-only lateral substitution may be appropriate for a broader vertical-
rebound objective after complete dose, impact, logistics, duration, and
rendering revalidation.

Migration 442's seven identity decisions are identity-only. If later card
review finds that a neighboring source lacks the mechanical fact asserted by
its current contract, quarantine that source for re-authoring; do not convert
the identity decision into media, score, graph, or publication approval.

## Floor vertical-jump review cohort (migrations 443–444)

Review Squat Jump, Countermovement Jump, and Countermovement Jump Rebound as
three exact start/contact contracts. For Squat Jump, confirm lower-body
stillness for the declared pause, fixed hands, no new dip, one flight, and a
controlled bilateral finish. For Countermovement Jump, confirm stationary
entry, one natural-arm countermovement, one flight, minimal travel, and a
controlled bilateral finish. For CMRJ, confirm a high active first CMJ,
simultaneous first landing, one immediate vertical rebound, exactly two
flights, controlled final landing, and reset.

Each card has five current oEmbed-healthy candidates. Reviewers must watch the
entire item and record start strategy, arm policy, takeoff/landing laterality,
flight/contact count, rebound strategy, terminal state, reset, cue accuracy,
unsafe advice, captions, accessibility, demonstration quality, and exact
baseline match. oEmbed health and title similarity are never approval.

Independently calibrate the proposed 40/44, 42/46, and 54/58
complexity/physical scores. Review the six new graph proposals and the
normalized Countermovement-Jump-to-Box-Jump edge. A static-start jump is not a
less-skilled label; it is a different exercise start. CMRJ and Drop Jump may be
reviewed as objective-dependent substitutions only after entry, metrics,
equipment, dose, impact, duration, logistics, and rendering are revalidated.

The independent card auditor confirms that all machine-actionable fields pass.
The remaining four blockers per card are human media, graph, calibration, and
publication gates. Do not change those statuses without real qualified review.

## Bilateral horizontal-jump review cohort (migration 445)

Review the four cards against exact purpose and contact contracts:

- Standing Broad Jump: stationary behind a line, one natural-arm
  countermovement, one maximal bilateral horizontal flight, valid bilateral
  landing, no backward touch, and consistent nearest-mark measurement.
- Broad Jump to Stick: stationary start, one natural-arm countermovement, one
  horizontal flight, bilateral landing, 2–3 second hold without another
  contact, and full reset.
- Repeated Broad Jump: a declared flexible count of at least two bilateral
  jumps, no pause at intermediate contacts, stable forward lane, and a held
  final landing.
- Triple Broad Jump: exactly three maximal linked bilateral jumps, no pause,
  valid final landing, and standardized total-distance measurement.

Each card has five currently healthy embed candidates. Review the full video
for start, arm policy, projection, laterality, jump and landing count,
intermediate contact behavior, terminal state, measurement, cue accuracy,
unsafe advice, captions, accessibility, and demonstration quality. Title and
oEmbed health are discovery evidence only.

Independently calibrate 46/52, 44/48, 54/62, and 58/66 complexity/physical
scores. Review the six new relationship proposals and four explicit identity
boundaries. Sequence count can be dosage for Repeated Broad Jump, but the exact
three-jump measured test remains a separate contract. Never convert any score
or card into an athlete proficiency classification.

## Drop-landing terminal-stick review cohort (migration 446)

Review bilateral and unilateral drop landings as separate first-contact stick
contracts. Both require a secured elevated platform, a deliberate step-off
without upward or outward jump, one flight, the prescribed terminal support,
controlled absorption, a declared hold, and full reset. For unilateral work,
also verify landing side, lead foot, free-foot clearance, and balanced side
dose. Platform height is recorded for every attempt.

Each card has five current oEmbed-healthy candidates. Review the entire item
for platform security, departure, flight and landing count, direction,
laterality, free-foot behavior, rebound or hop, terminal hold, reset, cue
accuracy, unsafe advice, captions, accessibility, and demonstration quality.
The title and embed response do not prove an exact or approved demonstration.

Independently calibrate the proposed 46/52 and 58/62 complexity/physical
scores. Review the six graph proposals and all eight identity boundaries.
Lead-foot effects and bilateral-versus-unilateral biomechanics support explicit
recording and separate terminal-support identities, but research evidence does
not supply reviewer approval. Do not turn platform height, laterality, or any
exercise difficulty score into an athlete skill classification.

The automated audit leaves only media, graph, calibration, and publication
human gates. Record qualified reviewer identity, full-video findings, reasons,
and timestamps; otherwise keep both cards quarantined.

## Floor-bridge cohort review packet

Source-registry version `2026-08-02.62` adds the supine-bridge narrative
review, modified single-leg and trunk-activation studies, ankle-position EMG,
single-leg hamstring fMRI, long-lever force/testing rigor, and ACE/NASM
instruction sources used by migration 448. These sources support candidate
mechanics, anatomy, setup, dosage, and safety claims; they do not supply Vortex
reviewer approval.

Review the four identities separately: bilateral dynamic, bilateral
isometric, unilateral dynamic, and unilateral isometric. For every variant,
verify contraction mode, support count and side, upper-trunk support, foot
distance, knee and ankle position, free-leg position, external-load contact,
range, tempo or hold time, side dose, breathing, exit, and stop rules. Do not
convert any exercise-difficulty score into an athlete skill classification.

Each card has five current oEmbed-healthy candidates. Watch every candidate in
full and record identity/variant exactness, title and channel accuracy,
implement and load contact, cue safety, unsafe advice, captions, accessibility,
demonstration quality, reviewer identity, reason, and timestamp. A title and
oEmbed response prove only current link/embed health.

Independently calibrate all 18 complexity/physical score proposals and review
the 11 progression, regression, substitution, and equipment-equivalence
proposals. The automated audit leaves only media, graph, calibration, and
publication gates; keep every card quarantined until qualified reviewers
complete those gates.

## Single-Leg Romanian Deadlift cohort review packet

Source-registry version `2026-08-02.63` adds direct Single-Leg Romanian
Deadlift loading-position EMG, flywheel-training, hamstring-cohort, ACE
technique, and NSCA technique sources. It also records that PMID 24978835 is
superseded for this family because that paper compares stiff-leg deadlift with
leg curl. Research supports candidate mechanics, anatomy, loading, and coaching
claims; it does not provide Vortex approval.

Review the stable identity across all active variants. Verify stance side,
free-leg trajectory, trunk/pelvis control, hip-hinge action, knee strategy,
reach target, external support, implement, load contact, contralateral or
ipsilateral loading, bilateral handheld or barbell loading, range, tempo,
assisted return, repetitions, side dose, rest, pickup/set-down, exit, and stop
rules. Distance Jump, Throwing, and Kicking are programming contexts, not new
exercise identities. Never convert an exercise-difficulty score into an
athlete skill classification.

Watch each of the five candidate videos in full. Record identity and exact-
variant match, title/channel accuracy, stance and loading side, setup and exit,
cue safety, unsafe advice, captions, accessibility, demonstration quality,
reviewer identity, reason, and timestamp. A successful oEmbed request proves
only that the URL currently returns embeddable metadata.

Independently calibrate the 20 complexity/physical anchors and review all 18
progression, regression, substitution, and equipment-equivalence proposals.
The automated packet has exactly four unresolved human gates: media, graph,
calibration, and publication. Keep the card quarantined until qualified
reviewers complete each gate.

## Cossack Squat current-contract review packet

Source-registry version `2026-08-02.64` adds PMID 30026952 and the Monash
University Cossack Squat guide. The first is adjacent evidence showing that
stance width and foot angle affect bilateral-squat mechanics; it is not direct
Cossack validation. The second directly describes candidate Cossack technique.
Neither establishes one universal stance, foot angle, depth, cue, dose, score,
or Vortex approval.

Review all eleven active variants separately. Confirm stance, working side,
contralateral long-leg action, foot-contact rule, pain-free owned range,
support type/height/pressure, hold or pry, terminal stick, tempo, reach
direction, exact implement/load position, pickup/set-down, repetitions or hold
seconds, balanced side dose, rest, fatigue budget, exit, and stop rules. Do not
restore the two archived unresolved placeholders unless a qualified reviewer
can identify the missing reach or loading contract from authoritative source
material.

Watch the five current YouTube candidates in full. Record identity and exact-
variant match, title/channel accuracy, range, support/load, cue safety, unsafe
advice, captions, accessibility, demonstration quality, reviewer identity,
reason, and timestamp. Current oEmbed title/channel/embed metadata is not a
playback or content review.

Independently calibrate all 22 active complexity/physical anchors and review
the 17 outgoing relationship proposals. The packet has exactly four human
gates—media, graph, calibration, and publication—and remains quarantined until
qualified reviewers complete them.

## Floor Press current-contract review packet

Source-registry version `2026-08-02.65` adds six Floor Press sources: direct
isometric Floor Press validity, adjacent bench-press range/sticking-region and
grip/EMG studies, and direct NASM and BarBend technique guidance. PMID 23096062
is explicitly removed from the family because it studies shoulder presses,
not Floor Press. Direct dynamic Floor Press outcome evidence remains sparse;
adjacent bench evidence must not be presented as direct validation.

Watch candidate videos `9vcKpv45aeE`, `77gWg_ZA8Kg`, `T0Y3OBF1bNI`,
`uUGDRwge4F8`, and `i1yoygDuZlA` in full. Record identity and exact-variant
match, title/channel accuracy, implement and arm pattern, grip, range boundary,
floor transfer and setup, cue safety, unsafe advice, captions, accessibility,
demonstration quality, reviewer identity, reason, and timestamp. Current
oEmbed results prove link/embed metadata health only.

Review the nine active variants independently, including safe pickup/set-down
or rack/safety/spotting requirements, floor clearance, dosage, rest, fatigue
budget, substitutions, exit conditions, and stop rules. Separately adjudicate
the 12 alternate-definition assessments, especially the pin, isometric,
bridge, dead-bug, and fly boundaries; do not silently promote them to variants.

Independently calibrate all 18 complexity/physical anchors and review the 16
progression, regression, substitution, and equipment-equivalence proposals.
The packet has exactly four unresolved human gates—media, graph, calibration,
and publication—and remains quarantined until qualified reviewers complete
each gate.

## Rotational Ball Slam current-contract review packet

Source-registry version `2026-08-02.66` adds the Army H2F Rainbow Slam source
and records direct ACE technique, ACE ball-type guidance, adjacent rotational-
throw test evidence, and adjacent upper-body plyometric evidence. Direct
dynamic floor-slam outcome research remains sparse. Reviewers must preserve
the direct/adjacent distinction and must not turn ACE's consumer experience
label into an athlete skill level on an exercise card.

Review the stationary diagonal, stationary rainbow arc, and step-behind
diagonal variants independently. Confirm ball construction, slam rating, mass,
and rebound; entry and trajectory; overhead range; side pattern and balanced
dose; foot/hip/trunk sequence; release mark; controlled finish; catch or
retrieval; rest; lane and traffic; cumulative fatigue; ball impacts; duration;
substitution handling; and all stop rules. Athlete landing impact is zero while
ball-to-floor impact is one per attempt and must be budgeted separately.

Watch candidates `xYANsh80ErM`, `wK9DwFTt1YQ`, `vf61IsovxKo`, `eZ0I7FmJ1A0`,
and `9CKf3Yc2FMk` in full. Record identity and exact-variant match, title and
channel, ball and rebound behavior, entry, trajectory, side pattern, release
zone, finish, catch/retrieval, cue safety, unsafe advice, captions,
accessibility, demonstration quality, reviewer identity, reason, and
timestamp. Current oEmbed results prove metadata and embed health only.

Adjudicate the 12 alternate assessments and six relationship proposals, then
independently calibrate the six complexity/physical score anchors. Side-to-side
alternation remains a delivery annotation unless authoritative evidence shows
a new identity contract. The packet has exactly four unresolved human gates—
media, graph, calibration, and publication—and remains quarantined until
qualified reviewers complete each gate.

## One-Arm Row current-contract review packet

Source-registry version `2026-08-02.67` adds direct ACE bench-supported row,
NSCA single-arm bent-over row, Strength and Conditioning Journal landmine-row,
ACE kettlebell-row, and Onnit landmine-suitcase technique sources. PMID
19620925 is adjacent biomechanics: it compares inverted, standing bent-over,
and one-arm cable rows, not these dumbbell or landmine variants. Preserve that
boundary in all review notes and claims.

Review the four active variants independently. Confirm implement, hand and
working side, support contacts, stance and orientation, landmine anchor and
attachment where applicable, grip, load, pull target, owned range, trunk and
pelvis policy, shoulder/scapula and elbow path, controlled eccentric, pickup
and set-down, repetitions per side, reserve, rest, duration, cumulative pull/
grip/trunk/hinge fatigue, recovery, lane/traffic, substitution behavior, and
all quality and stop rules.

Watch candidates `KRN38chlkds`, `k2kVniB5eQI`, `zvATS076NVA`, `TKmtHtY7yNo`,
and `2bjH8LMo6DM` in full. Record identity and exact-variant match, support,
stance, implement, handle, side, target, range, trunk policy, shoulder/elbow
path, eccentric, pickup/set-down, cue safety, unsafe advice, captions,
accessibility, demonstration quality, conflicts, reviewer identity, reason,
and timestamp. Current oEmbed responses establish link/title/channel/embed
health only.

Do not restore Landmine Gorilla Row source 1441 or Landmine Ball-Grip Row source
1448 until qualified reviewers obtain authoritative specifications for their
missing sequence, hand count, support/orientation, handle geometry, and
repetition contract. Adjudicate the 12 alternates and eight relationship
proposals, then independently calibrate all eight complexity/physical anchors.
The packet has exactly four unresolved human gates—media, graph, calibration,
and publication—and remains quarantined until qualified reviewers complete
every gate.

## Short Acceleration Sprint current-contract review note

Migration 454 adds no source, candidate media, relationship proposal,
calibration anchor, or approval. It normalizes machine-audited fields on the
existing 20-source research packet and preserves all review boundaries from
migrations 419 through 421. Registry version `2026-08-02.67` and its 263
sources are therefore unchanged.

Reviewers must continue to assess all eight variants independently. Confirm
the exact start and lead side, stillness or cue contract, surface and weather,
lane clearance, marked distance, effort, first projection and early steps,
arm-leg coordination, finish and run-out, rest, cumulative exposure, symptoms,
duration, and substituted identity. The walk-in two-point and build-up three-
point variants must remain nonselectable unless direct evidence resolves their
identity and delivery boundaries.

Difficulty review concerns exercise complexity and physical difficulty only;
it must not add an athlete skill level to an exercise or safety card. Candidate
media require complete human playback and exact-variant, caption,
accessibility, safety, demonstration-quality, reviewer, reason, and timestamp
records. Graph proposals and score anchors require their independent reviews,
followed by two-person publication review. Until then, the packet retains
exactly the media, graph, calibration, and publication gates.

## Push-Up family review packet

Registry version `2026-08-02.68` adds the NASM Push-Up technique page and direct
research on Push-Up kinetics, elevation effects, suspension/torso activation,
stable-versus-unstable activation, and hand-position activation. Review claims
against their actual scope. PMID 38156065 must not be restored: it studies
standing versus seated calf raises and is unrelated to Push-Up execution.

Review all 11 active variants independently. Confirm hand and lower support,
support height/body angle, hand base/orientation, side pattern and balanced
dose, range and bottom target, full-cycle or eccentric-only contraction,
assisted reset, external vest mass/retention, ring anchor/strap behavior,
body-line and scapular policy, shoulder/elbow/wrist path, repetition validity,
reserve, rest, cumulative local/wrist/shoulder/trunk/eccentric fatigue,
recovery, station/traffic, duration, substitutions, and controlled exit.

Watch candidates `WDIpL0pjun0`, `0JUrOH--Kdk`, `DBz85WuXqMk`, `6KfBJQcRpYw`,
and `A0r8ploEnZY` in full. Record exact identity/variant, support, body angle,
hand base, side, range, contraction and return, external load, body line,
scapular/shoulder/elbow/wrist behavior, cue safety, unsafe or conflicting
advice, captions, accessibility, demonstration quality, reviewer identity,
reason, and timestamp. Current oEmbed responses prove metadata/embed health
only.

Do not restore generic One-Arm Push-Up Progression source 585 until original
authoritative evidence supplies the working hand, assistance/counterbalance,
foot base, hand position, range, repetition sequence, and return strategy.
Adjudicate all 18 alternate assessments and 22 graph proposals, then have an
independent reviewer calibrate all 22 complexity/physical-difficulty anchors.
The packet remains quarantined by exactly media, graph, calibration, and
publication review; no candidate or machine decision is an approval.

## Reverse Lunge review packet after migration 456

Registry `2026-08-02.69` adds direct reverse-lunge kinetics from PMCID
PMC4641539. It also registers PMID 30676181 on lunge loading devices, PMID
36981573 on lunge load distribution and trunk activity, PMCID PMC8136561 on
trunk position in static/forward/walking lunges, and an ACE dumbbell-workout
instruction. Only PMC4641539 directly compares reverse lunges. Preserve the
adjacent-evidence boundary in every claim and review note.

Migration 456 deliberately keeps source 380 archived until original evidence
specifies its barbell rack position; source 421 until implement count and
dumbbell carry are known; source 473 until implement count and kettlebell carry
are known; and source 1009 until the sandbag hold is known. Do not restore
those sources from generic labels or video titles. Source 753 is retained as a
slow-eccentric full-cycle modifier, not an eccentric-only repetition, because
its authored instructions include the return to standing.

Candidates `RZKXLMxPF_I`, `v791YUqiE-o`, `xrPteyQLGAo`, `1cXnW986vqU`,
`Vlgh0ImT5oU`, `MpfeGnBFEo8`, `2D4xApe-UFU`, and `43WpRP4pWaM` returned HTTP
200 oEmbed metadata with title, channel, and embed HTML on 2026-08-02. The
first five are persisted as candidates only; review all eight before replacing
or approving the three-to-five final links. Record exact variant, working/front leg,
step-back and return contract, implement count and position, bar rack or ball
hold, range and rear-knee behavior, trunk policy, foot/knee/hip alignment,
side-dose balance, cue safety, conflicts, captions, accessibility,
demonstration quality, reviewer identity, reason, and timestamp.

The three active variants use exercise complexity and physical difficulty only,
with overall equal to their maximum. Athlete readiness belongs in workout
selection and delivery context; no exercise or safety skill level exists.
Independently review the six proposed substitution/progression relationships
and six score anchors. The family remains quarantined by media, graph,
calibration, and publication review only; machine completion and oEmbed health
do not make it rollout-ready.

## Lateral Lunge review packet after migration 457

Registry `2026-08-02.70` adds PMCID PMC8805090 as direct laboratory evidence
for side-lunge patellofemoral loading. The NSCA lunge-technique source is
adjacent technique context, and the ACE dumbbell-workout source is compound
instruction because its lateral lunge is followed by a shoulder raise. Do not
present either adjacent source as direct validation of the exact canonical
bodyweight step-out contract.

Review candidate videos `tmhESsZcpDY`, `14JjPgcZAdI`, `ppcfjd9WVj0`,
`vwOrd9umMOc`, and `4m9R6PijpWI` in full. Confirm bodyweight step-out identity,
both-side delivery, start stance, lateral step, foot and knee path, hip shift,
depth/range, trunk behavior, push-off and complete return, repetition validity,
symptom and stop guidance, captions, accessibility, cue safety, conflicting
advice, demonstration quality, reviewer identity, reason, and timestamp. The
current records prove only that title, channel, and embeddable oEmbed metadata
responded during discovery.

Do not restore six ambiguous sources from their labels or candidate media.
Source 63 mixes a fixed wide-stance shift with a step-out; source 174 omits
dumbbell count and hold; source 385 omits barbell rack position; source 475
omits kettlebell count, carry, and load side; source 1010 omits sandbag hold and
contains extraneous carry/drag instructions; source 1328 leaves both optional
implement and step/load protocol unresolved. Obtain and cite original
authoritative specifications before authoring any exact loaded variant.

Source 752 is a slow-eccentric full-cycle dosage modifier because its authored
repetition includes the return. Source 1055 must remain mapped to the Cossack
Squat family: despite its `Bodyweight Lateral Lunge` label, the executable
instructions prescribe a fixed wide stance and lateral shift with no step-out.
Review identity from the movement contract, not name similarity.

The active variant uses exercise complexity and physical difficulty only,
with overall equal to their maximum; neither exercise nor safety cards receive
athlete skill/proficiency. Independently adjudicate the 18 alternate
assessments, six proposed relationships, and two score anchors, then complete
the two-person publication review. Until then the packet remains quarantined
by exactly media, graph, calibration, and publication gates.

## Medicine Ball Shot-Put review packet after migration 458

Migration 458 supersedes the older candidate assumption that a generic
`Medicine Ball Shot-Put Throw` label or a forward-facing video title was enough
to establish an executable forward-facing baseline. It also refines the family
model: forward-facing, static side-on, stepping, kneeling, partner, wall-catch,
and open-lane executions share a unilateral shoulder-level shot-put release but
remain separate exact variants when orientation, stance, entry, pivot, target,
receiver, return, or catch changes. Bilateral chest, scoop, rotational throw,
overhead, and slam releases remain distinct definitions.

All seven legacy sources remain identity-quarantined. Obtain original
authoritative specifications for orientation, throwing side, stance and lead
leg, ball start and hand placement, permitted foot/pivot action, entry, target
or receiver, wall/rebound behavior, catch or no-catch return, finish, reset,
side order, ball mass/type, dose, and rest before restoring any source-derived
variant. Do not reconstruct these facts from names, aliases, thumbnails, video
titles, or oEmbed responses.

Review the authored static side-on, wall, no-catch working specification as a
new content decision. Confirm whether the declared rear-shoulder ball start,
static stance, natural pivot inside marked foot positions, ground-up sequence,
wall target, balanced finish, protected rebound zone, wait/retrieve/full-reset
contract, and equal side dose are coherent and safe. This working specification
is not represented as source approval or universal best practice.

Watch candidates `KtzuEYn0DmY`, `WBUDq_5DGG0`, `EXV9UhUMTiY`,
`wX4tcyR-61w`, and `GTK8P0IOCTI` in full. Their titles, channels, and embed HTML
returned current HTTP-200 oEmbed metadata on 2026-08-02. Record exact stance,
orientation, entry, ball position, hand placement, foot/pivot action, target,
release, catch/retrieval, finish, reset, side demonstration, ball type, unsafe
or conflicting advice, captions, accessibility, demonstration quality,
reviewer identity, reason, and timestamp. Metadata health is not playback or
content verification.

Review PMIDs 39589937, 37833510, 22744301, 41460695, and 21572350 only within
their actual protocols and populations. PMID 39589937 directly supports a
standardized rotational medicine-ball power test; seated and supine tests and
the upper-body plyometric meta-analysis are adjacent. Track-and-field shot-put
biomechanics must not be presented as direct validation of this medicine-ball
variant. The NSCA youth position statement supports qualified supervision and
progression, not exact adult shot-put technique.

Difficulty review concerns exercise complexity and physical difficulty only;
it must not add athlete skill/proficiency to exercise or safety cards.
Independently adjudicate all 18 alternates, four graph proposals, and two score
anchors, then complete separate content review and publication approval. The
packet retains exactly media, graph, calibration, and publication blockers.

## Suitcase Carry review packet after migration 459

Registry `2026-08-02.71` adds four research sources. PMID 38665162 directly
distinguishes farmer carry, suitcase carry, farmer hold, and suitcase hold and
reports trunk activation under the tested conditions. PMID 34051700 directly
examines hip/trunk activity and mechanics while walking with unilateral weight.
PMID 36557001 is adjacent postural-gait context, not a loading threshold or
clinical prescription. PMID 31820223 is an adjacent strongman systematic
review and explicitly describes gaps in unilateral-carriage biomechanics.
Review claims within those populations and protocols; do not turn surface-EMG
findings into universal muscle rankings, injury-prevention claims, clinical
indications, or safe-load rules.

Review the three authored working specifications separately: dumbbell straight
lane, kettlebell straight lane, and dumbbell single-line walk. Confirm one
implement, loaded hand, handle and mass, side-of-thigh position, pickup and
still start, natural-width or exact single-line foot rule, straight no-turn
route, pace, distance and time ceiling, trunk/pelvis allowance, free-arm rule,
finish, set-down, early exit, side order, rest, valid-distance rule, and
recovery. These are research-authored candidate contracts, not approved legacy
source restorations.

Do not restore any of the seven legacy variants from their names. Sources 204,
452, 504, and 559 inform the family or alternate assessment but omit at least
one exact route, foot, turn, pace, hand-order, pickup, finish, or set-down fact.
Source 1028 needs an authoritative sandbag handle/grip/position contract.
Source 1340 needs a complete executable carry specification. Source 1470 needs
an authoritative decision between in-place and traveling march plus knee
height, cadence, route, and terminal action.

Watch candidates `zFje79PZsxQ`, `IZ0aGhu24c8`, `z4WJXcx19WQ`,
`LJaq4BS7KpE`, and `Fko5Hp537us` in full. Their link, title, channel, and embed
HTML returned HTTP-200 oEmbed metadata on 2026-08-02. Record exact implement,
hand, pickup, route, turn, pace, foot path, trunk/pelvis behavior, finish,
set-down, both-side demonstration, unsafe or conflicting advice, captions,
accessibility, demonstration quality, reviewer identity, reason, and timestamp.
Metadata health is not playback or content verification.

Difficulty review concerns exercise complexity and physical difficulty only;
it must not add athlete skill/proficiency to exercise or safety cards.
Independently adjudicate all 21 alternates, eight graph proposals, and six score
anchors, then complete separate content review and publication approval. The
packet retains exactly media, graph, calibration, and publication blockers.

## Bent-Knee Soleus Raise review packet after migration 460

Registry `2026-08-02.72` adds five sources. PMID 38156065 is direct 12-week
within-person evidence comparing standing knee-extended and unilateral seated
knee-flexed machine training in 14 untrained adults; it supports a knee-
position distinction and similar soleus hypertrophy under that protocol, not
pure muscle isolation or universal programming. PMID 28145739 directly
compares estimated Achilles loading across seated and standing heel-raise
conditions in 21 healthy men; it is not a clinical load prescription. PMID
37015022 reports acute swelling after high-repetition work in 17 young women,
so it is an acute proxy rather than longitudinal adaptation evidence. PMID
22190157 found only a modest soleus-activity increase with knee flexion in 48
healthy adults. The NSCA technique article provides adjacent professional
instruction for a single-leg seated dumbbell/kettlebell version. Preserve
those population, protocol, and measurement limits.

Review the bilateral bodyweight-floor, unilateral-machine, and single-leg
dumbbell-floor working specifications independently. Confirm seat and support,
knee angle, side contract, one-foot or two-foot contact, implement and count,
load position, foot surface, heel clearance, start, full controlled range,
tempo, pause or bounce rule, repetition validity, finish, unloading, side
switch, dose, rest, symptom response, and cumulative calf/Achilles/running/
sprint/jump exposure. Confirm that `soleus-biased, not isolated` remains the
appropriate claim. These are research-authored candidate contracts, not
approved legacy restorations.

Watch candidates `RZ1Iv9sIYHM`, `fFWpWJy8ybU`, `wtBKmESLI98`,
`DHMOfk7DEyk`, and `7qzlklmu3Pw` in full. Their title, channel, link, and embed
HTML returned current HTTP-200 oEmbed metadata on 2026-08-02. Record exact
variant, knee position, laterality, implement/count/contact, foot surface,
range, tempo, bounce or assistance, repetition and reset, side dose, unsafe or
conflicting advice, captions, accessibility, demonstration quality, reviewer
identity, reason, and timestamp. Metadata health is not playback or content
verification.

Do not restore any of the seven source rows from names or media. Obtain exact
authoritative mechanics first. Independently adjudicate all 24 alternate
assessments, ten graph proposals, and six score anchors. Difficulty review is
limited to exercise complexity and physical difficulty, with overall derived
as their maximum; it must not add athlete skill/proficiency to exercise or
safety cards. Separate content review and publication approval remain
required, leaving exactly media, graph, calibration, and publication blockers.

## Back Squat review packet after migration 461

Review PMIDs 38900172 and 34541522 as small direct high-/low-bar biomechanics
studies whose results depend on stance, load, cohort, and method; they do not
establish universal superiority or muscle rankings. PMIDs 38036316 and
23085977 show that depth and load change joint moments in their tested cohorts,
not a universal safe depth or load. PMID 31230110 supplies limited longitudinal
depth-specific adaptation evidence. The NSCA manual supplies professional rack
and spotting context, and ACSM supplies general prescription—not approval of
these exact cards.

Independently verify bar shelf, grip, hooks, safeties, bar/plates, walkout,
stance, foot angle, depth, tempo, brace, load, repetitions, reserve, rest,
failed-rep response, two-hook rerack, cumulative load, and recovery for both
working specifications. Watch `8Kls95w2jFA`, `Akd5xmZlsvg`, `Po9CDtfcLJI`,
`1le_LVZmmUU`, and `7fmrKmJMQnw` in full. Their current oEmbed metadata is not
playback, exactness, caption, accessibility, safety, quality, or approval
evidence.

Do not restore any source row without authoritative missing mechanics.
Independently adjudicate 24 alternates, eight graph proposals, and four score
anchors. Difficulty review covers exercise complexity and physical difficulty
only; skill level remains exclusive to skill-library cards. Separate content
review and publication approval remain mandatory.

## Box Jump review packet after migration 462

Review the direct box/hurdle/countermovement comparison (PMC10204452) as a
small study of 20 recreationally trained men, not proof of universal task
superiority or transfer. Review the relative box-height study (PMC11166134) as
a 31-participant maximal-intent protocol whose mostly unchanged propulsion
variables do not make height a universal intensity or safety scale. The arm-
swing study (PMC5260575) supports standardizing arm policy in its tested cohort,
not a universal performance increment. NASM, NSCA, World Athletics, and landing-
feedback sources provide adjacent instruction and programming context, not
approval of these exact cards.

Independently verify all four working specifications: approach and lead step,
preload depth and stillness, arm position and timing, stance and takeoff line,
box type/height/top/edge, bilateral takeoff, flight and edge clearance,
simultaneous whole-foot landing, landing depth/symmetry/sound, hold, stand,
step-down route, reset, attempts, rest, every valid/failed/incident contact,
same-session exposure, duration, output loss, symptoms, and recovery.

Watch `52r_Ul5k03g`, `d2z2_rRkpAo`, `v9cZQqGX1Xk`, `kNIInK_Le8I`, and
`Bc_ycZFCEvQ` in full. Their prior card-v2 oEmbed metadata was carried forward;
the fresh fetch attempt failed and proves nothing. Record current playback,
exact variant, conflicting or unsafe advice, captions, accessibility,
demonstration quality, reviewer identity, reason, and timestamp. Do not restore
any of the nine sources from names or video.

Independently adjudicate all 30 alternates, ten graph proposals, and eight score
anchors. Difficulty review is limited to exercise complexity and physical
difficulty, with overall derived as their maximum; athlete readiness remains a
workout-selection input and proficiency categories remain confined to the skill
library. Separate content review and publication approval remain mandatory.

## Depth Jump review packet after migration 463

Review PMC5260527 as a direct comparison of countermovement and bounce drop-
jump techniques in eight male youth basketball players. It supports separating
contact strategies but does not establish universal thresholds or transfer.
Review PMC10160442 as a systematic review of 22 heterogeneous randomized
training studies that explicitly found inconsistent intensity, volume, surface,
height, and individualization reporting. Platform height alone is not an
intensity, readiness, or safety rule. The remaining NSCA, landing-feedback,
landing-intervention, plyometric, and YouTube-embed sources provide adjacent
context, not approval of these exact variants.

Independently verify both working specifications: rated platform and actual
height, declared step-off lead, hands-on-hips or free-arm policy, no upward jump
from the platform, simultaneous bilateral first contact, one continuous
countermovement without pause or bounce drift, immediate maximal vertical
rebound, contact time and height method when measured, simultaneous final
landing, two-second hold, full reset, attempts, rest, all valid/failed/incident
contacts, same-session exposure, duration, output loss, symptoms, and recovery.

Watch `AzPJZHOmGEg`, `GeN0S3XCZnM`, `DxzbXy0lC6Y`, `Phf_HO1w9BA`, and
`dGQRsuI_-ag` in full. Prior card-v2 oEmbed health was carried forward; fresh
fetches returned cache misses and verify nothing. Record current playback,
exact arm-policy and sequence match, conflicting or unsafe advice, captions,
accessibility, demonstration quality, reviewer identity, rationale, and time.
Do not restore any of the three source variants from a title or video.

Independently adjudicate 24 alternates, eight graph proposals, and four score
anchors. Difficulty review covers exercise complexity and physical difficulty
only, with overall derived as their maximum. Athlete readiness is evaluated by
workout selection, while proficiency categories remain exclusive to skill-
library cards. Separate content review and publication approval are mandatory.

## World's Greatest Stretch review packet after migration 471

Review the exact five-phase contract: assigned long-lunge and rear-knee
support; lead-side elbow toward the instep through owned range; the same arm
and thorax rotate upward without uncontrolled pelvic or lumbar substitution;
the hand returns; the hips rock back while the lead knee extends; then the
athlete uses the declared reset or switch. Verify entry, exit, starting side,
all ranges, tempo, breathing, dose, rest, lane, support, symptoms, duration,
failed attempts, and same-session lunge/hamstring/rotation/hand-support load.

The [P]rehab professional specification supports the movement identity and
sequence. PMID 29063454 supports only general dynamic-stretching context and
warns that duration, amplitude, and velocity affect results; PMID 24149201
shows that warm-up context can affect some outcomes while leaving others
unchanged. No exact-sequence trial was found or claimed. Proposed doses,
recovery windows, complexity scores, physical-difficulty scores, and transfer
claims require independent review.

Watch `-CiWQ2IvY34`, `FIZMUyAPPWY`, `CXnge363CH8`, and `VQqabRnOR1E` in full.
oEmbed currently establishes metadata and iframe response only. Record exact
variant match, playback, phase order, side mapping, ranges, captions,
accessibility, cue quality, safety, conflicts, reviewer identity, rationale,
timestamp, and card-version match. Independently adjudicate all 28 alternates,
four relationship proposals, and four score anchors before content review and
separate publication approval.

## Dead Bug review packet after migration 470

Primary research support includes the 12-participant Dying Bug trunk-EMG study
(PMID 11689975) and the 30-participant comparison of upper-only, lower-only, and
combined-limb methods at three metronome speeds (DOI
10.14474/ptrs.2017.6.1.1). NASM instruction supplies the common opposite-arm/
opposite-leg execution reference. The packet explicitly limits these sources:
acute surface EMG in small healthy samples does not validate a universal dose,
posture, safety rule, treatment effect, training outcome, or difficulty score.

Human reviewers must independently review all 16 evidence sections, 32
alternate classifications, four graph proposals, and four complexity/physical-
difficulty anchors. Four current YouTube oEmbed responses verify metadata only;
a qualified reviewer must still watch full playback and assess exact variant,
start, opposite pair, lever, range, terminal target, quiet trunk, breathing,
return, alternation, dose, captions, accessibility, safety, cue quality,
conflicts, reviewer identity, timestamp, and card-version match. Separate
content review and publication approval remain mandatory.

## Nordic Hamstring review packet after migrations 464–466

Review PMID 31644582 as an acute six-variation study of 18 adults with resistance
training experience but little or no Nordic experience. It supports preserving
lower-leg support slope and hip position as identity dimensions; it does not
establish a universal best setup. Review PMID 38439779 as a crossover study of
13 male volunteers performing five-second isometrics at specified knee and hip
angles on a 30-degree lower-leg support. It supports the exact K30/H0 working
protocol only as a review candidate, not as a universal angle, dose, or clinical
recommendation.

Review PMID 31502142 for heterogeneous intervention-volume evidence and PMID
40991853 for the 2025 42-study strength dose-response synthesis. The latter
reports low-to-very-low certainty and no simple volume-response relation after
meta-regression; its programme ranges are not card prescriptions. Review PMID
30808663 only as evidence about programmes that included Nordics, not proof that
one exercise, dose, or individual is “injury proof.” Do not restore PMID
38156065: it studies standing versus seated calf raises and is unrelated to
Nordic identity, dosage, or outcomes.

Independently verify all four working specifications: bilateral rated ankle
anchor, knee and hand padding, support slope, hip and knee angles, body line,
assistance interface and recoil path, range target or break point, five-second
eccentric or hold timing, concentric versus unloaded return, catch, reset, sets,
repetitions or seconds, rest, every valid/failed/incident exposure, same-session
sprint/run/kick/hinge/slider/Nordic load, symptoms, soreness, duration, and
recovery. Treat the unassisted full cycle as high relative strength, not an
athlete skill level.

Watch `_e9vFU9-tkc`, `6NCN6kOagfY`, `IiofP9cn_nc`, `6_WWA3cQF-w`, and
`kLE6k4DYgzQ` in full. Current oEmbed metadata and privacy-enhanced iframe URLs
prove only link health. Record exact contraction, assistance, angle, range,
tempo, catch and return match; current playback; conflicting or unsafe advice;
captions; accessibility; demonstration quality; reviewer identity; rationale;
and timestamp. Do not map a title to a variant automatically.

Independently adjudicate 31 alternates, ten graph proposals, and eight score
anchors. Difficulty review covers exercise complexity and physical difficulty
only, with overall derived as their maximum. Athlete readiness belongs to
workout selection and proficiency categories remain exclusive to skill-library
cards. Separate content review and publication approval are mandatory.

## Front Plank review packet after migrations 467–468

Review PMID 25325773 as a randomized acute comparison of traditional, long-
lever, posterior-tilt, and combined long-lever/posterior-tilt planks in 19
participants. It supports retaining lever and pelvic intent as variant facts;
surface EMG does not establish force, adaptation, a universal elbow offset,
dose, safety threshold, or transfer. Review PMID 29861239 as a 120-participant
prone-bridge time-to-exhaustion reliability study. Its repeated-technique-
failure termination supports explicit result validity, but test time is not a
training prescription.

Review PMID 35370773 for a nine-participant acute prone/reverse plank EMG
comparison, PMID 32560185 for inconsistent methods and missing evidence in the
core-activity literature, PMID 38668579 for the stable-versus-unstable support
boundary, and PMID 27630435 for deliberate hip-adduction/abduction variants.
None validates an “optimal” plank or direct RKC score. Do not restore PMID
32707142: it concerns prone CPR, not Front Plank exercise identity or outcomes.

Independently verify all three working specifications: stable dry mat, exact
elbow and toe marks, bilateral forearm/toe support, stance, lever, rib-pelvis
and tension intent, one-leg-at-a-time entry, continuous breathing, hold, first-
break termination, controlled knee exit, sets, rest, every valid/failed/early-
terminated second, same-session push/carry/crawl/gymnastics/trunk/support load,
symptoms, duration, and recovery. The RKC variant needs particular content and
calibration scrutiny because no direct RKC research source was found.

Watch `0nqvl7ybiYQ`, `K2UZq6uq_mY`, `abv03ZRw9bM`, `lismOShjHnA`, and
`tx8wfSu1C4k` in full. Current oEmbed metadata proves only link and iframe
health. Record exact support, lever, pelvic and tension intent, entry, hold,
breathing, stop, exit, playback, conflicts, captions, accessibility,
demonstration quality, reviewer identity, rationale, and timestamp.

Independently adjudicate 32 alternates, eight graph proposals, and six score
anchors. Difficulty review covers exercise complexity and physical difficulty
only, with overall derived as their maximum. Athlete readiness belongs to
workout selection, and proficiency categories remain exclusive to skill-
library cards. Separate content review and publication approval are mandatory.

## Kettlebell Swing review packet after migrations 472 and 474

Review the shoulder-height definition as a one-bell ballistic hip-hinge cycle:
declared hand count and side, stance, bell mass, park, close hike, hip-driven
float to chest-to-shoulder height, non-arm-dominant terminal position, falling
bell before the next hinge, cadence, breathing, quality stop, and controlled
final park. Review the overhead definition separately through the full declared
overhead terminal position, including ceiling, fixture and drop-zone clearance,
shoulder/elbow and rib-pelvis control, return path, and higher consequence of
lost bell control. Do not merge either definition with a deadlift, Romanian
deadlift, overhead carry, or strict press.

The professional ACE technique source supports the common two-hand hinge and
float contract. PMID 21997449, PMID 26618061, PMID 32131695, PMID 22207261,
PMCID PMC5455182/PMID 28593086, PMID 37126368, and PMID 36548500 provide
descriptive or acute information about muscle activity, kinematics, kinetics,
bell mass, style, fatigue, and overhead load. Preserve their limitations:
small and population-specific samples, acute laboratory tasks, differing swing
styles and protocols, and incomplete measurement of all tissues. None proves
a universal best swing, load, dose, recovery period, safety threshold, injury
effect, treatment outcome, sport transfer, or difficulty score.

Independently verify all four working variants and eight Output/Capacity
profiles. Record hand count, side, bell count and mass, terminal height, style,
start and park, planned/completed/failed repetitions, cadence, rest, first
quality break, symptoms, duration, substitution, and same-session hinge, power,
grip, trunk and applicable overhead exposure. Difficulty review is limited to
exercise complexity and physical difficulty, with overall derived as the
maximum; athlete readiness is not an exercise skill level.

Watch `IW979LifpGo`, `PAhDt_0PjP4`, `fvQoQsDk40M`, and `yHxcTn1UeAc` for the
shoulder-height card, and `MjZgWEr7dn8`, `d94xX-AQZ0A`, `dUlk6ZmFtAU`, and
`mKDIuUbH94Q` for the overhead card. The last candidate has a generic title and
therefore elevated exact-match uncertainty. Current oEmbed title, channel,
thumbnail, and privacy-enhanced iframe metadata prove only metadata health.
Record full playback, exact definition and variant, all identity dimensions,
captions, accessibility, safety, cue quality, conflicts, reviewer identity,
rationale, timestamp, and card-version match before any shortlist or approval.

Independently adjudicate all 54 alternate assessments, eight relationship
proposals, and eight complexity/physical-difficulty anchors. Migration 474's
controlled-taxonomy correction is not content approval. Separate qualified
content review and publication approval remain mandatory.

## Pull-Up / Chin-Up human-review packet

Review the seven exact working specifications separately: strict pronated bar,
strict supinated bar, fixed neutral handles, pronated archer with side-specific
load shift, elastic-band-assisted pronated bar, counterweight-machine-assisted
pronated pull, and weighted-vest pronated bar. Verify support, grip orientation
and width, assistance interface and setting or vest mass, bottom, top, strict
body path, laterality, tempo, reserve, mount, controlled return, exit, symptoms,
and cumulative pull/hang/climb/row/carry/grip exposure. Exercise complexity and
physical difficulty anchors are not athlete proficiency classifications.

Watch `GBqAZP6jquc`, `eGo4IYlbE5g`, `e1YSApl-QcM`, `ayvVeCtp83Q`, and
`AqCmhR1Bl2Q` in full. Current oEmbed responses establish title, channel,
thumbnail, and iframe metadata only. Record playback, exact definition and
variant, all support/grip/range/load facts, captions, accessibility, cue and
demonstration quality, safety concerns, conflicts, reviewer identity,
rationale, timestamp, and card-version match. Do not infer exactness from a
title or channel.

Independently adjudicate all 32 alternate assessments, 12 relationship
proposals, and 14 complexity/physical-difficulty anchors. The evidence includes
professional instruction and acute EMG, kinematic, kinetic, modeled-load,
fatigue, and trained-sample studies. It does not establish universal grip,
scapular position, readiness, safety, injury risk, load, dose, recovery,
transfer, or difficulty. Qualified content review and a separate publication
approver remain mandatory.

## Hollow Body Hold human-review packet

Review six static specifications separately: tuck arms-forward, side-specific
one-leg-extended arms-forward, straight-leg arms-forward, straight-leg arms-
overhead, fixed-overhead dumbbell, and fixed-overhead medicine-ball. Verify the
surface, entry, posterior pelvis/trunk relationship, head and shoulder position,
arm and leg lever, side, implement mass and fixed position, breathing, time
start, first shape break, symptom stop, controlled exit, sets, rest, recorded
seconds, and cumulative trunk, hip-flexor, shoulder, gripping, loaded-overhead,
and related gymnastics exposure. Difficulty review covers exercise complexity
and physical difficulty only; it is not an athlete proficiency classification.

The CrossFit Gymnastics Training Guide supplies direct identity and technique
context, and the CrossFit programming article separates initial static holds
from later dynamic work. PMIDs `15085209`, `23127994`, `9118976`, `26467996`,
`21975179`, and `18443772` provide adjacent pelvic-control, leg-lowering,
pullover-boundary, or graded-isometric evidence. Preserve the limitations:
abdominal hollowing is not itself the exact gymnastics Hollow Body Hold, and
these sources do not establish a universal shape, progression order, dose,
recovery interval, safety threshold, treatment effect, transfer outcome, or
numeric difficulty score. Do not restore unrelated CPR PMID `32707142` or
rowing PMID `19620925` to current-family provenance.

Watch `QgVOvBM96eE`, `qU0r6449do4`, `pLt0s2cimdI`, `LlDNef_Ztsc`, and
`VyrUmzIHmzw` in full. Current YouTube oEmbed metadata proves only present
title, channel, thumbnail, and iframe health. Record full playback, exact
static definition and variant, every identity dimension, captions,
accessibility, demonstration and cue quality, safety concerns, conflicts,
reviewer identity, rationale, timestamp, and card-version match. Do not infer
exactness or approval from title, channel, or successful embedding.

Independently adjudicate all 32 alternate assessments, 12 relationship
proposals, and 12 complexity/physical-difficulty anchors. Give particular
scrutiny to loaded holds versus dynamic pullovers or partner exchanges. Separate
qualified content review and publication approval remain mandatory.

## Handstand Hold human-review packet

Review four working specifications separately: freestanding floor,
freestanding locked low parallettes, chest-to-wall, and back-to-wall static
holds. Verify support interface and stability, hand marks and spacing, external
contact, wall orientation and distance, declared line and gaze, entry, timer
start, valid-hold boundary, continuous breathing, first invalidating event,
bailout or descent, supervision, station clearance, sets, attempts, valid,
failed and early-terminated seconds, rest, symptoms, and cumulative inverted-
support, wrist, overhead-press, tumbling, grip, entry, exit, and fall exposure.
Difficulty review covers exercise complexity and physical difficulty only; it
must not classify athlete proficiency.

The CrossFit coaching guide and USA Gymnastics JumpStart test protocol provide
professional and governing-body context. PMIDs `41473027`, `29471194`,
`39508479`, `38739595`, `31197281`, and `40980972`, plus PMC `7801474`, provide
systematic-review, acute muscle-activity, palmar-pressure, novice assessment,
stabilometric, motor-control, and neck-position evidence. Preserve their
limits: samples and methods vary, several studies are small or acute, and the
sources do not establish one universal line, eligibility rule, training dose,
recovery interval, safety or injury threshold, transfer outcome, or numeric
difficulty. Do not restore prone-CPR PMID `32707142` or treat generic closed-
chain EMG evidence as exact Handstand identity proof.

Watch the freestanding candidates `nDY1jlI8k6U`, `XtQC5F2dY1s`, `d6_lcWtQDxw`,
`jmF7prkqDho`, and `GamQNn1Avs0`, and the wall-supported candidates
`2v1YDTzMcO8`, `H3JRaep2lUE`, `hLYXOP-rFk8`, `yvr4Nbba6Zk`, and
`vNhVZcGZK7I` in full. Current oEmbed responses establish only title, channel,
thumbnail, iframe, and link-health metadata. Record full playback, exact card
and variant, support and contact facts, captions, accessibility, demonstration
and cue quality, safety concerns, conflicts, reviewer identity, rationale,
timestamp, and card-version match. Do not infer exactness or approval from a
title, channel, or successful embed response.

Independently adjudicate all 64 alternate assessments, eight relationship
proposals, and eight complexity/physical-difficulty anchors. Give particular
scrutiny to unsupported versus wall-supported holds and static holds versus
kick-ups, wall walks, toe pulls, shrugs, presses, and eccentric lowers. Separate
qualified content review and publication approval remain mandatory.

## Cartwheel Hand-Placement Line Drill human-review packet

Review the standing, half-kneeling, and wall-assisted working specifications
separately. Verify lead side, start, five marker locations, candidate T-shape
hand orientation, surface stability, hand-hand-foot-foot contact order, no hand
slide or regrasp, exact wall and spotter contract, full leg turnover, declared
first and second foot marks, controlled opposite lunge, invalidating events,
stop/exit behavior, lane clearance, observation, dose, rest, timing, symptoms,
and cumulative hand-support, inversion, tumbling, jumping, and landing exposure.
Difficulty review covers exercise complexity and physical difficulty only; it
must not classify athlete proficiency or modify Cartwheel skill-card levels.

Masaryk University's Safe Gymnastics material and USASF Cartwheel PT.14 provide
direct marker, contact-sequence, lunge, line, side-handstand, panel-mat, and
progression context. PMID `29343188`, DOI
`10.1080/14763141.2021.1876755`, PMCID `PMC11235812`, PMID `12929780`, the
International Journal of Sport Psychology manual-guidance experiments, and DOI
`10.26858/cpjok.v18i1.524` provide adjacent loading, complexity, impact,
practice-order, guidance, and floor-tape evidence. Preserve their limitations:
small and task-specific samples do not establish one universal hand
orientation, readiness or safety threshold, workout dose, recovery interval,
progression order, transfer outcome, or numeric difficulty score.

Watch `J4DISL56-kI`, `tc6EYwsUaws`, `kdPlscoyYO8`, `dFkTY-ZOSpU`, and
`CZb-afEMaIc` in full. Current YouTube oEmbed responses establish only title,
channel, thumbnail, iframe, and link health. Record exact definition/variant,
side, start, marks, hand orientation, support, wall or spotter contact,
turnover, foot order, finish, captions, accessibility, demonstration and cue
quality, safety concerns, conflicts, reviewer identity, rationale, timestamp,
and card-version match. Do not infer exactness or approval from title, channel,
or successful embedding.

Independently adjudicate all 32 alternate assessments, eight relationship
proposals, and six complexity/physical-difficulty anchors. Give particular
scrutiny to the wall-assisted contact contract, T-shape hand-orientation claim,
partial returns, panel-mat step-overs, finish-only work, hurdle entries,
Round-Off snap-down, static Handstands, Donkey Kicks, and unmarked Cartwheel
skill performance. Separate qualified content review and publication approval
remain mandatory.

## Gymnastics Back Bridge Hold human-review packet

Review floor bilateral, fixed low-step feet-elevated bilateral, and floor one-
leg-straight-up side-specific variants separately. Verify supine entry, exact
hand/foot marks and orientation, support height, free-leg side and shape, head
and neck clearance, elbow/leg contract, surface and friction, timer start,
breathing, first invalidating event, controlled lowering, assistance policy,
dose, rest, recovery, symptoms, and cumulative bridge/backbend/walkover,
hand-support, overhead, tumbling and loaded-spine-extension exposure. Difficulty
review covers exercise complexity and physical difficulty only; it must not
classify athlete proficiency or modify skill-library levels.

Use “Stretching the Spines of Gymnasts: A Review” for bridge terminology and
multiregion extension context. Treat the dynamic spinal-ROM/back-pain and
three-gymnast Back Walkover kinematic studies as adjacent evidence only. The
young-gymnast flexibility study, CanJump manual, Gymnastics Ontario rules,
British Gymnastics action list, and Sydney Sports and Exercise Physiology
instruction provide limited test, position, action-boundary, curriculum, and
professional context. None establishes one universal geometry, eligibility or
safety threshold, tissue load, workout dose, recovery interval, progression
order, injury effect, transfer outcome, or numeric difficulty score.

Watch `TrxZLshL0Ec`, `aozR72_L16g`, `tSvmWU-0Zo0`, and `usyrUMFhLUc` in full.
Current oEmbed responses establish only title, channel, thumbnail, iframe, and
link health. Record exact static card and variant, entry, supports, height,
side/free-leg geometry, head contact, valid hold, exit, captions,
accessibility, demonstration/cue quality, safety concerns, conflicts, reviewer
identity, rationale, timestamp, and card-version match. Do not infer playback,
exactness, accessibility, captions, quality, or approval from oEmbed health.

Independently adjudicate all 32 alternate assessments, eight relationship
proposals, and six complexity/physical-difficulty anchors. Give particular
scrutiny to hands-elevated or assisted variants, unilateral free-leg geometry,
standing entry, Handstand entry, Kickover, Walkover, dynamic pressing or
walking, head/forearm support, and the separation from Glute Bridge, Crab
Reach, Arch Hold, and Back Extension. Separate qualified content review and
publication approval remain mandatory.

## Bar Cast and Cast-to-Handstand human-review packet

Review all seven working specifications separately: Bar Cast below horizontal,
to horizontal, and above horizontal/sub-handstand; then assisted straddle,
assisted straight-body, independent straddle, and independent straight-body
Cast to Handstand. Verify the exact single rail, closed overgrip, mount and
front-support start, hip clearance, shoulder and hip timing, body shape, peak
reference or vertical tolerance, assistance, return or declared exit, valid
repetition, first fault, apparatus/mat/clearance inspection, dose, rest,
recovery, symptoms, and cumulative bar-support, grip, upper-extremity and
inversion exposure. Difficulty review covers exercise complexity and physical
difficulty only and must not classify an athlete or modify skill-card levels.

Use the World Gymnastics WAG Code 2025–2028 to review straddle/bent-hip versus
legs-together extended cast distinctions and terminal-handstand form. Use the
July 2025 USA Gymnastics optional replacement pages for current amplitude
rules, the 2023 compulsory replacement pages for assisted cast-to-handstand
action detail, and British Gymnastics East Midlands 2026 rules for amplitude
and adjacent-action boundaries. Treat the upper-extremity injury review, youth
gymnast injury retrospective, and subject-specific uneven-bar model as limited
population or adjacent biomechanics evidence. None establishes universal
eligibility, assistance, dose, recovery, safety, injury, transfer, or numeric
difficulty values.

Watch the Bar Cast candidates `0e0CAHk57IY`, `H9HXXXTGXuI`, and
`RGdJYHGA_n0`, and the Cast-to-Handstand candidates `NBqHxIRKJZI`,
`NrVhnMiYg7w`, and `jiHZCy1lLvY`, in full. Current YouTube oEmbed responses
establish only title, channel, thumbnail, iframe metadata, and link health.
Record exact definition/variant, action sequence, assistance, captions,
accessibility, demonstration and cue quality, safety concerns, conflicts,
reviewer identity, rationale, timestamp, and card-version match. Do not infer
playback, exactness, quality, accessibility, captions, or approval from oEmbed.

Independently adjudicate all 28 alternate assessments, 14 relationships, 14
complexity/physical-difficulty anchors, and five neighbor boundaries. Give
particular scrutiny to the return-versus-terminal-handstand boundary; basic
amplitude variants; assistance and body-technique variants; and separation from
Kips, static supports, circles, undershoots, turns, releases, mounts, and floor
or wall Handstand work. Separate qualified content review and publication
approval remain mandatory.

## Handstand Snap-Down source-18 review packet

Review the exact `Handstand Snap-Down to Feet-Together Stick` family, not the
legacy mixed `Round-Off Snap-Down Shape Drill` name. Confirm whether each
working variant starts only after either back-to-wall heel-contact or
independent freestanding two-hand support is established; whether the scored
action is tall shoulder push plus joined-leg snap; whether the hands release
before simultaneous feet; and whether the endpoint is an upright hollow feet-
together no-rebound stick. Record support, wall and assistance contact, hand
slide/regrasp or collapse, leg shape, turn, release timing, foot synchrony,
stick, rebound/step/fall/connection, bailout, symptoms, first fault, and every
valid, invalid, partial, assisted, or incident exposure.

Use USA Gymnastics July-2025 compulsory replacement text for current full
Round-Off and adjacent snap-down/rebound action boundaries; Masaryk Safe
Gymnastics for the full Roundoff approach, asymmetric leg/hand sequence, turn,
push, joined legs, and feet-together landing; CanJump for separately named
Handstand Snap-Down and rebound sequences; Special Olympics for population-
specific communication and lead-up coaching; and the registered handstand,
upper-extremity, tumbling-load, and skill-complexity research only for their
narrow studied claims. None independently establishes this exact standalone
working card, universal technique, eligibility, assistance, safe dose, contact
ceiling, recovery interval, outcome, transfer, or numeric difficulty.

Watch `7r-UOQi8YvE`, `BnnX00Hlqpk`, `D6bbi5bv0TY`, and `dqEZV4DW8aU` in full.
Current oEmbed metadata establishes only title/channel/thumbnail/embed response
health. Record exact definition and variant, start support, wall and coach
contact, hand support and release, snap action, simultaneous feet, endpoint,
captions, accessibility, demonstration and cue quality, safety concerns,
conflicts, reviewer identity, rationale, timestamp, current playback, and card-
version match. Keep all four rows candidate-only until that record exists.

Independently adjudicate all 24 alternate assessments, eight graph proposals,
four complexity/physical-difficulty anchors, and eight neighbor boundaries.
Pay special attention to full Round-Off, Round-Off rebound, connected Round-
Off/back-handspring, back-handspring snap-down, snap-down-to-rebound/back,
Power Hurdle entry, Cartwheel, static Handstand Holds, Handstand Kick-Up,
Standing Snap-Down, Donkey Kick, hand pop, unilateral landing, and altered
terminal states. A Round-Off skill-library link does not import a proficiency
level onto the exercise. Separate qualified content review and publication
approval remain mandatory after all candidate decisions.

## Lache / Tap Swing / Lache Precision source-19 review packet

Review three distinct working cards. For `Two-Bar Lache Transfer to Retained
Catch`, confirm bilateral closed overgrip, active source hang, hollow–arch tap,
simultaneous release, no turn/flip, declared target height, bilateral catch,
and retention to the first rearward apex. For `Bar Hollow–Arch Tap Swing`,
confirm one-bar no-release support and the exact matching bottom-crossing full-
cycle endpoint. For `Lache Precision to Two-Foot Stick`, confirm source-bar
release, no target hand contact, simultaneous feet on the declared low target,
and a two-second no-step/no-fall stick. The closed-overgrip and endpoints are
conservative Vortex working contracts requiring review, not universal rules.

Use the World Gymnastics 2021 Parkour Age Group manual and 2025 Table of Tricks
to distinguish swing, Tap Swing, Lache Precision, turns, dynamic entries, and
dismounts without copying age or acquisition levels. Use UrbanLeap pages
151–154 for direct Lache transfer action, same/higher/lower target progression,
faults, apparatus, and safety scope; it is a professional Erasmus+ handbook,
not EU or universal medical approval. Treat the Gervais/Baudin release study,
Kovacs release/regrasp paper, pull-up/scapular work, hangboard endurance,
upper-extremity review, and parkour injury survey as adjacent evidence only.
None proves a universal grip, release instant, catch rule, dose, recovery,
eligibility threshold, progression order, outcome, or numeric difficulty.

Watch all 15 candidates in full. Retained-catch IDs are `3o0NrxeRCsk`,
`FuNZG4yF1jo`, `NrC-TbmShKQ`, `HMGZNRRTV4s`, and `PmGur4Nfzfc`; Tap Swing IDs
are `SYdukm1xvEY`, `8epKPyb1e4g`, `rCe1Z0C9WnI`, `lcAyqMk4l7w`, and
`yl2IawdA00o`; Precision IDs are `s0Xbm2An7W4`, `FHwls3YJ1_U`, `EDnsNRgcggo`,
`zpVjQTemsJk`, and `4I5ZJ1-qSH0`. Current oEmbed responses prove metadata
health only. Record full playback, exact definition/variant, grip, source and
target geometry, release/no-release, turn, target contact, endpoint,
assistance, captions, accessibility, demonstration/cue quality, safety,
conflicts, reviewer identity, rationale, timestamp, and card-version match.

Independently adjudicate 38 alternate assessments, 15 identity boundaries, 11
graph proposals, and 12 complexity/physical-difficulty anchors. Pay particular
attention to same-bar regrasp, dismount, half turn, one-arm catch, wall/cat
contact, flipping release, dynamic entry, chained transfers, Dyno, Pole Swing,
Underbar, Giant, Bar Cast, Cast to Handstand, standing Precision Jump, and any
connection before the declared endpoint. Do not infer athlete readiness or a
skill-library level from exercise difficulty. Separate qualified content
review and independent publication approval remain mandatory.

## Precision Jump and Bilateral 360 Jump review packet

Review the no-turn family as one stationary bilateral forward flight ending in
a declared stick. Confirm that the open variant lands on a stable full-foot
surface and the restricted parkour variant lands both forefeet together on the
secured low horizontal target, then holds two seconds without step, shuffle,
hand contact, rebound, fall, or connection. Confirm exact takeoff/target
geometry, arm policy, miss and bailout, assistance, valid/invalid contact,
contact accounting, dose, rest, duration, and stop behavior. Do not infer a
running, unilateral, elevated, gap, rebound, drop, Lache, wall-contact, or
connected interpretation from the generic source label.

Review the 360 definition as a distinct full whole-body turn with declared
direction, forward projection, target reacquisition, final heading, bilateral
contact, stick, and full reset. Confirm open versus low restricted target as
exact support-interface variants. Quarter-turn, half-turn, no-turn, lateral
projection, vertical Tuck or Squat Jump, obstacle clearance, tuck-to-lateral
stick, in-place turn, run-up, unilateral takeoff, rebound, flip, load,
assistance, elevation/gap, and connected exits remain distinct definitions or
separately reviewed exact variants—not silent annotations.

Use the current World Gymnastics 2026 Table of Tricks to support the basic-
versus-360 action boundary and competition difficulty modifiers. Treat those
points as competition values, not Vortex scores. Use the UrbanLeap handbook
for direct educational Precision and 360 technique/progression/fault context;
it is not a universal normative safety standard. Use the seven-traceur
precision-coordination study only for its controlled no-run-up laboratory task,
the ten-traceur 0.75-m drop study only as adjacent landing-load evidence, the
15-participant 100-standing-long-jump study only as deliberately fatiguing
exposure evidence, and rotational-landing research only as adjacent evidence.
None establishes universal eligibility, safety, target geometry, dose,
recovery, progression order, outcome, or numeric difficulty.

Watch all ten candidates completely. No-turn IDs are `0M10agVeUzw`,
`Fhz-s_Hqo8I`, `9sb4TYNHGio`, `FFgenf0h-3M`, and `opS9-hg9Rzc`. Full-turn IDs
are `C4402xYqsXM`, `sB-XldxEVes`, `_ZXj9H_45po`, `jgkdLk_IuEQ`, and
`LSpKH0qsz6E`. oEmbed metadata and iframe health prove neither playback nor an
exact card/variant match. Record start, approach, takeoff, direction, rotation,
projection, target geometry, contact, stick, endpoint, assistance, conflicts,
captions, accessibility, cue/demonstration quality, safety, reviewer identity,
rationale, timestamp, and reviewed card version.

Independently adjudicate 41 alternates, 13 migration-owned identity decisions,
12 migration-487 graph proposals, and the 6 new score anchors, plus the two
existing open-variant anchors included by the packet. Verify all 32 evidence
applications and all working coach/athlete/support content. Complexity and
physical difficulty are exercise-task scores only; athlete readiness remains a
workout input and skill-library levels remain on skill cards. Separate content
review and publication approval are mandatory.

## 90/90 breathing-family source-21 review packet

Review three distinct cards and four exact variants. For `Supported 90/90
Breathing with Bilateral Reach`, confirm either both feet on a stable wall or
the calves/heels fully supported on a nonrolling bench/box, hips and knees near
90 degrees, both arms reaching without shrug, no prescribed heel pull or hip
lift, a comfortable inhale, longer unforced exhale, and comfortable reset. For
`90/90 Wall-Supported Breathing with Lateral Expansion`, confirm both hands
remain on the lower lateral ribs and no arm reach is scored. For `90/90 Hip
Lift with Ball and Balloon`, confirm the exact right-arm-overhead/left-hand-
balloon laterality, heel pull, small lift, ball pressure, resisted exhale,
reinhalation protocol, hygiene/material controls, and separate endpoint.

Use Functional Movement Systems only for its direct lateral-expansion
instruction; VA guidance for general comfortable diaphragmatic-breathing
instruction; the 2018 and 2026 reviews for heterogeneous slow/diaphragmatic-
breathing findings and limitations; the postural-task MRI study only as
indirect diaphragm-function evidence; Boyle et al. only as a clinical
suggestion for the ball-and-balloon sequence; and ACOG for the current caution
around prolonged supine exercise after 20 weeks of pregnancy. None establishes
a universal posture, structural reset, treatment effect, athletic transfer,
eligibility rule, safe dose, recovery interval, progression order, or numeric
difficulty for these exact cards.

Watch all 15 candidates completely. Reach IDs are `GZ6X2M6gRvQ`,
`O-cf22YQzAg`, `QN77knnBw8o`, `yFGJI00OZ8k`, and `kA6AtZkDxmg`. Lateral-
expansion IDs are `AnvRX080sR4`, `V6Zrlo5w7oY`, `xzzJgFbgexc`, `K2wKibekVbA`,
and `8UAOFVQIqYQ`. Ball-and-balloon IDs are `4GoqjoEXaAw`, `zL1Hmkt7aJA`,
`lcZp3gEz5_s`, `U1AG5y81VcQ`, and `-zxaq9lANYg`. Current oEmbed responses
prove title/channel/thumbnail/embed metadata only. Record full playback, exact
definition/variant, support, arm and hand contacts, heel/lift/ball/balloon
actions, laterality, breath cycle, endpoint, captions, accessibility,
demonstration/cue quality, safety, conflicts, reviewer identity, rationale,
timestamp, and reviewed card version.

Independently adjudicate all 48 evidence applications, 58 alternates, 20
identity decisions, 10 graph proposals, and 8 complexity/physical-difficulty
anchors. Give special scrutiny to source 1404's unresolved `Hip Reset` label;
wall versus fully supported reach; reach versus hands-on-ribs no-reach; the
active heel-pull/lift/ball/balloon sequence; and boundaries with Hip Switch,
Crocodile Breathing, Dead Bug, Box Breath, and Med Ball Belly Breathing. Do not
infer athlete readiness or a skill-library level from exercise difficulty.
Separate qualified content review and independent publication approval remain
mandatory.

## Crocodile Breathing source-22 review packet

Review one prone breathing identity with three exact support/feedback variants.
Confirm the face remains clear, forehead rests on stacked hands, upper body and
legs remain relaxed, and one repetition is a comfortable nasal inhale into
abdominal/lower-rib floor feedback, a slow unforced nasal exhale, and a
comfortable reset. For the bolster variant, confirm stable nonrolling lower-
leg support without changing the repetition. For the band variant, confirm
light nonrestrictive circumferential feedback that does not impede breathing.
Optional cadence, pause, dose, pursed-lip exhale, or consented coach touch must
remain delivery annotations only when they preserve the same breath cycle.

Use the Functional Movement Systems Crocodile Breathing materials for direct
exercise/instruction context and Aliverti et al. only for the measured prone-
versus-supine chest-wall mechanics in its studied sample. Do not turn either
source into universal treatment, structural-reset, performance-transfer,
eligibility, dose, recovery, progression, safety, or numeric-difficulty claims.
Weighted cuffs remain quarantined until load, placement, pressure, fit,
contraindications, and stop behavior are specified and independently reviewed.

Watch all five candidates completely: `2mCwbWPtICI`, `76-Sw5nZ2YI`,
`_8f9RHUfE1Q`, `aimIzymb81E`, and `XhYrGbEI2c8`. Current oEmbed metadata proves
neither playback nor exact card/variant match. Record posture, face clearance,
hand/forehead contact, support or band placement, breath cycle, endpoint,
assistance/touch, conflicts, captions, accessibility, cue/demonstration
quality, safety, reviewer identity, rationale, timestamp, and reviewed card
version.

Independently adjudicate all 16 evidence applications, 20 alternates, 9
relevant identity boundaries, 8 graph proposals, and 6 complexity/load
anchors. Verify coach/athlete/support content and the flat, bolster, and band
difficulty vectors `18/4/18`, `20/3/20`, and `24/5/24`. Exercise difficulty is
not an athlete proficiency level. Separate qualified content review and
independent publication approval remain mandatory.

## 2026-08-02 — Source 24 Neck CARs human-review packet

The registry is `2026-08-02.92` / 391 sources. Sixteen candidate evidence
applications draw on ACE professional CARs guidance, the Kinstretch starter
pack, the 2025 nonspecific-neck-pain clinical practice guideline, and a 2019
cervical-range/compensation study. Reviewers must keep these scopes separate:
the professional sources support slow deliberate active comfortable motion and
compensation awareness; the clinical sources supply studied action/plane and
warning context only. None establishes one universal path/range, universal
dose/frequency/recovery, eligibility, outcome, injury prevention, progression
order, or Vortex difficulty score.

Watch all five candidates fully before any media state changes:

- `J3tkQ4pk_Sc`;
- `c-zu1t-NsSo`;
- `iIt5_T8HM_Q`;
- `4wV_Jkk34ho`;
- `xqBwoN7AglQ`.

Current oEmbed health proves title/channel/thumbnail/embed metadata only, not
playback or exactness. Record exact full cervical path, selected standing or
seated base, directions, range policy, compensation, symptoms/stops, dose,
captions, accessibility, cue/demonstration quality, safety, conflicts,
reviewer identity, rationale, timestamp, and card-version match.

Independently adjudicate all 16 evidence applications, 20 alternates, the
source-897 duplicate and source-898 distinct decisions, 5 graph proposals,
and 4 complexity/physical-difficulty anchors. Verify the standing `28/4/28`
and seated `24/3/24` vectors, coach/athlete/support content, all instruction
lengths, and every stop/incident/persistence rule. The automated packet must
retain exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
`CARD-PUBLISH-01` until qualified review. Separate content review and
independent publication approval remain mandatory.

## 2026-08-09 — Source 30 Wrist Rockers — Palms Down human-review packet

Registry `2026-08-09.97` contains 409 sources. Sixteen candidate evidence
applications use USA Gymnastics for the kneeling palms-on-floor forward rock,
Prehab Guys for the quadruped fingers-forward controlled shoulder shift, wrist-
loading biomechanics for adjacent support-condition context, and a systematic
review for the limited-certainty wrist-pain/injury context in adolescent
gymnastics. None approves a Vortex identity, score, universal eligibility,
hand width, finger spread, range, pressure, dose, outcome, or publication
claim.

Watch all five candidates in full before changing any media state:

- `9KYKYqoVBSA` — Tangelo, “How To Do The Wrist Rockers Mobility Exercise”;
- `5mil82fqj30` — Matthew Stevens, “Wrist Rocks | Wrist Exercise”;
- `54khDyn0qn8` — Dr. Jordan Weber, “Quadruped Wrist Extension Rocks”;
- `O_S9TKHwnsE` — W10 Personal Training Gym, “Wrist rocks”;
- `4dRox1rxhfU` — Caroline Juster, “Wrist Rockers”.

For each candidate, record full playback; quadruped base; palms-down and
fingers-forward orientation; whole-hand and knee contacts; controlled forward
wrist-extension load; complete backward return; count rule; range; pace;
breathing; any circles, palm lifts, holds, changed support, force, or other
actions; stops; captions and accessibility; cue/demonstration quality; safety
conflicts; reviewer; rationale; timestamp; and exact card-version match.
oEmbed title, channel, thumbnail, and iframe health are not exactness or
approval.

Independently adjudicate all 16 evidence applications, 20 alternates, 4
neighbor identity boundaries, 4 graph proposals, and both exercise-complexity/
physical-difficulty anchors. Verify `22/16/22`, both delivery profiles,
actual-duration and cumulative wrist/hand-support budgets, all coach/athlete/
accessibility/support content, and every stop, incident, persistence, and
substitution rule. The packet must retain exactly `CARD-MEDIA-01`,
`CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified
review. Separate content review and independent publication approval remain
mandatory.

## 2026-08-02 — Source 23 Full-Body Joint CARs human-review packet

The registry is `2026-08-02.91` / 390 sources. Sixteen candidate evidence
applications draw on ACE professional CARs guidance, the Kinstretch starter
pack, a full-body Kinstretch follow-along, the 2025 nonspecific-neck-pain CPG,
and YouTube's official embed documentation. Reviewers must keep their scopes
separate: professional material supports slow, deliberate, active, pain-free,
momentum-limited rotations and compensation awareness; the CPG supplies
clinical warning context only; none validates the exact Vortex eight-region
order, universal dose, eligibility, outcomes, recovery interval, or difficulty
score.

Watch the four candidates in full before any media state changes:

- `6p1OHgpmVwU` — The Jiu-Jitsu Therapist, “Full Body CARs Routine”;
- `AyJ3omVBIho` — Melissa Ray Fitness, “Morning Routine - Functional Range
  Conditioning - Full Body CARs”;
- `m9Ar5qvCUbg` — Vegan CornHub, “Follow-Along FULL BODY CARS Routine (30
  min)”;
- `p_WqlqgfNrc` — Breathe and Flow, “Mobility Routine for Every Day and Every
  Joint! (Full Body CARS)”.

Current oEmbed title/channel/iframe health is not playback or exactness
approval. Record complete-sequence match, region order, joint actions,
directions, sides, support/base, momentum and compensation, neutral
checkpoints, dose, captions, accessibility, cue/demonstration quality, safety,
conflicts, reviewer identity, rationale, timestamp, and card-version match.

Independently adjudicate all 16 evidence applications, 20 alternates, 8
identity boundaries, 6 graph proposals, and 4 complexity/physical-difficulty
anchors. Verify the independent `38/8/38` and wall-supported `42/6/42` vectors,
coach/athlete/support content, the 238-character athlete instruction, and every
stop/incident/persistence rule. The automated packet must retain exactly
`CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
`CARD-PUBLISH-01` until qualified review. Separate content review and
independent publication approval remain mandatory.

## 2026-08-02 — Source 25 Cat-Cow human-review packet

The registry is `2026-08-02.93` / 396 sources. Sixteen candidate evidence
applications draw on ACE direct Cat-Cow instruction, the Academy of Orthopaedic
Physical Therapy low-back-pain guideline, a 2024 healthy-adult IMU measurement
study, one NASM example warm-up, a Special Olympics cool-down demonstration,
and YouTube's embed documentation. Reviewers must preserve scope: ACE supports
the recognizable quadruped phases and setup; the guideline supplies clinical
selection/red-flag context, not a Cat-Cow prescription; the twelve-man IMU
study supports cycle measurement, not technique or outcomes; and NASM/Special
Olympics show example contexts only. None establishes universal spinal shape,
segmental order, range, breath phase, dose, frequency, recovery, eligibility,
treatment effect, progression, prevention, or a Vortex score.

Watch all five candidates in full before any media state changes:

- `1Y0YjXS9sKI` — Hinge Health;
- `8kUU_odEY3o` — MGHOrthopaedics;
- `T0MsxeAROUQ` — Medbridge;
- `d_k1g-SJR-4` — E3 Rehab Exercise Library;
- `bKYGb1TgS6o` — The Jiu-Jitsu Therapist.

Current oEmbed title/channel/thumbnail/iframe health is not playback or
exactness approval. Record full playback; standard versus ordered-segmental
variant; hands-and-knees support; flexion, reversal, extension, and neutral
return; phase counting; range; breathing; support shift; added actions; stops;
captions; accessibility; cue/demonstration quality; safety; conflicts; reviewer
identity; rationale; timestamp; and card-version match.

Independently adjudicate all 16 evidence applications, 20 alternates, the
Source-889 duplicate and Source-26 distinct decisions, 5 graph proposals, and
4 complexity/physical-difficulty anchors. Verify standard `24/10/24` and
segmental `34/10/34`, the 202- and 220-character athlete instructions,
coach/athlete/accessibility/support content, cumulative budgets, every stop and
incident rule, and complete substitution revalidation. The automated packet
must retain exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
`CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified review. Separate
content review and independent publication approval remain mandatory.

## Source 46 Short-Foot review queue

Review the three exact Source 46 variants separately: standing hands-free,
standing light wall touch, and seated stable-bench. Validate one target foot,
heel/first-metatarsal-head/fifth-metatarsal-head/long-toe contacts,
metatarsal-head-to-heel shortening, visible arch elevation, absence of toe
curl or lift and ankle rotation, prescribed submaximal hold, breathing,
controlled full relaxation, side-specific repetition and hold-second
recording, first fault, symptoms, actual duration, station reset, and exit.

Independently adjudicate all 16 evidence applications, 28 alternates, 5
deterministic neighbor boundaries, 8 graph proposals, and 6 task-complexity
or physical-difficulty anchors. Direct doming mechanics and learning evidence
do not establish a universal workout dose, recovery interval, outcome,
participant threshold, or Vortex score. Maximal strength testing and
instrumented biofeedback are adjacent protocols, not automatic workout
prescriptions.

Five candidate videos have current YouTube oEmbed metadata only. A qualified
human must watch each in full and record exact variant, support, contacts,
arch action, toe behavior, hold, return, count, compensations, captions,
accessibility, cue quality, safety conflicts, reviewer, rationale, timestamp,
and card-version match. Retain exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
`CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until those separate human gates
are complete.

## Source 45 Toe Yoga qualified-review queue

Qualified reviewers must watch `SbQ2RYxbppE`, `QVZpBSVV9js`,
`bUoTjK0tQEw`, `SkFZ5zVXGEo`, and `kp8QI1Uj59Q` from start to finish and
assign each supported clip to an exact standing hands-free, standing
wall-touch, or seated-bench variant. Record playback, target-foot laterality,
heel and metatarsal-head contacts, great-toe phase, lesser-toe phase,
controlled returns, complete-cycle count, side-specific count, toe curling or
non-target movement, body compensation, support contacts, captions,
accessibility, cue quality, safety conflicts, reviewer, rationale, timestamp,
and exact card-version match. Current oEmbed metadata proves none of those
content properties and is not approval.

Independently adjudicate all 16 evidence applications, 28 alternate
assessments, 5 identity decisions, 8 graph proposals, and 6 difficulty
anchors. Verify the standing hands-free `42/8/42`, wall-touch `38/7/38`, and
seated `34/5/34` exercise-complexity / physical-difficulty / derived-overall
contracts; all 4 contextual delivery profiles; dosage and actual-duration
models; surface hygiene, toe visibility, wall and bench logistics; cumulative
foot, toe, calf, balance, running, landing, jumping, agility, and lower-body
budgets; substitutions; persistence; coach, athlete, accessibility, user-
support, and operations content; clinical scope; and every quality gate and
stop rule. These scores assess tasks only and must not become participant
skill, proficiency, age, readiness, or eligibility labels.

Retain exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
`CARD-PUBLISH-01` until qualified review and separate publication approval
are complete. Do not infer that the laboratory repetition exposure is a
universal dose, that standing variants have the same evidence strength as the
seated task, that perfect toe isolation is required, or that the exercise
diagnoses, treats, prevents injury, or proves sport readiness.

## Source 44 Standing Calf Raise qualified-review queue

Review migration 520 and packet
`scripts/data/canonical-research/generated/standing-calf-raise/standing-calf-raise.v1.json`
against the exact Source 44 contract. Independently adjudicate the three
duplicate-definition decisions and six distinct-neighbor decisions; all 16
evidence applications; all 28 alternate classifications; both prepare and
capacity profiles; task vector `22/32/32`; load, fatigue, recovery, cumulative
budgets, duration, logistics, quality, stop, persistence, accessibility,
athlete, coach, and support-operations fields; all four graph proposals; and
both calibration anchors. Do not copy participant skill or proficiency
metadata from legacy exercise rows or skill-library cards.

Qualified reviewers must watch candidates `_B6o13eoAuU`, `88D6QOBlCWA`,
`Dgf9hougTdc`, `CtpPV2FBkG4`, and `584joZQZvRg` from start to finish and record
playback; stable wall and hand support; bilateral flat-floor stance; full-foot
start and finish; forefoot pressure; mostly straight knees; simultaneous heel
rise; comfortable height; brief untimed checkpoint; controlled return; exact
count; all compensations; captions, transcript, still sequence, and audio-
description suitability; cue and demonstration quality; safety and scope
conflicts; reviewer identity; rationale; timestamp; and exact card-version
match. The last candidate's osteoporosis framing requires explicit scope
review. Current oEmbed records prove metadata and embedding availability only.
Eccentric-only videos `XQACBWaIino` and `3tc0lN_bW5o` are adjacent candidates,
not exact Source 44 media.

The packet must retain exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
`CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified review. Separate
content review and independent publication approval remain mandatory.

## Source 42 Ankle CARs qualified-review queue

Review all five candidate videos in full: `BDNGAnp7u7s`, `fyShbLKXMkY`,
`M2hhS_XJjww`, `IYdRxX95vNE`, and `gLtItpjgi3M`. Record playback; stable
seated bench and target-thigh support; non-target-foot support; target-foot
clearance; active rather than assisted motion; declared start; inversion,
plantarflexion, eversion, and return order; reverse direction; quiet tibia,
knee, pelvis, and trunk; exact count; pace; breathing; symptoms and stops;
side change and transfer; captions; accessibility; cue and demonstration
quality; safety; conflicts; reviewer identity; timestamp; card version; and
approval rationale. oEmbed metadata is not playback or exactness review.

Review the 16 evidence sections and explicitly preserve their limits. Active
ankle ROM, ankle biomechanics, and general CAR instruction do not validate one
universal seated geometry, range, path, knee angle, tempo, dose, frequency,
fatigue ceiling, recovery interval, progression, eligibility rule, warm-up
outcome, injury-prevention claim, performance transfer, or Vortex score.

Adjudicate all 24 alternate assessments, seven distinct-identity decisions,
four relationship proposals, and two calibration anchors. Confirm that Neck
CARs and Standing Single-Arm Shoulder CAR are distinct by anatomical region
and mechanics despite shared terminology. Retain exactly `CARD-MEDIA-01`,
`CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified
review and separate publication approval are complete.

## Source 41 Half-Kneeling Ankle Dorsiflexion Pulse qualified-review queue

Qualified reviewers must watch all five candidates from start to finish:
`Kn-TjcmuzYQ`, `NrZ4NuSlJ88`, `wIUdrQsqhKs`, `yc27kCW8aco`, and
`1uk2j8TyHvk`. Record playback; unloaded half-kneeling support; rear-knee and
lower-leg padding; front heel and tripod; knee path; initial uncounted advance;
comfortable endpoint; small retreat; same-endpoint re-advance; exact pulse
count; hand loading; pace; breathing; symptoms and stops; side change, rise,
and exit; captions; accessibility; cue and demonstration quality; safety
conflicts; reviewer; rationale; timestamp; and card-version match. The
kettlebell title for `wIUdrQsqhKs` and active-lift title and public description
for `1uk2j8TyHvk` are known adjacent-variant signals, not approvals. oEmbed
metadata is not playback or exactness evidence.

Independently adjudicate all 16 evidence applications, 24 alternates, 5
identity decisions, 4 graph proposals, and both complexity/physical-difficulty
anchors. Verify the `22/14/22` core vector and every normalized dimension; the
Prepare & Access and Restore profiles; mat, floor, kneeling, side-change, rise,
and exit logistics; actual-duration formulas; cumulative ankle, calf-Achilles,
knee, kneeling, lower-body, landing, sprint, cut, and kick budgets;
substitutions; persistence; coach/athlete/accessibility/support content;
incident handling; and every quality and stop rule. Difficulty must remain an
exercise assessment, never participant skill, proficiency, age, or readiness.

The packet must retain exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
`CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified review. Separate
content review and independent publication approval remain mandatory.

## Source 43 Wall-Supported Bilateral Tibialis Raise qualified-review queue

Qualified reviewers must watch `RHWRxiBe1iU`, `VzIcGAgBiaM`,
`psaTKDL1zUw`, `k9NvBCZfSWg`, and `0o2GAg2yX5M` from start to finish. For
each candidate, record playback, back and pelvis wall contact, planted heels,
foot position, mostly straight but unlocked knees, simultaneous bilateral
forefoot lift, comfortable active dorsiflexion range, controlled quiet return
to light floor contact, valid repetition count, pace, breathing, faults,
symptoms and stops, captions, accessibility, cue and demonstration quality,
safety conflicts, reviewer identity, rationale, timestamp, and exact card-
version match. Current title, channel, thumbnail, iframe, and oEmbed health
are not playback, exactness, accessibility, quality, safety, or approval.

Independently adjudicate all 16 evidence applications, 26 alternate
assessments, 6 deterministic distinct-task decisions, the ambiguous Sources
214/1113/1399 identity, 4 graph proposals, and both exercise-complexity and
physical-difficulty anchors. Verify the `18/24/24` task vector, Prepare &
Access and Capacity profiles, actual-duration formulas, wall/floor/footwear
and group logistics, cumulative lower-leg and downstream-demand budgets,
substitution revalidation, persistence, coach/athlete/accessibility/support
content, incident handling, and every quality gate and stop rule. Difficulty
must remain an exercise assessment and never become participant skill,
proficiency, age, readiness, or clinical metadata.

Do not automatically merge or substitute unilateral, alternating, bent-knee,
heel-elevated, unsupported, seated, banded, tib-bar, isometric-only,
eccentric-only, heel-walk, ankle-pump, Toe Yoga, calf-raise, clinical, or
sport-added tasks. Retain exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
`CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified review and
separate publication approval are complete.

## Source 40 Knee-to-Wall Ankle Rocker qualified-review queue

Qualified reviewers must watch all five current media candidates from start to
finish: `33-GE3x-xQM`, `ElrpduJn92Y`, `Y1IZXkdPPdw`, `qjrNGnubve4`, and
`YH7xjrkq7ic`. The first candidate's oEmbed title says kneeling and therefore
requires explicit support-position rejection or confirmation. Record playback;
standing staggered support; target heel and tripod contact; rear-foot support;
knee path toward the wall; comfortable rather than forced endpoint; controlled
return; exact repetition count; absence of an isometric press, band force,
rotation, elevation, calf raise, clinical measurement, or added sport action;
pace; breathing; symptoms and stops; entry, side change, and exit; captions;
accessibility; cue and demonstration quality; safety conflicts; reviewer;
rationale; timestamp; and exact card-version match. Current oEmbed metadata is
not playback, exactness, accessibility, safety, or approval evidence.

Independently adjudicate all 16 evidence applications, 24 alternates, 5
identity decisions, 4 graph proposals, and both complexity/physical-difficulty
anchors. Verify the complete `18/12/18` core task vector and additional
normalized dimensions; both delivery profiles; wall and floor logistics;
actual-duration formulas; cumulative foot, ankle, Achilles, calf, knee,
balance, lunge, squat, landing, sprint, cut, kick, and lower-body budgets;
substitutions; persistence; coach/athlete/accessibility/support content;
incident handling; and every quality gate and stop rule. Difficulty must remain
an exercise assessment and must not become participant skill, proficiency,
age, readiness, or clinical metadata.

The deterministic merge of Sources 40, 875, and 1359 does not approve the
card. Confirm that kicking plant/pivot language is contextual unless a physical
sport action is demonstrated, and preserve half-kneeling pulses, isometric
presses, Ankle CARs, foot-tripod shifts, calf raises, band mobilizations, and
clinical tests as separate tasks. Retain exactly `CARD-MEDIA-01`,
`CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified
review and separate publication approval are complete.

## Source 37 Shoulder CAR / Arm Circles qualified-review queue

Qualified reviewers must watch the five Shoulder CAR and four Arm Circles
candidates from start to finish. For Shoulder CAR, record fixed feet, one long
active arm, start, full path, humeral rotation, same-start return, side and
direction, momentum, scapular motion, trunk compensation, range, count,
breathing, symptoms, and stops. For Arm Circles, record simultaneous bilateral
action, declared comfortable height, long elbows, small diameter, direction,
actual seconds or complete revolutions, arm drop, shrugging, trunk motion,
breathing, symptoms, and stops. Also record playback, captions, accessibility,
cue and demonstration quality, safety conflicts, reviewer, rationale,
timestamp, and exact card-version match. oEmbed metadata is not approval.

Independently adjudicate all 32 evidence applications, 43 alternates, 7
identity decisions, 6 graph proposals, and 4 task-difficulty anchors. Verify
Shoulder CAR `30/12/30` and Arm Circles `16/14/16`, all three delivery
profiles, actual-duration formulas, cumulative shoulder/scapular/trunk and
overhead budgets, logistics, substitutions, persistence, coach/athlete/
accessibility/support content, incidents, and every quality and stop rule.
Difficulty must remain an exercise assessment, never participant skill,
proficiency, age, readiness, or clinical eligibility.

Confirm the boundaries from bilateral small Arm Circles, Neck CARs, Quadruped
Shoulder Circles, Full-Body Joint CARs, Dowel Pass-Through, Band External
Rotation, wall slides, pendulums, arm swings, shoulder rolls, loaded/assisted
variants, and clinical assessment. Each packet must retain exactly
`CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
`CARD-PUBLISH-01` until qualified review, comprehension testing, and separate
publication approval are complete.

## Source 36 Bilateral Band External Rotation qualified-review queue

Qualified reviewers must watch all five current candidates from start to
finish. Record playback; fixed-foot standing; unanchored band between both
hands; elbows near 90 degrees; upper arms beside the ribs; grip and wrist
organization; symmetric outward rotation; comfortable range; controlled
return and exact count; trunk and shoulder compensation; band condition,
release, recoil, and eye path; breathing; symptoms and stops; captions;
accessibility; cue and demonstration quality; conflicts; reviewer; rationale;
timestamp; and exact card-version match. Current oEmbed metadata is not
playback, exactness, accessibility, safety, or approval evidence.

Independently adjudicate all 16 evidence applications, 26 alternates, 4
identity decisions, 4 graph proposals, and both exercise-complexity/physical-
difficulty anchors. Verify `26/18/26`; Prepare & Access and Resilience
profiles; band condition and release rules; actual cycles, range, tension,
time under tension, duration, fatigue, recovery, and overlapping shoulder,
rotator-cuff, scapular, grip, pulling, throwing, climbing, hanging, handstand,
pressing, and overhead budgets; logistics; substitutions; persistence;
coach/athlete/accessibility/support content; incidents; and every gate and stop
rule. Difficulty must remain an exercise assessment, not participant skill,
proficiency, or age metadata.

Source 1348 Eccentric Band External Rotation must remain
`needs_human_review` until elbow position, shoulder angle, start, working and
assisted phases, and count are established. Retain exactly `CARD-MEDIA-01`,
`CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified
review and separate publication approval are complete.

## Source 35 Wall Slides with Lift-Off qualified-review queue

Qualified reviewers must watch all five current candidates—`3blA9Ba2TFI`,
`6fCDq1SMhsk`, `DwqcX8VVpkU`, `OKfgrx-Qeqk`, and `ykw9BWnZtlY`—from start to
finish and match each separately against the exact base variant. Record the
standing fixed-foot setup; vertical shoulder-width forearms; elbow start;
continuous bilateral forearm-wall contact during ascent; comfortable overhead
range; required terminal full-arm rather than hands-only lift-off; forearm
replacement; return-to-start count; trunk and lumbar compensation; pace;
breathing; symptoms and stops; captions and accessibility; demonstration and
cue quality; safety conflicts; reviewer; rationale; timestamp; and exact card
version. oEmbed title, channel, thumbnail, iframe, and embedding health are not
playback, exactness, accessibility, content review, or approval evidence.

Independently adjudicate all 16 evidence applications, 26 alternates, 4
Source-35-owned identity decisions, 4 graph proposals, and both exercise-
complexity/physical-difficulty anchors. Verify the `30/16/30` task-only
difficulty vector; both Prepare & Access and Movement Intelligence profiles;
full-cycle repetitions; arm elevation and wall-contact time; duration;
fatigue, recovery, and overlapping overhead, shoulder, scapular, rotator-cuff,
trunk, pressing, throwing, and handstand budgets; logistics; constraints;
substitutions; persistence; coach, athlete, accessibility, and support content;
incident handling; and every quality gate and stop rule. Difficulty must not
be converted into participant skill, proficiency, or age metadata.

Confirm Source 899 as an exact duplicate only against its full description.
Keep Source 1309 quarantined unless a qualified reviewer establishes the
missing wall contacts, path, terminal lift-off, return, and count contract.
Bands, unilateral, half-kneeling, seated, and hands-only tasks require variant
review. Supported no-lift-off reach, foam-roller slide, wall angel, wall
push-up plus, prone Y raise, and clinical assessment remain distinct. Retain
exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
`CARD-PUBLISH-01` until qualified review and separate publication approval are
complete.

## 2026-08-09 — Source 26 Quadruped Spinal Circles human-review packet

The registry is `2026-08-09.94` / 399 sources. Sixteen candidate evidence
applications draw on GMB's direct Quadruped Spinal Circles instructions and
context article, NAPA's adjacent quadruped exercise guidance, a thoracic-
exercise systematic review, the Academy of Orthopaedic Physical Therapy low-
back-pain guideline, and YouTube's embed documentation. Preserve scope: GMB
supports the recognizable task and one example dose; NAPA supports support-
change boundaries; the review supports explicit plane classification; and the
guideline supplies clinical selection/red-flag context only. None establishes
universal circle shape, required axial rotation, normal range, dose, frequency,
recovery, eligibility, treatment, outcome, progression, prevention, or a
Vortex score.

Watch all five candidates in full before any media state changes:

- `F8tiHAb_WQI` — ZOAR Fitness, “Quadruped Spine Circles”;
- `LywxamPqa9k` — Matt Gray, “Quadruped Spine Circles”;
- `b4fwyPYXFkY` — Functional Strength Training Centre, “Quadruped Spinal
  Circles”;
- `u2HkVRxxioA` — LL Calisthenics Coaching, “Quadruped Spine Circle”;
- `vdgvP8CqwRw` — Nunn Performance, “Quadruped Spine Circles”.

Current oEmbed title/channel/thumbnail/iframe health is not playback or
exactness approval. Record full playback; fixed bilateral hand-and-knee
contacts; rounded, named-side, arched, opposite-side, and counted-rounded
checkpoints; both directions; range; pace; breathing; pelvic/scapular/head
coupling; added axial rotation or other actions; dose; stops; captions;
accessibility; cue and demonstration quality; safety; conflicts; reviewer
identity; rationale; timestamp; and card-version match.

Independently adjudicate all 16 evidence applications, 20 alternates, 4
relevant identity boundaries, 4 graph proposals, and 2 complexity/physical-
difficulty anchors. Verify `32/12/32`, the 219-character athlete instruction,
coach/athlete/accessibility/support content, cumulative budgets, and every
stop/incident/persistence rule. The automated packet must retain exactly
`CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
`CARD-PUBLISH-01` until qualified review. Separate content review and
independent publication approval remain mandatory.

## 2026-08-09 — Source 28 Side-Lying Open Book human-review packet

The registry is `2026-08-09.95` / 402 sources. Sixteen candidate evidence
applications use Leeds Teaching Hospitals NHS and Dynamic Health NHS for the
recognizable Open Book setup and open-return action; a side-lying
thoracolumbar-rotation reliability study for the warning that thoracic motion
is difficult to isolate; a thoracic-exercise systematic review for adjacent
task classification; the AOPT low-back-pain guideline for clinical scope and
red-flag context; and YouTube embed documentation for metadata behavior only.
None validates one universal leg angle, isolated thoracic motion, a hand-to-
floor endpoint, cervical strategy, breathing phase, dose, frequency, recovery,
treatment effect, eligibility, progression, prevention, or Vortex score.

Watch all five candidates in full before any media state changes:

- `gooXfQYTV-0` — Tony Gentilcore, “TonyGentilcore.com Side Lying Open Book”;
- `Bik7s2SZo_U` — Brill Physical Therapy, “Side Lying Open Book”;
- `xznlno1QVuU` — Proactive Pelvic Health Centre, “Thoracic Rotation Exercise
  3: Side-lying Open Book”;
- `3Cyd4iYLuKo` — Champion Physical Therapy and Performance, “Side Lying Open
  Book”;
- `DO94-QTeyrM` — Forté Sports Medicine and Orthopedics, “Side Lying Open Book
  / Thoracic Rotation”.

Current oEmbed title/channel/thumbnail/iframe health is not playback or
exactness approval. Record full playback; side-lying base; bent stacked knees;
straight forward-stacked arms; top-arm path; rib-cage/trunk action; comfortable
range; pelvis and lower-body stability; hand-restack count; both sides; pace;
breathing; gaze/head strategy; props; added actions; stops; captions;
accessibility; cue and demonstration quality; safety; conflicts; reviewer;
rationale; timestamp; and exact card-version match.

Independently adjudicate all 16 evidence applications, 20 alternates, both
duplicate consolidations and all neighboring identity boundaries, 4 graph
proposals, and 2 complexity/physical-difficulty anchors. Verify `22/10/22`,
coach/athlete/accessibility/support content, actual-duration and cumulative
budgets, every stop/incident/persistence rule, and full substitution
revalidation. The packet must retain exactly `CARD-MEDIA-01`,
`CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified
review. Separate content review and independent publication approval remain
mandatory.

## 2026-08-09 — Source 29 Inchworm Walkout human-review packet

Registry `2026-08-09.96` contains 405 sources. Sixteen candidate evidence
applications use ACE for a recognizable Inchworm sequence, added-push-up and
traveling-return boundaries, and small-step/support cautions; Oxford Health NHS
for a standing walk-out-to-plank sequence; Special Olympics for a hands-out/
feet-in traveling example; peer-reviewed dynamic-stretching and low-back-pain
guidance for limited programming and scope context; and YouTube documentation
for metadata behavior only. None approves Vortex identity, score, universal
dose, outcome, eligibility, cumulative budget, or publication claims.

Watch all five candidates in full before changing any media state:

- `BXRL_AC8om4` — Performance Course, “Inchworm Walkout”;
- `ttxQ_UPOwWc` — Movement As Medicine, “Inchworm Walkout”;
- `aFkv2m9FTGs` — PureGym, “How To Do Inch Worm Exercise”;
- `-FW8DNKsAh8` — LivestrongWoman, “Walkout”;
- `ZvhfaibmpwU` — Performance Course, “Inchworm Walkout”.

For each candidate, record full playback; stationary or traveling return mode;
standing start and finish; hinge/knee strategy; hand and foot sequence; high-
plank checkpoint; whether a push-up, jump, pike, lunge, rotation, load, or other
action is added; count rule; traction and lane safety; pace; breathing; stops;
captions and accessibility; cue and demonstration quality; conflicts; reviewer;
rationale; timestamp; and exact card-version match. oEmbed title, channel,
thumbnail, and iframe health are not exactness or approval.

Independently adjudicate all 16 evidence applications, 20 alternates, both
return-mode identities and all 5 neighboring boundaries, 5 graph proposals,
and 4 exercise-complexity/physical-difficulty anchors. Verify stationary
`30/24/30` and traveling `34/26/34`, all four profiles, actual-duration and
cumulative budgets, coach/athlete/accessibility/support content, and every
stop, incident, persistence, and substitution rule. The packet must retain
exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
`CARD-PUBLISH-01` until qualified review. Separate content review and
independent publication approval remain mandatory.

## 2026-08-09 — Source 31 Wrist Rockers — Backs of Hands Down / Wrist-Flexion Bias human-review packet

Registry `2026-08-09.98` contains 410 sources. Sixteen candidate evidence
applications use GMB's rear-facing palms-up wrist instructions and USA
Gymnastics' back-of-hand kneeling rock for direct identity, setup, action,
comfort, and stop context. Wrist-support biomechanics and the adolescent
gymnastics wrist-injury review are adjacent loading, symptom, exposure, and
evidence-certainty context only. None approves a Vortex identity, score,
universal eligibility, range, pressure, dose, recovery, prevention, treatment,
outcome, or publication claim.

Watch all five current candidates in full before changing any media state:

- `GYlgQSLqNRI` — Chris Gaines, “Wrist Prep, Palms up, Fingers facing
  backwards”;
- `MGmCC35rSB8` — its.maddymartinez, “Palms up Fingers Facing you Wrist
  Stretch - Reduce Wrist and Forearm Pain!”;
- `CjPVImbUXfA` — Flux, “Rear Facing Wrist.mp4”;
- `M9UC3QezhCo` — McG, “Wrist Rocks - forward, backward, inside, palms up”;
- `PNRoKMw96Ew` — Tangelo, “Wrist Prep Routine + Wrist Rockers - Kinetic
  Sports Rehab”.

For each candidate, record full playback; bilateral quadruped base; backs of
hands down, palms up, and fingers toward knees; dorsal-hand and finger contact;
very light pressure; backward shift and full forward return; comfortable
wrist-flexion range; count rule; pace; breathing; any orientation change,
circles, palm lifts, holds, raised support, load, or other action; stops;
captions and accessibility; cue/demonstration quality; safety conflicts;
reviewer; rationale; timestamp; and exact card-version match. Current oEmbed
title, channel, thumbnail, and iframe metadata are not playback, exactness, or
approval.

Independently adjudicate all 16 evidence applications, 20 alternates, 4
neighbor identity boundaries, 4 graph proposals, and both exercise-complexity/
physical-difficulty anchors. Verify `26/18/26`, both delivery profiles,
actual-duration and cumulative wrist/hand-support budgets, all coach/athlete/
accessibility/support content, and every stop, incident, persistence, and
substitution rule. The packet must retain exactly `CARD-MEDIA-01`,
`CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified
review. Separate content review and independent publication approval remain
mandatory.

## 2026-08-09 — Source 32 Finger Pulses / Palm Lifts human-review packet

Registry `2026-08-09.99` contains 410 sources. Sixteen candidate evidence
applications use GMB's separately numbered Finger Pulse and Palm Pulse tasks
for the identity, contact, action, count, and limited dose context; USA
Gymnastics for pain, form, and stop context; and wrist-support biomechanics and
the adolescent gymnastics wrist-injury review as adjacent loading, symptom,
exposure, and evidence-certainty context only. None approves a Vortex identity,
score, universal eligibility, joint position, pressure, dose, recovery,
prevention, treatment, outcome, or publication claim.

Watch all four current candidates in full before changing any media state:

- `TBvEMTrLLp8` — Swift Movement Academy, “How To Do Palm Lifts”;
- `V9Lw__srIbM` — Dani Winks Flexibility, “Palm Pulses”;
- `WTcreH1yVjU` — Portland State Campus Rec, “Upper Body Mobility: Palm Press
  Finger Lifts”;
- `nM7wB89NlwE` — OriGym, “How To Do Finger Pulses | Exercise Demo”.

For each candidate, record full playback and which exact variant, if either, it
shows. Verify quadruped base; bilateral knee, hand, finger, distal-palm, and
palm-heel contacts; first-knuckle position; finger-pressure increase and
release or palm-heel lift and lower; absence of bouncing or added action;
comfortable range; count rule; pace; breathing; stops; captions and
accessibility; cue and demonstration quality; safety conflicts; reviewer;
rationale; timestamp; and exact card-version match. A palm-supported finger
lift reverses the moving contact and is not an exact Palm Lift. Current oEmbed
title, channel, thumbnail, and iframe metadata are not playback, exactness, or
approval.

Independently adjudicate all 16 evidence applications, 20 alternates, 5
neighbor identity boundaries, 5 graph proposals, and all 4 exercise-
complexity/physical-difficulty anchors. Verify Finger Pulses `24/18/24` and
Palm Lifts `28/22/28`, all four delivery profiles, actual-duration and
cumulative finger/hand/wrist/grip/support budgets, coach/athlete/accessibility/
support content, and every stop, incident, persistence, and substitution rule.
The packet must retain exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
`CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified review. Separate
content review and independent publication approval remain mandatory.

## Source 39 Plank to Down Dog qualified-review queue

Qualified reviewers must watch all five current media candidates from start
to finish: `DP2fmagkrdg`, `WPmvODuVv14`, `u8eUdDxyAMg`, `vXqPc4Uu8X0`, and
`0bzf7NKacXk`. Record playback; fixed bilateral palm and forefoot contacts;
long arms; high-plank start and same-plank return with shoulders over wrists;
comfortable inverted-V endpoint; whether knee bend and heel height are
optional; whether wave wording is merely a cue or requires segmental spinal
articulation; absence of a push-up, calf pedal, knee drive, step, limb lift,
equipment, or undeclared hold; count; pace; breathing; symptoms and stops;
floor entry and exit; captions; accessibility; cue and demonstration quality;
safety conflicts; reviewer; rationale; timestamp; and exact card-version
match. Current oEmbed title, channel, thumbnail, iframe, and embedding metadata
are not playback, exactness, accessibility, safety, or approval evidence.

Independently adjudicate all 16 evidence applications, 24 alternates, 5
identity decisions, 4 graph proposals, and both exercise-complexity/physical-
difficulty anchors. Verify the `30/28/30` task vector; Prepare & Access and
Resilience profiles; floor-transfer and actual-duration formulas; cumulative
palm, wrist, shoulder, trunk, hip, hamstring, calf, ankle, high-plank,
head-below-heart, push, handstand, crawl, and floor-work budgets; logistics;
substitutions; persistence; coach/athlete/accessibility/support content;
incident handling; and every quality gate and stop rule. Difficulty must
remain an exercise assessment and must not become participant skill,
proficiency, age, readiness, or clinical metadata.

The deterministic consolidation of Sources 39, 675, and 795 does not create
human approval. Verify that pike and Down Dog name the same fixed-support
endpoint in these source cards and that wave and rock are delivery cues unless
an exact candidate demonstrates an added required action. Retain exactly
`CARD-MEDIA-01`, `CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and
`CARD-PUBLISH-01` until qualified review and separate publication approval are
complete.

## Source 38 Bear Crawl Rock-Back qualified-review queue

Qualified reviewers must watch all five current media candidates from start
to finish: `LAZ9HYjUwvk`, `X4eMdNmq0e8`, `YJ05ptsucvY`, `s4MQVrvrXBU`, and
`b9fsav8zSm4`. Record playback, fixed bilateral palm and forefoot contacts,
continuous knee clearance, hand-under-shoulder and knee-under-hip start, long
arms, active palm pressure, level pelvis, organized trunk, backward hip path,
comfortable endpoint, forward return, valid repetition, pace, breathing,
symptoms and stops, floor entry and exit, captions, accessibility, cue and
demonstration quality, safety conflicts, reviewer, rationale, timestamp, and
exact card-version match. Current oEmbed title, channel, thumbnail, iframe,
and embedding metadata are not playback, exactness, accessibility, safety, or
approval evidence.

Independently adjudicate all 16 evidence applications, 24 alternates, 5
identity decisions, 4 graph proposals, and both exercise-complexity/physical-
difficulty anchors. Verify the exact `30/24/30` task vector; both Prepare &
Access and Movement Intelligence profiles; floor-transfer and actual-duration
formulas; cumulative palm, wrist, shoulder, trunk, hip, knee, ankle, forefoot,
hover, crawl, plank, push, handstand, and floor-work budgets; logistics;
substitutions; persistence; coach/athlete/accessibility/support content;
incident handling; and every quality gate and stop rule. Difficulty must
remain an exercise assessment and must not become participant skill,
proficiency, age, readiness, or clinical metadata.

Source 912 requires a separate identity decision. Determine its exact start,
whether knee contact is permitted or required, support continuity, endpoint,
return, and count before approving duplicate, variant, or distinct-definition
status. Do not automatically substitute holds, shoulder taps, crawls, crawl
prep, knees-down rock-backs, adductor or frog rock-backs, loaded variants, or
clinical assessments. Retain `CARD-MEDIA-01`, `CARD-IDENTITY-02`,
`CARD-GRAPH-03`, `CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified
review and separate publication approval are complete.

## Source 34 Quadruped Shoulder Circles qualified-review queue

Qualified reviewers must watch all five current media candidates from start to
finish and record playback result, fixed palm and knee contacts, elbow
extension, scapular rather than humeral or spinal motion, the declared initial
vertical direction, all four checkpoints, return-to-start count, both
directions, range, pace, breathing, trunk compensation, symptoms and stops,
captions, accessibility, cue and demonstration quality, safety conflicts,
reviewer identity, rationale, timestamp, and exact card-version match. Current
oEmbed title, channel, thumbnail, iframe, and embedding metadata are not
playback, exactness, accessibility, safety, or approval evidence.

Independently adjudicate all 16 evidence applications, 22 alternates, 4
Source-34-owned identity decisions, 4 graph proposals, and both exercise-
complexity/physical-difficulty anchors. Verify the exact `30/18/30` exercise
difficulty vector; both Prepare & Access and Movement Intelligence delivery
profiles; actual-circle, direction, support-time, duration, fatigue, recovery,
and overlapping wrist/shoulder/scapular/trunk-support accounting; logistics;
constraints; substitutions; persistence; coach/athlete/accessibility/support
content; incident handling; and every quality gate and stop rule. Difficulty
must remain an exercise assessment and must not be converted into participant
skill, proficiency, or age metadata.

Wall, raised-support, high-plank, hover, unilateral, resisted, and unstable
versions require separate variant review. Arm Circles/Shoulder CARs,
Quadruped Spinal Circles, Scapular Push-Ups, clinical assessment, and the
incompletely specified Source 1311 Quadruped Scapular Clock must remain
distinct unless later exact mechanics justify a different human-reviewed
decision. Retain exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
`CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified review and
separate publication approval are complete.

## Source 33 Scapular Push-Up qualified-review queue

Qualified reviewers must watch all five current media candidates from start to
finish and separately match each against an exact variant. Record base
contacts; elbow extension; scapular retraction/protraction or maintained
protraction; body-line, trunk, head, and shoulder organization; absence of a
full push-up, shrug, winging, lumbar motion, added instability, or undeclared
support; range; count or actual-valid-seconds rule; pace; breathing; symptoms
and stops; captions/accessibility; demonstration and cue quality; safety
conflicts; reviewer; rationale; timestamp; and exact card-version match.
Current oEmbed title, channel, thumbnail, and iframe metadata are not playback,
exactness, content review, or approval.

Independently adjudicate all 16 evidence applications, 24 alternates, 6
identity decisions, 6 graph proposals, and 8 exercise-complexity/physical-
difficulty anchors. Verify the quadruped dynamic `24/18/24`, high-plank
dynamic `32/30/32`, quadruped hold `22/18/22`, and high-plank hold `28/30/30`
contracts; all 8 delivery profiles; actual-duration formulas; cumulative
hand/wrist/shoulder/scapular/trunk-support budgets; logistics; substitutions;
coach/athlete/accessibility/support content; incidents; persistence; and every
quality and stop rule. Source 900's exact-duplicate consolidation and removal
of unrelated PMID 32707142 from current provenance are deterministic audit
actions, not qualified human review.

The packet must retain exactly `CARD-MEDIA-01`, `CARD-GRAPH-03`,
`CARD-CALIBRATION-01`, and `CARD-PUBLISH-01` until qualified review. Separate
content review and independent publication approval remain mandatory.
