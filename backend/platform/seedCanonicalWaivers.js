import { CANONICAL_WAIVER_TEMPLATES } from './canonicalWaiverBodies.js'

/** Idempotent seed of four canonical waiver templates per facility. */
export async function seedCanonicalWaivers(pool) {
  const facilities = await pool.query(`SELECT id FROM facility`)
  for (const facility of facilities.rows) {
    const facilityId = facility.id

    // Retire legacy generic placeholder if canonical set is being seeded
    await pool.query(
      `
        UPDATE waiver_template
        SET active_to = now(), updated_at = now()
        WHERE facility_id = $1
          AND name = 'Athlete Waiver'
          AND (waiver_type IS NULL OR waiver_type = '')
          AND active_to IS NULL
      `,
      [facilityId],
    )

    for (const template of CANONICAL_WAIVER_TEMPLATES) {
      await pool.query(
        `
          INSERT INTO waiver_template (
            facility_id, name, version, body, waiver_type, is_required, active_from, requires_resign
          )
          SELECT $1, $2, $3, $4, $5, TRUE, now(), FALSE
          WHERE NOT EXISTS (
            SELECT 1 FROM waiver_template wt
            WHERE wt.facility_id = $1
              AND wt.waiver_type = $5
              AND wt.active_to IS NULL
          )
        `,
        [facilityId, template.name, template.version, template.body, template.waiverType],
      )
    }
  }
}
