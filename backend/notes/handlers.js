// Append-only, dated notes (user comments + staff notes) for members and registrations.

const SUBJECT_TYPES = ['member', 'registration']
const NOTE_TYPES = ['user_comment', 'staff_note']

function mapNoteRow(row) {
  return {
    id: Number(row.id),
    subjectType: row.subject_type,
    subjectId: Number(row.subject_id),
    noteType: row.note_type,
    body: row.body,
    authorKind: row.author_kind || null,
    authorId: row.author_id != null ? Number(row.author_id) : null,
    authorEmail: row.author_email || null,
    authorName: row.author_name || null,
    source: row.source || null,
    createdAt: row.created_at,
  }
}

async function subjectBelongsToFacility(pool, subjectType, subjectId, facilityId) {
  const normalizedSubjectId = Number(subjectId)
  const normalizedFacilityId = Number(facilityId)
  if (!Number.isSafeInteger(normalizedSubjectId) || normalizedSubjectId <= 0
    || !Number.isSafeInteger(normalizedFacilityId) || normalizedFacilityId <= 0) {
    return false
  }
  if (subjectType === 'member') {
    const result = await pool.query(
      'SELECT 1 FROM member WHERE id = $1 AND facility_id = $2 LIMIT 1',
      [normalizedSubjectId, normalizedFacilityId],
    )
    return result.rows.length === 1
  }
  if (subjectType === 'registration') {
    // Legacy inquiries did not store facility_id. A linked member supplies the
    // tenant boundary; unlinked inquiries are visible only on a single-facility
    // installation so a multi-facility deployment fails closed.
    const result = await pool.query(
      `SELECT 1
         FROM registrations registration
         LEFT JOIN member linked_member ON linked_member.id = registration.member_id
        WHERE registration.id = $1
          AND (
            linked_member.facility_id = $2
            OR (
              registration.member_id IS NULL
              AND (SELECT COUNT(*) FROM facility) = 1
              AND EXISTS (SELECT 1 FROM facility WHERE id = $2)
            )
          )
        LIMIT 1`,
      [normalizedSubjectId, normalizedFacilityId],
    )
    return result.rows.length === 1
  }
  return false
}

// Resolve the current admin's display name from the canonical, facility-scoped
// app_user identity. Legacy admin rows are not an authorization or identity
// fallback.
export async function resolveAdminAuthor(pool, req) {
  const adminId = req.adminId
  const adminEmail = req.adminEmail || null
  const facilityId = req.canonicalAccess?.facilityId
  let name = null
  if (adminId != null && facilityId != null) {
    try {
      const u = await pool.query(
        'SELECT full_name FROM app_user WHERE id = $1 AND facility_id = $2',
        [adminId, facilityId],
      )
      if (u.rows[0]?.full_name) name = u.rows[0].full_name
    } catch {
      // Preserve note creation even when the display-name lookup fails. The
      // stable canonical author id and authenticated email are still recorded.
    }
  }
  return { authorKind: 'admin', authorId: adminId ?? null, authorEmail: adminEmail, authorName: name || adminEmail }
}

export function createNotesHandlers(pool) {
  return {
    async listNotes(req, res) {
      try {
        const { subjectType, subjectId, noteType } = req.query
        if (!SUBJECT_TYPES.includes(subjectType) || !subjectId) {
          return res.status(400).json({ success: false, message: 'subjectType and subjectId are required' })
        }
        if (!await subjectBelongsToFacility(pool, subjectType, subjectId, req.canonicalAccess?.facilityId)) {
          return res.status(404).json({ success: false, message: 'Note subject not found' })
        }
        const params = [subjectType, subjectId]
        let typeSql = ''
        if (noteType && NOTE_TYPES.includes(noteType)) {
          params.push(noteType)
          typeSql = `AND note_type = $${params.length}`
        }
        const result = await pool.query(
          `
          SELECT * FROM note
          WHERE subject_type = $1 AND subject_id = $2 AND is_deleted = FALSE ${typeSql}
          ORDER BY created_at DESC, id DESC
          `,
          params,
        )
        res.json({ success: true, data: result.rows.map(mapNoteRow) })
      } catch (err) {
        console.error('[notes] listNotes:', err)
        res.status(500).json({ success: false, message: 'Failed to load notes' })
      }
    },

    async addNote(req, res) {
      try {
        const { subjectType, subjectId, noteType, body } = req.body
        if (!SUBJECT_TYPES.includes(subjectType) || !subjectId) {
          return res.status(400).json({ success: false, message: 'Valid subjectType and subjectId are required' })
        }
        if (!NOTE_TYPES.includes(noteType)) {
          return res.status(400).json({ success: false, message: 'Invalid noteType' })
        }
        if (!body || !String(body).trim()) {
          return res.status(400).json({ success: false, message: 'Note body is required' })
        }
        if (!await subjectBelongsToFacility(pool, subjectType, subjectId, req.canonicalAccess?.facilityId)) {
          return res.status(404).json({ success: false, message: 'Note subject not found' })
        }
        const author = await resolveAdminAuthor(pool, req)
        const result = await pool.query(
          `
          INSERT INTO note (subject_type, subject_id, note_type, body, author_kind, author_id, author_email, author_name, source)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'admin_ui')
          RETURNING *
          `,
          [
            subjectType,
            subjectId,
            noteType,
            String(body).trim(),
            author.authorKind,
            author.authorId,
            author.authorEmail,
            author.authorName,
          ],
        )
        res.json({ success: true, data: mapNoteRow(result.rows[0]) })
      } catch (err) {
        console.error('[notes] addNote:', err)
        res.status(500).json({ success: false, message: 'Failed to add note' })
      }
    },

    async deleteNote(req, res) {
      try {
        const note = await pool.query(
          'SELECT subject_type, subject_id FROM note WHERE id = $1 AND is_deleted = FALSE LIMIT 1',
          [req.params.id],
        )
        if (note.rows.length === 0 || !await subjectBelongsToFacility(
          pool,
          note.rows[0].subject_type,
          note.rows[0].subject_id,
          req.canonicalAccess?.facilityId,
        )) {
          return res.status(404).json({ success: false, message: 'Note not found' })
        }
        const result = await pool.query(
          'UPDATE note SET is_deleted = TRUE WHERE id = $1 RETURNING id',
          [req.params.id],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Note not found' })
        }
        res.json({ success: true, message: 'Note removed' })
      } catch (err) {
        console.error('[notes] deleteNote:', err)
        res.status(500).json({ success: false, message: 'Failed to remove note' })
      }
    },
  }
}

// Append a staff note (used when registration admin_notes changes via the existing PUT).
export async function appendStaffNote(pool, req, subjectType, subjectId, body, source = 'admin_ui') {
  if (!body || !String(body).trim()) return null
  if (!await subjectBelongsToFacility(pool, subjectType, subjectId, req.canonicalAccess?.facilityId)) return null
  const author = await resolveAdminAuthor(pool, req)
  const result = await pool.query(
    `
    INSERT INTO note (subject_type, subject_id, note_type, body, author_kind, author_id, author_email, author_name, source)
    VALUES ($1, $2, 'staff_note', $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [subjectType, subjectId, String(body).trim(), author.authorKind, author.authorId, author.authorEmail, author.authorName, source],
  )
  return result.rows[0]
}
