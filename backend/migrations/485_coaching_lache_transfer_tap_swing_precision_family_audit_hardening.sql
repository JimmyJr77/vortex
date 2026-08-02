-- Replace the ambiguous Lache Swing baseline with three exact, separately
-- selectable actions: a two-bar transfer to a retained catch, a no-release
-- hollow-arch tap swing, and a release to a two-foot precision stick. Grip,
-- apparatus geometry, assistance, catch/landing endpoint, dose, and stop rules
-- are explicit working constraints. Media, content, graph, calibration, and
-- publication remain quarantined for qualified human review. Exercise scores
-- describe exercise complexity and physical difficulty, never athlete skill.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '485_coaching_lache_transfer_tap_swing_precision_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.87';
  lache_definition CONSTANT UUID := 'abc659bf-ce3c-4b7c-a118-f2b0c761bd07';
  tap_definition CONSTANT UUID := '3018f919-8d85-4870-a1d2-ece8fd2af15e';
  precision_definition CONSTANT UUID := '656028eb-c7d1-4a2f-a216-45763b201796';
  source_variant CONSTANT UUID := '9aedcb37-d32a-43b8-a1d1-0a653d1bcdb5';
  same_height_variant CONSTANT UUID := '29c4fb69-e9c3-4106-b09d-9a0732946da9';
  higher_target_variant CONSTANT UUID := '2b733b32-477c-4987-ba3b-fcd14cb183d6';
  lower_target_variant CONSTANT UUID := '53616483-e26c-4e32-90dc-1db96a7db5b0';
  assisted_variant CONSTANT UUID := 'a2f5e5c7-dcd1-4ed6-921d-60e8409a57d5';
  tap_variant CONSTANT UUID := 'c0717c68-366c-4039-93e6-be44febe8978';
  precision_variant CONSTANT UUID := '612fc5a8-a343-4609-9463-b891ebeaf104';
  definition_ids CONSTANT UUID[] := ARRAY[
    lache_definition,tap_definition,precision_definition
  ];
  active_variant_ids CONSTANT UUID[] := ARRAY[
    same_height_variant,higher_target_variant,lower_target_variant,
    assisted_variant,tap_variant,precision_variant
  ];
  active_hang_definition CONSTANT UUID := '77602a12-d58b-4d41-b84e-713a4b8c3011';
  dead_hang_definition CONSTANT UUID := '0973b1ff-410a-4c97-b85d-84fec7ad0182';
  scapular_pull_definition CONSTANT UUID := '0c7d9348-f563-4a42-a31a-248d657901c1';
  flexed_hang_definition CONSTANT UUID := '424de579-d93c-462e-b94f-4e849e89e03e';
  standing_precision_definition CONSTANT UUID := '6dc5fcf1-6383-4aed-a73b-7465384fd18b';
  bar_cast_definition CONSTANT UUID := '6915611f-7382-448b-b3eb-d8dd08f10ee7';
  cast_handstand_definition CONSTANT UUID := 'd8b03d69-0840-40b0-adba-21d855d3db3e';
  active_hang_variant CONSTANT UUID := 'aa45a58c-8fe7-4bb6-843a-c3432540fdc2';
  dead_hang_variant CONSTANT UUID := 'eded93cc-ea14-4cfe-b0b5-3bab27362b9a';
  scapular_pull_variant CONSTANT UUID := '9d1489fd-55b2-49d9-a3cf-4bc8271e781f';
  standing_precision_variant CONSTANT UUID := 'dd36d133-894b-4562-9cc7-016d1db6f56c';
  protected_count INTEGER;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=lache_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=19 AND definition_id=lache_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=lache_definition)
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id IN(active_hang_definition,dead_hang_definition,
          scapular_pull_definition,flexed_hang_definition,
          standing_precision_definition,bar_cast_definition,
          cast_handstand_definition) AND status<>'archived')<>7
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id IN(active_hang_variant,dead_hang_variant,scapular_pull_variant,
          standing_precision_variant) AND status<>'archived')<>4 THEN
    RAISE EXCEPTION '% prerequisite source lineage or identity anchors drifted',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='two-bar-lache-transfer-retained-catch' AND id<>lache_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='bar-hollow-arch-tap-swing' AND id<>tap_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='lache-precision-two-foot-stick' AND id<>precision_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids)
        AND definition_id<>ALL(definition_ids)) THEN
    RAISE EXCEPTION '% working slug or UUID ownership drifted',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(definition_ids)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ANY(definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ANY(definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=ANY(definition_ids)
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
      WHERE exercise_id=19
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=ANY(definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(definition_ids)
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
        'sourceInterpretation','legacy label and one-sentence summary do not declare same-bar versus bar-to-bar target grip apparatus geometry release direction terminal catch versus landing assistance miss or bailout or repetition endpoint',
        'exactWorkingSpecificationRequired',TRUE,
        'exerciseCardDoesNotClassifyAthletes',TRUE,
        'researchSources',jsonb_build_array(
          'https://www.gymnastics.sport/site/pages/education/agegroup-pk-manual-e.pdf',
          'https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf'),
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=19;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-19',
    display_name='Lache Swing Identity Quarantine — Source 19',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',19,
      'archiveReason','same_bar_bar_to_bar_or_feet_landing_release_and_terminal_contract_undefined',
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
  SELECT d.id,1,d.legacy_id,d.slug,d.name,d.name,d.aliases,d.description,
    d.family_key,'2.0.0',d.card_version,'review',d.content_confidence,60,58,
    d.patterns,d.regions,d.required_equipment,d.optional_equipment,
    jsonb_build_object(
      'apparatus',d.apparatus,'surface','fixed dry inspected hand-contact surfaces with secured mats covering the complete miss and bailout zone',
      'geometry',d.geometry,'clearance',d.clearance,'stationCapacity',1,
      'coachSightline','side or front-quarter view of both hands shoulders trunk hips legs source release target contact terminal checkpoint and full miss/bailout envelope',
      'inspection',jsonb_build_array('bar rail rack anchor and target integrity','diameter surface dryness friction and projections','declared gap height relation and alignment','mat seams movement and coverage','overhead lateral forward rearward and below-apparatus clearance','one-athlete access and emergency route'),
      'changeRule','Grip orientation bar diameter source or target geometry gap height relation assistance terminal checkpoint surface matting or bailout changes require variant selection and complete workout revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyAthletes',TRUE,'readinessIsWorkoutInput',TRUE,
      'readinessFacts',jsonb_build_array('current symptoms and restrictions are checked','exact active-hang grip and bailout are understood','selected source target and assistance contract pass inspection','coach can observe and stop the complete attempt','same-session grip shoulder swing release catch and landing exposure is within the declared budget'),
      'excludeOrReferPerFacilityPolicy',jsonb_build_array('pain numbness tingling weakness dizziness faintness vision change nausea panic unusual breathlessness or inability to communicate','unresolved restriction requiring clinical or organizational clearance','unsafe grip apparatus mats clearance supervision target or bailout conditions'),
      'noUniversalEligibilityAgeOrReadinessThresholdClaimed',TRUE),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,'identityContract',d.identity_contract,
      'workingGripConstraint','bilateral closed overgrip on each declared horizontal bar; this is a conservative Vortex working constraint, not a universal governing-body prescription',
      'workingTerminalConstraint',d.terminal_contract,
      'researchSources',jsonb_build_array(
        'https://www.gymnastics.sport/site/pages/education/agegroup-pk-manual-e.pdf',
        'https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202025.pdf',
        'https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf',
        'https://ojs.ub.uni-konstanz.de/cpa/article/view/2969',
        'https://doi.org/10.1016/j.jbiomech.2016.11.048',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC6458579/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12088353/',
        'https://pubmed.ncbi.nlm.nih.gov/23860830/'),
      'confidenceBySection',jsonb_build_object('identity',d.identity_confidence,'taxonomy',86,'anatomy',74,'difficulty',60,'load',62,'fatigueRecovery',50,'constraints',78,'dosage',44,'instructions',d.identity_confidence-4,'alternates',88,'media',58),
      'unresolvedClaims',jsonb_build_array('one universal ideal grip tap amplitude release instant catch or landing technique','individual shoulder elbow wrist hand spinal or landing load','universal readiness eligibility dose frequency recovery progression or safety threshold','numeric difficulty calibration','media playback exactness captions accessibility quality safety conflicts and approval'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('finger and forearm flexors','latissimus dorsi','serratus anterior and trapezius','deltoids','abdominal wall','hip flexors and extensors'),
      'secondaryMuscles',CASE d.card_key WHEN 'precision' THEN jsonb_build_array('biceps and triceps','rotator cuff','spinal extensors','gluteal muscles','quadriceps','hamstrings','calf musculature') ELSE jsonb_build_array('biceps and triceps','rotator cuff','pectoralis major','spinal extensors','gluteal muscles','quadriceps and hamstrings') END,
      'stabilizers',jsonb_build_array('hand wrist and elbow stabilizers','scapular stabilizers and rotator cuff','deep trunk stabilizers','pelvic and hip stabilizers','knee ankle and foot stabilizers when landing or bailing'),
      'joints',jsonb_build_array('fingers and hands','wrists and radioulnar joints','elbows','glenohumeral and scapulothoracic articulations','cervical thoracic and lumbar spine','pelvis','hips','knees','ankles and feet'),
      'jointActions',d.joint_actions,'planes',jsonb_build_array('sagittal primary','frontal stabilization','transverse stabilization'),
      'laterality','bilateral symmetrical source support; both hands remain together for bar contact and any valid target catch, and precision landing requires simultaneous bilateral feet; turns and unilateral catches are different identities',
      'evidenceBoundary','Joint actions and primary tissue demands are research-informed. Exact timing force distribution and load vary with anthropometry grip bar compliance swing amplitude release target geometry assistance and fatigue and are not quantified for every athlete.'),
    jsonb_build_object(
      'whyItMatters',d.why_it_matters,'primaryCue',d.athlete_cue,
      'expectedSensations',jsonb_build_array('firm symmetrical grip','active shoulders and braced trunk','organized hollow and arch positions','declared catch or landing absorption'),
      'unexpectedSensations',jsonb_build_array('pain pinch tearing or sudden pressure','numbness tingling weakness dizziness nausea or vision change','uncontrolled shoulder traction elbow collapse hand slip rotation fall or apparatus contact'),
      'painGuidance','Stop immediately, use the declared bailout if possible, tell the coach exactly what occurred, and follow facility escalation policy; never repeat to test pain.',
      'selfChecks',d.self_checks,'accessibility',jsonb_build_array('plain-language action and stop cue','visual source target and bailout markers','coach demonstration or no-flight walkthrough','written contact and terminal checklist'),
      'mediaAlternatives',jsonb_build_array('written sequence','coach demonstration','still-frame start release contact and endpoint checklist'),
      'notReadinessOrSkillClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',d.observation,
      'faultCorrections',jsonb_build_object('passive_or_asymmetric_shoulders','stop and return to a separately reviewed lower-demand action','lost_hollow_arch_timing','reduce amplitude and stop before adding speed or distance','grip_or_target_error','end and record the attempt; inspect and reselect the exact station','uncontrolled_catch_landing_or_bailout','secure the lane and follow incident policy before any further exposure'),
      'demonstrationPlan','Show exact grip apparatus geometry start action release or no-release rule target contact terminal checkpoint invalid examples stop signal and bailout without implying approval.',
      'groupManagement',jsonb_build_array('one athlete in the complete swing flight catch landing and bailout envelope','coach controls entry and station release','next athlete waits outside every fall path','record valid invalid partial assisted and incident attempts'),
      'modificationDecisionTree',jsonb_build_array('stop for symptoms or unsafe environment','reduce attempts or amplitude and increase rest first','change geometry grip assistance catch or landing only through an exact reviewed variant or definition','never turn a miss into an unplanned save or connection'),
      'doNotUseWhen',jsonb_build_array('exact start grip apparatus target or bailout cannot be established','coach cannot see or control the full envelope','same-session grip shoulder swing release catch or landing budget is reached'),
      'skillTransferNotAssumed',TRUE),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity or variant mismatch','apparatus surface target mat or clearance defect','symptom fall miss or incident','instruction rendering or accessibility conflict','dose duration contact or fatigue mismatch','media or evidence issue'),
      'supportEscalation',jsonb_build_object('urgent','stop secure the station and follow emergency policy for acute symptoms fall head or neck contact or inability to exit','clinical','refer symptom and return decisions per facility policy','content','quarantine identity dose evidence media or instruction conflicts until qualified review'),
      'retentionPolicy','Persist definition variant grip source target geometry assistance planned and actual dose every valid invalid partial assisted and incident attempt every hand foot or unplanned contact first fault symptoms duration substitution and version lineage.',
      'changeImpactPolicy','Any identity grip geometry assistance action release target terminal surface dose media or stop-rule change invalidates cached selection duration logistics persistence substitution and both renderings and requires complete revalidation.',
      'feedbackChannels',jsonb_build_array('athlete symptom fear and clarity report','coach first-fault station and exposure report','support issue and incident queue'),
      'noApprovalInference',TRUE)
  FROM (VALUES
    (lache_definition,19::BIGINT,'lache','two-bar-lache-transfer-retained-catch','Two-Bar Lache Transfer to Retained Catch',ARRAY['Lache','Laché','Lache Swing','Lache Swings','Bar-to-Bar Lache','Bar to Bar Lache']::TEXT[],'From an active bilateral overgrip on a fixed source horizontal bar, use an organized hollow-arch tap swing, release both hands, travel forward without a turn or flip, catch a second fixed horizontal bar with both hands, and retain the catch through the declared first post-catch rearward apex without re-release, slip, unintended contact, rescue, or connection.','two_bar_lache_transfer_retained_catch',2,84,88,ARRAY['hang','brace','reach','catch']::TEXT[],ARRAY['full_body','eye_hand','hand','wrist','elbow','shoulder','scapula','spine','core','pelvis','hip','knee','ankle','foot']::TEXT[],ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],ARRAY[]::TEXT[],'two fixed horizontal bars with parallel axes; target ahead in the declared sagittal swing plane; quantity two','gap centerline offset bar height relation diameter and catch surface are measured and persisted','complete source swing plus forward flight target catch rebound swing miss fall and coach-access envelope','active_bilateral_source_hang_tap_release_no_turn_bilateral_target_catch_retained_to_first_rearward_apex','retain two-hand target catch through first post-catch bottom crossing to first controlled rearward apex; later connection is outside the repetition','Transfers the body across a declared gap without ground contact while preserving exact release catch and finite endpoint data.','Swing organized, throw the source behind you, reach together, catch strong, and keep both hands through the first back swing.',jsonb_build_array('both hands use the declared overgrip','target remains ahead','both hands release together','both hands catch together','catch is retained to the endpoint'),jsonb_build_array('grip and active start','hollow-arch rhythm','release instant and trajectory','two-hand target reach and catch','scapular elbow trunk absorption','first rearward apex','miss bailout and symptoms'),jsonb_build_array('loaded finger flexion and wrist stabilization','elbow extension control with possible flexion during absorption','scapular depression upward-rotation and protraction-retraction control','shoulder flexion-extension through swing and catch','trunk hollow-arch flexion-extension control','hip flexion-extension with knee organization','whole-body deceleration at target catch')),
    (tap_definition,NULL::BIGINT,'tap','bar-hollow-arch-tap-swing','Bar Hollow–Arch Tap Swing',ARRAY['Tap Swing','Bar Tap Swing','Hollow Arch Swing','Beat Swing','Parkour Bar Swing']::TEXT[],'Maintain a bilateral closed overgrip on one fixed horizontal bar and complete one declared hollow-arch swing cycle from the forward-travel bottom crossing through both apices back to the next forward-travel bottom crossing, with active shoulders and organized trunk and hips; neither hand releases, regrasps, changes grip, or contacts another structure.','bar_hollow_arch_tap_swing_no_release',1,80,84,ARRAY['hang','brace']::TEXT[],ARRAY['full_body','hand','wrist','elbow','shoulder','scapula','spine','core','pelvis','hip','knee','ankle','foot']::TEXT[],ARRAY['pull_up_bar','mat','timer']::TEXT[],ARRAY['tape_measure']::TEXT[],'one fixed horizontal bar; quantity one; no target apparatus in the scored action','bar diameter height grip spacing swing amplitude and bottom-crossing direction are declared','complete forward and rear swing body envelope plus fall bailout and coach-access zone','single_bar_bilateral_overgrip_full_hollow_arch_cycle_without_release','ends at the next forward-travel bottom crossing after both swing apices; release dismount or target contact is outside the repetition','Builds repeatable source-bar swing shape and phase timing without adding release flight catch or landing.','Keep both hands fixed, shoulders active, move as one hollow-arch shape, and finish the full cycle without releasing.',jsonb_build_array('same bar and overgrip throughout','active shoulders','declared forward-travel start phase','both apices completed','next matching bottom crossing reached','no hand release'),jsonb_build_array('grip and start phase','active shoulders','hollow and arch organization','amplitude and direction','no release or regrasp','matching terminal phase','symptoms and fall path'),jsonb_build_array('sustained finger flexion and wrist stabilization','predominantly straight-elbow support with controlled shoulder motion','scapular elevation-depression and protraction-retraction control','shoulder flexion-extension','trunk and hip flexion-extension between hollow and arch','lower-limb shape stabilization')),
    (precision_definition,NULL::BIGINT,'precision','lache-precision-two-foot-stick','Lache Precision to Two-Foot Stick',ARRAY['Lache Precision','Laché Precision','Lache to Precision','Swing Release to Precision','Bar Lache Precision']::TEXT[],'From an active bilateral overgrip on a fixed horizontal bar, use an organized hollow-arch tap swing, release both hands, travel forward without a turn or flip, land both feet simultaneously on the declared low horizontal target, and retain a controlled two-foot stick for two seconds without hand contact, step, fall, collision, or connection.','lache_precision_bilateral_foot_stick',1,78,82,ARRAY['hang','brace','reach','land']::TEXT[],ARRAY['full_body','eye_hand','hand','wrist','elbow','shoulder','scapula','spine','core','pelvis','hip','knee','ankle','foot']::TEXT[],ARRAY['pull_up_bar','platform','mat','tape_measure','timer']::TEXT[],ARRAY['line_tape']::TEXT[],'one fixed source horizontal bar and one secured low horizontal landing target; no target bar catch','source bar height diameter target top dimensions height offset gap and landing zone are measured and persisted','complete swing release flight target overrun underrun fall collision bailout and coach-access envelope','source_bar_tap_release_no_turn_simultaneous_two_foot_precision_stick','simultaneous two-foot target contact followed by a controlled two-second stick; any later action is outside the repetition','Combines a bar release with an exact two-foot target landing without conflating it with a bar-to-bar catch or standing Precision Jump.','Swing organized, release together, find the target, land both feet together, and freeze for two seconds.',jsonb_build_array('declared overgrip and source bar','both hands release together','no target hand contact','both feet contact target together','two-second stick','no step or fall'),jsonb_build_array('grip and active start','hollow-arch rhythm','release and target tracking','simultaneous feet','landing absorption and two-second stick','miss bailout and symptoms'),jsonb_build_array('loaded finger flexion and wrist stabilization before release','scapular and shoulder swing control','trunk and hip hollow-arch organization','knee and hip flexion for bilateral landing absorption','ankle dorsiflexion and plantar-flexor control','foot stabilization on the target'))
  ) d(id,legacy_id,card_key,slug,name,aliases,description,family_key,card_version,content_confidence,identity_confidence,patterns,regions,required_equipment,optional_equipment,apparatus,geometry,clearance,identity_contract,terminal_contract,why_it_matters,athlete_cue,self_checks,observation,joint_actions)
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
  SELECT v.id,v.definition_id,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,'absoluteLoadDemand',v.physical,
      'physicalDifficulty',v.physical,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'coordinationDemand',v.coordination,'impact',v.impact,
      'supervisionDemand',v.supervision,'failureConsequence',v.failure,
      'workCapacityDemand',v.work_capacity,
      'relativeStrengthDemand',v.relative_strength,'mobilityDemand',v.mobility,
      'balanceDemand',v.balance,'stabilityDemand',v.stability,
      'speedDemand',v.speed,'decisionDemand',v.decision_demand,
      'inversionDemand',v.inversion,'fearExposure',v.fear,
      'complexityDimensions',jsonb_build_object('gripAndStartPhase',v.complexity-8,'wholeBodyTiming',v.coordination,'trajectoryOrAmplitude',v.complexity-4,'terminalPrecision',v.stability,'errorDetectionAndBailout',v.decision_demand),
      'physicalDimensions',jsonb_build_object('relativeSuspendedStrength',v.relative_strength,'gripAndUpperExtremityLoad',v.physical,'swingOrFlightSpeed',v.speed,'catchOrLandingAbsorption',v.eccentric),
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'overallFormula','max_exercise_complexity_physical_difficulty',
      'candidateIndependentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'representation','exact_working_specification',
      'actionFamily',v.action_family,'startPosition',v.start_position,
      'gripContract','bilateral closed overgrip with declared hand spacing on inspected fixed horizontal source bar; grip remains symmetrical and unchanged until the required release or terminal phase',
      'apparatusContract',v.apparatus_contract,'actionContract',v.action_contract,
      'terminalContract',v.terminal_contract,
      'assistanceContract',v.assistance_contract,
      'repetitionBoundary',v.repetition_boundary,
      'invalidatingEvents',v.invalid_events,'equipmentRequired',v.equipment,
      'identityQuarantine',FALSE,'workingGripAndEndpointRequireHumanReview',TRUE),
    'review',
    jsonb_build_object(
      'externalLoadMethod',v.load_method,
      'supportLoad','bodyweight segment inertia swing amplitude and acceleration are transmitted through two hands before any release; exact left-right and joint distribution is not assumed',
      'sourceLoadedHandSupportsPerRep',2,
      'targetCatchHandContactsPerRep',v.catch_contacts,
      'landingFootContactsPerRep',v.foot_contacts,
      'plannedImpactContacts',v.impact_contacts,
      'gripDemand',v.grip,'spinalLoading',v.spinal_loading,
      'eccentricStress',v.eccentric,'impactClass',v.impact_class,
      'dominantContraction',v.dominant_contraction,
      'effectiveLoadDrivers',jsonb_build_array('body mass and anthropometry','grip spacing and bar diameter surface compliance and friction','swing amplitude velocity and timing','gap target height and trajectory','catch or landing geometry','assistance','valid invalid partial and incident attempts','prior grip shoulder swing catch and landing fatigue'),
      'loadTracking',jsonb_build_array('two source loaded hand supports per repetition','target hand or foot contacts','valid invalid partial assisted and incident attempts','unplanned contact miss fall rescue or bailout','same-session hang pull swing release catch brachiation dismount and landing exposure')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip_fatigue,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',v.impact,'recoveryHours',v.recovery_hours,
      'recoveryWindow','candidate planning estimate only; adjust for novelty amplitude speed gap geometry assistance symptoms and adjacent hanging pulling swinging catching or landing exposure',
      'primaryFatigueSites',jsonb_build_array('hands and forearms','wrists elbows shoulders and scapular musculature','trunk and hips','knees ankles and feet when landing or bailing'),
      'earlyFatigueSignals',jsonb_build_array('grip shift or delayed release','passive or asymmetric shoulders','broken hollow-arch rhythm','late target focus or one-hand reach','hard bent-elbow catch uncontrolled rebound or unstable landing','slower stop response'),
      'downstreamConflicts',jsonb_build_array('priority grip climbing pull-up or hanging work','bar release regrasp brachiation or ninja work','high-impact jump landing or parkour lines','fatigued overhead or shoulder training')),
    jsonb_build_object(
      'trainingStimuli',v.training_stimuli,
      'stimulusDose',jsonb_build_object('primary','quality_terminated_valid_attempts_or_cycles','countInvalidPartialAssistedAndIncidentAttemptsAndEveryContactAsExposure',TRUE,'fatigueCeiling','low_for_technical_learning'),
      'weeklyExposure','Combine every valid invalid partial assisted and incident attempt plus loaded hand catch foot and unplanned contacts with all hanging pull-up climbing swing release regrasp brachiation dismount jump and landing work.',
      'prerequisites',jsonb_build_array('exact active hang grip start phase and bailout can be established','selected apparatus geometry mats clearance and target pass inspection','current hanging swing catch or landing actions are symptom free','athlete understands stop miss bailout and terminal rules'),
      'completionCriteria',v.completion_criteria,
      'sequenceRules',jsonb_build_array('place while grip shoulders attention and target tracking are fresh','do not use as an unplanned race or fatigue circuit','do not add turns flips releases catches landings or connections outside the selected identity','stop before the first grip shoulder rhythm trajectory catch or landing change'),
      'pairingCompatibility',jsonb_build_array('low-demand mobility after recovery','noncompeting visualization or instruction','technical work without shared grip shoulder swing release catch or landing fatigue'),
      'interferenceRules',jsonb_build_array('do not pre-fatigue grip shoulder or trunk control','do not share a live fall lane','revalidate after grip geometry assistance target dose or endpoint change'),
      'uncertaintyPolicy','If grip start phase apparatus geometry action release target contact endpoint miss or assistance is uncertain, do not select; quarantine and resolve the exact contract.',
      'selection',jsonb_build_object('phaseDefault','movement_intelligence','outputOnlyForDeclaredProfiles',TRUE,'readinessIsWorkoutInput',TRUE,'exerciseDifficultyDoesNotClassifyAthletes',TRUE),
      'publicationQuarantined',TRUE)
  FROM (VALUES
    (same_height_variant,lache_definition,'lache','same-height-independent-retained-catch','Same-Height Independent Two-Bar Lache to Retained Catch',ARRAY['same_height','independent','bilateral_overgrip','retained_catch']::TEXT[],82,78,82,70,76,82,88,86,64,60,48,78,58,84,88,94,18,82,78,86,92,30,'active bilateral overgrip hang on source bar at declared forward-travel start phase','two parallel fixed horizontal bars with target centerline ahead at the same declared bar height','organized hollow-arch tap swing then simultaneous two-hand source release and no-turn forward flight to simultaneous two-hand target catch','retain target with both hands through first post-catch bottom crossing to first controlled rearward apex without re-release or connection','independent scored action; coach controls station but no physical contact or rescue is valid','begins at first intentional swing action from declared start phase; ends at first controlled rearward apex after target catch','dynamic_bodyweight_two_bar_release_to_bilateral_hand_catch',2,0,2,'high_dynamic_bilateral_hand_catch_candidate','suspended swing acceleration release flight and eccentric target-catch absorption','no physical contact is planned; any coach contact makes the attempt assisted or invalid',ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],jsonb_build_array('source overgrip support','hollow-arch tap and projection','simultaneous release and target reach','two-hand catch absorption','retained rebound swing'),jsonb_build_array('correct source and target','symmetrical release and catch','no turn flip or collision','retained two-hand endpoint','complete exposure record'),jsonb_build_array('grip shift slip or regrasp','one-hand or missed target catch','turn flip unintended apparatus floor or body contact','release from target before endpoint','coach rescue symptom or uncontrolled bailout')),
    (higher_target_variant,lache_definition,'lache','higher-target-independent-retained-catch','Higher-Target Independent Two-Bar Lache to Retained Catch',ARRAY['higher_target','independent','bilateral_overgrip','retained_catch']::TEXT[],88,84,88,74,82,88,92,90,70,64,54,84,62,88,92,96,20,88,84,90,96,36,'active bilateral overgrip hang on source bar at declared forward-travel start phase','two parallel fixed horizontal bars with target centerline ahead and target catch surface measurably higher than source','organized hollow-arch tap swing then simultaneous release and no-turn forward-upward flight to simultaneous two-hand higher-target catch','retain target with both hands through first post-catch bottom crossing to first controlled rearward apex without re-release or connection','independent scored action; coach controls station but no physical contact or rescue is valid','begins at first intentional swing action; ends at first controlled rearward apex after higher-target catch','dynamic_bodyweight_two_bar_release_to_higher_bilateral_hand_catch',2,0,2,'high_dynamic_higher_bilateral_hand_catch_candidate','suspended acceleration upward-forward projection and eccentric higher-target catch absorption','no physical contact is planned; any coach contact makes the attempt assisted or invalid',ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],jsonb_build_array('source support and tap','higher-target projection','release timing and target tracking','two-hand catch absorption','retained rebound swing'),jsonb_build_array('declared higher target','symmetrical release and catch','no collision turn or flip','retained endpoint','complete record'),jsonb_build_array('grip shift slip or regrasp','underreach collision one-hand or missed catch','turn flip floor or unintended contact','release before endpoint','coach rescue symptom or uncontrolled bailout')),
    (lower_target_variant,lache_definition,'lache','lower-target-independent-retained-catch','Lower-Target Independent Two-Bar Lache to Retained Catch',ARRAY['lower_target','independent','bilateral_overgrip','retained_catch']::TEXT[],86,82,86,72,80,86,90,88,68,62,58,86,64,86,92,96,20,88,84,90,96,36,'active bilateral overgrip hang on source bar at declared forward-travel start phase','two parallel fixed horizontal bars with target centerline ahead and target catch surface measurably lower than source','organized hollow-arch tap swing then simultaneous release and no-turn forward-downward flight to simultaneous two-hand lower-target catch','retain target with both hands through first post-catch bottom crossing to first controlled rearward apex without re-release or connection','independent scored action; coach controls station but no physical contact or rescue is valid','begins at first intentional swing action; ends at first controlled rearward apex after lower-target catch','dynamic_bodyweight_two_bar_release_to_lower_bilateral_hand_catch',2,0,2,'high_dynamic_lower_bilateral_hand_catch_candidate','suspended acceleration forward-downward flight and eccentric lower-target catch absorption','no physical contact is planned; any coach contact makes the attempt assisted or invalid',ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],jsonb_build_array('source support and tap','lower-target trajectory','release timing and target tracking','two-hand catch absorption','retained rebound swing'),jsonb_build_array('declared lower target','symmetrical release and catch','no collision turn or flip','retained endpoint','complete record'),jsonb_build_array('grip shift slip or regrasp','overshoot collision one-hand or missed catch','turn flip floor or unintended contact','release before endpoint','coach rescue symptom or uncontrolled bailout')),
    (assisted_variant,lache_definition,'lache','same-height-coach-secured-catch','Same-Height Coach-Secured Two-Bar Lache Catch',ARRAY['same_height','qualified_assistance','bilateral_overgrip','retained_catch']::TEXT[],76,72,74,68,70,78,82,78,54,54,42,70,54,80,94,88,18,72,70,82,86,30,'active bilateral overgrip hang on source bar at declared forward-travel start phase','two parallel fixed horizontal bars at the same declared height and a qualified coach stationed at the target outside the flight path','organized hollow-arch tap swing then simultaneous release and no-turn forward flight to bilateral target catch with only the predeclared minimal securing action','retain target with both hands through first post-catch bottom crossing to first controlled rearward apex; record assistance location timing and amount','qualified coach may minimally secure the short-gap catch against slip or unwanted rotation; pulling propulsion carrying or unplanned saving invalidates the exact variant','begins at first intentional swing action; ends at first controlled rearward apex after the planned minimally secured catch','dynamic_bodyweight_two_bar_release_to_coach_secured_bilateral_catch',2,0,2,'high_dynamic_assisted_hand_catch_candidate','suspended acceleration release and target catch with declared minimal coach securing contact','qualified coach and exact contact zone timing purpose and maximum intervention are planned; every contact is recorded',ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],jsonb_build_array('organized short-gap transfer','release and two-hand reach','declared minimal catch securing','retained target control'),jsonb_build_array('declared same-height short gap','only planned securing contact','bilateral target catch retained','no pulling carry or rescue','complete assistance record'),jsonb_build_array('grip shift before release','coach propulsion pulling carrying or undeclared contact','one-hand miss turn flip collision or fall','release before endpoint','symptom panic or uncontrolled bailout')),
    (tap_variant,tap_definition,'tap','bilateral-overgrip-full-cycle','Bilateral Overgrip Hollow–Arch Tap Swing — Full Cycle',ARRAY['single_bar','bilateral_overgrip','full_cycle','no_release']::TEXT[],68,64,70,70,58,72,82,76,40,68,28,64,48,74,72,68,12,46,68,80,86,24,'active bilateral overgrip at the forward-travel bottom crossing with declared hand spacing and no external body contact','one fixed horizontal bar; no target bar wall platform or partner contact in the scored cycle','complete one organized hollow-arch oscillation through forward and rear apices while both hands remain fixed','next forward-travel bottom crossing after both apices with grip start direction and body organization retained','coach observes and cues only; any manual propulsion guidance or save makes the cycle assisted or invalid','begins at the declared forward-travel bottom crossing; ends at the next matching forward-travel bottom crossing after both apices','continuous_bodyweight_bilateral_bar_support_hollow_arch_cycle',0,0,0,'no_planned_release_catch_or_landing_impact','continuous suspended grip shoulder trunk and hip oscillation with no release','no physical assistance is planned; any coach contact is recorded and invalidates independent execution',ARRAY['pull_up_bar','mat','timer']::TEXT[],jsonb_build_array('active bilateral hang','organized hollow-arch rhythm','repeatable swing phase','no-release grip endurance'),jsonb_build_array('matching start and terminal phase','both hands fixed','active shoulders','both apices completed','no collision release or symptom','complete cycle count'),jsonb_build_array('hand slide regrasp release or orientation change','passive asymmetric or painful shoulder position','knee kick lumbar break twist or uncontrolled amplitude','apparatus mat or person contact','missed terminal phase symptom or fall')),
    (precision_variant,precision_definition,'precision','low-target-bilateral-two-second-stick','Lache Precision to Low Target — Bilateral Two-Second Stick',ARRAY['source_bar','low_target','bilateral_feet','two_second_stick','no_turn']::TEXT[],86,82,84,72,82,86,90,88,70,60,66,88,64,84,94,96,18,90,84,86,96,36,'active bilateral overgrip hang on source bar at declared forward-travel start phase','one fixed source horizontal bar and a secured low horizontal landing platform centered ahead in the sagittal plane; source-target gap height and top dimensions declared','organized hollow-arch tap swing then simultaneous release and no-turn forward flight to simultaneous two-foot target landing; hands do not contact target','controlled bilateral target stick for two seconds with no step fall hand contact collision or connection','coach controls station and bailout but does not propel carry or catch a valid repetition; any intervention is recorded and invalidates the independent stick','begins at first intentional swing action; ends after simultaneous target feet and two-second stable stick','dynamic_bodyweight_bar_release_to_bilateral_precision_landing',0,2,2,'high_dynamic_bilateral_precision_landing_candidate','suspended acceleration release flight and lower-extremity landing absorption on a restricted target','no physical assistance is planned; any contact or rescue invalidates independent execution',ARRAY['pull_up_bar','platform','mat','tape_measure','timer']::TEXT[],jsonb_build_array('source-bar tap and release','target tracking','simultaneous two-foot placement','landing absorption and stick'),jsonb_build_array('declared source and target','simultaneous release','no turn flip or hand target contact','both feet together','two-second stick','complete exposure record'),jsonb_build_array('grip shift slip or regrasp','one-hand release or unintended rotation','target underreach overreach collision or hand contact','asynchronous one-foot or missed landing','step fall connection rescue symptom or uncontrolled bailout'))
  ) v(id,definition_id,action_family,variant_key,display_name,modifiers,complexity,physical,relative_strength,mobility,balance,stability,coordination,speed,decision_demand,work_capacity,impact,eccentric,spinal_loading,grip,supervision,failure,inversion,fear,local_fatigue,grip_fatigue,technical_fatigue,recovery_hours,start_position,apparatus_contract,action_contract,terminal_contract,assistance_contract,repetition_boundary,load_method,catch_contacts,foot_contacts,impact_contacts,impact_class,dominant_contraction,assistance_text,equipment,training_stimuli,completion_criteria,invalid_events)
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,requirements_json=EXCLUDED.requirements_json,
    status='review',load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT gen_random_uuid(),p.variant_id,p.profile_key,p.phase_key,p.role,
    CASE p.phase_key
      WHEN 'prepare_and_access' THEN 'Rehearse the exact grip, source and target geometry, start phase, action, terminal checkpoint, stop, and bailout at minimal exposure.'
      WHEN 'output' THEN 'Express the exact swing, release, trajectory, target contact, and endpoint with maximal intended quality and full recovery, never as a fatigue test.'
      ELSE 'Practice repeatable grip, hollow-arch timing, release or no-release rule, target contact, and finite terminal checkpoint while fresh.' END,
    p.suitability,p.alignment,
    jsonb_build_object(
      'primaryObjective',CASE p.phase_key WHEN 'prepare_and_access' THEN 'identity_station_and_stop_rehearsal' WHEN 'output' THEN 'high_quality_swing_release_and_target_output' ELSE 'bar_swing_release_contact_motor_learning' END,
      'actionFamily',p.action_family,'variant',p.variant_key,
      'validOnlyWhenExactVariantPasses',TRUE,
      'fatigueCeiling',CASE p.phase_key WHEN 'output' THEN 'very_low' ELSE 'low' END,
      'notConditioningMaximumOrSkillRanking',TRUE),
    jsonb_build_object(
      'sets',jsonb_build_object('minimum',p.sets_min,'target',p.sets_target,'maximum',p.sets_max),
      'repetitionsOrCycles',jsonb_build_object('minimum',p.reps_min,'target',p.reps_target,'maximum',p.reps_max),
      'restSeconds',jsonb_build_object('minimum',p.rest_min,'target',p.rest_target,'maximum',p.rest_max),
      'validRepetition',CASE p.action_family
        WHEN 'tap' THEN 'declared forward-travel bottom crossing through both apices to the next matching bottom crossing with both hands fixed'
        WHEN 'precision' THEN 'source tap and simultaneous release to simultaneous two-foot target contact and two-second stick without turn hand contact step or fall'
        ELSE 'source tap and simultaneous release to simultaneous two-hand target catch retained through first rearward apex without turn re-release or unintended contact' END,
      'countInvalidPartialAssistedIncidentAttemptsAsExposure',TRUE,
      'countLoadedHandCatchFootAndUnplannedContacts',TRUE,
      'effortCap','stop_before_grip_shoulder_rhythm_trajectory_contact_or_endpoint_deteriorates',
      'doseAuthority','candidate_profile_pending_human_review'),
    CASE p.action_family
      WHEN 'tap' THEN 'Exact bar and overgrip, forward-travel start phase, active shoulders, organized hollow-arch cycle, both apices, matching terminal crossing, no release, breathing, and symptoms pass; the final valid cycle resembles the first.'
      WHEN 'precision' THEN 'Exact source and target, active overgrip start, organized tap and release, no turn, simultaneous target feet, controlled two-second stick, no collision or extra contact, breathing, and symptoms pass.'
      ELSE 'Exact two-bar geometry, active source overgrip, organized tap and release, no turn, simultaneous two-hand target catch, retained endpoint, no collision or rescue outside the assisted variant, breathing, and symptoms pass.' END,
    ARRAY[
      'Sharp or increasing hand wrist elbow shoulder neck spine hip knee ankle or foot pain.',
      'Numbness tingling weakness vision change dizziness nausea faintness panic unusual breathlessness or inability to answer the stop cue.',
      'A source or target bar rail rack anchor platform mat marker timer or clearance becomes unsafe or changes from the selected specification.',
      'Grip orientation hand spacing start phase target relation assistance or terminal checkpoint differs from the selected variant.',
      'A hand slides regrasps releases asynchronously or changes orientation, or the shoulder or elbow collapses.',
      'Hollow-arch organization breaks, swing becomes uncontrolled, the athlete twists, or an undeclared turn or flip begins.',
      'The target is missed contacted one-sidedly or struck unexpectedly, or a catch landing rebound swing or bailout is uncontrolled.',
      'An unplanned coach rescue body contact apparatus collision fall or exit occurs.',
      'The coach loses the full sightline or another person enters the swing flight catch landing or bailout envelope.',
      'The planned attempt cycle loaded-hand catch landing impact or shared fatigue budget is reached.'
    ]::TEXT[],
    'Confirm the exact definition and variant, bilateral overgrip, hand spacing, source and target geometry, measured gap and height relation, surface and mat inspection, assistance, miss and bailout plan, current symptoms, prior grip shoulder swing catch and landing exposure, dose, rest, and stop signal. Observe and record every attempt, contact, endpoint, first fault, and actual duration; revalidate the full workout after any change.',
    CASE p.action_family
      WHEN 'tap' THEN 'Keep both hands fixed, shoulders active, and move as one hollow-arch shape. Complete the full cycle and stop at the first slip, shape change, or symptom.'
      WHEN 'precision' THEN 'Swing organized, release both hands together, find the target, land both feet together, and freeze for two seconds. Stop at the first miss or symptom.'
      ELSE 'Swing organized, release together, reach together, catch strong, and keep both hands through the first back swing. Stop at the first miss or symptom.' END,
    CASE p.phase_key
      WHEN 'prepare_and_access' THEN 'Clearer exact grip, station, action, target, endpoint, stop, and bailout readiness with minimal fatigue.'
      WHEN 'output' THEN 'More repeatable high-quality swing-release trajectory and exact target contact under full recovery.'
      ELSE 'More repeatable hollow-arch timing, grip control, target tracking, release or no-release behavior, and exact terminal control.' END,
    p.equipment,
    jsonb_build_object(
      'stationType',p.station_type,'athletesPerStation',1,
      'barQuantity',CASE p.action_family WHEN 'lache' THEN 2 ELSE 1 END,
      'setupSeconds',p.setup_seconds,'attemptSeconds',p.attempt_seconds,
      'resetSeconds',p.reset_seconds,'transitionSeconds',25,
      'requiresDirectQualifiedObservation',TRUE,
      'requiresCompleteSwingFlightCatchLandingAndBailoutEnvelope',TRUE,
      'apparatusTargetMatAndClearanceInspectionBeforeEverySet',TRUE,
      'sharedLanePolicy','one athlete moves only after the previous athlete coach and all equipment clear the complete envelope',
      'equipmentOrGeometryChangeInvalidatesCachedLogistics',TRUE),
    p.substitution_ids,'review',
    jsonb_build_object(
      'durationFormula','setup and inspection + sum(each observed attempt or cycle + terminal check + reset + inter-repetition rest) + set rest + transitions',
      'estimateSeconds',p.estimate_seconds,'lowerBoundSeconds',p.lower_seconds,
      'upperBoundSeconds',p.upper_seconds,
      'includeInvalidPartialAssistedAndIncidentAttempts',TRUE,
      'includeEveryEntryMissBailoutContactAndEquipmentReset',TRUE,
      'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'regressionOrder',CASE p.action_family
        WHEN 'tap' THEN jsonb_build_array('reduce cycles','reduce amplitude','increase rest','select Active Hang only as a distinct reviewed exercise')
        WHEN 'precision' THEN jsonb_build_array('reduce attempts','reduce gap and target demand','increase rest','select standing Precision Jump or Tap Swing only as a distinct reviewed exercise')
        ELSE jsonb_build_array('reduce attempts','reduce gap within validated station range','increase rest','select coach-secured exact variant or Tap Swing only after full revalidation') END,
      'progressionOrder',CASE p.action_family
        WHEN 'tap' THEN jsonb_build_array('repeat the exact cycle','increase amplitude within reviewed range','select a release-and-catch definition only after full revalidation')
        WHEN 'precision' THEN jsonb_build_array('repeat exact two-foot stick','increase gap within reviewed range','change target height or width only after full revalidation')
        ELSE jsonb_build_array('repeat exact catch endpoint','increase gap within reviewed range','select higher or lower target exact variant after full revalidation','add any connection only as a distinct sequence') END,
      'neverScaleBy',jsonb_build_array('athlete proficiency label','unreviewed grip or apparatus','unplanned assistance or rescue','adding turn flip one-arm catch connection or fatigue repetitions'),
      'revalidateAllGenerationInputs',TRUE),
    jsonb_build_object(
      'planned',jsonb_build_array('definition and variant','grip and hand spacing','source and target geometry','gap and height relation','assistance','sets repetitions or cycles rest','terminal checkpoint','surface matting clearance and supervision'),
      'actual',jsonb_build_array('valid invalid partial assisted and incident attempts','loaded source hands target hand or foot and unplanned contacts','first fault','symptoms and fear','catch or landing endpoint','duration'),
      'cumulativeBudgets',jsonb_build_array('loaded hand supports','dynamic hand catches','foot landings and impact','swing cycles and release attempts','grip shoulder elbow trunk and target-tracking fatigue','same-session hang pull climb brachiation ninja and parkour exposure'),
      'persistenceRequired',TRUE,'coachAndAthleteRenderingRequired',TRUE),
    jsonb_build_object(
      'athletePrompt','Report symptoms fear uncertainty the first changed grip contact trajectory or endpoint and whether the exact catch or stick was retained.',
      'coachPrompt','Record exact definition variant grip geometry assistance every contact first fault symptoms exposure substitution duration and recovery note.',
      'supportPrompt','Quarantine identity apparatus media instruction dose rendering persistence or skill-link mismatches; never convert candidate state into approval.',
      'incidentPrompt','Stop, clear and secure the complete station, assess immediate help needs, document exact contacts and symptoms, and follow facility policy.')
  FROM (VALUES
    (same_height_variant,'lache','same-height-independent-retained-catch','prepare-and-access-rehearsal','prepare_and_access','secondary',82,86,1,1,2,1,1,2,120,150,240,ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],'two_bar_same_height_lache_lane',75,12,30,330,210,540,ARRAY[assisted_variant,tap_variant]::UUID[]),
    (same_height_variant,'lache','same-height-independent-retained-catch','movement-intelligence-quality','movement_intelligence','primary',94,94,2,3,4,2,3,4,150,210,300,ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],'two_bar_same_height_lache_lane',75,12,30,840,480,1260,ARRAY[assisted_variant,tap_variant]::UUID[]),
    (same_height_variant,'lache','same-height-independent-retained-catch','output-quality','output','conditional',86,90,3,4,5,1,2,3,180,240,360,ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],'two_bar_same_height_lache_lane',75,12,35,1020,600,1560,ARRAY[assisted_variant,tap_variant]::UUID[]),
    (higher_target_variant,'lache','higher-target-independent-retained-catch','prepare-and-access-rehearsal','prepare_and_access','secondary',76,84,1,1,2,1,1,2,150,180,300,ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],'two_bar_higher_target_lache_lane',90,12,35,390,240,630,ARRAY[same_height_variant,tap_variant]::UUID[]),
    (higher_target_variant,'lache','higher-target-independent-retained-catch','movement-intelligence-quality','movement_intelligence','primary',90,94,2,3,4,1,2,3,180,240,360,ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],'two_bar_higher_target_lache_lane',90,12,35,960,570,1440,ARRAY[same_height_variant,tap_variant]::UUID[]),
    (higher_target_variant,'lache','higher-target-independent-retained-catch','output-quality','output','conditional',82,90,3,4,5,1,2,3,210,270,420,ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],'two_bar_higher_target_lache_lane',90,12,40,1140,660,1740,ARRAY[same_height_variant,tap_variant]::UUID[]),
    (lower_target_variant,'lache','lower-target-independent-retained-catch','prepare-and-access-rehearsal','prepare_and_access','secondary',76,84,1,1,2,1,1,2,150,180,300,ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],'two_bar_lower_target_lache_lane',90,12,35,390,240,630,ARRAY[same_height_variant,tap_variant]::UUID[]),
    (lower_target_variant,'lache','lower-target-independent-retained-catch','movement-intelligence-quality','movement_intelligence','primary',90,94,2,3,4,1,2,3,180,240,360,ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],'two_bar_lower_target_lache_lane',90,12,35,960,570,1440,ARRAY[same_height_variant,tap_variant]::UUID[]),
    (lower_target_variant,'lache','lower-target-independent-retained-catch','output-quality','output','conditional',82,90,3,4,5,1,2,3,210,270,420,ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],'two_bar_lower_target_lache_lane',90,12,40,1140,660,1740,ARRAY[same_height_variant,tap_variant]::UUID[]),
    (assisted_variant,'lache','same-height-coach-secured-catch','prepare-and-access-rehearsal','prepare_and_access','secondary',86,90,1,1,2,1,1,2,120,150,240,ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],'two_bar_coach_secured_short_lache_lane',90,15,40,360,210,600,ARRAY[tap_variant,same_height_variant]::UUID[]),
    (assisted_variant,'lache','same-height-coach-secured-catch','movement-intelligence-quality','movement_intelligence','primary',94,94,2,3,4,2,3,4,150,210,300,ARRAY['pull_up_bar','mat','tape_measure','timer']::TEXT[],'two_bar_coach_secured_short_lache_lane',90,15,40,900,510,1380,ARRAY[tap_variant,same_height_variant]::UUID[]),
    (tap_variant,'tap','bilateral-overgrip-full-cycle','prepare-and-access-rehearsal','prepare_and_access','secondary',88,90,1,1,2,1,2,3,60,90,150,ARRAY['pull_up_bar','mat','timer']::TEXT[],'single_bar_tap_swing_lane',50,8,25,270,150,450,ARRAY[active_hang_variant]::UUID[]),
    (tap_variant,'tap','bilateral-overgrip-full-cycle','movement-intelligence-quality','movement_intelligence','primary',96,94,2,3,4,2,4,6,90,120,210,ARRAY['pull_up_bar','mat','timer']::TEXT[],'single_bar_tap_swing_lane',50,8,25,690,390,1050,ARRAY[active_hang_variant]::UUID[]),
    (precision_variant,'precision','low-target-bilateral-two-second-stick','prepare-and-access-rehearsal','prepare_and_access','secondary',78,86,1,1,2,1,1,2,150,180,300,ARRAY['pull_up_bar','platform','mat','tape_measure','timer']::TEXT[],'bar_to_low_precision_target_lane',90,12,40,390,240,660,ARRAY[tap_variant,standing_precision_variant]::UUID[]),
    (precision_variant,'precision','low-target-bilateral-two-second-stick','movement-intelligence-quality','movement_intelligence','primary',92,94,2,3,4,1,2,3,180,240,360,ARRAY['pull_up_bar','platform','mat','tape_measure','timer']::TEXT[],'bar_to_low_precision_target_lane',90,12,40,960,570,1500,ARRAY[tap_variant,standing_precision_variant]::UUID[]),
    (precision_variant,'precision','low-target-bilateral-two-second-stick','output-quality','output','conditional',84,90,3,4,5,1,2,3,210,270,420,ARRAY['pull_up_bar','platform','mat','tape_measure','timer']::TEXT[],'bar_to_low_precision_target_lane',90,12,45,1140,660,1800,ARRAY[tap_variant,standing_precision_variant]::UUID[])
  ) p(variant_id,action_family,variant_key,profile_key,phase_key,role,suitability,alignment,sets_min,sets_target,sets_max,reps_min,reps_target,reps_max,rest_min,rest_target,rest_max,equipment,station_type,setup_seconds,attempt_seconds,reset_seconds,estimate_seconds,lower_seconds,upper_seconds,substitution_ids)
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
        'https://www.gymnastics.sport/site/pages/education/agegroup-pk-manual-e.pdf',
        'https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202025.pdf',
        'https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf'),
      'identityOnlyNeighborStillRequiresItsOwnAudit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (lache_definition,tap_definition,'release_catch_vs_no_release_cycle','Two-bar transfer releases the source and catches another bar.','One-bar tap swing retains both hands and ends at a matching swing phase.','release_target_catch_and_terminal_support_change'),
    (lache_definition,precision_definition,'target_bar_catch_vs_two_foot_landing','Two-bar transfer ends in retained bilateral target-bar support.','Lache Precision ends in a simultaneous two-foot target stick with no target hand contact.','terminal_contact_interface_and_absorption_change'),
    (lache_definition,active_hang_definition,'dynamic_transfer_vs_static_active_hang','Lache includes swing release flight catch and retained rebound control.','Active Hang is static bilateral bar support with no flight or target change.','dynamic_release_flight_catch_vs_static_support'),
    (lache_definition,dead_hang_definition,'dynamic_transfer_vs_passive_hang','Lache requires active organized swing and a target catch.','Dead Hang is a static passive or declared hanging support without release flight or catch.','active_dynamic_transfer_vs_static_passive_support'),
    (lache_definition,scapular_pull_definition,'whole_body_transfer_vs_scapular_repetition','Lache transfers between bars through flight.','Scapular Pull-Up scores scapular elevation-depression on one bar without elbow pull or release.','whole_body_flight_vs_local_scapular_action'),
    (lache_definition,flexed_hang_definition,'dynamic_transfer_vs_flexed_arm_hold','Lache includes straight-to-absorbing dynamic bar transfer.','Flexed-Arm Hang is a timed elbow-flexed static hold.','dynamic_release_catch_vs_static_flexed_elbow_hold'),
    (lache_definition,standing_precision_definition,'bar_transfer_vs_standing_jump','Lache begins in source-bar support and ends on another bar.','Precision Jump begins from foot support and ends on a foot target.','source_support_flight_and_terminal_interface_change'),
    (lache_definition,bar_cast_definition,'hanging_transfer_vs_front_support_cast','Lache begins in hanging support and includes release flight to another bar.','Bar Cast begins in front support and returns to front support without a target transfer.','start_support_release_target_and_endpoint_change'),
    (lache_definition,cast_handstand_definition,'hanging_transfer_vs_cast_to_handstand','Lache ends in retained target-bar hang.','Cast to Handstand begins in front support and finishes at or through handstand on the same bar.','support_orientation_path_and_terminal_change'),
    (tap_definition,active_hang_definition,'cyclic_swing_vs_static_active_hang','Tap Swing scores a full hollow-arch oscillation.','Active Hang scores static support and scapular organization.','cyclic_shoulder_trunk_hip_action_vs_static_hold'),
    (tap_definition,dead_hang_definition,'active_cycle_vs_passive_static_hang','Tap Swing requires active shoulders and a full organized oscillation.','Dead Hang is static and may be passive.','dynamic_cycle_vs_static_support'),
    (tap_definition,scapular_pull_definition,'full_swing_cycle_vs_scapular_pull','Tap Swing changes whole-body angle and swing phase.','Scapular Pull-Up isolates scapular motion on one bar.','whole_body_swing_vs_local_scapular_action'),
    (tap_definition,standing_precision_definition,'bar_cycle_vs_foot_jump','Tap Swing remains suspended from one bar with no flight or landing.','Precision Jump takes off and lands on the feet.','support_contact_and_locomotor_action_change'),
    (tap_definition,precision_definition,'no_release_cycle_vs_release_landing','Tap Swing retains the source grip through a full cycle.','Lache Precision releases and lands on a foot target.','release_flight_landing_and_endpoint_change'),
    (precision_definition,standing_precision_definition,'bar_release_precision_vs_standing_precision','Lache Precision begins in a bar swing and includes hand release.','Precision Jump begins from standing or running foot support.','entry_support_and_release_action_change')
  ) b(left_id,right_id,boundary_key,rationale,left_contract,right_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT d.definition_id,d.card_version,s.section_key,
    CASE
      WHEN s.section_key='media' THEN d.media_url
      WHEN s.section_key IN('identity','constraints','instructions','programming','athlete_support','coach_support','accessibility') THEN 'https://assets.zyrosite.com/AR0yPVr0V2u089eJ/urban-leap-project---handbook_finalna-verzija-a41oVuj00q1YwJLx.pdf'
      WHEN s.section_key IN('taxonomy','alternates','dosage') THEN 'https://www.gymnastics.sport/site/pages/education/agegroup-pk-manual-e.pdf'
      WHEN s.section_key='anatomy' THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/'
      WHEN s.section_key='biomechanics' AND d.card_key='tap' THEN 'https://pubmed.ncbi.nlm.nih.gov/18930233/'
      WHEN s.section_key='biomechanics' THEN 'https://ojs.ub.uni-konstanz.de/cpa/article/view/2969'
      WHEN s.section_key='difficulty' THEN 'https://www.gymnastics.sport/publicdir/rules/files/en_1.1.1%20-%20PK%20Code%20of%20Points%202025-2028%20-%20Table%20of%20tricks%202025.pdf'
      WHEN s.section_key='load_fatigue_recovery' THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6458579/'
      ELSE 'https://pubmed.ncbi.nlm.nih.gov/23860830/' END,
    CASE
      WHEN s.section_key='media' THEN d.media_title
      WHEN s.section_key IN('identity','constraints','instructions','programming','athlete_support','coach_support','accessibility') THEN 'UrbanLeap Parkour Trainer Handbook'
      WHEN s.section_key IN('taxonomy','alternates','dosage') THEN 'FIG Parkour Age Group Development and Competition Program'
      WHEN s.section_key='anatomy' THEN 'Scapula kinematics of pull-up techniques: Avoiding impingement risk with training changes'
      WHEN s.section_key='biomechanics' AND d.card_key='tap' THEN 'Evaluation of a subject-specific female gymnast model and simulation of an uneven parallel bar swing'
      WHEN s.section_key='biomechanics' THEN 'The Identification of Release on the Horizontal Bar'
      WHEN s.section_key='difficulty' THEN 'Parkour Code of Points 2025–2028 — Table of Tricks 2025'
      WHEN s.section_key='load_fatigue_recovery' THEN 'Comparison of Three Hangboard Strength and Endurance Training Programs on Grip Endurance'
      ELSE '[Parkour—Art of Movement and its injury risk]' END,
    CASE
      WHEN s.section_key='media' THEN d.media_channel
      WHEN s.section_key IN('identity','constraints','instructions','programming','athlete_support','coach_support','accessibility') THEN 'UrbanLeap Erasmus+ Sport Project'
      WHEN s.section_key IN('taxonomy','alternates','dosage','difficulty') THEN 'World Gymnastics / Fédération Internationale de Gymnastique'
      WHEN s.section_key='anatomy' THEN 'Journal of Science and Medicine in Sport'
      WHEN s.section_key='biomechanics' AND d.card_key='tap' THEN 'Journal of Biomechanics'
      WHEN s.section_key='biomechanics' THEN 'International Society of Biomechanics in Sports Conference Proceedings'
      WHEN s.section_key='load_fatigue_recovery' THEN 'Journal of Human Kinetics'
      ELSE 'Sportverletzung Sportschaden' END,
    CASE
      WHEN s.section_key='media' THEN 'expert_instruction'
      WHEN s.section_key IN('identity','constraints','instructions','programming','athlete_support','coach_support','accessibility') THEN 'professional_standard'
      WHEN s.section_key IN('taxonomy','alternates','dosage','difficulty') THEN 'governing_body'
      ELSE 'peer_reviewed_research' END,
    jsonb_build_array(
      jsonb_build_object(
        'supported',CASE s.section_key
          WHEN 'identity' THEN d.identity_claim
          WHEN 'taxonomy' THEN 'FIG separately lists swing initiation, swing with half turn, Lache Precision, run-up/catch/swing composites, flyaway, front-flip dismount, back-cast dismount, and other bar elements.'
          WHEN 'anatomy' THEN 'Bilateral bar support and pull-up research supports explicit hand wrist elbow shoulder scapular and trunk involvement while showing that technique changes kinematics.'
          WHEN 'biomechanics' THEN CASE d.card_key WHEN 'tap' THEN 'A subject-specific bar-swing model supports treating apparatus compliance body configuration and swing mechanics as configuration-specific.' ELSE 'Instrumented horizontal-bar work shows release timing is a discrete measurable event and that flight is largely determined by release state.' END
          WHEN 'difficulty' THEN 'The FIG Table of Tricks separates Tap Swing and more complex swing release skills, supporting exercise-complexity distinctions without calibrating Vortex numbers or athlete level.'
          WHEN 'load_fatigue_recovery' THEN 'Hangboard research supports grip endurance as a real trainable fatigue dimension under sustained loaded hand support.'
          WHEN 'constraints' THEN 'The handbook calls for tested stable bars, controlled distance, nonslippery surfaces, clear landing zones, and conservative assistance.'
          WHEN 'dosage' THEN 'The FIG material supports gradual development and reduced high-load exposure but does not prescribe a universal set-repetition-rest scheme for these cards.'
          WHEN 'instructions' THEN d.instruction_claim
          WHEN 'safety_stop_rules' THEN 'Parkour injury survey data support tracking upper-extremity exposure and incidents but do not establish Lache-specific causality or thresholds.'
          WHEN 'programming' THEN 'The handbook progresses from active hang and controlled swing toward short transfers and then distance or height changes, one material constraint at a time.'
          WHEN 'athlete_support' THEN 'The handbook identifies target focus, grip, shoulder organization, hollow-arch rhythm, catch or landing stabilization, and common faults that can be explained in plain language.'
          WHEN 'coach_support' THEN 'The handbook describes station checks, side-positioned guidance, verbal timing cues, limited short-gap catch securing, and common fault observation.'
          WHEN 'accessibility' THEN 'The handbook supports demonstrations, progressive task presentation, visible targets, conservative setup, and verbal timing; alternative communication needs remain individual.'
          WHEN 'alternates' THEN 'FIG and professional sources separate no-release swings, turns, target-bar transfers, precision landings, flyaways, dismounts, and composites.'
          ELSE 'YouTube oEmbed returned current title, channel, thumbnail, and iframe metadata on 2026-08-02.' END,
        'scope',CASE s.section_key WHEN 'media' THEN 'candidate_metadata_only' ELSE 'research_informed_candidate_card_authorship' END),
      jsonb_build_object(
        'limitation',CASE s.section_key
          WHEN 'media' THEN 'Playback, exact definition and variant, grip, apparatus, action, target, endpoint, captions, accessibility, cue quality, safety, conflicts, reviewer identity, and approval remain unverified.'
          WHEN 'accessibility' THEN 'The source does not establish suitability, accommodations, or communication method for a particular athlete.'
          WHEN 'dosage' THEN 'No source establishes these candidate sets, repetitions, rest, weekly frequency, contact ceiling, or recovery hours.'
          WHEN 'difficulty' THEN 'Competition categories do not calibrate Vortex exercise complexity or physical difficulty and must not be converted to athlete proficiency.'
          WHEN 'safety_stop_rules' THEN 'A retrospective online survey is not Lache-specific or causal and supplies no universal safety or return threshold.'
          ELSE 'The source does not approve this exact Vortex grip, geometry, finite endpoint, assistance, numeric score, dose, readiness rule, or publication.' END,
        'noUniversalTechniqueSafetyReadinessDoseRecoveryOutcomeTransferOrDifficultyClaim',TRUE)),
    CASE
      WHEN s.section_key='media' THEN 60
      WHEN s.section_key IN('taxonomy','alternates','dosage','difficulty') THEN 92
      WHEN s.section_key IN('identity','constraints','instructions','programming','athlete_support','coach_support','accessibility') THEN 78
      WHEN s.section_key='anatomy' THEN 86
      WHEN s.section_key='biomechanics' AND d.card_key='tap' THEN 86
      WHEN s.section_key='biomechanics' THEN 68
      WHEN s.section_key='load_fatigue_recovery' THEN 84
      ELSE 78 END,
    'candidate',NULL,NULL
  FROM (VALUES
    (lache_definition,2,'lache','https://www.youtube.com/watch?v=3o0NrxeRCsk','Lache Parkour Tutorial - How to swing from a bar (Jesse La Flair)','LaFlairParkour','UrbanLeap defines Lache as a dynamic transfer from one bar or rail to another from an active hang through a controlled hollow-arch tap, forward projection, compact flight, bilateral reach, and controlled catch.','Use active shoulders and trunk organization, build a controlled tap, release at the selected trajectory, reach both arms to the target, absorb with active scapulae, and manage the rebound swing.'),
    (tap_definition,1,'tap','https://www.youtube.com/watch?v=SYdukm1xvEY','Tap Swings','SHIFT Movement Science and Gymnastics Education','FIG and UrbanLeap separately identify swing initiation and tap-swing drills before any release transfer; the scored cycle retains both hands on one bar.','Maintain active shoulders and a controlled hollow-arch rhythm, emphasize timing rather than uncontrolled amplitude, and do not release or regrasp.'),
    (precision_definition,1,'precision','https://www.youtube.com/watch?v=s0Xbm2An7W4','Lache to precision tutorial by special guest kie willis - Lukas Steiner/Stefan Rainer','Stefan Rainer','FIG separately names Lache Precision, while the handbook distinguishes a bar transfer from a precision landing on a small target; target-bar catch and two-foot stick are different endpoints.','Use an organized source-bar tap, release without turn, track the landing target, contact with both feet, absorb under control, and retain the declared stick.')
  ) d(definition_id,card_version,card_key,media_url,media_title,media_channel,identity_claim,instruction_claim)
  CROSS JOIN (VALUES
    ('identity'),('taxonomy'),('anatomy'),('biomechanics'),('difficulty'),
    ('load_fatigue_recovery'),('constraints'),('dosage'),('instructions'),
    ('safety_stop_rules'),('programming'),('athlete_support'),('coach_support'),
    ('accessibility'),('alternates'),('media')
  ) s(section_key)
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
  SELECT m.definition_id,NULL,m.card_version,
    'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,
    m.channel,NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate',
    'manual_research',m.source_query,NULL,NULL,'2026-11-02'::TIMESTAMPTZ,
    'YouTube oEmbed returned current metadata on 2026-08-02. This proves metadata and embed-response health only. Playback, exact definition and variant, grip, apparatus geometry, action, target, endpoint, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamped review, and approval remain unverified.'
  FROM (VALUES
    (lache_definition,2,'3o0NrxeRCsk','Lache Parkour Tutorial - How to swing from a bar (Jesse La Flair)','LaFlairParkour','two bar lache transfer tutorial'),
    (lache_definition,2,'FuNZG4yF1jo','How To LACHE (bar swing jump) - Parkour Tutorial','Ronnie Street Stunts','two bar lache transfer tutorial'),
    (lache_definition,2,'NrC-TbmShKQ','How to Perform the Lache in Parkour | AKA Swing like an APE','Jungle Movement','two bar lache transfer tutorial'),
    (lache_definition,2,'HMGZNRRTV4s','LACHE (bar to bar)','SirDudelot','two bar lache transfer tutorial'),
    (lache_definition,2,'PmGur4Nfzfc','Teaching Giles From Motus How to Lache','Origins Parkour','two bar lache transfer tutorial'),
    (tap_definition,1,'SYdukm1xvEY','Tap Swings','SHIFT Movement Science and Gymnastics Education','bar hollow arch tap swing tutorial'),
    (tap_definition,1,'8epKPyb1e4g','Skill Progressions #12: Tap Swings','GymTactics','bar hollow arch tap swing tutorial'),
    (tap_definition,1,'rCe1Z0C9WnI','Tap Swings on Bars featuring Coach Mary Lee Tracy','Gymnastics Tips','bar hollow arch tap swing tutorial'),
    (tap_definition,1,'lcAyqMk4l7w','HOW TO LEARN TO SWING ON BARS - BASIC TAP SWINGS TUTORIAL - Gymnastics Uneven Bars High Bar','ringsking','bar hollow arch tap swing tutorial'),
    (tap_definition,1,'yl2IawdA00o','HOW TO SWING ON BARS!(PARKOUR TUTORIAL)','Michael Franko','parkour bar tap swing tutorial'),
    (precision_definition,1,'s0Xbm2An7W4','Lache to precision tutorial by special guest kie willis - Lukas Steiner/Stefan Rainer','Stefan Rainer','lache precision two foot landing tutorial'),
    (precision_definition,1,'FHwls3YJ1_U','Tutorial Parkour lache precision #insegnanteparkour #parkouritalia #tutorialparkour #parkourtutorial','TeoParkour','lache precision two foot landing tutorial'),
    (precision_definition,1,'EDnsNRgcggo','Bob Reese Teaches You How to Do Lache Pres!','MindShift Gym','lache precision two foot landing tutorial'),
    (precision_definition,1,'zpVjQTemsJk','How to Lache Precision #parkour #tutorial #howto','Sasha Hordiychuk','lache precision two foot landing tutorial'),
    (precision_definition,1,'4I5ZJ1-qSH0','HOW TO LACHE - [PARKOUR FREERUNNING TUTORIAL]','Alexandr Zhurkov','lache precision tutorial')
  ) m(definition_id,card_version,video_id,title,channel,source_query)
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
  SELECT a.definition_id,a.card_version,a.alternate_name,a.classification,
    a.rationale,jsonb_build_object(
      'primaryDimension',a.dimension_key,'migration',migration_key,
      'exactRevalidationRequired',TRUE,'humanReviewRequired',TRUE),
    a.proposed_card,'candidate',NULL,NULL
  FROM (VALUES
    (lache_definition,2,'Gap distance within validated same geometry','modifier_annotation','Measured distance within an already validated station range changes dose and difficulty but not the scored source-release-target-catch contract.','gap_distance',jsonb_build_object('persistAs','delivery_measurement')),
    (lache_definition,2,'Same-height independent retained catch','same_identity','This is the primary exact working variant.','target_height_relation',jsonb_build_object('variantId',same_height_variant)),
    (lache_definition,2,'Higher target retained catch','new_variant','Higher target changes projection release timing catch geometry and load while retaining the two-bar catch endpoint.','target_higher',jsonb_build_object('variantId',higher_target_variant)),
    (lache_definition,2,'Lower target retained catch','new_variant','Lower target changes trajectory timing and catch absorption while retaining the two-bar catch endpoint.','target_lower',jsonb_build_object('variantId',lower_target_variant)),
    (lache_definition,2,'Coach-secured short-gap catch','new_variant','Predeclared minimal target-catch securing changes assistance and validity but retains the action boundary.','qualified_assistance',jsonb_build_object('variantId',assisted_variant)),
    (lache_definition,2,'Rail or noncircular target interface','new_variant','Cross-section diameter friction hand orientation and fall behavior materially change grip and catch requirements.','target_interface',jsonb_build_object('proposedVariantKey','declared-rail-interface')),
    (lache_definition,2,'One-arm target catch','new_definition','A unilateral catch changes laterality load rotation and failure response.','unilateral_catch',jsonb_build_object('proposedSlug','one-arm-lache-catch')),
    (lache_definition,2,'Lache with half turn','new_definition','A half turn changes flight rotation visual tracking hand orientation and catch.','flight_turn',jsonb_build_object('proposedSlug','lache-half-turn-catch')),
    (lache_definition,2,'Chained multiple Lache transfers','new_definition','A chain adds another release catch and cumulative sequence endpoint beyond this single retained catch.','connection',jsonb_build_object('proposedSlug','chained-lache-transfers')),
    (lache_definition,2,'Bar Hollow–Arch Tap Swing','new_definition','No-release single-bar swing has a different contact and endpoint contract and now has its own card.','no_release_cycle',jsonb_build_object('definitionId',tap_definition)),
    (lache_definition,2,'Lache Precision to Two-Foot Stick','new_definition','Two-foot landing replaces the target-bar catch and now has its own card.','terminal_feet',jsonb_build_object('definitionId',precision_definition)),
    (lache_definition,2,'Same-bar release and regrasp','new_definition','Regrasping the source bar changes target identity path and catch geometry.','same_bar_regrasp',jsonb_build_object('proposedSlug','same-bar-release-regrasp')),
    (lache_definition,2,'Swing dismount to feet','new_definition','A dismount ends on the ground or platform rather than another bar.','dismount',jsonb_build_object('proposedSlug','bar-swing-dismount-to-feet')),
    (lache_definition,2,'Flyaway or flipping dismount','new_definition','A declared flip adds rotation and a landing endpoint.','flip_dismount',jsonb_build_object('proposedSlug','bar-flyaway-dismount')),
    (lache_definition,2,'Run-up hop and catch source bar composite','new_definition','The scored run jump and source-bar catch add entry actions before the swing.','dynamic_entry',jsonb_build_object('proposedSlug','run-hop-catch-bar-lache-sequence')),
    (lache_definition,2,'Release to wall Cat or Arm Jump contact','new_definition','Wall and ledge hand-foot contact replace the target horizontal-bar catch.','wall_target',jsonb_build_object('proposedSlug','bar-release-to-wall-catch')),
    (lache_definition,2,'Dyno to bar','new_definition','A foot-supported or wall-supported leap to a bar has a different source support and takeoff.','dyno',jsonb_build_object('proposedSlug','dyno-to-bar-catch')),
    (lache_definition,2,'Underbar passage','new_definition','Underbar includes approach and body passage through an opening rather than a source-bar transfer.','underbar',jsonb_build_object('proposedSlug','underbar-passage')),

    (tap_definition,1,'Swing amplitude within validated clearance','modifier_annotation','Amplitude changes dose load and clearance while the one-bar no-release cycle remains unchanged.','amplitude',jsonb_build_object('persistAs','delivery_measurement')),
    (tap_definition,1,'Number of continuous cycles','modifier_annotation','Cycle count is dosage, not identity.','cycle_count',jsonb_build_object('persistAs','dosage')),
    (tap_definition,1,'Supinated bilateral grip tap swing','new_variant','Grip orientation changes wrist elbow shoulder loading and must be separately selected.','grip_orientation',jsonb_build_object('proposedVariantKey','bilateral-undergrip-full-cycle')),
    (tap_definition,1,'Mixed-grip tap swing','new_variant','Asymmetric grip changes laterality torque and bailout behavior.','mixed_grip',jsonb_build_object('proposedVariantKey','mixed-grip-full-cycle')),
    (tap_definition,1,'Strap-bar tap swing','new_variant','Straps change hand release possibility wrist interface and emergency exit.','strap_bar',jsonb_build_object('proposedVariantKey','strap-bar-full-cycle')),
    (tap_definition,1,'Giant swing','new_definition','A giant passes through full rotation around the bar rather than the bounded tap cycle.','full_rotation',jsonb_build_object('proposedSlug','horizontal-bar-giant-swing')),
    (tap_definition,1,'Swing with half turn','new_definition','A turn adds rotation and grip reorientation.','turn',jsonb_build_object('proposedSlug','bar-swing-half-turn')),
    (tap_definition,1,'Release and regrasp','new_definition','Any two-hand release introduces flight and catch.','release_regrasp',jsonb_build_object('proposedSlug','same-bar-release-regrasp')),
    (tap_definition,1,'Two-Bar Lache Transfer','new_definition','Target-bar release-and-catch now has a separate card.','target_bar',jsonb_build_object('definitionId',lache_definition)),
    (tap_definition,1,'Bent-arm pumping swing','new_definition','A deliberately flexed-elbow pulling action changes the joint-action and load contract.','elbow_pull',jsonb_build_object('proposedSlug','bent-arm-bar-pumping-swing')),

    (precision_definition,1,'Gap distance within validated target setup','modifier_annotation','Distance within a validated source-target configuration changes dose and difficulty but not the bar-release two-foot-stick identity.','gap_distance',jsonb_build_object('persistAs','delivery_measurement')),
    (precision_definition,1,'Landing target width within validated setup','modifier_annotation','Width is a persisted target measurement and difficulty driver when the same target type and terminal contact remain.','target_width',jsonb_build_object('persistAs','delivery_measurement')),
    (precision_definition,1,'Higher or lower landing target','new_variant','Target height relation changes trajectory flight time collision risk and landing load.','target_height',jsonb_build_object('proposedVariantKey','declared-target-height-relation')),
    (precision_definition,1,'Run-up hop and source-bar catch before release','new_definition','Dynamic entry adds takeoff and source-bar catch contacts before the scored swing.','dynamic_entry',jsonb_build_object('proposedSlug','run-hop-catch-bar-lache-precision')),
    (precision_definition,1,'Lache Precision with turn','new_definition','A turn changes flight rotation spotting and foot orientation.','flight_turn',jsonb_build_object('proposedSlug','lache-precision-with-turn')),
    (precision_definition,1,'Lache landing into Parkour Roll','new_definition','A roll changes the terminal endpoint and adds ground-contact sequence.','rolling_exit',jsonb_build_object('proposedSlug','lache-dismount-to-parkour-roll')),
    (precision_definition,1,'Two-Bar Lache Catch','new_definition','A target-bar catch replaces the foot landing and now has its own card.','target_bar_catch',jsonb_build_object('definitionId',lache_definition)),
    (precision_definition,1,'Release to Cat or Arm Jump','new_definition','Wall hand-foot contact is neither a horizontal foot stick nor target-bar catch.','wall_contact',jsonb_build_object('proposedSlug','bar-release-to-wall-catch')),
    (precision_definition,1,'One-foot precision landing','new_definition','Unilateral landing changes laterality contact and load absorption.','unilateral_landing',jsonb_build_object('proposedSlug','lache-to-one-foot-precision')),
    (precision_definition,1,'Connected action before the two-second stick','new_definition','If another action begins before the required stick, it changes the scored endpoint and sequence identity.','connection_before_endpoint',jsonb_build_object('proposedSlug','connected-lache-precision-sequence'))
  ) a(definition_id,card_version,alternate_name,classification,rationale,dimension_key,proposed_card)
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
      'revalidate',jsonb_build_array('identity','grip','source_and_target','geometry','assistance','action','release','catch_or_landing','terminal_checkpoint','environment','symptoms','dose','contact_and_fatigue_budgets','duration','logistics','persistence','skill_link','coach_rendering','athlete_rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (active_hang_variant,tap_variant,'progression',72,ARRAY['complexity','speed','stability','load']::TEXT[],'Moving from static active support to a full no-release hollow-arch cycle changes action and exposure; review does not infer athlete readiness.'),
    (dead_hang_variant,tap_variant,'progression',60,ARRAY['complexity','speed','stability','load']::TEXT[],'Passive static support and active cyclic swing are different actions; the edge is a review proposal only.'),
    (scapular_pull_variant,tap_variant,'compatible_pairing',66,ARRAY['stability','load','fatigue']::TEXT[],'Scapular Pull-Up and Tap Swing share grip and shoulder tissues; pairing must account for fatigue and is not automatic.'),
    (tap_variant,assisted_variant,'progression',72,ARRAY['complexity','speed','impact','decision_demand','load']::TEXT[],'Adding release flight target catch and coach-secured assistance changes identity and requires complete review.'),
    (tap_variant,same_height_variant,'progression',76,ARRAY['complexity','speed','impact','decision_demand','load']::TEXT[],'A two-bar independent transfer adds release flight catch and failure consequence beyond a no-release tap cycle.'),
    (assisted_variant,same_height_variant,'progression',86,ARRAY['stability','complexity','load']::TEXT[],'Removing planned catch securing changes assistance validity and failure response.'),
    (same_height_variant,higher_target_variant,'progression',82,ARRAY['range','complexity','load','decision_demand']::TEXT[],'A higher target changes trajectory and timing; no universal progression order is claimed.'),
    (same_height_variant,lower_target_variant,'progression',80,ARRAY['range','complexity','impact','load']::TEXT[],'A lower target changes descent and catch absorption; no universal progression order is claimed.'),
    (same_height_variant,precision_variant,'lateral_substitution',64,ARRAY['impact','complexity','stability','decision_demand']::TEXT[],'Target-bar catch and two-foot precision landing serve different contacts and require full substitution revalidation.'),
    (standing_precision_variant,precision_variant,'progression',58,ARRAY['complexity','load','impact','decision_demand']::TEXT[],'Bar support swing and release are added to a foot-landing target; standing Precision Jump does not authorize transfer.'),
    (precision_variant,same_height_variant,'lateral_substitution',64,ARRAY['impact','complexity','stability','decision_demand']::TEXT[],'Replacing a foot stick with target-bar catch changes the terminal interface and cannot be automatic.')
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
      'Review-only exercise-complexity anchor based on exact grip start phase whole-body hollow-arch timing apparatus geometry release or no-release rule trajectory target contact finite endpoint error detection bailout attention and supervision.'
    ELSE
      'Review-only physical-difficulty anchor based on suspended bodyweight grip wrist elbow shoulder trunk demand swing acceleration release catch or landing absorption geometry fatigue and recovery.' END
      ||' This scores the exercise, not athlete proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (same_height_variant,'same-height-independent-retained-catch',82,78,80),
    (higher_target_variant,'higher-target-independent-retained-catch',88,84,80),
    (lower_target_variant,'lower-target-independent-retained-catch',86,82,80),
    (assisted_variant,'same-height-coach-secured-catch',76,72,80),
    (tap_variant,'bilateral-overgrip-full-cycle',68,64,60),
    (precision_variant,'low-target-bilateral-two-second-stick',86,82,80)
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
  VALUES(19,82,78,88,48,88,82,
    jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'representativeVariant','same-height-independent-retained-catch',
      'exactGripSourceTargetGeometryReleaseCatchEndpointAndBailoutRequired',TRUE,
      'tapSwingAndLachePrecisionAreSeparateDefinitions',TRUE,
      'skillLibraryLevelsNotCopied',TRUE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),60,'queued',NULL,NULL,
    'Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not athlete proficiency. Exact grip, apparatus, geometry, assistance, release, catch, endpoint, bailout, and independent calibration remain required.')
  ON CONFLICT(exercise_id) DO UPDATE SET
    technical_complexity=EXCLUDED.technical_complexity,
    absolute_load_demand=EXCLUDED.absolute_load_demand,
    coordination_demand=EXCLUDED.coordination_demand,impact=EXCLUDED.impact,
    supervision_demand=EXCLUDED.supervision_demand,
    base_overall_difficulty=EXCLUDED.base_overall_difficulty,
    legacy_scores=EXCLUDED.legacy_scores,
    migration_confidence=EXCLUDED.migration_confidence,
    human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes=EXCLUDED.review_notes,updated_at=now();

  UPDATE coaching.exercise_difficulty_profile SET
    technical=8.2,complexity=8.2,load=7.8,overall=8.2,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='high',
    notes='Candidate exercise complexity and physical difficulty for the exact same-height independent Two-Bar Lache Transfer to Retained Catch. Tap Swing, Lache Precision, turns, dismounts, same-bar regrasp, one-arm catch, and connections are separate identities. This is not an athlete proficiency classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=19;

  UPDATE coaching.exercise SET
    name='Two-Bar Lache Transfer to Retained Catch',
    slug='two-bar-lache-transfer-retained-catch',
    skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,
    why_publish_ready=FALSE,archived=FALSE,
    description='Exact two-bar release-and-catch exercise. From a declared active bilateral overgrip on a fixed source horizontal bar, use an organized hollow-arch tap swing, release both hands, travel without a turn or flip, catch the declared target horizontal bar with both hands, and retain the catch through the first controlled rearward apex.',
    instructions='Declare source and target bars, overgrip and hand spacing, gap, target height relation, bar dimensions and surface, assistance, sets, repetitions, rest, terminal checkpoint, mats, complete miss and bailout envelope, cumulative hanging swing release catch and landing exposure, and stop. Record every valid invalid partial assisted and incident attempt plus every loaded hand catch foot and unplanned contact and actual duration.',
    default_sets=2,default_reps=3,default_work_seconds=NULL,
    default_rest_seconds=180,est_seconds_per_set=240,
    card_summary='Active-hang hollow-arch swing, two-hand release, no-turn flight, simultaneous two-hand target-bar catch, and retained first rearward apex.',
    coach_language='Verify exact card and variant, bilateral overgrip, source and target bar integrity, gap and height relation, complete fall and bailout envelope, mats, assistance, start phase, hollow-arch timing, release, trajectory, simultaneous target catch, retained endpoint, cumulative grip and catch exposure, first fault, symptoms, and actual rest. Stop before technical fatigue.',
    athlete_language='Swing organized, release both hands together, reach together, catch strong, and keep both hands through the first back swing. Stop at the first slip, miss, or symptom.',
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule','active_bilateral_source_hang_tap_release_no_turn_bilateral_target_catch_retained_to_first_rearward_apex',
      'skillLibraryRule','athlete performance levels remain only in coaching.skill; no Lache skill level is copied into this exercise card',
      'loadRule','record every valid invalid partial assisted and incident attempt plus source loaded hands target catches foot landings and unplanned contacts',
      'fatigueRule','combine all hang pull climb swing release regrasp brachiation ninja parkour and landing exposure',
      'substitutionRule','revalidate identity grip apparatus geometry assistance action release target contact endpoint surface symptoms dose fatigue duration logistics persistence skill link and both renderings',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['gap_distance','target_height_relation','swing_amplitude','sets','repetitions','rest','terminal_checkpoint','qualified_assistance']::TEXT[],
    movement_family='Two-Bar Lache Transfer to Retained Catch',
    primary_phase_key='movement_intelligence',
    phase_subrole='bar_release_target_catch_quality',
    primary_order_slot='fresh_grip_high_consequence_technical_work',
    programming_kind='exercise',linked_skill_id=NULL,
    movement_requirements=jsonb_build_object(
      'impact_level',3,
      'required_equipment',jsonb_build_array('pull_up_bar','mat','tape_measure','timer'),
      'required_quantities',jsonb_build_object('pull_up_bar',2),
      'required_environment',jsonb_build_array('inspected_fixed_source_and_target','measured_geometry','complete_miss_and_bailout_zone','qualified_direct_supervision'),
      'identityConstraints',jsonb_build_array('bilateral_closed_overgrip','active_source_hang','organized_tap_swing','simultaneous_release','no_turn_or_flip','simultaneous_two_hand_target_catch','retained_first_rearward_apex')),
    coaching_execution=jsonb_build_object(
      'observe',jsonb_build_array('grip and start phase','source and target geometry','hollow-arch timing','release','trajectory','two-hand target catch','scapular elbow trunk absorption','first rearward apex','miss bailout and symptoms'),
      'qualityStop','first unsafe or identity-changing event or two consecutive technical faults',
      'persistenceRequired',TRUE),
    pairing_logic=jsonb_build_object(
      'avoid',jsonb_build_array('dense grip pull-up climbing or hanging volume','fatigued shoulder overhead release catch or landing circuit','shared live fall lane'),
      'revalidateAfterPairingChange',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_urls',jsonb_build_array(
        'https://www.youtube.com/watch?v=3o0NrxeRCsk',
        'https://www.youtube.com/watch?v=FuNZG4yF1jo',
        'https://www.youtube.com/watch?v=NrC-TbmShKQ',
        'https://www.youtube.com/watch?v=HMGZNRRTV4s',
        'https://www.youtube.com/watch?v=PmGur4Nfzfc'),
      'media_review_state','candidate_oembed_metadata_only',
      'external_playback_verification_performed',FALSE,
      'human_review_required',TRUE),updated_at=now()
  WHERE id=19;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=4,impact_level=3,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='required',
    minimum_prerequisite_notes='Readiness is assessed from current symptoms, exact active hang and grip, organized swing, target tracking, selected apparatus geometry, assistance, catch tolerance, miss and bailout plan, same-session exposure, and qualified coach observation; never from an exercise proficiency label or age cutoff.',
    readiness_checks=ARRAY[
      'Exact definition variant grip source target gap height relation assistance endpoint miss and bailout are selected and understood.',
      'Hands wrists elbows shoulders neck spine trunk hips knees ankles feet grip and target tracking are symptom free for the selected contract.',
      'Both bars rack anchors surfaces mats complete swing flight catch fall and bailout envelope and emergency access pass inspection.',
      'The athlete can establish the declared active hang and organized no-release Tap Swing action and respond to the stop signal while the coach sees every contact.',
      'Prior same-session hanging pulling climbing swinging release catch brachiation ninja and landing exposure is known and within the workout budget.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Pain pinch numbness tingling weakness dizziness nausea vision change faintness panic unusual breathlessness or inability to communicate.',
      'Grip slide regrasp asynchronous release passive or asymmetric shoulder elbow collapse or uncontrolled hollow-arch rhythm.',
      'One-hand missed late or uncontrolled catch turn flip collision floor body or undeclared apparatus contact early target release or uncontrolled rebound.',
      'Coach rescue or assistance outside the selected variant miss fall panic or uncontrolled bailout.',
      'Bar target rack anchor surface mat marker timer clearance supervision emergency access or station isolation becomes unavailable.',
      'Two consecutive technical faults or any planned attempt loaded-hand catch landing or cumulative fatigue budget is reached.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms or restrictions for which loaded hanging dynamic shoulder movement catch or fall exposure has not been cleared when clearance is appropriate.',
      'No stable inspected two-bar setup measured target geometry complete mat and bailout coverage qualified direct supervision or enforceable one-athlete station.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Select the exact coach-secured short-gap variant only after complete revalidation and record all assistance.',
      'Use Bar Hollow–Arch Tap Swing, Active Hang, standing Precision Jump, or Lache Precision only as separate exercise identities.',
      'Do not add a turn flip one-arm catch same-bar regrasp dismount wall contact dynamic entry or connection without changing identity.'
    ]::TEXT[]
  WHERE exercise_id=19;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT p.definition_id,1,p.card_version,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey',p.identity_key,'legacySources',p.legacy_sources,'activeWorkingSpecifications',p.variant_count,'identityQuarantinedLegacySource',p.legacy_sources=1,'exerciseSkillClassificationAbsent',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesAndLaterality',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'loadedSourceHandsPerRep',2,'targetCatchHandsPerRep',p.catch_contacts,'landingFeetPerRep',p.foot_contacts,'validInvalidPartialAssistedAndIncidentAttemptsCounted',TRUE,'sharedGripShoulderSwingCatchAndLandingExposure',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'gripApparatusGeometryTargetAssistanceSurfaceClearanceBailoutContactsAndSupervision',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',p.profile_count,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'exactActionStopBailoutIncidentAndSkillBoundary',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'sourceScopeAndLimitationsExplicit',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',p.relationship_count,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',p.calibration_count,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',p.alternate_count,'identityBoundaries',p.boundary_count,'identityBoundariesExplicit',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify exact definition and variant, grip, apparatus geometry, action, release or no-release rule, target contact, terminal checkpoint, captions, accessibility, cue quality, safety, conflicts, current playback, reviewer identity, timestamp, and card version.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every graph proposal; no automatic progression regression substitution or skill transfer among hangs, tap swings, Lache transfers, precision landings, catches, dismounts, turns, flips, entries, or connections is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These scores do not classify an athlete and do not alter skill-library levels.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Every working grip, geometry, assistance, action, endpoint, dose, and support rule remains quarantined.')),
    TRUE,now()
  FROM (VALUES
    (lache_definition,2,'two_bar_lache_transfer_retained_catch',1,4,11,2,0,18,9,8,7),
    (tap_definition,1,'bar_hollow_arch_tap_swing_no_release',0,1,2,0,0,10,5,2,5),
    (precision_definition,1,'lache_precision_bilateral_foot_stick',0,1,3,0,2,10,1,2,3)
  ) p(definition_id,card_version,identity_key,legacy_sources,variant_count,profile_count,catch_contacts,foot_contacts,alternate_count,boundary_count,calibration_count,relationship_count)
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=19 AND definition_id=lache_definition
        AND provenance_json->>'sourceDisposition'='identity_quarantine'
        AND provenance_json->>'representedBySelectableSourceVariant'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine') THEN
    RAISE EXCEPTION '% found invalid source quarantine or lineage',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids) AND status='review'
        AND schema_version='2.0.0' AND approved_video_url IS NULL
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL
        AND movement_patterns<>'{}'::TEXT[] AND body_regions<>'{}'::TEXT[]
        AND cardinality(required_equipment)>0
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB
        AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB
        AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'canonicalAuthoredFromResearch'='true'
        AND provenance_json->>'approvalsCreated'='false')<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=lache_definition AND legacy_exercise_id=19 AND card_version=2
        AND slug='two-bar-lache-transfer-retained-catch')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=tap_definition AND legacy_exercise_id IS NULL AND card_version=1
        AND slug='bar-hollow-arch-tap-swing')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=precision_definition AND legacy_exercise_id IS NULL AND card_version=1
        AND slug='lache-precision-two-foot-stick') THEN
    RAISE EXCEPTION '% found incomplete canonical definitions',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'absoluteLoadDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=
          (difficulty_json->>'absoluteLoadDemand')::INTEGER
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (load_profile_json->>'sourceLoadedHandSupportsPerRep')::INTEGER=2
        AND (fatigue_profile_json->>'recoveryHours')::INTEGER>0
        AND programming_profile_json<>'{}'::JSONB)<>6
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=lache_definition AND id=ANY(active_variant_ids)
        AND status='review')<>4
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=tap_definition AND id=ANY(active_variant_ids)
        AND status='review')<>1
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=precision_definition AND id=ANY(active_variant_ids)
        AND status='review')<>1 THEN
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
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=8)<>16
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
        JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
        WHERE variant.definition_id=lache_definition
          AND variant.id=ANY(active_variant_ids) AND profile.status='review')<>11
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
        JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
        WHERE variant.definition_id=tap_definition
          AND variant.id=ANY(active_variant_ids) AND profile.status='review')<>2
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
        JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
        WHERE variant.definition_id=precision_definition
          AND variant.id=ANY(active_variant_ids) AND profile.status='review')<>3 THEN
    RAISE EXCEPTION '% found incomplete delivery profiles',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(definition_ids)
        AND ((definition_id=lache_definition AND reviewed_card_version=2)
          OR (definition_id IN(tap_definition,precision_definition)
            AND reviewed_card_version=1))
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>48
    OR EXISTS(SELECT 1 FROM unnest(definition_ids) AS listed(definition_id)
      WHERE (SELECT count(DISTINCT section_key)
        FROM coaching.exercise_section_evidence_v1 evidence
        WHERE evidence.definition_id=listed.definition_id
          AND evidence.reviewed_card_version=CASE
            WHEN listed.definition_id=lache_definition THEN 2 ELSE 1 END
          AND evidence.review_status='candidate'
          AND evidence.reviewer_user_id IS NULL)<>16)
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(definition_ids)
        AND ((definition_id=lache_definition AND reviewed_card_version=2)
          OR (definition_id IN(tap_definition,precision_definition)
            AND reviewed_card_version=1))
        AND link_status='healthy' AND review_status='candidate'
        AND embedding_allowed AND captions_available IS NULL
        AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>15
    OR EXISTS(SELECT 1 FROM unnest(definition_ids) AS listed(definition_id)
      WHERE (SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id=listed.definition_id
          AND media.reviewed_card_version=CASE
            WHEN listed.definition_id=lache_definition THEN 2 ELSE 1 END
          AND media.link_status='healthy' AND media.review_status='candidate')<>5)
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(definition_ids)
        AND ((definition_id=lache_definition AND reviewed_card_version=2)
          OR (definition_id IN(tap_definition,precision_definition)
            AND reviewed_card_version=1))
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>38 THEN
    RAISE EXCEPTION '% found incomplete evidence media or alternate packets',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND review_status='review' AND reviewed_by IS NULL)<>11
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>12
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE evidence_json->>'migration'=migration_key
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>15
    OR (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=ANY(definition_ids) AND status='quarantined'
        AND human_review_required
        AND jsonb_array_length(blocking_issues_json)=4)<>3 THEN
    RAISE EXCEPTION '% found incomplete graph calibration boundaries or packets',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=ANY(definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=ANY(definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(
        definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=ANY(definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE conditions_json->>'migration'=migration_key
        AND relationship.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY[
            'load','leverage','range','speed','stability','complexity','impact',
            'decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=19 AND (skill_level IS NOT NULL OR age_min IS NOT NULL
        OR age_max IS NOT NULL OR linked_skill_id IS NOT NULL
        OR is_published OR why_publish_ready))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=19
        AND (minimum_skill_level IS NOT NULL
          OR minimum_age_recommended IS NOT NULL
          OR requires_coach_supervision<>'required'))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=19 AND technical_complexity=82
        AND absolute_load_demand=78 AND base_overall_difficulty=82
        AND impact=48 AND human_review_status='queued'
        AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids)
        AND (difficulty_json ? 'athleteSkillOrProficiencyClassification'
          OR difficulty_json ? 'skillLevel'
          OR requirements_json ? 'minimumSkillLevel'
          OR programming_profile_json ? 'athleteProficiency'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(definition_ids)
        AND ((definition_id=lache_definition AND reviewed_card_version=2)
          OR (definition_id IN(tap_definition,precision_definition)
            AND reviewed_card_version=1))
        AND (review_status<>'candidate' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR captions_available IS NOT NULL
          OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND (review_status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND (status='approved' OR reviewed_by IS NOT NULL)) THEN
    RAISE EXCEPTION '% retained or fabricated proficiency approval media or publication state',migration_key;
  END IF;
END;
$$;
