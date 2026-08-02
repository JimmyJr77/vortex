-- Repair the machine-readable progression dimensions on the review-only edge
-- from the opposite-leg lateral bound to its 90-degree rotational neighbor.
-- This maps authored concepts to the controlled graph taxonomy; it creates no
-- coach approval, calibration approval, media approval, or publication state.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '469_coaching_lateral_bound_graph_taxonomy_closure';
  lateral_definition_id CONSTANT UUID :=
    '3c8db5f4-84d7-4f23-a400-abcea39207a4';
  rotational_definition_id CONSTANT UUID :=
    'b3a696c3-d189-49b3-a545-f3b9866353b7';
  lateral_variant_id UUID;
  rotational_variant_id UUID;
  updated_count INTEGER;
BEGIN
  SELECT variant.id INTO lateral_variant_id
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.definition_id=lateral_definition_id
    AND variant.variant_key='baseline'
    AND variant.status='review';

  SELECT variant.id INTO rotational_variant_id
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.definition_id=rotational_definition_id
    AND variant.status='review'
  ORDER BY variant.variant_key
  LIMIT 1;

  IF lateral_variant_id IS NULL OR rotational_variant_id IS NULL THEN
    RAISE EXCEPTION '% requires both review-only working variants',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1
    FROM coaching.exercise_relationship_v1 relationship
    WHERE relationship.from_variant_id=lateral_variant_id
      AND relationship.to_variant_id=rotational_variant_id
      AND relationship.relationship='progression'
      AND (relationship.review_status<>'review'
        OR relationship.created_by IS NOT NULL
        OR relationship.reviewed_by IS NOT NULL
        OR relationship.reviewed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refused to overwrite a reviewed relationship',
      migration_key;
  END IF;

  UPDATE coaching.exercise_relationship_v1 relationship
  SET dimensions=ARRAY['complexity','stability'],
      conditions_json=coalesce(relationship.conditions_json,'{}'::JSONB)
        ||jsonb_build_object(
          'controlledDimensionMapping',jsonb_build_object(
            'whole_body_rotation','complexity',
            'landing_heading','stability',
            'spatial_orientation','complexity'),
          'mappingScope','machine_taxonomy_correction_not_coach_approval'),
      review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
      updated_at=now()
  WHERE relationship.from_variant_id=lateral_variant_id
    AND relationship.to_variant_id=rotational_variant_id
    AND relationship.relationship='progression'
    AND relationship.review_status='review';
  GET DIAGNOSTICS updated_count=ROW_COUNT;

  IF updated_count<>1 THEN
    RAISE EXCEPTION '% expected exactly one review-only progression, updated %',
      migration_key,updated_count;
  END IF;

  UPDATE coaching.exercise_card_test_packet_v1 packet
  SET checks_json=(
        SELECT jsonb_agg(
          CASE WHEN check_row->>'id'='CARD-GRAPH-01'
            THEN check_row||jsonb_build_object(
              'status','passed',
              'evidence',jsonb_build_object(
                'invalidRelationshipIds',jsonb_build_array()))
            ELSE check_row END
          ORDER BY ordinal)
        FROM jsonb_array_elements(packet.checks_json)
          WITH ORDINALITY AS checks(check_row,ordinal)),
      blocking_issues_json=(
        SELECT coalesce(jsonb_agg(issue_row ORDER BY ordinal),'[]'::JSONB)
        FROM jsonb_array_elements(packet.blocking_issues_json)
          WITH ORDINALITY AS issues(issue_row,ordinal)
        WHERE issue_row->>'code'<>'CARD-GRAPH-01'),
      audit_version=migration_key,
      status='quarantined',human_review_required=TRUE,checked_at=now()
  WHERE packet.definition_id=lateral_definition_id
    AND jsonb_typeof(packet.checks_json)='array'
    AND jsonb_typeof(packet.blocking_issues_json)='array';

  IF EXISTS(
    SELECT 1
    FROM coaching.exercise_relationship_v1 relationship
    JOIN coaching.exercise_variant_v1 variant
      ON variant.id=relationship.from_variant_id
    WHERE variant.definition_id=lateral_definition_id
      AND (
        relationship.from_variant_id=relationship.to_variant_id
        OR relationship.relationship NOT IN(
          'regression','progression','lateral_substitution',
          'equipment_equivalent','phase_equivalent','compatible_pairing',
          'contraindicated_pairing')
        OR relationship.similarity_score NOT BETWEEN 1 AND 100
        OR btrim(relationship.reason)=''
        OR (relationship.relationship IN('progression','regression') AND (
          cardinality(relationship.dimensions)=0
          OR NOT relationship.dimensions <@ ARRAY[
            'load','leverage','range','speed','stability','complexity','impact',
            'decision_demand','fatigue']::TEXT[])))
  ) THEN
    RAISE EXCEPTION '% left an invalid current relationship edge',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_relationship_v1 relationship
    WHERE relationship.from_variant_id=lateral_variant_id
      AND relationship.to_variant_id=rotational_variant_id
      AND relationship.relationship='progression'
      AND (relationship.dimensions<>ARRAY['complexity','stability']::TEXT[]
        OR relationship.review_status<>'review'
        OR relationship.reviewed_by IS NOT NULL
        OR relationship.reviewed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% did not retain an unapproved controlled edge',
      migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise WHERE id=7
      AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=7 AND minimum_skill_level IS NOT NULL)
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_card_test_packet_v1 packet
      WHERE packet.definition_id=lateral_definition_id
        AND (packet.status<>'quarantined'
          OR packet.human_review_required<>TRUE
          OR jsonb_array_length(packet.blocking_issues_json)<>4
          OR EXISTS(
            SELECT 1 FROM jsonb_array_elements(packet.blocking_issues_json) issue
            WHERE issue->>'code' NOT IN(
              'CARD-MEDIA-01','CARD-PUBLISH-01','CARD-GRAPH-03',
              'CARD-CALIBRATION-01')))) THEN
    RAISE EXCEPTION '% changed proficiency metadata or human-review quarantine',
      migration_key;
  END IF;
END;
$$;
