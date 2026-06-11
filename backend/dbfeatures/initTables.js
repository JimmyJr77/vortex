import { SEED_SCHOOLS } from './seedSchools.js'

// Creates schema for Schools, member<->school links, registration->member link,
// the append-only note log, and saved DB queries. Then seeds schools and runs
// idempotent backfills. Safe to run on every server start.
export async function initDbFeatureTables(pool) {
  try {
    // ── Schema ────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS school (
        id          BIGSERIAL PRIMARY KEY,
        facility_id BIGINT REFERENCES facility(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        level       TEXT CHECK (level IN ('high','middle','elementary','other')),
        location    TEXT,
        is_verified BOOLEAN NOT NULL DEFAULT TRUE,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS school_name_unique
      ON school (facility_id, lower(name))
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_school_verified ON school(is_verified)`)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS member_school (
        member_id  BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
        school_id  BIGINT NOT NULL REFERENCES school(id) ON DELETE CASCADE,
        source     TEXT DEFAULT 'admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (member_id, school_id)
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_school_member ON member_school(member_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_school_school ON member_school(school_id)`)

    await pool.query(`
      ALTER TABLE registrations
      ADD COLUMN IF NOT EXISTS member_id BIGINT REFERENCES member(id) ON DELETE SET NULL
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_registrations_member ON registrations(member_id)`)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS note (
        id           BIGSERIAL PRIMARY KEY,
        subject_type TEXT NOT NULL CHECK (subject_type IN ('member','registration')),
        subject_id   BIGINT NOT NULL,
        note_type    TEXT NOT NULL CHECK (note_type IN ('user_comment','staff_note')),
        body         TEXT NOT NULL,
        author_kind  TEXT CHECK (author_kind IN ('user','admin','system')),
        author_id    BIGINT,
        author_email TEXT,
        author_name  TEXT,
        source       TEXT,
        is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_note_subject
      ON note(subject_type, subject_id, created_at DESC)
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_query (
        id          BIGSERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        base_entity TEXT NOT NULL,
        config      JSONB NOT NULL,
        created_by  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    // ── Seed schools ──────────────────────────────────────────────────────
    // Attach to the first facility if one exists (tenant scoping), else NULL.
    const facilityRes = await pool.query('SELECT id FROM facility ORDER BY id LIMIT 1')
    const facilityId = facilityRes.rows[0]?.id ?? null

    for (const [name, level, location] of SEED_SCHOOLS) {
      await pool.query(
        `
        INSERT INTO school (facility_id, name, level, location, is_verified, is_active)
        VALUES ($1, $2, $3, $4, TRUE, TRUE)
        ON CONFLICT (facility_id, lower(name)) DO NOTHING
        `,
        [facilityId, name, level, location],
      )
    }

    // ── Backfills (idempotent) ──────────────────────────────────────────────
    await backfillRegistrationMembers(pool)
    await backfillNotesFromRegistrations(pool)
    await backfillMemberSchoolsFromSignups(pool, facilityId)

    console.log('✅ DB feature tables (schools, notes, saved queries) initialized')
  } catch (error) {
    console.error('❌ DB feature tables initialization error:', error)
  }
}

// Link registrations to members by email, then phone, where not already linked.
async function backfillRegistrationMembers(pool) {
  await pool.query(`
    UPDATE registrations r
    SET member_id = m.id
    FROM member m
    WHERE r.member_id IS NULL
      AND r.email IS NOT NULL
      AND lower(m.email) = lower(r.email)
  `)
  await pool.query(`
    UPDATE registrations r
    SET member_id = m.id
    FROM member m
    WHERE r.member_id IS NULL
      AND r.phone IS NOT NULL AND r.phone <> ''
      AND m.phone = r.phone
  `)
}

// Seed the note log from existing registration message + admin_notes.
// Guarded by source so re-running does not duplicate.
async function backfillNotesFromRegistrations(pool) {
  await pool.query(`
    INSERT INTO note (subject_type, subject_id, note_type, body, author_kind, source, created_at)
    SELECT 'registration', r.id, 'user_comment', r.message, 'user', 'inquiry_message', r.created_at
    FROM registrations r
    WHERE r.message IS NOT NULL AND btrim(r.message) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM note n
        WHERE n.subject_type = 'registration' AND n.subject_id = r.id
          AND n.source = 'inquiry_message'
      )
  `)
  await pool.query(`
    INSERT INTO note (subject_type, subject_id, note_type, body, author_kind, source, created_at)
    SELECT 'registration', r.id, 'staff_note', r.admin_notes, 'admin', 'inquiry_admin_notes', COALESCE(r.updated_at, r.created_at)
    FROM registrations r
    WHERE r.admin_notes IS NOT NULL AND btrim(r.admin_notes) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM note n
        WHERE n.subject_type = 'registration' AND n.subject_id = r.id
          AND n.source = 'inquiry_admin_notes'
      )
  `)
}

// Link members to schools from scheduling signup responses.current_school.
async function backfillMemberSchoolsFromSignups(pool, facilityId) {
  const res = await pool.query(`
    SELECT s.email, s.phone, btrim(s.responses->>'current_school') AS school_name
    FROM scheduling_signup s
    WHERE COALESCE(btrim(s.responses->>'current_school'), '') <> ''
  `)

  for (const row of res.rows) {
    const schoolName = row.school_name
    if (!schoolName) continue

    // Match to a member by email then phone
    const memberRes = await pool.query(
      `
      SELECT id FROM member
      WHERE ($1 <> '' AND lower(email) = lower($1))
         OR ($2 <> '' AND phone = $2)
      ORDER BY id
      LIMIT 1
      `,
      [row.email || '', row.phone || ''],
    )
    const memberId = memberRes.rows[0]?.id
    if (!memberId) continue

    // Resolve school: verified match by normalized name, else create write-in
    let schoolRes = await pool.query(
      'SELECT id FROM school WHERE lower(name) = lower($1) LIMIT 1',
      [schoolName],
    )
    let schoolId = schoolRes.rows[0]?.id
    if (!schoolId) {
      const insertRes = await pool.query(
        `
        INSERT INTO school (facility_id, name, level, is_verified, is_active)
        VALUES ($1, $2, 'other', FALSE, TRUE)
        ON CONFLICT (facility_id, lower(name)) DO NOTHING
        RETURNING id
        `,
        [facilityId, schoolName],
      )
      schoolId =
        insertRes.rows[0]?.id ??
        (await pool.query('SELECT id FROM school WHERE lower(name) = lower($1) LIMIT 1', [schoolName]))
          .rows[0]?.id
    }
    if (!schoolId) continue

    await pool.query(
      `
      INSERT INTO member_school (member_id, school_id, source)
      VALUES ($1, $2, 'signup')
      ON CONFLICT (member_id, school_id) DO NOTHING
      `,
      [memberId, schoolId],
    )
  }
}
