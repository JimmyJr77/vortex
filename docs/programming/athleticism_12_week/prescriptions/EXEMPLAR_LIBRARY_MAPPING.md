# Exemplar library mapping and access audit

**Stage 3 · Day 1 and OR-01 · Local source review, pending operational release**

This companion identifies the exact source mechanics available for the exemplars. It does not prescribe their final sets or claim live approved-library grounding. The [machine-readable mapping](exemplar_library_mapping.json) records sources, candidate keys, source dose fields and missing gates. Internal mapping labels are documentation references, not database identities.

## Current access result

The inspected local runtime cannot supply a current canonical approved pool because required schema is absent. This is access/schema unavailability, not proof that any production library is empty. No migrations, backend fixes, publishing or production admin calls were performed.

The documented readiness command was inspected before access checks. No documented database URL variable was configured in the current shell; no secret file or credential value was read. The existing local Docker service was then inspected, followed by narrowly scoped SQL inside BEGIN READ ONLY / ROLLBACK. Only schema, equipment labels, two matched legacy exercise identities and the training-program count were read.

| Local observation | Meaning |
|---|---|
| Canonical definition and release tables absent | An approved canonical pool cannot be retrieved from this development database. |
| Programming-method, Skill Library and Flip & Fit schedule tables absent | This runtime cannot provide approved method records or the separately managed tumbling schedule. |
| Equipment taxonomy exists; only id/key/name/sort_order/created_at columns | Equipment names do not verify quantities, sizes, benches, safe anchors or lane geometry. |
| Local training-program count: 0 | No plan record is available in this local table; no claim is made about production. |
| Local legacy rows: ID 6 / 10-yard-sprint; ID 9 / dead-bug, both old published flags | These are development legacy rows, not production canonical IDs or independent current-version approvals. |

Production library contents, release membership, inventory and athlete histories remain unknown. The backend container reported unhealthy; no repair or migration was attempted for this documentation task.

## Decisions that constrain the exemplar

- Select the actual static start and record lead/setup. The walking route is orientation; the moving-entry two-point provisional source is expressly blocked.
- The exact dumbbell RDL candidate uses two dumbbells. The exact supported row candidate uses the opposite hand and knee on the bench.
- Source 66 Dead Bug Heel Tap fixes both arms and alternates heel contact from tabletop. It excludes heel sliding and contralateral arm motion. Heel-slide is only a proposed variant in the inspected local material.
- Bodyweight box squat and bodyweight hip hinge have real authored sources. A wall-touch hinge or assisted squat still needs its exact support/contact mapping; do not invent it from a related label.
- All source doses below remain evidence, not mandatory exemplar prescriptions. Proposed changes need a purpose, feasibility check and readiness rationale.

## ACC-STATIC — Short Acceleration Sprint

**Status:** authored_canonical_candidate. **Use:** Day 1, OR-01 only after separate technical-profile decision.

**Identity:** 10-yard-sprint. Candidate variant: standing-static / two-point-static. Candidate profile: output-standing-static / output-two-point-static.

Choose standing-static OR two-point-static explicitly. Start still; for two-point use a fixed stagger and declared/alternated lead. Accelerate through the marked target into clear gradual run-out. One active athlete per lane; release only after the run-out clears.

**Readiness / stops:** Demonstrated pain-free initiation, coordinated contacts and safe run-out; understands stop/return route. Stop for pain, limp, stumble, reaching, lane loss or meaningful timing/mechanics decline. Standing and staggered starts cannot share results unless the protocol deliberately standardizes the same start.

**Source evidence:**
- backend/migrations/420_coaching_short_acceleration_research_completion.sql:209;292-307;373-395 (authored_local_content).
- backend/migrations/454_coaching_short_acceleration_audit_hardening.sql:1-3;12-24 (authored_local_content).

**Source dose fields:** {"profileKeys": ["output-standing-static", "output-two-point-static"], "sets": 1, "defaultRepetitions": 4, "repetitionRange": [3, 6], "distanceMetres": [5, 20], "intentPercent": [85, 100], "restSeconds": [120, 240], "runOutMetres": [10, 30], "timeModel": {"setupSeconds": 60, "workSecondsPerAttempt": 8, "transitionSeconds": 20, "restSecondsPerAttempt": 150}, "status": "candidate defaults, not universal requirements or assigned workout"}.

