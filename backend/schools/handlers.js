// Schools admin handlers: CRUD, roster, deconfliction (merge/promote write-ins).

function mapSchoolRow(row) {
  return {
    id: Number(row.id),
    facilityId: row.facility_id != null ? Number(row.facility_id) : null,
    name: row.name,
    level: row.level || null,
    location: row.location || null,
    isVerified: row.is_verified,
    isActive: row.is_active,
    createdAt: row.created_at,
    memberCount: row.member_count != null ? Number(row.member_count) : undefined,
  }
}

export function createSchoolsHandlers(pool) {
  return {
    async listSchools(req, res) {
      try {
        const { level, active, verified } = req.query
        const params = []
        const where = []
        if (level) {
          params.push(level)
          where.push(`s.level = $${params.length}`)
        }
        if (active === 'true' || active === 'false') {
          params.push(active === 'true')
          where.push(`s.is_active = $${params.length}`)
        }
        if (verified === 'true' || verified === 'false') {
          params.push(verified === 'true')
          where.push(`s.is_verified = $${params.length}`)
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
        const result = await pool.query(
          `
          SELECT s.*, (
            SELECT COUNT(*)::int FROM member_school ms WHERE ms.school_id = s.id
          ) AS member_count
          FROM school s
          ${whereSql}
          ORDER BY s.is_verified ASC, s.level NULLS LAST, s.name ASC
          `,
          params,
        )
        res.json({ success: true, data: result.rows.map(mapSchoolRow) })
      } catch (err) {
        console.error('[schools] listSchools:', err)
        res.status(500).json({ success: false, message: 'Failed to load schools' })
      }
    },

    async listUnverified(_req, res) {
      try {
        const result = await pool.query(
          `
          SELECT s.*, (
            SELECT COUNT(*)::int FROM member_school ms WHERE ms.school_id = s.id
          ) AS member_count
          FROM school s
          WHERE s.is_verified = FALSE
          ORDER BY s.created_at DESC
          `,
        )
        res.json({ success: true, data: result.rows.map(mapSchoolRow) })
      } catch (err) {
        console.error('[schools] listUnverified:', err)
        res.status(500).json({ success: false, message: 'Failed to load write-in schools' })
      }
    },

    async createSchool(req, res) {
      try {
        const { name, level, location, isActive } = req.body
        if (!name || !String(name).trim()) {
          return res.status(400).json({ success: false, message: 'School name is required' })
        }
        const facilityRes = await pool.query('SELECT id FROM facility ORDER BY id LIMIT 1')
        const facilityId = facilityRes.rows[0]?.id ?? null
        const result = await pool.query(
          `
          INSERT INTO school (facility_id, name, level, location, is_verified, is_active)
          VALUES ($1, $2, $3, $4, TRUE, $5)
          ON CONFLICT (facility_id, lower(name)) DO UPDATE
            SET level = EXCLUDED.level, location = EXCLUDED.location, is_active = EXCLUDED.is_active
          RETURNING *
          `,
          [facilityId, String(name).trim(), level || null, location || null, isActive !== false],
        )
        res.json({ success: true, data: mapSchoolRow(result.rows[0]) })
      } catch (err) {
        console.error('[schools] createSchool:', err)
        res.status(500).json({ success: false, message: 'Failed to create school' })
      }
    },

    async updateSchool(req, res) {
      try {
        const { name, level, location, isActive, isVerified } = req.body
        const result = await pool.query(
          `
          UPDATE school
          SET name = COALESCE($1, name),
              level = COALESCE($2, level),
              location = $3,
              is_active = COALESCE($4, is_active),
              is_verified = COALESCE($5, is_verified)
          WHERE id = $6
          RETURNING *
          `,
          [
            name ? String(name).trim() : null,
            level || null,
            location ?? null,
            typeof isActive === 'boolean' ? isActive : null,
            typeof isVerified === 'boolean' ? isVerified : null,
            req.params.id,
          ],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'School not found' })
        }
        res.json({ success: true, data: mapSchoolRow(result.rows[0]) })
      } catch (err) {
        console.error('[schools] updateSchool:', err)
        res.status(500).json({ success: false, message: 'Failed to update school' })
      }
    },

    async setActive(req, res) {
      try {
        const result = await pool.query(
          'UPDATE school SET is_active = $1 WHERE id = $2 RETURNING *',
          [req.body.isActive !== false, req.params.id],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'School not found' })
        }
        res.json({ success: true, data: mapSchoolRow(result.rows[0]) })
      } catch (err) {
        console.error('[schools] setActive:', err)
        res.status(500).json({ success: false, message: 'Failed to update school' })
      }
    },

    // Promote a write-in to a verified school, optionally editing details.
    async verifySchool(req, res) {
      try {
        const { name, level, location } = req.body
        const result = await pool.query(
          `
          UPDATE school
          SET is_verified = TRUE,
              name = COALESCE($1, name),
              level = COALESCE($2, level),
              location = COALESCE($3, location)
          WHERE id = $4
          RETURNING *
          `,
          [name ? String(name).trim() : null, level || null, location ?? null, req.params.id],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'School not found' })
        }
        res.json({ success: true, data: mapSchoolRow(result.rows[0]) })
      } catch (err) {
        console.error('[schools] verifySchool:', err)
        res.status(500).json({ success: false, message: 'Failed to verify school' })
      }
    },

    // Merge a (usually write-in) school into a target school: repoint links, delete source.
    async mergeSchool(req, res) {
      const client = await pool.connect()
      try {
        const sourceId = Number(req.params.id)
        const targetId = Number(req.body.targetSchoolId)
        if (!targetId || targetId === sourceId) {
          return res.status(400).json({ success: false, message: 'A different target school is required' })
        }
        await client.query('BEGIN')
        const targetRes = await client.query('SELECT id FROM school WHERE id = $1', [targetId])
        if (targetRes.rows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).json({ success: false, message: 'Target school not found' })
        }
        // Repoint links, avoiding duplicate PK conflicts
        await client.query(
          `
          INSERT INTO member_school (member_id, school_id, source, created_at)
          SELECT member_id, $1, source, created_at FROM member_school WHERE school_id = $2
          ON CONFLICT (member_id, school_id) DO NOTHING
          `,
          [targetId, sourceId],
        )
        await client.query('DELETE FROM member_school WHERE school_id = $1', [sourceId])
        await client.query('DELETE FROM school WHERE id = $1', [sourceId])
        await client.query('COMMIT')
        res.json({ success: true, message: 'School merged' })
      } catch (err) {
        await client.query('ROLLBACK')
        console.error('[schools] mergeSchool:', err)
        res.status(500).json({ success: false, message: 'Failed to merge school' })
      } finally {
        client.release()
      }
    },

    async setMemberSchoolsRoute(req, res) {
      try {
        const ids = await setMemberSchools(
          pool,
          parseInt(req.params.id, 10),
          req.body?.schoolIds || [],
          req.body?.schoolWriteIn || null,
        )
        res.json({ success: true, data: { schoolIds: ids } })
      } catch (err) {
        console.error('[schools] setMemberSchoolsRoute:', err)
        res.status(500).json({ success: false, message: 'Failed to update member schools' })
      }
    },

    async memberSchools(req, res) {
      try {
        const result = await pool.query(
          `
          SELECT s.*, ms.source, ms.created_at AS linked_at
          FROM member_school ms
          JOIN school s ON s.id = ms.school_id
          WHERE ms.member_id = $1
          ORDER BY s.name
          `,
          [req.params.id],
        )
        res.json({ success: true, data: result.rows.map(mapSchoolRow) })
      } catch (err) {
        console.error('[schools] memberSchools:', err)
        res.status(500).json({ success: false, message: 'Failed to load member schools' })
      }
    },

    async schoolMembers(req, res) {
      try {
        const result = await pool.query(
          `
          SELECT m.id, m.first_name, m.last_name, m.email, m.phone, m.status, m.is_active,
                 m.date_of_birth, m.family_id, f.family_name, ms.source, ms.created_at AS linked_at
          FROM member_school ms
          JOIN member m ON m.id = ms.member_id
          LEFT JOIN family f ON f.id = m.family_id
          WHERE ms.school_id = $1
          ORDER BY m.last_name, m.first_name
          `,
          [req.params.id],
        )
        res.json({
          success: true,
          data: result.rows.map((r) => ({
            id: Number(r.id),
            firstName: r.first_name,
            lastName: r.last_name,
            email: r.email,
            phone: r.phone,
            status: r.status,
            isActive: r.is_active,
            dateOfBirth: r.date_of_birth,
            familyId: r.family_id != null ? Number(r.family_id) : null,
            familyName: r.family_name || null,
            source: r.source,
            linkedAt: r.linked_at,
          })),
        })
      } catch (err) {
        console.error('[schools] schoolMembers:', err)
        res.status(500).json({ success: false, message: 'Failed to load school roster' })
      }
    },
  }
}

