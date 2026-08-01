-- Complete candidate research and governance packets for Hanging Leg Raise,
-- support L-Sit, and Hanging L-Sit after migrations 310 and 311.
--
-- The three identities remain separate: dynamic bilateral hip flexion from an
-- overhead hang, a static straight-arm push-support compression hold, and a
-- static overhead-suspension compression hold. Knee angle, lever, range,
-- assistance, implement, tempo, and external load remain controlled variant or
-- delivery dimensions unless an authored action/support boundary requires a
-- separate definition.
--
-- Exercise cards store exercise complexity and physical difficulty only, with
-- overall derived as their maximum. Athlete or class skill levels remain
-- exclusive to coaching.skill.
--
-- Evidence, media, graph, calibration, and packets remain candidate/review-only.
-- Media URLs and privacy-enhanced embed URLs are discoveries, not playback,
-- embedding, exact-match, content, accessibility, reviewer, or approval claims.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '410_coaching_hanging_leg_raise_l_sit_research_completion';
  already_applied_count INTEGER;
  actual_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1
    AND slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND status<>'archived';
  IF actual_count<>3 THEN
    RAISE EXCEPTION '% requires exactly 3 active Hanging Leg Raise/L-Sit definitions; found %',migration_key,actual_count;
  END IF;

  SELECT count(*) INTO already_applied_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1
    AND slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND status<>'archived'
    AND provenance_json->>'researchCompletionMigration'=migration_key;
  IF already_applied_count NOT IN(0,3) THEN
    RAISE EXCEPTION '% found a partial prior application on % definitions',migration_key,already_applied_count;
  END IF;
  IF already_applied_count=0 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE facility_id=1 AND slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
      AND status<>'archived' AND card_version<>1
  ) THEN RAISE EXCEPTION '% expected migration-310/311 card version 1 before first application',migration_key; END IF;
  IF already_applied_count = 3 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1
      AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
      AND definition.status<>'archived' AND definition.card_version <> 2
  ) THEN RAISE EXCEPTION '% found drift after completion; all three cards must remain at version 2',migration_key; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source ON source.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.status<>'archived'
    AND (
      (definition.slug='hanging-leg-raise' AND source.legacy_exercise_id IN(604,605,778,819))
      OR (definition.slug='l-sit' AND source.legacy_exercise_id IN(603,804))
      OR (definition.slug='hanging-l-sit'
        AND source.legacy_exercise_id=definition.legacy_exercise_id
        AND source.provenance_json->>'created_by_migration'='311_coaching_l_sit_identity_and_hanging_split')
    );
  IF actual_count<>7 OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source ON source.definition_id=definition.id
    WHERE definition.facility_id=1
      AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
      AND definition.status<>'archived'
      AND NOT(
        (definition.slug='hanging-leg-raise' AND source.legacy_exercise_id IN(604,605,778,819))
        OR (definition.slug='l-sit' AND source.legacy_exercise_id IN(603,804))
        OR (definition.slug='hanging-l-sit'
          AND source.legacy_exercise_id=definition.legacy_exercise_id
          AND source.provenance_json->>'created_by_migration'='311_coaching_l_sit_identity_and_hanging_split')
      )
  ) THEN RAISE EXCEPTION '% expected exactly all 7 migration-310/311 legacy mappings',migration_key; END IF;

  CREATE TEMP TABLE family_variant_expectation(
    definition_slug TEXT NOT NULL,variant_key TEXT NOT NULL,
    PRIMARY KEY(definition_slug,variant_key)
  ) ON COMMIT DROP;
  INSERT INTO family_variant_expectation VALUES
    ('hanging-leg-raise','baseline'),
    ('hanging-leg-raise','straight-leg'),
    ('hanging-leg-raise','bent-knee-eccentric-lower'),
    ('l-sit','baseline'),
    ('l-sit','tuck'),
    ('l-sit','one-leg'),
    ('l-sit','straddle'),
    ('l-sit','ring-support'),
    ('hanging-l-sit','baseline'),
    ('hanging-l-sit','tuck'),
    ('hanging-l-sit','one-leg');

  SELECT count(*) INTO actual_count
  FROM family_variant_expectation expected
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=expected.definition_slug AND definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id AND variant.variant_key=expected.variant_key AND variant.status<>'archived';
  IF actual_count<>11 OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    LEFT JOIN family_variant_expectation expected
      ON expected.definition_slug=definition.slug AND expected.variant_key=variant.variant_key
    WHERE definition.facility_id=1
      AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
      AND definition.status<>'archived' AND variant.status<>'archived'
      AND expected.variant_key IS NULL
  ) THEN RAISE EXCEPTION '% requires exactly all 11 migration-310/311 review variants',migration_key; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  JOIN coaching.exercise_delivery_profile_v1 profile ON profile.variant_id=variant.id
  WHERE definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND definition.status<>'archived' AND variant.status<>'archived' AND profile.status<>'archived';
  IF actual_count<>11 THEN RAISE EXCEPTION '% requires exactly all 11 migration-310/311 delivery profiles; found %',migration_key,actual_count; END IF;

  CREATE TEMP TABLE family_identity_seed(
    survivor_slug TEXT NOT NULL,resolved_slug TEXT NOT NULL,boundary_key TEXT NOT NULL,
    rationale TEXT NOT NULL,PRIMARY KEY(survivor_slug,resolved_slug)
  ) ON COMMIT DROP;
  INSERT INTO family_identity_seed VALUES
    ('l-sit','hanging-l-sit','straight_arm_push_support_vs_overhead_suspension',
      'L-Sit supports bodyweight through straight arms pressing into the floor or apparatus. Hanging L-Sit suspends bodyweight from an overhead grip, changing support action, shoulder position, grip load, equipment, mount, supervision, failure consequence, and exit.'),
    ('hanging-leg-raise','hanging-l-sit','dynamic_hanging_hip_flexion_vs_static_hanging_hold',
      'Hanging Leg Raise repeatedly flexes and lowers the hips from a still hang. Hanging L-Sit holds a declared leg shape statically, changing contraction mode, time course, dose, measurement, fatigue, quality gates, and substitutions.'),
    ('l-sit','hanging-leg-raise','static_push_support_hold_vs_dynamic_overhead_suspension',
      'L-Sit is a static straight-arm push-support compression hold. Hanging Leg Raise is dynamic bilateral hip flexion from overhead suspension, changing support, action, shoulder and grip demand, dose, station, and exit.');

  IF EXISTS(
    SELECT 1 FROM family_identity_seed seed
    JOIN coaching.exercise_definition_v1 left_definition
      ON left_definition.facility_id=1 AND left_definition.slug=seed.survivor_slug AND left_definition.status<>'archived'
    JOIN coaching.exercise_definition_v1 right_definition
      ON right_definition.facility_id=1 AND right_definition.slug=seed.resolved_slug AND right_definition.status<>'archived'
    JOIN coaching.exercise_identity_resolution_v1 identity
      ON (identity.survivor_definition_id=left_definition.id AND identity.resolved_definition_id=right_definition.id)
      OR (identity.survivor_definition_id=right_definition.id AND identity.resolved_definition_id=left_definition.id)
    WHERE identity.decision<>'distinct_exercises'
      OR identity.survivor_definition_id<>left_definition.id
      OR identity.resolved_definition_id<>right_definition.id
      OR identity.reviewed_by IS NOT NULL
  ) THEN RAISE EXCEPTION '% refused to overwrite a conflicting or human-reviewed Hanging Leg Raise/L-Sit identity decision',migration_key; END IF;

  SELECT count(*) INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND definition.status<>'archived'
    AND (definition.status='published' OR definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL OR definition.last_reviewed_at IS NOT NULL);
  IF protected_count>0 THEN RAISE EXCEPTION '% refused to overwrite % human-reviewed or published definition(s)',migration_key,protected_count; END IF;

  SELECT count(*) INTO protected_count FROM coaching.exercise_score_v1 score
  WHERE (
      score.exercise_id IN(603,604,605,778,804,819)
      OR score.exercise_id=(SELECT legacy_exercise_id FROM coaching.exercise_definition_v1
        WHERE facility_id=1 AND slug='hanging-l-sit' AND status<>'archived')
    )
    AND (score.human_review_status<>'queued' OR score.reviewed_by IS NOT NULL OR score.reviewed_at IS NOT NULL);
  IF protected_count>0 THEN RAISE EXCEPTION '% refused to overwrite % human-reviewed legacy score record(s)',migration_key,protected_count; END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
      LEFT JOIN coaching.exercise_delivery_profile_v1 profile ON profile.variant_id=variant.id
      WHERE definition.facility_id=1 AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
        AND (variant.status='published' OR profile.status='published'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_section_evidence_v1 evidence
        ON evidence.definition_id=definition.id AND evidence.reviewed_card_version=definition.card_version
      WHERE definition.facility_id=1 AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_candidate_v1 media
        ON media.definition_id=definition.id AND media.reviewed_card_version=definition.card_version
      WHERE definition.facility_id=1 AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_alternate_assessment_v1 alternate
        ON alternate.definition_id=definition.id AND alternate.reviewed_card_version=definition.card_version
      WHERE definition.facility_id=1 AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_card_review_v1 review ON review.definition_id=definition.id
      WHERE definition.facility_id=1 AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_card_revision_v1 revision ON revision.definition_id=definition.id
      WHERE definition.facility_id=1 AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_review_v1 review ON review.definition_id=definition.id
      WHERE definition.facility_id=1 AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit'))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
      JOIN coaching.exercise_relationship_v1 relationship
        ON relationship.from_variant_id=variant.id OR relationship.to_variant_id=variant.id
      WHERE definition.facility_id=1 AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
        AND (relationship.review_status<>'review' OR relationship.reviewed_by IS NOT NULL OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
      JOIN coaching.exercise_score_calibration_v1 calibration ON calibration.variant_id=variant.id
      WHERE definition.facility_id=1 AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
        AND (calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL OR calibration.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN RAISE EXCEPTION '% refused to overwrite % reviewed or published dependent record(s)',migration_key,protected_count; END IF;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=CASE WHEN already_applied_count=0 THEN definition.card_version+1 ELSE definition.card_version END,
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'researchCompletionMigration',migration_key,
      'researchBatches',jsonb_build_array('hanging-leg-raise-family-v1','l-sit-support-and-hanging-family-v1'),
      'researchVersion',CASE WHEN definition.slug='hanging-leg-raise' THEN '2026-07-26.27' ELSE '2026-07-26.28' END,
      'identityAuthorityMigrations',jsonb_build_array('310_coaching_hanging_leg_raise_identity_consolidation','311_coaching_l_sit_identity_and_hanging_split',migration_key),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'evidenceState','candidate_requires_human_review',
      'mediaState','public_candidates_unverified_and_non_embeddable',
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
      'mediaApprovalCreated',FALSE,'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    updated_at=now()
  WHERE definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND definition.status<>'archived';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,survivor.id,resolved.id,'distinct_exercises',seed.rationale,
    jsonb_build_object('boundaryKey',seed.boundary_key,
      'researchBatches',jsonb_build_array('hanging-leg-raise-family-v1','l-sit-support-and-hanging-family-v1'),
      'evidenceSource','current_authored_candidate_card_contracts',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM family_identity_seed seed
  JOIN coaching.exercise_definition_v1 survivor
    ON survivor.facility_id=1 AND survivor.slug=seed.survivor_slug AND survivor.status<>'archived'
  JOIN coaching.exercise_definition_v1 resolved
    ON resolved.facility_id=1 AND resolved.slug=seed.resolved_slug AND resolved.status<>'archived'
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO NOTHING;

  UPDATE coaching.exercise_section_evidence_v1 evidence SET review_status='superseded',updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE evidence.definition_id=definition.id AND definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND evidence.reviewed_card_version<definition.card_version AND evidence.review_status='candidate';
  UPDATE coaching.exercise_media_candidate_v1 media SET review_status='superseded',updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE media.definition_id=definition.id AND definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND media.reviewed_card_version<definition.card_version AND media.review_status='candidate';
  UPDATE coaching.exercise_alternate_assessment_v1 alternate SET review_status='superseded',updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE alternate.definition_id=definition.id AND definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND alternate.reviewed_card_version<definition.card_version AND alternate.review_status='candidate';

  CREATE TEMP TABLE family_packet_seed(
    definition_slug TEXT PRIMARY KEY,research_version TEXT NOT NULL,packet_json JSONB NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_packet_seed VALUES
    ('hanging-leg-raise','2026-07-26.27',$packet${"evidence":[{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Resistance exercise selection requires qualified instruction, safe equipment and space, appropriate progression, and readiness assessed for the individual rather than inferred from a label on the exercise.","Before Hanging Leg Raise, check the anchor, bar or rings, mount, clearance, landing surface, assistance, traffic lane, grip, overhead tolerance, and exit. Stop for pain or pinching; instability; numbness or tingling; dizziness; grip slip; uncontrolled swing; repeated loss of pelvic, trunk, knee-angle, or lowering control; breath distress; or an unsafe dismount."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Training should be individualized and progressively developed from current readiness and movement competence.","Scale Hanging Leg Raise with a lower bar, stable foot support, safe mounting box, reduced range, bent knees, fewer repetitions, more rest, plain-language cues, visual range targets, or a supported or supine substitute. Exercise cards use complexity and physical-difficulty scores; athlete or class skill levels belong to the skill library, not this exercise card."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The five supplied videos are discovery candidates only. Public oEmbed title and channel metadata were observed on 2026-07-26, but exact variant match, complete sequence, cue and claim quality, safe mount and exit, captions, accessibility, reviewer identity, approval, and continuing availability remain pending human review."]},{"sectionKey":"identity","sourceUrl":"https://library.crossfit.com/premium/pdf/69_08_scaling_up_w_rings.pdf","sourceTitle":"Scaling Up CrossFit Workouts With Rings","sourcePublisher":"CrossFit Journal","sourceKind":"professional_standard","evidenceQuality":72,"claims":["The professional source describes a hanging straight-leg raise and recommends hanging knee raises as the easier progression, supporting one movement identity with knee-angle and lever variants.","Treat strict bent-knee, straight-leg, and timed eccentric-lower versions as declared variants. Tuck is synonymous with the bent-knee baseline; cyclic kipping, static holds, support-station versions, and combined pull-up actions remain outside this identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/12828897/","sourceTitle":"Pelvic and femoral contributions to bilateral hip flexion by subjects suspended from a bar","sourcePublisher":"Clinical Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["The study directly examined active bilateral hip flexion while participants were suspended by both hands from a bar.","Classify the stable identity as bilateral suspended hip flexion with pelvic contribution and upper-extremity suspension. Knee angle and hamstring-length interaction are variant and range dimensions, not separate exercise identities."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/9118976/","sourceTitle":"Abdominal and hip flexor muscle activation during various training exercises","sourcePublisher":"European Journal of Applied Physiology and Occupational Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["In a small EMG study, hip flexors were highly active in exercises involving hip flexion and bilateral leg lifts also required abdominal activation.","Model hip flexors as important movers and the abdominal wall as a contributor to pelvic and trunk control. Do not claim selective lower-abdominal isolation or reduce the movement to one muscle."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/12828897/","sourceTitle":"Pelvic and femoral contributions to bilateral hip flexion by subjects suspended from a bar","sourcePublisher":"Clinical Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["In 14 participants performing suspended bilateral hip flexion, pelvic rotation contributed to the observed movement and the contribution varied with knee position and hamstring length.","The study supports recording knee angle, range, pelvic motion, and individual tolerance. It does not establish one mandatory pelvic position, universal range, or safe dose."]},{"sectionKey":"difficulty","sourceUrl":"https://www.nsca.com/contentassets/1066cf7e2c9d4e61b3c1a6e3fea988e0/coach-7.1.2-implementing-core-training-concepts-into-strength-training-for-sport.pdf","sourceTitle":"Implementing Core Training Concepts Into Strength Training for Sport","sourcePublisher":"NSCA Coach","sourceKind":"professional_standard","evidenceQuality":82,"claims":["The professional instruction requires hanging support, feet together, extended knees through the range, hip flexion to a declared landmark, a vertical trunk, and slow lowering.","Those simultaneous requirements support higher physical difficulty for the straight-leg lever and a modest complexity increase over bent knees. Overall difficulty is derived as the maximum of exercise complexity and physical difficulty; neither score is an athlete level."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4792997/","sourceTitle":"Comparison of muscular activities in the abdomen and lower limbs while performing sit-up and leg-raise","sourcePublisher":"Journal of Physical Therapy Science","sourceKind":"peer_reviewed_research","evidenceQuality":78,"claims":["A small supine EMG study found meaningful hip-flexor activity during leg raises and compared concentric and eccentric tasks.","This is adjacent evidence only: it supports counting hip-flexor and trunk exposure and distinguishing eccentric dose, but it does not directly validate hanging recovery hours. Also count grip, shoulder position, long-lever, total hanging, and prior pulling work."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Safe resistance training requires qualified instruction, appropriate equipment and space, supervision, and progression matched to individual readiness.","Require a rated anchor, secure grip, tolerable overhead position, safe mount and exit, adequate clearance, and a still controllable start. Do not prescribe the card when symptoms, grip, shoulder control, equipment, traffic, or dismount cannot be safely managed."]},{"sectionKey":"dosage","sourceUrl":"https://library.crossfit.com/premium/pdf/69_08_scaling_up_w_rings.pdf","sourceTitle":"Scaling Up CrossFit Workouts With Rings","sourcePublisher":"CrossFit Journal","sourceKind":"professional_standard","evidenceQuality":72,"claims":["The professional source uses bent-knee raises as a progression toward straight-leg hanging raises, demonstrating that lever and range should be progressed deliberately.","The source does not establish a universal prescription. Use low-to-moderate strict repetition sets with enough rest to preserve grip, stillness, knee angle, pelvic and trunk control, and a controlled lower; eccentric work requires explicit tempo and recovery monitoring."]},{"sectionKey":"instructions","sourceUrl":"https://www.nsca.com/contentassets/1066cf7e2c9d4e61b3c1a6e3fea988e0/coach-7.1.2-implementing-core-training-concepts-into-strength-training-for-sport.pdf","sourceTitle":"Implementing Core Training Concepts Into Strength Training for Sport","sourcePublisher":"NSCA Coach","sourceKind":"professional_standard","evidenceQuality":82,"claims":["The professional instruction specifies a bar hang, feet together, extended knees, hip flexion to roughly parallel, a vertical back, and slow return for the straight-leg version.","General card instructions must also name the selected knee angle, still start, owned range, pelvic and trunk control, no-swing rule, secure grip, and safe step-down. Bent-knee range may be smaller and should not be forced to match the straight-leg landmark."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/9118976/","sourceTitle":"Abdominal and hip flexor muscle activation during various training exercises","sourcePublisher":"European Journal of Applied Physiology and Occupational Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Hip-flexion and bilateral leg-lift tasks can substantially involve hip flexors together with abdominal activity.","Program the card for strict hip-flexion and trunk-control strength, not as a lower-ab isolation promise. Count it with hanging, pulling, grip, hip-flexor, and abdominal work, and substitute when overhead support or grip would obscure the intended stimulus."]},{"sectionKey":"athlete_support","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Long-term development guidance emphasizes individualized, progressive training from current competence and readiness.","Athlete support should show the exact knee angle and range, expected hip-flexor, abdominal, grip, and shoulder effort, the difference between still and swinging repetitions, the safe exit, and clear symptom and grip-slip stop signals without assigning an exercise level."]},{"sectionKey":"coach_support","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Qualified instruction, safe equipment, direct supervision where needed, and gradual progression are central to resistance training.","Coach support should cover anchor and lane checks, mount and step-down, front and side observation, variant naming, range and tempo logging, swing correction, grip and shoulder limits, cumulative fatigue, substitutions, group turnover, and clinical or emergency escalation."]},{"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/12828897/","sourceTitle":"Pelvic and femoral contributions to bilateral hip flexion by subjects suspended from a bar","sourcePublisher":"Clinical Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Knee position and hamstring length changed the pelvic contribution during suspended bilateral hip flexion.","Bent-knee and straight-leg forms therefore need explicit variant annotations. Range, pause, tempo, assistance, grip, and rings can be variants or delivery modifiers; kipping/cyclic, supported captain-chair, rotational, static-hold, and pull-up-combination movements require separate identity decisions."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=dPwg1E_ygjc","title":"How To Do HANGING KNEE RAISES | Exercise Demonstration Video and Guide","channelName":"Live Lean TV Daily Exercises","sourceQuery":"Existing candidate rechecked through public YouTube oEmbed on 2026-07-26: hanging knee raise","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Public oEmbed returned title and channel only. Exact strict bent-knee sequence, still start, pelvic control, mount, exit, safety, claims, captions, and accessibility require human review."},{"url":"https://www.youtube.com/watch?v=p9hhX_Sx5v0","title":"The Hanging Knee Raise | A Tutorial","channelName":"Signum Fitness & Nutrition","sourceQuery":"Existing candidate rechecked through public YouTube oEmbed on 2026-07-26: hanging knee raise tutorial","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate by public metadata only. Exact bent-knee identity, no-kip rule, full range, cue accuracy, safe setup and exit, captions, and complete content require human review."},{"url":"https://www.youtube.com/watch?v=fLbZrF6MZuE","title":"Hanging Leg/Knee Raise Tutorial — Muscles Worked, Benefits, and Form","channelName":"BarBend","sourceQuery":"Existing candidate rechecked through public YouTube oEmbed on 2026-07-26: hanging leg knee raise tutorial","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"The public title spans knee and leg variants, but no exact-match or claim decision is inferred. Full sequence, anatomy claims, safety, variant boundaries, captions, and accessibility require human review."},{"url":"https://www.youtube.com/watch?v=PjlPiVTtWA4","title":"Hanging Leg Raise (HLR) | Olympic Weightlifting Exercise Library","channelName":"Catalyst Athletics","sourceQuery":"Existing candidate rechecked through public YouTube oEmbed on 2026-07-26: hanging straight leg raise exercise","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate for the straight-leg variant by public title only. Knee extension, strict versus swinging mode, range, mount, lowering, exit, safety, captions, and demonstration quality require human review."},{"url":"https://www.youtube.com/watch?v=XykqIceOdso","title":"Eccentric-Accentuated Hanging Leg Raise","channelName":"Hart Athletics","sourceQuery":"Existing candidate rechecked through public YouTube oEmbed on 2026-07-26: hanging leg raise eccentric lowering","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate for eccentric emphasis by public title only. Exact knee angle, start assistance, lowering time, range, swing, safety, dosage, claims, captions, and full sequence require human review."}],"alternateAssessments":[{"name":"Tuck Hanging Knee Raise","classification":"same_identity","rationale":"Tuck and bent-knee hanging knee raise describe the same bilateral strict hip-flexion pattern; the historical source is an exact duplicate rather than a selectable alternate.","distinguishingDimensions":{"kneeAngle":"flexed","identityDifference":"none"}},{"name":"Hanging Straight-Leg Raise","classification":"new_variant","rationale":"Extended knees lengthen the lever, add knee-extension isometric demand, and alter pelvic and hamstring interaction while preserving the same suspended bilateral hip-flexion identity.","distinguishingDimensions":{"kneeAngle":"extended","leverLength":"long"}},{"name":"Hanging Knee Raise Eccentric Lower","classification":"new_variant","rationale":"A declared 4–6 second lowering emphasis changes precision, start assistance, fatigue, dose, and recovery while preserving the bent-knee exercise identity.","distinguishingDimensions":{"contractionEmphasis":"eccentric","loweringSeconds":"4_to_6"}},{"name":"Partial-Range Hanging Knee Raise","classification":"modifier_annotation","rationale":"A smaller owned range changes dose and accessibility without changing support, laterality, knee angle, or the strict hip-flexion identity.","distinguishingDimensions":{"range":"declared_partial"}},{"name":"Pause Hanging Knee Raise","classification":"modifier_annotation","rationale":"A pause at the declared range landmark changes time under tension and quality criteria but not the exercise identity.","distinguishingDimensions":{"pause":"declared_top_or_midrange"}},{"name":"Foot-Assisted Hanging Knee Raise","classification":"new_variant","rationale":"Stable foot contact can unload grip, shoulder, and hip-flexion demand while preserving a declared strict hanging pattern and safe exit.","distinguishingDimensions":{"assistance":"stable_foot_contact"}},{"name":"Ring Hanging Leg Raise","classification":"new_variant","rationale":"Stable rings preserve suspension and bilateral hip flexion while changing grip orientation, implement motion, and station stability.","distinguishingDimensions":{"implement":"stable_rings","gripOrientation":"self_selected_or_declared"}},{"name":"Weighted Hanging Knee Raise","classification":"new_variant","rationale":"Added load changes physical difficulty, attachment, mount, exit, dose, and recovery enough to require an explicit reviewed variant.","distinguishingDimensions":{"externalLoad":"added_weight","attachment":"declared_and_secured"}},{"name":"Unilateral Hanging Knee Raise","classification":"new_variant","rationale":"One-sided hip flexion adds frontal and transverse trunk-control demand and must declare whether the support and other leg remain symmetric.","distinguishingDimensions":{"movingLegLaterality":"unilateral","trunkAntiRotation":"required"}},{"name":"Kipping Hanging Knee Raise","classification":"new_definition","rationale":"Cyclic arch-hollow swing, momentum, timing, repeated shoulder motion, and conditioning intent change the action, fatigue, coaching, and stop rules beyond a strict variant.","distinguishingDimensions":{"swingMode":"cyclic_kip","shoulderAction":"dynamic","intent":"cyclic_skill_or_capacity"}},{"name":"Strict Knees-to-Elbows","classification":"new_variant","rationale":"A higher declared end range with more posterior pelvic rotation and trunk flexion can remain a strict range variant if the movement does not add a kip or pull-up.","distinguishingDimensions":{"rangeLandmark":"knees_to_elbows","swingMode":"strict_none"}},{"name":"Toes-to-Bar","classification":"new_definition","rationale":"Full foot-to-bar range is commonly delivered with cyclic swing and greater shoulder, hamstring, compression, timing, and fatigue demands; it requires its own exact strict-versus-kipping identity review.","distinguishingDimensions":{"rangeLandmark":"feet_to_bar","identityReview":"strict_or_kipping_must_be_declared"}},{"name":"Captain's Chair Knee Raise","classification":"new_definition","rationale":"Forearm and back support replace hand suspension and materially change grip, shoulder, trunk, equipment, access, and failure constraints.","distinguishingDimensions":{"support":"forearm_and_back_supported_station","handSuspension":"none"}},{"name":"Hanging L-Sit","classification":"new_definition","rationale":"A static hip-flexion hold changes contraction mode, dosage, quality endpoints, and fatigue behavior from dynamic repetitions.","distinguishingDimensions":{"contractionMode":"isometric","kneeAngle":"extended"}},{"name":"Hanging Windshield Wiper","classification":"new_definition","rationale":"Large transverse-plane leg and pelvis motion adds rotation, anti-rotation, range, and shoulder-control demands outside the sagittal hanging leg-raise identity.","distinguishingDimensions":{"primaryPlane":"transverse","pelvicAction":"rotation"}},{"name":"Pull-Up With Knee Raise","classification":"new_definition","rationale":"Combining elbow flexion and vertical pulling with hip flexion creates a compound exercise with different sequencing, load, fatigue, and substitutions.","distinguishingDimensions":{"elbowAction":"dynamic_flexion_extension","compoundAction":"vertical_pull_plus_hip_flexion"}},{"name":"Supine Bent-Knee Raise","classification":"new_definition","rationale":"Floor support removes hanging, grip, overhead shoulder, mount, and dismount constraints, making this a useful substitute but not the same exercise.","distinguishingDimensions":{"support":"supine_floor","handSuspension":"none"}}]}$packet$::JSONB),
    ('l-sit','2026-07-26.28',$packet${"evidence":[{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Resistance exercise selection requires qualified instruction, safe equipment and space, appropriate progression, and readiness assessed for the individual rather than inferred from an exercise label.","Before L-Sit, check the support or anchor, hand position, clearance, mount, exit, traffic, symptoms, and fatigue. Stop for pain or pinching; instability; numbness or tingling; dizziness; grip slip; elbow or shoulder collapse; uncontrolled swing; repeated loss of the declared leg shape, height, trunk position, or breathing; or an unsafe exit."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Training should be individualized and progressively developed from current readiness and movement competence.","Scale L-Sit with stable support height or a lower bar, neutral-grip handles, a shorter lever, reduced leg height, shorter holds, more rest, safe assistance, plain-language cues, visual timing, or a supported or supine substitute. Exercise cards use complexity and physical-difficulty scores; athlete and class levels belong to skill-library cards."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The five supplied videos are discovery candidates only. Public oEmbed title and channel metadata were observed on 2026-07-26, but exact variant match, complete setup and exit, cue and claim quality, safety, captions, accessibility, reviewer identity, approval, and continuing availability remain pending human review."]},{"sectionKey":"identity","sourceUrl":"https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf","sourceTitle":"Parallette Training, Part 1","sourcePublisher":"CrossFit Journal","sourceKind":"professional_standard","evidenceQuality":76,"claims":["The professional progression presents tuck, one-leg, full L-sit, and straddle L-sit as a related support sequence, while V-sit and Manna are treated as later, different positions.","Use one support L-sit definition with explicit tuck, one-leg, full, straddle, and ring-support variants. Treat support height, assistance, hold duration, and heel contact as modifiers; treat hanging L-sit, V-sit, and Manna as separate identities."]},{"sectionKey":"taxonomy","sourceUrl":"https://www.gymnastics.sport/site/pages/education/agegroup-mag-manual-e.pdf","sourceTitle":"FIG Age Group Development and Competition Program for Men's Artistic Gymnastics","sourcePublisher":"International Gymnastics Federation","sourceKind":"governing_body","evidenceQuality":88,"claims":["The governing-body program describes L-sit in straight-arm support and separately describes hanging, pulling, and kip sequences.","Classify the card as static straight-arm push support with bilateral hip-flexion compression and trunk control, not as an overhead hanging action."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/9118976/","sourceTitle":"Abdominal and hip flexor muscle activation during various training exercises","sourcePublisher":"European Journal of Applied Physiology and Occupational Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Hip-flexion and bilateral leg-lift tasks can substantially involve hip flexors together with abdominal activity.","This adjacent EMG evidence supports modeling hip flexors as important movers and the abdominal wall as a contributor to pelvic and trunk control. It does not directly quantify the L-sit's shoulder, triceps, wrist, or scapular demands."]},{"sectionKey":"biomechanics","sourceUrl":"https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf","sourceTitle":"Parallette Training, Part 1","sourcePublisher":"CrossFit Journal","sourceKind":"professional_standard","evidenceQuality":76,"claims":["The documented progression changes knee angle and the number of extended legs before the full long-lever position, supporting lever length as a central scaling dimension.","Support height can create clearance without changing the primary support and compression action. Rings retain support but add independent implement instability and require an explicit variant."]},{"sectionKey":"difficulty","sourceUrl":"https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20MAG%20CoP%202025-2028.pdf","sourceTitle":"FIG Men's Artistic Gymnastics Code of Points 2025–2028","sourcePublisher":"International Gymnastics Federation","sourceKind":"governing_body","evidenceQuality":91,"claims":["The governing-body code requires an L-sit or straddle L-sit hold to be shown for a defined duration and distinguishes higher leg positions such as V-sit and Manna.","The source supports treating stable shape and duration as quality requirements, but it does not validate Vortex's numeric scores. Proposed scores are candidate calibration values, with overall derived from exercise complexity and physical difficulty rather than athlete classification."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf","sourceTitle":"Parallette Training, Part 1","sourcePublisher":"CrossFit Journal","sourceKind":"professional_standard","evidenceQuality":76,"claims":["The support progression increases lever demand from tuck through one-leg to full while retaining straight-arm support.","Count support, triceps, shoulder, hand or wrist, hip-flexor, abdominal, and long-lever knee-extension fatigue. Ring support adds grip and stabilization fatigue. No universal recovery interval is established by this source."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Safe resistance training requires qualified instruction, appropriate equipment and space, supervision, and progression matched to readiness.","Require stable support, safe hand position, appropriate clearance, direct supervision where needed, controlled breathing, and a safe exit. Substitute when symptoms or support demands obscure the intended compression stimulus."]},{"sectionKey":"dosage","sourceUrl":"https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20MAG%20CoP%202025-2028.pdf","sourceTitle":"FIG Men's Artistic Gymnastics Code of Points 2025–2028","sourcePublisher":"International Gymnastics Federation","sourceKind":"governing_body","evidenceQuality":91,"claims":["The governing-body standard uses a two-second hold criterion for recognized strength positions.","That performance criterion does not establish a training prescription. Candidate training doses use short repeatable holds, enough rest to preserve shape, and accumulated quality time recorded separately from failed or partial holds."]},{"sectionKey":"instructions","sourceUrl":"https://www.gymnastics.sport/site/pages/education/agegroup-mag-manual-e.pdf","sourceTitle":"FIG Age Group Development and Competition Program for Men's Artistic Gymnastics","sourcePublisher":"International Gymnastics Federation","sourceKind":"governing_body","evidenceQuality":88,"claims":["The governing-body program depicts L-sit in support with legs held horizontally and straight-arm support requirements.","Instructions should declare support, knee angle, leg position, height, time, breathing, and exit rather than using the name alone as the movement standard."]},{"sectionKey":"programming","sourceUrl":"https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf","sourceTitle":"Parallette Training, Part 1","sourcePublisher":"CrossFit Journal","sourceKind":"professional_standard","evidenceQuality":76,"claims":["The progression places shorter-lever holds before the full L-sit and shows straddle and higher positions as deliberate progressions.","Program short-lever support first, progress one controlled dimension at a time, and preserve adequate support, compression, and breathing reserve. Do not use an athlete level as an exercise dose."]},{"sectionKey":"athlete_support","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Long-term development guidance emphasizes individualized, progressive training from current competence and readiness.","Athlete support should show the exact support, leg shape and height, expected hand, arm, shoulder, hip, abdominal, and quadriceps effort, breathing, the safe exit, and clear symptom stop signals."]},{"sectionKey":"coach_support","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Qualified instruction, safe equipment, direct supervision where needed, and gradual progression are central to resistance training.","Coach support should cover support and lane checks, front and side observation, variant naming, hold and rest logging, lever changes, wrist options, cumulative pressing and compression fatigue, substitutions, group turnover, and clinical or emergency escalation."]},{"sectionKey":"alternates","sourceUrl":"https://library.crossfit.com/premium/pdf/42_06_Parallettes_Pt1.pdf","sourceTitle":"Parallette Training, Part 1","sourcePublisher":"CrossFit Journal","sourceKind":"professional_standard","evidenceQuality":76,"claims":["Tuck, one-leg, full, and straddle positions are presented within a parallette support progression, while V-sit and Manna are later distinct positions.","Classify knee angle, one-leg asymmetry, straddle, and ring stability as explicit variants; support height, heel taps, and assistance as modifiers; and hanging support, V-sit, Manna, and dynamic compression lifts as separate identity reviews."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=H_iZG5-L_KI","title":"L-SIT TUTORIAL | Step-by-Step Progressions to Master the Perfect L-Sit","channelName":"Simonster Strength","sourceQuery":"Public YouTube oEmbed observed 2026-07-26: L-sit tutorial progressions","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate by public metadata only. Exact support variants, setup, wrist options, hold standard, safety, dosage, claims, captions, accessibility, and full sequence require human review."},{"url":"https://www.youtube.com/watch?v=IUZJoSP66HI","title":"Floor L-sit Progression Tutorial by Antranik","channelName":"Antranik Kizirian","sourceQuery":"Public YouTube oEmbed observed 2026-07-26: floor L-sit progression","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate by public metadata only. Exact floor support, leverage progressions, cue accuracy, safety, captions, accessibility, and complete demonstration require human review."},{"url":"https://www.youtube.com/watch?v=eywCpp0p7lg","title":"The Perfect L-Sit Tutorial - Beginner Friendly","channelName":"STRIQfit","sourceQuery":"Public YouTube oEmbed observed 2026-07-26: beginner L-sit tutorial","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate by public metadata only. Beginner wording is not a Vortex athlete classification. Exact variants, safe support and exit, claims, captions, and accessibility require human review."},{"url":"https://www.youtube.com/watch?v=jceq8cCj1z8","title":"L - Sit Tutorial: Complete from Beginner to Advanced!!","channelName":"Sid Paulson","sourceQuery":"Public YouTube oEmbed observed 2026-07-26: L-sit complete tutorial","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate by public metadata only. Title language does not map to exercise-card levels. Exact movement variants, safety, claims, captions, accessibility, and completeness require human review."},{"url":"https://www.youtube.com/watch?v=r-LQKNxGJB0","title":"L-Sit Tutorial On Floor, Bar And Parallel Bars (6 Step-by-Step Guide)","channelName":"Gymless Fitness","sourceQuery":"Public YouTube oEmbed observed 2026-07-26: L-sit floor bar parallel bars","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate by public metadata only. Support implement boundaries, exact shapes, setup, safe exit, claims, captions, accessibility, and full content require human review."}],"alternateAssessments":[{"name":"Tuck L-Sit Hold","classification":"new_variant","rationale":"Knee flexion shortens the lever while preserving static straight-arm support compression, so the historical card is consolidated as the tuck variant.","distinguishingDimensions":{"kneeAngle":"flexed","leverLength":"short"}},{"name":"One-Leg L-Sit","classification":"new_variant","rationale":"One extended and one flexed knee create a mixed asymmetric lever while preserving the support L-sit identity.","distinguishingDimensions":{"kneeAngle":"mixed","laterality":"asymmetric_alternating"}},{"name":"Straddle L-Sit","classification":"new_variant","rationale":"Straddle changes hip-abduction range, flexibility interaction, symmetry, and spatial control while preserving static straight-arm support compression.","distinguishingDimensions":{"legPosition":"straddle","hipAbduction":"declared_owned_range"}},{"name":"Ring-Support L-Sit","classification":"new_variant","rationale":"Rings preserve straight-arm support compression but materially add independent implement stability, grip, supervision, mount, and exit demands.","distinguishingDimensions":{"implement":"rings","supportStability":"unstable_independent"}},{"name":"Heel-Tap L-Sit","classification":"modifier_annotation","rationale":"Brief declared heel contact reduces the supported lever without changing the primary support action or intended isometric hold.","distinguishingDimensions":{"assistance":"heel_contact","contactTiming":"declared"}},{"name":"Foot-Assisted L-Sit","classification":"modifier_annotation","rationale":"Stable foot assistance changes load and dosage while preserving straight-arm support compression.","distinguishingDimensions":{"assistance":"stable_foot_support","loadReduction":"declared"}},{"name":"Elevated-Support L-Sit","classification":"modifier_annotation","rationale":"Raising stable supports changes clearance and wrist position without changing the exercise identity when support action and leg standard remain the same.","distinguishingDimensions":{"supportHeight":"elevated","clearance":"increased"}},{"name":"Hanging L-Sit","classification":"new_definition","rationale":"Overhead suspension replaces straight-arm push support and changes grip, shoulder position, anchor, mount, clearance, fatigue, and exit demands.","distinguishingDimensions":{"supportAction":"overhead_suspension","grip":"required"}},{"name":"V-Sit","classification":"new_definition","rationale":"A substantially higher leg position changes shoulder-to-trunk relationship, compression range, flexibility, balance, and principal training demand.","distinguishingDimensions":{"legHeight":"above_horizontal","identityBoundary":"higher_compression_position"}},{"name":"Manna","classification":"new_definition","rationale":"Manna requires an extreme high-leg and shoulder relationship beyond an L-sit lever progression and needs its own anatomy, difficulty, safety, and dosage review.","distinguishingDimensions":{"legHeight":"extreme_above_horizontal","shoulderRelationship":"materially_changed"}},{"name":"Seated Compression Lift","classification":"new_definition","rationale":"The athlete remains seated and dynamically lifts the legs without suspending bodyweight through straight arms, changing support action and movement intent.","distinguishingDimensions":{"supportAction":"seated_grounded","contractionMode":"dynamic_leg_lift"}}]}$packet$::JSONB),
    ('hanging-l-sit','2026-07-26.28',$packet${"evidence":[{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Resistance exercise selection requires qualified instruction, safe equipment and space, appropriate progression, and readiness assessed for the individual rather than inferred from an exercise label.","Before Hanging L-Sit, check the support or anchor, hand position, clearance, mount, exit, traffic, symptoms, and fatigue. Stop for pain or pinching; instability; numbness or tingling; dizziness; grip slip; elbow or shoulder collapse; uncontrolled swing; repeated loss of the declared leg shape, height, trunk position, or breathing; or an unsafe exit."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Training should be individualized and progressively developed from current readiness and movement competence.","Scale Hanging L-Sit with stable support height or a lower bar, neutral-grip handles, a shorter lever, reduced leg height, shorter holds, more rest, safe assistance, plain-language cues, visual timing, or a supported or supine substitute. Exercise cards use complexity and physical-difficulty scores; athlete and class levels belong to skill-library cards."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The five supplied videos are discovery candidates only. Public oEmbed title and channel metadata were observed on 2026-07-26, but exact variant match, complete setup and exit, cue and claim quality, safety, captions, accessibility, reviewer identity, approval, and continuing availability remain pending human review."]},{"sectionKey":"identity","sourceUrl":"https://www.crossfit.com/essentials/the-hanging-l-sit","sourceTitle":"The Hanging L-Sit","sourcePublisher":"CrossFit","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["The official instructional page identifies the hanging L-sit as a named static hanging exercise.","Treat the two-hand static hanging hold as its own definition. Knee angle and mixed-leg versions are variants; support L-sit and dynamic hanging leg raises change support action or contraction intent and remain separate identities."]},{"sectionKey":"taxonomy","sourceUrl":"https://www.gymnastics.sport/site/pages/education/agegroup-mag-manual-e.pdf","sourceTitle":"FIG Age Group Development and Competition Program for Men's Artistic Gymnastics","sourcePublisher":"International Gymnastics Federation","sourceKind":"governing_body","evidenceQuality":88,"claims":["The governing-body program distinguishes support strength positions from hang, pull, and kip sequences.","Classify this card as static overhead suspension with bilateral hip-flexion compression, grip, and trunk control, not as straight-arm push support."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/9118976/","sourceTitle":"Abdominal and hip flexor muscle activation during various training exercises","sourcePublisher":"European Journal of Applied Physiology and Occupational Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Hip-flexion and bilateral leg-lift tasks can substantially involve hip flexors together with abdominal activity.","This adjacent evidence supports hip flexors as important contributors and the abdominal wall as a pelvic and trunk controller, but does not directly quantify static hanging grip or shoulder demand."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/12828897/","sourceTitle":"Pelvic and femoral contributions to bilateral hip flexion by subjects suspended from a bar","sourcePublisher":"Clinical Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["A study of participants suspended by both hands found that pelvic and femoral contributions to bilateral hip flexion varied with knee position and hamstring length.","The task in that study was dynamic rather than a static L-sit, so it is adjacent evidence only. It supports declaring knee angle, leg height, pelvic control, and individual range rather than assuming one universal position."]},{"sectionKey":"difficulty","sourceUrl":"https://www.crossfit.com/essentials/the-hanging-l-sit","sourceTitle":"The Hanging L-Sit","sourcePublisher":"CrossFit","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["The official instruction presents a hanging hold requiring sustained grip, suspension, and leg position.","The source supports the exercise's combined hanging and compression demands but does not validate Vortex's numeric scores. Overall is derived from exercise complexity and physical difficulty and is not an athlete classification."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/12828897/","sourceTitle":"Pelvic and femoral contributions to bilateral hip flexion by subjects suspended from a bar","sourcePublisher":"Clinical Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Knee position and hamstring length affect pelvic and femoral contributions during suspended bilateral hip flexion.","Count grip, overhead position, hip-flexor, trunk, pelvic, and long-lever knee-extension fatigue. This study does not establish recovery hours for a static hanging L-sit, so all recovery values remain candidate calibration."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Safe resistance training requires qualified instruction, appropriate equipment and space, supervision, and progression matched to readiness.","Require a rated anchor, safe mount, secure grip, tolerated overhead position, clearance, stillness, and safe step-down. Substitute when symptoms, grip, shoulder position, or equipment obscure the intended stimulus."]},{"sectionKey":"dosage","sourceUrl":"https://www.crossfit.com/essentials/the-hanging-l-sit","sourceTitle":"The Hanging L-Sit","sourcePublisher":"CrossFit","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["The official instruction demonstrates the movement but does not establish one universal training dose.","Use short repeatable holds and enough rest to preserve grip, shoulder position, stillness, leg shape, breathing, and exit. Accumulated clean time should exclude swinging, shortened, or failed holds."]},{"sectionKey":"instructions","sourceUrl":"https://www.crossfit.com/essentials/the-hanging-l-sit","sourceTitle":"The Hanging L-Sit","sourcePublisher":"CrossFit","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["The official instruction provides a direct demonstration of the hanging L-sit.","Vortex instructions must additionally declare the anchor, mount, grip, knee angle, leg height, still-start rule, breathing, hold time, and safe exit so the name alone is not treated as a complete standard."]},{"sectionKey":"programming","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Long-term development guidance emphasizes progressive training from current readiness and movement competence.","Program a shorter lever before a longer lever, preserve grip and shoulder reserve, count all hanging and pulling fatigue, and substitute when the hanging constraint is not the intended stimulus."]},{"sectionKey":"athlete_support","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Long-term development guidance emphasizes individualized, progressive training from current competence and readiness.","Athlete support should show anchor and mount checks, the exact knee angle and leg height, expected grip, shoulder, hip, abdominal, and quadriceps effort, the still-body standard, safe exit, and clear symptom and grip-slip stop signals."]},{"sectionKey":"coach_support","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Qualified instruction, safe equipment, direct supervision where needed, and gradual progression are central to resistance training.","Coach support should cover anchor and lane checks, mount and step-down, front and side observation, variant naming, hold and rest logging, swing correction, cumulative grip and hanging fatigue, substitutions, group turnover, and clinical or emergency escalation."]},{"sectionKey":"alternates","sourceUrl":"https://www.crossfit.com/essentials/the-hanging-l-sit","sourceTitle":"The Hanging L-Sit","sourcePublisher":"CrossFit","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["The official source identifies a distinct hanging L-sit exercise.","Classify tuck and one-leg levers as variants; foot assistance, reduced height, grip, and hold time as modifiers; and support L-sit, dynamic hanging leg raise, one-arm hanging, and swinging or cyclic versions as separate identity reviews."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=WHi1bvZLwlw","title":"The Hanging L-Sit","channelName":"CrossFit","sourceQuery":"Official CrossFit page embedded video discovered and public YouTube oEmbed observed 2026-07-26","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Official source candidate, but exact full sequence, setup, safe exit, claims, captions, accessibility, and continuing embedding require human review."},{"url":"https://www.youtube.com/watch?v=784YzIaJSJg","title":"How to Perform a Hanging L-Sit - Exercise Tutorial","channelName":"Be a Game Character","sourceQuery":"Public YouTube oEmbed observed 2026-07-26: hanging L-sit exercise tutorial","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate by public metadata only. Exact static hold, anchor, mount, grip, no-swing rule, exit, safety, captions, accessibility, and claims require human review."},{"url":"https://www.youtube.com/watch?v=U5q6xbZ74Hw","title":"Hanging L-Sit Tutorial","channelName":"Flexibility Maestro","sourceQuery":"Public YouTube oEmbed observed 2026-07-26: hanging L-sit tutorial","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate by public metadata only. Exact identity, knee-angle variants, stillness, setup and exit, safety, claims, captions, and accessibility require human review."},{"url":"https://www.youtube.com/watch?v=zTNEqU6pWuE","title":"Hanging L-Sit technique #technique #crossfit #coaching","channelName":"More Than Muscle | Training and Nutrition","sourceQuery":"Public YouTube oEmbed observed 2026-07-26: hanging L-sit technique coaching","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Short-form candidate by public metadata only. Complete setup, hold, exit, safety, cue context, captions, accessibility, and claim review are especially important."},{"url":"https://www.youtube.com/watch?v=TWpGkp1TvG0","title":"Hanging L Sit","channelName":"CoreFit inc.","sourceQuery":"Public YouTube oEmbed observed 2026-07-26: hanging L sit","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate by public metadata only. Exact static identity, setup, mount and exit, safety, technique, claims, captions, accessibility, and full sequence require human review."}],"alternateAssessments":[{"name":"Tuck Hanging L-Sit","classification":"new_variant","rationale":"Knee flexion shortens the lever while preserving the static two-hand overhead hanging identity.","distinguishingDimensions":{"kneeAngle":"flexed","leverLength":"short"}},{"name":"One-Leg Hanging L-Sit","classification":"new_variant","rationale":"One extended and one flexed knee create a mixed asymmetric lever while preserving the static two-hand overhead hanging identity.","distinguishingDimensions":{"kneeAngle":"mixed","laterality":"asymmetric_alternating"}},{"name":"Foot-Assisted Hanging L-Sit","classification":"modifier_annotation","rationale":"Stable foot assistance changes suspension load, range, and dosage without changing the intended static hanging compression hold.","distinguishingDimensions":{"assistance":"stable_foot_contact","loadReduction":"declared"}},{"name":"Weighted Hanging L-Sit","classification":"modifier_annotation","rationale":"Secure added resistance changes load, attachment, mount, exit, fatigue, and recovery but preserves the static two-hand hanging identity; it remains quarantined pending calibration.","distinguishingDimensions":{"externalLoad":"added","attachment":"secure_and_reviewed"}},{"name":"Support L-Sit","classification":"new_definition","rationale":"Straight-arm push support replaces overhead suspension and changes hand loading, shoulder relationship, grip demand, equipment, and exit.","distinguishingDimensions":{"supportAction":"straight_arm_push_support","grip":"not_overhead_suspension"}},{"name":"Hanging Leg Raise","classification":"new_definition","rationale":"Repeated hip flexion and lowering change contraction mode, time course, range, fatigue, measurement, and intent from a static hold.","distinguishingDimensions":{"contractionMode":"dynamic_concentric_and_eccentric","intent":"repeated_raise_and_lower"}},{"name":"Kipping Hanging L-Sit","classification":"new_definition","rationale":"Cyclic shoulder and trunk swing changes movement pattern, momentum, impact, fatigue, timing, and training stimulus beyond the strict static identity.","distinguishingDimensions":{"swingMode":"cyclic_kipping","movementPattern":"dynamic"}},{"name":"One-Arm Hanging L-Sit","classification":"new_definition","rationale":"Single-arm suspension materially changes laterality, grip, shoulder load, anti-rotation demand, failure consequence, and supervision.","distinguishingDimensions":{"supportLaterality":"unilateral","primaryLoadDistribution":"single_arm"}}]}$packet$::JSONB);

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,evidence.item->>'sectionKey',
    evidence.item->>'sourceUrl',evidence.item->>'sourceTitle',
    evidence.item->>'sourcePublisher',evidence.item->>'sourceKind',
    evidence.item->'claims',(evidence.item->>'evidenceQuality')::SMALLINT,
    'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'evidence') evidence(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT definition.id,NULL,definition.card_version,media.item->>'url',
    'https://www.youtube-nocookie.com/embed/'||substring(media.item->>'url' FROM 'v=([^&]+)'),
    substring(media.item->>'url' FROM 'v=([^&]+)'),
    media.item->>'title',media.item->>'channelName',NULL,'en',NULL,FALSE,NULL,NULL,
    'unverified','candidate','manual_research',media.item->>'sourceQuery',
    NULL,NULL,NULL,media.item->>'notes'
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'mediaCandidates') media(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,video_id)
  DO UPDATE SET variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=FALSE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='unverified',review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=NULL,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,alternate.item->>'name',
    alternate.item->>'classification',alternate.item->>'rationale',
    alternate.item->'distinguishingDimensions',NULL,'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'alternateAssessments') alternate(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name)
  DO UPDATE SET classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,proposed_card_json=NULL,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  CREATE TEMP TABLE family_relationship_seed(
    from_slug TEXT NOT NULL,from_variant_key TEXT NOT NULL,
    to_slug TEXT NOT NULL,to_variant_key TEXT NOT NULL,
    relationship TEXT NOT NULL,similarity_score SMALLINT NOT NULL,
    dimensions TEXT[] NOT NULL,reason TEXT NOT NULL,conditions_json JSONB NOT NULL,
    PRIMARY KEY(from_slug,from_variant_key,to_slug,to_variant_key,relationship)
  ) ON COMMIT DROP;
  INSERT INTO family_relationship_seed VALUES
    ('l-sit','tuck','l-sit','one-leg','progression',90,ARRAY['leverage','complexity']::TEXT[],
      'One extended leg lengthens the lever while retaining the support L-sit identity.',
      jsonb_build_object('requires',jsonb_build_array('repeatable_tuck_hold','both_sides_tolerated'),'authoredDirection',TRUE)),
    ('l-sit','one-leg','l-sit','baseline','progression',92,ARRAY['leverage','complexity']::TEXT[],
      'Extending both knees produces the full bilateral support L-sit lever.',
      jsonb_build_object('requires',jsonb_build_array('repeatable_one_leg_hold_each_side','straight_knee_range'),'authoredDirection',TRUE)),
    ('l-sit','baseline','l-sit','straddle','lateral_substitution',82,ARRAY['range','complexity']::TEXT[],
      'Straddle changes frontal-plane hip position and flexibility demand while preserving static straight-arm support compression.',
      jsonb_build_object('requires',jsonb_build_array('pain_free_straddle_range','symmetric_leg_height'),'authoredDirection',TRUE)),
    ('l-sit','baseline','l-sit','ring-support','progression',78,ARRAY['stability','complexity','fatigue']::TEXT[],
      'Rings retain the support L-sit action but materially increase stability, grip, supervision, and exit demands.',
      jsonb_build_object('requires',jsonb_build_array('stable_ring_support','safe_mount_and_exit','direct_supervision'),'authoredDirection',TRUE)),
    ('hanging-l-sit','tuck','hanging-l-sit','one-leg','progression',89,ARRAY['leverage','complexity']::TEXT[],
      'One extended leg lengthens the lever while retaining the static hanging L-sit identity.',
      jsonb_build_object('requires',jsonb_build_array('still_tuck_hold','both_sides_tolerated'),'authoredDirection',TRUE)),
    ('hanging-l-sit','one-leg','hanging-l-sit','baseline','progression',92,ARRAY['leverage','complexity']::TEXT[],
      'Extending both knees produces the full bilateral hanging L-sit lever.',
      jsonb_build_object('requires',jsonb_build_array('one_leg_hold_each_side','straight_knee_range','grip_reserve'),'authoredDirection',TRUE)),
    ('hanging-leg-raise','baseline','hanging-leg-raise','straight-leg','progression',90,ARRAY['leverage','range','complexity']::TEXT[],
      'Extending both knees lengthens the lever and increases knee-extension, hamstring-range, pelvic-control, and physical demand while preserving strict suspended bilateral hip flexion.',
      jsonb_build_object('requires',jsonb_build_array('repeatable_strict_bent_knee_repetitions','owned_straight_knee_range','safe_grip_and_exit'),'authoredDirection',TRUE)),
    ('hanging-leg-raise','baseline','hanging-leg-raise','bent-knee-eccentric-lower','lateral_substitution',84,ARRAY['contraction','tempo','fatigue']::TEXT[],
      'Timed eccentric lowering preserves the strict bent-knee identity while changing contraction emphasis, assistance, dose, recovery, and measurement.',
      jsonb_build_object('selectedIntent','controlled_eccentric_exposure','requires',jsonb_build_array('safe_start_assistance','four_to_six_second_lower','recovery_monitoring'),'authoredDirection',TRUE)),
    ('hanging-leg-raise','baseline','hanging-l-sit','baseline','lateral_substitution',64,ARRAY['contraction','duration','fatigue']::TEXT[],
      'Both use overhead suspension and bilateral hip-flexion compression, but dynamic repetitions and a static hold are substitutes only when the selected intent permits the contraction-mode change.',
      jsonb_build_object('selectedIntent','hanging_compression_not_exact_contraction_mode','requires',jsonb_build_array('secure_grip','tolerated_overhead_hang','owned_full_lever'),'authoredDirection',TRUE)),
    ('l-sit','baseline','hanging-l-sit','baseline','lateral_substitution',60,ARRAY['support','grip','equipment']::TEXT[],
      'Both are static long-lever compression holds, but push support and overhead suspension are substitutes only when the selected intent permits different hand, shoulder, grip, equipment, mount, and exit demands.',
      jsonb_build_object('selectedIntent','static_compression_not_exact_support_action','requires',jsonb_build_array('safe_selected_support','owned_full_lever','controlled_exit'),'authoredDirection',TRUE));

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT from_variant.id,to_variant.id,seed.relationship,seed.similarity_score,
    seed.dimensions,seed.reason,seed.conditions_json,'review',NULL,NULL,NULL
  FROM family_relationship_seed seed
  JOIN coaching.exercise_definition_v1 from_definition
    ON from_definition.facility_id=1 AND from_definition.slug=seed.from_slug AND from_definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id=from_definition.id AND from_variant.variant_key=seed.from_variant_key AND from_variant.status<>'archived'
  JOIN coaching.exercise_definition_v1 to_definition
    ON to_definition.facility_id=1 AND to_definition.slug=seed.to_slug AND to_definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id=to_definition.id AND to_variant.variant_key=seed.to_variant_key AND to_variant.status<>'archived'
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,review_status='review',
    created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT relationship.to_variant_id,relationship.from_variant_id,
    CASE relationship.relationship WHEN 'progression' THEN 'regression' ELSE relationship.relationship END,
    relationship.similarity_score,relationship.dimensions,
    'Inverse review candidate of the authored '||relationship.relationship||': '||relationship.reason,
    (coalesce(relationship.conditions_json,'{}'::JSONB)-'authoredDirection')||jsonb_build_object(
      'inverseOfRelationship',relationship.relationship,'humanReviewRequired',TRUE),
    'review',NULL,NULL,NULL
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 from_variant ON from_variant.id=relationship.from_variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=from_variant.definition_id
  WHERE definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND relationship.relationship IN('progression','lateral_substitution')
    AND relationship.review_status='review'
    AND NOT(coalesce(relationship.conditions_json,'{}'::JSONB)?'inverseOfRelationship')
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,review_status='review',
    created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.dimension,
    CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END,
    CASE WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=30 THEN 20
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=50 THEN 40
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=70 THEN 60 ELSE 80 END,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN 'Candidate exercise-complexity anchor reflects dynamic versus static action, support geometry, lever and leg shape, range, implement stability, tempo, mount, exit, and supervision; independent comparison is pending.'
      ELSE 'Candidate physical-difficulty anchor reflects bodyweight support or suspension, lever length, grip, overhead or push support, compression, knee extension, hold or repetition demand, controlled lowering, and safe exit; independent comparison is pending.' END,
    'review',1,NULL,NULL,'Candidate migration-410 anchor; independent human review required.',NULL
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  CROSS JOIN(VALUES('technicalComplexity'),('absoluteLoadDemand')) AS dimension(dimension)
  WHERE definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND definition.status<>'archived' AND variant.status<>'archived'
    AND variant.difficulty_json?'technicalComplexity'
    AND variant.difficulty_json?'absoluteLoadDemand'
  ON CONFLICT(facility_id,variant_id,dimension,version)
  DO UPDATE SET proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_score_calibration_v1.status='review';

  CREATE TEMP TABLE family_score_seed(
    exercise_id BIGINT PRIMARY KEY,complexity SMALLINT NOT NULL,physical SMALLINT NOT NULL,
    coordination SMALLINT NOT NULL,impact SMALLINT NOT NULL,supervision SMALLINT NOT NULL,
    confidence SMALLINT NOT NULL,notes TEXT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_score_seed VALUES
    (603,58,68,58,1,45,76,'Candidate L-Sit baseline score; human calibration review required.'),
    (804,42,48,44,1,45,76,'Candidate Tuck L-Sit source score; human calibration review required.'),
    (604,42,62,46,1,55,72,'Candidate Hanging Leg Raise bent-knee baseline score; human calibration review required.'),
    (605,48,72,52,1,55,72,'Candidate Hanging Straight-Leg Raise score; human calibration review required.'),
    (778,48,58,50,1,55,68,'Candidate Hanging Knee Raise eccentric-lower score; human calibration review required.'),
    (819,42,62,46,1,55,72,'Archived duplicate Tuck Hanging Knee Raise score retained with the baseline; human calibration review required.');
  INSERT INTO family_score_seed
  SELECT definition.legacy_exercise_id,50,68,54,1,62,68,
    'Candidate Hanging L-Sit baseline score; human calibration review required.'
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug='hanging-l-sit' AND definition.status<>'archived'
  ON CONFLICT(exercise_id) DO NOTHING;

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity=seed.complexity,absolute_load_demand=seed.physical,
    coordination_demand=seed.coordination,impact=seed.impact,
    supervision_demand=seed.supervision,
    base_overall_difficulty=greatest(seed.complexity,seed.physical),
    legacy_scores=coalesce(score.legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,
      'researchBatches',jsonb_build_array('hanging-leg-raise-family-v1','l-sit-support-and-hanging-family-v1'),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'candidateOnly',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=seed.confidence,human_review_status='queued',
    reviewed_by=NULL,reviewed_at=NULL,review_notes=seed.notes,updated_at=now()
  FROM family_score_seed seed
  WHERE score.exercise_id=seed.exercise_id AND score.human_review_status='queued'
    AND score.reviewed_by IS NULL AND score.reviewed_at IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,definition.facility_id,definition.card_version,definition.schema_version,
    migration_key,'quarantined',jsonb_build_object(
      'stableIdentityAndAliases',TRUE,
      'supportActionAndContractionBoundariesPresent',TRUE,
      'legacyMappingsPresent',TRUE,
      'taxonomyAnatomyPlanesLateralityPresent',TRUE,
      'difficultyOnlyModelPresent',TRUE,
      'exerciseSkillClassificationAbsent',TRUE,
      'loadFatigueRecoveryPresent',TRUE,
      'equipmentEnvironmentPopulationPresent',TRUE,
      'deliveryDosageInstructionsAndStopRulesPresent',TRUE,
      'athleteCoachAndOperationsSupportPresent',TRUE,
      'candidateEvidenceSectionsPresent',TRUE,
      'fiveMediaCandidatesPresent',TRUE,
      'alternateAssessmentsPresent',TRUE,
      'progressionRegressionAndSubstitutionProposalsPresent',TRUE,
      'complexityAndPhysicalCalibrationProposalsPresent',TRUE,
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
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND definition.status<>'archived'
  ON CONFLICT(definition_id)
  DO UPDATE SET facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_identity_resolution_v1 identity
  JOIN coaching.exercise_definition_v1 survivor ON survivor.id=identity.survivor_definition_id
  JOIN coaching.exercise_definition_v1 resolved ON resolved.id=identity.resolved_definition_id
  WHERE identity.decision='distinct_exercises' AND identity.reviewed_by IS NULL
    AND ((survivor.slug='l-sit' AND resolved.slug='hanging-l-sit')
      OR (survivor.slug='hanging-leg-raise' AND resolved.slug='hanging-l-sit')
      OR (survivor.slug='l-sit' AND resolved.slug='hanging-leg-raise'));
  IF actual_count<>3 THEN RAISE EXCEPTION '% did not create all 3 Hanging Leg Raise/L-Sit identity boundaries; found %',migration_key,actual_count; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_section_evidence_v1 evidence
    ON evidence.definition_id=definition.id AND evidence.reviewed_card_version=definition.card_version
  WHERE definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND evidence.review_status='candidate';
  IF actual_count<>48 THEN RAISE EXCEPTION '% did not create all 48 candidate evidence rows; found %',migration_key,actual_count; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_media_candidate_v1 media
    ON media.definition_id=definition.id AND media.reviewed_card_version=definition.card_version
  WHERE definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND media.review_status='candidate' AND media.link_status='unverified'
    AND media.embedding_allowed=FALSE AND media.exact_variant_match IS NULL
    AND media.demonstration_quality_score IS NULL
    AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL;
  IF actual_count<>15 THEN RAISE EXCEPTION '% did not create all 15 unverified, non-embeddable media candidates; found %',migration_key,actual_count; END IF;
  IF EXISTS(
    SELECT 1 FROM(
      SELECT definition.slug,count(*) count
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_candidate_v1 media
        ON media.definition_id=definition.id AND media.reviewed_card_version=definition.card_version
      WHERE definition.facility_id=1
        AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
        AND media.review_status='candidate'
      GROUP BY definition.slug
    ) counts WHERE counts.count<>5
  ) THEN RAISE EXCEPTION '% requires exactly 5 current media candidates per definition',migration_key; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_alternate_assessment_v1 alternate
    ON alternate.definition_id=definition.id AND alternate.reviewed_card_version=definition.card_version
  WHERE definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND alternate.review_status='candidate';
  IF actual_count<>36 THEN RAISE EXCEPTION '% did not create all 36 candidate alternate assessments; found %',migration_key,actual_count; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 from_variant ON from_variant.id=relationship.from_variant_id
  JOIN coaching.exercise_variant_v1 to_variant ON to_variant.id=relationship.to_variant_id
  WHERE (
      from_variant.definition_id IN(
        SELECT id FROM coaching.exercise_definition_v1
        WHERE facility_id=1 AND slug IN ('hanging-leg-raise','l-sit','hanging-l-sit'))
      OR to_variant.definition_id IN(
        SELECT id FROM coaching.exercise_definition_v1
        WHERE facility_id=1 AND slug IN ('hanging-leg-raise','l-sit','hanging-l-sit'))
    )
    AND relationship.review_status='review'
    AND relationship.reviewed_by IS NULL AND relationship.reviewed_at IS NULL;
  IF actual_count<>24 THEN RAISE EXCEPTION '% did not preserve 9 graph proposals, add 4 authored proposals, and create 11 inverse proposals; found %',migration_key,actual_count; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_score_calibration_v1 calibration
  JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND variant.status<>'archived' AND calibration.status='review'
    AND calibration.dimension IN('technicalComplexity','absoluteLoadDemand')
    AND calibration.reviewed_by IS NULL AND calibration.reviewed_at IS NULL;
  IF actual_count<>22 THEN RAISE EXCEPTION '% did not create all 22 review-only calibration rows; found %',migration_key,actual_count; END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    WHERE definition.facility_id=1
      AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
      AND variant.status<>'archived'
      AND ((variant.difficulty_json->>'baseOverallDifficulty')::SMALLINT
        <>greatest((variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT)
        OR (variant.programming_profile_json->>'overallDifficulty')::SMALLINT
        <>greatest((variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT))
  ) THEN RAISE EXCEPTION '% found a variant whose overall is not max(complexity, physical difficulty)',migration_key; END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_card_test_packet_v1 packet
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=packet.definition_id AND definition.card_version=packet.card_version
  WHERE definition.facility_id=1
    AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
    AND packet.audit_version=migration_key AND packet.status='quarantined'
    AND packet.human_review_required=TRUE;
  IF actual_count<>3 THEN RAISE EXCEPTION '% did not create all 3 quarantined card test packets; found %',migration_key,actual_count; END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1
      AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
      AND coaching.exercise_json_has_level_classification(jsonb_build_array(
        definition.provenance_json,definition.environment_json,definition.population_json,
        definition.anatomy_json,definition.athlete_support_json,
        definition.coach_support_json,definition.support_operations_json))
  ) THEN RAISE EXCEPTION '% found forbidden exercise skill/proficiency classification',migration_key; END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    LEFT JOIN coaching.exercise_card_review_v1 card_review ON card_review.definition_id=definition.id
    LEFT JOIN coaching.exercise_media_review_v1 media_review ON media_review.definition_id=definition.id
    WHERE definition.facility_id=1
      AND definition.slug IN ('hanging-leg-raise','l-sit','hanging-l-sit')
      AND (definition.status='published' OR definition.approved_video_url IS NOT NULL
        OR definition.reviewed_by IS NOT NULL OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR card_review.id IS NOT NULL OR media_review.id IS NOT NULL)
  ) THEN RAISE EXCEPTION '% created or retained a forbidden approval on the completed candidate cards',migration_key; END IF;
END;
$$;
