import { id, inputError } from '../newAdmin/common.js'

/** The editor includes every public class, even those without a current schedule. */
export async function loadEnrollmentOrder(db, facilityId, { lock = false } = {}) {
  const facility = id(facilityId, 'facility')
  const { rows: programs } = await db.query(
    `SELECT id,display_name FROM programs
     WHERE facility_id=$1 AND archived=FALSE AND COALESCE(is_active,TRUE)=TRUE
     ORDER BY enrollment_sort_order ASC NULLS LAST,display_name,id ${lock ? 'FOR UPDATE' : ''}`, [facility],
  )
  const { rows: classes } = await db.query(
    `SELECT p.id,p.programs_id,p.display_name FROM program p
     JOIN programs parent ON parent.id=p.programs_id AND parent.facility_id=p.facility_id
     WHERE p.facility_id=$1 AND p.archived=FALSE AND p.is_active=TRUE
       AND parent.archived=FALSE AND COALESCE(parent.is_active,TRUE)=TRUE
     ORDER BY p.enrollment_sort_order ASC NULLS LAST,p.display_name,p.id ${lock ? 'FOR UPDATE OF p' : ''}`, [facility],
  )
  return { programs: programs.flatMap(program => {
    const children = classes.filter(klass => String(klass.programs_id) === String(program.id))
    return children.length ? [{ id: Number(program.id), displayName: program.display_name,
      classes: children.map(klass => ({ id: Number(klass.id), displayName: klass.display_name })) }] : []
  }) }
}

function orderedIds(values, label) {
  if (!Array.isArray(values) || values.length > 10000) throw inputError(`Invalid ${label} order.`)
  const ids = values.map(value => id(value, label))
  if (new Set(ids).size !== ids.length) throw inputError(`Duplicate ${label} in order.`)
  return ids
}

function sameIds(left, right) {
  const expected = new Set(right)
  return left.length === expected.size && left.every(value => expected.has(value))
}

/** Save a complete facility catalog order atomically; never move classes between programs. */
export async function saveEnrollmentOrder(pool, facilityId, body) {
  if (!Array.isArray(body?.programs)) throw inputError('Program order is required.')
  const programIds = orderedIds(body.programs.map(program => program?.id), 'program')
  const requested = body.programs.map((program, index) => ({ id: programIds[index], classIds: orderedIds(program.classIds, 'class') }))
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await loadEnrollmentOrder(client, facilityId, { lock: true })
    const expected = new Map(current.programs.map(program => [program.id, program.classes.map(klass => klass.id)]))
    if (!sameIds(programIds, [...expected.keys()]) || requested.some(program => !sameIds(program.classIds, expected.get(program.id) || []))) {
      throw inputError('The class catalog changed or includes records outside this facility. Reload the order editor and try again.', 409)
    }
    await client.query(
      `UPDATE programs p SET enrollment_sort_order=ordered.position-1,updated_at=now()
       FROM unnest($1::bigint[]) WITH ORDINALITY AS ordered(id,position)
       WHERE p.id=ordered.id AND p.facility_id=$2`, [programIds, id(facilityId, 'facility')],
    )
    for (const program of requested) {
      await client.query(
        `UPDATE program p SET enrollment_sort_order=ordered.position-1,updated_at=now()
         FROM unnest($1::bigint[]) WITH ORDINALITY AS ordered(id,position)
         WHERE p.id=ordered.id AND p.programs_id=$2 AND p.facility_id=$3`,
        [program.classIds, program.id, id(facilityId, 'facility')],
      )
    }
    await client.query('COMMIT')
    return { saved: true }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally { client.release() }
}
