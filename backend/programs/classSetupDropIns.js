import Joi from 'joi'
import { id, inputError } from '../newAdmin/common.js'

const editSchema = Joi.object({
  allowDropIns: Joi.boolean().required(),
  scope: Joi.string().valid('class', 'matching', 'program').required(),
  timeSlotId: Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER).optional(),
}).required()

/** Change only the selected schedule, matching class definitions, or entire program. */
export async function saveClassSetupDropIns(pool, facilityId, classId, body) {
  const facility = id(facilityId, 'facility')
  const sourceId = id(classId, 'class')
  const { error, value } = editSchema.validate(body, { convert: false })
  if (error) throw inputError(error.details[0].message)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const initial = (await client.query(
      'SELECT id, programs_id FROM program WHERE id=$1 AND facility_id=$2',
      [sourceId, facility],
    )).rows[0]
    if (!initial) throw inputError('Class not found.', 404)

    // Serialize scope edits in a program before locking class rows. Recheck the
    // source afterward so a concurrent program move cannot broaden the edit.
    if (initial.programs_id != null) {
      const parent = (await client.query(
        'SELECT id FROM programs WHERE id=$1 AND facility_id=$2 FOR UPDATE',
        [initial.programs_id, facility],
      )).rows[0]
      if (!parent) throw inputError('Program not found in this facility.', 404)
    }
    const source = (await client.query(
      'SELECT id, programs_id, display_name FROM program WHERE id=$1 AND facility_id=$2 FOR UPDATE',
      [sourceId, facility],
    )).rows[0]
    if (!source) throw inputError('Class not found.', 404)
    if (String(source.programs_id ?? '') !== String(initial.programs_id ?? '')) {
      throw inputError('This class moved to another program. Refresh Class Master and try again.', 409)
    }
    if (value.scope !== 'class' && source.programs_id == null) {
      throw inputError('This class has no parent program. Choose just this class.')
    }

    let selectedSlot = null
    if (value.timeSlotId != null) {
      selectedSlot = (await client.query(
        `SELECT slot.id, slot.slot_group_id FROM scheduling_time_slot slot
         JOIN scheduling_form form ON form.id=slot.form_id
         WHERE slot.id=$1 AND form.program_id=$2 AND form.deleted_at IS NULL`,
        [value.timeSlotId, sourceId],
      )).rows[0]
      if (!selectedSlot) throw inputError('Schedule line not found for this class.', 404)
    }

    const excluded = !value.allowDropIns
    let classIds = [sourceId]
    if (value.scope !== 'class') {
      const targets = await client.query(
        `SELECT id FROM program WHERE programs_id=$1 AND facility_id=$2
         ${value.scope === 'matching' ? 'AND lower(btrim(display_name))=lower(btrim($3))' : ''}
         ORDER BY id FOR UPDATE`,
        value.scope === 'matching' ? [source.programs_id, facility, source.display_name] : [source.programs_id, facility],
      )
      classIds = targets.rows.map(row => Number(row.id))
    }
    // Booking locks its schedule group before checking availability. Use the
    // same lock so an eligibility change and an in-flight booking serialize.
    await client.query(
      `SELECT slot_group.id FROM scheduling_slot_group slot_group
       JOIN scheduling_form form ON form.id=slot_group.form_id
       WHERE form.program_id=ANY($1::bigint[]) AND form.deleted_at IS NULL
         ${value.scope === 'class' && selectedSlot ? 'AND slot_group.id=$2' : ''}
       ORDER BY slot_group.id FOR UPDATE OF slot_group`,
      value.scope === 'class' && selectedSlot ? [classIds, selectedSlot.slot_group_id] : [classIds],
    )
    if (selectedSlot) {
      const lockedSlot = (await client.query(
        `SELECT slot.id FROM scheduling_time_slot slot
         JOIN scheduling_form form ON form.id=slot.form_id
         WHERE slot.id=$1 AND form.program_id=$2 AND form.deleted_at IS NULL
         FOR UPDATE OF slot`,
        [value.timeSlotId, sourceId],
      )).rows[0]
      if (!lockedSlot) throw inputError('Schedule line not found for this class.', 404)
    }
    let slots
    if (value.scope === 'class' && value.timeSlotId != null) {
      slots = await client.query(
        'UPDATE scheduling_time_slot SET exclude_from_drop_ins=$2, updated_at=now() WHERE id=$1 RETURNING id',
        [value.timeSlotId, excluded],
      )
    } else {
      if (value.scope === 'program') {
        await client.query(
          'UPDATE programs SET exclude_from_drop_ins=$3, updated_at=now() WHERE id=$1 AND facility_id=$2',
          [source.programs_id, facility, excluded],
        )
      }
      await client.query(
        'UPDATE program SET exclude_from_drop_ins=$3, updated_at=now() WHERE id=ANY($1::bigint[]) AND facility_id=$2',
        [classIds, facility, value.scope === 'program' ? null : excluded],
      )
      // Broader edits supersede previous schedule exceptions in the affected
      // classes. Historical forms are left intact.
      slots = await client.query(
        `UPDATE scheduling_time_slot slot SET exclude_from_drop_ins=NULL, updated_at=now()
         FROM scheduling_form form
         WHERE form.id=slot.form_id AND form.program_id=ANY($1::bigint[])
           AND form.deleted_at IS NULL
         RETURNING slot.id`,
        [classIds],
      )
    }
    await client.query('COMMIT')
    return { scope: value.scope, allowDropIns: value.allowDropIns, classIds, timeSlotIds: slots.rows.map(row => Number(row.id)) }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
