-- Close the two high-similarity pairs surfaced when Source 42 received its
-- exact Ankle CAR identity. Shared CAR terminology does not make cervical or
-- shoulder rotations the same exercise as an ankle-joint-complex circuit.
-- This migration creates no review, calibration, media, or publication approval.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '517_coaching_ankle_cars_similarity_identity_closure';
  prerequisite_filename CONSTANT TEXT := '516_coaching_ankle_cars_identity_and_family_audit_hardening.sql';
  ankle_definition UUID;
  neck_definition UUID;
  shoulder_definition UUID;
  ankle_variant UUID;
  full_body_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO ankle_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=42;
  SELECT id INTO neck_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=24;
  SELECT id INTO shoulder_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=37;
  SELECT id INTO ankle_variant FROM coaching.exercise_variant_v1 WHERE definition_id=ankle_definition AND variant_key='seated-thigh-supported-active-ankle-circuit';
  SELECT v.id INTO full_body_variant FROM coaching.exercise_definition_v1 d JOIN coaching.exercise_variant_v1 v ON v.definition_id=d.id WHERE d.facility_id=1 AND d.legacy_exercise_id=23 AND v.variant_key='standing-independent-eight-region-sequence';
  IF NOT EXISTS(SELECT 1 FROM schema_migrations
      WHERE filename=prerequisite_filename)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ankle_definition AND slug='ankle-cars' AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=neck_definition AND slug='neck-cars' AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=shoulder_definition AND slug='arm-circles' AND status='review') THEN
    RAISE EXCEPTION '% prerequisite migration or identity state is missing or drifted',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ankle_definition
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ankle_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ankle_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=ankle_definition
        AND resolved_definition_id IN(neck_definition,shoulder_definition)
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ankle_variant
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed card or identity records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_definition_v1 SET
    body_regions=ARRAY['foot','ankle','calf','knee','hip','core']::TEXT[],
    athlete_support_json=athlete_support_json||jsonb_build_object(
      'whyItMatters','Use a low-load active ankle circuit to practice controlling available foot-and-ankle motion before or after training when the exact seated setup fits.',
      'primaryCue','Keep the leg quiet and draw one slow smooth circle with the working foot.',
      'painGuidance','Use only comfortable active range. Stop for sharp, increasing, unfamiliar, pinching, catching, unstable, neurologic, circulatory, or systemic symptoms and tell the coach.',
      'selfChecks',athlete_support_json->'selfCheck',
      'accessibility',jsonb_build_array('smaller comfortable active range','slower pace','fewer circuits','more rest','front-quarter and side demonstration','written path diagram','captions transcript still images or live instruction'),
      'mediaAlternatives',jsonb_build_array('written ordered-path diagram','front-quarter still sequence','side-view still sequence','captioned transcript','live coach demonstration')),
    coach_support_json=coach_support_json||jsonb_build_object(
      'observationChecklist',coach_support_json->'observation',
      'faultCorrections',jsonb_build_array(
        jsonb_build_object('fault','target foot contacts floor','correction','reposition on the bench and restore clear foot space'),
        jsonb_build_object('fault','tibia knee pelvis or trunk creates the circle','correction','reduce active range and re-cue a quiet leg'),
        jsonb_build_object('fault','path skips a quadrant or misses the start','correction','slow down and use the ordered path cue or diagram'),
        jsonb_build_object('fault','toe gripping cramping or breath holding','correction','reduce effort and range increase rest or stop')),
      'demonstrationPlan',jsonb_build_array('show stable seated support and foot clearance','show the first ordered circuit from front-quarter and side','show the reverse circuit and separate count','show one invalid leg-compensation example','show the stop signal and safe transfer'),
      'groupManagement',jsonb_build_object('stationCapacity',1,'coachPositions',jsonb_build_array('front_quarter','side'),'crossTraffic','prohibited','sideChange','one participant at a time with clear foot space','equipmentReset','inspect and reset bench before the next participant'),
      'modificationDecisionTree',jsonb_build_array('reduce active range','slow the circuit','reduce circuit count','increase rest','add visual path diagram or live demonstration','stop the set','select a separately validated task after full revalidation'),
      'doNotUseWhen',jsonb_build_array('bench floor foot clearance transfer sightline or communication is unsafe','active ankle motion is restricted by current symptoms or applicable guidance','the intended task is passive resisted loaded weight-bearing clinical or sport-specific')),
    support_operations_json=support_operations_json||jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_wrong_variant','bench_floor_or_clearance','instruction_or_count','symptom_or_stop','accessibility_or_media','persistence_or_rendering','substitution_or_budget'),
      'supportEscalation',jsonb_build_array('stop and stabilize the seated position','assist safe transfer or exit within scope','follow facility clinical emergency and incident policy','record observed facts and selected variant','do not resume without reassessment'),
      'retentionPolicy',jsonb_build_object('retain',jsonb_build_array('definition_variant_profile_card_version','planned_and_actual_dose','first_fault','symptoms_and_stop_reason','substitution','duration'),'exclude',jsonb_build_array('diagnosis','clinical_range_interpretation','participant_skill_level'),'followFacilityPolicy',TRUE),
      'changeImpactPolicy','Any base, support, vision, assistance, resistance, load, weight-bearing, path, count, dose, symptom, equipment, environment, or downstream-demand change reruns identity, logistics, duration, fatigue, impact, substitution, persistence, and rendered-instruction checks.'),
    provenance_json=provenance_json||jsonb_build_object(
      'taxonomyAndSupportContractCorrection',migration_key,
      'directSimilarityClosures',2,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=ankle_definition;

  UPDATE coaching.exercise_relationship_v1 SET
    dimensions=ARRAY['complexity','range','stability']::TEXT[],
    reason='Moves from one seated ankle circuit to an ordered standing multi-region flow with different stability, range, duration, and logistics; use only after full reselection.',
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE from_variant_id=ankle_variant
    AND to_variant_id=full_body_variant
    AND relationship='progression';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,ankle_definition,i.definition_id,'distinct_exercises',i.rationale,
    jsonb_build_object(
      'migration',migration_key,'identityBoundary',i.boundary_key,
      'ankleContract','seated target thigh supported target foot clear active ankle-joint-complex dorsiflexion inversion plantarflexion eversion circuit each direction counted separately',
      'neighborContract',i.neighbor_contract,
      'sharedTermOnly','controlled articular rotation',
      'anatomicalRegionChangesIdentity',TRUE,
      'automaticSubstitution',FALSE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (neck_definition,'ankle_circuit_vs_cervical_circuit','Neck CARs move the cervical region through a controlled head-and-neck circuit while the torso remains organized; Ankle CARs move the foot and ankle joint complex while the tibia, knee, pelvis, and trunk remain quiet. The anatomical region, joints, support, actions, risks, instructions, and stop rules are different.','tall_or_supported_cervical_flexion_lateral_flexion_extension_and_rotation_circuit'),
    (shoulder_definition,'ankle_circuit_vs_glenohumeral_circuit','Standing Single-Arm Shoulder CAR moves one upper limb through a full shoulder-elevation and rotation path in standing; Ankle CARs use seated thigh support and a free foot-and-ankle circuit. The anatomical region, base, path, loading, instructions, and stop rules are different.','standing_single_arm_shoulder_elevation_and_rotation_circuit')
  ) i(definition_id,boundary_key,rationale,neighbor_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=ankle_definition
        AND resolved_definition_id IN(neck_definition,shoulder_definition)
        AND decision='distinct_exercises'
        AND resolution_source='deterministic_identity_equivalence'
        AND reviewed_by IS NULL)<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ankle_definition
        AND body_regions=ARRAY['foot','ankle','calf','knee','hip','core']::TEXT[]
        AND athlete_support_json ?& ARRAY['whyItMatters','primaryCue','expectedSensations','unexpectedSensations','painGuidance','selfChecks','accessibility','mediaAlternatives']::TEXT[]
        AND coach_support_json ?& ARRAY['observationChecklist','faultCorrections','demonstrationPlan','groupManagement','modificationDecisionTree','doNotUseWhen']::TEXT[]
        AND support_operations_json ?& ARRAY['issueCategories','supportEscalation','retentionPolicy','changeImpactPolicy']::TEXT[]
        AND provenance_json->>'directSimilarityClosures'='2'
        AND reviewed_by IS NULL AND approved_by IS NULL AND last_reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ankle_variant
        AND to_variant_id=full_body_variant
        AND relationship='progression'
        AND dimensions=ARRAY['complexity','range','stability']::TEXT[]
        AND review_status='review' AND reviewed_by IS NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=ankle_definition
        AND resolved_definition_id IN(neck_definition,shoulder_definition)
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')) THEN
    RAISE EXCEPTION '% taxonomy support relationship identity or quarantine assertion failed',migration_key;
  END IF;
END
$migration$;
