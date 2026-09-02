-- Retire the catch-all member status derivation.
--
-- The compatibility member.status and cached waiver columns remain readable
-- while older clients are retired, but they no longer drive or mirror current
-- participation, waiver, household, portal, or staff-access state.

DO $$
BEGIN
  IF to_regclass('public.member') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_athlete_status ON member';
  END IF;

  IF to_regclass('public.member_program') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_status_on_enrollment ON member_program';
  END IF;
END $$;

DROP FUNCTION IF EXISTS update_member_athlete_status();
DROP FUNCTION IF EXISTS update_athlete_status_on_enrollment();

-- Canonical creation paths do not stamp misleading compatibility values.
-- Keep the columns readable during the retirement window, but require any
-- remaining legacy writer to opt in explicitly instead of inheriting a fake
-- "legacy" status, an empty guardian cache, or a false waiver cache.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'member' AND column_name = 'status'
  ) THEN
    ALTER TABLE member ALTER COLUMN status DROP DEFAULT;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'member' AND column_name = 'parent_guardian_ids'
  ) THEN
    ALTER TABLE member ALTER COLUMN parent_guardian_ids DROP DEFAULT;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'member' AND column_name = 'has_completed_waivers'
  ) THEN
    ALTER TABLE member ALTER COLUMN has_completed_waivers DROP DEFAULT;
  END IF;
END $$;

-- These compatibility columns exist in the current production schema, but
-- older or already-cleaned installations may legitimately omit one. Comments
-- are documentation, not a deployment prerequisite, so apply them only when
-- the target column is present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'member'
       AND column_name = 'status'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN member.status IS '
      || quote_literal(
        'Deprecated compatibility value. Record lifecycle uses is_active; participation is derived from enrollment records.'
      );
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'member'
       AND column_name = 'has_completed_waivers'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN member.has_completed_waivers IS '
      || quote_literal(
        'Deprecated compatibility cache. Current waiver state is derived from required templates and member_waiver_acceptance.'
      );
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'member'
       AND column_name = 'waiver_completion_date'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN member.waiver_completion_date IS '
      || quote_literal(
        'Deprecated compatibility cache. Canonical completion timestamps come from member_waiver_acceptance.accepted_at.'
      );
  END IF;
END $$;
