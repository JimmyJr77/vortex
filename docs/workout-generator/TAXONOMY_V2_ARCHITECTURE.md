# Vortex Taxonomy and Workout Architecture v2

Status: proposed normative architecture and implementation reference
Created: 2026-08-16
Scope: exercise cards, taxonomy, retrieval, athlete fit, workout composition,
prescription, validation, and affected coach-library interfaces

## Purpose

This document defines the target architecture for finalizing the Vortex
exercise selector and deterministic workout generator. It preserves the visible
Athleticism Accelerator philosophy while separating the data needed for card
identity, exercise retrieval, athlete fit, whole-workout composition,
prescription, and validation.

This document does not approve, publish, calibrate, or externally verify any
exercise card, relationship, score, or media record. Existing human-review and
publication quarantines remain in force.

## Executive decision

The Athleticism Accelerator philosophy remains compact and recognizable:

- seven canonical session phases;
- eight tenets of athleticism;
- methodologies that describe how a movement or load is manipulated;
- six high-level physiological emphases;
- order slots, session models, and validation rules.

The philosophy taxonomy must not also be forced to perform every retrieval,
athlete-fit, composition, and prescription job. The target architecture uses
separate controlled layers:

| Layer | Question answered | Main data |
|---|---|---|
| Philosophy | Why does Vortex train this way? | Phases, tenets, methodologies, physiology, order slots |
| Retrieval | What kind of movement is wanted? | Training Family, Athletic Niche, movement, anatomy, character, equipment |
| Athlete fit | Can this athlete perform it appropriately? | Difficulty, task demands, prerequisites, constraints, supervision |
| Composition | Does it belong with the rest of the workout? | Stress vectors, fatigue, recovery, relationships, interference |
| Prescription | How is it performed today? | Format, method, load, sets, reps, time, rest, zone, scaling |
| Validation | Is the completed workout coherent and executable? | Hard gates, budgets, sequencing, logistics, duration, stop rules |

## Current repository state

Vortex already contains substantial production-oriented foundations:

- seven phases and eight tenets;
- six physiological parent categories;
- phase profiles and order slots;
- contextual dosage, difficulty, equipment, anatomy, fatigue, and recovery;
- coach, athlete, accessibility, and support content;
- reviewed relationship and media-governance models;
- automated per-card test packets;
- canonical definition, variant, delivery-profile, and prescription layers;
- deterministic generation, persistence, diagnostics, and coach/athlete
  rendering;
- explicit enforcement that exercise cards cannot contain skill or proficiency
  levels.

The latest authoritative rollout snapshot at the time of this document reports
1,676 source-covered legacy rows mapped through 206 active canonical
definitions. All active canonical definitions are in review and zero are
published. A source row is lineage, not necessarily a distinct production card:
one canonical definition can contain multiple variants and can preserve multiple
legacy source mappings.

Current gaps relevant to this architecture include:

- Methodology is overloaded with training families, outcomes, physiology, and
  programming formats.
- The legacy facet system does not contain complete Training Family, Athletic
  Niche, movement-character, force-velocity, or scoped focus taxonomies.
- The canonical card contract does not yet expose every proposed classification
  as controlled, engine-consumed data.
- Workout Intent v1 does not model scoped focuses, phase emphasis, Training
  Family, Athletic Niche, programming structure, or force-velocity focus.
- The canonical deterministic engine selects by phase rather than selecting
  anchors first and propagating their demand profile through supporting phases.
- Library interfaces do not present one consistent model across Exercise
  Library, Canonical Governance, Skill Library, Programming Library, and Games
  & Competitions.

### Implementation status in the current working tree

The gap list above records the baseline that motivated v2. The current
uncommitted implementation now includes:

- controlled Taxonomy v2 terms, aliases, scoped assignments, explicit
  not-applicable decisions, independent review, and coverage reporting;
- Training Family, Athletic Niche, force-velocity, movement character,
  programming structures, conditioning protocols, physiology mechanisms, and
  five aerobic zones;
- scoped workout focuses, phase emphasis, anchor-first selection, preserved
  substitution intent, and support-phase demand propagation;
- exact-variant movement geometry, anatomy roles, equipment roles, task
  demands, stress vectors, scaling boundaries, and composition profiles;
- strict separation of `difficulty` into technical complexity, physical
  difficulty, and their derived maximum; Skill Library proficiency remains
  isolated from Exercise Library cards;
- cumulative legacy fatigue budgets plus independent joint, tissue, neural,
  impact, local-muscular, systemic, grip, conditioning, and recovery budgets;
