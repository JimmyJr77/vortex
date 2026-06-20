export async function initSchedulingTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduling_form (
      id            BIGSERIAL PRIMARY KEY,
      title         VARCHAR(255) NOT NULL,
      description   TEXT,
      start_date    DATE,
      end_date      DATE,
      signup_fields JSONB NOT NULL DEFAULT '["first_name","last_name","email"]'::jsonb,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    ALTER TABLE scheduling_form
    ADD COLUMN IF NOT EXISTS signup_fields JSONB NOT NULL DEFAULT '["first_name","last_name","email"]'::jsonb
  `)

  await pool.query(`
    ALTER TABLE scheduling_form
    ADD COLUMN IF NOT EXISTS mandate_waiver BOOLEAN NOT NULL DEFAULT FALSE
  `)

  await pool.query(`
    ALTER TABLE scheduling_form
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `)

  await pool.query(`
    ALTER TABLE scheduling_form
    ADD COLUMN IF NOT EXISTS max_slots_per_user INTEGER
  `)
  await pool.query(`
    ALTER TABLE scheduling_form
    ADD COLUMN IF NOT EXISTS slot_cost_monthly_cents INTEGER NOT NULL DEFAULT 0
  `)
  await pool.query(`
    ALTER TABLE scheduling_form
    ADD COLUMN IF NOT EXISTS programs_id BIGINT
  `)
  await pool.query(`
    ALTER TABLE scheduling_form
    ADD COLUMN IF NOT EXISTS program_id BIGINT
  `)
  await pool.query(`
    ALTER TABLE scheduling_form
    ADD COLUMN IF NOT EXISTS pricing_overrides_program BOOLEAN NOT NULL DEFAULT FALSE
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduling_category (
      id          BIGSERIAL PRIMARY KEY,
      form_id     BIGINT REFERENCES scheduling_form(id) ON DELETE CASCADE,
      name        VARCHAR(255) NOT NULL,
      description TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    ALTER TABLE scheduling_category ALTER COLUMN form_id DROP NOT NULL
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduling_time_slot (
      id               BIGSERIAL PRIMARY KEY,
      form_id          BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
      category_id      BIGINT REFERENCES scheduling_category(id) ON DELETE CASCADE,
      schedule_mode    VARCHAR(10) DEFAULT 'day',
      week_letter      VARCHAR(2),
      day_of_week      INTEGER,
      specific_date    DATE,
      start_time       TIME NOT NULL,
      end_time         TIME NOT NULL,
      max_participants INTEGER NOT NULL DEFAULT 10,
      start_date       DATE,
      end_date         DATE,
      active_start     DATE,
      active_end       DATE,
      dates_tbd        BOOLEAN NOT NULL DEFAULT FALSE,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    ALTER TABLE scheduling_time_slot ADD COLUMN IF NOT EXISTS schedule_mode VARCHAR(10) DEFAULT 'day'
  `)
  await pool.query(`
    ALTER TABLE scheduling_time_slot ADD COLUMN IF NOT EXISTS week_letter VARCHAR(2)
  `)
  await pool.query(`
    ALTER TABLE scheduling_time_slot ADD COLUMN IF NOT EXISTS specific_date DATE
  `)
  await pool.query(`
    ALTER TABLE scheduling_time_slot ADD COLUMN IF NOT EXISTS active_start DATE
  `)
  await pool.query(`
    ALTER TABLE scheduling_time_slot ADD COLUMN IF NOT EXISTS active_end DATE
  `)
  await pool.query(`
    ALTER TABLE scheduling_time_slot ADD COLUMN IF NOT EXISTS dates_tbd BOOLEAN NOT NULL DEFAULT FALSE
  `)
  await pool.query(`
    ALTER TABLE scheduling_time_slot ALTER COLUMN day_of_week DROP NOT NULL
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduling_signup (
      id              BIGSERIAL PRIMARY KEY,
      form_id         BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
      category_id     BIGINT NOT NULL REFERENCES scheduling_category(id),
      time_slot_id    BIGINT NOT NULL REFERENCES scheduling_time_slot(id),
      first_name      VARCHAR(255),
      last_name       VARCHAR(255),
      email           VARCHAR(255),
      phone           VARCHAR(50),
      field_responses JSONB NOT NULL DEFAULT '{}',
      responses       JSONB NOT NULL DEFAULT '{}',
      status          VARCHAR(50) NOT NULL DEFAULT 'confirmed',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS responses JSONB NOT NULL DEFAULT '{}'::jsonb
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS waiver_email_sent_at TIMESTAMPTZ
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS promotion_email_sent_at TIMESTAMPTZ
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS demotion_email_sent_at TIMESTAMPTZ
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup DROP CONSTRAINT IF EXISTS scheduling_signup_status_check
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup
    ADD CONSTRAINT scheduling_signup_status_check
    CHECK (status IN ('confirmed', 'waitlisted', 'cancelled'))
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduling_form_category (
      form_id     BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
      category_id BIGINT NOT NULL REFERENCES scheduling_category(id) ON DELETE CASCADE,
      PRIMARY KEY (form_id, category_id)
    )
  `)

  await pool.query(`
    INSERT INTO scheduling_form_category (form_id, category_id)
    SELECT form_id, id FROM scheduling_category WHERE form_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `)

  await pool.query(`
    INSERT INTO scheduling_form_category (form_id, category_id)
    SELECT DISTINCT form_id, category_id FROM scheduling_time_slot
    WHERE category_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `)

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_category_form ON scheduling_category(form_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_form_category_form ON scheduling_form_category(form_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_slot_form ON scheduling_time_slot(form_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_slot_category ON scheduling_time_slot(category_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_signup_slot ON scheduling_signup(time_slot_id)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduling_slot_group (
      id               BIGSERIAL PRIMARY KEY,
      form_id          BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
      category_id      BIGINT REFERENCES scheduling_category(id) ON DELETE CASCADE,
      schedule_mode    VARCHAR(10) NOT NULL DEFAULT 'day',
      max_participants INTEGER NOT NULL DEFAULT 10,
      active_start     DATE,
      active_end       DATE,
      dates_tbd        BOOLEAN NOT NULL DEFAULT FALSE,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    ALTER TABLE scheduling_time_slot
    ADD COLUMN IF NOT EXISTS slot_group_id BIGINT REFERENCES scheduling_slot_group(id) ON DELETE CASCADE
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup
    ADD COLUMN IF NOT EXISTS slot_group_id BIGINT REFERENCES scheduling_slot_group(id)
  `)

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_slot_group_form ON scheduling_slot_group(form_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_slot_group_category ON scheduling_slot_group(category_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_time_slot_group ON scheduling_time_slot(slot_group_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_signup_group ON scheduling_signup(slot_group_id)`)

  const ungrouped = await pool.query(
    'SELECT * FROM scheduling_time_slot WHERE slot_group_id IS NULL ORDER BY id',
  )
  for (const slot of ungrouped.rows) {
    const groupRes = await pool.query(
      `
      INSERT INTO scheduling_slot_group (
        form_id, category_id, schedule_mode, max_participants,
        active_start, active_end, dates_tbd, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        slot.form_id,
        slot.category_id,
        slot.schedule_mode || 'day',
        slot.max_participants,
        slot.active_start,
        slot.active_end,
        slot.dates_tbd ?? false,
        slot.is_active ?? true,
      ],
    )
    await pool.query('UPDATE scheduling_time_slot SET slot_group_id = $1 WHERE id = $2', [
      groupRes.rows[0].id,
      slot.id,
    ])
  }

  await pool.query(`
    UPDATE scheduling_signup s
    SET slot_group_id = ts.slot_group_id
    FROM scheduling_time_slot ts
    WHERE s.time_slot_id = ts.id AND s.slot_group_id IS NULL
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup ALTER COLUMN category_id DROP NOT NULL
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup ALTER COLUMN time_slot_id DROP NOT NULL
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup
    ADD COLUMN IF NOT EXISTS orphaned_at TIMESTAMPTZ
  `)
  await pool.query(`
    ALTER TABLE scheduling_signup
    ADD COLUMN IF NOT EXISTS status_at_orphaning VARCHAR(50)
  `)
  await pool.query(`
    ALTER TABLE scheduling_signup
    ADD COLUMN IF NOT EXISTS orphaned_snapshot JSONB
  `)
  await pool.query(`
    ALTER TABLE scheduling_signup
    ADD COLUMN IF NOT EXISTS re_enrolled_at TIMESTAMPTZ
  `)
  await pool.query(`
    ALTER TABLE scheduling_signup
    ADD COLUMN IF NOT EXISTS re_enrolled_signup_id BIGINT REFERENCES scheduling_signup(id) ON DELETE SET NULL
  `)
  await pool.query(`
    ALTER TABLE scheduling_signup
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_scheduling_signup_orphaned
    ON scheduling_signup(form_id, orphaned_at)
    WHERE orphaned_at IS NOT NULL AND re_enrolled_at IS NULL
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_scheduling_signup_archived
    ON scheduling_signup(form_id, archived_at)
    WHERE archived_at IS NOT NULL
  `)

  await pool.query(`
    ALTER TABLE scheduling_signup
    ADD COLUMN IF NOT EXISTS member_id BIGINT REFERENCES member(id) ON DELETE SET NULL
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_signup_member ON scheduling_signup(member_id)`)
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_scheduling_signup_form_member ON scheduling_signup(form_id, member_id)`,
  )

  await pool.query(`
    ALTER TABLE scheduling_signup
    ADD COLUMN IF NOT EXISTS admin_stub BOOLEAN NOT NULL DEFAULT FALSE
  `)

  await pool.query(`
    ALTER TABLE member
    ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT TRUE
  `)
  await pool.query(`
    ALTER TABLE member
    ADD COLUMN IF NOT EXISTS signup_source VARCHAR(32)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduling_auth_token (
      id          BIGSERIAL PRIMARY KEY,
      token_hash  TEXT NOT NULL,
      email       VARCHAR(255) NOT NULL,
      form_id     BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
      member_id   BIGINT REFERENCES member(id) ON DELETE CASCADE,
      expires_at  TIMESTAMPTZ NOT NULL,
      used_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_scheduling_auth_token_email_form ON scheduling_auth_token(email, form_id)`,
  )

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduling_offering (
      id           BIGSERIAL PRIMARY KEY,
      form_id      BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
      category_id  BIGINT NOT NULL REFERENCES scheduling_category(id) ON DELETE CASCADE,
      start_date   DATE NOT NULL,
      end_date     DATE NOT NULL,
      label        VARCHAR(255),
      is_selected  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_offering_form ON scheduling_offering(form_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_offering_category ON scheduling_offering(category_id)`)
  await pool.query(`DROP INDEX IF EXISTS idx_scheduling_offering_selected`)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduling_offering_selected
    ON scheduling_offering(form_id, category_id) WHERE is_selected = TRUE AND category_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduling_offering_selected_no_cat
    ON scheduling_offering(form_id) WHERE is_selected = TRUE AND category_id IS NULL
  `)
  await pool.query(`
    ALTER TABLE scheduling_offering
      ALTER COLUMN category_id DROP NOT NULL
  `)
  await pool.query(`
    ALTER TABLE scheduling_slot_group
    ADD COLUMN IF NOT EXISTS offering_id BIGINT REFERENCES scheduling_offering(id) ON DELETE SET NULL
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduling_slot_group_offering ON scheduling_slot_group(offering_id)`)

  const fs = await import('fs')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const offeringsMigration = path.join(__dirname, '../migrations/add_scheduling_offerings.sql')
  if (fs.existsSync(offeringsMigration)) {
    try {
      await pool.query(fs.readFileSync(offeringsMigration, 'utf8'))
    } catch (err) {
      console.warn('[scheduling] offerings migration:', err.message)
    }
  }

  const enrollSitesMigration = path.join(__dirname, '../migrations/add_scheduling_enroll_sites.sql')
  if (fs.existsSync(enrollSitesMigration)) {
    try {
      await pool.query(fs.readFileSync(enrollSitesMigration, 'utf8'))
    } catch (err) {
      console.warn('[scheduling] enroll sites migration:', err.message)
    }
  }

  try {
    const { ensureDiscountEngineSchema } = await import('../programs/schema.js')
    await ensureDiscountEngineSchema(pool)
  } catch (err) {
    console.warn('[scheduling] discount engine migration:', err.message)
  }

  const freePassesMigration = path.join(__dirname, '../migrations/add_free_passes.sql')
  if (fs.existsSync(freePassesMigration)) {
    try {
      await pool.query(fs.readFileSync(freePassesMigration, 'utf8'))
    } catch (err) {
      console.warn('[scheduling] free passes migration:', err.message)
    }
  }

  const benefitSelectionMigration = path.join(__dirname, '../migrations/add_pricing_benefit_selection.sql')
  if (fs.existsSync(benefitSelectionMigration)) {
    try {
      await pool.query(fs.readFileSync(benefitSelectionMigration, 'utf8'))
    } catch (err) {
      console.warn('[scheduling] benefit selection migration:', err.message)
    }
  }

  console.log('✅ Scheduling tables ready')
}
