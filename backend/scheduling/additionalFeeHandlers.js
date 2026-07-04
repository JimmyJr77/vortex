import Joi from 'joi'
import { ensureDiscountEngineSchema } from '../programs/schema.js'
import {
  FEE_APPLY_BASES,
  FEE_TRIGGER_TYPES,
  mapFeeRow,
} from './additionalFeesEngine.js'

async function getFacilityId(pool) {
  const res = await pool.query('SELECT id FROM facility LIMIT 1')
  return res.rows[0]?.id ?? null
}

const feeSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().allow('', null).max(2000).optional(),
  amountCents: Joi.number().integer().min(0).required(),
  applyBasis: Joi.string()
    .valid(...FEE_APPLY_BASES)
    .required(),
  applyInterval: Joi.number().integer().min(1).default(1),
  triggerType: Joi.string()
    .valid(...FEE_TRIGGER_TYPES)
    .default('each_enrollment'),
  scopeLevel: Joi.string().valid('global', 'sport', 'program', 'class', 'offering').default('global'),
  scopeRefId: Joi.number().integer().allow(null).optional(),
  active: Joi.boolean().default(true),
  startsAt: Joi.date().iso().allow(null).optional(),
  endsAt: Joi.date().iso().allow(null).optional(),
  priority: Joi.number().integer().min(0).default(100),
  config: Joi.object().default({}),
})

export function createAdditionalFeeHandlers(pool) {
  return {
    async listFees(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const facilityId = await getFacilityId(pool)
        const result = await pool.query(
          `SELECT * FROM additional_fee
           WHERE facility_id IS NULL OR facility_id = $1
           ORDER BY priority ASC, name ASC`,
          [facilityId],
        )
        res.json({ success: true, data: { fees: result.rows.map(mapFeeRow) } })
      } catch (err) {
        console.error('[scheduling] listFees:', err)
        res.status(500).json({ success: false, message: 'Failed to load additional fees' })
      }
    },

    async createFee(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const facilityId = await getFacilityId(pool)
        const { error, value } = feeSchema.validate(req.body, { stripUnknown: true })
        if (error) return res.status(400).json({ success: false, message: error.details[0].message })

        const insert = await pool.query(
          `INSERT INTO additional_fee (
             facility_id, name, description, amount_cents, apply_basis, apply_interval,
             trigger_type, scope_level, scope_ref_id, active, starts_at, ends_at, priority, config
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING *`,
          [
            facilityId,
            value.name,
            value.description || null,
            value.amountCents,
            value.applyBasis,
            value.applyInterval,
            value.triggerType,
            value.scopeLevel,
            value.scopeRefId ?? null,
            value.active,
            value.startsAt ?? null,
            value.endsAt ?? null,
            value.priority,
            value.config || {},
          ],
        )
        res.json({ success: true, data: mapFeeRow(insert.rows[0]) })
        const { scheduleStripeCatalogSync, syncAdditionalFeeCatalog } = await import(
          '../billing/stripeCatalogSync.js'
        )
        scheduleStripeCatalogSync(`fee ${insert.rows[0].id}`, () =>
          syncAdditionalFeeCatalog(pool, Number(insert.rows[0].id)),
        )
      } catch (err) {
        console.error('[scheduling] createFee:', err)
        res.status(500).json({ success: false, message: 'Failed to create additional fee' })
      }
    },

    async updateFee(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const id = Number(req.params.id)
        const { error, value } = feeSchema.validate(req.body, { stripUnknown: true })
        if (error) return res.status(400).json({ success: false, message: error.details[0].message })

        const upd = await pool.query(
          `UPDATE additional_fee SET
             name=$2, description=$3, amount_cents=$4, apply_basis=$5, apply_interval=$6,
             trigger_type=$7, scope_level=$8, scope_ref_id=$9, active=$10, starts_at=$11,
             ends_at=$12, priority=$13, config=$14, updated_at=now()
           WHERE id=$1 RETURNING *`,
          [
            id,
            value.name,
            value.description || null,
            value.amountCents,
            value.applyBasis,
            value.applyInterval,
            value.triggerType,
            value.scopeLevel,
            value.scopeRefId ?? null,
            value.active,
            value.startsAt ?? null,
            value.endsAt ?? null,
            value.priority,
            value.config || {},
          ],
        )
        if (upd.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Additional fee not found' })
        }
        res.json({ success: true, data: mapFeeRow(upd.rows[0]) })
        const { scheduleStripeCatalogSync, syncAdditionalFeeCatalog } = await import(
          '../billing/stripeCatalogSync.js'
        )
        scheduleStripeCatalogSync(`fee ${id}`, () => syncAdditionalFeeCatalog(pool, id))
      } catch (err) {
        console.error('[scheduling] updateFee:', err)
        res.status(500).json({ success: false, message: 'Failed to update additional fee' })
      }
    },

    async deleteFee(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const id = Number(req.params.id)
        const del = await pool.query('DELETE FROM additional_fee WHERE id = $1 RETURNING id', [id])
        if (del.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Additional fee not found' })
        }
        res.json({ success: true })
        const { scheduleStripeCatalogSync, deactivateAdditionalFeeCatalog } = await import(
          '../billing/stripeCatalogSync.js'
        )
        scheduleStripeCatalogSync(`fee ${id}`, () => deactivateAdditionalFeeCatalog(pool, id))
      } catch (err) {
        console.error('[scheduling] deleteFee:', err)
        res.status(500).json({ success: false, message: 'Failed to delete additional fee' })
      }
    },
  }
}
