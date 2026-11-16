-- Archiving one identity must not rewrite other household members. Household
-- relationships are canonical in family/family_member; this compatibility cache
-- is not an authorization, enrollment, or billing ownership signal.
DO $$
BEGIN
  IF to_regclass('public.member') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trigger_update_family_active ON public.member;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.update_family_active_status();
