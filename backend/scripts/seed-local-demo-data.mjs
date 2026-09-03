import pg from 'pg'
import { seedDevTestMembers, DEV_TEST_FLAG } from '../members/seedDevTestMembers.js'

if (process.env.LOCAL_DEV_SEED !== 'true') {
  throw new Error('Refusing to seed demo data without LOCAL_DEV_SEED=true')
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

const DEMO_CLASSES = [
  ['[DEV] Acrobatics Lab — Ages 8–11', 1, '16:00', '17:00', 12, 8],
  ['[DEV] Ninja Foundations — Ages 6–9', 2, '17:00', '18:00', 14, 11],
  ['[DEV] Tumbling Skills — Ages 10–14', 3, '18:00', '19:00', 12, 7],
  ['[DEV] Strength & Mobility — Teens', 4, '17:30', '18:30', 10, 6],
  ['[DEV] Preschool Movement — Ages 3–5', 5, '10:00', '10:45', 10, 9],
  ['[DEV] Adult Open Gym', 6, '19:00', '20:00', 16, 5],
]

const DEMO_PRODUCTS = [
  ['VTX-DEV-GRIP-CHALK', '[DEV] Grip Chalk', 'Fictional chalk block for front-desk testing.', 'other', 650, 42, false, 120],
  ['VTX-DEV-WRISTBAND', '[DEV] Vortex Wristband', 'Fictional training wristband.', 'apparel', 800, 30, true, 130],
  ['VTX-DEV-WATER', '[DEV] Electrolyte Water', 'Fictional cold drink for counter-sale testing.', 'food_drink', 350, 48, false, 140],
  ['VTX-DEV-PROTEIN', '[DEV] Protein Bar', 'Fictional snack for counter-sale testing.', 'food_drink', 425, 24, false, 150],
  ['VTX-DEV-HOODIE', '[DEV] Team Hoodie', 'Fictional heavyweight hoodie.', 'apparel', 5500, 14, true, 160],
  ['VTX-DEV-KEYCHAIN', '[DEV] Foam Keychain', 'Fictional Vortex souvenir keychain.', 'other', 500, 60, true, 170],
]

function fakeEmail(member) {
  if (member.email) return member.email
  return `dev.athlete.${member.id}@test.vortex.dev`
}

async function seedClasses(client, facilityId) {
  const programs = await client.query(
    'SELECT id FROM program WHERE facility_id = $1 AND is_active = TRUE ORDER BY id',
    [facilityId],
  )
  if (programs.rows.length === 0) throw new Error('No active programs exist for the local facility')

  await client.query('DELETE FROM "class" WHERE facility_id = $1 AND name LIKE $2', [facilityId, '[DEV] %'])
  for (const [index, [name, dayOfWeek, startTime, endTime, maxCapacity, currentEnrollment]] of DEMO_CLASSES.entries()) {
    const programId = programs.rows[index % programs.rows.length].id
    await client.query(
      `INSERT INTO "class"
        (facility_id, program_id, name, start_time, end_time, day_of_week, max_capacity, current_enrollment, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)`,
      [facilityId, programId, name, startTime, endTime, dayOfWeek, maxCapacity, currentEnrollment],
    )
  }
  return DEMO_CLASSES.length
}

async function seedEnrollments(client, facilityId) {
  const members = await client.query(
    `SELECT id, first_name, last_name, email, phone
       FROM member
      WHERE facility_id = $1 AND internal_flags = $2
      ORDER BY id`,
    [facilityId, DEV_TEST_FLAG],
  )
  const slots = await client.query(
    `SELECT st.id, st.form_id, st.slot_group_id
       FROM scheduling_time_slot st
       JOIN scheduling_form sf ON sf.id = st.form_id
      WHERE st.is_active = TRUE AND sf.is_active = TRUE AND sf.deleted_at IS NULL
      ORDER BY st.form_id, st.id`,
  )
  if (slots.rows.length === 0) throw new Error('No local schedule slots exist. Run seed:local-scheduling first.')

  await client.query(
    `DELETE FROM scheduling_signup
      WHERE admin_stub = TRUE
        AND member_id IN (SELECT id FROM member WHERE facility_id = $1 AND internal_flags = $2)`,
    [facilityId, DEV_TEST_FLAG],
  )

  const statuses = ['confirmed', 'confirmed', 'confirmed', 'waitlisted', 'paused', 'cancelled']
  for (const [index, member] of members.rows.entries()) {
    const slot = slots.rows[index % slots.rows.length]
    const status = statuses[index % statuses.length]
    const memberName = `${member.first_name} ${member.last_name}`
    const responses = {
      source: 'local_demo_seed',
      athlete_name: memberName,
      experience_level: ['new', 'beginner', 'intermediate'][index % 3],
    }
    await client.query(
      `INSERT INTO scheduling_signup
        (form_id, time_slot_id, slot_group_id, first_name, last_name, email, phone,
         field_responses, responses, status, member_id, admin_stub, enrollment_start_date,
         paused_at, cancel_requested_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $8::jsonb, $9::varchar(50), $10, TRUE,
               CURRENT_DATE - ($11::int),
               CASE WHEN $9::text = 'paused' THEN now() - interval '2 days' ELSE NULL END,
               CASE WHEN $9::text = 'cancelled' THEN now() - interval '4 days' ELSE NULL END)`,
      [
        slot.form_id,
        slot.id,
        slot.slot_group_id,
        member.first_name,
        member.last_name,
        fakeEmail(member),
        member.phone || '555-0100',
        JSON.stringify(responses),
        status,
        member.id,
        (index + 1) * 7,
      ],
    )
  }
  return members.rows.length
}

async function seedProducts(client, facilityId) {
  for (const [sku, name, description, category, priceCents, inventoryQuantity, isPublic, sortOrder] of DEMO_PRODUCTS) {
    await client.query(
      `INSERT INTO store_product
        (facility_id, sku, name, description, category, price_cents, inventory_quantity, is_public, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)
       ON CONFLICT (facility_id, sku) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         price_cents = EXCLUDED.price_cents,
         inventory_quantity = EXCLUDED.inventory_quantity,
         is_public = EXCLUDED.is_public,
         is_active = TRUE,
         sort_order = EXCLUDED.sort_order,
         updated_at = now()`,
      [facilityId, sku, name, description, category, priceCents, inventoryQuantity, isPublic, sortOrder],
    )
  }
  return DEMO_PRODUCTS.length
}

try {
  const members = await seedDevTestMembers(pool, { replace: true })
  const facility = await pool.query('SELECT id FROM facility ORDER BY id LIMIT 1')
  const facilityId = facility.rows[0]?.id
  if (!facilityId) throw new Error('No local facility exists')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const classes = await seedClasses(client, facilityId)
    const enrollments = await seedEnrollments(client, facilityId)
    const products = await seedProducts(client, facilityId)
    await client.query('COMMIT')
    console.log(JSON.stringify({
      success: true,
      members: members.created,
      classes,
      enrollments,
      products,
      memberPassword: members.password,
    }))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
} finally {
  await pool.end()
}
