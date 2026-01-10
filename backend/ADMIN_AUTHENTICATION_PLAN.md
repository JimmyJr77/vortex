# Admin Authentication Consolidation & Security Plan

## 🚨 CRITICAL SECURITY ISSUE FOUND

**Problem**: Admin routes (`/api/admin/*`) are **NOT PROTECTED** by authentication middleware!
- Comment in code says: `// in production, add authentication`
- Routes are publicly accessible without authentication
- This is a **major security vulnerability**

## Current State Analysis

### Two Admin Tables Exist:
1. **`admins` table** (Legacy)
   - Used by `/api/admin/login` endpoint
   - Has: id, email, username, password_hash, is_master
   - Creates JWT with: `{ adminId, role: 'ADMIN', email }`

2. **`app_user` table** (Newer RBAC system)
   - Has: id, email, full_name, password_hash, role (user_role enum)
   - Role can be: `OWNER_ADMIN`, `PARENT_GUARDIAN`, `COACH`, `ATHLETE_VIEWER`
   - Currently has 1 user with `OWNER_ADMIN` role (same email as `admins` table)

### Authentication Flow:
- Admin login uses `admins` table ✅
- Creates JWT token with `adminId` and `role: 'ADMIN'` ✅
- `authenticateMember` middleware exists but **NOT applied to admin routes** ❌
- Admin routes are **unprotected** ❌

## Best Practices for Admin Authentication

### 1. **Single Source of Truth** ✅
- Use ONE table for admin authentication
- Recommendation: Migrate to `app_user` table (modern RBAC system)

### 2. **Role-Based Access Control (RBAC)** ✅
- Use roles: `OWNER_ADMIN` for full admin access
- Support multiple roles via `user_role` junction table
- Check roles in middleware, not just authentication

### 3. **Protected Routes** ❌ (CURRENTLY MISSING)
- All `/api/admin/*` routes MUST be protected
- Middleware should verify:
  - Valid JWT token
  - Admin role (`OWNER_ADMIN` or role from `user_role` table)
  - Active account (`is_active = true`)

### 4. **Separate Admin vs Member Auth** ✅
- Admins use `app_user` table with `OWNER_ADMIN` role
- Members use `member` table (for member portal)
- Different authentication endpoints and middleware

## Recommended Solution

### Phase 1: Secure Admin Routes (IMMEDIATE - Security Fix)
1. Create `authenticateAdmin` middleware
2. Apply to all `/api/admin/*` routes
3. Verify JWT token + admin role

### Phase 2: Consolidate to `app_user` Table
1. Update `/api/admin/login` to use `app_user` instead of `admins`
2. Query `app_user` where `role = 'OWNER_ADMIN'` or check `user_role` table
3. Migrate any remaining `admins` data to `app_user`
4. Drop `admins` table after verification

### Phase 3: Enhance Role Checking
1. Check `user_role` junction table for multiple roles
2. Support fine-grained permissions (if needed)
3. Audit trail for admin actions

## Implementation Steps

### Step 1: Create Admin Authentication Middleware

```javascript
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'No authentication token provided' 
    })
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET)
    
    // Get admin ID (support both old and new token formats)
    const adminId = decoded.adminId || decoded.userId
    
    if (!adminId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token: no admin ID' 
      })
    }
    
    // Verify admin exists and has OWNER_ADMIN role
    // First check app_user table (preferred)
    const appUserCheck = await pool.query(`
      SELECT au.id, au.email, au.is_active, au.role, 
             EXISTS(
               SELECT 1 FROM user_role ur 
               WHERE ur.user_id = au.id 
               AND ur.role = 'OWNER_ADMIN'
             ) as has_owner_admin_role
      FROM app_user au
      WHERE au.id = $1
    `, [adminId])
    
    if (appUserCheck.rows.length > 0) {
      const user = appUserCheck.rows[0]
      
      // Check if user has OWNER_ADMIN role (either in role column or user_role table)
      const isOwnerAdmin = user.role === 'OWNER_ADMIN' || user.has_owner_admin_role
      
      if (!isOwnerAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied: Admin privileges required' 
        })
      }
      
      if (!user.is_active) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied: Account is inactive' 
        })
      }
      
      req.adminId = user.id
      req.adminEmail = user.email
      req.isAdmin = true
      return next()
    }
    
    // Fallback: Check admins table (for backward compatibility during migration)
    const adminCheck = await pool.query(`
      SELECT id, email, is_master
      FROM admins
      WHERE id = $1
    `, [adminId])
    
    if (adminCheck.rows.length > 0) {
      const admin = adminCheck.rows[0]
      req.adminId = admin.id
      req.adminEmail = admin.email
      req.isAdmin = true
      return next()
    }
    
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token: Admin not found' 
    })
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      })
    }
    
    console.error('[AUTH] Admin authentication error:', error)
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    })
  }
}
```

### Step 2: Apply Middleware to Admin Routes

```javascript
// Apply to all admin routes
app.use('/api/admin', authenticateAdmin)

// OR apply to specific routes (if some need to be public)
app.get('/api/admin/login', /* public, no middleware */)
app.use('/api/admin/*', authenticateAdmin) // All other admin routes
```

### Step 3: Update Admin Login to Use `app_user`

