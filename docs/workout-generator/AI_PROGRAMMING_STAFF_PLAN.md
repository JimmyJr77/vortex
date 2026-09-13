# AI Programming Staff: repository assessment and implementation plan

Audit: 2026-09-12. Functional authority: [AI_WORKOUT_PROGRAMMING_ARCHITECTURE.md](../AI_WORKOUT_PROGRAMMING_ARCHITECTURE.md), copied verbatim from the supplied document. This assessment describes repository code, migrations, tests, and documentation; it is not an assertion about the current production database. Existing uncommitted philosophy/UI work was inspected and is preserved.

## Architectural decision

Extend the canonical workout system with a versioned **session-component orchestration layer**. Keep PostgreSQL exercise definitions, variants, delivery profiles, programming methods, taxonomy, reviews, and library releases authoritative. Keep existing generators and saved workouts compatible. Specialized model capabilities propose coaching decisions; deterministic services retrieve, filter, rank, allocate, prescribe within reviewed bounds, schedule, and validate. No model receives a publication or rule-changing tool.

The new component order is Prepare & Access → Explosiveness → Strength → Capacity / Competition → Body Control / Tumbling. Generation order differs from delivery order: resolve downstream work and its demands before prescribing preparation. All decisions consume the same session revision, library release, coach constraints, and accumulated demand/load context. Do not call the existing generator once per component and concatenate results.

## What exists and how it should be used

Paths below are relative to the repository root.

| Area | Existing implementation | Reuse and extension |
|---|---|---|
| Application | `package.json`, `backend/package.json`, `src/coach/api.ts`, `backend/platform/coachPortalRoutes.js` | React 19 + Vite + TypeScript frontend; Express/ES modules backend; PostgreSQL via `pg`; Node test runner. Follow these conventions. No new service/framework is needed. Backend JS plus adjacent `.d.ts` declarations already exists in `phaseArchitect` and `focusApplicability`. |
| Philosophy | `src/coach/vortexTrainingPhilosophy.ts`, `prepareAccessRampPhilosophy.ts`, `trainingPhilosophyTaxonomy.ts`; `docs/VORTEX_TRAINING_PHILOSOPHY.md` | Reuse Vortex terminology, integrated tenets and Raise → Mobilize → Activate → Integrate → Potentiate Bridge. The current uncommitted guide has four developmental pillars and an optional capacity window. The initiative specification controls the five-component programming contract; capacity can serve recovery/transition when appropriate and must preserve subsequent tumbling readiness. Reconcile the display later without rewriting the guide during this audit. |
| Legacy workout storage | Migrations `013`, `020`, `082`, `139`; `src/coach/types.ts` (`Workout`, `WorkoutBlock`, `WorkoutItem`) | `coaching.workout`, `workout_block`, `workout_item` already support prescriptions and programming-method IDs. Preserve these IDs and saved-session behavior. Add a deliberate render/save adapter only after the component contract stabilizes. |
| Canonical storage | Migration `241_coaching_canonical_workout_model_v1.sql`; `canonicalWorkoutContract.js`, `canonicalLibraryRepository.js` | Reuse `exercise_definition_v1` → `exercise_variant_v1` → `exercise_delivery_profile_v1`; `workout_library_release_v1`; `generated_workout_v1` snapshots with intent, output, validation and versions. Add a component model discriminator/version to the existing JSON envelope; do not create another workout or exercise library. |
| Card authoring and approval | `canonicalCardAuthoring.js`, `canonicalCardRepository.js`, `canonicalAiCardDraft.js`, `canonicalResearchReview.js`; migrations `243`, `246`, `265`, `753` | Existing canonical draft validation, duplicate checks, independent human review, version-specific media and structured-profile evidence, lifecycle `draft → review → published`. Represent `AI_PROPOSED` as workflow/provenance on an existing draft, not a new database card status. Exercise Creator must use this path after gap evidence exists. |
| Exercise retrieval | `loadPublishedCanonicalLibrary`, `loadCurrentCanonicalLibraryRelease`; `exerciseLibrarySearch.js`; `phaseAwarePrescription.js` | Published canonical loader is facility scoped and checks card/media/taxonomy/profile/relationship approval evidence. Existing routes intersect with the current release definition IDs. Extract reusable eligibility/scoring from the canonical engine for a ranked candidate API. Search drafts too for duplicate/gap research, while keeping them ineligible for generation. |
| Programming library | `programmingMethodProgramming.js`, `programmingValidation.js`, `coachProgrammingRoutes.js`; migration `138` | Already has phase fit, dosage, compatibility, fatigue, quality standards, stop rules, equipment tags, and validator rules. Extract the list query into a facility/user-scoped repository and reuse `scoreProgrammingMethodForBlock`. Generation should select published accessible methods; owner-visible drafts remain review content. Canonical generation currently exposes methodology keys, not a complete canonical programming-method selection workflow. |
| Taxonomy | `taxonomyV2.js`, `taxonomyV2Repository.js`; migrations `750`–`753`; `src/coach/taxonomy.ts`, `useTaxonomy.ts` | Reuse controlled facets: tenets, training families, methodologies, physiology mechanisms, programming structures, conditioning protocols, movement, anatomy, equipment roles and scoped assignments. Keep method records distinct from methodology tags. Legacy 1–5/1–10 metadata is not interchangeable with reviewed canonical 1–100 fields. |
| Athlete context | `ageDifficultyPolicy.js`, `skillLevelPolicy.js`, `sportContextPolicy.js`, `canonicalWorkoutContract.js`; `coachPortalRoutes.js` load/wellness/grades endpoints; migrations `016`, `022` | Age/training-age, experience, cohorts, limitations, wellness check-ins, skill progress and recent load already exist. Add authorized, timestamped context assembly for readiness, adjacent sessions and maturity when known. Requested 9–11 / 12–14 / 15–18 groups are coach-facing cohorts, not silently substituted for existing policy bands. Experience belongs on athletes; exercise cards explicitly prohibit skill-level labels. |
| Equipment/logistics | `coaching.equipment` in migration `011`; taxonomy v2 equipment roles; canonical environment/time/logistics profiles; `equipmentSetupsStorage.ts` | Equipment taxonomy is not a live quantity inventory. Saved setups use browser localStorage. Canonical input supports quantities, coach count, floor area and lane length, but not explicit lane count or a shared station schedule. Missing quantity currently behaves as unconstrained in the engine: the new final scheduler must instead report unresolved quantity for required physical resources. |
| Existing generation | `phaseArchitect.js`, `phaseAwarePrescription.js`, `canonicalDeterministicEngine.js` | Reuse planning, eligibility, deterministic scoring, dosage and approved substitution concepts. Canonical engine already selects anchors first, derives a demand signature and accumulates fatigue/stress. Extract its helpers with parity tests before extending; no third independent selector. |
| Validation and repair | `workoutValidation.js`, `programmingValidation.js`, `controlResilienceValidation.js`, `prescriptionQualityChecks.js`, `requirementsContract.js`, `hardGateEligibility.js`, `prescriptionRepairLoop.js`, `canonicalQualityEvaluation.js` | Retain existing neural ordering, sprint/landing preparation, high-impact, age/readiness, programming placement and stop rules. Adapt them into one structured finding envelope with stable rule IDs and severity. Legacy warnings and canonical hard failures have different semantics; build an explicit coverage/severity matrix rather than claiming one existing validator enforces everything. |
| AI | `aiService.js`, `canonicalAiIntent.js`, `canonicalAiCardDraft.js` | Existing Vercel AI SDK structured intent interpretation and quarantined card drafting. Reuse provider wrapper and audit conventions when introducing specialists. Current interpreter only proposes intent and can replace supplied defaults; new Director must receive immutable coach constraints and return a narrow decision patch, never a replacement request. |
| UI/API | `CanonicalWorkoutGeneratorPanel.tsx`, `NeedsEnginePanel.tsx`, `WorkoutSetupWizard.tsx`, `WorkoutBuilder.tsx`, `ProgrammingLibraryPanel.tsx`, `CanonicalCardEditor.tsx`, builder stores | Extend existing canonical generator and editor surfaces. Current controls include duration, athletes/coaches, quantities, focuses, phase emphasis and swaps; modes are deterministic/AI-assisted. Add four autonomy modes, component AUTO/directed controls, locks and modification flows here rather than adding a parallel chatbot. |
| Telemetry/rollout | Migrations `242`, `243`, `755`; `canonicalFeatureFlags.js`, `canonicalOperationalReadiness.js`; canonical review/swap/rollout routes | Reuse intent usage/latency audits, generated snapshots, coach reviews and feature gates. Add bounded capability-run/revision records and cost metadata. Keep deterministic form usable when model calls fail, and label fallback honestly. |

Useful existing routes: `/api/coach/taxonomy`, `/taxonomy-v2`, `/programming-methods`, `/needs-engine/prescribe-canonical`, `/needs-engine/prescribe-canonical-ai`, `/canonical/cards/duplicate-check`, `/canonical/cards/ai-draft`, card review/status routes, `/canonical/workouts/:id/swaps`, `/canonical/workouts/:id/review`. Route prefixes after the first entry are also `/api/coach`. Existing permission names include `library.view`, `library.manage`, `workouts.manage` and `coach_insights.view`.

## Important gaps and compatibility decisions

