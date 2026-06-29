import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Joi from 'joi'
import { normalizeProgramPricingOptions } from '../programPricingOptions.js'

const pricingCostOptionSchema = Joi.object({
  key: Joi.string().required(),
  enabled: Joi.boolean().required(),
  amountCents: Joi.number().integer().min(0).required(),
  offeringLabel: Joi.string().valid('offering', 'event').optional().allow(null),
}).unknown(true)

const topProgramUpdateSchema = Joi.object({
  pricingCostOptions: Joi.array().items(pricingCostOptionSchema).optional(),
})

function sanitize(body) {
  const sanitized = { ...(body ?? {}) }
  if (sanitized.pricingCostOptions !== undefined) {
    sanitized.pricingCostOptions = normalizeProgramPricingOptions(sanitized.pricingCostOptions)
  }
  return sanitized
}

describe('topProgramUpdateSchema', () => {
  it('accepts standard pricing save payload', () => {
    const payload = sanitize({
      pricingCostOptions: [
        { key: 'per_class', enabled: true, amountCents: 2500 },
        { key: 'per_offering', enabled: false, amountCents: 0, offeringLabel: 'offering' },
      ],
    })
    const { error } = topProgramUpdateSchema.validate(payload)
    assert.equal(error, undefined)
  })

  it('accepts legacy pricing rows after sanitize', () => {
    const payload = sanitize({
      pricingCostOptions: [
        {
          key: 'discount_off_2x',
          enabled: false,
          amountCents: 0,
          timesPerWeek: 2,
          createsClassDiscounts: true,
        },
        { key: 'per_class', enabled: true, amountCents: 2500 },
      ],
    })
    const { error } = topProgramUpdateSchema.validate(payload)
    assert.equal(error, undefined)
    assert.ok(payload.pricingCostOptions.every((o) => !('timesPerWeek' in o)))
  })

  it('rejects non-integer amountCents before sanitize', () => {
    const { error } = topProgramUpdateSchema.validate({
      pricingCostOptions: [{ key: 'per_class', enabled: true, amountCents: 25.5 }],
    })
    assert.ok(error)
  })
})
