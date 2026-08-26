import test from 'node:test'
import assert from 'node:assert/strict'

import { duplicateClassEvent } from '../duplicateClass.js'

const columnsByTable = {
  program: [
    'id',
    'facility_id',
    'category',
    'programs_id',
    'name',
    'display_name',
    'description',
    'is_active',
    'archived',
    'created_at',
    'updated_at',
  ],
  scheduling_form: [
    'id',
    'title',
    'description',
    'start_date',
    'end_date',
    'is_active',
    'programs_id',
    'program_id',
    'pricing_overrides_program',
    'cost_amount_cents',
    'cost_unit',
    'deleted_at',
    'created_at',
    'updated_at',
  ],
  scheduling_offering: [
    'id',
    'form_id',
    'start_date',
    'end_date',
    'label',
    'is_selected',
    'created_at',
    'updated_at',
  ],
  scheduling_slot_group: [
    'id',
    'form_id',
    'offering_id',
    'schedule_mode',
    'max_participants',
    'active_start',
    'active_end',
    'is_active',
    'created_at',
    'updated_at',
  ],
  scheduling_time_slot: [
    'id',
    'form_id',
    'slot_group_id',
    'schedule_mode',
    'day_of_week',
    'start_time',
    'end_time',
    'max_participants',
    'is_active',
    'created_at',
    'updated_at',
  ],
  coach_class_assignment: [
    'id',
    'coach_user_id',
    'program_id',
    'class_iteration_id',
    'scheduling_form_id',
    'scheduling_offering_id',
    'scheduling_time_slot_id',
    'created_at',
  ],
  pricing_benefit_selection: [
    'id',
    'scope_level',
    'scope_ref_id',
    'benefit_type',
    'benefit_id',
    'auto_apply',
    'allow_member_code',
    'sort_order',
    'created_at',
    'updated_at',
  ],
}

function duplicatePool({ sourceExists = true } = {}) {
  const inserted = []
  const queries = []
  const nextIds = {
    program: 107,
    scheduling_form: 120,
    scheduling_offering: 130,
    scheduling_slot_group: 140,
    scheduling_time_slot: 150,
    coach_class_assignment: 160,
    pricing_benefit_selection: 170,
  }

  const sourceClass = {
    id: 7,
    facility_id: 1,
    category: 'GYMNASTICS',
    programs_id: 3,
    name: 'TORNADOES',
    display_name: 'Tornadoes',
    description: 'Class description',
    is_active: true,
    archived: false,
  }
  const sourceForm = {
    id: 20,
    title: 'Tornadoes',
    description: 'Bring water',
    start_date: '2026-09-01',
    end_date: '2026-12-20',
    is_active: true,
    programs_id: 3,
    program_id: 7,
    pricing_overrides_program: true,
    cost_amount_cents: 12500,
    cost_unit: 'per_month',
    deleted_at: null,
  }
  const sourceOffering = {
    id: 30,
    form_id: 20,
    start_date: '2026-09-01',
    end_date: '2026-12-20',
    label: null,
    is_selected: true,
  }
  const sourceGroup = {
    id: 40,
    form_id: 20,
    offering_id: 30,
    schedule_mode: 'day',
    max_participants: 12,
    active_start: '2026-09-01',
    active_end: '2026-12-20',
    is_active: true,
  }
  const sourceSlot = {
    id: 50,
    form_id: 20,
    slot_group_id: 40,
    schedule_mode: 'day',
    day_of_week: 1,
    start_time: '16:00',
    end_time: '17:00',
    max_participants: 12,
    is_active: true,
  }

  const client = {
    released: false,
    async query(sql, values = []) {
      queries.push(sql)
      const normalized = sql.replace(/\s+/g, ' ').trim()
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
        return { rows: [] }
      }
      if (normalized.startsWith('SELECT * FROM program WHERE id')) {
        return { rows: sourceExists ? [sourceClass] : [] }
      }
      if (normalized.includes('FROM information_schema.columns')) {
        return { rows: columnsByTable[values[0]].map((column_name) => ({ column_name })) }
      }
      if (normalized.startsWith('SELECT * FROM scheduling_form')) return { rows: [sourceForm] }
      if (normalized.startsWith('SELECT * FROM scheduling_offering')) return { rows: [sourceOffering] }
      if (normalized.startsWith('SELECT * FROM scheduling_slot_group')) return { rows: [sourceGroup] }
      if (normalized.startsWith('SELECT * FROM scheduling_time_slot')) return { rows: [sourceSlot] }
      if (normalized.startsWith('SELECT to_regclass')) {
        return { rows: [{ table_name: values[0] }] }
      }
      if (normalized.startsWith('SELECT * FROM coach_class_assignment')) {
        return {
          rows: [{
            id: 60,
            coach_user_id: 9,
            program_id: 7,
            class_iteration_id: null,
            scheduling_form_id: 20,
            scheduling_offering_id: 30,
            scheduling_time_slot_id: 50,
          }],
        }
      }
      if (normalized.startsWith('SELECT * FROM pricing_benefit_selection')) {
        return {
          rows: [{
            id: 70,
            scope_level: 'class',
            scope_ref_id: 20,
            benefit_type: 'discount_rule',
            benefit_id: 5,
            auto_apply: true,
            allow_member_code: true,
            sort_order: 0,
          }],
        }
      }

      const insertMatch = normalized.match(/^INSERT INTO "([^"]+)" \(([^)]+)\)/)
      if (insertMatch) {
        const table = insertMatch[1]
        const columns = insertMatch[2].split(',').map((column) => column.trim().replaceAll('"', ''))
        const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]))
        row.id = nextIds[table]
        inserted.push({ table, row })
        return { rows: [row] }
      }
      throw new Error(`Unexpected query: ${normalized}`)
    },
    release() {
      this.released = true
    },
  }

  return {
    pool: { async connect() { return client } },
    client,
    inserted,
    queries,
  }
}

