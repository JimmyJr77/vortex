ALTER TABLE payroll_i9_hiring_context
  ADD COLUMN IF NOT EXISTS participation_verified_on date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_i9_hiring_context_participation_date_required'
      AND conrelid = 'payroll_i9_hiring_context'::regclass
  ) THEN
    ALTER TABLE payroll_i9_hiring_context
      ADD CONSTRAINT payroll_i9_hiring_context_participation_date_required
      CHECK (participation_verified_on IS NOT NULL) NOT VALID;
  END IF;
END $$;
