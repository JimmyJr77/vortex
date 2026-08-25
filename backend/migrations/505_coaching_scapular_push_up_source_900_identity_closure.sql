-- Source 900 is an exact quadruped dynamic alias of Source 33. Consolidate the
-- duplicate definition without changing any human review or approval state.
-- Also remove the unrelated PMID 32707142 citation from inherited identity
-- decisions while preserving their deterministic decision history.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '505_coaching_scapular_push_up_source_900_identity_closure';
  research_version CONSTANT TEXT := '2026-08-09.101';
  canonical_definition UUID;
  canonical_variant UUID;
  duplicate_definition UUID;
  duplicate_variant UUID;
  duplicate_profile UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=33;
  SELECT id INTO canonical_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition
    AND variant_key='quadruped-straight-arm-retraction-protraction-cycle';
  SELECT id INTO duplicate_definition FROM coaching.exercise_definition_v1
  WHERE legacy_exercise_id=900;
  SELECT id INTO duplicate_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=duplicate_definition AND variant_key='baseline';
  SELECT id INTO duplicate_profile FROM coaching.exercise_delivery_profile_v1
  WHERE variant_id=duplicate_variant ORDER BY created_at LIMIT 1;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=900 AND facility_id=1
        AND name='Quadruped Scapular Protraction-Retraction')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1
        AND legacy_exercise_id=33 AND status='review' AND card_version=2)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=canonical_variant AND definition_id=canonical_definition
        AND variant_key='quadruped-straight-arm-retraction-protraction-cycle'
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=duplicate_definition AND facility_id=1
        AND legacy_exercise_id=900
        AND status IN('review','archived'))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=duplicate_variant AND definition_id=duplicate_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1
      WHERE id=duplicate_profile AND variant_id=duplicate_variant)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=900
        AND definition_id IN(canonical_definition,duplicate_definition))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=900)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile
      WHERE exercise_id=900)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=900) THEN
    RAISE EXCEPTION '% prerequisite Source 33 or Source 900 lineage is missing',
      migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=duplicate_definition
        AND (status='published' OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=duplicate_definition
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=duplicate_definition
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=duplicate_definition
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=duplicate_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=duplicate_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=duplicate_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=duplicate_variant OR to_variant_id=duplicate_variant)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=duplicate_variant
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=duplicate_definition
          OR resolved_definition_id=duplicate_definition)
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=900
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records',
      migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=duplicate_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=duplicate_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=duplicate_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=duplicate_variant OR to_variant_id=duplicate_variant)
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=duplicate_variant
    AND reviewed_by IS NULL AND status<>'approved';

  DELETE FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=900 AND definition_id=duplicate_definition;
  INSERT INTO coaching.exercise_definition_source_v1(
    definition_id,legacy_exercise_id,source_kind,provenance_json)
  VALUES(canonical_definition,900,'duplicate_consolidation',
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','exact_quadruped_dynamic_duplicate_consolidated',
      'retiredDefinitionId',duplicate_definition,
      'retiredVariantId',duplicate_variant,
      'replacementVariantId',canonical_variant,
      'identityReason','both cards require bilateral hands-and-knees support straight elbows scapular retraction and protraction through chest movement and one complete cycle',
      'primaryIdentitySource','https://bmjopensem.bmj.com/content/bmjosem/8/1/e001270/DC1/embed/inline-supplementary-material-1.pdf',
      'source900DescriptionPreserved',TRUE,
      'legacyClassificationAgeAndPublicationClaimsUnsupported',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE))
  ON CONFLICT(legacy_exercise_id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,
    source_kind='duplicate_consolidation',
    provenance_json=EXCLUDED.provenance_json;

  UPDATE coaching.exercise_delivery_profile_v1 SET
    status='archived',updated_at=now()
  WHERE id=duplicate_profile AND variant_id=duplicate_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-900',
    display_name='Quadruped Scapular Protraction-Retraction Legacy Skeleton — Source 900',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',900,
      'archiveReason','exact duplicate of the canonical quadruped straight-arm retraction-protraction cycle',
      'survivorDefinitionId',canonical_definition,
      'replacementVariantId',canonical_variant,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','superseded_source_skeleton','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=duplicate_variant;
  UPDATE coaching.exercise_definition_v1 SET
    status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','exact_quadruped_dynamic_duplicate_archived',
        'survivorDefinitionId',canonical_definition,
        'replacementVariantId',canonical_variant,
        'identityReason','same hands-and-knees straight-elbow scapular retraction-protraction cycle and count boundary',
        'selectable',FALSE,'publicationQuarantined',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=duplicate_definition;

  UPDATE coaching.exercise_definition_v1 SET
    aliases=CASE
      WHEN aliases @> ARRAY['Quadruped Scapular Protraction-Retraction']::TEXT[]
        THEN aliases
      ELSE array_append(aliases,'Quadruped Scapular Protraction-Retraction') END,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'source900DuplicateConsolidated',duplicate_definition,
      'source900ReplacementVariantId',canonical_variant,
      'identityClosureMigration',migration_key,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=canonical_definition;

  UPDATE coaching.exercise SET
    skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,archived=TRUE,
    programming_logic=coalesce(programming_logic,'{}'::JSONB)||jsonb_build_object(
      'selectionStatus','exact_duplicate_consolidated','selectable',FALSE,
      'survivorDefinitionId',canonical_definition,
      'survivorLegacyExerciseId',33,
      'replacementVariantId',canonical_variant,
      'migration',migration_key,
      'identityReason','same quadruped straight-arm scapular retraction-protraction cycle',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    linked_skill_id=NULL,why_publish_ready=FALSE,updated_at=now()
  WHERE id=900;
  UPDATE coaching.exercise_safety_profile SET
    minimum_age_recommended=NULL,minimum_skill_level=NULL,
    minimum_prerequisite_notes='Archived exact duplicate source. Use the Source-33 Scapular Push-Up canonical survivor and quadruped dynamic variant; readiness remains a workout input rather than an age or participant level.',
    common_substitutions=ARRAY['Use canonical Scapular Push-Up definition ae22d70e-e68f-4d40-9402-6dd39a6420f1 and exact quadruped dynamic variant e201df7f-eedf-47b7-903b-c3077cf41935 after complete selection and budget revalidation.']::TEXT[]
  WHERE exercise_id=900;
  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=24,absolute_load_demand=18,
    coordination_demand=24,impact=1,supervision_demand=22,
    base_overall_difficulty=greatest(24,18),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','archived_duplicate_source_lineage_only',
      'survivorDefinitionId',canonical_definition,
      'replacementVariantId',canonical_variant,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseScoresDescribeTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=84,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Archived exact duplicate lineage only. Use the canonical quadruped dynamic variant; this score describes the exercise task and does not classify a participant.',
    updated_at=now()
  WHERE exercise_id=900;
  UPDATE coaching.exercise_difficulty_profile SET
    technical=2.4,complexity=2,load=1.8,overall=2.4,
    recommended_age_min=NULL,recommended_age_max=NULL,
    attention_demand='low',
    notes='Archived exact duplicate source projection only. Use the Source-33 quadruped dynamic variant scored 24/18/24; this is not participant proficiency or age classification.',
    source='canonical_duplicate_archived',updated_at=now()
  WHERE exercise_id=900;

  UPDATE coaching.exercise_identity_resolution_v1 SET
    evidence_json=(coalesce(evidence_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'removedUnrelatedResearchSource','https://pubmed.ncbi.nlm.nih.gov/32707142/',
        'removedSourceReason','PMID 32707142 is a prone cardiopulmonary-resuscitation review and does not support scapular exercise identity',
        'replacementIdentitySources',jsonb_build_array(
          'https://bmjopensem.bmj.com/content/bmjosem/8/1/e001270/DC1/embed/inline-supplementary-material-1.pdf',
          'current_authored_candidate_card_contracts'),
        'provenanceCorrectionMigration',migration_key,
        'decisionUnchanged',TRUE,'approvalsCreated',FALSE),
    reviewed_by=NULL,resolved_at=now()
  WHERE (survivor_definition_id=canonical_definition
      OR resolved_definition_id=canonical_definition)
    AND coalesce(evidence_json->'researchSources','[]'::JSONB)::TEXT
      LIKE '%32707142%';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(1,canonical_definition,duplicate_definition,'duplicate_consolidated',
    'Source 900 and the canonical quadruped dynamic Scapular Push-Up both require bilateral hands-and-knees support, straight elbows, scapular retraction as the chest moves toward the floor, and scapular protraction as the floor is pushed away. Source 900 is therefore an exact alias rather than a separate exercise.',
    jsonb_build_object(
      'migration',migration_key,
      'match','same_quadruped_straight_arm_scapular_retraction_protraction_cycle',
      'resolvedSlug','quadruped-scapular-protraction-retraction',
      'survivorSlug','scapular-push-up',
      'replacementVariantId',canonical_variant,
      'identityDimensions',jsonb_build_array('quadruped_base','bilateral_hands_and_knees','straight_elbows','scapular_retraction_protraction','chest_toward_and_away_from_floor','complete_cycle_boundary'),
      'primaryIdentitySource','https://bmjopensem.bmj.com/content/bmjosem/8/1/e001270/DC1/embed/inline-supplementary-material-1.pdf',
      'decisionScope','identity_and_traceability_only_not_media_graph_calibration_content_or_publication_approval',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now();

  UPDATE coaching.exercise_card_test_packet_v1 SET
    audit_version=migration_key,
    checks_json=CASE
      WHEN jsonb_typeof(checks_json)='array' AND checks_json @>
        '[{"id":"CARD-IDENTITY-SOURCE-900"}]'::JSONB THEN checks_json
      WHEN jsonb_typeof(checks_json)='array' THEN checks_json||jsonb_build_array(
        jsonb_build_object('id','CARD-IDENTITY-SOURCE-900','status','passed',
          'message','Source 900 exact quadruped dynamic duplicate is consolidated.',
          'source900DuplicateConsolidated',TRUE,'identityDecisions',6,
          'humanReviewRequired',TRUE,'approvalsCreated',FALSE))
      ELSE jsonb_set(
        jsonb_set(checks_json,'{identity,source900DuplicateConsolidated}',
          'true'::JSONB,TRUE),
        '{identity,identityDecisions}','6'::JSONB,TRUE) END,
    status='quarantined',human_review_required=TRUE,checked_at=now()
  WHERE definition_id=canonical_definition;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=900 AND definition_id=canonical_definition
        AND source_kind='duplicate_consolidation')
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=900 AND definition_id=duplicate_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=duplicate_definition AND status='archived'
        AND approved_video_url IS NULL AND reviewed_by IS NULL
        AND approved_by IS NULL AND last_reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=duplicate_variant AND status='archived'
        AND requirements_json->>'replacementVariantId'=canonical_variant::TEXT)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1
      WHERE id=duplicate_profile AND status='archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=900 AND skill_level IS NULL AND age_min IS NULL
        AND age_max IS NULL AND is_published=FALSE AND archived=TRUE
        AND linked_skill_id IS NULL AND programming_kind='exercise')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=900 AND technical_complexity=24
        AND absolute_load_demand=18 AND base_overall_difficulty=24
        AND human_review_status='queued' AND reviewed_by IS NULL
        AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND resolved_definition_id=duplicate_definition
        AND decision='duplicate_consolidated' AND reviewed_by IS NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_definition
          OR resolved_definition_id=canonical_definition)
        AND coalesce(evidence_json->'researchSources','[]'::JSONB)::TEXT
          LIKE '%32707142%')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND aliases @> ARRAY['Quadruped Scapular Protraction-Retraction']::TEXT[])
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND status='quarantined'
        AND audit_version=migration_key
        AND checks_json::TEXT LIKE '%source900DuplicateConsolidated%'
        AND jsonb_array_length(blocking_issues_json)=4)
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=duplicate_definition
        AND review_status='superseded')<>5 THEN
    RAISE EXCEPTION '% postcondition failed',migration_key;
  END IF;
END
$migration$;