1. **Components are not legacy phases.** Both canonical and legacy engines persist seven ordered phase keys: `prepare_and_access`, `movement_intelligence`, `output`, `capacity`, `resilience`, `sustained_capacity`, `restore`. Legacy `capacity` primarily houses strength; requested Capacity / Competition is closer to `sustained_capacity`. Never rename `capacity` to mean conditioning in old data. Preserve each prescription's delivery-profile phase separately from its new session component.
2. **Metadata hints are not eligibility.** Preparation can retrieve `prepare_and_access`; Explosiveness often retrieves `output`; Strength often retrieves `capacity`; Capacity / Competition often retrieves `sustained_capacity`; Body Control may draw from `movement_intelligence`/`resilience` and specific skill profiles. These are discovery hints, not unconditional conversions. Review exact purpose, dose, prerequisites, freshness, impact and supervision. A high-output tumbling profile cannot become a safe late-session drill by relabeling it. Movement intelligence/resilience/restore remain useful metadata within components.
3. **Whole-session timing is incomplete.** Existing canonical time estimates include several overheads, but clamp demonstration/transition time to allocation fractions and allow estimated-duration tolerance. Station count is derived per exercise; synchronization is prose. Extend this to explicit athlete waves, resource occupancy, coach assignment, rest and runout. Never shorten reviewed minimum recovery/demo time to make arithmetic pass. Book athletic and separate tumbling time explicitly; a 60-minute athletic workout plus 30 tumbling is 90 minutes booked, not 60.
4. **Fatigue totals are not an execution ledger.** Anchor-first selection already improves coherence. Selection-order cumulative sums do not establish execution-order freshness, actual sprint distance/contact load, readiness before tumbling, or fatigue-dependent Capacity intensity. Add a delivery-order ledger and recalculate it after every edit. Treat heuristic stress scores as reviewed programming estimates, not physiological measurements.
5. **Equipment catalog coverage is incomplete for the requested examples.** The current controlled v2 equipment set plus canonical compatibility keys does not include every facility item (for example sled/turf). Do not invent keys or relabel an item as another device. Reconcile authoritative `coaching.equipment`, reviewed aliases and facility resources in the librarian/inventory increment. Surface missing taxonomy distinctly from unavailable equipment and from an exercise gap. The first contract intentionally retains current canonical supported keys.
6. **Library coverage needs evidence.** `PRODUCTION_ROLLOUT.md` records an August 11 disposable-DB snapshot with 206 review definitions and zero published cards. This is historical evidence, not a live September count. Before real generation, inspect the target facility's release/readiness read-only. Empty or unpublished coverage produces an actionable result; it never authorizes automatic publication or fallback to unreviewed cards.
7. **Final validation must hydrate truth again.** `validateCanonicalWorkoutOutput` checks generated metadata and totals; it is not a security boundary for arbitrary model/client prescriptions. Resolve all IDs within the authenticated facility/release and re-evaluate dose, equipment, eligibility and rules from database records before saving a final revision. Existing programming validators should receive pre-scoped records or gain a scoped adapter, rather than trusting arbitrary IDs.
8. **Gap and revision state are missing.** Zero ranked results alone is insufficient evidence for exercise creation: failures might be inventory, impossible duration, overconstrained locks, catalog coverage or missing approvals. Capture search coverage and relaxable preferences first. There is no staff registry, typed specialist revision protocol, or lock-preserving natural-language modification pipeline yet.

## Staff responsibilities and deterministic boundaries

| Capability | Judgment supplied | Deterministic owner / authority restriction |
|---|---|---|
| Vortex Director of Performance | Objective, tradeoffs, coherent component intents, accepted consultant advice | Orchestrator owns run state and immutable coach request; validates Director patches; Vortex policy outranks consultant preferences. |
| Methodology / Performance Consultant | Optional method recommendations with canonical IDs, rationale and public source references | Pluggable interface; no constraint changes, publication or direct library mutation. OTA-style adapter uses public concepts and does not reproduce proprietary workouts. |
| Athlete Development | Readiness interpretation, teaching complexity, progression/regression recommendations | Existing population, contraindication, prerequisite and reviewed dosage rules enforce eligibility. Unknown readiness remains unknown; AI cannot waive a restriction. |
| Programming Librarian | Optional interpretation of a coaching objective into search intent | Repository, visibility filters, compatibility and ranking run as ordinary deterministic code; return canonical method IDs and score evidence. |
| Exercise Librarian | Optional clarification of desired movement stimulus | Release-scoped retrieval, eligibility, ranking, duplicate detection and gap evidence run deterministically. |
| Exercise Creator | Proposed missing movement/card content | Requires verified `ExerciseGap`; reuse draft validator/quarantine and existing human review. No generation from drafts and no shadow library. |
| Prepare & Access Specialist | Adapt the familiar framework to exact downstream demands | Can run only after demand snapshot exists; deterministic coverage, time, dose and fatigue checks verify the proposal. |
| Session Builder | Operational arrangement proposal where coaching judgment helps | Deterministic allocator prescribes within reviewed ranges, calculates waves/queues and shared resource schedule, and enforces locks. |
| Programming Critic / QA | Coaching critique, concise rationale, targeted revision requests | Structured PASS/REVISE. PASS cannot suppress hard findings. Orchestrator routes revisions and limits attempts; final deterministic validation always follows. |

Use a typed registry of capabilities with `id`, `version`, input/output parsers and a bounded `invoke` implementation. Registration does not imply one model call per role. Combine compatible reasoning tasks, skip unused consultants, and register librarians/scheduler as services. Do not implement speculative sprint/strength/periodization agents now.

## Proposed typed contracts

This is a staged contract proposal, not a claim that all objects already have runtime implementations. The first implemented boundary is linked below. Use backend ES modules with runtime parsers and adjacent TypeScript declarations; carry existing canonical card/dose/focus types by reference when extracting them from the current local UI interfaces. Avoid another broad exercise-card interface.

```ts
type ComponentKey = 'prepare_and_access' | 'explosiveness' | 'strength'
  | 'capacity_competition' | 'body_control';
type AutonomyMode = 'generate_for_me' | 'guided' | 'coach_directed' | 'modify_existing';
type CanonicalId = string; // UUID for canonical cards/releases/workouts; bigint text for methods/actors; validate by table
type RevisionId = string;

interface CanonicalExerciseRef {
  exerciseCardId: CanonicalId; // existing definition ID, not legacy exercise ID
  variantId: CanonicalId;
  deliveryProfileId: CanonicalId;
  cardVersion: number;
}
interface TaxonomyRef { facet: string; key: string } // validate against DB catalog
interface Priority { target: TaxonomyRef; strength: 'required' | 'preferred' | 'exclude'; weight: number }
interface AthleteProfile {
  cohortId: string; athleteCount: number;
  ageMin: number; ageMax: number;
  trainingExperience: 'beginner' | 'intermediate' | 'advanced';
  trainingAgeMonths: number | null;
  sportIds: CanonicalId[];
  readiness: { observedAt: string; sourceRecordIds: CanonicalId[]; limitations: string[] } | null;
  maturityContext: string | null; // only known, coach-supplied context
  competencyEvidenceIds: CanonicalId[];
  recentSessionIds: CanonicalId[];
}
interface EquipmentAvailability {
  available: string[]; quantities: Record<string, number | null>;
  excluded: string[]; // null quantity is unknown, never unlimited
}
interface ComponentEquipmentPreferences {
  allowed?: string[]; // omitted inherits; empty means no physical equipment
  preferred?: string[]; excluded?: string[];
}
interface ComponentControl {
  key: ComponentKey; selection: 'auto' | 'directed';
  budgetSeconds: number | null; // null asks allocator; positive values consume booked time
  priorities: Priority[];
  preferredMethodIds: CanonicalId[]; excludedMethodIds: CanonicalId[];
  preferredExercises: CanonicalExerciseRef[]; excludedExerciseCardIds: CanonicalId[];
  equipment: ComponentEquipmentPreferences;
  locks: Array<{ blockId: string; fields: Array<'method' | 'exercises' | 'dose' | 'timing'> }>;
}
interface CoachWorkoutRequest {
  schemaVersion: string; requestId: string; mode: AutonomyMode;
  athletes: AthleteProfile[]; priorities: Priority[];
  schedule: { athleticSeconds: number; tumblingSeconds: number; totalBookedSeconds: number };
  logistics: { coachCount: number; laneCount: number; stationCount: number;
    laneLengthFeet: number | null; floorAreaSquareFeet: number | null };
  equipment: EquipmentAvailability; components: ComponentControl[];
  consultantIds: string[];
  modification: { workoutId: CanonicalId; expectedRevision: RevisionId; instruction: string } | null;
}
interface SessionIntent {
  requestId: string; revision: RevisionId; philosophyVersion: string;
  libraryReleaseId: CanonicalId; ruleVersion: string;
  objective: string; components: ComponentIntent[];
  assumptions: string[]; explanation: ProgrammingExplanation;
}
interface ComponentIntent {
  key: ComponentKey; purpose: string; budgetSeconds: number;
  priorities: Priority[]; methodCandidateIds: CanonicalId[];
  dependsOn: ComponentKey[]; // preparation depends on downstream demand snapshot
}
interface MethodologyRecommendation {
  consultantId: string; programmingMethodIds: CanonicalId[];
  rationale: string; publicSourceUrls: string[]; tradeoffs: string[];
}
interface ExerciseCandidate {
  ref: CanonicalExerciseRef; programmingMethodIds: CanonicalId[];
  score: number; scoreComponents: Record<string, number>;
  eligibilityEvidenceIds: string[]; // server-owned evidence, never model assertion
}
interface ExerciseGap {
  id: string; requestRevision: RevisionId; libraryReleaseId: CanonicalId;
  component: ComponentKey; unmetDemand: string;
  searchAuditId: string; rejectedCandidates: Array<{ ref: CanonicalExerciseRef; ruleIds: string[] }>;
  alternativesConsidered: string[];
  reason: 'missing_movement_or_delivery_profile';
}
interface ProposedExercise {
  gapId: string; draftAuditId: CanonicalId; state: 'AI_PROPOSED';
  canonicalDraftId: CanonicalId | null; // existing draft store, existing schema
  humanReviewRequired: true;
}
interface SessionBlock {
  id: string; component: ComponentKey; programmingMethodId: CanonicalId | null;
  exerciseRefs: CanonicalExerciseRef[];
  prescriptionIds: string[]; // reuse canonical dose/prescription contracts
  startSecond: number; durationSeconds: number;
  resourceScheduleId: string; demandSnapshotId: string; loadLedgerEntryIds: string[];
  rationale: string;
}
interface ProgrammingExplanation { summary: string; decisions: Array<{ subjectId: string; rationale: string }> }
interface RevisionFinding {
  id: string; ruleId: string | null; blockIds: string[]; component: ComponentKey | null;
  owner: 'director' | 'athlete_development' | 'prepare_access' | 'session_builder' | 'librarians';
  severity: 'hard' | 'coaching'; message: string;
}
type QAResult =
  | { status: 'PASS'; revision: RevisionId; rationale: string; findings: [] }
  | { status: 'REVISE'; revision: RevisionId; rationale: string;
      findings: [RevisionFinding, ...RevisionFinding[]] };
interface GeneratedWorkout {
  schemaVersion: string; sessionModel: 'vortex_components_v1';
  workoutId: CanonicalId; revision: RevisionId; intent: SessionIntent;
  blocks: SessionBlock[]; deterministicValidationId: string; qa: QAResult;
  explanation: ProgrammingExplanation;
}
interface Capability<I, O> {
  id: string; version: string;
  parseInput(raw: unknown): I; parseOutput(raw: unknown): O;
  invoke(input: Readonly<I>, context: { runId: string; revision: RevisionId; signal: AbortSignal }): Promise<O>;
}
interface MethodologyConsultant extends Capability<SessionIntent, MethodologyRecommendation> {}
```

