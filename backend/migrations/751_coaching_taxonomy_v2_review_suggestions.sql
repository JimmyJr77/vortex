-- Conservative Taxonomy v2 suggestions derived from existing canonical facts.
-- Every row remains review-only; no reviewer, approval, media, calibration, or
-- publication evidence is created. Ambiguous legacy categories are not copied.
-- IDEMPOTENT.

WITH candidates(definition_id, facet_type, term_key, role, weight, confidence, rule_key) AS (
  SELECT d.id, 'training_family', 'general_resistance', 'compatible', 4, 70,
         'legacy_resistance_or_external_load'
  FROM coaching.exercise_definition_v1 d
  WHERE d.status != 'archived' AND (
    d.required_equipment && ARRAY['barbell','dumbbell','kettlebell','trap_bar','landmine','cable','machine','bands','resistance_band','sandbag']::TEXT[]
    OR EXISTS (
      SELECT 1 FROM coaching.exercise_definition_source_v1 source
      JOIN coaching.exercise_tag tag ON tag.exercise_id=source.legacy_exercise_id AND tag.facet_type='methodology'
      JOIN coaching.methodology method ON method.id=tag.facet_id
      WHERE source.definition_id=d.id AND method.key IN ('resistance_calisthenics','strength_training')
    )
  )
  UNION ALL
  SELECT d.id, 'training_family', 'calisthenics', 'compatible', 4, 68,
         'bodyweight_calisthenic_identity'
  FROM coaching.exercise_definition_v1 d
  WHERE d.status != 'archived'
    AND lower(d.canonical_name) ~ '(push[- ]?up|pull[- ]?up|chin[- ]?up|dip|plank|hollow|arch body|handstand|bodyweight|bear crawl|dead bug|bird dog)'
  UNION ALL
  SELECT d.id, 'training_family', 'powerlifting', 'compatible', 5, 82,
         'exact_powerlifting_lift_identity'
  FROM coaching.exercise_definition_v1 d
  WHERE d.status != 'archived'
    AND lower(d.canonical_name) ~ '^(back squat|bench press|conventional deadlift|sumo deadlift)$'
  UNION ALL
  SELECT d.id, 'training_family', 'olympic_weightlifting', 'compatible', 5, 78,
         'olympic_lift_name_and_barbell'
  FROM coaching.exercise_definition_v1 d
  WHERE d.status != 'archived' AND 'barbell'=ANY(d.required_equipment)
    AND lower(d.canonical_name) ~ '(^| )(clean|snatch|jerk)( |$)|clean pull|snatch pull'
  UNION ALL
  SELECT d.id, 'training_family', 'loaded_carry_training', 'compatible', 5, 85,
         'loaded_carry_identity'
  FROM coaching.exercise_definition_v1 d
  WHERE d.status != 'archived'
    AND (d.movement_patterns && ARRAY['carry','loaded_carry']::TEXT[] OR lower(d.canonical_name) ~ '(carry|farmer walk|yoke walk)')
  UNION ALL
  SELECT d.id, 'training_family', 'kettlebell_training', 'compatible', 4, 75,
         'traditional_kettlebell_identity'
  FROM coaching.exercise_definition_v1 d
  WHERE d.status != 'archived' AND 'kettlebell'=ANY(d.required_equipment)
    AND lower(d.canonical_name) ~ '(swing|snatch|clean|turkish get|windmill)'
  UNION ALL
  SELECT d.id, 'training_family', 'sprinting', 'compatible', 5, 78,
         'sprint_identity'
  FROM coaching.exercise_definition_v1 d
  WHERE d.status != 'archived' AND lower(d.canonical_name) ~ '(sprint|acceleration|max velocity|flying [0-9])'
  UNION ALL
  SELECT d.id, 'training_family', 'jumping_landing', 'compatible', 5, 78,
         'jump_hop_bound_land_identity'
  FROM coaching.exercise_definition_v1 d
  WHERE d.status != 'archived' AND lower(d.canonical_name) ~ '(jump|hop|bound|landing|snap[- ]?down|pogo)'
  UNION ALL
  SELECT d.id, 'training_family', 'throwing', 'compatible', 5, 78,
         'throw_toss_slam_identity'
  FROM coaching.exercise_definition_v1 d
  WHERE d.status != 'archived' AND lower(d.canonical_name) ~ '(throw|toss|slam|shot put)'
  UNION ALL
  SELECT d.id, 'training_family', 'change_of_direction_agility', 'compatible', 5, 78,
         'cut_shuffle_change_direction_identity'
  FROM coaching.exercise_definition_v1 d
  WHERE d.status != 'archived' AND lower(d.canonical_name) ~ '(cut|shuffle|change of direction|reactive agility|shuttle)'
  UNION ALL
  SELECT d.id, 'training_family', 'mobility_recovery', 'compatible', 4, 72,
         'mobility_recovery_identity'
  FROM coaching.exercise_definition_v1 d
  WHERE d.status != 'archived' AND (d.movement_patterns && ARRAY['mobility','breathing_downregulation']::TEXT[]
    OR lower(d.canonical_name) ~ '(mobility|stretch|breathing|cars|rocker|rockback)')
), resolved AS (
  SELECT candidates.*, term.id AS term_id
  FROM candidates
  JOIN coaching.taxonomy_term_v2 term
    ON term.facet_type=candidates.facet_type AND term.key=candidates.term_key
)
INSERT INTO coaching.exercise_taxonomy_assignment_v2 (
  definition_id,subject_scope,term_id,assignment_role,weight,confidence,review_status,provenance_json
)
SELECT definition_id,'definition',term_id,role,weight,confidence,'review',jsonb_build_object(
  'taxonomyVersion','2.0.0','sourceType','deterministic_canonical_fact',
  'ruleKey',rule_key,'humanReviewRequired',TRUE,'approvalCreated',FALSE
)
FROM resolved
ON CONFLICT (definition_id,term_id) WHERE definition_id IS NOT NULL DO NOTHING;

