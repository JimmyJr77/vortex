import { id, inputError } from './common.js'

// Keep this separate from ordinary lead editing: destructive actions require
// accounts.lifecycle at the route boundary and remain facility scoped here.
export async function changeLeadLifecycle(pool, facilityId, leadId, action) {
  const target = id(leadId), facility = id(facilityId, 'facility')
  if (!['archive', 'restore', 'delete'].includes(action)) throw inputError('Invalid lead action.')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [lead] } = await client.query(
      'SELECT id, archived, member_id, converted_member_id FROM registrations WHERE id=$1 AND facility_id=$2 FOR UPDATE',
      [target, facility],
    )
    if (!lead) throw inputError('Lead not found.', 404)
    if (action === 'delete') {
      if (lead.archived !== true) throw inputError('Archive this lead before permanently deleting it.', 409)
      if (lead.member_id != null || lead.converted_member_id != null) throw inputError('Converted leads must be retained with their member history.', 409)
      const invites = await client.query('SELECT 1 FROM account_invite WHERE registration_id=$1 LIMIT 1', [target])
      if (invites.rows.length) throw inputError('This lead has registration invitation history and must remain archived.', 409)
      await client.query('DELETE FROM registrations WHERE id=$1 AND facility_id=$2', [target, facility])
      await client.query("DELETE FROM note WHERE subject_type='registration' AND subject_id=$1", [target])
    } else {
      await client.query('UPDATE registrations SET archived=$3,updated_at=now() WHERE id=$1 AND facility_id=$2', [target, facility, action === 'archive'])
    }
    await client.query('COMMIT')
    return { id: target, archived: action === 'archive', deleted: action === 'delete' }
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === '23503') throw inputError('This lead has linked records and must remain archived.', 409)
    throw error
  } finally { client.release() }
}
