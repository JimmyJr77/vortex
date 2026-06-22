-- Youth athlete graduation year (family signup + admin)

ALTER TABLE member
  ADD COLUMN IF NOT EXISTS graduation_year INTEGER;

COMMENT ON COLUMN member.graduation_year IS
  'Expected high school graduation year for youth athletes.';
