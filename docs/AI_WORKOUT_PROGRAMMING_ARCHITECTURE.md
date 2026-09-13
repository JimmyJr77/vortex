# Vortex Athletics AI Workout Programming Architecture

**Status:** Codex implementation specification\
**Purpose:** Authoritative specification for the Vortex AI-assisted
workout programming system.

## 1. Mission

Build an AI-assisted workout programming system that generates complete,
coach-quality athletic-development sessions grounded in the existing
Vortex philosophy, exercise-card library, programming library, taxonomy,
application architecture, and deterministic rules.

This is not a generic AI workout generator. It should function like an
**AI Programming Staff**: specialized agents operating under a Vortex
Director of Performance.

> **AI agents provide coaching judgment. Deterministic code enforces
> rules. The database provides truth. Coaches retain control.**

Do not duplicate existing Vortex systems when they can be extended.

## 2. Inspect Before Building

Before major implementation, inspect and document the repository's:

-   workout/session models and schemas
-   exercise-card schema and library
-   programming/methodology library
-   taxonomy and tags
-   age, skill, training-level, and athlete models
-   equipment taxonomy/inventory
-   movement, physiology, phase/intent, sport, and body-region
    classifications
-   workout-generation logic
-   AI/LLM integrations
-   database, APIs, services, React UI, validation, approval, and
    persistence mechanisms

Produce an architecture assessment identifying what exists, what should
be reused, what should be extended, what must be created, and where the
AI Programming Staff integrates.

## 3. Vortex Philosophy

The system develops broad, transferable athleticism through:

**Prepare & Access → Explosiveness → Strength → Capacity / Competition →
Body Control / Tumbling**

Movement intelligence, balance, coordination, mobility, neural
readiness, perception-action skill, and movement quality are integrated
into these components rather than treated as disconnected silos.

### Prepare & Access

Use a recognizable standardized Vortex warm-up, but adapt targeted
elements to downstream demands. Potential elements include mobility,
dynamic ROM, activation, neural readiness, movement intelligence,
balance, coordination, pattern rehearsal, low-level plyometrics, sprint
preparation, landing preparation, and tissue preparation.

**Warm-up generation must be demand-driven:**

`Session intent → downstream demands → required preparation → Prepare & Access prescription`

### Explosiveness

Potential content includes starts/acceleration, sprinting, max velocity,
jumping, bounding, plyometrics, reactive ability, deceleration, change
of direction, medicine-ball work, and sport-transfer activities.

Use **explosiveness** as the primary Vortex term rather than "power."

### Strength

Develop force production, tissue capacity, resilience, and foundational
strength through appropriate bilateral/unilateral, upper/lower,
posterior-chain, trunk, eccentric, isometric, carry, and accessory work.

### Capacity / Competition

Develop repeatability, conditioning, work capacity, and competitive
behavior without unnecessarily degrading higher-priority explosiveness
or strength work.

### Body Control / Tumbling

Treat tumbling as athletic development: body control, spatial awareness,
balance, coordination, inversion, rotation, landing, rolling, bracing,
kinesthetic awareness, and movement confidence.

## 4. Session Architecture

Recognize standard templates while allowing intelligent time allocation.

**90-minute athletic session** - 0--15 Prepare & Access - 15--45
Explosiveness - 45--75 Strength - 75--90 Capacity / Competition -
optional/separate 30-minute Body Control / Tumbling

**60-minute athletic session** - approximately 0--10 Prepare & Access -
10--35 Explosiveness - 35--55 Strength - 55--60 Capacity / Competition,
finisher, transition, or other appropriate use - optional/separate
30-minute Body Control / Tumbling

Templates are not blind rules. Use time budgets and coach priorities.

## 5. Family of Agents

Do not use one giant prompt. Build an extensible **Vortex AI Programming
Staff** with clear responsibilities, authority, structured
inputs/outputs, and deterministic services where AI is unnecessary.

### Vortex Director of Performance

Primary orchestrator and philosophical authority. Interpret the coach
request, establish `SessionIntent`, resolve priorities/tradeoffs,
coordinate specialists, preserve whole-session coherence, and approve
the final Vortex programming direction.

Consider athlete population, training age, chronological age, readiness,
sport, duration, objectives, phase, equipment, space, athlete count,
coaches, lanes/stations, methodology preferences, fatigue, and adjacent
sessions when available.

### Methodology / Performance Consultant

