# Purpose of the `app_user` Table

## Overview

The `app_user` table serves as the **authentication and authorization system** for the Vortex Athletics application. It stores user accounts with roles and permissions, primarily used for admin access and parent/guardian accounts.

## Key Purpose

### 1. **Authentication System** 🔐
- Stores user login credentials (email, password_hash, username)
- Used for authenticating admin users and parent/guardian accounts
- Supports both email and username-based login

### 2. **Role-Based Access Control (RBAC)** 👥
- Each user has a `role` field that defines their permissions
- Supports multiple roles via the `user_role` junction table
- Roles include:
  - `OWNER_ADMIN` - Full system administration access
  - `PARENT_GUARDIAN` - Parent/guardian accounts that can manage families
  - `COACH` - Staff members who can manage classes
  - `ATHLETE_VIEWER` - Read-only access for viewing athlete information

### 3. **Facility Management** 🏢
- Links users to facilities via `facility_id`
- Supports multi-facility deployments
- Ensures users can only access their assigned facility

## Table Schema

```sql
CREATE TABLE app_user (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  role                user_role NOT NULL,           -- Primary role
  email               TEXT NOT NULL,                -- Login email
  phone               TEXT,                         -- Contact phone
  full_name           TEXT NOT NULL,                -- User's full name
  password_hash       TEXT,                         -- Bcrypt hashed password
  address             TEXT,                         -- User address
  username            VARCHAR(50),                  -- Optional username (unique per facility)
  is_active           BOOLEAN NOT NULL DEFAULT TRUE, -- Account status
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, email)                       -- Email unique per facility
)
```

## Relationship to Other Tables

### 1. **Member Table** (Unified)
- `app_user` and `member` can have **overlapping data**
- Admin users exist in BOTH tables:
  - `app_user` - for authentication/authorization
  - `member` - as a member record in the unified member system
- This is **intentional** - admins are both users (for auth) and members (in the member system)

### 2. **User Role Table** (`user_role`)
- Junction table for **multiple roles per user**
- Allows a user to have multiple roles (e.g., both COACH and PARENT_GUARDIAN)
- References `app_user.id`

### 3. **Family Guardian Table** (`family_guardian`)
- Links `app_user` accounts to families
- Has both `user_id` (references `app_user`) and `member_id` (references `member`)
- Allows parents/guardians to manage family accounts

### 4. **Family Table** (`family`)
- `primary_user_id` can reference `app_user.id`
- Identifies the primary account holder for a family

## Current Usage in Codebase

### Admin Login (`/api/admin/login`)
- **Currently queries `admins` table** (not `app_user`)
- This appears to be a legacy implementation
- **Note:** There seems to be both an `admins` table and `app_user` table
- The `admins` table is likely the older authentication system

### Creating Users (`/api/admin/app-users`)
- Creates new `app_user` records
- Validates username/email uniqueness per facility
- Sets roles via `user_role` table
- Handles archived user reactivation

### Authorization Middleware
- `getUserRoles()` function queries `user_role` table
- Falls back to `app_user.role` if `user_role` table doesn't have entries
- Used for checking permissions on protected routes

## Why It Still Exists (After Member Table Migration)

### 1. **Authentication is Separate from Member Data**
- `app_user` handles **who can log in** and **what they can do**
- `member` table handles **member information** (enrollments, medical notes, etc.)
- These are **different concerns** - authentication vs. member data

### 2. **Different Use Cases**
- `app_user` - Users who need to log in (admins, parents, staff)
- `member` - All people in the system (including children who don't log in)
- A parent might be in `app_user` (to log in) AND `member` (as a family member)

### 3. **Backward Compatibility**
- Existing admin authentication system still uses `admins` table
- `app_user` was created to modernize the system but hasn't fully replaced `admins`
- Migration from `admins` to `app_user` may be incomplete

## Potential Issues / Inconsistencies

### 1. **Dual Authentication Systems**
- `/api/admin/login` queries `admins` table
- But `app_user` table exists and is used elsewhere
- This suggests **two parallel authentication systems** exist

### 2. **Data Duplication**
- Admin users exist in both `app_user` and `member` tables
- This is intentional but could be confusing
- Data sync between tables must be maintained

### 3. **Migration Incomplete**
- Migration 001 creates `app_user` and migrates from `admins`
- But admin login still uses `admins` table
- Suggests migration from `admins` → `app_user` for authentication wasn't completed

## Recommended Future State

### Option 1: **Consolidate to `app_user`** (Recommended)
- Update `/api/admin/login` to query `app_user` instead of `admins`
- Drop `admins` table after migration
- Single authentication system

### Option 2: **Keep Both** (Current State)
- `admins` for admin authentication
- `app_user` for parent/guardian authentication
- More complex but maintains backward compatibility

### Option 3: **Migrate to Unified Member Table**
- Use `member` table for all authentication
- Add authentication fields to `member` table
- Eliminate `app_user` entirely
- Simpler but requires significant refactoring

## Summary

**The `app_user` table's purpose is:**
1. ✅ **Authentication** - Store login credentials
2. ✅ **Authorization** - Manage roles and permissions  
3. ✅ **Facility Linking** - Connect users to facilities
4. ✅ **Parent/Guardian Accounts** - For family management

**It's separate from `member` table because:**
- Authentication (login/roles) ≠ Member data (enrollments/medical info)
- Not all members need to log in (e.g., children)
- Not all users are members (e.g., some admin accounts)
- Supports role-based access control separately from member enrollment status

**Current Status:**
- ✅ Table exists and is actively used
- ⚠️  Authentication system seems split between `admins` and `app_user`
- ✅ Parent/guardian accounts use `app_user`
- ⚠️  Admin authentication may still use legacy `admins` table


