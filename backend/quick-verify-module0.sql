-- Quick Module 0 Verification
-- Copy and paste these queries into your database client

-- 1. Check if user_role enum exists and show values
SELECT 
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'user_role'
GROUP BY t.typname;

-- 2. Check facility table and data
SELECT 
  'facility' as table_name,
  COUNT(*) as row_count
FROM facility
UNION ALL
SELECT 
  'app_user' as table_name,
  COUNT(*) as row_count
FROM app_user;

-- 3. Show facility details
SELECT id, name, timezone, created_at FROM facility;

-- 4. Show user counts by role
SELECT 
  role,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE is_active = true) as active_users
FROM app_user
GROUP BY role
ORDER BY role;

-- 5. Compare admin counts (should match or app_user should have more)
SELECT 
  'admins table' as source,
  COUNT(*) as count
FROM admins
UNION ALL
SELECT 
  'app_user (OWNER_ADMIN)' as source,
  COUNT(*) as count
FROM app_user
WHERE role = 'OWNER_ADMIN';

-- 6. Compare member counts (should match or app_user should have more)
SELECT 
  'members table' as source,
  COUNT(*) as count
FROM members
UNION ALL
SELECT 
  'app_user (PARENT_GUARDIAN)' as source,
  COUNT(*) as count
FROM app_user
WHERE role = 'PARENT_GUARDIAN';

-- 7. Show sample migrated users
SELECT 
  'OWNER_ADMIN' as role_type,
  email,
  full_name,
  is_active
FROM app_user
WHERE role = 'OWNER_ADMIN'
LIMIT 3
UNION ALL
SELECT 
  'PARENT_GUARDIAN' as role_type,
  email,
  full_name,
  is_active
FROM app_user
WHERE role = 'PARENT_GUARDIAN'
LIMIT 3;