- authoring UI, generator controls, paginated governance batches (including
  missing-field triage and direct exact-variant editing), immutable structured
  profile review evidence, stable failing-variant IDs, and fail-closed
  publication/library loading;
- the five affected library surfaces: Exercise Library, Canonical Governance,
  Skill Library, Programming Library, and Games & Competitions.

Migration-generated values are suggestions only. Migration 753 creates no
approvals, copies only unambiguous numeric legacy evidence, explicitly models
bodyweight/no-equipment variants, and leaves ambiguous or missing values for
human resolution. Migration 754 token-normalizes only explicit legacy plane
words (`sagittal`, `frontal`, `transverse`, and `multiplanar`) into the
controlled vocabulary; it preserves source provenance and resets no human
approval. In the latest disposable-database validation, all 484 active exact
variants remained quarantined from the published selector until their
structured profile is complete and independently approved. The normalization
removed the 338 legacy-plane vocabulary failures; all 484 remaining profiles
now visibly require authored scaling handles rather than opaque validation
repair. Canonical Governance links each queue row to its exact variant, whose
controlled Scaling Handles editor records the sanctioned dimension, identity
boundary, easier/harder directions, and optional author limits. It intentionally
does not prefill a direction or create review approval.

## Philosophy backbone

### Canonical session phases

The phase order remains fixed:

1. Prepare & Access
2. Movement Intelligence
3. Output
4. Capacity
5. Resilience
6. Sustained Capacity
7. Restore

Phase emphasis may alter allocation, slot count, and selection priority. It must
not change phase order or relax fatigue, impact, recovery, supervision, or
safety constraints.

### Tenets of athleticism

The eight tenets remain:

- Strength
- Explosiveness
- Speed
- Agility
- Balance
- Flexibility/Mobility
- Coordination
- Body Control

Tenet relevance uses weighted categorical assignments, normally 1-5. It does
not represent athlete proficiency or exercise difficulty.

### Physiological emphasis

Keep the six coach-readable parent categories:

- Neural Output & Readiness
- Force Capacity & Tissue Capacity
- SSC & Stiffness (Elastic Energy)
- Control & Stability
- Perception-Action Skill (Movement Intelligence)
- Energy Systems & Repeatability

Add controlled child mechanisms beneath them.

Suggested child mechanisms include:

- Neural Output & Readiness: recruitment, rate of force development, movement
  intent, coordination speed, potentiation/readiness.
- Force & Tissue Capacity: maximum force, hypertrophy, muscular endurance,
  tendon capacity, ligament/joint tolerance, bone loading, local fatigue
  resistance.
- SSC & Stiffness: fast SSC, slow SSC, elastic stiffness, reactive strength,
  rebound efficiency.
- Control & Stability: postural control, joint stabilization, landing control,
  eccentric braking, perturbation control.
- Perception-Action Skill: reaction, choice response, anticipation,
  spatial/rhythm coupling, dual-task attention.
- Energy Systems & Repeatability: phosphagen, glycolytic, oxidative, mixed,
  repeat-sprint ability, aerobic base, threshold, aerobic power.

### Philosophy language

The visible explanation should use these definitions:

- Phase = when in the session.
- Tenet = what transferable athletic quality is developed.
- Methodology = how the movement or load is manipulated.
- Physiology = why the prescription produces the intended response.
- Programming format = how work is organized in today's workout.
- Order slot = the fine sequence inside a phase.

Programming format becomes a distinct concept and must no longer be represented
as Methodology.

## Methodology

Methodology describes a movement or loading manipulation. Many methodologies
are applied at the delivery-profile or prescription level rather than being a
permanent definition-level identity.

Recommended controlled methods:

- Plyometric
- Ballistic
- Isometric
- Eccentric Emphasis
- Eccentric-Only
- Eccentric Overload
- Concentric-Only
- Tempo-Controlled
- Paused
- Resisted
- Assisted/Overspeed
- Accommodating Resistance
- Variable Resistance
- Perturbation
- Instability
- Blood-Flow Restriction
- Velocity-Based

### Terms moved out of Methodology

| Existing or proposed term | Canonical destination |
|---|---|
| Resistance | General Resistance Training Family |
| Calisthenics | Calisthenics Training Family |
| Hypertrophy | Adaptation target under physiology/prescription |
| Neural Training | Physiological emphasis and execution intent |
| Balance & Stability | Tenet, task demand, and movement character |
| Mobility & Flexibility | Tenet, movement classification, and phase profile |
| Core & Body Control | Athletic Niche, anatomy, and tenets |
| Grip Training | Athletic Niche and anatomy |
| Rotational Power | Athletic Niche |
| HIIT | Programming protocol |
| Strength Training | Strength tenet and General Resistance family |
| Speed & Agility | Separate tenets and Athletic Niche terms |
| Power-Strength | Force-velocity emphasis |