-- Definition-level movement character suggestions. The low-confidence fallback
-- only fills the review queue; it is never treated as approval.
WITH candidates AS (
  SELECT d.id AS definition_id,
         CASE
           WHEN lower(d.canonical_name) ~ '(isometric| hold$|dead hang)' THEN 'static_isometric'
           WHEN lower(d.canonical_name) ~ '(pogo|rebound|bound|depth jump)' THEN 'elastic_reactive'
           WHEN lower(d.canonical_name) ~ '(jump|throw|toss|slam|sprint|explosive)' THEN 'explosive'
           WHEN d.movement_patterns && ARRAY['run','sprint','crawl','climb','carry']::TEXT[] THEN 'locomotor'
           ELSE 'controlled_dynamic'
         END AS term_key,
         CASE WHEN lower(d.canonical_name) ~ '(isometric| hold$|dead hang|pogo|rebound|bound|depth jump|jump|throw|toss|slam|sprint|explosive)'
           OR d.movement_patterns && ARRAY['run','sprint','crawl','climb','carry']::TEXT[] THEN 78 ELSE 55 END AS confidence
  FROM coaching.exercise_definition_v1 d WHERE d.status != 'archived'
), resolved AS (
  SELECT candidates.*,term.id AS term_id FROM candidates
  JOIN coaching.taxonomy_term_v2 term ON term.facet_type='movement_character' AND term.key=candidates.term_key
)
INSERT INTO coaching.exercise_taxonomy_assignment_v2 (
  definition_id,subject_scope,term_id,assignment_role,weight,confidence,review_status,provenance_json
)
SELECT definition_id,'definition',term_id,'primary',5,confidence,'review',jsonb_build_object(
  'taxonomyVersion','2.0.0','sourceType','deterministic_canonical_fact',
  'ruleKey','movement_character_identity_heuristic','humanReviewRequired',TRUE,'approvalCreated',FALSE
)
FROM resolved
ON CONFLICT (definition_id,term_id) WHERE definition_id IS NOT NULL DO NOTHING;

-- Exact variants inherit movement-character compatibility only as a suggestion.
INSERT INTO coaching.exercise_taxonomy_assignment_v2 (
  variant_id,subject_scope,term_id,assignment_role,weight,confidence,review_status,provenance_json
)
SELECT variant.id,'variant',assignment.term_id,'compatible',assignment.weight,
       LEAST(assignment.confidence,70),'review',jsonb_build_object(
         'taxonomyVersion','2.0.0','sourceType','definition_compatibility_inheritance',
         'sourceAssignmentId',assignment.id,'humanReviewRequired',TRUE,'approvalCreated',FALSE
       )
FROM coaching.exercise_variant_v1 variant
JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
JOIN coaching.exercise_taxonomy_assignment_v2 assignment ON assignment.definition_id=definition.id
JOIN coaching.taxonomy_term_v2 term ON term.id=assignment.term_id AND term.facet_type='movement_character'
WHERE definition.status!='archived' AND variant.status!='archived'
ON CONFLICT (variant_id,term_id) WHERE variant_id IS NOT NULL DO NOTHING;