Create a pluggable `MethodologyConsultant` interface. The initial
consultant may understand publicly available Overtime Athletes-style
concepts such as athleticism-first development, sprinting,
explosiveness, strength foundations, quality plyometrics, high intent,
adequate recovery, logical sequencing, and simple effective programming.

It is a **consultant, not an authority**, and must not copy proprietary
workouts. Vortex remains authoritative.

### Athlete Development Agent

Evaluate developmental appropriateness using age, training age, maturity
where known, experience, coordination, complexity, loading, impact,
sprint/plyometric volume, fatigue, and progression/regression needs.

Support ages 9--11, 12--14, 15--18 and beginner/intermediate/advanced
populations. Readiness should outrank chronological age when
appropriate.

### Programming Librarian

Search and rank the existing Vortex programming library before inventing
methods. Return canonical programming IDs wherever possible.

### Exercise Librarian

Search and rank existing exercise cards using Vortex metadata such as
Tenets, Methodologies, Physiology, movement functions/patterns,
equipment, sports, phase/intent, body region, age/readiness, complexity,
impact, unilateral/bilateral classification, and
regressions/progressions.

Candidate ranking should consider objective, developmental, equipment,
movement, methodology, physiology, sequencing, fatigue, and logistics
fit.

### Exercise Creator

Activate only after a documented `ExerciseGap`. Proposed exercises must
exactly satisfy the existing card schema/taxonomy and enter a
human-approval state such as `AI_PROPOSED`. Do not create a shadow
exercise library.

### Prepare & Access Specialist

Design/adapt preparation only after downstream demands are known. Ask:
**What must these athletes be prepared to do exceptionally well today?**

### Session Builder

Construct an operational workout accounting for sequencing, transitions,
setup time, work/rest, athletes, coaches, lanes, stations, equipment
quantities, space, coaching bandwidth, and fatigue. A session for 15
athletes and 3 lanes must actually work on the floor.

### Programming Critic / QA Coach

Review every generated workout for impact/volume, developmental
mismatch, redundancy, sequencing, fatigue, equipment conflicts,
unrealistic timing, recovery, unsafe combinations, complexity, coaching
bandwidth, warm-up mismatch, rules violations, and failure to meet
objectives.

Return structured `PASS` or `REVISE`, with revision routed to the
appropriate role.

## 6. Extensibility Without Over-Agentizing

Design registration/interfaces so future specialists can be added, such
as Sprint, Plyometric, Strength, Isometric, Mobility, Tumbling,
Competition, sport-specific, Long-Term Athlete Development, and
Periodization agents.

Do not implement all of them now. Add specialists only where specialized
reasoning materially improves the system.

Use deterministic code---not LLM calls---for database retrieval,
filtering, sorting, calculations, eligibility, time math, equipment
counts, schema validation, taxonomy validation, duplicate detection, and
other hard rules.

## 7. Deterministic Rules Engine

Hard constraints belong outside prompts whenever feasible. Enforce:

-   total session time
-   equipment availability/quantity
-   age/readiness restrictions
-   exercise eligibility
-   impact thresholds
-   sequencing/order
-   required recovery
-   lanes/stations and athlete ratios
-   incompatible/duplicate exercises
-   exercise-card schema and metadata
-   existing Vortex safety/programming constraints

Preserve existing rules such as appropriate neural/explosive ordering,
high-impact placement, and other repository-defined sequencing
constraints.

## 8. Coach Controls

The Workout Generator should capture:

**Athletes:** age group, developmental/skill level, training age if
available, athlete count, sport if relevant.

**Logistics:** athletic duration, tumbling duration, coach count,
lanes/stations, space constraints.

**Equipment:** facility defaults, available equipment, quantities where
relevant, exclusions, and preferences.

For every major component---Prepare & Access, Explosiveness, Strength,
Capacity / Competition, Body Control / Tumbling---the coach can choose
**AUTO** or specify priorities, methodologies, exercises, and equipment
preferences.

Examples include acceleration, max velocity, jumping, reactive
plyometrics, deceleration/COD, unilateral/bilateral strength, posterior
chain, isometric/eccentric work, aerobic/anaerobic/repeat-sprint
capacity, circuits, tempo, competitions, and team challenges.

Prefer dynamically populated options from the existing Vortex
taxonomy/programming library rather than hard-coded duplicates.

### Component Equipment Control

Support global availability plus component-level restrictions. Example:
full facility overall; sleds+turf for Explosiveness; dumbbells+benches
for Strength; bodyweight only for Capacity.