Calisthenics must not remain both a Methodology and Training Family.

## Force-velocity emphasis

Power-Strength is not redundant with the Strength tenet. It describes the
force-velocity continuum. Use `strength_speed` as the canonical term and retain
Power-Strength as a search/migration alias.

Controlled values:

- Maximum Strength
- Strength-Speed
- Peak Power
- Speed-Strength
- Ballistic Speed
- Reactive Strength
- Maximum Movement Speed

Force-velocity emphasis is normally delivery-profile or prescription data. The
same exercise variant can occupy different positions when load and intent
change, within reviewed limits.

## Athletic Niche

Athletic Niche is the coach-facing retrieval name. Internally each term should
carry a domain so anatomical specializations are distinguishable from speed,
jump, agility, and throwing outcomes.

Athletic Niche is multi-select and uses relevance weights rather than
difficulty scores.

### Specialized strength

- Trunk/Core Strength
- Grip Strength
- Shoulder Strength
- Foot/Ankle Strength

### Speed and agility

- First-Step Quickness
- Acceleration
- Maximum Velocity
- Speed Endurance
- Deceleration
- Change of Direction
- Reactive Agility

### Jumping, landing, and elasticity

- Vertical Jump Power
- Horizontal Jump Power
- Lateral Jump Power
- Landing/Braking
- Reactive Strength

### Throwing and rotational power

- Rotational Power
- Linear Throwing Power
- Overhead Throwing Power

First-Step Quickness and Acceleration must use separate keys. A user-facing
preset may select both. Deceleration and Change of Direction must also remain
separate.

## Training Family

Training Family answers: "What recognizable training style, tradition, or
exercise domain does this belong to?"

Recommended controlled families:

- General Resistance
- Powerlifting
- Olympic Weightlifting
- Bodybuilding
- Calisthenics
- Loaded-Carry Training
- Strongman
- Kettlebell Training
- Gymnastics
- Tumbling/Acrobatics
- Sprinting
- Running/Locomotion
- Jumping/Landing
- Throwing
- Change-of-Direction/Agility
- Conditioning
- Mobility/Recovery

Canonical keys should include `powerlifting` and `olympic_weightlifting`.
Training Family is multi-select, with a primary or weighted role where useful.

Examples:

- A farmer's walk may be General Resistance, Loaded-Carry Training, and
  Strongman.
- A kettlebell goblet squat uses kettlebell equipment but is normally General
  Resistance, not necessarily Kettlebell Training.
- A kettlebell snatch can be Kettlebell Training and Ballistic.
- A back squat can align with Powerlifting, Bodybuilding, or General Resistance
  depending on exact variant and delivery profile.

Loaded Carry remains a movement pattern as well. The two facets answer different
questions.

The existing canonical `familyKey` is an identity-family field and must not be
repurposed as Training Family.

## Programming architecture

Programming must be decomposed into independent dimensions rather than one flat
list.

### Set and flow structure

- Straight Sets
- Superset
- Tri-Set
- Giant Set
- Circuit
- Complex
- Contrast
- Cluster Set
- Rest-Pause
- Ladder
- Pyramid
- Wave

### Clock structure

- Timed Set
- Continuous Work
- Interval
- EMOM
- AMRAP
- Density Block

### Conditioning protocol

- HIIT
- Tempo Conditioning
- Repeat Sprint
- Repeat Shuttle
- Aerobic Base
- Threshold
- Aerobic Power
- Mixed-Modal
- Partner Alternating
- Team Relay
- Game-Based
- Recovery Pace

A prescription can combine one value from each compatible dimension. For
example:

```json
{
  "setStructure": "circuit",
  "clockStructure": "interval",
  "conditioningProtocol": "aerobic_base"
}
```

This replaces overlapping entries such as `EMOM / AMRAP / Density` plus a
second `Density Blocks` entry.

### Aerobic and conditioning zones

Zones are prescription intensity, not exercise identity or programming format.

Support at least the five-zone model:

- Zone 1: Recovery
- Zone 2: Aerobic Base
- Zone 3: Tempo
- Zone 4: Threshold
- Zone 5: Aerobic Power / VO2max

Every zone prescription must declare its model and basis, for example:

