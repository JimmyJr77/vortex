import test from 'node:test'
import assert from 'node:assert/strict'

import {
  loadEffectivePricingForForm,
  resolveFormProgramsId,
  resolveEffectiveFormPricing,
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


test('carried-over class rates stay fixed while program benefits retain their behavior', () => {
  const program={pricing_cost_amount_cents:25000,pricing_cost_unit:'per_month',pricing_free_slots_per_user:2}
  const form={class_program_pricing:{pricing_cost_amount_cents:12000,pricing_cost_unit:'per_month'},pricing_overrides_program:false}
  const effective=resolveEffectiveFormPricing(program,form)
  assert.equal(effective.costAmountCents,12000)
  assert.equal(effective.freeSlotsPerUser,2)
})

test('an explicit free class never falls back to its old program price', () => {
  const effective=resolveEffectiveFormPricing({pricing_slot_cost_monthly_cents:15000},{class_monthly_price_cents:0,pricing_overrides_program:true})
  assert.equal(effective.costAmountCents,0)
  assert.equal(effective.costUnit,'per_month')
})

test('new class pricing has no default program price', () => {
  const effective=resolveEffectiveFormPricing({pricing_slot_cost_monthly_cents:15000},{class_program_pricing:{},pricing_overrides_program:true})
  assert.equal(effective.costAmountCents,0)
})
