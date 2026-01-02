-- ============================================================
-- Module 0 Verification Queries
-- Run these queries to verify Module 0 migration completed
-- ============================================================

-- 1. Check if user_role enum exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') 
    THEN '✅ user_role enum exists'
    ELSE '❌ user_role enum NOT found'
  END as enum_status;

-- 2. Check facility table
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'facility') 
    THEN '✅ facility table exists'
    ELSE '❌ facility table NOT found'
  END as facility_table_status;

-- 3. Check facility data
SELECT 
  id, 
  name, 
  timezone, 
  created_at 
FROM facility;

-- 4. Check app_user table
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_user') 
    THEN '✅ app_user table exists'
    ELSE '❌ app_user table NOT found'
  END as app_user_table_status;

-- 5. Count users by role
SELECT 
  role, 
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM app_user
GROUP BY role
ORDER BY role;

-- 6. Show sample migrated admins (OWNER_ADMIN)
SELECT 
  id, 
  email, 
  full_name, 
  role, 
  is_active,
  created_at
FROM app_user 
WHERE role = 'OWNER_ADMIN'
ORDER BY created_at DESC
LIMIT 5;

-- 7. Show sample migrated members (PARENT_GUARDIAN)
SELECT 
  id, 
  email, 
  full_name, 
  role, 
  is_active,
  created_at
FROM app_user 
WHERE role = 'PARENT_GUARDIAN'
ORDER BY created_at DESC
LIMIT 5;

-- 8. Compare counts: admins table vs app_user (OWNER_ADMIN)
SELECT 
  (SELECT COUNT(*) FROM admins) as admins_table_count,
  (SELECT COUNT(*) FROM app_user WHERE role = 'OWNER_ADMIN') as app_user_owner_admin_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM admins) = (SELECT COUNT(*) FROM app_user WHERE role = 'OWNER_ADMIN')
    THEN '✅ Counts match'
    ELSE '⚠️  Counts do not match (some admins may not have been migrated)'
  END as migration_status;

-- 9. Compare counts: members table vs app_user (PARENT_GUARDIAN)
SELECT 
  (SELECT COUNT(*) FROM members) as members_table_count,
  (SELECT COUNT(*) FROM app_user WHERE role = 'PARENT_GUARDIAN') as app_user_parent_guardian_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM members) = (SELECT COUNT(*) FROM app_user WHERE role = 'PARENT_GUARDIAN')
    THEN '✅ Counts match'
    ELSE '⚠️  Counts do not match (some members may not have been migrated)'
  END as migration_status;