```json
{
  "zoneModel": "five_zone",
  "zone": 2,
  "basis": "heart_rate_reserve",
  "fallbackBasis": "rpe_talk_test"
}
```

Supported bases may include heart-rate reserve, percent HRmax, pace, power,
validated threshold, RPE, and talk test. Zone number alone is insufficient.

## Movement classification

Movement pattern must remain separate from plane, projection, direction,
support, stance, and limb relationship.

Recommended movement patterns:

- Squat
- Hinge
- Lunge
- Step
- Horizontal Push
- Vertical Push
- Horizontal Pull
- Vertical Pull
- Carry
- Brace
- Rotate
- Anti-Rotate
- Anti-Extension
- Anti-Lateral Flexion
- Jump
- Hop
- Bound
- Land
- Throw
- Strike
- Sprint
- Run
- Shuffle
- Cut
- Crawl
- Climb
- Hang
- Support
- Swing
- Roll
- Invert
- Tumble
- Isolated Joint Action
- Mobility
- Breathing/Downregulation

Allow one primary pattern and multiple secondary patterns.

### Movement geometry

- Plane: sagittal, frontal, transverse, multiplanar.
- Projection: vertical, horizontal, diagonal, rotational.
- Direction: forward, backward, lateral, multidirectional.
- Support: bilateral, unilateral, alternating.
- Stance: square, split, staggered, tandem.
- Limb relationship: symmetrical, asymmetrical, ipsilateral, contralateral.

This replaces one overloaded laterality field with structured movement facts.

### Movement character

- Static/Isometric
- Controlled Dynamic
- Explosive
- Ballistic
- Elastic/Reactive
- Cyclical
- Continuous
- Multidirectional
- Reactive/Open Skill
- Acrobatic
- Locomotor
- Ground-Based
- Aerial

`Dynamic` may remain a search alias that expands into the appropriate controlled
movement-character values.

## Anatomy and tissue classification

Anatomy uses a controlled hierarchy for body region, joint, muscle/tissue, and
action. Each assignment includes its role:

- Primary training target
- Secondary training target
- Stabilizer
- Mobility target
- Stress exposure

Required anatomical concepts include:

- primary and secondary muscles;
- stabilizers;
- involved joints;
- joint actions;
- muscle action or contraction role when material;
- tissue exposure for muscle, tendon, ligament/joint, bone, and other relevant
  structures;
- plane, direction, support, stance, and laterality facts.

"Trains the shoulder" and "places stress on the shoulder" must never be the
same undifferentiated tag. Rotation is an action or movement pattern, not a body
region.

## Equipment taxonomy and roles

Recommended canonical equipment keys:

- `none` - Bodyweight / No Equipment
- `kettlebell`
- `medicine_ball`
- `wall_ball`
- `slam_ball`
- `jump_rope`
- `barbell`
- `dumbbell`
- `battle_rope`
- `climbing_rope`
- `resistance_band`
- `mini_band`
- `cones`
- `mini_hurdles`
- `trap_bar`
- `sandbag`
- `agility_ladder`
- `timing_gates`
- `force_plate`

Do not retain ambiguous `rope`, `bands`, `dumbbells`, or similar variants as
canonical values. Preserve them as deprecated aliases and migration mappings.

Equipment assignments require roles:

- required for execution;
- optional;
- approved substitute;
- measurement equipment;
- safety/support equipment;
- quantity per station.

Timing gates and force plates are normally measurement equipment. Their absence
must not reject an exercise unless the requested measurement protocol requires
them.

## Difficulty and athlete fit

Exercise difficulty remains limited to:

- exercise complexity;
- physical difficulty;
- derived overall difficulty, equal to the greater of the two.

Exercise cards cannot contain beginner/intermediate/advanced classifications,
skill levels, proficiency levels, or disguised equivalents. Those concepts are
confined to Skill Library cards.

Strength, power, mobility, balance, conditioning, and similar properties belong
in a separate task-demand profile:

- Strength demand
- Power demand
- Mobility demand
- Balance demand
- Coordination demand
- Conditioning demand
- Impact-tolerance demand
- Eccentric-control demand
- Body-control demand
- Perceptual demand
- Attention/dual-task demand
- Supervision demand
- Failure consequence

Task demand describes the exercise. Eligibility compares those demands with an
athlete or cohort profile, demonstrated prerequisites, training age, current
restrictions, maturation where relevant, and available supervision.

Age alone must not determine selection. Difficulty does not replace safety,
readiness, prerequisites, or supervision constraints.

