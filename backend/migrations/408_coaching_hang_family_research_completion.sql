-- Complete the candidate evidence and governance packet for Dead Hang,
-- Active Hang, and Scapular Pull-Up after migrations 309, 313, and 314.
--
-- The three identities remain distinct: passive scapular position, active
-- straight-arm scapular isometric, and repeated straight-arm scapular motion.
-- Existing exact variants and delivery profiles already match the research
-- packet and are preserved. This migration adds version-bound evidence,
-- alternate assessments, five public media candidates per definition,
-- inverse regression proposals, difficulty calibration proposals, and
-- quarantined card-test packets.
--
-- No exercise skill/proficiency level is created. Exercise difficulty remains
-- exercise complexity plus physical difficulty, with overall derived as their
-- maximum. Media playback, embedding, exact match, captions, quality, reviewer,
-- and approval remain unverified. No human approval is fabricated.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '408_coaching_hang_family_research_completion';
  research_batch CONSTANT TEXT := 'hang-scapular-control-family-v1';
  research_version CONSTANT TEXT := '2026-07-26.30';
  already_applied_count INTEGER;
  actual_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT count(*)
  INTO actual_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND status <> 'archived';

  IF actual_count <> 3 THEN
    RAISE EXCEPTION '% requires exactly 3 active hang-family definitions; found %', migration_key, actual_count;
  END IF;

  SELECT count(*)
  INTO already_applied_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND status <> 'archived'
    AND provenance_json->>'researchCompletionMigration' = migration_key;

  IF already_applied_count NOT IN (0,3) THEN
    RAISE EXCEPTION '% found a partial prior application on % definitions', migration_key, already_applied_count;
  END IF;

  IF already_applied_count = 0 AND EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug IN ('dead-hang','active-hang','scapular-pull-up')
      AND status <> 'archived'
      AND card_version <> 3
  ) THEN
    RAISE EXCEPTION '% expected migration-314 card version 3 before first application', migration_key;
  END IF;

  IF already_applied_count = 3 AND EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id = 1
      AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
      AND definition.status <> 'archived'
      AND definition.card_version <> 4
  ) THEN
    RAISE EXCEPTION '% found drift after completion; all three cards must remain at version 4', migration_key;
  END IF;

  SELECT count(*)
  INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source ON source.definition_id = definition.id
  WHERE definition.facility_id = 1
    AND definition.status <> 'archived'
    AND (
      (definition.slug = 'dead-hang' AND source.legacy_exercise_id IN (201,1689))
      OR (definition.slug = 'active-hang' AND source.legacy_exercise_id IN (820,857,1074))
      OR (definition.slug = 'scapular-pull-up' AND source.legacy_exercise_id = 200)
    );

  IF actual_count <> 6 OR EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source ON source.definition_id = definition.id
    WHERE definition.facility_id = 1
      AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
      AND definition.status <> 'archived'
      AND NOT (
        (definition.slug = 'dead-hang' AND source.legacy_exercise_id IN (201,1689))
        OR (definition.slug = 'active-hang' AND source.legacy_exercise_id IN (820,857,1074))
        OR (definition.slug = 'scapular-pull-up' AND source.legacy_exercise_id = 200)
      )
  ) THEN
    RAISE EXCEPTION '% expected exactly all 6 migration-309 hang-family legacy mappings', migration_key;
  END IF;

  SELECT count(*)
  INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id = definition.id
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND definition.status <> 'archived'
    AND variant.status <> 'archived'
    AND variant.variant_key IN ('baseline','foot-assisted','band-assisted','ring','weighted','single-arm');

  IF actual_count <> 18 OR EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id = definition.id
    WHERE definition.facility_id = 1
      AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
      AND definition.status <> 'archived'
      AND variant.status <> 'archived'
      AND variant.variant_key NOT IN ('baseline','foot-assisted','band-assisted','ring','weighted','single-arm')
  ) THEN
    RAISE EXCEPTION '% requires all 18 exact migration-313 review variants and no additional selectable identity', migration_key;
  END IF;

  SELECT count(*)
  INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id = definition.id
  JOIN coaching.exercise_delivery_profile_v1 profile ON profile.variant_id = variant.id
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND definition.status <> 'archived'
    AND variant.status <> 'archived'
    AND profile.status <> 'archived';

  IF actual_count <> 19 THEN
    RAISE EXCEPTION '% requires all 19 exact contextual hang-family delivery profiles; found %', migration_key, actual_count;
  END IF;

  SELECT count(*)
  INTO actual_count
  FROM coaching.exercise_identity_resolution_v1 identity
  JOIN coaching.exercise_definition_v1 survivor ON survivor.id = identity.survivor_definition_id
  JOIN coaching.exercise_definition_v1 resolved ON resolved.id = identity.resolved_definition_id
  WHERE identity.facility_id = 1
    AND identity.reviewed_by IS NULL
    AND (
      (survivor.slug = 'active-hang' AND resolved.slug = 'dead-hang' AND identity.decision = 'distinct_exercises')
      OR (survivor.slug = 'active-hang' AND resolved.slug = 'scapular-pull-up' AND identity.decision = 'distinct_exercises')
      OR (survivor.slug = 'dead-hang' AND resolved.slug = 'scapular-pull-up' AND identity.decision = 'distinct_exercises')
      OR (survivor.slug = 'pull-up-chin-up' AND resolved.slug = 'scapular-pull-up' AND identity.decision = 'distinct_exercises')
      OR (survivor.slug = 'active-hang' AND resolved.slug = 'active-hang-scapular-hold' AND identity.decision = 'duplicate_consolidated')
    );

  IF actual_count <> 5 THEN
    RAISE EXCEPTION '% requires all 5 researched hang-family identity boundaries and consolidations; found %', migration_key, actual_count;
  END IF;

  SELECT count(*)
  INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND definition.status <> 'archived'
    AND (
      definition.status = 'published'
      OR definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL
      OR definition.last_reviewed_at IS NOT NULL
    );

  IF protected_count > 0 THEN
    RAISE EXCEPTION '% refused to overwrite % human-reviewed or published definition(s)', migration_key, protected_count;
  END IF;

  SELECT count(*)
  INTO protected_count
  FROM coaching.exercise_score_v1 score
  WHERE score.exercise_id IN (200,201,820,857,1074,1689)
    AND (
      score.human_review_status <> 'queued'
      OR score.reviewed_by IS NOT NULL
      OR score.reviewed_at IS NOT NULL
    );

  IF protected_count > 0 THEN
    RAISE EXCEPTION '% refused to overwrite % human-reviewed legacy score record(s)', migration_key, protected_count;
  END IF;

  SELECT
    (SELECT count(*)
     FROM coaching.exercise_definition_v1 definition
     JOIN coaching.exercise_variant_v1 variant ON variant.definition_id = definition.id
     LEFT JOIN coaching.exercise_delivery_profile_v1 profile ON profile.variant_id = variant.id
     WHERE definition.facility_id = 1
       AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
       AND (variant.status = 'published' OR profile.status = 'published'))
    + (SELECT count(*)
       FROM coaching.exercise_definition_v1 definition
       JOIN coaching.exercise_section_evidence_v1 evidence ON evidence.definition_id = definition.id
        AND evidence.reviewed_card_version = definition.card_version
       WHERE definition.facility_id = 1
         AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
         AND evidence.review_status NOT IN ('candidate','superseded'))
    + (SELECT count(*)
       FROM coaching.exercise_definition_v1 definition
       JOIN coaching.exercise_media_candidate_v1 media ON media.definition_id = definition.id
        AND media.reviewed_card_version = definition.card_version
       WHERE definition.facility_id = 1
         AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
         AND media.review_status NOT IN ('candidate','superseded'))
    + (SELECT count(*)
       FROM coaching.exercise_definition_v1 definition
       JOIN coaching.exercise_alternate_assessment_v1 alternate ON alternate.definition_id = definition.id
        AND alternate.reviewed_card_version = definition.card_version
       WHERE definition.facility_id = 1
         AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
         AND alternate.review_status NOT IN ('candidate','superseded'))
    + (SELECT count(*)
       FROM coaching.exercise_definition_v1 definition
       JOIN coaching.exercise_card_review_v1 review ON review.definition_id = definition.id
       WHERE definition.facility_id = 1
         AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up'))
    + (SELECT count(*)
       FROM coaching.exercise_definition_v1 definition
       JOIN coaching.exercise_card_revision_v1 revision ON revision.definition_id = definition.id
       WHERE definition.facility_id = 1
         AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up'))
    + (SELECT count(*)
       FROM coaching.exercise_definition_v1 definition
       JOIN coaching.exercise_media_review_v1 review ON review.definition_id = definition.id
       WHERE definition.facility_id = 1
         AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up'))
    + (SELECT count(*)
       FROM coaching.exercise_definition_v1 definition
       JOIN coaching.exercise_variant_v1 variant ON variant.definition_id = definition.id
       JOIN coaching.exercise_relationship_v1 relationship
         ON relationship.from_variant_id = variant.id OR relationship.to_variant_id = variant.id
       WHERE definition.facility_id = 1
         AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
         AND (relationship.review_status <> 'review' OR relationship.reviewed_by IS NOT NULL OR relationship.reviewed_at IS NOT NULL))
    + (SELECT count(*)
       FROM coaching.exercise_definition_v1 definition
       JOIN coaching.exercise_variant_v1 variant ON variant.definition_id = definition.id
       JOIN coaching.exercise_score_calibration_v1 calibration ON calibration.variant_id = variant.id
       WHERE definition.facility_id = 1
         AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
         AND (calibration.status <> 'review' OR calibration.reviewed_by IS NOT NULL OR calibration.reviewed_at IS NOT NULL))
  INTO protected_count;

  IF protected_count > 0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published dependent record(s)', migration_key, protected_count;
  END IF;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version = CASE WHEN already_applied_count = 0 THEN definition.card_version + 1 ELSE definition.card_version END,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = definition.provenance_json || jsonb_build_object(
        'researchCompletionMigration',migration_key,
        'researchBatch',research_batch,
        'researchVersion',research_version,
        'identityAuthorityMigrations',jsonb_build_array(
          '309_coaching_hang_family_identity_consolidation',
          '313_coaching_hang_family_structural_completion',
          '314_coaching_hang_family_contract_completion',
          '395_coaching_score_72_identity_boundaries'
        ),
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'evidenceState','candidate_requires_human_review',
        'mediaState','public_candidates_unverified_and_non_embeddable',
        'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE,
        'mediaApprovalCreated',FALSE,
        'graphApprovalCreated',FALSE,
        'calibrationApprovalCreated',FALSE
      ),
      updated_at = now()
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND definition.status <> 'archived';

  UPDATE coaching.exercise_section_evidence_v1 evidence
  SET review_status = 'superseded', updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE evidence.definition_id = definition.id
    AND definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND evidence.reviewed_card_version < definition.card_version
    AND evidence.review_status = 'candidate';

  UPDATE coaching.exercise_media_candidate_v1 media
  SET review_status = 'superseded', updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE media.definition_id = definition.id
    AND definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND media.reviewed_card_version < definition.card_version
    AND media.review_status = 'candidate';

  UPDATE coaching.exercise_alternate_assessment_v1 alternate
  SET review_status = 'superseded', updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE alternate.definition_id = definition.id
    AND definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND alternate.reviewed_card_version < definition.card_version
    AND alternate.review_status = 'candidate';

  CREATE TEMP TABLE hang_evidence_seed (
    definition_slug TEXT NOT NULL,
    section_key TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality SMALLINT NOT NULL,
    claims_json JSONB NOT NULL,
    PRIMARY KEY (definition_slug, section_key)
  ) ON COMMIT DROP;

  INSERT INTO hang_evidence_seed VALUES
    ('dead-hang','identity','https://www.crossfit.com/essentials/crossfit-bar-hanging','Is Hanging from a Bar Worth Your Time? A CrossFit Reality Check','CrossFit','expert_instruction',70,'["The professional instruction distinguishes a passive hang, in which the shoulders relax upward, from an active-shoulder hang, in which the shoulders are drawn away from the ears.","Use passive scapular mode as the Dead Hang identity. Treat breathing, warm-up use, grip emphasis, and hold duration as delivery choices rather than separate cards."]'::JSONB),
    ('dead-hang','taxonomy','https://www.crossfit.com/essentials/crossfit-bar-hanging','Is Hanging from a Bar Worth Your Time? A CrossFit Reality Check','CrossFit','expert_instruction',70,'["Hanging position must state shoulder mode because passive and active approaches are not interchangeable.","Classify {{canonicalName}} by passive scapular mode, straight elbows, grip and implement, assistance, hold intent, external load, and safe exit. Exercise complexity and physical difficulty replace any audience-level label."]'::JSONB),
    ('dead-hang','anatomy','https://www.acefitness.org/blog/3516/muscles-that-move-the-scapulae/','Muscles that Move the Scapulae','American Council on Exercise','expert_instruction',74,'["The anatomy reference distinguishes scapular elevation, depression, retraction, protraction, and rotation and identifies muscles contributing to those actions.","A passive hang permits scapular elevation rather than requiring active depression. Grip tissues and the whole shoulder complex remain relevant; do not describe the position as muscle-free or structurally uniform across athletes."]'::JSONB),
    ('dead-hang','biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/','Scapula kinematics of pull-up techniques: Avoiding impingement risk with training changes','Journal of Science and Medicine in Sport','peer_reviewed_research',86,'["Pull-up technique changes scapulothoracic, glenohumeral, and humerothoracic kinematics, and the study reports meaningful inter-technique differences in elevated-arm positions.","This adjacent pull-up study supports explicit grip and shoulder-mode specification, but it did not test passive dead hangs and cannot establish an ideal universal scapular position or injury effect for {{canonicalName}}."]'::JSONB),
    ('dead-hang','difficulty','https://pmc.ncbi.nlm.nih.gov/articles/PMC6458579/','Comparison of the Effects of Three Hangboard Strength and Endurance Training Programs on Grip Endurance in Sport Climbers','Journal of Human Kinetics','peer_reviewed_research',84,'["Dead-hang loading is commonly manipulated through hold size, added weight, hanging duration, repetition pattern, and recovery, and it can create substantial finger-flexor endurance demands.","A general bar Dead Hang has low exercise complexity but moderate-to-high relative physical difficulty for many athletes. Derive overall difficulty as the maximum of complexity and physical demand; keep grip fatigue, supervision, failure consequence, and shoulder tolerance separate."]'::JSONB),
    ('dead-hang','load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC6458579/','Comparison of the Effects of Three Hangboard Strength and Endurance Training Programs on Grip Endurance in Sport Climbers','Journal of Human Kinetics','peer_reviewed_research',84,'["In trained climbers, repeated and maximal dead-hang protocols changed grip-endurance outcomes, showing that hang time, rest, edge, and loading materially alter the training dose.","For {{canonicalName}}, record implement and grip, assistance or added load, seconds per hold, total time, rest, grip loss, shoulder response, and overlap with climbing, pull-ups, carries, and bar work. Do not import small-edge climber protocols as universal bar-hang prescriptions."]'::JSONB),
    ('dead-hang','constraints','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Safe resistance training requires appropriate equipment, qualified supervision, technique instruction, and progression matched to readiness.","Require a rated anchor, safe bar height, full clearance, secure grip, tolerable passive overhead position, and controlled dismount. Foot assistance is a first-line load adjustment, not a failure."]'::JSONB),
    ('dead-hang','dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC6458579/','Comparison of the Effects of Three Hangboard Strength and Endurance Training Programs on Grip Endurance in Sport Climbers','Journal of Human Kinetics','peer_reviewed_research',84,'["The climber study used distinct maximal and intermittent protocols and generous recovery, illustrating that a hang dose is incomplete without load, time, repetitions, and rest.","Use short submaximal general-population candidate doses and progress from assistance to time before added load. The proposed ranges are conservative programming judgments, not direct prescriptions from the trained-climber study."]'::JSONB),
    ('dead-hang','instructions','https://www.crossfit.com/essentials/crossfit-bar-hanging','Is Hanging from a Bar Worth Your Time? A CrossFit Reality Check','CrossFit','expert_instruction',70,'["The professional source says hanging technique should change with the purpose and explicitly differentiates passive from active shoulders.","Instructions for {{canonicalName}} must say passive mode, secure grip, straight elbows, assistance, still body, hold endpoint, and step-down. Do not cue active shoulder depression on a passive-hang card."]'::JSONB),
    ('dead-hang','programming','https://www.crossfit.com/essentials/crossfit-bar-hanging','Is Hanging from a Bar Worth Your Time? A CrossFit Reality Check','CrossFit','expert_instruction',70,'["The professional source presents hanging as a possible warm-up, grip, or position exposure and cautions that dedicated hanging may add little when similar pulling volume is already high.","Select {{canonicalName}} only for a declared passive-position or grip purpose, count it toward cumulative grip and shoulder load, and avoid fatigue before high-consequence bar, climbing, or ninja work."]'::JSONB),
    ('dead-hang','athlete_support','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Long-term development should account for individual readiness, movement competence, psychosocial needs, and progressive exposure.","Athlete support should show passive mode, assistance, hold time, safe step-down, an acceptable repetition, and pain, tingling, slipping-grip, or dizziness stop signals in plain language."]'::JSONB),
    ('dead-hang','coach_support','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Qualified instruction, close supervision, safe equipment, and gradual progression are core requirements.","Coach support should include anchor and clearance checks, true station capacity, assistance setup, grip and shoulder observation, total hang-time logging, fatigue-order warnings, and hard quarantine of the historical passive-or-active source."]'::JSONB),
    ('dead-hang','alternates','https://www.crossfit.com/essentials/crossfit-bar-hanging','Is Hanging from a Bar Worth Your Time? A CrossFit Reality Check','CrossFit','expert_instruction',70,'["Passive and active hanging positions serve different stated purposes, while grip demands may remain meaningful in either.","Foot and band assistance, grip, implement, duration, and added load can be controlled variants or delivery annotations. Active Hang, Scapular Pull-Up, flexed-arm hang, pull-up, and small-edge hangboard work remain separate definitions."]'::JSONB),
    ('active-hang','identity','https://www.crossfit.com/essentials/crossfit-bar-hanging','Is Hanging from a Bar Worth Your Time? A CrossFit Reality Check','CrossFit','expert_instruction',70,'["The professional instruction defines an active hanging position by keeping the shoulders engaged and slightly away from the ears.","Treat straight-elbow scapular engagement held without visible repetitions as Active Hang. Hold duration, breathing, trunk shape, assistance, and grip are controlled delivery or variant dimensions."]'::JSONB),
    ('active-hang','taxonomy','https://www.crossfit.com/essentials/crossfit-bar-hanging','Is Hanging from a Bar Worth Your Time? A CrossFit Reality Check','CrossFit','expert_instruction',70,'["The source explicitly distinguishes active-shoulder and passive-hang approaches by goal and shoulder position.","Classify {{canonicalName}} by active isometric scapular mode, straight elbows, implement, grip, assistance, trunk shape, time, and added load. Do not merge it with passive hanging or dynamic scapular repetitions."]'::JSONB),
    ('active-hang','anatomy','https://www.acefitness.org/blog/3516/muscles-that-move-the-scapulae/','Muscles that Move the Scapulae','American Council on Exercise','expert_instruction',74,'["The anatomy reference identifies the lower trapezius with scapular depression and distinguishes depression from elevation, retraction, protraction, and rotation.","Represent scapular depression as the primary active action, with grip, straight-elbow position, the rotator cuff and other scapular stabilizers, and trunk control also modeled. Do not reduce the shoulder complex to one muscle."]'::JSONB),
    ('active-hang','biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/','Scapula kinematics of pull-up techniques: Avoiding impingement risk with training changes','Journal of Science and Medicine in Sport','peer_reviewed_research',86,'["Elevated-arm pulling techniques produced different scapulothoracic and glenohumeral kinematics, showing that grip and technique affect shoulder motion.","This adjacent pull-up evidence supports an explicitly defined, comfortable active position and cautions against treating one forced down-and-back cue as universal. It does not directly validate static Active Hang mechanics or safety."]'::JSONB),
    ('active-hang','difficulty','https://www.crossfit.com/essentials/crossfit-bar-hanging','Is Hanging from a Bar Worth Your Time? A CrossFit Reality Check','CrossFit','expert_instruction',70,'["Active hanging requires continued shoulder-girdle engagement instead of allowing the shoulders to remain passive.","Score exercise complexity separately from relative physical difficulty and derive overall as their maximum. Active scapular force raises physical demand above Dead Hang, while coordination, supervision, grip fatigue, and failure consequence remain separate planning dimensions."]'::JSONB),
    ('active-hang','load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC6458579/','Comparison of the Effects of Three Hangboard Strength and Endurance Training Programs on Grip Endurance in Sport Climbers','Journal of Human Kinetics','peer_reviewed_research',84,'["Hanging dose and grip fatigue change with assistance or added load, hold duration, repetition pattern, grip surface, and rest.","For {{canonicalName}}, also record scapular-position drift and elbow bend. Count the exposure with pulling, climbing, carries, rings, rope, and other grip or scapular-depression work rather than treating a short static exercise as fatigue-free."]'::JSONB),
    ('active-hang','constraints','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Safe exercise requires appropriate equipment, instruction, supervision, and progression matched to individual readiness.","Require a rated anchor, safe bar height, secure grip, pain-free overhead position, the ability to find a small active scapular position with straight elbows, and a controlled exit. Use foot or band assistance before position quality fails."]'::JSONB),
    ('active-hang','dosage','https://www.crossfit.com/wp-content/uploads/2025/10/30140653/CAP_Open_Training_Plans_02_PullUp_20251027_R1-1.pdf','Train for the Open With CrossFit Affiliate Programming: Pull-Up','CrossFit Affiliate Programming','professional_standard',74,'["The professional pull-up plan uses repeated timed Active Hang sets as a specific pulling-capacity exposure.","That plan demonstrates that sets, hold time, and recovery must be explicit; it is not a universal dose. Begin with shorter assisted holds, preserve position reserve, and progress only after repeatable straight-elbow control."]'::JSONB),
    ('active-hang','instructions','https://www.crossfit.com/essentials/crossfit-bar-hanging','Is Hanging from a Bar Worth Your Time? A CrossFit Reality Check','CrossFit','expert_instruction',70,'["The professional source cues active hanging by drawing the shoulders slightly away from the ears while staying engaged.","Instructions for {{canonicalName}} must include secure grip, straight elbows, small active scapular position, assigned trunk shape, hold endpoint, breathing, and controlled step-down. Avoid maximal depression or aggressive forced retraction."]'::JSONB),
    ('active-hang','programming','https://www.crossfit.com/wp-content/uploads/2025/10/30140653/CAP_Open_Training_Plans_02_PullUp_20251027_R1-1.pdf','Train for the Open With CrossFit Affiliate Programming: Pull-Up','CrossFit Affiliate Programming','professional_standard',74,'["The plan uses Active Hang as a pulling prerequisite or accessory exposure and separates it from dynamic pull-up technique work.","Use {{canonicalName}} when active straight-arm position ownership is the session goal, keep enough reserve for later high-consequence bar tasks, and count cumulative grip and shoulder loading."]'::JSONB),
    ('active-hang','athlete_support','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Training should reflect individual readiness, competence, and progressive development.","Athlete support should visually compare passive and active positions, show straight elbows, assistance, hold time, safe step-down, and pain, tingling, grip-slip, or shoulder-drift stop signals without assigning a level to the card."]'::JSONB),
    ('active-hang','coach_support','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Qualified instruction, safe equipment, supervision, and gradual progression are central to resistance training.","Coach support should include anchor and clearance checks, passive-versus-active mode confirmation, front or side observation, grip and scapular-drift logging, fatigue-order warnings, assistance options, and safe station turnover."]'::JSONB),
    ('active-hang','alternates','https://www.crossfit.com/essentials/crossfit-bar-hanging','Is Hanging from a Bar Worth Your Time? A CrossFit Reality Check','CrossFit','expert_instruction',70,'["Active and passive positions are intentionally distinguished, while grip, equipment, and loading can be manipulated.","Foot or band assistance, rings, trunk shape, hold time, and added load can be variants or delivery annotations. Dead Hang, Scapular Pull-Up, pull-up, and flexed-arm hang remain separate definitions."]'::JSONB),
    ('scapular-pull-up','identity','https://www.calixpert.com/exercises/scapula-pull-ups','How To Do Scapula Pull-Ups','Calixpert','expert_instruction',68,'["The exercise instruction defines Scapular Pull-Ups as straight-arm hanging repetitions in which the shoulder blades move down and the body rises slightly, followed by a controlled return.","Use repeated scapular motion with straight elbows as the identity boundary. If the athlete only holds the top position, the task is Active Hang; if the shoulders remain passive, it is Dead Hang."]'::JSONB),
    ('scapular-pull-up','taxonomy','https://www.calixpert.com/exercises/scapula-pull-ups','How To Do Scapula Pull-Ups','Calixpert','expert_instruction',68,'["The source differentiates scapular movement from elbow flexion and describes a small range rather than a full pull-up.","Classify {{canonicalName}} by dynamic scapular mode, straight elbows, bottom and top positions, implement, grip, assistance, range, pause, tempo, repetitions, and trunk shape."]'::JSONB),
    ('scapular-pull-up','anatomy','https://www.acefitness.org/blog/3516/muscles-that-move-the-scapulae/','Muscles that Move the Scapulae','American Council on Exercise','expert_instruction',74,'["The anatomy reference distinguishes scapular depression, elevation, retraction, protraction, and rotation and identifies muscular contributors including the lower trapezius.","Represent the task as scapular depression and controlled return under a fixed overhead hand contact, with grip, shoulder stabilizers, straight-elbow position, and trunk control also modeled. Do not describe scapular motion as a single isolated joint action."]'::JSONB),
    ('scapular-pull-up','biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/','Scapula kinematics of pull-up techniques: Avoiding impingement risk with training changes','Journal of Science and Medicine in Sport','peer_reviewed_research',86,'["Pull-up techniques produce different three-dimensional humerothoracic, scapulothoracic, and glenohumeral kinematics.","This adjacent study supports specifying grip, shoulder path, and technique and avoiding a universal forced position. It did not test the isolated Scapular Pull-Up, so exact range and injury implications remain unverified."]'::JSONB),
    ('scapular-pull-up','difficulty','https://www.calixpert.com/exercises/scapula-pull-ups','How To Do Scapula Pull-Ups','Calixpert','expert_instruction',68,'["The exercise requires the athlete to isolate small scapular motion while keeping the arms straight and preventing swing.","Score exercise complexity separately from physical difficulty and derive overall as their maximum. Dynamic scapular control raises complexity above static hangs, while relative bodyweight and grip create substantial physical demand."]'::JSONB),
    ('scapular-pull-up','load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC6458579/','Comparison of the Effects of Three Hangboard Strength and Endurance Training Programs on Grip Endurance in Sport Climbers','Journal of Human Kinetics','peer_reviewed_research',84,'["Hanging fatigue changes with grip surface, relative load, time, repetitions, and recovery.","For {{canonicalName}}, additionally track scapular range, return control, elbow bend, and swing across repetitions. Count the exposure with pull-ups, climbing, rings, rope, carries, and other grip or scapular-loading work."]'::JSONB),
    ('scapular-pull-up','constraints','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Safe resistance training requires appropriate equipment, instruction, supervision, and progression matched to readiness.","Require a rated anchor, safe bar height, secure grip, tolerable assigned top and bottom shoulder positions, straight-elbow scapular motion, controlled return, and safe exit. Use foot or band assistance before technique changes."]'::JSONB),
    ('scapular-pull-up','dosage','https://www.calixpert.com/exercises/scapula-pull-ups','How To Do Scapula Pull-Ups','Calixpert','expert_instruction',68,'["The exercise instruction uses controlled repetitions and a brief top pause, emphasizing straight arms and a controlled return.","Use low candidate repetition ranges, stop with clean repetitions in reserve, and progress control or assistance before load. No source validates one universal repetition count or range."]'::JSONB),
    ('scapular-pull-up','instructions','https://www.calixpert.com/exercises/scapula-pull-ups','How To Do Scapula Pull-Ups','Calixpert','expert_instruction',68,'["The instruction starts in a controlled hang, keeps the arms straight, moves the shoulder blades down to raise the body slightly, pauses, and returns without dropping.","Instructions for {{canonicalName}} must name the assigned bottom, small scapular action, straight elbows, top quality, controlled return, swing limit, hold endpoint, and safe step-down."]'::JSONB),
    ('scapular-pull-up','programming','https://www.crossfit.com/wp-content/uploads/2025/10/30140653/CAP_Open_Training_Plans_02_PullUp_20251027_R1-1.pdf','Train for the Open With CrossFit Affiliate Programming: Pull-Up','CrossFit Affiliate Programming','professional_standard',74,'["The professional plan separates static Active Hang work from dynamic pull-up technique, supporting distinct exercise and delivery choices.","Use {{canonicalName}} for dynamic straight-arm scapular control, not as an interchangeable passive hang or full pull-up. Place quality practice before fatigue and budget grip and shoulder exposure."]'::JSONB),
    ('scapular-pull-up','athlete_support','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Training should reflect individual readiness, competence, and progressive development.","Athlete support should show start, small top position, controlled return, straight elbows, assistance, repetitions, safe step-down, and pain, tingling, grip-slip, elbow-bend, or swing stop signals."]'::JSONB),
    ('scapular-pull-up','coach_support','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Qualified instruction, safe equipment, supervision, and gradual progression are core requirements.","Coach support should include anchor and clearance checks, demonstration of the small range, side observation of elbow and scapular motion, first-to-last repetition comparison, assistance options, cumulative grip-load warning, and station turnover."]'::JSONB),
    ('scapular-pull-up','alternates','https://www.calixpert.com/exercises/scapula-pull-ups','How To Do Scapula Pull-Ups','Calixpert','expert_instruction',68,'["Assistance, grip, implement, pause, range, and added load can change the exercise demand while straight-elbow scapular repetitions remain primary.","Foot or band assistance, rings, top pause, unilateral loading, and added weight can become controlled variants. Dead Hang, Active Hang, full Pull-Up, flexed-arm hang, and horizontal scapular row remain separate definitions."]'::JSONB),
    ('dead-hang','safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Appropriate equipment, qualified supervision, clear technique standards, and readiness-matched progression are core resistance-training safeguards.","Stop for pain, pinching, instability, numbness, tingling, dizziness, grip opening, uncontrolled swing, or loss of a safe step-down. Passive shoulder position is assigned, not forced."]'::JSONB),
    ('dead-hang','accessibility','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Long-term development should reflect current readiness, movement competence, individual response, and progressive exposure.","Scale with stable foot assistance, lower bar height, shorter submaximal holds, longer rest, alternate grip, or a supported non-hanging task without assigning an athlete proficiency level to the card."]'::JSONB),
    ('dead-hang','media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["YouTube documents privacy-enhanced embedding through youtube-nocookie.com; an embed URL alone does not prove playback, permission, accessibility, or exercise match.","Five public-title discoveries are candidates for the bilateral passive-scapular Dead Hang only. Mount, grip, passive mode, complete hold, safe exit, captions, accessibility, and claims all require full human review."]'::JSONB),
    ('active-hang','safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Appropriate equipment, qualified supervision, clear technique standards, and readiness-matched progression are core resistance-training safeguards.","Stop for symptoms, grip opening, elbow bend, drift into an unintended passive hang, forced shoulder position, uncontrolled swing, breath distress, or loss of a safe step-down."]'::JSONB),
    ('active-hang','accessibility','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Long-term development should reflect current readiness, movement competence, individual response, and progressive exposure.","Scale with stable foot or managed band assistance, shorter holds, longer rest, alternate grip, or supported scapular isometrics without assigning an athlete proficiency level to the card."]'::JSONB),
    ('active-hang','media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["YouTube documents privacy-enhanced embedding through youtube-nocookie.com; an embed URL alone does not prove playback, permission, accessibility, or exercise match.","Five public-title discoveries are candidates for the straight-elbow active-scapular isometric only. Mount, exact active position, complete hold, safe exit, captions, accessibility, and claims require human review."]'::JSONB),
    ('scapular-pull-up','safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Appropriate equipment, qualified supervision, clear technique standards, and readiness-matched progression are core resistance-training safeguards.","Stop for symptoms, grip opening, elbow flexion, loss of the assigned top or bottom shoulder position, uncontrolled return, swing, marked range loss, or unsafe dismount."]'::JSONB),
    ('scapular-pull-up','accessibility','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Long-term development should reflect current readiness, movement competence, individual response, and progressive exposure.","Scale with stable foot or managed band assistance, fewer repetitions, smaller owned scapular range, slower tempo, longer rest, or a supported non-hanging scapular task without assigning an athlete proficiency level."]'::JSONB),
    ('scapular-pull-up','media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["YouTube documents privacy-enhanced embedding through youtube-nocookie.com; an embed URL alone does not prove playback, permission, accessibility, or exercise match.","Five public-title discoveries are candidates for repeated straight-arm scapular motion only. Exact range, elbow position, controlled return, full sequence, safety, captions, accessibility, and claims require human review."]'::JSONB);

  INSERT INTO coaching.exercise_section_evidence_v1 (
    definition_id, reviewed_card_version, section_key, source_url, source_title,
    source_publisher, source_kind, claims_json, evidence_quality, review_status,
    reviewer_user_id, reviewed_at
  )
  SELECT definition.id, definition.card_version, evidence.section_key,
    evidence.source_url, evidence.source_title, evidence.source_publisher,
    evidence.source_kind, evidence.claims_json, evidence.evidence_quality,
    'candidate', NULL, NULL
  FROM hang_evidence_seed evidence
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = evidence.definition_slug
   AND definition.status <> 'archived'
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    section_key,
    source_url
  )
  DO UPDATE SET
    source_url = EXCLUDED.source_url,
    source_title = EXCLUDED.source_title,
    source_publisher = EXCLUDED.source_publisher,
    source_kind = EXCLUDED.source_kind,
    claims_json = EXCLUDED.claims_json,
    evidence_quality = EXCLUDED.evidence_quality,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  CREATE TEMP TABLE hang_media_seed (
    definition_slug TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    source_query TEXT NOT NULL,
    notes TEXT NOT NULL,
    PRIMARY KEY (definition_slug, video_id)
  ) ON COMMIT DROP;

  INSERT INTO hang_media_seed VALUES
    ('dead-hang','0Bx_Ap7-EwU','Dead Hang','OPEX Fitness','Public YouTube search: dead hang exercise demo CrossFit','Candidate by exact public title only. Passive shoulder mode, grip, setup, safe exit, full sequence, cue quality, and accessibility require human review.'),
    ('dead-hang','2vspW4N4BMs','Dead Hang | Proper Form Tutorial for Grip & Shoulder Health','FIT.nl','Public YouTube search: dead hang exercise technique','Candidate by public title/channel only. The title''s health framing is not adopted as a Vortex claim; exact passive mode and full content require human review.'),
    ('dead-hang','0HBhuaD_S7M','Beginner Dead Hang Tutorial','Maximus Pump','Public YouTube search: dead hang exercise technique','Candidate by public metadata only. The external title is retained as provenance and does not assign a level to the exercise card; exact mode, safety, and full content require human review.'),
    ('dead-hang','AH8YrGT9s1s','How to: Dead Hangs','Body Smart Training','Public YouTube search: dead hang exercise demo CrossFit','Candidate by public title/channel only; passive scapular mode, setup, grip, dose, claims, captions, and demonstration quality require human review.'),
    ('dead-hang','EmQVeAF_CJ0','Dead Hang','Morris Brossette','Public YouTube search: dead hang exercise demo CrossFit','Candidate by exact public title only; full sequence, passive shoulder position, safe mount and dismount, cue quality, and accessibility require human review.'),
    ('active-hang','0_YZc2yuKkE','How To Do Active Hang','Calixpert','Public YouTube search: active hang exercise demo pull up','Candidate by exact public title only; straight elbows, active scapular position, mount, full hold, safe exit, cue quality, and accessibility require human review.'),
    ('active-hang','kKXyCA7i-20','Active Hang for Pull-Up Strength','FitWitFitness','Public YouTube search: active hang exercise demo pull up','Candidate by public title/channel only; exact active isometric mode, full sequence, safety, claims, captions, and demonstration quality require human review.'),
    ('active-hang','mtOAYPGRBMc','How To Do More Pull Ups - Pull up starting point: Active Hang','School of Calisthenics','Public YouTube search: active hang exercise demo pull up','Candidate by public metadata only. Pull-up framing does not establish a universal prerequisite; exact hold sequence and full content require human review.'),
    ('active-hang','lqy8oud8FgQ','Movement: Active Bar Hang','CrossFit Jääkarhu','Public YouTube search: dead hang exercise demo CrossFit','Candidate by exact public title only; straight elbows, active scapular position, trunk requirement, mount, exit, and full content require human review.'),
    ('active-hang','thmWJ-Z749M','Active Hang','OPEX Fitness','Public YouTube search: active hang exercise demo pull up','Candidate by exact public title only; exact sequence, active-versus-passive distinction, safety, cue quality, and accessibility require human review.'),
    ('scapular-pull-up','-ZIpSoTRsuE','Scapular Pull Ups (Beginner to Advanced Progressions)','Zack Henderson','Public YouTube search: scapular pull up exercise technique','Candidate by public title/channel only. External progression labels are not copied to the exercise card; exact baseline sequence, straight elbows, full content, safety, and accessibility require human review.'),
    ('scapular-pull-up','XIkPI-_80r4','Scap Pulls - Ensure correct activation before pull ups','Perform 360','Public YouTube search: scapular pull up exercise technique','Candidate by public title/channel only. Pull-up framing does not establish a universal prerequisite; exact dynamic range, return, safety, and full content require human review.'),
    ('scapular-pull-up','d0DVd2V0n7A','Fix Your Pull Ups with Scapula Pull Ups | Tim Keeley | Physio REHAB','Physio REHAB','Public YouTube search: scap pull up exercise demo physical therapy','Candidate by public metadata only. The corrective framing is not adopted as a Vortex claim; exact exercise, cue quality, safety, captions, and full content require human review.'),
    ('scapular-pull-up','qVFX6LnZF4A','Hanging Scap Pull-up','Champion Physical Therapy and Performance','Public YouTube search: scap pull up exercise demo physical therapy','Candidate by exact public title only; straight-elbow motion, top and bottom positions, controlled return, safety, and full content require human review.'),
    ('scapular-pull-up','kCoCVLZvI8E','Scap Pull ups','The Active Life','Public YouTube search: scap pull up exercise demo physical therapy','Candidate by exact public title only; full sequence, elbow position, range, return control, captions, and demonstration quality require human review.');

  INSERT INTO coaching.exercise_media_candidate_v1 (
    definition_id, variant_id, reviewed_card_version, url, embed_url, video_id,
    title, channel_name, duration_seconds, language_code, captions_available,
    embedding_allowed, exact_variant_match, demonstration_quality_score,
    link_status, review_status, discovery_method, source_query,
    reviewer_user_id, reviewed_at, next_review_at, notes
  )
  SELECT definition.id, NULL, definition.card_version,
    'https://www.youtube.com/watch?v=' || media.video_id,
    'https://www.youtube-nocookie.com/embed/' || media.video_id,
    media.video_id, media.title, media.channel_name, NULL, 'en', NULL,
    FALSE, NULL, NULL, 'unverified', 'candidate', 'manual_research',
    media.source_query, NULL, NULL, NULL, media.notes
  FROM hang_media_seed media
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = media.definition_slug
   AND definition.status <> 'archived'
  ON CONFLICT (definition_id, reviewed_card_version, video_id)
  DO UPDATE SET
    variant_id = NULL,
    url = EXCLUDED.url,
    embed_url = EXCLUDED.embed_url,
    title = EXCLUDED.title,
    channel_name = EXCLUDED.channel_name,
    duration_seconds = NULL,
    language_code = 'en',
    captions_available = NULL,
    embedding_allowed = FALSE,
    exact_variant_match = NULL,
    demonstration_quality_score = NULL,
    link_status = 'unverified',
    review_status = 'candidate',
    discovery_method = 'manual_research',
    source_query = EXCLUDED.source_query,
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    next_review_at = NULL,
    notes = EXCLUDED.notes,
    updated_at = now();

  CREATE TEMP TABLE hang_alternate_seed (
    definition_slug TEXT NOT NULL,
    alternate_name TEXT NOT NULL,
    classification TEXT NOT NULL,
    rationale TEXT NOT NULL,
    dimensions JSONB NOT NULL,
    PRIMARY KEY (definition_slug, alternate_name)
  ) ON COMMIT DROP;

  INSERT INTO hang_alternate_seed VALUES
    ('dead-hang','Foot-Assisted Dead Hang','new_variant','Stable foot contact unloads the grip and shoulders while preserving passive scapular mode, straight elbows, and the suspension task.','{"assistance":"stable_foot_contact","scapularMode":"passive"}'::JSONB),
    ('dead-hang','Band-Assisted Dead Hang','new_variant','Band assistance reduces relative load but adds entry, recoil, and exit logistics that must be explicit.','{"assistance":"band","bandEntryAndExit":"declared"}'::JSONB),
    ('dead-hang','Ring Dead Hang','new_variant','Freely rotating rings preserve passive hanging but change grip orientation and equipment stability.','{"implement":"stable_rings","gripOrientation":"self_selected_or_declared"}'::JSONB),
    ('dead-hang','Weighted Dead Hang','new_variant','Added load materially increases grip and shoulder-position demand and changes attachment, dose, recovery, and dismount requirements.','{"externalLoad":"added_weight","loadAttachment":"declared"}'::JSONB),
    ('dead-hang','Single-Arm Dead Hang','new_variant','One-arm suspension retains passive mode but changes laterality, load per limb, trunk control, and failure consequence enough to require a scored variant.','{"laterality":"unilateral","assistance":"declared"}'::JSONB),
    ('dead-hang','Maximum-Time Dead Hang Test','modifier_annotation','Testing to a standardized endpoint changes intent, termination rules, recovery, and reporting but not the passive hanging movement identity.','{"deliveryProfile":"maximum_duration_test","routineTrainingDefault":false}'::JSONB),
    ('dead-hang','Dead Hang with Nasal Breathing','modifier_annotation','Breathing focus and short restore dose are contextual delivery annotations on Dead Hang.','{"deliveryProfile":"restore_nasal_breathing"}'::JSONB),
    ('dead-hang','Active Hang','new_definition','Intentionally holding the shoulders away from the ears adds an active scapular isometric and changes anatomy, difficulty, cues, fatigue, and purpose.','{"scapularMode":"active_isometric"}'::JSONB),
    ('dead-hang','Scapular Pull-Up','new_definition','Repeated scapular depression and controlled return create a dynamic straight-arm task rather than a passive hold.','{"scapularMode":"dynamic_repetition"}'::JSONB),
    ('dead-hang','Flexed-Arm Hang','new_definition','Elbow flexion and top-position pulling isometric substantially change joint actions, physical demand, fatigue, and failure mode.','{"elbowAction":"flexion_isometric","bodyPosition":"top_pull_position"}'::JSONB),
    ('dead-hang','Hangboard Edge Hang','new_definition','Small-edge finger loading, grip type, edge depth, and climbing-specific dose create a distinct high-finger-load task.','{"implement":"hangboard_edge","edgeDepthAndGripType":"required"}'::JSONB),
    ('active-hang','Foot-Assisted Active Hang','new_variant','Stable foot contact unloads grip and shoulder demand while preserving the straight-elbow active scapular isometric.','{"assistance":"stable_foot_contact","scapularMode":"active_isometric"}'::JSONB),
    ('active-hang','Band-Assisted Active Hang','new_variant','Band assistance reduces relative load but adds entry, recoil, and exit constraints.','{"assistance":"band","bandEntryAndExit":"declared"}'::JSONB),
    ('active-hang','Ring Active Hang','new_variant','Rings preserve active isometric mode while changing grip orientation and stability demand.','{"implement":"stable_rings","gripOrientation":"self_selected_or_declared"}'::JSONB),
    ('active-hang','Hollow-Body Active Hang','modifier_annotation','A declared hollow trunk shape changes body-line emphasis without changing the active straight-arm hang identity.','{"trunkShape":"hollow"}'::JSONB),
    ('active-hang','Arched Active Hang','modifier_annotation','A declared arch changes trunk and shoulder orientation but remains an Active Hang only while elbows and scapular position stay isometric.','{"trunkShape":"controlled_arch"}'::JSONB),
    ('active-hang','Weighted Active Hang','new_variant','Added load materially changes physical difficulty, attachment, dose, recovery, and exit requirements.','{"externalLoad":"added_weight"}'::JSONB),
    ('active-hang','Single-Arm Active Hang','new_variant','One-arm active suspension changes laterality, load per limb, asymmetric shoulder and trunk control, and failure consequence.','{"laterality":"unilateral","scapularMode":"active_isometric"}'::JSONB),
    ('active-hang','Dead Hang','new_definition','Passive scapular mode removes the active isometric action and changes intent, cues, difficulty, fatigue, and shoulder-position tolerance.','{"scapularMode":"passive"}'::JSONB),
    ('active-hang','Scapular Pull-Up','new_definition','Repeated scapular motion and controlled return create a dynamic exercise rather than an isometric hold.','{"scapularMode":"dynamic_repetition"}'::JSONB),
    ('active-hang','Pull-Up','new_definition','Elbow flexion and large body displacement add a full vertical-pull action and substantially greater movement and fatigue demands.','{"elbowAction":"dynamic_flexion_extension","bodyDisplacement":"full_vertical_pull"}'::JSONB),
    ('active-hang','Straight-Arm Support Hold','new_definition','Supporting the body above bars or rings reverses the force direction and changes shoulder, elbow, grip, and equipment demands.','{"forceDirection":"support_above_implement"}'::JSONB),
    ('scapular-pull-up','Foot-Assisted Scapular Pull-Up','new_variant','Stable foot contact reduces relative load while preserving dynamic straight-arm scapular motion.','{"assistance":"stable_foot_contact","scapularMode":"dynamic_repetition"}'::JSONB),
    ('scapular-pull-up','Band-Assisted Scapular Pull-Up','new_variant','Band assistance reduces bodyweight demand but adds changing assistance, entry, recoil, and exit constraints.','{"assistance":"band","bandEntryAndExit":"declared"}'::JSONB),
    ('scapular-pull-up','Ring Scapular Pull-Up','new_variant','Rings preserve dynamic scapular repetitions while changing grip orientation and equipment stability.','{"implement":"stable_rings","gripOrientation":"self_selected_or_declared"}'::JSONB),
    ('scapular-pull-up','Paused Scapular Pull-Up','modifier_annotation','A top pause changes tempo and time under tension without changing the dynamic scapular exercise identity.','{"topPauseSeconds":"declared"}'::JSONB),
    ('scapular-pull-up','Weighted Scapular Pull-Up','new_variant','Added load materially changes physical difficulty, attachment, recovery, and failure consequence.','{"externalLoad":"added_weight"}'::JSONB),
    ('scapular-pull-up','Single-Arm Scapular Pull-Up','new_variant','Unilateral dynamic suspension changes laterality, load per limb, asymmetric trunk control, and failure consequence.','{"laterality":"unilateral","scapularMode":"dynamic_repetition"}'::JSONB),
    ('scapular-pull-up','Dead Hang','new_definition','A passive static shoulder position removes the active dynamic scapular action.','{"scapularMode":"passive_isometric"}'::JSONB),
    ('scapular-pull-up','Active Hang','new_definition','Holding the active position without repetitions is an isometric exercise with different dose and fatigue behavior.','{"scapularMode":"active_isometric"}'::JSONB),
    ('scapular-pull-up','Pull-Up','new_definition','Dynamic elbow flexion and large body displacement create a full vertical-pull identity.','{"elbowAction":"dynamic_flexion_extension","bodyDisplacement":"full_vertical_pull"}'::JSONB),
    ('scapular-pull-up','Flexed-Arm Hang','new_definition','An elbow-flexed top-position isometric changes joint actions, physical load, fatigue, and stop rules.','{"elbowAction":"flexion_isometric"}'::JSONB),
    ('scapular-pull-up','Scapular Inverted Row','new_definition','Horizontal body orientation and pulling direction change load, joint orientation, base of support, and progression path.','{"forceDirection":"horizontal_pull","bodySupport":"feet_supported"}'::JSONB);

  INSERT INTO coaching.exercise_alternate_assessment_v1 (
    definition_id, reviewed_card_version, alternate_name, classification,
    rationale, distinguishing_dimensions, proposed_card_json, review_status,
    reviewer_user_id, reviewed_at
  )
  SELECT definition.id, definition.card_version, alternate.alternate_name,
    alternate.classification, alternate.rationale, alternate.dimensions,
    NULL, 'candidate', NULL, NULL
  FROM hang_alternate_seed alternate
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = alternate.definition_slug
   AND definition.status <> 'archived'
  ON CONFLICT (definition_id, reviewed_card_version, alternate_name)
  DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = NULL,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id, to_variant_id, relationship, similarity_score, dimensions,
    reason, conditions_json, review_status, created_by, reviewed_by, reviewed_at
  )
  SELECT relationship.to_variant_id, relationship.from_variant_id, 'regression',
    relationship.similarity_score, relationship.dimensions,
    'Inverse review candidate of the authored progression: ' || relationship.reason,
    coalesce(relationship.conditions_json,'{}'::JSONB) || jsonb_build_object(
      'inverseOfRelationship','progression',
      'humanReviewRequired',TRUE
    ),
    'review', NULL, NULL, NULL
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 from_variant ON from_variant.id = relationship.from_variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id = from_variant.definition_id
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND relationship.relationship = 'progression'
    AND relationship.review_status = 'review'
  ON CONFLICT (from_variant_id, to_variant_id, relationship)
  DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    created_by = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now()
  WHERE coaching.exercise_relationship_v1.review_status = 'review';

  INSERT INTO coaching.exercise_score_calibration_v1 (
    facility_id, variant_id, dimension, proposed_score, anchor_tier, rationale,
    status, version, created_by, reviewed_by, review_notes, reviewed_at
  )
  SELECT 1, variant.id, dimension.dimension,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT
    END,
    CASE
      WHEN CASE dimension.dimension
        WHEN 'technicalComplexity' THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
        ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT
      END <= 30 THEN 20
      WHEN CASE dimension.dimension
        WHEN 'technicalComplexity' THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
        ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT
      END <= 50 THEN 40
      WHEN CASE dimension.dimension
        WHEN 'technicalComplexity' THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
        ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT
      END <= 70 THEN 60
      ELSE 80
    END,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN 'Candidate exercise-complexity anchor reflects scapular mode, isometric versus repeated action, assistance, implement stability, laterality, load attachment, body control, and safe exit; independent human comparison is pending.'
      ELSE 'Candidate physical-difficulty anchor reflects assistance-adjusted relative bodyweight, grip, shoulder and scapular loading, implement stability, laterality, added load, and controlled exit; fatigue and failure consequence remain separate planning inputs.'
    END,
    'review', 1, NULL, NULL,
    'Candidate migration-408 anchor; independent human review required.', NULL
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id = definition.id
  CROSS JOIN (VALUES ('technicalComplexity'),('absoluteLoadDemand')) AS dimension(dimension)
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND definition.status <> 'archived'
    AND variant.status <> 'archived'
    AND variant.difficulty_json ? 'technicalComplexity'
    AND variant.difficulty_json ? 'absoluteLoadDemand'
  ON CONFLICT (facility_id, variant_id, dimension, version)
  DO UPDATE SET
    proposed_score = EXCLUDED.proposed_score,
    anchor_tier = EXCLUDED.anchor_tier,
    rationale = EXCLUDED.rationale,
    status = 'review',
    created_by = NULL,
    reviewed_by = NULL,
    review_notes = EXCLUDED.review_notes,
    reviewed_at = NULL,
    updated_at = now()
  WHERE coaching.exercise_score_calibration_v1.status = 'review';

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = seed.complexity,
      absolute_load_demand = seed.physical,
      coordination_demand = seed.coordination,
      impact = seed.impact,
      supervision_demand = seed.supervision,
      base_overall_difficulty = CASE
        WHEN seed.complexity IS NULL OR seed.physical IS NULL THEN NULL
        ELSE greatest(seed.complexity,seed.physical)
      END,
      legacy_scores = coalesce(score.legacy_scores,'{}'::JSONB) || jsonb_build_object(
        'migration',migration_key,
        'researchBatch',research_batch,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'scoreDeferred',seed.complexity IS NULL OR seed.physical IS NULL,
        'candidateOnly',TRUE,
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE
      ),
      migration_confidence = seed.confidence,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes = seed.notes,
      updated_at = now()
  FROM (VALUES
    (200::BIGINT,38::SMALLINT,62::SMALLINT,42::SMALLINT,1::SMALLINT,40::SMALLINT,82::SMALLINT,'Candidate Scapular Pull-Up baseline score; human calibration review required.'::TEXT),
    (201::BIGINT,NULL::SMALLINT,NULL::SMALLINT,NULL::SMALLINT,NULL::SMALLINT,NULL::SMALLINT,20::SMALLINT,'Historical passive-or-active compound source remains identity-quarantined and deliberately unscored.'::TEXT),
    (820::BIGINT,28::SMALLINT,58::SMALLINT,30::SMALLINT,1::SMALLINT,35::SMALLINT,80::SMALLINT,'Candidate Active Hang baseline score; human calibration review required.'::TEXT),
    (857::BIGINT,28::SMALLINT,58::SMALLINT,30::SMALLINT,1::SMALLINT,35::SMALLINT,80::SMALLINT,'Exact Active Hang duplicate source uses the same candidate baseline score; human review required.'::TEXT),
    (1074::BIGINT,28::SMALLINT,58::SMALLINT,30::SMALLINT,1::SMALLINT,35::SMALLINT,76::SMALLINT,'Compound source was deterministically split to Active Hang; candidate baseline score requires human review.'::TEXT),
    (1689::BIGINT,18::SMALLINT,52::SMALLINT,20::SMALLINT,1::SMALLINT,35::SMALLINT,78::SMALLINT,'Candidate Dead Hang baseline score; human calibration review required.'::TEXT)
  ) AS seed(exercise_id,complexity,physical,coordination,impact,supervision,confidence,notes)
  WHERE score.exercise_id = seed.exercise_id
    AND score.human_review_status = 'queued'
    AND score.reviewed_by IS NULL
    AND score.reviewed_at IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1 (
    definition_id, facility_id, card_version, schema_version, audit_version,
    status, checks_json, blocking_issues_json, human_review_required, checked_at
  )
  SELECT definition.id, definition.facility_id, definition.card_version,
    definition.schema_version, migration_key, 'quarantined',
    jsonb_build_object(
      'stableIdentityAndAliases',TRUE,
      'passiveActiveDynamicBoundariesPresent',TRUE,
      'legacyMappingsPresent',TRUE,
      'taxonomyAnatomyAndLateralityPresent',TRUE,
      'difficultyOnlyModelPresent',TRUE,
      'loadFatigueRecoveryPresent',TRUE,
      'equipmentEnvironmentPopulationPresent',TRUE,
      'deliveryDosageInstructionsAndStopRulesPresent',TRUE,
      'athleteCoachAndOperationsSupportPresent',TRUE,
      'candidateEvidenceSectionsPresent',TRUE,
      'fiveMediaCandidatesPresent',TRUE,
      'alternateAssessmentsPresent',TRUE,
      'progressionAndRegressionProposalsPresent',TRUE,
      'complexityAndPhysicalCalibrationProposalsPresent',TRUE,
      'exerciseSkillOrProficiencyClassificationPresent',FALSE,
      'approvalsCreated',FALSE
    ),
    jsonb_build_array(
      jsonb_build_object('code','CARD-EVIDENCE-02','message','Candidate evidence and all authored section claims require independent human review.'),
      jsonb_build_object('code','CARD-IDENTITY-05','message','Identity and variant boundaries require coach review before publication.'),
      jsonb_build_object('code','CARD-MEDIA-01','message','Five public media candidates require playback, embedding, exact-match, full-content, safety, caption, accessibility, and reviewer approval.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','Progression and regression relationships remain review-only.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Complexity and physical-difficulty anchors remain review-only.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Two-person card review, version approval, media approval, and pilot evidence are incomplete.')
    ),
    TRUE, now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND definition.status <> 'archived'
  ON CONFLICT (definition_id)
  DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    card_version = EXCLUDED.card_version,
    schema_version = EXCLUDED.schema_version,
    audit_version = EXCLUDED.audit_version,
    status = 'quarantined',
    checks_json = EXCLUDED.checks_json,
    blocking_issues_json = EXCLUDED.blocking_issues_json,
    human_review_required = TRUE,
    checked_at = now();

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_section_evidence_v1 evidence
    ON evidence.definition_id = definition.id
   AND evidence.reviewed_card_version = definition.card_version
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND evidence.review_status = 'candidate';
  IF actual_count <> 48 THEN RAISE EXCEPTION '% did not create all 48 candidate evidence rows; found %', migration_key, actual_count; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_media_candidate_v1 media
    ON media.definition_id = definition.id
   AND media.reviewed_card_version = definition.card_version
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND media.review_status = 'candidate'
    AND media.link_status = 'unverified'
    AND media.embedding_allowed = FALSE
    AND media.exact_variant_match IS NULL
    AND media.demonstration_quality_score IS NULL
    AND media.reviewer_user_id IS NULL
    AND media.reviewed_at IS NULL;
  IF actual_count <> 15 THEN RAISE EXCEPTION '% did not create all 15 unverified, non-embeddable media candidates; found %', migration_key, actual_count; END IF;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT definition.slug, count(*) media_count
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_candidate_v1 media
        ON media.definition_id = definition.id
       AND media.reviewed_card_version = definition.card_version
      WHERE definition.facility_id = 1
        AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
        AND media.review_status = 'candidate'
      GROUP BY definition.slug
    ) counts WHERE counts.media_count <> 5
  ) THEN RAISE EXCEPTION '% requires exactly 5 current media candidates per definition', migration_key; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_alternate_assessment_v1 alternate
    ON alternate.definition_id = definition.id
   AND alternate.reviewed_card_version = definition.card_version
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND alternate.review_status = 'candidate';
  IF actual_count <> 33 THEN RAISE EXCEPTION '% did not create all 33 candidate alternate assessments; found %', migration_key, actual_count; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 variant ON variant.id = relationship.from_variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id = variant.definition_id
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND relationship.review_status = 'review'
    AND relationship.reviewed_by IS NULL
    AND relationship.reviewed_at IS NULL;
  IF actual_count <> 34 THEN RAISE EXCEPTION '% did not preserve 17 progression and create 17 inverse regression proposals; found %', migration_key, actual_count; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_score_calibration_v1 calibration
  JOIN coaching.exercise_variant_v1 variant ON variant.id = calibration.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id = variant.definition_id
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND variant.status <> 'archived'
    AND calibration.status = 'review'
    AND calibration.dimension IN ('technicalComplexity','absoluteLoadDemand')
    AND calibration.reviewed_by IS NULL
    AND calibration.reviewed_at IS NULL;
  IF actual_count <> 36 THEN RAISE EXCEPTION '% did not create all 36 review-only calibration rows; found %', migration_key, actual_count; END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id = definition.id
    WHERE definition.facility_id = 1
      AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
      AND variant.status <> 'archived'
      AND (
        (variant.difficulty_json->>'baseOverallDifficulty')::SMALLINT
          <> greatest((variant.difficulty_json->>'technicalComplexity')::SMALLINT,(variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT)
        OR (variant.programming_profile_json->>'overallDifficulty')::SMALLINT
          <> greatest((variant.difficulty_json->>'technicalComplexity')::SMALLINT,(variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT)
      )
  ) THEN RAISE EXCEPTION '% found a variant whose overall is not max(complexity, physical difficulty)', migration_key; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_card_test_packet_v1 packet
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = packet.definition_id
   AND definition.card_version = packet.card_version
  WHERE definition.facility_id = 1
    AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
    AND packet.audit_version = migration_key
    AND packet.status = 'quarantined'
    AND packet.human_review_required = TRUE;
  IF actual_count <> 3 THEN RAISE EXCEPTION '% did not create all 3 quarantined card test packets; found %', migration_key, actual_count; END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id = 1
      AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
      AND coaching.exercise_json_has_level_classification(jsonb_build_array(
        definition.provenance_json, definition.environment_json, definition.population_json,
        definition.anatomy_json, definition.athlete_support_json,
        definition.coach_support_json, definition.support_operations_json
      ))
  ) THEN RAISE EXCEPTION '% found forbidden exercise skill/proficiency classification', migration_key; END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    LEFT JOIN coaching.exercise_card_review_v1 card_review ON card_review.definition_id = definition.id
    LEFT JOIN coaching.exercise_media_review_v1 media_review ON media_review.definition_id = definition.id
    WHERE definition.facility_id = 1
      AND definition.slug IN ('dead-hang','active-hang','scapular-pull-up')
      AND (
        definition.status = 'published'
        OR definition.approved_video_url IS NOT NULL
        OR definition.reviewed_by IS NOT NULL
        OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR card_review.id IS NOT NULL
        OR media_review.id IS NOT NULL
      )
  ) THEN RAISE EXCEPTION '% created or retained a forbidden approval on the completed candidate cards', migration_key; END IF;
END;
$$;