**Alternatives:** Changing target distance is dose; changing start, cue choice, terminal stop or moving entry requires exact task review. A walking route is orientation, not proof of high-intent acceleration.

**Remaining mapping gates:** Current release and reviewed exact start/profile. Measure usable target plus run-out, surface, return lane and queue recovery. OR-01 lower-intent teaching is a proposed technical use; do not claim these high-intent profiles cover walking.

## GOBLET — Goblet Squat

**Status:** legacy_card_with_exact_mechanics. **Use:** Day 1.

**Identity:** goblet-squat.

Hold one declared kettlebell or dumbbell close at the chest, use a stable bilateral base, descend through owned range with full-foot pressure and coordinated knee/hip action, then stand without losing trunk control.

**Readiness / stops:** Verify pain-free range, front-held load control, safe pickup/set-down and supervision. Stop for pain, lost load/trunk/knee control or breathing symptoms. The empty legacy prerequisite list does not mean no readiness checks.

**Source evidence:**
- scripts/data/capacity-squat-cards-1-10.mjs:50-58;81-84;107-174 (legacy_authored_card).

**Source dose fields:** {"sets": 3, "repetitions": 8, "restSeconds": 90, "tempo": "2-0-1-0", "estimatedSecondsPerSet": 45, "rpeRange": [6, 8], "status": "legacy default; final dose may be an explicitly justified session override"}.

**Alternatives:** Box contact adds a terminal constraint and needs a stable height; bodyweight box squat has its own source. A younger or less experienced athlete may receive lighter load/owned range; age alone is not a new variant or novice label.

**Remaining mapping gates:** Resolve current canonical owner, exact goblet implement/stance variant and profile. Verify available implements and actual loading.

## DB-RDL — Romanian Deadlift — Dumbbell Standard Tempo

**Status:** authored_canonical_candidate. **Use:** Day 1.

**Identity:** romanian-deadlift. Candidate variant: dumbbell-standard-tempo. Candidate profile: capacity-strength.

Bilateral top-start hinge using TWO dumbbells in close independent paths. Keep soft knees and a controlled trunk/pelvis, move hips back to owned range, return by hip extension, reset and set down safely.

**Readiness / stops:** Legacy source requires demonstrated deadlift hinge competency and controlled lowering; retain task-level competency review. Verify two implements, grip, pickup/set-down space and noninterfering range. Stop for pain, balance or grip loss, load drift, increased knee bend, bounce or uncontrolled spinal position/tempo.

**Source evidence:**
- backend/migrations/331_coaching_romanian_deadlift_family_completion.sql:461-464;624-680;707-718;772-774 (authored_local_content).
- scripts/data/capacity-hinge-cards-11-18.mjs:239-310 (legacy_authored_card).

**Source dose fields:** {"profile": "capacity-strength", "sets": "2-5", "repetitions": "3-10", "restSeconds": "90-240", "tempo": "standard_controlled", "implement": "dumbbell", "quantity": "two", "range": "declared_owned_hamstring_limited_range", "timeModel": {"repetitionSeconds": 6, "resetSeconds": 6, "setupSeconds": 45}, "legacyDefault": {"sets": 3, "repetitions": 6, "restSeconds": 90, "tempo": "3-0-1-0"}, "status": "candidate profile plus separately labeled legacy default"}.

**Alternatives:** One centered kettlebell is separately authored as single-kettlebell-standard-tempo; do not call it the two-DB variant. Unloaded hinge teaching is a different prescription and may use the bodyweight hinge source below. Unsupported rows compete with hinge/grip demands; a row is not automatic rest.

**Remaining mapping gates:** Current reviewed DB variant/profile; distinguish standard tempo from deliberate 4-6 second eccentric profile. Choose exact cadence and reconcile source time estimates with the actual session clock.