## Canonical assignment scope

Classifications must be stored at the scope where they are true.

| Scope | Canonical data |
|---|---|
| Exercise concept | Broad lineage such as Clean, Squat, or Push-Up; aliases and source mappings |
| Exact variant | Stance, support, action sequence, equipment, movement facts, anatomy, base difficulty, base demands |
| Delivery profile | Phase, purpose, tenet weights, Athletic Niche, physiology, order slot, compatible methods, dosage |
| Workout prescription | Applied methodology, programming format, intensity, sets, reps, rest, zone, load, scaling |
| Workout | Focuses, phase emphasis, constraints, equipment pool, fatigue and impact budgets |

Every selectable candidate is an exact variant plus an eligible contextual
delivery profile. A card must not be duplicated simply because it is used with a
different phase intent or dosage.

## Canonical exercise-card sections

The target card contract contains:

1. Identity and lineage
   - stable ID, slug, canonical name, aliases, concept, definition, exact
     variant, source mappings, lifecycle, provenance.
2. Philosophy classification
   - phase profiles, tenets, methodologies, physiological parent/child terms,
     order slots.
3. Retrieval classification
   - Training Family, Athletic Niche, movement patterns, geometry, movement
     character, force-velocity eligibility, sport relevance/actions.
4. Anatomy and biomechanics
   - muscles, joints, actions, tissues, roles, contacts, support and sequence.
5. Difficulty and task demands
   - exercise complexity, physical difficulty, derived overall difficulty,
     task-demand vector, prerequisites, supervision and failure consequence.
6. Load, stress, fatigue, and recovery
   - external load, impact, contacts, eccentric stress, joint/tissue stress,
     local/systemic/neural/grip/conditioning fatigue, recovery and overlapping
     budgets.
7. Constraints and logistics
   - equipment roles and quantities, environment, surface, space, lane, station
     capacity, setup, sightlines, population and symptom constraints.
8. Delivery and dosage
   - phase-specific purpose, fit, sets, reps, time, intensity, rest, tempo,
     contacts, quality gates, stop rules and time model.
9. Scaling
   - approved scaling handles, limits, modifier/variant/definition boundaries,
     regression and progression behavior.
10. Relationships and composition
    - prerequisites, teaching, substitution, pairing, interference, sequencing,
      progression distance and review status.
11. Instructions and support
    - coach delivery, athlete instructions, expected sensations, pain guidance,
      self-checks, corrections, accessibility and support escalation.
12. Media, evidence, review and governance
    - candidate media, exact-match review state, evidence sections, confidence,
      independent review and lifecycle approvals.
13. Generator metadata and tests
    - compatibility, preservation requirements, deterministic hard constraints,
      test packet and release-readiness results.

### Machine-readable composition constraints

Pairing notes and interference prose remain valuable reviewer context, but they
are not deterministic selector rules. A card may block an incompatible session
only through independently reviewed structured-profile constraints. Each row
uses a controlled relationship type (`avoid_same_session` or `avoid_after`) and
a controlled target (`variant`, `definition`, `family`, `movement_pattern`,
`body_region`, or approved `taxonomy`). Taxonomy targets also declare the
controlled facet they address. For example:

```json
{
  "constraints": [
    {
      "type": "avoid_same_session",
      "targetType": "family",
      "targetKey": "olympic_weightlifting"
    },
    {
      "type": "avoid_after",
      "targetType": "taxonomy",
      "facetType": "methodology",
      "targetKey": "plyometric"
    }
  ]
}
```

`avoid_same_session` is symmetric. `avoid_after` follows canonical phase time,
not the generator's anchor-first selection order. Suggested or unreviewed
profiles cannot create hard constraints, and legacy free-text fields are never
silently converted into them.

## Scaling boundaries

Every scaling handle must declare whether the change is:

- a dose or annotation change within the same profile;
- a reviewed modifier within the same exact variant;
- a separate exact variant;
- a separate definition.

External load, rest, volume, and bounded tempo often remain prescription changes.
Support, stance, takeoff/landing behavior, contraction sequence, contact count,
terminal action, or action sequence may cross a variant or definition boundary.
The generator must not silently scale an exercise beyond its approved identity
and dosage contract.

## Relationship graph

Recommended reviewed relationship types:

- Progression
- Regression
- Prerequisite For
- Teaches
- Prepares For
- Potentiates
- Substitutes For
- Equipment Alternative
- Low-Impact Alternative
- Phase Equivalent
- Pairs With
- Contrasts With
- Balances
- Restore Complement
- Avoid After
- Avoid Same Session
- Must Precede
- Contraindicated Pairing