-- Conservative force-velocity suggestions are limited to identities with a
-- strong movement-character signal. Other variants remain explicitly missing.
WITH candidates AS (
  SELECT variant.id AS variant_id,
         CASE character.key
           WHEN 'elastic_reactive' THEN 'reactive_strength'
           WHEN 'explosive' THEN 'peak_power'
           ELSE NULL
         END AS term_key
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  JOIN coaching.exercise_taxonomy_assignment_v2 assignment ON assignment.definition_id=definition.id
  JOIN coaching.taxonomy_term_v2 character ON character.id=assignment.term_id
    AND character.facet_type='movement_character'
  WHERE definition.status!='archived' AND variant.status!='archived'
), resolved AS (
  SELECT candidates.variant_id,term.id AS term_id FROM candidates
  JOIN coaching.taxonomy_term_v2 term ON term.facet_type='force_velocity' AND term.key=candidates.term_key
  WHERE candidates.term_key IS NOT NULL
)
INSERT INTO coaching.exercise_taxonomy_assignment_v2 (
  variant_id,subject_scope,term_id,assignment_role,weight,confidence,review_status,provenance_json
)
SELECT variant_id,'variant',term_id,'compatible',4,65,'review',jsonb_build_object(
  'taxonomyVersion','2.0.0','sourceType','movement_character_force_velocity_suggestion',
  'humanReviewRequired',TRUE,'approvalCreated',FALSE
)
FROM resolved
ON CONFLICT (variant_id,term_id) WHERE variant_id IS NOT NULL DO NOTHING;

-- Name and movement facts can safely nominate Athletic Niche review targets;
-- they cannot approve the selection intent for a delivery profile.
WITH candidates AS (
  SELECT d.id AS definition_id,
         CASE
           WHEN lower(d.canonical_name) ~ '(first step|falling start|ground start|acceleration)' THEN 'acceleration'
           WHEN lower(d.canonical_name) ~ '(max velocity|flying sprint)' THEN 'maximum_velocity'
           WHEN lower(d.canonical_name) ~ '(decel|deceleration|snap[- ]?down|stick landing)' THEN 'deceleration'
           WHEN lower(d.canonical_name) ~ '(change of direction|[0-9]+ degree cut|shuttle)' THEN 'change_of_direction'
           WHEN lower(d.canonical_name) ~ '(reactive agility|reaction.*cut|color call|point and go)' THEN 'reactive_agility'
           WHEN lower(d.canonical_name) ~ '(vertical jump|box jump|depth jump)' THEN 'vertical_jump_power'
           WHEN lower(d.canonical_name) ~ '(broad jump|forward jump|horizontal jump)' THEN 'horizontal_jump_power'
           WHEN lower(d.canonical_name) ~ '(lateral jump|lateral bound|skater)' THEN 'lateral_jump_power'
           WHEN lower(d.canonical_name) ~ '(landing|snap[- ]?down|drop squat)' THEN 'landing_braking'
           WHEN lower(d.canonical_name) ~ '(rotational|rotation.*throw|shot put)' THEN 'rotational_power'
           WHEN lower(d.canonical_name) ~ '(overhead.*throw|overhead.*slam)' THEN 'overhead_throwing_power'
           WHEN lower(d.canonical_name) ~ '(carry|hang|grip)' THEN 'grip_strength'
           ELSE NULL
         END AS term_key
  FROM coaching.exercise_definition_v1 d WHERE d.status!='archived'
), resolved AS (
  SELECT candidates.definition_id,term.id AS term_id FROM candidates
  JOIN coaching.taxonomy_term_v2 term ON term.facet_type='athletic_niche' AND term.key=candidates.term_key
  WHERE candidates.term_key IS NOT NULL
)
INSERT INTO coaching.exercise_taxonomy_assignment_v2 (
  definition_id,subject_scope,term_id,assignment_role,weight,confidence,review_status,provenance_json
)
SELECT definition_id,'definition',term_id,'compatible',4,68,'review',jsonb_build_object(
  'taxonomyVersion','2.0.0','sourceType','identity_athletic_niche_suggestion',
  'humanReviewRequired',TRUE,'approvalCreated',FALSE
)
FROM resolved
ON CONFLICT (definition_id,term_id) WHERE definition_id IS NOT NULL DO NOTHING;