## INCLINE-PUSH — Incline Push-Up

**Status:** legacy_card_with_research_identity. **Use:** Day 1, OR-01 high incline.

**Identity:** incline-push-up.

Use a stable elevated hand-support surface and feet on the floor. Maintain an inclined straight-body position, lower chest toward the surface under control, then press back while keeping support and trunk organized.

**Readiness / stops:** Select support height and range the athlete can control; confirm stable surface, pain-free hands/wrists/shoulders and communication. Stop for support movement, pain, inability to retain body line or repeated neck/shoulder compensation.

**Source evidence:**
- scripts/data/capacity-push-cards-19-26.mjs:51-52;104-176 (legacy_authored_card).
- scripts/data/canonical-research/incline-push-up.v1.json:3-6;143-154;198;274 (research_packet).

**Source dose fields:** {"sets": 3, "repetitions": 8, "restSeconds": 90, "tempo": "2-0-1-0", "estimatedSecondsPerSet": 40, "rpeRange": [5, 7], "status": "legacy default; OR-01 teaching volume must be separately written"}.

**Alternatives:** Higher support can preserve the incline-push-up identity; record actual height/foot position and reassess demand. Wall push-up appears in legacy scaling text but does not by itself establish a current exact wall variant. Do not force lower support because the athlete is older.

**Remaining mapping gates:** Resolve current canonical owner, exact support variant/profile and approved media. Do not invent a high-incline variant key; treat height as declared setup until current mapping is verified.

## SUPPORTED-ROW — One-Arm Row — Bench-Supported Dumbbell

**Status:** authored_canonical_candidate. **Use:** Day 1, OR-01 lighter instructional use.

**Identity:** one-arm-dumbbell-row. Candidate variant: bench-supported-dumbbell. Candidate profile: capacity-strength. Verified repository legacy source: 195.

The exact bench-supported-dumbbell variant uses the CONTRALATERAL HAND AND KNEE on the bench. From that braced base, row one dumbbell toward the declared trunk/hip target, control the lowering, then change sides and set down safely.

**Readiness / stops:** Verify appropriate stable bench, floor support and safe loading, with each side observed. Stop for bench movement, grip/support loss, pain, trunk rotation, altered pull path/range or uncontrolled return. A standing hand-only support, chest-supported row and unsupported hinged row do not inherit this exact variant.

**Source evidence:**
- backend/migrations/453_coaching_one_arm_row_family_completion.sql:1-4;16-17;165-174;312;344-386 (authored_local_content).

**Source dose fields:** {"profile": "capacity-strength", "sets": 4, "repetitionsPerSide": 6, "restSeconds": 120, "sideRestSeconds": 20, "tempo": "controlled", "reserveRepetitions": 2, "timeModel": {"setupSeconds": 75, "secondsPerRepetition": 5, "sideChangeSeconds": 20, "transitionSeconds": 45, "countBothSides": true}, "secondaryProfile": {"key": "resilience-control", "sets": 3, "repetitionsPerSide": 8, "restSeconds": 75, "tempo": "3_second_eccentric", "reserveRepetitions": 3}, "status": "candidate defaults; lower teaching doses require explicit session override"}.

**Alternatives:** Ring/TRX row is a tangible separate legacy alternative but needs secure adjustable anchors and a declared body angle. If hand-and-knee support does not fit athlete/bench, choose another validated task; do not silently use hand-only support under this key.

**Remaining mapping gates:** Current reviewed exact support variant/profile; verify bench dimensions/quantity. Count both sides, load changes and set-down in the clock.

## RING-ROW-ALT — Ring Row / TRX Row

**Status:** legacy_card_with_exact_mechanics. **Use:** Day 1 alternative, OR-01 alternative.

**Identity:** ring-row-trx-row.

Hold secure rings/straps with feet placed for a declared straight-body angle; pull chest toward handles and lower to controlled arm extension without losing body line.

**Readiness / stops:** Verify anchors, equal handle setup, grip, body line and pain-free pull. Stop for unsecured support, shoulder/elbow pain, grip failure or inability to retain line.

