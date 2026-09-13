import { libraryScopeId } from './coachingLibraryContext.js'

/**
 * Research includes every lifecycle state, including archived identities. None of
 * these rows is a generation candidate without the ordinary released loader.
 * Caller owns the read snapshot; bounded pagination must report incomplete work.
 */
export async function loadCanonicalExerciseResearchCatalog(client, facilityId) {
  const scope = libraryScopeId(facilityId, 'facilityId')
  const rows = []
  const pageSize = 500
  for (let page = 0; page < 20; page += 1) {
    const result = await client.query(
      `SELECT /* canonical_exercise_gap_research */
         d.id AS definition_id, d.canonical_name, d.display_name, d.aliases,
         d.family_key, d.description, d.card_version, d.status AS definition_status,
         d.movement_patterns, d.body_regions, d.required_equipment,
         d.updated_at AS definition_updated_at,
         v.id AS variant_id, v.variant_key, v.display_name AS variant_name,
         v.status AS variant_status, v.updated_at AS variant_updated_at,
         p.id AS profile_id, p.profile_key, p.phase_key, p.role, p.purpose,
         p.status AS profile_status, p.equipment_required,
         p.updated_at AS profile_updated_at
       FROM coaching.exercise_definition_v1 d
       LEFT JOIN coaching.exercise_variant_v1 v ON v.definition_id=d.id
       LEFT JOIN coaching.exercise_delivery_profile_v1 p ON p.variant_id=v.id
       WHERE d.facility_id=$1
       ORDER BY d.id, v.id NULLS FIRST, p.id NULLS FIRST
       LIMIT $2 OFFSET $3`, [scope, pageSize + 1, page * pageSize],
    )
    rows.push(...result.rows.slice(0, pageSize).map((row) => ({ ...row,
      // pg returns timestamptz as Date. Source hashing needs the actual timestamp,
      // not an object's empty enumerable keys, including metadata-only edits.
      ...Object.fromEntries(['definition_updated_at', 'variant_updated_at', 'profile_updated_at'].map((key) =>
        [key, row[key] instanceof Date ? row[key].toISOString() : row[key] ?? null])),
    })))
    if (result.rows.length <= pageSize) return { rows, searchComplete: true }
  }
  return { rows, searchComplete: false }
}
