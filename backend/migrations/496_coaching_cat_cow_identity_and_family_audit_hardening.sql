-- Source 25: consolidate the duplicate Source-889 definition while preserving
-- its segmental sequencing as an exact Cat-Cow variant. Evidence, media,
-- identity, graph, calibration, and publication remain candidate/review-only.
-- This migration creates no human approval and no exercise-card athlete level.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '496_coaching_cat_cow_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.93';
  canonical_definition CONSTANT UUID := '29f1f054-8700-4233-9866-63810e69242e';
  duplicate_definition CONSTANT UUID := '366ca335-c637-4f44-b0f3-616e8db8ee76';
  spinal_circle_definition CONSTANT UUID := 'c8a4e447-0b65-4c0b-985b-7f5466fc07ec';
  thread_definition CONSTANT UUID := '1032ba98-fa48-4960-a039-2d11b2a492cc';
  full_body_definition CONSTANT UUID := 'c6e2b1c7-e42f-47b6-ac34-2549b32f8dd3';
  source_variant CONSTANT UUID := 'dd378c3e-51cd-44d5-bc26-34e562543f85';
  duplicate_variant CONSTANT UUID := '77182da9-ca9b-4bbf-ba9f-8d234c19bead';
  spinal_circle_variant CONSTANT UUID := 'b274f28a-6d80-4ecf-bbff-4fa426f789b4';
  thread_variant CONSTANT UUID := '5f9f99ba-46f6-4a92-84d4-4080f93463ef';
  standard_variant CONSTANT UUID := '3d36d51f-99e0-43db-91a4-da04a49647d5';
  segmental_variant CONSTANT UUID := '8fb77631-0365-471f-a1ce-eb17320b6b99';
  active_variant_ids CONSTANT UUID[] := ARRAY[standard_variant,segmental_variant];
  all_owned_variant_ids CONSTANT UUID[] := ARRAY[
    source_variant,duplicate_variant,standard_variant,segmental_variant];
  protected_count INTEGER;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=25 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=889 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=26 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=25)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=duplicate_definition AND facility_id=1 AND legacy_exercise_id=889)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=spinal_circle_definition AND facility_id=1 AND legacy_exercise_id=26)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=thread_definition AND facility_id=1 AND card_version=2)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=full_body_definition AND facility_id=1 AND card_version=2)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=25 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=889
        AND definition_id IN(canonical_definition,duplicate_definition))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=duplicate_variant AND definition_id=duplicate_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=spinal_circle_variant AND definition_id=spinal_circle_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=thread_variant AND definition_id=thread_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=25)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=889)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=25)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=889)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=25)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=889) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='cat-cow' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id IN(canonical_definition,duplicate_definition)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids)
          OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id IN(canonical_definition,duplicate_definition)
          OR resolved_definition_id IN(canonical_definition,duplicate_definition))
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id IN(25,889)
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(all_owned_variant_ids)
      OR to_variant_id=ANY(all_owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_owned_variant_ids)
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 SET
    source_kind='legacy_migration',
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','canonical_survivor_reauthored',
        'sourceInterpretation','source 25 supplies the quadruped flexion-extension identity but omits exact cycle counting support constraints anatomy cumulative budgets persistence and human review contracts',
        'exactWorkingSpecifications',jsonb_build_array(
          'standard_coordinated_quadruped_cat_cow',
          'ordered_segmental_wave_quadruped_cat_cow'),
        'researchSources',jsonb_build_array(
          'https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/',
          'https://doi.org/10.1186/s12984-024-01366-1',
          'https://blog.nasm.org/workout-plan-for-beginners',
          'https://resources.specialolympics.org/sports-essentials/sports-and-coaching/warm-up-and-cool-down-videos/cool-down-cat-cow-stretch'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=25 AND definition_id=canonical_definition;

  DELETE FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=889 AND definition_id=duplicate_definition;
  INSERT INTO coaching.exercise_definition_source_v1(
    definition_id,legacy_exercise_id,source_kind,provenance_json)
  VALUES(canonical_definition,889,'duplicate_consolidation',
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','duplicate_definition_consolidated_variant_preserved',
      'retiredDefinitionId',duplicate_definition,
      'retiredVariantId',duplicate_variant,
      'preservedVariantId',segmental_variant,
      'identityReason','the source has the same quadruped contacts flexion extension endpoints and full-cycle boundary while mandatory ordered segmental sequencing is preserved as an exact variant',
      'legacyClassificationAndPublicationClaimsUnsupported',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE))
  ON CONFLICT(legacy_exercise_id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,source_kind='duplicate_consolidation',
    provenance_json=EXCLUDED.provenance_json;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id IN(source_variant,duplicate_variant);

  UPDATE coaching.exercise_variant_v1 SET
    variant_key=CASE id WHEN source_variant THEN 'identity-quarantine-source-25'
      ELSE 'identity-quarantine-source-889' END,
    display_name=CASE id WHEN source_variant THEN 'Cat-Cow Legacy Skeleton — Source 25'
      ELSE 'Cat-Cow Segmental Wave Legacy Skeleton — Source 889' END,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',CASE id WHEN source_variant THEN 25 ELSE 889 END,
      'archiveReason',CASE id WHEN source_variant THEN
        'exact cycle support anatomy dose constraints cumulative budgets and support contracts were missing'
        ELSE 'duplicate definition was consolidated while its mandatory segmental sequencing was preserved as a new exact variant' END,
      'replacementVariantIds',to_jsonb(active_variant_ids),
      'survivorDefinitionId',canonical_definition,
      'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','superseded_source_skeleton','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id IN(source_variant,duplicate_variant);

  UPDATE coaching.exercise_definition_v1 SET
    status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','duplicate_definition_archived_variant_preserved',
      'survivorDefinitionId',canonical_definition,
      'preservedVariantId',segmental_variant,
      'identityReason','ordered segmental sequencing is an exact variant inside the same quadruped Cat-Cow definition rather than a separate definition',
      'selectable',FALSE,'publicationQuarantined',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=duplicate_definition;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES(
    canonical_definition,1,25,'cat-cow','Cat-Cow','Cat-Cow',
    ARRAY['Cat Cow','Cat-Camel','Cat Camel','Quadruped Cat-Cow','Quadruped Cat-Camel','Cat-Cow Segmental Wave'],
    'From a stable bilateral hands-and-knees quadruped base, begin with the spine and pelvis neutral. Move through comfortable whole-spine flexion with posterior pelvic tilt, reverse through neutral into comfortable extension with anterior pelvic tilt, then return to neutral while both hands and knees remain planted. The standard variant uses coordinated global motion; the segmental-wave variant requires the declared ordered pelvis-to-spine sequence. One counted repetition includes both phases and the neutral return. Lateral circling, rotation, limb lift, locomotion, hover, external force, or a non-quadruped base is a different exercise.',
    'quadruped_spinal_flexion_extension','2.0.0',2,'review',
    82,60,50,ARRAY['brace']::TEXT[],
    ARRAY['spine','thoracic_spine','neck','rib_cage','pelvis','core','scapula','shoulder','wrist','knee']::TEXT[],
    '{}'::TEXT[],ARRAY['mat_optional']::TEXT[],
    jsonb_build_object(
      'surface','flat dry stable nonslip floor that tolerates bilateral hands and knees and permits a safe floor transfer and exit',
      'space','one stationary quadruped station with head trunk elbow hip and foot clearance and no cross traffic',
      'stationCapacity',1,'optionalEquipmentKey','mat_optional',
      'matPolicy','optional stable cushioning may improve hand or knee comfort but cannot conceal unstable or painful support',
      'coachSightline','front and side views sufficient to observe support contacts pelvic initiation spinal phase scapular glide head position breathing symptoms and neutral return',
      'inspection',jsonb_build_array('floor traction cleanliness and clutter','mat flatness and movement when used','hand and knee contact area','head and limb clearance','cross traffic','communication and emergency route','safe floor entry and exit'),
      'changeRule','Changing support interface base range moving region sequence external force dose symptoms surface or downstream loading requires full identity selection dose fatigue duration logistics persistence and rendering revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe floor entry support and exit','comfortable controllable flexion and extension in the selected exact variant','bilateral hand knee shoulder and wrist support tolerance','understands one complete counted cycle and stop signal','no conflicting trauma symptom restriction or service-scope concern'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma or surgery without applicable clearance','severe progressive radiating or unfamiliar spinal pain','new numbness tingling weakness saddle sensory change or bowel or bladder change','dizziness faintness nausea visual change or loss of orientation with head movement','wrist hand shoulder knee or floor-transfer symptoms that prevent exact support','known clinical restriction conflicting with spinal flexion extension or quadruped loading','participant requests stop or cannot communicate reliably'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility','universal symptom treatment','injury prevention','structural correction','normal spinal range','one correct breath phase','one safe dose frequency or recovery interval','readiness for later training')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'primaryIdentitySources',jsonb_build_array(
        'https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/',
        'legacy_sources_25_and_889'),
      'supportingSources',jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/',
        'https://doi.org/10.1186/s12984-024-01366-1',
        'https://blog.nasm.org/workout-plan-for-beginners',
        'https://resources.specialolympics.org/sports-essentials/sports-and-coaching/warm-up-and-cool-down-videos/cool-down-cat-cow-stretch'),
      'sourceLimits','ACE and professional examples establish recognizable technique and example contexts; the guideline supplies clinical scope; the small healthy-adult measurement study supports cycle observability only. None validates universal technique dose safety outcome recovery progression or scores.',
      'duplicateDefinitionConsolidated',duplicate_definition,
      'duplicateSourceVariantPreservedAs',segmental_variant,
      'candidateEvidenceOnly',TRUE,'currentOEmbedMetadataOnly',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'publicationQuarantined',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('rectus_abdominis','internal_oblique','external_oblique','erector_spinae','multifidus'),
      'secondaryMuscles',jsonb_build_array('deep_cervical_flexors','cervical_extensors','quadratus_lumborum','serratus_anterior','middle_trapezius','rhomboids','gluteus_maximus'),
      'stabilizers',jsonb_build_array('rotator_cuff','triceps_brachii','forearm_wrist_flexors_and_extensors','scapular_stabilizers','deep_trunk_stabilizers','hip_stabilizers','quadriceps'),
      'joints',jsonb_build_array('cervical_intervertebral_joints','thoracic_intervertebral_joints','lumbar_intervertebral_joints','lumbosacral_junction','sacroiliac_region','scapulothoracic_articulation','glenohumeral_joint','elbow_joint','radiocarpal_wrist','hip_joint','knee_joint'),
      'jointActions',jsonb_build_array('cervical_thoracic_and_lumbar_flexion','cervical_thoracic_and_lumbar_extension','posterior_and_anterior_pelvic_tilt','scapular_protraction_and_retraction_as_coupled_motion','isometric_shoulder_flexion_support','isometric_elbow_extension_support','sustained_wrist_extension_support','sustained_hip_and_knee_flexion_support'),
      'planes',jsonb_build_array('sagittal'),'laterality','bilateral_symmetric',
      'supportSequence',jsonb_build_array('enter_floor_safely','establish_both_hands_and_both_knees','neutral_start','flexion_phase','reverse_through_neutral','extension_phase','neutral_return','safe_floor_exit'),
      'orientation','prone_facing_quadruped','locomotion',FALSE,
      'repetitionBoundary','neutral quadruped through one comfortable flexion phase and one comfortable extension phase back to neutral with the exact declared sequencing and all four primary contacts maintained',
      'compensationToRecord',jsonb_build_array('elbow_bending_or_shoulder_collapse','hand_or_knee_contact_shift','weight_shift_hiding_spinal_motion','single_lumbar_hinge','head_throw_or_neck_crank','lateral_flexion_or_rotation','breath_holding_or_straining','range_forcing','speed_or_momentum','missed_neutral_return'),
      'anatomyLimit','Muscle roles and coupled scapular or pelvic behavior vary with range and technique; no isolated vertebral motion, tissue force, or universal spinal shape is claimed.'),
    jsonb_build_object(
      'whyItMatters','Provides a low-load way to practice and observe comfortable spinal flexion-extension and pelvic control in an exact quadruped support position; it does not diagnose or treat a condition.',
      'primaryCue','Keep both hands and knees planted; round comfortably, reverse into a comfortable arch, and finish neutral.',
      'expectedSensations',jsonb_build_array('mild changing tension across the back chest or abdomen','light effort through hands shoulders trunk and knees','comfortable movement with normal breathing'),
      'unexpectedSensations',jsonb_build_array('sharp increasing radiating or unfamiliar pain','numbness tingling weakness or saddle sensory change','bowel or bladder change','dizziness faintness nausea or visual change','wrist hand shoulder or knee pain','loss of support or inability to return neutral'),
      'painGuidance','Stop immediately for warning symptoms or participant request. Reduce range only when the full two-phase cycle remains comfortable and intended; do not use this card to assess, diagnose, treat, clear, or override clinical restrictions.',
      'selfChecks',jsonb_build_array('hands under or near shoulders and knees under or near hips','all four contacts remain stable','both flexion and extension phases occur','range stays comfortable','no lateral circle rotation limb lift or hover is added','breathing remains available','neutral finish is regained'),
      'accessibility',jsonb_build_array('front and side demonstration','plain-language cat and cow phase names plus non-animal anatomical cues','written and visual phase sequence','optional stable mat cushioning','smaller range fewer cycles slower pace and rest','stop and choose separately validated support or non-floor card when contacts or transfer do not fit'),
      'mediaAlternatives',jsonb_build_array('step text','phase illustrations','coach demonstration','verbal phase callout','tactile cue only with consent and qualified scope'),
      'reporting','Record the selected exact variant planned and actual cycles range and breath annotations valid invalid partial or assisted attempts first fault symptoms stop reason support changes substitution rest duration and exit.'),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact standard or segmental variant','safe entry and four-point support','hands knees wrists shoulders and floor tolerance','neutral start','pelvic and spinal flexion phase','reversal and extension phase','declared sequencing','scapular and head coupling without collapse or crank','comfortable range and breathing','neutral return','symptoms and participant response','actual time and downstream support exposure'),
      'faultCorrections',jsonb_build_object(
        'elbows_or_shoulders_collapse','reduce range and restore active floor pressure without turning the task into a scapular push-up',
        'single_lumbar_hinge','reduce range and cue pelvis rib cage and head sequence without promising isolated vertebral motion',
        'head_crank','let the head follow the available spinal shape and keep the neck comfortable',
        'lateral_circle_or_rotation','return neutral and select Quadruped Spinal Circles or another distinct card if multi-planar motion is intended',
        'support_shift','reset hand knee spacing and stop if stable quadruped support cannot be restored',
        'breath_hold','reduce range and pace; breath phase may change but straining is not required',
        'symptom','stop record and follow facility escalation policy'),
      'demonstrationPlan',jsonb_build_array('name and show the exact variant','show safe floor entry and exit','show neutral start from front and side','show one complete counted flexion-extension-neutral cycle','contrast standard coordinated with ordered segmental sequencing','show range reduction and invalid lateral circle support loss head crank and missed neutral finish','state warning symptoms and stop process'),
      'groupManagement',jsonb_build_array('one participant per clear station','stagger floor transitions','inspect every mat and support area','maintain front and side sightlines','do not count by speed','use phase callouts and participant stop signals','record substitutions and symptoms','do not force contact or range'),
      'modificationDecisionTree',jsonb_build_array('reduce_range','reduce_cycles','slow_pace','increase_rest','add_optional_stable_mat_cushioning','switch_between_authored_standard_and_segmental_variants_only_after_full_revalidation','select_a_separately_authored_neutral_wrist_elevated_non_floor_or_clinician_directed_task','stop_and_escalate'),
      'doNotUseWhen',jsonb_build_array('warning symptom or participant stop request','recent significant trauma or surgery without applicable clearance','conflicting clinical restriction','unsafe or intolerable hand wrist shoulder knee or floor support','unsafe floor entry or exit','task intent is circular rotational loaded hover limb-lift passive manual or clinical','required supervision communication space or emergency access is unavailable'),
      'scopeBoundary','Coach movement and record observations within role. Do not diagnose pain, prescribe treatment, define normal range, promise prevention or correction, or infer readiness from an exercise score.'),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_variant_mismatch','support_or_equipment_mismatch','floor_transfer_or_accessibility','pain_or_neurologic_symptom','dizziness_or_systemic_warning','technique_or_counting','duration_or_budget','media_or_instruction_conflict','incident_or_near_miss','data_or_version_mismatch'),
      'supportEscalation',jsonb_build_array('stop_and_secure_participant','record_planned_and_actual_state','follow_urgent_or_emergency_policy_for_red_flags','route_nonurgent_clinical_question_to_qualified_provider','route_identity_content_media_or_data_issue_to_library_owner','do_not_diagnose_or_clear'),
      'retentionPolicy','Persist definition card schema generator rendering and research versions plus planned and actual variant dose timing support range breath annotations valid invalid partial assisted or symptom-limited attempts first fault symptoms stops substitutions incidents and reviewer state under facility policy.',
      'changeImpactPolicy','Any change to identity sequencing base support moving region actions range contract equipment surface symptoms dose duration fatigue budget substitution logic instructions media or approval state requires affected-workout revalidation and version-aware coach and participant rerendering.',
      'incidentMinimum',jsonb_build_array('participant_and_session','definition_and_variant','planned_and_actual_cycle','support_and_surface','first_fault','symptom_and_onset_phase','stop_and_response','substitution','escalation','versions'),
      'humanReviewQueue',jsonb_build_array('evidence_scope','standard_and_segmental_identity','anatomy_and_actions','instructions_and_support','five_full_videos','alternates','graph','difficulty_calibration','content','publication')))
  ON CONFLICT(id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,legacy_exercise_id=EXCLUDED.legacy_exercise_id,
    slug=EXCLUDED.slug,canonical_name=EXCLUDED.canonical_name,
    display_name=EXCLUDED.display_name,aliases=EXCLUDED.aliases,
    description=EXCLUDED.description,family_key=EXCLUDED.family_key,
    schema_version=EXCLUDED.schema_version,card_version=EXCLUDED.card_version,
    status='review',content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,
    media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,
    optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,approved_video_url=NULL,
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,
    athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT v.id,canonical_definition,v.variant_key,v.display_name,v.modifier_keys,
    jsonb_build_object(
      'technicalComplexity',v.complexity,'exerciseComplexity',v.complexity,
      'absoluteLoadDemand',v.physical,'physicalDifficulty',v.physical,
      'coordinationDemand',v.coordination,'supervisionDemand',v.supervision,
      'failureConsequence',v.failure,'impact',1,'workCapacityDemand',v.capacity,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'complexityDimensions',jsonb_build_object(
        'supportSetup',16,'phaseRecognition',20,'pelvisSpineCoordination',v.coordination,
        'orderedSegmentation',CASE WHEN v.id=segmental_variant THEN 40 ELSE 12 END,
        'errorDetectionAndReset',v.complexity),
      'physicalDimensions',jsonb_build_object(
        'bodyweightSupport',10,'wristAndShoulderSupport',12,'kneeContactTolerance',8,
        'spinalRangeEffort',8,'workCapacity',v.capacity),
      'independentCalibrationRequired',TRUE,'approvalsCreated',FALSE),
    jsonb_build_object(
      'selectable',TRUE,'base','bilateral_hands_and_knees_quadruped',
      'support','both_hands_both_knees_or_shins_with_stable_floor_contacts',
      'equipment',jsonb_build_array('none'),'optionalEquipment',jsonb_build_array('mat_optional'),
      'startPosition','neutral_quadruped_with_stable_four_point_support_and_comfortable_head_position',
      'actionSequence',CASE WHEN v.id=standard_variant THEN
        jsonb_build_array('coordinated_posterior_pelvic_tilt_and_whole_spine_flexion','reverse_through_neutral','coordinated_anterior_pelvic_tilt_and_whole_spine_extension','neutral_return')
      ELSE jsonb_build_array('posterior_pelvic_tilt_initiates','lumbar_then_thoracic_then_cervical_flexion_follows','reverse_through_neutral','anterior_pelvic_tilt_initiates','lumbar_then_thoracic_then_cervical_extension_follows','neutral_return') END,
      'countingRule','one repetition requires one complete flexion phase one complete extension phase and the final neutral return',
      'breathRule','exhale-to-flex and inhale-to-extend is the default cue but comfortable continuous breathing is acceptable; breath holding or straining is invalid',
      'validCompletion','exact declared sequencing with stable bilateral hand and knee support comfortable flexion and extension no added lateral circle rotation limb lift hover or external force and a controlled neutral return without warning symptoms',
      'invalidCompletion',jsonb_build_array('one_phase_omitted','neutral_return_missed','wrong_sequence_for_segmental_variant','hand_or_knee_contact_lost','support_collapse','lateral_circle_or_rotation_added','limb_lift_hover_or_locomotion_added','external_force_added','forced_range_or_momentum','warning_symptom'),
      'rangePolicy','comfortable controllable active range; no universal normal curve end range or segmental amplitude is required',
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','bodyweight_closed_chain_quadruped_spinal_flexion_extension',
      'externalLoadMethod','bodyweight_segment_mass_with_bilateral_hand_and_knee_support',
      'gripDemand',4,'spinalLoading',8,'eccentricStress',6,
      'jointStress',12,'landingContactsPerRep',0,'handImpactContactsPerRep',0,
      'impactClass','none','supportDistribution','variable low-load body-segment support across both hands and knees; no fixed percentage is claimed',
      'primaryExposure',jsonb_build_array('wrist_extension_and_hand_pressure','shoulder_and_scapular_support','knee_and_shin_contact','active_spinal_flexion_extension','pelvic_tilt','head_following_spinal_shape'),
      'tracking',jsonb_build_array('variant','support_and_surface','planned_and_actual_complete_cycles','phase_and_sequence','range_and_breath_annotations','tempo_and_holds','support_shift','first_fault','symptoms','duration','same_session_wrist_shoulder_knee_and_spinal_exposure')),
    jsonb_build_object(
      'localMuscleFatigue',12,'gripFatigue',4,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',1,'recoveryHours',2,
      'primaryFatigueSites',jsonb_build_array('trunk_flexors_and_extensors','scapular_and_shoulder_support','forearm_and_wrist_support','knee_contact_tolerance','attention_and_sequence_control'),
      'cumulativeBudget',jsonb_build_object('completeCycles',30,'activeSpinalRangeSeconds',300,'quadrupedSupportSeconds',420,'technicalSensitivity',v.technical_fatigue,'impact',1),
      'interference',jsonb_build_array('wrist_or_shoulder_support_volume','knee_contact_and_floor_work','loaded_spinal_flexion_extension','high_fatigue_trunk_work','crawling_handstand_or_tumbling_support','symptoms_or_clinical_care'),
      'recoveryIsPlanningEstimate',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('comfortable_spinal_flexion_extension_access','pelvis_spine_coordination','quadruped_support_awareness',CASE WHEN v.id=segmental_variant THEN 'ordered_segmental_control' ELSE 'coordinated_whole_spine_control' END,'low_load_breath_movement_awareness'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,2),'completeCycles',jsonb_build_array(4,10),'secondsPerCycle',jsonb_build_array(6,30),'restSeconds',jsonb_build_array(0,60),'range','comfortable_controllable'),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('exact_quadruped_support_safe','safe_floor_entry_and_exit','comfortable_controllable_flexion_and_extension','understands_counting_sequence_and_stop_prompt','no_conflicting_warning_symptom_or_restriction'),
      'completionCriteria',jsonb_build_array('both_phases_and_neutral_return','exact_variant_sequence','stable_four_point_support','comfortable_range','no_added_action_or_base_change','no_warning_symptom'),
      'sequenceRules',jsonb_build_array('prepare_or_restore_context_only','count_complete_cycles_not_individual_phases','do_not_count_partial_or_wrong_sequence_attempts','revalidate_downstream_support_and_spinal_loading'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_load_breathing','light_general_preparation','separately_validated_quadruped_rotation_or_crawling_when_budgets_fit'),'avoid',jsonb_build_array('wrist_shoulder_or_knee_support_when_current_exposure_conflicts','loaded_spinal_flexion_extension_when_range_or_symptoms_conflict','fatiguing_floor_or_trunk_work','time_critical_output_when_this_drill_displaces_priority_work')),
      'interferenceRules',jsonb_build_array('count_all_same_session_quadruped_support_and_spinal_range','stop_before_support_or_sequence_changes','select_a_distinct_card_instead_of_adding_circles_rotation_hover_limb_lift_or_load'),
      'uncertaintyPolicy','When base support sequence moving region symptoms scope or dose is uncertain do not select; request clarification or choose a separately validated task.',
      'selectionStatus','review_only_machine_complete','publicationQuarantined',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE)
  FROM (VALUES
    (standard_variant,'standard-coordinated-quadruped-cycle','Cat-Cow — Standard Coordinated',ARRAY['quadruped','standard','coordinated']::TEXT[],24,10,24,16,14,12,24),
    (segmental_variant,'ordered-segmental-wave-cycle','Cat-Cow — Ordered Segmental Wave',ARRAY['quadruped','segmental','ordered']::TEXT[],34,10,36,20,14,14,32)
  ) v(id,variant_key,display_name,modifier_keys,complexity,physical,coordination,supervision,failure,capacity,technical_fatigue)
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT p.id,p.variant_id,p.profile_key,p.phase_key,p.role,
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Use the exact Cat-Cow variant as low-load quadruped spinal flexion-extension preparation when floor access, support contacts, symptoms, cumulative exposure, and the next task fit.'
    ELSE 'Use a conservative exact Cat-Cow cycle after training to restore comfortable movement options without treating symptoms, forcing range, or adding fatigue.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      CASE WHEN p.variant_id=standard_variant THEN 90 ELSE 84 END
    ELSE CASE WHEN p.variant_id=standard_variant THEN 84 ELSE 76 END END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 84 ELSE 72 END,
    jsonb_build_object('mobility',94,'movement_control',CASE WHEN p.variant_id=segmental_variant THEN 96 ELSE 88 END,'recovery',CASE WHEN p.phase_key='restore' THEN 84 ELSE 58 END,'quadruped_support',66),
    jsonb_build_object('sets',jsonb_build_array(1,2),
      'completeCycles',CASE WHEN p.phase_key='prepare_and_access' THEN jsonb_build_array(4,10) ELSE jsonb_build_array(3,8) END,
      'secondsPerCycle',CASE WHEN p.variant_id=segmental_variant THEN jsonb_build_array(10,30) ELSE jsonb_build_array(6,24) END,
      'restSeconds',jsonb_build_array(0,60),'range','comfortable_controllable',
      'countingRule','flexion_plus_extension_plus_neutral_return_is_one_cycle',
      'breathing','continuous_comfortable_no_straining'),
    'The exact variant and four-point base are stable; both comfortable spinal phases occur with the declared coordination or segmental sequence; no lateral circle, rotation, limb lift, hover, external force, support collapse, or warning symptom appears; and neutral is regained.',
    ARRAY[
      'Sharp, increasing, radiating, or unfamiliar spinal or joint pain; participant stop request.',
      'Numbness, tingling, weakness, saddle sensory change, or bowel or bladder change.',
      'Dizziness, faintness, nausea, visual change, disorientation, or inability to communicate clearly.',
      'Recent significant trauma, surgery, or a clinical restriction becomes known and conflicts with the task.',
      'Hand, wrist, shoulder, knee, or floor-transfer symptoms prevent stable exact support.',
      'Support collapse, lateral circle, rotation, limb lift, hover, external force, forced range, speed, breath holding, or wrong segmental sequence cannot be corrected by range or pace reduction.',
      'Floor, mat, space, traffic, sightline, hygiene, communication, entry, or exit becomes unsafe.',
      'The planned cycle, support-time, spinal-range, technical-fatigue, duration, or downstream exposure budget is reached.',
      'The task would become a seated, standing, supine, elevated, neutral-wrist, thoracic-only, cervical-only, circular, flow, loaded, manual, or clinical exercise identity.'
    ]::TEXT[],
    'Verify the exact variant, safe floor entry and exit, floor or mat, hand wrist shoulder and knee tolerance, current symptoms and restrictions, planned cycles, downstream support and spinal loading, communication, and stop process. Demonstrate front and side; count only a complete flexion-extension-neutral cycle; observe support, pelvic and spinal phase, declared sequencing, scapular and head coupling, breathing, symptoms, first fault, and actual duration. Do not force range, diagnose, treat, or label a spinal shape as normal.',
    CASE WHEN p.variant_id=standard_variant THEN
      'Start on hands and knees. Round your pelvis and spine, reverse into a comfortable arch, then finish neutral. Keep all four contacts steady. Stop for pain, tingling, weakness, dizziness, or lost support.'
    ELSE
      'Start on hands and knees. Let the pelvis lead, then move the spine in order into a round shape; reverse the order into a comfortable arch and finish neutral. Stop for pain, tingling, weakness, dizziness, or lost support.' END,
    CASE WHEN p.variant_id=segmental_variant THEN
      'More consistent ordered low-load pelvic and spinal flexion-extension control in the exact quadruped base; no isolated-vertebra, treatment, structural, readiness, or performance outcome is guaranteed.'
    ELSE 'More consistent low-load coordinated spinal flexion-extension and pelvic control in the exact quadruped base; no treatment, structural, readiness, or performance outcome is guaranteed.' END,
    ARRAY['none']::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','bilateral_hands_and_knees_quadruped',
      'optionalEquipment','mat_optional','floorEntryAndExitRequired',TRUE,
      'space','stationary_one_person_quadruped_clearance','setupSeconds',25,
      'coachSightline','front_and_side','crossTrafficProhibited',TRUE,
      'surfaceAndMatInspectionRequired',TRUE,'hygieneResetRequired',TRUE,
      'revalidateAfterAnyChange',TRUE),
    CASE WHEN p.variant_id=standard_variant THEN ARRAY[segmental_variant]::UUID[]
      ELSE ARRAY[standard_variant]::UUID[] END,
    'review',
    jsonb_build_object(
      'durationFormula','setup_seconds + sum(actual_complete_cycles * actual_seconds_per_cycle) + phase_hold_seconds + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + floor_exit_seconds',
      'secondsPerCycle',CASE WHEN p.variant_id=segmental_variant THEN jsonb_build_array(10,30) ELSE jsonb_build_array(6,24) END,
      'minimumSeconds',50,'typicalSeconds',120,'maximumSecondsWithoutReview',360,
      'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'regressionOrder',jsonb_build_array('reduce_range','reduce_to_three_or_four_complete_cycles','slow_pace','remove_phase_holds','increase_rest','add_optional_stable_mat_cushioning',CASE WHEN p.variant_id=segmental_variant THEN 'select_standard_coordinated_exact_variant_after_revalidation' ELSE 'stop_and_select_a_separately_validated_support_or_non_floor_task' END),
      'progressionOrder',jsonb_build_array('complete_clean_cycles','increase_cycles_within_profile','add_brief_phase_holds_only_if_support_and_breathing_remain_clean','select_segmental_variant_only_by_variant_change_after_sequence_revalidation','select_distinct_multiplanar_or_loaded_task_only_after_full_revalidation'),
      'neverScaleByForcingRangeAddingSpeedOrIgnoringSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_and_variant','support_surface_and_optional_mat','planned_and_actual_complete_cycles','phase_sequence','range_breath_tempo_and_hold_annotations','valid_invalid_partial_assisted_and_symptom_limited_attempts','first_fault','support_shift','symptoms_and_stop_reason','rest','duration','substitution','floor_exit'),
      'validUnit','one_complete_flexion_extension_cycle_with_exact_sequence_and_neutral_return',
      'individualPhasesDoNotCountAsRepetitions',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('exact_variant','four_point_support','both_phases','comfortable_range','breathing','neutral_return','warning_symptom_stop'),
      'coach',jsonb_build_array('floor_entry_and_exit','support_tolerance','phase_and_sequence','spinal_pelvic_scapular_and_head_observation','first_fault','clinical_scope','logging_and_escalation'),
      'accessibility',jsonb_build_array('front_and_side_demonstration','written_and_visual_phase_sequence','plain_language_and_anatomical_cues','optional_mat_cushioning','smaller_range_fewer_cycles_slower_pace_and_rest','separately_validated_support_or_non_floor_alternative'))
  FROM (VALUES
    ('bb41b865-48d9-4731-8301-5c8697e6f03d'::UUID,standard_variant,'prepare-standard-coordinated-cycle','prepare_and_access','primary'),
    ('d658764d-60e6-4032-b2f5-c1758761444b'::UUID,standard_variant,'restore-standard-low-dose','restore','primary'),
    ('383a4087-acbb-4b90-aee4-3b0f47d7ad7b'::UUID,segmental_variant,'prepare-ordered-segmental-wave','prepare_and_access','secondary'),
    ('8cb3770b-c2ee-46fc-adef-be94e402e148'::UUID,segmental_variant,'restore-segmental-low-dose','restore','secondary')
  ) p(id,variant_id,profile_key,phase_key,role)
  ON CONFLICT(id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,profile_key=EXCLUDED.profile_key,
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

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,canonical_definition,duplicate_definition,'duplicate_consolidated',
      'Source 889 uses the same quadruped contacts, spinal flexion-extension actions, phase endpoints, and full-cycle boundary as Cat-Cow. Its stricter pelvis-to-spine order is preserved as the survivor segmental-wave exact variant rather than as a duplicate definition.',
      jsonb_build_object('migration',migration_key,
        'identityBoundary','source_25_cat_cow_vs_source_889_segmental_wave_definition_consolidation',
        'survivorContract','quadruped_flexion_extension_full_cycle_with_standard_and_segmental_exact_variants',
        'duplicateDefinitionContract','same_full_cycle_with_mandatory_ordered_segmental_sequence',
        'preservedVariantId',segmental_variant,
        'legacySources',jsonb_build_array(25,889),
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,spinal_circle_definition,'distinct_exercises',
      'Quadruped Spinal Circles adds lateral shifting or lateral flexion and a circular path in both directions. Cat-Cow is a sagittal flexion-extension cycle with neutral return and no lateral circle.',
      jsonb_build_object('migration',migration_key,
        'identityBoundary','cat_cow_sagittal_cycle_vs_quadruped_spinal_circle',
        'leftContract','quadruped_spinal_flexion_extension_full_cycle_neutral_return',
        'rightContract','quadruped_multiplanar_spine_and_pelvis_circle_both_directions',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,e.section_key,e.source_url,e.source_title,e.publisher,
    e.source_kind,jsonb_build_array(
      jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,
        'noUniversalShapeSequenceRangeTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/','Back Exercises: Cat-Cow','American Council on Exercise','professional_standard','ACE specifies a quadruped neutral start followed by cat flexion, cow extension, and return. This supports the canonical full-cycle boundary and separates it from circular, rotational, limb-lift, hover, loaded, and non-quadruped tasks.','direct professional Cat-Cow identity and instruction','ACE does not adjudicate Source 889, define the Vortex cycle count, or approve consolidation.',88),
    ('taxonomy','https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/','Back Exercises: Cat-Cow','American Council on Exercise','professional_standard','The observable task is bilateral closed-chain quadruped spinal flexion-extension with pelvic tilt and coupled scapular motion in the sagittal plane.','direct professional movement context','ACE does not create or approve Vortex controlled keys; brace is the existing trunk-control key and mobility remains purpose.',88),
    ('anatomy','https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/','Back Exercises: Cat-Cow','American Council on Exercise','professional_standard','ACE specifies hands under shoulders, knees under hips, abdominal contraction during flexion, whole-spine shape change, head following the spine, and scapular approximation during extension.','direct support and observable action context','It does not quantify muscle force, isolate vertebral levels, or define universal scapular or pelvic motion.',88),
    ('biomechanics','https://doi.org/10.1186/s12984-024-01366-1','Automated, IMU-based spine angle estimation and IMU location identification for telerehabilitation','Journal of NeuroEngineering and Rehabilitation','peer_reviewed_research','A two-IMU study operationalized full-spine Cat-Cow as a repeated cycle and measured head-to-pelvis flexion angle across five repetitions.','whole-spine cycle measurement in twelve healthy young adult men','The study was designed to validate measurement, not technique, safety, normal range, segmental order, clinical effectiveness, or dose.',84),
    ('difficulty','https://doi.org/10.1186/s12984-024-01366-1','Automated, IMU-based spine angle estimation and IMU location identification for telerehabilitation','Journal of NeuroEngineering and Rehabilitation','peer_reviewed_research','Whole-spine phase coordination and a measurable repeated cycle support nonzero exercise complexity despite low external load. Ordered segmental sequencing adds motor-control demand.','task observability and coordination context','The study assigns no Vortex score and does not compare standard versus segmental difficulty or classify participants.',84),
    ('load_fatigue_recovery','https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/','Back Exercises: Cat-Cow','American Council on Exercise','professional_standard','ACE describes no external equipment and bilateral hand-and-knee floor support while the spine moves under body-segment mass.','direct support and external-load context','It does not quantify hand load, spinal tissue load, fatigue, cumulative limits, or recovery.',88),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/','Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021','Journal of Orthopaedic & Sports Physical Therapy / Academy of Orthopaedic Physical Therapy','professional_standard','The guideline supports exercise and movement-control or trunk-mobility interventions for appropriate presentations while emphasizing patient-centered assessment and red-flag screening.','clinical exercise scope and selection context','The guideline is not a Cat-Cow prescription and does not authorize exercise staff to diagnose, treat, or clear participants.',96),
    ('dosage','https://blog.nasm.org/workout-plan-for-beginners','The Best 5-Week Workout Plan for Beginners','National Academy of Sports Medicine','expert_instruction','NASM includes Cat-Cow at two sets of ten in one example dynamic warm-up.','one professional programming example','The example is not a universal dose, frequency, recovery, eligibility, or outcome rule; ACE uses different phase timing.',74),
    ('instructions','https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/','Back Exercises: Cat-Cow','American Council on Exercise','professional_standard','ACE supports hands under shoulders, knees under hips, neutral start, exhaled flexion, controlled extension, head following the spine, and neutral return.','direct professional technique','It does not validate every Vortex cue, one breath phase for all participants, segmental sequencing, or the authored counting rule.',88),
    ('safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/','Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021','Journal of Orthopaedic & Sports Physical Therapy / Academy of Orthopaedic Physical Therapy','professional_standard','Best-practice guidance includes screening for red-flag conditions and neurologic deficits before or during exercise management.','clinical warning and referral context','It does not prove Cat-Cow safe for a specific participant or replace facility emergency and clinical policies.',96),
    ('programming','https://blog.nasm.org/workout-plan-for-beginners','The Best 5-Week Workout Plan for Beginners','National Academy of Sports Medicine','expert_instruction','NASM places Cat-Cow in one dynamic warm-up and separately advises limits, pain stops, and recovery awareness.','professional example warm-up context','It does not establish phase exclusivity, sport transfer, prevention, universal dose, or Vortex cumulative budgets.',74),
    ('athlete_support','https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/','Back Exercises: Cat-Cow','American Council on Exercise','professional_standard','The direct setup and two named phases can be translated into concise visible participant instructions and self-checks.','plain-language participant support','The source does not establish universal sensation meaning, accessibility, symptom treatment, or readiness.',88),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/','Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021','Journal of Orthopaedic & Sports Physical Therapy / Academy of Orthopaedic Physical Therapy','professional_standard','Clinical guidance supports individualized exercise and monitoring rather than one universal drill, and it preserves red-flag and neurologic escalation responsibilities.','coach observation and scope boundary','The guideline does not prescribe group layout, cues, counting, progression, or floor-transfer management.',96),
    ('accessibility','https://resources.specialolympics.org/sports-essentials/sports-and-coaching/warm-up-and-cool-down-videos/cool-down-cat-cow-stretch','Cool Down: Cat Cow Stretch','Special Olympics','governing_body','Special Olympics provides Cat-Cow as a coach-facing sport cool-down demonstration.','inclusive sport demonstration context','The page does not prove universal access, specify support modifications, or validate Vortex accessibility decisions.',78),
    ('alternates','https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/','Back Exercises: Cat-Cow','American Council on Exercise','professional_standard','ACE exact hands-and-knees flexion-extension phases provide the boundary for identifying added planes, moving regions, contacts, bases, loads, limbs, or flows as different tasks.','alternate identity boundary context','The source does not adjudicate all twenty Vortex alternates or approve any graph edge.',88),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Nine legacy candidates across sources 25 and 889 returned current YouTube oEmbed title, channel, thumbnail, and iframe metadata on 2026-08-02; five title-relevant candidates were selected.','candidate metadata and privacy-enhanced embed format only','oEmbed does not prove playback, exact standard or segmental variant, support, cycle, range, breathing, captions, accessibility, cue quality, safety, conflicts, reviewer identity, card-version match, or approval.',82)
  ) e(section_key,source_url,source_title,publisher,source_kind,supported_claim,scope,limitation,quality)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url) DO UPDATE SET
    source_title=EXCLUDED.source_title,source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  SELECT canonical_definition,NULL,2,'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,m.channel,
    NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research',
    m.query,NULL,NULL,'2026-11-02'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback and exact standard or segmental sequence, support, phases, cycle count, range, breathing, captions, accessibility, cue quality, safety, conflicts, reviewer identity, card-version match, and approval remain unverified.'
  FROM (VALUES
    ('1Y0YjXS9sKI','How to Do a Cat Cow Stretch: A Guide from Physical Therapists','Hinge Health','legacy source-25 candidate checked by YouTube oEmbed'),
    ('8kUU_odEY3o','How to: Cat cow exercise by the Women''s Sports Medicine Program at Mass General','MGHOrthopaedics','legacy source-25 candidate checked by YouTube oEmbed'),
    ('T0MsxeAROUQ','How to Do the Cat Cow | Medbridge','Medbridge','legacy source-25 candidate checked by YouTube oEmbed'),
    ('d_k1g-SJR-4','Segmental Cat Cow | Spine Range of Motion | Flexion & Extension','E3 Rehab Exercise Library','legacy source-889 candidate checked by YouTube oEmbed'),
    ('bKYGb1TgS6o','1 Minute Mobility - Segmental Cat Cow','The Jiu-Jitsu Therapist','legacy source-889 candidate checked by YouTube oEmbed')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=NULL,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,
      'neverInferFromNameOrParticipantRanking',TRUE),
    jsonb_build_object('status',a.proposed_status,
      'classificationCandidate',a.classification,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,
      'approvalsCreated',FALSE),'candidate',NULL,NULL
  FROM (VALUES
    ('Cat-Camel or Cat Cow','same_identity','Common naming aliases retain the same quadruped flexion-extension cycle when contacts phases and neutral return are exact.','direct_alias',jsonb_build_array('quadruped','flexion','extension','neutral_return'),'alias'),
    ('Standard Coordinated Quadruped Cat-Cow','new_variant','The whole spine and pelvis move as a coordinated flexion-extension pattern without mandatory segment-by-segment ordering.','standard_variant',jsonb_build_array('quadruped','coordinated','full_cycle'),'authored_variant'),
    ('Cat-Cow Segmental Wave','new_variant','Source 889 retains the same contacts actions endpoints and full cycle but requires ordered pelvis-to-spine sequencing; consolidate its duplicate definition and preserve this exact variant.','source_889_variant',jsonb_build_array('legacy_source_889','ordered_segmental_sequence','same_cycle'),'authored_variant'),
    ('Breath Phase or Comfortable Breath Timing','modifier_annotation','Breath phase changes delivery when support spinal phases full cycle and the no-straining rule remain exact.','breath_annotation',jsonb_build_array('breath_phase','continuous_breathing'),'delivery_annotation'),
    ('Phase Holds Tempo Cycles or Rest','modifier_annotation','Brief holds cadence cycle count and rest change dose rather than the exact repetition boundary.','dose_annotation',jsonb_build_array('phase_hold','tempo','cycles','rest'),'delivery_annotation'),
    ('Range-Reduced Cat-Cow','modifier_annotation','Smaller comfortable flexion-extension range remains the same task when both phases and neutral return remain intended and observable.','range_annotation',jsonb_build_array('range','both_phases'),'delivery_annotation'),
    ('Optional Mat or Knee Cushion','modifier_annotation','Stable cushioning changes contact comfort and setup without changing hand-and-knee support or the scored spinal cycle.','surface_annotation',jsonb_build_array('mat_optional','cushioning','same_contacts'),'delivery_annotation'),
    ('Neutral-Wrist Cat-Cow on Fists Handles or Wedges','new_variant','Hand interface and wrist position materially change support and equipment and require an exact reviewed variant before selection.','neutral_wrist_variant',jsonb_build_array('hand_interface','wrist_position','equipment'),'needs_human_review'),
    ('Elevated-Hands Cat-Cow on Bench or Box','new_variant','Elevating the hands changes trunk angle load distribution equipment clearance and exit while preserving a possible flexion-extension cycle; author separately.','elevated_hands_variant',jsonb_build_array('elevated_hands','equipment','load_distribution','exit'),'needs_human_review'),
    ('Seated Cat-Cow','new_definition','A seated base removes bilateral hand-and-knee loading and changes pelvic shoulder scapular transfer and support contracts.','seated_distinct',jsonb_build_array('seated','no_hand_knee_support'),'research_queue'),
    ('Standing Wall- or Chair-Supported Cat-Cow','new_definition','Standing support balance hand contact trunk orientation and fall or exit rules differ from quadruped.','standing_distinct',jsonb_build_array('standing','external_support','balance'),'research_queue'),
    ('Supine Pelvic Tilt or Spinal Flexion-Extension','new_definition','A supine surface supports the spine and removes closed-chain hand-and-knee loading creating different actions and feedback.','supine_distinct',jsonb_build_array('supine','surface_feedback','no_quadruped_support'),'research_queue'),
    ('Quadruped Spinal Circles','new_definition','Source 26 adds lateral shift or flexion and a circular path in both directions rather than one sagittal flexion-extension cycle.','spinal_circle_distinct',jsonb_build_array('source_26','lateral_motion','circular_path'),'existing_distinct_definition'),
    ('Thoracic-Only Cat-Camel','new_definition','Holding the pelvis and lumbar region while isolating thoracic flexion-extension changes the intended moving region and completion rule.','thoracic_only_distinct',jsonb_build_array('thoracic_only','pelvis_fixed'),'research_queue'),
    ('Quadruped Cervical Flexion-Extension','new_definition','Moving only the neck while thorax and pelvis remain fixed omits the whole-spine and pelvic cycle.','cervical_only_distinct',jsonb_build_array('cervical_only','trunk_fixed'),'research_queue'),
    ('Cat-Cow with Tail Wag or Lateral Flexion','new_definition','Adding side bending changes plane action sequence repetition boundary and measurement.','lateral_flexion_distinct',jsonb_build_array('frontal_plane','lateral_flexion'),'research_queue'),
    ('Cat-Cow to Child''s Pose or Down-Dog Flow','new_definition','Leaving quadruped contacts for another pose adds transitions support endpoints and duration contracts.','flow_distinct',jsonb_build_array('multi_pose','contact_change','transition'),'research_queue'),
    ('Hover or Bear-Position Cat-Cow','new_definition','Lifting the knees creates a loaded hover with different strength fatigue support and failure demands.','hover_distinct',jsonb_build_array('knees_off_floor','increased_support_load'),'research_queue'),
    ('Bird-Dog or Limb-Lift Cat-Cow','new_definition','Removing a hand or knee contact and moving a limb adds balance laterality anti-rotation and limb-action requirements.','limb_lift_distinct',jsonb_build_array('contact_removed','limb_lift','anti_rotation'),'research_queue'),
    ('Loaded Banded Partner-Resisted or Manual-Assisted Cat-Cow','new_definition','External force anchor or partner contact consent load magnitude failure consequence and clinical scope create a different task.','external_force_distinct',jsonb_build_array('external_force','anchor_or_partner','consent','clinical_scope'),'research_queue')
  ) a(name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,
      'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity','variant sequence','base and support','moving region and actions','symptoms and restrictions','purpose','dose','fatigue and cumulative support and spinal budget','duration','equipment surface space and logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (standard_variant,segmental_variant,'progression',88,ARRAY['complexity','stability']::TEXT[],'Adds mandatory ordered pelvis-to-spine sequencing while retaining the same quadruped cycle; exact variant score instructions and measurement require revalidation.'),
    (segmental_variant,standard_variant,'regression',88,ARRAY['complexity','stability']::TEXT[],'Removes mandatory segmental ordering while retaining the complete quadruped flexion-extension cycle; this remains an exact variant change.'),
    (standard_variant,spinal_circle_variant,'progression',66,ARRAY['range','complexity','decision_demand']::TEXT[],'Changes to a distinct multi-planar circular task with lateral components and both directions; it is never an automatic Cat-Cow substitution.'),
    (spinal_circle_variant,standard_variant,'regression',66,ARRAY['range','complexity','decision_demand']::TEXT[],'Changes from a distinct multi-planar spinal circle to a sagittal flexion-extension cycle; identity dose and measurement must be revalidated.'),
    (standard_variant,thread_variant,'compatible_pairing',54,ARRAY['range','complexity','fatigue']::TEXT[],'Thread-the-Needle is a distinct rotational task that may follow Cat-Cow only when wrist shoulder knee spinal-range duration and symptom budgets permit.')
  ) r(from_id,to_id,relationship,score,dimensions,reason)
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
  SELECT 1,v.id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity ELSE v.physical END,
    20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on four-point setup, phase recognition, pelvis-spine coordination, exact cycle counting, support monitoring, neutral return, and the declared standard or segmental sequence.'
    ELSE 'Review-only physical-difficulty anchor based on bilateral hand and knee bodyweight support, wrist and shoulder tolerance, active spinal range, low work capacity, and no impact without asserting tissue force.' END
      ||' This scores the exercise task, not participant proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (standard_variant,'standard-coordinated-quadruped-cycle',24,10),
    (segmental_variant,'ordered-segmental-wave-cycle',34,10)
  ) v(id,variant_key,complexity,physical)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise SET
    name='Cat-Cow',slug='cat-cow',
    description='Use the exact standard-coordinated or ordered-segmental Cat-Cow variant. From neutral hands-and-knees support, move through comfortable spinal and pelvic flexion, reverse into comfortable extension, and finish neutral while all four contacts stay stable. One repetition includes both phases and the neutral return.',
    instructions='Select and record the exact variant. Enter a stable hands-and-knees base. For the standard variant, coordinate the pelvis and whole spine through a comfortable round shape, reverse through neutral into a comfortable arch, and return neutral. For the segmental variant, let the pelvis initiate and move the spine in the declared order through each phase. Count only a full flexion-extension-neutral cycle. Keep all four contacts, range, breathing, and support comfortable. Stop for sharp, increasing, radiating, or unfamiliar pain; numbness; tingling; weakness; saddle sensory or bowel or bladder change; dizziness; faintness; nausea; visual change; lost support; or participant request. This is exercise, not assessment, diagnosis, treatment, or clearance.',
    skill_level=NULL,age_min=NULL,age_max=NULL,default_sets=1,default_reps=6,
    default_work_seconds=NULL,default_rest_seconds=15,
    tempo='slow comfortable complete flexion-extension cycle with neutral return; exact sequence determined by variant',
    load_note='Track exact variant, four-point support and surface, optional mat, planned and actual complete cycles, phase sequence, range, breathing, tempo, holds, valid invalid partial assisted or symptom-limited attempts, first fault, symptoms, rest, duration, substitution, and same-session hand wrist shoulder knee and spinal exposure.',
    est_seconds_per_set=120,is_published=FALSE,archived=FALSE,
    card_summary='Exact quadruped spinal flexion-extension cycle with standard coordinated and ordered segmental-wave variants.',
    coach_language='Verify the exact variant, floor entry and exit, support and surface, wrist shoulder and knee tolerance, symptoms and restrictions, planned cycles, phase and sequence, comfortable range, neutral return, actual duration, downstream support and spinal loading, stop response, and professional scope.',
    athlete_language='Keep both hands and knees steady, move through a comfortable round and arch, finish neutral, and stop for pain, numbness, tingling, weakness, dizziness, or lost support.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,
      'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','standard versus ordered segmental sequence','safe floor entry support and exit','hand wrist shoulder and knee tolerance','comfortable spinal flexion extension','trauma symptom and clinical restriction context','cycle dose duration and cumulative support exposure','coach scope sightline communication and escalation'),
      'substitutionRevalidation',jsonb_build_array('identity','exact variant sequence','base and support','moving region and actions','symptoms and restrictions','purpose','dose','fatigue and cumulative support and spinal budget','duration','equipment surface space and logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['complete_cycles','range','seconds_per_cycle','phase_hold_seconds','breath_phase','rest_seconds','sets']::TEXT[],
    movement_family='Quadruped Spinal Flexion-Extension',primary_phase_key=NULL,
    phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,
      'exactCycle',jsonb_build_array('neutral_quadruped','comfortable_flexion','reverse_through_neutral','comfortable_extension','neutral_return'),
      'mustMaintain',jsonb_build_array('exact_variant_sequence','bilateral_hand_and_knee_support','comfortable_range','both_phases','continuous_available_breathing','neutral_return','communication'),
      'mustNotAdd',jsonb_build_array('lateral_circle_or_rotation','limb_lift','hover','locomotion','external_force','non_quadruped_base','forced_range_or_speed','clinical_assessment_treatment_or_clearance','silent_phase_omission'),
      'validCompletion','one full comfortable flexion-extension cycle with exact declared sequence stable support no added action or warning symptom and neutral return'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_support_and_station_exact','safe_entry_and_exit','both_phases_and_neutral_return','declared_sequence_correct','four_contacts_stable','comfortable_range_and_breathing','no_added_action_or_support_collapse','no_warning_symptom'),
      'stopRules',jsonb_build_array('sharp_increasing_radiating_or_unfamiliar_pain','numbness_tingling_weakness_saddle_sensory_or_bowel_bladder_change','dizziness_faintness_nausea_visual_change_or_disorientation','recent_trauma_surgery_or_conflicting_restriction','hand_wrist_shoulder_knee_or_floor_transfer_intolerance','support_sequence_range_or_breathing_cannot_be_corrected','unsafe_floor_mat_space_traffic_sightline_communication_entry_or_exit','budget_or_duration_reached','task_identity_changes'),
      'persistence',jsonb_build_array('definition_and_variant','support_surface_and_optional_mat','planned_and_actual_complete_cycles','phase_and_sequence','range_breath_tempo_and_hold_annotations','valid_invalid_partial_assisted_and_symptom_limited_attempts','first_fault','symptoms_and_stop_reason','rest','duration','substitution','floor_exit')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_spinal_cycles','active_spinal_range_time','quadruped_support_time','wrist_shoulder_and_knee_exposure','loaded_spinal_flexion_extension','technical_control_and_symptoms'),
      'avoidAutomaticPairingWith',jsonb_build_array('conflicting_hand_wrist_shoulder_or_knee_support','loaded_spinal_flexion_extension_when_range_or_symptoms_conflict','fatiguing_trunk_or_floor_work','clinical_assessment_or_treatment','time_critical_output_when_this_drill_displaces_priority_work'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('1Y0YjXS9sKI','8kUU_odEY3o','T0MsxeAROUQ','d_k1g-SJR-4','bKYGb1TgS6o'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessVariantSupportCycleRangeBreathingCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,
    updated_at=now()
  WHERE id=25;

  UPDATE coaching.exercise SET
    skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,archived=TRUE,
    programming_logic=coalesce(programming_logic,'{}'::JSONB)||jsonb_build_object(
      'selectionStatus','duplicate_definition_consolidated_variant_preserved',
      'selectable',FALSE,'survivorDefinitionId',canonical_definition,
      'survivorLegacyExerciseId',25,'preservedVariantId',segmental_variant,
      'migration',migration_key,
      'identityReason','the same quadruped flexion-extension cycle belongs to one definition while mandatory segmental sequencing remains an exact survivor variant',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    linked_skill_id=NULL,why_publish_ready=FALSE,updated_at=now()
  WHERE id=889;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness is evaluated from safe floor entry and exit, exact quadruped support, hand wrist shoulder and knee tolerance, comfortable spinal flexion-extension, symptoms and restrictions, communication, cumulative exposure, and workout purpose; never from an exercise proficiency or age label.',
    readiness_checks=ARRAY[
      'Confirm the exact standard or segmental variant, clear stable floor, optional flat mat, safe entry and exit, and adequate front and side sightlines.',
      'Confirm no significant recent trauma, severe progressive radiating or unfamiliar pain, neurologic or bowel or bladder warning, dizziness, or conflicting clinical restriction.',
      'Confirm stable comfortable bilateral hand knee wrist and shoulder support plus understanding of both phases, one-cycle counting, range reduction, neutral return, and stop signal.',
      'Review same-session wrist shoulder knee quadruped support spinal-range loaded-flexion-extension fatigue duration and symptom exposure.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, radiating, or unfamiliar spinal or joint pain; participant stop request.',
      'Numbness, tingling, weakness, saddle sensory change, or bowel or bladder change.',
      'Dizziness, faintness, nausea, visual change, disorientation, or inability to communicate clearly.',
      'Hand, wrist, shoulder, knee, or floor-transfer symptoms prevent stable exact support.',
      'Support collapse, wrong sequence, forced range, breath holding, added action, or missed neutral return cannot be corrected safely.',
      'Floor, mat, space, traffic, sightline, hygiene, communication, duration, entry, or exit becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Recent significant trauma or surgery or current severe progressive radiating or unfamiliar spinal symptoms require evaluation under facility policy.',
      'New neurologic finding, saddle sensory change, bowel or bladder change, dizziness, faintness, nausea, visual disturbance, or disorientation.',
      'The exact quadruped support, floor transfer, or comfortable flexion-extension cycle cannot be maintained.',
      'The intended service is diagnosis, normal-range assessment, treatment, clearance, passive or manual care, loaded motion, or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Switch between standard-coordinated and ordered-segmental exact variants only after full sequence score dose duration and support revalidation.',
      'Use optional stable mat cushioning only when support contacts and identity remain exact.',
      'Select a separately authored neutral-wrist elevated-hand seated standing supine or clinician-directed task when floor or contact support changes.',
      'Select Quadruped Spinal Circles Thread-the-Needle a flow hover limb-lift loaded or manual task only when that distinct identity is intended and fully revalidated.'
    ]::TEXT[]
  WHERE exercise_id=25;

  UPDATE coaching.exercise_safety_profile SET
    minimum_age_recommended=NULL,minimum_skill_level=NULL,
    minimum_prerequisite_notes='Archived duplicate source. Use the Source-25 canonical survivor and exact ordered-segmental variant; readiness is a workout input, not an age or proficiency label.',
    common_substitutions=ARRAY['Use canonical Cat-Cow definition 29f1f054-8700-4233-9866-63810e69242e and exact ordered-segmental variant 8fb77631-0365-471f-a1ce-eb17320b6b99 after complete revalidation.']::TEXT[]
  WHERE exercise_id=889;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=34,absolute_load_demand=10,coordination_demand=36,
    impact=1,supervision_demand=20,
    base_overall_difficulty=greatest(34,10),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','ordered_segmental_variant_representative_highest_complexity_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object(
        'standardCoordinated',jsonb_build_object('complexity',24,'physicalDifficulty',10,'overall',24),
        'orderedSegmental',jsonb_build_object('complexity',34,'physicalDifficulty',10,'overall',34)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant proficiency. Exact sequence, support, symptoms, and independent calibration remain required.',updated_at=now()
  WHERE exercise_id=25;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=34,absolute_load_demand=10,coordination_demand=36,
    impact=1,supervision_demand=20,
    base_overall_difficulty=greatest(34,10),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','archived_duplicate_source_lineage_only',
      'survivorDefinitionId',canonical_definition,
      'preservedVariantId',segmental_variant,
      'exerciseScoresDescribeTaskOnly',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Archived duplicate lineage only. Use the canonical survivor ordered-segmental variant; no participant proficiency or publication status is implied.',updated_at=now()
  WHERE exercise_id=889;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=3.4,complexity=3,load=1.0,overall=3.4,
    recommended_age_min=NULL,recommended_age_max=NULL,
    attention_demand='moderate',
    notes='Candidate projection from the ordered-segmental exact variant, the highest-complexity current Cat-Cow variant. Canonical physical difficulty is 10/100. This is not participant proficiency or age classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=25;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=3.4,complexity=3,load=1.0,overall=3.4,
    recommended_age_min=NULL,recommended_age_max=NULL,
    attention_demand='moderate',
    notes='Archived duplicate source projection only. Use the Source-25 survivor ordered-segmental exact variant; this is not participant proficiency or age classification.',
    source='canonical_duplicate_archived',updated_at=now()
  WHERE exercise_id=889;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','quadruped_spinal_flexion_extension_full_cycle','legacySources',2,'duplicateDefinitionConsolidated',TRUE,'segmentalVariantPreserved',TRUE,'activeVariants',2,'archivedSourceSkeletons',2,'spinalCirclesRemainDistinct',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace'),'bodyRegions',to_jsonb(ARRAY['spine','thoracic_spine','neck','rib_cage','pelvis','core','scapula','shoulder','wrist','knee']::TEXT[]),'equipment',jsonb_build_array('none','mat_optional'),'mobilityAndFlexionExtensionRemainPurposeAndAnatomyNotInventedMovementKeys',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralitySupportAndCompensation',TRUE,'noIsolatedVertebraOrUniversalShapeClaim',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('24/10/24','34/10/34'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCyclesRangeSupportDurationAndDownstreamExposureTracked',TRUE,'scoreFloorOneForNoImpact',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'traumaSymptomsSupportFloorTransferSurfaceSpaceTrafficSightlineScopeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',4,'prepareAndRestoreOnly',TRUE,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteInstructionsAtMost240Characters',TRUE,'coachAthleteAccessibilityAndSupportOperations',TRUE,'cycleSequenceSupportSymptomsAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'sourceLimitationsExplicit',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantSupportAndCycleReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',5,'approved',0,'controlledDimensionsOnly',TRUE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'derivedOverallNotCalibrated',TRUE),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',20,'survivorOwnedIdentityDecisions',2,'clinicalScopeBoundaryExplicit',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeBudgets',TRUE,'duration',TRUE,'equipmentSurfaceAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact standard or segmental variant, support, phases, cycle counting, range, breathing, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every exact-variant, distinct-task progression, regression, and pairing proposal; no automatic support, circular, rotational, or floor-task substitution is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty for both exact variants. Scores do not classify a participant or create an age or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity, sequence, anatomy, support, range, dose, stop, scope, accessibility, and support rules remain quarantined.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status='review' AND card_version=2
        AND schema_version='2.0.0' AND approved_video_url IS NULL
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL
        AND movement_patterns=ARRAY['brace']::TEXT[]
        AND body_regions=ARRAY['spine','thoracic_spine','neck','rib_cage','pelvis','core','scapula','shoulder','wrist','knee']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB
        AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB
        AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=duplicate_definition AND status='archived'
        AND provenance_json->>'survivorDefinitionId'=canonical_definition::TEXT
        AND provenance_json->>'preservedVariantId'=segmental_variant::TEXT
        AND reviewed_by IS NULL AND approved_by IS NULL)
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id IN(source_variant,duplicate_variant) AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')<>2 THEN
    RAISE EXCEPTION '% definition or source quarantine assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=25 AND definition_id=canonical_definition
        AND source_kind='legacy_migration')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=889 AND definition_id=canonical_definition
        AND source_kind='duplicate_consolidation')
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=889 AND definition_id=duplicate_definition) THEN
    RAISE EXCEPTION '% source mapping or duplicate lineage assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition
        AND status='review' AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'physicalDifficulty')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'physicalDifficulty')::INTEGER)
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (load_profile_json->>'handImpactContactsPerRep')::INTEGER=0
        AND load_profile_json->>'impactClass'='none'
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true')<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=standard_variant
        AND (difficulty_json->>'technicalComplexity')::INTEGER=24
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=10
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=24)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=segmental_variant
        AND (difficulty_json->>'technicalComplexity')::INTEGER=34
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=10
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=34) THEN
    RAISE EXCEPTION '% active variant score or mechanics assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB
        AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=8)<>4
    OR (SELECT count(DISTINCT section_key)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND link_status='healthy' AND review_status='candidate'
        AND embedding_allowed AND captions_available IS NULL
        AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>20
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND review_status='review' AND reviewed_by IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND resolved_definition_id IN(duplicate_definition,spinal_circle_definition)
        AND reviewed_by IS NULL)<>2 THEN
    RAISE EXCEPTION '% authored row-count or quarantine assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND resolved_definition_id=duplicate_definition
        AND decision='duplicate_consolidated'
        AND resolution_source='deterministic_identity_equivalence'
        AND reviewed_by IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND resolved_definition_id=spinal_circle_definition
        AND decision='distinct_exercises'
        AND resolution_source='deterministic_identity_equivalence'
        AND reviewed_by IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=full_body_definition
        AND resolved_definition_id=canonical_definition
        AND decision='distinct_exercises') THEN
    RAISE EXCEPTION '% identity disposition assertion failed',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.movement_patterns) key
      WHERE d.id=canonical_definition
        AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.body_regions) key
      WHERE d.id=canonical_definition
        AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.required_equipment||d.optional_equipment) key
      WHERE d.id=canonical_definition
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 v
      CROSS JOIN LATERAL jsonb_array_elements_text(v.requirements_json->'equipment') key
      WHERE v.id=ANY(active_variant_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1 p
      CROSS JOIN LATERAL unnest(p.equipment_required) key
      WHERE p.variant_id=ANY(active_variant_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed
          WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      CROSS JOIN LATERAL unnest(relationship.dimensions) dimension
      WHERE relationship.conditions_json->>'migration'=migration_key
        AND dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']::TEXT[])) THEN
    RAISE EXCEPTION '% uncontrolled relationship dimension was authored',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=25
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=889
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=TRUE
      AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=25
      AND technical_complexity=34 AND absolute_load_demand=10
      AND base_overall_difficulty=34 AND impact=1
      AND human_review_status='queued' AND reviewed_by IS NULL
      AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile
      WHERE exercise_id=25 AND technical=3.4 AND complexity=3
        AND load=1.0 AND overall=3.4 AND recommended_age_min IS NULL
        AND recommended_age_max IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=25 AND minimum_age_recommended IS NULL
        AND minimum_skill_level IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id IN(canonical_definition,duplicate_definition)
        AND (approved_video_url IS NOT NULL OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status<>'candidate')
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND (review_status<>'candidate' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR exact_variant_match IS NOT NULL
          OR captions_available IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND (review_status<>'review' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND (status<>'review' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% approval quarantine assertion failed',migration_key;
  END IF;
END
$migration$;