**Source evidence:**
- scripts/data/capacity-pull-cards-27-36.mjs:53-54;114-172 (legacy_authored_card).

**Source dose fields:** {"sets": 3, "repetitions": 8, "restSeconds": 60, "tempo": "2-0-1-0", "estimatedSecondsPerSet": 70, "rpeRange": [5, 8], "status": "legacy default"}.

**Alternatives:** More upright body angle reduces leverage demand when exact mechanics remain; record rather than inventing a variant ID. This is bilateral bodyweight suspension pulling, not bench-supported unilateral dumbbell rowing; update side counting, equipment, fatigue and history.

**Remaining mapping gates:** Current canonical consolidation/variant/profile, approved anchor setup and facility quantities.

## HEEL-TAP — Dead Bug Heel Tap

**Status:** authored_canonical_candidate. **Use:** Day 1 candidate, OR-01 only if tabletop readiness fits.

**Identity:** dead-bug-heel-tap. Candidate variant: bodyweight-supine-arms-fixed-alternating-heel-tap. Verified repository legacy source: 66.

Lie supine with hips and knees in tabletop and arms vertical. Keeping the arms fixed, lower one bent leg through a comfortable active range to a light declared heel target, return to the same tabletop, then alternate sides. One cycle is one controlled heel contact and return per side. This excludes contralateral arm-and-leg Dead Bug, heel slide, static press, wall press, pullover, band resistance, Bird Dog, testing, and forced range.

**Readiness / stops:** can use the supine tabletop base and exit safely can complete a small arms-fixed heel-contact return without symptom escalation or persistent trunk loss clear stable surface and communication session logistics and downstream demands fit Stop for symptoms, persistent trunk loss or forced range.

**Source evidence:**
- scripts/data/canonical-research/contracts/dead-bug-heel-tap.v1.json:1 (minified complete contract) (authored_local_content).
- backend/migrations/542_coaching_dead_bug_heel_tap_source_66_candidate_materialization.sql:1-3 (authored_local_content).

**Source dose fields:** {"deliveryProfiles": [{"profileKey": "prepare-bodyweight-arms-fixed-alternating-dead-bug-heel-tap", "phase": "prepare_and_access", "role": "conditional", "dosage": {"sets": "1-3", "cyclesPerSide": "3-6", "restSeconds": "20-45", "countRule": "count only arms-fixed, controlled heel-contact-and-return cycles while trunk, breath, and range remain controlled"}, "timeModel": {"setupSeconds": 20, "perSetSeconds": 40, "resetSeconds": 20}}], "status": "local candidate; not the completed prescription"}.

**Alternatives:** Reduced owned range preserves arms-fixed heel-tap mechanics; continuous heel slide does not. Contralateral arm/leg Dead Bug is a separate candidate definition with its own keys; do not use generic “dead bug” to hide the difference.

**Remaining mapping gates:** Current reviewed source66 candidate/profile and tabletop readiness. Count one cycle as a controlled heel-contact-and-return on each side; make session rep notation explicit. Only a prepare_and_access delivery profile was verified; complementary use in Strength is a proposed session adaptation pending profile mapping. The source combines a both-side cycle description with the field cyclesPerSide: define counted repetitions explicitly and do not multiply side totals twice.

## BOX-BW — Bodyweight Box Squat

**Status:** legacy_card_with_exact_mechanics. **Use:** OR-01, Day 1 readiness alternative.

**Identity:** bodyweight-box-squat.

Use a stable height appropriate to owned range. Squat to a light box contact, keep tension and stand without rocking or collapsing. Box contact is explicit; it is not an unassisted free squat.

**Readiness / stops:** Confirm stable non-sliding box and controlled contact/stand. Stop for pain, fearful collapse, loss of brace or inability to stand without momentum. Hand assistance is not fully specified by the box-squat source; a supported squat needs its exact support setup reviewed.

**Source evidence:**
- scripts/data/resistance-band-body-resistance-all-cards.json:772;870-934 (legacy_authored_card).
- scripts/data/capacity-squat-cards-1-10.mjs:185-186;243-311 (related_legacy_card).