Every edge is directional and records scope, conditions, rationale, changed and
preserved dimensions, provenance, review status, and version.

Keep separate metrics for:

- similarity score: how closely two tasks preserve the selection reason;
- progression distance: the size of the readiness or demand change.

Do not manually encode all pairwise complementarity across the library. Compute
most compatibility from anatomy, stress, fatigue, movement, and demand vectors.
Use explicit graph edges for meaningful teaching, progression, substitution,
sequencing, and contraindication relationships.

## Substitution preservation

Substitution must preserve the reason the original prescription was selected.

The preservation signature may include:

- phase and phase intent;
- required focus and focus scope;
- primary tenet;
- required Training Family;
- Athletic Niche;
- movement pattern and geometry;
- anatomy and stress limits;
- force-velocity emphasis;
- equipment availability;
- difficulty and task demand;
- impact and fatigue budgets;
- physiological emphasis;
- space and supervision constraints.

The workout intent declares which properties are mandatory on substitution.
Every swap must be re-prescribed, re-budgeted, revalidated, rerendered, and
persisted as a traceable new output.

## Scoped workout focus controls

Every focus declares:

- facet;
- value;
- scope;
- strength;
- ranking weight;
- preservation behavior for substitution.

Focus strengths:

- Required: hard constraint.
- Strong preference: may be violated only for safety or coherence, with an
  explicit unmet-preference record.
- Preferred: ranking bias.
- Neutral: no effect.
- Exclude: hard prohibition.

Focus scopes:

- Whole session
- Anchor exercises
- Main work
- Specific phase or phases
- Prepare and Restore
- Accessories
- Conditioning

Example:

```json
{
  "focuses": [
    {
      "facet": "training_family",
      "value": "olympic_weightlifting",
      "scope": ["movement_intelligence", "output", "capacity"],
      "strength": "required",
      "weight": 100,
      "preserveOnSubstitution": true
    },
    {
      "facet": "athletic_niche",
      "value": "vertical_jump_power",
      "scope": "output",
      "strength": "preferred",
      "weight": 80
    }
  ]
}
```

Within one facet, ordinary retrieval uses OR by default. Across different
facets, retrieval uses AND. The interface must also expose explicit match-all,
required, preferred, and exclude behavior where useful.

## Phase emphasis

Phase emphasis changes allocation and selection priority while preserving
canonical order and minimum requirements.

```json
{
  "phaseEmphasis": {
    "prepare_and_access": 50,
    "movement_intelligence": 60,
    "output": 100,
    "capacity": 70,
    "resilience": 40,
    "sustained_capacity": 20,
    "restore": 50
  }
}
```

These values are allocation weights, not difficulty, safety, or allowable-load
scores. Higher emphasis can produce more time, more slots, or higher selection
priority. It cannot weaken hard budgets.

## Anchor-first deterministic generation

The target selection and composition flow is:

1. Normalize athlete, facility, focus, programming, and hard constraints.
2. Select the session model and resolve phase emphasis.
3. Select one or more anchor prescriptions from the required focus scope.
4. Calculate the anchors' movement, anatomy, equipment, stress, fatigue,
   logistics, and restoration demands.
5. Build Prepare & Access around the actual anchor demands.
6. Add Movement Intelligence and Output work that teaches, prepares, or
   potentiates the principal objective.
7. Add complementary Capacity and Resilience work without exceeding cumulative
   budgets.
8. Add Sustained Capacity only when it does not undermine the principal
   objective or violate interference rules.
9. Select Restore work from the tissues, ranges, stresses, and symptoms actually
   accumulated.
10. Resolve equipment quantity, stations, space, coach sightlines,
    synchronization, duration, setup, transitions, and cleanup.
11. Validate the entire session and perform only bounded, reviewed, traceable
    repairs.
12. Persist the normalized intent, library/rule versions, selection and rejection
    evidence, budgets, repairs, assumptions, diagnostics, and coach/athlete
    renderings.

The deterministic path remains network- and LLM-independent after intent
normalization.

## Library and interface impact

### Exercise Library

Add consistent browse, search, include, prefer, require, and exclude controls for:

- phase and order slot;
- tenet;
- Methodology compatibility;
- physiological parent and child emphasis;
- Training Family;
- Athletic Niche;
- movement pattern and character;
- anatomy, plane, direction, support, stance, and limb relationship;
- force-velocity emphasis;
- equipment role and availability;
- difficulty and task-demand ranges;
- impact, fatigue, recovery, logistics, and review state.

