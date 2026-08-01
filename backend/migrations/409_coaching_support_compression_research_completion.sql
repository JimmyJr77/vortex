-- Complete the candidate research and governance packet for Seated
-- Compression Lift, V-Sit, and Manna Hold after migration 312.
--
-- Preserve the authored exercise identities and scores: a grounded dynamic
-- leg lift, a static straight-arm high-compression support with both feet above
-- horizontal, and an extreme posterior-support Manna with hips elevated and
-- legs beyond the shoulder line. Formal gymnastics proficiency remains only in
-- coaching.skill; exercise cards contain complexity and physical difficulty.
--
-- Media URLs and privacy-enhanced embed URLs are candidate discoveries only.
-- Playback, embedding permission, exact match, complete viewing, captions,
-- accessibility, demonstration quality, reviewer identity, and approval remain
-- unverified. No approval is fabricated.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '409_coaching_support_compression_research_completion';
  research_batch CONSTANT TEXT := 'support-compression-v-sit-manna-family-v1';
  research_version CONSTANT TEXT := '2026-07-26.29';
  already_applied_count INTEGER;
  actual_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND status <> 'archived';
  IF actual_count <> 3 THEN
    RAISE EXCEPTION '% requires exactly 3 active support-compression definitions; found %', migration_key, actual_count;
  END IF;

  SELECT count(*) INTO already_applied_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND status <> 'archived'
    AND provenance_json->>'researchCompletionMigration' = migration_key;
  IF already_applied_count NOT IN (0,3) THEN
    RAISE EXCEPTION '% found a partial prior application on % definitions', migration_key, already_applied_count;
  END IF;

  IF already_applied_count = 0 AND EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug IN ('straddle-compression-lift','v-sit','manna-hold')
      AND status <> 'archived' AND card_version <> 1
  ) THEN RAISE EXCEPTION '% expected migration-312 card version 1 before first application', migration_key; END IF;

  IF already_applied_count = 3 AND EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id = 1
      AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
      AND definition.status <> 'archived' AND definition.card_version <> 2
  ) THEN RAISE EXCEPTION '% found drift after completion; all three cards must remain at version 2', migration_key; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source ON source.definition_id = definition.id
  WHERE definition.facility_id = 1 AND definition.status <> 'archived'
    AND ((definition.slug='straddle-compression-lift' AND source.legacy_exercise_id=803)
      OR (definition.slug='v-sit' AND source.legacy_exercise_id=1704)
      OR (definition.slug='manna-hold' AND source.legacy_exercise_id=1705));
  IF actual_count <> 3 OR EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source ON source.definition_id=definition.id
    WHERE definition.facility_id=1
      AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
      AND definition.status<>'archived'
      AND NOT ((definition.slug='straddle-compression-lift' AND source.legacy_exercise_id=803)
        OR (definition.slug='v-sit' AND source.legacy_exercise_id=1704)
        OR (definition.slug='manna-hold' AND source.legacy_exercise_id=1705))
  ) THEN RAISE EXCEPTION '% expected exactly all 3 migration-312 legacy mappings', migration_key; END IF;

  CREATE TEMP TABLE support_variant_expectation (
    definition_slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    PRIMARY KEY(definition_slug,variant_key)
  ) ON COMMIT DROP;
  INSERT INTO support_variant_expectation VALUES
    ('straddle-compression-lift','baseline'),
    ('straddle-compression-lift','bent-knee'),
    ('straddle-compression-lift','pike'),
    ('straddle-compression-lift','single-leg-pike'),
    ('v-sit','baseline'),
    ('v-sit','straddle'),
    ('v-sit','ring-support'),
    ('manna-hold','baseline');

  SELECT count(*) INTO actual_count
  FROM support_variant_expectation expected
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=expected.definition_slug AND definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id AND variant.variant_key=expected.variant_key AND variant.status<>'archived';
  IF actual_count <> 8 OR EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    LEFT JOIN support_variant_expectation expected
      ON expected.definition_slug=definition.slug AND expected.variant_key=variant.variant_key
    WHERE definition.facility_id=1
      AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
      AND definition.status<>'archived' AND variant.status<>'archived'
      AND expected.variant_key IS NULL
  ) THEN RAISE EXCEPTION '% requires exactly all 8 migration-312 review variants', migration_key; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  JOIN coaching.exercise_delivery_profile_v1 profile ON profile.variant_id=variant.id
  WHERE definition.facility_id=1
    AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND definition.status<>'archived' AND variant.status<>'archived' AND profile.status<>'archived';
  IF actual_count <> 8 THEN RAISE EXCEPTION '% requires exactly all 8 migration-312 delivery profiles; found %', migration_key, actual_count; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 identity
    JOIN coaching.exercise_definition_v1 survivor ON survivor.id=identity.survivor_definition_id
    JOIN coaching.exercise_definition_v1 resolved ON resolved.id=identity.resolved_definition_id
    WHERE survivor.slug='l-sit' AND resolved.slug='v-sit'
      AND identity.decision='distinct_exercises' AND identity.reviewed_by IS NULL
  ) THEN RAISE EXCEPTION '% requires the researched L-Sit versus V-Sit boundary', migration_key; END IF;

  CREATE TEMP TABLE support_identity_seed (
    survivor_slug TEXT NOT NULL,
    resolved_slug TEXT NOT NULL,
    boundary_key TEXT NOT NULL,
    rationale TEXT NOT NULL,
    PRIMARY KEY(survivor_slug,resolved_slug)
  ) ON COMMIT DROP;
  INSERT INTO support_identity_seed VALUES
    ('straddle-compression-lift','v-sit','grounded_dynamic_leg_lift_vs_static_above_horizontal_support','Seated Compression Lift is a grounded dynamic hip-flexion task without bodyweight arm support. V-Sit is a static straight-arm support hold with both extended legs clearly above horizontal, changing support, action, range, load, balance, entry, exit, and fatigue.'),
    ('v-sit','manna-hold','above_horizontal_v_position_vs_hips_and_legs_beyond_shoulders','V-Sit holds the extended legs clearly above horizontal. Manna additionally elevates the hips and carries the legs beyond the shoulder line through a much larger posterior shoulder-support path, changing position, balance, range, supervision, assistance, and exit.'),
    ('straddle-compression-lift','manna-hold','grounded_dynamic_compression_vs_extreme_posterior_support_hold','Seated Compression Lift is a grounded dynamic leg lift. Manna is an extreme static straight-arm posterior-support hold with high hip elevation and the legs beyond the shoulders, changing every primary support, loading, range, balance, supervision, and exit contract.');

  IF EXISTS (
    SELECT 1 FROM support_identity_seed seed
    JOIN coaching.exercise_definition_v1 left_definition ON left_definition.slug=seed.survivor_slug AND left_definition.status<>'archived'
    JOIN coaching.exercise_definition_v1 right_definition ON right_definition.slug=seed.resolved_slug AND right_definition.status<>'archived'
    JOIN coaching.exercise_identity_resolution_v1 identity
      ON (identity.survivor_definition_id=left_definition.id AND identity.resolved_definition_id=right_definition.id)
      OR (identity.survivor_definition_id=right_definition.id AND identity.resolved_definition_id=left_definition.id)
    WHERE identity.decision<>'distinct_exercises'
      OR identity.survivor_definition_id<>left_definition.id
      OR identity.resolved_definition_id<>right_definition.id
      OR identity.reviewed_by IS NOT NULL
  ) THEN RAISE EXCEPTION '% refused to overwrite a conflicting or human-reviewed support-compression identity decision', migration_key; END IF;

  SELECT count(*) INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1
    AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND definition.status<>'archived'
    AND (definition.status='published' OR definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL OR definition.last_reviewed_at IS NOT NULL);
  IF protected_count>0 THEN RAISE EXCEPTION '% refused to overwrite % human-reviewed or published definition(s)', migration_key, protected_count; END IF;

  SELECT count(*) INTO protected_count FROM coaching.exercise_score_v1 score
  WHERE score.exercise_id IN (803,1704,1705)
    AND (score.human_review_status<>'queued' OR score.reviewed_by IS NOT NULL OR score.reviewed_at IS NOT NULL);
  IF protected_count>0 THEN RAISE EXCEPTION '% refused to overwrite % human-reviewed legacy score record(s)', migration_key, protected_count; END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
     JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
     LEFT JOIN coaching.exercise_delivery_profile_v1 profile ON profile.variant_id=variant.id
     WHERE definition.facility_id=1
       AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
       AND (variant.status='published' OR profile.status='published'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_section_evidence_v1 evidence ON evidence.definition_id=definition.id AND evidence.reviewed_card_version=definition.card_version
      WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold') AND evidence.review_status NOT IN ('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_candidate_v1 media ON media.definition_id=definition.id AND media.reviewed_card_version=definition.card_version
      WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold') AND media.review_status NOT IN ('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_alternate_assessment_v1 alternate ON alternate.definition_id=definition.id AND alternate.reviewed_card_version=definition.card_version
      WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold') AND alternate.review_status NOT IN ('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_card_review_v1 review ON review.definition_id=definition.id
      WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_card_revision_v1 revision ON revision.definition_id=definition.id
      WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_review_v1 review ON review.definition_id=definition.id
      WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
      JOIN coaching.exercise_relationship_v1 relationship ON relationship.from_variant_id=variant.id OR relationship.to_variant_id=variant.id
      WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
        AND (relationship.review_status<>'review' OR relationship.reviewed_by IS NOT NULL OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
      JOIN coaching.exercise_score_calibration_v1 calibration ON calibration.variant_id=variant.id
      WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
        AND (calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL OR calibration.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN RAISE EXCEPTION '% refused to overwrite % reviewed or published dependent record(s)', migration_key, protected_count; END IF;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=CASE WHEN already_applied_count=0 THEN definition.card_version+1 ELSE definition.card_version END,
      approved_video_url=NULL, reviewed_by=NULL, approved_by=NULL, last_reviewed_at=NULL,
      provenance_json=(definition.provenance_json-'formalProficiencyScope')||jsonb_build_object(
        'researchCompletionMigration',migration_key,
        'researchBatch',research_batch,
        'researchVersion',research_version,
        'identityAuthorityMigrations',jsonb_build_array('312_coaching_support_compression_identity_family','340_coaching_remaining_high_similarity_identity_adjudication',migration_key),
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'evidenceState','candidate_requires_human_review',
        'mediaState','public_candidates_unverified_and_non_embeddable',
        'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE,
        'mediaApprovalCreated',FALSE,
        'graphApprovalCreated',FALSE,
        'calibrationApprovalCreated',FALSE
      ), updated_at=now()
  WHERE definition.facility_id=1
    AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND definition.status<>'archived';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at
  )
  SELECT 1,survivor.id,resolved.id,'distinct_exercises',seed.rationale,
    jsonb_build_object('boundaryKey',seed.boundary_key,'researchBatch',research_batch,
      'evidenceSource','current_authored_candidate_card_contracts','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM support_identity_seed seed
  JOIN coaching.exercise_definition_v1 survivor ON survivor.facility_id=1 AND survivor.slug=seed.survivor_slug AND survivor.status<>'archived'
  JOIN coaching.exercise_definition_v1 resolved ON resolved.facility_id=1 AND resolved.slug=seed.resolved_slug AND resolved.status<>'archived'
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO NOTHING;

  UPDATE coaching.exercise_section_evidence_v1 evidence SET review_status='superseded',updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE evidence.definition_id=definition.id AND definition.facility_id=1
    AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND evidence.reviewed_card_version<definition.card_version AND evidence.review_status='candidate';
  UPDATE coaching.exercise_media_candidate_v1 media SET review_status='superseded',updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE media.definition_id=definition.id AND definition.facility_id=1
    AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND media.reviewed_card_version<definition.card_version AND media.review_status='candidate';
  UPDATE coaching.exercise_alternate_assessment_v1 alternate SET review_status='superseded',updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE alternate.definition_id=definition.id AND definition.facility_id=1
    AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND alternate.reviewed_card_version<definition.card_version AND alternate.review_status='candidate';

  CREATE TEMP TABLE support_evidence_seed(
    definition_slug TEXT NOT NULL,section_key TEXT NOT NULL,source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,source_publisher TEXT NOT NULL,source_kind TEXT NOT NULL,
    evidence_quality SMALLINT NOT NULL,claims_json JSONB NOT NULL,
    PRIMARY KEY(definition_slug,section_key)
  ) ON COMMIT DROP;
  INSERT INTO support_evidence_seed VALUES
    ('straddle-compression-lift','identity','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["The professional progression distinguishes compression-building lead-up work from supported L-sit, V-sit, and Manna positions.","Classify seated dynamic leg lifting as a grounded compression exercise; pike, straddle, knee angle, laterality, hand position, range, and tempo do not by themselves create a new movement identity."]'::JSONB),
    ('straddle-compression-lift','taxonomy','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Parallette progressions manipulate knee angle, unilateral versus bilateral legs, straddle, height, and compression demand.","Represent knee angle, laterality, and pike or straddle as controlled variants; represent hand position, support height, range, pause, tempo, and volume as modifiers."]'::JSONB),
    ('straddle-compression-lift','anatomy','https://pubmed.ncbi.nlm.nih.gov/9118976/','Abdominal and hip flexor muscle activation during various training exercises','European Journal of Applied Physiology and Occupational Physiology','peer_reviewed_research',82,'["Training exercises involving hip flexion recruit hip-flexor musculature and can also require abdominal activation.","For a seated leg lift, describe active hip flexion as primary and trunk/pelvic control and knee extension as important contributors without claiming isolated-muscle training."]'::JSONB),
    ('straddle-compression-lift','biomechanics','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Shortening the knee lever and moving from one leg to two legs changes the mechanical demand of compression work.","Pike versus straddle changes frontal-plane hip position and available range, while trunk rocking or hand pulling changes execution rather than successful completion."]'::JSONB),
    ('straddle-compression-lift','difficulty','https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf','Basics of Strength and Conditioning Manual','National Strength and Conditioning Association','professional_standard',84,'["Exercise prescription should account for technique, load, fatigue, and progression instead of relying on a generic label.","Candidate difficulty rises with longer bilateral lever, higher owned range, less compensation, and added straddle symmetry; overall is derived only from exercise complexity and physical difficulty."]'::JSONB),
    ('straddle-compression-lift','load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/9118976/','Abdominal and hip flexor muscle activation during various training exercises','European Journal of Applied Physiology and Occupational Physiology','peer_reviewed_research',82,'["Hip-flexion exercises can impose meaningful local hip-flexor and abdominal demand even without external load.","Track compression alongside other high-volume hip-flexion, hanging-leg-raise, L-sit, V-sit, and press work; stop before rocking, knee change, range loss, or uncontrolled lowering."]'::JSONB),
    ('straddle-compression-lift','constraints','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Safe resistance training requires suitable space, equipment, instruction, progression, and individualized readiness.","Require a non-slip surface, clear leg arc, owned seated range, pain-free execution, controlled lowering, and a declared lever and position."]'::JSONB),
    ('straddle-compression-lift','dosage','https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf','Basics of Strength and Conditioning Manual','National Strength and Conditioning Association','professional_standard',84,'["Training variables should be selected to preserve technique and match the intended adaptation.","Use short controlled sets with a visible repetition reserve, sufficient rest, and a cap that prevents active-compression practice from becoming momentum-based conditioning."]'::JSONB),
    ('straddle-compression-lift','instructions','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Compression progressions emphasize actively lifting the legs and manipulating knee angle and leg position.","Cue a declared seated position, active lift from the hips, stable trunk, unchanged knee angle, controlled lower, breathing, and an early stop."]'::JSONB),
    ('straddle-compression-lift','programming','https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf','Basics of Strength and Conditioning Manual','National Strength and Conditioning Association','professional_standard',84,'["Exercise order, training volume, rest, and progression should reflect the session goal and cumulative demand.","Place precise compression work before competing hip-flexor and trunk fatigue; count it with L-sit, V-sit, hanging-leg-raise, press, and active-flexibility volume."]'::JSONB),
    ('straddle-compression-lift','athlete_support','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Individual development should be based on readiness and movement competence.","Give the athlete plain-language self-checks for trunk rocking, knee position, range, quiet lowering, symptoms, breathing, and whether the next repetition can match the first."]'::JSONB),
    ('straddle-compression-lift','coach_support','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Qualified supervision and technique-focused progression are central to safe resistance exercise.","The coach should preselect lever, position, range, tempo, and dose; observe from front and side; and regress before compensations replace the intended action."]'::JSONB),
    ('straddle-compression-lift','alternates','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Knee angle, one-leg work, bilateral work, straddle, and compression range form a progression family, while supported L-sit, V-sit, and Manna impose different support identities.","Use explicit variants for meaningful lever or leg-position changes, modifier annotations for range, hand position, tempo, and dose, and separate definitions when bodyweight support or a different principal action appears."]'::JSONB),
    ('v-sit','identity','https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20MAG%20CoP%202025-2028.pdf','FIG Men''s Artistic Gymnastics Code of Points 2025–2028','International Gymnastics Federation','governing_body',91,'["The current governing-body code lists V-sit as a distinct held floor element and separates it from L-sit and Manna.","For exercise identity, require a static straight-arm support position with both extended legs clearly above horizontal; a horizontal position remains L-sit work."]'::JSONB),
    ('v-sit','taxonomy','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["The professional progression describes V-sit as an L-sit-derived support position with the legs raised substantially above horizontal and a changed lean and shoulder relationship.","Taxonomy should retain straight-arm push support and brace while explicitly recording above-horizontal leg position and together, straddle, or ring-support variants."]'::JSONB),
    ('v-sit','anatomy','https://pubmed.ncbi.nlm.nih.gov/9118976/','Abdominal and hip flexor muscle activation during various training exercises','European Journal of Applied Physiology and Occupational Physiology','peer_reviewed_research',82,'["Hip-flexion exercise can involve high hip-flexor activation with abdominal contribution.","For V-sit, combine hip-flexor, abdominal, quadriceps, triceps, scapular, shoulder-stabilizer, and hand/wrist support roles without claiming one isolated muscle causes the position."]'::JSONB),
    ('v-sit','biomechanics','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Raising the legs above horizontal requires increased compression and a changed body and shoulder relationship compared with L-sit.","The position depends on active support, high hip flexion, knee extension, trunk and pelvic control, balance, and sufficient owned range rather than passive flexibility alone."]'::JSONB),
    ('v-sit','difficulty','https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20MAG%20CoP%202025-2028.pdf','FIG Men''s Artistic Gymnastics Code of Points 2025–2028','International Gymnastics Federation','governing_body',91,'["The governing-body code distinguishes held V-sit from L-sit and Manna and assigns them separate element boxes and values.","Candidate exercise difficulty is high because of above-horizontal compression, straight-arm support, balance, range, and exit demands; overall is max(complexity, physical difficulty), not the governing-body element value."]'::JSONB),
    ('v-sit','load_fatigue_recovery','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["V-sit requires intense compression and substantial triceps and support demand.","Count V-sit with L-sit, Manna, presses, dips, ring support, hip-flexor, and high-compression work; stop before height, elbow, shoulder, knee, breathing, or exit quality changes."]'::JSONB),
    ('v-sit','constraints','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Safe resistance exercise requires qualified instruction, appropriate progression, safe equipment and space, and individual readiness.","Require stable support, clear leg and exit space, pain-free support and high-compression range, an owned L-sit prerequisite, and direct observation."]'::JSONB),
    ('v-sit','dosage','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Professional instruction treats V-sit as a high-demand progression built from shorter supported positions rather than a fatigue test.","Use short clean holds with full recovery and a visible quality reserve; cap attempts before position or support deteriorates."]'::JSONB),
    ('v-sit','instructions','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["The progression emphasizes a high tuck, straightening the legs, and eventually moving from L-sit into V-sit.","Cue stable support, straight elbows, active shoulders, clearly above-horizontal extended legs, declared together or straddle position, breathing, and a controlled exit."]'::JSONB),
    ('v-sit','programming','https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf','Basics of Strength and Conditioning Manual','National Strength and Conditioning Association','professional_standard',84,'["Exercise order, rest, volume, and progression should preserve the intended technique and adaptation.","Place V-sit while support and compression are fresh; budget hand, wrist, elbow, shoulder, hip-flexor, hamstring-range, trunk, and ring-stability demand."]'::JSONB),
    ('v-sit','athlete_support','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Development should be individualized from current readiness and movement competence.","Give plain-language checks for stable support, straight elbows, shoulder height, feet clearly above horizontal, unchanged knee position, breathing, and early exit."]'::JSONB),
    ('v-sit','coach_support','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Qualified instruction and progression are central to safe youth resistance exercise.","The coach should declare the exact height standard, leg position, support, assistance, dose, and exit; distinguish V-sit from L-sit fallback; and regress before failure."]'::JSONB),
    ('v-sit','alternates','https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20MAG%20CoP%202025-2028.pdf','FIG Men''s Artistic Gymnastics Code of Points 2025–2028','International Gymnastics Federation','governing_body',91,'["The code separates V-sit, Manna, and V-sit-to-handstand combinations as distinct held or combined elements.","Treat straddle and ring support as variants, exact angle and assistance as modifiers, L-sit and Manna as separate definitions, and press-to-handstand combinations as separate dynamic identities."]'::JSONB),
    ('manna-hold','identity','https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20MAG%20CoP%202025-2028.pdf','FIG Men''s Artistic Gymnastics Code of Points 2025–2028','International Gymnastics Federation','governing_body',91,'["The current governing-body code lists the Manna position separately from V-sit and identifies Manna-containing combinations separately.","For exercise identity, require elevated hips and extended legs beyond the shoulder line in straight-arm support; a lower high-compression position remains V-sit or a declared preparatory drill."]'::JSONB),
    ('manna-hold','taxonomy','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Professional instruction describes Manna as the next position beyond V-sit, with the hips elevated and legs carried behind the head through a changed shoulder relationship.","Taxonomy retains push and brace but must explicitly record extreme high compression, large-range shoulder extension relative to the trunk, declared assistance, and controlled entry and exit."]'::JSONB),
    ('manna-hold','anatomy','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Professional instruction emphasizes very high triceps strength, compression, and dynamic shoulder flexibility for Manna.","Describe hand and wrist support, elbow and triceps isometric work, shoulder extensors and scapular stabilizers, hip flexors, trunk, quadriceps, and whole-body positional control without claiming isolated action."]'::JSONB),
    ('manna-hold','biomechanics','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Manna changes the V-sit by rolling the body farther, elevating the hips toward shoulder height, and carrying the legs beyond the head.","This materially changes shoulder-extension support, balance, trunk and pelvic organization, compression range, assistance, and exit mechanics rather than merely increasing hold time."]'::JSONB),
    ('manna-hold','difficulty','https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20MAG%20CoP%202025-2028.pdf','FIG Men''s Artistic Gymnastics Code of Points 2025–2028','International Gymnastics Federation','governing_body',91,'["The governing-body code separates Manna from V-sit and lists Manna combinations at distinct difficulty values.","Candidate exercise difficulty is very high because of the combined support, shoulder range, high compression, balance, supervision, and exit demands; overall is max(complexity, physical difficulty), not the competition value."]'::JSONB),
    ('manna-hold','load_fatigue_recovery','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Professional instruction characterizes Manna as requiring enormous triceps strength and substantial shoulder flexibility in addition to compression.","Treat every attempt as high-cost support and compression work; do not perform after pressing, support, shoulder, grip, hip-flexor, active-flexibility, or high-compression fatigue."]'::JSONB),
    ('manna-hold','constraints','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Safe resistance training requires qualified instruction, safe equipment and space, suitable progression, and individual readiness.","Require qualified direct supervision, stable rated support, matting as needed, declared assistance and communication, a planned entry and exit, repeatable V-sit prerequisites, and no competing fatigue."]'::JSONB),
    ('manna-hold','dosage','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Professional instruction recommends spotted Manna holds as preparatory work, underscoring the need for controlled assistance and progression.","Use very short attempts, full recovery, a strict attempt cap, visible reserve, and immediate termination when assistance or position changes."]'::JSONB),
    ('manna-hold','instructions','https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf','Parallette Training, Part 1','CrossFit Journal','professional_standard',76,'["Manna progression builds from V-sit and uses spotted holds rather than forcing an unsupported final position.","Cue agreed support and assistance, straight elbows, the cleared shoulder path, elevated hips and legs, breathing and communication, and an immediate controlled exit."]'::JSONB),
    ('manna-hold','programming','https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf','Basics of Strength and Conditioning Manual','National Strength and Conditioning Association','professional_standard',84,'["Exercise order, recovery, volume, and progression should protect technique and the intended adaptation.","Place Manna only while completely fresh after its specific preparation and before all competing support, pressing, shoulder, grip, high-compression, or high-consequence work."]'::JSONB),
    ('manna-hold','athlete_support','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Training progressions should be individualized from present readiness and competence.","Give plain-language checks for coach and spotter readiness, exact assistance, elbow and shoulder path, hip and leg position, breathing, communication, and immediate exit."]'::JSONB),
    ('manna-hold','coach_support','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Qualified supervision, safe equipment, and appropriate progression are central to resistance exercise.","The coach must verify prerequisites and fatigue, prebrief support, assistance, entry, communication, position, and exit, never pull into range, and stop at the first quality change."]'::JSONB),
    ('manna-hold','alternates','https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20MAG%20CoP%202025-2028.pdf','FIG Men''s Artistic Gymnastics Code of Points 2025–2028','International Gymnastics Federation','governing_body',91,'["The code separates V-sit, Manna, Manna-to-handstand, and Manna dislocation-to-handstand elements.","Treat assistance and hold time as modifiers, lower high-compression positions as V-sit or preparatory work, and dynamic press or dislocation combinations as separate definitions."]'::JSONB),
    ('straddle-compression-lift','safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Appropriate equipment, qualified supervision, explicit technique standards, and readiness-matched progression are core resistance-training safeguards.","Stop for hand, wrist, hip, hamstring, groin, abdominal, or back symptoms; involuntary knee bend; trunk collapse; forced range; breath holding; momentum; or loss of a controlled lowering."]'::JSONB),
    ('straddle-compression-lift','accessibility','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Long-term development should be individualized from current readiness, movement competence, response, and progressive exposure.","Scale with bent knees, one leg at a time, lower lift height, hands on stable blocks, smaller range, fewer repetitions, longer rest, visual demonstration, or a supported active-hip-flexion task. Do not assign an athlete proficiency level to the exercise card."]'::JSONB),
    ('straddle-compression-lift','media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["YouTube documents privacy-enhanced embed URLs, but an embed URL does not establish current playback, embedding permission, accessibility, or exact exercise match.","Five public-title discoveries are candidates for seated dynamic compression lifts. Exact leg position, bilateral versus unilateral action, lift and lowering, hand support, complete sequence, claims, captions, accessibility, and quality require human review."]'::JSONB),
    ('v-sit','safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Appropriate equipment, qualified supervision, explicit technique standards, and readiness-matched progression are core resistance-training safeguards.","Stop for hand, wrist, elbow, shoulder, hip, hamstring, abdominal, or back symptoms; support slip; elbow or shoulder collapse; feet falling to or below horizontal; knee bend; breath distress; or unsafe entry or exit."]'::JSONB),
    ('v-sit','accessibility','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Long-term development should be individualized from current readiness, movement competence, response, and progressive exposure.","Scale with stable raised supports, declared assistance, shorter holds, a lower but still above-horizontal target, straddle or together-leg selection, longer rest, or L-Sit and seated-compression substitutions. Do not copy formal gymnastics proficiency onto the exercise card."]'::JSONB),
    ('v-sit','media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["YouTube documents privacy-enhanced embed URLs, but an embed URL does not establish current playback, embedding permission, accessibility, or exact exercise match.","Five public-title discoveries are candidates for static straight-arm V-Sit support with both feet clearly above horizontal. Exact height, leg position, support, entry, hold, exit, captions, accessibility, claims, and quality require human review."]'::JSONB),
    ('manna-hold','safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Appropriate equipment, qualified supervision, explicit technique standards, and readiness-matched progression are core resistance-training safeguards.","Stop or do not start without qualified direct supervision, stable rated support, planned assistance and exit, and clear communication. Stop for symptoms, elbow bend, shoulder-path change, hip or leg position loss, increased assistance, breath or communication change, or uncertain exit."]'::JSONB),
    ('manna-hold','accessibility','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Long-term development should be individualized from current readiness, movement competence, response, and progressive exposure.","Use coach-cleared partial progressions, stable raised support, declared assistance, very short attempts, long rest, or V-Sit and seated-compression substitutions. Manna is not a general group default, and formal proficiency remains in the skill library."]'::JSONB),
    ('manna-hold','media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["YouTube documents privacy-enhanced embed URLs, but an embed URL does not establish current playback, embedding permission, accessibility, or exact exercise match.","Five public-title discoveries are candidates for the exact static Manna position. Exact hip height, legs beyond the shoulder line, shoulder-extension path, straight-arm support, assistance, entry, exit, supervision, captions, accessibility, claims, and quality require human review."]'::JSONB);

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at
  )
  SELECT definition.id,definition.card_version,evidence.section_key,evidence.source_url,
    evidence.source_title,evidence.source_publisher,evidence.source_kind,evidence.claims_json,
    evidence.evidence_quality,'candidate',NULL,NULL
  FROM support_evidence_seed evidence
  JOIN coaching.exercise_definition_v1 definition ON definition.facility_id=1 AND definition.slug=evidence.definition_slug AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  CREATE TEMP TABLE support_media_seed(
    definition_slug TEXT NOT NULL,video_id TEXT NOT NULL,title TEXT NOT NULL,
    channel_name TEXT NOT NULL,source_query TEXT NOT NULL,notes TEXT NOT NULL,
    PRIMARY KEY(definition_slug,video_id)
  ) ON COMMIT DROP;
  INSERT INTO support_media_seed VALUES
    ('straddle-compression-lift','WR3C2cliSaA','Pike compression lifts - strengthen hip flexors','The Movement Collective','Public YouTube search and oEmbed observed 2026-07-26: pike compression lifts','Candidate by public metadata only. Exact seated identity, declared knee and hand position, range, trunk control, lowering, safety, captions, accessibility, and full sequence require human review.'),
    ('straddle-compression-lift','yQXnOuQqKYc','How to Improve Active Pike Compression with Antranik','Antranik Kizirian','Public YouTube search and oEmbed observed 2026-07-26: active pike compression','Candidate by public metadata only. Exact exercise versus mobility scope, range, dosage, cue quality, safety, captions, accessibility, and complete demonstration require human review.'),
    ('straddle-compression-lift','6w4gmF0NUX0','Core Compression, Seated Pike, Leg Lifts','The Sustainable Training Method','Public YouTube search and oEmbed observed 2026-07-26: seated pike leg lifts','Candidate by public metadata only. Exact variant, trunk and knee standard, lowering, dosage, claims, captions, accessibility, and full content require human review.'),
    ('straddle-compression-lift','hEo814VH208','Core Compression, Seated Pike Leg Lifts, Isometrics & Lift Offs','The Sustainable Training Method','Public YouTube search and oEmbed observed 2026-07-26: seated pike lift-offs','Candidate by public metadata only. Dynamic versus isometric identity boundaries, exact setup, stop rules, safety, captions, accessibility, and full sequence require human review.'),
    ('straddle-compression-lift','mC4sBN6E_R8','Gymnastics Compression Drills','CrossFit','Public YouTube search and oEmbed observed 2026-07-26: gymnastics compression drills','Official-channel candidate by metadata only. Exact seated variants, intended dose, safety, captions, accessibility, claim quality, and complete sequence require human review.'),
    ('v-sit','3HAQXpSpHBA','HOW TO DO the ''V Sit'' 🤸 Gymnastics & Calisthenics Progression','Criticalbench','Public YouTube search and oEmbed observed 2026-07-26: V-sit gymnastics progression','Candidate by public metadata only. Exact above-horizontal hold, support, variants, setup, exit, dosage, safety, captions, accessibility, and claims require human review.'),
    ('v-sit','m2Di7xThWx0','6 Exercises To Learn The V-Sit','Calixpert','Public YouTube search and oEmbed observed 2026-07-26: exercises to learn V-sit','Candidate by public metadata only. Progression boundaries, exact V height, seated compression segments, support and exit safety, captions, accessibility, and full content require human review.'),
    ('v-sit','P83rvEDFTjg','How to learn the V-SIT Ι Tips and Progressions!!','Sid Paulson','Public YouTube search and oEmbed observed 2026-07-26: V-sit tips and progressions','Candidate by public metadata only. Exact variants, support, leg-height standard, safety, claims, captions, accessibility, and full sequence require human review.'),
    ('v-sit','dzpeUQIp0cY','V-Sit Tutorial | How to V-Sit, Step by Step #calisthenics #tutorial #workout','Movement by Dima','Public YouTube search and oEmbed observed 2026-07-26: V-sit step by step','Short-form candidate by public metadata only. Complete setup, height standard, variants, dosage, safety, exit, captions, accessibility, and claim review are especially important.'),
    ('v-sit','ARiWA2R6gzM','💪 How To V-SIT (Full Workout)','SaturnoMovement','Public YouTube search and oEmbed observed 2026-07-26: V-sit full workout','Candidate by public metadata only. Workout dosage is not automatically the Vortex dose; exact identity, safety, setup, exit, captions, accessibility, and claims require human review.'),
    ('manna-hold','KJFW2rnownQ','Manna Progression','Acro Fitness Motivation','Public YouTube search and oEmbed observed 2026-07-26: Manna progression','Candidate by public metadata only. Exact Manna identity, prerequisites, support, assistance, shoulder path, dosage, safety, exit, captions, accessibility, and claims require human review.'),
    ('manna-hold','dTPEnTZnHHo','Manna progressions','Mahermovement','Public YouTube search and oEmbed observed 2026-07-26: Manna progressions','Candidate by public metadata only. Exact identity boundaries, spotting, support, progression order, safety, exit, captions, accessibility, and full content require human review.'),
    ('manna-hold','OLFnFSTqP_c','Tips and Tricks for Manna','Nils Valkenborgh (AcroNils)','Public YouTube search and oEmbed observed 2026-07-26: Manna tips','Candidate by public metadata only. Exact position, shoulder and hip range, assistance, dose, safety, exit, claims, captions, and accessibility require human review.'),
    ('manna-hold','7r5HgYtuwSs','Manna Gymnastics Progressions','Club Calisthenics','Public YouTube search and oEmbed observed 2026-07-26: Manna gymnastics progressions','Candidate by public metadata only. Exact gymnastics Manna position, support, assistance, prerequisites, safety, exit, captions, accessibility, and complete sequence require human review.'),
    ('manna-hold','BKwVJrGf5do','TEACH YOUR GYMNAST HOW TO DO A MANNA','Gym Club Solutions','Public YouTube search and oEmbed observed 2026-07-26: teach gymnast Manna','Candidate by public metadata only. Coaching title does not establish Vortex approval; exact setup, spot, position, dosage, safety, exit, captions, accessibility, and claims require human review.');

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,notes
  )
  SELECT definition.id,NULL,definition.card_version,
    'https://www.youtube.com/watch?v='||media.video_id,
    'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel_name,NULL,'en',NULL,FALSE,NULL,NULL,
    'unverified','candidate','manual_research',media.source_query,NULL,NULL,NULL,media.notes
  FROM support_media_seed media
  JOIN coaching.exercise_definition_v1 definition ON definition.facility_id=1 AND definition.slug=media.definition_slug AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,video_id)
  DO UPDATE SET variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,title=EXCLUDED.title,
    channel_name=EXCLUDED.channel_name,duration_seconds=NULL,language_code='en',captions_available=NULL,
    embedding_allowed=FALSE,exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='unverified',review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=NULL,
    notes=EXCLUDED.notes,updated_at=now();

  CREATE TEMP TABLE support_alternate_seed(
    definition_slug TEXT NOT NULL,alternate_name TEXT NOT NULL,classification TEXT NOT NULL,
    rationale TEXT NOT NULL,dimensions JSONB NOT NULL,
    PRIMARY KEY(definition_slug,alternate_name)
  ) ON COMMIT DROP;
  INSERT INTO support_alternate_seed VALUES
    ('straddle-compression-lift','Bent-Knee Seated Compression Lift','new_variant','Knee flexion materially shortens the lever and lowers physical demand while preserving the grounded dynamic compression identity.','{"kneeAngle":"flexed","leverLength":"short"}'::JSONB),
    ('straddle-compression-lift','Single-Leg Pike Compression Lift','new_variant','Unilateral alternating execution changes lever, side-to-side control, symmetry, and dose but preserves the seated dynamic action.','{"laterality":"unilateral_alternating","legPosition":"pike"}'::JSONB),
    ('straddle-compression-lift','Pike Seated Compression Lift','new_variant','Pike changes hip-abduction position and available range relative to straddle while preserving bilateral seated leg lifting.','{"legPosition":"pike_together","laterality":"bilateral"}'::JSONB),
    ('straddle-compression-lift','Straddle Compression Lift','same_identity','This is the historical baseline variant retained inside the broader Seated Compression Lift definition.','{"legPosition":"straddle","legacySource":true}'::JSONB),
    ('straddle-compression-lift','Hands-on-Blocks Compression Lift','modifier_annotation','Stable blocks or handles change hand position and clearance without changing the seated dynamic leg-lift action.','{"handSupport":"stable_blocks_or_handles","identityBoundary":"unchanged"}'::JSONB),
    ('straddle-compression-lift','Paused Compression Lift','modifier_annotation','A brief top pause changes time under tension and dose while preserving identity and variant.','{"tempo":"top_pause","dose":"increased_time_under_tension"}'::JSONB),
    ('straddle-compression-lift','L-Sit','new_definition','L-sit suspends bodyweight through straight-arm push support and is static rather than a grounded dynamic leg lift.','{"supportAction":"straight_arm_push_support","contractionMode":"static_hold"}'::JSONB),
    ('straddle-compression-lift','Hanging Leg Raise','new_definition','Hanging leg raise adds overhead suspension, grip, anchor, swing, mount, and exit demands and uses a different start and support action.','{"supportAction":"overhead_suspension","movementPattern":"dynamic_hanging_leg_raise"}'::JSONB),
    ('v-sit','L-Sit','new_definition','A horizontal extended-leg support hold does not meet the above-horizontal V-sit identity and has materially lower range and balance demand.','{"legHeight":"horizontal","identityBoundary":"not_above_horizontal"}'::JSONB),
    ('v-sit','Straddle V-Sit','new_variant','Straddle preserves the high support hold but changes hip-abduction range, adductor control, symmetry, and spatial organization.','{"legPosition":"straddle","minimumHeight":"clearly_above_horizontal"}'::JSONB),
    ('v-sit','Ring-Support V-Sit','new_variant','Rings preserve the position while materially increasing grip, stability, supervision, mount, exit, and recovery demands.','{"support":"independent_rings","stability":"unstable"}'::JSONB),
    ('v-sit','Assisted V-Sit','modifier_annotation','Declared safe assistance changes external support and dose without changing the target V position; assistance method and amount must be recorded.','{"assistance":"declared","targetPosition":"unchanged"}'::JSONB),
    ('v-sit','Higher-Angle V-Sit','modifier_annotation','Increasing an already above-horizontal owned angle changes range and difficulty within the same identity until the hip and leg relationship crosses into Manna.','{"legAngle":"higher_above_horizontal","identityBoundary":"below_manna_position"}'::JSONB),
    ('v-sit','V-Sit to Handstand Press','new_definition','Adding a dynamic press to inverted support changes primary action, movement pattern, phase, risk, prerequisites, and dosage.','{"movementPattern":"dynamic_press_to_inversion","endPosition":"handstand"}'::JSONB),
    ('v-sit','Manna Hold','new_definition','Manna elevates the hips and carries the legs beyond the shoulder line, changing shoulder extension, trunk, flexibility, balance, assistance, and exit demands.','{"hipHeight":"near_or_above_shoulders","legPosition":"beyond_shoulder_line"}'::JSONB),
    ('v-sit','V-Up','new_definition','V-up is a dynamic supine trunk-and-hip flexion repetition without straight-arm push support.','{"startPosition":"supine","contractionMode":"dynamic_repetition","supportAction":"none"}'::JSONB),
    ('manna-hold','Spotted Manna Hold','modifier_annotation','Declared qualified assistance changes delivery and load but preserves the target Manna identity; assistance location and amount must be recorded.','{"assistance":"qualified_spot","targetPosition":"manna"}'::JSONB),
    ('manna-hold','Low Manna','new_variant','A deliberately lower but still post-V-sit hip and shoulder relationship may be a preparatory variant, but the exact identity threshold needs qualified coach review before implementation.','{"hipHeight":"below_full_manna","reviewState":"identity_threshold_pending"}'::JSONB),
    ('manna-hold','Straddle Manna','new_variant','Straddle may preserve the Manna support action while changing hip-abduction range, symmetry, and lever, but requires separate coach review before implementation.','{"legPosition":"straddle","hipHeight":"manna_standard"}'::JSONB),
    ('manna-hold','Manna to Handstand Press','new_definition','Adding a press to inverted support changes primary action, movement pattern, phase, prerequisites, risk, and dosage.','{"movementPattern":"dynamic_press_to_inversion","endPosition":"handstand"}'::JSONB),
    ('manna-hold','Manna Dislocation to Handstand','new_definition','The dislocation and transition to handstand create a different dynamic shoulder action, orientation, risk, and governing-body element.','{"movementPattern":"dynamic_dislocation_to_inversion","endPosition":"handstand"}'::JSONB),
    ('manna-hold','V-Sit','new_definition','V-sit holds the legs above horizontal without the full Manna hip height and beyond-shoulder leg relationship.','{"hipHeight":"below_manna","legPosition":"above_horizontal_not_beyond_manna_line"}'::JSONB),
    ('manna-hold','Ring Manna','new_variant','Independent rings may preserve the target position but materially increase grip, stability, supervision, assistance, mount, exit, and failure consequence; do not implement without specialist review.','{"support":"independent_rings","reviewState":"specialist_review_required"}'::JSONB),
    ('manna-hold','Reverse Plank Leg Lift','reject','A reverse plank leg lift does not reproduce the Manna hip, leg, or support relationship and should not be labeled as Manna even if used as general preparation.','{"supportAction":"posterior_plank","identityMatch":false}'::JSONB);

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at
  )
  SELECT definition.id,definition.card_version,alternate.alternate_name,alternate.classification,
    alternate.rationale,alternate.dimensions,NULL,'candidate',NULL,NULL
  FROM support_alternate_seed alternate
  JOIN coaching.exercise_definition_v1 definition ON definition.facility_id=1 AND definition.slug=alternate.definition_slug AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name)
  DO UPDATE SET classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,proposed_card_json=NULL,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  CREATE TEMP TABLE support_authored_lateral_seed(
    definition_slug TEXT NOT NULL,from_variant_key TEXT NOT NULL,to_variant_key TEXT NOT NULL,
    similarity_score SMALLINT NOT NULL,dimensions TEXT[] NOT NULL,reason TEXT NOT NULL,
    conditions_json JSONB NOT NULL,
    PRIMARY KEY(definition_slug,from_variant_key,to_variant_key)
  ) ON COMMIT DROP;
  INSERT INTO support_authored_lateral_seed VALUES
    ('straddle-compression-lift','pike','baseline',82,ARRAY['range','complexity']::TEXT[],
      'Straddle changes frontal-plane hip position, range, and adductor control while preserving the seated dynamic compression action.',
      jsonb_build_object('requires',jsonb_build_array('pain_free_owned_straddle','symmetric_leg_lift'),'authoredDirection',TRUE)),
    ('v-sit','baseline','straddle',80,ARRAY['range','complexity']::TEXT[],
      'Straddle changes hip-abduction range and symmetry while preserving the above-horizontal straight-arm support identity.',
      jsonb_build_object('requires',jsonb_build_array('pain_free_owned_straddle','symmetric_v_height'),'authoredDirection',TRUE));

  UPDATE coaching.exercise_relationship_v1 relationship
  SET similarity_score=seed.similarity_score,dimensions=seed.dimensions,reason=seed.reason,
    conditions_json=seed.conditions_json,review_status='review',created_by=NULL,
    reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  FROM support_authored_lateral_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=seed.definition_slug AND definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id=definition.id AND from_variant.variant_key=seed.from_variant_key AND from_variant.status<>'archived'
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id=definition.id AND to_variant.variant_key=seed.to_variant_key AND to_variant.status<>'archived'
  WHERE relationship.from_variant_id=from_variant.id
    AND relationship.to_variant_id=to_variant.id
    AND relationship.relationship='lateral_substitution'
    AND relationship.review_status='review';

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at
  )
  SELECT relationship.to_variant_id,relationship.from_variant_id,
    CASE relationship.relationship WHEN 'progression' THEN 'regression' ELSE relationship.relationship END,
    relationship.similarity_score,relationship.dimensions,
    'Inverse review candidate of the authored '||relationship.relationship||': '||relationship.reason,
    coalesce(relationship.conditions_json,'{}'::JSONB)||jsonb_build_object(
      'inverseOfRelationship',relationship.relationship,'humanReviewRequired',TRUE),
    'review',NULL,NULL,NULL
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 from_variant ON from_variant.id=relationship.from_variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=from_variant.definition_id
  WHERE definition.facility_id=1
    AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND relationship.relationship IN ('progression','lateral_substitution')
    AND relationship.review_status='review'
    AND NOT (coalesce(relationship.conditions_json,'{}'::JSONB)?'inverseOfRelationship')
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,review_status='review',
    created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at
  )
  SELECT 1,variant.id,dimension.dimension,
    CASE dimension.dimension WHEN 'technicalComplexity' THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END,
    CASE WHEN (CASE dimension.dimension WHEN 'technicalComplexity' THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=30 THEN 20
      WHEN (CASE dimension.dimension WHEN 'technicalComplexity' THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=50 THEN 40
      WHEN (CASE dimension.dimension WHEN 'technicalComplexity' THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=70 THEN 60 ELSE 80 END,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN 'Candidate exercise-complexity anchor reflects dynamic versus static action, support geometry, leg position, range standard, implement stability, assistance, entry, exit, and supervision; independent comparison is pending.'
      ELSE 'Candidate physical-difficulty anchor reflects lever length, bilateral compression, straight-arm support, shoulder range, bodyweight loading, implement stability, hold or repetition demand, and controlled exit; independent comparison is pending.' END,
    'review',1,NULL,NULL,'Candidate migration-409 anchor; independent human review required.',NULL
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  CROSS JOIN(VALUES('technicalComplexity'),('absoluteLoadDemand')) AS dimension(dimension)
  WHERE definition.facility_id=1
    AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND definition.status<>'archived' AND variant.status<>'archived'
    AND variant.difficulty_json?'technicalComplexity' AND variant.difficulty_json?'absoluteLoadDemand'
  ON CONFLICT(facility_id,variant_id,dimension,version)
  DO UPDATE SET proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_score_calibration_v1.status='review';

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity=seed.complexity,absolute_load_demand=seed.physical,
    coordination_demand=seed.coordination,impact=seed.impact,supervision_demand=seed.supervision,
    base_overall_difficulty=greatest(seed.complexity,seed.physical),
    legacy_scores=coalesce(score.legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchBatch',research_batch,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'candidateOnly',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=seed.confidence,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,review_notes=seed.notes,updated_at=now()
  FROM(VALUES
    (803::BIGINT,40::SMALLINT,46::SMALLINT,44::SMALLINT,1::SMALLINT,28::SMALLINT,76::SMALLINT,'Candidate Seated Compression Lift baseline score; human calibration review required.'::TEXT),
    (1704::BIGINT,72::SMALLINT,80::SMALLINT,74::SMALLINT,1::SMALLINT,68::SMALLINT,74::SMALLINT,'Candidate V-Sit baseline score; human calibration review required.'::TEXT),
    (1705::BIGINT,88::SMALLINT,94::SMALLINT,90::SMALLINT,1::SMALLINT,92::SMALLINT,70::SMALLINT,'Candidate Manna Hold baseline score; qualified gymnastics coach and calibration review required.'::TEXT)
  ) AS seed(exercise_id,complexity,physical,coordination,impact,supervision,confidence,notes)
  WHERE score.exercise_id=seed.exercise_id AND score.human_review_status='queued'
    AND score.reviewed_by IS NULL AND score.reviewed_at IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at
  )
  SELECT definition.id,definition.facility_id,definition.card_version,definition.schema_version,
    migration_key,'quarantined',jsonb_build_object(
      'stableIdentityAndAliases',TRUE,
      'groundedVAndMannaBoundariesPresent',TRUE,
      'legacyMappingsPresent',TRUE,
      'taxonomyAnatomyPlanesLateralityPresent',TRUE,
      'difficultyOnlyModelPresent',TRUE,
      'loadFatigueRecoveryPresent',TRUE,
      'equipmentEnvironmentPopulationPresent',TRUE,
      'deliveryDosageInstructionsAndStopRulesPresent',TRUE,
      'athleteCoachAndOperationsSupportPresent',TRUE,
      'candidateEvidenceSectionsPresent',TRUE,
      'fiveMediaCandidatesPresent',TRUE,
      'alternateAssessmentsPresent',TRUE,
      'progressionRegressionAndSubstitutionProposalsPresent',TRUE,
      'complexityAndPhysicalCalibrationProposalsPresent',TRUE,
      'exerciseSkillClassificationAbsent',TRUE,
      'approvalsCreated',FALSE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-EVIDENCE-02','message','Candidate evidence and authored section claims require independent review.'),
      jsonb_build_object('code','CARD-IDENTITY-05','message','Exercise and variant boundaries require qualified coach review before publication.'),
      jsonb_build_object('code','CARD-MEDIA-01','message','Five media candidates require playback, embedding, exact-match, complete-content, safety, caption, accessibility, and reviewer approval.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','Progression, regression, and substitution relationships remain review-only.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Complexity and physical-difficulty anchors remain review-only.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Two-person card review, version approval, media approval, and pilot evidence are incomplete.')),
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1
    AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND definition.status<>'archived'
  ON CONFLICT(definition_id)
  DO UPDATE SET facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,human_review_required=TRUE,checked_at=now();

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_identity_resolution_v1 identity
  JOIN coaching.exercise_definition_v1 survivor ON survivor.id=identity.survivor_definition_id
  JOIN coaching.exercise_definition_v1 resolved ON resolved.id=identity.resolved_definition_id
  WHERE identity.decision='distinct_exercises' AND identity.reviewed_by IS NULL
    AND ((survivor.slug='l-sit' AND resolved.slug='v-sit')
      OR (survivor.slug='straddle-compression-lift' AND resolved.slug='v-sit')
      OR (survivor.slug='v-sit' AND resolved.slug='manna-hold')
      OR (survivor.slug='straddle-compression-lift' AND resolved.slug='manna-hold'));
  IF actual_count<>4 THEN RAISE EXCEPTION '% did not preserve or create all 4 support-compression identity boundaries; found %',migration_key,actual_count; END IF;

  SELECT count(*) INTO actual_count FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_section_evidence_v1 evidence ON evidence.definition_id=definition.id AND evidence.reviewed_card_version=definition.card_version
  WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold') AND evidence.review_status='candidate';
  IF actual_count<>48 THEN RAISE EXCEPTION '% did not create all 48 candidate evidence rows; found %',migration_key,actual_count; END IF;

  SELECT count(*) INTO actual_count FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_media_candidate_v1 media ON media.definition_id=definition.id AND media.reviewed_card_version=definition.card_version
  WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND media.review_status='candidate' AND media.link_status='unverified' AND media.embedding_allowed=FALSE
    AND media.exact_variant_match IS NULL AND media.demonstration_quality_score IS NULL
    AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL;
  IF actual_count<>15 THEN RAISE EXCEPTION '% did not create all 15 unverified, non-embeddable media candidates; found %',migration_key,actual_count; END IF;
  IF EXISTS(
    SELECT 1 FROM(SELECT definition.slug,count(*) count FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_candidate_v1 media ON media.definition_id=definition.id AND media.reviewed_card_version=definition.card_version
      WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold') AND media.review_status='candidate'
      GROUP BY definition.slug) counts WHERE counts.count<>5
  ) THEN RAISE EXCEPTION '% requires exactly 5 current media candidates per definition',migration_key; END IF;

  SELECT count(*) INTO actual_count FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_alternate_assessment_v1 alternate ON alternate.definition_id=definition.id AND alternate.reviewed_card_version=definition.card_version
  WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold') AND alternate.review_status='candidate';
  IF actual_count<>24 THEN RAISE EXCEPTION '% did not create all 24 candidate alternate assessments; found %',migration_key,actual_count; END IF;

  SELECT count(*) INTO actual_count FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 from_variant ON from_variant.id=relationship.from_variant_id
  JOIN coaching.exercise_variant_v1 to_variant ON to_variant.id=relationship.to_variant_id
  WHERE (from_variant.definition_id IN(SELECT id FROM coaching.exercise_definition_v1 WHERE slug IN ('straddle-compression-lift','v-sit','manna-hold'))
      OR to_variant.definition_id IN(SELECT id FROM coaching.exercise_definition_v1 WHERE slug IN ('straddle-compression-lift','v-sit','manna-hold')))
    AND relationship.review_status='review' AND relationship.reviewed_by IS NULL AND relationship.reviewed_at IS NULL;
  IF actual_count<>15 THEN RAISE EXCEPTION '% did not preserve 8 graph proposals and create all 7 inverse proposals; found %',migration_key,actual_count; END IF;

  SELECT count(*) INTO actual_count FROM coaching.exercise_score_calibration_v1 calibration
  JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND variant.status<>'archived' AND calibration.status='review'
    AND calibration.dimension IN ('technicalComplexity','absoluteLoadDemand')
    AND calibration.reviewed_by IS NULL AND calibration.reviewed_at IS NULL;
  IF actual_count<>16 THEN RAISE EXCEPTION '% did not create all 16 review-only calibration rows; found %',migration_key,actual_count; END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
      AND variant.status<>'archived' AND ((variant.difficulty_json->>'baseOverallDifficulty')::SMALLINT
        <>greatest((variant.difficulty_json->>'technicalComplexity')::SMALLINT,(variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT)
        OR (variant.programming_profile_json->>'overallDifficulty')::SMALLINT
        <>greatest((variant.difficulty_json->>'technicalComplexity')::SMALLINT,(variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT))
  ) THEN RAISE EXCEPTION '% found a variant whose overall is not max(complexity, physical difficulty)',migration_key; END IF;

  SELECT count(*) INTO actual_count FROM coaching.exercise_card_test_packet_v1 packet
  JOIN coaching.exercise_definition_v1 definition ON definition.id=packet.definition_id AND definition.card_version=packet.card_version
  WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
    AND packet.audit_version=migration_key AND packet.status='quarantined' AND packet.human_review_required=TRUE;
  IF actual_count<>3 THEN RAISE EXCEPTION '% did not create all 3 quarantined card test packets; found %',migration_key,actual_count; END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
      AND coaching.exercise_json_has_level_classification(jsonb_build_array(
        definition.provenance_json,definition.environment_json,definition.population_json,
        definition.anatomy_json,definition.athlete_support_json,definition.coach_support_json,definition.support_operations_json))
  ) THEN RAISE EXCEPTION '% found forbidden exercise skill/proficiency classification',migration_key; END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
    LEFT JOIN coaching.exercise_card_review_v1 card_review ON card_review.definition_id=definition.id
    LEFT JOIN coaching.exercise_media_review_v1 media_review ON media_review.definition_id=definition.id
    WHERE definition.facility_id=1 AND definition.slug IN ('straddle-compression-lift','v-sit','manna-hold')
      AND (definition.status='published' OR definition.approved_video_url IS NOT NULL
        OR definition.reviewed_by IS NOT NULL OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL OR card_review.id IS NOT NULL OR media_review.id IS NOT NULL)
  ) THEN RAISE EXCEPTION '% created or retained a forbidden approval on the completed candidate cards',migration_key; END IF;
END;
$$;