Component restrictions may narrow global availability but cannot select
unavailable equipment.

## 9. Variable AI Autonomy

Support:

-   **Generate For Me:** minimal coach input; AI handles most
    programming.
-   **Guided:** coach sets objectives/components; AI selects
    methods/exercises.
-   **Coach Directed:** coach locks methods/exercises for selected
    components; AI fills gaps.
-   **Modify Existing:** natural-language changes to an existing
    workout.

Examples: "Make this appropriate for 9--11," "replace sled work," "make
explosiveness acceleration-focused," "we only have 60 minutes," "make
capacity competitive," or "reconfigure for 15 athletes and 3 lanes."

Any modification must re-run relevant validation and QA.

## 10. Structured Agent Communication

Prefer typed, runtime-validated contracts over long natural-language
handoffs.

Potential domain objects:

`CoachWorkoutRequest`, `AthleteProfile`, `SessionIntent`,
`ComponentIntent`, `EquipmentAvailability`,
`ComponentEquipmentPreferences`, `MethodologyRecommendation`,
`ExerciseCandidate`, `ExerciseGap`, `ProposedExercise`, `SessionBlock`,
`GeneratedWorkout`, `QAResult`, `ProgrammingExplanation`.

Use repository conventions. If TypeScript is used, prefer strong types
plus runtime schema validation.

## 11. Database-Grounded Generation

Prefer canonical IDs over generated names:

-   `exerciseCardId` rather than free-text "Box Jump"
-   `programmingMethodId` rather than recreating an existing methodology

This preserves instructions, videos, coaching cues, metadata,
regressions/progressions, equipment, analytics, and future updates.

## 12. Whole-Session Coherence

Do not generate components independently and concatenate them.

Earlier work must influence later volume, intensity, fatigue, and
selection. High sprint or plyometric demand should affect strength;
heavy strength should affect Capacity; warm-up should prepare exact
downstream demands; adjacent sessions and tumbling should influence load
when those data are available.

## 13. Explainability

Support concise coach-facing explanations for why the workout, exercise,
methodology, warm-up, order, volume, and progression/regression were
selected.

Do not expose private chain-of-thought. Store/display concise
programming rationales and decision summaries.

## 14. Human in the Loop

Require appropriate approval for permanent new exercise cards, taxonomy
changes, new programming methods, and safety/eligibility rule changes.

Coaches must always be able to replace exercises, change methods, adjust
priorities, lock blocks, regenerate selected components, and then
revalidate the session.

## 15. Observability and Testing

Provide sufficient logging/telemetry to understand which agents/services
ran, what canonical records were selected, validation failures, revision
loops, latency/cost, and AI-created content.

Tests should cover deterministic rules, schema validation, equipment
conflicts, time budgets, age/readiness constraints, exercise-gap
behavior, agent output parsing, QA revision loops, and representative
full-session generation.

## 16. Recommended Generation Flow

Conceptually:

`Coach Request` → validate/normalize → `Vortex Director` →
`SessionIntent` → retrieve programming/exercise candidates → invoke only
necessary specialists → determine downstream demands → adapt
`Prepare & Access` → `Session Builder` → deterministic rules validation
→ `Programming Critic / QA` → revise if required → final validation →
coach-facing workout + concise rationale

Do not assume every step requires a separate model call.

## 17. Initial Implementation Sequence

1.  Repository/architecture audit.
2.  Map current schemas, libraries, taxonomy, rules, and UI.
3.  Define canonical typed contracts.
4.  Define agent registry/orchestration boundary.
5.  Define deterministic rules-engine boundary.
6.  Implement database-grounded Programming and Exercise Librarians.
7.  Implement Vortex Director and structured `SessionIntent`.
8.  Implement Session Builder.
9.  Implement demand-driven Prepare & Access logic.
10. Implement QA/revision loop.
11. Implement ExerciseGap → Exercise Creator → human approval workflow.
12. Build/extend coach-facing controls and autonomy modes.
13. Add observability and tests.
14. Add specialist agents only when justified.

## 18. Definition of Done

The feature is successful when a coach can describe the athletes,
logistics, available equipment, duration, desired priorities, and
component-level preferences; receive a coherent Vortex workout grounded
in canonical exercise/programming records; modify or lock parts of it;
understand concise selection rationales; and trust that deterministic
rules and QA have validated the result.

The system must feel like **Vortex Athletics programming assisted by an
intelligent coaching staff**, not a chatbot inventing workouts.
