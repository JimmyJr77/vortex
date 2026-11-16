// These counts come from business records and are independent of browser analytics consent.
// Rows are counted by creation date and current confirmed/fulfilled status.
export async function getBusinessOutcomes(pool, range, facilityId) {
  if (!facilityId) return null
  const { rows: [totals] } = await pool.query(`
    WITH bookings AS (
      SELECT COUNT(*) FILTER (WHERE b.benefit_type = 'free_trial')::int AS free_trials,
             COUNT(*) FILTER (WHERE b.benefit_type <> 'free_trial')::int AS other_drop_ins
      FROM drop_in_registration b
      JOIN scheduling_form f ON f.id = b.form_id
      JOIN program p ON p.id = f.program_id AND p.facility_id = $3
      WHERE b.created_at BETWEEN $1 AND $2 AND b.status IN ('confirmed', 'attended')
    ), enrollments AS (
      SELECT COUNT(*)::int AS enrollments
      FROM account_enrollment_current s
      WHERE s.record_facility_id = $3 AND s.created_at BETWEEN $1 AND $2 AND s.status IN ('confirmed', 'completed', 'paused')
        AND s.archived_at IS NULL AND s.orphaned_at IS NULL AND s.historical_only IS NOT TRUE
    ), orders AS (
      SELECT COUNT(*)::int AS store_orders, COALESCE(SUM(total_cents), 0)::float8 AS store_order_value_cents
      FROM store_order
      WHERE facility_id = $3 AND created_at BETWEEN $1 AND $2
        AND source IN ('public', 'member') AND status IN ('placed', 'fulfilled')
    )
    SELECT * FROM bookings CROSS JOIN enrollments CROSS JOIN orders`, [range.from, range.to, facilityId])
  return totals
}