Authentication supplies facility/user context separately; neither model output nor client body may set it. Each handoff also carries run/revision, schema/policy/library versions, canonical references, concise rationale and uncertainty. Database hydration verifies foreign keys, version membership and visibility. Server-constructed resource and validation IDs cannot be manufactured by a model. Runtime schemas reject unknown authority fields and malformed/oversized input; numeric coercion and unknown enum fallback are inappropriate at the model boundary.

`SessionIntent` is a resolved overlay around the existing normalized workout intent, not a replacement athlete/equipment schema. Extract shared types as needed. Preserve legacy phase metadata in canonical prescriptions even when `SessionBlock.component` differs. The model-facing selection output should contain only candidate IDs from the provided pool plus rationale; the server resolves actual cards, quantities, dose bounds and rules.

## Orchestration and validation flow

1. Authenticate, load facility context and release, validate coach request and locks. Compile immutable hard constraints and preflight impossible combinations.
2. Director resolves objective and component priorities. Optionally request developmental/consultant advice. Accept only a validated decision patch that respects coach constraints.
3. Deterministic librarians retrieve/rank methods and exact exercise profiles using the shared eligibility/scoring implementation. Emit rejection evidence and distinct outcomes for missing approval, unavailable resources, constraint conflict and true content gaps.
4. Build downstream work in delivery order, carrying dose-derived load/stress and demands from Explosiveness through Strength, Capacity and scheduled Body Control. Capacity must consume the remaining fatigue budget and preserve any later freshness-sensitive work. Do not treat a calendar age or missing readiness record as evidence of skill competency.
5. Prepare specialist adapts the existing five-purpose framework from the full downstream demand snapshot. Deterministic coverage checks link each required preparation stimulus to a selected prescription. Recompute downstream budgets if preparation itself changes fatigue.
6. Builder schedules the whole session: explanation/setup/reset, athlete waves, actual work/rest, transitions, resource overlap, stations/lanes, supervision and clear runout. All intervals fit the booked clock. No invented equipment and no unverified quantities for required physical resources.
7. Run deterministic rules, then Critic. Route structured revisions to the responsible capability. Start with a maximum of two revision attempts, explicit model-call/token/time budgets, cancellation, and unchanged-state detection. Rehydrate and revalidate after every repair. Preserve locked fields exactly; impossible locks return a coach-action result.
8. Finalize only after fresh deterministic validation and Critic PASS for the same revision. Persist using existing generated snapshot storage with versions, request hash, selected IDs, validated explanations and run evidence. Exhaustion yields `NEEDS_COACH_REVIEW` with findings, never a falsely final workout. Modify Existing and swaps rerun downstream demands, preparation, resource scheduling and whole-session QA.

Existing deterministic rule thresholds remain in force until a separate approved change. The new component sequence is an initiative requirement, not permission to change age/impact or safety thresholds. Where old phase-order assumptions conflict with the new composition, adapt rule context explicitly and test both paths; do not turn off the old validator globally.

## Phased implementation and acceptance gates

| Increment | Concrete work | Required evidence before progressing |
|---|---|---|
| 0 — Assessment | Preserve supplied specification; this inventory, mapping, conflicts, contracts and plan | Trace decisions to real repository code; distinguish historical rollout evidence from live state. Completed in this change. |
| 1 — Component contract | Pure versioned component budget/equipment boundary + `.d.ts`; shared taxonomy resolver and existing compatibility keys | Exact order; no duplicate/unknown components; no hidden time extension; inherited/narrowed equipment; aliases; zero/unknown quantity handling; malformed output rejection. No production route change. Implemented in this change. |
| 2 — Shared librarians | Extract canonical eligibility/ranking and programming queries; add release/facility-scoped candidate results and gap evidence; reconcile missing equipment catalog mappings | Existing canonical golden/parity tests pass; inaccessible/draft/out-of-release IDs rejected; stable ranking; unknown taxonomy and missing publication distinguished from ExerciseGap; read-only facility readiness report. |
| 3 — Staff boundary and Director | Strict request/intent/decision schemas, immutable coach controls, capability registry; optional methodology and developmental advice using existing AI wrapper | Malformed/unknown IDs, constraint broadening, stale revisions and consultant authority violations rejected; deterministic fallback explicit; model calls mocked/injected in tests. |
| 4 — Whole-session builder | Add component plan option to shared planner, execution-order load ledger, canonical method-linked dosage, resource/time scheduler and locks | 60/90-minute athletic templates and explicit tumbling booking; 15 athletes/3 lanes executable; no concurrent equipment overbooking; enough recovery; dose-dependent fatigue affects Strength/Capacity; old generator fixtures unchanged. |
| 5 — Demand-driven preparation | Connect downstream demands to existing Prepare & Access framework and readiness validators | Sprint, landing, upper support, mobility and pattern preparation match selected downstream exercises; changing downstream work invalidates and rebuilds relevant preparation; no warm-up exhaustion. |
| 6 — Critic and revisions | Structured PASS/REVISE, targeted bounded repairs, validation after every change and final rehydration | No stale PASS; no hard-rule override; lock integrity; loop/call limits; adversarial outputs; failure leaves an actionable draft. |
| 7 — ExerciseGap and Creator | Proven search gap → existing quarantined draft → existing independent review | No creator on library outage, unpublished coverage or impossible constraints; exact schema/taxonomy validated; no AI publication; duplicates surfaced; only human-approved released records eligible. |
| 8 — Coach controls | Extend canonical generator/editor with four autonomy modes, dynamic priorities/methods, component equipment, lanes/stations, block locks and modifications | Browser checks for complete generate → edit → revalidate flow; accessible controls; 9–11, 12–14, 15–18 and mixed readiness scenarios; accurate separate tumbling time. |
| 9 — Pilot and rollout | Extend existing audit records and feature enrollment; compare generated sessions with coaches | Representative full-session fixtures, measured execution vs plan, canonical release gates, authentic human card/pilot reviews, latency/cost reporting and rollback. Existing human gates are not auto-approved by this implementation request. |

Tests grow with each increment; do not add a full-system facade ahead of the underlying verified services. Reuse Node tests, existing golden matrix and approved fixture builders. Add database integration tests with disposable PostgreSQL when persistence/scoping changes. Use browser verification when UI work starts. No live-model call is required for deterministic tests.

## First increment scope

`backend/platform/sessionComponentContract.js` and its adjacent declaration expose a **planning boundary only**. It validates integer seconds within a booked duration and component equipment inheritance. It does not establish exercise eligibility, lane throughput, coach ratios, completed-session safety, or successful QA. Unallocated seconds remain explicit reserve; incomplete component lists are accepted as planning input and must be resolved by the later Director before finalization. Separate tumbling must be counted in the supplied booked duration if included in the plan.

Do not wire this planning object directly into `generateCanonicalWorkout`: its planner and validator still use the legacy seven-phase vocabulary and order. The component-aware builder and final validator must land before an endpoint advertises five-component generation.

Verification for this increment: 51 Node tests passed across `sessionComponentContract`, `canonicalWorkoutContract`, `canonicalDeterministicEngine`, `phaseArchitect`, and `taxonomyV2`. This includes 11 new component-contract tests and the existing 7,000-card deterministic generation scenario. JavaScript syntax, declaration checking and whitespace checks also pass. The copied specification matches the supplied file byte for byte. No database migrations, publication actions or feature-flag changes were performed.

```sh
node --test backend/platform/__tests__/sessionComponentContract.test.js backend/platform/__tests__/canonicalWorkoutContract.test.js backend/platform/__tests__/canonicalDeterministicEngine.test.js backend/platform/__tests__/phaseArchitect.test.js backend/platform/__tests__/taxonomyV2.test.js
```

