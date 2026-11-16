import { captureDeletionTarget, assertNoUnexpectedDeleteReferences } from '../members/deletionReferences.js'
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
      // An inquiry's contact/conversion link is not ownership of the member or
      // their money. Deleting the inquiry must never edit that account, its
      // enrollment, or a signup's invitation pointer.
      const { rows: invites } = await client.query(
        `SELECT id, facility_id, used_at, pending_family_id, inviter_member_id,
           (pending_payload ? 'result') AS has_completed_payload
         FROM account_invite WHERE registration_id=$1 ORDER BY id FOR UPDATE`, [target],
      )
      if (invites.some(invite => String(invite.facility_id) !== String(facility))) {
        throw inputError('This inquiry has an invitation in another facility. Keep it archived until its links are corrected.', 409)
      }
      const unused = invites.filter(invite => invite.used_at == null)
      const unusedIds = unused.map(invite => invite.id)
      if (unused.some(invite => invite.pending_family_id != null || invite.inviter_member_id != null || invite.has_completed_payload)
          || (unusedIds.length && (await client.query('SELECT 1 FROM scheduling_signup WHERE account_invite_id=ANY($1::bigint[]) LIMIT 1', [unusedIds])).rows.length)) {
        throw inputError('This inquiry has an unfinished account registration or class reservation. Complete or cancel it before deleting the inquiry.', 409)
      }
      // Completed invitations can still provide existing members with their
      // registration result and class links. Retain them, detaching only the
      // obsolete inquiry backlink. Completion already refuses a missing lead
      // for unused invitations; unreferenced unused invitations are removed.
      const completedIds = invites.filter(invite => invite.used_at != null).map(invite => invite.id)
      if (completedIds.length) await client.query(
        'UPDATE account_invite SET registration_id=NULL WHERE id=ANY($1::bigint[]) AND registration_id=$2 AND facility_id=$3',
        [completedIds, target, facility],
      )
      const targets = []
      targets.push(await captureDeletionTarget(client, 'registrations', 'id=$1 AND facility_id=$2', [target, facility]))
      targets.push(await captureDeletionTarget(client, 'account_invite', 'id=ANY($1::bigint[]) AND registration_id=$2 AND facility_id=$3', [unusedIds, target, facility]))
      targets.push(await captureDeletionTarget(client, 'new_admin_lead_ownership_audit', 'registration_id=$1', [target]))
      targets.push(await captureDeletionTarget(client, 'note', "subject_type='registration' AND subject_id=$1", [target]))
      const analytics = []
      for (const table of ['utm_attribution', 'visitor_identities']) {
        analytics.push(await captureDeletionTarget(client, table, 'inquiry_id=$1', [target]))
      }
      // Only the nullable inquiry backlink may change on these analytics rows;
      // their member/visitor attribution and all other evidence must survive.
      await assertNoUnexpectedDeleteReferences(client, targets, {
        allowedNullReferences: analytics.map(({ table, keys }) => ({ table, column: 'inquiry_id', keys })),
      })
      await client.query('DELETE FROM account_invite WHERE id=ANY($1::bigint[]) AND registration_id=$2 AND facility_id=$3', [unusedIds, target, facility])
      await client.query('DELETE FROM new_admin_lead_ownership_audit WHERE registration_id=$1', [target])
      await client.query("DELETE FROM note WHERE subject_type='registration' AND subject_id=$1", [target])
      await client.query('DELETE FROM registrations WHERE id=$1 AND facility_id=$2', [target, facility])
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
