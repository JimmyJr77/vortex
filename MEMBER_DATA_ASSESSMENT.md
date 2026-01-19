# Member Data Assessment

## Executive Summary

This document assesses how member data flows from the `MemberFormSection` component through the API to the database. Several fields collected in the form are not being properly saved to the database.

---

## Database Schema (member table)

Based on `backend/migrations/005_unified_member_table.sql` and `backend/server.js` initialization:

### Fields in member table:
- **Identity**: `id`, `facility_id`, `family_id`, `first_name`, `last_name`, `date_of_birth`, `email`, `phone`, `address`
- **Billing**: `billing_street`, `billing_city`, `billing_state`, `billing_zip`
- **Authentication**: `password_hash`, `username`
- **Status**: `status`, `is_active`, `family_is_active`
- **Medical**: `medical_notes`, `medical_concerns`, `gender` (added via ALTER TABLE)
- **Family**: `parent_guardian_ids` (BIGINT[] array)
- **Waivers**: `has_completed_waivers`, `waiver_completion_date`
- **Other**: `internal_flags`, `created_at`, `updated_at`

**Note**: The table has both `medical_notes` and `medical_concerns` columns, but they serve different purposes.

---

## Form Fields Collected (MemberFormSection.tsx)

### 1. Contact Information Section
✅ **Collected**: `firstName`, `lastName`, `email`, `phone`, `addressStreet`, `addressCity`, `addressState`, `addressZip`
- **Status**: ✅ All fields are properly passed and saved

### 2. Login & Security Section
✅ **Collected**: `username`, `password`
- **Status**: ✅ Both fields are properly passed and saved

### 3. Personal Data Section
⚠️ **Collected**: 
- `dateOfBirth` ✅ Saved
- `gender` ❌ **NOT SAVED**
- `medicalConcerns` ❌ **NOT SAVED** (form collects `medicalConcerns`, but payload sends `medicalNotes`; database has both columns but INSERT only uses `medical_notes`)
- `injuryHistoryDate` ❌ **NOT SAVED**
- `injuryHistoryBodyPart` ❌ **NOT SAVED**
- `injuryHistoryNotes` ❌ **NOT SAVED**
- `noInjuryHistory` ❌ **NOT SAVED**

### 4. Parent/Guardian Selection Section
⚠️ **Collected**: `parentGuardians` (array with `id`, `relationship`, `relationshipOther`)
- **Status**: ⚠️ Only `parentGuardianIds` array is saved; **relationships are lost**
- The form collects relationship information (Mother, Father, Other legal guardian) but this is not persisted

### 5. Waiver Status Section
✅ **Collected**: `hasCompletedWaivers`, `waiverCompletionDate`
- **Status**: ✅ Both fields are properly passed and saved

### 6. Previous Classes Section
❌ **Collected**: `experience` (text field)
- **Status**: ❌ **NOT SAVED** - No corresponding database field exists

---

## Data Flow Analysis

### Frontend → API (AdminMembers.tsx, lines 1454-1499)

**Payload sent to API:**
```typescript
{
  firstName, lastName, email, phone, dateOfBirth,
  username, password,
  address (combined), billingStreet, billingCity, billingState, billingZip,
  medicalNotes,  // ⚠️ Form collects "medicalConcerns" but sends "medicalNotes"
  internalFlags,
  hasCompletedWaivers, waiverCompletionDate,
  parentGuardianIds  // ⚠️ Only IDs, relationships lost
}
```

**Missing from payload:**
- ❌ `gender`
- ❌ `medicalConcerns` (form collects this, but payload sends `medicalNotes` instead)
- ❌ `injuryHistoryDate`, `injuryHistoryBodyPart`, `injuryHistoryNotes`
- ❌ `experience`
- ❌ `parentGuardians` relationships

### API → Database (server.js, lines 5625-5657)

**INSERT query:**
```sql
INSERT INTO member (
  facility_id, family_id, first_name, last_name, email, phone,
  date_of_birth, username, password_hash,
  address, billing_street, billing_city, billing_state, billing_zip,
  parent_guardian_ids, has_completed_waivers, waiver_completion_date,
  medical_notes, internal_flags, status, is_active
)
```

**Missing from INSERT:**
- ❌ `gender` (column exists but not inserted)
- ❌ `medical_concerns` (column exists but not inserted; only `medical_notes` is inserted)
- ❌ Injury history fields (no columns exist)
- ❌ `experience` (no column exists)
- ❌ Parent/guardian relationships (only IDs saved in array)