## Shared librarian increment (2026-09-12)

Implemented the shared retrieval foundation of increment 2:

- `canonicalExerciseSelection.js` contains the existing eligibility, ranking, focus and demand-signature implementation. The existing generator imports these helpers; its default first-profile behavior and scoring remain unchanged. Librarian searches explicitly inspect every matching delivery profile so an unavailable first profile cannot hide a usable second profile.
- `canonicalLibraryRepository.loadReleasedCanonicalLibrary` centralizes facility-scoped published-release intersection. Both existing canonical generation endpoints reuse it.
- `programmingLibraryRepository.loadProgrammingLibraryPage` centralizes bound SQL, facility/author visibility, publication and pagination. The existing Programming Library route retains its array response and explicit own-draft visibility; generator searches default to published records. Ranking searches up to 5,000 methods and explicitly reports incomplete coverage beyond that bound.
- `workoutProgrammingLibrarians.searchWorkoutProgrammingResources` returns typed canonical references, score components, method preferences/exclusions, rejection evidence, request revision/hash, release versions and quantity unknowns. It narrows component equipment using the first increment's contract and hydrates downstream demand references against the current release and exact card version.
- `coachingLibraryContext.withCoachingLibrarySnapshot` uses a read-only repeatable-read transaction for a consistent multi-library handoff, rolls back failures, and releases/discards connections correctly. Exercise/variant/profile/release IDs are UUIDs; method/facility/user IDs are bigint strings. The earlier illustrative contract's generic ID comment has been corrected accordingly.

Results remain candidates for composition. Missing releases, constraint conflicts, unavailable programming methods, truncated searches and database failures never create an `ExerciseGap` or authorize Exercise Creator. The confirmed-gap/draft-duplicate research and approval workflow remains increment 7. No new generation endpoint, model call, library publication or rollout change is introduced by this increment.

Verification: the focused tests cover library scoping, profile enumeration, constraint enforcement, equipment scope/unknown quantities, stale or foreign downstream references, method pagination, immutable handoffs, and transaction failures. Existing canonical golden tests and the 7,000-card scenario pass. All 24 complete generation outputs/failures captured before extraction remain deeply equal after it. The declaration and syntax checks pass. A disposable PostgreSQL 15 container ran the actual programming migrations and verified facility isolation, author-only draft visibility, bound search inputs, pagination, forbidden writes, and repeatable-read consistency under a concurrent publication change. The temporary container was removed after the test; no existing database was modified.

Read-only local readiness evidence: the existing `vortex_postgres` development container has `public.facility` and `coaching.equipment`, but **does not have** `coaching.exercise_definition_v1`, `coaching.workout_library_release_v1` or `coaching.programming_method`. A live canonical generation test cannot run against that database yet. This is local development evidence, not production evidence, and does not justify applying the repository's entire migration history automatically. Its equipment catalog includes legacy `sled`, `bands`, `cones` (labelled Cones / Ladder), and `dumbbell`. The controlled v2 catalog still needs reviewed reconciliation for these identities; the new librarian does not invent mappings or silently treat a sled as another resource.

The following staff-boundary increment extends these shared librarians. Full live-facility readiness, confirmed ExerciseGap research, scheduling, QA, approvals and the coach UI remain unfinished.

```sh
node --test backend/platform/__tests__/workoutProgrammingLibrarians.test.js backend/platform/__tests__/programmingLibraryRepository.test.js backend/platform/__tests__/canonicalLibraryRepository.test.js backend/platform/__tests__/canonicalGoldenMatrix.test.js backend/platform/__tests__/programmingValidation.test.js
# Opt-in integration test: supply an empty dedicated loopback database named vortex_programming_test_<suffix>.
node --test backend/platform/__tests__/programmingLibraryRepository.postgres.test.js
```

## Coach request and Director increment (2026-09-12)

Implemented the intent-stage portion of increment 3, with adjacent TypeScript declarations and strict runtime contracts:

- `workoutProgrammingRequest.js` validates and freezes coach truth: all four autonomy-mode contracts, athlete cohorts, chronological/training age, explicit readiness unknowns, limitations and evidence IDs, athletic/tumbling booking, coaches/lanes/stations/space, equipment quantities and preferences, taxonomy priorities, component controls, exact exercise references, method IDs and locks. Total booked time must equal athletic plus tumbling time. Modification requires a source UUID, expected revision and instruction. Source IDs and observations are supplied context, not proof of verified competency; later authenticated hydration must verify them.
- Component budgets are deterministic. The specification's 60- and 90-minute clocks provide allocation weights; fixed coach budgets remain fixed. Capacity can be explicitly omitted, while an omitted component cannot retain locked work or required priorities. Reserve time stays explicit. Mixed-cohort retrieval uses the youngest member's existing budget baseline, minimum training age, least-experienced cohort and union of limitations. Unknown readiness is never promoted into a competency claim.
- Required priorities remain on the immutable request as session/component coverage obligations. The retrieval projection ranks them as strong preferences so support work need not satisfy every anchor priority; final coverage enforcement belongs to composition. No relaxation is written back into coach truth.
- `programmingStaffRuntime.js` registers server-owned capabilities and checks the expected role at invocation. It bounds calls, input size, output-token allocation, run duration and per-call duration, supports cancellation, rejects concurrent loops, validates output independently of provider schemas, and records capability/model versions, latency, token usage and failures. Missing token usage retains the full reserved output allocation. Neither registration nor model output grants database, rule-editing or approval tools.
- `programmingStaffModel.js` uses the installed AI SDK 6 `ToolLoopAgent` with `Output.object`, one step, no tools and no automatic retries. The existing `aiService.js` exposes a factory using the application's current model configuration. This increment does not change providers or select a new production model.
- `workoutProgrammingDirector.js` orchestrates a read-only resource snapshot, optional Athlete Development advice, pluggable registered Methodology Consultant advice, and the Vortex Director's session-intent proposal. Schemas reject extra authority fields; semantic validation rejects stale revisions, foreign/component-inappropriate IDs, removed locks, reordered components, unrequested coach-directed choices and premature automatic preparation selection. Consultant method/source references must belong to supplied canonical candidates and registered source references. Consultants cannot alter the deterministic plan.
- Batched librarian retrieval uses one release and database snapshot across active components. Eligible coach locks are retained beyond the ranked shortlist limit; stale/unavailable/ineligible locks remain explicit unresolved controls. Exact exercise-profile preferences and component equipment preferences now influence ranking. These additions do not change the legacy generator's selection defaults.

The result is explicitly `INTENT_READY` or `NEEDS_COACH_REVIEW`, with `validatedWorkout: false` and `creatorAuthorized: false`. `INTENT_READY` permits the next composition stage; it does not establish resource feasibility, required-priority coverage, warm-up completeness, coach approval or final workout safety. Automatic Prepare & Access exercise selection is deferred until downstream prescriptions expose actual demands. Failed, unavailable, over-budget or invalid advice yields a deterministic review draft while preserving the original request and locks; it never becomes a publishable fallback workout. Cancellation propagates as cancellation.

**Remaining boundaries:** the Director is not exposed as a five-component generation endpoint. Modify Existing is represented and validated in the request contract, but execution returns `source_workout_adapter_required` until the persisted component-workout adapter can hydrate and verify a source revision and preserve block locks. The initial methodology capability is pluggable; no OTA-specific public-source packet or methodology claims have been added. Athlete evidence hydration, shared philosophy/version packaging, component-aware prescriptions and cumulative fatigue, lanes/station scheduling, demand-driven preparation, final Critic validation, approved exercise creation, persistence and coach UI remain required. The full initiative is active.

Verification: **125 Node tests pass** across the new contracts, runtime, Director and librarians plus existing canonical contracts, generation, golden scenarios, programming rules and taxonomy. Tests exercise injected model failures/authority attempts and the actual installed `ToolLoopAgent` with its mock language-model provider; no paid/live model call was needed. All **24 complete legacy outputs/failures** captured before helper extraction still deeply match. Strict TypeScript declaration checking, JavaScript syntax and whitespace checks pass. The earlier disposable PostgreSQL snapshot/visibility integration remains applicable; this increment adds no SQL mutation, migration or publication action.

Next implementation slice: build the component-aware whole-session prescription and scheduling core over existing canonical cards, dosage profiles, cumulative-load rules and programming validation. Select downstream work first, derive preparation requirements, compose the Vortex framework, then validate the complete booked session. Rehearse the canonical schema in a disposable database and prepare a reviewed equipment-identity mapping alongside that software work.

```sh
node --test backend/platform/__tests__/workoutProgrammingRequest.test.js backend/platform/__tests__/programmingStaffRuntime.test.js backend/platform/__tests__/workoutProgrammingDirector.test.js backend/platform/__tests__/workoutProgrammingLibrarians.test.js
```

## Prescription, resource scheduling and load-ledger increment (2026-09-12)

Implemented the deterministic execution primitives for increment 4:

