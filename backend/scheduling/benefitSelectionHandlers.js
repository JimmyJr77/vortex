import Joi from 'joi'
import { parseProgramPromoCodes } from '../programs/pricingDefaults.js'
import {
  loadBenefitSelectionsForScope,
  saveBenefitSelectionsForScope,
  migrateProgramPromoCodesToSelections,
} from './benefitSelection.js'

const selectionItemSchema = Joi.object({
  benefitType: Joi.string().valid('discount_rule', 'free_pass').required(),
  benefitId: Joi.number().integer().required(),
  autoApply: Joi.boolean().default(false),
  allowMemberCode: Joi.boolean().default(true),
  sortOrder: Joi.number().integer().min(0).default(0),
})

const saveSchema = Joi.object({
  scopeLevel: Joi.string().valid('sport', 'program', 'class', 'category').required(),
  scopeRefId: Joi.number().integer().required(),
  selections: Joi.array().items(selectionItemSchema).required(),
})

export function createBenefitSelectionHandlers(pool) {
  return {
    async getSelections(req, res) {
      try {
        const scopeLevel = req.query.scopeLevel
        const scopeRefId = Number(req.query.scopeRefId)
        if (!scopeLevel || !Number.isFinite(scopeRefId)) {
          return res.status(400).json({ success: false, message: 'scopeLevel and scopeRefId required' })
        }

        if (scopeLevel === 'program') {
          const { resolveProgramsSchema } = await import('../programs/schema.js')
          const schema = await resolveProgramsSchema(pool)
          const progRes = await pool.query(
            `SELECT pricing_promo_codes FROM ${schema.programsTable} WHERE id = $1`,
            [scopeRefId],
          )
          const promoCodes = parseProgramPromoCodes(progRes.rows[0])
          await migrateProgramPromoCodesToSelections(pool, scopeRefId, promoCodes)
        }

        const selections = await loadBenefitSelectionsForScope(pool, scopeLevel, scopeRefId)
        res.json({ success: true, data: selections })
      } catch (err) {
        console.error('[benefitSelection] getSelections:', err)
        res.status(500).json({ success: false, message: 'Failed to load benefit selections' })
      }
    },

    async putSelections(req, res) {
      try {
        const { error, value } = saveSchema.validate(req.body, { stripUnknown: true })
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const selections = await saveBenefitSelectionsForScope(
          pool,
          value.scopeLevel,
          value.scopeRefId,
          value.selections,
        )
        res.json({ success: true, data: selections })
      } catch (err) {
        console.error('[benefitSelection] putSelections:', err)
        res.status(500).json({ success: false, message: 'Failed to save benefit selections' })
      }
    },
  }
}
