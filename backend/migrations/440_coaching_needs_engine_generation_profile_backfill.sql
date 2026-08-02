-- Complete the published Needs Engine generation prerequisites reported after
-- canonical identity closure: 11 exercise-only difficulty profiles and 19
-- dosage profiles. Difficulty means exercise complexity plus physical
-- difficulty, with overall=max(complexity, physical difficulty). Scores are
-- explicitly provisional calibration candidates, not human approvals. No
-- exercise skill/proficiency classification is created.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '440_coaching_needs_engine_generation_profile_backfill';
  difficulty_source CONSTANT TEXT :=
    'provisional_needs_engine_backfill_migration_440';
  difficulty_ids CONSTANT INTEGER[] :=
    ARRAY[16,17,2,9,3,11,19,4,5,12,8];
  dosage_ids CONSTANT INTEGER[] :=
    ARRAY[1692,1684,1695,1694,1691,1689,1699,1698,1697,1700,
      1687,1696,1693,1690,1701,1688,1685,1702,1686];
  completed_difficulty INTEGER;
  completed_dosage INTEGER;
BEGIN
  IF(SELECT count(*) FROM coaching.exercise
     WHERE facility_id=1 AND id=ANY(difficulty_ids)
       AND archived IS FALSE AND is_published IS TRUE)<>11
    OR(SELECT count(*) FROM coaching.exercise
       WHERE facility_id=1 AND id=ANY(dosage_ids)
         AND archived IS FALSE AND is_published IS TRUE)<>19 THEN
    RAISE EXCEPTION '% cannot find every active published target',migration_key;
  END IF;

  SELECT count(*) INTO completed_difficulty
  FROM coaching.exercise_difficulty_profile difficulty
  WHERE difficulty.exercise_id=ANY(difficulty_ids)
    AND difficulty.source=difficulty_source
    AND difficulty.overall=GREATEST(difficulty.technical,difficulty.load);
  SELECT count(*) INTO completed_dosage
  FROM coaching.exercise_dosage_profile dosage
  WHERE dosage.exercise_id=ANY(dosage_ids)
    AND dosage.profile_name='needs-engine-default-v1'
    AND dosage.is_default IS TRUE;
  IF completed_difficulty=11 AND completed_dosage=19 THEN RETURN; END IF;
  IF completed_difficulty<>0 OR completed_dosage<>0 THEN
    RAISE EXCEPTION '% found partial prior backfill',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile difficulty
      WHERE difficulty.exercise_id=ANY(difficulty_ids)
        AND difficulty.source<>difficulty_source)
    OR EXISTS(SELECT 1 FROM coaching.exercise_dosage_profile dosage
      WHERE dosage.exercise_id=ANY(dosage_ids)) THEN
    RAISE EXCEPTION '% refuses to overwrite an existing profile',migration_key;
  END IF;

  INSERT INTO coaching.exercise_difficulty_profile(
    exercise_id,technical,load,overall,recommended_age_min,
    recommended_age_max,attention_demand,notes,source,updated_at,complexity)
  VALUES
    (16,7,5,7,NULL,NULL,'high',
      'Provisional: exercise complexity 7/10 and physical difficulty 5/10. Bridge entry, shoulder and wrist loading, spinal shape, inversion orientation, and safe exit require calibration review.',
      difficulty_source,now(),NULL),
    (17,8,7,8,NULL,NULL,'high',
      'Provisional: exercise complexity 8/10 and physical difficulty 7/10. Bar support, swing timing, cast shape, grip security, return, and fall consequence require calibration review.',
      difficulty_source,now(),NULL),
    (2,5,5,5,NULL,NULL,'moderate',
      'Provisional: exercise complexity 5/10 and physical difficulty 5/10 at an owned box height. Takeoff, landing, box height, impact, and step-down constraints require calibration review.',
      difficulty_source,now(),NULL),
    (9,3,2,3,NULL,NULL,'low',
      'Provisional: exercise complexity 3/10 and physical difficulty 2/10. Contralateral sequencing, trunk position, range, breathing, and limb lever require calibration review.',
      difficulty_source,now(),NULL),
    (3,7,7,7,NULL,NULL,'high',
      'Provisional: exercise complexity 7/10 and physical difficulty 7/10. Drop height, landing stiffness, rebound policy, impact, tissue readiness, and stop rules require calibration review.',
      difficulty_source,now(),NULL),
    (11,6,6,6,NULL,NULL,'high',
      'Provisional: exercise complexity 6/10 and physical difficulty 6/10. Ballistic hinge timing, bell path, grip, load, density, and safe park require calibration review.',
      difficulty_source,now(),NULL),
    (19,8,7,8,NULL,NULL,'high',
      'Provisional: exercise complexity 8/10 and physical difficulty 7/10. Swing amplitude, release or regrip policy, bar spacing, grip, flight, catch, and fall consequence require calibration review.',
      difficulty_source,now(),NULL),
    (4,6,8,8,NULL,NULL,'high',
      'Provisional: exercise complexity 6/10 and physical difficulty 8/10. Knee support, hip position, eccentric range, assistance, hamstring force, and recovery require calibration review.',
      difficulty_source,now(),NULL),
    (5,2,3,3,NULL,NULL,'low',
      'Provisional: exercise complexity 2/10 and physical difficulty 3/10. Support position, lever, breathing, hold duration, and alignment require calibration review.',
      difficulty_source,now(),NULL),
    (12,5,7,7,NULL,NULL,'moderate',
      'Provisional: exercise complexity 5/10 and physical difficulty 7/10. Grip, start and finish standard, body mass, assistance, range, and fatigue require calibration review.',
      difficulty_source,now(),NULL),
    (8,6,6,6,NULL,NULL,'moderate',
      'Provisional: exercise complexity 6/10 and physical difficulty 6/10. Single-leg balance, hinge range, pelvis control, implement position, side load, and tempo require calibration review.',
      difficulty_source,now(),NULL)
  ON CONFLICT(exercise_id) DO UPDATE SET
    technical=EXCLUDED.technical,load=EXCLUDED.load,
    overall=EXCLUDED.overall,recommended_age_min=NULL,
    recommended_age_max=NULL,attention_demand=EXCLUDED.attention_demand,
    notes=EXCLUDED.notes,source=EXCLUDED.source,updated_at=now(),complexity=NULL
  WHERE coaching.exercise_difficulty_profile.source=difficulty_source;

  UPDATE coaching.exercise exercise
  SET programming_logic=exercise.programming_logic||jsonb_build_object(
      'difficultyBackfillMigration',migration_key,
      'difficultyState','provisional_requires_calibration_review',
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'technicalMeaning','exercise_complexity',
      'loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'humanReviewRequired',TRUE,'approvalCreated',FALSE),
    skill_level=NULL,linked_skill_id=NULL,updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id=ANY(difficulty_ids);

  INSERT INTO coaching.exercise_dosage_profile(
    exercise_id,profile_name,is_default,volume_unit,default_sets,
    default_reps,default_work_seconds,default_distance,default_contacts,
    default_rounds,default_rest_seconds,tempo,load_type,default_intensity,
    default_rpe_min,default_rpe_max,default_load_note,est_seconds_per_set,
    session_volume_min,session_volume_max,weekly_volume_min,
    weekly_volume_max,created_at)
  VALUES
    (1692,'needs-engine-default-v1',TRUE,'seconds',3,NULL,25,NULL,NULL,NULL,
      20,'controlled_transitions','bodyweight','sustainable_quality',5,7,
      'One work interval includes the exact bar-hang and squat-hold sequence; stop if grip, landing, squat position, or transition quality fails.',45,
      '2 quality intervals','4 quality intervals',NULL,NULL,now()),
    (1684,'needs-engine-default-v1',TRUE,'breaths',2,4,60,NULL,NULL,NULL,
      15,'four_equal_phases','breath','easy_downshift',1,3,
      'One breath completes the declared inhale, hold, exhale, and hold phases; never strain or extend breath holds through symptoms.',75,
      '4 breaths','10 breaths',NULL,NULL,now()),
    (1695,'needs-engine-default-v1',TRUE,'reps',3,6,20,NULL,NULL,NULL,
      30,'controlled_down_crisp_up','bodyweight','sustainable_quality',6,8,
      'Use only an owned burpee and target contract; stop before landing, trunk, or target quality degrades.',50,
      '12 reps','24 reps',NULL,NULL,now()),
    (1694,'needs-engine-default-v1',TRUE,'seconds',4,NULL,15,NULL,NULL,NULL,
      20,'repeatable_braking_rhythm','bodyweight','sustainable_quality',6,8,
      'Keep cone distance, lane, turn rule, and footwork exact; stop if braking, posture, or spacing degrades.',35,
      '45 seconds','90 seconds',NULL,NULL,now()),
    (1691,'needs-engine-default-v1',TRUE,'seconds',4,NULL,20,NULL,NULL,NULL,
      25,'repeatable_shuttle_rhythm','bodyweight','sustainable_quality',6,8,
      'Declare cone distance, touch standard, turn direction, and finish before the interval.',45,
      '60 seconds','120 seconds',NULL,NULL,now()),
    (1689,'needs-engine-default-v1',TRUE,'seconds',2,NULL,20,NULL,NULL,NULL,
      30,'relaxed_supported_hang','bodyweight','easy_restore',1,3,
      'Feet may use declared support; stop for pain, numbness, grip loss, breath holding, or shoulder discomfort.',50,
      '20 seconds','60 seconds',NULL,NULL,now()),
    (1699,'needs-engine-default-v1',TRUE,'reps',3,6,45,NULL,NULL,NULL,
      45,'3-1-controlled','kettlebell','moderate_capacity',6,8,
      'Declare load and owned range; the three-second descent and one-second pause must remain exact.',90,
      '12 reps','24 reps',NULL,NULL,now()),
    (1698,'needs-engine-default-v1',TRUE,'throws',4,5,15,NULL,NULL,NULL,
      45,'reset_every_throw','medicine_ball','high_intent_not_fatigue',6,8,
      'Count only crisp chest passes with a stable setup and full reset; stop when ball speed or catch-lane safety changes.',60,
      '8 throws','20 throws',NULL,NULL,now()),
    (1697,'needs-engine-default-v1',TRUE,'seconds',4,NULL,20,NULL,NULL,NULL,
      25,'repeatable_rope_rhythm','jump_rope','sustainable_quality',6,8,
      'Use an owned jump-rope pattern and count all contacts in the cumulative impact budget.',45,
      '60 seconds','120 seconds',NULL,NULL,now()),
    (1700,'needs-engine-default-v1',TRUE,'reps',4,5,45,NULL,NULL,NULL,
      60,'controlled_hinge','kettlebell','heavy_owned_load',7,9,
      'Heavy means technically owned, not maximal; preserve floor start, brace, hinge path, lockout, and safe set-down.',105,
      '12 reps','24 reps',NULL,NULL,now()),
    (1687,'needs-engine-default-v1',TRUE,'breaths',2,5,60,NULL,NULL,NULL,
      15,'slow_relaxed_breath','medicine_ball','easy_downshift',1,3,
      'Use only light comfortable feedback; the ball must not impede breathing or create pressure or anxiety.',75,
      '5 breaths','12 breaths',NULL,NULL,now()),
    (1696,'needs-engine-default-v1',TRUE,'seconds',3,NULL,30,NULL,NULL,NULL,
      20,'controlled_march','medicine_ball','sustainable_quality',5,7,
      'Declare carry position, lane, turn, and hand-change policy; stop if grip, posture, gait, or breathing loses control.',50,
      '60 seconds','120 seconds',NULL,NULL,now()),
    (1693,'needs-engine-default-v1',TRUE,'reps',3,6,15,NULL,NULL,NULL,
      30,'reset_every_slam','medicine_ball','sustainable_quality',6,8,
      'Each rep includes a safe pickup, high-quality slam, controlled retrieval, and full reset; never catch an unpredictable rebound.',45,
      '12 reps','24 reps',NULL,NULL,now()),
    (1690,'needs-engine-default-v1',TRUE,'reps',3,8,30,NULL,NULL,NULL,
      30,'controlled_squat_press','medicine_ball','sustainable_quality',6,8,
      'Declare ball load and squat range; stop before trunk, knee, press path, or breathing quality degrades.',60,
      '15 reps','30 reps',NULL,NULL,now()),
    (1701,'needs-engine-default-v1',TRUE,'jumps',4,3,20,NULL,NULL,NULL,
      60,'full_reset_every_jump','bodyweight','high_intent_not_fatigue',6,8,
      'Count every takeoff and landing; target an owned distance and stop at the first loss of projection or landing control.',80,
      '6 jumps','12 jumps',NULL,NULL,now()),
    (1688,'needs-engine-default-v1',TRUE,'seconds',2,NULL,30,NULL,NULL,NULL,
      10,'slow_continuous_walk','bodyweight','easy_restore',1,3,
      'Use a clear low-traffic cone path; keep gaze, gait, breathing, and turns relaxed and controlled.',40,
      '30 seconds','90 seconds',NULL,NULL,now()),
    (1685,'needs-engine-default-v1',TRUE,'seconds',2,NULL,45,NULL,NULL,NULL,
      10,'relaxed_static_hold','bodyweight','easy_restore',1,3,
      'Use a pain-free range with no forced knee extension, neural tension, breath holding, or partner pressure.',55,
      '45 seconds each side','90 seconds each side',NULL,NULL,now()),
    (1702,'needs-engine-default-v1',TRUE,'attempts',4,3,25,NULL,NULL,NULL,
      75,'three_jumps_then_full_reset','bodyweight','high_intent_not_fatigue',7,9,
      'One attempt contains exactly three declared broad jumps; count all three landings and stop when distance, rhythm, or landing control changes.',100,
      '4 attempts','12 attempts',NULL,NULL,now()),
    (1686,'needs-engine-default-v1',TRUE,'seconds',2,NULL,40,NULL,NULL,NULL,
      10,'relaxed_static_hold','bodyweight','easy_restore',1,3,
      'Declare straight-knee or bent-knee position and use pain-free tension without bouncing or forced range.',50,
      '40 seconds each side','80 seconds each side',NULL,NULL,now())
  ON CONFLICT(exercise_id,profile_name) DO UPDATE SET
    is_default=EXCLUDED.is_default,volume_unit=EXCLUDED.volume_unit,
    default_sets=EXCLUDED.default_sets,default_reps=EXCLUDED.default_reps,
    default_work_seconds=EXCLUDED.default_work_seconds,
    default_distance=EXCLUDED.default_distance,
    default_contacts=EXCLUDED.default_contacts,
    default_rounds=EXCLUDED.default_rounds,
    default_rest_seconds=EXCLUDED.default_rest_seconds,tempo=EXCLUDED.tempo,
    load_type=EXCLUDED.load_type,
    default_intensity=EXCLUDED.default_intensity,
    default_rpe_min=EXCLUDED.default_rpe_min,
    default_rpe_max=EXCLUDED.default_rpe_max,
    default_load_note=EXCLUDED.default_load_note,
    est_seconds_per_set=EXCLUDED.est_seconds_per_set,
    session_volume_min=EXCLUDED.session_volume_min,
    session_volume_max=EXCLUDED.session_volume_max,
    weekly_volume_min=EXCLUDED.weekly_volume_min,
    weekly_volume_max=EXCLUDED.weekly_volume_max;

  UPDATE coaching.exercise exercise
  SET programming_logic=exercise.programming_logic||jsonb_build_object(
      'dosageBackfillMigration',migration_key,
      'dosageState','generation_ready_requires_program_review',
      'doseSource','existing_card_defaults_plus_exact_volume_contract',
      'humanReviewRequired',TRUE,'approvalCreated',FALSE),
    skill_level=NULL,linked_skill_id=NULL,updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id=ANY(dosage_ids);

  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level=NULL
  WHERE exercise_id=ANY(difficulty_ids||dosage_ids);

  IF(SELECT count(*) FROM coaching.exercise_difficulty_profile difficulty
     WHERE difficulty.exercise_id=ANY(difficulty_ids)
       AND difficulty.source=difficulty_source
       AND difficulty.technical BETWEEN 1 AND 10
       AND difficulty.load BETWEEN 1 AND 10
       AND difficulty.overall=GREATEST(
         difficulty.technical,difficulty.load))<>11 THEN
    RAISE EXCEPTION '% failed difficulty model validation',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_dosage_profile dosage
     WHERE dosage.exercise_id=ANY(dosage_ids)
       AND dosage.profile_name='needs-engine-default-v1'
       AND dosage.is_default IS TRUE
       AND dosage.default_sets IS NOT NULL
       AND dosage.est_seconds_per_set IS NOT NULL
       AND(dosage.default_reps IS NOT NULL
         OR dosage.default_work_seconds IS NOT NULL
         OR dosage.default_distance IS NOT NULL
         OR dosage.default_contacts IS NOT NULL
         OR dosage.default_rounds IS NOT NULL
         OR dosage.volume_unit IN('attempts','rounds')))<>19 THEN
    RAISE EXCEPTION '% failed dosage generation validation',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise exercise
      WHERE exercise.id=ANY(difficulty_ids||dosage_ids)
        AND(exercise.skill_level IS NOT NULL
          OR exercise.linked_skill_id IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
      WHERE safety.exercise_id=ANY(difficulty_ids||dosage_ids)
        AND safety.minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% created forbidden exercise proficiency state',
      migration_key;
  END IF;
END $$;
