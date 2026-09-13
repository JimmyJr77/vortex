# Vortex Athletics: Repeatable Athleticism Block Programming Specification

**Deliverable:** A coach-ready 12-week athleticism development program, with a separate four-week instructional on-ramp.  
**Baseline prescription:** Ages 12–14, with exercise-by-exercise prescriptions for ages 9–11 and 15–18.  
**Workflow:** Philosophy → complete progression outline → daily stimulus briefs → purposeful sets and exercises → sequential workout development → cross-session review.  
**Purpose:** Instructions for Codex working in the Vortex repository. This document is a programming brief, not the completed training plan.
**Revision:** Added outline-first programming, explicit set purposes, exercise-selection justification, and exposure-to-exposure continuity.

> **Design the progression before filling the workouts. Give every set a job. Make each session contribute to what came before and what comes next.**

## 1. Goal and scope

Review the current Vortex training philosophy and create an extensively detailed, coherent athleticism development program inspired by Vortex and verified, publicly available Overtime Athletes (OTA) principles. Use Vortex terminology, formatting, exercise cards, programming library, and taxonomy.

Create TWO distinct products:

1. **An ongoing 12-week development block** for athletes who already have the prerequisites to participate in regular Vortex training. Design it to connect to the previous and subsequent blocks without resetting everyone to beginner instruction.
2. **A separate four-week instructional on-ramp** for new athletes, athletes returning after a substantial absence, and athletes with specific prerequisite gaps. Its purpose is to teach participation competencies, not to consume the first month of every continuing athlete's program.

Interpret “three months” as 12 training weeks and “one month” as four training weeks for planning purposes. Do not attach arbitrary calendar dates. Begin with the existing five-day-per-week program offering: 60 numbered main-program sessions and 20 separately numbered on-ramp session plans. This is an offering schedule, NOT a requirement that every athlete attend five days per week. Confirm or explicitly qualify this convention during the initial review if the current repository differs.

The main task is program design and coach documentation—not building a new workout-generation application. Reuse the existing family-of-agents capabilities where available. Do not spend this initiative implementing an agent platform instead of producing the training program.

## 2. Read the sources before programming

Inspect the complete current philosophy and relevant repository records before selecting exercises. Locate these filenames where available; do not assume that a file exists at a particular path:

- `Vortex_Training_Philosophy_Codex.md`
- `AI_WORKOUT_PROGRAMMING_ARCHITECTURE.md`
- Current Vortex session/program templates and approved example sessions.
- The existing exercise-card library, schema, media, prerequisites, and progression/regression relationships.
- The existing programming/methodology library and equipment taxonomy.
- Earlier Vortex 12-week regimen files, including their exercise-detail formatting.
- Available prior-block plans, athlete attendance, completed prescriptions, results, coach notes, restrictions, and upcoming sport commitments.

Separate source authority by subject. The latest explicit owner requirements and latest approved philosophy govern programming intent. Canonical library records govern identities and schema requirements. Earlier plans can supply formatting and historical context, but must not silently override the newer philosophy. Verified safety and eligibility constraints remain enforceable; flag contradictions rather than rationalizing them away.

In particular, do not reinstate the older standalone Movement Intelligence, Resilience, or Capacity/Sustained Capacity structure merely because it appears in a legacy regimen. Review whether it has been superseded by the current philosophy.

Produce a source and conflict register. Distinguish verified requirements, assumptions, unresolved gaps, and proposed changes. Do not claim to have read inaccessible files, exercised unavailable agents, or queried inaccessible libraries. When information is missing, make a clearly labeled conservative planning assumption where possible and record its effect.

For outside methodology, consult primary, publicly available OTA material and appropriate primary youth-training guidance. Cite the actual material used, distinguish source-backed principles from proposed Vortex adaptations, and do not claim OTA endorsement. Do not reproduce proprietary workouts, invent OTA protocols, or treat marketing claims as established evidence. No external-source access means the resulting attribution remains unverified, not fabricated.

## 3. Start with the philosophy of a continuing 12-week block

Before writing daily workouts, explain what a 12-week block should accomplish for athletes who train at Vortex repeatedly across the year.

Address the following questions explicitly:

- Which athletic qualities should improve during this block, and how will improvement be recognized?
- Which qualities should be retained throughout, even when another quality receives emphasis?
- How should workload, intensity, specificity, complexity, and recovery vary across the block?
- What should stay consistent so athletes can practice, measure, and improve?
- When is exercise variation useful, and when would changing exercises interrupt productive progression?
- How should the next block start from the athlete's actual finishing point?
- How do individual training age, readiness, attendance, and sport workload modify the group plan?
- Where do onboarding, remediation, consolidation, and reassessment belong without turning the program into recurring beginner instruction?

**Critical distinction: ages 12–14 are the foundational/reference prescription, not a synonym for novice training.** An experienced 12-year-old is not automatically a beginner, and an older new athlete does not automatically receive an advanced variation.

Assume the main group has demonstrated the stated entry competencies. Define those competencies rather than assuming advanced skill. Week 1 should include productive training at an appropriate established level, with brief embedded calibration—not several weeks devoted only to relearning basic patterns.

Do not make every block follow “learn to squat again → relearn jumping → finally train hard.” Developmental sequences such as Control → Produce → Redirect → React are tools for selecting an athlete's appropriate level, not a mandatory reset of the whole group every 12 weeks.

A three-by-four-week emphasis structure is a candidate, not a predetermined scientific requirement. Recommend and justify the block organization that best fits the Vortex setting. Preserve appropriate exposure to explosiveness, strength, movement intelligence, and body control throughout. Do not withhold sprinting or useful loading until the last month merely to make the phases look different.

Continuity does not mean that load must increase every week forever. Explain how recovery, consolidation, lighter exposure, reassessment, and new emphasis preserve progress without restarting the curriculum.

## 4. Preserve the current Vortex identity and format

Use the current philosophy's four developmental pillars:

**Access & Prepare → Explosiveness → Strength → Body Control / Tumbling**

Capacity / Competition is a supporting finishing layer when appropriate to the session duration, intent, and subsequent tumbling—not a replacement for strength or a requirement to exhaust athletes.

Use **Explosiveness** as the coach-facing term rather than renaming the component “Power.” If legacy schemas use another field name, map it explicitly rather than silently creating a parallel category.

Integrate movement intelligence, balance, coordination, rhythm, reaction, perception, mobility, resilience, landing, braking, and tissue tolerance into appropriate exercises. Do not create extra mandatory time blocks merely to tick off these qualities. Identify where the qualities are actually trained rather than claiming that every exercise develops everything.

Default main-session timetable:

| Time | Component | Duration |
|---|---|---:|
| 0–15 | Access & Prepare | 15 minutes |
| 15–45 | Explosiveness | 30 minutes |
| 45–75 | Strength | 30 minutes |
| 75–90 | Capacity / Competition | 15 minutes |

Keep the separately programmed 30-minute Body Control / Tumbling segment outside the 90-minute athletic block. Coordinate its demands with the athletic session; do not ignore the fatigue created before it.

Where the 60-minute offering is needed, use the current compressed template: 0–10 Access & Prepare, 10–35 Explosiveness, 35–55 Strength, 55–60 Capacity / Competition. Give specific daily modifications, preserving the priority stimulus and recovery rather than compressing every exercise equally.

Instruction, demonstrations, setup, station changes, water breaks, recovery, and transitions must fit INSIDE the allotted times. Any proposed change to an approved template must be explicit and justified.

### Standardized preparation is a requirement

Read the actual standardized Access & Prepare routine from the current philosophy. Preserve its recognizable base sequence and required concluding movement checks, with appropriate drill regressions. Do not replace it with a newly invented generic warm-up each day.

Determine the downstream Explosiveness and Strength demands first. Then add the current philosophy's two targeted preparation drills: one movement/position rehearsal and one progressive rehearsal of the upcoming task. Explain their relationship to that day's work.

Verify that the complete routine, targeted preparation, and group logistics fit the available preparation time. Do not assume that a long list fits simply because it is labeled “10 minutes.” Flag any timing conflict and propose an explicit, coach-reviewable solution that preserves the intended preparation.

## 5. Main-program architecture, purposeful sets, and progression

This is a required design sequence, not an optional explanation added after exercise selection:

**Block outcomes → phase objectives → weekly progression → daily stimulus → set purposes → exercise/method selection → age-specific prescriptions → session and program review.**

