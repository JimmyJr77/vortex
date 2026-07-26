-- Preserve direct YouTube links from every legacy source card as unverified
-- candidates on the surviving canonical identity. Nothing is approved.
-- IDEMPOTENT.

WITH legacy_urls AS (
  SELECT
    source.definition_id,
    source.legacy_exercise_id,
    media_field.key AS source_field,
    btrim(media_url.value) AS source_url
  FROM coaching.exercise_definition_source_v1 source
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=source.definition_id
   AND definition.status!='archived'
  JOIN coaching.exercise legacy ON legacy.id=source.legacy_exercise_id
  CROSS JOIN LATERAL jsonb_each(COALESCE(legacy.media_library, '{}'::jsonb)) media_field
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(media_field.value)='array' THEN media_field.value
      ELSE '[]'::jsonb
    END
  ) media_url(value)
  WHERE btrim(media_url.value) ~
    '^https://(www\.)?(youtube\.com/watch\?([^#]*&)?v=|youtu\.be/)[A-Za-z0-9_-]{6,}'
),
normalized AS (
  SELECT DISTINCT ON (legacy.definition_id, video_match.video_id)
    legacy.definition_id,
    legacy.legacy_exercise_id,
    legacy.source_field,
    video_match.video_id
  FROM legacy_urls legacy
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      (regexp_match(
        legacy.source_url,
        'youtube\.com/watch\?[^#]*v=([A-Za-z0-9_-]{6,})'
      ))[1],
      (regexp_match(
        legacy.source_url,
        'youtu\.be/([A-Za-z0-9_-]{6,})'
      ))[1]
    ) AS video_id
  ) video_match
  WHERE video_match.video_id IS NOT NULL
  ORDER BY legacy.definition_id, video_match.video_id,
    legacy.legacy_exercise_id, legacy.source_field
),
new_candidates AS (
  SELECT normalized.*
  FROM normalized
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=normalized.definition_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_media_candidate_v1 existing
    WHERE existing.definition_id=normalized.definition_id
      AND existing.reviewed_card_version=definition.card_version
      AND existing.video_id=normalized.video_id
  )
),
ranked AS (
  SELECT
    candidate.*,
    definition.card_version,
    row_number() OVER (
      PARTITION BY candidate.definition_id
      ORDER BY candidate.video_id
    ) AS candidate_rank,
    (
      SELECT COUNT(DISTINCT existing.video_id)
      FROM coaching.exercise_media_candidate_v1 existing
      WHERE existing.definition_id=candidate.definition_id
        AND existing.reviewed_card_version=definition.card_version
        AND existing.review_status IN ('candidate','shortlisted','approved')
    ) AS existing_count
  FROM new_candidates candidate
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=candidate.definition_id
)
INSERT INTO coaching.exercise_media_candidate_v1 (
  definition_id,
  reviewed_card_version,
  url,
  embed_url,
  video_id,
  review_status,
  link_status,
  discovery_method,
  notes
)
SELECT
  definition_id,
  card_version,
  'https://www.youtube.com/watch?v=' || video_id,
  'https://www.youtube-nocookie.com/embed/' || video_id,
  video_id,
  'candidate',
  'unverified',
  'legacy_import',
  'Imported from legacy exercise ' || legacy_exercise_id::text
    || ' media_library.' || source_field
    || '; availability, embedding, exact-version match, and demonstration quality remain pending.'
FROM ranked
WHERE candidate_rank <= GREATEST(5 - existing_count, 0)
ON CONFLICT (definition_id, reviewed_card_version, video_id) DO NOTHING;
