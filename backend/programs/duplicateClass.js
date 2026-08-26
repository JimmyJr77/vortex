import { randomUUID } from 'node:crypto'

const CLONE_EXCLUDED_COLUMNS = new Set(['id', 'created_at', 'updated_at'])

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

async function loadCloneableColumns(client, tableName, cache) {
  if (cache.has(tableName)) return cache.get(tableName)

  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = $1
       AND is_generated = 'NEVER'
       AND identity_generation IS NULL
     ORDER BY ordinal_position`,
    [tableName],
  )
  const columns = result.rows.map((row) => row.column_name)
  cache.set(tableName, columns)
  return columns
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT to_regclass($1) AS table_name`,
    [`public.${tableName}`],
  )
  return result.rows[0]?.table_name != null
}

async function cloneRow(client, tableName, sourceRow, overrides, columnCache) {
  const availableColumns = await loadCloneableColumns(client, tableName, columnCache)
  const columns = availableColumns.filter((column) => !CLONE_EXCLUDED_COLUMNS.has(column))
  if (columns.length === 0) throw new Error(`No cloneable columns found for ${tableName}`)

  const values = columns.map((column) => (
    Object.prototype.hasOwnProperty.call(overrides, column)
      ? overrides[column]
      : sourceRow[column]
  ))
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ')
  const result = await client.query(
    `INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')})
     VALUES (${placeholders})
     RETURNING *`,
    values,
  )
  return result.rows[0]
}

function remapRequiredId(id, idMap, label) {
  if (id == null) return null
  const mapped = idMap.get(Number(id))
  if (mapped == null) throw new Error(`Failed to duplicate ${label} ${id}`)
  return mapped
}

async function cloneCoachAssignments(
  client,
  { sourceClassId, newClassId, sourceFormId, newFormId, offeringIdMap, timeSlotIdMap },
  columnCache,
) {
  if (!(await tableExists(client, 'coach_class_assignment'))) return 0

  const columns = await loadCloneableColumns(client, 'coach_class_assignment', columnCache)
  const columnSet = new Set(columns)
  const predicates = []
  const values = []
  const addPredicate = (sql, value) => {
    values.push(value)
    predicates.push(sql.replace('?', `$${values.length}`))
  }

  if (columnSet.has('program_id')) addPredicate('program_id = ?', sourceClassId)
  if (sourceFormId != null && columnSet.has('scheduling_form_id')) {
    addPredicate('scheduling_form_id = ?', sourceFormId)
  }
  if (offeringIdMap.size > 0 && columnSet.has('scheduling_offering_id')) {
    addPredicate('scheduling_offering_id = ANY(?::bigint[])', [...offeringIdMap.keys()])
  }
  if (timeSlotIdMap.size > 0 && columnSet.has('scheduling_time_slot_id')) {
    addPredicate('scheduling_time_slot_id = ANY(?::bigint[])', [...timeSlotIdMap.keys()])
  }
  if (predicates.length === 0) return 0

  const result = await client.query(
    `SELECT * FROM coach_class_assignment WHERE ${predicates.join(' OR ')}`,
    values,
  )
  let count = 0
  for (const row of result.rows) {
    // A legacy iteration assignment belongs to that specific iteration, which is
    // intentionally not part of the Class Master scheduling copy.
    if (row.class_iteration_id != null) continue

    const overrides = {}
    if (Number(row.program_id) === sourceClassId) overrides.program_id = newClassId
    if (sourceFormId != null && Number(row.scheduling_form_id) === sourceFormId) {
      overrides.scheduling_form_id = newFormId
    }
    if (row.scheduling_offering_id != null) {
      overrides.scheduling_offering_id = remapRequiredId(
        row.scheduling_offering_id,
        offeringIdMap,
        'coach offering assignment',
      )
    }
    if (row.scheduling_time_slot_id != null) {
      overrides.scheduling_time_slot_id = remapRequiredId(
        row.scheduling_time_slot_id,
        timeSlotIdMap,
        'coach timeslot assignment',
      )
    }

    await cloneRow(client, 'coach_class_assignment', row, overrides, columnCache)
    count += 1
  }
  return count
}

