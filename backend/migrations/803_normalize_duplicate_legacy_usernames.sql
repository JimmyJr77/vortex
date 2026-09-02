-- Preflight normalization for legacy duplicate usernames. This deliberately
-- runs before the canonical access migration, whose unique-index preflight
-- must never choose a login identity arbitrarily.
--
-- If every duplicate has an email, remove the ambiguous alias from all of
-- them. If exactly one lacks an email, preserve its username and remove the
-- alias from every email-backed account. Groups with multiple accounts lacking
-- an email remain blocked for explicit review.
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS username TEXT;

WITH duplicate_groups AS (
  SELECT
    LOWER(BTRIM(username)) AS normalized_username,
    COUNT(*) AS account_count,
    COUNT(*) FILTER (WHERE POSITION('@' IN COALESCE(email, '')) > 1) AS email_login_count
    FROM app_user
   WHERE NULLIF(BTRIM(username), '') IS NOT NULL
   GROUP BY LOWER(BTRIM(username))
  HAVING COUNT(*) > 1
)
UPDATE app_user app_user_row
   SET username = NULL,
       updated_at = now()
  FROM duplicate_groups duplicate
 WHERE LOWER(BTRIM(app_user_row.username)) = duplicate.normalized_username
   AND (
     duplicate.email_login_count = duplicate.account_count
     OR (
       duplicate.account_count - duplicate.email_login_count = 1
       AND POSITION('@' IN COALESCE(app_user_row.email, '')) > 1
     )
   );
