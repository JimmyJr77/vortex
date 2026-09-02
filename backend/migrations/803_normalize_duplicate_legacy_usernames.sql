-- Follow-up normalization for databases that recorded the first released
-- canonical-access migration before duplicate legacy username cleanup was
-- added. Preserve valid email sign-ins and remove only an ambiguous username
-- alias when every affected account already has an email identifier.
--
-- Any duplicate group with a missing email is deliberately left untouched:
-- public login would still be ambiguous, so it requires explicit operator
-- review rather than a guessed account choice.
WITH duplicated_usernames AS (
  SELECT LOWER(BTRIM(username)) AS normalized_username
    FROM app_user
   WHERE NULLIF(BTRIM(username), '') IS NOT NULL
   GROUP BY LOWER(BTRIM(username))
  HAVING COUNT(*) > 1
     AND BOOL_AND(POSITION('@' IN COALESCE(email, '')) > 1)
)
UPDATE app_user app_user_row
   SET username = NULL,
       updated_at = now()
  FROM duplicated_usernames duplicate
 WHERE LOWER(BTRIM(app_user_row.username)) = duplicate.normalized_username;
