-- Align the completed vertical-jump cards with the independent canonical-card
-- auditor's normalized field contract. This changes no identity, score, media
-- decision, graph review, calibration review, or publication approval.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '444_coaching_vertical_jump_foundations_audit_hardening';
  completion_key CONSTANT TEXT :=
    '443_coaching_vertical_jump_foundations_completion';
  cmj_id CONSTANT UUID := 'd404c234-4aba-4865-b4a2-3db6e7714a47';
  rebound_id CONSTANT UUID := '51a6a26f-bbc2-4ab7-b9c7-ed116a32a25f';
  squat_id CONSTANT UUID := '91c2fab1-0fc9-4d68-88b8-75b7ba2b06c9';
  cmj_variant_id CONSTANT UUID := '48e6ea38-e560-481f-bf99-32edfd5021b4';
  rebound_variant_id CONSTANT UUID := '9069f6fc-4867-4a0a-a671-1ac2a5245996';
  squat_variant_id CONSTANT UUID := 'cc3c51dd-2795-4ac6-a57a-dcfdf023e838';
  box_variant_id CONSTANT UUID := 'bda03e2a-caa6-4f12-8afd-37ed0d7d315b';
  definition_ids CONSTANT UUID[] := ARRAY[cmj_id,rebound_id,squat_id];
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json->>'verticalJumpFoundationsAuditHardeningMigration'=migration_key)=3 THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json ? 'verticalJumpFoundationsAuditHardeningMigration')<>0 THEN
    RAISE EXCEPTION '% found a partial or conflicting prior state',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids) AND card_version=2 AND status='review'
        AND provenance_json->>'verticalJumpFoundationsCompletionMigration'=completion_key)<>3 THEN
    RAISE EXCEPTION '% requires all three version-2 completion cards',migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1 definition SET
    movement_patterns=ARRAY['squat','jump','brace'],
    body_regions=CASE definition.id WHEN squat_id THEN
      ARRAY['foot','ankle','calf','knee','hamstrings','glutes','hip','pelvis','core','spine']
      ELSE ARRAY['foot','ankle','calf','knee','hamstrings','glutes','hip','pelvis','core','spine','shoulder'] END,
    required_equipment=ARRAY[]::TEXT[],
    optional_equipment=ARRAY[]::TEXT[],
    anatomy_json=CASE definition.id WHEN squat_id THEN
      $json${"primaryMuscles":["soleus","gastrocnemius","quadriceps","gluteus_maximus"],"secondaryMuscles":["hamstrings","gluteus_medius","hip_external_rotators","intrinsic_foot_muscles","tibialis_anterior"],"stabilizers":["abdominal_wall","spinal_stabilizers","gluteus_medius","intrinsic_foot_muscles"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex"],"jointActions":["ankle_knee_hip_isometric_stabilization","ankle_plantarflexion","knee_extension","hip_extension","ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"],"jointActionPhases":{"staticStart":["ankle_knee_hip_isometric_stabilization"],"propulsion":["ankle_plantarflexion","knee_extension","hip_extension"],"landing":["ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"]},"planes":["sagittal","frontal","transverse"],"laterality":"bilateral"}$json$::JSONB
      ELSE $json${"primaryMuscles":["soleus","gastrocnemius","quadriceps","gluteus_maximus"],"secondaryMuscles":["hamstrings","gluteus_medius","hip_external_rotators","intrinsic_foot_muscles","tibialis_anterior","deltoids","latissimus_dorsi"],"stabilizers":["abdominal_wall","spinal_stabilizers","gluteus_medius","intrinsic_foot_muscles"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex","shoulder"],"jointActions":["ankle_dorsiflexion","knee_flexion","hip_flexion","shoulder_extension","ankle_plantarflexion","knee_extension","hip_extension","shoulder_flexion","ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"],"jointActionPhases":{"countermovement":["ankle_dorsiflexion","knee_flexion","hip_flexion","shoulder_extension"],"propulsion":["ankle_plantarflexion","knee_extension","hip_extension","shoulder_flexion"],"landing":["ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"]},"planes":["sagittal","frontal","transverse"],"laterality":"bilateral"}$json$::JSONB END,
    athlete_support_json=CASE definition.id
      WHEN squat_id THEN $json${"whyItMatters":"Builds vertical force from a motionless lower-body position and makes start-strategy errors visible while preserving landing control.","primaryCue":"Freeze, then jump without dipping again.","plainLanguage":"Set your squat, freeze, jump straight up without dipping again, land on both feet, hold, and reset.","beforeYouStart":["Confirm start depth, two-to-three-second pause, hands-on-hips policy, intent, landing hold, attempts, rest, and stop signal."],"expectedSensations":["whole-foot pressure during the hold","strong thigh hip and calf drive","controlled foot ankle knee and hip absorption"],"unexpectedSensations":["sharp pain","joint giving way","dizziness","fear","one-sided contact","uncontrolled impact"],"painGuidance":"Stop immediately for pain, giving way, dizziness, or loss of control; do not jump through symptoms.","selfChecks":["Lower body becomes completely still","No second dip before takeoff","Jump and land on two feet in the same area","Quiet controlled hold before reset"],"accessibility":["use visible footprints","reduce jump intent","use a shallower owned start","allow more reset time","request a non-impact power option"],"mediaAlternatives":["written sequence","front-view still frames","side-view still frames","coach demonstration"],"reportImmediately":["pain","giving_way","dizziness","fear","unexpected_surface_movement","loss_of_control"],"alternativeRequests":["lower-intent squat jump","countermovement jump","non-impact power option"]}$json$::JSONB
      WHEN cmj_id THEN $json${"whyItMatters":"Trains a coordinated slow stretch-shortening-cycle vertical jump while making takeoff output and landing control observable.","primaryCue":"Dip once, jump straight up, and own the landing.","plainLanguage":"Dip once, swing naturally, jump straight up, land on both feet, hold, and reset.","beforeYouStart":["Confirm natural-arm policy, intent or height target, landing hold, attempts, rest, and stop signal."],"expectedSensations":["smooth downward-to-upward reversal","coordinated arm and leg drive","controlled foot ankle knee and hip absorption"],"unexpectedSensations":["sharp pain","joint giving way","dizziness","fear","one-sided contact","uncontrolled impact"],"painGuidance":"Stop immediately for pain, giving way, dizziness, or loss of control; do not jump through symptoms.","selfChecks":["One smooth countermovement","Both feet leave and return together","Minimal forward travel","Quiet controlled hold before reset"],"accessibility":["use visible footprints","reduce jump intent","limit countermovement depth","allow more reset time","request a static-start or non-impact option"],"mediaAlternatives":["written sequence","front-view still frames","side-view still frames","coach demonstration"],"reportImmediately":["pain","giving_way","dizziness","fear","unexpected_surface_movement","loss_of_control"],"alternativeRequests":["paused squat jump","lower-intent jump to stick","non-impact power option"]}$json$::JSONB
      ELSE $json${"whyItMatters":"Links a high slow-cycle countermovement jump to one fast landing-to-takeoff rebound while preserving final landing control.","primaryCue":"Jump high, rebound immediately once, then stick.","plainLanguage":"Jump high, land and bounce straight into one quick second jump, then land softly, hold, and reset.","beforeYouStart":["Confirm first-jump target, rebound target, exactly two jumps, attempts, rest, and stop signal."],"expectedSensations":["strong first vertical drive","brief controlled first contact","quick second takeoff","controlled final absorption"],"unexpectedSensations":["sharp pain","joint giving way","dizziness","fear","one-sided first contact","heel slam","uncontrolled final landing"],"painGuidance":"Stop immediately for pain, giving way, dizziness, asymmetrical contact, or loss of control; do not force the rebound.","selfChecks":["First jump is a normal high countermovement jump","Both feet meet the floor together","Second takeoff is immediate and vertical","Final landing is controlled and there is no third jump"],"accessibility":["use a one-flight jump-to-stick","reduce first-jump intent","practice low-level rebounds separately","use visible footprints","request a non-impact power option"],"mediaAlternatives":["written two-flight sequence","front-view still frames","side-view contact sequence","coach demonstration"],"reportImmediately":["pain","giving_way","dizziness","fear","asymmetrical_first_contact","loss_of_control"],"alternativeRequests":["one-flight countermovement jump","low-level rebound","non-impact power option"]}$json$::JSONB END,
    coach_support_json=CASE definition.id
      WHEN squat_id THEN $json${"observationChecklist":["motionless start for the declared hold","no preparatory dip","hands remain fixed","bilateral vertical takeoff","landing in the start area","controlled hold and reset"],"faultCorrections":{"prepDip":"Reduce intent, re-establish the pause, or change to Countermovement Jump if dynamic reversal is intended.","startDepthDrift":"Use a visible depth reference and reset each attempt.","landingLoss":"Reduce intent or use a landing-only task."},"demonstrationPlan":["Show the static start and full pause from the side.","Contrast one invalid preparatory dip with one valid no-dip attempt.","Show the front-view bilateral landing standard."],"groupManagement":{"station":"one athlete per clear flight and landing zone","spacing":"no overlapping jump or fall space","traffic":"none through station","counting":"record every valid and failed landing"},"modificationDecisionTree":["Symptoms or unsafe surface: stop.","Cannot become still: reduce intent or use isometric-plus-rise power.","Prep dip persists: select Countermovement Jump if that matches the objective.","Landing degrades: reduce intent or use jump-to-stick regression."],"doNotUseWhen":["pain","giving way","dizziness","fear","cannot hold the start","cannot control the landing","unsafe surface or clearance"],"setupChecklist":["Inspect surface and clear flight, landing, and fall space.","Declare start depth, pause, hands-on-hips policy, intent, hold, attempts, rest, and stop band."],"validRep":["motionless_start_for_declared_pause","no_preparatory_dip","bilateral_vertical_takeoff","bilateral_landing_in_start_area","controlled_hold","full_reset"],"observationViews":["side_for_stillness_depth_and_travel","front_for_symmetry_and_alignment"],"record":["start_depth","pause","arm_policy","intent_or_height","valid_and_failed_attempts","all_landing_contacts","hold","rest","faults","symptoms","substitution"]}$json$::JSONB
      WHEN cmj_id THEN $json${"observationChecklist":["stationary entry","one countermovement","consistent natural-arm policy","bilateral vertical takeoff","minimal travel","controlled bilateral hold and reset"],"faultCorrections":{"extraDip":"Reduce intent and cue one smooth reversal.","armPolicyDrift":"Restate and demonstrate the selected arm protocol.","landingLoss":"Reduce intent or return to a lower-output jump-to-stick."},"demonstrationPlan":["Show one smooth dip-and-drive from the side.","Show natural arm timing without an approach.","Show the front-view bilateral landing standard."],"groupManagement":{"station":"one athlete per clear flight and landing zone","spacing":"no overlapping jump or fall space","traffic":"none through station","counting":"record every valid and failed landing"},"modificationDecisionTree":["Symptoms or unsafe surface: stop.","Countermovement or arm timing changes: reduce intent or use movement-quality profile.","Landing degrades: use a lower-intent stick task.","Static-start objective: substitute Squat Jump and revalidate dose."],"doNotUseWhen":["pain","giving way","dizziness","fear","uncontrolled countermovement","cannot control the landing","unsafe surface or clearance"],"setupChecklist":["Inspect surface and clear flight, landing, and fall space.","Declare natural-arm policy, intent, hold, attempts, rest, and stop band."],"validRep":["stationary_start","one_countermovement","coordinated_natural_arm_swing","bilateral_vertical_takeoff","bilateral_landing_in_start_area","controlled_hold","full_reset"],"observationViews":["side_for_countermovement_arm_timing_and_travel","front_for_symmetry_and_alignment"],"record":["arm_policy","countermovement_policy","intent_or_height","valid_and_failed_attempts","all_landing_contacts","hold","rest","faults","symptoms","substitution"]}$json$::JSONB
      ELSE $json${"observationChecklist":["high first Countermovement Jump","simultaneous bilateral first contact","immediate vertical second takeoff","exactly two flights","controlled final bilateral hold","complete reset"],"faultCorrections":{"lowFirstJump":"Rest longer or reduce the target before repeating.","pauseOrCollapse":"Remove the rebound and use one-flight Countermovement Jump.","contactOrReboundDrift":"Stop the set or lower the first-jump target.","thirdJump":"Restate exactly two flights and require a final stick."},"demonstrationPlan":["Show the full two-flight sequence from the side.","Pause the demonstration at first bilateral contact.","Show the front-view symmetry and final landing standard."],"groupManagement":{"station":"one athlete per clear two-flight and two-landing zone","spacing":"no overlapping jump or fall space","traffic":"none through station","counting":"record both landings for valid and failed attempts"},"modificationDecisionTree":["Symptoms, asymmetrical first contact, or unsafe surface: stop.","First jump changes: rest or reduce target.","Pause or excessive collapse: select one-flight Countermovement Jump.","Reactive objective requires platform entry: consider Drop Jump and revalidate all constraints."],"doNotUseWhen":["pain","giving way","dizziness","fear","asymmetrical first contact","pause or collapse","uncontrolled final landing","unsafe surface or clearance"],"setupChecklist":["Inspect surface and clear both flight, both landing, and fall spaces.","Declare natural-arm policy, first-jump target, rebound targets, attempts, rest, and stop band."],"validRep":["stationary_start","one_countermovement_first_jump","bilateral_first_landing","immediate_vertical_second_takeoff","exactly_two_flights","controlled_bilateral_final_landing","full_reset"],"observationViews":["side_for_flight_contact_and_rebound_strategy","front_for_symmetry_and_alignment"],"record":["arm_policy","first_jump_height_or_target","contact_time_if_available","rebound_height_or_target","valid_and_failed_attempts","all_landing_contacts","final_hold","rest","faults","symptoms","substitution"]}$json$::JSONB END,
    support_operations_json=definition.support_operations_json||$json${"issueCategories":["identity_or_variant_mismatch","dose_or_duration_mismatch","equipment_or_environment_mismatch","symptom_or_safety_event","media_or_accessibility_issue","rendering_or_persistence_issue"],"supportEscalation":{"immediate":["pain","giving_way","dizziness","fall","unsafe_surface","unexpected_collision"],"coachReview":["repeated_technique_failure","substitution_request","dose_budget_conflict"],"contentReview":["identity_confusion","media_mismatch","accessibility_gap"]},"retentionPolicy":{"store":["definition_id","variant_id","profile_key","dose","targets","valid_and_failed_attempts","all_contacts","faults","symptoms","substitution_reason","validation_result","rendered_instructions"],"preserveHumanReviewHistory":true,"neverOverwriteApprovedReview":true},"changeImpactPolicy":{"onIdentityDoseEquipmentOrProfileChange":["revalidate_selection","recompute_fatigue_and_impact_budgets","recompute_duration","recheck_logistics","rerender_coach_and_athlete_instructions","persist_new_validation"],"neverSilent":true}}$json$::JSONB,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'verticalJumpFoundationsAuditHardeningMigration',migration_key,
      'canonicalAuditContract','canonical-card-audit-v1',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE definition.id=ANY(definition_ids);

  UPDATE coaching.exercise_variant_v1 variant SET
    load_profile_json=variant.load_profile_json||CASE variant.id
      WHEN squat_variant_id THEN $json${"gripDemand":5,"spinalLoading":30,"eccentricStress":46,"landingContactsPerRep":1,"externalLoadMethod":"bodyweight"}$json$::JSONB
      WHEN cmj_variant_id THEN $json${"gripDemand":5,"spinalLoading":34,"eccentricStress":52,"landingContactsPerRep":1,"externalLoadMethod":"bodyweight"}$json$::JSONB
      ELSE $json${"gripDemand":5,"spinalLoading":42,"eccentricStress":68,"landingContactsPerRep":2,"externalLoadMethod":"bodyweight"}$json$::JSONB END,
    fatigue_profile_json=variant.fatigue_profile_json||CASE variant.id
      WHEN squat_variant_id THEN $json${"gripFatigue":5,"recoveryHours":24}$json$::JSONB
      WHEN cmj_variant_id THEN $json${"gripFatigue":5,"recoveryHours":24}$json$::JSONB
      ELSE $json${"gripFatigue":5,"recoveryHours":36}$json$::JSONB END,
    programming_profile_json=variant.programming_profile_json||CASE variant.id
      WHEN squat_variant_id THEN $json${"weeklyExposure":{"frequency":"individualized_from_training_age_readiness_and_total_impact","minimumRecoveryHours":24},"sequenceRules":["after_specific_preparation","before_fatigued_conditioning","fully_reset_attempts_only"],"pairingCompatibility":["low_fatigue_upper_body_power","non_competing_mobility_during_full_rest"],"interferenceRules":["do_not_precede_with_fatiguing_lower_body_work","include_same_session_running_and_jump_contacts","stop_before_start_or_landing_strategy_changes"]}$json$::JSONB
      WHEN cmj_variant_id THEN $json${"weeklyExposure":{"frequency":"individualized_from_training_age_readiness_and_total_impact","minimumRecoveryHours":24},"sequenceRules":["after_specific_preparation","before_fatigued_conditioning","fully_reset_attempts_only"],"pairingCompatibility":["low_fatigue_upper_body_power","non_competing_mobility_during_full_rest"],"interferenceRules":["do_not_precede_with_fatiguing_lower_body_work","include_same_session_running_and_jump_contacts","stop_before_output_or_landing_strategy_changes"]}$json$::JSONB
      ELSE $json${"weeklyExposure":{"frequency":"individualized_low_frequency_reactive_exposure","minimumRecoveryHours":36},"sequenceRules":["after_specific_preparation","after_one_flight_and_low_level_rebound_prerequisites","before_fatigued_conditioning","fully_reset_two_flight_attempts_only"],"pairingCompatibility":["low_fatigue_upper_body_power","non_competing_mobility_during_long_rest"],"interferenceRules":["do_not_precede_with_fatiguing_lower_body_or_reactive_work","include_every_same_session_running_and_jump_contact","do_not_pair_with_high_impact_density","stop_before_first_jump_contact_rebound_or_final_landing_changes"]}$json$::JSONB END,
    updated_at=now()
  WHERE variant.id IN(squat_variant_id,cmj_variant_id,rebound_variant_id);

  UPDATE coaching.exercise_delivery_profile_v1 profile SET
    equipment_required=ARRAY['none'],updated_at=now()
  WHERE profile.variant_id IN(squat_variant_id,cmj_variant_id,rebound_variant_id)
    AND profile.status='review';

  UPDATE coaching.exercise_relationship_v1 relationship SET
    dimensions=CASE
      WHEN relationship.from_variant_id=squat_variant_id
        AND relationship.to_variant_id=cmj_variant_id
        AND relationship.relationship='progression'
        THEN ARRAY['complexity','speed']
      WHEN relationship.from_variant_id=cmj_variant_id
        AND relationship.to_variant_id=squat_variant_id
        AND relationship.relationship='regression'
        THEN ARRAY['complexity','speed']
      WHEN relationship.from_variant_id=cmj_variant_id
        AND relationship.to_variant_id=rebound_variant_id
        AND relationship.relationship='progression'
        THEN ARRAY['complexity','speed','impact']
      WHEN relationship.from_variant_id=rebound_variant_id
        AND relationship.to_variant_id=cmj_variant_id
        AND relationship.relationship='regression'
        THEN ARRAY['complexity','speed','impact']
      WHEN relationship.from_variant_id=cmj_variant_id
        AND relationship.to_variant_id=box_variant_id
        AND relationship.relationship='progression'
        THEN ARRAY['complexity','impact','stability']
      ELSE relationship.dimensions END,
    updated_at=now()
  WHERE (relationship.from_variant_id,relationship.to_variant_id,relationship.relationship) IN(
    (squat_variant_id,cmj_variant_id,'progression'),
    (cmj_variant_id,squat_variant_id,'regression'),
    (cmj_variant_id,rebound_variant_id,'progression'),
    (rebound_variant_id,cmj_variant_id,'regression'),
    (cmj_variant_id,box_variant_id,'progression'));

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=ANY(definition_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=ANY(definition_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed
          WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(definition_ids)
        AND (jsonb_typeof(definition.anatomy_json->'jointActions')<>'array'
          OR jsonb_array_length(definition.anatomy_json->'jointActions')=0
          OR definition.anatomy_json->>'laterality'<>'bilateral'
          OR definition.athlete_support_json->>'whyItMatters' IS NULL
          OR definition.coach_support_json->'observationChecklist' IS NULL
          OR definition.support_operations_json->'issueCategories' IS NULL)) THEN
    RAISE EXCEPTION '% did not complete normalized anatomy and support',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
      WHERE variant.id IN(squat_variant_id,cmj_variant_id,rebound_variant_id)
        AND (variant.load_profile_json->>'externalLoadMethod'<>'bodyweight'
          OR variant.load_profile_json->>'landingContactsPerRep' IS NULL
          OR variant.load_profile_json->>'gripDemand' IS NULL
          OR variant.load_profile_json->>'spinalLoading' IS NULL
          OR variant.load_profile_json->>'eccentricStress' IS NULL
          OR variant.fatigue_profile_json->>'gripFatigue' IS NULL
          OR variant.fatigue_profile_json->>'recoveryHours' IS NULL
          OR variant.programming_profile_json->'weeklyExposure' IS NULL
          OR variant.programming_profile_json->'sequenceRules' IS NULL
          OR variant.programming_profile_json->'pairingCompatibility' IS NULL
          OR variant.programming_profile_json->'interferenceRules' IS NULL)) THEN
    RAISE EXCEPTION '% did not complete normalized load and programming',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id IN(squat_variant_id,cmj_variant_id,rebound_variant_id)
        AND status='review' AND equipment_required=ARRAY['none'])<>5 THEN
    RAISE EXCEPTION '% did not declare bodyweight profile equipment',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE relationship.from_variant_id IN(squat_variant_id,cmj_variant_id,rebound_variant_id)
        AND relationship.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% retained uncontrolled graph dimensions',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(definition_ids)
        AND (definition.approved_video_url IS NOT NULL
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR coaching.exercise_json_has_level_classification(jsonb_build_array(
            definition.provenance_json,definition.environment_json,
            definition.population_json,definition.anatomy_json,
            definition.athlete_support_json,definition.coach_support_json,
            definition.support_operations_json)))) THEN
    RAISE EXCEPTION '% created approval or exercise proficiency metadata',migration_key;
  END IF;
END;
$$;
