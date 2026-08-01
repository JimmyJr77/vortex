-- Retire two non-atomic ankling/pogo labels and add the exact wall-lean,
-- same-leg repeated-contact option to the existing Single-Leg Pogo card.
--
-- Legacy 947 does not identify support, displacement, laterality, contact order,
-- or finish. Legacy 1085 adds wall pressure and posture but still does not say
-- whether contacts are bilateral, alternating, or repeated on one leg. Neither
-- source is mapped to the exact variant. Link health and automated visual
-- research remain candidate evidence and never create human approval.
-- Exercise difficulty is complexity plus physical difficulty; overall is the
-- maximum. Athlete proficiency belongs only to coaching.skill.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '425_coaching_ankling_pogo_identity_resolution';
  free_legacy_slug CONSTANT TEXT := 'ankling-pogo-hop';
  wall_legacy_slug CONSTANT TEXT := 'wall-ankling-pogo';
  survivor_slug CONSTANT TEXT := 'single-leg-pogo';
  wall_variant_id CONSTANT UUID :=
    '0f5e6a8e-784c-43ae-8420-78e3f3940282'::UUID;
  relationship_id CONSTANT UUID :=
    'f70b8906-b8b9-4744-a432-143eab0f9f40'::UUID;
  complexity_calibration_id CONSTANT UUID :=
    'a066f47d-7f97-426e-895b-7e89e38e1954'::UUID;
  physical_calibration_id CONSTANT UUID :=
    '7996ddde-ad4f-44c2-97b7-02dd10151ab7'::UUID;
  free_legacy_id UUID;
  wall_legacy_id UUID;
  survivor_id UUID;
  balance_variant_id UUID;
  already_applied_count INTEGER;
  protected_count INTEGER;
  actual_count INTEGER;