**Source dose fields:** {"sourceDefault": {"sets": 3, "repetitions": 8, "restSeconds": 90, "estimatedSecondsPerSet": 40, "rpeRange": [5, 7]}, "relatedBoxSquatTempo": "2-1-1-0", "status": "legacy source defaults, not OR-01 teaching dose"}.

**Alternatives:** Change box height/owned range deliberately; record a different support/load setup. Do not inherit barbell back-squat or goblet-squat identity for a box-contact task.

**Remaining mapping gates:** Resolve current canonical owner/profile for bodyweight-box-squat versus box-squat source. Verify box heights/quantities and any manual/support assistance.

## HINGE-BW — Bodyweight Hip Hinge Good Morning

**Status:** legacy_card_with_exact_mechanics. **Use:** OR-01 alternative to unresolved wall hinge.

**Identity:** bodyweight-hip-hinge-good-morning.

Stand tall with soft knees and the declared source hand position (across chest or behind head); move hips back through owned range while keeping the trunk organized, then return to standing and reset.

**Readiness / stops:** Can retain soft knees, controlled hip movement and pain-free range. Stop for symptoms, repeated trunk change, loss of balance or forced range.

**Source evidence:**
- scripts/data/resistance-band-body-resistance-all-cards.json:2521;2615-2674 (legacy_authored_card).
- scripts/data/capacity-hinge-cards-11-18.mjs:307-310 (related_legacy_scaling).

**Source dose fields:** {"sets": 3, "repetitions": 10, "restSeconds": 90, "estimatedSecondsPerSet": 50, "rpeRange": [4, 6], "status": "legacy default; instructional use needs a separately justified dose"}.

**Alternatives:** Wall-touch or hand-on-wall support changes task setup; a phrase in unrelated single-leg scaling does not establish the exact bilateral wall-hinge record. A dowel hinge is mentioned by the RDL legacy scaling, but exact contact points and current card/profile remain unresolved.

**Remaining mapping gates:** Resolve current canonical owner/profile and hand position. If wall contact is retained, first define touch versus load-bearing support and search/resolve the exact variant; do not invent its ID.

## OR-WALK-ROUTE — Walking the training route

**Status:** orientation_procedure_not_mapped_as_exercise. **Use:** OR-01 orientation.

**Identity:** No exact mapped source slug.

A coached walk shows entry, signal, target, gradual exit, return and waiting positions. Treat it as orientation time, not a Short Acceleration Sprint output result or a new exercise record.

**Readiness / stops:** Understands the stop signal, lane boundaries and return route. No crossing occupied lanes or following before clearance.

**Source evidence:**
- docs/VORTEX_ATHLETICISM_BLOCK_PROGRAMMING_SPEC.md:235-245 (owner_instruction).
- backend/migrations/420_coaching_short_acceleration_research_completion.sql:445-456 (explicit_avoid_boundary).

**Source dose fields:** {"status": "root authors instructional time and repetitions; no canonical sprint dose claimed"}.

**Alternatives:** A static standing-start rehearsal can follow when appropriate, but exact low-intent teaching mapping remains explicit. Do not select two-point-walk-in-provisional: local profile says avoid and prescriptionBlocked pending exact authorship/review.

**Remaining mapping gates:** Define whether the later action is static-start rehearsal or actual short acceleration; use separate success criteria.

## HEEL-SLIDE-GAP — Contralateral Heel Slide Dead Bug

**Status:** proposed_variant_only_not_materialized_mapping. **Use:** OR-01 requested possibility.

**Identity:** No exact mapped source slug.

The local alternate assessment describes continuous floor-contact heel sliding with contralateral action as a new variant. It does not supply a verified current selectable variant/profile; arms-fixed slide would require its own exact limb-action decision.

**Readiness / stops:** Do not fabricate tabletop, limb action, heel path, progression eligibility or approval from the “dead bug” label.

**Source evidence:**
- backend/migrations/470_coaching_dead_bug_family_audit_hardening.sql:556-570;842-855 (candidate_alternate_assessment).
- scripts/data/canonical-research/contracts/dead-bug-heel-tap.v1.json:1 (minified complete contract) (explicit_identity_exclusion).