-- Weighted legacy Tenets are copied to each delivery profile as review evidence.
WITH candidates AS (
  SELECT profile.id AS delivery_profile_id, tenet.key AS term_key,
         GREATEST(1,LEAST(5,MAX(tag.weight)))::smallint AS weight
  FROM coaching.exercise_delivery_profile_v1 profile
  JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  JOIN coaching.exercise_definition_source_v1 source ON source.definition_id=definition.id
  JOIN coaching.exercise_tag tag ON tag.exercise_id=source.legacy_exercise_id AND tag.facet_type='tenet'
  JOIN coaching.tenet tenet ON tenet.id=tag.facet_id
  WHERE definition.status!='archived' AND variant.status!='archived' AND profile.status!='archived'
  GROUP BY profile.id,tenet.key
), resolved AS (
  SELECT candidates.*,term.id AS term_id FROM candidates
  JOIN coaching.taxonomy_term_v2 term ON term.facet_type='tenet' AND term.key=candidates.term_key
)
INSERT INTO coaching.exercise_taxonomy_assignment_v2 (
  delivery_profile_id,subject_scope,term_id,assignment_role,weight,confidence,review_status,provenance_json
)
SELECT delivery_profile_id,'delivery_profile',term_id,
       CASE WHEN weight=5 THEN 'primary' ELSE 'secondary' END,weight,60,'review',jsonb_build_object(
         'taxonomyVersion','2.0.0','sourceType','legacy_tenet_profile_suggestion',
         'humanReviewRequired',TRUE,'approvalCreated',FALSE
       )
FROM resolved
ON CONFLICT (delivery_profile_id,term_id) WHERE delivery_profile_id IS NOT NULL DO NOTHING;

-- Direct legacy methodology mappings are profile compatibility suggestions.
WITH candidates AS (
  SELECT DISTINCT profile.id AS delivery_profile_id,mapping.target_term_id AS term_id,
         GREATEST(1,LEAST(5,tag.weight))::smallint AS weight,mapping.confidence,
         method.key AS source_key
  FROM coaching.exercise_delivery_profile_v1 profile
  JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  JOIN coaching.exercise_definition_source_v1 source ON source.definition_id=definition.id
  JOIN coaching.exercise_tag tag ON tag.exercise_id=source.legacy_exercise_id AND tag.facet_type='methodology'
  JOIN coaching.methodology method ON method.id=tag.facet_id
  JOIN coaching.taxonomy_legacy_mapping_v2 mapping
    ON mapping.source_facet_type='methodology' AND mapping.source_key=method.key AND mapping.mapping_state='direct'
  JOIN coaching.taxonomy_term_v2 term ON term.id=mapping.target_term_id AND 'delivery_profile'=ANY(term.allowed_scopes)
  WHERE definition.status!='archived' AND variant.status!='archived' AND profile.status!='archived'
)
INSERT INTO coaching.exercise_taxonomy_assignment_v2 (
  delivery_profile_id,subject_scope,term_id,assignment_role,weight,confidence,review_status,provenance_json
)
SELECT delivery_profile_id,'delivery_profile',term_id,'compatible',MAX(weight),MIN(confidence),'review',jsonb_build_object(
  'taxonomyVersion','2.0.0','sourceType','legacy_methodology_profile_suggestion',
  'legacyKeys',array_agg(DISTINCT source_key ORDER BY source_key),
  'humanReviewRequired',TRUE,'approvalCreated',FALSE
)
FROM candidates GROUP BY delivery_profile_id,term_id
ON CONFLICT (delivery_profile_id,term_id) WHERE delivery_profile_id IS NOT NULL DO NOTHING;

-- Prescription-shape suggestions stay on delivery profiles.
WITH candidates AS (
  SELECT profile.id AS delivery_profile_id,
         CASE
           WHEN profile.dosage_json ? 'workSeconds' THEN 'programming_clock_structure:timed_set'
           WHEN profile.dosage_json ? 'reps' OR profile.dosage_json ? 'sets' THEN 'programming_set_structure:straight_sets'
           ELSE NULL
         END AS identity
  FROM coaching.exercise_delivery_profile_v1 profile
  JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE definition.status!='archived' AND variant.status!='archived' AND profile.status!='archived'
), resolved AS (
  SELECT candidates.delivery_profile_id,term.id AS term_id
  FROM candidates JOIN coaching.taxonomy_term_v2 term
    ON term.facet_type=split_part(candidates.identity,':',1)
   AND term.key=split_part(candidates.identity,':',2)
  WHERE candidates.identity IS NOT NULL
)
INSERT INTO coaching.exercise_taxonomy_assignment_v2 (
  delivery_profile_id,subject_scope,term_id,assignment_role,weight,confidence,review_status,provenance_json
)
SELECT delivery_profile_id,'delivery_profile',term_id,'default',4,65,'review',jsonb_build_object(
  'taxonomyVersion','2.0.0','sourceType','dosage_shape_suggestion',
  'humanReviewRequired',TRUE,'approvalCreated',FALSE
)
FROM resolved
ON CONFLICT (delivery_profile_id,term_id) WHERE delivery_profile_id IS NOT NULL DO NOTHING;
