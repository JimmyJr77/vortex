-- Programming Library audiences use training experience, never Skill Library
-- proficiency levels. Aerobic programming represents all applicable zones.
-- IDEMPOTENT.

ALTER TABLE coaching.programming_method_prescription_profile
  ADD COLUMN IF NOT EXISTS training_experience TEXT;

UPDATE coaching.programming_method_prescription_profile
SET training_experience = lower(skill_level::text)
WHERE training_experience IS NULL AND skill_level IS NOT NULL;

UPDATE coaching.programming_method_prescription_profile SET skill_level = NULL
WHERE skill_level IS NOT NULL;

ALTER TABLE coaching.programming_method_prescription_profile
  DROP CONSTRAINT IF EXISTS programming_method_prescription_profile_no_skill_level;
ALTER TABLE coaching.programming_method_prescription_profile
  ADD CONSTRAINT programming_method_prescription_profile_no_skill_level
  CHECK (skill_level IS NULL);

ALTER TABLE coaching.programming_method_prescription_profile
  DROP CONSTRAINT IF EXISTS programming_method_prescription_profile_training_experience_che;
ALTER TABLE coaching.programming_method_prescription_profile
  DROP CONSTRAINT IF EXISTS pmp_training_experience_check;
ALTER TABLE coaching.programming_method_prescription_profile
  ADD CONSTRAINT pmp_training_experience_check
  CHECK (training_experience IS NULL OR training_experience IN (
    'beginner','intermediate','advanced','elite'
  ));

UPDATE coaching.programming_method
SET category='Aerobic Conditioning (Zones 1-5)',updated_at=now()
WHERE category='Aerobic Base / Zone 2';
