-- Replace the ambiguous Bar Cast baseline with exact front-support cast-and-
-- return specifications, and author Cast to Handstand as a separate terminal-
-- handstand identity. Technique, assistance, amplitude, rail, media, graph,
-- calibration, content, and publication decisions remain review-only.
-- Exercise difficulty describes complexity and physical difficulty only; it
-- never classifies athlete proficiency or copies a skill-library level.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '482_coaching_bar_cast_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.85';
  cast_definition UUID;
  handstand_definition UUID := gen_random_uuid();
  source_variant UUID;
  cast_below_variant UUID := gen_random_uuid();
  cast_horizontal_variant UUID := gen_random_uuid();
  cast_above_variant UUID := gen_random_uuid();
  assisted_straddle_handstand_variant UUID := gen_random_uuid();
  assisted_straight_handstand_variant UUID := gen_random_uuid();
  independent_straddle_handstand_variant UUID := gen_random_uuid();
  independent_straight_handstand_variant UUID := gen_random_uuid();
  affected_definition_ids UUID[];
  cast_variant_ids UUID[];
  handstand_variant_ids UUID[];
  active_variant_ids UUID[];
  front_support_definition UUID;
  freestanding_handstand_definition UUID;
  wall_handstand_definition UUID;
  handstand_kickup_definition UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO cast_definition
  FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=17;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=cast_definition AND variant_key='baseline';
  SELECT id INTO front_support_definition FROM coaching.exercise_definition_v1
  WHERE slug='front-support-shape-hold' AND status<>'archived';
  SELECT id INTO freestanding_handstand_definition FROM coaching.exercise_definition_v1
  WHERE slug='handstand-hold' AND status<>'archived';
  SELECT id INTO wall_handstand_definition FROM coaching.exercise_definition_v1
  WHERE slug='wall-handstand-hold' AND status<>'archived';
  SELECT id INTO handstand_kickup_definition FROM coaching.exercise_definition_v1
  WHERE slug='handstand-kick-up-wall' AND status<>'archived';
  affected_definition_ids := ARRAY[cast_definition,handstand_definition];
  cast_variant_ids := ARRAY[
    cast_below_variant,cast_horizontal_variant,cast_above_variant];
  handstand_variant_ids := ARRAY[
    assisted_straddle_handstand_variant,assisted_straight_handstand_variant,
    independent_straddle_handstand_variant,independent_straight_handstand_variant];
  active_variant_ids := cast_variant_ids||handstand_variant_ids;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=cast_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=17 AND definition_id=cast_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=cast_definition)
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id IN(front_support_definition,freestanding_handstand_definition,
          wall_handstand_definition,handstand_kickup_definition)
          AND status<>'archived')<>4 THEN
    RAISE EXCEPTION '% prerequisite Bar Cast lineage or identity neighbors drifted',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='bar-cast-to-handstand' AND id<>handstand_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=handstand_definition AND (facility_id<>1 OR slug<>'bar-cast-to-handstand'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids)
        AND definition_id<>CASE WHEN id=ANY(cast_variant_ids)
          THEN cast_definition ELSE handstand_definition END)
    OR EXISTS(SELECT 1 FROM coaching.equipment
      WHERE key='gymnastics_single_rail'
        AND name<>'Gymnastics Single Rail / Low Bar') THEN
    RAISE EXCEPTION '% working identities, variant UUIDs, slug, or equipment taxonomy are already owned',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
        AND status IN('published','deprecated')
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
          OR to_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[]))
        AND (reviewed_by IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
        AND (reviewed_by IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=17
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',migration_key,protected_count;
  END IF;

  INSERT INTO coaching.equipment(key,name,sort_order)
  VALUES('gymnastics_single_rail','Gymnastics Single Rail / Low Bar',260)
  ON CONFLICT(key) DO NOTHING;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
      OR to_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[]))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 source SET
    provenance_json=(coalesce(source.provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','identity_quarantine',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','legacy Support-position strength on bar does not fix front-support start peak amplitude return hand contact rail height assistance or whether the endpoint is support horizontal or handstand',
        'exactWorkingSpecificationRequired',TRUE,
        'skillLibraryBoundary','competition element levels and athlete progression classifications remain in dedicated skill-library cards and are not exercise difficulty',
        'researchSources',jsonb_build_array(
          'https://www.gymnastics.sport/publicdir/rules/files/en_1.1.%20WAG%20Code%20of%20Points%202025-2028.pdf',
          'https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf',
          'https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email'),
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=17;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-17',
    display_name='Bar Cast Identity Quarantine — Source 17',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',17,
      'archiveReason','source_omits_start_peak_return_rail_assistance_and_terminal_state',
      'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=source_variant;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES
  (cast_definition,1,17,'bar-cast','Front-Support Bar Cast and Return',
    'Bar Cast',ARRAY['Bar Casts','Front-Support Cast','Front Support Cast','Basic Bar Cast'],
    'From an exact overgrip front support on a declared gymnastics single rail, shift and press so the hips separate from the bar and the straight or declared body line travels backward-upward to a declared peak angle, then reverse under control to the same front support without circling, releasing, contacting the floor, or finishing in handstand.',
    'front_support_bar_cast_peak_and_return','2.0.0',2,'review',82,62,44,
    ARRAY['push','brace']::TEXT[],
    ARRAY['full_body','shoulder','scapula','elbow','wrist','hand','core','spine','hip']::TEXT[],
    ARRAY['gymnastics_single_rail','mat']::TEXT[],
    ARRAY['panel_mat','grip_tool']::TEXT[],
    jsonb_build_object(
      'apparatus','inspected locked gymnastics single rail with declared diameter height and overgrip surface',
      'surface','continuous secured gymnastics matting through the entire body fall mount and dismount zone',
      'clearance','no athlete equipment wall low rail upright or traffic may enter the cast or fall envelope',
      'stationCapacity',1,'coachSightline','side or front-quarter view of grip shoulders hips legs peak angle return and exit',
      'inspection',jsonb_build_array('rail locks uprights cables anchors and mat seams','hand surface chalk and optional grips','mount aid and panel mat if used','fall zone and emergency access'),
      'changeRule','Rail height diameter grip assistance mount body shape peak target repetitions rest and return must be selected recorded and revalidated.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyAthletes',TRUE,'readinessIsWorkoutInput',TRUE,
      'readinessFacts',jsonb_build_array('exact front support mount and controlled dismount are available','secure declared overgrip is maintained','straight-arm support and the selected cast-return path are symptom free','athlete understands the peak marker stop signal and no-circle rule','qualified coach can see the complete attempt'),
      'excludeOrReferPerFacilityPolicy',jsonb_build_array('pain numbness tingling weakness dizziness faintness unusual exertional symptoms or grip uncertainty','current restriction requiring clinical or organizational clearance that has not been satisfied','unlocked rail unsafe matting obstructed fall zone no qualified supervision or no controlled exit'),
      'noUniversalEligibilityAgeOrReadinessThresholdClaimed',TRUE),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email',
      'legacySources',jsonb_build_array(17),
      'identityContract','front_support_press_and_backward_upward_cast_to_declared_peak_then_controlled_return_to_same_front_support',
      'skillLibraryBoundary','competition program levels and mastery classifications belong only to skill-library cards',
      'researchSources',jsonb_build_array(
        'https://www.gymnastics.sport/publicdir/rules/files/en_1.1.%20WAG%20Code%20of%20Points%202025-2028.pdf',
        'https://static.usagym.org/PDFs/Women/Rules/dpcop/revisedpages_080425_mini.pdf',
        'https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf',
        'https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12088353/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC9955164/',
        'https://pubmed.ncbi.nlm.nih.gov/18930233/'),
      'confidenceBySection',jsonb_build_object('identity',88,'taxonomy',86,'anatomy',72,'difficulty',62,'load',60,'fatigueRecovery',52,'constraints',78,'dosage',50,'instructions',78,'alternates',86,'media',44),
      'unresolvedClaims',jsonb_build_array('one universal ideal cast technique or shoulder hip timing','individual bar and tissue loads','universal readiness dose weekly exposure or recovery interval','numeric difficulty calibration','media exactness captions accessibility safety and cue quality'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('shoulder flexors and extensors acting by phase','scapular upward rotators and stabilizers','triceps brachii','abdominal wall','hip extensors'),
      'secondaryMuscles',jsonb_build_array('latissimus dorsi','pectoralis major','rotator cuff','forearm and hand musculature','spinal extensors','hip adductors'),
      'stabilizers',jsonb_build_array('serratus anterior','trapezius','rotator cuff','elbow and wrist stabilizers','obliques','deep trunk stabilizers','gluteal and leg musculature'),
      'joints',jsonb_build_array('fingers and hands','wrists','radioulnar joints','elbows','glenohumeral joints','scapulothoracic articulations','spine','pelvis','hips','knees','ankles'),
      'jointActions',jsonb_build_array('continuous grip with wrist and forearm rotation around the rail','isometric elbow extension','scapular protraction elevation and upward rotation by phase','shoulder angle opening toward overhead support','trunk and pelvis anti-extension or declared hollow-shape control','hip extension after the forward support shift','controlled reversal of shoulder hip and whole-body rotation to front support'),
      'planes',jsonb_build_array('sagittal primary','frontal stabilization','transverse stabilization'),
      'laterality','bilateral symmetrical hand support unless a later exact variant declares otherwise',
      'evidenceBoundary','Muscle roles and load shares vary with rail geometry grip assistance body shape peak angle anthropometry and technique; no source quantifies this card for every athlete.'),
    jsonb_build_object(
      'purpose','Practice an exact front-support cast-and-return action with a selected peak angle and low-fatigue quality target.',
      'before',jsonb_build_array('Confirm rail grip mount front support peak target repetitions rest return and dismount.','Inspect the rail matting clearance optional grips and mount aid.','Report symptoms fear grip uncertainty or a missing controlled exit before starting.'),
      'during',jsonb_build_array('Keep the declared grip and straight-arm support.','Shift and press to the exact peak marker without circling or releasing.','Return to the same front support under control and breathe.'),
      'expectedSensations',jsonb_build_array('hand and forearm grip effort','shoulder and upper-back support effort','trunk and hip tension','brief effort and heart-rate increase'),
      'unexpectedSensations',jsonb_build_array('pain pinch numbness tingling weakness dizziness or unusual breathlessness','grip slip rail movement mat shift collision or uncontrolled fall','bent-arm collapse unplanned circle foot contact or lost return'),
      'selfChecks',jsonb_build_array('same grip and rail','hips clearly leave the rail','declared peak reached without changing identity','same controlled front-support return'),
      'mediaFallback','Use this written repetition contract and a qualified live demonstration until exact current-card media is approved.'),
    jsonb_build_object(
      'preflight',jsonb_build_array('Confirm definition variant peak angle body shape grip rail height mount return dismount dose rest and stop signal.','Inspect apparatus locks anchors rail surface grips mat seams clearance and emergency access.','Confirm recent hand wrist elbow shoulder trunk and grip exposure plus symptom report.'),
      'observationOrder',jsonb_build_array('station and mount','grip and wrists','front support','shoulder shift and press','hip separation and body line','peak angle','controlled reversal','front-support return and dismount'),
      'qualityGate','Count only attempts that preserve the exact rail grip support body-shape peak and return contract without release circle floor contact collision or uncontrolled exit.',
      'stopAndRegress',jsonb_build_array('stop immediately for symptoms fear grip or apparatus uncertainty or fall-zone intrusion','stop on elbow collapse unplanned contact circle release peak loss return loss or two consecutive quality faults','reduce the peak target repetitions or density only through a reviewed variant and revalidate'),
      'groupManagement','One moving athlete per rail; coach controls entry; the next athlete waits outside the complete fall zone.',
      'record',jsonb_build_array('definition variant profile and card version','rail height grip mount body shape peak target and assistance','planned completed invalid assisted and partial attempts','first fault symptoms actual duration rest substitution and incident'),
      'evidenceLimit','The authored difficulty and dose are quarantined planning proposals, not universal prescriptions or athlete classifications.'),
    jsonb_build_object(
      'memberQuestions',jsonb_build_array('Which peak angle and body shape am I using?','What makes the attempt valid?','How do I mount return and exit?','What should I report immediately?'),
      'supportEscalation',jsonb_build_array('symptom or medical question','apparatus mat grip or clearance concern','identity variant peak or assistance mismatch','media or accessibility concern','unresolved substitution or incident'),
      'accessibilityOptions',jsonb_build_array('plain-language written sequence','side-view still markers','qualified live demonstration','reviewed lower-amplitude or assisted exact variant','extra transition time and reduced station density'),
      'neverDo',jsonb_build_array('infer readiness from exercise difficulty','invent a safe age dose or recovery interval','allow an unreviewed hands-on spot','treat oEmbed metadata as playback or approval'),
      'persistenceRequired',TRUE,'coachAndAthleteRenderingRequired',TRUE)),
  (handstand_definition,1,NULL,'bar-cast-to-handstand','Bar Cast to Handstand',
    'Cast to Handstand',ARRAY['Cast Handstand','Cast-to-Handstand','Straight-Body Cast to Handstand','Straddle Cast to Handstand'],
    'From an exact overgrip front support on a declared gymnastics single rail, shift and press the body backward-upward using a declared straight-body or bent-hip straddle technique until a controlled bar-supported vertical handstand is achieved; the attempt ends at the declared handstand standard before an independently planned exit or next element.',
    'front_support_bar_cast_to_terminal_handstand','2.0.0',1,'review',84,60,42,
    ARRAY['push','brace','invert']::TEXT[],
    ARRAY['full_body','shoulder','scapula','elbow','wrist','hand','core','spine','pelvis','hip']::TEXT[],
    ARRAY['gymnastics_single_rail','mat','panel_mat']::TEXT[],
    ARRAY['grip_tool']::TEXT[],
    jsonb_build_object(
      'apparatus','inspected locked gymnastics single rail with declared height diameter overgrip surface and complete vertical clearance',
      'surface','secured gymnastics landing matting and declared spotting block through the complete cast handstand fall and exit envelope',
      'clearance','full vertical side forward backward and over-bar fall space with no cross traffic or adjacent apparatus conflict',
      'stationCapacity',1,'coachSightline','side view of support shift body technique shoulder and hip path vertical arrival assistance and exit',
      'qualifiedSpotter','A qualified gymnastics coach controls whether physical assistance is planned and follows facility-approved technique; untrained spotting is prohibited.',
      'changeRule','Technique assistance rail height grip mount handstand tolerance exit or continuation dose and rest changes require complete revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyAthletes',TRUE,'readinessIsWorkoutInput',TRUE,
      'readinessFacts',jsonb_build_array('exact front support mount and planned exit are controlled','secure declared overgrip and straight-arm support are maintained','selected assisted or independent straight or straddle path is symptom free','athlete understands the handstand arrival tolerance stop signal and fall plan','qualified coach can supervise the complete attempt'),
      'excludeOrReferPerFacilityPolicy',jsonb_build_array('pain numbness tingling weakness dizziness faintness unusual exertional symptoms fear or grip uncertainty','current restriction requiring clinical or organizational clearance that has not been satisfied','unlocked apparatus missing mats blocked fall zone insufficient vertical clearance no qualified supervision or no planned exit'),
      'noUniversalEligibilityAgeOrReadinessThresholdClaimed',TRUE),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.%20WAG%20Code%20of%20Points%202025-2028.pdf',
      'identityContract','front_support_cast_with_declared_technique_to_terminal_bar_supported_vertical_handstand',
      'createdBecauseIdentityChangedFromBasicCastReturn',TRUE,
      'skillLibraryBoundary','competition element value mastery and program levels remain dedicated skill-library content',
      'researchSources',jsonb_build_array(
        'https://www.gymnastics.sport/publicdir/rules/files/en_1.1.%20WAG%20Code%20of%20Points%202025-2028.pdf',
        'https://static.usagym.org/PDFs/Women/Rules/dpcop/revisedpages_080425_mini.pdf',
        'https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12088353/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC9955164/',
        'https://pubmed.ncbi.nlm.nih.gov/18930233/'),
      'confidenceBySection',jsonb_build_object('identity',92,'taxonomy',90,'anatomy',74,'difficulty',60,'load',58,'fatigueRecovery',50,'constraints',80,'dosage',48,'instructions',82,'alternates',88,'media',42),
      'unresolvedClaims',jsonb_build_array('one universal optimal straight or straddle technique','exact assistance and individual bar or tissue load','universal readiness dose weekly exposure or recovery interval','numeric difficulty calibration','media exactness captions accessibility safety and cue quality'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('shoulder flexors and extensors acting by phase','scapular upward rotators and stabilizers','triceps brachii','abdominal wall','hip extensors'),
      'secondaryMuscles',jsonb_build_array('latissimus dorsi','pectoralis major','rotator cuff','forearm and hand musculature','spinal extensors','hip abductors and adductors for straddle technique'),
      'stabilizers',jsonb_build_array('serratus anterior','trapezius','rotator cuff','elbow and wrist stabilizers','obliques','deep trunk stabilizers','gluteal and leg musculature'),
      'joints',jsonb_build_array('fingers and hands','wrists','radioulnar joints','elbows','glenohumeral joints','scapulothoracic articulations','spine','pelvis','hips','knees','ankles'),
      'jointActions',jsonb_build_array('continuous grip with wrist and forearm rotation around the rail','isometric elbow extension','scapular protraction elevation and upward rotation','shoulder angle opening to overhead vertical support','trunk and pelvis hollow-line or declared shape control','hip extension in straight technique or flexion abduction then adduction and extension in straddle technique','whole-body angular control to the handstand arrival'),
      'planes',jsonb_build_array('sagittal primary','frontal for straddle and stabilization','transverse stabilization'),
      'laterality','bilateral symmetrical hand support with symmetrical straight or straddle leg technique',
      'evidenceBoundary','Official technique descriptions do not quantify individual muscle contribution joint load or optimal timing across rail geometry assistance anthropometry and training history.'),
    jsonb_build_object(
      'purpose','Practice a precisely selected front-support cast to a controlled bar handstand using declared technique and assistance.',
      'before',jsonb_build_array('Confirm rail grip mount technique assistance handstand tolerance exit attempts rest and stop signal.','Inspect rail locks mats block clearance optional grips and emergency access.','Report symptoms fear grip uncertainty or inability to use the exact exit.'),
      'during',jsonb_build_array('Keep the declared grip and straight arms.','Shift press and follow the selected straight or straddle path.','Reach the declared vertical line; do not improvise a turn circle release or exit.'),
      'expectedSensations',jsonb_build_array('strong hand and forearm grip effort','shoulder upper-back and straight-arm support effort','trunk hip and leg tension','brief high concentration and exertion'),
      'unexpectedSensations',jsonb_build_array('pain pinch numbness tingling weakness dizziness or unusual breathlessness','grip slip apparatus movement mat shift collision or uncontrolled fall','elbow collapse unplanned contact twist release or missed exit'),
      'selfChecks',jsonb_build_array('same grip rail technique and assistance','hips and shoulders travel through the declared path','vertical tolerance reached without an added action','planned exit or continuation remains available'),
      'mediaFallback','Use this written contract and a qualified live demonstration until an exact current-card video is approved.'),
    jsonb_build_object(
      'preflight',jsonb_build_array('Confirm definition variant technique assistance rail height grip mount vertical tolerance exit attempt count rest and stop signal.','Inspect rail locks anchors surface grips mats block fall envelope overhead clearance and emergency access.','Confirm recent upper-extremity trunk inversion and grip exposure plus symptom and fear report.'),
      'observationOrder',jsonb_build_array('station and mount','grip wrists and elbows','front-support shift','shoulder and hip path','straight or straddle technique','vertical arrival','assistance','exit or continuation'),
      'qualityGate','Count only attempts preserving the exact rail grip support technique assistance vertical tolerance and terminal handstand without an added circle turn release contact or improvised exit.',
      'stopAndRegress',jsonb_build_array('stop for symptoms fear grip apparatus mat clearance or exit uncertainty','stop on elbow collapse unplanned contact twist release assistance change missed vertical tolerance or uncontrolled fall','select a reviewed assisted or lower-amplitude definition and revalidate every constraint'),
      'groupManagement','One moving athlete and one responsible qualified coach at the rail; every other athlete remains outside the full fall and spotting zone.',
      'record',jsonb_build_array('definition variant profile and card version','rail grip mount technique assistance and vertical tolerance','planned completed invalid assisted partial and fall attempts','first fault symptoms duration rest exit substitution and incident'),
      'evidenceLimit','Difficulty and dose are review proposals, not athlete-level classifications or universal prescriptions.'),
    jsonb_build_object(
      'memberQuestions',jsonb_build_array('Which technique and assistance are assigned?','What vertical tolerance counts?','What is my exact exit?','When must I stop and report?'),
      'supportEscalation',jsonb_build_array('symptom fear or medical question','apparatus mat grip block clearance or spotting concern','identity technique assistance or exit mismatch','media or accessibility need','unresolved substitution or incident'),
      'accessibilityOptions',jsonb_build_array('plain-language sequence','side-view position markers','qualified live demonstration','reviewed assisted exact variant','reviewed basic cast definition when the terminal handstand objective can change'),
      'neverDo',jsonb_build_array('infer readiness from exercise difficulty','invent a safe age dose or recovery interval','use an untrained spotter or improvised exit','treat oEmbed metadata as playback approval'),
      'persistenceRequired',TRUE,'coachAndAthleteRenderingRequired',TRUE))
  ON CONFLICT(id) DO UPDATE SET
    legacy_exercise_id=EXCLUDED.legacy_exercise_id,slug=EXCLUDED.slug,
    canonical_name=EXCLUDED.canonical_name,display_name=EXCLUDED.display_name,
    aliases=EXCLUDED.aliases,description=EXCLUDED.description,
    family_key=EXCLUDED.family_key,schema_version=EXCLUDED.schema_version,
    card_version=EXCLUDED.card_version,status='review',
    content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,
    media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,optional_equipment=EXCLUDED.optional_equipment,
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
  SELECT v.id,v.definition_id,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,'absoluteLoadDemand',v.physical,
      'physicalDifficulty',v.physical,'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'coordinationDemand',v.complexity,'impact',1,
      'supervisionDemand',v.supervision,'failureConsequence',v.failure,
      'workCapacityDemand',v.work_capacity,
      'complexityDimensions',jsonb_build_object('supportAndGrip',v.complexity-6,'wholeBodyTiming',v.complexity,'spatialOrientation',v.complexity-2,'peakOrTerminalPrecision',v.complexity,'errorDetection',v.complexity-4),
      'physicalDimensions',jsonb_build_object('relativeSupportStrength',v.physical,'gripDemand',v.grip,'rangeAndLeverage',v.physical-2,'balanceAndBracing',v.physical-4),
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'overallFormula','max_exercise_complexity_physical_difficulty',
      'scoreState','review_proposal_requires_calibration','athleteReadinessDerivedElsewhere',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'apparatus','gymnastics_single_rail','grip','closed_overgrip',
      'railHeight','declared_and_persisted','mount','declared_controlled_front_support',
      'bodyShape',v.body_shape,'peakOrTerminalStandard',v.terminal_standard,
      'assistance',v.assistance,'repetitionContract',CASE
        WHEN v.definition_id=cast_definition THEN 'front_support_to_declared_peak_and_controlled_return_to_same_front_support'
        ELSE 'front_support_to_declared_bar_handstand_terminal_standard_before_separate_exit' END,
      'invalidatingEvents',CASE WHEN v.definition_id=cast_definition
        THEN jsonb_build_array('grip_change_or_release','elbow_collapse','hips_do_not_clear_rail','unplanned_circle','floor_or_apparatus_contact','peak_target_missed','uncontrolled_front_support_return')
        ELSE jsonb_build_array('grip_change_or_release','elbow_collapse','unplanned_circle_or_turn','external_contact_outside_declared_assistance','vertical_tolerance_missed','uncontrolled_fall_or_exit') END,
      'fallZoneRequired',TRUE,'qualifiedCoachSupervisionRequired',TRUE,
      'publicationQuarantined',TRUE),
    'review',
    jsonb_build_object(
      'externalLoadMethod','bodyweight','effectiveLoadDrivers',jsonb_build_array('body_mass','rail_height_and_diameter','front_support_geometry','shoulder_and_hip_path','peak_angle_or_vertical_terminal','body_shape','assistance','angular_velocity'),
      'supportDistribution','dynamic bilateral hand support with initial or terminal hip-to-rail contact according to the exact definition; no universal hand force fraction is claimed',
      'gripDemand',v.grip,'spinalLoading',v.spinal,'eccentricStress',v.eccentric,
      'landingContactsPerRep',0,'plannedImpactContacts',0,
      'inversionExposure',CASE WHEN v.definition_id=handstand_definition THEN 'terminal_inverted_bar_support' ELSE 'none_to_partial_by_peak_angle' END,
      'jointStressNotes',jsonb_build_array('repetitive hand wrist elbow and shoulder weight-bearing','grip and rail friction','fall and unplanned-contact consequence'),
      'loadPrecisionLimit','Individual forces and tissue loads are not measured by the cited sources and must not be inferred from the scores.'),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip_fatigue,
      'technicalFatigueSensitivity',v.technical_fatigue,'impactAccumulation',1,
      'recoveryHours',v.recovery_hours,
      'recoveryEstimateType','conservative planning estimate requiring individual and session-context review',
      'earlyFatigueSignals',jsonb_build_array('grip readjustment','elbow softness','shoulder shift timing drift','body-shape change','reduced peak or vertical tolerance','unplanned rail contact','return or exit uncertainty'),
      'sameSessionBudgets',jsonb_build_array('bar support attempts','hand wrist elbow and shoulder support exposure','grip-intensive work','inversion attempts','falls assisted and invalid attempts','technical failure count'),
      'interference',jsonb_build_array('prior pulling hanging gripping handstand tumbling or upper-extremity support fatigue','subsequent bar circles releases swings handstands or high-consequence work')),
    jsonb_build_object(
      'trainingStimuli',CASE WHEN v.definition_id=cast_definition
        THEN jsonb_build_array('front_support_cast_timing','straight_arm_bar_support','declared_peak_control','controlled_return')
        ELSE jsonb_build_array('front_support_cast_timing','straight_arm_bar_support','vertical_handstand_arrival','declared_technique_and_assistance') END,
      'stimulusDose',jsonb_build_object('unit','quality_attempt','plannedRange','profile_specific','failedAssistedAndPartialAttemptsCountTowardExposure',TRUE),
      'weeklyExposure',jsonb_build_object('rule','aggregate with all bar support grip inversion and fall exposures','universalLimitEstablished',FALSE),
      'prerequisites',jsonb_build_array('exact apparatus and mats','secure overgrip and front support','controlled mount and planned exit','qualified supervision','symptom and fear report','understood stop signal'),
      'completionCriteria',CASE WHEN v.definition_id=cast_definition
        THEN jsonb_build_array('hips_clear_rail','declared_peak_met','same_front_support_returned_under_control')
        ELSE jsonb_build_array('declared_technique_retained','vertical_tolerance_met','terminal_handstand_controlled','planned_exit_available') END,
      'sequenceRules',jsonb_build_array('low_fatigue_technical_work_before_grip_or_support_fatigue','one_moving_athlete_per_station','stop_before_repeated_quality_loss','exit_is_not_an_unplanned_extra_element'),
      'pairingCompatibility',jsonb_build_object('preferred','low-fatigue preparation or unrelated lower-body task after full station clearance','avoid','dense grip pulling hanging inversion pressing or bar-skill circuit'),
      'interferenceRules',jsonb_build_array('reduce or omit after material hand wrist elbow shoulder grip or inversion load','revalidate after any variant assistance rail grip peak terminal exit dose or rest change'),
      'uncertaintyPolicy',jsonb_build_object('unknownIdentityOrConstraint','do_not_select','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'persistence',jsonb_build_array('definition_variant_profile_card_version','rail_grip_mount_body_shape_peak_or_terminal','assistance_and_exit','planned_completed_invalid_assisted_partial_and_fall_attempts','first_fault_symptoms_duration_rest_and_substitution'))
  FROM (VALUES
    (cast_below_variant,cast_definition,'front-support-cast-below-horizontal-return','Bar Cast — Below Horizontal and Return',ARRAY['below_horizontal','front_support_return','bilateral_overgrip']::TEXT[],56,54,72,60,42,48,34,38,50,50,72,18,'straight_or_declared','below_horizontal_declared_angle','none'),
    (cast_horizontal_variant,cast_definition,'front-support-cast-to-horizontal-return','Bar Cast — To Horizontal and Return',ARRAY['horizontal','front_support_return','bilateral_overgrip']::TEXT[],64,62,78,66,48,55,38,44,58,58,80,24,'straight_or_declared','body_line_horizontal_with_bar_reference','none'),
    (cast_above_variant,cast_definition,'front-support-cast-above-horizontal-return','Bar Cast — Above Horizontal and Return',ARRAY['above_horizontal','front_support_return','bilateral_overgrip']::TEXT[],72,70,84,74,52,62,44,52,66,66,88,30,'straight_or_declared','declared_angle_above_horizontal_below_handstand','none'),
    (assisted_straddle_handstand_variant,handstand_definition,'assisted-straddle-cast-to-handstand','Cast to Handstand — Qualified-Assisted Straddle',ARRAY['straddle_pike','qualified_physical_assistance','terminal_handstand']::TEXT[],82,74,94,82,52,66,50,56,66,68,92,32,'bent_hip_straddle_then_close','declared_vertical_tolerance','qualified_coach_physical_assistance'),
    (assisted_straight_handstand_variant,handstand_definition,'assisted-straight-body-cast-to-handstand','Cast to Handstand — Qualified-Assisted Straight Body',ARRAY['straight_body','qualified_physical_assistance','terminal_handstand']::TEXT[],86,80,95,84,56,70,52,60,70,72,94,36,'straight_or_hollow_body','declared_vertical_tolerance','qualified_coach_physical_assistance'),
    (independent_straddle_handstand_variant,handstand_definition,'independent-straddle-cast-to-handstand','Cast to Handstand — Independent Straddle',ARRAY['straddle_pike','no_physical_assistance','terminal_handstand']::TEXT[],86,82,92,86,58,72,52,60,72,74,94,38,'bent_hip_straddle_then_close','declared_vertical_tolerance','qualified_coach_present_no_planned_physical_assistance'),
    (independent_straight_handstand_variant,handstand_definition,'independent-straight-body-cast-to-handstand','Cast to Handstand — Independent Straight Body',ARRAY['straight_body','no_physical_assistance','terminal_handstand']::TEXT[],90,88,94,88,62,76,56,64,76,78,96,42,'straight_or_hollow_body','declared_vertical_tolerance','qualified_coach_present_no_planned_physical_assistance')
  ) v(id,definition_id,variant_key,display_name,modifiers,complexity,physical,
      supervision,failure,work_capacity,grip,spinal,eccentric,local_fatigue,
      grip_fatigue,technical_fatigue,recovery_hours,body_shape,
      terminal_standard,assistance)
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,requirements_json=EXCLUDED.requirements_json,
    status='review',load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT v.id,p.profile_key,p.phase_key,p.role,
    CASE
      WHEN v.definition_id=cast_definition AND p.phase_key='prepare_and_access'
        THEN 'Rehearse the exact rail, grip, front support, body line, peak marker, return, dismount, and stop signal at low exposure.'
      WHEN v.definition_id=cast_definition
        THEN 'Practice repeatable front-support casts to the exact peak and controlled return while technical quality is fresh.'
      WHEN p.phase_key='prepare_and_access'
        THEN 'Rehearse the exact rail, grip, front support, technique, assistance, vertical tolerance, exit, and stop signal at low exposure.'
      ELSE 'Practice the selected cast-to-handstand technique and assistance with full rest and exact terminal control.' END,
    CASE WHEN p.phase_key='prepare_and_access' THEN 82 ELSE
      CASE WHEN v.definition_id=cast_definition THEN 94 ELSE 90 END END,
    CASE WHEN p.phase_key='prepare_and_access' THEN 88 ELSE 94 END,
    jsonb_build_object(
      'objective',CASE WHEN v.definition_id=cast_definition THEN 'front_support_cast_peak_and_return_quality' ELSE 'cast_to_terminal_bar_handstand_quality' END,
      'variantSpecific',TRUE,'lowFatiguePriority',TRUE,'publicationQuarantined',TRUE),
    jsonb_build_object(
      'sets',CASE WHEN p.phase_key='prepare_and_access' THEN 2 ELSE
        CASE WHEN v.definition_id=cast_definition THEN 3 ELSE 4 END END,
      'repetitionsPerSet',CASE WHEN p.phase_key='prepare_and_access'
        THEN jsonb_build_array(1,2) WHEN v.definition_id=cast_definition
        THEN jsonb_build_array(2,4) ELSE jsonb_build_array(1,3) END,
      'restSeconds',CASE WHEN p.phase_key='prepare_and_access'
        THEN jsonb_build_array(90,150) WHEN v.definition_id=cast_definition
        THEN jsonb_build_array(120,210) ELSE jsonb_build_array(150,300) END,
      'attemptCeiling',CASE WHEN p.phase_key='prepare_and_access' THEN 4
        WHEN v.definition_id=cast_definition THEN 12 ELSE 10 END,
      'reserveRule','stop before predicted grip support or technique loss; never chase a maximum under fatigue',
      'planningEstimateNotUniversalPrescription',TRUE,
      'failedAssistedPartialAndFallAttemptsCountTowardExposure',TRUE),
    CASE WHEN v.definition_id=cast_definition
      THEN 'Exact grip and front support; hips clear the rail; selected peak is met; the same front support returns under control with no release circle floor contact or improvised exit.'
      ELSE 'Exact grip, technique, assistance and support path; declared vertical tolerance is met; no unplanned contact turn circle release or exit; the planned exit remains available.' END,
    ARRAY[
      'Stop immediately for pain, pinch, numbness, tingling, weakness, dizziness, faintness, unusual breathlessness, fear, or inability to communicate.',
      'Stop for grip slip, apparatus or mat movement, fall-zone intrusion, collision, missed assistance, or loss of the planned exit.',
      'Stop on the first uncontrolled fall or two consecutive technical faults; record every invalid, assisted, partial, and fall attempt.',
      'Do not add a circle, turn, release, dismount, or next element that is not independently selected and validated.'
    ]::TEXT[],
    CASE WHEN v.definition_id=cast_definition
      THEN 'Control the station, verify the exact variant, watch grip and straight arms first, then support shift, hip clearance, peak, reversal, front-support return, and exit. Stop before technical fatigue.'
      ELSE 'Control the station and qualified assistance plan; watch grip and straight arms, support shift, selected body path, vertical arrival, assistance, and exit. Stop before technical fatigue.' END,
    CASE WHEN v.definition_id=cast_definition
      THEN 'Use the exact grip and front support. Press to your assigned peak, then return to the same support under control. Stop for symptoms, grip change, contact, or a lost return.'
      ELSE 'Use the assigned grip, technique, and assistance. Cast only to the declared vertical line and use the planned exit. Stop for symptoms, grip change, contact, or loss of control.' END,
    CASE WHEN v.definition_id=cast_definition
      THEN 'More repeatable front-support cast timing, selected peak control, and controlled return within the exact variant.'
      ELSE 'More repeatable selected cast-to-handstand path and terminal control within the exact technique and assistance variant.' END,
    CASE WHEN v.definition_id=cast_definition
      THEN ARRAY['gymnastics_single_rail','mat']::TEXT[]
      ELSE ARRAY['gymnastics_single_rail','mat','panel_mat']::TEXT[] END,
    jsonb_build_object(
      'stationType',CASE WHEN v.definition_id=cast_definition THEN 'single_rail_cast_return_station' ELSE 'single_rail_cast_handstand_spotting_station' END,
      'athletesPerStation',1,'qualifiedCoachControlsEntry',TRUE,
      'setupSeconds',CASE WHEN p.phase_key='prepare_and_access' THEN 60 ELSE 45 END,
      'resetSeconds',CASE WHEN v.definition_id=cast_definition THEN 20 ELSE 35 END,
      'transitionSeconds',45,'fallZoneClearBeforeEveryAttempt',TRUE,
      'apparatusAndMatInspectionRequired',TRUE,
      'throughputRule','no next athlete enters until the prior athlete coach and all equipment clear the complete fall and exit envelope'),
    CASE v.id
      WHEN cast_below_variant THEN ARRAY[cast_horizontal_variant]::UUID[]
      WHEN cast_horizontal_variant THEN ARRAY[cast_below_variant,cast_above_variant]::UUID[]
      WHEN cast_above_variant THEN ARRAY[cast_horizontal_variant,assisted_straddle_handstand_variant]::UUID[]
      WHEN assisted_straddle_handstand_variant THEN ARRAY[cast_above_variant,assisted_straight_handstand_variant,independent_straddle_handstand_variant]::UUID[]
      WHEN assisted_straight_handstand_variant THEN ARRAY[assisted_straddle_handstand_variant,independent_straight_handstand_variant]::UUID[]
      WHEN independent_straddle_handstand_variant THEN ARRAY[assisted_straddle_handstand_variant,independent_straight_handstand_variant]::UUID[]
      ELSE ARRAY[assisted_straight_handstand_variant,independent_straddle_handstand_variant]::UUID[] END,
    'review',
    jsonb_build_object(
      'formula','setup + sum(attempt_seconds + reset_seconds) + inter_set_rest + transition',
      'attemptSeconds',CASE WHEN v.definition_id=cast_definition THEN jsonb_build_array(3,8) ELSE jsonb_build_array(4,12) END,
      'setupSeconds',CASE WHEN p.phase_key='prepare_and_access' THEN 60 ELSE 45 END,
      'resetSeconds',CASE WHEN v.definition_id=cast_definition THEN 20 ELSE 35 END,
      'durationBoundsSeconds',CASE WHEN p.phase_key='prepare_and_access'
        THEN jsonb_build_array(240,540) WHEN v.definition_id=cast_definition
        THEN jsonb_build_array(420,900) ELSE jsonb_build_array(600,1500) END,
      'includeInvalidAssistedPartialAndFallAttempts',TRUE),
    jsonb_build_object(
      'order',jsonb_build_array('reduce_attempts','increase_rest','reduce_peak_or_choose_assisted_reviewed_variant','change_definition_only_when_objective_change_is_accepted'),
      'preserve',jsonb_build_array('grip','rail','mount','repetition_boundary','stop_rule','planned_exit'),
      'revalidateOnChange',jsonb_build_array('identity','variant','technique','assistance','apparatus','dose','fatigue_budgets','duration','logistics','persistence','coach_rendering','athlete_rendering')),
    jsonb_build_object(
      'primary',CASE WHEN v.definition_id=cast_definition THEN 'valid_peak_and_return_attempts' ELSE 'valid_terminal_handstand_attempts' END,
      'record',jsonb_build_array('planned_completed_invalid_assisted_partial_and_fall_attempts','first_fault','peak_or_vertical_tolerance','assistance','symptoms','actual_duration','rest','exit','substitution'),
      'doNotAverageAwayFailures',TRUE),
    jsonb_build_object(
      'athletePrompt','Report symptoms fear grip uncertainty the first fault assistance and whether the exact return or exit stayed available.',
      'coachPrompt','Record exact variant apparatus grip mount shape target assistance outcome first fault symptoms duration rest exit and cumulative exposure.',
      'supportPrompt','Quarantine identity apparatus assistance media dose rendering persistence or substitution mismatches; never convert them into approval.',
      'incidentPrompt','Stop, secure the station, activate facility emergency procedures when indicated, preserve the exact event record, and do not resume without required review.')
  FROM (VALUES
    (cast_below_variant,cast_definition),(cast_horizontal_variant,cast_definition),
    (cast_above_variant,cast_definition),
    (assisted_straddle_handstand_variant,handstand_definition),
    (assisted_straight_handstand_variant,handstand_definition),
    (independent_straddle_handstand_variant,handstand_definition),
    (independent_straight_handstand_variant,handstand_definition)
  ) v(id,definition_id)
  CROSS JOIN (VALUES
    ('prepare-and-access-rehearsal','prepare_and_access','secondary'),
    ('movement-intelligence-quality','movement_intelligence','primary')
  ) p(profile_key,phase_key,role)
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

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,b.left_id,b.right_id,'distinct_exercises',b.rationale,
    jsonb_build_object(
      'migration',migration_key,'identityBoundary',b.boundary_key,
      'leftContract',b.left_contract,'rightContract',b.right_contract,
      'researchSources',jsonb_build_array(
        'https://www.gymnastics.sport/publicdir/rules/files/en_1.1.%20WAG%20Code%20of%20Points%202025-2028.pdf',
        'https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf',
        'https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email'),
      'identityOnlyNeighborStillRequiresItsOwnAudit',b.right_id<>handstand_definition,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (cast_definition,handstand_definition,'cast_return_vs_terminal_handstand','Basic Bar Cast reaches a declared sub-handstand peak and returns to the same front support; Cast to Handstand terminates in vertical bar support before a separate exit.','front_support_cast_to_peak_and_return','front_support_cast_to_terminal_vertical_handstand'),
    (cast_definition,front_support_definition,'dynamic_cast_vs_static_front_support','Bar Cast includes hip separation, backward-upward motion, a peak, and controlled reversal; Front Support Shape Hold is static and the existing card is not an apparatus-specific cast.','dynamic_front_support_cast_and_return','static_front_support_shape_hold'),
    (handstand_definition,freestanding_handstand_definition,'bar_cast_entry_vs_floor_handstand_hold','Cast to Handstand includes a front-support bar entry and dynamic cast; Freestanding Handstand Hold is a timed static floor or parallette balance without the cast action.','dynamic_bar_cast_to_handstand','static_freestanding_handstand_hold'),
    (handstand_definition,wall_handstand_definition,'bar_cast_entry_vs_wall_supported_hold','Cast to Handstand uses a rail and dynamic cast to vertical; Wall-Supported Handstand Hold retains wall contact for a timed static interval.','dynamic_bar_cast_to_handstand','static_wall_supported_handstand_hold'),
    (handstand_definition,handstand_kickup_definition,'bar_cast_entry_vs_floor_kickup','Cast to Handstand begins in bar front support; Handstand Kick-Up begins from floor stance or lunge and scores hand arrival and wall or spot reception.','front_support_bar_cast_entry','floor_lunge_kickup_entry')
  ) b(left_id,right_id,boundary_key,rationale,left_contract,right_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT e.definition_id,CASE WHEN e.definition_id=cast_definition THEN 2 ELSE 1 END,
    e.section_key,e.source_url,e.source_title,e.publisher,e.source_kind,
    jsonb_build_array(
      jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,
        'noUniversalTechniqueSafetyReadinessDoseRecoveryOutcomeTransferOrDifficultyClaim',TRUE)),
    e.evidence_quality,'candidate',NULL,NULL
  FROM (VALUES
    (cast_definition,'identity','https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email','East Midlands Gymnastics for All Rules 2026','British Gymnastics','governing_body','The rules separately name casts to 135 degrees, horizontal, and above horizontal and place them before separately named circles, swings, and dismounts.','current_regional_governing_body_bar_sequences','Competition wording does not define every training return, body shape, assistance, or population.',84),
    (cast_definition,'taxonomy','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.%20WAG%20Code%20of%20Points%202025-2028.pdf','Women’s Artistic Gymnastics Code of Points 2025–2028','World Gymnastics','governing_body','The code groups casts separately from clear-hip circles and evaluates cast amplitude relative to horizontal and handstand.','current_international_wag_element_taxonomy','Elite competition taxonomy is not a universal training prescription.',94),
    (cast_definition,'anatomy','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','The teaching text describes front support, shoulders forward, legs backward-upward, pressure against the bar, shoulder extension, and straight-arm whole-body shape.','governing_body_cast_action_description','The text does not quantify individual muscle forces or joint loads.',90),
    (cast_definition,'biomechanics','https://pubmed.ncbi.nlm.nih.gov/18930233/','Evaluation of a subject-specific female gymnast model and simulation of an uneven parallel bar swing','Journal of Biomechanics','peer_reviewed_research','A subject-specific model represented shoulder, hip, ankle, and bar-center positions during an uneven-bar swing, supporting whole-body and apparatus-specific kinematic modeling.','single_gymnast_uneven_bar_simulation','A dismount-preparation swing is adjacent biomechanics, not direct evidence for a basic cast or its optimal technique.',86),
    (cast_definition,'difficulty','https://static.usagym.org/PDFs/Women/Rules/dpcop/revisedpages_080425_mini.pdf','Women’s Development Program Code Replacement Pages, July 2025','USA Gymnastics','governing_body','Current development rules distinguish cast amplitude requirements and deductions, supporting amplitude as a meaningful exact constraint.','current_usag_amplitude_rules','Competition requirements do not calibrate Vortex complexity or physical-difficulty scores.',92),
    (cast_definition,'load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC12088353/','Common upper extremity gymnastics injuries and gymnastic specific return to play protocols','Journal of the Pediatric Orthopaedic Society of North America','peer_reviewed_research','The review describes repetitive upper-extremity weight-bearing and grip-related loading in gymnastics.','young_gymnast_upper_extremity_review','It does not quantify Bar Cast forces, attempt ceilings, recovery hours, or individual injury thresholds.',90),
    (cast_definition,'constraints','https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email','East Midlands Gymnastics for All Rules 2026','British Gymnastics','governing_body','The rules specify single wooden bar or asymmetric-bar configurations, apparatus height context, mats, coach presence, and ordered bar sequences.','current_regional_apparatus_context','A competition setup does not approve every facility rail, mat, spotting method, or clearance.',84),
    (cast_definition,'dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC9955164/','Injury Pathology in Young Gymnasts: A Retrospective Analysis','Children','peer_reviewed_research','The retrospective study reports injury and overuse context in gymnasts aged 6–17 and supports recording cumulative exposure rather than treating repetitions as risk free.','retrospective_youth_gymnast_injury_context','Self-reported injury data do not establish Bar Cast dose, weekly volume, recovery, or causation.',82),
    (cast_definition,'instructions','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','The developmental text identifies front support, forward shoulder position, backward-upward leg action, pressure against the bar, straight arms, and controlled body shape.','governing_body_cast_instruction','The section focuses on assisted Cast to Handstand and does not validate every cue for lower-amplitude casts.',90),
    (cast_definition,'safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC12088353/','Common upper extremity gymnastics injuries and gymnastic specific return to play protocols','Journal of the Pediatric Orthopaedic Society of North America','peer_reviewed_research','The review supports attention to hand, wrist, elbow, shoulder, grip, apparatus, and emergency response concerns in gymnastics.','young_gymnast_upper_extremity_review','It does not provide a Bar Cast symptom diagnosis, universal stop threshold, or spotting authorization.',90),
    (cast_definition,'programming','https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email','East Midlands Gymnastics for All Rules 2026','British Gymnastics','governing_body','Ordered routines place a cast before separately named circles, swings, and dismounts and differentiate target amplitude.','current_regional_sequence_examples','Competition sequence order does not establish optimal workout order, density, frequency, or adaptation.',84),
    (cast_definition,'athlete_support','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','The description provides observable support, arm, leg, head, and body-shape facts suitable for plain-language self-checks.','governing_body_cast_description','Self-check wording in this card remains unapproved and cannot replace qualified instruction.',90),
    (cast_definition,'coach_support','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','The developmental section directs coach assistance and shaping while observing support, shoulder, leg, arm, head, and completion positions.','governing_body_coach_observation','It does not publish a universal hands-on spotting method or authorize untrained assistance.',90),
    (cast_definition,'accessibility','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','The manual explicitly includes coach-assisted cast practice, showing assistance is a material delivery constraint that must be selected and recorded.','governing_body_assisted_training_context','It does not establish who is eligible, how much assistance is safe, or universal progression criteria.',90),
    (cast_definition,'alternates','https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email','East Midlands Gymnastics for All Rules 2026','British Gymnastics','governing_body','The rules separately name amplitude targets, front support, upward circle, back hip circle, baby giant, undershoot, swing, and dismount actions.','current_regional_identity_boundaries','The rules do not decide every Vortex definition versus variant boundary.',84),
    (cast_definition,'media','https://www.youtube.com/watch?v=H9HXXXTGXuI','How to Cast on a Bar #4','TGC_Online','expert_instruction','YouTube oEmbed returned current title, channel, thumbnail, and iframe metadata on 2026-08-02.','candidate_metadata_only','Playback, exact variant, peak, return, captions, accessibility, safety, cue quality, conflicts, reviewer, and approval remain unverified.',60),
    (handstand_definition,'identity','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.%20WAG%20Code%20of%20Points%202025-2028.pdf','Women’s Artistic Gymnastics Code of Points 2025–2028','World Gymnastics','governing_body','The current code separately identifies bent-hip or straddled and legs-together extended casts to handstand and additional turn or grip-change elements.','current_international_cast_handstand_taxonomy','Elite code values do not classify athlete readiness or define a standalone training exit.',94),
    (handstand_definition,'taxonomy','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.%20WAG%20Code%20of%20Points%202025-2028.pdf','Women’s Artistic Gymnastics Code of Points 2025–2028','World Gymnastics','governing_body','Casts to handstand occupy the cast element group and are distinct from circles, releases, turns, and other handstand arrivals.','current_international_wag_element_taxonomy','Competition taxonomy does not itself approve Vortex relationships or substitutions.',94),
    (handstand_definition,'anatomy','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','The manual describes shoulders forward of the bar, legs moving backward-upward, pressing against the bar, shoulder extension, and straight or bent-hip straddle technique to a closed straight-hollow handstand.','governing_body_cast_handstand_action_description','It does not quantify individual muscle contribution, force, or optimal joint timing.',90),
    (handstand_definition,'biomechanics','https://pubmed.ncbi.nlm.nih.gov/18930233/','Evaluation of a subject-specific female gymnast model and simulation of an uneven parallel bar swing','Journal of Biomechanics','peer_reviewed_research','A subject-specific uneven-bar model used shoulder, hip, ankle, and bar-center kinematics, supporting a whole-body apparatus model rather than a single-joint explanation.','single_gymnast_uneven_bar_simulation','The modeled swing is not a Cast to Handstand study and cannot establish this card’s ideal path or loads.',86),
    (handstand_definition,'difficulty','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.%20WAG%20Code%20of%20Points%202025-2028.pdf','Women’s Artistic Gymnastics Code of Points 2025–2028','World Gymnastics','governing_body','The code distinguishes straddled or bent-hip and legs-together extended casts and evaluates body alignment and handstand completion.','current_international_technique_and_terminal_constraints','Element values do not calibrate Vortex exercise complexity or physical difficulty.',94),
    (handstand_definition,'load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC12088353/','Common upper extremity gymnastics injuries and gymnastic specific return to play protocols','Journal of the Pediatric Orthopaedic Society of North America','peer_reviewed_research','The review describes repetitive hand, wrist, elbow, shoulder, and grip loading in artistic gymnastics.','young_gymnast_upper_extremity_review','It does not quantify Cast-to-Handstand forces, attempt ceilings, recovery hours, or individual injury thresholds.',90),
    (handstand_definition,'constraints','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','The manual specifies a single rail context, front support, qualified assistance, straight or straddle technique, and controlled handstand completion facts.','governing_body_training_context','It does not approve every rail, mat, block, grip, spot, fall zone, or facility procedure.',90),
    (handstand_definition,'dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC9955164/','Injury Pathology in Young Gymnasts: A Retrospective Analysis','Children','peer_reviewed_research','The retrospective youth-gymnast study supports tracking repetitive exposure and symptoms across gymnastics work.','retrospective_youth_gymnast_injury_context','It does not establish Cast-to-Handstand attempts, frequency, recovery, or causation.',82),
    (handstand_definition,'instructions','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','The manual explicitly describes assisted straight and bent-hip straddle Cast-to-Handstand actions and the required straight-hollow terminal position.','governing_body_cast_handstand_instruction','The text is developmental guidance, not approval of this card or a universal spotting method.',90),
    (handstand_definition,'safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC12088353/','Common upper extremity gymnastics injuries and gymnastic specific return to play protocols','Journal of the Pediatric Orthopaedic Society of North America','peer_reviewed_research','The clinical review supports explicit grip, upper-extremity symptom, apparatus, and emergency escalation rules for gymnastics exposure.','young_gymnast_upper_extremity_review','It cannot diagnose symptoms or provide universal Cast-to-Handstand stopping or spotting thresholds.',90),
    (handstand_definition,'programming','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','The development material places assisted Cast-to-Handstand work in a technical-development context with repeated coach shaping.','governing_body_development_context','It does not establish optimal Vortex set count, rest, weekly frequency, or adaptation.',90),
    (handstand_definition,'athlete_support','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','Observable support, shoulder, leg, arm, head, and terminal-shape facts can support plain-language attempt checks.','governing_body_cast_handstand_description','This card’s athlete wording remains a candidate and cannot replace qualified coaching.',90),
    (handstand_definition,'coach_support','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','The manual calls for coach assistance and shaping and supplies observable technique and completion positions.','governing_body_coach_observation','It does not state a universal hands-on spot or authorize assistance by an unqualified person.',90),
    (handstand_definition,'accessibility','https://static.usagym.org/PDFs/Women/development/compulsory/2021/replacement_072323.pdf','Women’s Development Program Compulsory Replacement Pages 2023','USA Gymnastics','governing_body','Assisted and straddle techniques show that technique and assistance are material selectable constraints rather than hidden athlete classifications.','governing_body_assisted_and_straddle_context','The manual does not establish universal eligibility or automatic progression to independent work.',90),
    (handstand_definition,'alternates','https://www.gymnastics.sport/publicdir/rules/files/en_1.1.%20WAG%20Code%20of%20Points%202025-2028.pdf','Women’s Artistic Gymnastics Code of Points 2025–2028','World Gymnastics','governing_body','The code distinguishes straddled or bent-hip, extended legs-together, hop-grip-change, half-turn, full-turn, and other cast outcomes.','current_international_identity_boundaries','The code does not determine every training drill or Vortex variant boundary.',94),
    (handstand_definition,'media','https://www.youtube.com/watch?v=NrVhnMiYg7w','#GymnasticsHowTo: Cast-to-Handstand','Shannon Miller','expert_instruction','YouTube oEmbed returned current title, channel, thumbnail, and iframe metadata on 2026-08-02.','candidate_metadata_only','Playback, technique, assistance, exact variant, captions, accessibility, safety, cue quality, conflicts, reviewer, and approval remain unverified.',60)
  ) e(definition_id,section_key,source_url,source_title,publisher,source_kind,
      supported_claim,scope,limitation,evidence_quality)
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
  SELECT m.definition_id,NULL,CASE WHEN m.definition_id=cast_definition THEN 2 ELSE 1 END,
    'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,
    m.channel,NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate',
    'manual_research',m.source_query,NULL,NULL,'2026-11-02'::TIMESTAMPTZ,
    'YouTube oEmbed returned current title, channel, thumbnail, and iframe metadata on 2026-08-02. This does not establish full playback, exact definition or variant, rail, grip, mount, peak or terminal angle, return, technique, assistance, exit, captions, accessibility, safety, cue quality, conflicts, reviewer identity, or approval.'
  FROM (VALUES
    (cast_definition,'0e0CAHk57IY','Teaching Uneven Bars - Essential Intermediate Skills - Mas Watanabe','GymSmarts','front support gymnastics bar cast technique'),
    (cast_definition,'H9HXXXTGXuI','How to Cast on a Bar #4','TGC_Online','basic gymnastics bar cast and return'),
    (cast_definition,'RGdJYHGA_n0','How to Cast on a Bar #3','TGC_Online','basic gymnastics bar cast front support'),
    (handstand_definition,'NBqHxIRKJZI','How to Do a Cast Handstand Drill | Gymnastics','Howcast','cast to handstand gymnastics drill'),
    (handstand_definition,'NrVhnMiYg7w','#GymnasticsHowTo: Cast-to-Handstand','Shannon Miller','cast to handstand technique'),
    (handstand_definition,'jiHZCy1lLvY','Jump to Bar Cast Handstand Drill','How To Gymnastics','cast handstand bar drill')
  ) m(definition_id,video_id,title,channel,source_query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=NULL,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    duration_seconds=NULL,language_code='en',captions_available=NULL,
    embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT a.definition_id,CASE WHEN a.definition_id=cast_definition THEN 2 ELSE 1 END,
    a.alternate_name,a.classification,a.rationale,
    jsonb_build_object(
      'boundaryKey',a.boundary_key,'factsRequired',a.facts_required,
      'startSupportActionPeakTerminalReturnAndExitRequired',TRUE,
      'neverInferFromNameOrAthleteRanking',TRUE),
    jsonb_build_object(
      'status','research_queue','classificationCandidate',a.classification,
      'requiredFacts',a.facts_required,
      'humanIdentityAndContentReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    (cast_definition,'Front-Support Cast Below Horizontal and Return','same_identity','Exact lower-amplitude working specification inside the cast-and-return identity.','below_horizontal_variant',jsonb_build_array('rail','grip','front_support','hip_clearance','peak_angle','return')),
    (cast_definition,'Front-Support Cast to Horizontal and Return','same_identity','Exact horizontal-peak working specification inside the cast-and-return identity.','horizontal_variant',jsonb_build_array('rail','grip','front_support','horizontal_reference','peak','return')),
    (cast_definition,'Front-Support Cast Above Horizontal and Return','same_identity','Exact above-horizontal but sub-handstand working specification inside the cast-and-return identity.','above_horizontal_variant',jsonb_build_array('rail','grip','front_support','peak_angle','sub_handstand_limit','return')),
    (cast_definition,'Cast to 135 Degrees and Return','new_variant','A named halfway-to-horizontal target is an exact amplitude specification requiring its own angle tolerance and validation.','135_degree_variant',jsonb_build_array('angle_convention','target','tolerance','body_line','return','measurement')),
    (cast_definition,'Cast to Handstand','new_definition','Terminal vertical bar support replaces the controlled return-to-front-support endpoint and is authored as a separate definition in this migration.','cast_return_vs_terminal_handstand',jsonb_build_array('peak','vertical_tolerance','terminal_state','technique','assistance','exit')),
    (cast_definition,'Kip Cast','new_definition','A glide or long-hang kip adds an entry action and dynamic arrival before the cast.','front_support_start_vs_kip_entry',jsonb_build_array('hang','glide','kip','front_support_transition','cast','finish')),
    (cast_definition,'Cast into Back Hip Circle','new_definition','Continuing into a backward hip circle adds a complete bar rotation and a different terminal action.','cast_return_vs_back_hip_circle',jsonb_build_array('cast_peak','hip_contact','backward_rotation','hand_shift','support_return','finish')),
    (cast_definition,'Cast to Undershoot','new_definition','Passing below or away from the bar into an undershoot adds swing, support transition, and a different finish or dismount.','cast_return_vs_undershoot',jsonb_build_array('cast','hip_clearance','underswing','release_or_support','flight','landing_or_hang')),
    (cast_definition,'Cast to Baby Giant or Clear Pullover','new_definition','The downward-forward swing and complete return around the rail add a circle and distinct repetition boundary.','cast_return_vs_clear_pullover',jsonb_build_array('cast_height','downward_swing','tap','rotation','clear_support','spot')),
    (cast_definition,'Cast with Turn or Hop-Grip Change','new_definition','A prescribed hand release, regrasp, or longitudinal turn adds rotation, flight, grip transition, and failure consequences.','no_turn_no_release_vs_turn_or_hop',jsonb_build_array('turn_degrees','release','regrasp','grip','body_angle','finish')),
    (cast_definition,'Static Bar Front Support Hold','new_definition','A timed static support has no hip-separation cast, peak, or reversal.','dynamic_cast_vs_static_support',jsonb_build_array('mount','support','timer','no_cast','stop','dismount')),
    (cast_definition,'Jump or Pullover to Front Support','new_definition','Mounting to support scores the approach, jump or pull, contact transition, and arrival rather than the cast.','cast_vs_front_support_mount',jsonb_build_array('start','jump_or_pull','rail_contact','support_arrival','stabilize','finish')),
    (cast_definition,'Qualified-Assisted Basic Bar Cast','new_variant','Physical assistance changes effective load, coach contact, validity, exposure accounting, and failure response while preserving the cast-and-return action.','assisted_basic_cast_variant',jsonb_build_array('qualification','contact_phase','assistance_amount','peak','return','attempt_classification')),
    (cast_definition,'Bar Cast Sets Repetitions Rest or Tempo Change','modifier_annotation','Dose and tempo within the same start action peak and return are delivery annotations that require duration and fatigue recalculation.','dose_annotation',jsonb_build_array('sets','repetitions','rest','tempo','duration','fatigue_budget')),
    (handstand_definition,'Qualified-Assisted Straddle Cast to Handstand','same_identity','Exact assisted straddle working specification inside the terminal-handstand identity.','assisted_straddle_variant',jsonb_build_array('technique','assistance','rail','vertical_tolerance','terminal_control','exit')),
    (handstand_definition,'Qualified-Assisted Straight-Body Cast to Handstand','same_identity','Exact assisted straight-body working specification inside the terminal-handstand identity.','assisted_straight_variant',jsonb_build_array('technique','assistance','rail','vertical_tolerance','terminal_control','exit')),
    (handstand_definition,'Independent Straddle Cast to Handstand','same_identity','Exact no-planned-physical-assistance straddle specification with qualified supervision and a declared exit.','independent_straddle_variant',jsonb_build_array('technique','no_physical_assistance','rail','vertical_tolerance','terminal_control','exit')),
    (handstand_definition,'Independent Straight-Body Cast to Handstand','same_identity','Exact no-planned-physical-assistance straight-body specification with qualified supervision and a declared exit.','independent_straight_variant',jsonb_build_array('technique','no_physical_assistance','rail','vertical_tolerance','terminal_control','exit')),
    (handstand_definition,'Basic Cast Below Horizontal, to Horizontal, or Above Horizontal','new_definition','A sub-handstand cast that returns to front support has a different terminal state and is the separate Bar Cast definition.','terminal_handstand_vs_front_support_return',jsonb_build_array('peak','vertical_tolerance','return','terminal_state','exit','dose')),
    (handstand_definition,'Kip Cast to Handstand','new_definition','A glide or long-hang kip before the cast adds a scored entry and different timing and fatigue sequence.','front_support_start_vs_kip_entry',jsonb_build_array('hang','glide','kip','support_transition','cast_handstand','exit')),
    (handstand_definition,'Cast to Handstand with Half or Full Turn','new_definition','A longitudinal turn changes hand sequence, body rotation, grip, terminal orientation, and failure consequence.','no_turn_vs_turn_to_handstand',jsonb_build_array('turn_degrees','hand_sequence','grip','rotation_timing','vertical_tolerance','finish')),
    (handstand_definition,'Cast to Handstand with Hop-Grip Change','new_definition','Hand release and regrasp add flight, timing, grip change, and failed-catch exposure.','continuous_grip_vs_hop_regrasp',jsonb_build_array('takeoff','release','flight','regrasp','grip','handstand')),
    (handstand_definition,'Toe-On or Stalder to Handstand','new_definition','Foot-to-bar or straddle-circle support and a complete circling action replace the front-support cast path.','cast_vs_toe_on_or_stalder_circle',jsonb_build_array('foot_or_leg_contact','circle','hip_path','handstand_arrival','grip','finish')),
    (handstand_definition,'Clear Hip Circle to Handstand','new_definition','A backward clear-hip circle adds a full rotation around the rail before the handstand.','cast_vs_clear_hip_circle',jsonb_build_array('circle','hip_clearance','shoulder_opening','rotation','vertical_arrival','finish')),
    (handstand_definition,'Static Bar Handstand Hold','new_definition','A timed handstand hold begins after arrival and scores duration rather than the dynamic cast entry.','dynamic_entry_vs_static_hold',jsonb_build_array('start_at_handstand','timer','balance','corrections','stop','exit')),
    (handstand_definition,'Cast Handstand Fall-Over or Forward-Roll Drill','new_definition','Intentionally passing vertical and falling or rolling changes the terminal action, mat contact, and exit.','terminal_handstand_vs_fallover_drill',jsonb_build_array('pass_vertical','fall_direction','bar_release_or_rotation','mat_contact','coach_role','finish')),
    (handstand_definition,'Different Declared Rail Height or Diameter','new_variant','Apparatus geometry changes mount, clearance, leverage, grip, coach position, and fall envelope and requires an exact reviewed variant.','rail_geometry_variant',jsonb_build_array('rail_type','height','diameter','mount','clearance','spotting_zone')),
    (handstand_definition,'Cast-to-Handstand Attempt Count Rest or Tempo Change','modifier_annotation','Attempt count, rest, and tempo are delivery changes only when start technique assistance terminal standard and exit remain identical.','dose_annotation',jsonb_build_array('attempts','sets','rest','tempo','duration','fatigue_budget'))
  ) a(definition_id,alternate_name,classification,rationale,boundary_key,facts_required)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,r.to_id,r.relationship,r.similarity,r.dimensions,r.reason,
    jsonb_build_object(
      'migration',migration_key,'reviewOnly',TRUE,'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity','rail','grip','mount','support','body_shape','peak_or_terminal','technique','assistance','return','exit','equipment','environment','symptoms','dose','fatigue_budgets','duration','logistics','persistence','skill_link','coach_rendering','athlete_rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (cast_below_variant,cast_horizontal_variant,'progression',86,ARRAY['range','load','complexity']::TEXT[],'A horizontal target retains the same cast-and-return action while increasing declared amplitude and support demand; no athlete readiness is inferred.'),
    (cast_horizontal_variant,cast_below_variant,'regression',86,ARRAY['range','load','complexity']::TEXT[],'A lower peak can reduce range and demand while preserving the same exact start and return only after full revalidation.'),
    (cast_horizontal_variant,cast_above_variant,'progression',84,ARRAY['range','load','stability','complexity']::TEXT[],'An above-horizontal target increases amplitude, angular control, support demand, and failure consequence within the cast-return identity.'),
    (cast_above_variant,cast_horizontal_variant,'regression',84,ARRAY['range','load','stability','complexity']::TEXT[],'Returning to horizontal changes the peak constraint and may reduce demand but still requires exact revalidation.'),
    (cast_above_variant,assisted_straddle_handstand_variant,'progression',66,ARRAY['range','load','stability','complexity']::TEXT[],'Terminal handstand, straddle closure, qualified physical assistance, vertical clearance, and a separate exit change identity and require complete review.'),
    (assisted_straddle_handstand_variant,cast_above_variant,'regression',66,ARRAY['range','load','stability','complexity']::TEXT[],'Selecting the sub-handstand cast-return definition removes terminal vertical support but changes the objective and repetition endpoint.'),
    (assisted_straddle_handstand_variant,assisted_straight_handstand_variant,'lateral_substitution',78,ARRAY['load','range','complexity']::TEXT[],'Straight-body technique retains assisted terminal handstand but changes leverage, hip path, timing, and physical demand.'),
    (assisted_straight_handstand_variant,assisted_straddle_handstand_variant,'lateral_substitution',78,ARRAY['load','range','complexity']::TEXT[],'Straddle technique retains assisted terminal handstand but changes hip actions, timing, and body path.'),
    (assisted_straddle_handstand_variant,independent_straddle_handstand_variant,'progression',82,ARRAY['load','stability','complexity']::TEXT[],'Removing planned physical assistance changes effective load, balance, failure response, attempt classification, and coach role.'),
    (independent_straddle_handstand_variant,assisted_straddle_handstand_variant,'regression',82,ARRAY['load','stability','complexity']::TEXT[],'Adding qualified physical assistance changes effective load and validity and is never an automatic readiness decision.'),
    (assisted_straight_handstand_variant,independent_straight_handstand_variant,'progression',82,ARRAY['load','stability','complexity']::TEXT[],'Removing planned physical assistance from the straight-body technique changes load, control, failure response, and coach role.'),
    (independent_straight_handstand_variant,assisted_straight_handstand_variant,'regression',82,ARRAY['load','stability','complexity']::TEXT[],'Qualified physical assistance changes the exact straight-body variant and requires complete exposure and result recording.'),
    (independent_straddle_handstand_variant,independent_straight_handstand_variant,'lateral_substitution',80,ARRAY['load','range','complexity']::TEXT[],'Straight-body technique retains independent terminal handstand but changes leverage, hip path, timing, and physical demand.'),
    (independent_straight_handstand_variant,independent_straddle_handstand_variant,'lateral_substitution',80,ARRAY['load','range','complexity']::TEXT[],'Straddle technique retains independent terminal handstand but changes hip actions, timing, and body path.')
  ) r(from_id,to_id,relationship,similarity,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,v.id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity ELSE v.physical END,
    v.anchor_tier,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on exact rail and grip, front-support start, shoulder and hip timing, body-shape path, peak or terminal precision, return or exit, error detection, attention, and supervision.'
    ELSE
      'Review-only physical-difficulty anchor based on dynamic bodyweight bar support, grip, straight-arm and shoulder demand, leverage, range, body shape, assistance, terminal control, fatigue, and recovery.' END
      ||' This scores the exercise, not athlete proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (cast_below_variant,'front-support-cast-below-horizontal-return',56,54,60),
    (cast_horizontal_variant,'front-support-cast-to-horizontal-return',64,62,60),
    (cast_above_variant,'front-support-cast-above-horizontal-return',72,70,80),
    (assisted_straddle_handstand_variant,'assisted-straddle-cast-to-handstand',82,74,80),
    (assisted_straight_handstand_variant,'assisted-straight-body-cast-to-handstand',86,80,80),
    (independent_straddle_handstand_variant,'independent-straddle-cast-to-handstand',86,82,80),
    (independent_straight_handstand_variant,'independent-straight-body-cast-to-handstand',90,88,80)
  ) v(id,variant_key,complexity,physical,anchor_tier)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_score_v1(
    exercise_id,technical_complexity,absolute_load_demand,coordination_demand,
    impact,supervision_demand,base_overall_difficulty,legacy_scores,
    migration_confidence,human_review_status,reviewed_by,reviewed_at,review_notes)
  VALUES(17,64,62,64,1,78,64,
    jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'representativeVariant','front-support-cast-to-horizontal-return',
      'exactRailGripStartPeakReturnAndExitRequired',TRUE,
      'castToHandstandIsSeparateDefinition',TRUE,
      'skillLibraryLevelsNotCopied',TRUE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),62,'queued',NULL,NULL,
    'Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not athlete proficiency. Exact rail, grip, start, peak, return, assistance, exit, and independent calibration remain required.')
  ON CONFLICT(exercise_id) DO UPDATE SET
    technical_complexity=EXCLUDED.technical_complexity,
    absolute_load_demand=EXCLUDED.absolute_load_demand,
    coordination_demand=EXCLUDED.coordination_demand,impact=EXCLUDED.impact,
    supervision_demand=EXCLUDED.supervision_demand,
    base_overall_difficulty=EXCLUDED.base_overall_difficulty,
    legacy_scores=EXCLUDED.legacy_scores,migration_confidence=EXCLUDED.migration_confidence,
    human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes=EXCLUDED.review_notes,updated_at=now();

  UPDATE coaching.exercise_difficulty_profile SET
    technical=6.4,complexity=6.4,load=6.2,overall=6.4,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='high',
    notes='Candidate exercise complexity and physical difficulty for the exact front-support Cast to Horizontal and Return representative variant. Cast to Handstand is a separate definition. This is not an athlete proficiency classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=17;

  UPDATE coaching.exercise SET
    name='Bar Cast',slug='bar-cast',skill_level=NULL,age_min=NULL,age_max=NULL,
    is_published=FALSE,why_publish_ready=FALSE,archived=FALSE,
    description='Front-support gymnastics single-rail cast exercise. Select an exact below-horizontal, horizontal, or above-horizontal peak-and-return variant. Cast to Handstand, kips, circles, undershoots, turns, releases, and mounts remain separate actions.',
    instructions='Declare rail, height, grip, mount, body shape, peak target and tolerance, assistance, sets, repetitions, rest, front-support return, dismount, cumulative bar-support exposure, and stop. Count every valid, invalid, partial, assisted, and fall attempt plus first fault and actual duration.',
    default_sets=3,default_reps=3,default_work_seconds=NULL,
    default_rest_seconds=150,est_seconds_per_set=90,
    card_summary='Dynamic front-support bar cast to an exact sub-handstand peak and controlled return to the same support; rail, grip, amplitude, body shape, return, and exit are mandatory.',
    coach_language='Verify exact rail, grip, mount, front support, body shape, peak marker, assistance, matting, fall zone, straight-arm support, hip clearance, return, dismount, cumulative hand-support and grip exposure, first fault, symptoms, and actual rest. Stop before technical fatigue.',
    athlete_language='Use your assigned rail, grip, body shape, and peak. Press away from the bar, reach the marker, and return to the same front support. Stop for symptoms, grip change, contact, or loss of return.',
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule','front_support_cast_to_declared_sub_handstand_peak_and_controlled_return_required',
      'skillLibraryRule','competition levels and athlete mastery classifications remain only in skill-library cards',
      'loadRule','record all valid invalid partial assisted and fall attempts plus rail grip peak return and exit',
      'fatigueRule','combine bar support grip hand wrist elbow shoulder inversion swing circle release and handstand exposure',
      'substitutionRule','revalidate identity rail grip mount support peak terminal action assistance dose fatigue duration logistics persistence and both renderings',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['peak_angle','angle_tolerance','body_shape','rail_height','sets','repetitions','rest','tempo','qualified_assistance','mount','dismount']::TEXT[],
    movement_family='Front-support bar cast and return',
    primary_phase_key='movement_intelligence',phase_subrole='bar_cast_quality',
    primary_order_slot='low_fatigue_bar_technique',programming_kind='exercise',
    linked_skill_id=NULL,
    movement_requirements=jsonb_build_object(
      'impact_level',1,'required_equipment',jsonb_build_array('gymnastics_single_rail','mat'),
      'required_environment',jsonb_build_array('locked_rail','secured_matting','clear_fall_zone','qualified_supervision'),
      'identityConstraints',jsonb_build_array('front_support_start','hips_clear_rail','declared_peak','controlled_same_support_return')),
    coaching_execution=jsonb_build_object(
      'observe',jsonb_build_array('grip','straight_arms','support_shift','hip_clearance','body_shape','peak','return','exit'),
      'qualityStop','first uncontrolled fall or two consecutive faults',
      'persistenceRequired',TRUE),
    pairing_logic=jsonb_build_object(
      'avoid',jsonb_build_array('dense_grip_or_upper_extremity_support_work','fatigued_bar_skill_circuit'),
      'revalidateAfterPairingChange',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_urls',jsonb_build_array(
        'https://www.youtube.com/watch?v=0e0CAHk57IY',
        'https://www.youtube.com/watch?v=H9HXXXTGXuI',
        'https://www.youtube.com/watch?v=RGdJYHGA_n0'),
      'media_review_state','candidate_oembed_metadata_only',
      'external_playback_verification_performed',FALSE,
      'human_review_required',TRUE),updated_at=now()
  WHERE id=17;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=4,impact_level=1,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='required',
    minimum_prerequisite_notes='Readiness is assessed from current symptoms, exact rail and grip tolerance, front-support control, selected cast-return path, controlled mount and exit, environment, and qualified coach observation; never from an exercise proficiency label.',
    readiness_checks=ARRAY[
      'Exact rail, grip, mount, body shape, peak target, return, dismount, dose, and assistance policy are understood.',
      'Hands, wrists, elbows, shoulders, neck, spine, hips, and grip are symptom-free for the selected path and support.',
      'Rail locks, uprights, anchors, matting, optional grips and mount aid, overhead space, fall zone, and emergency access are checked.',
      'The athlete can hold front support, respond to the stop signal, return to support, and use the planned dismount while the coach sees the full attempt.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Pain, pinch, numbness, tingling, weakness, dizziness, faintness, panic, unusual breathlessness, or inability to communicate.',
      'Grip slip, rail or mat movement, fall-zone intrusion, collision, elbow collapse, unplanned contact, circle, turn, release, foot contact, or uncontrolled fall.',
      'Peak or return standard is lost, assistance changes unexpectedly, the planned exit is unavailable, or two consecutive technical faults occur.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms or restrictions for which bar support or gymnastics participation has not been cleared when clearance is appropriate.',
      'No locked exact rail, secured matting, complete fall zone, controlled mount and exit, qualified supervision, or enforceable one-athlete station.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Select a reviewed lower-amplitude cast-and-return variant only after full revalidation.',
      'Use the separate Cast to Handstand definition only when the terminal-handstand objective, technique, assistance, fall zone, and exit are independently validated.',
      'Do not substitute a kip, back hip circle, undershoot, baby giant, turn, release, mount, or static support hold without changing identity.'
    ]::TEXT[]
  WHERE exercise_id=17;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT d.definition_id,1,d.card_version,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object(
        'passed',TRUE,'identityKey',d.identity_key,
        'legacySources',CASE WHEN d.definition_id=cast_definition THEN 1 ELSE 0 END,
        'researchAuthoredDefinition',d.definition_id=handstand_definition,
        'activeWorkingSpecifications',d.variant_count,
        'identityQuarantinedLegacySource',d.definition_id=cast_definition,
        'skillLibraryBoundaryExplicit',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesAndLaterality',TRUE),
      'difficulty',jsonb_build_object(
        'passed',TRUE,'model','max_exercise_complexity_physical_difficulty',
        'athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object(
        'passed',TRUE,'landingContactsPerRep',0,'plannedImpactContacts',0,
        'validInvalidPartialAssistedAndFallAttemptsCounted',TRUE,
        'cumulativeBarSupportGripUpperExtremityAndInversionExposure',TRUE),
      'constraints',jsonb_build_object(
        'passed',TRUE,'railGripMountSupportBodyShapeTargetAssistanceReturnExitMattingClearanceAndSupervision',TRUE),
      'delivery',jsonb_build_object(
        'passed',TRUE,'profiles',d.variant_count*2,
        'prepareAndAccessAndMovementIntelligenceOnly',TRUE,
        'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object(
        'passed',TRUE,'athleteCoachSupport',TRUE,
        'mountSupportActionTargetStopReturnExitIncidentAndSkillBoundary',TRUE),
      'research',jsonb_build_object(
        'passed',TRUE,'sections',16,'registryVersion',research_version,
        'governingBodyAndResearchLimitsExplicit',TRUE),
      'media',jsonb_build_object(
        'passed',FALSE,'candidateCount',3,'currentOEmbedMetadataHealthy',TRUE,
        'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,
        'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,
        'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object(
        'passed',FALSE,'reviewOnly',CASE WHEN d.definition_id=cast_definition THEN 5 ELSE 9 END,'approved',0),
      'calibration',jsonb_build_object(
        'passed',FALSE,'reviewOnly',d.variant_count*2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',14,'identityBoundariesExplicit',TRUE),
      'generationSupport',jsonb_build_object(
        'passed',TRUE,'selectionConstraints',TRUE,'cumulativeBudgets',TRUE,
        'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,
        'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object(
        'code','CARD-MEDIA-01',
        'message','A qualified human must watch every candidate in full and verify exact definition and variant, rail, grip, mount, front support, body path, peak or terminal standard, assistance, return or exit, captions, accessibility, safety, cue quality, conflicts, reviewer identity, timestamp, card version, and current playback.'),
      jsonb_build_object(
        'code','CARD-GRAPH-03',
        'message','A qualified coach must approve or reject every progression, regression, and substitution proposal; no automatic transfer among amplitude, assistance, technique, terminal state, circle, turn, release, mount, or skill performance is authorized.'),
      jsonb_build_object(
        'code','CARD-CALIBRATION-01',
        'message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These scores do not classify an athlete and do not modify skill-library levels.'),
      jsonb_build_object(
        'code','CARD-PUBLISH-01',
        'message','A qualified reviewer and separate approver must complete content review before publication. Every identity, rail, grip, mount, target, technique, assistance, return, exit, dose, and support rule remains quarantined.')),
    TRUE,now()
  FROM (VALUES
    (cast_definition,2,'front_support_bar_cast_peak_and_return',3),
    (handstand_definition,1,'front_support_bar_cast_to_terminal_handstand',4)
  ) d(definition_id,card_version,identity_key,variant_count)
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=17 AND definition_id=cast_definition
        AND provenance_json->>'sourceDisposition'='identity_quarantine'
        AND provenance_json->>'representedBySelectableSourceVariant'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id=ANY(affected_definition_ids) AND status='review'
          AND schema_version='2.0.0' AND approved_video_url IS NULL
          AND reviewed_by IS NULL AND approved_by IS NULL
          AND last_reviewed_at IS NULL
          AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
          AND population_json<>'{}'::JSONB
          AND athlete_support_json<>'{}'::JSONB
          AND coach_support_json<>'{}'::JSONB
          AND support_operations_json<>'{}'::JSONB
          AND provenance_json->>'canonicalAuthoredFromResearch'='true'
          AND provenance_json->>'approvalsCreated'='false')<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
        WHERE id=handstand_definition AND legacy_exercise_id IS NULL
          AND provenance_json->>'primaryIdentitySource' LIKE 'https://%') THEN
    RAISE EXCEPTION '% found invalid source quarantine, definitions, or research lineage',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'absoluteLoadDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=(difficulty_json->>'absoluteLoadDemand')::INTEGER
        AND (difficulty_json->>'workCapacityDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (difficulty_json->>'supervisionDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'failureConsequence')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (load_profile_json->>'plannedImpactContacts')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND (fatigue_profile_json->>'recoveryHours')::INTEGER>0
        AND programming_profile_json<>'{}'::JSONB)<>7 THEN
    RAISE EXCEPTION '% found invalid active variants, score model, loading, or fatigue contract',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'formula','')<>''
        AND dose_scaling_json<>'{}'::JSONB
        AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=4)<>14
    OR EXISTS(SELECT 1 FROM unnest(affected_definition_ids) target(definition_id)
      WHERE (SELECT count(DISTINCT section_key)
        FROM coaching.exercise_section_evidence_v1 evidence
        JOIN coaching.exercise_definition_v1 definition ON definition.id=evidence.definition_id
        WHERE evidence.definition_id=target.definition_id
          AND evidence.reviewed_card_version=definition.card_version
          AND evidence.review_status='candidate'
          AND evidence.reviewer_user_id IS NULL)<>16)
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
        JOIN coaching.exercise_definition_v1 definition ON definition.id=media.definition_id
        WHERE media.definition_id=ANY(affected_definition_ids)
          AND media.reviewed_card_version=definition.card_version
          AND media.link_status='healthy' AND media.review_status='candidate'
          AND media.embedding_allowed AND media.captions_available IS NULL
          AND media.exact_variant_match IS NULL
          AND media.demonstration_quality_score IS NULL
          AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>6
    OR EXISTS(SELECT 1 FROM unnest(affected_definition_ids) target(definition_id)
      WHERE (SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
        JOIN coaching.exercise_definition_v1 definition ON definition.id=media.definition_id
        WHERE media.definition_id=target.definition_id
          AND media.reviewed_card_version=definition.card_version
          AND media.link_status='healthy' AND media.review_status='candidate')<>3)
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
        JOIN coaching.exercise_definition_v1 definition ON definition.id=alternate.definition_id
        WHERE alternate.definition_id=ANY(affected_definition_ids)
          AND alternate.reviewed_card_version=definition.card_version
          AND alternate.review_status='candidate'
          AND alternate.reviewer_user_id IS NULL)<>28 THEN
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternate assessments',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>14
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
        WHERE variant_id=ANY(active_variant_ids) AND status='review'
          AND version=1 AND reviewed_by IS NULL)<>14
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
        WHERE decision='distinct_exercises' AND reviewed_by IS NULL AND
          ((survivor_definition_id=cast_definition
            AND resolved_definition_id IN(handstand_definition,front_support_definition))
          OR (survivor_definition_id=handstand_definition
            AND resolved_definition_id IN(freestanding_handstand_definition,
              wall_handstand_definition,handstand_kickup_definition))))<>5 THEN
    RAISE EXCEPTION '% found incomplete review-only graph, calibration, or identity boundaries',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=ANY(affected_definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=ANY(affected_definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=ANY(affected_definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE relationship.from_variant_id=ANY(active_variant_ids)
        AND relationship.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=17 AND (skill_level IS NOT NULL OR age_min IS NOT NULL
        OR age_max IS NOT NULL OR is_published OR why_publish_ready))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=17
        AND (minimum_skill_level IS NOT NULL OR minimum_age_recommended IS NOT NULL
          OR requires_coach_supervision<>'required'))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=17 AND technical_complexity=64
        AND absolute_load_demand=62 AND base_overall_difficulty=64
        AND impact=1 AND human_review_status='queued'
        AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition ON definition.id=media.definition_id
      WHERE media.definition_id=ANY(affected_definition_ids)
        AND media.reviewed_card_version=definition.card_version
        AND (media.review_status<>'candidate' OR media.reviewer_user_id IS NOT NULL
          OR media.reviewed_at IS NOT NULL OR media.captions_available IS NOT NULL
          OR media.exact_variant_match IS NOT NULL
          OR media.demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND (review_status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND (status='approved' OR reviewed_by IS NOT NULL))
    OR (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
        WHERE definition_id=ANY(affected_definition_ids)
          AND status='quarantined' AND human_review_required
          AND jsonb_array_length(blocking_issues_json)=4)<>2 THEN
    RAISE EXCEPTION '% retained or fabricated proficiency, approval, media, or publication state',migration_key;
  END IF;
END;
$$;
