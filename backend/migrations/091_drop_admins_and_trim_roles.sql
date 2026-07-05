-- Retire legacy admins table; admin auth uses app_user only.
-- Ensure team.vortexathletics@gmail.com (or other admins) has app_user MASTER_ADMIN before applying.

UPDATE app_user
SET role = 'MASTER_ADMIN', updated_at = now()
WHERE email = 'team.vortexathletics@gmail.com'
  AND role <> 'MASTER_ADMIN';

DELETE FROM role
WHERE key IN ('MEMBER', 'PARENT_GUARDIAN', 'ATHLETE', 'ATHLETE_VIEWER', 'OWNER_ADMIN');

DROP TABLE IF EXISTS admins;