- `canonicalProgrammingDose.js` binds a released exercise delivery profile to an existing, group-appropriate programming-method prescription profile. It preserves canonical IDs, method work/rest clocks, reviewed exercise defaults/bounds, contact provenance, load metadata, quality gates and stop rules. Missing defaults or incompatible method/card doses require review; the code does not stretch work, remove rest or invent a new method to fill a window. Set reductions require explicit reviewed bounds. Missing/null contact counts remain unknown and fall through to reviewed estimates or per-repetition models; unknown high-impact exposure is rejected. High-fatigue Capacity before booked tumbling and high-fatigue/high-technical methods are rejected.
- `workoutResourceScheduler.js` assigns every athlete to explicit repeated waves, calculates work/reset/recovery intervals, consumes actual stations/lanes/equipment and station footprints, preserves full-group canonical supervision ratios, and retains teaching/setup/cleanup time. Shared physical stations have one active athlete; floor-only group drills use reviewed station capacity. Limited equipment can increase the number of waves instead of implying imaginary inventory. Unknown required inventory, floor area or lane dimensions cannot be treated as feasible. Missing overhead estimates leave an explicit coach-confirmation finding rather than a falsely complete schedule.
- The event verifier checks participant dose completeness, work clocks, within- and cross-activity recovery, station/lane assignment integrity, simultaneous equipment/space conflicts, booked time, stale dose hashes and duplicated activities. `scheduleProgrammingSession` places activities inside the immutable component windows and exposes every unfilled second. Its `SCHEDULED` status concerns scheduling only; `validatedWorkout` remains false. Changing coach clocks or equipment controls is rejected.
- `workoutLoadLedger.js` re-resolves source doses and replays exposure in actual execution order. Every entry records before/after/remaining fatigue, stress and high-impact contact budgets; forged summaries do not suppress cost. Longer booking, extra waves, reserve or additional tumbling time cannot dilute an unchanged athlete dose. Later work can fail because earlier work already consumed the budget, and an explicitly allowed smaller dose can then fit. Unknown required load metadata is an unresolved finding.
- `canonicalLoadBudget.js` extracts the existing arithmetic for reuse without altering legacy generation. The new ledger uses prescribed active seconds with a fixed 60-active-minute normalization. **This is a reviewed-score exposure index, not measured physiological fatigue or a newly validated safety model.** Its interpretation and version are explicit; coach calibration, sensitive-skill readiness and final whole-session validation remain required.
- Canonical composition checks now optionally accept execution indices so `avoid_after` works for end-of-session Body Control despite its legacy delivery metadata being `movement_intelligence` or `resilience`. The old phase-index behavior remains the default. Canonical profile hydration retains the original logistics object as well as the existing flattened properties.
- Librarian retrieval can explicitly use `equipmentScheduling: 'waves'` to establish that at least one station is possible; the Director uses this mode. The scheduler must then prove actual group throughput. The legacy simultaneous-allocation default and generator outputs remain unchanged.

These primitives compose reviewed activities into a timed draft; they do **not yet select and complete all session content automatically**. The next slice must connect them to release-scoped Director candidates, enforce required priority/method/exercise coverage and locks, select complementary downstream work while consulting the ledger, and derive Prepare & Access from the actual selected prescriptions. Filling reserve with invented repetitions or repeating families to satisfy a clock is not an acceptable substitute. Concurrent mixed-exercise circuit rotations and exact semantics for all programming clock types also need explicit composition support; the current scheduler verifies sequential complete-group activities with waves. Final QA must rehydrate source records and reconstruct schedules before trusting persisted or edited artifacts.

Verification: **145 Node tests pass**, including 15 athletes/3 lanes, scarce dumbbells, floor-only group capacity, 60/90-minute athletic windows with separate booked tumbling, immutable controls, unknown resources, recovery and participant tampering, source dose bounds, contact provenance, cumulative exposure and Body Control ordering. Strict declaration, syntax and whitespace checks pass. The legacy 24-output parity capture remains unchanged. No new endpoint, migration, publication or deployment is introduced.

```sh
node --test backend/platform/__tests__/canonicalProgrammingDose.test.js backend/platform/__tests__/workoutResourceScheduler.test.js backend/platform/__tests__/workoutLoadLedger.test.js
```

## Automatic composition and demand-driven preparation increment (2026-09-12)

`workoutProgrammingBuilder.buildWorkoutProgrammingDraft` now connects the Director handoff to complete-session draft composition. It revalidates immutable coach truth and clocks, reloads canonical resources in one authenticated read-only snapshot, verifies the release, and validates Director selections against current candidates. Model calls happen after that database transaction has been released. The published programming-method search is shared and loaded once per snapshot instead of once per component.

The Session Builder capability selects complementary downstream exercise/method pairs across the complete session. Its contract contains IDs, rationale and a purpose for remaining time; the model cannot prescribe unrestricted doses, assign inventory or extend clocks. Prompt candidates are bounded after canonical search/ranking, retaining locks, Director preferences and available required-coverage matches. Deterministic code resolves exact source doses, schedules group waves, replays cumulative load, and reduces sets only within reviewed bounds. A failed composition can request one bounded Builder revision with concrete findings. Invalid or unavailable Builder advice produces an explicit deterministic review draft.

The selected downstream prescriptions then produce a `ProgrammingPreparationDemand`: exact canonical references, dose hashes, movement/task/stress metadata, and the shared framework version/content hash. A dedicated Prepare & Access capability chooses the familiar base plus exactly two daily-specific tasks, covering the Vortex preparation purposes. Those tasks must cite real downstream demand IDs; the progressive bridge must address selected explosive work. Claimed matches need supporting canonical movement patterns, training-family/athletic-niche assignments or reviewed `preparesFor` targets. This validates traceability and related movement metadata, **not clinical readiness or the adequacy of every coaching judgment**; the Critic still must assess the complete preparation.

The existing coach-guide preparation section was moved intact into `backend/shared/vortexPreparationFramework.js`, with a typed declaration. Both the UI and staff now import it. Keeping this pure module under `backend/shared` also fits the existing backend-only Docker build context. The frontend's text and routine remain the same. The AI wrapper adds registered `session_builder` and `prepare_access` roles and a default configured-staff registry alongside the Director and Athlete Development roles; external consultants remain explicitly pluggable.

Preparation is generated after downstream set reductions, and its contract requires the resulting demand hash. A later change to selected movement metadata or dose changes that hash; stale proposals cannot pass the contract. Complete execution order is then rechecked with preparation included. If preparation cannot fit the remaining load or time, the draft keeps explicit findings instead of silently discarding work or publishing a partial warm-up. Automatic repair that changes downstream work after preparation must regenerate preparation; that later full Critic/revision coordinator remains to be connected.

The final draft includes activities and source hashes, component schedules, explicit recovery/coaching/readiness use of remaining time, load ledger, required-priority/equipment/lock coverage, exact-duplicate checks, capability telemetry and repairs. A successful draft is `READY_FOR_CRITIC`; unresolved work is `NEEDS_COACH_REVIEW`. Both retain `validatedWorkout: false` and `creatorAuthorized: false`. This is an internal service over a server-built SessionIntent, not authorization to trust a client-supplied artifact or expose an unguarded generation endpoint.

Remaining gates: independent whole-session Critic and bounded repair routing, source rehydration before finalization, readiness/athlete evidence hydration, exact programming-clock and concurrent circuit semantics, Modify Existing/source revision handling, persisted run auditing, approval controls and coach UI. Excessive or poorly justified reserve must be judged during QA; giving unused time a label is not proof of coach-quality programming. The new draft service does not replace those gates.

Verification: **155 Node tests passed** at completion of this increment, including complete 60-minute drafts and 90-minute athletic drafts plus 30-minute tumbling, three-lane group execution, one-snapshot retrieval, no model calls inside a database transaction, cumulative-load-driven set reductions and Builder revisions before preparation, stale demand rejection, unsupported movement attribution, immutable coach controls, foreign IDs, coverage/lock failures, and explicit unavailable-model/cancellation outcomes. Existing canonical parity remains required and unchanged.

```sh
node --test backend/platform/__tests__/workoutProgrammingBuilder.test.js
```

## Independent reconstruction and Critic increment (2026-09-12)

`workoutProgrammingQA.js` adds typed, read-only whole-session validation and a separate `programming_critic` capability. Validation starts from a server-owned SessionIntent, checks the strict draft envelope and immutable coach truth, then reloads the current released cards and accessible published methods in an authenticated snapshot. Exact selected references are pinned through ranking limits without bypassing eligibility. Embedded cards/profiles/methods and source hashes must agree with newly hydrated records. All prescriptions, preparation demand, proposal-to-activity ordering, coverage, schedules and load ledgers are reconstructed; previously stored totals or event assignments cannot prove their own correctness.

The Critic contract requires one assessment for each of twelve review areas covering the specification: impact/volume, development/readiness, redundancy, sequencing, cumulative fatigue, equipment/space, timing/recovery, complexity/supervision, preparation, objectives, methodology and coach controls. It receives actual doses, component clocks, reserve durations/purposes, load entries, source coaching guidance and the Vortex preparation framework. Event assignments are independently checked by code and summarized for the model. `PASS` requires every area to pass with no findings; `REVISE` requires actionable findings for every failed area, valid activity/component references and an explicit staff/coach revision route. Authority fields, stale review hashes, contradictory outcomes and invented IDs are rejected.

Deterministic findings prevent a Critic call. When the Critic passes, a second fresh database snapshot reconstructs the session again and checks the complete review target hash. A source change while the model is running invalidates that pass. Model failure or cancellation cannot finalize the session; calls are bounded, traced and occur outside database transactions. The service performs at most one Critic call per invocation and does not retry or modify the workout.

The gate explicitly reports adapters still required for non-straight-set clocks/layouts, structured programming rules/compatibility, additional method builder rules, exercise sequence/pairing/weekly exposure rules, and athlete evidence. Missing prerequisite metadata is unknown; it is not an empty prerequisite declaration. Any actual prerequisite, uncertainty policy, booked Body Control or referenced competency/readiness/recent-session records requires source-backed evidence evaluation. Synthetic happy-path tests explicitly declare an empty prerequisite list; this does not establish production-library coverage or athlete readiness.

