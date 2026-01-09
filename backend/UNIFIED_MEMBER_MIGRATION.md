# Unified Member Table Migration Guide

## Overview

This migration merges the `app_user` and `athlete` tables into a unified `member` table, simplifying the data model and eliminating redundancy.

## Key Changes

### 1. Unified Member Table
- **Replaces**: `app_user` and `athlete` tables
- **New fields**:
  - `billing_street`, `billing_city`, `billing_state`, `billing_zip` (from enrollment form)
  - `family_is_active` (boolean - true if member or their family is active)
  - `status` now includes: `'enrolled'`, `'legacy'` (was `'stand-bye'`), `'archived'`, `'family_active'`

### 2. Parent-Guardian Authority Table
- **New table**: `parent_guardian_authority`
- **Purpose**: Links parents/guardians to specific children with legal authority
- **Fields**: `parent_member_id`, `child_member_id`, `has_legal_authority`, `relationship`, `notes`

### 3. Status System Updates
- `'stand-bye'` → `'legacy'` (renamed)
- **New status**: `'family_active'` - assigned when member's family is active even if member isn't enrolled
- Status calculation:
  - `'enrolled'`: Member has enrollments AND is active
  - `'family_active'`: Family is active (even if member isn't enrolled)
  - `'legacy'`: Default status (no enrollments, not in active family)
  - `'archived'`: Member is archived

### 4. Enrollment Table
- `athlete_program` → `member_program`
- `athlete_id` → `member_id`

## Migration Steps

### Step 1: Run Database Migration
```bash
# Run the SQL migration
psql -d vortex_athletics -f backend/migrations/005_unified_member_table.sql
```

### Step 2: Run Data Migration Script
```bash
# Run the Node.js migration script
node backend/run-unified-member-migration.js
```

### Step 3: Verify Migration
```sql
-- Check member counts
SELECT COUNT(*) FROM member;
SELECT COUNT(*) FROM app_user; -- Should match (or be less if duplicates merged)
SELECT COUNT(*) FROM athlete; -- Should match (or be less if duplicates merged)

-- Check enrollments
SELECT COUNT(*) FROM member_program;
SELECT COUNT(*) FROM athlete_program; -- Should match

-- Check family active status
SELECT status, COUNT(*) FROM member GROUP BY status;
```

### Step 4: Update Application Code
The following endpoints need to be updated to use `member` table:

#### Critical Endpoints (High Priority)
1. **Authentication** (`/api/admin/login`, `/api/member/login`)
   - Update to query `member` table instead of `app_user`
   - Check `password_hash` and `is_active` from `member`

2. **Member Management** (`/api/admin/members`, `/api/admin/families`)
   - Update all queries to use `member` table
   - Update status logic to include `'family_active'`
   - Update status calculation to use `updateMemberStatus()` helper

3. **Enrollments** (`/api/admin/enrollments`, `/api/member/enroll`)
   - Update to use `member_program` instead of `athlete_program`
   - Update `member_id` references

4. **Family Management** (`/api/admin/families`)
   - Update to use `member` table for guardians
   - Update `family_guardian` to use `member_id`
   - Update `family.primary_member_id`

#### Medium Priority Endpoints
5. **User Management** (`/api/admin/users`)
   - Update to query `member` table
   - Filter by roles (via `user_role` table)

6. **Athlete Management** (`/api/admin/athletes`)
   - Update to use `member` table
   - Consider renaming to `/api/admin/members`

#### Low Priority (Can be done later)
7. **Emergency Contacts**
   - Update to reference `member_id` instead of `athlete_id`

8. **Search Endpoints**
   - Update search queries to use `member` table

## Status Calculation Logic

The `updateMemberStatus()` helper function calculates status as follows:

```javascript
// Priority order:
1. If member has enrollments AND is_active → 'enrolled'
2. Else if family_is_active OR any family member is active → 'family_active'
3. Else → 'legacy'
4. If archived → 'archived' (overrides all)
```

## Parent-Guardian Authority

To check if a parent has legal authority to sign for a child:

```sql
SELECT has_legal_authority
FROM parent_guardian_authority
WHERE parent_member_id = $1
  AND child_member_id = $2
  AND has_legal_authority = TRUE;
```

## Billing Address

Billing address fields are stored directly on the `member` table:
- `billing_street`
- `billing_city`
- `billing_state`
- `billing_zip`

These should be populated from the enrollment form.

## Backward Compatibility

During migration, the old tables (`app_user`, `athlete`, `athlete_program`) are kept for reference but should not be used for new operations. They can be dropped after verification:

```sql
-- After verification, drop old tables:
DROP TABLE IF EXISTS athlete_program CASCADE;
DROP TABLE IF EXISTS athlete CASCADE;
-- Keep app_user for now if still needed for admin login
-- DROP TABLE IF EXISTS app_user CASCADE;
```

## Testing Checklist

- [ ] All members migrated successfully
- [ ] All enrollments migrated to `member_program`
- [ ] Status calculation works correctly
- [ ] Family active status updates correctly
- [ ] Parent-guardian authority relationships created
- [ ] Billing address fields populated
- [ ] Login still works (using `member` table)
- [ ] Enrollment still works (using `member_program`)
- [ ] Family management still works
- [ ] Search functionality works

## Rollback Plan

If migration fails, you can rollback by:
1. Restoring from database backup
2. Or manually reverting the migration SQL (reverse the changes)

## Notes

- The migration script handles merging adults who exist in both `app_user` and `athlete` tables
- Children (athletes without `user_id`) are migrated as separate member records
- `family_is_active` is calculated automatically via trigger when member status changes
- Status is recalculated when enrollments are added/removed