Do not reverse this sequence by selecting interesting exercises first and inventing a training rationale afterward.

### 5.1 Complete and audit the entire progression outline first

Before writing detailed workouts or exemplars, create the complete 12-week progression matrix with an entry for every main-program day (`Day 1` through `Day 60`). Also complete the four-week instructional map so its prerequisites match the main block. The outline is a full program design, not just three monthly themes or a list of weekly body parts.

For each phase, week, and day, identify the relevant:

- Primary development outcome and supporting/maintenance qualities.
- Daily Explosiveness focus and complementary full-body Strength emphasis.
- Recurring movement or exercise-family anchors and intended programming methods.
- Planned progression variable, retained qualities, and reason to progress, hold, consolidate, or reduce exposure.
- Observable quality/performance target and prerequisites, without fabricating expected gains.
- Workload emphasis, recovery considerations, and assessment opportunities.
- Prior relevant exposure and subsequent planned exposure, with explicit day references when available.
- Preparation demands, Capacity / Competition role, and separate Body Control / Tumbling interface.
- Accommodation for different attendance patterns and for athletes joining from the on-ramp.

Audit the outline for coherent progression, recoverability, realistic logistics, and continuity before detailed prescription begins. Record the review outcome and correct contradictions. This is a planning-quality gate, not a requirement to obtain approval for every routine decision.

The outline may identify likely anchor exercises and methods, but final exercise selection and dosage require the session-level process below. Revise the outline transparently when detailed feasibility checks reveal a better solution; do not silently drift away from it.

### 5.2 Write a daily stimulus brief before selecting the workout

For each day, answer:

1. What is the main athletic quality or capability this session is intended to develop?
2. What should good execution or successful performance look like today?
3. What is the intended contribution of each Vortex component?
4. What has the athlete practiced previously that this session retains, develops, or applies?
5. What later exposure does this session prepare for?
6. What must be protected today: output quality, movement quality, recovery, a skill prerequisite, or another stated priority?

Avoid vague goals such as “athleticism,” “full body,” or “work hard” as the entire session objective. Give the day a specific emphasis without forcing every exercise to train the identical quality. Supporting upper-body work, trunk work, or maintenance exposure can have a legitimate separate purpose within the full-body session.

Distinguish intended adaptation from an observed result. A well-reasoned prescription is not proof that a particular athlete will achieve a particular improvement.

### 5.3 Every set must have a specific programming job

For each exercise prescription, specify what its sets are intended to accomplish within this day. Apply this to preparation, technical practice, working sets, sprint/jump efforts, assessment efforts, and finishing work—not just the first exercise.

Record:

- **Primary set purpose:** one clear task, adaptation, rehearsal, assessment, or maintenance objective.
- **Role in the day:** preparation; primary development; complementary development; maintenance; technical practice; assessment; or appropriate late-session capacity/competition.
- **Dose and execution:** relevant sets, repetitions, sides, contacts, distance, time, effort/load, tempo, recovery, and coaching intent for each age band.
- **Success and stop criteria:** what the coach observes to continue, hold, progress, regress, or stop.
- **Relationship to other work:** why these sets belong here and what they support, preserve, or avoid duplicating.
- **Progression relationship:** the prior relevant prescription, today's planned change or deliberate retention, and the criterion for the next change.

Identical sets can legitimately share a purpose. For example, label “Sets 1–3” with a common objective when all three deliver the same stimulus. Do not invent three different purposes or three different exercises merely to satisfy set-level documentation. When a preparation set, working set, or assessment set has a different role or dose, identify it separately.

Secondary benefits may be noted, but do not describe every set as developing every Vortex quality. Give each set a primary job. For a competition, define what constitutes a set/round and preserve the specific work/rest prescription.

Use the existing Vortex exercise-detail format. Add a concise **Set purpose / daily contribution** field and a **Prior → current → next exposure** field or linked ledger entry; do not replace the entire template with a new incompatible format.

### 5.4 Select the most justified exercises, not the most novel ones

Interpret “most impactful” as the highest-value, best-supported selection for the stated objective, athletes, readiness, time, equipment, coaching coverage, and surrounding workload—not an unsupported claim that one exercise is universally optimal.

Search the canonical exercise and programming libraries. For important anchor selections, new substitutions, or substantial changes, compare plausible alternatives using:

- Fit to the day's primary objective and the stage of the block.
- Compatibility with the athlete's demonstrated prerequisites.
- Ability to practice, measure, and progressively develop the intended quality.
- Sufficient stimulus without unnecessary fatigue, impact, or complexity.
- Available equipment, usable space, group flow, instruction time, and recovery.
- Contribution relative to other selected exercises, including useful reinforcement versus redundant volume.
- Suitability for all three age prescriptions while preserving the intended outcome.

Record a concise selection rationale and, where the decision is consequential, why a credible alternative was not selected. Reuse the rationale for unchanged anchor selections and document what changed today; do not generate pages of repetitive explanation for every repeated exercise.

Do not equate sweat, soreness, novelty, exercise count, or difficult-looking combinations with training value. Do not claim that an exercise transfers directly to a sport skill merely because it resembles that skill. Separate source-backed principles, coaching judgment, and hypotheses that require observation.

### 5.5 Make exercises complement one another within the day

A workout must be an intentionally coordinated training exposure, not independently selected component lists placed next to one another.

- Preparation must rehearse and prepare for the actual downstream demands while preserving the standardized Vortex base.
- Explosiveness work must have a defined focus and quality requirement, not become conditioning through unnecessary density.
- Strength content must have a defensible relationship to the day's objectives and the weekly plan, including supporting or maintenance work where appropriate.
- Exercise order, pairing, rest, and transitions must preserve the intended stimulus. A convenient station circuit does not automatically justify combining any exercises.
- Capacity / Competition must have a defined role and dose; it is not a place to hide extra uncounted sprint, jump, or strength volume.
- Separate tumbling demands must inform the fatigue and impact decisions made earlier.

Distinguish useful repetition from redundant stress. Repeated practice can be deliberate; extra volume still requires a reason. Avoid both arbitrary variety and doing several near-identical exercises simply to fill time.

Do not force every exercise into one biomechanical theme. A coherent full-body session can contain complementary developmental, maintenance, and preparation tasks. Explain their roles rather than pretending that every task directly causes the primary adaptation.

### 5.6 Progress exposures deliberately across sessions and weeks

Use a small, justified set of recurring exercises or movement families as progression anchors. Retain them long enough to practice and evaluate them. Change an exercise when the change serves a documented progression, adaptation, readiness, equipment, or recovery need—not just because a new week begins.

For each anchor, maintain a progression ledger containing:

`Anchor / exercise ID | relevant exposure / day | objective | prior planned dose | actual completed dose and response when available | current prescription | variable changed or retained | rationale | advance / hold / regress criteria | next planned exposure`

Reference the **previous relevant exposure**, not automatically the previous calendar day. Show both relationships: how adjacent sessions coexist without unnecessary interference, and how repeated exposures to the same quality develop over time.

Progression can involve execution quality, useful range, force, speed, load, repetitions, distance, decision demand, or another justified variable. Do not increase load, volume, impact, complexity, and density together by default. Do not shorten recovery for quality speed work merely to make a later workout look harder.

Not every next session must be harder. Retention, technical refinement, recovery, consolidation, assessment, and lower-demand exposures can be deliberate steps in the progression. Require an explicit reason for a planned hold or reduction just as for an increase.

The next prescription is a conditional plan, not automatic permission to advance. State what happens when the athlete meets the criterion, partly meets it, is fatigued, has missed an exposure, or needs a different variation. Apply the progression logic separately to each age/readiness prescription rather than scaling all three bands mechanically.

### 5.7 Preserve continuity without making attendance brittle

Support athletes attending one through five days per week. Every day must be a useful standalone athletic-development session, while multiple days complement rather than duplicate one another. Favor balanced/full-body strength exposure with rotating emphasis over body-part splits that leave infrequent attendees missing entire movement families.

Rotate emphases across weeks so a fixed-day attendee is not permanently restricted to one narrow quality. Explain accommodations for one-, two-, three-, four-, and five-day patterns, including consecutive attendance.

Keep two distinct views: the group offering calendar and the individual athlete's completed exposure history. Build an athlete's next progression from demonstrated readiness and completed work, not solely from the calendar's week number. Do not assign accumulated missed volume as a catch-up session or force every athlete to restart after a missed day.