Successful review is `QA_PASSED`, while failures remain `NEEDS_COACH_REVIEW`. `validatedWorkout`, `creatorAuthorized` and `libraryApprovalGranted` remain false: this internal QA artifact does not grant persistence, exercise approval or clinical clearance. The returned findings preserve deterministic evidence and specialist routes. Automatic execution of Critic-directed repairs is the next orchestration increment; a downstream change must rebuild preparation and rerun complete QA. Database evidence/rule adapters, complete method-clock/circuit support, server persistence and auditing, Modify Existing, approval controls, coach UI and pilot calibration remain outstanding.

Verification: **166 Node tests pass** with test-file concurrency set to one, including independent reconstruction, tampered participant events/doses/load summaries/source metadata, source withdrawals and in-flight changes, immutable constraints, missing readiness metadata, referenced athlete evidence, booked tumbling, invalid or unavailable Critics, cancellation during review, complete rubric coverage and specialist routing. The initial parallel run passed 165 tests but crossed the existing 7,000-card generation limit at 5.31 seconds while other checks were running; the unchanged performance test passes in the serial run. All **24 complete legacy outputs/failures** remain unchanged. Strict TypeScript declaration checks (including library checking), JavaScript syntax and whitespace checks pass. No migration, endpoint, deployment or live paid model call is introduced.

```sh
node --test backend/platform/__tests__/workoutProgrammingQA.test.js
```

## Shared lifecycle and bounded Critic repair increment (2026-09-12)

`workoutProgrammingWorkflow.js` now connects an immutable coach request (or a server-owned existing SessionIntent) to the Director, canonical composition, demand-driven preparation and independent whole-session QA. It reuses the existing services and capability registry. One staff run supplies a shared call count, output-token allocation, input-size limit, cancellation signal and deadline across all stages and repairs. Defaults permit at most eighteen calls and two repair passes; the server may disable repairs or configure up to three passes. Standalone service callers retain their existing defaults. Deadline/cancellation assertions also run at deterministic stage boundaries, including after the final database reconstruction; an expired run cannot return a workflow pass. Database work is checked before/after its operations, not forcibly interrupted through a PostgreSQL query-cancellation mechanism.

The deterministic repair planner handles validated Critic findings routed to Session Builder and Prepare & Access. A preparation-only finding calls the preparation specialist again while retaining every downstream canonical pair and exact dose, including earlier reviewed set reductions. A downstream finding allows changes from the earliest affected component through later components whose load may be affected. Earlier components and all immutable coach controls remain fixed. The Builder receives structured findings, the previous proposal, actual doses and load ledger; a contract check rejects changes outside that scope. The existing dose resolver, resource scheduler and cumulative ledger still own execution. Unchanged source hashes and exact dose reconstruction are required for retained work; a changed preserved source requires review.

Every downstream repair regenerates preparation from the resulting actual demand hash and runs complete independent QA. A valid preparation-only repair also reruns the complete session schedule, load and Critic checks. The original coach request, exercise/method locks and directed selections remain authoritative throughout. Missing evidence, unresolved source/rule adapters, and Critic findings assigned to other roles stop automatic composition with explicit routes; calling another model cannot manufacture database evidence or waive a missing rule implementation.

The coordinator detects unchanged proposals and repeated content states independently of random draft IDs. It stops on cycles, exhausted repair counts or shared execution budgets. An incomplete or failed repair retains the previous complete draft paired with its real unresolved QA; attempted changes and validation failures remain in the run history. History records source draft/QA IDs, repair scope, capability-call ranges, before/after canonical references and dose/source hashes, preparation-demand changes, findings and stop reasons. These records are returned in memory for the future persistence adapter; no audit tables or public endpoints are added in this increment.

Successful workflow status is still `QA_PASSED`, with `validatedWorkout: false`, `creatorAuthorized: false` and `libraryApprovalGranted: false`. Remaining delivery work includes deterministic programming-clock and structured-rule adapters, source-backed athlete/readiness and adjacent-session evidence, complete circuit/station layouts, persisted runs and audit records, Modify Existing, exercise-gap/creation approval integration, coach UI, database/equipment rehearsal and pilot calibration.

Verification: **180 Node tests pass** with test-file concurrency set to one, including request-to-QA execution, scoped downstream repair with fresh preparation, preparation-only exercise replacement, exact retention of already-reduced doses, stale retained sources, locks and repair-scope violations, unchanged proposals, cycles, repair-count/call/token budgets, cancellation, deadline expiry during the final source read, provider failure, existing-intent reuse and explicit nonautomatic routes. All **24 complete legacy outputs/failures** remain unchanged; strict TypeScript declaration checks (including library checking), JavaScript syntax and whitespace checks pass. All model responses in these tests are injected; no live paid call, database write, migration, deployment or external publication is introduced.

```sh
node --test backend/platform/__tests__/workoutProgrammingWorkflow.test.js
```

## Audience prescriptions, fixed method clocks and source rules increment (2026-09-12)

`programmingMethodClock.js` now selects the canonical prescription for the whole cohort before resolving execution. Explicit `training_experience` remains authoritative; exact `beginner`/`intermediate`/`advanced`/`elite` profile names are a documented compatibility adapter for the existing seed, whose audience names are populated but whose experience columns remain null. The least-experienced cohort and full age range govern selection. Conflicting audience metadata requires review; longer prose names are not interpreted as experience levels.

Straight sets retain the existing recovery-set behavior. Fixed work/rest intervals and single-exercise EMOM variants now derive the exact cycle count from reviewed duration and work/rest metadata. Profile records and audience defaults must agree, including RPE. Fractional cycles, conflicting duration/round counts, non-minute EMOM cadences and incompatible exercise-dose bounds stop composition. Fixed clocks cannot be shortened through the Builder's set-reduction path. Alternating exercises, circuits, ladders, time caps and other layouts remain explicit adapter gaps.

The resource scheduler preserves each athlete's cadence across equipment-limited waves. Fixed intervals can stagger waves within a cycle where work and station reset fit; further waves require complete additional batches. EMOM batches remain aligned to the activity's minute clock. Teaching, setup, reset, cleanup and the final prescribed recovery remain booked. For fifteen athletes using three lanes, eight cycles of 20 seconds work/40 seconds rest need 980 seconds with interval staggering, or 2,400 seconds with EMOM batches. An undersized window is rejected rather than dropping athletes, cycles or recovery. Independent validation checks exact cadence and minute alignment as well as existing participant/resource constraints.

`programmingMethodRules.js` evaluates the published structured conditions against freshly reconstructed execution order, work duration, applicable quality standards, cohort ages, source fatigue guidance and confirmed operational resources. Conditions are conjunctions with explicit `TRIGGERED`, `NOT_TRIGGERED` and `UNKNOWN` outcomes. A false condition no longer produces a blanket warning; missing evidence and unsupported predicates cannot become a pass. Scoped compatibility uses reviewed canonical `facet_type`/`facet_key` mappings and approved exercise assignments. Legacy labels such as `locomotion` are not silently translated into taxonomy keys. Conditional prose, missing mappings and unresolved deceleration evidence remain actionable review findings.

The immutable coach request now supports nullable `timerAvailable`, `scoreTrackingAvailable` and `clearRunoutConfirmed` logistics controls. These are operational confirmations, not invented equipment-taxonomy aliases. Method requirements, allowed phases, age guidance, RPE bounds, time caps and recognized metadata shapes are checked by code. Descriptive method guidance remains available to the Critic. Whole-session QA includes the reconstructed method-rule results in its review hash and Critic contract, and rechecks them after a model pass.

**Actual database rehearsal:** a new disposable PostgreSQL 15 database applied existing migrations 138, 141 and 752 and hydrated all 50 published methods through the production read-only repository. Across its 150 audience profiles, the clock adapter resolves **26**, reports **4 source conflicts**, and reports **120 unsupported formats**. For example, the intermediate EMOM prescription resolves to twelve 25/35 cycles; the intermediate Tabata-style seed has a duration that does not contain a whole number of its specified cycles. Seed compatibility child rows still lack canonical facet mappings. These counts describe clock resolution, **not production eligibility or approved workouts**. No seed records, live database or taxonomy were rewritten, and the disposable container was removed.

Verification: **194 Node tests pass** with test-file concurrency set to one, plus **3 PostgreSQL integration tests**. Coverage includes exact named-audience selection, source conflicts, immutable fixed-cycle counts, fifteen-athlete/three-lane interval and EMOM schedules, reset/cadence tampering, structured condition truth/unknown states, operational confirmations, reviewed compatibility mappings and a complete fixed-clock workflow through the independent Critic. Strict TypeScript declaration checking, JavaScript syntax and whitespace checks pass. All **24 complete legacy outputs/failures** remain unchanged. No public endpoint, live model call, permanent database write or deployment was introduced.

The next increment should hydrate athlete/readiness and adjacent-session evidence from existing scoped records, then consume the canonical exercise sequence/pairing rules. Complex layouts, source compatibility/equipment mapping review, persisted run auditing, Modify Existing, ExerciseGap/creation approval integration, coach UI and pilot calibration remain outstanding. Workflow `QA_PASSED` still has `validatedWorkout: false`, `creatorAuthorized: false` and `libraryApprovalGranted: false`; the full initiative remains active.