**Source dose fields:** {"status": "no exact authored materialized heel-slide dosage/profile verified"}.

**Alternatives:** The tangible source66 heel-tap candidate is only an alternative for an athlete who meets its tabletop and heel-contact requirements; it is not an equivalent slide. If heel-tap readiness fails, root may document another known body-control task or defer the slide to exact variant review.

**Remaining mapping gates:** Search current authorized library for exact slide variant; if absent, complete the existing card/variant workflow with human review before claiming release. This is an unresolved variant mapping, not proof that the entire exercise family is missing.

## SQUAT-BW — Tempo Bodyweight Squat

**Status:** legacy_card_with_exact_mechanics. **Use:** OR-01 primary knee-pattern candidate.

**Identity:** tempo-bodyweight-squat.

No external load or mandatory box. Stand with feet about shoulder-width and ribs over pelvis; choose a comfortable owned depth, lower for a controlled three-count, pause briefly at the bottom, then stand without bouncing and reset posture/breath. The exact source says a brief pause but does not fix ascent duration.

**Readiness / stops:** Verify a pain-free, repeatable bilateral base, controlled knee/hip/trunk action and comfortable breathing. Stop or reduce range for pain, repeated loss of position, bounce or uncontrolled breathing; do not force depth. The source equipment tag is none. Generic template language about bands does not add bands to this unloaded exercise.

**Source evidence:**
- scripts/data/resistance-band-body-resistance-all-cards.json:21-30;81-85;133-201 (legacy_authored_card).

**Source dose fields:** {"legacyDefault": {"sets": 3, "repetitions": 8, "restSeconds": 90, "estimatedSecondsPerSet": 40, "rpeRange": [5, 7]}, "executionTempo": "three-count lowering; brief pause in owned range; controlled stand without bounce", "rootProposedInstructionalOverride": {"sets": 2, "repetitions": "3-4", "externalLoad": "none", "loweringSeconds": 3, "standingSeconds": 1, "pause": "retain a brief pause in the model or explicitly label its omission as an adaptation"}, "status": "Source defaults and root-proposed instructional reduction are distinct; final age-specific dose and timing belong to the exemplar."}.

**Alternatives:** BOX-BW remains a distinct box-contact task. Use only when an individually fitting stable box/support and adequate changeover time exist; it is not this free squat variant. Changing owned depth or tempo requires observation and documentation. Manual assistance or hand support must not be hidden in this source identity. No box requirement avoids a simultaneous height-matched box assumption; usable floor space and coaching sightlines still require verification.

**Remaining mapping gates:** Resolve current canonical owner, exact variant/profile and approval; no live ID or local canonical variant key was verified. Reconcile source brief pause with the final proposed cadence and set-duration arithmetic. Record the instructional dose reduction and purpose rather than presenting 2 sets of 3-4 as a source default.

## BREATH-9090-ALT — 90/90 Breathing with Reach — supported alternative

**Status:** authored_canonical_candidate. **Use:** OR-01 alternative only when HEEL-TAP tabletop readiness fails and supported breathing fits.

**Identity:** 9090-breathing-with-reach. Candidate variant: wall-supported-bilateral-reach / lower-leg-supported-bilateral-reach. Candidate profile: prepare-and-access-wall / prepare-and-access-lower-leg-support.

Choose one exact support. Feet-on-wall: lie supine with both feet flat on a stable wall and hips/knees near 90 degrees, using light contact without heel pull or pelvic lift. Lower-legs-supported: calves and/or heels rest fully on a stable nonrolling bench/box, with passive support and no heel drive. In either version, reach both arms toward the ceiling gently without shrugging, inhale comfortably through the nose, exhale longer without strain, then reset to comfortable breathing. Do not force the back flat, crunch or hold the breath.

**Readiness / stops:** Comfortable supported supine position and safe floor entry/exit; comfortable resting breathing; pain-free declared shoulder/hip/knee position; can communicate symptoms. Stop for support loss, pain, dizziness, unusual breathlessness, panic/air hunger, forced breathing, shrugging/crunching or added hip lift. If supported supine position or reach itself is not comfortable, this is not an eligible automatic fallback.