Account for practices, games, tournaments, other strength work, tumbling, absences, readiness, and known restrictions when records exist. When they do not, specify the coach check and adjustment rule rather than inventing histories.

Include practical repeatable assessment conditions and training-compatible timing. Do not fabricate expected gains or require true maximal strength testing to prescribe group loads. Carry the prior block's relevant completed prescriptions, competencies, and responses into the next block so continuing athletes do not restart at beginner instruction.

## 6. Build the separate instructional on-ramp

Design four weeks of instruction that prepare athletes to join the current main block—not necessarily to enter the main program at Day 1.

Create 20 instructional session plans under the five-day offering assumption, clearly labeled `OR-01` through `OR-20`. Organize learning modules so lower-frequency attendees can demonstrate competencies without automatically graduating solely because four calendar weeks passed. Conversely, competent athletes may bypass or shorten instruction based on documented checks.

Define weekly learning objectives, session objectives, exercises, demonstrations, practice opportunities, age-scaled prescriptions, common errors, correction cues, and observable progression criteria. Maintain the Vortex session identity while allowing appropriate additional teaching time and lower complexity or workload.

Cover the prerequisites actually used by the main program, including the standardized preparation routine, safe training conduct, station flow, basic movement vocabulary, movement control, landing/braking, sprint positions, strength-pattern execution, equipment handling, effort/rest concepts, and tumbling readiness where relevant. The content must match the exercise library and approved coaching practices.

For each learning domain, specify:

- What the athlete must demonstrate.
- How the coach observes and records it.
- What variation the athlete uses before meeting the criterion.
- Which main-program variations the criterion unlocks.
- What to do when only some competencies are missing.

Include an onboarding/entry matrix and an example of an athlete joining during the middle of the 12-week block. Provide targeted remedial options without forcing all continuing athletes through the same lead-in month.

Do not turn the on-ramp into punishment conditioning, and do not require four calendar weeks of attendance as a substitute for demonstrated ability.

## 7. Every exercise needs three real prescriptions

For EVERY programmed exercise—including warm-up drills, targeted preparation, finishers, and newly prescribed body-control work—provide the following:

1. **Ages 12–14 reference prescription.**
2. **Ages 9–11 scaled prescription.**
3. **Ages 15–18 scaled prescription.**

Use exact exercise variants and appropriate doses, not “easier,” “harder,” “reduce by 20%,” or “add weight” as the entire adaptation. Preserve the intended training outcome, not necessarily the identical movement variation.

Include all relevant prescription fields: sets, repetitions per side, distances, durations, contact counts, hold times, tempo, recovery between efforts and sets, and an appropriate effort/load-selection method. Use explicit units. Where a field is not applicable, mark it accordingly rather than inventing a number.

Do not prescribe a single absolute load to an entire age group without a basis. Explain how the coach selects and adjusts loads using demonstrated competency and an appropriate effort target. For high-intent work, explain intended execution quality and recovery rather than treating it like a fatigued strength set.

Each age-band prescription must also have a competency/readiness override. Provide beginner and experienced alternatives where needed within the same age band. Older does not automatically mean more impact, more complex acrobatics, more volume, or less rest.

State the observable progression criterion and the stop/regress criterion. Avoid routine failure, forced repetitions, grinding technique, or fatigue that defeats the stated purpose. Refer individual restrictions and rehabilitation decisions to the applicable qualified professional rather than inventing clearance.

## 8. Required daily session format

Use the current Vortex coach-facing template and existing exercise-detail field names where available. Preserve the useful legacy side-by-side age-prescription format while updating the component labels to the current philosophy.

Every main session must be independently usable by a coach and include:

- Week, day, session number (`Day 1` through `Day 60`), phase/emphasis, and title.
- Athlete assumptions, readiness considerations, and prior/next-session relationships.
- Primary objective, supporting objectives, and observable success criteria.
- The exact component timetable, including realistic transitions and recovery.
- Equipment requirements and quantities, space/lane needs, grouping, and coaching coverage assumptions.
- Standardized preparation and two explicitly identified daily-specific drills.
- Actual exercise selections and programming-method references for every athletic block.
- The three age prescriptions for every exercise, with competency overrides.
- Setup, execution, concise coaching cues, common errors, and stop/regression criteria.
- The daily stimulus brief and why the exercise and method serve this day and this stage of the block.
- A primary purpose for every set or explicitly identified group of identical sets, including its contribution to the day.
- The rationale for exercise order, pairings, recovery, and complementary versus maintenance work.
- A specific prior → current → next exposure relationship, with the planned progression/retention decision and readiness criteria.
- Approved alternatives for unavailable equipment that retain the intended stimulus.
- The separate Body Control / Tumbling reference or handoff and fatigue implications.
- Exact changes for the compressed 60-minute version where that offering is supported.
- A completed timing/logistics, workload, and philosophy review.