```sh
node --test backend/platform/__tests__/programmingMethodClock.test.js backend/platform/__tests__/programmingMethodRules.test.js
# Run against a fresh, empty, loopback-only vortex_programming_test_* database:
WORKOUT_PROGRAMMING_TEST_DATABASE_URL=postgresql://vortex_test@127.0.0.1:55487/vortex_programming_test_methods node --test backend/platform/__tests__/programmingMethodExecution.postgres.test.js
```

### Evidence-adapter audit and contract refinement

The next slice must correct the current draft contract before interpreting athlete records. `ProgrammingAthleteCohort` has a cohort count and evidence IDs but no roster/member binding. `recentSessionIds` currently accepts UUIDs, matching generated-workout snapshots rather than the bigint IDs in `coaching.session`. A generated workout is a plan, not proof that an athlete performed it. These fields currently stop at the explicit QA evidence gate; there is no implemented path that treats them as verified readiness.

Reuse `assessment_result` and `athlete_skill_progress` from migration 016, `session`/`session_attendance` and completion links from 021, `wellness_checkin` from 022, and the published gymnastics evaluation/component/issue records from 427 and later amendments. Scope every record through the authenticated facility **and the bound cohort member**, including legacy tables without their own facility column. Preserve observed/updated timestamps and record identifiers in hashed snapshots; rehydrate the same evidence during final QA. Do not copy the broader legacy grades route's member-only predicates into the new repository. Load only the coaching evidence needed for this request, not unrelated member identity, medical, billing or contact fields.

Refine the contract with optional `memberIds` that, when present, bind the complete cohort without duplicates across cohorts, and discriminated references such as `{ kind: 'skill_progress' | 'assessment_result' | 'gymnastics_evaluation', id: bigintText }`. Distinguish performed `session`/`completion_log` references from planned `generated_workout` UUIDs. Keep anonymous cohort planning available, while reporting unavailable athlete-specific evidence honestly. Existing ambiguous fields must receive a deliberate compatibility/deprecation path rather than silently changing what an ID means.

Wellness is self-report; skill labels, scores and gymnastics component evaluations are source observations. None currently provides a universal, reviewed mapping to canonical prerequisite strings such as `pain_free_hand_support` or `understands_stop_command`. Hydration must therefore remain distinct from prerequisite satisfaction. The first evidence increment should deliver timestamped source observations to Athlete Development and the Critic, reject foreign/stale/misbound references, and preserve unknown prerequisite outcomes. A subsequent reviewed evidence-rule mapping and freshness policy can establish which exact observations satisfy a specific canonical requirement; neither label similarity, a readiness average nor model confidence supplies that authority.

## Roster-bound athlete evidence increment (2026-09-12)

The immutable request now supports complete `memberIds` rosters, typed `evidenceReferences` and an optional `logistics.sessionDate`. A bound roster must cover every athlete in its cohort, and a member cannot belong to multiple cohorts. Each reference identifies a source kind, numeric record ID and the exact member, with an optional expected source hash. Supported kinds are `skill_progress`, `assessment_result`, `gymnastics_evaluation`, `wellness_checkin`, `session` and `completion_log`. The older untyped evidence fields still parse for compatibility but produce an explicit migration finding before model advice; the code never guesses which table an ID means. Anonymous cohort planning remains available and performs no athlete-table reads.

`workoutAthleteEvidence.js` loads existing source records within the same authenticated, repeatable-read, read-only snapshot as released exercises and published methods. Every query scopes the member and all applicable source definitions to the facility, including legacy tables without their own facility column. Member birth dates are used only to return age on the reference date and verify the immutable cohort range. A resolved member carries the corresponding scheduler `athleteKey`, retaining the roster-to-wave association. Unavailable members, unknown ages, age mismatches, wrong-member references and foreign sources require review.

The reader returns explicit typed observations plus the latest recorded wellness check-in, up to 25 completion logs from the preceding 35 days, and up to 10 attendance-linked sessions within 35 days before/after the reference date per athlete. Counts and truncation are explicit. These are bounded retrieval limits, **not a physiological freshness policy or proof of complete training history**. Truncated history and oversized observation content stop automatic validation; outside activity remains unknown. Only sessions with a recorded member attendance association can enter this reader. A future planned session remains a plan, attendance does not establish performed exercise doses, and partial completion remains partial. Retired assessments remain identifiable historical observations, carrying their archived state.

Source timestamps, selected source fields and content hashes survive every handoff. Timestamps normalize to UTC; date-only source records retain their source calendar dates. When no session date is supplied, the reader uses the database's UTC calendar date, with the date basis included in the contract. Future observations and observations recorded after the requested session date cannot establish readiness for that session. Source hashes cover complete selected source content even when a model-facing preview is truncated. The projection excludes member contact/billing/medical fields, media URLs, recipient addresses and unrestricted gymnastics report JSON. Future API callers must authorize athlete-insight access as well as workout generation before supplying authenticated scope to this internal reader.

Athlete Development, the Director, Session Builder, Prepare & Access and the independent Critic now receive this source evidence. Builder and QA rehydrate it from the database; changed rosters or observations invalidate earlier Athlete Development advice. An evidence-blocked Builder performs no model calls and returns an explicit review draft. The Critic's review target includes reconstructed evidence, and the final fresh snapshot rejects a source change during its PASS. A supplied expected source hash also detects stale coach references. No model can mark these source observations as approved prerequisite satisfaction.

`prerequisiteStatus` remains `NOT_ESTABLISHED`. Existing canonical prerequisite/uncertainty checks, the Body Control readiness gate, exercise sequence/pairing and weekly-exposure adapter findings remain enforced. The next slice should implement their typed, deterministic interpretation using reviewed source mappings and freshness rules, with missing mappings remaining reviewable. Do not invent score cutoffs or equate a free-text skill label, wellness average or canonical workout plan with demonstrated competence or completed contact volume. Complex method layouts, reviewed compatibility/equipment mappings, persisted run auditing, Modify Existing, ExerciseGap/creation approval integration, coach UI, actual facility release rehearsal and pilot calibration remain outstanding.

Verification: **201 Node regression tests pass**, plus **4 PostgreSQL integration tests** against a fresh disposable PostgreSQL 15 database applying existing migrations 016, 017, 021, 022 and 427. The SQL tests cover all six source kinds, actual ownership joins, future plans versus reported completion, private-field exclusion, read-only enforcement, cross-facility/wrong-member attempts, source changes, future observations, bounded history and stable hashes across database time zones. Workflow tests cover all five receiving staff capabilities, roster-to-scheduler identity, one snapshot per stage, no model calls in transactions, stale advice, and invalidation after a Critic PASS. Strict declaration/syntax/whitespace checks pass; all **24 complete legacy outputs/failures** remain unchanged. Tests use injected model responses and a disposable database only. No public endpoint, live model call, permanent database mutation or deployment was introduced. The full initiative remains active.

```sh
node --test backend/platform/__tests__/workoutAthleteEvidence.test.js
# Fresh, empty, loopback-only vortex_programming_test_* database:
WORKOUT_PROGRAMMING_TEST_DATABASE_URL=postgresql://vortex_test@127.0.0.1:55487/vortex_programming_test_athletes node --test backend/platform/__tests__/workoutAthleteEvidence.postgres.test.js
```

## Reviewed prerequisite, sequencing and recorded-exposure rules increment (2026-09-12)

Added an optional, runtime-validated `programming.executionRules` contract inside the existing exact-variant programming JSON. `canonicalProgrammingRulesContract.js` defines typed observation, sequence, interference-dose and recorded-exposure rules. Source bindings identify the existing programming field, its content hash, the interpreting rule IDs and a reviewer-readable explanation. Every nonempty prerequisite, sequence, pairing, weekly-exposure, interference and uncertainty field needs a complete binding before execution. Source prerequisites require exact keys and observation mappings; the code does not infer a prerequisite from a similar skill label or convert prose into approved policy. Known numeric exposure/recovery bounds cannot be relaxed or converted from a weekly cap to a shorter permissive window.

Draft authoring accepts valid partial mappings so reviewers can complete them incrementally. Publication readiness requires complete, current bindings when execution rules are present. The existing whole-card review path now computes rule-source hashes per exact variant and stores them in its existing `rubric_json`; it overwrites client-supplied stamps. No new approval table or alternate publication path was introduced. The published library hydrates these stamps from the current card-version review by the publishing reviewer. Runtime evaluation requires the matching source hash, variant/version and reviewer. A newer unstamped approval or request-changes decision cannot fall back to an older stamp. Existing cards without execution rules keep their previous library shape and retrieval behavior.

`canonicalProgrammingRules.js` evaluates these source-backed rules over reconstructed session order and scoped athlete evidence:

- Observation requirements apply to **every** roster member. Selectors use exact assessment, legacy exercise/rubric-criterion or gymnastics movement/component identities. Comparisons declare their metric, units/score scale, operator, threshold, freshness window and whether a coach observation is required. The latest matching result governs; stale evidence, scale/unit mismatches, missing records, ambiguous same-time results and incomplete rosters remain unknown. Self-reported wellness cannot certify competency or provide the deceleration skill fact. No clinical threshold or production prerequisite mapping was invented.
- Sequence rules reuse the existing composition-target matcher with exact variant references and actual execution indices. They support required prior work, exclusion after a target and same-session exclusions. Preferences remain visible advisory outcomes for the Critic. Interference rules cap actual later sets, active seconds or high-impact contacts after a reviewed target; a legacy phase label cannot change execution order.
- Recorded-exposure rules count distinct linked sessions, include partial reported work, add the proposed session once and check reviewed recovery against completion-log timestamps. They name their scope (`recorded_facility`) and event clock (`completion_logged_at`). Multiple item logs from the same session do not multiply session frequency. Unlinked or truncated history stays unknown. The stricter reviewed recovery value is retained, and invalid recovery metadata cannot become zero. This evaluates **recorded facility history**, not total outside activity or a measured physiological recovery state.
- Body Control requires a satisfied reviewed same-day coach-observation rule for the full roster in addition to its specific prerequisites. Reviewed observation rules may provide the explicit deceleration-readiness fact used by existing programming-method predicates. Age, coach prose, wellness averages and model confidence do not provide that fact.

