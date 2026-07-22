import test from 'node:test'
import assert from 'node:assert/strict'

import {
  loadEffectivePricingForForm,
  resolveFormProgramsId,
} from '../pricingDefaults.js'

function classMasterPool({ classProgramsId = 42, staleFormProgramsId = 7, priceCents = 15000 } = {}) {
  return {
    async query(sql) {
      if (sql.includes('information_schema.tables')) return { rows: [{ table_name: 'programs' }] }
      if (sql.includes("table_name = 'program'")) return { rows: [{ column_name: 'programs_id' }] }
      if (sql.includes("table_name = 'scheduling_form'")) {
        return { rows: [{ column_name: 'program_id' }, { column_name: 'programs_id' }] }
      }
      if (sql.includes('AS programs_id FROM program')) {
        return { rows: [{ programs_id: classProgramsId }] }
      }
      if (sql.includes('pricing_max_slots_per_user')) {
        assert.match(sql, /FROM programs WHERE id = \$1/)
        return {
          rows: [{
            pricing_cost_amount_cents: priceCents,
            pricing_cost_unit: 'per_month',
            pricing_cost_options: [],
            multi_class_pass_packages: [],
          }],
        }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
    staleFormProgramsId,
  }
}

test('Class Master parent overrides a stale scheduling_form parent link', async () => {
  const pool = classMasterPool()
  const programsId = await resolveFormProgramsId(pool, {
    program_id: 13,
    programs_id: pool.staleFormProgramsId,
  })

  assert.equal(programsId, 42)
})

test('effective class pricing is loaded from the Class Master parent', async () => {
  const pool = classMasterPool({ priceCents: 15000 })
  const { effective } = await loadEffectivePricingForForm(pool, {
    id: 3,
    program_id: 13,
    programs_id: pool.staleFormProgramsId,
    pricing_overrides_program: false,
  })

  assert.equal(effective.costAmountCents, 15000)
  assert.equal(effective.costUnit, 'per_month')
})

test('forms without a Class Master row retain their direct parent link', async () => {
  const pool = classMasterPool()
  const programsId = await resolveFormProgramsId(pool, {
    program_id: null,
    programs_id: pool.staleFormProgramsId,
  })

  assert.equal(programsId, 7)
})