Retain appropriate Vortex metadata such as Methodology, Athletic Tenets, Physiology, Movement Pattern/Function, Body Region, Equipment, and Coaching Cue when those fields exist. Do not fabricate canonical identifiers or tags.

A useful exercise-detail order is: component/order; exercise and card reference; set purpose/daily contribution; 12–14 prescription; 9–11 prescription; 15–18 prescription; methodology; equipment; coaching cues; prior → current → next exposure; progression/readiness notes. Reuse existing fields when they serve these purposes. Adapt to the actual template instead of unnecessarily creating a new format.

Every day needs a complete prescription. “Same as last week,” “continue progression,” and “repeat with more intensity” are not finished sessions. Repeated exercises and a standardized warm-up are encouraged when purposeful, but each day's dose must remain explicit. A reusable warm-up record is acceptable in the repository only if the exported coach session resolves it into accessible, complete instructions with age scaling.

### Separate tumbling program

Reuse the approved separately managed tumbling program when it exists, linking the precise appropriate session and prerequisites. Do not duplicate or overwrite it merely to make this document self-contained.

When new body-control content is needed, keep it in a separate linked section and use approved exercise records, demonstrated prerequisites, appropriate supervision, and coach review. Never assign advanced skills solely because an athlete belongs to the older band.

Be explicit about scope: a handoff objective is not a completed 30-minute tumbling prescription. Identify any missing tumbling content and approval dependency instead of claiming that it has been delivered.

## 9. Ground the plan in the libraries

Search the exercise and programming libraries before proposing new content. Use canonical record names and IDs when verified, including links to existing instructions and videos where supported.

Do not assume a card is absent after one unsuccessful keyword search. Check synonyms, existing variations, and movement relationships. When a genuine gap remains, document it.

A new exercise must be proposed in the existing complete card schema, clearly marked for human approval. Provide an approved substitute so that an unresolved card does not quietly become a required part of a finalized session. A new dosage or coaching emphasis alone does not necessarily require a new exercise card.

If the library cannot be accessed, distinguish provisional exercise names from verified canonical selections. Do not fabricate IDs, approval status, video links, or a claim of database grounding.

Preserve equipment availability and component-level constraints from the existing system. A preference cannot create equipment that is not available.

## 10. Use the family of agents as a programming staff

Where actual agent capabilities exist, coordinate appropriate roles under the Vortex Director of Performance:

- **Vortex Director:** philosophy, priorities, conflicts, and final coherence.
- **OTA/public-methodology reviewer:** source-backed methodology perspective, subordinate to Vortex.
- **Block/periodization planner:** 12-week continuity, weekly exposures, and previous/next-block relationships.
- **Athlete-development/scaling reviewer:** readiness and all exercise-level age prescriptions.
- **Programming and exercise librarians:** canonical methods, exercises, and progression relationships.
- **Instructional on-ramp specialist:** prerequisite teaching and entry pathways.
- **Preparation specialist and session builder:** demand-driven warm-up, complete sessions, logistics, and timing.
- **Independent programming critic:** challenges the daily stimulus, set purposes, exercise-selection rationale, progression continuity, recovery, omissions, conflicts, and impractical prescriptions. Rejects exercise lists justified only by variety or generic athleticism labels.

Do not add an LLM call for simple arithmetic, ID validation, sorting, or equipment counts. Use deterministic checks for calculable constraints. Do not let agents revise core philosophy independently or maintain conflicting copies of the program.

If independent agents are unavailable, perform explicitly labeled role-based review without pretending that separate independent agents executed.

## 11. Work in stages, not in one enormous generation

### Stage 1 — Philosophy review and block strategy