The coach request now accepts an optional `sessionStartsAt` with an explicit offset, normalized to UTC and its UTC session date. Exact start times resolve recovery comparisons that a date alone cannot prove. Evidence recorded or updated after that start cannot establish readiness for the earlier session. The athlete reader also checks the facility of assessment/gymnastics graders and excludes future unpublished evaluations. Date-only sources retain their documented calendar-date limits.

Whole-session QA replaces the blanket exercise-rule adapter failure with these evaluations where a complete reviewed contract exists. It keeps adapter findings for unmapped sources, includes rule contracts/outcomes in the review hash and Critic context, and rehydrates review/evidence records after the Critic passes. Builder candidate context now includes the original programming fields and execution rules. Deterministic violations remain explicit routed findings; the next slice should use them during candidate selection and bounded Builder repair, so an avoidable bad selection can be replaced before final QA. The existing Critic-only automatic repair policy has not been broadened to waive deterministic failures.

Verification: **254 Node tests pass** across the full programming workflow plus existing card authoring, repository and structured-profile tests. **8 PostgreSQL integration tests pass** for current review/version/variant/actor scope, missing and stale stamps, later approval decisions, athlete source ownership and source changes. All **24 complete legacy outputs/failures** remain unchanged; strict TypeScript declaration, JavaScript syntax and whitespace checks pass. A complete synthetic 90-minute athletic session plus 30-minute Body Control session passes QA with reviewed fixture mappings and current coach observations for all 15 athletes. Changing an approval hash prevents a further Critic call. These mappings and model responses are test fixtures; no real card was approved, no library policy was seeded, and no live model call, permanent database mutation, public endpoint or deployment was introduced.

Remaining initiative work includes integrating deterministic findings into composition/repair, reviewed mappings for actual library sources, additional clock/circuit layouts, equipment identity review, persistent run/audit storage, Modify Existing, ExerciseGap/creation approval integration, coach UI and full facility/pilot verification. The workflow still returns `validatedWorkout: false`, `creatorAuthorized: false` and `libraryApprovalGranted: false`. The full goal remains active.

```sh
node --test backend/platform/__tests__/canonicalProgrammingRules.test.js
# Fresh, empty, loopback-only vortex_programming_test_* database:
WORKOUT_PROGRAMMING_TEST_DATABASE_URL=postgresql://vortex_test@127.0.0.1:55487/vortex_programming_test_rules node --test backend/platform/__tests__/canonicalProgrammingRuleReview.postgres.test.js
```

### Candidate eligibility and verified execution-rule repair (implemented)

`workoutProgrammingEligibility` applies the same approved exercise-rule evaluator before the Builder's model-context candidate cutoff. Roster observations, current readiness and recorded exposure are evaluated against the current scoped evidence snapshot. Each considered profile receives an immutable `ELIGIBLE`, `INELIGIBLE` or `REQUIRES_REVIEW` report; a known failed requirement is distinguished from absent evidence or approval. Only eligible profiles enter the Builder and Prepare selection contracts. An unresolved source can be replaced by eligible canonical work; a blocked lock, preserved choice or insufficient component candidate pool stops composition and records the source findings. No missing prerequisite is interpreted as satisfied, and exclusions do not establish an ExerciseGap or authorize exercise creation.

Candidate evaluation explicitly marks sequence and interference-dose rules `DEFERRED`: they require actual complete session order and resolved dose. Full-session QA continues to recompute those rules and athlete requirements from fresh database material. The stored candidate reports describe selection-time evidence; they are diagnostic records, not authority to pass later QA. Body Control without a reviewed same-day coach observation now stops before a Builder call. The existing complete five-component fixture still passes with those observations.

The existing bounded workflow can now repair a closed set of deterministic failures: approved `sequence` and `dose_limit_after` rules with a verified `VIOLATED` outcome. The planner verifies the QA target hash, findings, reconstructed rule result and actual approved contract before scheduling repair. Unknown evidence, missing approval, source drift, other rule types and mixed failures still require review. Repair scope includes the subject and matching target components, followed by every later component. Earlier preserved work and coach locks remain enforced; preparation is regenerated from the changed downstream work. Every changed complete proposal undergoes full source reconstruction, deterministic validation, independent Critic review and final fresh validation. Shared call/time/token limits, unchanged-proposal detection and last-complete-draft retention remain in force.

Verification: **261 Node regression tests pass**, including observed eligibility, missing/stale approval, recorded exposure, exclusion replacement, locked choices, complete sequence/dose repairs, altered finding rejection and unchanged-proposal stopping. Full QA still catches source changes after an earlier eligibility pass. All **24 complete legacy outputs/failures** remain unchanged. Strict TypeScript declaration, JavaScript syntax and whitespace checks pass. PostgreSQL scope/approval tests were not rerun in this increment because no database query, migration or approval implementation changed; their previously recorded eight passing integration checks remain the latest database verification.

This increment introduces no new database schema, seed policy, approval, public endpoint or live model call. Next: persist the staff run and versioned session evidence through the existing generated-workout storage architecture, then expose the reviewable workflow through the existing coach API/editor. Reviewed mappings for real source records, further method/circuit formats, equipment identity coverage, Modify Existing, ExerciseGap approval integration and facility pilot verification remain necessary before declaring the full system complete.

### Saved staff sessions and coach API (implemented)

`workoutProgrammingService.generateAndPersistWorkoutProgramming` now runs the bounded staff workflow and saves its completed result through the existing `coaching.generated_workout_v1` table. No parallel workout library or new migration was introduced. The existing persistence helper accepts an optional server-generated snapshot UUID; the staff run ID becomes the immutable row ID, making repeated saves of the same finished run idempotent. Concurrent storage conflicts retry storage once, without repeating any model call. A different artifact cannot overwrite the same run ID.

`workoutProgrammingStorageContract` defines the JSON envelope with `sessionModel: 'vortex_components_v1'`, schema/generator/rule/model versions, immutable coach intent, canonical references, concise explanations, complete staff/QA history, per-call capability versions and token usage, and evidence hashes. JSON serialization is canonicalized before returning the envelope so optional source fields round-trip through JSONB. Snapshot size and terminal telemetry are bounded. It stores parsed decisions and rationales, not private reasoning or unparsed model responses.

`workoutProgrammingRepository` verifies the server actor and facility, source-release ownership and run-origin scope. Director intents now carry their server-owned facility/actor provenance; Builder and QA reject foreign-facility intents. Saving performs fresh deterministic QA and the insert in one repeatable-read transaction. A matching prior Critic PASS plus current deterministic PASS can set the saved envelope's `validatedWorkout: true`; an absent Critic, changed source or unresolved finding saves `NEEDS_COACH_REVIEW`. The underlying workflow remains historical evidence with its original status. Neither saved status grants exercise creation or library approval. Failed writes and cancellation before commit roll back the row.

Scoped list/reload services distinguish this envelope from existing legacy snapshots. Reloads explicitly identify validation as historical. Read-only revalidation can confirm the same reviewed evidence without another model call; changed evidence returns a review stop and never rewrites history. Legacy swap handlers reject this session model because it requires whole-session revision and revalidation. Existing linked coach-review storage remains available.

The existing coach route registration now exposes:

- `POST /api/coach/workout-programming`: validate a coach request, use application-configured capabilities and fixed server budgets, generate, review and save.
- `GET /api/coach/workout-programming`: bounded, cursor-paginated saved-session summaries for the authenticated facility.
- `GET /api/coach/workout-programming/:id`: reopen a typed saved snapshot with historical-validation status.
- `POST /api/coach/workout-programming/:id/revalidate`: check the saved session against current canonical and athlete evidence without accepting submitted QA or changing the saved row.

All routes use existing `workouts.manage` authorization and facility canonical-generator rollout checks. Generation additionally requires the existing AI rollout flag and configured application model. Client bodies cannot supply facility scope, capabilities, run budgets, SessionIntent or QA artifacts. Disconnects cancel an in-progress generation. This code was not deployed or exercised with a paid model; the coach UI is the next integration increment.

Verification: **284 Node regression tests pass**, including storage-contract tampering, terminal telemetry, idempotent saves, stale-source downgrade, missing Critic review, rollback/cancellation, full generation → save → reopen → revalidation, and route permissions/request boundaries. **6 PostgreSQL integration checks pass** against the exact existing generated-workout table DDL in a disposable empty database: JSONB/version/foreign-key round trips, concurrent same-run writes, facility/actor isolation, cursor pagination and legacy discrimination, rollback after insert, and read-only revalidation preserving history. Those storage integration tests use the existing synthetic canonical-library/model fixtures for source hydration; they do not establish real-facility library or model quality. All **24 complete legacy outputs/failures** remain unchanged. Strict TypeScript declaration, JavaScript syntax and whitespace checks pass. The disposable database was removed; no production database or deployment was changed.

Remaining work includes coach controls and session display, Modify Existing/selected-component revisions and swaps, ExerciseGap → existing Creator/human approval, reviewed mappings for actual library data, broader method/circuit coverage, equipment identities, durable recovery/audit for interrupted in-flight generation, provider cost reporting and actual facility/pilot verification. The full initiative remains active.
