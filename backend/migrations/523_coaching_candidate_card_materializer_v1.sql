-- Declarative, candidate-only materializer for canonical exercise cards.
-- This is migration infrastructure: it does not publish cards, approve media,
-- approve relationships, or approve calibration. Future family migrations pass
-- a complete immutable JSONB contract and fail closed on protected review data.

CREATE OR REPLACE FUNCTION coaching.apply_candidate_exercise_card_v1(p_card JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $materializer$
DECLARE
  definition_data JSONB := p_card->'definition';
  source_variant_data JSONB := p_card->'sourceVariant';
  legacy_data JSONB := p_card->'legacy';
  safety_data JSONB := p_card->'safety';
  score_data JSONB := p_card->'score';
  packet_data JSONB := p_card->'testPacket';
  migration_key TEXT := coalesce(p_card->>'migrationKey', '');
  research_version TEXT := coalesce(p_card->>'researchVersion', '');
  facility_id_value BIGINT := coalesce((definition_data->>'facilityId')::BIGINT, 1);
  legacy_exercise_id_value BIGINT := (definition_data->>'legacyExerciseId')::BIGINT;
  definition_id_value UUID := NULLIF(definition_data->>'id','')::UUID;
  source_variant_id_value UUID := NULLIF(source_variant_data->>'id','')::UUID;
  definition_slug_value TEXT := coalesce(definition_data->>'slug','');
  source_variant_key_value TEXT := coalesce(source_variant_data->>'lookupKey','');
  source_variant_archive_key_value TEXT := coalesce(source_variant_data->>'archiveKey','');
  preserve_definition_legacy_id BOOLEAN := coalesce(
    (definition_data->>'preserveLegacyExerciseId')::BOOLEAN,FALSE
  );
  preserve_legacy_archived BOOLEAN := coalesce(
    (legacy_data->>'preserveArchived')::BOOLEAN,FALSE
  );
  active_variant_ids UUID[];
  owned_variant_ids UUID[];
  protected_count INTEGER;
  card_text TEXT := coalesce(p_card::TEXT, '');
  variant_data JSONB;
  profile_data JSONB;
  evidence_data JSONB;
  media_data JSONB;
  alternate_data JSONB;
  relationship_data JSONB;
  calibration_data JSONB;
  resolution_data JSONB;
BEGIN
  IF migration_key='' OR research_version='' OR definition_data IS NULL
    OR source_variant_data IS NULL OR legacy_data IS NULL OR safety_data IS NULL
    OR score_data IS NULL OR packet_data IS NULL THEN
    RAISE EXCEPTION 'candidate card materializer requires migrationKey, researchVersion, definition, sourceVariant, legacy, safety, score, and testPacket';
  END IF;
  -- A canonical definition and its archived source skeleton have historically
  -- received random UUIDs during the initial canonical import.  A later
  -- family migration must therefore be able to locate those rows by stable
  -- identity keys instead of requiring one environment's UUIDs.  Explicit
  -- UUIDs remain supported and must resolve to the same stable rows.
  IF definition_id_value IS NULL AND definition_slug_value<>'' THEN
    SELECT id INTO definition_id_value
    FROM coaching.exercise_definition_v1
    WHERE facility_id=facility_id_value AND slug=definition_slug_value;
  END IF;
  IF source_variant_id_value IS NULL AND source_variant_key_value<>''
    AND definition_id_value IS NOT NULL THEN
    SELECT id INTO source_variant_id_value
    FROM coaching.exercise_variant_v1
    WHERE definition_id=definition_id_value
      AND variant_key IN (source_variant_key_value, source_variant_archive_key_value)
    ORDER BY (variant_key=source_variant_key_value) DESC
    LIMIT 1;
  END IF;

  IF definition_id_value IS NULL OR source_variant_id_value IS NULL
    OR legacy_exercise_id_value IS NULL
    OR definition_slug_value=''
    OR coalesce(definition_data->>'canonicalName','')=''
    OR coalesce(definition_data->>'description','')=''
    OR jsonb_array_length(coalesce(p_card->'variants','[]'::JSONB))=0 THEN
    RAISE EXCEPTION '% has an incomplete identity or no exact variants', migration_key;
  END IF;
  IF coalesce(definition_data->>'status','review') <> 'review'
    OR coalesce(packet_data->>'status','quarantined') <> 'quarantined'
    OR coalesce(packet_data->>'humanReviewRequired','true') <> 'true'
    OR card_text ~* '"(?:reviewedBy|approvedBy|reviewerUserId|reviewedAt)"\s*:\s*[^n]'
    OR card_text ~* '"(?:reviewStatus|status)"\s*:\s*"approved"' THEN
    RAISE EXCEPTION '% attempts to create an approval or non-review card state', migration_key;
  END IF;
  IF card_text ~* '"[^"]*(?:skill[_-]?level|proficiency[_-]?(?:level|classification))[^"]*"\s*:' THEN
    RAISE EXCEPTION '% contains exercise-card proficiency classification metadata', migration_key;
  END IF;

  SELECT array_agg((item->>'id')::UUID ORDER BY item->>'key')
  INTO active_variant_ids
  FROM jsonb_array_elements(p_card->'variants') item;
  owned_variant_ids := array_append(active_variant_ids, source_variant_id_value);
  IF cardinality(active_variant_ids) <> (
    SELECT count(DISTINCT (item->>'id')::UUID)
    FROM jsonb_array_elements(p_card->'variants') item
  ) THEN
    RAISE EXCEPTION '% contains duplicate exact variant UUIDs', migration_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise
    WHERE id=legacy_exercise_id_value AND facility_id=facility_id_value
  ) OR NOT EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=definition_id_value
      AND facility_id=facility_id_value
      AND slug=definition_slug_value
  ) OR NOT EXISTS (
    SELECT 1 FROM coaching.exercise_definition_source_v1
    WHERE definition_id=definition_id_value
      AND legacy_exercise_id=legacy_exercise_id_value
  ) OR NOT EXISTS (
    SELECT 1 FROM coaching.exercise_variant_v1
    WHERE id=source_variant_id_value
      AND definition_id=definition_id_value
  ) OR NOT EXISTS (
    SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=legacy_exercise_id_value
  ) OR NOT EXISTS (
    SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=legacy_exercise_id_value
  ) OR NOT EXISTS (
    SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=legacy_exercise_id_value
  ) THEN
    RAISE EXCEPTION '% prerequisite source rows are missing or identity moved', migration_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE facility_id=facility_id_value
      AND slug=definition_data->>'slug'
      AND id<>definition_id_value
  ) OR EXISTS (
    SELECT 1 FROM coaching.exercise_variant_v1
    WHERE id=ANY(active_variant_ids)
      AND definition_id<>definition_id_value
  ) THEN
    RAISE EXCEPTION '% working slug or exact variant UUID belongs to another card', migration_key;
  END IF;

  SELECT coalesce(sum(counted),0)
  INTO protected_count
  FROM (
    SELECT count(*)::INTEGER AS counted
    FROM coaching.exercise_definition_v1
    WHERE id=definition_id_value
      AND (status IN ('published','deprecated')
        OR reviewed_by IS NOT NULL
        OR approved_by IS NOT NULL
        OR last_reviewed_at IS NOT NULL)
    UNION ALL
    SELECT count(*)::INTEGER
    FROM coaching.exercise_section_evidence_v1
    WHERE definition_id=definition_id_value
      AND (reviewer_user_id IS NOT NULL OR review_status NOT IN ('candidate','superseded'))
    UNION ALL
    SELECT count(*)::INTEGER
    FROM coaching.exercise_media_candidate_v1
    WHERE definition_id=definition_id_value
      AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
        OR review_status NOT IN ('candidate','superseded'))
    UNION ALL
    SELECT count(*)::INTEGER
    FROM coaching.exercise_alternate_assessment_v1
    WHERE definition_id=definition_id_value
      AND (reviewer_user_id IS NOT NULL OR review_status NOT IN ('candidate','superseded'))
    UNION ALL
    SELECT count(*)::INTEGER
    FROM coaching.exercise_card_review_v1
    WHERE definition_id=definition_id_value
    UNION ALL
    SELECT count(*)::INTEGER
    FROM coaching.exercise_card_revision_v1
    WHERE definition_id=definition_id_value
    UNION ALL
    SELECT count(*)::INTEGER
    FROM coaching.exercise_media_review_v1
    WHERE definition_id=definition_id_value
    UNION ALL
    SELECT count(*)::INTEGER
    FROM coaching.exercise_relationship_v1
    WHERE (from_variant_id=ANY(owned_variant_ids) OR to_variant_id=ANY(owned_variant_ids))
      AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL
    SELECT count(*)::INTEGER
    FROM coaching.exercise_score_calibration_v1
    WHERE variant_id=ANY(owned_variant_ids)
      AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL
    SELECT count(*)::INTEGER
    FROM coaching.exercise_identity_resolution_v1
    WHERE survivor_definition_id=definition_id_value
      AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL
    SELECT count(*)::INTEGER
    FROM coaching.exercise_score_v1
    WHERE exercise_id=legacy_exercise_id_value
      AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records', migration_key, protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded', reviewer_user_id=NULL, reviewed_at=NULL, updated_at=now()
  WHERE definition_id=definition_id_value
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded', reviewer_user_id=NULL, reviewed_at=NULL,
      exact_variant_match=NULL, demonstration_quality_score=NULL, updated_at=now()
  WHERE definition_id=definition_id_value
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded', reviewer_user_id=NULL, reviewed_at=NULL, updated_at=now()
  WHERE definition_id=definition_id_value
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(owned_variant_ids) OR to_variant_id=ANY(owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(owned_variant_ids)
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1
  SET source_kind='legacy_migration',
      provenance_json=jsonb_build_object(
        'source_table','coaching.exercise',
        'migration',migration_key,
        'researchVersion',research_version,
        'identityContract',definition_data->>'identityContract',
        'representedBySelectableSourceVariants',to_jsonb(active_variant_ids),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE
      )
  WHERE definition_id=definition_id_value
    AND legacy_exercise_id=legacy_exercise_id_value;

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived', updated_at=now()
  WHERE variant_id=source_variant_id_value;
  UPDATE coaching.exercise_variant_v1
  SET variant_key=coalesce(source_variant_data->>'archiveKey',
        'superseded-source-' || legacy_exercise_id_value::TEXT || '-skeleton'),
      display_name=coalesce(source_variant_data->>'displayName',
        definition_data->>'displayName' || ' Legacy Skeleton'),
      modifier_keys='{}'::TEXT[],
      difficulty_json='{}'::JSONB,
      requirements_json=jsonb_build_object(
        'selectable',FALSE,
        'representation','superseded_source_skeleton',
        'sourceLegacyExerciseId',legacy_exercise_id_value,
        'archiveReason',source_variant_data->>'archiveReason',
        'replacementVariantIds',to_jsonb(active_variant_ids),
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE
      ),
      load_profile_json=jsonb_build_object('selectable',FALSE),
      fatigue_profile_json=jsonb_build_object('selectable',FALSE),
      programming_profile_json=jsonb_build_object(
        'selectionStatus','superseded_source_skeleton',
        'selectable',FALSE,
        'publicationQuarantined',TRUE
      ),
      status='archived',
      updated_at=now()
  WHERE id=source_variant_id_value;

  INSERT INTO coaching.exercise_definition_v1 (
    id, facility_id, legacy_exercise_id, slug, canonical_name, display_name,
    aliases, description, family_key, schema_version, card_version, status,
    content_confidence, scoring_confidence, media_confidence, movement_patterns,
    body_regions, required_equipment, optional_equipment, environment_json,
    population_json, provenance_json, approved_video_url, reviewed_by, approved_by,
    last_reviewed_at, anatomy_json, athlete_support_json, coach_support_json,
    support_operations_json
  ) VALUES (
    definition_id_value, facility_id_value, legacy_exercise_id_value,
    definition_data->>'slug', definition_data->>'canonicalName',
    definition_data->>'displayName',
    ARRAY(SELECT jsonb_array_elements_text(coalesce(definition_data->'aliases','[]'::JSONB))),
    definition_data->>'description', definition_data->>'familyKey',
    coalesce(definition_data->>'schemaVersion','2.0.0'),
    coalesce((definition_data->>'cardVersion')::INTEGER,2),
    'review',
    coalesce((definition_data#>>'{confidence,content}')::SMALLINT, 70),
    coalesce((definition_data#>>'{confidence,scoring}')::SMALLINT, 50),
    coalesce((definition_data#>>'{confidence,media}')::SMALLINT, 40),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(definition_data->'movementPatterns','[]'::JSONB))),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(definition_data->'bodyRegions','[]'::JSONB))),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(definition_data->'requiredEquipment','[]'::JSONB))),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(definition_data->'optionalEquipment','[]'::JSONB))),
    coalesce(definition_data->'environment','{}'::JSONB),
    coalesce(definition_data->'population','{}'::JSONB),
    coalesce(definition_data->'provenance','{}'::JSONB)
      || jsonb_build_object(
        'migration',migration_key,
        'researchVersion',research_version,
        'canonicalAuthoredFromResearch',TRUE,
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'externalPlaybackVerificationPerformed',FALSE,
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE
      ),
    NULL, NULL, NULL, NULL,
    coalesce(definition_data->'anatomy','{}'::JSONB),
    coalesce(definition_data->'athleteSupport','{}'::JSONB),
    coalesce(definition_data->'coachSupport','{}'::JSONB),
    coalesce(definition_data->'supportOperations','{}'::JSONB)
  )
  ON CONFLICT (id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,
    legacy_exercise_id=CASE
      WHEN preserve_definition_legacy_id
        THEN coaching.exercise_definition_v1.legacy_exercise_id
      ELSE EXCLUDED.legacy_exercise_id
    END,
    slug=EXCLUDED.slug,
    canonical_name=EXCLUDED.canonical_name,
    display_name=EXCLUDED.display_name,
    aliases=EXCLUDED.aliases,
    description=EXCLUDED.description,
    family_key=EXCLUDED.family_key,
    schema_version=EXCLUDED.schema_version,
    card_version=EXCLUDED.card_version,
    status='review',
    content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,
    media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,
    body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,
    optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,
    population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,
    approved_video_url=NULL,
    reviewed_by=NULL,
    approved_by=NULL,
    last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,
    athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,
    updated_at=now();

  FOR variant_data IN SELECT value FROM jsonb_array_elements(p_card->'variants')
  LOOP
    INSERT INTO coaching.exercise_variant_v1 (
      id, definition_id, variant_key, display_name, modifier_keys,
      difficulty_json, requirements_json, status, load_profile_json,
      fatigue_profile_json, programming_profile_json
    ) VALUES (
      (variant_data->>'id')::UUID, definition_id_value, variant_data->>'key',
      variant_data->>'displayName',
      ARRAY(SELECT jsonb_array_elements_text(coalesce(variant_data->'modifierKeys','[]'::JSONB))),
      coalesce(variant_data->'difficulty','{}'::JSONB),
      coalesce(variant_data->'requirements','{}'::JSONB) || jsonb_build_object(
        'selectable',TRUE,
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE
      ),
      'review',
      coalesce(variant_data->'loadProfile','{}'::JSONB),
      coalesce(variant_data->'fatigueProfile','{}'::JSONB),
      coalesce(variant_data->'programmingProfile','{}'::JSONB)
        || jsonb_build_object('publicationQuarantined',TRUE)
    )
    ON CONFLICT (id) DO UPDATE SET
      definition_id=EXCLUDED.definition_id,
      variant_key=EXCLUDED.variant_key,
      display_name=EXCLUDED.display_name,
      modifier_keys=EXCLUDED.modifier_keys,
      difficulty_json=EXCLUDED.difficulty_json,
      requirements_json=EXCLUDED.requirements_json,
      status='review',
      load_profile_json=EXCLUDED.load_profile_json,
      fatigue_profile_json=EXCLUDED.fatigue_profile_json,
      programming_profile_json=EXCLUDED.programming_profile_json,
      updated_at=now();

    FOR profile_data IN
      SELECT value FROM jsonb_array_elements(coalesce(variant_data->'deliveryProfiles','[]'::JSONB))
    LOOP
      INSERT INTO coaching.exercise_delivery_profile_v1 (
        variant_id, profile_key, phase_key, role, purpose, phase_suitability,
        methodology_alignment, objective_relevance_json, dosage_json, quality_gate,
        stop_rules, coach_instructions, athlete_instructions, expected_adaptation,
        equipment_required, logistics_json, substitution_ids, status, time_model_json,
        dose_scaling_json, measurement_json, support_prompts_json
      ) VALUES (
        (variant_data->>'id')::UUID, profile_data->>'key', profile_data->>'phase',
        profile_data->>'role', profile_data->>'purpose',
        (profile_data->>'suitability')::SMALLINT,
        nullif(profile_data->>'methodologyAlignment','')::SMALLINT,
        coalesce(profile_data->'objectiveRelevance','{}'::JSONB),
        coalesce(profile_data->'dosage','{}'::JSONB),
        profile_data->>'qualityGate',
        ARRAY(SELECT jsonb_array_elements_text(coalesce(profile_data->'stopRules','[]'::JSONB))),
        profile_data->>'coachInstructions',
        profile_data->>'athleteInstructions',
        profile_data->>'expectedAdaptation',
        ARRAY(SELECT jsonb_array_elements_text(coalesce(profile_data->'equipmentRequired','[]'::JSONB))),
        coalesce(profile_data->'logistics','{}'::JSONB),
        ARRAY(SELECT jsonb_array_elements_text(coalesce(profile_data->'substitutionIds','[]'::JSONB)))::UUID[],
        'review',
        coalesce(profile_data->'timeModel','{}'::JSONB),
        coalesce(profile_data->'doseScaling','{}'::JSONB),
        coalesce(profile_data->'measurement','{}'::JSONB),
        coalesce(profile_data->'supportPrompts','{}'::JSONB)
      )
      ON CONFLICT (variant_id,profile_key) DO UPDATE SET
        phase_key=EXCLUDED.phase_key,
        role=EXCLUDED.role,
        purpose=EXCLUDED.purpose,
        phase_suitability=EXCLUDED.phase_suitability,
        methodology_alignment=EXCLUDED.methodology_alignment,
        objective_relevance_json=EXCLUDED.objective_relevance_json,
        dosage_json=EXCLUDED.dosage_json,
        quality_gate=EXCLUDED.quality_gate,
        stop_rules=EXCLUDED.stop_rules,
        coach_instructions=EXCLUDED.coach_instructions,
        athlete_instructions=EXCLUDED.athlete_instructions,
        expected_adaptation=EXCLUDED.expected_adaptation,
        equipment_required=EXCLUDED.equipment_required,
        logistics_json=EXCLUDED.logistics_json,
        substitution_ids=EXCLUDED.substitution_ids,
        status='review',
        time_model_json=EXCLUDED.time_model_json,
        dose_scaling_json=EXCLUDED.dose_scaling_json,
        measurement_json=EXCLUDED.measurement_json,
        support_prompts_json=EXCLUDED.support_prompts_json,
        updated_at=now();
    END LOOP;
  END LOOP;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived', updated_at=now()
  WHERE profile.variant_id=ANY(active_variant_ids)
    AND profile.status IN ('draft','review')
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_card->'variants') variant_item,
           jsonb_array_elements(coalesce(variant_item->'deliveryProfiles','[]'::JSONB)) profile_item
      WHERE (variant_item->>'id')::UUID=profile.variant_id
        AND profile_item->>'key'=profile.profile_key
    );

  FOR resolution_data IN
    SELECT value FROM jsonb_array_elements(coalesce(p_card->'identityResolutions','[]'::JSONB))
  LOOP
    INSERT INTO coaching.exercise_identity_resolution_v1 (
      facility_id, survivor_definition_id, resolved_definition_id, decision,
      rationale, evidence_json, resolution_source
    ) VALUES (
      facility_id_value, definition_id_value,
      (resolution_data->>'resolvedDefinitionId')::UUID,
      resolution_data->>'decision', resolution_data->>'rationale',
      coalesce(resolution_data->'evidence','{}'::JSONB),
      coalesce(resolution_data->>'resolutionSource','deterministic_identity_equivalence')
    )
    ON CONFLICT (survivor_definition_id,resolved_definition_id) DO UPDATE SET
      decision=EXCLUDED.decision,
      rationale=EXCLUDED.rationale,
      evidence_json=EXCLUDED.evidence_json,
      resolution_source=EXCLUDED.resolution_source,
      resolved_at=now()
    WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
      AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';
  END LOOP;

  FOR evidence_data IN SELECT value FROM jsonb_array_elements(p_card->'evidence')
  LOOP
    INSERT INTO coaching.exercise_section_evidence_v1 (
      definition_id, reviewed_card_version, section_key, source_url, source_title,
      source_publisher, source_kind, claims_json, evidence_quality, review_status
    ) VALUES (
      definition_id_value, (definition_data->>'cardVersion')::INTEGER,
      evidence_data->>'sectionKey', evidence_data->>'sourceUrl',
      evidence_data->>'sourceTitle', evidence_data->>'sourcePublisher',
      evidence_data->>'sourceKind', coalesce(evidence_data->'claims','[]'::JSONB),
      (evidence_data->>'evidenceQuality')::SMALLINT, 'candidate'
    )
    ON CONFLICT (definition_id,reviewed_card_version,section_key,source_url)
    DO UPDATE SET
      source_title=EXCLUDED.source_title,
      source_publisher=EXCLUDED.source_publisher,
      source_kind=EXCLUDED.source_kind,
      claims_json=EXCLUDED.claims_json,
      evidence_quality=EXCLUDED.evidence_quality,
      review_status='candidate',
      reviewer_user_id=NULL,
      reviewed_at=NULL,
      updated_at=now();
  END LOOP;

  FOR media_data IN SELECT value FROM jsonb_array_elements(p_card->'media')
  LOOP
    INSERT INTO coaching.exercise_media_candidate_v1 (
      definition_id, variant_id, reviewed_card_version, url, embed_url, video_id,
      title, channel_name, review_status, link_status, discovery_method,
      source_query, notes, embedding_allowed
    ) VALUES (
      definition_id_value, NULL, (definition_data->>'cardVersion')::INTEGER,
      media_data->>'url',
      'https://www.youtube-nocookie.com/embed/' || (media_data->>'videoId'),
      media_data->>'videoId',
      media_data->>'title', media_data->>'channelName',
      'candidate', coalesce(media_data->>'linkStatus','unverified'),
      'manual_research', media_data->>'sourceQuery', media_data->>'notes',
      coalesce((media_data->>'embeddingAllowed')::BOOLEAN,FALSE)
    )
    ON CONFLICT (definition_id,reviewed_card_version,video_id)
    DO UPDATE SET
      variant_id=NULL,
      title=EXCLUDED.title,
      channel_name=EXCLUDED.channel_name,
      review_status='candidate',
      link_status=EXCLUDED.link_status,
      discovery_method=EXCLUDED.discovery_method,
      source_query=EXCLUDED.source_query,
      notes=EXCLUDED.notes,
      embedding_allowed=EXCLUDED.embedding_allowed,
      exact_variant_match=NULL,
      demonstration_quality_score=NULL,
      reviewer_user_id=NULL,
      reviewed_at=NULL,
      updated_at=now();
  END LOOP;

  FOR alternate_data IN SELECT value FROM jsonb_array_elements(p_card->'alternates')
  LOOP
    INSERT INTO coaching.exercise_alternate_assessment_v1 (
      definition_id, reviewed_card_version, alternate_name, classification,
      rationale, distinguishing_dimensions, proposed_card_json, review_status
    ) VALUES (
      definition_id_value, (definition_data->>'cardVersion')::INTEGER,
      alternate_data->>'name', alternate_data->>'classification',
      alternate_data->>'rationale',
      coalesce(alternate_data->'distinguishingDimensions','{}'::JSONB),
      alternate_data->'proposedCard', 'candidate'
    )
    ON CONFLICT (definition_id,reviewed_card_version,alternate_name)
    DO UPDATE SET
      classification=EXCLUDED.classification,
      rationale=EXCLUDED.rationale,
      distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
      proposed_card_json=EXCLUDED.proposed_card_json,
      review_status='candidate',
      reviewer_user_id=NULL,
      reviewed_at=NULL,
      updated_at=now();
  END LOOP;

  FOR relationship_data IN
    SELECT value FROM jsonb_array_elements(coalesce(p_card->'relationships','[]'::JSONB))
  LOOP
    INSERT INTO coaching.exercise_relationship_v1 (
      from_variant_id, to_variant_id, relationship, similarity_score,
      dimensions, reason, conditions_json, review_status
    ) VALUES (
      (relationship_data->>'fromVariantId')::UUID,
      (relationship_data->>'toVariantId')::UUID,
      relationship_data->>'relationship',
      (relationship_data->>'similarityScore')::SMALLINT,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(relationship_data->'dimensions','[]'::JSONB))),
      relationship_data->>'reason',
      coalesce(relationship_data->'conditions','{}'::JSONB),
      'review'
    )
    ON CONFLICT (from_variant_id,to_variant_id,relationship)
    DO UPDATE SET
      similarity_score=EXCLUDED.similarity_score,
      dimensions=EXCLUDED.dimensions,
      reason=EXCLUDED.reason,
      conditions_json=EXCLUDED.conditions_json,
      review_status='review'
    WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
      AND coaching.exercise_relationship_v1.review_status<>'approved';
  END LOOP;

  FOR calibration_data IN
    SELECT value FROM jsonb_array_elements(coalesce(p_card->'calibrations','[]'::JSONB))
  LOOP
    INSERT INTO coaching.exercise_score_calibration_v1 (
      facility_id, variant_id, dimension, proposed_score, anchor_tier,
      rationale, status, version
    ) VALUES (
      facility_id_value, (calibration_data->>'variantId')::UUID,
      calibration_data->>'dimension',
      (calibration_data->>'proposedScore')::SMALLINT,
      (calibration_data->>'anchorTier')::SMALLINT,
      calibration_data->>'rationale', 'review', 1
    )
    ON CONFLICT (facility_id,variant_id,dimension,version)
    DO UPDATE SET
      proposed_score=EXCLUDED.proposed_score,
      anchor_tier=EXCLUDED.anchor_tier,
      rationale=EXCLUDED.rationale,
      status='review',
      reviewed_by=NULL,
      review_notes=NULL,
      reviewed_at=NULL,
      updated_at=now();
  END LOOP;

  UPDATE coaching.exercise
  SET description=legacy_data->>'description',
      skill_level=NULL,
      age_min=NULL,
      age_max=NULL,
      default_sets=(legacy_data->>'defaultSets')::INTEGER,
      default_reps=(legacy_data->>'defaultReps')::INTEGER,
      default_work_seconds=(legacy_data->>'defaultWorkSeconds')::INTEGER,
      default_rest_seconds=(legacy_data->>'defaultRestSeconds')::INTEGER,
      tempo=legacy_data->>'tempo',
      load_note=legacy_data->>'loadNote',
      est_seconds_per_set=coalesce(
        (legacy_data->>'estimatedSecondsPerSet')::INTEGER,
        (legacy_data->>'defaultWorkSeconds')::INTEGER,
        60
      ),
      is_published=FALSE,
      archived=CASE
        WHEN preserve_legacy_archived THEN coaching.exercise.archived
        ELSE FALSE
      END,
      card_summary=legacy_data->>'cardSummary',
      coach_language=legacy_data->>'coachLanguage',
      athlete_language=legacy_data->>'athleteLanguage',
      programming_logic=coalesce(legacy_data->'programmingLogic','{}'::JSONB),
      scalable_variables=ARRAY(SELECT jsonb_array_elements_text(coalesce(legacy_data->'scalableVariables','[]'::JSONB))),
      movement_family=legacy_data->>'movementFamily',
      primary_phase_key=legacy_data->>'primaryPhaseKey',
      phase_subrole=legacy_data->>'phaseSubrole',
      primary_order_slot=legacy_data->>'primaryOrderSlot',
      movement_requirements=coalesce(legacy_data->'movementRequirements','{}'::JSONB),
      coaching_execution=coalesce(legacy_data->'coachingExecution','{}'::JSONB),
      pairing_logic=coalesce(legacy_data->'pairingLogic','{}'::JSONB),
      media_library=coalesce(legacy_data->'mediaLibrary','{}'::JSONB),
      participant_structure=coalesce(legacy_data->>'participantStructure','individual'),
      programming_kind=coalesce(legacy_data->>'programmingKind','exercise'),
      linked_skill_id=NULL,
      why_publish_ready=FALSE,
      updated_at=now()
  WHERE id=legacy_exercise_id_value;

  UPDATE coaching.exercise_safety_profile
  SET risk_level=(safety_data->>'riskLevel')::INTEGER,
      impact_level=(safety_data->>'impactLevel')::INTEGER,
      minimum_age_recommended=NULL,
      minimum_skill_level=NULL,
      requires_spotting=coalesce((safety_data->>'requiresSpotting')::BOOLEAN,FALSE),
      requires_coach_supervision=coalesce(safety_data->>'coachSupervision','recommended'),
      minimum_prerequisite_notes=safety_data->>'prerequisiteNotes',
      readiness_checks=ARRAY(SELECT jsonb_array_elements_text(coalesce(safety_data->'readinessChecks','[]'::JSONB))),
      stop_signs=ARRAY(SELECT jsonb_array_elements_text(coalesce(safety_data->'stopSigns','[]'::JSONB))),
      contraindications=ARRAY(SELECT jsonb_array_elements_text(coalesce(safety_data->'contraindications','[]'::JSONB))),
      common_substitutions=ARRAY(SELECT jsonb_array_elements_text(coalesce(safety_data->'commonSubstitutions','[]'::JSONB)))
  WHERE exercise_id=legacy_exercise_id_value;

  UPDATE coaching.exercise_score_v1
  SET technical_complexity=(score_data->>'technicalComplexity')::SMALLINT,
      absolute_load_demand=(score_data->>'absoluteLoadDemand')::SMALLINT,
      coordination_demand=(score_data->>'coordinationDemand')::SMALLINT,
      impact=(score_data->>'impact')::SMALLINT,
      supervision_demand=(score_data->>'supervisionDemand')::SMALLINT,
      base_overall_difficulty=greatest(
        (score_data->>'technicalComplexity')::SMALLINT,
        (score_data->>'absoluteLoadDemand')::SMALLINT
      ),
      legacy_scores=coalesce(legacy_scores,'{}'::JSONB) || coalesce(score_data->'legacyScores','{}'::JSONB)
        || jsonb_build_object(
          'candidateReassessment',migration_key,
          'researchVersion',research_version,
          'difficultyModel','max_exercise_complexity_physical_difficulty',
          'exerciseScoresDescribeTaskOnly',TRUE,
          'independentCalibrationRequired',TRUE,
          'humanReviewRequired',TRUE,
          'approvalsCreated',FALSE
        ),
      migration_confidence=(score_data->>'confidence')::SMALLINT,
      human_review_status='queued',
      reviewed_by=NULL,
      reviewed_at=NULL,
      review_notes=coalesce(score_data->>'reviewNotes',
        'Candidate reassessment only. Scores describe the exercise task, not a person. Independent calibration and human content review remain required.'),
      updated_at=now()
  WHERE exercise_id=legacy_exercise_id_value;

  UPDATE coaching.exercise_difficulty_profile
  SET technical=(score_data#>>'{difficultyProfile,technical}')::NUMERIC,
      complexity=(score_data#>>'{difficultyProfile,complexity}')::NUMERIC,
      load=greatest(
        coalesce((score_data#>>'{difficultyProfile,load}')::NUMERIC, 1.0),
        1.0
      ),
      overall=(score_data#>>'{difficultyProfile,overall}')::NUMERIC,
      recommended_age_min=NULL,
      recommended_age_max=NULL,
      attention_demand=CASE score_data#>>'{difficultyProfile,attentionDemand}'
        WHEN 'low' THEN 'low'
        WHEN 'moderate' THEN 'moderate'
        WHEN 'high' THEN 'high'
        WHEN 'low_to_moderate' THEN 'moderate'
        WHEN 'moderate_to_high' THEN 'high'
        ELSE 'moderate'
      END,
      notes=score_data#>>'{difficultyProfile,notes}',
      source='canonical_research_candidate',
      updated_at=now()
  WHERE exercise_id=legacy_exercise_id_value;

  INSERT INTO coaching.exercise_card_test_packet_v1 (
    definition_id, facility_id, card_version, schema_version, audit_version,
    status, checks_json, blocking_issues_json, human_review_required, checked_at
  ) VALUES (
    definition_id_value, facility_id_value, (definition_data->>'cardVersion')::INTEGER,
    coalesce(definition_data->>'schemaVersion','2.0.0'),
    packet_data->>'auditVersion', 'quarantined',
    coalesce(packet_data->'checks','{}'::JSONB),
    coalesce(packet_data->'blockingIssues','[]'::JSONB),
    TRUE, now()
  )
  ON CONFLICT (definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,
    card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,
    audit_version=EXCLUDED.audit_version,
    status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,
    checked_at=now();

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    CROSS JOIN LATERAL unnest(definition.movement_patterns) item(key)
    WHERE definition.id=definition_id_value
      AND NOT EXISTS (SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=item.key)
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    CROSS JOIN LATERAL unnest(definition.body_regions) item(key)
    WHERE definition.id=definition_id_value
      AND NOT EXISTS (SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=item.key)
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_variant_v1 variant
    CROSS JOIN LATERAL jsonb_array_elements_text(variant.requirements_json->'equipment') item(key)
    WHERE variant.id=ANY(active_variant_ids)
      AND NOT EXISTS (SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=item.key)
  ) THEN
    RAISE EXCEPTION '% authored uncontrolled taxonomy', migration_key;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_variant_v1
    WHERE id=ANY(active_variant_ids)
      AND (
        status<>'review'
        OR requirements_json->>'selectable'<>'true'
        OR (difficulty_json->>'baseOverallDifficulty')::INTEGER
          <> greatest(
            (difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'physicalDifficulty')::INTEGER
          )
        OR programming_profile_json->>'publicationQuarantined'<>'true'
      )
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE id=definition_id_value
      AND (status<>'review' OR approved_video_url IS NOT NULL
        OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise
    WHERE id=legacy_exercise_id_value
      AND (skill_level IS NOT NULL OR age_min IS NOT NULL OR age_max IS NOT NULL
        OR linked_skill_id IS NOT NULL OR is_published OR why_publish_ready)
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_card_test_packet_v1
    WHERE definition_id=definition_id_value
      AND (status<>'quarantined' OR NOT human_review_required
        OR jsonb_array_length(blocking_issues_json) < 4)
  ) THEN
    RAISE EXCEPTION '% candidate-only invariant failed', migration_key;
  END IF;
END;
$materializer$;

REVOKE ALL ON FUNCTION coaching.apply_candidate_exercise_card_v1(JSONB) FROM PUBLIC;