Results must display active filters, counts, selection scope, review status, and
why each card matches. Equipment filtering must be directly available in the
library UI rather than existing only in APIs or the Needs Engine.

### Canonical Governance

Extend authoring, comparison, review, audit, and publication interfaces for all
new controlled fields. Governance must show:

- assignment scope and provenance;
- suggested versus reviewed tags;
- deprecated aliases and legacy mappings;
- taxonomy completeness and conflicts;
- variant/profile boundaries;
- substitution preservation signatures;
- machine gates versus human gates;
- no implied approval from automated backfill.

Taxonomy changes that affect selection, substitution, dosage, rendering, or
safety must invalidate the appropriate card version and require revalidation.

### Delivery projections

Persisted workout output has separate, deliberate projections. The coach view
receives logistics, station plan, equipment, coaching/support prompts,
measurement, scaling, substitutions, and quality/stop rules. The athlete view
receives only the executable dose, athlete instructions and support, an
athlete-visible measurement, the quality gate as a self-check, stop rules, and
approved media. Coach-only support and internal selection diagnostics must not
leak into the athlete projection.

### Skill Library

Skill Library remains the only library that uses formal skill/proficiency levels.
It may reuse controlled movement, anatomy, equipment, phase, and relationship
references when helpful, but it must not inherit exercise difficulty semantics
or be collapsed into the Exercise Library.

Any exercise-card-like item found to be an assessed sport/gymnastics skill must
be routed through explicit identity review rather than silently retagged.

### Programming Library

Refactor Programming Library around set/flow structure, clock structure,
conditioning protocol, intensity/zone targets, phase compatibility, exercise
compatibility, fatigue intent, quality standards, and stop rules.

Remove exercise/proficiency-level semantics from programming-method profiles.
Use athlete training experience, readiness evidence, prerequisite constraints,
or cohort fit instead. Programming cards define how work is organized; they do
not redefine exercise identity.

### Games & Competitions

Keep Games & Competitions as its own library. Reuse controlled equipment,
space, participant structure, phase compatibility, tenets, physiological
emphasis, movement demands, intensity, fatigue, and safety data where relevant.

Game-Based Conditioning is a programming protocol that can organize an eligible
game card. The game itself remains a distinct content type with rules, scoring,
participants, competitive structure, and game-specific safety constraints.

Formal skill levels must not be added to games unless a separate, explicitly
approved game progression model is created; do not borrow exercise difficulty
or Skill Library proficiency implicitly.

## Selector behavior and explainability

The exercise selector must support:

- hard eligibility gates before ranking;
- scoped required, preferred, and excluded focuses;
- OR within facets and AND across facets by default;
- deterministic tie-breaking;
- exact visible rejection reasons;
- candidate-pool depth by phase and constraint combination;
- explicit zero-depth and suggested-relaxation reports;
- reviewed graph substitutions only;
- cumulative fatigue, impact, joint/tissue, equipment, duration, and supervision
  budgets;
- recent-exposure and variety handling that never overrides required focus;
- coach-facing selection rationale and athlete-facing concise instructions.

No aggregate quality score may hide a hard constraint failure or a zero-depth
required pool.

## Migration and backfill strategy

The migration must be additive and reversible at the feature-flag/read-path
level. Stable IDs, source mappings, archived identities, saved workouts, and
human review history must be preserved.

Do not manually retag 1,676 legacy source rows as independent production cards.
Classify active canonical concepts/definitions, exact variants, and delivery
profiles. Legacy source mappings inherit those classifications where the mapping
is valid. Ambiguous archived sources remain unselectable and quarantined.

### Legacy term mapping rules

- `rotational_power` -> Athletic Niche: Rotational Power.
- `grip_training` -> Athletic Niche: Grip Strength, subject to exact card review.
- `core_body_control` -> review into Trunk/Core Strength, Body Control, brace or
  other patterns; never bulk-map blindly.
- `speed_agility` -> split using exact movement and phase facts; ambiguous cases
  remain review-only.
- `power_strength` -> Force-Velocity: Strength-Speed.
- `resistance_calisthenics` -> split between General Resistance and
  Calisthenics.
- `neural` -> physiological Neural Output & Readiness only where supported by
  delivery intent and dose.
- `hiit` -> programming-protocol compatibility.
- Balance and mobility methodologies -> deprecated with explicit
  tenet/pattern/profile replacements.
- `dumbbells`, `bands`, `rope`, and other aliases -> controlled equipment keys
  with ambiguity review where required.

