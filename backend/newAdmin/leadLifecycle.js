import { hasFamilyPayments } from '../members/unpaidHistoryDeletion.js'
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
      const memberIds = [lead.member_id, lead.converted_member_id].filter(value => value != null)
      const { rows: accounts } = await client.query(
        `SELECT id FROM family_billing_account WHERE payer_member_id=ANY($1::bigint[]) OR family_id IN (
           SELECT family_id FROM member WHERE id=ANY($1::bigint[])
           UNION SELECT family_id FROM family_member WHERE member_id=ANY($1::bigint[])
           UNION SELECT pending_family_id FROM account_invite WHERE registration_id=$2
         ) ORDER BY id FOR UPDATE`, [memberIds, target],
      )
      if (await hasFamilyPayments(client, { familyId: -1, accountIds: accounts.map(row => row.id), memberIds })) {
        throw inputError('Payments have been made for this lead’s member or family. Keep the lead archived to preserve payment history.', 409)
      }
      // Keep linked members and enrollments; remove only the lead and its invitations.
      await client.query('UPDATE scheduling_signup SET account_invite_id=NULL WHERE account_invite_id IN (SELECT id FROM account_invite WHERE registration_id=$1)', [target])
      await client.query('DELETE FROM account_invite WHERE registration_id=$1', [target])
      await client.query('DELETE FROM new_admin_lead_ownership_audit WHERE registration_id=$1', [target])
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