BEGIN
  SELECT id INTO free_legacy_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=free_legacy_slug;
  SELECT id INTO wall_legacy_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=wall_legacy_slug;
  SELECT id INTO survivor_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=survivor_slug;
  SELECT id INTO balance_variant_id FROM coaching.exercise_variant_v1
  WHERE definition_id=survivor_id
    AND variant_key='supported-stationary-low-amplitude';

  IF free_legacy_id IS NULL OR wall_legacy_id IS NULL OR survivor_id IS NULL
      OR balance_variant_id IS NULL THEN
    RAISE EXCEPTION '% requires both legacy cards, the Single-Leg Pogo card, and its supported baseline',
      migration_key;
  END IF;

  SELECT count(*) INTO already_applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=survivor_id
    AND definition.provenance_json->>'wallLeanVariantMigration'=migration_key;
  IF already_applied_count NOT IN(0,1) THEN
    RAISE EXCEPTION '% found partial prior application',migration_key;
  END IF;

  IF already_applied_count=0 THEN
    IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id IN(free_legacy_id,wall_legacy_id)
         AND definition.status='review' AND definition.card_version=2)<>2 THEN
      RAISE EXCEPTION '% expected two active legacy review cards at version 2',
        migration_key;
    END IF;
    IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=survivor_id AND definition.status='review'
        AND definition.card_version=2
    ) THEN
      RAISE EXCEPTION '% expected Single-Leg Pogo review card version 2',
        migration_key;
    END IF;
    IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_source_v1 source
      WHERE source.definition_id=free_legacy_id
        AND source.legacy_exercise_id=947
    ) OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_source_v1 source
      WHERE source.definition_id=wall_legacy_id
        AND source.legacy_exercise_id=1085
    ) THEN
      RAISE EXCEPTION '% requires the original 947 and 1085 source lineage',
        migration_key;
    END IF;
  ELSE
    IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id IN(free_legacy_id,wall_legacy_id)
         AND definition.status='archived' AND definition.card_version=3)<>2
       OR NOT EXISTS(
         SELECT 1 FROM coaching.exercise_definition_v1 definition
         WHERE definition.id=survivor_id
           AND definition.status IN('review','published','deprecated')
           AND definition.card_version=3)
       OR NOT EXISTS(
         SELECT 1 FROM coaching.exercise_variant_v1 variant
         WHERE variant.id=wall_variant_id AND variant.definition_id=survivor_id
           AND variant.status IN('review','published')) THEN
      RAISE EXCEPTION '% found prior-application drift',migration_key;
    END IF;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1 variant
    WHERE variant.id=wall_variant_id
      AND(variant.definition_id<>survivor_id
        OR variant.variant_key<>'wall-lean-stationary-single-leg')
  ) THEN
    RAISE EXCEPTION '% found unexpected stable variant identity',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.resolution_source='human_review'
      AND resolution.reviewed_by IS NOT NULL
      AND(
        resolution.survivor_definition_id IN(
          free_legacy_id,wall_legacy_id,survivor_id)
        OR resolution.resolved_definition_id IN(
          free_legacy_id,wall_legacy_id,survivor_id))
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',
      migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.id IN(free_legacy_id,wall_legacy_id,survivor_id)
        AND(definition.status IN('published','deprecated')
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      WHERE evidence.definition_id IN(
          free_legacy_id,wall_legacy_id,survivor_id)
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id IN(
          free_legacy_id,wall_legacy_id,survivor_id)
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      WHERE alternate.definition_id IN(
          free_legacy_id,wall_legacy_id,survivor_id)
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      WHERE review.definition_id IN(
        free_legacy_id,wall_legacy_id,survivor_id))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      WHERE revision.definition_id IN(
        free_legacy_id,wall_legacy_id,survivor_id))
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      WHERE review.definition_id IN(
        free_legacy_id,wall_legacy_id,survivor_id))
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      WHERE variant.definition_id IN(
          free_legacy_id,wall_legacy_id,survivor_id)
        AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      WHERE variant.definition_id IN(
          free_legacy_id,wall_legacy_id,survivor_id)
        AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
          OR variant.id=relationship.to_variant_id
      WHERE variant.definition_id IN(
          free_legacy_id,wall_legacy_id,survivor_id)
        AND(relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      WHERE variant.definition_id IN(
          free_legacy_id,wall_legacy_id,survivor_id)
        AND(calibration.status<>'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id IN(947,1085)
        AND(score.human_review_status<>'queued'
          OR score.reviewed_by IS NOT NULL OR score.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  IF already_applied_count=0 THEN
    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status='archived',updated_at=now()
    FROM coaching.exercise_variant_v1 variant
    WHERE profile.variant_id=variant.id
      AND variant.definition_id IN(free_legacy_id,wall_legacy_id)
      AND profile.status<>'archived';

    UPDATE coaching.exercise_variant_v1 variant
    SET status='archived',
      requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
        ||jsonb_build_object(
          'selectable',FALSE,'identityQuarantine',TRUE,
          'retirementReason','legacy label omits an exact ordered contact contract',
          'retirementMigration',migration_key),
      updated_at=now()
    WHERE variant.definition_id IN(free_legacy_id,wall_legacy_id)
      AND variant.status<>'archived';

    UPDATE coaching.exercise_section_evidence_v1 evidence
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE evidence.definition_id IN(free_legacy_id,wall_legacy_id)
      AND evidence.review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1 media
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,
      updated_at=now()
    WHERE media.definition_id IN(free_legacy_id,wall_legacy_id)
      AND media.review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 alternate
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE alternate.definition_id IN(free_legacy_id,wall_legacy_id)
      AND alternate.review_status='candidate';

    UPDATE coaching.exercise_definition_v1 definition
    SET card_version=3,status='archived',reviewed_by=NULL,approved_by=NULL,
      last_reviewed_at=NULL,approved_video_url=NULL,
      description=CASE definition.id
        WHEN free_legacy_id THEN
          'Archived nonprescribable legacy label: the source does not define support, laterality, displacement, ordered contacts, dose unit, or finish. Use an exact reviewed pogo or ankling card instead.'
        ELSE
          'Archived nonprescribable legacy label: the source declares wall pressure and posture but not bilateral, alternating, or same-leg contacts, flight, dose unit, or finish. Use an exact reviewed wall drill or pogo variant instead.' END,
      provenance_json=definition.provenance_json||jsonb_build_object(
        'identityRetirementMigration',migration_key,
        'researchVersion','2026-08-01.4',
        'retirementReason','non_atomic_legacy_label_missing_ordered_contact_contract',
        'selectable',FALSE,'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE,'approvalsCreated',FALSE),
      updated_at=now()
    WHERE definition.id IN(free_legacy_id,wall_legacy_id);

    UPDATE coaching.exercise_section_evidence_v1 evidence
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE evidence.definition_id=survivor_id
      AND evidence.reviewed_card_version=2
      AND evidence.review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1 media
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,
      updated_at=now()
    WHERE media.definition_id=survivor_id
      AND media.reviewed_card_version=2
      AND media.review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 alternate
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE alternate.definition_id=survivor_id
      AND alternate.reviewed_card_version=2
      AND alternate.review_status='candidate';
  END IF;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=3,status='review',reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    movement_patterns=ARRAY(
      SELECT DISTINCT key FROM unnest(
        coalesce(definition.movement_patterns,'{}')
          ||ARRAY['jump','brace']) key ORDER BY key),
    body_regions=ARRAY(
      SELECT DISTINCT key FROM unnest(
        coalesce(definition.body_regions,'{}')
          ||ARRAY['foot','ankle','knee','hip','core','hand','wrist','elbow','shoulder']) key
      ORDER BY key),
    optional_equipment=ARRAY(
      SELECT DISTINCT key FROM unnest(
        coalesce(definition.optional_equipment,'{}')||ARRAY['wall']) key
      ORDER BY key),
    anatomy_json=definition.anatomy_json||jsonb_build_object(
      'wallLeanVariant',jsonb_build_object(
        'support','two_hand_intentional_wall_pressure',
        'bodyLine','forward_lean_aligned_without_waist_fold',
        'contactSequence','same_leg_repeated_contacts_then_controlled_reset',
        'oppositeLeg','declared_recovery_position_held',
        'upperBodyJoints',jsonb_build_array('hand','wrist','elbow','shoulder'),
        'upperBodyActions',jsonb_build_array(
          'isometric_wall_brace','scapular_control','trunk_alignment'))),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'wallLeanVariantMigration',migration_key,
      'researchBatch','wall-lean-single-leg-pogo-variant-v1',
      'researchVersion','2026-08-01.4',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'legacyLabelsRetired',jsonb_build_array(
        free_legacy_slug,wall_legacy_slug),
      'legacySourcesMappedToExactVariant',FALSE,
      'mediaState','candidate_oembed_healthy_embedding_metadata_only',
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
      'approvalsCreated',FALSE),
    updated_at=now()
  WHERE definition.id=survivor_id;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES(
    wall_variant_id,survivor_id,'wall-lean-stationary-single-leg',
    'Wall-Lean Stationary Single-Leg Pogo',
    ARRAY['unilateral','wall_lean','stationary','same_leg_repeated_contacts',
      'low_amplitude'],
    jsonb_build_object(
      'technicalComplexity',48,'absoluteLoadDemand',52,
      'baseOverallDifficulty',52,'coordinationDemand',50,
      'supervisionDemand',44,'failureConsequence',42,'impact',4,
      'workCapacityDemand',50,
      'difficultyModel','max_exercise_complexity_physical_difficulty'),
    jsonb_build_object(
      'selectable',TRUE,'side','declared_and_recorded_separate_sets',
      'support','two_hands_intentional_pressure_on_immovable_wall_or_rated_rack',
      'bodyLine','forward_lean_aligned_from_support_foot_through_trunk',
      'action','same_leg_repeated_low_amplitude_ankle_dominant_hops',
      'oppositeLeg','declared_hip_flexion_recovery_position_held',
      'direction','stationary','footReturn','beneath_hip',
      'landingContactsPerRep',1,
      'finish','controlled_two_foot_reset_before_side_change',
      'terminalStickBetweenContacts',FALSE,
      'identityQuarantine',FALSE,
      'researchVersion','2026-08-01.4'),
    'review',
    jsonb_build_object(
      'externalLoadMethod','bodyweight_with_declared_wall_lean_and_pressure',
      'externalLoadDescription','wall-braced unilateral repeated low-amplitude contacts on one declared leg',
      'landingContactsPerRep',1,'eccentricStress',52,'spinalLoading',18,
      'gripDemand',14,
      'loadTracking',jsonb_build_array(
        'side','body_angle','hand_position','recovery_leg_position','contacts',
        'cadence','amplitude','surface','footwear','contact_quality')),
    jsonb_build_object(
      'localMuscleFatigue',56,'impactAccumulation',58,
      'technicalFatigueSensitivity',64,'gripFatigue',10,'recoveryHours',36,
      'primaryFatigueSites',jsonb_build_array(
        'foot','calf','Achilles_tendon','lateral_hip','hip_flexors','shoulder_girdle'),
      'stopBefore',jsonb_build_array(
        'wall_pressure_or_body_line_changes','contact_loud_or_slow',
        'foot_reaches_or_drifts','recovery_leg_drops','alignment_changes','symptom')),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array(
        'wall_lean_unilateral_ankle_spring','same_leg_contact_rhythm',
        'forward_body_line_control','foot_calf_Achilles_tolerance'),
      'prerequisites',jsonb_build_array(
        'pain_free_bilateral_pogo_or_calf_raise',
        'controlled_single_leg_landing','safe_wall_lean_and_two_foot_exit'),
      'stimulusDose',jsonb_build_object(
        'primary','quality_contacts_per_side','fatigueCeiling','low'),
      'cumulativeBudget',jsonb_build_object(
        'impact',58,'calfAchilles',60,'technicalSensitivity',64,
        'upperBodyBrace',20),
      'weeklyExposure',jsonb_build_object(
        'typical',1,'maximumWithoutReview',2),
      'sequenceRules',jsonb_build_array(
        'fresh_preparation_or_elastic_output','count_every_landing_contact',
        'complete_one_side_then_reset_before_changing'),
      'completionCriteria',jsonb_build_array(
        'same_body_line_both_sides','stable_wall_pressure',
        'quiet_repeatable_contacts','foot_returns_under_hip',
        'recovery_leg_position_held','controlled_two_foot_exit'),
      'pairingCompatibility',jsonb_build_object(
        'preferred',jsonb_build_array(
          'acceleration_posture_preparation','lower_leg_elastic_preparation'),
        'avoid',jsonb_build_array(
          'post_fatigue_impact','crowded_wall_station','untracked_jump_or_sprint_volume')),
      'uncertaintyPolicy',jsonb_build_object(
        'symptom','stop','contact_or_body_line_fails',
        'reduce_contacts_or_use_light_balance_supported_variant')))
  ON CONFLICT(definition_id,variant_key)
  DO UPDATE SET id=wall_variant_id,display_name=EXCLUDED.display_name,
    modifier_keys=EXCLUDED.modifier_keys,difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,
    updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT wall_variant_id,profile.profile_key,profile.phase_key,profile.role,
    profile.purpose,profile.suitability,profile.alignment,
    profile.objective_relevance,profile.dosage,
    'Every counted contact uses the same declared leg, forward body line, stable wall pressure, opposite-leg hold, quiet low amplitude, foot return beneath the hip, and controlled two-foot exit.',
    ARRAY[
      'Stop for pain, guarding, numbness, dizziness, or unusual breathlessness.',
      'Stop if the wall, rack, hands, footwear, or support foot slips.',
      'Stop when body line, wall pressure, recovery-leg position, contact sound, cadence, foot return, knee-pelvis alignment, or breathing changes.',
      'Stop after two consecutive contacts fail the quality gate.'
    ],
    'Verify the support and floor, declare side and recovery position, demonstrate setup and two-foot exit, count every landing, compare sides, and record the first quality failure.',
    'Push the stable wall, keep one long body line, hold the opposite thigh, make small same-leg bounces under the hip, count each landing, and step down before changing sides.',
    profile.adaptation,ARRAY['wall']::TEXT[],
    jsonb_build_object(
      'setupSeconds',35,'transitionSeconds',20,'athletesPerStation',1,
      'stableSupportRequired',TRUE,'clearExitRequired',TRUE,
      'stationFootprintMeters',jsonb_build_object('width',3,'length',3)),
    ARRAY[balance_variant_id]::UUID[],'review',
    jsonb_build_object(
      'setupSeconds',35,'secondsPerContact',1,
      'sideTransitionSeconds',20,'durationFormula',
        'setup + side_sets * contacts + side_transition + interset_rest',
      'estimatedDurationSecondsMin',profile.duration_min,
      'estimatedDurationSecondsMax',profile.duration_max,
      'workDose',profile.dosage),
    jsonb_build_object(
      'scaleDown',jsonb_build_array(
        'reduce_contacts','reduce_amplitude','reduce_cadence',
        'lower_recovery_leg_position','increase_rest',
        'use_light_balance_supported_variant'),
      'scaleUp',jsonb_build_array(
        'improve_symmetry','add_contacts_within_cap','add_one_set_within_cap'),
      'neverScaleBy',jsonb_build_array(
        'adding_external_load','turning_into_alternating_switches',
        'continuing_through_symptoms_or_quality_loss')),
    jsonb_build_object(
      'repUnit','one_landing_contact_on_declared_support_leg',
      'record',jsonb_build_array(
        'variant_key','side','wall_or_rack','body_angle','hand_position',
        'recovery_leg_position','target_contacts','actual_contacts','cadence',
        'amplitude','surface','footwear','quality_pass','symptoms','stop_reason'),
      'failureRule','The first symptom, slip, body-line change, wall-pressure change, recovery-leg change, loud or slow contact, reach, heel slam, alignment drift, or unsafe exit ends the set.'),
    jsonb_build_object(
      'coachPrompt','Record actual contacts and first quality failure separately for each side; never count left-right cycles.',
      'athletePrompt','Report foot, ankle, Achilles, calf, knee, hip, back, hand, wrist, elbow, or shoulder symptoms immediately.',
      'accessibilityPrompt','Offer fewer contacts, lower amplitude, slower cadence, longer rest, lower recovery position, the light-balance supported variant, or a bilateral pogo substitution.')
  FROM(VALUES
    ('wall-lean-patterning','prepare_and_access','primary',
      'Learn a stable wall-lean body line and same-leg contact rhythm without free-balance or travel demand.',
      78,86,
      jsonb_build_object('movementLearning',92,'lowerLegPreparation',82,
        'accelerationPosture',72,'conditioning',10),
      jsonb_build_object(
        'setsPerSide',jsonb_build_object('min',1,'max',3,'default',2),
        'contactsPerSet',jsonb_build_object('min',6,'max',10,'default',8),
        'restSeconds',jsonb_build_object('min',45,'max',90,'default',60),
        'stopAtTechnicalRir',4,'maximumContactsPerSide',30),
      'repeatable wall-lean same-leg contact pattern with conservative exposure',
      177,440),
    ('wall-lean-elastic-output','output','secondary',
      'Express low-amplitude unilateral ankle spring in a fixed forward body line while preserving full contact quality.',
      72,82,
      jsonb_build_object('elasticOutput',86,'accelerationPreparation',76,
        'lowerLegCapacity',68,'conditioning',8),
      jsonb_build_object(
        'setsPerSide',jsonb_build_object('min',2,'max',4,'default',3),
        'contactsPerSet',jsonb_build_object('min',6,'max',12,'default',8),
        'restSeconds',jsonb_build_object('min',75,'max',120,'default',90),
        'stopAtTechnicalRir',3,'maximumContactsPerSide',40),
      'quality-limited unilateral elastic contacts with stable wall pressure and side symmetry',
      361,1007)
  ) profile(profile_key,phase_key,role,purpose,suitability,alignment,
    objective_relevance,dosage,adaptation,duration_min,duration_max)
  ON CONFLICT(variant_id,profile_key)
  DO UPDATE SET phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,
    purpose=EXCLUDED.purpose,phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,
    substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  CREATE TEMP TABLE family_packet_seed(
    packet_slug TEXT PRIMARY KEY,research_version TEXT NOT NULL,
    packet_json JSONB NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_packet_seed VALUES
  -- BEGIN GENERATED CANONICAL RESEARCH PACKETS
    ('single-leg-pogo','2026-08-01.4',$packet${"assessmentSummary":{"identity":"From a declared forward wall lean, both hands maintain firm contact with an immovable support while one declared leg performs repeated low-amplitude ankle-dominant hops in place and the opposite thigh remains held in the declared recovery position. Each landing contact is counted; legs change only after a controlled reset.","currentCardFindings":["The existing Single-Leg Pogo definition already treats support as a variant dimension, but its supported baseline permits only light balance assistance and does not define a forward wall lean or intentional wall pressure.","Legacy Ankling Pogo Hop is generic template text that omits support, laterality, ordered contacts, displacement, and finish; it cannot be prescribed as an exact exercise.","Legacy Wall Ankling Pogo declares wall pressure and stacked posture but omits whether contacts are bilateral, alternating, or repeated on one leg; it also cannot be prescribed as an exact exercise.","A public Wall Drill SL Pogo candidate was visually inspected and showed a wall-supported forward lean with one leg repeatedly contacting while the opposite leg remained raised. This is automated candidate evidence, not human media approval.","Five exact-title candidates returned current YouTube oEmbed metadata and iframe markup; human exact-match and demonstration review remain mandatory."],"proposedTaxonomy":{"movementPatterns":["jump","brace"],"jointActions":["repeated_support_leg_ankle_plantarflexion_and_dorsiflexion","short_range_support_knee_flexion_extension","contralateral_hip_flexion_hold","shoulder_elbow_and_trunk_isometric_wall_brace"],"planes":["sagittal","frontal_and_transverse_control"],"laterality":"unilateral_repeated_contacts_with_separate_left_and_right_sets","sequence":"establish_wall_lean__raise_nonworking_thigh__repeat_same_leg_contacts__controlled_reset__change_side","intent":"low_amplitude_unilateral_ankle_spring_with_forward_body_line_and_stable_wall_pressure"},"proposedAnatomy":{"primaryMuscles":["soleus","gastrocnemius","foot_intrinsics"],"secondaryMuscles":["tibialis_anterior","quadriceps","gluteus_medius","hip_flexors","abdominal_wall","serratus_anterior"],"joints":["foot","ankle","knee","hip","pelvis","lumbar_spine","shoulder","elbow","wrist","hand"],"primaryActions":["same_leg_repeated_low_amplitude_hopping","opposite_thigh_position_hold","forward_lean_wall_brace"]},"proposedDifficulty":{"technicalComplexity":48,"absoluteLoadDemand":52,"coordinationDemand":50,"supervisionDemand":44,"failureConsequence":42,"impact":4,"workCapacityDemand":50,"baseOverallDifficulty":52,"formula":"max(technicalComplexity, absoluteLoadDemand)"},"variantDifficultyCandidates":[{"variantKey":"wall-lean-stationary-single-leg","exerciseComplexity":48,"physicalDifficulty":52,"derivedOverallDifficulty":52}],"proposedLoadProfile":{"loadingType":"bodyweight_wall_braced_unilateral_repeated_low_amplitude_plyometric","impactClass":"moderate_unilateral_by_contact_count_amplitude_surface_and_body_angle","landingContactsPerRep":1,"externalLoadMethod":"bodyweight_with_declared_wall_lean_and_pressure","loadTracking":["side","body_angle","hand_position","recovery_leg_position","contacts","cadence","amplitude","surface","footwear","quality","symptoms"],"primaryStress":["foot_calf_Achilles_cyclic_load","single_leg_impact","hip_pelvis_control","wall_brace"]},"proposedFatigueRecovery":{"primaryFatigueSites":["foot","calf","Achilles_tendon","lateral_hip","hip_flexors","shoulder_girdle"],"technicalSensitivity":["body_line_rises_or_sags","wall_pressure_changes","contact_becomes_loud_or_slow","foot_drifts","recovery_leg_drops","side_difference"],"recoveryHours":"twenty_four_to_forty_eight_after_moderate_contact_volume_subject_to_symptoms_and_overlapping_running_jumping_or_calf_work","cumulativeBudget":{"impact":58,"calfAchilles":60,"technicalSensitivity":64,"upperBodyBrace":20}},"proposedConstraints":{"requiredEquipment":["immovable_non_slip_wall_or_rated_rack","flat_dry_high_traction_surface","appropriate_footwear"],"optionalEquipment":["floor_marker","contact_counter","cadence_feedback","video"],"environment":["hands_and_feet_cannot_slip","clear_station_and_exit","no_cross_traffic","one_athlete_per_wall_station"],"population":["pain_free_bilateral_pogo_or_calf_raise","controlled_single_leg_landing","can_hold_declared_wall_lean_and_recovery_leg_position","can_stop_on_command"]},"proposedDosage":{"patterning":"one_to_three_sets_of_six_to_ten_contacts_per_side_with_forty_five_to_ninety_seconds_rest","elasticOutput":"two_to_four_sets_of_six_to_twelve_contacts_per_side_with_seventy_five_to_one_hundred_twenty_seconds_rest","maximumWithoutReview":"forty_quality_contacts_per_side_in_one_session","measurement":"count_each_landing_contact_and_record_actual_contacts_per_side_not_round_trips_or_time_alone","progressWhen":"both sides preserve the same body line, wall pressure, recovery position, quiet contact, foot return, cadence, and controlled reset"},"proposedInstructions":{"coachCues":["Push the wall","Long line through the stance leg","Hold the opposite thigh","Bounce under the hip","Quick and quiet"],"athleteInstructions":["Confirm the wall or rack cannot move or slip and that the floor and shoes are dry.","Place both hands at the declared height, walk the feet back, and establish the coached forward body line without bending at the waist.","Shift to the declared support leg and hold the opposite thigh in the prescribed recovery position.","Perform small repeated hops on the same support leg; return the foot beneath the hip and count every landing contact.","Stop while contacts remain quick and quiet, regain a two-foot stance, then reset before changing sides."],"commonFaults":["alternating_legs_inside_the_set","wall_or_hands_slip","waist_folds_or_ribs_flare","recovery_leg_drops_or_cycles","foot_reaches_forward","heel_slams","contact_height_or_sound_drifts","counting_cycles_instead_of_contacts"]},"proposedSafety":{"readiness":["support_and_surface_inspection","pain_free_low_pogo_and_single_leg_landing","controlled_setup_and_two_foot_exit","stop_signal_understood"],"qualityGates":["same_leg_contacts_only","body_line_and_wall_pressure_stable","foot_returns_under_hip","quiet_repeatable_low_amplitude_contacts","recovery_leg_position_stable","controlled_two_foot_reset"],"stopRules":["pain_guarding_numbness_dizziness_or_unusual_breathlessness","wall_rack_hand_or_foot_slip","body_line_wall_pressure_or_recovery_leg_position_changes","loud_slow_or_lengthening_contact","heel_slam_or_foot_reach","knee_pelvis_or_trunk_control_changes","two_consecutive_contacts_fail_quality"]},"proposedContextualProfiles":[{"context":"prepare_and_access_wall_lean_patterning","dose":"one_to_three_sets_of_six_to_ten_contacts_per_side","purpose":"learn_same_leg_contact_rhythm_and_forward_body_line_with_a_stable_support"},{"context":"output_wall_lean_elastic_contacts","dose":"two_to_four_sets_of_six_to_twelve_contacts_per_side","purpose":"express low_amplitude_unilateral_ankle_spring_without_free_balance_or_travel"}],"proposedRelationships":{"lateralSubstitution":["supported_stationary_low_amplitude_single_leg_pogo_when_balance_assistance_not_forward_wall_pressure_is_the_goal"],"progressions":["unsupported_stationary_single_leg_pogo_after_wall_lean_and_balance_supported_variants_are_controlled"],"doNotMerge":["wall_drill_march","wall_drill_switch","wall_supported_alternating_stride_pogo","ankling_drill","bilateral_ankle_pogo"]},"programmingDecision":"Archive the two non-atomic legacy Ankling Pogo labels as nonprescribable evidence. Add this exact wall-lean same-leg repeated-contact task as a review-only variant of Single-Leg Pogo. Do not map either ambiguous legacy source to the variant, and do not publish until human content, media, calibration, relationship, pilot, and card review are complete.","currentCardSnapshot":{"capturedAt":"2026-08-01T22:30:00.000Z","cardVersion":2,"status":"review","description":"Balance on the declared leg with support, direction, amplitude, cadence, arm action, contact count, and finish rule specified by the exact variant. Perform repeated low-amplitude ankle-dominant hops with a tall organized trunk, the foot returning under the hip or to the declared line, the knee tracking with the foot, and the pelvis controlled. Use quick quiet contacts without an intentional stick between repetitions; stop before contact time, sound, alignment, height, direction, or symptoms change.","familyKey":"repeated_unilateral_ankle_dominant_pogo","movementPatterns":["jump","locomote"],"bodyRegions":["foot","ankle","knee","hip","core"],"requiredEquipment":[],"optionalEquipment":["line_tape","wall","mat"],"environment":{"setup":{"footwearAndSurfaceRecorded":true,"side_support_direction_amplitude_cadence_contacts_and_finish_declared":true},"space":{"runOutMeters":3,"travelLaneMeters":{"target":8,"maximum":12,"minimum":5},"crossTrafficProhibited":true,"stationaryRadiusMeters":1.5},"record":["side","support","direction","amplitude","cadence","contacts","distance","contact_quality","finish_rule"],"surface":{"avoid":["wet","uneven","very_hard_for_high_volume","soft_unstable"],"required":"flat_dry_stable_high_traction_with_appropriate_compliance"},"traffic":{"coachSightlineRequired":true,"stationSeparationMeters":2.5,"oneAthletePerLaneOrStation":true}},"population":{"useCaution":["current_foot_ankle_achilles_calf_knee_hip_or_back_symptoms","recent_lower_extremity_procedure","limited_unilateral_impact_exposure","large_side_difference"],"doNotUseWhen":["pain_or_limp","unsafe_surface_or_lane","cannot_control_supported_low_amplitude_variant","contacts_are_loud_slow_or_unstable","fatigue_already_changes_landing"],"medicalScope":"This card is not rehabilitation prescription, tendon treatment, or clearance.","prerequisites":["pain_free_bilateral_pogo_or_repeated_calf_raise","controlled_single_leg_stance","can_land_single_leg_quietly","understands_contact_and_stop_rule"],"regressionOrder":["supported_stationary","fewer_contacts","lower_amplitude","slower_declared_cadence","bilateral_pogo_substitution"]},"difficulty":{},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube oEmbed returned current public metadata and iframe markup for all five candidates on 2026-08-01.","Availability and embed metadata do not establish exact movement identity, complete playback, safety, cue quality, captions, accessibility, reviewer identity, or approval."]},{"sectionKey":"identity","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["World Athletics defines a wall-supported forward acceleration body position with hands on a stationary object and the torso aligned with the support leg.","The pogo variant adds repeated same-leg flight contacts; laterality, contact order, opposite-leg position, body angle, support pressure, count unit, and finish must remain explicit."]},{"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/24290613/","sourceTitle":"Leg stiffness: comparison between unilateral and bilateral hopping tasks","sourcePublisher":"Human Movement Science","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Repeated unilateral hopping is mechanically distinct from bilateral hopping.","Wall lean and intentional wall pressure are exact support and posture dimensions within the Single-Leg Pogo identity, not athlete skill levels."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/24290613/","sourceTitle":"Leg stiffness: comparison between unilateral and bilateral hopping tasks","sourcePublisher":"Human Movement Science","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Foot, ankle, knee, hip, pelvis, and trunk coordinate repeated unilateral contacts.","Wall support adds hand, wrist, elbow, shoulder-girdle and trunk bracing without changing the contact leg's unilateral identity."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/24290613/","sourceTitle":"Leg stiffness: comparison between unilateral and bilateral hopping tasks","sourcePublisher":"Human Movement Science","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Unilateral hopping stiffness behavior differs from bilateral hopping and depends on the exact task.","Body angle, contact cadence, amplitude and wall force are unmeasured constraints here; no sprint-transfer or stiffness-value claim is inferred."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10105022/","sourceTitle":"The effects of plyometric jump training on lower-limb stiffness in healthy individuals: A meta-analytical comparison","sourcePublisher":"Journal of Sport and Health Science","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Unilateral impact and repeated contact control drive physical difficulty; forward wall posture, same-leg rhythm and opposite-leg hold drive complexity.","Overall difficulty is the maximum of exercise complexity and physical difficulty; athlete proficiency is excluded from exercise cards."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10105022/","sourceTitle":"The effects of plyometric jump training on lower-limb stiffness in healthy individuals: A meta-analytical comparison","sourcePublisher":"Journal of Sport and Health Science","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Every landing counts toward unilateral impact and foot-calf-Achilles exposure even at low amplitude.","Track overlapping running, jumping, calf, ankle and wall-brace work and stop before contact or posture changes."]},{"sectionKey":"constraints","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["The wall or stationary object and the athlete's body line are material setup constraints.","Require an immovable nonslip support, dry high-traction floor, clear station, practiced setup, and controlled exit."]},{"sectionKey":"dosage","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10105022/","sourceTitle":"The effects of plyometric jump training on lower-limb stiffness in healthy individuals: A meta-analytical comparison","sourcePublisher":"Journal of Sport and Health Science","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Plyometric dose depends on contact exposure and task characteristics.","The proposed contact ranges and recovery windows are conservative programming proposals requiring coach and pilot review."]},{"sectionKey":"instructions","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Wall drills require an explicit body position and support-leg alignment rather than generic jump cues.","Instructions separately define hand placement, body line, same-leg contacts, opposite-leg hold, contact counting, reset and side change."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10105022/","sourceTitle":"The effects of plyometric jump training on lower-limb stiffness in healthy individuals: A meta-analytical comparison","sourcePublisher":"Journal of Sport and Health Science","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Repeated hopping creates task-specific lower-limb stiffness and impact demands.","Stop for symptoms, slipping, body-line loss, loud or slow contacts, heel slam, reach, alignment drift, recovery-leg change or failed reset."]},{"sectionKey":"programming","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Wall-supported drills can teach acceleration-oriented posture and force direction.","This pogo remains a low-amplitude unilateral contact task and must not be claimed as equivalent to sprinting, marching or switching."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/24290613/","sourceTitle":"Leg stiffness: comparison between unilateral and bilateral hopping tasks","sourcePublisher":"Human Movement Science","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Athletes need a clear distinction between expected foot-calf effort and symptoms that require stopping.","Show setup, same-leg contact, opposite-leg hold, contact count, two-foot exit, side change and a nonvideo text alternative."]},{"sectionKey":"coach_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10105022/","sourceTitle":"The effects of plyometric jump training on lower-limb stiffness in healthy individuals: A meta-analytical comparison","sourcePublisher":"Journal of Sport and Health Science","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Task-specific stiffness cannot be inferred from appearance alone.","Record side, body angle, support, recovery position, actual contacts, cadence, amplitude, surface, footwear, quality, symptoms and stop reason."]},{"sectionKey":"accessibility","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/24290613/","sourceTitle":"Leg stiffness: comparison between unilateral and bilateral hopping tasks","sourcePublisher":"Human Movement Science","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Support can reduce balance demand while preserving unilateral contact exposure.","Scale contacts, amplitude, cadence, recovery-position height and rest; use the existing light-balance or bilateral variant when the wall-lean contract cannot be preserved."]},{"sectionKey":"alternates","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Wall march and continuous wall sprint have explicit alternating leg actions distinct from same-leg repeated pogo contacts.","Light-balance support is a different Single-Leg Pogo variant; alternating stride pogos and wall switches require separate ordered-contact definitions."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=uLagcbggFjs","title":"Wall Drill SL Pogo","channelName":"Kinetic | Sports Physical Therapy | Delafield, WI","sourceQuery":"wall single leg pogo","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-08-01T22:00:00.000Z"},"notes":"oEmbed returned current metadata and iframe markup. Automated visual inspection observed a wall lean with repeated same-leg contacts and the opposite leg held raised. Full human exact-match, safety, cue, caption, accessibility, quality, reviewer, and approval review remain pending.","exactVariantMatch":null,"reviewStatus":"candidate"},{"url":"https://www.youtube.com/watch?v=iprr4n3k_rk","title":"Wall supported single leg pogo hop","channelName":"thespotter123","sourceQuery":"wall single leg pogo","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-08-01T22:00:00.000Z"},"notes":"oEmbed returned current metadata and iframe markup; title is exact-adjacent. Playback, exact movement and variant match, safety, captions, accessibility, quality, reviewer, and approval remain pending.","exactVariantMatch":null,"reviewStatus":"candidate"},{"url":"https://www.youtube.com/watch?v=vy_0AVL_Qbc","title":"Single Leg Wall Pogo","channelName":"Brendan Satterlund","sourceQuery":"wall single leg pogo","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-08-01T22:00:00.000Z"},"notes":"oEmbed returned current metadata and iframe markup; title is exact-adjacent. Playback, exact movement and variant match, safety, captions, accessibility, quality, reviewer, and approval remain pending.","exactVariantMatch":null,"reviewStatus":"candidate"},{"url":"https://www.youtube.com/watch?v=do7hjBVIfFo","title":"Single Leg Wall Pogo","channelName":"All Seasons Club","sourceQuery":"wall single leg pogo","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-08-01T22:00:00.000Z"},"notes":"oEmbed returned current metadata and iframe markup; title is exact-adjacent. Playback, exact movement and variant match, safety, captions, accessibility, quality, reviewer, and approval remain pending.","exactVariantMatch":null,"reviewStatus":"candidate"},{"url":"https://www.youtube.com/watch?v=vACWLutUtvQ","title":"Single Leg Pogo Hop on Wall (Phase 1 Plyometrics)","channelName":"YourPhysicianCoach","sourceQuery":"wall single leg pogo","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-08-01T22:00:00.000Z"},"notes":"oEmbed returned current metadata and iframe markup; title is exact-adjacent and uses population/program framing that requires human scope review. Playback, exact movement and variant match, safety, captions, accessibility, quality, reviewer, and approval remain pending.","exactVariantMatch":null,"reviewStatus":"candidate"}],"alternateAssessments":[{"name":"Wall-Lean Stationary Single-Leg Pogo","classification":"new_variant","rationale":"Intentional wall pressure and a forward body line change support and posture while preserving repeated same-leg low-amplitude contacts.","distinguishingDimensions":{"support":"intentional_wall_pressure","bodyLine":"forward_lean","contactSequence":"same_leg_repeated"}},{"name":"Light-Balance Supported Stationary Single-Leg Pogo","classification":"same_identity","rationale":"The existing supported variant uses the wall only for balance and remains a separate exact support option.","distinguishingDimensions":{"support":"light_balance_only","bodyLine":"tall"}},{"name":"Unsupported Stationary Single-Leg Pogo","classification":"same_identity","rationale":"Removing support raises balance demand without changing laterality or repeated-contact action.","distinguishingDimensions":{"support":"none","direction":"stationary"}},{"name":"Wall-Supported Alternating Stride Pogo","classification":"new_definition","rationale":"Alternating flight contacts change ordered contact sequence, side accounting and coordination.","distinguishingDimensions":{"contactSequence":"alternating","flight":true}},{"name":"Wall Drill March","classification":"new_definition","rationale":"A deliberate alternating march has no repeated same-leg flight contacts.","distinguishingDimensions":{"contactSequence":"alternating_step","flight":false}},{"name":"Wall Drill Switch","classification":"new_definition","rationale":"One or more reciprocal leg exchanges use a different ordered action and terminal rule.","distinguishingDimensions":{"contactSequence":"reciprocal_switch"}},{"name":"Ankling Drill","classification":"new_definition","rationale":"Unsupported traveling alternating ankling changes support, displacement, contact sequence and dose unit.","distinguishingDimensions":{"support":"none","travel":true,"contactSequence":"alternating"}},{"name":"Bilateral Ankle Pogo","classification":"new_definition","rationale":"Synchronous two-leg contacts change laterality, load distribution and balance demand.","distinguishingDimensions":{"laterality":"bilateral_synchronous"}},{"name":"Contact Count, Cadence, Low Amplitude, Rest, or Starting Side","classification":"modifier_annotation","rationale":"These dosage variables preserve the exact wall-lean same-leg identity when setup and contact sequence remain fixed.","distinguishingDimensions":{"modifiers":["contacts","cadence","low_amplitude","rest","starting_side"]}}]}$packet$::JSONB);
  -- END GENERATED CANONICAL RESEARCH PACKETS

  WITH packet_evidence AS(
    SELECT packet.packet_slug,evidence.item->>'sectionKey' section_key,
      evidence.item->>'sourceUrl' source_url,
      evidence.item->>'sourceTitle' source_title,
      evidence.item->>'sourcePublisher' source_publisher,
      evidence.item->>'sourceKind' source_kind,
      (evidence.item->>'evidenceQuality')::SMALLINT evidence_quality,
      to_jsonb(ARRAY(SELECT jsonb_array_elements_text(
        evidence.item->'claims'))) claims_json
    FROM family_packet_seed packet
    CROSS JOIN LATERAL jsonb_array_elements(
      packet.packet_json->'evidence') evidence(item)
  )
  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,evidence.section_key,
    evidence.source_url,evidence.source_title,evidence.source_publisher,
    evidence.source_kind,evidence.claims_json,evidence.evidence_quality,
    'candidate',NULL,NULL
  FROM packet_evidence evidence
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=evidence.packet_slug
      AND definition.status='review'
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  SELECT definition.id,wall_variant_id,definition.card_version,
    media.item->>'url',
    'https://www.youtube-nocookie.com/embed/'
      ||substring(media.item->>'url' FROM 'v=([^&]+)'),
    substring(media.item->>'url' FROM 'v=([^&]+)'),media.item->>'title',
    media.item->>'channelName',NULL,'en',NULL,
    coalesce((media.item->>'embeddingAllowed')::BOOLEAN,FALSE),NULL,NULL,
    CASE WHEN media.item->>'linkStatus'='healthy' THEN 'healthy'
      ELSE 'unverified' END,
    'candidate','manual_research',media.item->>'sourceQuery',NULL,NULL,NULL,
    concat_ws(' ',media.item->>'notes',
      'Automated availability and embedding evidence do not establish exact movement match, complete viewing, safety, accessibility, reviewer identity, or approval.')
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(
    packet.packet_json->'mediaCandidates') media(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.packet_slug
      AND definition.status='review'
  ON CONFLICT(definition_id,reviewed_card_version,video_id)
  DO UPDATE SET variant_id=wall_variant_id,url=EXCLUDED.url,
    embed_url=EXCLUDED.embed_url,title=EXCLUDED.title,
    channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,
    embedding_allowed=EXCLUDED.embedding_allowed,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status=EXCLUDED.link_status,
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=NULL,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,alternate.item->>'name',
    alternate.item->>'classification',alternate.item->>'rationale',
    coalesce(alternate.item->'distinguishingDimensions','{}'::JSONB),
    NULL,'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(
    packet.packet_json->'alternateAssessments') alternate(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.packet_slug
      AND definition.status='review'
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name)
  DO UPDATE SET classification=EXCLUDED.classification,
    rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    id,from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES(
    relationship_id,wall_variant_id,balance_variant_id,'lateral_substitution',72,
    ARRAY['support','posture','body_angle','balance']::TEXT[],
    'Both variants preserve stationary repeated same-leg low-amplitude contacts. The wall-lean variant uses intentional wall pressure and a forward body line; the existing supported variant uses light balance assistance with a tall posture. This is a review-only contextual substitution, not a progression claim.',
    jsonb_build_object(
      'requires',jsonb_build_array(
        'qualified_human_relationship_review','same_low_amplitude_contact_goal',
        'support_and_body_line_match_session_objective'),
      'approvalCreated',FALSE),'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,
    conditions_json=EXCLUDED.conditions_json,review_status='review',
    created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    id,facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  VALUES
    (complexity_calibration_id,1,wall_variant_id,'technicalComplexity',48,40,
      'Candidate complexity reflects wall and floor setup, forward body-line control, intentional two-hand wall pressure, opposite-leg position, same-leg contact rhythm, side-specific counting, and controlled exit. Human anchor review is required.',
      'review',1,NULL,NULL,
      'Proposal only; no calibration or card approval is created.',NULL),
    (physical_calibration_id,1,wall_variant_id,'absoluteLoadDemand',52,60,
      'Candidate physical difficulty reflects repeated unilateral impact, foot-calf-Achilles demand, hip-pelvis control, wall bracing, side balance, and cumulative running or jumping exposure. Human anchor review is required.',
      'review',1,NULL,NULL,
      'Proposal only; no calibration or card approval is created.',NULL)
  ON CONFLICT(facility_id,variant_id,dimension,version)
  DO UPDATE SET proposed_score=EXCLUDED.proposed_score,
    anchor_tier=EXCLUDED.anchor_tier,rationale=EXCLUDED.rationale,
    status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_score_calibration_v1.status='review';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(
    1,free_legacy_id,wall_legacy_id,'distinct_exercises',
    'The only stable source-level boundary is external support: legacy 947 uses a clear lane and does not prescribe a wall, while legacy 1085 explicitly requires wall pressure. Both labels are retired because neither specifies an exact ordered contact contract. The decision separates their source identities without making either prescribable.',
    jsonb_build_object(
      'boundary','free_lane_candidate_vs_required_wall_support',
      'bothLegacyCardsArchived',TRUE,
      'missingExactFacts',jsonb_build_array(
        'laterality','ordered_contacts','flight','displacement','dose_unit','finish'),
      'exactVariantAdded','single-leg-pogo:wall-lean-stationary-single-leg',
      'legacySourcesMappedToExactVariant',FALSE,
      'researchVersion','2026-08-01.4',
      'decisionScope','identity_and_retirement_only_not_human_approval',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id)
  DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,1,definition.card_version,'1.0.0',migration_key,
    'quarantined',
    jsonb_build_object(
      'ambiguousLegacyCardsArchived',(
        SELECT count(*)=2 FROM coaching.exercise_definition_v1 legacy
        WHERE legacy.id IN(free_legacy_id,wall_legacy_id)
          AND legacy.status='archived'),
      'legacySourcesNotMappedToExactVariant',NOT EXISTS(
        SELECT 1 FROM coaching.exercise_definition_source_v1 source
        WHERE source.legacy_exercise_id IN(947,1085)
          AND source.definition_id=survivor_id),
      'exactWallLeanVariant',EXISTS(
        SELECT 1 FROM coaching.exercise_variant_v1 variant
        WHERE variant.id=wall_variant_id AND variant.status='review'
          AND variant.requirements_json->>'selectable'='true'
          AND variant.requirements_json->>'action'
            ='same_leg_repeated_low_amplitude_ankle_dominant_hops'),
      'difficultyUsesComplexityAndPhysicalDemandOnly',EXISTS(
        SELECT 1 FROM coaching.exercise_variant_v1 variant
        WHERE variant.id=wall_variant_id
          AND(variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
            =greatest(
              (variant.difficulty_json->>'technicalComplexity')::INTEGER,
              (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER)
          AND NOT coaching.exercise_json_has_non_neutral_level_classification(
            variant.difficulty_json)),
      'twoPlanningProfiles',(
        SELECT count(*)=2 FROM coaching.exercise_delivery_profile_v1 profile
        WHERE profile.variant_id=wall_variant_id AND profile.status='review'),
      'sixteenCandidateEvidenceSections',(
        SELECT count(DISTINCT evidence.section_key)=16
        FROM coaching.exercise_section_evidence_v1 evidence
        WHERE evidence.definition_id=survivor_id
          AND evidence.reviewed_card_version=definition.card_version
          AND evidence.review_status='candidate'),
      'fiveEmbeddableCandidates',(
        SELECT count(*)=5 FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id=survivor_id
          AND media.variant_id=wall_variant_id
          AND media.reviewed_card_version=definition.card_version
          AND media.review_status='candidate' AND media.link_status='healthy'
          AND media.embedding_allowed=TRUE
          AND media.exact_variant_match IS NULL
          AND media.demonstration_quality_score IS NULL
          AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL),
      'nineAlternateAssessments',(
        SELECT count(*)=9
        FROM coaching.exercise_alternate_assessment_v1 alternate
        WHERE alternate.definition_id=survivor_id
          AND alternate.reviewed_card_version=definition.card_version
          AND alternate.review_status='candidate'),
      'relationshipReviewOnly',EXISTS(
        SELECT 1 FROM coaching.exercise_relationship_v1 relationship
        WHERE relationship.from_variant_id=wall_variant_id
          AND relationship.review_status='review'
          AND relationship.reviewed_by IS NULL
          AND relationship.reviewed_at IS NULL),
      'calibrationsReviewOnly',(
        SELECT count(*)=2
        FROM coaching.exercise_score_calibration_v1 calibration
        WHERE calibration.variant_id=wall_variant_id
          AND calibration.status='review' AND calibration.reviewed_by IS NULL
          AND calibration.reviewed_at IS NULL),
      'approvalsCreated',FALSE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','Human content, equipment-risk, difficulty, dosage, support, pilot, and publication review are incomplete.'),
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','Five links are automated oEmbed-healthy and embeddable, but full playback, exact variant matching, safety, cues, captions, accessibility, quality, reviewer identity, and approval remain incomplete.'),
      jsonb_build_object('code','CARD-GRAPH-03',
        'message','The contextual substitution relationship remains review-only.'),
      jsonb_build_object('code','CARD-CALIBRATION-01',
        'message','Complexity and physical-difficulty scores remain review-only proposals.')),
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=survivor_id AND definition.status='review'
  ON CONFLICT(definition_id)
  DO UPDATE SET facility_id=EXCLUDED.facility_id,
    card_version=EXCLUDED.card_version,schema_version=EXCLUDED.schema_version,
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.id IN(free_legacy_id,wall_legacy_id)
      AND(definition.status<>'archived' OR definition.card_version<>3)
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1 variant
    WHERE variant.definition_id IN(free_legacy_id,wall_legacy_id)
      AND variant.status<>'archived'
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_delivery_profile_v1 profile
    JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
    WHERE variant.definition_id IN(free_legacy_id,wall_legacy_id)
      AND profile.status<>'archived'
  ) THEN
    RAISE EXCEPTION '% failed to retire both non-atomic legacy cards',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_source_v1 source
    WHERE source.legacy_exercise_id IN(947,1085)
      AND source.definition_id=survivor_id
  ) THEN
    RAISE EXCEPTION '% incorrectly mapped an ambiguous legacy source to the exact variant',
      migration_key;
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1 variant
    WHERE variant.id=wall_variant_id AND variant.definition_id=survivor_id
      AND variant.status='review'
      AND variant.requirements_json->>'selectable'='true'
      AND(variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
        =greatest(
          (variant.difficulty_json->>'technicalComplexity')::INTEGER,
          (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER)
      AND NOT coaching.exercise_json_has_non_neutral_level_classification(
        jsonb_build_array(
          variant.difficulty_json,variant.requirements_json,
          variant.load_profile_json,variant.fatigue_profile_json,
          variant.programming_profile_json))
  ) THEN
    RAISE EXCEPTION '% failed exact variant difficulty or proficiency invariant',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      WHERE profile.variant_id=wall_variant_id AND profile.status='review'
        AND profile.dosage_json ? 'setsPerSide'
        AND profile.dosage_json ? 'contactsPerSet'
        AND profile.dosage_json ? 'restSeconds'
        AND profile.time_model_json ? 'estimatedDurationSecondsMin'
        AND profile.time_model_json ? 'estimatedDurationSecondsMax'
        AND profile.measurement_json->>'repUnit'
          ='one_landing_contact_on_declared_support_leg')<>2 THEN
    RAISE EXCEPTION '% expected two planning-ready wall-lean profiles',
      migration_key;
  END IF;

  IF(SELECT count(DISTINCT evidence.section_key)
      FROM coaching.exercise_section_evidence_v1 evidence
      WHERE evidence.definition_id=survivor_id
        AND evidence.reviewed_card_version=3
        AND evidence.review_status='candidate')<>16 THEN
    RAISE EXCEPTION '% expected all sixteen candidate evidence sections',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id=survivor_id AND media.variant_id=wall_variant_id
        AND media.reviewed_card_version=3
        AND media.review_status='candidate' AND media.link_status='healthy'
        AND media.embedding_allowed=TRUE AND media.exact_variant_match IS NULL
        AND media.demonstration_quality_score IS NULL
        AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>5 THEN
    RAISE EXCEPTION '% expected five embeddable but unapproved media candidates',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      WHERE alternate.definition_id=survivor_id
        AND alternate.reviewed_card_version=3
        AND alternate.review_status='candidate')<>9 THEN
    RAISE EXCEPTION '% expected nine alternate assessments',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_media_candidate_v1 media
    WHERE media.definition_id=survivor_id
      AND media.reviewed_card_version=3
      AND(media.review_status<>'candidate'
        OR media.exact_variant_match IS NOT NULL
        OR media.demonstration_quality_score IS NOT NULL
        OR media.reviewer_user_id IS NOT NULL OR media.reviewed_at IS NOT NULL)
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_relationship_v1 relationship
    WHERE relationship.from_variant_id=wall_variant_id
      AND(relationship.review_status<>'review'
        OR relationship.reviewed_by IS NOT NULL
        OR relationship.reviewed_at IS NOT NULL)
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_score_calibration_v1 calibration
    WHERE calibration.variant_id=wall_variant_id
      AND(calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL
        OR calibration.reviewed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% created or overwrote a prohibited approval',migration_key;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.survivor_definition_id=free_legacy_id
    AND resolution.resolved_definition_id=wall_legacy_id
    AND resolution.decision='distinct_exercises'
    AND resolution.resolution_source='deterministic_identity_equivalence'
    AND resolution.reviewed_by IS NULL;
  IF actual_count<>1 THEN
    RAISE EXCEPTION '% failed to record the retired-label identity boundary',
      migration_key;
  END IF;
END
$$;
