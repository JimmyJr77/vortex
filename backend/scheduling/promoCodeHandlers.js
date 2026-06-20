import { ensureDiscountEngineSchema } from '../programs/schema.js'
import {
  backfillMissingPromoCodes,
  buildPromoCodeRegistry,
} from './promoCodeRegistry.js'

async function getFacilityId(pool) {
  const res = await pool.query('SELECT id FROM facility LIMIT 1')
  return res.rows[0]?.id ?? null
}

export function createPromoCodeHandlers(pool) {
  return {
    async listPromoCodes(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const facilityId = await getFacilityId(pool)
        await backfillMissingPromoCodes(pool, facilityId)
        const entries = await buildPromoCodeRegistry(pool, facilityId)
        res.json({ success: true, data: entries })
      } catch (err) {
        console.error('[scheduling] listPromoCodes:', err)
        res.status(500).json({ success: false, message: 'Failed to load promo codes' })
      }
    },
  }
}
