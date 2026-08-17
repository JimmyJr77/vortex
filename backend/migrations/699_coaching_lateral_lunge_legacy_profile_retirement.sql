-- The `legacy-capacity` lateral-lunge profile is an incomplete historical
-- fragment.  The same exact review variant has two complete current profiles;
-- archive the fragment rather than filling it with invented dosage or support.
DO $lateral_lunge_profile_retirement$
DECLARE
  target_profile UUID;
BEGIN
  SELECT p.id INTO target_profile
  FROM coaching.exercise_definition_v1 d
  JOIN coaching.exercise_variant_v1 v ON v.definition_id=d.id
  JOIN coaching.exercise_delivery_profile_v1 p ON p.variant_id=v.id
  WHERE d.facility_id=1 AND d.slug='lateral-lunge'
    AND v.variant_key='bodyweight-step-out-full-cycle'
    AND p.profile_key='legacy-capacity' AND p.status='review';
  IF target_profile IS NULL THEN
    RAISE EXCEPTION '699_coaching_lateral_lunge_legacy_profile_retirement prerequisite profile is missing';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 d
    JOIN coaching.exercise_variant_v1 v ON v.definition_id=d.id
    WHERE d.facility_id=1 AND d.slug='lateral-lunge'
      AND (d.reviewed_by IS NOT NULL OR d.approved_by IS NOT NULL OR d.last_reviewed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '699_coaching_lateral_lunge_legacy_profile_retirement refuses human-reviewed content';
  END IF;
  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived', updated_at=now()
  WHERE id=target_profile;
END;
$lateral_lunge_profile_retirement$;