---

## Issues Identified

### 🔴 Critical Issues

1. **Gender Not Saved**
   - **Location**: `MemberFormSection.tsx` collects `gender`, but it's not included in the payload
   - **Impact**: Gender information is lost
   - **Fix**: Add `gender` to `memberPayload` in `AdminMembers.tsx` and to INSERT query in `server.js`

2. **Medical Concerns Not Saved on Create**
   - **Location**: Form collects `medicalConcerns`, schema accepts it, but INSERT query doesn't include it
   - **Impact**: `medical_concerns` column exists and is used in UPDATE, but never populated on member creation
   - **Fix**: Add `medical_concerns` to INSERT query in `server.js` (line 5631)

3. **Injury History Not Saved**
   - **Location**: Form collects `injuryHistoryDate`, `injuryHistoryBodyPart`, `injuryHistoryNotes`, `noInjuryHistory`
   - **Impact**: Important medical information is lost
   - **Fix**: Add columns to database and include in payload/INSERT

4. **Experience Not Saved**
   - **Location**: Form collects `experience` text
   - **Impact**: Previous experience information is lost
   - **Fix**: Add `experience` column to database and include in payload/INSERT

### ⚠️ Moderate Issues

5. **Parent/Guardian Relationships Lost**
   - **Location**: Form collects relationships (Mother, Father, Other) but only IDs are saved
   - **Impact**: Relationship information is lost; only parent/guardian IDs are stored
   - **Fix**: Use `parent_guardian_authority` table to store relationships, or add relationship info to the array structure

6. **Address Field Handling**
   - **Location**: Form collects separate address fields but combines them into single `address` field
   - **Impact**: Structured address data is lost (though billing address is saved separately)
   - **Status**: This may be intentional, but worth noting

---

## Recommendations

### Immediate Fixes

1. **Add `gender` to payload and INSERT**
   ```typescript
   // In AdminMembers.tsx memberPayload
   gender: member.gender || member.sections.personalData?.tempData?.gender || null
   ```
   ```sql
   -- In server.js INSERT
   gender
   ```

2. **Fix medical concerns**
   - Add `medicalConcerns` to `memberPayload` in `AdminMembers.tsx`
   - Add `medical_concerns` to INSERT query in `server.js` (column already exists)

3. **Add injury history fields**
   - Add columns: `injury_history_date`, `injury_history_body_part`, `injury_history_notes`, `no_injury_history`
   - Include in payload and INSERT

4. **Add experience field**
   - Add column: `experience` (TEXT)
   - Include in payload and INSERT

### Schema Changes Needed

```sql
-- Add missing columns to member table
ALTER TABLE member
  ADD COLUMN IF NOT EXISTS injury_history_date DATE,
  ADD COLUMN IF NOT EXISTS injury_history_body_part TEXT,
  ADD COLUMN IF NOT EXISTS injury_history_notes TEXT,
  ADD COLUMN IF NOT EXISTS no_injury_history BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS experience TEXT;
```

### Code Changes Needed

1. **AdminMembers.tsx** (lines 1454-1499): Add missing fields to `memberPayload`
2. **server.js** (lines 5625-5657): Add missing fields to INSERT query and parameters
3. **memberSchema** (server.js, lines 1177-1264): Add validation for new fields

---

## Fields Properly Saved ✅

- ✅ `firstName` / `first_name`
- ✅ `lastName` / `last_name`
- ✅ `email`
- ✅ `phone`
- ✅ `dateOfBirth` / `date_of_birth`
- ✅ `username`
- ✅ `password` / `password_hash`
- ✅ `address` (combined)
- ✅ `billingStreet` / `billing_street`
- ✅ `billingCity` / `billing_city`
- ✅ `billingState` / `billing_state`
- ✅ `billingZip` / `billing_zip`
- ✅ `hasCompletedWaivers` / `has_completed_waivers`
- ✅ `waiverCompletionDate` / `waiver_completion_date`
- ✅ `parentGuardianIds` / `parent_guardian_ids` (IDs only, relationships lost)

---

## Summary

**Total fields collected**: ~20 fields
**Fields properly saved**: ~15 fields (75%)
**Fields missing/not saved**: ~5 fields (25%)

The core member information (name, contact, login, waivers) is being saved correctly. However, important medical and personal information (gender, injury history, experience) is being lost during submission. The parent/guardian relationship information is also not being persisted, only the IDs.

