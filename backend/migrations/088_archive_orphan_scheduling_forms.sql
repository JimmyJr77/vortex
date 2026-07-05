-- Soft-delete pre-unification scheduling forms that only had a stale override flag
-- and zero custom pricing. Verified 2026-07-05: no signups, offerings, coach
-- assignments, events, or stripe catalog rows for ids 25, 35, 36, 37.

UPDATE scheduling_form
SET deleted_at = COALESCE(deleted_at, now()),
    is_active = FALSE,
    pricing_overrides_program = FALSE,
    updated_at = now()
WHERE id IN (25, 35, 36, 37)
  AND deleted_at IS NULL;

-- Orphan class rows with no programs_id link (legacy pre-taxonomy products).
UPDATE program
SET archived = TRUE,
    updated_at = now()
WHERE id IN (36, 46, 47, 48)
  AND programs_id IS NULL
  AND archived IS NOT TRUE;
