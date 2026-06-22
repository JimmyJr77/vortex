-- ============================================================
-- 034: Member archive/delete permission split
-- ------------------------------------------------------------
-- Policy:
--   - Master admins (MASTER_ADMIN) can archive AND permanently delete members.
--   - Regular admins (ADMIN) can archive members but cannot delete them.
--
-- This migration:
--   1. Adds the new `members.delete` permission to the catalog.
--   2. Grants every permission (incl. members.delete) to MASTER_ADMIN
--      (master admins also bypass permission checks at runtime, but we keep
--      the catalog accurate).
--   3. Grants `members.archive` to ADMIN so regular admins can archive
--      (it was previously omitted from the ADMIN role seed in 008).
--
-- Idempotent: ON CONFLICT guards make re-runs safe.
-- Runs inside the migration runner's own transaction (no BEGIN/COMMIT).
-- ============================================================

-- 1) Catalog the new permission.
INSERT INTO permission (key, description) VALUES
  ('members.delete', 'Permanently delete member records.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

-- 2) Master admins get the full permission set (covers members.delete).
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permission p
WHERE r.key = 'MASTER_ADMIN'
ON CONFLICT DO NOTHING;

-- 3) Regular admins can archive members (but NOT members.delete).
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key = 'members.archive'
WHERE r.key = 'ADMIN'
ON CONFLICT DO NOTHING;
