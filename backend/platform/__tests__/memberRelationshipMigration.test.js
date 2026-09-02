import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../../migrations/801_canonical_member_relationships.sql',
  import.meta.url,
)

test('canonical member relationship migration is additive and deterministic', async () => {
  const sql = await fs.readFile(migrationUrl, 'utf8')

  assert.match(sql, /INSERT INTO family_member/)
  assert.match(sql, /member_row\.family_id = family_link\.family_id\) DESC NULLS LAST/)
  assert.match(sql, /family_link\.joined_at ASC/)
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_family_member_one_active_per_member/)
  assert.match(sql, /ON family_member\(member_id\)\s+WHERE is_active = TRUE/)
  assert.match(sql, /sync_member_family_pointer_from_family_member/)

  assert.match(sql, /unnest\([\s\S]*child_row\.parent_guardian_ids/)
  assert.match(sql, /parent_row\.facility_id = child_row\.facility_id/)
  assert.match(sql, /WHERE parent_row\.id <> child_row\.id/)
  assert.match(sql, /parent_row\.date_of_birth IS NOT NULL/)
  assert.match(sql, /parent_row\.date_of_birth <= \(CURRENT_DATE - INTERVAL '18 years'\)::date/)
  assert.match(sql, /SET has_legal_authority = FALSE/)
  assert.match(sql, /guard_parent_guardian_authority_scope/)
  assert.match(sql, /authority\.parent_member_id = OLD\.id OR authority\.child_member_id = OLD\.id/)
  assert.match(sql, /authority\.child_member_id = OLD\.id[\s\S]*NEW\.facility_id IS DISTINCT FROM parent_row\.facility_id/)

  assert.doesNotMatch(
    sql,
    /DELETE\s+FROM\s+(?:member|family|family_member|parent_guardian_authority)\b/i,
  )
  assert.doesNotMatch(sql, /DROP\s+(?:TABLE|COLUMN)\b/i)
})