Read the complete current philosophy and relevant source records. Deliver a concise but substantive review, conflict/assumption register, interpretation of a continuing 12-week block, proposed block organization, on-ramp relationship, entry expectations, and staged work plan.

**Do not write the 60 daily workouts in this stage.** The first substantive work must answer how Vortex should treat a recurring three-month block.

### Stage 2 — Program architecture

Create the complete 12-week progression matrix with all 60 daily entries and the separate four-week on-ramp map. Follow Section 5.1: connect block outcomes to phase objectives, weekly progression, daily emphases, exercise-family anchors, and prior/subsequent exposures. Define exposure balance, assessment/recovery, attendance logic, between-block continuity, and daily-format requirements.

**Gate:** audit and reconcile this complete outline before writing the detailed exemplars or individual workouts. A few example days, monthly labels, or a blank matrix do not satisfy this stage. Record the review, assumptions, and remaining conditional decisions.

The matrix can identify likely anchor exercises and methods, but it does not replace session-level exercise selection and detailed prescriptions. Later outline changes must be explicit and propagated to affected sessions and ledgers.

### Stage 3 — Prescription standards and exemplar

Resolve exercise/library mappings, the standardized warm-up, exercise-level age scaling, logistics assumptions, and progression/stop criteria. Produce one fully detailed representative main-program session and one fully detailed on-ramp session as format/quality exemplars.

Validate timing and prescriptions. Record needed corrections before extending the format across the program. The exemplar is not permission to make every other day a mechanical copy.

### Stage 4 — Complete the on-ramp

Write and review the instructional sessions sequentially, organized by week. Confirm that the instruction actually prepares athletes for the entry requirements used by the main block. Finish the competency matrix and mid-block entry example.

### Stage 5 — Build the main program one session at a time

For each session, consult the current philosophy, 12-week matrix, current/adjacent week, athlete assumptions, library candidates, previous relevant exposures, and cumulative workload ledger.

Then perform this sequence:

1. Read the relevant outline entry, prior and next related exposures, and cumulative workload context.
2. Write the daily stimulus brief: primary objective, supporting roles, observable quality target, and practical constraints.
3. Define the job and justified dose of each planned exercise/set group before selecting final exercise variants.
4. Select the primary Explosiveness and complementary full-body Strength content from canonical records; compare alternatives for consequential choices.
5. Establish ordering, pairing, recovery, and a concise explanation of how the exercises complement one another.
6. Prescribe every exercise for all three age bands, with competency overrides and explicit advance/hold/regress criteria.
7. Record prior → current → next exposure links and why each dose or variation changes, stays, or decreases.
8. Derive targeted preparation from downstream demands; add appropriate Capacity / Competition and coordinate separate tumbling.
9. Calculate real timing, equipment use, athlete flow, individual recovery, and total exposure.
10. Challenge the session: does every set have a job, is the dose justified, do the exercises complement each other, and does the workout fit the wider progression? Revise unsupported or redundant content.
11. Save the complete session, its concise rationale, and updated progression/workload ledgers before moving forward.

Do not attempt to generate all 60 sessions in one response or use a bulk template fill that skips individual decisions. Finalize one week of five individually developed sessions, audit that week, then continue to the next week at the same level of detail.

### Stage 6 — Whole-program audit and final assembly

After each week, after each major phase, and at completion, check the plan across sessions—not just within individual workouts. Verify complete day numbering, actual exercise prescriptions, explicit set purposes, library status, all age bands, timing, progression, recovery, equipment, attendance compatibility, and continuity. Trace recurring anchors through their full exposure chains, check that adjacent sessions complement one another, and reconcile any changes with the original outline. Review future planned exposure as well as completed session documents.

Assemble the coach manual and available repository-compatible exports. Do not label the project complete because an outline, first week, or handful of samples exists.

## 12. Preserve context across work units

Use repository files as durable project state, following existing folder conventions. Maintain:

- The reviewed philosophy and block-strategy document.
- The complete program matrix and instructional map.
- Source/assumption/conflict and decision logs.
- The versioned prescription template and standardized warm-up reference.
- Complete individual sessions grouped by week.
- A workload/exposure ledger and exercise progression ledger with explicit prior/current/next links.
- Daily stimulus briefs and set-purpose mappings, embedded in sessions or linked without duplicating conflicting copies.
- A progression-outline revision log identifying affected sessions and whether they have been reconciled.
- A QA report with unresolved dependencies and rejected/proposed content.
- A progress manifest listing exactly what is complete and the next work unit.

