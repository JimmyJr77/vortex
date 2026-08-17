-- A floor target is a delivery marker, not a controlled equipment taxonomy key
-- for the no-equipment bilateral forward-jump identity.
DO $forward_jump_target_taxonomy_correction$
DECLARE
  definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='forward-hop-to-stick-low-amplitude' AND status='review';
  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION '730_coaching_forward_jump_target_taxonomy_correction requires the active forward-jump review card';
  END IF;
  UPDATE coaching.exercise_definition_v1
  SET optional_equipment=array_remove(optional_equipment,'floor_target'),
      provenance_json=provenance_json || jsonb_build_object('targetTaxonomyCorrection','730_coaching_forward_jump_target_taxonomy_correction','humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
      updated_at=now()
  WHERE id=definition_id_value;
  IF EXISTS (SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=definition_id_value AND 'floor_target'=ANY(optional_equipment)) THEN
    RAISE EXCEPTION '730_coaching_forward_jump_target_taxonomy_correction failed to remove floor_target';
  END IF;
END;
$forward_jump_target_taxonomy_correction$;
