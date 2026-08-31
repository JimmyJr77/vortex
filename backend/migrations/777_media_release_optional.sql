-- A media release is voluntary consent and must not block account creation.
UPDATE waiver_template
SET is_required = FALSE,
    updated_at = now()
WHERE waiver_type = 'MEDIA_RELEASE'
  AND is_required IS DISTINCT FROM FALSE;
