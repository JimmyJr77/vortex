// Bookings and individual session edits share the day lock. A day closure
// takes it exclusively, including when a new schedule has just been added.
export async function lockSchedulingDay(client, facilityId, date, { shared = false } = {}) {
  const lock = shared ? 'pg_advisory_xact_lock_shared' : 'pg_advisory_xact_lock'
  await client.query(`SELECT ${lock}(hashtextextended($1::text, 0))`, [
    `scheduling-day-cancellation:${facilityId}:${date}`,
  ])
}

export async function listSchedulingDayCancellations(db, facilityId, startDate, endDate) {
  const result = await db.query(`
    SELECT occurrence_date::text
    FROM scheduling_day_cancellation
    WHERE facility_id = $1 AND occurrence_date BETWEEN $2::date AND $3::date
    ORDER BY occurrence_date
  `, [facilityId, startDate, endDate])
  return result.rows.map(row => row.occurrence_date)
}

export async function setSchedulingDayCancellation(pool, { facilityId, date, cancelled, beforeCancellation, onRestore }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await lockSchedulingDay(client, facilityId, date)
    if (cancelled) {
      const existing = await client.query(`SELECT 1 FROM scheduling_day_cancellation
        WHERE facility_id=$1 AND occurrence_date=$2::date`, [facilityId,date])
      if (!existing.rows.length) await beforeCancellation?.(client)
      await client.query(`
        INSERT INTO scheduling_day_cancellation (facility_id, occurrence_date)
        VALUES ($1, $2::date)
        ON CONFLICT (facility_id, occurrence_date) DO NOTHING
      `, [facilityId, date])
    } else {
      await onRestore?.(client)
      await client.query(`
        DELETE FROM scheduling_day_cancellation
        WHERE facility_id = $1 AND occurrence_date = $2::date
      `, [facilityId, date])
    }
    await client.query('COMMIT')
    return { date, cancelled }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
