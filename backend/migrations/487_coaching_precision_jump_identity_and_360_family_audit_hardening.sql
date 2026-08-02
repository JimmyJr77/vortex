-- Consolidate the ambiguous legacy Precision Jump source into the already
-- complete Broad Jump to Stick definition, add an exact stationary parkour
-- precision variant for a restricted low target, and author a distinct
-- bilateral 360-degree horizontal jump-to-stick definition. A full turn
-- changes the scored action; target support is an exact variant dimension.
-- All specifications remain machine-authored and quarantined. Difficulty is
-- exercise complexity plus physical difficulty, with overall=max; no athlete
-- proficiency or exercise skill level is authored.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '487_coaching_precision_jump_identity_and_360_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.88';
  survivor_definition CONSTANT UUID := '1260d75e-6807-4c91-859d-7d561a9160a3';
  source_definition CONSTANT UUID := '6dc5fcf1-6383-4aed-a73b-7465384fd18b';
  rotation_definition CONSTANT UUID := '1101413d-55c7-4585-abc2-6e63484ec434';
  base_variant CONSTANT UUID := '962d4295-1d84-400f-af24-53ff25813f96';
  source_variant CONSTANT UUID := 'dd36d133-894b-4562-9cc7-016d1db6f56c';
  precision_variant CONSTANT UUID := '5cc18072-971f-4f98-bf71-1213341167e4';
  rotation_open_variant CONSTANT UUID := 'b365da0f-2779-4883-8152-a5b3c09bee9f';
  rotation_precision_variant CONSTANT UUID := '1101413d-55c7-4585-abc2-6e63484ec435';
  standing_broad_definition CONSTANT UUID := '626ba7ed-840e-4275-9001-bab668e37503';
  standing_broad_variant CONSTANT UUID := 'b6d4dea3-c379-4029-9de2-5b5f4d4b51e8';
  lache_precision_definition CONSTANT UUID := '656028eb-c7d1-4a2f-a216-45763b201796';
  lache_precision_variant CONSTANT UUID := '612fc5a8-a343-4609-9463-b891ebeaf104';
  ninety_definition CONSTANT UUID := '866cff83-dc6c-4131-b6d8-e471ef92d859';
  ninety_variant CONSTANT UUID := '1f49a1bd-cc33-420e-9c86-b48e1224594e';
  one_eighty_definition CONSTANT UUID := 'cdafa4d9-31f5-4cab-b9b4-c0b2385d8e0e';
  awareness_definition CONSTANT UUID := 'fd2db4bf-6a62-4bae-ab7c-a7eaa4ce587c';
  rebound_definition CONSTANT UUID := 'abafa520-df54-4378-8bc8-cea2860a4c3a';
  repeated_definition CONSTANT UUID := 'a3768015-f081-44ff-81a0-2d15a5acb94f';
  active_definition_ids CONSTANT UUID[] := ARRAY[
    survivor_definition,rotation_definition
  ];
  active_variant_ids CONSTANT UUID[] := ARRAY[
    base_variant,precision_variant,rotation_open_variant,
    rotation_precision_variant
  ];
  protected_definition_ids CONSTANT UUID[] := ARRAY[
    survivor_definition,source_definition,rotation_definition
  ];
  protected_variant_ids CONSTANT UUID[] := ARRAY[
    base_variant,source_variant,precision_variant,rotation_open_variant,
    rotation_precision_variant
  ];
  protected_count INTEGER;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=survivor_definition
        AND provenance_json->>'precisionJumpAuditMigration'=migration_key)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=rotation_definition
        AND provenance_json->>'precisionJumpAuditMigration'=migration_key) THEN
    IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
        WHERE id=survivor_definition AND card_version=2 AND status='review')
      OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
        WHERE id=base_variant AND definition_id=survivor_definition
          AND status='review')
      OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
        WHERE id=source_definition AND legacy_exercise_id=20
          AND card_version=1 AND status='review')
      OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
        WHERE id=source_variant AND definition_id=source_definition
          AND status='review')
      OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
        WHERE legacy_exercise_id=20 AND definition_id=source_definition)
      OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
        WHERE legacy_exercise_id=146 AND definition_id=survivor_definition)
      OR (SELECT count(*) FROM coaching.exercise_definition_v1
          WHERE id IN(standing_broad_definition,lache_precision_definition,
            ninety_definition,one_eighty_definition,awareness_definition,
            rebound_definition,repeated_definition))<>7
      OR (SELECT count(*) FROM coaching.exercise_variant_v1
          WHERE id IN(standing_broad_variant,lache_precision_variant,
            ninety_variant))<>3 THEN
      RAISE EXCEPTION '% prerequisite source, survivor, or identity anchors drifted',
        migration_key;
    END IF;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='bilateral-360-degree-jump-to-stick'
        AND id<>rotation_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=precision_variant AND definition_id<>survivor_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id IN(rotation_open_variant,rotation_precision_variant)
        AND definition_id<>rotation_definition) THEN
    RAISE EXCEPTION '% working slug or UUID ownership drifted',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ANY(protected_definition_ids)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(protected_definition_ids)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(protected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(protected_definition_ids)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ANY(protected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ANY(protected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=ANY(protected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(protected_variant_ids)
        AND status IN('published','deprecated')
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(protected_variant_ids)
          OR to_variant_id=ANY(protected_variant_ids))
        AND (reviewed_by IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(protected_variant_ids)
        AND (reviewed_by IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=20
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',
      migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 SET
    status='archived',updated_at=now()
  WHERE variant_id=source_variant AND status<>'archived';

  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-20',
    display_name='Precision Jump Identity Quarantine — Source 20',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',20,
      'archiveReason','standing_or_running_entry_takeoff_contact_target_width_height_gap_surface_forefoot_rule_hold_and_connection_are_undefined',
      'canonicalSurvivorDefinitionId',survivor_definition,
      'requiredExactVariantId',precision_variant,
      'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=source_variant;

  UPDATE coaching.exercise_definition_v1 SET
    legacy_exercise_id=NULL,status='archived',approved_video_url=NULL,
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    description='Archived legacy identity lineage. Select Broad Jump to Stick and its exact open-surface or stationary parkour precision variant; this source card is not selectable because entry, target, contact, hold, and connection are under-specified.',
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'precisionJumpAuditMigration',migration_key,
      'identityResolution','duplicate_consolidated',
      'survivorDefinitionId',survivor_definition,
      'sourceVariantSelectable',FALSE,'selectable',FALSE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=source_definition;

  UPDATE coaching.exercise_definition_source_v1 source SET
    definition_id=survivor_definition,source_kind='duplicate_consolidation',
    provenance_json=coalesce(source.provenance_json,'{}'::JSONB)
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','duplicate_consolidated_into_broad_jump_to_stick_family',
        'sourceDefinitionId',source_definition,
        'sourceVariantDisposition','identity_quarantine',
        'representedByExactVariantId',precision_variant,
        'sourceInterpretation','The one-line source preserves a stationary bilateral horizontal jump and terminal foot-placement concept but omits the exact entry target support contact and endpoint. The executable parkour interpretation is an exact restricted-target variant; running one-foot turning rebound drop and connected interpretations are distinct.',
        'exerciseCardDoesNotClassifyAthletes',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=20
    AND definition_id IN(source_definition,survivor_definition);

  UPDATE coaching.exercise_definition_v1 definition SET
    canonical_name='Broad Jump to Stick',display_name='Broad Jump to Stick',
    aliases=ARRAY[
      'Standing Broad Jump to Stick','Horizontal Jump to Stick',
      'Broad Jump and Hold','Precision Jump','Parkour Precision Jump',
      'Standing Precision Jump','Two-Foot Precision Jump'
    ]::TEXT[],
    description='From a stationary bilateral foot-supported start, use one declared arm-and-leg countermovement, take off from both feet, travel forward through one flight, contact the selected horizontal landing target with both feet together, retain the declared terminal stick without another contact, and fully reset. The exact variant declares an open full-foot landing surface or a restricted parkour forefoot target.',
    family_key='bilateral_horizontal_jump_terminal_stick',
    schema_version='2.0.0',card_version=3,status='review',
    content_confidence=90,scoring_confidence=72,media_confidence=56,
    movement_patterns=ARRAY['squat','jump','project','land','brace']::TEXT[],
    body_regions=ARRAY['foot','ankle','calf','knee','hamstrings','glutes',
      'hip','pelvis','core','spine','shoulder']::TEXT[],
    required_equipment='{}'::TEXT[],
    optional_equipment=ARRAY['line_tape','cones','jump_mat','platform','mat',
      'tape_measure','timer']::TEXT[],
    environment_json=$json${
      "surface":"level dry non-slip predictable horizontal takeoff and landing interfaces",
      "targetInterfaces":["open stable landing surface","secured low restricted horizontal top surface declared by exact variant"],
      "geometry":"record takeoff edge or line, target width and depth, horizontal distance, height difference, gap consequence, foot-placement zone, fall and run-out space",
      "clearance":"one complete takeoff flight landing overrun underrun side-fall and exit envelope with no cross traffic",
      "stationCapacity":1,
      "coachSightlines":["side for projection and target contact","front or landing-quarter for bilateral placement alignment and stick"],
      "inspection":["takeoff and target stability","surface dryness friction edges and projections","platform and mat security","distance height width depth and gap","full fall run-out and emergency-access envelope"],
      "changeRule":"Entry, takeoff support, turn, target interface, distance, height, consequential gap, contact rule, assistance, hold, rebound, exit, surface, dose, or station change requires exact variant selection or a distinct definition plus full workout revalidation."
    }$json$::JSONB,
    population_json=$json${
      "selectionStatus":"machine_authored_working_specification_pending_human_review",
      "readinessFacts":["current symptoms restrictions and fear response are checked","selected takeoff target and bailout contract pass inspection","one pain-free bilateral takeoff and controlled landing rehearsal matches the selected surface","athlete understands target contact hold invalidation bailout and stop signal","same-session sprint jump landing and lower-body exposure remains inside the workout budget"],
      "excludeWhen":["pain guarding numbness weakness dizziness giving way or unusual breathlessness","uncontrolled bilateral takeoff landing or stop response","unsafe or moving takeoff target surface platform mat lane or clearance","target geometry or bailout cannot be declared","fatigue or fear changes the selected action"],
      "individualize":["variant and target interface","distance and height inside the reviewed station range","attempts rest and impact budget","visual target and communication","written still-frame or demonstrated instruction"],
      "notEstablishedByExerciseCard":["athlete proficiency level","age cutoff","diagnosis","universal safe distance height gap dose or recovery interval"]
    }$json$::JSONB,
    anatomy_json=$json${
      "primaryMuscles":["gluteus_maximus","quadriceps","hamstrings","soleus","gastrocnemius"],
      "secondaryMuscles":["gluteus_medius","hip_flexors","tibialis_anterior","intrinsic_foot_muscles","deltoids","latissimus_dorsi"],
      "stabilizers":["abdominal_wall","spinal_stabilizers","gluteus_medius","intrinsic_foot_muscles"],
      "joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex","shoulder","elbow"],
      "jointActions":["ankle_dorsiflexion","knee_flexion","hip_flexion","shoulder_extension","trunk_forward_inclination","ankle_plantarflexion","knee_extension","hip_extension","shoulder_flexion","flight_rotation_control","ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"],
      "jointActionPhases":{"countermovement":["ankle_dorsiflexion","knee_flexion","hip_flexion","shoulder_extension"],"propulsion":["ankle_plantarflexion","knee_extension","hip_extension","shoulder_flexion"],"flight":["whole_body_segment_positioning"],"landing":["ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"]},
      "planes":["sagittal","frontal","transverse"],
      "laterality":"bilateral takeoff and simultaneous bilateral landing; turn direction is absent in this definition",
      "supportContactSequence":["stationary bilateral start","bilateral takeoff","unsupported flight","simultaneous bilateral target contact","declared terminal stick","full reset"]
    }$json$::JSONB,
    athlete_support_json=$json${
      "whyItMatters":"Builds controlled horizontal projection, exact bilateral foot placement, momentum absorption, and a deliberate stop on the declared target.",
      "primaryCue":"See the target, swing and project, place both feet together, then own the stick.",
      "beforeYouStart":["Confirm exact variant, start, arm policy, target interface, distance, height, gap, hold, rest, lane, bailout, impact budget, and stop signal."],
      "plainLanguage":"Start still on both feet, dip and swing once, jump forward, place both feet together on the selected target, hold without another touch, then reset.",
      "selfChecks":["stationary bilateral start","one declared countermovement","both feet leave together","both feet contact the selected target together","no hand touch step shuffle rebound fall or connection","hold and reset match the displayed variant"],
      "expectedSensations":["whole-body forward projection","strong hip knee and ankle extension","target-focused foot placement","controlled lower-body absorption and balance"],
      "unexpectedSensations":["sharp pain","giving way","numbness or tingling","dizziness","fear that changes the attempt","one-sided or uncontrolled contact","slip collision or fall"],
      "painGuidance":"Stop for pain, guarding, giving way, numbness, dizziness, fear, or loss of control; do not jump through symptoms.",
      "accessibility":["shorter visible target","open-surface variant instead of restricted target","fewer attempts and longer rest","high-contrast markers","written sequence and front/side still frames","non-impact horizontal-power substitute after revalidation"],
      "mediaAlternatives":["written repetition boundary","takeoff flight contact stick still frames","front and side diagrams","coach demonstration"],
      "reportImmediately":["symptoms","fear or uncertainty","surface or platform movement","target mismatch","lane intrusion","miss slip collision or fall"]
    }$json$::JSONB,
    coach_support_json=$json${
      "setupChecklist":["Inspect and isolate the complete lane.","Declare exact variant, start, arm policy, target interface, geometry, contact, hold, bailout, dose, rest, impact cap, stop band, and recording fields."],
      "observationChecklist":["stationary bilateral start","single countermovement and arm swing","simultaneous takeoff","forward trajectory and target focus","simultaneous variant-matched foot contact","hip knee ankle and trunk absorption","declared stick and full reset"],
      "observationViews":["side for projection and over-or-under travel","front or landing-quarter for placement alignment and target ownership"],
      "faultCorrections":{"targetMiss":"Reduce distance or use the open-surface variant after revalidation.","extraContact":"Shorten target demand and restore a full reset.","asynchronousFeet":"Reduce demand and re-establish simultaneous takeoff and landing.","heelOrMidfootOnRestrictedTarget":"Use the open-surface variant; do not widen the declared target silently.","reboundOrConnection":"Select the separate rebound or connected definition."},
      "demonstrationPlan":["Show the exact start, target interface, one flight, contact, stick, and reset from the side.","Show front-view bilateral placement.","Contrast open full-foot and restricted forefoot variants plus invalid miss, step, rebound, turn, and connection."],
      "groupManagement":{"station":"one athlete per isolated lane","spacing":"separate takeoff flight target fall run-out and exit zones","traffic":"none through an active lane","counting":"record every valid invalid partial assisted and incident attempt and both planned or unplanned foot contacts"},
      "modificationDecisionTree":["Symptoms, fear, or unsafe station: stop.","Cannot retain exact contact and stick: reduce target demand or select the open-surface variant.","Entry includes a run-up, stride, drop, turn, rebound, hand contact, or connection: change definition.","Substitution changes identity, target, dose, impact, duration, logistics, or rendering: rerun full validation."],
      "doNotUseWhen":["symptoms or restrictions are unresolved","target or bailout is not exact","surface platform mat or lane fails inspection","one-athlete station cannot be enforced","fatigue changes projection contact or stick"],
      "record":["definition_id","variant_id","profile_key","start and arm policy","target interface and geometry","distance height and gap","valid invalid partial assisted and incident attempts","every contact","hold","dose and rest","first fault","symptoms","substitution","actual duration"]
    }$json$::JSONB,
    support_operations_json=$json${
      "issueCategories":["identity_or_variant_mismatch","target_geometry_or_surface_mismatch","dose_duration_or_impact_mismatch","equipment_environment_or_station_issue","symptom_fear_or_incident","media_or_accessibility_issue","rendering_persistence_or_version_issue"],
      "supportEscalation":{"immediate":["pain","giving_way","dizziness","miss","collision","fall","unsafe_surface","lane_intrusion"],"coachReview":["repeated_contact_or_stick_failure","target_or_assistance_change","substitution_request","impact_budget_conflict"],"contentReview":["identity_confusion","instruction_conflict","media_mismatch","accessibility_gap"]},
      "retentionPolicy":{"store":["definition_id","variant_id","card_and_schema_version","profile_key","target_contract","planned_and_actual_dose","valid_invalid_partial_assisted_and_incident_attempts","all_contacts","first_fault","symptoms","substitution_reason","validation_result","duration","coach_and_athlete_renderings"],"preserveHumanReviewHistory":true,"neverOverwriteApprovedReview":true},
      "changeImpactPolicy":{"onIdentityVariantTargetDoseEquipmentEnvironmentOrProfileChange":["revalidate_selection","recompute_cumulative_fatigue_and_impact","recompute_duration","recheck_logistics_and_station","rerender_coach_and_athlete_instructions","persist_new_validation"],"neverSilent":true},
      "incidentPrompt":"Stop and isolate the lane, secure apparatus and mats, assess immediate help needs, record exact geometry contacts symptoms and assistance, and follow facility incident policy."
    }$json$::JSONB,
    provenance_json=coalesce(definition.provenance_json,'{}'::JSONB)
      ||jsonb_build_object(
        'precisionJumpAuditMigration',migration_key,
        'researchVersion',research_version,
        'canonicalAuditContract','canonical-card-audit-v1',
        'difficultyModel','exercise_complexity_and_physical_difficulty_only',
        'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
        'primaryIdentitySource','https://pmc.ncbi.nlm.nih.gov/articles/PMC6093881/',
        'source20IdentityDecision','duplicate_consolidated_with_exact_restricted_target_variant',
        'canonicalAuthoredFromResearch',TRUE,
        'mediaVerificationScope','youtube_oembed_metadata_and_embed_response_health_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE id=survivor_definition;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,created_by,reviewed_by,
    approved_by,last_reviewed_at,anatomy_json,athlete_support_json,
    coach_support_json,support_operations_json)
  VALUES(
    rotation_definition,1,NULL,'bilateral-360-degree-jump-to-stick',
    'Bilateral 360-Degree Jump to Stick','Bilateral 360-Degree Jump to Stick',
    ARRAY['360 Jump to Stick','360-Degree Jump to Stick','360 Precision',
      '360 Precision Jump','Parkour 360 Precision Jump']::TEXT[],
    'From a stationary bilateral foot-supported start, use one declared countermovement, take off from both feet, travel forward while completing one full 360-degree whole-body turn in the declared direction, locate the selected horizontal target, contact it with both feet together at the declared final heading, retain the terminal stick without another contact, and fully reset. The exact variant declares an open surface or restricted parkour forefoot target.',
    'bilateral_360_horizontal_jump_terminal_stick','2.0.0',1,'review',
    84,58,50,
    ARRAY['squat','jump','project','rotate','land','brace']::TEXT[],
    ARRAY['full_body','foot','ankle','calf','knee','hamstrings','glutes',
      'hip','pelvis','core','spine','shoulder']::TEXT[],
    ARRAY['line_tape','timer']::TEXT[],
    ARRAY['cones','jump_mat','platform','mat','tape_measure']::TEXT[],
    $json${
      "surface":"level dry non-slip predictable horizontal takeoff and selected landing target",
      "geometry":"record start heading, turn direction, target heading, target width and depth, distance, height difference, gap consequence, fall and run-out space",
      "targetInterfaces":["open stable landing surface","secured low restricted horizontal top surface declared by exact variant"],
      "clearance":"complete takeoff arm-swing flight rotation landing miss side-fall overrun underrun and exit envelope",
      "stationCapacity":1,
      "coachSightline":"front-quarter or side view that preserves takeoff, rotation, target spotting, both feet, final heading, stick, miss, and bailout",
      "inspection":["surface platform mat and marker stability","declared clockwise or counterclockwise direction","start and finish headings","distance height target dimensions and gap","overhead lateral forward rear and fall clearance","one-athlete station and emergency access"],
      "changeRule":"Rotation amount or direction, entry, target interface, height, gap, assistance, contact, hold, rebound, exit, dose, or station change requires exact variant selection or a distinct definition plus complete revalidation."
    }$json$::JSONB,
    $json${
      "selectionStatus":"machine_authored_working_specification_pending_human_review",
      "readinessFacts":["current symptoms restrictions dizziness and fear response are checked","selected direction target and bailout pass inspection","bilateral jump-to-stick and lower-angle declared-direction rotation can be controlled separately","athlete can locate the target and stop on signal","same-session jump rotation landing and lower-body exposure remains inside budget"],
      "excludeWhen":["pain guarding numbness weakness dizziness disorientation giving way or unusual breathlessness","cannot retain a declared turn direction target heading or simultaneous bilateral landing","unsafe surface target platform mat clearance or station","fatigue fear or spotting loss changes rotation or landing"],
      "individualize":["open or restricted-target variant","clockwise and counterclockwise exposure","distance and height inside reviewed geometry","attempts rest visual targets and communication"],
      "notEstablishedByExerciseCard":["athlete proficiency level","age cutoff","universal rotation readiness test","universal safe distance height gap dose or recovery interval"]
    }$json$::JSONB,
    jsonb_build_object(
      'precisionJumpAuditMigration',migration_key,
      'researchVersion',research_version,
      'canonicalAuditContract','canonical-card-audit-v1',
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
      'primaryIdentitySource','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202026.pdf',
      'canonicalAuthoredFromResearch',TRUE,
      'mediaVerificationScope','youtube_oembed_metadata_and_embed_response_health_only',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,NULL,
    $json${
      "primaryMuscles":["gluteus_maximus","quadriceps","hamstrings","soleus","gastrocnemius"],
      "secondaryMuscles":["gluteus_medius","hip_flexors","tibialis_anterior","intrinsic_foot_muscles","deltoids","latissimus_dorsi"],
      "stabilizers":["abdominal_wall","spinal_stabilizers","gluteus_medius","intrinsic_foot_muscles"],
      "joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex","thoracic_spine","shoulder","elbow","cervical_spine"],
      "jointActions":["lower_limb_countermovement","triple_extension","arm_swing","whole_body_axial_rotation","head_and_eye_target_reorientation","flight_segment_repositioning","bilateral_landing_absorption","pelvis_trunk_and_heading_stabilization"],
      "jointActionPhases":{"countermovement":["ankle_dorsiflexion","knee_flexion","hip_flexion","shoulder_extension","declared_direction_preset"],"propulsion":["ankle_plantarflexion","knee_extension","hip_extension","diagonal_arm_swing","whole_body_rotation_initiation"],"flight":["whole_body_axial_rotation","head_and_eye_target_reorientation","segment_repositioning"],"landing":["bilateral_ankle_knee_hip_flexion_control","rotation_deceleration","pelvis_trunk_and_heading_stabilization"]},
      "planes":["sagittal","transverse","frontal"],
      "laterality":"bilateral takeoff and simultaneous bilateral landing with declared clockwise or counterclockwise full-turn direction",
      "supportContactSequence":["stationary bilateral start","bilateral takeoff","unsupported forward full-turn flight","simultaneous bilateral target contact","declared-heading stick","full reset"]
    }$json$::JSONB,
    $json${
      "whyItMatters":"Develops forward projection, full-turn orientation, visual target reacquisition, bilateral landing placement, and deliberate rotational deceleration.",
      "primaryCue":"Declare the direction, rise and turn as one unit, find the target, place both feet, then stop the turn.",
      "beforeYouStart":["Confirm exact variant, turn direction, start and finish headings, target interface, geometry, hold, rest, lane, bailout, impact budget, and stop signal."],
      "plainLanguage":"Start still on both feet, dip once, jump forward and turn one full revolution, find the target, land with both feet together at the declared heading, hold, then reset.",
      "selfChecks":["direction declared before takeoff","both feet leave together","one full turn without extra contact","target found before landing","both feet contact together","final heading and hold match the variant","no step hand touch rebound fall or connection"],
      "expectedSensations":["whole-body takeoff and turn","visual target reacquisition","controlled bilateral absorption","active stopping of remaining rotation"],
      "unexpectedSensations":["pain","dizziness or disorientation","giving way","lost target","one-sided contact","uncontrolled continued rotation","slip collision or fall"],
      "painGuidance":"Stop for pain, dizziness, disorientation, giving way, fear, lost target, or loss of control; do not repeat through symptoms.",
      "accessibility":["separate non-rotating jump-to-stick card","separate 90-degree rotation card","open-surface variant","larger visible target","fewer attempts and longer rest","written sequence and start-finish diagrams"],
      "mediaAlternatives":["written repetition boundary","overhead turn-direction diagram","start flight target stick still frames","coach demonstration"],
      "reportImmediately":["symptoms","dizziness or disorientation","target loss","surface or marker movement","lane intrusion","miss collision or fall"]
    }$json$::JSONB,
    $json${
      "setupChecklist":["Inspect and isolate the complete rotational flight lane.","Declare exact variant, clockwise or counterclockwise direction, start and finish headings, target geometry, contact, hold, bailout, dose, rest, impact cap, and stop band."],
      "observationChecklist":["stationary bilateral start","declared-direction countermovement and arm swing","simultaneous takeoff","whole-body rotation without premature limb reach","target spotting","simultaneous bilateral contact at final heading","rotation absorption stick and reset"],
      "observationViews":["front-quarter for takeoff rotation target and final heading","side for forward projection and over-or-under travel"],
      "faultCorrections":{"underRotation":"Reduce projection or rotation demand and return to the separate lower-angle card.","overRotation":"Reduce turn impulse and require the declared final heading before adding distance.","targetLoss":"Stop and regress rotation; do not cue a blind landing.","asynchronousFeet":"Reduce demand and re-establish bilateral contact.","continuedTurn":"Reduce demand and restore a complete stick before another attempt."},
      "demonstrationPlan":["Show start and finish headings plus direction from overhead or front-quarter.","Show takeoff rotation spotting bilateral contact and stick from the side.","Contrast valid full turn with under-turn over-turn extra step rebound and restricted-target miss."],
      "groupManagement":{"station":"one athlete per isolated rotational lane","spacing":"separate takeoff rotation target fall run-out and exit zones","traffic":"none through active lane","direction":"do not run opposing rotations in overlapping lanes","counting":"record direction and every valid invalid partial assisted and incident attempt and contact"},
      "modificationDecisionTree":["Symptoms dizziness disorientation fear or unsafe lane: stop.","Cannot find target or stop rotation: return to a separately defined lower-angle rotation or non-rotating stick.","Restricted target changes contact consequence: select exact precision variant.","Entry rebound flip hand contact or connection changes: select a distinct definition."],
      "doNotUseWhen":["symptoms or vestibular concerns are unresolved","target or direction cannot be declared","surface platform mat marker or lane fails inspection","target cannot be seen before contact","fatigue changes turn or landing"],
      "record":["definition_id","variant_id","profile_key","turn_direction","start_and_finish_heading","target_contract","geometry","valid_invalid_partial_assisted_and_incident_attempts","every_contact","hold","dose_rest_and_duration","first_fault","symptoms","substitution"]
    }$json$::JSONB,
    $json${
      "issueCategories":["identity_rotation_or_variant_mismatch","target_heading_geometry_or_surface_mismatch","dose_duration_or_impact_mismatch","environment_station_or_sightline_issue","symptom_dizziness_fear_or_incident","media_or_accessibility_issue","rendering_persistence_or_version_issue"],
      "supportEscalation":{"immediate":["pain","dizziness","disorientation","giving_way","target_loss","collision","fall","lane_intrusion"],"coachReview":["under_or_over_rotation","repeated_landing_change","direction_asymmetry","substitution_or_target_change","impact_budget_conflict"],"contentReview":["identity_confusion","instruction_conflict","media_mismatch","accessibility_gap"]},
      "retentionPolicy":{"store":["definition_id","variant_id","card_and_schema_version","profile_key","direction","headings","target_contract","planned_and_actual_dose","valid_invalid_partial_assisted_and_incident_attempts","all_contacts","first_fault","symptoms","substitution","duration","renderings"],"preserveHumanReviewHistory":true,"neverOverwriteApprovedReview":true},
      "changeImpactPolicy":{"onIdentityRotationDirectionTargetDoseEquipmentEnvironmentOrProfileChange":["revalidate_selection","recompute_cumulative_fatigue_and_impact","recompute_duration","recheck_logistics_sightlines_and_station","rerender_coach_and_athlete_instructions","persist_new_validation"],"neverSilent":true},
      "incidentPrompt":"Stop and isolate the lane, secure apparatus and mats, assess immediate help needs, record direction geometry contacts symptoms and assistance, and follow facility incident policy."
    }$json$::JSONB)
  ON CONFLICT(id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,legacy_exercise_id=NULL,
    slug=EXCLUDED.slug,canonical_name=EXCLUDED.canonical_name,
    display_name=EXCLUDED.display_name,aliases=EXCLUDED.aliases,
    description=EXCLUDED.description,family_key=EXCLUDED.family_key,
    schema_version=EXCLUDED.schema_version,card_version=EXCLUDED.card_version,
    status='review',content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,
    media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,
    body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,
    optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,
    population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,approved_video_url=NULL,
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,
    athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  UPDATE coaching.exercise_variant_v1 SET
    variant_key='open-surface-natural-arm-bilateral-stick',
    display_name='Open-Surface Natural-Arm Broad Jump to Stick',
    modifier_keys=ARRAY['natural_arm_swing','bilateral_takeoff',
      'open_surface_bilateral_landing','two_to_three_second_stick']::TEXT[],
    difficulty_json=$json${
      "technicalComplexity":44,"absoluteLoadDemand":48,"physicalDifficulty":48,
      "coordinationDemand":50,"supervisionDemand":44,"failureConsequence":52,
      "impact":54,"workCapacityDemand":22,"baseOverallDifficulty":48,
      "technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty",
      "overallFormula":"max(exercise_complexity,physical_difficulty)",
      "complexityDimensions":{"wholeBodyTiming":46,"targetPlacement":42,"terminalStability":48,"errorDetection":40},
      "physicalDimensions":{"horizontalPropulsion":50,"landingAbsorption":52,"relativeBodyweightDemand":46}
    }$json$::JSONB,
    requirements_json=$json${
      "selectable":true,"representation":"exact_working_specification",
      "start":"stationary_bilateral_on_open_stable_surface",
      "countermovement":"one_natural_arm_and_leg_countermovement",
      "approach":"forbidden","turn":"forbidden","jumpCount":1,"flightCount":1,
      "takeoffLaterality":"bilateral_simultaneous","projection":"controlled_horizontal_distance",
      "targetInterface":"open_stable_horizontal_surface_supporting_the_full_declared_landing",
      "landingLaterality":"bilateral_simultaneous","landingEventCount":1,
      "terminalAction":"two_to_three_second_stick","measurement":"optional_visible_target_or_distance",
      "reset":"full_between_attempts",
      "invalid":["approach","turn","non_bilateral_takeoff_or_landing","hand_touch","extra_step","shuffle","rebound","fall","lane_intrusion","connected_action"]
    }$json$::JSONB,
    load_profile_json=$json${
      "loadingType":"bodyweight_bilateral_horizontal_ballistic_and_eccentric_braking",
      "externalLoadMethod":"bodyweight","gripDemand":5,"spinalLoading":38,
      "eccentricStress":54,"landingEventsPerRep":1,"landingContactsPerRep":2,
      "landingFootContactsPerRep":2,"plannedImpactContacts":2,
      "contactCountRule":"count both planned feet plus every failed partial assisted incident or unplanned contact",
      "primaryStress":["horizontal_propulsion","momentum_braking","bilateral_landing","trunk_and_arm_coordination"],
      "effectiveLoadDrivers":["body mass","distance and intent","surface and footwear","arm policy","landing strategy","prior fatigue"]
    }$json$::JSONB,
    fatigue_profile_json=$json${
      "localMuscleFatigue":44,"gripFatigue":5,"technicalFatigueSensitivity":56,
      "impactAccumulation":54,"recoveryHours":36,
      "recoveryWindow":"candidate planning estimate only; individualize from intent contacts symptoms and overlapping sprint jump and landing exposure",
      "earlyFatigueSignals":["distance or trajectory change","asymmetric contact","louder landing","extra step or hand touch","longer stabilization","slower stop response"],
      "downstreamConflicts":["priority sprint or jump output","dense lower-body plyometrics","high-impact parkour or landing work"]
    }$json$::JSONB,
    programming_profile_json=$json${
      "selection":{"readinessIsWorkoutInput":true,"exerciseDifficultyDoesNotClassifyAthletes":true},
      "trainingStimuli":["horizontal projection","bilateral landing absorption","terminal braking and stick"],
      "stimulusDose":{"primary":"quality_terminated_attempts","countEveryContact":true,"fatigueCeiling":"low_to_moderate"},
      "weeklyExposure":"Combine every valid invalid partial assisted and incident attempt and all contacts with sprint jump rebound drop and landing work.",
      "prerequisites":["exact open-surface lane and target are available","pain-free bilateral jump and stick rehearsal","stop signal understood"],
      "completionCriteria":["stationary start","bilateral takeoff and landing","one flight","declared stick","complete exposure record"],
      "sequenceRules":["place before fatigued lower-body conditioning","stop before contact or stick changes","do not turn the exercise into repeated jumps"],
      "pairingCompatibility":["low-fatigue upper-body work","noncompeting mobility during full rest"],
      "interferenceRules":["include all same-session contacts","do not pre-fatigue landing control","recompute after substitution"],
      "uncertaintyPolicy":"If entry target contact hold or exit is uncertain, do not select.",
      "publicationQuarantined":true
    }$json$::JSONB,status='review',updated_at=now()
  WHERE id=base_variant;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES
  (precision_variant,survivor_definition,
    'standing-parkour-two-foot-precision-low-restricted-target',
    'Standing Parkour Two-Foot Precision — Low Restricted Target',
    ARRAY['stationary_bilateral','natural_arm_swing','restricted_low_target',
      'bilateral_forefoot_contact','two_second_stick','no_turn']::TEXT[],
    $json${
      "technicalComplexity":62,"absoluteLoadDemand":54,"physicalDifficulty":54,
      "coordinationDemand":68,"supervisionDemand":70,"failureConsequence":72,
      "impact":60,"workCapacityDemand":24,"baseOverallDifficulty":62,
      "balanceDemand":68,"decisionDemand":56,"fearExposure":58,
      "technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty",
      "overallFormula":"max(exercise_complexity,physical_difficulty)",
      "complexityDimensions":{"wholeBodyTiming":60,"targetPlacement":74,"terminalStability":70,"trajectoryControl":58,"errorDetectionAndBailout":60},
      "physicalDimensions":{"horizontalPropulsion":56,"landingAbsorption":60,"restrictedForefootSupport":62,"relativeBodyweightDemand":52},
      "candidateIndependentCalibrationRequired":true
    }$json$::JSONB,
    $json${
      "selectable":true,"representation":"exact_working_specification",
      "actionFamily":"parkour_precision","start":"stationary_parallel_bilateral_foot_support_at_declared_takeoff_edge_or_spot",
      "countermovement":"one_natural_arm_and_leg_countermovement",
      "approach":"forbidden","turn":"forbidden","jumpCount":1,"flightCount":1,
      "takeoffLaterality":"bilateral_simultaneous","projection":"forward_to_declared_low_restricted_target",
      "targetInterface":"secured low horizontal top surface sized and declared for bilateral forefoot or ball-of-foot placement without full-foot support",
      "targetGeometry":"width depth height distance alignment edge profile and miss consequence are measured and persisted",
      "landingContact":"both forefeet or balls of feet contact the declared top target simultaneously; heels remain unsupported beyond the target rather than contacting another surface",
      "landingLaterality":"bilateral_simultaneous","landingEventCount":1,
      "terminalAction":"two_second_stable_stick_without_step_hand_contact_rebound_fall_or_connection",
      "assistanceContract":"coach controls station and bailout but does not propel carry or catch a valid repetition",
      "reset":"full_between_attempts",
      "workingContactAndGeometryRequireHumanReview":true,
      "invalidatingEvents":["approach or turn","asynchronous takeoff or landing","underreach overreach or target-edge slip","heel midfoot shin hand or undeclared surface contact","step shuffle rebound fall rescue or connection","symptom fear or uncontrolled bailout"]
    }$json$::JSONB,
    'review',
    $json${
      "loadingType":"bodyweight_bilateral_horizontal_ballistic_to_restricted_forefoot_support_and_eccentric_braking",
      "externalLoadMethod":"bodyweight","gripDemand":5,"spinalLoading":42,
      "eccentricStress":60,"landingEventsPerRep":1,"landingContactsPerRep":2,
      "landingFootContactsPerRep":2,"plannedImpactContacts":2,
      "contactCountRule":"count both planned target feet plus every failed partial assisted incident or unplanned contact",
      "supportLoad":"bodyweight momentum is accepted through two restricted forefoot target contacts; exact joint and left-right distribution is not assumed",
      "primaryStress":["horizontal_propulsion","precise_target_placement","restricted_forefoot_support","momentum_braking","trunk_and_arm_balance"],
      "effectiveLoadDrivers":["body mass and anthropometry","distance and height difference","target width depth edge and friction","surface and footwear","intent arm swing and trajectory","landing strategy","miss consequence and assistance","prior sprint jump and landing fatigue"]
    }$json$::JSONB,
    $json${
      "localMuscleFatigue":50,"gripFatigue":5,"technicalFatigueSensitivity":72,
      "impactAccumulation":60,"recoveryHours":36,
      "recoveryWindow":"candidate planning estimate only; individualize from novelty geometry consequence contacts symptoms and overlapping sprint jump and landing exposure",
      "primaryFatigueSites":["calf ankle and intrinsic foot musculature","quadriceps hamstrings and gluteals","trunk and shoulder counterbalance"],
      "earlyFatigueSignals":["target fixation delay","lower or changed trajectory","foot separation or edge miss","heel or shin contact","louder landing","step rebound or longer stabilization","slower stop response"],
      "downstreamConflicts":["priority sprint or jump output","dense plyometric contacts","parkour lines with shared target or landing fatigue"]
    }$json$::JSONB,
    $json${
      "selection":{"phaseDefault":"movement_intelligence","readinessIsWorkoutInput":true,"exerciseDifficultyDoesNotClassifyAthletes":true},
      "trainingStimuli":["stationary horizontal projection","restricted-target visual and foot placement","forefoot support","bilateral absorption and two-second stick"],
      "stimulusDose":{"primary":"quality_terminated_valid_attempts","countInvalidPartialAssistedIncidentAndEveryContact":true,"fatigueCeiling":"low_for_precision_learning"},
      "weeklyExposure":"Combine every valid invalid partial assisted and incident attempt and every contact with sprint jump rebound drop parkour and landing work.",
      "prerequisites":["exact low restricted target and complete bailout are available","pain-free open-surface broad jump to stick","target contact and stop signal understood","coach can observe every contact"],
      "completionCriteria":["stationary bilateral start","simultaneous takeoff","no turn","both target forefeet together","two-second stick","complete exposure record"],
      "sequenceRules":["place while attention and lower-body control are fresh","do not use as an unplanned race or fatigue circuit","stop before the first trajectory contact or stick change"],
      "pairingCompatibility":["low-demand instruction or visualization","noncompeting mobility after recovery"],
      "interferenceRules":["do not pre-fatigue lower-leg landing or target tracking","do not share a live fall lane","revalidate after target geometry dose or endpoint change"],
      "uncertaintyPolicy":"If start target geometry contact endpoint miss or assistance is uncertain, quarantine and resolve the exact contract.",
      "publicationQuarantined":true
    }$json$::JSONB),
  (rotation_open_variant,rotation_definition,
    'stationary-bilateral-forward-360-open-surface-stick',
    'Stationary Bilateral Forward 360 — Open-Surface Stick',
    ARRAY['stationary_bilateral','forward_projection','full_turn','open_surface',
      'bilateral_landing','two_second_stick']::TEXT[],
    $json${
      "technicalComplexity":78,"absoluteLoadDemand":64,"physicalDifficulty":64,
      "coordinationDemand":82,"supervisionDemand":78,"failureConsequence":80,
      "impact":66,"workCapacityDemand":30,"baseOverallDifficulty":78,
      "balanceDemand":80,"decisionDemand":72,"fearExposure":68,
      "technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty",
      "overallFormula":"max(exercise_complexity,physical_difficulty)",
      "complexityDimensions":{"takeoffAndTurnTiming":82,"targetReacquisition":82,"rotationAmountAndHeading":86,"terminalStability":78,"errorDetectionAndBailout":72},
      "physicalDimensions":{"horizontalPropulsion":64,"rotationAndSegmentControl":66,"landingAbsorption":66,"relativeBodyweightDemand":58},
      "candidateIndependentCalibrationRequired":true
    }$json$::JSONB,
    $json${
      "selectable":true,"representation":"exact_working_specification",
      "start":"stationary_parallel_bilateral_foot_support_at_declared_heading",
      "countermovement":"one_declared_direction_arm_and_leg_countermovement",
      "approach":"forbidden","projection":"forward_horizontal","wholeBodyTurnDegrees":360,
      "turnDirection":"declared_clockwise_or_counterclockwise_before_attempt",
      "takeoffLaterality":"bilateral_simultaneous","flightCount":1,
      "targetInterface":"open_stable_horizontal_surface_supporting_the_full_landing",
      "targetReacquisition":"selected target must be visually located before contact",
      "landingLaterality":"bilateral_simultaneous","landingHeading":"declared_full_turn_finish_heading",
      "landingEventCount":1,"terminalAction":"two_second_stick_without_continued_rotation_or_extra_contact",
      "reset":"full_between_attempts_and_direction_declared_again",
      "invalidatingEvents":["approach","wrong direction","underrotation or overrotation outside declared heading","target not located before contact","asynchronous takeoff or landing","hand touch step shuffle rebound fall rescue or connection","symptom dizziness or disorientation"]
    }$json$::JSONB,'review',
    $json${
      "loadingType":"bodyweight_bilateral_forward_ballistic_full_turn_and_eccentric_rotational_braking",
      "externalLoadMethod":"bodyweight","gripDemand":5,"spinalLoading":54,
      "eccentricStress":66,"landingEventsPerRep":1,"landingContactsPerRep":2,
      "landingFootContactsPerRep":2,"plannedImpactContacts":2,
      "contactCountRule":"count both planned feet plus every failed partial assisted incident or unplanned contact",
      "primaryStress":["forward_propulsion","whole_body_rotation","visual_target_reacquisition","rotational_and_linear_braking","bilateral_landing"],
      "effectiveLoadDrivers":["body mass and anthropometry","projection distance and turn impulse","direction and segment strategy","target size and heading","surface and footwear","landing strategy","prior rotational jump and landing fatigue"]
    }$json$::JSONB,
    $json${
      "localMuscleFatigue":58,"gripFatigue":5,"technicalFatigueSensitivity":86,
      "impactAccumulation":66,"recoveryHours":48,
      "recoveryWindow":"candidate planning estimate only; individualize from novelty direction projection contacts symptoms and overlapping rotational jump sprint and landing exposure",
      "earlyFatigueSignals":["slower or delayed spotting","arm or trunk turn strategy change","underrotation or overrotation","asymmetric contact","continued rotation","extra step hand touch or louder landing","dizziness or slower stop response"],
      "downstreamConflicts":["priority sprint or jump output","rotational acrobatics","dense plyometric or landing contacts","tasks requiring fresh visual orientation"]
    }$json$::JSONB,
    $json${
      "selection":{"phaseDefault":"movement_intelligence","readinessIsWorkoutInput":true,"exerciseDifficultyDoesNotClassifyAthletes":true},
      "trainingStimuli":["forward full-turn projection","declared-direction orientation","target spotting","bilateral rotational braking and stick"],
      "stimulusDose":{"primary":"quality_terminated_direction_declared_attempts","countInvalidPartialAssistedIncidentAndEveryContact":true,"fatigueCeiling":"low"},
      "weeklyExposure":"Combine every attempt and contact with all rotational jump acrobatic sprint and landing exposure by direction.",
      "prerequisites":["pain-free broad jump to stick","separate lower-angle turn control","target can be located before landing","direction and stop signal understood"],
      "completionCriteria":["stationary bilateral start","declared full turn","target reacquired","bilateral declared-heading landing","two-second stick","direction-specific exposure recorded"],
      "sequenceRules":["place while attention orientation and landing control are fresh","alternate direction only when each attempt is declared","stop before turn spotting or contact changes"],
      "pairingCompatibility":["low-demand instruction or visualization","noncompeting mobility after full recovery"],
      "interferenceRules":["do not pre-fatigue rotation target tracking or landing","include all same-session directional contacts","recompute after substitution"],
      "uncertaintyPolicy":"If direction target heading rotation amount or contact cannot be observed, do not select.",
      "publicationQuarantined":true
    }$json$::JSONB),
  (rotation_precision_variant,rotation_definition,
    'standing-parkour-360-precision-low-restricted-target',
    'Standing Parkour 360 Precision — Low Restricted Target',
    ARRAY['stationary_bilateral','forward_projection','full_turn',
      'restricted_low_target','bilateral_forefoot_contact','two_second_stick']::TEXT[],
    $json${
      "technicalComplexity":86,"absoluteLoadDemand":68,"physicalDifficulty":68,
      "coordinationDemand":90,"supervisionDemand":90,"failureConsequence":92,
      "impact":72,"workCapacityDemand":32,"baseOverallDifficulty":86,
      "balanceDemand":90,"decisionDemand":82,"fearExposure":84,
      "technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty",
      "overallFormula":"max(exercise_complexity,physical_difficulty)",
      "complexityDimensions":{"takeoffAndTurnTiming":88,"targetReacquisition":94,"rotationAmountAndHeading":92,"restrictedTargetPlacement":94,"terminalStability":90,"errorDetectionAndBailout":82},
      "physicalDimensions":{"horizontalPropulsion":68,"rotationAndSegmentControl":72,"restrictedForefootSupport":74,"landingAbsorption":72,"relativeBodyweightDemand":62},
      "candidateIndependentCalibrationRequired":true
    }$json$::JSONB,
    $json${
      "selectable":true,"representation":"exact_working_specification",
      "actionFamily":"parkour_360_precision",
      "start":"stationary_parallel_bilateral_foot_support_at_declared_takeoff_edge_or_spot_and_heading",
      "countermovement":"one_declared_direction_arm_and_leg_countermovement",
      "approach":"forbidden","projection":"forward_to_declared_low_restricted_target",
      "wholeBodyTurnDegrees":360,"turnDirection":"declared_clockwise_or_counterclockwise_before_attempt",
      "takeoffLaterality":"bilateral_simultaneous","flightCount":1,
      "targetInterface":"secured low horizontal top surface sized and declared for bilateral forefoot or ball-of-foot placement without full-foot support",
      "targetGeometry":"width depth height distance alignment edge profile final heading and miss consequence are measured and persisted",
      "targetReacquisition":"selected target must be visually located before contact",
      "landingContact":"both forefeet or balls of feet contact the target top simultaneously at the declared full-turn heading; heels remain unsupported beyond the target",
      "landingLaterality":"bilateral_simultaneous","landingEventCount":1,
      "terminalAction":"two_second_stick_without_continued_rotation_step_hand_contact_rebound_fall_or_connection",
      "assistanceContract":"coach controls station and bailout but does not propel carry or catch a valid repetition",
      "workingContactGeometryAndSpottingRequireHumanReview":true,
      "invalidatingEvents":["approach","wrong direction","underrotation or overrotation","target not located before contact","asynchronous takeoff or landing","underreach overreach edge slip heel shin hand or undeclared surface contact","continued rotation step rebound fall rescue symptom disorientation or connection"]
    }$json$::JSONB,'review',
    $json${
      "loadingType":"bodyweight_bilateral_forward_ballistic_full_turn_to_restricted_forefoot_support_and_eccentric_rotational_braking",
      "externalLoadMethod":"bodyweight","gripDemand":5,"spinalLoading":58,
      "eccentricStress":72,"landingEventsPerRep":1,"landingContactsPerRep":2,
      "landingFootContactsPerRep":2,"plannedImpactContacts":2,
      "contactCountRule":"count both planned target feet plus every failed partial assisted incident or unplanned contact",
      "supportLoad":"bodyweight linear and angular momentum is accepted through two restricted forefoot target contacts; exact joint and left-right distribution is not assumed",
      "primaryStress":["forward_propulsion","whole_body_rotation","target_reacquisition","restricted_forefoot_placement","linear_and_rotational_braking","bilateral_stick"],
      "effectiveLoadDrivers":["body mass and anthropometry","distance height and rotation impulse","direction and segment strategy","target width depth edge friction and final heading","surface footwear and miss consequence","landing strategy assistance and prior fatigue"]
    }$json$::JSONB,
    $json${
      "localMuscleFatigue":62,"gripFatigue":5,"technicalFatigueSensitivity":94,
      "impactAccumulation":72,"recoveryHours":48,
      "recoveryWindow":"candidate planning estimate only; individualize from novelty direction geometry consequence contacts symptoms and overlapping rotational jump parkour and landing exposure",
      "earlyFatigueSignals":["delayed target spotting","turn strategy change","underrotation or overrotation","edge miss foot separation heel or shin contact","continued rotation","step hand touch louder landing","dizziness disorientation or slower stop response"],
      "downstreamConflicts":["priority sprint or jump output","rotational acrobatics","parkour lines with shared target or landing fatigue","dense plyometric contacts","tasks requiring fresh visual orientation"]
    }$json$::JSONB,
    $json${
      "selection":{"phaseDefault":"movement_intelligence","readinessIsWorkoutInput":true,"exerciseDifficultyDoesNotClassifyAthletes":true},
      "trainingStimuli":["forward full-turn projection","target reacquisition","restricted bilateral forefoot placement","rotational and linear braking","two-second stick"],
      "stimulusDose":{"primary":"quality_terminated_direction_declared_valid_attempts","countInvalidPartialAssistedIncidentAndEveryContact":true,"fatigueCeiling":"very_low"},
      "weeklyExposure":"Combine every attempt and contact with all rotational jump acrobatic sprint parkour and landing exposure by direction and target consequence.",
      "prerequisites":["pain-free open-surface 360 jump to stick","exact low restricted target and bailout available","target can be located before contact","coach sees direction rotation target and every contact"],
      "completionCriteria":["stationary bilateral start","declared full turn","target reacquired","both restricted-target forefeet together","two-second declared-heading stick","complete exposure record"],
      "sequenceRules":["place while attention orientation and landing control are fresh","do not use as an unplanned race or fatigue circuit","stop before first turn spotting target or contact change"],
      "pairingCompatibility":["low-demand instruction or visualization","noncompeting mobility after full recovery"],
      "interferenceRules":["do not pre-fatigue rotation target tracking calf foot or landing control","do not share a live fall lane","revalidate after direction geometry dose or endpoint change"],
      "uncertaintyPolicy":"If direction target geometry rotation contact endpoint miss or assistance is uncertain, quarantine and resolve the exact contract.",
      "publicationQuarantined":true
    }$json$::JSONB)
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  UPDATE coaching.exercise_delivery_profile_v1 SET
    quality_gate=CASE profile_key
      WHEN 'landing-control-horizontal' THEN 'One stationary bilateral horizontal jump ends in simultaneous open-surface foot contact and a two-to-three-second stick without a hand touch, step, shuffle, rebound, turn, fall, or connection.'
      ELSE 'Distance remains inside the declared output band and every open-surface landing is held after one stationary bilateral flight without a touch, step, shuffle, rebound, turn, or lane exit.' END,
    stop_rules=ARRAY['pain','giving way','numbness or weakness','dizziness or fear',
      'asynchronous feet','hand touch or extra step','shuffle or rebound',
      'turn or connected action','lane intrusion or surface movement',
      'two changed attempts or impact budget reached']::TEXT[],
    coach_instructions=CASE profile_key
      WHEN 'landing-control-horizontal' THEN 'Verify the open-surface exact variant, clear lane, stationary bilateral start, natural arm policy, target, simultaneous takeoff and landing, two-to-three-second stick, full reset, every contact, first fault, symptoms, and actual rest. Scale target distance before repetitions and stop at the first changed landing.'
      ELSE 'Use the open-surface exact variant only when controlled horizontal output is the objective. Verify target band, full recovery, simultaneous contacts, stick, every valid and failed attempt, first fault, symptoms, and actual duration; reduce distance immediately when the landing changes.' END,
    athlete_instructions=CASE profile_key
      WHEN 'landing-control-horizontal' THEN 'Start still, dip and swing once, jump forward, land on both feet, freeze for the count, then reset.'
      ELSE 'Jump to the declared target, land with both feet together, freeze, then recover fully before the next attempt.' END,
    expected_adaptation=CASE profile_key
      WHEN 'landing-control-horizontal' THEN 'Horizontal projection with repeatable bilateral momentum absorption and terminal braking.'
      ELSE 'High horizontal output constrained by an unchanged bilateral terminal stick.' END,
    equipment_required=ARRAY['none']::TEXT[],
    logistics_json=$json${"station":"one clear single-flight landing fall and run-out lane","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"],"stationCapacity":1}$json$::JSONB,
    status='review',
    time_model_json=CASE profile_key
      WHEN 'landing-control-horizontal' THEN $json${"durationFormula":"setup + sets * repetitions * (attempt + hold + reset) + between-repetition rest + between-set rest","setupSeconds":45,"attemptSeconds":4,"holdSecondsFromDose":true,"resetSeconds":{"min":12,"max":25},"setTransitionSeconds":15,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB
      ELSE $json${"durationFormula":"setup + sets * repetitions * (attempt + hold + reset) + full between-repetition and between-set recovery","setupSeconds":45,"attemptSeconds":4,"holdSecondsFromDose":true,"resetSeconds":{"min":20,"max":40},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB END,
    dose_scaling_json=CASE profile_key
      WHEN 'landing-control-horizontal' THEN $json${"preserve":["stationary start","bilateral takeoff and landing","open-surface contact","declared stick","full reset"],"scaleDownOrder":["target distance","intent","repetitions"],"neverAdd":["turn","rebound","run-up","connection"],"revalidateAfterChange":true}$json$::JSONB
      ELSE $json${"preserve":["one flight","bilateral landing","terminal stick","output band"],"scaleDownOrder":["target distance","intent","repetitions"],"neverAdd":["turn","rebound","run-up","connection"],"revalidateAfterChange":true}$json$::JSONB END,
    measurement_json=$json${"record":["definition variant and profile","target or distance","valid invalid partial assisted and incident attempts","both planned and unplanned contacts","hold","rest","first fault","symptoms","substitution","actual duration"]}$json$::JSONB,
    support_prompts_json=$json${"athletePrompts":["Can you repeat the exact target contact and freeze without another touch?"],"coachPrompts":["Does the next attempt preserve the same trajectory contact and stick?"],"supportPrompt":"Quarantine identity dose target media rendering or persistence mismatches."}$json$::JSONB,
    updated_at=now()
  WHERE variant_id=base_variant
    AND profile_key IN('landing-control-horizontal','output-controlled-distance');

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT p.variant_id,p.profile_key,p.phase_key,p.role,p.purpose,p.suitability,
    p.alignment,
    jsonb_build_object('targetPlacement',5,'terminalControl',5,
      'horizontalProjection',CASE WHEN p.action_key='precision' THEN 4 ELSE 5 END,
      'rotationControl',CASE WHEN p.action_key='precision' THEN 1 ELSE 5 END),
    jsonb_build_object(
      'sets',jsonb_build_object('min',p.sets_min,'max',p.sets_max),
      'repetitionsPerSet',jsonb_build_object('min',p.reps_min,'max',p.reps_max),
      'restBetweenRepsSeconds',jsonb_build_object('min',p.rest_rep_min,'max',p.rest_rep_max),
      'restBetweenSetsSeconds',jsonb_build_object('min',p.rest_set_min,'max',p.rest_set_max),
      'landingHoldSeconds',jsonb_build_object('min',2,'max',3),
      'intent',p.intent,'landingEventsPerRep',1,'plannedFootContactsPerRep',2,
      'countFailedPartialAssistedIncidentAttemptsAndEveryContact',TRUE),
    p.quality_gate,
    ARRAY['pain guarding numbness weakness or giving way','dizziness disorientation or fear',
      'target surface marker platform or mat moves','lane intrusion or lost coach sightline',
      'takeoff feet separate','target not located before contact',
      'landing feet separate or miss selected target contact','hand shin heel or undeclared contact',
      'step shuffle rebound continued rotation fall rescue or connection',
      'two changed attempts or planned contact budget reached']::TEXT[],
    p.coach_instructions,p.athlete_instructions,p.expected_adaptation,
    p.equipment,
    jsonb_build_object('station',p.station,'stationCapacity',1,
      'setupSeconds',p.setup_seconds,'surfaceInspection',TRUE,
      'noCrossTraffic',TRUE,'completeMissAndBailoutEnvelope',TRUE,
      'coachViews',jsonb_build_array('side','front_or_landing_quarter')),
    p.substitution_ids,'review',
    jsonb_build_object(
      'durationFormula','setup + sets * repetitions * (attempt + hold + reset) + between-repetition rest + between-set rest',
      'setupSeconds',p.setup_seconds,'attemptSeconds',p.attempt_seconds,
      'holdSecondsFromDose',TRUE,
      'resetSeconds',jsonb_build_object('min',p.reset_min,'max',p.reset_max),
      'setTransitionSeconds',20,'durationIncludesRest',TRUE,
      'estimatedSessionSeconds',jsonb_build_object('min',p.duration_min,'max',p.duration_max),
      'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'preserve',p.preserve,
      'scaleDownOrder',p.scale_order,
      'neverScaleBy',jsonb_build_array('athlete proficiency label','unreviewed target or apparatus','unplanned assistance','adding run-up turn drop rebound hand contact or connection'),
      'revalidateAllGenerationInputs',TRUE),
    jsonb_build_object(
      'record',jsonb_build_array('definition variant and profile','direction when applicable','target interface and geometry','valid invalid partial assisted and incident attempts','both planned and unplanned contacts','hold','rest','first fault','symptoms','substitution','actual duration'),
      'cumulativeBudgets',jsonb_build_array('jump and landing contacts','lower-leg and landing fatigue','rotation and target-tracking fatigue','same-session sprint plyometric parkour and acrobatic exposure')),
    jsonb_build_object(
      'athletePrompt','Report symptoms fear dizziness uncertainty and the first changed target contact or stick.',
      'coachPrompt','Record exact variant geometry direction every contact first fault symptoms substitution rest and actual duration.',
      'supportPrompt','Quarantine identity target media dose rendering persistence or review-state mismatch; never infer approval.')
  FROM (VALUES
    (precision_variant,'precision','prepare-and-access-rehearsal','prepare_and_access','secondary','Rehearse the exact stationary start, low restricted target, bilateral forefoot contact, stick, miss, and bailout at the shortest reviewed geometry.',86,88,1,2,1,2,60,120,90,180,'submaximal exact target rehearsal','Both feet contact the declared low restricted target together and retain a two-second stick without another contact.','Verify the exact low target and bailout, use the shortest reviewed distance, observe both feet and every miss, and stop at the first contact or confidence change.','Jump from both feet to the close target, place both forefeet together, freeze for two seconds, then reset.','Exact restricted-target contact and stop behavior before longer precision work.',ARRAY['platform','mat','tape_measure','timer']::TEXT[],'isolated_low_restricted_precision_lane',60,4,12,25,240,720,ARRAY[base_variant]::UUID[],ARRAY['stationary bilateral start','restricted target','simultaneous forefoot contact','two-second stick','full reset']::TEXT[],ARRAY['target distance','intent','repetitions']::TEXT[]),
    (precision_variant,'precision','movement-intelligence-quality','movement_intelligence','primary','Develop repeatable stationary parkour precision projection, restricted bilateral forefoot placement, absorption, and two-second target ownership.',96,94,2,4,2,4,90,180,120,240,'highest precision that preserves exact contact','The declared restricted-target contact, two-second stick, and reset remain identical across every valid attempt.','Keep attention and lower legs fresh, verify exact geometry, count every contact and miss, and terminate before trajectory foot placement or stick changes.','See the target, swing and jump, place both forefeet together, own the two-second stick, then reset.','Target-specific visual-motor placement and terminal balance under low fatigue.',ARRAY['platform','mat','tape_measure','timer']::TEXT[],'isolated_low_restricted_precision_lane',75,4,15,30,480,1260,ARRAY[base_variant]::UUID[],ARRAY['stationary bilateral start','restricted target','simultaneous forefoot contact','two-second stick','full reset']::TEXT[],ARRAY['target distance','target demand inside reviewed range','attempts']::TEXT[]),
    (precision_variant,'precision','output-quality','output','conditional','Express controlled horizontal power only while the exact restricted target contact and stick remain unchanged.',82,88,2,3,1,3,120,240,150,300,'highest distance inside exact precision gate','Distance remains in the declared band and every restricted-target landing is simultaneous and retained for two seconds.','Use only after the movement profile is stable, provide full recovery, record distance and every contact, and stop on first output or landing change.','Jump to the declared distance, place both forefeet together, freeze, and recover fully before repeating.','Horizontal output constrained by exact restricted-target placement and terminal control.',ARRAY['platform','mat','tape_measure','timer']::TEXT[],'isolated_low_restricted_precision_lane',75,4,20,40,540,1440,ARRAY[base_variant]::UUID[],ARRAY['stationary bilateral start','restricted target','simultaneous forefoot contact','two-second stick','output band']::TEXT[],ARRAY['distance','intent','repetitions']::TEXT[]),
    (rotation_open_variant,'rotation','prepare-and-access-rehearsal','prepare_and_access','secondary','Rehearse declared direction, start and finish headings, target spotting, bilateral landing, stick, and bailout on an open surface.',76,84,1,2,1,2,120,180,150,240,'submaximal direction rehearsal','One declared full turn ends at the marked heading with both feet together and a two-second open-surface stick.','Verify direction headings and full clearance, observe spotting and both feet, count every attempt, and stop for dizziness target loss or changed rotation.','Declare the direction, jump and turn, find the landing, place both feet together, freeze, then reset.','Full-turn orientation and stop behavior at low projection demand.',ARRAY['line_tape','timer']::TEXT[],'isolated_open_surface_360_lane',75,5,20,40,300,900,ARRAY[ninety_variant,base_variant]::UUID[],ARRAY['stationary bilateral start','declared full turn','target spotting','bilateral open-surface landing','two-second stick']::TEXT[],ARRAY['projection distance','rotation speed','attempts']::TEXT[]),
    (rotation_open_variant,'rotation','movement-intelligence-quality','movement_intelligence','primary','Develop repeatable forward full-turn projection, target reacquisition, simultaneous bilateral landing, and terminal rotational braking.',94,92,2,4,1,3,150,240,180,300,'highest turn quality with exact heading','Direction, rotation amount, target spotting, bilateral contact, final heading, and two-second stick remain exact.','Keep attention and orientation fresh, verify direction and headings before each attempt, observe target reacquisition and landing, and stop at the first changed turn.','Declare the direction, rise and turn, find the target, land together at the heading, freeze, then reset.','Visual-spatial orientation and bilateral rotational landing control.',ARRAY['line_tape','timer']::TEXT[],'isolated_open_surface_360_lane',75,5,25,45,540,1440,ARRAY[ninety_variant,base_variant]::UUID[],ARRAY['stationary bilateral start','declared full turn','target spotting','bilateral landing','declared heading and stick']::TEXT[],ARRAY['projection distance','rotation speed','attempts']::TEXT[]),
    (rotation_open_variant,'rotation','output-quality','output','conditional','Express forward rotational output only while the full turn, target reacquisition, bilateral landing, and stick remain exact.',78,86,2,3,1,3,180,300,210,360,'highest projection with exact full turn and stick','Projection remains in the declared band and every full turn ends at the same heading with bilateral contact and two-second stick.','Use only after exact low-demand full turns are repeatable, provide full recovery, record direction and every contact, and stop on first rotation or landing change.','Jump and turn to the declared target, find it, land together, freeze, and recover fully.','Forward full-turn output constrained by orientation and landing quality.',ARRAY['line_tape','timer']::TEXT[],'isolated_open_surface_360_lane',75,5,30,50,600,1680,ARRAY[ninety_variant,base_variant]::UUID[],ARRAY['stationary bilateral start','declared full turn','target spotting','bilateral landing','output band and stick']::TEXT[],ARRAY['projection distance','intent','attempts']::TEXT[]),
    (rotation_precision_variant,'rotation_precision','prepare-and-access-rehearsal','prepare_and_access','secondary','Rehearse the exact full-turn direction, low restricted target, spotting, simultaneous forefoot placement, stick, miss, and bailout at minimal geometry.',72,84,1,2,1,2,180,240,210,300,'minimal geometry exact target rehearsal','One declared full turn ends with both forefeet together on the low restricted target and a two-second stick without continued rotation.','Verify exact direction target geometry and complete bailout, observe target reacquisition and every contact, and stop at the first dizziness miss or changed turn.','Declare the direction, turn to the close target, find it, place both forefeet together, freeze, then reset.','Exact full-turn restricted-target contact and bailout behavior at low projection demand.',ARRAY['platform','mat','tape_measure','timer']::TEXT[],'isolated_low_restricted_360_precision_lane',90,5,30,60,360,1080,ARRAY[rotation_open_variant,precision_variant]::UUID[],ARRAY['stationary bilateral start','declared full turn','target spotting','restricted forefoot contact','two-second stick']::TEXT[],ARRAY['projection distance','rotation speed','attempts']::TEXT[]),
    (rotation_precision_variant,'rotation_precision','movement-intelligence-quality','movement_intelligence','primary','Develop exact forward full-turn projection, restricted-target reacquisition, simultaneous forefoot placement, and rotational braking.',92,94,2,3,1,3,210,300,240,360,'highest exact 360 precision quality','Direction, full rotation, target spotting, simultaneous restricted contact, final heading, and two-second stick remain exact.','Keep attention orientation calf and foot control fresh, verify geometry before every attempt, count all contacts and misses, and stop at the first turn target or stick change.','Declare the direction, rise and turn, find the target, place both forefeet together, stop the turn, then reset.','High-precision visual-spatial orientation and restricted-target bilateral landing control.',ARRAY['platform','mat','tape_measure','timer']::TEXT[],'isolated_low_restricted_360_precision_lane',90,5,35,70,600,1740,ARRAY[rotation_open_variant,precision_variant]::UUID[],ARRAY['stationary bilateral start','declared full turn','target spotting','restricted forefoot contact','declared heading and stick']::TEXT[],ARRAY['projection distance','target demand inside reviewed range','attempts']::TEXT[]),
    (rotation_precision_variant,'rotation_precision','output-quality','output','conditional','Express forward full-turn output only while exact target reacquisition, restricted contact, final heading, and stick remain unchanged.',68,84,2,3,1,2,240,360,300,420,'highest projection inside exact 360 precision gate','Projection remains inside the declared band and every full turn ends with the same simultaneous restricted-target contact and two-second stick.','Use only after exact low-demand 360 precision attempts are repeatable, provide full recovery, record direction geometry and every contact, and stop on first output rotation or landing change.','Turn to the declared target, find it, land both forefeet together, freeze, and recover fully.','Forward full-turn output constrained by exact restricted-target orientation and landing quality.',ARRAY['platform','mat','tape_measure','timer']::TEXT[],'isolated_low_restricted_360_precision_lane',90,5,40,80,660,1920,ARRAY[rotation_open_variant,precision_variant]::UUID[],ARRAY['stationary bilateral start','declared full turn','target spotting','restricted forefoot contact','output band and stick']::TEXT[],ARRAY['projection distance','intent','attempts']::TEXT[])
  ) p(variant_id,action_key,profile_key,phase_key,role,purpose,suitability,
      alignment,sets_min,sets_max,reps_min,reps_max,rest_rep_min,rest_rep_max,
      rest_set_min,rest_set_max,intent,quality_gate,coach_instructions,
      athlete_instructions,expected_adaptation,equipment,station,setup_seconds,
      attempt_seconds,reset_min,reset_max,duration_min,duration_max,
      substitution_ids,preserve,scale_order)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,
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

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT e.definition_id,e.card_version,e.section_key,e.source_url,e.source_title,
    e.source_publisher,e.source_kind,e.claims,e.quality,'candidate',NULL,NULL
  FROM (VALUES
    (survivor_definition,3,'identity','https://pmc.ncbi.nlm.nih.gov/articles/PMC6093881/','On the coordination of highly dynamic human movements: an extension of the Uncontrolled Manifold approach applied to precision jump in parkour','Scientific Reports','peer_reviewed_research',$claims$["The studied parkour precision is similar to a standing long jump: a horizontal jump without run-up, simultaneous two-foot takeoff, arm swing, forward projection, precise forefoot landing, and stabilization.","The study involved seven trained male traceurs under one laboratory protocol; it supports the exact stationary working identity but not a universal technique, safe target, dose, recovery interval, or numeric difficulty."]$claims$::JSONB,92),
    (survivor_definition,3,'taxonomy','https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf','UrbanLeap Parkour Trainer Handbook','UrbanLeap Erasmus+ Sport Project','professional_standard',$claims$["The handbook places Precision Jump among parkour jumps and landings and distinguishes 360 Precision, Splat, Cat Leap, and Drop Landing.","It describes standing and run-up applications together, so this card fixes the stationary bilateral interpretation and treats dynamic entry as a distinct identity requiring its own contract."]$claims$::JSONB,78),
    (survivor_definition,3,'anatomy','https://pubmed.ncbi.nlm.nih.gov/26949101/','Exploration of the validity of the two-dimensional sagittal plane assumption in modeling the standing long jump','Journal of Biomechanics','peer_reviewed_research',$claims$["Standing-long-jump work coordinates foot, ankle, knee, hip, pelvis, trunk, shoulder, and elbow actions rather than one isolated muscle.","The study supports multi-joint anatomy; the restricted target and parkour contact details come from direct precision sources and remain human-review candidates."]$claims$::JSONB,88),
    (survivor_definition,3,'biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC6093881/','On the coordination of highly dynamic human movements: an extension of the Uncontrolled Manifold approach applied to precision jump in parkour','Scientific Reports','peer_reviewed_research',$claims$["The precision task has takeoff, flight, and landing phases; arm swing contributes to impulse and rotation control while landing requires momentum regulation and stabilization.","The laboratory target and expert sample do not establish one mandatory joint-angle template for every person, target, surface, or context."]$claims$::JSONB,92),
    (survivor_definition,3,'difficulty','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202026.pdf','Parkour Code of Points 2025–2028 — Table of Tricks 2026','World Gymnastics / Fédération Internationale de Gymnastique','governing_body',$claims$["World Gymnastics lists basic Precision Jump separately from 360 Precision and increases difficulty for distance, height difference, restricted takeoff, narrow or elevated landing, and connected entry or exit.","Competition values are not Vortex 1–100 scores; complexity and physical-difficulty values remain independent review-only calibration proposals and do not classify athletes."]$claims$::JSONB,95),
    (survivor_definition,3,'load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC3761764/','Ground reaction forces and loading rates associated with parkour and traditional drop landing techniques','Journal of Sports Science and Medicine','peer_reviewed_research',$claims$["Ten trained male traceurs performed 0.75-m drop landings; the tested precision technique used forefoot contact without rear-foot contact and produced different forces and loading rates from a traditional landing.","This is adjacent drop-landing evidence, not a standing precision-jump dose study; it does not establish a universal safe height, injury claim, recovery interval, or contact budget."]$claims$::JSONB,84),
    (survivor_definition,3,'constraints','https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf','UrbanLeap Parkour Trainer Handbook','UrbanLeap Erasmus+ Sport Project','professional_standard',$claims$["Precision is used for controlled placement on small surfaces such as walls, rails, bars, and edges; progression changes surface width, height, distance, and entry.","The handbook is educational guidance rather than a normative safety standard; target geometry, matting, consequence, supervision, and bailout must be declared locally."]$claims$::JSONB,78),
    (survivor_definition,3,'dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC11622049/','Acute Neuromuscular Fatigue of a Random Vs Constant Session of Repeated Standing Long Jumps','Journal of Sports Science and Medicine','peer_reviewed_research',$claims$["Fifteen healthy young participants completed 100 variable- or constant-distance standing long jumps in a deliberately fatiguing protocol, showing that repeated targeted jumps create meaningful acute exposure.","That 100-jump protocol is not a recommended precision dose; Vortex uses small quality-terminated candidate ranges and counts every valid, failed, partial, assisted, incident, and unplanned contact pending coach review."]$claims$::JSONB,84),
    (survivor_definition,3,'instructions','https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf','UrbanLeap Parkour Trainer Handbook','UrbanLeap Erasmus+ Sport Project','professional_standard',$claims$["The handbook describes arm-assisted projection, knee lift, target-directed feet, forward hand counterbalance, balls-of-feet contact, and stabilization, with misses including overjump, underjump, slip, and shin contact.","Its knee-angle and spotting guidance is not treated as a universal medical threshold; the card uses observable identity, target, contact, stick, fault, and stop rules pending human review."]$claims$::JSONB,78),
    (survivor_definition,3,'safety_stop_rules','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202026.pdf','Parkour Code of Points 2025–2028 — Table of Tricks 2026','World Gymnastics / Fédération Internationale de Gymnastique','governing_body',$claims$["The current table distinguishes controlled, soft landings from slips, collisions, uncontrolled seated or lying landings, and major crashes.","Competition deductions do not establish clinical safety; Vortex stops on symptoms, target or lane failure, miss, collision, fall, identity drift, or repeated technical change."]$claims$::JSONB,95),
    (survivor_definition,3,'programming','https://pmc.ncbi.nlm.nih.gov/articles/PMC11622049/','Acute Neuromuscular Fatigue of a Random Vs Constant Session of Repeated Standing Long Jumps','Journal of Sports Science and Medicine','peer_reviewed_research',$claims$["Target distance and repeated jump volume affect acute precision-like standing-long-jump exposure and action-perception demand.","The study does not validate this card's set, repetition, rest, weekly frequency, or recovery proposals; keep precision work fresh, quality-terminated, and included in cumulative jump and landing budgets."]$claims$::JSONB,84),
    (survivor_definition,3,'athlete_support','https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf','UrbanLeap Parkour Trainer Handbook','UrbanLeap Erasmus+ Sport Project','professional_standard',$claims$["Precision learning begins with visible ground lines and low targets before added width, height, distance, or dynamic entry.","Athlete support therefore shows the exact target and stick, offers an open-surface alternative, and asks the athlete to report symptoms, fear, misses, slips, or changed control."]$claims$::JSONB,78),
    (survivor_definition,3,'coach_support','https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf','UrbanLeap Parkour Trainer Handbook','UrbanLeap Erasmus+ Sport Project','professional_standard',$claims$["The handbook changes coach position and spotting with target, surface, height, athlete behavior, and over- or under-jump tendency.","It does not authorize one universal manual assist; the working card requires exact station control, sightlines, bailout, contact accounting, and incident recording pending qualified review."]$claims$::JSONB,78),
    (survivor_definition,3,'accessibility','https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/','Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes','BMJ Open Sport & Exercise Medicine','peer_reviewed_research',$claims$["Jump-landing interventions depend on task-specific instruction, feedback, suitable materials, and progression rather than a single universal drill.","Accessible options may change target visibility, distance, interface, contacts, rest, and instruction format; any identity change requires a different variant or definition and revalidation."]$claims$::JSONB,89),
    (survivor_definition,3,'alternates','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202026.pdf','Parkour Code of Points 2025–2028 — Table of Tricks 2026','World Gymnastics / Fédération Internationale de Gymnastique','governing_body',$claims$["Basic Precision and 360 Precision are separate listed elements; placement, entry, exit, narrow surfaces, elevation, distance, and connections alter difficulty.","Standing restricted-target precision is an exact variant of the no-turn stick family; rotation, dynamic entry, one-foot action, drop, rebound, hand contact, and connections require distinct identities."]$claims$::JSONB,95),
    (survivor_definition,3,'media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',$claims$["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five current candidates have oEmbed metadata and embed-response health only; full playback, exact variant, captions, accessibility, cue quality, safety, reviewer identity, and approval remain human gates."]$claims$::JSONB,82),
    (rotation_definition,1,'identity','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202026.pdf','Parkour Code of Points 2025–2028 — Table of Tricks 2026','World Gymnastics / Fédération Internationale de Gymnastique','governing_body',$claims$["World Gymnastics lists 360 Precision separately from basic Precision, establishing a distinct full-turn action rather than a target-only modifier.","The table does not define every start, heading, spotting, target, contact, hold, bailout, dose, or safety rule; these remain explicit machine-authored working constraints pending review."]$claims$::JSONB,95),
    (rotation_definition,1,'taxonomy','https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf','UrbanLeap Parkour Trainer Handbook','UrbanLeap Erasmus+ Sport Project','professional_standard',$claims$["The handbook gives 360 Precision its own movement description using rotational arm swing, head turn, target spotting, leg extension toward the landing spot, and arm balance.","The card separates full-turn action from no-turn precision and declares open versus restricted target as exact variants."]$claims$::JSONB,78),
    (rotation_definition,1,'anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC6776723/','The Effects of Mid-flight Whole-Body and Trunk Rotation on Landing Mechanics: Implications for Anterior Cruciate Ligament Injuries','Journal of Biomechanics','peer_reviewed_research',$claims$["Mid-flight whole-body and trunk rotation changes task-specific landing mechanics and requires multi-planar lower-limb and trunk control.","The study is adjacent rotational-landing evidence, not a 360 Precision prescription; exact anatomy and score proposals remain review-only."]$claims$::JSONB,91),
    (rotation_definition,1,'biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC6776723/','The Effects of Mid-flight Whole-Body and Trunk Rotation on Landing Mechanics: Implications for Anterior Cruciate Ligament Injuries','Journal of Biomechanics','peer_reviewed_research',$claims$["Whole-body rotation and trunk strategy materially affect landing mechanics, supporting explicit turn direction, rotation amount, target heading, and rotational braking fields.","The study does not establish a universal safest turn strategy, spotting timing, distance, target, or dose for parkour 360 Precision."]$claims$::JSONB,91),
    (rotation_definition,1,'difficulty','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202026.pdf','Parkour Code of Points 2025–2028 — Table of Tricks 2026','World Gymnastics / Fédération Internationale de Gymnastique','governing_body',$claims$["The current table assigns 360 Precision a materially higher competition value than basic Precision and further scales narrow or elevated landing, distance, height, entry, and exit.","Competition points are not Vortex scores; the proposed exercise-complexity and physical-difficulty anchors require independent human calibration and never classify athletes."]$claims$::JSONB,95),
    (rotation_definition,1,'load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC6776723/','The Effects of Mid-flight Whole-Body and Trunk Rotation on Landing Mechanics: Implications for Anterior Cruciate Ligament Injuries','Journal of Biomechanics','peer_reviewed_research',$claims$["Adding whole-body and trunk rotation changes landing mechanics beyond a straight jump and creates directional orientation and braking demands.","It does not validate the proposed 48-hour planning estimate, contact cap, or weekly exposure; count every directional attempt and landing with all rotational and plyometric work."]$claims$::JSONB,91),
    (rotation_definition,1,'constraints','https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf','UrbanLeap Parkour Trainer Handbook','UrbanLeap Erasmus+ Sport Project','professional_standard',$claims$["The handbook progresses 360 Precision from rotation and forward control to ground and then obstacle-to-obstacle targets, with coach position changing when obstacle consequence rises.","It is educational guidance, not a universal safety standard; direction, headings, geometry, sightlines, matting, lane, miss, and bailout must be local and exact."]$claims$::JSONB,78),
    (rotation_definition,1,'dosage','https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf','UrbanLeap Parkour Trainer Handbook','UrbanLeap Erasmus+ Sport Project','professional_standard',$claims$["The handbook provides a learning sequence for arm swing, rotation, forward travel, distance, and obstacle transfer but no universal set-repetition-rest prescription.","Candidate delivery uses few quality-terminated attempts with full recovery and direction-specific contact accounting pending coach and pilot review."]$claims$::JSONB,78),
    (rotation_definition,1,'instructions','https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf','UrbanLeap Parkour Trainer Handbook','UrbanLeap Erasmus+ Sport Project','professional_standard',$claims$["The handbook describes diagonal rotational arm swing, head turn, arms drawn toward the body, target spotting, leg extension to the target, and arms forward for landing balance.","Vortex translates those observations into declared direction, target reacquisition, bilateral contact, final heading, stick, and invalidation fields without claiming one universal style."]$claims$::JSONB,78),
    (rotation_definition,1,'safety_stop_rules','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202026.pdf','Parkour Code of Points 2025–2028 — Table of Tricks 2026','World Gymnastics / Fédération Internationale de Gymnastique','governing_body',$claims$["Current judging distinguishes controlled landings from slips, collisions, uncontrolled seated or lying landings, and major crashes.","For a full-turn target task, Vortex additionally stops on dizziness, disorientation, lost target, wrong direction, under- or overrotation, lane failure, miss, fall, or changed technique."]$claims$::JSONB,95),
    (rotation_definition,1,'programming','https://pmc.ncbi.nlm.nih.gov/articles/PMC6776723/','The Effects of Mid-flight Whole-Body and Trunk Rotation on Landing Mechanics: Implications for Anterior Cruciate Ligament Injuries','Journal of Biomechanics','peer_reviewed_research',$claims$["Rotational landing is task-specific and should not be programmed as interchangeable with straight landing without revalidation.","Place candidate 360 work while orientation and landing control are fresh, track direction and all contacts, and avoid automatic substitution or fatigued circuit delivery."]$claims$::JSONB,91),
    (rotation_definition,1,'athlete_support','https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf','UrbanLeap Parkour Trainer Handbook','UrbanLeap Erasmus+ Sport Project','professional_standard',$claims$["The handbook builds rotation, forward travel, spotting, and target landing progressively rather than asking for an undeclared full-turn obstacle jump.","Athlete support displays direction, headings, target, contact, stick, bailout, symptoms, and an open-surface or lower-angle alternative without assigning a proficiency level."]$claims$::JSONB,78),
    (rotation_definition,1,'coach_support','https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf','UrbanLeap Parkour Trainer Handbook','UrbanLeap Erasmus+ Sport Project','professional_standard',$claims$["The handbook identifies insufficient arm swing or rotation, excessive rotation, balance loss, wrong lean, and slow head turn as common observable errors.","Coach support must also control direction-specific lanes, sightlines, exact target geometry, every contact, first fault, dizziness, incident, and revalidation after change."]$claims$::JSONB,78),
    (rotation_definition,1,'accessibility','https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/','The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review','Journal of Athletic Training','peer_reviewed_research',$claims$["Task-focused visual and verbal feedback can alter jump-landing mechanics, while excessive or poorly targeted feedback can interfere with learning.","Use visible headings, larger targets, written or still-frame sequences, fewer attempts, longer rest, open-surface variants, or separate lower-angle definitions with full revalidation."]$claims$::JSONB,87),
    (rotation_definition,1,'alternates','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202026.pdf','Parkour Code of Points 2025–2028 — Table of Tricks 2026','World Gymnastics / Fédération Internationale de Gymnastique','governing_body',$claims$["360 Precision is distinct from basic Precision; turn amount, landing placement, entry, exit, and connected actions materially alter the scored element.","Open versus restricted target remains an exact support-interface variant within this full-turn definition; 90, 180, flip, rebound, one-foot, running, and connected forms remain distinct."]$claims$::JSONB,95),
    (rotation_definition,1,'media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',$claims$["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five 360 Precision candidates have current oEmbed metadata and embed-response health only; full playback, exact variant, captions, accessibility, cue quality, safety, reviewer identity, and approval remain human gates."]$claims$::JSONB,82)
  ) e(definition_id,card_version,section_key,source_url,source_title,
      source_publisher,source_kind,claims,quality)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_section_evidence_v1.reviewer_user_id IS NULL;

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,
    title,channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  VALUES
    (survivor_definition,base_variant,3,'https://www.youtube.com/watch?v=0M10agVeUzw','https://www.youtube-nocookie.com/embed/0M10agVeUzw','0M10agVeUzw','Broad Jump With A Stick','England Rugby Game Development',NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research','broad jump to stick',NULL,NULL,NULL,'YouTube oEmbed returned current title, channel, thumbnail, and iframe metadata on 2026-08-02. Full playback, exact open-surface variant, captions, accessibility, quality, safety, and approval remain unverified.'),
    (survivor_definition,base_variant,3,'https://www.youtube.com/watch?v=Fhz-s_Hqo8I','https://www.youtube-nocookie.com/embed/Fhz-s_Hqo8I','Fhz-s_Hqo8I','Broad Jump to Stick | Build Power & Landing Control for Gymnasts','uoasportsagility',NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research','broad jump to stick',NULL,NULL,NULL,'YouTube oEmbed returned current metadata on 2026-08-02; complete playback and human review remain pending.'),
    (survivor_definition,precision_variant,3,'https://www.youtube.com/watch?v=9sb4TYNHGio','https://www.youtube-nocookie.com/embed/9sb4TYNHGio','9sb4TYNHGio','How to PRECISION JUMP - Parkour Tutorial','Ronnie Street Stunts',NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research','parkour precision jump tutorial',NULL,NULL,NULL,'The title indicates parkour precision. oEmbed metadata is healthy; exact stationary low restricted-target variant, playback, captions, accessibility, cue quality, safety, and approval require full human review.'),
    (survivor_definition,precision_variant,3,'https://www.youtube.com/watch?v=FFgenf0h-3M','https://www.youtube-nocookie.com/embed/FFgenf0h-3M','FFgenf0h-3M','How to PRECISION JUMP | Tutorial & Exercises','SaturnoMovement',NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research','parkour precision jump tutorial',NULL,NULL,NULL,'The title indicates parkour precision. oEmbed metadata is healthy; exact variant and all human-only review fields remain unverified.'),
    (survivor_definition,precision_variant,3,'https://www.youtube.com/watch?v=opS9-hg9Rzc','https://www.youtube-nocookie.com/embed/opS9-hg9Rzc','opS9-hg9Rzc','5 Ways You FAIL to Stick (Parkour Precision Jump Mistakes)','Origins Parkour',NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research','parkour precision jump mistakes',NULL,NULL,NULL,'The title indicates parkour precision faults. oEmbed metadata is healthy; full playback, exact variant, accessibility, cue quality, safety, and approval remain unverified.'),
    (rotation_definition,rotation_precision_variant,1,'https://www.youtube.com/watch?v=C4402xYqsXM','https://www.youtube-nocookie.com/embed/C4402xYqsXM','C4402xYqsXM','360 Precision - Learn Parkour','Unparalleled Movement',NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research','parkour 360 precision jump tutorial',NULL,NULL,NULL,'The title indicates 360 Precision. oEmbed metadata is healthy; complete playback, exact start target direction contact stick captions accessibility quality safety and approval remain unverified.'),
    (rotation_definition,rotation_precision_variant,1,'https://www.youtube.com/watch?v=sB-XldxEVes','https://www.youtube-nocookie.com/embed/sB-XldxEVes','sB-XldxEVes','LEARN TO 360 PRECISION (tutorial)','PHAT',NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research','parkour 360 precision tutorial',NULL,NULL,NULL,'The title indicates 360 Precision. oEmbed metadata is healthy; all human-only review fields remain null.'),
    (rotation_definition,rotation_precision_variant,1,'https://www.youtube.com/watch?v=_ZXj9H_45po','https://www.youtube-nocookie.com/embed/_ZXj9H_45po','_ZXj9H_45po','HOW TO DO A 360 PRECISION (PARKOUR TUTORIAL)','Matthieu Parkour',NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research','parkour 360 precision tutorial',NULL,NULL,NULL,'The title indicates a parkour 360 Precision tutorial. Exact variant and complete playback review remain pending.'),
    (rotation_definition,rotation_precision_variant,1,'https://www.youtube.com/watch?v=jgkdLk_IuEQ','https://www.youtube-nocookie.com/embed/jgkdLk_IuEQ','jgkdLk_IuEQ','TUTORIAL - 360 Precision Jump','Move With Mendoza',NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research','parkour 360 precision jump tutorial',NULL,NULL,NULL,'The title indicates 360 Precision Jump. oEmbed health does not prove playback, exactness, captions, accessibility, safety, or approval.'),
    (rotation_definition,rotation_precision_variant,1,'https://www.youtube.com/watch?v=LSpKH0qsz6E','https://www.youtube-nocookie.com/embed/LSpKH0qsz6E','LSpKH0qsz6E','HOW TO DO A 360 PRECISION - Freerunning Tutorial (Jesse La Flair)','LaFlairParkour',NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research','freerunning 360 precision tutorial',NULL,NULL,NULL,'The title indicates a 360 Precision tutorial. Current oEmbed metadata is healthy; all qualified human review and approval gates remain open.')
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,embed_url=EXCLUDED.embed_url,
    video_id=EXCLUDED.video_id,title=EXCLUDED.title,
    channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=NULL,
    notes=EXCLUDED.notes,updated_at=now()
  WHERE coaching.exercise_media_candidate_v1.reviewer_user_id IS NULL;

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,
    rationale,distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT a.definition_id,a.card_version,a.name,a.classification,a.rationale,
    a.dimensions,a.proposed,'candidate',NULL,NULL
  FROM (VALUES
    (survivor_definition,3,'Standing Parkour Two-Foot Precision to Low Restricted Target','new_variant','Same no-turn stationary bilateral horizontal flight and terminal stick; restricted forefoot support materially changes target geometry, contact, consequence, logistics, and validation and is implemented as an exact variant.',$json${"implementedVariantId":"5cc18072-971f-4f98-bf71-1213341167e4","targetInterface":"restricted_low_horizontal","contact":"simultaneous_bilateral_forefoot"}$json$::JSONB,$json${"implementationState":"machine_authored_review_quarantine"}$json$::JSONB),
    (survivor_definition,3,'Ground-Line Precision Target','modifier_annotation','A visible line on the same open landing surface changes target feedback but not support contact; use the open-surface variant with an exact target annotation.',$json${"target":"line_or_zone","supportInterface":"open_surface"}$json$::JSONB,NULL),
    (survivor_definition,3,'Submaximal Target Distance','modifier_annotation','Distance and intent are delivery scalars inside an already reviewed geometry and do not change the no-turn bilateral jump-to-stick identity.',$json${"deliveryScalars":["distance","intent"]}$json$::JSONB,NULL),
    (survivor_definition,3,'Target Width Within Reviewed Restricted Range','modifier_annotation','Width can scale delivery only inside the exact restricted-target variant range; crossing to open full-foot support or a new consequence requires variant change and revalidation.',$json${"deliveryScalar":"target_width_inside_reviewed_variant_range"}$json$::JSONB,NULL),
    (survivor_definition,3,'Elevated Restricted-Target Precision','new_variant','Target height and miss consequence materially change trajectory, landing, supervision, matting, and bailout while preserving one stationary no-turn bilateral precision flight.',$json${"targetHeight":"elevated","requiresExactGeometryAndBailout":true}$json$::JSONB,$json${"status":"not_authored_due_to_universal_height_and_bailout_uncertainty"}$json$::JSONB),
    (survivor_definition,3,'Lower-Than-Takeoff Restricted-Target Precision','new_variant','A lower target changes flight and landing energy, foot presentation, consequence, and bailout while preserving the same one-flight action.',$json${"targetHeightRelation":"lower"}$json$::JSONB,$json${"status":"requires_exact_geometry_human_review"}$json$::JSONB),
    (survivor_definition,3,'Consequential-Gap Precision','new_variant','A gap whose miss creates a fall materially changes environment, fear, supervision, bailout, and failure consequence and cannot be inferred from the low-target variant.',$json${"gapConsequence":"fall_exposure","requiresExactGapAndRescuePlan":true}$json$::JSONB,$json${"status":"quarantined_until_facility_specific_risk_review"}$json$::JSONB),
    (survivor_definition,3,'Running Precision Jump','new_definition','A run-up changes entry, approach steps, takeoff strategy, lane length, speed, dose, and repetition boundary.',$json${"entry":"run_up","missingFacts":["approach_length","last_steps","takeoff_foot_sequence","speed","bailout"]}$json$::JSONB,$json${"status":"identity_known_but_exact_working_specification_not_authored"}$json$::JSONB),
    (survivor_definition,3,'One-Foot Precision','new_definition','One-foot takeoff changes laterality, impulse, flight preparation, load distribution, and repetition validity even if both feet land together.',$json${"takeoffLaterality":"unilateral","landingLaterality":"bilateral"}$json$::JSONB,NULL),
    (survivor_definition,3,'Bilateral 360-Degree Jump to Stick','new_definition','A full whole-body turn changes the scored action and is implemented as a separate definition with open and restricted-target variants.',$json${"implementedDefinitionId":"1101413d-55c7-4585-abc2-6e63484ec434","rotationDegrees":360}$json$::JSONB,$json${"implementationState":"machine_authored_review_quarantine"}$json$::JSONB),
    (survivor_definition,3,'180 Precision Jump','new_definition','A half turn changes rotation amount, spotting, landing heading, direction accounting, and repetition validity.',$json${"rotationDegrees":180,"target":"restricted"}$json$::JSONB,NULL),
    (survivor_definition,3,'90-Degree Rotational Broad Jump to Stick','new_definition','A quarter turn changes the scored action and already has a separate canonical definition.',$json${"existingDefinitionId":"866cff83-dc6c-4131-b6d8-e471ef92d859","rotationDegrees":90}$json$::JSONB,NULL),
    (survivor_definition,3,'Plyo or Rebound Precision','new_definition','Immediate re-projection removes the terminal stick and changes contact time, elastic intent, fatigue, impact, and endpoint.',$json${"terminalAction":"immediate_reprojection","existingNeighborId":"abafa520-df54-4378-8bc8-cea2860a4c3a"}$json$::JSONB,NULL),
    (survivor_definition,3,'Stride to Precision','new_definition','A stride entry adds unilateral contacts and a connected approach before the target jump.',$json${"entry":"connected_stride","contactSequence":"unilateral_to_precision"}$json$::JSONB,NULL),
    (survivor_definition,3,'Drop to Precision Landing','new_definition','A drop begins from elevated support without a horizontal takeoff and changes loading, contact, fall height, and repetition boundary.',$json${"entry":"step_or_drop","takeoff":"absent_or_passive"}$json$::JSONB,NULL),
    (survivor_definition,3,'Lache Precision to Two-Foot Stick','new_definition','Bar support, swing, hand release, flight source, grip fatigue, and bailout differ from a foot-supported precision jump.',$json${"existingDefinitionId":"656028eb-c7d1-4a2f-a216-45763b201796","startSupport":"bar"}$json$::JSONB,NULL),
    (survivor_definition,3,'Cat Leap or Arm Jump','new_definition','Feet-to-wall plus hand contact and a retained vertical support change target interface, contact order, terminal support, and bailout.',$json${"target":"vertical_wall","contacts":["feet","hands"]}$json$::JSONB,NULL),
    (survivor_definition,3,'Splat','new_definition','Feet-first vertical wall contact followed by slide or drop is not a horizontal target stick.',$json${"target":"vertical_wall","terminalAction":"slide_or_drop"}$json$::JSONB,NULL),
    (survivor_definition,3,'Standing Broad Jump Test','new_definition','Maximal measured distance with nearest-mark validity differs from a quality-first target and held landing and already has a separate card.',$json${"existingDefinitionId":"626ba7ed-840e-4275-9001-bab668e37503","purpose":"maximal_measured_test"}$json$::JSONB,NULL),
    (survivor_definition,3,'Repeated Broad Jumps','new_definition','Linked bilateral contacts replace the deliberate intermediate stick and already have a separate definition.',$json${"existingDefinitionId":"a3768015-f081-44ff-81a0-2d15a5acb94f","contacts":"linked_multiple"}$json$::JSONB,NULL),
    (survivor_definition,3,'Loaded Broad Jump to Stick','new_variant','External load changes arm policy, momentum, implement control, landing, failure response, and equipment while preserving one no-turn flight.',$json${"externalLoad":"declared_implement_and_mass"}$json$::JSONB,NULL),
    (survivor_definition,3,'Coach-Assisted Precision','new_variant','Physical assistance changes effective load, station, coach contact, validity, persistence, and bailout and must be exact.',$json${"assistance":"declared_qualified_coach_contact"}$json$::JSONB,NULL),
    (survivor_definition,3,'Single-Leg Hop to Stick','new_definition','Unilateral takeoff or landing changes laterality, balance, load distribution, and contact accounting.',$json${"laterality":"unilateral"}$json$::JSONB,NULL),
    (survivor_definition,3,'Precision into Immediate Sprint or Vault','new_definition','A connected exit removes the terminal reset and adds locomotion or hand-supported action, space, fatigue, and a new repetition endpoint.',$json${"exit":"connected_action","terminalStick":"absent_or_transitional"}$json$::JSONB,NULL),
    (rotation_definition,1,'Open-Surface Bilateral Forward 360 Jump to Stick','new_variant','Same stationary forward full-turn action with an open full-foot landing surface; implemented as an exact support-interface variant.',$json${"implementedVariantId":"b365da0f-2779-4883-8152-a5b3c09bee9f","targetInterface":"open_surface"}$json$::JSONB,$json${"implementationState":"machine_authored_review_quarantine"}$json$::JSONB),
    (rotation_definition,1,'Standing Parkour 360 Precision to Low Restricted Target','new_variant','Same full-turn action with restricted bilateral forefoot support; implemented as an exact support-interface variant.',$json${"implementedVariantId":"1101413d-55c7-4585-abc2-6e63484ec435","targetInterface":"restricted_low_horizontal"}$json$::JSONB,$json${"implementationState":"machine_authored_review_quarantine"}$json$::JSONB),
    (rotation_definition,1,'Clockwise or Counterclockwise Direction','modifier_annotation','Direction is declared and persisted per attempt; it does not create a new definition when all other action and target constraints remain exact.',$json${"deliveryDimension":"turn_direction","values":["clockwise","counterclockwise"]}$json$::JSONB,NULL),
    (rotation_definition,1,'Bilateral 90-Degree Rotational Broad Jump to Stick','new_definition','A quarter turn has a different rotation amount, spotting window, heading, and completion rule and already has a separate card.',$json${"existingDefinitionId":"866cff83-dc6c-4131-b6d8-e471ef92d859","rotationDegrees":90}$json$::JSONB,NULL),
    (rotation_definition,1,'180 Jump to Stick','new_definition','A half turn changes rotation amount and final heading and already has a separate but incomplete neighboring definition.',$json${"existingDefinitionId":"cdafa4d9-31f5-4cab-b9b4-c0b2385d8e0e","rotationDegrees":180}$json$::JSONB,NULL),
    (rotation_definition,1,'Basic No-Turn Precision Jump','new_definition','Removing the full turn returns to the separately defined Broad Jump to Stick family and its exact precision variant.',$json${"existingDefinitionId":"1260d75e-6807-4c91-859d-7d561a9160a3","rotationDegrees":0}$json$::JSONB,NULL),
    (rotation_definition,1,'Running 360 Precision','new_definition','A run-up changes entry speed, step sequence, takeoff strategy, lane, dose, and repetition boundary.',$json${"entry":"run_up","rotationDegrees":360}$json$::JSONB,NULL),
    (rotation_definition,1,'One-Foot 360 Precision','new_definition','One-foot takeoff changes laterality, impulse, rotation initiation, load, and landing preparation.',$json${"takeoffLaterality":"unilateral","rotationDegrees":360}$json$::JSONB,NULL),
    (rotation_definition,1,'180 Precision Return','new_definition','A 180 landing followed by an immediate return adds a second flight and contact sequence rather than one full-turn flight.',$json${"flightCount":2,"sequence":[180,180]}$json$::JSONB,NULL),
    (rotation_definition,1,'360 Precision to Rebound','new_definition','Immediate re-projection removes the terminal stick and changes elastic contact, endpoint, impact, and dose.',$json${"terminalAction":"rebound","rotationDegrees":360}$json$::JSONB,NULL),
    (rotation_definition,1,'360 Precision into Vault or Sprint','new_definition','A connected exit adds locomotion or hand support and replaces the full reset with a new compound sequence.',$json${"exit":"connected_action"}$json$::JSONB,NULL),
    (rotation_definition,1,'360 Awareness Catch with Safe Twist','new_definition','A ball or object-awareness catch task changes implement interaction, hand action, purpose, and terminal contact despite sharing 360 language.',$json${"existingDefinitionId":"fd2db4bf-6a62-4bae-ab7c-a7eaa4ce587c","action":"object_catch"}$json$::JSONB,NULL),
    (rotation_definition,1,'360 Flip to Precision','new_definition','Adding inversion or a somersault changes rotation axes, flight action, consequence, and repetition validity.',$json${"inversion":true,"rotationAxes":["transverse_or_sagittal","longitudinal"]}$json$::JSONB,NULL),
    (rotation_definition,1,'Elevated or Consequential-Gap 360 Precision','new_variant','Height, target width, gap consequence, matting, supervision, and bailout materially change the exact full-turn task.',$json${"targetConsequence":"elevated_or_gap","requiresFacilitySpecificRiskReview":true}$json$::JSONB,$json${"status":"quarantined_until_exact_geometry_and_risk_review"}$json$::JSONB),
    (rotation_definition,1,'Loaded 360 Jump to Stick','new_variant','External load changes angular momentum, arm policy, implement control, landing, failure response, and equipment.',$json${"externalLoad":"declared_implement_and_mass"}$json$::JSONB,NULL),
    (rotation_definition,1,'Assisted 360 Precision','new_variant','Coach contact changes rotation, effective load, validity, station, persistence, and bailout and must be separately exact.',$json${"assistance":"declared_qualified_coach_contact"}$json$::JSONB,NULL),
    (rotation_definition,1,'360 Jump in Place to Same Footprint','new_definition','Removing forward travel and using the same footprint changes projection, target, visual strategy, and repetition purpose.',$json${"projection":"vertical_or_in_place","target":"same_footprint"}$json$::JSONB,NULL)
  ) a(definition_id,card_version,name,classification,rationale,dimensions,proposed)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_alternate_assessment_v1.reviewer_user_id IS NULL;

  UPDATE coaching.exercise_relationship_v1 SET
    from_variant_id=precision_variant,
    reason='Bar support, swing, release, and suspended-source fatigue are added to a foot-supported stationary restricted-target precision; the standing variant does not authorize Lache transfer.',
    conditions_json=jsonb_build_object(
      'migration',migration_key,'reviewOnly',TRUE,'approvalsCreated',FALSE,
      'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity','entry support','grip','source and target','geometry','assistance','release','landing','terminal checkpoint','environment','symptoms','dose','contact and fatigue budgets','duration','logistics','persistence','coach rendering','athlete rendering')),
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE id='d533216f-abd9-493b-a577-92713cff0409'::UUID
    AND reviewed_by IS NULL AND review_status<>'approved';

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (base_variant,precision_variant,'progression',84,ARRAY['complexity','stability','impact','decision_demand'],'Changes from an open full-foot landing surface to a low restricted bilateral forefoot target while preserving one stationary no-turn flight and terminal stick.',jsonb_build_object('migration',migration_key,'onlyWhen',jsonb_build_array('restricted target precision matches objective','exact geometry and bailout pass review'),'revalidate',jsonb_build_array('target interface','geometry','contact','impact','supervision','dose','duration','logistics','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL),
    (precision_variant,base_variant,'regression',88,ARRAY['complexity','stability','impact','decision_demand'],'Restores an open stable landing surface and full-foot support while retaining the same stationary bilateral no-turn jump-to-stick action.',jsonb_build_object('migration',migration_key,'onlyWhen',jsonb_build_array('open surface still matches objective'),'notEquivalentForRestrictedTargetPrecision',TRUE,'revalidate',jsonb_build_array('target','contact','dose','duration','logistics','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL),
    (precision_variant,rotation_open_variant,'progression',66,ARRAY['complexity','stability','impact','decision_demand'],'Adds a declared full whole-body turn and target reacquisition while changing to an open landing surface.',jsonb_build_object('migration',migration_key,'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('rotation','direction','headings','target','spotting','contact','dose','impact','duration','logistics','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL),
    (rotation_open_variant,precision_variant,'regression',72,ARRAY['complexity','stability','impact','decision_demand'],'Removes the full turn and restores the exact stationary restricted-target no-turn precision action; target interface also changes and must be revalidated.',jsonb_build_object('migration',migration_key,'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('rotation','target interface','contact','dose','impact','duration','logistics','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL),
    (precision_variant,rotation_precision_variant,'progression',72,ARRAY['complexity','stability','impact','decision_demand'],'Adds a declared full turn, target reacquisition, final heading, and rotational braking while retaining a low restricted bilateral forefoot target.',jsonb_build_object('migration',migration_key,'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('rotation','direction','headings','spotting','target','contact','dose','impact','duration','logistics','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL),
    (rotation_precision_variant,precision_variant,'regression',82,ARRAY['complexity','stability','impact','decision_demand'],'Removes the full turn while retaining the exact low restricted target and bilateral forefoot stick.',jsonb_build_object('migration',migration_key,'onlyWhen',jsonb_build_array('no-turn precision matches objective'),'revalidate',jsonb_build_array('rotation','direction','dose','impact','duration','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL),
    (rotation_open_variant,rotation_precision_variant,'progression',82,ARRAY['complexity','stability','impact','decision_demand'],'Changes the full-turn landing from open full-foot support to a low restricted bilateral forefoot target.',jsonb_build_object('migration',migration_key,'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('target interface','geometry','contact','supervision','impact','dose','duration','logistics','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL),
    (rotation_precision_variant,rotation_open_variant,'regression',88,ARRAY['complexity','stability','impact','decision_demand'],'Restores an open stable landing surface while retaining the declared full turn, target spotting, final heading, and stick.',jsonb_build_object('migration',migration_key,'notEquivalentForRestrictedTargetPrecision',TRUE,'revalidate',jsonb_build_array('target interface','contact','dose','impact','duration','logistics','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL),
    (lache_precision_variant,precision_variant,'regression',58,ARRAY['complexity','load','impact','decision_demand'],'Removes bar support, swing, grip load, and hand release and returns to a stationary foot-supported restricted-target precision jump.',jsonb_build_object('migration',migration_key,'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('identity','entry support','grip','source target','release','landing','dose','fatigue','duration','logistics','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL),
    (ninety_variant,rotation_open_variant,'progression',64,ARRAY['complexity','stability','impact','decision_demand'],'Increases the whole-body turn from 90 to 360 degrees and adds a later target-reacquisition and rotational-braking demand.',jsonb_build_object('migration',migration_key,'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('rotation amount','direction','headings','spotting','target','contact','dose','duration','logistics','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL),
    (rotation_open_variant,ninety_variant,'regression',72,ARRAY['complexity','stability','impact','decision_demand'],'Reduces the full turn to a separately defined 90-degree rotational broad jump and changes final-heading timing.',jsonb_build_object('migration',migration_key,'onlyWhen',jsonb_build_array('quarter-turn action matches objective'),'revalidate',jsonb_build_array('identity','rotation amount','direction','headings','target','dose','duration','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  VALUES
    (1,precision_variant,'technicalComplexity',62,60,'Restricted bilateral forefoot target placement, exact trajectory, simultaneous contact, target ownership, and bailout awareness materially increase exercise complexity above an open-surface stick.','review',1,NULL,NULL,'Independent calibration required; no athlete classification.',NULL),
    (1,precision_variant,'absoluteLoadDemand',54,60,'Body-mass horizontal propulsion and restricted forefoot braking create moderate physical difficulty; distance, height, consequence, and repeated contacts remain separately declared.','review',1,NULL,NULL,'Independent calibration required.',NULL),
    (1,rotation_open_variant,'technicalComplexity',78,80,'A stationary forward full turn adds direction, whole-body rotation timing, target reacquisition, final heading, rotational braking, and error detection before a bilateral stick.','review',1,NULL,NULL,'Independent calibration required.',NULL),
    (1,rotation_open_variant,'absoluteLoadDemand',64,60,'Forward body-mass propulsion, a full-turn flight, and combined linear and rotational landing absorption create substantial physical difficulty on an open surface.','review',1,NULL,NULL,'Independent calibration required.',NULL),
    (1,rotation_precision_variant,'technicalComplexity',86,80,'Full-turn timing and spotting combined with restricted bilateral forefoot placement, final heading, two-second stick, and consequential miss management create very high exercise complexity.','review',1,NULL,NULL,'Independent calibration required.',NULL),
    (1,rotation_precision_variant,'absoluteLoadDemand',68,60,'Forward propulsion, full-turn segment control, restricted forefoot support, and combined linear and rotational braking create high physical difficulty even on a low target.','review',1,NULL,NULL,'Independent calibration required.',NULL)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,survivor_definition,source_definition,'duplicate_consolidated','The legacy Precision Jump row and Broad Jump to Stick share one stationary bilateral forward flight and a controlled terminal foot landing. Parkour-specific restricted target support is an exact variant; the under-specified source baseline remains archived.',$json${"migration":"487_coaching_precision_jump_identity_and_360_family_audit_hardening","identityBoundary":"same_stationary_bilateral_horizontal_jump_and_terminal_stick_family","sourceVariantSelectable":false,"exactVariantId":"5cc18072-971f-4f98-bf71-1213341167e4","researchSources":["https://pmc.ncbi.nlm.nih.gov/articles/PMC6093881/","https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf"],"humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,'deterministic_identity_equivalence',NULL,now()),
    (1,survivor_definition,rotation_definition,'distinct_exercises','Basic no-turn jump-to-stick and a forward full-turn jump have different scored actions, target-reacquisition demands, headings, validity, and repetition boundaries.',$json${"migration":"487_coaching_precision_jump_identity_and_360_family_audit_hardening","identityBoundary":"zero_rotation_vs_full_360_rotation","researchSources":["https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202026.pdf"],"humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,'deterministic_identity_equivalence',NULL,now()),
    (1,survivor_definition,lache_precision_definition,'distinct_exercises','Standing precision begins from bilateral foot support; Lache Precision begins suspended from a bar and adds swing, grip, release, and a different failure and fatigue contract.',$json${"migration":"487_coaching_precision_jump_identity_and_360_family_audit_hardening","identityBoundary":"foot_supported_takeoff_vs_bar_swing_release","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,'deterministic_identity_equivalence',NULL,now()),
    (1,rotation_definition,ninety_definition,'distinct_exercises','A full 360-degree turn differs from a 90-degree rotational broad jump in rotation amount, spotting window, final heading, timing, and invalidation.',$json${"migration":"487_coaching_precision_jump_identity_and_360_family_audit_hardening","identityBoundary":"360_vs_90_degree_whole_body_turn","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,'deterministic_identity_equivalence',NULL,now()),
    (1,rotation_definition,one_eighty_definition,'distinct_exercises','A full 360-degree turn differs from a 180-degree jump in rotation amount, target reacquisition, final heading, and completion.',$json${"migration":"487_coaching_precision_jump_identity_and_360_family_audit_hardening","identityBoundary":"360_vs_180_degree_whole_body_turn","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,'deterministic_identity_equivalence',NULL,now()),
    (1,rotation_definition,awareness_definition,'distinct_exercises','The awareness-catch task includes an external object and hand catch; a 360 jump-to-stick scores body rotation, target landing, and terminal foot support.',$json${"migration":"487_coaching_precision_jump_identity_and_360_family_audit_hardening","identityBoundary":"rotational_foot_landing_vs_object_awareness_catch","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,'deterministic_identity_equivalence',NULL,now()),
    (1,rotation_definition,standing_broad_definition,'distinct_exercises','Standing Broad Jump is a maximal measured no-turn distance test; the 360 card scores a full turn, target reacquisition, final heading, and stick rather than maximum standardized distance.',$json${"migration":"487_coaching_precision_jump_identity_and_360_family_audit_hardening","identityBoundary":"full_turn_target_stick_vs_maximal_no_turn_distance_test","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  UPDATE coaching.exercise SET
    name='Precision Jump',slug='precision-jump',
    description='Archived source lineage consolidated into Broad Jump to Stick. Select the exact open-surface or stationary parkour restricted-target variant; running, one-foot, turning, drop, rebound, wall-contact, and connected forms are distinct exercises.',
    instructions='This legacy source is not selectable. Choose an exact canonical definition and variant with declared entry, takeoff, target interface, geometry, contact, hold, bailout, dose, rest, impact budget, logistics, persistence, and coach and athlete rendering.',
    skill_level=NULL,age_min=NULL,age_max=NULL,default_sets=NULL,
    default_reps=NULL,default_work_seconds=NULL,default_rest_seconds=NULL,
    tempo=NULL,load_note=NULL,est_seconds_per_set=45,is_published=FALSE,
    archived=TRUE,card_summary='Archived ambiguous Precision Jump source; route to an exact Broad Jump to Stick or distinct alternate identity.',
    coach_language='Do not prescribe source 20. Select the exact canonical definition and variant, then validate target geometry, contacts, cumulative impact and fatigue, duration, logistics, substitutions, persistence, and both renderings.',
    athlete_language='This old card is unavailable because the exact jump and target were not specified. Ask for the exact open-surface, parkour precision, turning, running, or other reviewed version.',
    programming_logic=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'canonicalSurvivorDefinitionId',survivor_definition,
      'exactRestrictedTargetVariantId',precision_variant,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDoesNotClassifyAthletes',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables='{}'::TEXT[],movement_family='Broad Jump to Stick',
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',FALSE,'sourceIdentityQuarantine',TRUE,
      'missingIdentityFacts',jsonb_build_array('standing or running entry','takeoff foot sequence','target interface width height distance and gap','forefoot or full-foot contact','hold','rebound or connection','miss and bailout'),
      'requiredCanonicalVariant',precision_variant),
    coaching_execution=jsonb_build_object(
      'doNotRenderExecutionFromLegacySource',TRUE,
      'routeToCanonicalDefinition',survivor_definition),
    pairing_logic=jsonb_build_object('doNotPairUnresolvedSource',TRUE),
    media_library=jsonb_build_object(
      'historical_candidate_video_urls',jsonb_build_array(
        'https://www.youtube.com/watch?v=9sb4TYNHGio',
        'https://www.youtube.com/watch?v=FFgenf0h-3M',
        'https://www.youtube.com/watch?v=_b0HCpsuP6c',
        'https://www.youtube.com/watch?v=opS9-hg9Rzc'),
      'reviewState','historical_candidate_metadata_only',
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,
    updated_at=now()
  WHERE id=20;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=3,impact_level=3,requires_spotting=FALSE,
    requires_coach_supervision='required',minimum_age_recommended=NULL,
    minimum_skill_level=NULL,
    minimum_prerequisite_notes='Source 20 is nonselectable. Readiness belongs to the selected exact canonical variant and current workout inputs, never to an exercise level or age cutoff.',
    readiness_checks=ARRAY['Select an exact canonical definition and variant before exposure.','Declare target interface geometry contact hold miss bailout and stop signal.','Check current symptoms fear and same-session sprint jump parkour and landing exposure.']::TEXT[],
    stop_signs=ARRAY['Do not start from this archived source card.','Stop for pain guarding numbness weakness dizziness giving way fear miss collision fall or loss of control.','Stop when target surface lane mat supervision or exact variant becomes unavailable.']::TEXT[],
    contraindications=ARRAY['Undefined entry target contact or terminal action.','Unsafe target lane surface clearance supervision or bailout.']::TEXT[],
    common_substitutions=ARRAY['Select Broad Jump to Stick open-surface variant.','Select Standing Parkour Two-Foot Precision low restricted-target variant.','Select a separately defined running turning drop rebound wall-contact or connected identity after full validation.']::TEXT[]
  WHERE exercise_id=20;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=62,absolute_load_demand=54,
    coordination_demand=68,impact=60,supervision_demand=70,
    base_overall_difficulty=greatest(62,54),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','exact stationary parkour restricted-target variant; legacy source remains nonselectable',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseScoresDescribeTaskOnly',TRUE,
      'humanReviewRequired',TRUE),
    migration_confidence=68,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,review_notes=NULL,updated_at=now()
  WHERE exercise_id=20;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT p.definition_id,1,p.card_version,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey',p.identity_key,
        'source20Consolidated',p.definition_id=survivor_definition,
        'activeWorkingSpecifications',p.variant_count,
        'exerciseSkillClassificationAbsent',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityAndContacts',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','overallDerived',TRUE,'scoreScope','exercise_task_only','independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'landingEventsPerRep',1,'plannedFootContactsPerRep',2,'validInvalidPartialAssistedIncidentAndUnplannedContactsCounted',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'entryTargetGeometryContactSurfaceLaneBailoutAndSupervision',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',p.profile_count,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAndSupportOperations',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'sourceScopeAndLimitationsExplicit',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnlyOutgoing',p.outgoing_graph,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',p.calibration_count,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',p.alternate_count,'identityBoundariesExplicit',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'coachAndAthleteRenderingRequired',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five current candidates in full and verify exact definition and variant, entry, takeoff, direction, target interface and geometry, contact, endpoint, captions, accessibility, cue quality, safety, conflicts, current playback, reviewer identity, timestamp, and card version.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every progression regression and substitution proposal; no automatic transfer among open restricted rotational running rebound drop Lache or connected identities is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These scores do not classify an athlete and do not alter skill-library levels.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Every working target contact rotation dose and support rule remains quarantined.')),
    TRUE,now()
  FROM (VALUES
    (survivor_definition,3,'bilateral_horizontal_jump_terminal_stick',2,5,24,5,4),
    (rotation_definition,1,'bilateral_360_horizontal_jump_terminal_stick',2,6,17,4,4)
  ) p(definition_id,card_version,identity_key,variant_count,profile_count,
      alternate_count,outgoing_graph,calibration_count)
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=20 AND definition_id=survivor_definition
        AND source_kind='duplicate_consolidation'
        AND provenance_json->>'representedByExactVariantId'=precision_variant::TEXT)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=source_definition AND legacy_exercise_id IS NULL
        AND status='archived'
        AND provenance_json->>'survivorDefinitionId'=survivor_definition::TEXT)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine') THEN
    RAISE EXCEPTION '% found invalid source consolidation or quarantine',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(active_definition_ids) AND status='review'
        AND schema_version='2.0.0' AND approved_video_url IS NULL
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL
        AND movement_patterns<>'{}'::TEXT[] AND body_regions<>'{}'::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB
        AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB
        AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'precisionJumpAuditMigration'=migration_key
        AND provenance_json->>'canonicalAuthoredFromResearch'='true'
        AND provenance_json->>'approvalsCreated'='false')<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=survivor_definition AND legacy_exercise_id=146
        AND card_version=3 AND slug='broad-jump-to-stick')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=rotation_definition AND legacy_exercise_id IS NULL
        AND card_version=1 AND slug='bilateral-360-degree-jump-to-stick') THEN
    RAISE EXCEPTION '% found incomplete active canonical definitions',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND status='review'
        AND (difficulty_json->>'technicalComplexity')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'absoluteLoadDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=
          (difficulty_json->>'absoluteLoadDemand')::INTEGER
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (load_profile_json->>'landingEventsPerRep')::INTEGER=1
        AND (load_profile_json->>'landingFootContactsPerRep')::INTEGER=2
        AND (fatigue_profile_json->>'recoveryHours')::INTEGER>0
        AND programming_profile_json<>'{}'::JSONB)<>4
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=survivor_definition AND status='review')<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=rotation_definition AND status='review')<>2 THEN
    RAISE EXCEPTION '% found invalid active variants or difficulty model',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB
        AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 20 AND 300
        AND cardinality(stop_rules)>=8)<>11
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=base_variant AND status='review')<>2
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=precision_variant AND status='review')<>3
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=rotation_open_variant AND status='review')<>3
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=rotation_precision_variant AND status='review')<>3 THEN
    RAISE EXCEPTION '% found incomplete delivery profiles',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE (definition_id=survivor_definition AND reviewed_card_version=3
          OR definition_id=rotation_definition AND reviewed_card_version=1)
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>32
    OR EXISTS(SELECT 1 FROM unnest(active_definition_ids) listed(definition_id)
      WHERE (SELECT count(DISTINCT section_key)
        FROM coaching.exercise_section_evidence_v1 evidence
        WHERE evidence.definition_id=listed.definition_id
          AND evidence.reviewed_card_version=CASE
            WHEN listed.definition_id=survivor_definition THEN 3 ELSE 1 END
          AND evidence.review_status='candidate'
          AND evidence.reviewer_user_id IS NULL)<>16)
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE (definition_id=survivor_definition AND reviewed_card_version=3
          OR definition_id=rotation_definition AND reviewed_card_version=1)
        AND link_status='healthy' AND review_status='candidate'
        AND embedding_allowed AND captions_available IS NULL
        AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>10
    OR EXISTS(SELECT 1 FROM unnest(active_definition_ids) listed(definition_id)
      WHERE (SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id=listed.definition_id
          AND media.reviewed_card_version=CASE
            WHEN listed.definition_id=survivor_definition THEN 3 ELSE 1 END
          AND media.link_status='healthy' AND media.review_status='candidate')<>5)
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=survivor_definition AND reviewed_card_version=3
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>24
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=rotation_definition AND reviewed_card_version=1
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>17 THEN
    RAISE EXCEPTION '% found incomplete evidence media or alternate packets',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND review_status='review' AND reviewed_by IS NULL)<>12
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id IN(precision_variant,rotation_open_variant,
        rotation_precision_variant) AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE evidence_json->>'migration'=migration_key
        AND decision='duplicate_consolidated' AND reviewed_by IS NULL)<>1
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE evidence_json->>'migration'=migration_key
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=ANY(active_definition_ids) AND status='quarantined'
        AND human_review_required
        AND jsonb_array_length(blocking_issues_json)=4)<>2 THEN
    RAISE EXCEPTION '% found incomplete graph calibration identity or packets',
      migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=ANY(active_definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=ANY(active_definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(
        definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=ANY(active_definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1 profile
      CROSS JOIN LATERAL unnest(profile.equipment_required) key
      WHERE profile.variant_id=ANY(active_variant_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE conditions_json->>'migration'=migration_key
        AND relationship.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed',
            'stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=20 AND (skill_level IS NOT NULL OR age_min IS NOT NULL
        OR age_max IS NOT NULL OR linked_skill_id IS NOT NULL
        OR is_published OR why_publish_ready OR NOT archived))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=20
        AND (minimum_skill_level IS NOT NULL
          OR minimum_age_recommended IS NOT NULL
          OR requires_coach_supervision<>'required'))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=20 AND technical_complexity=62
        AND absolute_load_demand=54 AND base_overall_difficulty=62
        AND impact=60 AND supervision_demand=70
        AND human_review_status='queued'
        AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(active_definition_ids)
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          definition.provenance_json,definition.environment_json,
          definition.population_json,definition.anatomy_json,
          definition.athlete_support_json,definition.coach_support_json,
          definition.support_operations_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
      WHERE variant.id=ANY(active_variant_ids)
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          variant.difficulty_json,variant.requirements_json,
          variant.load_profile_json,variant.fatigue_profile_json,
          variant.programming_profile_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE (definition_id=survivor_definition AND reviewed_card_version=3
          OR definition_id=rotation_definition AND reviewed_card_version=1)
        AND (review_status<>'candidate' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR captions_available IS NOT NULL
          OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND (review_status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id IN(precision_variant,rotation_open_variant,
        rotation_precision_variant)
        AND (status='approved' OR reviewed_by IS NOT NULL)) THEN
    RAISE EXCEPTION '% retained or fabricated proficiency approval media or publication state',
      migration_key;
  END IF;
END;
$$;