```javascript
app.post('/api/admin/login', async (req, res) => {
  // ... validation ...
  
  // Check app_user table first (preferred)
  let query, params
  if (isEmail) {
    query = `
      SELECT au.*, 
             EXISTS(
               SELECT 1 FROM user_role ur 
               WHERE ur.user_id = au.id 
               AND ur.role = 'OWNER_ADMIN'
             ) as has_owner_admin_role
      FROM app_user au
      WHERE au.email = $1
      AND (au.role = 'OWNER_ADMIN' OR EXISTS(
        SELECT 1 FROM user_role ur 
        WHERE ur.user_id = au.id 
        AND ur.role = 'OWNER_ADMIN'
      ))
    `
    params = [usernameOrEmail]
  } else {
    query = `
      SELECT au.*,
             EXISTS(
               SELECT 1 FROM user_role ur 
               WHERE ur.user_id = au.id 
               AND ur.role = 'OWNER_ADMIN'
             ) as has_owner_admin_role
      FROM app_user au
      WHERE LOWER(au.username) = LOWER($1)
      AND (au.role = 'OWNER_ADMIN' OR EXISTS(
        SELECT 1 FROM user_role ur 
        WHERE ur.user_id = au.id 
        AND ur.role = 'OWNER_ADMIN'
      ))
    `
    params = [usernameOrEmail]
  }
  
  const result = await pool.query(query, params)
  
  // Fallback to admins table if not found (during migration)
  if (result.rows.length === 0) {
    // ... check admins table ...
  }
  
  // ... verify password and create token ...
  
  // Create token with consistent format
  const adminToken = jwt.sign(
    { 
      adminId: user.id,
      userId: user.id, // Also include for compatibility
      role: 'OWNER_ADMIN',
      email: user.email 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
})
```

## Migration Plan

### Migration Script: `008_consolidate_admin_auth.sql`

```sql
-- Step 1: Ensure all admins in 'admins' table exist in 'app_user' with OWNER_ADMIN role
INSERT INTO app_user (
  id, facility_id, role, email, phone, full_name, password_hash, 
  is_active, created_at, updated_at, username
)
SELECT 
  a.id,
  (SELECT id FROM facility LIMIT 1) as facility_id,
  'OWNER_ADMIN'::user_role as role,
  a.email,
  a.phone,
  COALESCE(a.first_name || ' ' || a.last_name, 'Admin User') as full_name,
  a.password_hash,
  TRUE as is_active,
  a.created_at,
  a.updated_at,
  a.username
FROM admins a
WHERE NOT EXISTS (
  SELECT 1 FROM app_user au WHERE au.id = a.id OR au.email = a.email
)
ON CONFLICT (id) DO UPDATE
SET 
  role = 'OWNER_ADMIN'::user_role,
  password_hash = EXCLUDED.password_hash,
  is_active = TRUE;

-- Step 2: Ensure user_role entries exist for OWNER_ADMIN
INSERT INTO user_role (user_id, role, created_at)
SELECT au.id, 'OWNER_ADMIN'::user_role, au.created_at
FROM app_user au
WHERE au.role = 'OWNER_ADMIN'
AND NOT EXISTS (
  SELECT 1 FROM user_role ur 
  WHERE ur.user_id = au.id AND ur.role = 'OWNER_ADMIN'
);

-- Step 3: Verify migration
-- Check counts match
SELECT 
  (SELECT COUNT(*) FROM admins) as admins_count,
  (SELECT COUNT(*) FROM app_user WHERE role = 'OWNER_ADMIN') as app_user_admin_count;

-- After verification, drop admins table (in separate migration)
-- DROP TABLE IF EXISTS admins CASCADE;
```

## Security Checklist

- [ ] Create `authenticateAdmin` middleware
- [ ] Apply middleware to ALL `/api/admin/*` routes (except login)
- [ ] Update admin login to use `app_user` table
- [ ] Verify role checking works correctly
- [ ] Test with existing admin credentials
- [ ] Test access denial for non-admin users
- [ ] Test access denial for inactive admin accounts
- [ ] Test access denial for missing/invalid tokens
- [ ] Migrate `admins` table data to `app_user`
- [ ] Update all admin-related queries to use `app_user`
- [ ] Drop `admins` table after verification
- [ ] Update documentation

## Testing

### Test Cases:
1. ✅ Valid admin login → Should receive JWT token
2. ✅ Admin with valid token → Should access admin routes
3. ❌ Non-admin user → Should be denied access (403)
4. ❌ Invalid token → Should be denied (401)
5. ❌ Missing token → Should be denied (401)
6. ❌ Inactive admin → Should be denied (403)
7. ❌ Expired token → Should be denied (401)

## Summary

**Current Issues:**
- ❌ Admin routes are **unprotected** (SECURITY VULNERABILITY)
- ❌ Two admin tables (`admins` and `app_user`) - inconsistent
- ❌ Admin login uses legacy `admins` table
- ❌ No role verification on admin routes

**Recommended Solution:**
- ✅ Consolidate to `app_user` table with RBAC
- ✅ Create `authenticateAdmin` middleware
- ✅ Protect ALL admin routes
- ✅ Verify `OWNER_ADMIN` role for access
- ✅ Support migration period (check both tables)

**Priority:**
- 🔴 **CRITICAL**: Secure admin routes immediately (Phase 1)
- 🟡 **HIGH**: Consolidate authentication (Phase 2)
- 🟢 **MEDIUM**: Enhance role system (Phase 3)