Every automated assignment stores:

- source value and source location;
- migration version;
- mapping rule;
- confidence;
- review-required state;
- ambiguity or quarantine reason;
- no fabricated reviewer, approval, media, or calibration evidence.

## Implementation path

1. Freeze and approve the taxonomy-v2 dictionary and scope rules.
2. Add controlled reference tables, aliases, deprecations, and assignment
   storage additively.
3. Extend canonical card, intent, output, governance, and data-quality contracts.
4. Add deterministic migration/backfill tooling with provenance and quarantine.
5. Update card adapters and repository loaders without changing the production
   read path.
6. Update Exercise Library and Canonical Governance authoring/filter surfaces.
7. Refactor Programming Library semantics and compatibility.
8. Update Skill Library and Games & Competitions only at controlled shared
   boundaries.
9. Add Workout Intent v2 with scoped focuses and phase emphasis.
10. Implement taxonomy-aware filtering and scoring in shadow mode.
11. Implement anchor-first demand propagation and supporting-phase composition
    behind a feature flag.
12. Add substitution preservation, computed complementarity, cumulative stress,
    logistics, duration, and validation integration.
13. Add coach/athlete rendering, rationale, diagnostics, persistence, and review
    telemetry for the new contract.
14. Rehearse the complete migration chain against disposable PostgreSQL.
15. Run focused lint/tests, full platform and backend suites, deterministic
    golden scenarios, data-quality reporting, and production build.
16. Complete independent human media, calibration, graph, card, accessibility,
    shadow-workout, and coach-pilot gates before staged publication.

## Acceptance criteria

The architecture is technically implemented only when:

- all canonical taxonomy keys and aliases are controlled and documented;
- deprecated terms have explicit mappings or quarantined ambiguity;
- every selectable exact variant/profile has complete required classification
  or an explicit not-applicable decision;
- exercise cards contain no skill/proficiency-level metadata;
- Skill Library proficiency semantics remain intact and isolated;
- Methodology, Training Family, Athletic Niche, programming, force-velocity,
  equipment, and physiology are not semantically conflated;
- Exercise Library and Canonical Governance expose the new classifications;
- Programming Library models format/protocol/zone compatibility correctly;
- Games & Competitions and Skill Library reuse only appropriate shared facets;
- Workout Intent v2 represents phase emphasis and scoped focus strength;
- the generator selects anchors first and propagates their demands;
- required focus survives reviewed substitutions;
- cumulative fatigue, impact, tissue/joint stress, logistics, duration, and
  supervision are validated end to end;
- deterministic repeated inputs produce identical outputs for the same library,
  rule versions, and seed;
- data-quality reporting exposes zero-depth combinations and every failing
  stable ID;
- migrations are idempotent on disposable PostgreSQL and preserve unrelated
  state;
- focused lint, complete automated suites, golden scenarios, and production
  build pass;
- release readiness remains blocked until real human gates are satisfied.

## Production and governance constraints

- Never fabricate card, relationship, media, score, calibration, accessibility,
  or publication approval.
- Candidate links and metadata health are not exact-match media approval.
- Automated taxonomy suggestions remain review evidence, not human decisions.
- Existing published or human-controlled state must be guarded before migration
  changes.
- Saved workouts retain the taxonomy, card, library, generator, rule, and model
  versions used to create them.
- Rollback uses feature flags and versioned read paths; do not destructively
  remove migration history during an incident.
- Preserve unrelated dirty work throughout implementation.

## Final assessment

This architecture preserves the Athleticism Accelerator as the visible backbone
while giving the selector and generator the fidelity they require.

- Phases, tenets, methodologies, physiology, order slots, session models, and
  validation explain the training system.
- Training Family, Athletic Niche, movement, anatomy, equipment, geometry,
  character, and force-velocity retrieve the right cards.
- Difficulty, task demands, prerequisites, and constraints determine athlete
  eligibility without assigning exercise skill levels.
- Stress vectors, fatigue, recovery, and reviewed relationships determine
  whether prescriptions complement one another.
- Delivery profiles and programming structures determine what an exact variant
  becomes in today's workout.
- Anchor-first demand propagation creates coherent Prepare, supporting work,
  Resilience, and Restore around the session objective instead of independently
  selecting generic phase exercises.

The remaining quality ceiling is empirical rather than architectural: qualified
coach review, media playback and accessibility review, score calibration,
approved graph relationships, shadow comparison, real floor execution, and
staged rollout evidence are still required before production publication.
