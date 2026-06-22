-- ============================================================
-- 035: Remove the legacy OWNER_ADMIN role
-- ------------------------------------------------------------
-- The consolidated admin model is MASTER_ADMIN and ADMIN only. OWNER_ADMIN
-- was a backward-compatibility role that migration 032 already deleted, but
-- the boot-time re-run of migration 008 (via initPlatformTables) kept
-- re-seeding it. Now that 008/011/034 no longer reference OWNER_ADMIN, this
-- migration removes the lingering catalog row for good.
--
-- The `user_role` enum no longer contains OWNER_ADMIN (collapsed in 032), so
-- no app_user / app_user_role rows can hold it. We still guard defensively.
--
-- Idempotent and safe to re-run.
-- ============================================================

-- Drop permission grants tied to the OWNER_ADMIN catalog role, then the role.
DELETE FROM role_permission
WHERE role_id IN (SELECT id FROM role WHERE key = 'OWNER_ADMIN');

DELETE FROM role WHERE key = 'OWNER_ADMIN';
