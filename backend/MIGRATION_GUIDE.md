# Database Migration Guide

This guide explains how to run database migrations for the Vortex Athletics application.

## Overview

The application uses **SQL-first migrations**. Each migration is a SQL file in the `backend/migrations/` directory.

## Running Migrations

### Method 1: Using npm script (Recommended)

```bash
npm run migrate <migration-file.sql>
```

Example:
```bash
npm run migrate 001_module_0_identity_rbac_facility.sql
```

### Method 2: Direct node command

```bash
node run-migration.js <migration-file.sql>
```

### Method 3: Manual execution

You can also run the SQL file directly using `psql` or your database client:

```bash
psql -d vortex_athletics -f backend/migrations/001_module_0_identity_rbac_facility.sql
```

## Migration Files

Migrations are numbered sequentially and follow this naming convention:
- `001_module_0_identity_rbac_facility.sql`
- `002_module_1_programs_classes.sql`
- `003_module_2_family_athletes.sql`
- etc.

## Module 0 Migration

The first migration (`001_module_0_identity_rbac_facility.sql`) includes:

1. **User Role Enum**: Creates `user_role` enum with values:
   - `OWNER_ADMIN`
   - `COACH`
   - `PARENT_GUARDIAN`
   - `ATHLETE_VIEWER`

2. **Facility Table**: Creates the facility table and seeds a default facility

3. **App User Table**: Creates the new `app_user` table that will replace/extend the existing `admins` and `members` tables

4. **Data Migration**: 
   - Migrates existing `admins` to `app_user` with role `OWNER_ADMIN`
   - Migrates existing `members` to `app_user` with role `PARENT_GUARDIAN`

## Important Notes

⚠️ **Backward Compatibility**: The migration preserves your existing `admins` and `members` tables. They remain in the database for backward compatibility. You can drop them later after verifying everything works correctly.

⚠️ **Facility ID**: The migration assumes a single facility. All new `app_user` records are linked to the default facility.

⚠️ **Testing**: Always test migrations on a development/staging database before running on production.

## Verification

After running Module 0 migration, verify:

1. Check that the facility table has one row:
   ```sql
   SELECT * FROM facility;
   ```

2. Check that admins were migrated:
   ```sql
   SELECT * FROM app_user WHERE role = 'OWNER_ADMIN';
   ```

3. Check that members were migrated:
   ```sql
   SELECT * FROM app_user WHERE role = 'PARENT_GUARDIAN';
   ```

## Next Steps

After Module 0 is complete, you can proceed with:
- Module 1: Programs & Classes
- Module 2: Family Accounts & Athlete Profiles
- etc.