function insertedRow(inserted, table) {
  return inserted.find((entry) => entry.table === table)?.row
}

test('duplicates the class schedule with new IDs and no enrollments', async () => {
  const fixture = duplicatePool()
  const result = await duplicateClassEvent(fixture.pool, 7, { uniqueSuffix: 'test-copy' })

  assert.equal(result.classId, 107)
  assert.equal(result.formId, 120)
  assert.equal(result.enrollmentCount, 0)
  assert.equal(result.offeringCount, 1)
  assert.equal(result.slotGroupCount, 1)
  assert.equal(result.timeSlotCount, 1)
  assert.equal(result.coachAssignmentCount, 1)
  assert.equal(result.benefitSelectionCount, 1)

  const classCopy = insertedRow(fixture.inserted, 'program')
  assert.equal(classCopy.display_name, 'Tornadoes')
  assert.equal(classCopy.description, 'Class description')
  assert.equal(classCopy.name, 'TORNADOES__COPY_test-copy')

  const formCopy = insertedRow(fixture.inserted, 'scheduling_form')
  assert.equal(formCopy.program_id, 107)
  assert.equal(formCopy.description, 'Bring water')
  assert.equal(formCopy.cost_amount_cents, 12500)

  assert.equal(insertedRow(fixture.inserted, 'scheduling_offering').form_id, 120)
  assert.deepEqual(
    {
      formId: insertedRow(fixture.inserted, 'scheduling_slot_group').form_id,
      offeringId: insertedRow(fixture.inserted, 'scheduling_slot_group').offering_id,
    },
    { formId: 120, offeringId: 130 },
  )
  assert.deepEqual(
    {
      formId: insertedRow(fixture.inserted, 'scheduling_time_slot').form_id,
      slotGroupId: insertedRow(fixture.inserted, 'scheduling_time_slot').slot_group_id,
    },
    { formId: 120, slotGroupId: 140 },
  )
  assert.deepEqual(
    {
      classId: insertedRow(fixture.inserted, 'coach_class_assignment').program_id,
      formId: insertedRow(fixture.inserted, 'coach_class_assignment').scheduling_form_id,
      offeringId: insertedRow(fixture.inserted, 'coach_class_assignment').scheduling_offering_id,
      timeSlotId: insertedRow(fixture.inserted, 'coach_class_assignment').scheduling_time_slot_id,
    },
    { classId: 107, formId: 120, offeringId: 130, timeSlotId: 150 },
  )
  assert.equal(insertedRow(fixture.inserted, 'pricing_benefit_selection').scope_ref_id, 120)
  assert.equal(fixture.queries.some((sql) => sql.includes('scheduling_signup')), false)
  assert.equal(fixture.queries.at(-1), 'COMMIT')
  assert.equal(fixture.client.released, true)
})

test('returns null and rolls back when the source class does not exist', async () => {
  const fixture = duplicatePool({ sourceExists: false })
  const result = await duplicateClassEvent(fixture.pool, 999, { uniqueSuffix: 'missing' })

  assert.equal(result, null)
  assert.deepEqual(fixture.queries, [
    'BEGIN',
    'SELECT * FROM program WHERE id = $1 FOR SHARE',
    'ROLLBACK',
  ])
  assert.equal(fixture.client.released, true)
})
