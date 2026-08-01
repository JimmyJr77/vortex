-- Complete candidate canonical packets for the controlled low/high Dribble Run
-- variants and the distinct Dribble Build to Sprint compound transition.
--
-- Both definitions and all three exact variants have complete structural
-- contracts and become selectable only after independent human approval.
--
-- Exercise cards store exercise complexity and physical difficulty only;
-- overall difficulty is their maximum. Athlete proficiency belongs only to
-- coaching.skill. Evidence, media, graph, calibration, cards, and scores remain
-- candidate/review-only. This migration creates no approval.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '417_coaching_dribble_run_research_completion';
  research_batch CONSTANT TEXT := 'dribble-run-progression-v1';
  active_slugs CONSTANT TEXT[] := ARRAY[
    'high-dribble-run','dribble-build-to-sprint'
  ];
  selectable_slugs CONSTANT TEXT[] := active_slugs;
  audited_source_ids CONSTANT BIGINT[] := ARRAY[321,322,342];
  already_applied_count INTEGER;
  actual_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived';
  IF actual_count<>2 THEN
    RAISE EXCEPTION '% requires exactly two active prepared definitions; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO already_applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived'
    AND definition.provenance_json->>'researchCompletionMigration'=migration_key;
  IF already_applied_count NOT IN(0,2) THEN
    RAISE EXCEPTION '% found partial prior application on % definitions',
      migration_key,already_applied_count;
  END IF;
  IF already_applied_count=0 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
      AND definition.status<>'archived' AND definition.card_version<>1
  ) THEN
    RAISE EXCEPTION '% expected card version 1 before first application',migration_key;
  END IF;
  IF already_applied_count = 2 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
      AND definition.status<>'archived' AND definition.card_version <> 2
  ) THEN
    RAISE EXCEPTION '% found card-version drift after completion',migration_key;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived'
    AND source.legacy_exercise_id=ANY(audited_source_ids);
  IF actual_count<>cardinality(audited_source_ids) OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source
      ON source.definition_id=definition.id
    WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
      AND definition.status<>'archived'
      AND NOT(source.legacy_exercise_id=ANY(audited_source_ids))
  ) THEN
    RAISE EXCEPTION '% requires exactly all % audited source mappings',
      migration_key,cardinality(audited_source_ids);
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived' AND variant.status<>'archived';
  IF actual_count<>3 OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
      AND definition.status<>'archived' AND variant.status<>'archived'
      AND NOT(
        (definition.slug='high-dribble-run' AND variant.variant_key IN(
          'low-ankle-shin-recovery','high-knee-recovery'))
        OR (definition.slug='dribble-build-to-sprint'
          AND variant.variant_key='baseline'))
  ) THEN
    RAISE EXCEPTION '% requires the two controlled Dribble Run variants and one build-to-sprint baseline',migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
        AND definition.status<>'archived'
        AND (definition.status='published' OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=evidence.definition_id
      WHERE definition.slug=ANY(active_slugs)
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=media.definition_id
      WHERE definition.slug=ANY(active_slugs)
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=alternate.definition_id
      WHERE definition.slug=ANY(active_slugs)
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=ANY(active_slugs))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=revision.definition_id
      WHERE definition.slug=ANY(active_slugs))
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=ANY(active_slugs))
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(active_slugs) AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(active_slugs) AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 from_variant
        ON from_variant.id=relationship.from_variant_id
      JOIN coaching.exercise_variant_v1 to_variant
        ON to_variant.id=relationship.to_variant_id
      WHERE (from_variant.definition_id IN(
          SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(active_slugs))
        OR to_variant.definition_id IN(
          SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(active_slugs)))
        AND (relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(active_slugs)
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

  CREATE TEMP TABLE family_packet_seed(
    definition_slug TEXT PRIMARY KEY,
    research_version TEXT NOT NULL,
    packet_json JSONB NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_packet_seed VALUES
  -- BEGIN GENERATED CANONICAL RESEARCH PACKETS
    ('high-dribble-run','2026-07-25.8',$packet${"assessmentSummary":{"identity":"Traveling alternating high dribbles using a compact circular foot path that recovers toward knee height, short contacts close to the hips, coordinated arms, and controlled upright rhythm over a defined lane.","currentCardFindings":["The card says higher than low dribble but does not define the recovery landmark, making the identity dependent on another incomplete card.","The generic difficulty and load values understate the larger hip excursion, balance, cadence, and repeated-contact demand.","A 25-second interval is likely to shift the drill toward fatigue and should become short passes with a visible quality stop."],"proposedTaxonomy":{"movementPatterns":["traveling_alternating_high_dribble","cyclic_sprint_mechanics"],"jointActions":["hip_flexion_extension","knee_flexion_extension","ankle_dorsiflexion_and_plantarflexion","contralateral_arm_swing"],"planes":["sagittal","frontal"],"laterality":"alternating_left_right","intent":"compact_knee_height_recovery_with_short_repeatable_contacts"},"proposedAnatomy":{"primaryMuscles":["hip_flexors","hamstrings","soleus","gastrocnemius","tibialis_anterior"],"secondaryMuscles":["gluteus_maximus","quadriceps","intrinsic_foot","gluteus_medius","obliques","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":58,"absoluteLoadDemand":24,"coordinationDemand":66,"supervisionDemand":44,"failureConsequence":35,"impact":34,"workCapacityDemand":30,"baseOverallDifficulty":58},"proposedLoadProfile":{"loadingType":"bodyweight_traveling_alternating_knee_height_cycle_locomotion","impactClass":"moderate_by_cadence_surface_and_contacts","landingContactsPerRep":"record_pass_distance_and_optional_total_contacts","primaryStress":["hip_flexor_cyclic_work","hamstring_limb_recovery","plantar_flexor_loading","single_support_coordination"],"fatigueSensitivity":"cycle_height_reach_contact_sound_pelvic_position_cadence_and_relaxation"},"proposedConstraints":{"requiredEquipment":["15_to_25_metre_clear_lane","safe_finish_zone"],"optionalEquipment":["knee_height_reference","cones","video","cadence_feedback"],"environment":["level_dry_non_slip_surface","no_cross_traffic"],"population":["owns_low_dribble","pain_free_fast_locomotion","can_control_knee_height_cycle_without_reaching"]},"proposedDosage":{"sets":"2-4_passes","distancePerPass":"10-20_metres_or_6-12_seconds","restSeconds":"45-90_or_walk_back","intensity":"submaximal_to_crisp_high_cadence","progressWhen":"recovery reaches the assigned height without leaning back, reaching, or losing relaxation"},"proposedInstructions":{"coachCues":["Compact circle to knee height","Step down close to the hips","Keep the pelvis stacked","Fast and relaxed"],"athleteInstructions":["Cycle each thigh higher while keeping the foot path compact and the contact close beneath you"],"commonFaults":["high_knee_march_substitution","casting_the_foot","backward_lean","pelvic_tuck","loud_contacts","tension"]},"proposedSafety":{"readiness":["owns_low_dribble","pain_free_fast_running","safe_lane"],"stopRules":["pain","limp","repeated_reaching","leaning_back","contact_noise","cycle_height_or_cadence_drop"]},"programmingDecision":"Retain as the knee-height variant in the Dribble Run family, not as a universal model of upright sprinting. Define the recovery landmark and cap passes before the larger cycle turns into reaching or fatigue.","currentCardSnapshot":{"capturedAt":"2026-07-26T03:15:00.000Z","cardVersion":1,"status":"review","description":"High Dribble Run is a sprint access & mechanics exercise for speed, sprinting, and quick-release athletes. It emphasizes hip flexion, ankle stiffness, front side cycle while keeping the session intent aligned with the Vortex phase sequence.","familyKey":"Sprint Drill Series","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["World Athletics presents ankling and progressively larger knee actions as distinct drill constraints that are learned before cadence increases.","High Dribble Run must state the cyclic recovery height, contact sequence, displacement, cadence, arm action, approach, transition, sprint segment, and deceleration; low, high, build, bleed, and run are not interchangeable labels."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Maximal sprint performance involves interacting spatiotemporal, segment-configuration, segment-velocity, and front- and back-side variables rather than one isolated technical feature.","High Dribble Run belongs to a traveling alternating dribble family, a controlled recovery-height variant, a supported repeated-contact family, or a compound drill-to-sprint transition; it is not itself a maximal sprint."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37989833/","sourceTitle":"Ankle and Plantar Flexor Muscle-Tendon Unit Function in Sprinters: A Narrative Review","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["The ankle and plantar-flexor muscle-tendon units contribute differently across sprint phases, with soleus and gastrocnemius supporting and accelerating the center of mass and transferring energy at high speed.","The card should include intrinsic-foot, soleus, gastrocnemius, tibialis-anterior, hamstring, quadriceps, hip-flexor and extensor, pelvic-stabilizer, trunk, and arm-action roles in proportion to recovery height and running speed."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11994691/","sourceTitle":"Angular kinematics during top speed sprinting in male intercollegiate track and field and team sport athletes","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["Top-speed sprinting depends on coordinated lower-extremity angular behavior, and observed strategies differ between populations and sporting demands.","A dribble drill can constrain foot-path size, cadence, and contact placement, but its appearance cannot prove sprint force, joint stiffness, or transfer; observable quality should focus on compact cycling, contact close to the projected center of mass, posture, relaxation, and smooth transition."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Mechanical stiffness varies with task, velocity, maturity, fatigue, and measurement method and should not be inferred as a fixed property from drill appearance.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; audience experience remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37989833/","sourceTitle":"Ankle and Plantar Flexor Muscle-Tendon Unit Function in Sprinters: A Narrative Review","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Plantar-flexor and ankle demands change as a sprint progresses from start through acceleration to maximal velocity.","High Dribble Run needs pass length, total steps or contacts, cycle height, cadence or speed intent, sprint metres when present, surface, footwear, weekly high-speed exposure, technical-fatigue thresholds, and between-attempt recovery."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed work requires suitable space, clear start and finish zones, progressive intensity, adequate recovery, and coaching that preserves the session's speed intent.","Require a level, dry, non-slip lane; clear entry, finish, and deceleration zones; safe athlete spacing; suitable footwear; an immovable support only for supported variants; and readiness for the highest speed actually prescribed."]},{"sectionKey":"dosage","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["World Athletics gives two passes over 10 to 20 metres as an example for progressive sprint drills and directs athletes to learn the movement before increasing cadence.","Use passes, metres, contact counts, cycle height, target intensity, and full recovery rather than a generic work interval; transition drills must separately prescribe drill, sprint, and deceleration distances."]},{"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8008308/","sourceTitle":"Kinematic Stride Characteristics of Maximal Sprint Running of Elite Sprinters – Verification of the Swing-Pull Technique","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Small horizontal foot distance from the center of mass at contact, active foot velocity before contact, and coordinated hip motion may help minimize braking during maximal sprinting.","Use a small observable cue set: make a compact circle, recover to the assigned height, step close beneath the hips, stay stacked and relaxed, keep the arms coordinated, increase cadence without reaching, and blend rather than lunge into a sprint."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint power demand rises steeply with velocity, so drill-to-sprint transitions should be treated as high-speed exposures rather than low-load warm-up repetitions.","Stop for foot, shin, calf, Achilles, hamstring, knee, hip, or back pain; a limp; repeated reaching or locked-knee braking; loud or lengthening contacts; cadence or speed loss; rising tension; unsafe support movement; an abrupt transition; or inadequate deceleration space."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36513077/","sourceTitle":"Effect of Vertical Jump and Sprint Training on Power and Speed Performance Transfer","sourcePublisher":"Motor Control","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Training transfer depends on the relationship between the practiced task, performance outcome, population, dose, and intervention rather than similarity of one visible feature.","High Dribble Run belongs after general preparation and before maximal sprinting: use low and high dribbles for a named coordination constraint, and use dribble-to-sprint only as a fresh high-speed exposure when the athlete already owns both segments."]},{"sectionKey":"athlete_support","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["Athlete support should show the movement first at learning cadence and then at the prescribed speed.","Show side and rear views, the ankle-, shin-, or knee-height recovery target, contact zone, lane and finish, arm rhythm, transition, deceleration, and a lower-cadence option; explain that fast feet do not justify longer reaches or forced foot strike."]},{"sectionKey":"coach_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11994691/","sourceTitle":"Angular kinematics during top speed sprinting in male intercollegiate track and field and team sport athletes","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["Sprint kinematics can differ across athlete populations, so one visual template should not be treated as universal proof of efficiency.","Provide side and rear observation, exact cycle-height definitions, pass and contact counts, optional video or timing, left-right comparison, relaxation and posture checks, lane setup, recovery, progression criteria, and a clear distinction between a drill cue and measured sprint biomechanics."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include slower cadence, shorter lanes, lower recovery height, walking cycles, flat contact targets, a stable support, fewer contacts, longer recovery, quieter instruction, and removing the sprint transition while keeping difficulty dimensions explicit."]},{"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint performance emerges from interacting mechanics and cannot be reduced to one preferred recovery height or cue.","Ankle-, shin-, calf-, and knee-height dribbles are controlled recovery-height variants of one cyclic pattern; cadence, lane length, and arm constraint are delivery annotations; a terminal sprint or a materially different supported contact sequence requires a distinct variant or definition."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The direct candidates for High Dribble Run were discovered through visible YouTube search; current availability and embedding, exact cycle height and contact sequence, complete viewing, captions, instructional quality, safety, and approval remain separate review gates, and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=DHv8Q-55TRY","title":"Sprint Drills: Dribbling - Ankle Dribble, Calf Dribble, Knee Dribble","channelName":"ATHLETE.X","sourceQuery":"high dribble run sprint drill knee dribble","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=hed1-9RePqg","title":"Dribbles - Ankle/Shin/Knee (ASK Running)","channelName":"Brendan Hoyer","sourceQuery":"high dribble run sprint drill knee dribble","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=y00yX5c-jUo","title":"Dribble run (knee-high)","channelName":"Ryan Ford","sourceQuery":"high dribble run sprint drill knee dribble","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=LP2ZPHMaCjc","title":"Sprint Drills - Knee Dribble - Cody Bidlow","channelName":"ATHLETE.X","sourceQuery":"high dribble run sprint drill knee dribble","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=IIEKHZnJD5M","title":"Dribble Series","channelName":"Brendan Thompson -- Speed & Physical Therapy","sourceQuery":"high dribble run sprint drill knee dribble","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."}],"alternateAssessments":[{"name":"Knee Dribble","classification":"same_identity","rationale":"This is the clearer name when recovery is explicitly knee height.","distinguishingDimensions":{"cycleHeight":"knee"}},{"name":"Low Dribble Run","classification":"new_variant","rationale":"Ankle-to-shin recovery is a lower-amplitude variant.","distinguishingDimensions":{"cycleHeight":"ankle_to_shin"}},{"name":"Calf Dribble","classification":"new_variant","rationale":"Calf-height recovery provides an intermediate amplitude.","distinguishingDimensions":{"cycleHeight":"calf"}},{"name":"High Dribble with Hands on Hips","classification":"modifier_annotation","rationale":"Removing arm swing changes the coordination constraint but not the foot-cycle identity.","distinguishingDimensions":{"armAction":"hands_on_hips"}},{"name":"High Dribble Bleed to Sprint","classification":"new_definition","rationale":"A free-sprint transition adds high-speed exposure and distinct logistics.","distinguishingDimensions":{"terminalAction":"sprint"}}]}$packet$::JSONB),
    ('dribble-build-to-sprint','2026-07-25.8',$packet${"assessmentSummary":{"identity":"A compound drill-to-sprint transition that begins with a defined low-to-high or fixed-height dribble segment, progressively increases cadence and displacement, blends into free upright sprinting, and ends with controlled deceleration.","currentCardFindings":["The current phrase 'begin with low-to-high dribble rhythm' leaves the recovery-height sequence, segment distances, and transition threshold undefined.","Six seconds and one repetition do not record dribble contacts, sprint distance, peak-speed exposure, or deceleration demand.","The difficulty value of 40 materially understates a compound near-maximal sprint exposure."],"proposedTaxonomy":{"movementPatterns":["dribble_progression","transition_to_upright_sprint","controlled_deceleration"],"jointActions":["progressive_hip_and_knee_cycle","ankle_dorsiflexion_and_plantarflexion","sprint_ground_contact","contralateral_arm_swing"],"planes":["sagittal","frontal"],"laterality":"alternating_left_right","intent":"smoothly_increase_cycle_height_and_velocity_into_free_sprinting_without_reach"},"proposedAnatomy":{"primaryMuscles":["hamstrings","gluteus_maximus","hip_flexors","soleus","gastrocnemius"],"secondaryMuscles":["quadriceps","tibialis_anterior","intrinsic_foot","gluteus_medius","obliques","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":75,"absoluteLoadDemand":36,"coordinationDemand":80,"supervisionDemand":65,"failureConsequence":65,"impact":62,"workCapacityDemand":42,"baseOverallDifficulty":75},"proposedLoadProfile":{"loadingType":"bodyweight_compound_dribble_progression_to_high_speed_sprint","impactClass":"high_by_terminal_speed_and_total_contacts","landingContactsPerRep":"record_dribble_contacts_sprint_steps_total_metres_and_high_speed_metres","primaryStress":["hamstring_high_speed_load","plantar_flexor_loading","hip_cycle_velocity","neural_speed_demand","deceleration"],"fatigueSensitivity":"transition_reach_contact_sound_tension_speed_posture_and_shutdown_quality"},"proposedConstraints":{"requiredEquipment":["30_to_50_metre_clear_lane","marked_dribble_transition_sprint_and_deceleration_zones"],"optionalEquipment":["cones","timing_gates","video"],"environment":["level_dry_high_grip_surface","no_cross_traffic","suitable_footwear"],"population":["owns_low_and_high_dribbles","recent_pain_free_fast_sprinting","can_decelerate_safely"]},"proposedDosage":{"sets":"2-4","attemptsPerSet":"1-2","segmentDose":"10-20_metres_dribble_progression_then_10-20_metres_free_sprint_plus_15-25_metres_deceleration","restSeconds":"180-300_between_near_maximal_attempts","progressWhen":"the transition is continuous, contact stays close, speed and relaxation repeat, and the shutdown is controlled"},"proposedInstructions":{"coachCues":["Build the circle gradually","Let cadence and travel increase together","Blend into the sprint","Do not reach","Run through and shut down gradually"],"athleteInstructions":["Start with the assigned dribble, let the cycle grow smoothly into a fast relaxed sprint, and use the full deceleration zone"],"commonFaults":["undefined_entry_pattern","abrupt_transition","overstriding","premature_maximal_effort","upper_body_tension","short_shutdown"]},"proposedSafety":{"readiness":["owns_entry_dribble","recent_fast_sprint_exposure","full_clear_lane","safe_deceleration"],"stopRules":["pain","limp","protective_mechanics","abrupt_or_stumbling_transition","speed_or_relaxation_drop","unsafe_shutdown"]},"programmingDecision":"Retain as a distinct compound definition and add Dribble Bleed to Sprint as an alias. Require one named entry pattern, explicit segment distances, target speed, high-speed exposure accounting, full recovery, and a marked deceleration zone.","currentCardSnapshot":{"capturedAt":"2026-07-26T03:15:00.000Z","cardVersion":1,"status":"review","description":"Dribble Build to Sprint is a max velocity & rhythm exercise for speed, sprinting, and quick-release athletes. It emphasizes dribble transition, upright sprint cycle, elastic foot contact while keeping the session intent aligned with the Vortex phase sequence.","familyKey":"Max Velocity Projection Drills","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":30,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["World Athletics presents ankling and progressively larger knee actions as distinct drill constraints that are learned before cadence increases.","Dribble Build to Sprint must state the cyclic recovery height, contact sequence, displacement, cadence, arm action, approach, transition, sprint segment, and deceleration; low, high, build, bleed, and run are not interchangeable labels."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Maximal sprint performance involves interacting spatiotemporal, segment-configuration, segment-velocity, and front- and back-side variables rather than one isolated technical feature.","Dribble Build to Sprint belongs to a traveling alternating dribble family, a controlled recovery-height variant, a supported repeated-contact family, or a compound drill-to-sprint transition; it is not itself a maximal sprint."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37989833/","sourceTitle":"Ankle and Plantar Flexor Muscle-Tendon Unit Function in Sprinters: A Narrative Review","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["The ankle and plantar-flexor muscle-tendon units contribute differently across sprint phases, with soleus and gastrocnemius supporting and accelerating the center of mass and transferring energy at high speed.","The card should include intrinsic-foot, soleus, gastrocnemius, tibialis-anterior, hamstring, quadriceps, hip-flexor and extensor, pelvic-stabilizer, trunk, and arm-action roles in proportion to recovery height and running speed."]},{"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11994691/","sourceTitle":"Angular kinematics during top speed sprinting in male intercollegiate track and field and team sport athletes","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["Top-speed sprinting depends on coordinated lower-extremity angular behavior, and observed strategies differ between populations and sporting demands.","A dribble drill can constrain foot-path size, cadence, and contact placement, but its appearance cannot prove sprint force, joint stiffness, or transfer; observable quality should focus on compact cycling, contact close to the projected center of mass, posture, relaxation, and smooth transition."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Mechanical stiffness varies with task, velocity, maturity, fatigue, and measurement method and should not be inferred as a fixed property from drill appearance.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; audience experience remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37989833/","sourceTitle":"Ankle and Plantar Flexor Muscle-Tendon Unit Function in Sprinters: A Narrative Review","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Plantar-flexor and ankle demands change as a sprint progresses from start through acceleration to maximal velocity.","Dribble Build to Sprint needs pass length, total steps or contacts, cycle height, cadence or speed intent, sprint metres when present, surface, footwear, weekly high-speed exposure, technical-fatigue thresholds, and between-attempt recovery."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed work requires suitable space, clear start and finish zones, progressive intensity, adequate recovery, and coaching that preserves the session's speed intent.","Require a level, dry, non-slip lane; clear entry, finish, and deceleration zones; safe athlete spacing; suitable footwear; an immovable support only for supported variants; and readiness for the highest speed actually prescribed."]},{"sectionKey":"dosage","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["World Athletics gives two passes over 10 to 20 metres as an example for progressive sprint drills and directs athletes to learn the movement before increasing cadence.","Use passes, metres, contact counts, cycle height, target intensity, and full recovery rather than a generic work interval; transition drills must separately prescribe drill, sprint, and deceleration distances."]},{"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8008308/","sourceTitle":"Kinematic Stride Characteristics of Maximal Sprint Running of Elite Sprinters – Verification of the Swing-Pull Technique","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Small horizontal foot distance from the center of mass at contact, active foot velocity before contact, and coordinated hip motion may help minimize braking during maximal sprinting.","Use a small observable cue set: make a compact circle, recover to the assigned height, step close beneath the hips, stay stacked and relaxed, keep the arms coordinated, increase cadence without reaching, and blend rather than lunge into a sprint."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint power demand rises steeply with velocity, so drill-to-sprint transitions should be treated as high-speed exposures rather than low-load warm-up repetitions.","Stop for foot, shin, calf, Achilles, hamstring, knee, hip, or back pain; a limp; repeated reaching or locked-knee braking; loud or lengthening contacts; cadence or speed loss; rising tension; unsafe support movement; an abrupt transition; or inadequate deceleration space."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36513077/","sourceTitle":"Effect of Vertical Jump and Sprint Training on Power and Speed Performance Transfer","sourcePublisher":"Motor Control","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Training transfer depends on the relationship between the practiced task, performance outcome, population, dose, and intervention rather than similarity of one visible feature.","Dribble Build to Sprint belongs after general preparation and before maximal sprinting: use low and high dribbles for a named coordination constraint, and use dribble-to-sprint only as a fresh high-speed exposure when the athlete already owns both segments."]},{"sectionKey":"athlete_support","sourceUrl":"https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed","sourceTitle":"Jereem Richards’ games and drills to help develop speed","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":77,"claims":["Athlete support should show the movement first at learning cadence and then at the prescribed speed.","Show side and rear views, the ankle-, shin-, or knee-height recovery target, contact zone, lane and finish, arm rhythm, transition, deceleration, and a lower-cadence option; explain that fast feet do not justify longer reaches or forced foot strike."]},{"sectionKey":"coach_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11994691/","sourceTitle":"Angular kinematics during top speed sprinting in male intercollegiate track and field and team sport athletes","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["Sprint kinematics can differ across athlete populations, so one visual template should not be treated as universal proof of efficiency.","Provide side and rear observation, exact cycle-height definitions, pass and contact counts, optional video or timing, left-right comparison, relaxation and posture checks, lane setup, recovery, progression criteria, and a clear distinction between a drill cue and measured sprint biomechanics."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include slower cadence, shorter lanes, lower recovery height, walking cycles, flat contact targets, a stable support, fewer contacts, longer recovery, quieter instruction, and removing the sprint transition while keeping difficulty dimensions explicit."]},{"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","sourceTitle":"The Training and Development of Elite Sprint Performance: an Integration of Scientific and Best Practice Literature","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Sprint performance emerges from interacting mechanics and cannot be reduced to one preferred recovery height or cue.","Ankle-, shin-, calf-, and knee-height dribbles are controlled recovery-height variants of one cyclic pattern; cadence, lane length, and arm constraint are delivery annotations; a terminal sprint or a materially different supported contact sequence requires a distinct variant or definition."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The direct candidates for Dribble Build to Sprint were discovered through visible YouTube search; current availability and embedding, exact cycle height and contact sequence, complete viewing, captions, instructional quality, safety, and approval remain separate review gates, and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=Rg4YE2CaiL8","title":"Dribble bleed to sprint","channelName":"Ethan Printy","sourceQuery":"dribble bleed into sprint track drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=xaoo0tjiwaI","title":"Dribble Bleed to Sprint","channelName":"nemet35","sourceQuery":"dribble bleed into sprint track drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=mVblhCw8roU","title":"Dribble Bleed-Sprint","channelName":"Paul Walshe","sourceQuery":"dribble bleed into sprint track drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=iYxXaFKqVpc","title":"Dribble Into Sprint","channelName":"Tinsley Performance","sourceQuery":"dribble bleed into sprint track drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."},{"url":"https://www.youtube.com/watch?v=h6dhMAHh-P8","title":"How We Use Dribble Bleeds To Get Faster… Try This Drill Now!","channelName":"Les Spellman","sourceQuery":"dribble bleed into sprint track drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending."}],"alternateAssessments":[{"name":"Dribble Bleed to Sprint","classification":"same_identity","rationale":"Bleed describes the gradual transition already required by this definition.","distinguishingDimensions":{"transitionStyle":"gradual"}},{"name":"Low Dribble to Sprint","classification":"new_variant","rationale":"A fixed low entry changes the transition demand and target speed build.","distinguishingDimensions":{"entryPattern":"low_dribble"}},{"name":"High Dribble to Sprint","classification":"new_variant","rationale":"A knee-height entry starts closer to the free sprint cycle.","distinguishingDimensions":{"entryPattern":"high_dribble"}},{"name":"Low-to-High Dribble Progression without Sprint","classification":"new_definition","rationale":"Removing free sprinting materially reduces speed exposure and logistics.","distinguishingDimensions":{"terminalAction":"dribble_run_out"}},{"name":"Timed Dribble Bleed Fly","classification":"new_variant","rationale":"A measured fly zone adds testing intent, timing equipment, and higher-speed accountability.","distinguishingDimensions":{"terminalAction":"timed_fly"}}]}$packet$::JSONB);
  -- END GENERATED CANONICAL RESEARCH PACKETS

  UPDATE coaching.exercise_definition_v1 definition
  SET description=CASE WHEN definition.slug='high-dribble-run' THEN
      'Traveling alternating Dribble Run with a declared compact circular foot path at ankle-to-lower-shin or knee recovery height, short contacts close to the hips, coordinated arms, controlled cadence, and a defined lane and finish.'
      ELSE packet.packet_json#>>'{assessmentSummary,identity}' END,
    family_key='dribble_run_progression',
    card_version=CASE WHEN already_applied_count=0
      THEN definition.card_version+1 ELSE definition.card_version END,
    status='review',
    content_confidence=CASE
      WHEN definition.slug=ANY(selectable_slugs) THEN 76 ELSE 52 END,
    scoring_confidence=CASE
      WHEN definition.slug=ANY(selectable_slugs) THEN 66 ELSE 50 END,
    media_confidence=20,
    movement_patterns=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedTaxonomy,movementPatterns}')),
    body_regions=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedAnatomy,joints}')),
    required_equipment=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}')),
    optional_equipment=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedConstraints,optionalEquipment}')),
    anatomy_json=jsonb_build_object(
      'primaryMusclesAndTissues',
        packet.packet_json#>'{assessmentSummary,proposedAnatomy,primaryMuscles}',
      'secondaryMusclesAndTissues',
        packet.packet_json#>'{assessmentSummary,proposedAnatomy,secondaryMuscles}',
      'joints',packet.packet_json#>'{assessmentSummary,proposedAnatomy,joints}',
      'actions',packet.packet_json#>'{assessmentSummary,proposedTaxonomy,jointActions}',
      'planes',packet.packet_json#>'{assessmentSummary,proposedTaxonomy,planes}',
      'laterality',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,laterality}',
      'intent',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}'),
    environment_json=jsonb_build_object(
      'requirements',packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'surfacePolicy','dry_level_non_slip_surface_appropriate_to_contact_intensity',
      'trafficPolicy','clear_station_or_one_directional_lane_with_safe_finish',
      'weatherPolicy','reduce_or_replace_when_traction_visibility_or_spacing_is_unreliable',
      'humanReviewRequired',TRUE),
    population_json=jsonb_build_object(
      'selectionStatus','candidate_requires_human_review',
      'readinessChecks',packet.packet_json#>'{assessmentSummary,proposedConstraints,population}',
      'structurallyPrescribable',definition.slug=ANY(selectable_slugs),
      'identitySequenceResolved',definition.slug=ANY(selectable_slugs),
      'constraints',jsonb_build_array(
        'scale_from_current_readiness_and_movement_competence',
        'pain_symptoms_surface_lane_and_fatigue_override_the_planned_dose',
        'do_not_infer_athlete_proficiency_from_exercise_difficulty'),
      'contraindications',jsonb_build_array(
        'sharp_or_increasing_pain','limp_or_repeated_balance_loss',
        'unsafe_surface_lane_finish_or_equipment',
        'inability_to_follow_the_declared_contact_sequence')),
    athlete_support_json=jsonb_build_object(
      'plainLanguageSummary',packet.packet_json#>'{assessmentSummary,proposedInstructions,athleteInstructions}',
      'setupChecklist',jsonb_build_array(
        'confirm_surface_lane_contact_pattern_and_finish',
        'rehearse_below_training_speed','confirm_stop_signal_and_safe_exit'),
      'cues',packet.packet_json#>'{assessmentSummary,proposedInstructions,coachCues}',
      'expectedSensations',packet.packet_json#>'{assessmentSummary,proposedLoadProfile,primaryStress}',
      'stopSignals',packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}',
      'readinessChecks',packet.packet_json#>'{assessmentSummary,proposedSafety,readiness}',
      'feedbackPrompt','Were contacts quiet, close, symmetric or correctly alternating, pain-free, and repeatable through the declared finish?',
      'accessibilityOptions',jsonb_build_array(
        'shorter_lane_or_fewer_contacts','slower_cadence','lower_amplitude',
        'flat_visual_marks_instead_of_ladder','extra_demonstration',
        'longer_recovery','live_written_still_image_or_video_instruction')),
    coach_support_json=jsonb_build_object(
      'identityContract',packet.packet_json#>>'{assessmentSummary,identity}',
      'programmingDecision',packet.packet_json#>>'{assessmentSummary,programmingDecision}',
      'coachCues',packet.packet_json#>'{assessmentSummary,proposedInstructions,coachCues}',
      'commonFaults',packet.packet_json#>'{assessmentSummary,proposedInstructions,commonFaults}',
      'qualityGate',packet.packet_json#>>'{assessmentSummary,proposedDosage,progressWhen}',
      'stopRules',packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}',
      'observationPlan',jsonb_build_array(
        'rear_view_for_lane_symmetry_and_frontal_control',
        'side_view_for_posture_contact_location_flight_and_reach',
        'first_to_last_contact_comparison_for_fatigue_drift'),
      'cumulativeBudgetWarnings',jsonb_build_array(
        'count_every_landing_contact_and_each_side',
        'count_prior_sprinting_jumping_pogo_and_lower_leg_exposure',
        'high_speed_and_high_impact_cards_require_full_quality_recovery'),
      'escalation',jsonb_build_object(
        'clinical','stop_and_refer_when_pain_neurologic_symptoms_or_limp_persist',
        'emergency','follow_facility_emergency_plan_for_acute_injury_or_collapse')),
    support_operations_json=jsonb_build_object(
      'stationType','one_directional_drill_lane',
      'requiredEquipment',packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}',
      'optionalEquipment',packet.packet_json#>'{assessmentSummary,proposedConstraints,optionalEquipment}',
      'environment',packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'dosage',packet.packet_json#>'{assessmentSummary,proposedDosage}',
      'contactAccounting',packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,landingContactsPerRep}',
      'structuralSelectionAllowed',definition.slug=ANY(selectable_slugs),
      'selectionBlockReason',CASE WHEN definition.slug=ANY(selectable_slugs)
        THEN NULL ELSE packet.packet_json#>>'{assessmentSummary,programmingDecision}' END,
      'groupFlow',jsonb_build_object(
        'oneAthletePerStationOrLane',TRUE,'staggeredStarts',TRUE,
        'clearFinishBeforeNextStart',TRUE,'coachMustSeeSetupAndFinish',TRUE),
      'recording',jsonb_build_array(
        'selected_identity_and_profile','distance_time_or_contacts_per_side',
        'contact_pattern','surface_and_spacing','rest','quality_failures','symptoms'),
      'humanReviewRequired',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'researchCompletionMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',packet.research_version,
      'auditedSourceSlugs',jsonb_build_array(
        'low-dribble-run','high-dribble-run','dribble-build-to-sprint'),
      'identityAuthorityMigrations',jsonb_build_array(
        '392_coaching_score_74_variant_identity_consolidations',
        '416_coaching_dribble_run_variant_lineage_preparation'),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'evidenceState','candidate_requires_human_review',
      'mediaState','public_candidates_unverified_and_non_embeddable',
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
      'cardApprovalCreated',FALSE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    updated_at=now()
  FROM family_packet_seed packet
  WHERE definition.facility_id=1 AND definition.slug=packet.definition_slug
    AND definition.status<>'archived';

  UPDATE coaching.exercise_variant_v1 variant
  SET difficulty_json=CASE
      WHEN variant.variant_key='low-ankle-shin-recovery' THEN
        '{"technicalComplexity":48,"absoluteLoadDemand":20,"coordinationDemand":56,"supervisionDemand":38,"failureConsequence":30,"impact":28,"workCapacityDemand":25,"baseOverallDifficulty":48}'::JSONB
      ELSE packet.packet_json#>'{assessmentSummary,proposedDifficulty}' END,
    requirements_json=jsonb_build_object(
      'requiredEquipment',packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}',
      'optionalEquipment',packet.packet_json#>'{assessmentSummary,proposedConstraints,optionalEquipment}',
      'environment',packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'population',packet.packet_json#>'{assessmentSummary,proposedConstraints,population}',
      'readiness',packet.packet_json#>'{assessmentSummary,proposedSafety,readiness}',
      'structurallySelectable',definition.slug=ANY(selectable_slugs),
      'selectable',definition.slug=ANY(selectable_slugs),
      'identitySequenceResolved',definition.slug=ANY(selectable_slugs),
      'selectionBlockReason',CASE WHEN definition.slug=ANY(selectable_slugs)
        THEN NULL ELSE packet.packet_json#>>'{assessmentSummary,programmingDecision}' END,
      'humanReviewRequired',TRUE),
    load_profile_json=(CASE WHEN variant.variant_key='low-ankle-shin-recovery'
      THEN '{"loadingType":"bodyweight_traveling_alternating_low_cycle_locomotion","impactClass":"low_to_moderate_by_cadence_surface_and_contacts","landingContactsPerRep":"record_pass_distance_and_optional_total_contacts","primaryStress":["foot_loading","plantar_flexor_cyclic_force","compact_limb_recovery","coordination"],"fatigueSensitivity":"cycle_height_reach_contact_sound_posture_cadence_and_relaxation"}'::JSONB
      ELSE packet.packet_json#>'{assessmentSummary,proposedLoadProfile}' END)
      ||jsonb_build_object(
        'loadSource','bodyweight_and_declared_external_constraints',
        'contactBudgetRequired',TRUE,'humanReviewRequired',TRUE),
    fatigue_profile_json=jsonb_build_object(
      'fatigueSensitivity',CASE WHEN variant.variant_key='low-ankle-shin-recovery'
        THEN 'cycle_height_reach_contact_sound_posture_cadence_and_relaxation'
        ELSE packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,fatigueSensitivity}' END,
      'primaryStress',CASE WHEN variant.variant_key='low-ankle-shin-recovery'
        THEN '["foot_loading","plantar_flexor_cyclic_force","compact_limb_recovery","coordination"]'::JSONB
        ELSE packet.packet_json#>'{assessmentSummary,proposedLoadProfile,primaryStress}' END,
      'impactClass',CASE WHEN variant.variant_key='low-ankle-shin-recovery'
        THEN 'low_to_moderate_by_cadence_surface_and_contacts'
        ELSE packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,impactClass}' END,
      'monitor',CASE WHEN variant.variant_key='low-ankle-shin-recovery'
        THEN '["undefined_cycle_height","casting_the_foot","high_knee_substitution","loud_contacts","upper_body_bounce","racing"]'::JSONB
        ELSE packet.packet_json#>'{assessmentSummary,proposedInstructions,commonFaults}' END,
      'stopRules',CASE WHEN variant.variant_key='low-ankle-shin-recovery'
        THEN '["pain","limp","repeated_reaching","loud_contacts","cycle_height_loss","posture_or_cadence_break"]'::JSONB
        ELSE packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}' END,
      'recoveryEvidenceState','no_universal_recovery_interval_established',
      'recoveryDecisionInputs',jsonb_build_array(
        'total_and_per_leg_contacts','prior_sprinting_and_jumping',
        'surface_and_footwear','lower_leg_or_hamstring_symptoms',
        'coordination_or_speed_drift','next_session_demand'),
      'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object(
      'intent',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}',
      'dosage',CASE WHEN variant.variant_key='low-ankle-shin-recovery' THEN
        '{"sets":"2-4_passes","distancePerPass":"10-20_metres_or_6-12_seconds","restSeconds":"walk_back_or_30-75","intensity":"learning_to_crisp_submaximal_cadence","progressWhen":"the assigned ankle-to-lower-shin cycle height, compact contact, posture, and relaxation remain repeatable"}'::JSONB
        ELSE packet.packet_json#>'{assessmentSummary,proposedDosage}' END,
      'qualityGate',CASE WHEN variant.variant_key='low-ankle-shin-recovery'
        THEN 'The assigned ankle-to-lower-shin cycle height, compact contact, posture, and relaxation remain repeatable.'
        ELSE packet.packet_json#>>'{assessmentSummary,proposedDosage,progressWhen}' END,
      'overallDifficulty',CASE WHEN variant.variant_key='low-ankle-shin-recovery'
        THEN 48 ELSE (packet.packet_json#>>'{assessmentSummary,proposedDifficulty,baseOverallDifficulty}')::SMALLINT END,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'structurallySelectable',definition.slug=ANY(selectable_slugs),
      'programmingDecision',packet.packet_json#>>'{assessmentSummary,programmingDecision}',
      'humanReviewRequired',TRUE),
    status='review',updated_at=now()
  FROM coaching.exercise_definition_v1 definition,family_packet_seed packet
  WHERE variant.definition_id=definition.id
    AND definition.facility_id=1 AND definition.slug=packet.definition_slug
    AND definition.status<>'archived' AND variant.status<>'archived';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET role='primary',
    purpose=CASE WHEN variant.variant_key='low-ankle-shin-recovery'
      THEN 'repeatable_compact_low_recovery_dribble_cycle_and_contact_rhythm'
      ELSE packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}' END,
    phase_suitability=CASE WHEN definition.slug='dribble-build-to-sprint'
      THEN 86 ELSE 84 END,
    methodology_alignment=82,
    objective_relevance_json=jsonb_build_object(
      'intent',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}',
      'movementPatterns',packet.packet_json#>'{assessmentSummary,proposedTaxonomy,movementPatterns}',
      'identitySequenceResolved',definition.slug=ANY(selectable_slugs),
      'humanReviewRequired',TRUE),
    dosage_json=CASE WHEN variant.variant_key='low-ankle-shin-recovery' THEN
      '{"sets":"2-4_passes","distancePerPass":"10-20_metres_or_6-12_seconds","restSeconds":"walk_back_or_30-75","intensity":"learning_to_crisp_submaximal_cadence"}'::JSONB
      ELSE packet.packet_json#>'{assessmentSummary,proposedDosage}' END,
    quality_gate=CASE WHEN variant.variant_key='low-ankle-shin-recovery'
      THEN 'The assigned ankle-to-lower-shin cycle height, compact contact, posture, and relaxation remain repeatable.'
      ELSE coalesce(packet.packet_json#>>'{assessmentSummary,proposedDosage,progressWhen}',
        packet.packet_json#>>'{assessmentSummary,programmingDecision}') END,
    stop_rules=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}')),
    coach_instructions=CASE WHEN variant.variant_key='low-ankle-shin-recovery'
      THEN 'Assign ankle-to-lower-shin recovery; Make a compact circle; Step close beneath the hips; Stay tall and relaxed; Finish under control'
      ELSE array_to_string(ARRAY(SELECT jsonb_array_elements_text(
        packet.packet_json#>'{assessmentSummary,proposedInstructions,coachCues}')),'; ') END,
    athlete_instructions=CASE WHEN variant.variant_key='low-ankle-shin-recovery'
      THEN 'Travel with compact ankle-to-lower-shin cycles, quiet contacts close beneath you, relaxed arms, and a controlled finish.'
      ELSE array_to_string(ARRAY(SELECT jsonb_array_elements_text(
        packet.packet_json#>'{assessmentSummary,proposedInstructions,athleteInstructions}')),' ') END,
    expected_adaptation=CASE WHEN variant.variant_key='low-ankle-shin-recovery'
      THEN 'repeatable_compact_low_recovery_dribble_cycle_and_contact_rhythm'
      ELSE packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}' END,
    equipment_required=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}')),
    logistics_json=jsonb_build_object(
      'environment',packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'contactAccounting',packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,landingContactsPerRep}',
      'oneAthletePerStationOrLane',TRUE,'staggeredStarts',TRUE,
      'clearFinishBeforeNextStart',TRUE,
      'structurallySelectable',definition.slug=ANY(selectable_slugs)),
    time_model_json=CASE WHEN definition.slug='dribble-build-to-sprint' THEN
        '{"setupSeconds":90,"workSecondsPerAttempt":35,"transitionSeconds":30,"restSecondsPerAttempt":240,"estimateConfidence":"candidate"}'::JSONB
      ELSE '{"setupSeconds":60,"workSecondsPerPass":25,"transitionSeconds":15,"restSecondsPerPass":60,"estimateConfidence":"candidate"}'::JSONB END,
    dose_scaling_json=jsonb_build_object(
      'dimensions',jsonb_build_array(
        'contacts_or_distance','cadence_or_velocity','amplitude','constraint','rest'),
      'progressOneDimensionAtATime',TRUE,'preserveQualityBeforeVolume',TRUE),
    measurement_json=jsonb_build_object(
      'primary','declared_contacts_distance_or_seconds',
      'secondary',jsonb_build_array(
        'contact_pattern_accuracy','contact_sound','posture','speed_or_rhythm','symptoms'),
      'failedContactsExcluded',TRUE),
    support_prompts_json=jsonb_build_object(
      'before','Confirm the exact pattern, surface, lane, finish, dose, and stop signal.',
      'during','Watch contact order, sound, posture, reach, symmetry, equipment clearance, and fatigue drift.',
      'after','Record contacts or distance, rest, failures, symptoms, and selected profile.'),
    status='review',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  JOIN family_packet_seed packet ON packet.definition_slug=definition.slug
  WHERE profile.variant_id=variant.id AND definition.facility_id=1
    AND definition.status<>'archived' AND variant.status<>'archived';

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,evidence.item->>'sectionKey',
    evidence.item->>'sourceUrl',evidence.item->>'sourceTitle',
    evidence.item->>'sourcePublisher',evidence.item->>'sourceKind',
    evidence.item->'claims',(evidence.item->>'evidenceQuality')::SMALLINT,
    'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'evidence') evidence(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug
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
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug
      AND definition.status<>'archived'
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
  SELECT definition.id,definition.card_version,alternate.item->>'name',
    alternate.item->>'classification',alternate.item->>'rationale',
    alternate.item->'distinguishingDimensions',NULL,'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'alternateAssessments') alternate(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name)
  DO UPDATE SET classification=EXCLUDED.classification,
    rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  CREATE TEMP TABLE family_relationship_seed(
    from_slug TEXT NOT NULL,from_variant_key TEXT NOT NULL,
    to_slug TEXT NOT NULL,to_variant_key TEXT NOT NULL,
    relationship TEXT NOT NULL,
    similarity_score SMALLINT NOT NULL,dimensions TEXT[] NOT NULL,
    reason TEXT NOT NULL,conditions_json JSONB NOT NULL,
    PRIMARY KEY(from_slug,from_variant_key,to_slug,to_variant_key,relationship)
  ) ON COMMIT DROP;
  INSERT INTO family_relationship_seed VALUES
    ('high-dribble-run','low-ankle-shin-recovery',
      'high-dribble-run','high-knee-recovery','progression',78,
      ARRAY['cycle_height','hip_motion','coordination','impact'],
      'Knee-height recovery increases cycle amplitude, hip motion, coordination, and contact demand after compact low recovery remains repeatable.',
      '{"requires":["repeatable_low_cycle","pain_free_contacts","no_reaching_or_posture_loss"],"authoredDirection":true,"humanReviewRequired":true}'),
    ('high-dribble-run','high-knee-recovery',
      'dribble-build-to-sprint','baseline','progression',72,
      ARRAY['terminal_sprint','velocity','transition','deceleration','recovery'],
      'Dribble Build to Sprint adds a progressive blend into free upright sprinting, a declared sprint segment, higher velocity exposure, full recovery, and controlled deceleration.',
      '{"requires":["repeatable_knee_height_cycle","sprint_readiness","full_lane_and_deceleration_zone"],"authoredDirection":true,"humanReviewRequired":true}'),
    ('high-dribble-run','low-ankle-shin-recovery',
      'dribble-build-to-sprint','baseline','progression',60,
      ARRAY['cycle_height_progression','terminal_sprint','velocity','deceleration'],
      'A low-cycle entry can progress to the compound build only when the exact low-to-high or fixed-height transition and sprint segment are declared.',
      '{"requires":["repeatable_low_cycle","declared_entry_pattern","sprint_readiness","full_lane_and_deceleration_zone"],"authoredDirection":true,"humanReviewRequired":true}');

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT from_variant.id,to_variant.id,seed.relationship,seed.similarity_score,
    seed.dimensions,seed.reason,seed.conditions_json,'review',NULL,NULL,NULL
  FROM family_relationship_seed seed
  JOIN coaching.exercise_definition_v1 from_definition
    ON from_definition.facility_id=1 AND from_definition.slug=seed.from_slug
      AND from_definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id=from_definition.id
      AND from_variant.variant_key=seed.from_variant_key
      AND from_variant.status<>'archived'
  JOIN coaching.exercise_definition_v1 to_definition
    ON to_definition.facility_id=1 AND to_definition.slug=seed.to_slug
      AND to_definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id=to_definition.id
      AND to_variant.variant_key=seed.to_variant_key
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
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND relationship.relationship IN('progression','lateral_substitution')
    AND relationship.review_status='review'
    AND coalesce(relationship.conditions_json,'{}'::JSONB)->>'authoredDirection'='true'
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
      'Candidate exercise-complexity anchor reflects ordered contacts, flight, travel, laterality, posture, external constraints, compound transitions, finish, and supervision; independent comparison is pending.'
      ELSE 'Candidate physical-difficulty anchor reflects contact count, impact, speed, amplitude, surface, plantar-flexor and hamstring exposure, prior work, and fatigue-sensitive quality; independent comparison is pending.' END,
    'review',1,NULL,NULL,
    'Candidate migration-417 anchor; independent human review required.',NULL
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  CROSS JOIN(VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(dimension)
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived' AND variant.status<>'archived'
    AND variant.difficulty_json?'technicalComplexity'
    AND variant.difficulty_json?'absoluteLoadDemand'
  ON CONFLICT(facility_id,variant_id,dimension,version)
  DO UPDATE SET proposed_score=EXCLUDED.proposed_score,
    anchor_tier=EXCLUDED.anchor_tier,rationale=EXCLUDED.rationale,
    status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_score_calibration_v1.status='review';

  CREATE TEMP TABLE family_score_seed(
    exercise_id BIGINT PRIMARY KEY,complexity SMALLINT NOT NULL,
    physical SMALLINT NOT NULL,coordination SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,supervision SMALLINT NOT NULL,
    confidence SMALLINT NOT NULL,notes TEXT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_score_seed VALUES
    (321,48,20,56,28,38,70,'Low ankle-to-shin Dribble Run source aligned to the controlled low-recovery variant; calibration review required.'),
    (322,58,24,66,34,44,70,'High knee-recovery Dribble Run source aligned to the controlled high-recovery variant; calibration review required.'),
    (342,75,36,80,62,65,68,'Compound Dribble Build to Sprint source score; high-speed exposure and calibration review required.');

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity=seed.complexity,
    absolute_load_demand=seed.physical,
    coordination_demand=seed.coordination,impact=seed.impact,
    supervision_demand=seed.supervision,
    base_overall_difficulty=greatest(seed.complexity,seed.physical),
    legacy_scores=coalesce(score.legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchBatch',research_batch,
      'researchVersion','2026-07-25.8',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'candidateOnly',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=seed.confidence,human_review_status='queued',
    reviewed_by=NULL,reviewed_at=NULL,review_notes=seed.notes,updated_at=now()
  FROM family_score_seed seed
  WHERE score.exercise_id=seed.exercise_id
    AND score.human_review_status='queued'
    AND score.reviewed_by IS NULL AND score.reviewed_at IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,definition.facility_id,definition.card_version,
    definition.schema_version,migration_key,'quarantined',jsonb_build_object(
      'stableIdentityAndAliases',definition.slug=ANY(selectable_slugs),
      'allThreeLegacySourcesAuditedAndTraceable',TRUE,
      'lowAndHighCycleHeightVariantsRestored',TRUE,
      'terminalSprintTransitionIdentityDistinct',TRUE,
      'taxonomyAnatomyPlanesLateralityPresent',TRUE,
      'difficultyOnlyModelPresent',TRUE,
      'exerciseSkillClassificationAbsent',TRUE,
      'loadFatigueRecoveryPresent',TRUE,
      'equipmentEnvironmentPopulationPresent',TRUE,
      'deliveryDosageInstructionsAndStopRulesPresent',TRUE,
      'durationMeasurementAndDoseScalingPresent',TRUE,
      'athleteCoachAndOperationsSupportPresent',TRUE,
      'candidateEvidenceSectionsPresent',TRUE,
      'fiveMediaCandidatesPresent',TRUE,
      'alternateAssessmentsPresent',TRUE,
      'progressionRegressionAndSubstitutionProposalsPresent',TRUE,
      'complexityAndPhysicalCalibrationProposalsPresent',TRUE,
      'identitySequenceResolved',definition.slug=ANY(selectable_slugs),
      'structurallySelectableAfterApproval',definition.slug=ANY(selectable_slugs),
      'approvalsCreated',FALSE),
    CASE WHEN definition.slug=ANY(selectable_slugs) THEN jsonb_build_array(
      jsonb_build_object('code','CARD-EVIDENCE-02','message','Candidate evidence and authored section claims require independent review.'),
      jsonb_build_object('code','CARD-MEDIA-01','message','Five media candidates require playback, continuing availability, embedding, exact-match, complete-content, safety, caption, accessibility, and reviewer approval.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','Progression, regression, and substitution relationships remain review-only.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Complexity and physical-difficulty anchors remain review-only.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Two-person card review, version approval, media approval, and pilot evidence are incomplete.'))
    ELSE jsonb_build_array(
      jsonb_build_object('code','CARD-IDENTITY-06','message',definition.coach_support_json->>'programmingDecision'),
      jsonb_build_object('code','CARD-SELECTION-02','message','The definition and baseline profile are non-prescribable until the exact identity and ordered contact contract are approved.'),
      jsonb_build_object('code','CARD-EVIDENCE-02','message','Candidate evidence and authored section claims require independent review.'),
      jsonb_build_object('code','CARD-MEDIA-01','message','Five media candidates require complete human media verification and approval.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','Relationships to this definition remain blocked review candidates.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Complexity and physical-difficulty anchors remain review-only.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Identity resolution, two-person card review, media approval, and pilot evidence are incomplete.')) END,
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived'
  ON CONFLICT(definition_id)
  DO UPDATE SET facility_id=EXCLUDED.facility_id,
    card_version=EXCLUDED.card_version,schema_version=EXCLUDED.schema_version,
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_section_evidence_v1 evidence
    ON evidence.definition_id=definition.id
      AND evidence.reviewed_card_version=definition.card_version
  WHERE definition.slug=ANY(active_slugs) AND evidence.review_status='candidate';
  IF actual_count<>32 THEN
    RAISE EXCEPTION '% expected 32 candidate evidence rows; found %',migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_media_candidate_v1 media
    ON media.definition_id=definition.id
      AND media.reviewed_card_version=definition.card_version
  WHERE definition.slug=ANY(active_slugs) AND media.review_status='candidate'
    AND media.link_status='unverified' AND media.embedding_allowed=FALSE
    AND media.exact_variant_match IS NULL
    AND media.demonstration_quality_score IS NULL
    AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL;
  IF actual_count<>10 THEN
    RAISE EXCEPTION '% expected 10 quarantined media candidates; found %',migration_key,actual_count;
  END IF;
  IF EXISTS(
    SELECT 1 FROM(
      SELECT definition.slug,count(*) count
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_candidate_v1 media
        ON media.definition_id=definition.id
          AND media.reviewed_card_version=definition.card_version
      WHERE definition.slug=ANY(active_slugs) AND media.review_status='candidate'
      GROUP BY definition.slug) counts WHERE counts.count<>5
  ) THEN
    RAISE EXCEPTION '% requires exactly five current media candidates per card',migration_key;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_alternate_assessment_v1 alternate
    ON alternate.definition_id=definition.id
      AND alternate.reviewed_card_version=definition.card_version
  WHERE definition.slug=ANY(active_slugs) AND alternate.review_status='candidate';
  IF actual_count<>10 THEN
    RAISE EXCEPTION '% expected 10 candidate alternate assessments; found %',migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_delivery_profile_v1 profile
  JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE definition.slug=ANY(active_slugs) AND definition.status<>'archived'
    AND variant.status<>'archived' AND profile.status<>'archived';
  IF actual_count<>3 THEN
    RAISE EXCEPTION '% expected one active delivery profile per exact variant; found %',migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.id=relationship.from_variant_id
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.id=relationship.to_variant_id
  WHERE (from_variant.definition_id IN(
      SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(active_slugs))
    OR to_variant.definition_id IN(
      SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(active_slugs)))
    AND relationship.review_status='review'
    AND relationship.reviewed_by IS NULL AND relationship.reviewed_at IS NULL;
  IF actual_count<>6 THEN
    RAISE EXCEPTION '% expected three authored and three inverse graph proposals; found %',migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_score_calibration_v1 calibration
  JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE definition.slug=ANY(active_slugs) AND variant.status<>'archived'
    AND calibration.status='review'
    AND calibration.dimension IN('technicalComplexity','absoluteLoadDemand')
    AND calibration.reviewed_by IS NULL AND calibration.reviewed_at IS NULL;
  IF actual_count<>6 THEN
    RAISE EXCEPTION '% expected six review-only calibration rows; found %',migration_key,actual_count;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    WHERE definition.slug=ANY(active_slugs) AND variant.status<>'archived'
      AND ((variant.difficulty_json->>'baseOverallDifficulty')::SMALLINT
        <>greatest((variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT)
        OR (variant.programming_profile_json->>'overallDifficulty')::SMALLINT
        <>greatest((variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT))
  ) THEN
    RAISE EXCEPTION '% found overall difficulty outside max(complexity, physical)',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    JOIN coaching.exercise_delivery_profile_v1 profile ON profile.variant_id=variant.id
    WHERE definition.slug=ANY(active_slugs)
      AND NOT(definition.slug=ANY(selectable_slugs))
      AND variant.status<>'archived' AND profile.status<>'archived'
      AND (coalesce((variant.requirements_json->>'selectable')::BOOLEAN,TRUE)
        OR profile.role<>'avoid' OR profile.phase_suitability<>1)
  ) THEN
    RAISE EXCEPTION '% found an unresolved card that remains selectable',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.slug=ANY(active_slugs)
      AND (definition.status<>'review' OR definition.card_version<>2
        OR definition.reviewed_by IS NOT NULL OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR definition.approved_video_url IS NOT NULL)
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_card_test_packet_v1 packet
    JOIN coaching.exercise_definition_v1 definition ON definition.id=packet.definition_id
    WHERE definition.slug=ANY(active_slugs)
      AND (packet.status<>'quarantined' OR NOT packet.human_review_required)
  ) THEN
    RAISE EXCEPTION '% created or retained an approval outside the review workflow',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
      JOIN coaching.exercise_definition_v1 definition ON definition.id=packet.definition_id
      WHERE definition.slug=ANY(active_slugs) AND packet.audit_version=migration_key)<>2 THEN
    RAISE EXCEPTION '% expected two current quarantined test packets',migration_key;
  END IF;
END
$$;
