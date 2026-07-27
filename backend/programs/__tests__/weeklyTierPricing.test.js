import test from 'node:test'
import assert from 'node:assert/strict'
import {
  maxEnabledWeeklySlots,
  onlyFlatOneXWeeklyTier,
  resolveSyncedWeeklyTierCatalogRef,
  weeklyTierMarginalCents,
  weeklyTierTotalCents,
  weeklyTierTotalDollars,
} from '../weeklyTierPricing.js'
import { normalizeProgramPricingOptions } from '../programPricingOptions.js'

function opts(rows) {
  const base = normalizeProgramPricingOptions([])
  return base.map((def) => {
    const patch = rows.find((r) => r.key === def.key)
    if (!patch) return def
    return { ...def, ...patch }
  })
}

test('1 slot uses monthly_1x bundle total', () => {
  const options = opts([
    { key: 'monthly_1x', enabled: true, amountCents: 15000 },
    { key: 'monthly_2x', enabled: true, amountCents: 25000 },
  ])
  assert.equal(weeklyTierTotalDollars(1, options), 150)
})

test('2 slots use monthly_2x bundle total ($250), not per-slot multiplication', () => {
  const options = opts([
    { key: 'monthly_1x', enabled: true, amountCents: 15000 },
    { key: 'monthly_2x', enabled: true, amountCents: 25000 },
  ])
  assert.equal(weeklyTierTotalDollars(2, options), 250)
})

test('marginal for slot 2 is $100 when 1x=$150 and 2x=$250', () => {
  const options = opts([
    { key: 'monthly_1x', enabled: true, amountCents: 15000 },
    { key: 'monthly_2x', enabled: true, amountCents: 25000 },
    { key: 'monthly_3x', enabled: true, amountCents: 35000 },
  ])
  assert.equal(weeklyTierMarginalCents(1, options), 15000)
  assert.equal(weeklyTierMarginalCents(2, options), 10000)
  assert.equal(weeklyTierMarginalCents(3, options), 10000)
  assert.equal(weeklyTierTotalDollars(3, options), 350)
})

test('extrapolates 3x+ from 1x and 2x delta when amounts saved', () => {
  const options = opts([
    { key: 'monthly_1x', enabled: true, amountCents: 15000 },
    { key: 'monthly_2x', enabled: true, amountCents: 25000 },
    { key: 'monthly_3x', enabled: true, amountCents: 0 },
  ])
  assert.equal(weeklyTierTotalCents(3, options), 35000)
})

test('maxEnabledWeeklySlots respects disabled tiers', () => {
  const options = opts([
    { key: 'monthly_1x', enabled: true, amountCents: 15000 },
    { key: 'monthly_2x', enabled: true, amountCents: 25000 },
    { key: 'monthly_3x', enabled: false, amountCents: 35000 },
  ])
  assert.equal(maxEnabledWeeklySlots(options), 2)
})

test('only 1x enabled: each class at 1x price, up to 7 slots', () => {
  const options = opts([{ key: 'monthly_1x', enabled: true, amountCents: 15000 }])
  assert.equal(onlyFlatOneXWeeklyTier(options), true)
  assert.equal(maxEnabledWeeklySlots(options), 7)
  assert.equal(weeklyTierTotalDollars(1, options), 150)
  assert.equal(weeklyTierTotalDollars(2, options), 300)
  assert.equal(weeklyTierTotalDollars(3, options), 450)
  assert.equal(weeklyTierMarginalCents(1, options), 15000)
  assert.equal(weeklyTierMarginalCents(2, options), 15000)
  assert.equal(weeklyTierMarginalCents(3, options), 15000)
})

test('resolveSyncedWeeklyTierCatalogRef maps flat 1x multi-slot to monthly_1x quantity', () => {
  const options = opts([{ key: 'monthly_1x', enabled: true, amountCents: 15000 }])
  assert.deepEqual(resolveSyncedWeeklyTierCatalogRef(options, 2), {
    optionKey: 'monthly_1x',
    quantity: 2,
    amountCents: 30000,
  })
  assert.deepEqual(resolveSyncedWeeklyTierCatalogRef(options, 1), {
    optionKey: 'monthly_1x',
    quantity: 1,
    amountCents: 15000,
  })
})

test('resolveSyncedWeeklyTierCatalogRef uses stored monthly_2x when enabled', () => {
  const options = opts([
    { key: 'monthly_1x', enabled: true, amountCents: 15000 },
    { key: 'monthly_2x', enabled: true, amountCents: 25000 },
  ])
  assert.deepEqual(resolveSyncedWeeklyTierCatalogRef(options, 2), {
    optionKey: 'monthly_2x',
    quantity: 1,
    amountCents: 25000,
  })
})

test('resolveSyncedWeeklyTierCatalogRef returns null key for extrapolated bundle tiers', () => {
  const options = opts([
    { key: 'monthly_1x', enabled: true, amountCents: 15000 },
    { key: 'monthly_2x', enabled: true, amountCents: 25000 },
    { key: 'monthly_3x', enabled: true, amountCents: 0 },
  ])
  const ref = resolveSyncedWeeklyTierCatalogRef(options, 3)
  assert.equal(ref.optionKey, null)
  assert.equal(ref.quantity, 1)
  assert.equal(ref.amountCents, 35000)
})