**Source evidence:**
- backend/migrations/490_coaching_9090_breathing_family_audit_hardening.sql:35-49;925-944;992-1009;1295-1309;1363-1377;2045-2052 (authored_local_candidate).
- scripts/data/foundation-access-cards-1-10.mjs:45-53;91-143 (legacy_authored_card).

**Source dose fields:** {"profileDefaults": {"sets": 1, "breathsPerSet": 4, "restSeconds": 15, "effort": "very_low / RPE1-2", "inhale": "comfortable nasal, not maximal", "exhale": "longer unforced; approximately4-6s only if comfortable"}, "countRule": "One repetition is one comfortable inhale and longer unforced exhale with exact support/reach and comfortable reset.", "status": "Candidate Prepare & Access profiles; root must specify actual instructional duration/dose, setup and transition."}.

**Alternatives:** This changes the purpose to supported breath-and-position rehearsal. It does not deliver the moving-leg challenge of HEEL-TAP or demonstrate the missing tabletop competency. Choose feet-on-wall when safe wall/floor space exists; choose fully supported lower legs when wall contact adds unwanted leg effort and stable fitted support exists. Floor feet-down breathing is not either exact 90/90 support variant. Do not rename it under these keys. Only the simple supported reach variants are under consideration; no balloon, ball squeeze, hip lift, heel drive, added limb motion or breath retention is introduced.

**Remaining mapping gates:** Current independent approval and exact support/profile/media; these remain candidates. Verify support, floor access, arm clearance, comfort, coaching sightline and time; do not assume this resolves all equipment bottlenecks. If placed in the instructional Strength/body-control section, label contextual use as a proposed adaptation of a preparation profile. Mark HEEL-TAP task not delivered and retain the prerequisite gap for future instruction.

## Method semantics

| Organization | Verified status and consequence |
|---|---|
| Fully recovered quality attempts | task_profile_supported_no_live_method_card. Count accepted attempts with complete task-specific recovery and run-out. Candidate 120-240 second recovery must not be silently shortened by a queue model. |
| Straight strength sets | existing_format_no_live_method_card. Declared sets, repetitions, effort, tempo and rest; task-specific dosage/profile selection stays explicit. |
| Noncompeting pairs | existing_taxonomy_not_automatic_eligibility. Check grip, hinge, trunk, shoulder, station and supervision interference; elapsed time at another station is not automatically recovery. |
| Technical rehearsal and orientation | proposed_session_organization_not_named_method_card. Separate demonstrations, finite practice and route walks from high-intent output. Do not map a walking practice to the quarantined moving-entry sprint. |
| Rejected misleading method matches | actual_authored_method_semantics_incompatible_with_fresh_output. time-cap-quality-block, coach-controlled-interval and repeat-sprint-format explicitly target fatigue repeatability and sustained_capacity; they do not certify fresh quality attempts or instructional learning. |

Exact method source paths and lines are recorded in the JSON. No live programming-method ID was retrieved. Exercise methodology tags, set-structure taxonomy, workout formats and separately authored programming-method cards remain distinct.

## Release boundary

- Current authorized facility/release and independently approved exact definition/variant/profile/media/taxonomy/relationships.
- Real inventory counts/sizes, floor and lane geometry, coaching coverage and safe logistics.
- Actual athlete completed exposure, restrictions/readiness and sport/tumbling demands.
- Final session dose, instruction/setup/recovery/transition arithmetic, three age bands and within-band readiness adaptations.
- Separate approved 30-minute tumbling session or truthful pending handoff.

Source defaults are evidence. Root-authored exemplar prescriptions may propose justified doses for review; deviations must remain explicit, and no reviewable document is described as released or live approved.

Verification: JSON parsing succeeded; the Markdown companion preserves the same identity and release boundaries. 33 source references were checked for file existence and valid line bounds. All live canonical IDs remain null and no live approval is claimed.
