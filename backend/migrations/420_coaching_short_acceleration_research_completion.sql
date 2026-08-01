-- Complete one planning-ready Short Acceleration Sprint card with controlled
-- standing, two-point, three-point, falling, half-kneeling, auditory,
-- provisional walk-in, and provisional three-point build-up variants.
--
-- Distance, units, cones, lead side, intent, recovery, and run-out are dosage
-- or delivery dimensions. Moving-entry and longer build-up contracts remain
-- explicitly nonselectable. Difficulty is exercise complexity plus physical
-- difficulty, with overall derived as their maximum. Athlete proficiency is
-- exclusive to coaching.skill. Evidence, media, relationships, calibrations,
-- source scores, and the card remain candidate/review-only; no approval is
-- created.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '420_coaching_short_acceleration_research_completion';
  research_batch CONSTANT TEXT := 'short-acceleration-starts-v1';
  active_slug CONSTANT TEXT := '10-yard-sprint';
  audited_source_ids CONSTANT BIGINT[] := ARRAY[
    6,99,117,118,119,120,325,326,327,706,707,708,744,937,957,
    1121,1122,1333,1591,1592
  ];
  selectable_variant_keys CONSTANT TEXT[] := ARRAY[
    'standing-static','two-point-static','three-point-static','falling-start',
    'half-kneeling-start','two-point-auditory-start'
  ];
  blocked_variant_keys CONSTANT TEXT[] := ARRAY[
    'two-point-walk-in-provisional','three-point-build-up-provisional'
  ];
  already_applied_count INTEGER;
  actual_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived';
  IF actual_count<>1 THEN
    RAISE EXCEPTION '% requires exactly one active prepared survivor; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO already_applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived'
    AND definition.provenance_json->>'researchCompletionMigration'=migration_key;
  IF already_applied_count NOT IN(0,1) THEN
    RAISE EXCEPTION '% found partial prior application',migration_key;
  END IF;
  IF already_applied_count = 0 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived' AND definition.card_version <> 1
  ) THEN
    RAISE EXCEPTION '% expected card version 1 before first application',migration_key;
  END IF;
  IF already_applied_count = 1 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived' AND definition.card_version <> 2
  ) THEN
    RAISE EXCEPTION '% found card-version drift after completion',migration_key;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived'
    AND source.legacy_exercise_id=ANY(audited_source_ids);
  IF actual_count<>cardinality(audited_source_ids) OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source
      ON source.definition_id=definition.id
    WHERE definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
      AND NOT(source.legacy_exercise_id=ANY(audited_source_ids))
  ) THEN
    RAISE EXCEPTION '% requires exactly all % audited source mappings',
      migration_key,cardinality(audited_source_ids);
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived' AND variant.status<>'archived';
  IF actual_count<>8 OR EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1 variant
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id=variant.definition_id
    WHERE definition.slug=active_slug AND variant.status<>'archived'
      AND NOT(variant.variant_key=ANY(
        selectable_variant_keys||blocked_variant_keys))
  ) THEN
    RAISE EXCEPTION '% requires the six exact and two provisional prepared variants',
      migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.slug=active_slug
        AND (definition.status='published' OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=evidence.definition_id
      WHERE definition.slug=active_slug
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=media.definition_id
      WHERE definition.slug=active_slug
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=alternate.definition_id
      WHERE definition.slug=active_slug
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=active_slug)
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=revision.definition_id
      WHERE definition.slug=active_slug)
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=active_slug)
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 from_variant
        ON from_variant.id=relationship.from_variant_id
      JOIN coaching.exercise_variant_v1 to_variant
        ON to_variant.id=relationship.to_variant_id
      WHERE (from_variant.definition_id=(
          SELECT id FROM coaching.exercise_definition_v1 WHERE slug=active_slug)
        OR to_variant.definition_id=(
          SELECT id FROM coaching.exercise_definition_v1 WHERE slug=active_slug))
        AND (relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug
        AND (calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id=ANY(audited_source_ids)
        AND (score.human_review_status<>'queued' OR score.reviewed_by IS NOT NULL
          OR score.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  -- Keep the published legacy row usable by the Needs Engine while canonical
  -- selection is quarantined. The compatibility scale is the canonical
  -- standing variant divided by ten: complexity 48, physical difficulty 68,
  -- and overall=max(48,68). Never replace an existing assessment.
  INSERT INTO coaching.exercise_difficulty_profile(
    exercise_id,technical,load,overall,recommended_age_min,
    recommended_age_max,attention_demand,notes,source,complexity,updated_at)
  VALUES(
    6,4.8,6.8,6.8,NULL,NULL,'high',
    'Canonical candidate compatibility: exercise complexity 48/100, physical difficulty 68/100, overall=max(complexity, physical difficulty). Human score review remains required.',
    'canonical_candidate',48,now())
  ON CONFLICT(exercise_id) DO NOTHING;

  CREATE TEMP TABLE family_packet_seed(
    packet_slug TEXT PRIMARY KEY,
    research_version TEXT NOT NULL,
    packet_json JSONB NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_packet_seed VALUES
  -- BEGIN GENERATED CANONICAL RESEARCH PACKETS
    ('10-yard-sprint','2026-07-25.15',$packet${"assessmentSummary":{"identity":"A maximal or near-maximal linear acceleration through a 10-yard target from a prescribed start variant, ending with a planned run-out.","currentCardFindings":["The current description says only maximal acceleration sprint and does not specify the start, cue, target behavior, run-out, dose, recovery, quality gates, or stop rules.","The identity can remain start-agnostic only if every delivered workout selects an explicit controlled start variant.","No production anatomy, constraints, load, fatigue, support, or complete difficulty dimensions are stored on the card."],"proposedTaxonomy":{"movementPatterns":["short_linear_acceleration"],"jointActions":["hip_knee_ankle_extension","swing_leg_recovery","reciprocal_arm_action"],"planes":["sagittal","frontal","transverse_control"],"laterality":"start_variant_specific_then_alternating_sprint","intent":"maximal_or_near_maximal_acceleration_through_10_yards"},"proposedAnatomy":{"primaryMuscles":["gluteus_maximus","hamstrings","quadriceps","soleus","gastrocnemius"],"secondaryMuscles":["hip_flexors","intrinsic_foot","tibialis_anterior","gluteus_medius","obliques","shoulder_girdle"],"joints":["foot","ankle","knee","hip","spine","shoulder"]},"proposedDifficulty":{"technicalComplexity":48,"absoluteLoadDemand":12,"coordinationDemand":55,"supervisionDemand":52,"failureConsequence":55,"impact":58,"workCapacityDemand":42,"baseOverallDifficulty":48},"proposedLoadProfile":{"loadingType":"bodyweight_high_intent_short_acceleration","impactClass":"moderate_to_high_by_speed_surface_and_start","landingContactsPerRep":"all_contacts_through_target_and_run_out","primaryStress":["early_acceleration_force","posterior_chain","plantar_flexors","high_speed_contacts"],"fatigueSensitivity":"start_quality_projection_first_steps_speed_and_run_out"},"proposedConstraints":{"requiredEquipment":["clear_10_yard_lane","start_and_finish_marks","safe_run_out"],"optionalEquipment":["cones","timing_gates","video","start_variant_specific_equipment"],"environment":["dry_level_non_slip_surface","no_cross_traffic"],"population":["pain_free_acceleration","can_execute_selected_start","can_decelerate_safely"]},"proposedDosage":{"setsAndReps":"2-6_efforts","distance":"10_yards","restSeconds":"60-180","intensity":"maximal_or_near_maximal_after_rehearsal","progressWhen":"start, split, technique, and finish remain repeatable"},"proposedInstructions":{"coachCues":["Name the start","Project and push back","Accelerate through the line","Use the run-out"],"athleteInstructions":["Use the assigned start and sprint through the 10-yard line before easing down in the run-out"],"commonFaults":["undefined_start","false_step","popping_upright","reaching","stopping_at_target","insufficient_recovery"]},"proposedSafety":{"readiness":["selected_start_competency","safe_lane","completed_warm_up"],"stopRules":["pain","limp","slip","stumble","repeated_false_step","speed_loss","unsafe_run_out"]},"programmingDecision":"Retain as the start-agnostic 10-yard acceleration identity only when delivery requires an explicit start variant. Merge 10-Yard Sprint Start as an alias.","currentCardSnapshot":{"capturedAt":"2026-07-26T09:35:00.000Z","cardVersion":1,"status":"review","description":"Maximal acceleration sprint.","familyKey":"10-yard-sprint","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6407765/","sourceTitle":"Correlations between muscle-tendon parameters and acceleration ability in 20 m sprints","sourcePublisher":"PLOS ONE","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Rapid acceleration during the first sprint steps is a distinct performance quality.","10-Yard Sprint is a maximal or near-maximal linear acceleration effort through a 10-yard target from an explicitly selected start, followed by a safe run-out. Adding the word start does not create a second exercise."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["The start, push-off, and first acceleration steps are related but distinguishable phases.","10-Yard Sprint belongs to short linear acceleration output. Standing, two-point, three-point, falling, prone, resisted, and externally cued starts are controlled variants; a flying entry is maximal-velocity work."]},{"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4689850/","sourceTitle":"Sprint Acceleration Mechanics: The Major Role of Hamstrings in Horizontal Force Production","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Sprint acceleration involves rapid hip, knee, and ankle actions, including hamstring contribution to horizontal force production.","Represent gluteal, hamstring, quadriceps, hip-flexor, plantar-flexor, foot, pelvic, trunk, and reciprocal shoulder and arm roles, with start-specific upper-body demands added by the selected variant."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Higher-performing initial acceleration is associated with propulsive force and forward-directed impulse.","Project from the selected start, push the ground backward, coordinate the arms and legs, rise progressively, sprint through the target, and avoid prescribing one universal shin angle or step length."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start procedure and body position influence sprint timing and performance.","Score technical complexity, absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty directly. Athlete experience is programming context, not an exercise-card skill level."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6407765/","sourceTitle":"Correlations between muscle-tendon parameters and acceleration ability in 20 m sprints","sourcePublisher":"PLOS ONE","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Power output is highest during the first acceleration steps.","10-Yard Sprint must track effort count, distance, high-speed contacts, start variant and side, surface, posterior-chain and plantar-flexor stress, technical fatigue, speed loss, recovery, and total session sprint volume."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Sprint work requires an appropriate surface, marked distance, sufficient run-out, spacing, and recovery.","Require a clear dry level 10-yard lane, suitable footwear, a visible target, athlete separation, and a safe run-out; require any equipment and readiness specific to the selected start variant."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration work should specify distance, intensity, repetitions, sets, and recovery.","Use two to six quality 10-yard efforts with roughly 60–180 seconds recovery according to start complexity and measured speed; a dense repeated-sprint objective requires a separate submaximal conditioning profile."]},{"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["A start should support rapid propulsion without forcing an anthropometrically inappropriate setup.","Name the exact start, hold the required stillness, project and push back, coordinate the first steps, sprint through the 10-yard line, and decelerate only in the run-out."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Training should use appropriate supervision, correct technique, manageable demands, and gradual progression.","Stop for pain, limp, slip, stumble, lane obstruction, unsafe spacing, repeated false step, loss of posture or coordination, marked speed decline, or inability to complete the run-out safely."]},{"sectionKey":"programming","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration and maximal-velocity sprinting are distinct training qualities.","10-Yard Sprint belongs after preparation and before fatiguing work. Use full recovery for output; do not silently convert the card to conditioning by shortening rest."]},{"sectionKey":"athlete_support","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Acceleration develops across successive steps rather than through an immediate upright posture.","Show the selected start from both sides, first three contacts, the 10-yard line, the instruction to run through it, the run-out, and an appropriate simpler start regression."]},{"sectionKey":"coach_support","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Coaches should distinguish acceleration output from maximal velocity and conditioning.","Provide start-variant selection, side distribution, lane and run-out checks, side and rear observation, split timing when used, speed-loss stops, session contact totals, and exact identity and substitution rules."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Speed training should be developmentally appropriate and based on movement competency.","Accessibility options include a standing or comfortable two-point start, submaximal intent, five-yard target, untimed attempts, visual marks, fewer efforts, extra demonstration, and longer recovery."]},{"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Different start positions alter the initial force task while retaining short acceleration as the central stimulus.","Ten yards versus ten metres is dosage; standing, two-point, three-point, falling, prone, resisted, and reaction starts require variants, while flying sprints require a distinct maximal-velocity definition."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Visible links for 10-Yard Sprint remain candidate-only. Availability, embedding, exact 10-yard and start-variant match, complete viewing, captions, cue and safety quality, reviewer identity, and approval are separate gates."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=mATMYLiKa_0","title":"How To Run A Faster 40 Yard Dash : The First 10 Yards Breakdown","channelName":"Athletic Preparation","sourceQuery":"existing 10-yard acceleration candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"First-10-yard candidate; exact prescribed start and full review remain pending."},{"url":"https://www.youtube.com/watch?v=d9ZC-vTABCw","title":"Winning the First 10m | How to Improve Acceleration (Part Three)","channelName":"Coach Chris Korfist (Slow Guy Speed School)","sourceQuery":"existing 10-yard acceleration candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Metric adjacent-distance candidate; exact 10-yard and start-variant match remain pending."},{"url":"https://www.youtube.com/watch?v=00lM8-a2o3Y","title":"40 Yard Dash: Sprint Like a Pro | NFL Combine Trainer","channelName":"Bodybuilding.com","sourceQuery":"existing 10-yard acceleration candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Longer-sprint context; exact 10-yard segment and full review remain pending."},{"url":"https://www.youtube.com/watch?v=3d8W16av094","title":"My 10 x 10 Sprint Protocol Outlined","channelName":"Derek M Hansen","sourceQuery":"existing 10-yard acceleration candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"May describe a protocol rather than one exact effort; dosage and movement review remain pending."}],"alternateAssessments":[{"name":"10-Yard Sprint Start","classification":"same_identity","rationale":"The duplicate does not define a different start or movement.","distinguishingDimensions":{"nameOnly":"adds_start"}},{"name":"10-Metre Sprint","classification":"modifier_annotation","rationale":"The small metric distance change is dosage.","distinguishingDimensions":{"distance":"10_metres"}},{"name":"Three-Point 10-Yard Sprint","classification":"new_variant","rationale":"The grounded-hand stance changes initiation.","distinguishingDimensions":{"startPosition":"three_point"}},{"name":"Resisted 10-Yard Sprint","classification":"new_variant","rationale":"External resistance changes equipment and force velocity.","distinguishingDimensions":{"externalResistance":"present"}},{"name":"Flying 10-Yard Sprint","classification":"new_definition","rationale":"A flying entry targets maximal velocity rather than acceleration from a start.","distinguishingDimensions":{"primaryStimulus":"maximal_velocity"}}]}$packet$::JSONB),
    ('2-point-acceleration-start','2026-07-25.1',$packet${"assessmentSummary":{"identity":"A short maximal or near-maximal acceleration effort beginning from a two-point standing or staggered stance.","currentCardFindings":["The card has empty controlled taxonomy, anatomy, equipment, environment, population, load, and fatigue fields.","Uniform 40 difficulty values understate coordination, supervision, impact, and failure consequence and omit required score dimensions.","The generic description spans many sports but does not define distance, start geometry, run-out, dosage, or observable quality."],"proposedDifficulty":{"technicalComplexity":48,"absoluteLoadDemand":12,"coordinationDemand":54,"supervisionDemand":50,"failureConsequence":52,"impact":56,"workCapacityDemand":40,"baseOverallDifficulty":48},"programmingDecision":"Retain as a two-point start variant of short acceleration. Prescribe 5–20 m, full run-out, high intent, and enough recovery to keep split time and projection stable.","currentCardSnapshot":{"capturedAt":"2026-07-25T21:30:00.000Z","cardVersion":1,"status":"review","description":"2-Point Acceleration Start is a non-traditional strength-based explosiveness drill selected for athletes who need to express force quickly: football linemen off the line, sprinters from a start, baseball hitters and throwers, jumpers, and field/court athletes. The goal is high-output movement quality with low fatigue, not strength grinding or conditioning volume.","familyKey":"Acceleration / First-Step Output","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and timing trigger materially affect measured sprint-start performance.","2-Point Acceleration Start must record its start constraint separately from sprint distance and timing method."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["The start, push-off, and first acceleration steps are related but distinguishable parts of short sprint acceleration.","2-Point Acceleration Start belongs to linear locomotion and acceleration output; stance, cue, and distance remain controlled variant dimensions."]},{"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4689850/","sourceTitle":"Sprint Acceleration Mechanics: The Major Role of Hamstrings in Horizontal Force Production","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Sprint acceleration requires rapid lower-limb force production and coordinated hip, knee, and ankle action.","Hamstring function contributes to horizontally oriented force production during acceleration."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Early acceleration performance is associated with forward-directed impulse, propulsive force, and progressive projection through the first steps.","One universal setup or forced first-step geometry is not appropriate across different bodies and start constraints."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Standing, three-point, and block starts produce different timing and body-position effects.","Difficulty scoring must include start complexity, coordination, supervision, impact, and failure consequence rather than treating all unloaded starts as difficulty 40."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6407765/","sourceTitle":"Correlations between muscle-tendon parameters and acceleration ability in 20 m sprints","sourcePublisher":"PLOS ONE","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Power output is highest during the first steps of sprint acceleration.","The card should track neural intent, high-speed lower-limb contacts, local posterior-chain stress, technical fatigue sensitivity, and performance recovery."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Quality sprint work needs a suitable surface, marked start and finish, sufficient run-out, and recovery that preserves the intended speed quality.","Start setup, footwear, lane separation, athlete readiness, and coach sightline are relevant constraints for 2-Point Acceleration Start."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration sessions should prescribe distance, intensity, repetitions, sets, and recovery rather than repetitions alone.","Recovery and total volume should preserve fast, technically consistent efforts instead of converting start work into conditioning."]},{"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["The setup should support rapid hip extension and forward propulsion without forcing an anthropometrically inappropriate position.","Athletes should project, push the ground backward, coordinate arm action, accelerate through the target, and use the planned run-out."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Youth training should use qualified supervision, correct technique, manageable demands, and gradual progression.","Stop for pain, limping, repeated stumble, unsafe spacing or surface, loss of posture, or visible speed decline that does not recover with rest."]},{"sectionKey":"programming","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration and maximal-velocity sprinting are distinct training qualities.","2-Point Acceleration Start should be placed fresh in output or skill work; dense submaximal conditioning requires a separate delivery profile."]},{"sectionKey":"athlete_support","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Acceleration develops incrementally across successive steps rather than by immediately standing upright.","Athlete-facing support should use one or two task cues, define a successful start and finish, and avoid prescribing identical stride shapes to every athlete."]},{"sectionKey":"coach_support","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Coaches should distinguish the target acceleration quality from maximal velocity and conditioning.","Observation should include setup consistency, projection, force direction, arm-leg coordination, split performance where available, and safe completion."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Speed work should be developmentally appropriate and based on movement competency.","Distance, intent, start complexity, cue complexity, rest, and timing pressure can be scaled while retaining a short-acceleration learning objective."]},{"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and timing procedure change the task and measured performance.","Stance and cue changes should usually be modeled as variants; small distance changes are dosage annotations, while a flying start changes the primary stimulus to maximal velocity."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The candidates for 2-Point Acceleration Start returned current oEmbed player responses, but exact-version, full-content, caption, safety, and demonstration-quality review remain human gates."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=96Idqyl7_1U","title":"2-Point Start - Exercise Drill for Speed & Sprint Training","channelName":"PitcheroGPS","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 707 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."},{"url":"https://www.youtube.com/watch?v=FlfsCUSTQN8","title":"Two-Point Start For Max Acceleration","channelName":"The Stadium Sports","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 707 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."},{"url":"https://www.youtube.com/watch?v=gijySBfsL-s","title":"1st Step Explosiveness: Improve Speed with 2 Point Start","channelName":"FASSTRAINING24","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 707 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."},{"url":"https://www.youtube.com/watch?v=GzZjzBm-56k","title":"Standing Start Technique | Standing Sprint Starts for Acceleration","channelName":"Simple Speed Coach","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 707 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."}],"alternateAssessments":[{"name":"3-Point Acceleration Start","classification":"new_variant","rationale":"Adding one hand to the ground changes setup and initial projection but retains short acceleration as the primary stimulus.","distinguishingDimensions":{"startPosition":"three_point"}},{"name":"Falling Acceleration Start","classification":"new_variant","rationale":"A forward fall constrains projection and initiation without changing the central acceleration identity.","distinguishingDimensions":{"startPosition":"falling_start"}},{"name":"Block Start","classification":"new_variant","rationale":"Starting blocks change equipment, setup, and push-off mechanics while remaining a sprint-start variant.","distinguishingDimensions":{"startPosition":"blocks","equipment":["starting_blocks"]}},{"name":"2-Point Start 20m","classification":"modifier_annotation","rationale":"Distance is dosage metadata when stance, intent, and primary acceleration stimulus are unchanged.","distinguishingDimensions":{"distance":"20_meters"}}]}$packet$::JSONB),
    ('3-point-start-10-20m','2026-07-25.14',$packet${"assessmentSummary":{"identity":"A static three-point short acceleration with one hand grounded, a staggered stance, and a high-intent sprint through a prescribed 5–20-metre target.","currentCardFindings":["The current card states a distance and generic sprint qualities but does not define which hand is down, the stance relationship, initiation cue, lead-side handling, target behavior, or run-out.","Its legacy aliases contain malformed plural and punctuation variants that should remain hidden search aliases rather than display names.","The four legacy difficulty values omit supervision, failure consequence, impact, work-capacity demand, and hand-supported transition demands."],"proposedTaxonomy":{"movementPatterns":["static_three_point_start","short_linear_acceleration"],"jointActions":["hand_support_release","hip_knee_ankle_extension","swing_leg_recovery","reciprocal_arm_action"],"planes":["sagittal","frontal","transverse_control"],"laterality":"one_hand_and_staggered_feet_then_alternating_sprint","intent":"high_quality_short_acceleration_from_three_point_stance"},"proposedAnatomy":{"primaryMuscles":["gluteus_maximus","hamstrings","quadriceps","soleus","gastrocnemius"],"secondaryMuscles":["hip_flexors","intrinsic_foot","tibialis_anterior","pectoralis_major","triceps","rotator_cuff","obliques"],"joints":["hand","wrist","elbow","shoulder","spine","hip","knee","ankle","foot"]},"proposedDifficulty":{"technicalComplexity":58,"absoluteLoadDemand":12,"coordinationDemand":60,"supervisionDemand":58,"failureConsequence":58,"impact":58,"workCapacityDemand":42,"baseOverallDifficulty":58},"proposedLoadProfile":{"loadingType":"bodyweight_three_point_high_intent_acceleration","impactClass":"moderate_to_high_by_speed_surface_and_distance","landingContactsPerRep":"count_all_acceleration_and_run_out_contacts","primaryStress":["grounded_hand_and_wrist","early_acceleration_force","posterior_chain","plantar_flexors"],"fatigueSensitivity":"setup_hand_clearance_projection_first_steps_speed_and_run_out"},"proposedConstraints":{"requiredEquipment":["clean_hand_contact_area","clear_5_to_20_metre_lane","target_mark","safe_run_out"],"optionalEquipment":["cones","timing_gates","video"],"environment":["dry_level_non_slip_surface","no_cross_traffic"],"population":["pain_free_hand_support","stable_three_point_stance","pain_free_acceleration"]},"proposedDosage":{"setsAndReps":"2-6_efforts","distance":"5-20_metres","restSeconds":"90-180","intensity":"high_intent_after_rehearsal","progressWhen":"setup, hand clearance, projection, and split performance remain repeatable"},"proposedInstructions":{"coachCues":["Set the hand and feet","Load the stance","Push back and clear the hand","Sprint through the target"],"athleteInstructions":["Start still from the same three-point setup, clear the grounded hand, and accelerate through the assigned line"],"commonFaults":["undefined_hand_or_stagger","rocking_start","false_step","hand_slip","popping_upright","stopping_at_target"]},"proposedSafety":{"readiness":["pain_free_hand_support","stable_start","safe_lane","completed_warm_up"],"stopRules":["pain","hand_slip","stumble","repeated_false_step","marked_speed_loss","unsafe_run_out"]},"programmingDecision":"Retain as the stable three-point short-acceleration identity. Move 5–20-metre choices into delivery profiles and preserve reviewed legacy names as aliases.","currentCardSnapshot":{"capturedAt":"2026-07-26T09:05:00.000Z","cardVersion":1,"status":"review","description":"3-Point Start 10-20m is a acceleration & first-step output exercise for speed, sprinting, and quick-release athletes. It emphasizes hip extension, arm drive, trunk projection while keeping the session intent aligned with the Vortex phase sequence.","familyKey":"Acceleration Starts","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and procedure influence sprint performance, so the supported stance and initiation rule must be explicit.","3-Point Start 10-20m must define the grounded hand, stagger, static or build-up procedure, intent, target distance, finish, and run-out. Five yards, ten metres, or twenty metres alone does not create a new exercise identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Sprint-start push-off and the early acceleration steps are connected but distinguishable phases.","3-Point Start 10-20m belongs to a three-point ground-supported start and short linear acceleration family; two-point, four-point, block, resisted, externally cued, and progressive build-up executions require controlled variant or delivery-profile labels."]},{"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4689850/","sourceTitle":"Sprint Acceleration Mechanics: The Major Role of Hamstrings in Horizontal Force Production","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Sprint acceleration requires coordinated hip, knee, and ankle action, including hamstring contribution to horizontal force production.","Represent hand, wrist, shoulder-girdle, trunk, gluteal, hamstring, quadriceps, hip-flexor, plantar-flexor, and foot roles without reducing the exercise to knee drive."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Effective early acceleration is associated with forward-directed impulse, propulsive force, and progressive projection.","Use a repeatable stagger and hand position, clear the grounded hand, push through both legs according to the setup, coordinate the arms, and rise progressively without forcing one universal shin angle or step length."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Lower start positions change body position and timing compared with standing starts.","Score technical complexity, absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty directly; athlete experience remains programming context and is not an exercise-card skill level."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6407765/","sourceTitle":"Correlations between muscle-tendon parameters and acceleration ability in 20 m sprints","sourcePublisher":"PLOS ONE","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Power output is highest during the first acceleration steps.","3-Point Start 10-20m must track effort count, distance, sprint contacts, start-side distribution, grounded-hand side, surface, posterior-chain and plantar-flexor stress, technical fatigue, speed loss, run-out, recovery, and total session sprint volume."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Quality sprint work requires suitable space, surface, targets, separation, and recovery.","Require a clear dry level lane, safe hand-contact area, suitable footwear, visible target, athlete spacing, and sufficient run-out; cones, timing gates, and video are optional logistics or measurement tools."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration work should prescribe distance, intensity, repetitions, sets, and recovery rather than repetitions alone.","Use two to six high-quality efforts over roughly 5–20 metres with 60–180 seconds recovery; any longer progressive build-up must state its acceleration zone, target intensity, total distance, and longer contact budget."]},{"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Start setup should support effective projection without forcing an anthropometrically inappropriate position.","Use a small cue set: place the hand and feet, load the stance, push the ground back, clear the hand, coordinate opposite arm and leg, accelerate through the target, and use the run-out."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Training should use qualified supervision, correct technique, manageable demands, and gradual progression.","Stop for hand or wrist pain, other lower- or upper-limb pain, slip, stumble, lane obstruction, unsafe spacing, repeated false step, loss of projection or arm-leg coordination, marked speed decline, or inability to decelerate safely."]},{"sectionKey":"programming","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration and maximal-velocity sprinting are distinct qualities, and high-quality speed work should not become dense conditioning.","3-Point Start 10-20m belongs after sprint preparation and before fatiguing work. Static maximal starts fit output work; a defined longer progressive build-up may fit approach-rhythm or transition work but must not be silently substituted."]},{"sectionKey":"athlete_support","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Acceleration develops across successive steps rather than by immediately standing upright.","Show both stance sides, exact hand and foot setup, first three contacts, distance markers, finish and run-out, a slower rehearsal, and the difference between a short maximal start and a progressive build-up."]},{"sectionKey":"coach_support","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Coaches should distinguish acceleration quality from maximal velocity and conditioning.","Provide setup checks, side and rear observation, stance-side balance, step and contact counts, split timing when used, projection, hand clearance, speed-loss stops, and exact merge, variant, and delivery-profile guidance."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Speed training should be developmentally appropriate and based on movement competency.","Accessibility options include a two-point start, taller stagger, chosen grounded hand, submaximal intent, shorter distance, untimed attempts, visual marks, extra demonstration, fewer efforts, and longer recovery."]},{"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and timing procedure change the task and measured performance.","Small distance or measurement-system changes are dosage; changing support points, external cue, resistance, blocks, or a static maximal start into a longer progressive build-up requires a controlled variant or distinct delivery profile."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Visible links for 3-Point Start 10-20m remain candidate-only. Availability, embedding, exact stance and delivery-profile match, complete viewing, captions, cue and safety quality, reviewer identity, and approval are separate gates."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=-Ihg0il6gtw","title":"Sprint Training - How to do a 3-Point Start","channelName":"MomentumSports","sourceQuery":"existing three-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=EO6SbD2nrSc","title":"How to properly do a 3 point start #running #tips","channelName":"Lyfestyle Athletics","sourceQuery":"existing three-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=SE0SEbGSA-M","title":"Take Your 40 Yard Dash and 3 Point Starts to the Next Level","channelName":"Outperform","sourceQuery":"existing three-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=dgewJyq8ZFc","title":"How to do a 3-Point Start","channelName":"Science for Sport","sourceQuery":"existing three-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."}],"alternateAssessments":[{"name":"Three-Point Start Acceleration","classification":"same_identity","rationale":"It defines the same static supported start and differs only by a 5–10-yard target.","distinguishingDimensions":{"distance":"5_to_10_yards"}},{"name":"Three-Point Acceleration Build-Up","classification":"new_variant","rationale":"A longer progressive speed rise changes the delivery profile and contact budget if that is the intended execution.","distinguishingDimensions":{"speedProfile":"progressive_build_up"}},{"name":"Two-Point Start","classification":"new_variant","rationale":"Removing hand support changes setup and transition.","distinguishingDimensions":{"supportPoints":2}},{"name":"Block Start","classification":"new_variant","rationale":"Blocks change equipment, stance, and push-off constraints.","distinguishingDimensions":{"equipment":"starting_blocks"}},{"name":"Auditory Three-Point Start","classification":"new_variant","rationale":"An external sound cue adds a reaction requirement.","distinguishingDimensions":{"cue":"auditory"}}]}$packet$::JSONB),
    ('falling-start-10m','2026-07-25.1',$packet${"assessmentSummary":{"identity":"A short acceleration initiated by a controlled forward fall from standing, followed by a forceful first step and continued acceleration through 10 m.","currentCardFindings":["The card lacks controlled taxonomy, constraints, load, fatigue, and complete difficulty scoring.","The forward-fall constraint adds balance, timing, and failure-consequence demands that are not represented by uniform 40 scores.","Several existing falling-start names appear semantically identical or differ only by 10 m versus 10 yards."],"proposedDifficulty":{"technicalComplexity":52,"absoluteLoadDemand":12,"coordinationDemand":58,"supervisionDemand":54,"failureConsequence":58,"impact":56,"workCapacityDemand":40,"baseOverallDifficulty":52},"programmingDecision":"Treat the forward fall as a start variant and 10 m as dosage. Require a controlled whole-body fall, timely recovery step, clear lane, and full run-out; regress to a two-point start if the athlete reaches or stumbles.","currentCardSnapshot":{"capturedAt":"2026-07-25T21:30:00.000Z","cardVersion":1,"status":"review","description":"Falling Start 10m is a acceleration & first-step output exercise for speed, sprinting, and quick-release athletes. It emphasizes forward lean projection, hip extension, ankle stiffness while keeping the session intent aligned with the Vortex phase sequence.","familyKey":"Acceleration Starts","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and timing trigger materially affect measured sprint-start performance.","Falling Start 10m must record its start constraint separately from sprint distance and timing method."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["The start, push-off, and first acceleration steps are related but distinguishable parts of short sprint acceleration.","Falling Start 10m belongs to linear locomotion and acceleration output; stance, cue, and distance remain controlled variant dimensions."]},{"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4689850/","sourceTitle":"Sprint Acceleration Mechanics: The Major Role of Hamstrings in Horizontal Force Production","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Sprint acceleration requires rapid lower-limb force production and coordinated hip, knee, and ankle action.","Hamstring function contributes to horizontally oriented force production during acceleration."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Early acceleration performance is associated with forward-directed impulse, propulsive force, and progressive projection through the first steps.","One universal setup or forced first-step geometry is not appropriate across different bodies and start constraints."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Standing, three-point, and block starts produce different timing and body-position effects.","Difficulty scoring must include start complexity, coordination, supervision, impact, and failure consequence rather than treating all unloaded starts as difficulty 40."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6407765/","sourceTitle":"Correlations between muscle-tendon parameters and acceleration ability in 20 m sprints","sourcePublisher":"PLOS ONE","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Power output is highest during the first steps of sprint acceleration.","The card should track neural intent, high-speed lower-limb contacts, local posterior-chain stress, technical fatigue sensitivity, and performance recovery."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Quality sprint work needs a suitable surface, marked start and finish, sufficient run-out, and recovery that preserves the intended speed quality.","Start setup, footwear, lane separation, athlete readiness, and coach sightline are relevant constraints for Falling Start 10m."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration sessions should prescribe distance, intensity, repetitions, sets, and recovery rather than repetitions alone.","Recovery and total volume should preserve fast, technically consistent efforts instead of converting start work into conditioning."]},{"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["The setup should support rapid hip extension and forward propulsion without forcing an anthropometrically inappropriate position.","Athletes should project, push the ground backward, coordinate arm action, accelerate through the target, and use the planned run-out."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Youth training should use qualified supervision, correct technique, manageable demands, and gradual progression.","Stop for pain, limping, repeated stumble, unsafe spacing or surface, loss of posture, or visible speed decline that does not recover with rest."]},{"sectionKey":"programming","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration and maximal-velocity sprinting are distinct training qualities.","Falling Start 10m should be placed fresh in output or skill work; dense submaximal conditioning requires a separate delivery profile."]},{"sectionKey":"athlete_support","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Acceleration develops incrementally across successive steps rather than by immediately standing upright.","Athlete-facing support should use one or two task cues, define a successful start and finish, and avoid prescribing identical stride shapes to every athlete."]},{"sectionKey":"coach_support","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Coaches should distinguish the target acceleration quality from maximal velocity and conditioning.","Observation should include setup consistency, projection, force direction, arm-leg coordination, split performance where available, and safe completion."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Speed work should be developmentally appropriate and based on movement competency.","Distance, intent, start complexity, cue complexity, rest, and timing pressure can be scaled while retaining a short-acceleration learning objective."]},{"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and timing procedure change the task and measured performance.","Stance and cue changes should usually be modeled as variants; small distance changes are dosage annotations, while a flying start changes the primary stimulus to maximal velocity."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The candidates for Falling Start 10m returned current oEmbed player responses, but exact-version, full-content, caption, safety, and demonstration-quality review remain human gates."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=MgXvvuMyFfc","title":"Falling Start Speed Drill  Improve Acceleration | Speed Development for Young Athletes","channelName":"Developing Young Athletes Network","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 325 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."},{"url":"https://www.youtube.com/watch?v=O_N0AHMoGFA","title":"Speed Training Exercises:  \"Falling Starts\" to Run Faster","channelName":"synergyfitnessteam","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 325 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."},{"url":"https://www.youtube.com/watch?v=pYZ-4SoZNE8","title":"Speed Training | Falling Start - Fast, Easy, Fast | How To Run Faster","channelName":"ONEighty Athletics","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 325 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."},{"url":"https://www.youtube.com/watch?v=xxomffu3dTQ","title":"Falling Start Sprint","channelName":"Andrew Sacks","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 325 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."},{"url":"https://www.youtube.com/watch?v=xzJ96zkv3TI","title":"Falling Starts","channelName":"Nick Brattain","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 325 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."}],"alternateAssessments":[{"name":"Falling Start Sprint","classification":"same_identity","rationale":"The unspecified-distance name describes the same controlled-fall acceleration task and should resolve to one identity with distance in dosage.","distinguishingDimensions":{"distance":"unspecified"}},{"name":"Falling Start to 10 Meters","classification":"same_identity","rationale":"This is a spelling-level expression of the exact same start constraint and distance.","distinguishingDimensions":{"distance":"10_meters"}},{"name":"Falling Start to 10 Yards","classification":"modifier_annotation","rationale":"The small distance and unit change is dosage metadata when execution and intent remain unchanged.","distinguishingDimensions":{"distance":"10_yards","measurementSystem":"imperial"}},{"name":"Band-Resisted Falling Start","classification":"new_variant","rationale":"External resistance changes equipment and force-velocity demand while retaining the falling-start constraint.","distinguishingDimensions":{"loadMethod":"band_resisted","equipment":["resistance_band","partner_or_anchor"]}}]}$packet$::JSONB),
    ('half-kneeling-start-sprint','2026-07-25.1',$packet${"assessmentSummary":{"identity":"A 5–10 yard acceleration initiated from a stable half-kneeling stance, transitioning through the front foot into sprinting.","currentCardFindings":["The description is specific, but all controlled taxonomy, anatomy, constraints, load, fatigue, and most difficulty dimensions are empty.","Rising from the floor increases transition coordination, mobility, and supervision demands beyond a standing start.","The card does not identify kneeling-surface comfort, lead-leg symmetry, hand position, or safe transition criteria."],"proposedDifficulty":{"technicalComplexity":58,"absoluteLoadDemand":12,"coordinationDemand":62,"supervisionDemand":58,"failureConsequence":60,"impact":56,"workCapacityDemand":44,"baseOverallDifficulty":58},"programmingDecision":"Retain as a start-position variant used for first-step projection and floor-to-sprint transition. Dose both lead legs, provide knee-friendly support when needed, and regress if the athlete pushes from the rear knee or loses balance.","currentCardSnapshot":{"capturedAt":"2026-07-25T21:30:00.000Z","cardVersion":1,"status":"review","description":"Athlete begins in a half-kneeling stance. On cue, they shift weight into the front foot, drive the arms, push out of the start, and sprint 5–10 yards.","familyKey":"Acceleration & start speed","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and timing trigger materially affect measured sprint-start performance.","Half-Kneeling Start Sprint must record its start constraint separately from sprint distance and timing method."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["The start, push-off, and first acceleration steps are related but distinguishable parts of short sprint acceleration.","Half-Kneeling Start Sprint belongs to linear locomotion and acceleration output; stance, cue, and distance remain controlled variant dimensions."]},{"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4689850/","sourceTitle":"Sprint Acceleration Mechanics: The Major Role of Hamstrings in Horizontal Force Production","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Sprint acceleration requires rapid lower-limb force production and coordinated hip, knee, and ankle action.","Hamstring function contributes to horizontally oriented force production during acceleration."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Early acceleration performance is associated with forward-directed impulse, propulsive force, and progressive projection through the first steps.","One universal setup or forced first-step geometry is not appropriate across different bodies and start constraints."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Standing, three-point, and block starts produce different timing and body-position effects.","Difficulty scoring must include start complexity, coordination, supervision, impact, and failure consequence rather than treating all unloaded starts as difficulty 40."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6407765/","sourceTitle":"Correlations between muscle-tendon parameters and acceleration ability in 20 m sprints","sourcePublisher":"PLOS ONE","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Power output is highest during the first steps of sprint acceleration.","The card should track neural intent, high-speed lower-limb contacts, local posterior-chain stress, technical fatigue sensitivity, and performance recovery."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Quality sprint work needs a suitable surface, marked start and finish, sufficient run-out, and recovery that preserves the intended speed quality.","Start setup, footwear, lane separation, athlete readiness, and coach sightline are relevant constraints for Half-Kneeling Start Sprint."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration sessions should prescribe distance, intensity, repetitions, sets, and recovery rather than repetitions alone.","Recovery and total volume should preserve fast, technically consistent efforts instead of converting start work into conditioning."]},{"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["The setup should support rapid hip extension and forward propulsion without forcing an anthropometrically inappropriate position.","Athletes should project, push the ground backward, coordinate arm action, accelerate through the target, and use the planned run-out."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Youth training should use qualified supervision, correct technique, manageable demands, and gradual progression.","Stop for pain, limping, repeated stumble, unsafe spacing or surface, loss of posture, or visible speed decline that does not recover with rest."]},{"sectionKey":"programming","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration and maximal-velocity sprinting are distinct training qualities.","Half-Kneeling Start Sprint should be placed fresh in output or skill work; dense submaximal conditioning requires a separate delivery profile."]},{"sectionKey":"athlete_support","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Acceleration develops incrementally across successive steps rather than by immediately standing upright.","Athlete-facing support should use one or two task cues, define a successful start and finish, and avoid prescribing identical stride shapes to every athlete."]},{"sectionKey":"coach_support","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Coaches should distinguish the target acceleration quality from maximal velocity and conditioning.","Observation should include setup consistency, projection, force direction, arm-leg coordination, split performance where available, and safe completion."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Speed work should be developmentally appropriate and based on movement competency.","Distance, intent, start complexity, cue complexity, rest, and timing pressure can be scaled while retaining a short-acceleration learning objective."]},{"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and timing procedure change the task and measured performance.","Stance and cue changes should usually be modeled as variants; small distance changes are dosage annotations, while a flying start changes the primary stimulus to maximal velocity."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The candidates for Half-Kneeling Start Sprint returned current oEmbed player responses, but exact-version, full-content, caption, safety, and demonstration-quality review remain human gates."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=0NH-PWKekIQ","title":"Half kneeling start to sprint","channelName":"Coach Christo","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 708 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."},{"url":"https://www.youtube.com/watch?v=14TzuI0l7Ug","title":"Speed drill: Half Kneeling Sprint Start","channelName":"ASSA Sport Speed Academy","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 708 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."},{"url":"https://www.youtube.com/watch?v=HkNM61TpxAM","title":"Half Kneeling Start","channelName":"Sports Rehab Expert","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 120 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."},{"url":"https://www.youtube.com/watch?v=hUIqIaL26TY","title":"Half-Kneeling Sprint Start","channelName":"Simone Sports Performance","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 708 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."},{"url":"https://www.youtube.com/watch?v=HWJIGVYVbKk","title":"Half Kneeling Start","channelName":"Performance Course","sourceQuery":"legacy direct-link candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Imported from legacy exercise 120 media_library.clinical_or_sport_science_references; availability, embedding, exact-version match, and demonstration quality remain pending.\nYouTube oEmbed metadata and an embed-player response were verified at 2026-07-25T21:49:16Z; exact exercise/version and demonstration-quality review remain pending."}],"alternateAssessments":[{"name":"Tall-Kneeling Start Sprint","classification":"new_variant","rationale":"Starting with both knees down changes the transition and available front-foot contribution while retaining floor-to-sprint acceleration.","distinguishingDimensions":{"startPosition":"tall_kneeling"}},{"name":"Prone Start Sprint","classification":"new_variant","rationale":"A prone start adds a larger floor transition and different upper-body contribution.","distinguishingDimensions":{"startPosition":"prone"}},{"name":"Half-Kneeling Start 5 Yards","classification":"modifier_annotation","rationale":"Distance is dosage metadata within the same half-kneeling start task.","distinguishingDimensions":{"distance":"5_yards"}},{"name":"Half-Kneeling Start with Auditory Cue","classification":"new_variant","rationale":"An unpredictable external go-signal adds simple-reaction demand to the same physical start.","distinguishingDimensions":{"cueModality":"auditory","cueTiming":"unpredictable"}}]}$packet$::JSONB),
    ('auditory-start-sprint','2026-07-25.17',$packet${"assessmentSummary":{"identity":"A short linear sprint acceleration initiated from a prescribed stance in response to one unpredictable, standardized auditory go-signal.","currentCardFindings":["The generic strength-based explosiveness description does not define cue type, intensity, location, randomized wait, start stance, distance, false-start rule, finish, or run-out.","The task is simple reaction only when one sound maps to one prepared forward sprint; directional choice is a different definition.","Several inherited media candidates show a start or reaction component but not necessarily the exact combined task."],"proposedTaxonomy":{"movementPatterns":["auditory_reaction_start","short_linear_acceleration"],"jointActions":["auditory_response_to_hip_knee_ankle_extension","swing_leg_recovery","reciprocal_arm_action"],"planes":["sagittal","frontal_control"],"laterality":"stance_specific_then_alternating_sprint","intent":"accurate_unanticipated_response_then_high_quality_acceleration"},"proposedAnatomy":{"primaryMuscles":["gluteus_maximus","hamstrings","quadriceps","soleus","gastrocnemius"],"secondaryMuscles":["hip_flexors","intrinsic_foot","tibialis_anterior","gluteus_medius","obliques","shoulder_girdle"],"joints":["foot","ankle","knee","hip","spine","shoulder"]},"proposedDifficulty":{"technicalComplexity":55,"absoluteLoadDemand":12,"coordinationDemand":64,"supervisionDemand":60,"failureConsequence":60,"impact":56,"workCapacityDemand":42,"baseOverallDifficulty":55},"proposedLoadProfile":{"loadingType":"bodyweight_auditory_reaction_to_high_intent_acceleration","impactClass":"moderate_to_high_by_speed_surface_and_stance","landingContactsPerRep":"all_contacts_through_target_and_run_out","primaryStress":["attention_and_anticipation_control","early_acceleration_force","posterior_chain","plantar_flexors"],"fatigueSensitivity":"cue_detection_anticipation_start_quality_projection_speed_and_run_out"},"proposedConstraints":{"requiredEquipment":["clear_short_lane","audible_non_startling_cue","target","safe_run_out"],"optionalEquipment":["whistle","speaker","timing_system","cones","video"],"environment":["cue_audible_over_background_noise","dry_level_surface","no_cross_traffic"],"population":["can_hear_or_access_equivalent_cue","can_execute_selected_start","pain_free_acceleration"]},"proposedDosage":{"setsAndReps":"2-6_accepted_reactions","distance":"5-20_metres","restSeconds":"60-180","intensity":"high_intent_after_cue_rehearsal","progressWhen":"reaction validity, start mechanics, speed, and finish remain repeatable"},"proposedInstructions":{"coachCues":["Set the exact stance","Wait for the sound","Do not guess","Sprint through the target"],"athleteInstructions":["Hold the stance, react only to the assigned sound, and accelerate through the target"],"commonFaults":["undefined_cue","predictable_wait","anticipation","wrong_sound_response","false_step","stopping_at_target"]},"proposedSafety":{"readiness":["cue_access_confirmed","selected_start_competency","safe_lane"],"stopRules":["pain","startle_or_distress","cue_ambiguity","repeated_anticipation","stumble","speed_loss","unsafe_run_out"]},"programmingDecision":"Retain as the simple auditory go-signal sprint-start identity. Treat whistle, clap, and verbal go as controlled cue implementations; stance remains an explicit variant.","currentCardSnapshot":{"capturedAt":"2026-07-26T10:25:00.000Z","cardVersion":1,"status":"review","description":"Auditory Start Sprint is a non-traditional strength-based explosiveness drill selected for athletes who need to express force quickly: football linemen off the line, sprinters from a start, baseball hitters and throwers, jumpers, and field/court athletes. The goal is high-output movement quality with low fatigue, not strength grinding or conditioning volume.","familyKey":"Reactive Explosiveness","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/17127583/","sourceTitle":"Sprint starts and the minimum auditory reaction time","sourcePublisher":"Journal of Sports Sciences","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["An auditory sprint start includes a measurable interval between an unpredictable go-signal and force or movement onset.","Auditory Start Sprint must define cue modality, cue meaning, waiting interval, allowed response choices, start stance, false-start rule, direction, sprint distance, finish, and run-out. Simple go reaction and directional choice reaction are not interchangeable."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5465987/","sourceTitle":"Are Change of Direction Speed and Reactive Agility Useful for Determining the Optimal Field Position for Young Soccer Players?","sourcePublisher":"Journal of Sports Science and Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":78,"claims":["A visually cued reactive task differs from a pre-planned task because the athlete must identify an unpredictable illuminated target before selecting the direction.","Auditory Start Sprint belongs either to a simple externally cued sprint-start variant or to reactive agility with perceptual decision and direction selection; the exact cue-response mapping determines which."]},{"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4689850/","sourceTitle":"Sprint Acceleration Mechanics: The Major Role of Hamstrings in Horizontal Force Production","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Sprint acceleration requires coordinated hip, knee, and ankle action, including hamstring contribution to horizontal force production.","Represent visual or auditory processing and head-eye orientation as task demands, then gluteal, hamstring, quadriceps, hip-flexor, plantar-flexor, foot, trunk, and reciprocal arm roles; add braking and lateral control for directional choices."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Early sprint acceleration is associated with forward-directed impulse, propulsive force, and progressive projection.","The prepared response should preserve a repeatable start and first steps. Directional-choice responses additionally require head-eye pickup, safe reorientation, braking or turning mechanics, and a clear target path."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/17127583/","sourceTitle":"Sprint starts and the minimum auditory reaction time","sourcePublisher":"Journal of Sports Sciences","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Auditory reaction time includes neural and neuromuscular components in addition to physical sprint-start execution.","Score technical complexity, absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty directly; athlete experience is programming context and never an exercise-card skill level."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6407765/","sourceTitle":"Correlations between muscle-tendon parameters and acceleration ability in 20 m sprints","sourcePublisher":"PLOS ONE","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Power output is highest during the first acceleration steps.","Auditory Start Sprint must track attempts, accepted versus anticipated responses, decision errors, distance, sprint and braking contacts, stance and direction distribution, surface, posterior-chain and plantar-flexor stress, technical or perceptual fatigue, recovery, and total session volume."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Quality sprint work requires a suitable surface, target, spacing, run-out, and recovery.","Require a clear dry lane or direction grid, unobstructed sight or hearing, consistent non-startling cue delivery, athlete separation, safe targets and run-outs, and any light, whistle, cone, or timing equipment specified by the variant."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration work should prescribe distance, intensity, repetitions, sets, and recovery.","Use two to six quality reactions per cue or direction with randomized waits and roughly 60–180 seconds recovery for high-intent sprint starts; directional tasks must balance choices and record correct responses separately from movement time."]},{"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5465987/","sourceTitle":"Are Change of Direction Speed and Reactive Agility Useful for Determining the Optimal Field Position for Young Soccer Players?","sourcePublisher":"Journal of Sports Science and Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":78,"claims":["Reactive trials require the athlete to identify the presented target rather than execute a known direction.","Set the stance, focus on the defined cue source, wait without guessing, execute only the mapped response, accelerate through the target, and use the assigned deceleration or run-out path."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Training should use appropriate supervision, correct technique, manageable demands, and gradual progression.","Stop for pain, startle or distress, missed or ambiguous cue, repeated anticipation, slip, stumble, lane conflict, unsafe turn or brake, marked decision or speed decline, or inability to complete the run-out safely."]},{"sectionKey":"programming","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration and maximal-velocity sprinting are distinct qualities, and high-quality sprint work should not become dense conditioning.","Auditory Start Sprint belongs after preparation and before fatigue. Program simple reaction before multiple-choice direction tasks, and separate reaction accuracy from sprint or agility output when reviewing performance."]},{"sectionKey":"athlete_support","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Acceleration develops across successive steps rather than through immediate upright running.","Show the exact stance, cue device and location, allowed mappings, one accepted and one false-start example, all target directions, finish and run-out paths, and a pre-planned regression."]},{"sectionKey":"coach_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5465987/","sourceTitle":"Are Change of Direction Speed and Reactive Agility Useful for Determining the Optimal Field Position for Young Soccer Players?","sourcePublisher":"Journal of Sports Science and Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":78,"claims":["Reactive assessment separates the unplanned visual-target condition from the same pre-planned movement path.","Provide a randomized cue schedule, cue and movement timestamps when measured, response accuracy, anticipation and no-response rules, stance and direction balance, lane control, technique and speed stops, and exact simple-versus-choice classification."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Speed training should be developmentally appropriate and based on movement competency.","Accessibility options include a comfortable stance, one cue modality, one known response, longer wait window, submaximal intent, shorter distance, high-contrast visual target, non-startling sound, demonstration, fewer choices, fewer reps, and longer recovery."]},{"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5465987/","sourceTitle":"Are Change of Direction Speed and Reactive Agility Useful for Determining the Optimal Field Position for Young Soccer Players?","sourcePublisher":"Journal of Sports Science and Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":78,"claims":["Pre-planned and reactive direction tasks use similar paths but differ in whether the target direction is known.","Whistle, clap, and verbal go can be aliases of one simple auditory signal; changing cue modality is a variant, while adding multiple response choices, a live opponent, a ball, or a required direction change may require a distinct definition."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Visible links for Auditory Start Sprint remain candidate-only. Availability, embedding, exact stance, cue, choice count, direction and finish match, full viewing, captions, cue and safety quality, reviewer identity, and approval are separate gates."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=edfjTEu7O4I","title":"Speed & Agility: Auditory & Visual Reaction Time- Cone Drill","channelName":"Relentless Athletics","sourceQuery":"existing auditory-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Auditory and visual reaction component; exact simple forward sprint start requires review."},{"url":"https://www.youtube.com/watch?v=-Ihg0il6gtw","title":"Sprint Training - How to do a 3-Point Start","channelName":"MomentumSports","sourceQuery":"existing auditory-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Start component only; unpredictable auditory cue is unverified."},{"url":"https://www.youtube.com/watch?v=TJc9SIXBjME","title":"Beginner Sprint Start Drills That Actually Work in 2025!","channelName":"Lyfestyle Athletics","sourceQuery":"existing auditory-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Sprint-start candidate; exact auditory reaction procedure requires review."},{"url":"https://www.youtube.com/watch?v=TNnKwjJo8Sc","title":"Whistle Reaction Advanced Agility","channelName":"ONEighty Athletics","sourceQuery":"existing auditory-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Whistle reaction component; may be agility rather than one forward sprint."},{"url":"https://www.youtube.com/watch?v=yzrr3wy8bxY","title":"Sprinters: Improve Reaction Time With This Tool","channelName":"ATHLETE.X","sourceQuery":"existing auditory-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Reaction-time candidate; exact stance, distance, and cue procedure require review."}],"alternateAssessments":[{"name":"Whistle Start Sprint","classification":"same_identity","rationale":"A whistle is one implementation of the same simple auditory go-signal.","distinguishingDimensions":{"cueDevice":"whistle"}},{"name":"Split-Stance Auditory Sprint Start","classification":"new_variant","rationale":"It fixes the stance while preserving one auditory response.","distinguishingDimensions":{"startPosition":"split_stance"}},{"name":"Visual-Cue Start Sprint","classification":"new_variant","rationale":"Changing sensory modality alters detection and access requirements.","distinguishingDimensions":{"cueModality":"visual"}},{"name":"Partner Point Reactive Sprint","classification":"new_definition","rationale":"Multiple directional choices add decision-making and change-of-direction demands.","distinguishingDimensions":{"responseChoices":"left_right_forward"}},{"name":"Self-Selected Start Sprint","classification":"new_definition","rationale":"Removing the external cue removes reaction and anticipation control.","distinguishingDimensions":{"cueModality":"self_selected"}}]}$packet$::JSONB),
    ('two-point-start-walk-in','2026-07-25.12',$packet${"assessmentSummary":{"identity":"A controlled submaximal initiation variant in which the athlete walks into or gradually settles into a staggered two-point projection before accelerating a short prescribed distance.","currentCardFindings":["The description conflates walking in, leaning in, and a static two-point start; one exact entry sequence must be chosen.","The title implies a moving entry while the description permits multiple procedures, so publication remains quarantined.","Uniform difficulty values fail to reflect the reduced physical output but continuing timing, coordination, and supervision demands."],"proposedTaxonomy":{"movementPatterns":["walk_in_to_two_point_projection","submaximal_short_acceleration"],"jointActions":["walking_gait_to_hip_knee_ankle_extension","swing_leg_recovery","reciprocal_arm_action"],"planes":["sagittal","frontal"],"laterality":"alternating_walk_then_staggered_projection_then_sprint","intent":"rehearse_transition_into_two_point_acceleration_at_controlled_intent"},"proposedAnatomy":{"primaryMuscles":["gluteus_maximus","hamstrings","quadriceps","soleus","gastrocnemius"],"secondaryMuscles":["hip_flexors","intrinsic_foot","tibialis_anterior","gluteus_medius","trunk","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":46,"absoluteLoadDemand":9,"coordinationDemand":52,"supervisionDemand":44,"failureConsequence":42,"impact":38,"workCapacityDemand":28,"baseOverallDifficulty":46},"proposedLoadProfile":{"loadingType":"bodyweight_walk_in_to_submaximal_short_acceleration","impactClass":"low_to_moderate_by_exit_intent_and_distance","landingContactsPerRep":"count_entry_steps_separately_from_acceleration_contacts","primaryStress":["entry_timing","projection_transition","posterior_chain","plantar_flexors"],"fatigueSensitivity":"entry_inconsistency_false_step_projection_posture_and_exit_control"},"proposedConstraints":{"requiredEquipment":["clear_short_lane","entry_start_and_finish_marks","safe_run_out"],"optionalEquipment":["cones","video"],"environment":["dry_level_non_slip_surface","no_cross_traffic"],"population":["pain_free_walk_and_acceleration","can_follow_entry_sequence"]},"proposedDosage":{"setsAndReps":"2-6_rehearsals","entryAndDistance":"2-4_walk_steps_then_5-10_metres","restSeconds":"30-90","intensity":"submaximal_learning","progressWhen":"entry and transition are repeatable without rocking, reaching, or false steps"},"proposedInstructions":{"coachCues":["Use the exact walk-in count","Settle into projection","Push back","Exit smoothly"],"athleteInstructions":["Take the assigned entry steps, transition into the two-point projection, and accelerate smoothly through the short target"],"commonFaults":["undefined_entry","turning_into_rolling_sprint","pausing_between_entry_and_exit","overreaching","maximal_intent_too_soon"]},"proposedSafety":{"readiness":["pain_free_walk","stable_two_point_stance","safe_lane"],"stopRules":["pain","limp","stumble","entry_confusion","unsafe_speed","loss_of_control","unsafe_run_out"]},"programmingDecision":"Retain only as a controlled walk-in variant of 2-Point Acceleration Start after one exact entry sequence is selected. Keep publication and media quarantined until the moving-entry match is human-reviewed.","currentCardSnapshot":{"capturedAt":"2026-07-26T07:40:00.000Z","cardVersion":1,"status":"review","description":"Athlete sets a two-point start (one foot forward, one back), walks in or leans into the first step with proper shin angles and arm action, then accelerates only through prescribed short distance at submax intensity.","familyKey":"Locomotion & sprint mechanics","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and timing procedure affect sprint performance; start geometry must be explicit while small distance changes remain dosage.","Two-Point Start Walk-In must define stance, self-initiated or cued start, walk-in or static entry, sprint intent, distance, and run-out. Five, ten, or twenty metres does not create a new identity when the two-point start is unchanged."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["The push-off and early acceleration steps form distinguishable but connected phases of sprint acceleration.","Two-Point Start Walk-In belongs to static two-point short acceleration or a controlled walk-in two-point initiation variant; it is not a falling start, three-point start, block start, maximal-velocity sprint, or conditioning interval."]},{"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4689850/","sourceTitle":"Sprint Acceleration Mechanics: The Major Role of Hamstrings in Horizontal Force Production","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Sprint acceleration requires coordinated hip, knee, and ankle action, with hamstring contribution to horizontal force production.","Represent gluteal, hamstring, quadriceps, plantar-flexor, hip-flexor, foot, pelvic, trunk, and reciprocal arm-action roles without reducing the exercise to knee drive or ankle stiffness."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Early acceleration is associated with forward-directed impulse, propulsive force, and progressive projection.","Use a repeatable staggered setup, complete push from the front leg, coordinated arms, and progressive rise without forcing identical shin angles or step lengths across athletes."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Standing and lower start positions produce different timing and body-position effects and should not receive an unexplained generic score.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; audience readiness remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6407765/","sourceTitle":"Correlations between muscle-tendon parameters and acceleration ability in 20 m sprints","sourcePublisher":"PLOS ONE","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Power output is highest during the first acceleration steps, so short starts require high-intent contact and recovery accounting.","Two-Point Start Walk-In needs distance, intent, timed status, total high-speed contacts, start-side distribution, surface, footwear, posterior-chain and plantar-flexor stress, technical-fatigue markers, recovery, and session sprint-volume accounting."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Quality sprint work requires a suitable surface, marked start and finish, sufficient run-out, and recovery that preserves speed quality.","Require a clear dry level lane, safe separation, suitable footwear, stable staggered stance, finish mark, and run-out; timing gates and cones are optional measurement and logistics tools."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration work should prescribe distance, intensity, repetitions, sets, and recovery rather than repetitions alone.","Use 2-6 high-quality efforts over 5-20 metres with roughly 60-180 seconds recovery, or lower-intent rehearsals with shorter recovery when the card explicitly uses a walk-in learning profile."]},{"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["The start should support rapid hip extension and forward propulsion without forcing an anthropometrically inappropriate setup.","Use a small cue set: set the feet, load the front leg, project forward, push the ground backward, coordinate opposite arm and leg, accelerate through the target, and use the run-out."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Training should use qualified supervision, correct technique, manageable demands, and gradual progression.","Stop for pain, limping, repeated stumble, false step that creates collision risk, unstable setup, unsafe surface or spacing, projection or arm-leg breakdown, marked speed decline, or inability to decelerate in the run-out."]},{"sectionKey":"programming","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration and maximal-velocity sprinting are distinct qualities and high-quality sprint work should not be converted into dense conditioning.","Two-Point Start Walk-In belongs after preparation and before fatiguing work; static high-intent starts fit output work, while walk-in and submaximal versions fit teaching or movement preparation."]},{"sectionKey":"athlete_support","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Acceleration develops progressively across successive steps rather than by immediately standing upright.","Show stance setup from both sides, lead-leg options, first three contacts, start and finish marks, run-out, a submaximal rehearsal, and the difference between a static start and a walk-in entry."]},{"sectionKey":"coach_support","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Coaches should distinguish acceleration quality from maximal velocity and conditioning.","Provide side and rear observation, stance measurements when needed, start-side balance, step and distance counts, timing method, projection, arm-leg coordination, speed-loss stops, and exact merge or variant guidance."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Speed work should be developmentally appropriate and based on movement competency.","Accessibility options include a taller or more comfortable stagger, a walk-in entry, submaximal intent, shorter distance, untimed attempts, visual start marks, extra demonstration, fewer efforts, and longer recovery."]},{"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and timing procedure change the task and measured performance.","Five-to-ten yards versus ten-to-twenty metres is dosage; static versus walk-in entry, two-point versus three-point stance, external cue, blocks, and resistance require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The existing visible candidates for Two-Point Start Walk-In remain candidate-only; current embedding, exact static or walk-in start match, complete viewing, captions, instruction, safety, reviewer identity, and approval remain separate human gates."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=96Idqyl7_1U","title":"2-Point Start - Exercise Drill for Speed and Sprint Training","channelName":"PitcheroGPS","sourceQuery":"existing researched two-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Static two-point candidate; exact walk-in entry unverified."},{"url":"https://www.youtube.com/watch?v=FlfsCUSTQN8","title":"Two-Point Start For Max Acceleration","channelName":"The Stadium Sports","sourceQuery":"existing researched two-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Maximal static-start candidate; non-exact for submaximal walk-in."},{"url":"https://www.youtube.com/watch?v=gijySBfsL-s","title":"1st Step Explosiveness: Improve Speed with 2 Point Start","channelName":"FASSTRAINING24","sourceQuery":"existing researched two-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Two-point component only; moving entry requires review."},{"url":"https://www.youtube.com/watch?v=GzZjzBm-56k","title":"Standing Start Technique","channelName":"Simple Speed Coach","sourceQuery":"existing researched two-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Standing-start component only; exact walk-in procedure unverified."}],"alternateAssessments":[{"name":"Static 2-Point Acceleration Start","classification":"new_variant","rationale":"Removing the moving entry changes the start procedure and raises output intent.","distinguishingDimensions":{"entry":"static"}},{"name":"Two-Step Walk-In Start","classification":"same_identity","rationale":"A fixed two-step entry is a reproducible expression of this variant.","distinguishingDimensions":{"entrySteps":2}},{"name":"Falling Start","classification":"new_variant","rationale":"A continuous forward fall rather than a counted walk initiates the effort.","distinguishingDimensions":{"entry":"forward_fall"}},{"name":"Rolling Start","classification":"new_definition","rationale":"A continuous run-in changes the task toward build-up or maximal-velocity exposure.","distinguishingDimensions":{"entry":"running"}},{"name":"Walk-In to Position Hold","classification":"new_definition","rationale":"Ending in a hold removes acceleration output.","distinguishingDimensions":{"terminalAction":"hold"}}]}$packet$::JSONB),
    ('three-point-acceleration-build-up','2026-07-25.14',$packet${"assessmentSummary":{"identity":"A provisionally controlled three-point-start delivery profile that uses a longer, progressive acceleration rise rather than a short maximal start.","currentCardFindings":["The description says the drill supports a distance-jump run-up but does not state the starting hand or foot setup, total distance, acceleration-zone length, target intensity, finish, or whether a jump approach follows.","The term build-up may describe either ordinary progressive acceleration from the same three-point start or a distinct approach-rhythm task; the current card cannot distinguish them.","No difficulty dimensions, contact budget, fatigue model, constraints, instructions, stop rules, or exact media are present."],"proposedTaxonomy":{"movementPatterns":["three_point_start","progressive_linear_acceleration"],"jointActions":["hand_support_release","hip_knee_ankle_extension","swing_leg_recovery","reciprocal_arm_action"],"planes":["sagittal","frontal","transverse_control"],"laterality":"one_hand_and_staggered_feet_then_alternating_sprint","intent":"progressively_build_speed_and_posture_from_three_point_start"},"proposedAnatomy":{"primaryMuscles":["gluteus_maximus","hamstrings","quadriceps","soleus","gastrocnemius"],"secondaryMuscles":["hip_flexors","intrinsic_foot","tibialis_anterior","pectoralis_major","triceps","rotator_cuff","obliques"],"joints":["hand","wrist","elbow","shoulder","spine","hip","knee","ankle","foot"]},"proposedDifficulty":{"technicalComplexity":56,"absoluteLoadDemand":12,"coordinationDemand":60,"supervisionDemand":55,"failureConsequence":56,"impact":64,"workCapacityDemand":58,"baseOverallDifficulty":56},"proposedLoadProfile":{"loadingType":"bodyweight_three_point_progressive_acceleration","impactClass":"moderate_to_high_by_final_speed_and_total_distance","landingContactsPerRep":"count_every_contact_across_acceleration_zone_finish_and_run_out","primaryStress":["grounded_hand_and_wrist","progressive_acceleration_contacts","posterior_chain","plantar_flexors","speed_endurance_if_extended"],"fatigueSensitivity":"start_setup_rate_of_rise_posture_rhythm_speed_contact_count_and_run_out"},"proposedConstraints":{"requiredEquipment":["clean_hand_contact_area","marked_acceleration_zone","clear_lane","target_and_safe_run_out"],"optionalEquipment":["cones","timing_gates","video","jump_runway_if_that_context_is_confirmed"],"environment":["dry_level_non_slip_surface","no_cross_traffic"],"population":["pain_free_hand_support","can_control_progressive_speed_rise","can_decelerate_safely"]},"proposedDosage":{"setsAndReps":"2-5_efforts","distance":"must_be_human_defined_before_publication","restSeconds":"120-240_by_distance_and_final_speed","intensity":"progressive_not_automatically_maximal","progressWhen":"rate of rise, posture, rhythm, finish, and run-out remain repeatable"},"proposedInstructions":{"coachCues":["Define the exact three-point setup","Build speed across the marked zone","Rise progressively","Run through and out"],"athleteInstructions":["Use the assigned three-point stance and build speed smoothly across the marked zone without rushing upright"],"commonFaults":["undefined_build_up","ordinary_maximal_start_mislabeled","no_marked_zones","abrupt_posture_change","unplanned_jump_approach","unsafe_finish"]},"proposedSafety":{"readiness":["pain_free_hand_support","controlled_progressive_acceleration","safe_lane_and_run_out"],"stopRules":["pain","hand_slip","stumble","zone_confusion","loss_of_rhythm","marked_speed_loss","unsafe_run_out"]},"programmingDecision":"Retain only as a quarantined controlled delivery profile of the stable three-point-start identity until a human specifies the exact start, distance, speed progression, terminal action, and jump-runway relationship. If no material execution difference remains, merge it as an alias.","currentCardSnapshot":{"capturedAt":"2026-07-26T09:05:00.000Z","cardVersion":1,"status":"review","description":"Three-Point Acceleration Build-Up addresses distance-jumping performance by targeting builds acceleration intent and gradual rise mechanics that feed into the distance-jump run-up. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.","familyKey":"Acceleration build-up","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and procedure influence sprint performance, so the supported stance and initiation rule must be explicit.","Three-Point Acceleration Build-Up must define the grounded hand, stagger, static or build-up procedure, intent, target distance, finish, and run-out. Five yards, ten metres, or twenty metres alone does not create a new exercise identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Sprint-start push-off and the early acceleration steps are connected but distinguishable phases.","Three-Point Acceleration Build-Up belongs to a three-point ground-supported start and short linear acceleration family; two-point, four-point, block, resisted, externally cued, and progressive build-up executions require controlled variant or delivery-profile labels."]},{"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4689850/","sourceTitle":"Sprint Acceleration Mechanics: The Major Role of Hamstrings in Horizontal Force Production","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Sprint acceleration requires coordinated hip, knee, and ankle action, including hamstring contribution to horizontal force production.","Represent hand, wrist, shoulder-girdle, trunk, gluteal, hamstring, quadriceps, hip-flexor, plantar-flexor, and foot roles without reducing the exercise to knee drive."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Effective early acceleration is associated with forward-directed impulse, propulsive force, and progressive projection.","Use a repeatable stagger and hand position, clear the grounded hand, push through both legs according to the setup, coordinate the arms, and rise progressively without forcing one universal shin angle or step length."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Lower start positions change body position and timing compared with standing starts.","Score technical complexity, absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty directly; athlete experience remains programming context and is not an exercise-card skill level."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6407765/","sourceTitle":"Correlations between muscle-tendon parameters and acceleration ability in 20 m sprints","sourcePublisher":"PLOS ONE","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Power output is highest during the first acceleration steps.","Three-Point Acceleration Build-Up must track effort count, distance, sprint contacts, start-side distribution, grounded-hand side, surface, posterior-chain and plantar-flexor stress, technical fatigue, speed loss, run-out, recovery, and total session sprint volume."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Quality sprint work requires suitable space, surface, targets, separation, and recovery.","Require a clear dry level lane, safe hand-contact area, suitable footwear, visible target, athlete spacing, and sufficient run-out; cones, timing gates, and video are optional logistics or measurement tools."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration work should prescribe distance, intensity, repetitions, sets, and recovery rather than repetitions alone.","Use two to six high-quality efforts over roughly 5–20 metres with 60–180 seconds recovery; any longer progressive build-up must state its acceleration zone, target intensity, total distance, and longer contact budget."]},{"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","sourceTitle":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Start setup should support effective projection without forcing an anthropometrically inappropriate position.","Use a small cue set: place the hand and feet, load the stance, push the ground back, clear the hand, coordinate opposite arm and leg, accelerate through the target, and use the run-out."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Training should use qualified supervision, correct technique, manageable demands, and gradual progression.","Stop for hand or wrist pain, other lower- or upper-limb pain, slip, stumble, lane obstruction, unsafe spacing, repeated false step, loss of projection or arm-leg coordination, marked speed decline, or inability to decelerate safely."]},{"sectionKey":"programming","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration and maximal-velocity sprinting are distinct qualities, and high-quality speed work should not become dense conditioning.","Three-Point Acceleration Build-Up belongs after sprint preparation and before fatiguing work. Static maximal starts fit output work; a defined longer progressive build-up may fit approach-rhythm or transition work but must not be silently substituted."]},{"sectionKey":"athlete_support","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Acceleration develops across successive steps rather than by immediately standing upright.","Show both stance sides, exact hand and foot setup, first three contacts, distance markers, finish and run-out, a slower rehearsal, and the difference between a short maximal start and a progressive build-up."]},{"sectionKey":"coach_support","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Coaches should distinguish acceleration quality from maximal velocity and conditioning.","Provide setup checks, side and rear observation, stance-side balance, step and contact counts, split timing when used, projection, hand clearance, speed-loss stops, and exact merge, variant, and delivery-profile guidance."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Speed training should be developmentally appropriate and based on movement competency.","Accessibility options include a two-point start, taller stagger, chosen grounded hand, submaximal intent, shorter distance, untimed attempts, visual marks, extra demonstration, fewer efforts, and longer recovery."]},{"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22233797/","sourceTitle":"The difference is in the start: impact of timing and start procedure on sprint running performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Start position and timing procedure change the task and measured performance.","Small distance or measurement-system changes are dosage; changing support points, external cue, resistance, blocks, or a static maximal start into a longer progressive build-up requires a controlled variant or distinct delivery profile."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Visible links for Three-Point Acceleration Build-Up remain candidate-only. Availability, embedding, exact stance and delivery-profile match, complete viewing, captions, cue and safety quality, reviewer identity, and approval are separate gates."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=-Ihg0il6gtw","title":"Sprint Training - How to do a 3-Point Start","channelName":"MomentumSports","sourceQuery":"adjacent three-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Shows the start component; an exact progressive build-up profile was not established."},{"url":"https://www.youtube.com/watch?v=EO6SbD2nrSc","title":"How to properly do a 3 point start #running #tips","channelName":"Lyfestyle Athletics","sourceQuery":"adjacent three-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Shows the start component; exact distance-jump build-up intent remains unverified."},{"url":"https://www.youtube.com/watch?v=SE0SEbGSA-M","title":"Take Your 40 Yard Dash and 3 Point Starts to the Next Level","channelName":"Outperform","sourceQuery":"adjacent three-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Three-point acceleration candidate; exact progressive build-up delivery is unverified."},{"url":"https://www.youtube.com/watch?v=dgewJyq8ZFc","title":"How to do a 3-Point Start","channelName":"Science for Sport","sourceQuery":"adjacent three-point-start candidate","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Shows a three-point start, not a confirmed longer build-up or jump approach."}],"alternateAssessments":[{"name":"3-Point Start 10–20m","classification":"new_variant","rationale":"The stable card uses a short high-intent start rather than a longer prescribed progressive rise.","distinguishingDimensions":{"speedProfile":"short_high_intent"}},{"name":"Build-Up Sprint / Stride-Out","classification":"new_variant","rationale":"A standing or rolling build-up removes the three-point support constraint.","distinguishingDimensions":{"startPosition":"standing_or_rolling"}},{"name":"Long-Jump Approach Run","classification":"new_definition","rationale":"A measured approach with a takeoff objective adds accuracy and a terminal action.","distinguishingDimensions":{"terminalAction":"jump_takeoff"}},{"name":"Three-Point Start 30m","classification":"modifier_annotation","rationale":"Distance alone is a dose when the speed profile remains the same.","distinguishingDimensions":{"distance":"30_metres"}},{"name":"Three-Point Sprint-Float-Sprint","classification":"new_variant","rationale":"A prescribed float zone changes the velocity sequence.","distinguishingDimensions":{"speedProfile":"sprint_float_sprint"}}]}$packet$::JSONB);
  -- END GENERATED CANONICAL RESEARCH PACKETS

  IF (SELECT count(*) FROM family_packet_seed)<>8 THEN
    RAISE EXCEPTION '% requires all eight generated research packets',migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name='Short Acceleration Sprint',
    display_name='Short Acceleration Sprint',
    description='A maximal or near-maximal short linear acceleration through a prescribed target from an explicitly selected standing, two-point, three-point, falling, half-kneeling, or simple auditory start, followed by a planned run-out and controlled deceleration. Distance, units, cones, lead side, intent, and rest are delivery dimensions; moving-entry and longer build-up variants remain quarantined until their exact sequence is authored.',
    family_key='short_linear_acceleration',schema_version='canonical-exercise-card-v1',
    card_version=CASE WHEN already_applied_count=0
      THEN definition.card_version+1 ELSE definition.card_version END,
    status='review',content_confidence=78,scoring_confidence=68,
    media_confidence=20,
    movement_patterns=ARRAY['linear_acceleration','sprint_start'],
    body_regions=ARRAY['full_body','lower_body'],
    required_equipment=ARRAY['none'],
    optional_equipment=ARRAY[
      'cones','timing_gates','starting_blocks','knee_pad',
      'auditory_cue_device','video'],
    environment_json=$json${
      "required":["level_dry_non_slip_sprint_surface","clear_start_target_run_out_and_deceleration_zones","no_cross_traffic","adequate_lighting"],
      "space":{"sprintDistanceMetres":[5,20],"runOutMetres":[10,30],"laneWidthMetresMinimum":1.2},
      "surfaceOptions":["track","turf","court_with_adequate_grip"],
      "avoid":["wet_or_slippery_surface","blind_finish","cross_traffic","insufficient_run_out","unsecured_equipment"]
    }$json$::JSONB,
    population_json=$json${
      "readiness":["pain_free_walking_jogging_and_submaximal_acceleration","can_hold_selected_start_without_falling_or_reaching","can_decelerate_in_available_space"],
      "doNotUseWhen":["acute_lower_extremity_or_back_pain","unexplained_neurologic_symptoms","unsafe_surface_or_lane","cannot_control_selected_start_or_run_out"],
      "scaleBy":["current_sprint_exposure","tissue_tolerance","body_mass","symptoms","surface","footwear","start_geometry","speed_intent","contact_quality"],
      "experienceIsSelectionContextOnly":true,
      "notExerciseProficiency":true
    }$json$::JSONB,
    anatomy_json=$json${
      "primaryMuscles":["gluteus_maximus","hamstrings","quadriceps","soleus","gastrocnemius"],
      "secondaryMuscles":["hip_flexors","tibialis_anterior","intrinsic_foot","gluteus_medius","adductors","erector_spinae","obliques","latissimus_dorsi","deltoids"],
      "joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder","elbow"],
      "jointActions":["hip_extension_and_flexion","knee_extension_and_flexion","ankle_plantarflexion_and_dorsiflexion","contralateral_arm_swing","trunk_and_pelvic_stabilization"],
      "planes":["sagittal","frontal","transverse"],
      "laterality":"alternating_bilateral_with_declared_lead_side",
      "mechanicalIntent":"rapid_forward_centre_of_mass_acceleration_with_repeatable_projection_and_run_out"
    }$json$::JSONB,
    athlete_support_json=$json${
      "plainLanguage":"Choose the named start, accelerate hard through the target, and keep running into the clear run-out instead of stopping at the line.",
      "selfChecks":["start_position_stable","first_steps_project_forward_without_stumbling","arms_and_legs_move_oppositely","no_reaching_or_popping_upright","run_out_stays_clear"],
      "accessibility":["standing_start","taller_two_point_stance","shorter_distance","submaximal_intent","visual_marks","untimed_repetitions","extra_demonstration","longer_rest"],
      "painEscalation":"Stop immediately for sharp pain, a limp, loss of coordination, dizziness, or inability to decelerate safely and tell the coach.",
      "mediaAlternative":"Provide a concise text sequence and start/finish diagram when video is unavailable or inaccessible."
    }$json$::JSONB,
    coach_support_json=$json${
      "programmingDecision":"Use one stable short-acceleration card and select an exact start variant. Distance, units, cones, side, intent, rest, timing, and run-out belong in the delivery profile. Do not select the moving walk-in or three-point build-up until its ordered contract is approved.",
      "observationPoints":["side_view_start_and_first_three_contacts","front_or_rear_view_lane_and_step_width","finish_and_run_out_visibility","left_right_lead_comparison"],
      "demonstrationSequence":["show_exact_start_geometry","mark_target_and_run_out","demonstrate_first_three_contacts","show_run_through_and_gradual_deceleration"],
      "correctionPriorities":["safety_and_lane","stable_start","whole_body_projection","step_under_moving_centre_of_mass","relaxed_fast_arm_action","complete_run_out"],
      "groupManagement":["one_direction_only","one_athlete_per_lane_or_timed_release","coach_controls_start","athletes_clear_run_out_before_next_repetition"],
      "record":["variant","lead_side","distance","unit","intent","surface","footwear","time_when_used","quality_stop","symptoms"]
    }$json$::JSONB,
    support_operations_json=$json${
      "selectionSupport":{"requiredInputs":["variant","distance","intent","surface","run_out_space","pain_and_readiness"],"blockedVariants":["two-point-walk-in-provisional","three-point-build-up-provisional"]},
      "issueRouting":{"pain_or_limp":"stop_and_escalate","unsafe_lane":"remove_until_corrected","identity_mismatch":"quarantine_and_request_card_review","media_failure":"keep_candidate_unapproved"},
      "feedbackCapture":["completed_attempts","best_and_typical_time","quality_loss_reason","symptoms","substitution","coach_edit"],
      "changeImpact":["start_geometry","cue_mode","distance","intent","surface","run_out","difficulty","dose","media","relationship"],
      "retention":{"preserve_legacy_source_ids":true,"preserve_variant_and_profile_versions":true,"preserve_candidate_review_state":true}
    }$json$::JSONB,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'researchBatch',research_batch,
      'researchVersions',(SELECT jsonb_object_agg(packet_slug,research_version)
        FROM family_packet_seed),
      'researchCompletionMigration',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'externalEvidenceStatus','candidate_requires_independent_review',
      'mediaReviewStatus','unverified_unapproved_non_embeddable_candidates',
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
      'approvalsCreated',FALSE),
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    approved_video_url=NULL,updated_at=now()
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived';

  CREATE TEMP TABLE variant_seed(
    variant_key TEXT PRIMARY KEY,display_name TEXT NOT NULL,
    complexity SMALLINT NOT NULL,physical SMALLINT NOT NULL,
    coordination SMALLINT NOT NULL,supervision SMALLINT NOT NULL,
    consequence SMALLINT NOT NULL,impact SMALLINT NOT NULL,
    work_capacity SMALLINT NOT NULL,selectable BOOLEAN NOT NULL,
    start_contract JSONB NOT NULL,load_profile JSONB NOT NULL,
    fatigue_profile JSONB NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO variant_seed VALUES
    ('standing-static','Standing Short Acceleration',48,68,55,52,55,58,42,TRUE,
      '{"startGeometry":"standing_static_or_self_selected","supportPoints":2,"cueMode":"self_or_coach_go","leadSide":"declared_or_alternated"}',
      '{"loadingType":"maximal_bodyweight_linear_acceleration","gripDemand":1,"spinalLoading":45,"eccentricStress":72,"landingContactsPerRep":12,"externalLoadMethod":"none","primaryStress":["horizontal_force_expression","posterior_chain","plantar_flexors","hamstrings","whole_body_coordination"]}',
      '{"localMuscleFatigue":75,"gripFatigue":1,"technicalFatigueSensitivity":88,"impactAccumulation":70,"recoveryHours":48}'),
    ('two-point-static','Two-Point Static Start',48,70,54,50,52,56,40,TRUE,
      '{"startGeometry":"static_staggered_two_point","supportPoints":2,"cueMode":"self_or_coach_go","leadSide":"declared_or_alternated"}',
      '{"loadingType":"maximal_bodyweight_two_point_acceleration","gripDemand":1,"spinalLoading":45,"eccentricStress":72,"landingContactsPerRep":12,"externalLoadMethod":"none","primaryStress":["front_and_rear_leg_projection","posterior_chain","plantar_flexors","hamstrings","whole_body_coordination"]}',
      '{"localMuscleFatigue":75,"gripFatigue":1,"technicalFatigueSensitivity":88,"impactAccumulation":70,"recoveryHours":48}'),
    ('three-point-static','Three-Point Static Start',58,72,60,58,58,58,42,TRUE,
      '{"startGeometry":"static_staggered_three_point_one_hand_grounded","supportPoints":3,"cueMode":"self_or_coach_go","leadSide":"declared_or_alternated"}',
      '{"loadingType":"maximal_bodyweight_three_point_acceleration","gripDemand":10,"spinalLoading":48,"eccentricStress":74,"landingContactsPerRep":12,"externalLoadMethod":"none","primaryStress":["grounded_hand_clearance","front_and_rear_leg_projection","posterior_chain","plantar_flexors","hamstrings"]}',
      '{"localMuscleFatigue":76,"gripFatigue":8,"technicalFatigueSensitivity":90,"impactAccumulation":72,"recoveryHours":48}'),
    ('falling-start','Falling Start',52,70,58,54,58,56,40,TRUE,
      '{"startGeometry":"standing_controlled_whole_body_fall","supportPoints":2,"cueMode":"loss_of_balance_threshold_then_recovery_step","leadSide":"declared_or_alternated"}',
      '{"loadingType":"maximal_bodyweight_falling_start_acceleration","gripDemand":1,"spinalLoading":45,"eccentricStress":72,"landingContactsPerRep":12,"externalLoadMethod":"none","primaryStress":["fall_recovery_timing","posterior_chain","plantar_flexors","hamstrings","balance_to_acceleration_transition"]}',
      '{"localMuscleFatigue":75,"gripFatigue":1,"technicalFatigueSensitivity":90,"impactAccumulation":70,"recoveryHours":48}'),
    ('half-kneeling-start','Half-Kneeling Start',58,68,62,58,60,56,44,TRUE,
      '{"startGeometry":"stable_half_kneeling_front_foot_and_opposite_knee_grounded","supportPoints":2,"cueMode":"self_or_coach_go","leadSide":"both_sides_dosed"}',
      '{"loadingType":"maximal_bodyweight_floor_to_sprint_acceleration","gripDemand":1,"spinalLoading":45,"eccentricStress":70,"landingContactsPerRep":12,"externalLoadMethod":"none","primaryStress":["floor_to_front_foot_transition","single_side_projection","posterior_chain","plantar_flexors","hamstrings"]}',
      '{"localMuscleFatigue":72,"gripFatigue":1,"technicalFatigueSensitivity":90,"impactAccumulation":68,"recoveryHours":48}'),
    ('two-point-auditory-start','Two-Point Auditory Start',55,70,64,60,60,56,42,TRUE,
      '{"startGeometry":"static_staggered_two_point","supportPoints":2,"cueMode":"one_unpredictable_standardized_auditory_go_signal","leadSide":"declared_or_alternated"}',
      '{"loadingType":"maximal_bodyweight_reactive_two_point_acceleration","gripDemand":1,"spinalLoading":45,"eccentricStress":72,"landingContactsPerRep":12,"externalLoadMethod":"none","primaryStress":["auditory_response_and_movement_initiation","posterior_chain","plantar_flexors","hamstrings","whole_body_coordination"]}',
      '{"localMuscleFatigue":75,"gripFatigue":1,"technicalFatigueSensitivity":92,"impactAccumulation":70,"recoveryHours":48}'),
    ('two-point-walk-in-provisional','Two-Point Walk-In (Identity Review)',46,55,52,44,42,38,28,FALSE,
      '{"startGeometry":"moving_entry_unresolved","supportPoints":2,"cueMode":"entry_sequence_unresolved","identityBlocker":"exact walking entry, settle step, acceleration trigger, distance, finish, and run-out require human authorship"}',
      '{"loadingType":"provisional_submaximal_moving_entry_acceleration","gripDemand":1,"spinalLoading":35,"eccentricStress":45,"landingContactsPerRep":8,"externalLoadMethod":"none","primaryStress":["moving_entry_coordination","projection_transition"]}',
      '{"localMuscleFatigue":45,"gripFatigue":1,"technicalFatigueSensitivity":85,"impactAccumulation":45,"recoveryHours":24}'),
    ('three-point-build-up-provisional','Three-Point Build-Up (Identity Review)',56,72,60,55,56,64,58,FALSE,
      '{"startGeometry":"three_point_progressive_build_unresolved","supportPoints":3,"cueMode":"unresolved","identityBlocker":"exact three-point setup, progressive rise, distance, speed intent, terminal action, and runway relationship require human authorship"}',
      '{"loadingType":"provisional_three_point_longer_acceleration_build","gripDemand":10,"spinalLoading":50,"eccentricStress":78,"landingContactsPerRep":18,"externalLoadMethod":"none","primaryStress":["three_point_clearance","progressive_acceleration","high_speed_exposure"]}',
      '{"localMuscleFatigue":82,"gripFatigue":8,"technicalFatigueSensitivity":92,"impactAccumulation":80,"recoveryHours":48}');

  UPDATE coaching.exercise_variant_v1 variant
  SET display_name=seed.display_name,modifier_keys=ARRAY[seed.variant_key],
    difficulty_json=jsonb_build_object(
      'technicalComplexity',seed.complexity,
      'absoluteLoadDemand',seed.physical,
      'coordinationDemand',seed.coordination,
      'supervisionDemand',seed.supervision,
      'failureConsequence',seed.consequence,'impact',seed.impact,
      'workCapacityDemand',seed.work_capacity,
      'baseOverallDifficulty',greatest(seed.complexity,seed.physical),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'audienceExperienceExcluded',TRUE),
    requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||seed.start_contract||jsonb_build_object(
        'selectable',seed.selectable,'humanReviewRequired',TRUE,
        'requiredEnvironment',jsonb_build_array(
          'clear_sprint_lane','target_zone','run_out_and_deceleration_zone'),
        'doNotUseWhen',jsonb_build_array(
          'pain','limp','unsafe_surface_or_lane','cannot_control_start_or_run_out'),
        'migration',migration_key),
    programming_profile_json=jsonb_build_object(
      'selectionRole',CASE WHEN seed.selectable THEN 'primary_or_variant'
        ELSE 'blocked_identity_review' END,
      'primaryPhase','output','physicalDifficulty',seed.physical,
      'exerciseComplexity',seed.complexity,
      'overallDifficulty',greatest(seed.complexity,seed.physical),
      'fatigueBudgetCost',CASE WHEN seed.selectable THEN 68 ELSE 100 END,
      'impactBudgetCost',seed.impact,
      'highSpeedExposure',seed.variant_key<>'two-point-walk-in-provisional',
      'requiresFullRecovery',TRUE,'selectable',seed.selectable,
      'humanReviewRequired',TRUE),
    load_profile_json=seed.load_profile,
    fatigue_profile_json=seed.fatigue_profile,status='review',updated_at=now()
  FROM variant_seed seed
  WHERE variant.definition_id=(
      SELECT id FROM coaching.exercise_definition_v1 WHERE slug=active_slug)
    AND variant.variant_key=seed.variant_key AND variant.status<>'archived';

  CREATE TEMP TABLE profile_seed(
    variant_key TEXT PRIMARY KEY,profile_key TEXT NOT NULL,role TEXT NOT NULL,
    suitability SMALLINT NOT NULL,purpose TEXT NOT NULL,dosage JSONB NOT NULL,
    quality_gate TEXT NOT NULL,coach_instruction TEXT NOT NULL,
    athlete_instruction TEXT NOT NULL,adaptation TEXT NOT NULL,
    equipment TEXT[] NOT NULL,logistics JSONB NOT NULL,time_model JSONB NOT NULL,
    dose_scaling JSONB NOT NULL,measurement JSONB NOT NULL,
    support_prompts JSONB NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO profile_seed VALUES
    ('standing-static','output-standing-static','primary',86,
      'Express maximal or near-maximal short linear acceleration from a stable standing start with full recovery and a planned run-out.',
      '{"sets":1,"repetitions":4,"repetitionRange":[3,6],"distanceMetres":[5,20],"intentPercent":[85,100],"restSeconds":[120,240],"runOutMetres":[10,30]}',
      'Start stable, project forward without reaching, maintain coordinated contacts through the target, and complete the clear run-out without abrupt braking.',
      'Declare the start, target, run-out, intent, and rest. Observe the first three contacts and stop before projection, timing, or relaxation deteriorates.',
      'Start still, accelerate hard through the marker, and keep running into the clear run-out.',
      'Improved short-acceleration force expression, first-step organization, and repeatable run-through quality.',ARRAY['none'],
      '{"oneAthletePerLane":true,"releaseOnlyAfterRunOutClears":true,"coachControlsDirection":true,"conesOptional":true}',
      '{"setupSeconds":60,"workSecondsPerAttempt":8,"transitionSeconds":20,"restSecondsPerAttempt":150,"estimateConfidence":"candidate"}',
      '{"dimensions":["distance","intent","attempts","rest","lead_side"],"progressOneDimensionAtATime":true}',
      '{"primary":"best_and_typical_split_or_clean_attempt","secondary":["first_three_contacts","projection","run_out","symptoms"]}',
      '{"before":"Confirm lane, target, run-out, start variant, readiness, and intent.","during":"Stop on pain, limp, stumble, reaching, early rise, lane loss, or meaningful time and quality drop.","after":"Record variant, side, distance, intent, time when used, clean attempts, and symptoms."}'),
    ('two-point-static','output-two-point-static','primary',90,
      'Express short acceleration from an exact static staggered two-point stance while preserving lead-side and run-out data.',
      '{"sets":1,"repetitions":4,"repetitionRange":[3,6],"distanceMetres":[5,20],"intentPercent":[85,100],"restSeconds":[120,240],"runOutMetres":[10,30],"leadSides":"alternate_or_declared"}',
      'Both feet remain set until go; the whole body projects, the first contacts occur without a false step or stumble, and the athlete runs through the target.',
      'Fix the two-point geometry, compare both leads when appropriate, and retain full recovery. Do not turn distance or a cone into another exercise identity.',
      'Set a staggered stance, stay still until go, push through both legs, and sprint through the target.',
      'Repeatable static two-point initiation, projection, and early acceleration.',ARRAY['none'],
      '{"oneAthletePerLane":true,"releaseOnlyAfterRunOutClears":true,"leadSideRecorded":true,"conesOptional":true}',
      '{"setupSeconds":60,"workSecondsPerAttempt":8,"transitionSeconds":20,"restSecondsPerAttempt":150,"estimateConfidence":"candidate"}',
      '{"dimensions":["distance","intent","attempts","rest","lead_side"],"progressOneDimensionAtATime":true}',
      '{"primary":"best_and_typical_split_or_clean_attempt","secondary":["start_stillness","first_three_contacts","projection","symptoms"]}',
      '{"before":"Confirm exact two-point stance, lane, target, run-out, side, and intent.","during":"Stop on pain, limp, false step, stumble, reaching, lane loss, or projection and time drop.","after":"Record side, distance, intent, clean attempts, time when used, and symptoms."}'),
    ('three-point-static','output-three-point-static','primary',86,
      'Express short acceleration from a static staggered three-point stance with one declared hand grounded.',
      '{"sets":1,"repetitions":4,"repetitionRange":[3,6],"distanceMetres":[5,20],"intentPercent":[85,100],"restSeconds":[150,300],"runOutMetres":[10,30],"leadSides":"alternate_or_declared"}',
      'The stance is stable, the grounded hand clears safely, both legs contribute, the first contacts remain coordinated, and the athlete runs through the target.',
      'Declare grounded hand and lead leg, ensure wrist and shoulder tolerance, and provide longer rest for maximal-quality efforts.',
      'Set the named hand and feet, stay still until go, clear the hand, and accelerate through the target.',
      'Repeatable ground-supported start clearance and early horizontal acceleration.',ARRAY['none'],
      '{"oneAthletePerLane":true,"releaseOnlyAfterRunOutClears":true,"groundedHandAndLeadRecorded":true,"conesOptional":true}',
      '{"setupSeconds":75,"workSecondsPerAttempt":8,"transitionSeconds":25,"restSecondsPerAttempt":180,"estimateConfidence":"candidate"}',
      '{"dimensions":["distance","intent","attempts","rest","grounded_hand","lead_side"],"progressOneDimensionAtATime":true}',
      '{"primary":"best_and_typical_split_or_clean_attempt","secondary":["hand_clearance","first_three_contacts","projection","symptoms"]}',
      '{"before":"Confirm wrist and shoulder tolerance, grounded hand, lead side, lane, target, and run-out.","during":"Stop on pain, collapse, hand-clearance fault, stumble, lane loss, or meaningful quality drop.","after":"Record hand, side, distance, intent, time when used, clean attempts, and symptoms."}'),
    ('falling-start','output-falling-start','primary',84,
      'Use a controlled whole-body forward fall to trigger the first recovery step and short acceleration without reaching or stumbling.',
      '{"sets":1,"repetitions":4,"repetitionRange":[3,6],"distanceMetres":[5,15],"intentPercent":[80,100],"restSeconds":[120,240],"runOutMetres":[10,25],"leadSides":"alternate_or_declared"}',
      'The athlete falls as one line, waits for loss of balance, recovers under the moving body, and accelerates through the target without a waist hinge or reach.',
      'Regress to a static two-point start when the athlete hinges, reaches, anticipates, or stumbles. Keep the fall small enough to preserve control.',
      'Lean forward as one line, let balance trigger the step, then accelerate through the target.',
      'Improved transition from controlled forward displacement to coordinated early acceleration.',ARRAY['none'],
      '{"oneAthletePerLane":true,"releaseOnlyAfterRunOutClears":true,"leadSideRecorded":true,"conesOptional":true}',
      '{"setupSeconds":60,"workSecondsPerAttempt":8,"transitionSeconds":20,"restSecondsPerAttempt":150,"estimateConfidence":"candidate"}',
      '{"dimensions":["fall_angle","distance","intent","attempts","rest","lead_side"],"progressOneDimensionAtATime":true}',
      '{"primary":"clean_fall_to_first_step_and_split_when_used","secondary":["whole_body_line","no_reach","first_three_contacts","symptoms"]}',
      '{"before":"Confirm controlled fall rehearsal, lane, target, run-out, side, and intent.","during":"Stop on pain, waist hinge, reaching, stumble, premature step, or quality drop.","after":"Record fall quality, side, distance, intent, clean attempts, and symptoms."}'),
    ('half-kneeling-start','output-half-kneeling-start','primary',82,
      'Train a declared half-kneeling floor-to-sprint transition on both lead sides with adequate knee comfort and run-out space.',
      '{"sets":1,"repetitionsPerSide":3,"repetitionRangePerSide":[2,4],"distanceMetres":[5,15],"intentPercent":[75,95],"restSeconds":[120,240],"runOutMetres":[10,25]}',
      'The base is stable, the front foot initiates projection, the rear knee does not push painfully into the floor, and both sides finish with controlled run-out.',
      'Use knee padding when needed, declare foot and knee positions, dose both sides, and regress if the athlete pushes from the rear knee or loses balance.',
      'Set the front foot and opposite knee, drive through the front foot, rise into the sprint, and run through the target.',
      'Improved asymmetric floor-to-sprint transition and first-step projection on both sides.',ARRAY['none'],
      '{"oneAthletePerLane":true,"releaseOnlyAfterRunOutClears":true,"bothSidesDosed":true,"kneePadOptional":true}',
      '{"setupSeconds":75,"workSecondsPerAttempt":9,"transitionSeconds":25,"restSecondsPerAttempt":150,"estimateConfidence":"candidate"}',
      '{"dimensions":["distance","intent","attempts_per_side","rest","knee_padding"],"progressOneDimensionAtATime":true}',
      '{"primary":"clean_floor_to_sprint_attempts_per_side","secondary":["front_foot_contribution","balance","first_three_contacts","symptoms"]}',
      '{"before":"Confirm knee comfort, exact foot and knee setup, lane, target, run-out, and side order.","during":"Stop on knee pain, balance loss, rear-knee push, stumble, or quality drop.","after":"Record both sides, padding, distance, intent, clean attempts, and symptoms."}'),
    ('two-point-auditory-start','output-two-point-auditory-start','primary',82,
      'Add one unpredictable standardized auditory go-signal to a stable two-point short-acceleration start without changing the sprint contract.',
      '{"sets":1,"repetitions":4,"repetitionRange":[3,6],"distanceMetres":[5,15],"intentPercent":[80,100],"restSeconds":[120,240],"runOutMetres":[10,25],"cue":"one_standardized_unpredictable_auditory_go"}',
      'The athlete remains still before the signal, responds only to the declared cue, preserves the two-point start, and accelerates through the target without guessing.',
      'Standardize signal type and loudness, avoid startling or unsafe volume, vary delay, record anticipations, and separate reaction quality from sprint time.',
      'Hold the two-point stance, wait for the named sound, then accelerate through the target without guessing.',
      'Improved simple auditory response integrated with a repeatable two-point short acceleration.',ARRAY['none'],
      '{"oneAthletePerLane":true,"releaseOnlyAfterRunOutClears":true,"coachControlsSignal":true,"safeSignalVolume":true}',
      '{"setupSeconds":75,"workSecondsPerAttempt":8,"transitionSeconds":25,"restSecondsPerAttempt":150,"estimateConfidence":"candidate"}',
      '{"dimensions":["cue_delay","distance","intent","attempts","rest","lead_side"],"progressOneDimensionAtATime":true}',
      '{"primary":"valid_nonanticipated_responses_and_split_when_used","secondary":["start_stillness","reaction_error","first_three_contacts","symptoms"]}',
      '{"before":"Confirm exact cue, safe volume, two-point stance, lane, target, and run-out.","during":"Stop on pain, repeated anticipation, nonresponse, stumble, lane loss, or quality drop.","after":"Record valid trials, anticipations, cue, side, distance, time when used, and symptoms."}'),
    ('two-point-walk-in-provisional','output-two-point-walk-in-provisional','avoid',1,
      'Identity quarantine for an unresolved moving-entry two-point acceleration sequence.',
      '{"prescriptionBlocked":true,"requiredAuthorship":["walking_entry","settle_step","acceleration_trigger","distance","finish","run_out"]}',
      'Do not prescribe until the exact moving-entry contract is authored and independently approved.',
      'Use a selectable standing or static two-point start instead. Preserve this source only for identity review.',
      'This version is not ready to perform; use the coach-selected static start.',
      'No adaptation claim while identity is unresolved.',ARRAY['none'],
      '{"prescriptionBlocked":true,"identityReviewRequired":true}',
      '{"setupSeconds":0,"workSecondsPerAttempt":0,"transitionSeconds":0,"restSecondsPerAttempt":0,"estimateConfidence":"blocked"}',
      '{"dimensions":[],"progressOneDimensionAtATime":true,"prescriptionBlocked":true}',
      '{"primary":"identity_authorship_status","secondary":["source_traceability"]}',
      '{"before":"Block selection and show the unresolved ordered-contract requirements.","during":"No athlete delivery is authorized.","after":"Route exact sequence evidence to card review."}'),
    ('three-point-build-up-provisional','output-three-point-build-up-provisional','avoid',1,
      'Identity quarantine for an unresolved longer three-point acceleration build-up or runway-related task.',
      '{"prescriptionBlocked":true,"requiredAuthorship":["three_point_setup","progressive_rise","distance","speed_intent","terminal_action","runway_relationship"]}',
      'Do not prescribe until the exact build-up and terminal contract are authored and independently approved.',
      'Use the selectable static three-point short acceleration instead. Preserve this source only for identity review.',
      'This version is not ready to perform; use the coach-selected static three-point start.',
      'No adaptation claim while identity is unresolved.',ARRAY['none'],
      '{"prescriptionBlocked":true,"identityReviewRequired":true}',
      '{"setupSeconds":0,"workSecondsPerAttempt":0,"transitionSeconds":0,"restSecondsPerAttempt":0,"estimateConfidence":"blocked"}',
      '{"dimensions":[],"progressOneDimensionAtATime":true,"prescriptionBlocked":true}',
      '{"primary":"identity_authorship_status","secondary":["source_traceability"]}',
      '{"before":"Block selection and show the unresolved ordered-contract requirements.","during":"No athlete delivery is authorized.","after":"Route exact sequence evidence to card review."}');

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET profile_key=seed.profile_key,phase_key='output',role=seed.role,
    purpose=seed.purpose,phase_suitability=seed.suitability,
    methodology_alignment=CASE WHEN seed.role='avoid' THEN 1 ELSE 88 END,
    objective_relevance_json=jsonb_build_object(
      'shortAcceleration',CASE WHEN seed.role='avoid' THEN 0 ELSE 96 END,
      'firstStepProjection',CASE WHEN seed.role='avoid' THEN 0 ELSE 90 END,
      'identityResolved',seed.role<>'avoid','humanReviewRequired',TRUE),
    dosage_json=seed.dosage,quality_gate=seed.quality_gate,
    stop_rules=ARRAY[
      'pain_or_limp','unsafe_surface_lane_or_run_out','stumble_or_fall',
      'loss_of_declared_start_contract','lane_or_target_confusion',
      'meaningful_projection_timing_or_relaxation_drop',
      'athlete_cannot_decelerate_safely'],
    coach_instructions=seed.coach_instruction,
    athlete_instructions=seed.athlete_instruction,
    expected_adaptation=seed.adaptation,equipment_required=seed.equipment,
    logistics_json=seed.logistics,substitution_ids='{}'::UUID[],status='review',
    time_model_json=seed.time_model,dose_scaling_json=seed.dose_scaling,
    measurement_json=seed.measurement,support_prompts_json=seed.support_prompts,
    updated_at=now()
  FROM profile_seed seed
  JOIN coaching.exercise_variant_v1 variant ON variant.variant_key=seed.variant_key
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id AND definition.slug=active_slug
  WHERE profile.variant_id=variant.id AND profile.status<>'archived';

  WITH raw_claims AS(
    SELECT evidence.item->>'sectionKey' section_key,
      evidence.item->>'sourceUrl' source_url,
      evidence.item->>'sourceTitle' source_title,
      evidence.item->>'sourcePublisher' source_publisher,
      evidence.item->>'sourceKind' source_kind,
      (evidence.item->>'evidenceQuality')::SMALLINT evidence_quality,
      claim.value claim
    FROM family_packet_seed packet
    CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'evidence') evidence(item)
    CROSS JOIN LATERAL jsonb_array_elements_text(evidence.item->'claims') claim(value)
    UNION ALL
    SELECT evidence.item->>'sectionKey',evidence.item->>'sourceUrl',
      evidence.item->>'sourceTitle',evidence.item->>'sourcePublisher',
      evidence.item->>'sourceKind',
      (evidence.item->>'evidenceQuality')::SMALLINT,
      'Packet applicability: '||packet.packet_slug
    FROM family_packet_seed packet
    CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'evidence') evidence(item)
  ), grouped_evidence AS(
    SELECT section_key,source_url,min(source_title) source_title,
      min(source_publisher) source_publisher,min(source_kind) source_kind,
      max(evidence_quality) evidence_quality,
      jsonb_agg(DISTINCT claim ORDER BY claim) claims_json
    FROM raw_claims GROUP BY section_key,source_url
  )
  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,evidence.section_key,
    evidence.source_url,evidence.source_title,evidence.source_publisher,
    evidence.source_kind,evidence.claims_json,evidence.evidence_quality,
    'candidate',NULL,NULL
  FROM grouped_evidence evidence
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  SELECT definition.id,NULL,definition.card_version,media.item->>'url',
    'https://www.youtube-nocookie.com/embed/'
      ||substring(media.item->>'url' FROM 'v=([^&]+)'),
    substring(media.item->>'url' FROM 'v=([^&]+)'),media.item->>'title',
    media.item->>'channelName',NULL,'en',NULL,FALSE,NULL,NULL,
    'unverified','candidate','manual_research',media.item->>'sourceQuery',
    NULL,NULL,NULL,media.item->>'notes'
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'mediaCandidates') media(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
  WHERE packet.packet_slug='10-yard-sprint'
  ON CONFLICT(definition_id,reviewed_card_version,video_id)
  DO UPDATE SET variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    duration_seconds=NULL,language_code='en',captions_available=NULL,
    embedding_allowed=FALSE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='unverified',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=NULL,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,
    reviewed_at)
  SELECT definition.id,definition.card_version,
    alternate.item->>'name'||' ['||packet.packet_slug||']',
    alternate.item->>'classification',alternate.item->>'rationale',
    coalesce(alternate.item->'distinguishingDimensions','{}'::JSONB)
      ||jsonb_build_object('assessmentPacket',packet.packet_slug),
    NULL,'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'alternateAssessments') alternate(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name)
  DO UPDATE SET classification=EXCLUDED.classification,
    rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  CREATE TEMP TABLE relationship_seed(
    from_key TEXT NOT NULL,to_key TEXT NOT NULL,relationship TEXT NOT NULL,
    similarity SMALLINT NOT NULL,dimensions TEXT[] NOT NULL,
    reason TEXT NOT NULL,conditions JSONB NOT NULL,
    PRIMARY KEY(from_key,to_key,relationship)
  ) ON COMMIT DROP;
  INSERT INTO relationship_seed VALUES
    ('standing-static','two-point-static','progression',82,
      ARRAY['start_geometry','projection','lead_side'],
      'A fixed staggered two-point stance adds a repeatable lead-side and projection constraint to the same short acceleration.',
      '{"requires":["stable_standing_start","pain_free_acceleration"],"authoredDirection":true,"humanReviewRequired":true}'),
    ('two-point-static','three-point-static','progression',78,
      ARRAY['support_points','hand_clearance','start_geometry','coordination'],
      'Grounding one hand adds setup, upper-limb support, clearance, and start-geometry demands.',
      '{"requires":["repeatable_two_point_start","wrist_and_shoulder_tolerance"],"authoredDirection":true,"humanReviewRequired":true}'),
    ('two-point-static','falling-start','progression',72,
      ARRAY['balance_trigger','recovery_step','timing','failure_consequence'],
      'The falling start replaces a fixed go position with a balance-triggered recovery step and higher timing consequence.',
      '{"requires":["repeatable_two_point_projection","controlled_whole_body_fall"],"authoredDirection":true,"humanReviewRequired":true}'),
    ('two-point-static','half-kneeling-start','progression',68,
      ARRAY['floor_transition','asymmetry','balance','knee_tolerance'],
      'Half-kneeling adds a floor-to-sprint transition, asymmetric support, bilateral side dosing, and knee-comfort requirements.',
      '{"requires":["repeatable_two_point_start","pain_free_half_kneeling"],"authoredDirection":true,"humanReviewRequired":true}'),
    ('two-point-static','two-point-auditory-start','progression',80,
      ARRAY['cue_mode','reaction','anticipation_control'],
      'The unpredictable auditory go-signal adds response selection and anticipation control while retaining the two-point sprint contract.',
      '{"requires":["repeatable_two_point_start","understands_standardized_cue"],"authoredDirection":true,"humanReviewRequired":true}'),
    ('two-point-static','two-point-walk-in-provisional','lateral_substitution',35,
      ARRAY['entry_sequence','identity_review'],
      'The moving-entry source is retained only as a blocked adjacent candidate; it is not an authorized substitution until its ordered sequence is authored.',
      '{"selectionBlocked":true,"authoredDirection":true,"humanReviewRequired":true}'),
    ('three-point-static','three-point-build-up-provisional','lateral_substitution',35,
      ARRAY['distance','speed_progression','terminal_action','identity_review'],
      'The longer build-up source is retained only as a blocked adjacent candidate; it is not an authorized substitution until distance, rise, and terminal action are authored.',
      '{"selectionBlocked":true,"authoredDirection":true,"humanReviewRequired":true}');

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT from_variant.id,to_variant.id,seed.relationship,seed.similarity,
    seed.dimensions,seed.reason,seed.conditions,'review',NULL,NULL,NULL
  FROM relationship_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id=definition.id
      AND from_variant.variant_key=seed.from_key
      AND from_variant.status<>'archived'
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id=definition.id
      AND to_variant.variant_key=seed.to_key
      AND to_variant.status<>'archived'
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,
    conditions_json=EXCLUDED.conditions_json,review_status='review',created_by=NULL,
    reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT relationship.to_variant_id,relationship.from_variant_id,
    CASE relationship.relationship WHEN 'progression' THEN 'regression'
      ELSE relationship.relationship END,
    relationship.similarity_score,relationship.dimensions,
    'Inverse review candidate of the authored '||relationship.relationship||': '
      ||relationship.reason,
    (coalesce(relationship.conditions_json,'{}'::JSONB)-'authoredDirection')
      ||jsonb_build_object('inverseOfRelationship',relationship.relationship,
        'humanReviewRequired',TRUE),
    'review',NULL,NULL,NULL
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.id=relationship.from_variant_id
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=from_variant.definition_id
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND relationship.relationship IN('progression','lateral_substitution')
    AND relationship.review_status='review'
    AND coalesce(relationship.conditions_json,'{}'::JSONB)
      ->>'authoredDirection'='true'
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,
    conditions_json=EXCLUDED.conditions_json,review_status='review',created_by=NULL,
    reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.dimension,
    CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END,
    CASE WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=30 THEN 20
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=50 THEN 40
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=70 THEN 60
      ELSE 80 END,
    CASE dimension.dimension WHEN 'technicalComplexity' THEN
      'Candidate exercise-complexity anchor reflects start geometry, support points, lead side, balance trigger, cue response, ordered clearance, first contacts, supervision, and run-out; independent comparison is pending.'
      ELSE 'Candidate physical-difficulty anchor reflects maximal bodyweight acceleration, force and speed intent, sprint and run-out contacts, impact, surface, posterior-chain and plantar-flexor exposure, and recovery; independent comparison is pending.' END,
    'review',1,NULL,NULL,
    'Candidate migration-420 anchor; independent human review required.',NULL
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  CROSS JOIN(VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(dimension)
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived' AND variant.status<>'archived'
  ON CONFLICT(facility_id,variant_id,dimension,version)
  DO UPDATE SET proposed_score=EXCLUDED.proposed_score,
    anchor_tier=EXCLUDED.anchor_tier,rationale=EXCLUDED.rationale,
    status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_score_calibration_v1.status='review';

  CREATE TEMP TABLE source_score_seed(
    exercise_id BIGINT PRIMARY KEY,variant_key TEXT NOT NULL,notes TEXT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO source_score_seed VALUES
    (6,'standing-static','Standing short-acceleration source.'),
    (1333,'standing-static','Ten-yard sprint-start alias source.'),
    (118,'two-point-static','Five-to-ten-yard two-point source; distance is dosage.'),
    (326,'two-point-static','Ten-to-twenty-metre two-point source; distance is dosage.'),
    (707,'two-point-static','Two-point acceleration source.'),
    (1592,'two-point-static','Split-stance ten-yard alias source; cones are logistics.'),
    (119,'three-point-static','Three-point acceleration alias source.'),
    (327,'three-point-static','Three-point five-to-twenty-metre source.'),
    (1122,'three-point-build-up-provisional','Unresolved longer three-point build-up source; selection blocked.'),
    (117,'falling-start','Five-to-ten-yard falling-start source.'),
    (325,'falling-start','Falling Start 10m source.'),
    (706,'falling-start','Falling Start Sprint alias source.'),
    (957,'falling-start','Ten-yard falling-start source.'),
    (1121,'falling-start','Ten-metre falling-start source.'),
    (1591,'falling-start','Cone-marked falling-start source; cone is logistics.'),
    (120,'half-kneeling-start','Half-kneeling start source.'),
    (708,'half-kneeling-start','Half-kneeling sprint-start alias source.'),
    (744,'two-point-auditory-start','Auditory start source.'),
    (937,'two-point-auditory-start','Split-stance auditory alias source.'),
    (99,'two-point-walk-in-provisional','Unresolved moving-entry source; selection blocked.');

  INSERT INTO coaching.exercise_score_v1(
    exercise_id,legacy_scores,migration_confidence,human_review_status,
    review_notes)
  SELECT seed.exercise_id,jsonb_build_object(
      'migration',migration_key,'researchBatch',research_batch,
      'sourceScoreCreatedForCanonicalBackfill',TRUE,
      'candidateOnly',TRUE,'humanReviewRequired',TRUE),
    68,'queued',seed.notes||' Canonical score row backfilled; calibration review required.'
  FROM source_score_seed seed
  ON CONFLICT(exercise_id) DO NOTHING;

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity=(variant.difficulty_json->>'technicalComplexity')::SMALLINT,
    absolute_load_demand=(variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT,
    coordination_demand=(variant.difficulty_json->>'coordinationDemand')::SMALLINT,
    impact=(variant.difficulty_json->>'impact')::SMALLINT,
    supervision_demand=(variant.difficulty_json->>'supervisionDemand')::SMALLINT,
    base_overall_difficulty=greatest(
      (variant.difficulty_json->>'technicalComplexity')::SMALLINT,
      (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT),
    legacy_scores=coalesce(score.legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchBatch',research_batch,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'candidateOnly',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=68,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,review_notes=seed.notes||' Calibration review required.',
    updated_at=now()
  FROM source_score_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug=active_slug AND definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id AND variant.variant_key=seed.variant_key
      AND variant.status<>'archived'
  WHERE score.exercise_id=seed.exercise_id
    AND score.human_review_status='queued'
    AND score.reviewed_by IS NULL AND score.reviewed_at IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,definition.facility_id,definition.card_version,
    definition.schema_version,migration_key,'quarantined',jsonb_build_object(
      'stableIdentityAndAliases',TRUE,
      'allTwentyLegacySourcesAuditedAndTraceable',TRUE,
      'sixSelectableAndTwoBlockedVariantsPresent',TRUE,
      'distanceUnitConesSideIntentAndRestAreDeliveryDimensions',TRUE,
      'taxonomyAnatomyPlanesLateralityPresent',TRUE,
      'complexityAndPhysicalDifficultyPresent',TRUE,
      'overallDifficultyDerivedAsMaximum',TRUE,
      'exerciseSkillClassificationAbsent',TRUE,
      'loadFatigueImpactRecoveryPresent',TRUE,
      'equipmentEnvironmentPopulationPresent',TRUE,
      'deliveryDosageInstructionsAndStopRulesPresent',TRUE,
      'durationMeasurementAndDoseScalingPresent',TRUE,
      'athleteCoachAndOperationsSupportPresent',TRUE,
      'candidateEvidenceSectionsPresent',TRUE,
      'threeToFiveMediaCandidatesPresent',TRUE,
      'alternateAssessmentsPresent',TRUE,
      'progressionRegressionAndSubstitutionProposalsPresent',TRUE,
      'complexityAndPhysicalCalibrationProposalsPresent',TRUE,
      'approvalsCreated',FALSE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-IDENTITY-06','message','Moving walk-in and three-point build-up variants remain nonselectable until their exact ordered contracts are authored and approved.'),
      jsonb_build_object('code','CARD-EVIDENCE-02','message','Candidate evidence and authored section claims require independent review.'),
      jsonb_build_object('code','CARD-MEDIA-01','message','Four media candidates require playback, continuing availability, embedding, exact-match, complete-content, safety, caption, accessibility, and reviewer approval.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','Progression, regression, and substitution relationships remain review-only.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Complexity and physical-difficulty anchors remain review-only.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Two-person card review, version approval, media approval, and pilot evidence are incomplete.')),
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived'
  ON CONFLICT(definition_id)
  DO UPDATE SET facility_id=EXCLUDED.facility_id,
    card_version=EXCLUDED.card_version,schema_version=EXCLUDED.schema_version,
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_section_evidence_v1 evidence
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=evidence.definition_id
  WHERE definition.slug=active_slug
    AND evidence.reviewed_card_version=definition.card_version
    AND evidence.review_status='candidate';
  IF actual_count<16 OR (SELECT count(DISTINCT evidence.section_key)
      FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=evidence.definition_id
      WHERE definition.slug=active_slug
        AND evidence.reviewed_card_version=definition.card_version
        AND evidence.review_status='candidate')<>16 THEN
    RAISE EXCEPTION '% requires candidate evidence for all 16 controlled sections; found % rows',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_media_candidate_v1 media
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=media.definition_id
  WHERE definition.slug=active_slug
    AND media.reviewed_card_version=definition.card_version
    AND media.review_status='candidate' AND media.link_status='unverified'
    AND media.embedding_allowed=FALSE AND media.exact_variant_match IS NULL
    AND media.demonstration_quality_score IS NULL
    AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL;
  IF actual_count<3 OR actual_count>5 THEN
    RAISE EXCEPTION '% requires three to five quarantined media candidates; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_alternate_assessment_v1 alternate
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=alternate.definition_id
  WHERE definition.slug=active_slug
    AND alternate.reviewed_card_version=definition.card_version
    AND alternate.review_status='candidate';
  IF actual_count<30 THEN
    RAISE EXCEPTION '% expected at least 30 candidate alternate assessments; found %',
      migration_key,actual_count;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND definition.status<>'archived'
        AND variant.status<>'archived' AND profile.status<>'archived')<>8 THEN
    RAISE EXCEPTION '% expected one active delivery profile per exact variant',
      migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 from_variant
        ON from_variant.id=relationship.from_variant_id
      JOIN coaching.exercise_variant_v1 to_variant
        ON to_variant.id=relationship.to_variant_id
      WHERE from_variant.definition_id=(
          SELECT id FROM coaching.exercise_definition_v1 WHERE slug=active_slug)
        AND to_variant.definition_id=from_variant.definition_id
        AND relationship.review_status='review'
        AND relationship.reviewed_by IS NULL
        AND relationship.reviewed_at IS NULL)<>14 THEN
    RAISE EXCEPTION '% expected seven authored and seven inverse graph proposals',
      migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND variant.status<>'archived'
        AND calibration.status='review'
        AND calibration.dimension IN('technicalComplexity','absoluteLoadDemand')
        AND calibration.reviewed_by IS NULL
        AND calibration.reviewed_at IS NULL)<>16 THEN
    RAISE EXCEPTION '% expected 16 review-only calibration proposals',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1 variant
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id=variant.definition_id
    WHERE definition.slug=active_slug AND variant.status<>'archived'
      AND ((variant.difficulty_json->>'baseOverallDifficulty')::SMALLINT
        <>greatest(
          (variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT)
        OR (variant.programming_profile_json->>'overallDifficulty')::SMALLINT
        <>greatest(
          (variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT))
  ) THEN
    RAISE EXCEPTION '% found overall difficulty outside max(complexity, physical)',
      migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id=ANY(audited_source_ids)
        AND score.human_review_status='queued'
        AND score.reviewed_by IS NULL AND score.reviewed_at IS NULL
        AND score.base_overall_difficulty=greatest(
          score.technical_complexity,score.absolute_load_demand))
      <>cardinality(audited_source_ids) THEN
    RAISE EXCEPTION '% expected 20 queued source-score packets',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND variant.status<>'archived'
        AND coalesce((variant.requirements_json->>'selectable')::BOOLEAN,FALSE)
        AND variant.variant_key=ANY(selectable_variant_keys))<>6
    OR (SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND variant.status<>'archived'
        AND NOT coalesce((variant.requirements_json->>'selectable')::BOOLEAN,FALSE)
        AND variant.variant_key=ANY(blocked_variant_keys))<>2 THEN
    RAISE EXCEPTION '% expected six selectable and two identity-blocked variants',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    LEFT JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id=definition.id
    LEFT JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id=variant.id
    WHERE definition.slug=active_slug AND(
      definition.status='published' OR definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL
      OR definition.last_reviewed_at IS NOT NULL
      OR definition.approved_video_url IS NOT NULL
      OR variant.status='published' OR profile.status='published'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=media.definition_id
      WHERE definition.slug=active_slug
        AND media.review_status IN('shortlisted','approved','rejected'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug
        AND relationship.review_status<>'review')
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND calibration.status<>'review') THEN
    RAISE EXCEPTION '% created forbidden approval or publication state',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id=variant.id
    WHERE definition.slug=active_slug AND(
      coaching.exercise_json_has_non_neutral_level_classification(
        definition.provenance_json)
      OR coaching.exercise_json_has_non_neutral_level_classification(
        definition.population_json)
      OR coaching.exercise_json_has_non_neutral_level_classification(
        variant.difficulty_json)
      OR coaching.exercise_json_has_non_neutral_level_classification(
        variant.requirements_json)
      OR coaching.exercise_json_has_non_neutral_level_classification(
        variant.programming_profile_json)
      OR coaching.exercise_json_has_non_neutral_level_classification(
        profile.dosage_json)
      OR coaching.exercise_json_has_non_neutral_level_classification(
        profile.logistics_json)
      OR coaching.exercise_json_has_non_neutral_level_classification(
        profile.support_prompts_json))) THEN
    RAISE EXCEPTION '% found forbidden exercise skill/proficiency classification',
      migration_key;
  END IF;

  IF (SELECT card_version FROM coaching.exercise_definition_v1
      WHERE slug=active_slug)<>2
    OR (SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=packet.definition_id
      WHERE definition.slug=active_slug AND packet.card_version=2
        AND packet.audit_version=migration_key AND packet.status='quarantined'
        AND packet.human_review_required=TRUE)<>1 THEN
    RAISE EXCEPTION '% expected one current quarantined version-2 test packet',
      migration_key;
  END IF;
END
$$;
