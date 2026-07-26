# Canonical exercise research and media review

Status: active library-review program, 2026-07-25.

## Scope and current baseline

Identity consolidation leaves 1,553 active canonical exercise definitions and
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

The minimum program therefore contains 24,848 card-section decisions and
4,659–7,765 video candidates. Multiple sources may be required for one section.

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

The three cards use only exercise complexity and physical difficulty for core
difficulty assessment, with overall equal to their maximum. External video
titles containing audience-level words remain source metadata and do not assign
a level to an exercise card. All 15 selected links returned successful current
YouTube oEmbed responses. Exact movement and variant match, complete viewing,
captions, cue and safety quality, reviewer identity, and approval remain human
gates. No candidate was approved.

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

## Quality reporting

`buildCanonicalDataQualityReport` reports active definitions only and separates:

- complete candidate research packets from fully reviewed packets;
- candidate-section coverage from reviewed-section coverage;
- cards with three to five raw candidates, currently embeddable candidates, and
  approvals as separate measures;
- candidate alternate assessments from reviewed assessments.

As of the first 149 active imported packets and candidate-only legacy media
backfill in disposable PostgreSQL:

- active cards: 1,553;
- exact direct identity collisions: 0;
- candidate-complete research cards: 149 (9.59%), containing 2,384 section
  decisions, 726 currently healthy per-card video candidates (466 distinct
  video IDs), and 777 alternate assessments;
- reviewed research cards: 0;
- cards with three to five candidate videos: 1,219 (78.49%);
- cards with three to five currently healthy and embeddable candidates: 149
  (9.59%);
- cards with no direct video candidate: 334;
- cards with three to five approved videos: 0;
- candidate alternate assessments: 149 cards (9.59%);
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
