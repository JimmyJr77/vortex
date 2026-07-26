-- T&T and other governing-body catalogs include individual skill-library cards.
-- This classification belongs to coaching.skill, not coaching.exercise.

ALTER TABLE coaching.skill
  DROP CONSTRAINT IF EXISTS skill_skill_kind_check;

ALTER TABLE coaching.skill
  ADD CONSTRAINT skill_skill_kind_check
  CHECK (skill_kind IN ('skill', 'combo', 'hold', 'partner', 'individual'));