async function cloneClassBenefitSelections(client, sourceFormId, newFormId, columnCache) {
  if (sourceFormId == null || !(await tableExists(client, 'pricing_benefit_selection'))) return 0
  const result = await client.query(
    `SELECT * FROM pricing_benefit_selection
     WHERE scope_level = 'class' AND scope_ref_id = $1
     ORDER BY id`,
    [sourceFormId],
  )
  for (const row of result.rows) {
    await cloneRow(
      client,
      'pricing_benefit_selection',
      row,
      { scope_ref_id: newFormId },
      columnCache,
    )
  }
  return result.rows.length
}

/**
 * Duplicate a Class Master class and all of its class-owned scheduling config.
 * Enrollment/member-owned data is deliberately never selected or inserted.
 */
export async function duplicateClassEvent(pool, sourceClassId, options = {}) {
  const client = await pool.connect()
  const columnCache = new Map()
  const uniqueSuffix = options.uniqueSuffix ?? randomUUID()

  try {
    await client.query('BEGIN')
    const sourceResult = await client.query(
      'SELECT * FROM program WHERE id = $1 FOR SHARE',
      [sourceClassId],
    )
    const sourceClass = sourceResult.rows[0]
    if (!sourceClass) {
      await client.query('ROLLBACK')
      return null
    }

    const internalName = `${sourceClass.name || 'CLASS'}__COPY_${uniqueSuffix}`
    const newClass = await cloneRow(
      client,
      'program',
      sourceClass,
      { name: internalName },
      columnCache,
    )
    const newClassId = Number(newClass.id)

    const formResult = await client.query(
      `SELECT * FROM scheduling_form
       WHERE program_id = $1 AND deleted_at IS NULL
       ORDER BY id
       LIMIT 1
       FOR SHARE`,
      [sourceClassId],
    )
    const sourceForm = formResult.rows[0] ?? null
    let newFormId = null
    const offeringIdMap = new Map()
    const slotGroupIdMap = new Map()
    const timeSlotIdMap = new Map()

    if (sourceForm) {
      const newForm = await cloneRow(
        client,
        'scheduling_form',
        sourceForm,
        { program_id: newClassId, deleted_at: null },
        columnCache,
      )
      newFormId = Number(newForm.id)

      const offerings = await client.query(
        'SELECT * FROM scheduling_offering WHERE form_id = $1 ORDER BY id',
        [sourceForm.id],
      )
      for (const offering of offerings.rows) {
        const copy = await cloneRow(
          client,
          'scheduling_offering',
          offering,
          { form_id: newFormId },
          columnCache,
        )
        offeringIdMap.set(Number(offering.id), Number(copy.id))
      }

      const groups = await client.query(
        'SELECT * FROM scheduling_slot_group WHERE form_id = $1 ORDER BY id',
        [sourceForm.id],
      )
      for (const group of groups.rows) {
        const copy = await cloneRow(
          client,
          'scheduling_slot_group',
          group,
          {
            form_id: newFormId,
            offering_id: remapRequiredId(group.offering_id, offeringIdMap, 'offering'),
          },
          columnCache,
        )
        slotGroupIdMap.set(Number(group.id), Number(copy.id))
      }

      const slots = await client.query(
        'SELECT * FROM scheduling_time_slot WHERE form_id = $1 ORDER BY id',
        [sourceForm.id],
      )
      for (const slot of slots.rows) {
        const copy = await cloneRow(
          client,
          'scheduling_time_slot',
          slot,
          {
            form_id: newFormId,
            slot_group_id: remapRequiredId(slot.slot_group_id, slotGroupIdMap, 'slot group'),
          },
          columnCache,
        )
        timeSlotIdMap.set(Number(slot.id), Number(copy.id))
      }
    }

    const coachAssignmentCount = await cloneCoachAssignments(
      client,
      {
        sourceClassId: Number(sourceClassId),
        newClassId,
        sourceFormId: sourceForm ? Number(sourceForm.id) : null,
        newFormId,
        offeringIdMap,
        timeSlotIdMap,
      },
      columnCache,
    )
    const benefitSelectionCount = await cloneClassBenefitSelections(
      client,
      sourceForm ? Number(sourceForm.id) : null,
      newFormId,
      columnCache,
    )

    await client.query('COMMIT')
    return {
      sourceClassId: Number(sourceClassId),
      classId: newClassId,
      formId: newFormId,
      offeringCount: offeringIdMap.size,
      slotGroupCount: slotGroupIdMap.size,
      timeSlotCount: timeSlotIdMap.size,
      coachAssignmentCount,
      benefitSelectionCount,
      enrollmentCount: 0,
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