Before continuing after a context boundary, read the manifest and relevant source files. Do not rely only on memory of an earlier response or allow later weeks to drift from the agreed philosophy.

Suggested folder: `docs/programming/athleticism_12_week/`, with a separate `instructional_on_ramp/` section. Follow existing project structure when an appropriate location already exists. Do not claim files were saved until they actually were.

Limit revision loops and record unresolved issues instead of looping indefinitely. Checkpoints are concrete artifacts and reviews, not a requirement to ask the user for approval of every exercise. Reserve human decisions for genuinely consequential unresolved questions, new-card approval, and requested philosophy changes.

## 13. Timing, workload, and quality checks

Use 15 athletes and three lanes as the initial logistics test case unless the current project specifies another group. Confirm or clearly label coach count, equipment quantities, and usable distances as assumptions; do not invent them as facility facts.

Calculate work, individual recovery, queueing, return travel, demonstrations, and transitions. Show how rotations preserve required rest. Three lanes do not automatically make an unrealistic amount of work fit. Verify that older and younger prescriptions also fit the shared session structure.

Track useful exposure measures separately: sprint distances and effort categories, relevant jump/landing contacts, high-intent efforts, strength sets and effort targets, conditioning dose, and body-control demands where available. Do not collapse unlike contacts or invent a single authoritative fatigue score without a validated basis.

Check that simple doses are not secretly increased by finishers, competitions, or tumbling. Capacity programming must respect the day's total load and the skill demands that follow.

Do not invent universal numeric safety limits and present them as established fact. Identify which thresholds are approved Vortex policies, which are source-backed guidance, and which are provisional coach-review assumptions.

Use deterministic validation to check required fields, day/exercise references, dose arithmetic, set counts, timing, and missing age prescriptions. Use substantive programming review—not a numeric check alone—to evaluate selection quality, useful complementarity, and progression rationale.

Return `REVISE` when a session contains unassigned set purposes, unjustified changes, redundant exposure without a reason, advancement that ignores prerequisites, or a primary objective undermined by later work. A workout does not pass merely because it contains one exercise in each component or its minutes add up. Record whether each concern is resolved, conditionally accepted with a stated assumption, or awaiting coach review.

## 14. Required final deliverables

The complete project must contain:

1. Reviewed OTA-inspired Vortex philosophy, sources, and continuing-block strategy.
2. A complete, audited 12-week progression matrix with 60 numbered athletic sessions and explicit daily objectives, progression anchors, and prior/subsequent exposure relationships.
3. A separate four-week instructional curriculum with 20 session plans, competency checks, and main-program entry rules under the declared offering assumption.
4. Exercise-level prescriptions for ages 12–14, 9–11, and 15–18, including readiness overrides.
5. Standardized preparation plus each day's targeted preparation.
6. Verified exercise/programming record mapping, with approval gaps transparently separated.
7. Practical coach instructions, equipment/setup plans, explicit set purposes, complementary-exercise rationales, progression criteria, and compressed-session changes where applicable.
8. Explicit coordination with the separately programmed tumbling component and a truthful status for any missing tumbling prescriptions.
9. Assessment, attendance adjustment, and between-block transition guidance.
10. A complete QA report, set-purpose and progression traceability, reconciled workload/progression ledgers, and progress manifest.

Include a worked continuity example: take a hypothetical established athlete's documented end-of-block performance, clearly mark the example data as hypothetical, and show how the next block begins without sending the athlete back through beginner instruction. Demonstrate a different entry route for a newcomer completing the on-ramp.

## 15. First action

Begin with **Stage 1 only**. Review the philosophy and explain how the recurring 12-week block should work, why it should not restart at beginner level, and how the separate four-week instructional program feeds into it. Present the source/conflict register, recommended block architecture, important assumptions, and the next staged deliverable.

Do not jump directly to a 60-workout exercise list. The next major milestone after philosophy is the complete, reviewed progression outline—not an assortment of detailed workouts. The end goal is a fully prescribed, reviewable program in which every set has a purpose, every day fits the block, and every recurring exposure has an intentional progression or retention decision.
