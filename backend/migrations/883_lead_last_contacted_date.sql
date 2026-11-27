-- The editable last-contact date is distinct from the first contact timestamp.
-- Backfill only when the column is first introduced: replaying this additive
-- migration must never restore a date staff deliberately cleared later.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='registrations' AND column_name='last_contacted_date') THEN
    ALTER TABLE registrations ADD COLUMN last_contacted_date DATE;
    UPDATE registrations r SET last_contacted_date=(r.first_contacted_at AT TIME ZONE
      COALESCE((SELECT NULLIF(f.timezone,'') FROM facility f WHERE f.id=r.facility_id),'America/New_York'))::date
    WHERE r.first_contacted_at IS NOT NULL;
  END IF;
END $$;