// Shared helper: replace a member's school links with the given set, and handle a
// free-typed "Other" write-in (creates an unverified school, then links it).
export async function setMemberSchools(pool, memberId, schoolIds = [], writeIn = null) {
  const ids = Array.isArray(schoolIds) ? [...new Set(schoolIds.map(Number).filter(Boolean))] : []

  if (writeIn && String(writeIn).trim()) {
    const name = String(writeIn).trim()
    const facilityRes = await pool.query('SELECT id FROM facility ORDER BY id LIMIT 1')
    const facilityId = facilityRes.rows[0]?.id ?? null
    const insertRes = await pool.query(
      `
      INSERT INTO school (facility_id, name, level, is_verified, is_active)
      VALUES ($1, $2, 'other', FALSE, TRUE)
      ON CONFLICT (facility_id, lower(name)) DO NOTHING
      RETURNING id
      `,
      [facilityId, name],
    )
    const writeInId =
      insertRes.rows[0]?.id ??
      (await pool.query('SELECT id FROM school WHERE lower(name) = lower($1) LIMIT 1', [name]))
        .rows[0]?.id
    if (writeInId) ids.push(Number(writeInId))
  }

  await pool.query('DELETE FROM member_school WHERE member_id = $1', [memberId])
  for (const schoolId of ids) {
    await pool.query(
      `
      INSERT INTO member_school (member_id, school_id, source)
      VALUES ($1, $2, 'admin')
      ON CONFLICT (member_id, school_id) DO NOTHING
      `,
      [memberId, schoolId],
    )
  }
  return ids
}
