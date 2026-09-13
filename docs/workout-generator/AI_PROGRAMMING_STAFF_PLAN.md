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
