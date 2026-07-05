-- ============================================================
-- 074: Member messaging create permissions
-- ------------------------------------------------------------
-- Grants (via admin Access portal) for members who may create:
--   - event message boards
--   - event calendar / schedule items
--
-- Not granted to MEMBER_ATHLETE by default — assign via
-- app_user_permission_override allow or role_permission.
-- Idempotent: ON CONFLICT guards make re-runs safe.
-- ============================================================

INSERT INTO permission (key, description) VALUES
  ('event_boards.create', 'Create event message boards in the member portal.'),
  ('event_calendar.create', 'Create event calendar and schedule items in the member portal.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
