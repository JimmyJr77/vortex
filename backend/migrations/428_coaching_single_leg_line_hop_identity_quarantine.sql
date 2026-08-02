-- Retire the non-executable Single-Leg Line Hop and Stick source without
-- guessing which of six exact active identities it intended.
--
-- Legacy source 270 contradicts its named stick by permitting immediate
-- reacceleration and omits line direction, crossing, takeoff and landing leg,
-- contact count, approach, exit, and repetition boundary. Its stable source
-- mapping and three adjacent media candidates remain traceable. No identity,
-- media, score, relationship, card, or publication approval is created.
-- Exercise skill/proficiency belongs only to coaching.skill; an undefined
-- exercise receives no complexity or physical-difficulty score.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '428_coaching_single_leg_line_hop_identity_quarantine';
  target_slug CONSTANT TEXT := 'single-leg-line-hop-and-stick';
  target_legacy_id CONSTANT BIGINT := 270;
  target_id UUID;
  target_variant_id UUID;
  already_applied_count INTEGER;
  protected_count INTEGER;
  actual_count INTEGER;
BEGIN
  SELECT id INTO target_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=target_slug;

  SELECT id INTO target_variant_id
  FROM coaching.exercise_variant_v1
  WHERE definition_id=target_id AND variant_key='baseline';

  IF target_id IS NULL OR target_variant_id IS NULL THEN
    RAISE EXCEPTION '% requires the canonical definition and baseline variant',
      migration_key;
  END IF;

  IF NOT EXISTS(
    SELECT 1
    FROM coaching.exercise_definition_source_v1 source
    WHERE source.definition_id=target_id
      AND source.legacy_exercise_id=target_legacy_id
  ) THEN
    RAISE EXCEPTION '% requires preserved legacy source 270 lineage',
      migration_key;
  END IF;

  SELECT count(*) INTO already_applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=target_id
    AND definition.provenance_json->>'identityRetirementMigration'=migration_key;

  IF already_applied_count NOT IN(0,1) THEN
    RAISE EXCEPTION '% found partial prior application',migration_key;
  END IF;

  IF already_applied_count=0 THEN
    IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=target_id AND definition.status='review'
        AND definition.card_version=1
    ) THEN
      RAISE EXCEPTION '% expected the active version-1 review card',migration_key;
    END IF;
    IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise exercise
      WHERE exercise.facility_id=1 AND exercise.id=target_legacy_id
        AND exercise.slug=target_slug AND exercise.is_published IS TRUE
        AND exercise.archived IS FALSE AND exercise.skill_level IS NULL
    ) THEN
      RAISE EXCEPTION '% expected published legacy source 270 without an exercise skill level',
        migration_key;
    END IF;
  ELSE
    IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=target_id AND definition.status='archived'
        AND definition.card_version=2
    ) OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise exercise
      WHERE exercise.facility_id=1 AND exercise.id=target_legacy_id
        AND exercise.archived IS TRUE AND exercise.is_published IS FALSE
        AND exercise.skill_level IS NULL
    ) THEN
      RAISE EXCEPTION '% found prior-application drift',migration_key;
    END IF;
  END IF;

  IF EXISTS(
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE(resolution.survivor_definition_id=target_id
        OR resolution.resolved_definition_id=target_id)
      AND resolution.resolution_source='human_review'
      AND resolution.reviewed_by IS NOT NULL
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',
      migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=target_id
        AND(definition.status IN('published','deprecated')
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      WHERE evidence.definition_id=target_id
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id=target_id
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      WHERE alternate.definition_id=target_id
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      WHERE review.definition_id=target_id)
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      WHERE revision.definition_id=target_id)
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      WHERE review.definition_id=target_id)
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      WHERE variant.definition_id=target_id AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      WHERE variant.definition_id=target_id AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
          OR variant.id=relationship.to_variant_id
      WHERE variant.definition_id=target_id
        AND(relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=calibration.variant_id
      WHERE variant.definition_id=target_id
        AND(calibration.status<>'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id=target_legacy_id
        AND(score.human_review_status<>'queued'
          OR score.reviewed_by IS NOT NULL OR score.reviewed_at IS NOT NULL))
  INTO protected_count;

  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  IF already_applied_count=0 THEN
    UPDATE coaching.exercise_section_evidence_v1 evidence
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE evidence.definition_id=target_id
      AND evidence.review_status='candidate';

    UPDATE coaching.exercise_media_candidate_v1 media
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,
      updated_at=now()
    WHERE media.definition_id=target_id
      AND media.review_status='candidate';

    UPDATE coaching.exercise_alternate_assessment_v1 alternate
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE alternate.definition_id=target_id
      AND alternate.review_status='candidate';
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id AND variant.definition_id=target_id
    AND profile.status<>'archived';

  UPDATE coaching.exercise_variant_v1 variant
  SET status='archived',
    difficulty_json=jsonb_build_object(
      'scoringStatus','blocked_pending_exact_identity',
      'exerciseComplexity',NULL,'physicalDifficulty',NULL,
      'overallDifficulty',NULL,
      'reason','direction, foot sequence, contact count, approach, finish, and repetition boundary are unresolved',
      'athleteProficiencyExcluded',TRUE),
    requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'selectable',FALSE,'identityQuarantine',TRUE,
        'missingIdentityDimensions',jsonb_build_array(
          'projection_direction','line_crossing','takeoff_leg','landing_leg',
          'contact_count','contact_sequence','approach','terminal_action',
          'exit','repetition_boundary'),
        'retirementMigration',migration_key),
    load_profile_json=jsonb_build_object(
      'status','blocked_pending_exact_identity',
      'reason','landing contacts, direction, cadence, approach, and terminal action are unresolved'),
    fatigue_profile_json=jsonb_build_object(
      'status','blocked_pending_exact_identity',
      'reason','impact, fatigue, and recovery budgets require an exact contact contract'),
    programming_profile_json=jsonb_build_object(
      'selectable',FALSE,'selectionPolicy','blocked_pending_identity_contract',
      'replacementPolicy','qualified_human_selects_an_exact_active_card'),
    updated_at=now()
  WHERE variant.definition_id=target_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=2,status='archived',reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    canonical_name='Single-Leg Line Hop and Stick (Unresolved Legacy)',
    display_name='Single-Leg Line Hop and Stick (Unresolved Legacy)',
    description='Archived nonprescribable legacy label. The source does not define line direction or crossing, takeoff and landing leg, contact count, approach, terminal action, exit, or repetition boundary, and it permits either immediate reacceleration or a stable stick. Select an exact reviewed line-hop, hop-to-stick, landing, or reacceleration card instead.',
    family_key='unresolved_single_leg_line_hop_identity_quarantine',
    movement_patterns=ARRAY['jump','land'],
    body_regions=ARRAY['foot','ankle','knee','hip','core'],
    required_equipment=ARRAY[]::TEXT[],optional_equipment=ARRAY[]::TEXT[],
    environment_json=jsonb_build_object(
      'known',jsonb_build_array('visible_floor_line','high_traction_surface'),
      'unresolved',jsonb_build_array(
        'line_orientation','crossing_geometry','lane_direction',
        'landing_zone','fall_space','approach_space','exit_space'),
      'selectionBlocked',TRUE),
    population_json=jsonb_build_object(
      'selectionBlocked',TRUE,
      'reason','readiness cannot be matched to an undefined contact and terminal-action contract',
      'supportPath','choose_an_exact_reviewed_lower_impact_or_line_hop_card'),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'generic_lower_limb_jump_landing_involvement_only'),
      'secondaryMuscles',jsonb_build_array(),
      'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis','spine'),
      'jointActions',jsonb_build_array(
        'exact_actions_blocked_pending_direction_and_contact_contract'),
      'planes',jsonb_build_array('unresolved'),
      'laterality','single_leg_wording_without_takeoff_or_landing_contract',
      'humanReviewRequired',TRUE),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This source label can mean several materially different drills, so it is unavailable until an exact task is chosen.',
      'primaryCue','Ask the coach which exact direction, foot sequence, contact count, and finish are intended.',
      'secondaryCues',jsonb_build_array(
        'Do not perform from this card','Use the exact replacement card instructions'),
      'expectedSensations',jsonb_build_array(),
      'unexpectedSensations',jsonb_build_array(
        'Any pain, instability, numbness, dizziness, or unusual breathlessness'),
      'painGuidance','Do not begin from this unresolved card; stop any replacement exercise for pain or instability.',
      'selfChecks',jsonb_build_array(
        'exact replacement name is visible','direction and landing foot are declared',
        'contact count and finish are declared'),
      'accessibility',jsonb_build_array(
        'plain-language retirement explanation','nonvideo exact replacement instructions'),
      'mediaAlternatives',jsonb_build_array(
        'text explanation of missing identity facts','coach-selected exact card')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'direction','line crossing','takeoff foot','landing foot','contacts',
        'approach','terminal action','exit','repetition boundary'),
      'faultCorrections',jsonb_build_array(
        'Do not cue or dose until every identity field is declared'),
      'demonstrationPlan','Demonstrate only from the selected exact active card, never from this legacy label.',
      'groupManagement','Keep this card out of stations, substitutions, printed plans, and athlete rendering.',
      'modificationDecisionTree',jsonb_build_array(
        'If the intended action is known, select the exact active card',
        'If any identity field remains unknown, omit the exercise'),
      'doNotUseWhen',jsonb_build_array(
        'always_nonprescribable','identity_contract_incomplete')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity_ambiguity','unsafe_selection','incorrect_substitution',
        'legacy_rendering','media_mismatch'),
      'supportEscalation',jsonb_build_object(
        'owner','canonical_library_editor',
        'requiredEvidence',jsonb_build_array(
          'authoritative_source','direction','takeoff_and_landing_legs',
          'contact_sequence','approach','terminal_action','repetition_boundary')),
      'retentionPolicy','preserve_source_mapping_evidence_media_and_history_while_archived',
      'changeImpactPolicy','new_exact_identity_requires_new_version_tests_human_review_and_release'),
    provenance_json=coalesce(definition.provenance_json,'{}'::JSONB)
      ||jsonb_build_object(
        'identityRetirementMigration',migration_key,
        'researchBatch','single-leg-line-hop-identity-quarantine-v1',
        'researchVersion','2026-08-01.6','legacySourceId',target_legacy_id,
        'retirementReason','source_missing_and_contradicting_exact_identity_contract',
        'selectable',FALSE,'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE,'approvalsCreated',FALSE,
        'mediaState','three_oembed_healthy_adjacent_candidates_no_exact_match'),
    updated_at=now()
  WHERE definition.id=target_id;

  UPDATE coaching.exercise exercise
  SET is_published=FALSE,archived=TRUE,skill_level=NULL,
    why_publish_ready=FALSE,
    description='Archived nonprescribable legacy label. Direction, line crossing, takeoff and landing leg, contact count, approach, terminal action, exit, and repetition boundary are unresolved; the source also permits either reacceleration or a stick.',
    card_summary='Identity quarantine only. Preserve history but do not select, substitute, dose, demonstrate, or render as an executable exercise.',
    coach_language='Choose an exact active card after declaring direction, foot sequence, contacts, approach, finish, and repetition boundary. Do not coach from this source label.',
    athlete_language='This exercise label is unavailable because it does not define one exact movement. Ask your coach for the exact replacement card.',
    movement_requirements=coalesce(exercise.movement_requirements,'{}'::JSONB)
      ||jsonb_build_object(
        'selectable',FALSE,'identityQuarantine',TRUE,
        'retirementMigration',migration_key,
        'missingIdentityDimensions',jsonb_build_array(
          'projection_direction','line_crossing','takeoff_leg','landing_leg',
          'contact_count','contact_sequence','approach','terminal_action',
          'exit','repetition_boundary')),
    programming_logic=coalesce(exercise.programming_logic,'{}'::JSONB)
      ||jsonb_build_object(
        'selectionPolicy','blocked_pending_identity_contract',
        'substitutionPolicy','qualified_human_selects_exact_active_card',
        'preserveHistoricalRendering',TRUE),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array('Do not set up this unresolved exercise'),
      'quality_gate',jsonb_build_array(
        'An exact active replacement card is selected before exposure'),
      'stop_signs',jsonb_build_array(
        'Any attempt to prescribe from the unresolved source label')),
    updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id=target_legacy_id;

  CREATE TEMP TABLE IF NOT EXISTS family_packet_seed(
    packet_slug TEXT PRIMARY KEY,
    research_version TEXT NOT NULL,
    packet_json JSONB NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE family_packet_seed;
  INSERT INTO family_packet_seed(packet_slug,research_version,packet_json)
  VALUES
  -- BEGIN GENERATED CANONICAL RESEARCH PACKETS
    ('single-leg-line-hop-and-stick','2026-08-01.6',$packet${"assessmentSummary":{"identity":"Unresolved legacy label. The source does not establish line direction, whether the line is crossed, takeoff foot, landing foot, contact count, approach, terminal action, exit, or repetition boundary.","currentCardFindings":["The legacy description permits either an immediate reacceleration or a stable stick, so the named terminal action is contradicted by its own execution contract.","Setup text permits an approach and exit but never defines either, while the name alone does not establish lateral versus forward-back line crossing.","The source never states whether one declared leg both takes off and lands, whether contacts alternate, or whether the athlete performs one, three, or continuous hops.","Six active similarity pairs reflect valid competing interpretations already represented by exact cards; merging into any one would fabricate missing identity facts.","The three inherited videos are healthy and embeddable candidates for adjacent interpretations only. No candidate establishes the exact legacy exercise."],"knownTaxonomy":{"movementPatterns":["jump","land"],"knownConstraints":["single_leg_wording","line_target_wording","some_form_of_terminal_control_wording"],"missingIdentityDimensions":["projection_direction","line_crossing","takeoff_leg","landing_leg","contact_count","contact_sequence","approach","terminal_action","exit","repetition_boundary"]},"anatomyDecision":"Do not assign an exact anatomy or joint-action contract until direction, laterality, contacts, and terminal action are fixed. Only generic lower-limb jump-landing involvement is supportable.","difficultyDecision":"Do not score exercise complexity or physical difficulty because the source does not define one exercise. Athlete skill or proficiency is also excluded.","loadFatigueDecision":"Do not assign impact, eccentric, fatigue, contact, or recovery budgets until foot count, direction, contact count, cadence, approach, and finish are fixed.","constraintDecision":"A visible line and high-traction surface are known, but lane direction, crossing geometry, landing zone, fall space, and traffic boundary cannot be specified from the source.","dosageDecision":"Block dosage and duration. Repetitions cannot be counted without a declared contact sequence and repetition boundary.","instructionDecision":"Do not render coach or athlete execution instructions from the ambiguous source. Route users to an exact reviewed interpretation instead.","safetyDecision":"Block selection before exposure. A safe setup cannot be derived while direction, approach, contact sequence, and terminal action are unresolved.","contextualDeliveryDecision":"Create no selectable delivery profile. Immediate reacceleration and terminal stabilization are different session tasks and cannot share one profile.","supportDecision":"User and coach support should explain why the card is unavailable, list the missing identity facts, and present exact alternatives without recommending one automatically.","proposedRelationships":{"possibleExistingIdentities":["single-leg-lateral-hop-to-stick","single-leg-hop-to-stick","triple-line-hop-and-stick","single-leg-triple-hop-to-stick","single-leg-landing-stick","single-leg-pogo-hold-stick"],"resolution":"retire_ambiguous_source_without_consolidation","doNotMerge":["same_leg_lateral_discrete_hop","generic_forward_discrete_hop","three_contact_line_hop","continuous_line_hops","pogo_then_hold","hop_then_reacceleration"]},"programmingDecision":"Archive the canonical and legacy card as nonprescribable while preserving the stable slug, source mapping, evidence, media candidates, and prior needs-human-review decisions. Do not map it to any exact active card unless a qualified human supplies authoritative identity evidence.","currentCardSnapshot":{"capturedAt":"2026-08-01T23:55:00.000Z","cardVersion":1,"status":"review","description":"Single-Leg Line Hop and Stick is a elastic stiffness and foot reactivity drill. The athlete uses clear start, plant, stop, or exit targets to rehearse single-leg stiffness plus stick ownership, emphasizing low hips, clean foot placement, aligned braking, and an immediate reacceleration or stable stick depending on the drill intent.","familyKey":"Single-Leg Elastic Control","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":30,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["Three inherited links returned current oEmbed metadata and iframe markup on 2026-08-01.","Their titles expose adjacent interpretations but do not verify the legacy line direction, foot sequence, contact count, stick, exit, safety, quality, captions, accessibility, reviewer, or approval."]},{"sectionKey":"identity","sourceUrl":"https://www.emoryhealthcare.org/centers-programs/acl-program/return-to-play/single-leg-line-jump","sourceTitle":"Single-Leg Line Jump","sourcePublisher":"Emory Healthcare","sourceKind":"expert_instruction","evidenceQuality":80,"claims":["Emory defines one exact interpretation using a single-leg start, one lateral jump over tape, a single-leg landing, and a timed hold.","Those explicit facts are absent from the legacy card and therefore cannot be imported as if they were original identity evidence."]},{"sectionKey":"taxonomy","sourceUrl":"https://www.nsca.com/education/articles/kinetic-select/7-line-drills-to-improve-agility/","sourceTitle":"7 Line Drills to Improve Agility","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":80,"claims":["NSCA describes multiple line-drill patterns and distinguishes foot count and direction.","A generic line-hop label is insufficient for controlled taxonomy without direction, laterality, contact sequence, and finish."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/32148612/","sourceTitle":"Effect of Jump Direction and External Load on Single-Legged Jump-Landing Biomechanics","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Single-leg jump-landing mechanics vary with direction and external load.","Exact muscles, joint actions, planes, and laterality cannot be assigned beyond generic lower-limb jump-landing involvement until the legacy task is defined."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28090004/","sourceTitle":"Difference in Dynamic Body Balance between Forward and Lateral Single-Leg Hop Landing","sourcePublisher":"Kurume Medical Journal","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Forward and lateral single-leg hop landings produce different dynamic-balance demands.","Direction is therefore a material missing biomechanical variable rather than a cosmetic label."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/32148612/","sourceTitle":"Effect of Jump Direction and External Load on Single-Legged Jump-Landing Biomechanics","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Direction and loading change single-leg jump-landing demands.","No complexity, physical-difficulty, or derived-overall score is proposed for an undefined exercise; athlete proficiency remains outside exercise cards."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37300972/","sourceTitle":"The side hop test: Validity, reliability, and quality aspects in relation to sex, age and anterior cruciate ligament reconstruction, in soccer players","sourcePublisher":"Physical Therapy in Sport","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Side-hop exposure and errors depend on contact count and execution quality.","Impact, fatigue, and recovery cannot be budgeted from the legacy source because contact count, direction, and cadence are missing."]},{"sectionKey":"constraints","sourceUrl":"https://www.emoryhealthcare.org/centers-programs/acl-program/return-to-play/single-leg-line-jump","sourceTitle":"Single-Leg Line Jump","sourcePublisher":"Emory Healthcare","sourceKind":"expert_instruction","evidenceQuality":80,"claims":["An exact line-jump task declares the taped line, start, direction, landing, and hold.","The legacy card provides only a generic line reference and cannot supply lane geometry, landing zone, or fall-space requirements."]},{"sectionKey":"dosage","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37300972/","sourceTitle":"The side hop test: Validity, reliability, and quality aspects in relation to sex, age and anterior cruciate ligament reconstruction, in soccer players","sourcePublisher":"Physical Therapy in Sport","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Side-hop testing counts defined contacts and quality errors.","A repetition, contact, duration, or work-to-rest prescription is unsafe to infer without an ordered movement and terminal state."]},{"sectionKey":"instructions","sourceUrl":"https://www.emoryhealthcare.org/centers-programs/acl-program/return-to-play/single-leg-line-jump","sourceTitle":"Single-Leg Line Jump","sourcePublisher":"Emory Healthcare","sourceKind":"expert_instruction","evidenceQuality":80,"claims":["Executable instruction separates start leg, line crossing, landing leg, alignment, hold, and reset.","The legacy card cannot be rendered as exact coach or athlete instructions because these fields are missing or contradictory."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Landing feedback requires observable task-specific movement criteria.","The correct fail-closed rule is to block selection until the task has a declared direction, contacts, landing, and finish; symptom stops do not repair an undefined task."]},{"sectionKey":"programming","sourceUrl":"https://www.nsca.com/education/articles/kinetic-select/7-line-drills-to-improve-agility/","sourceTitle":"7 Line Drills to Improve Agility","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":80,"claims":["Line drills can target different footwork and agility patterns depending on the declared execution.","A stable stick and immediate reacceleration are different programming intents and cannot be selected from one ambiguous profile."]},{"sectionKey":"athlete_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/","sourceTitle":"Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes: a systematic review and meta-analysis","sourcePublisher":"BMJ Open Sport & Exercise Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Landing interventions depend on specific instruction, feedback, and progression.","Athlete support must say that this card is unavailable and link to an exact alternative instead of guessing the intended drill."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37300972/","sourceTitle":"The side hop test: Validity, reliability, and quality aspects in relation to sex, age and anterior cruciate ligament reconstruction, in soccer players","sourcePublisher":"Physical Therapy in Sport","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Quality review records defined errors such as line contact, free-foot contact, double hops, and foot turns.","Coach support must request direction, takeoff and landing legs, contacts, approach, finish, and repetition boundary before authoring a replacement."]},{"sectionKey":"accessibility","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/","sourceTitle":"Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes: a systematic review and meta-analysis","sourcePublisher":"BMJ Open Sport & Exercise Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Task scaling presupposes a defined base task.","No accessible regression can preserve an unknown identity; users should receive text alternatives and an exact lower-impact card chosen for the intended action."]},{"sectionKey":"alternates","sourceUrl":"https://www.nsca.com/education/articles/kinetic-select/7-line-drills-to-improve-agility/","sourceTitle":"7 Line Drills to Improve Agility","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":80,"claims":["Single-leg, two-foot, lateral, forward-back, and repeated line drills are distinct executable patterns.","Each plausible interpretation must be mapped to an existing exact card or authored separately after identity review."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=ZHg88_EYQ74","title":"Lateral Line Hops – Speed, Agility & Footwork","channelName":"Train With Cuz","sourceQuery":"single leg line hop and stick","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-08-01T23:50:00.000Z"},"notes":"oEmbed returned current metadata and iframe markup. The title does not declare single-leg execution or a terminal stick, so this is adjacent evidence only.","exactVariantMatch":null,"reviewStatus":"candidate"},{"url":"https://www.youtube.com/watch?v=Jiukp-0mUIA","title":"Lateral Line Hops","channelName":"Travis Goyeneche","sourceQuery":"single leg line hop and stick","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-08-01T23:50:00.000Z"},"notes":"oEmbed returned current metadata and iframe markup. The title does not declare single-leg execution, contact count, or a terminal stick, so this is adjacent evidence only.","exactVariantMatch":null,"reviewStatus":"candidate"},{"url":"https://www.youtube.com/watch?v=7WgzHOQGgYw","title":"Single Leg Hops | Exercise Tutorial","channelName":"Elevate Yourself","sourceQuery":"single leg line hop and stick","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-08-01T23:50:00.000Z"},"notes":"oEmbed returned current metadata and iframe markup. The title does not declare a line, direction, contact count, or terminal stick, so this is adjacent evidence only.","exactVariantMatch":null,"reviewStatus":"candidate"}],"alternateAssessments":[{"name":"Same-Leg Lateral Line Hop to Stick","classification":"same_identity","rationale":"If authoritative evidence establishes one lateral flight, same-leg takeoff and landing, terminal hold, and reset, the line is a target constraint on the existing Single-Leg Lateral Hop to Stick card.","distinguishingDimensions":{"possibleMapping":"single-leg-lateral-hop-to-stick","requiredFacts":["lateral","same_leg","one_flight","terminal_hold","reset"]}},{"name":"Single-Leg Forward Line Hop to Stick","classification":"same_identity","rationale":"If the line is a forward target and one same-leg flight ends in a hold, it may map to the exact general or forward single-leg hop-to-stick identity after human review.","distinguishingDimensions":{"possibleMapping":"single-leg-hop-to-stick","requiredFacts":["forward","same_leg","one_flight","terminal_hold"]}},{"name":"Repeated Single-Leg Lateral Line Hops","classification":"new_definition","rationale":"Continuous line crossings remove the terminal hold and change contact count, cadence, fatigue, and impact budgets.","distinguishingDimensions":{"direction":"lateral","contacts":"repeated","terminalAction":"continuous"}},{"name":"Repeated Single-Leg Forward-Back Line Hops","classification":"new_definition","rationale":"Forward-back crossings use a different direction, contact sequence, and stabilization demand.","distinguishingDimensions":{"direction":"forward_back","contacts":"repeated"}},{"name":"Triple-Line Hop and Stick","classification":"same_identity","rationale":"If authoritative evidence establishes exactly three declared contacts followed by a stick, use the existing exact Triple-Line Hop and Stick card.","distinguishingDimensions":{"possibleMapping":"triple-line-hop-and-stick","contacts":3,"terminalAction":"stick"}},{"name":"Single-Leg Line Hop to Reacceleration","classification":"new_definition","rationale":"An immediate exit is an agility transition with a different terminal action, space, dose, and success measure than a stick.","distinguishingDimensions":{"terminalAction":"reacceleration","exit":"declared"}},{"name":"Line Width, Target Color, Hold Duration, Distance, Rest, or Starting Side","classification":"modifier_annotation","rationale":"These become modifiers only after direction, foot sequence, contact count, approach, terminal action, and repetition boundary are fixed.","distinguishingDimensions":{"modifiers":["line_width","target_color","hold_duration","distance","rest","starting_side"]}}]}$packet$::JSONB);
  -- END GENERATED CANONICAL RESEARCH PACKETS

  WITH packet_evidence AS(
    SELECT packet.packet_slug,evidence.item->>'sectionKey' section_key,
      evidence.item->>'sourceUrl' source_url,
      evidence.item->>'sourceTitle' source_title,
      evidence.item->>'sourcePublisher' source_publisher,
      evidence.item->>'sourceKind' source_kind,
      (evidence.item->>'evidenceQuality')::SMALLINT evidence_quality,
      to_jsonb(ARRAY(SELECT jsonb_array_elements_text(
        evidence.item->'claims'))) claims_json
    FROM family_packet_seed packet
    CROSS JOIN LATERAL jsonb_array_elements(
      packet.packet_json->'evidence') evidence(item)
  )
  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT target_id,2,evidence.section_key,evidence.source_url,
    evidence.source_title,evidence.source_publisher,evidence.source_kind,
    evidence.claims_json,evidence.evidence_quality,'candidate',NULL,NULL
  FROM packet_evidence evidence
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  SELECT target_id,target_variant_id,2,media.item->>'url',
    'https://www.youtube-nocookie.com/embed/'
      ||substring(media.item->>'url' FROM 'v=([^&]+)'),
    substring(media.item->>'url' FROM 'v=([^&]+)'),media.item->>'title',
    media.item->>'channelName',NULL,'en',NULL,
    coalesce((media.item->>'embeddingAllowed')::BOOLEAN,FALSE),NULL,NULL,
    CASE WHEN media.item->>'linkStatus'='healthy' THEN 'healthy'
      ELSE 'unverified' END,
    'candidate','manual_research',media.item->>'sourceQuery',NULL,NULL,NULL,
    concat_ws(' ',media.item->>'notes',
      'Adjacent candidate for identity review only. No exact movement match, complete viewing, safety, accessibility, reviewer identity, or approval is established.')
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(
    packet.packet_json->'mediaCandidates') media(item)
  ON CONFLICT(definition_id,reviewed_card_version,video_id)
  DO UPDATE SET variant_id=target_variant_id,url=EXCLUDED.url,
    embed_url=EXCLUDED.embed_url,title=EXCLUDED.title,
    channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,
    embedding_allowed=EXCLUDED.embedding_allowed,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status=EXCLUDED.link_status,
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=NULL,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT target_id,2,alternate.item->>'name',
    alternate.item->>'classification',alternate.item->>'rationale',
    coalesce(alternate.item->'distinguishingDimensions','{}'::JSONB),
    NULL,'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(
    packet.packet_json->'alternateAssessments') alternate(item)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name)
  DO UPDATE SET classification=EXCLUDED.classification,
    rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise_identity_resolution_v1 resolution
  SET evidence_json=coalesce(resolution.evidence_json,'{}'::JSONB)
      ||jsonb_build_object(
        'ambiguousSourceRetired',TRUE,
        'retirementMigration',migration_key,
        'sourceMappedToExactIdentity',FALSE,
        'humanIdentityDecisionStillRequiredForAnyFutureReactivation',TRUE),
    resolution_source='deterministic_identity_equivalence',
    reviewed_by=NULL,resolved_at=now()
  WHERE(resolution.survivor_definition_id=target_id
      OR resolution.resolved_definition_id=target_id)
    AND resolution.decision='needs_human_review'
    AND resolution.resolution_source<>'human_review'
    AND resolution.reviewed_by IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(
    target_id,1,2,'1.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'stableSlugPreserved',TRUE,'legacySourceMappingPreserved',TRUE,
      'canonicalSelectionBlocked',TRUE,'legacySelectionBlocked',TRUE,
      'identityContractComplete',FALSE,'difficultyScoringBlocked',TRUE,
      'exerciseSkillLevelAbsent',TRUE,'deliveryProfilesSelectable',FALSE,
      'candidateEvidenceSections',16,'candidateMediaCount',3,
      'mediaExactMatchReviewed',FALSE,'alternateInterpretations',7,
      'priorIdentityQuarantinesPreserved',TRUE,
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-IDENTITY-01','category','identity',
        'message','Direction, line crossing, foot sequence, contacts, approach, finish, exit, and repetition boundary are unresolved.'),
      jsonb_build_object('code','CARD-DIFFICULTY-01','category','difficulty',
        'message','Exercise complexity and physical difficulty cannot be scored until one exact exercise is defined.'),
      jsonb_build_object('code','CARD-LOAD-01','category','load',
        'message','Contact, impact, fatigue, and recovery budgets require an exact movement contract.'),
      jsonb_build_object('code','CARD-DELIVERY-01','category','delivery',
        'message','No selectable dosage, duration, logistics, substitution, or rendering profile is permitted.'),
      jsonb_build_object('code','CARD-MEDIA-01','category','media',
        'message','Adjacent candidates do not establish an exact exercise match or human approval.'),
      jsonb_build_object('code','CARD-PUBLISH-01','category','publication',
        'message','The legacy card is archived and nonprescribable.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,card_version=2,
    schema_version='1.0.0',audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=target_id AND definition.status='archived'
    AND definition.card_version=2 AND definition.reviewed_by IS NULL
    AND definition.approved_by IS NULL
    AND definition.provenance_json->>'identityRetirementMigration'=migration_key;
  IF actual_count<>1 THEN
    RAISE EXCEPTION '% failed canonical retirement invariant',migration_key;
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM coaching.exercise exercise
    WHERE exercise.facility_id=1 AND exercise.id=target_legacy_id
      AND exercise.slug=target_slug AND exercise.archived IS TRUE
      AND exercise.is_published IS FALSE AND exercise.skill_level IS NULL
      AND exercise.movement_requirements->>'selectable'='false'
  ) THEN
    RAISE EXCEPTION '% failed legacy selection quarantine',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1 variant
    WHERE variant.definition_id=target_id
      AND(variant.status<>'archived'
        OR variant.requirements_json->>'selectable'<>'false'
        OR coaching.exercise_json_has_non_neutral_level_classification(
          variant.difficulty_json))
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_delivery_profile_v1 profile
    JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
    WHERE variant.definition_id=target_id AND profile.status<>'archived'
  ) THEN
    RAISE EXCEPTION '% failed variant or delivery quarantine invariant',
      migration_key;
  END IF;

  IF(SELECT count(DISTINCT evidence.section_key)
      FROM coaching.exercise_section_evidence_v1 evidence
      WHERE evidence.definition_id=target_id
        AND evidence.reviewed_card_version=2
        AND evidence.review_status='candidate')<>16 THEN
    RAISE EXCEPTION '% failed sixteen-section candidate evidence invariant',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id=target_id AND media.reviewed_card_version=2
        AND media.review_status='candidate' AND media.link_status='healthy'
        AND media.embedding_allowed IS TRUE
        AND media.exact_variant_match IS NULL
        AND media.demonstration_quality_score IS NULL
        AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>3 THEN
    RAISE EXCEPTION '% failed candidate-only media invariant',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      WHERE alternate.definition_id=target_id
        AND alternate.reviewed_card_version=2
        AND alternate.review_status='candidate'
        AND alternate.reviewer_user_id IS NULL
        AND alternate.reviewed_at IS NULL)<>7 THEN
    RAISE EXCEPTION '% failed alternate-assessment invariant',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE(resolution.survivor_definition_id=target_id
          OR resolution.resolved_definition_id=target_id)
        AND resolution.decision='needs_human_review'
        AND resolution.evidence_json->>'ambiguousSourceRetired'='true')<>6 THEN
    RAISE EXCEPTION '% failed six identity-quarantine provenance invariants',
      migration_key;
  END IF;
END
$$;
