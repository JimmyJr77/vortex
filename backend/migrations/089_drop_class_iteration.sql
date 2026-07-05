-- Drop pre-scheduling class iteration model (0 rows on prod as of 2026-07-05).
-- Code paths removed in PR-2; verify §10.6 counts before applying.

ALTER TABLE coach_class_assignment DROP COLUMN IF EXISTS class_iteration_id;
ALTER TABLE member_program DROP COLUMN IF EXISTS iteration_id;
ALTER TABLE coaching.session DROP COLUMN IF EXISTS class_iteration_id;

DROP TABLE IF EXISTS class_iteration;
DROP TABLE IF EXISTS public.class;
