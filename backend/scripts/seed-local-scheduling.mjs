import pg from 'pg'

if (process.env.LOCAL_DEV_SEED !== 'true') {
  throw new Error('Refusing to seed schedules without LOCAL_DEV_SEED=true')
}

const connectionString = process.env.DATABASE_URL || process.env.DB_URL
const dbHost = process.env.DB_HOST || 'localhost'
if (connectionString || !['localhost', '127.0.0.1', 'postgres'].includes(dbHost)) {
  throw new Error('Refusing to seed a non-local database')
}

const pool = new pg.Pool({
  host: dbHost,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'vortex_athletics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
})

const isoDate = (date) => date.toISOString().slice(0, 10)
const activeStart = new Date()
activeStart.setUTCHours(0, 0, 0, 0)
const activeEnd = new Date(activeStart)
activeEnd.setUTCFullYear(activeEnd.getUTCFullYear() + 1)

const forms = await pool.query(`
  SELECT sf.id, sf.title
  FROM scheduling_form sf
  WHERE sf.deleted_at IS NULL
    AND sf.is_active = TRUE
  ORDER BY sf.id
`)

let seeded = 0
for (const [index, form] of forms.rows.entries()) {
  const existing = await pool.query(
    `SELECT 1 FROM scheduling_time_slot WHERE form_id = $1 AND is_active = TRUE LIMIT 1`,
    [form.id],
  )
  if (existing.rows.length > 0) continue

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const offering = await client.query(
      `
        INSERT INTO scheduling_offering
          (form_id, start_date, end_date, label, is_selected)
        VALUES ($1, $2, $3, 'Local development schedule', TRUE)
        RETURNING id
      `,
      [form.id, isoDate(activeStart), isoDate(activeEnd)],
    )
    const group = await client.query(
      `
        INSERT INTO scheduling_slot_group
          (form_id, schedule_mode, max_participants, active_start, active_end,
           dates_tbd, is_active, offering_id, inherits_offering_dates)
        VALUES ($1, 'day', 12, $2, $3, FALSE, TRUE, $4, TRUE)
        RETURNING id
      `,
      [form.id, isoDate(activeStart), isoDate(activeEnd), offering.rows[0].id],
    )

    const weekday = (index % 5) + 1
    const hour = 16 + (index % 4)
    const startTime = `${String(hour).padStart(2, '0')}:00`
    const endTime = `${String(hour + 1).padStart(2, '0')}:00`
    await client.query(
      `
        INSERT INTO scheduling_time_slot
          (form_id, slot_group_id, schedule_mode, day_of_week, start_time,
           end_time, max_participants, active_start, active_end, dates_tbd, is_active)
        VALUES ($1, $2, 'day', $3, $4, $5, 12, $6, $7, FALSE, TRUE)
      `,
      [
        form.id,
        group.rows[0].id,
        weekday,
        startTime,
        endTime,
        isoDate(activeStart),
        isoDate(activeEnd),
      ],
    )
    await client.query('COMMIT')
    seeded += 1
    console.log(`Seeded local schedule: ${form.title}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

await pool.end()
console.log(`Local scheduling seed complete (${seeded} forms added)`)
