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

// Resolve the current admin's display name (app_user.full_name → admins name → email).
export async function resolveAdminAuthor(pool, req) {
  const adminId = req.adminId
  const adminEmail = req.adminEmail || null
  let name = null
  if (adminId != null) {
    try {
      const u = await pool.query('SELECT full_name FROM app_user WHERE id = $1', [adminId])
      if (u.rows[0]?.full_name) name = u.rows[0].full_name
    } catch {
      // app_user may not be available; fall through
    }
    if (!name) {
      try {
        const a = await pool.query(
          `SELECT COALESCE(first_name || ' ' || last_name, email) AS name FROM admins WHERE id = $1`,
          [adminId],
        )
        if (a.rows[0]?.name) name = a.rows[0].name
      } catch {
        // ignore
      }
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
