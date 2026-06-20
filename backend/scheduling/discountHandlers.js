import Joi from 'joi'
import {
  computeOrderDiscounts,
  loadActiveDiscountRules,
  loadRedemptionCaps,
  DISCOUNT_TYPES,
} from './discountEngine.js'
import { ensureDiscountEngineSchema } from '../programs/schema.js'
import {
  ensureDiscountRulePromoCode,
  loadOccupiedPromoCodes,
} from './promoCodeRegistry.js'

async function getFacilityId(pool) {
  const res = await pool.query('SELECT id FROM facility LIMIT 1')
  return res.rows[0]?.id ?? null
}

const tierSchema = Joi.object({
  threshold: Joi.number().integer().min(1).required(),
  amountType: Joi.string().valid('percent', 'fixed').required(),
  amountValue: Joi.number().integer().min(0).required(),
})

const ruleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().allow('', null).max(2000).optional(),
  type: Joi.string()
    .valid(...DISCOUNT_TYPES)
    .required(),
  amountType: Joi.string().valid('percent', 'fixed').default('percent'),
  amountValue: Joi.number().integer().min(0).default(0),
  applyTo: Joi.string().valid('per_class', 'order_total').default('per_class'),
  calcBase: Joi.string().valid('pre', 'post').default('pre'),
  priority: Joi.number().integer().min(0).default(100),
  stackable: Joi.boolean().default(true),
  exclusivityGroup: Joi.string().trim().allow('', null).max(100).optional(),
  maxDiscountCents: Joi.number().integer().min(0).allow(null).optional(),
  scopeLevel: Joi.string().valid('global', 'sport', 'program', 'class', 'offering').default('global'),
  scopeRefId: Joi.number().integer().allow(null).optional(),
  active: Joi.boolean().default(true),
  startsAt: Joi.date().iso().allow(null).optional(),
  endsAt: Joi.date().iso().allow(null).optional(),
  maxRedemptions: Joi.number().integer().min(0).allow(null).optional(),
  config: Joi.object().default({}),
  tiers: Joi.array().items(tierSchema).default([]),
})

const simulateSchema = Joi.object({
  promoCodes: Joi.array().items(Joi.string().trim()).default([]),
  lines: Joi.array()
    .items(
      Joi.object({
        key: Joi.string().optional(),
        formId: Joi.number().integer().allow(null).optional(),
        programId: Joi.number().integer().allow(null).optional(),
        sportId: Joi.number().integer().allow(null).optional(),
        offeringId: Joi.number().integer().allow(null).optional(),
        memberId: Joi.number().integer().allow(null).optional(),
        memberCity: Joi.string().allow('', null).optional(),
        memberSchool: Joi.string().allow('', null).optional(),
        classOrdinal: Joi.number().integer().min(0).default(0),
        childOrdinal: Joi.number().integer().min(0).default(0),
        baseCents: Joi.number().integer().min(0).required(),
      }),
    )
    .min(1)
    .required(),
})

function mapRuleRow(r, tiers = []) {
  return {
    id: Number(r.id),
    facilityId: r.facility_id != null ? Number(r.facility_id) : null,
    name: r.name,
    description: r.description ?? null,
    type: r.type,
    amountType: r.amount_type,
    amountValue: Number(r.amount_value),
    applyTo: r.apply_to,
    calcBase: r.calc_base,
    priority: Number(r.priority ?? 100),
    stackable: r.stackable !== false,
    exclusivityGroup: r.exclusivity_group ?? null,
    maxDiscountCents: r.max_discount_cents != null ? Number(r.max_discount_cents) : null,
    scopeLevel: r.scope_level,
    scopeRefId: r.scope_ref_id != null ? Number(r.scope_ref_id) : null,
    active: r.active !== false,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    maxRedemptions: r.max_redemptions != null ? Number(r.max_redemptions) : null,
    redeemedCount: Number(r.redeemed_count ?? 0),
    config: r.config || {},
    tiers: tiers.map((t) => ({
      id: Number(t.id),
      threshold: Number(t.threshold),
      amountType: t.amount_type,
      amountValue: Number(t.amount_value),
    })),
  }
}

async function loadRuleWithTiers(pool, id) {
  const res = await pool.query('SELECT * FROM discount_rule WHERE id = $1', [id])
  if (res.rows.length === 0) return null
  const tiersRes = await pool.query(
    'SELECT * FROM discount_rule_tier WHERE rule_id = $1 ORDER BY threshold ASC',
    [id],
  )
  return mapRuleRow(res.rows[0], tiersRes.rows)
}

async function replaceTiers(client, ruleId, tiers) {
  await client.query('DELETE FROM discount_rule_tier WHERE rule_id = $1', [ruleId])
  for (const t of tiers) {
    await client.query(
      `INSERT INTO discount_rule_tier (rule_id, threshold, amount_type, amount_value)
       VALUES ($1,$2,$3,$4)`,
      [ruleId, t.threshold, t.amountType, t.amountValue],
    )
  }
}

export function createDiscountHandlers(pool) {
  return {
    async listRules(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const facilityId = await getFacilityId(pool)
        const rulesRes = await pool.query(
          `SELECT * FROM discount_rule
           WHERE facility_id = $1 OR facility_id IS NULL
           ORDER BY type, priority, name`,
          [facilityId],
        )
        const ids = rulesRes.rows.map((r) => Number(r.id))
        const tiersRes = ids.length
          ? await pool.query(
              'SELECT * FROM discount_rule_tier WHERE rule_id = ANY($1::bigint[]) ORDER BY threshold ASC',
              [ids],
            )
          : { rows: [] }
        const tiersByRule = new Map()
        for (const t of tiersRes.rows) {
          const list = tiersByRule.get(Number(t.rule_id)) || []
          list.push(t)
          tiersByRule.set(Number(t.rule_id), list)
        }
        const settingsRes = await pool.query(
          `SELECT max_free_units_total, max_discount_redemptions_total
           FROM discount_global_settings WHERE facility_id = $1`,
          [facilityId],
        )
        res.json({
          success: true,
          data: {
            rules: rulesRes.rows.map((r) => mapRuleRow(r, tiersByRule.get(Number(r.id)) || [])),
            globalSettings: settingsRes.rows[0]
              ? {
                  maxFreeUnitsTotal: settingsRes.rows[0].max_free_units_total,
                  maxDiscountRedemptionsTotal: settingsRes.rows[0].max_discount_redemptions_total,
                }
              : { maxFreeUnitsTotal: null, maxDiscountRedemptionsTotal: null },
          },
        })
      } catch (err) {
        console.error('[scheduling] listRules:', err)
        res.status(500).json({ success: false, message: 'Failed to load discount rules' })
      }
    },

    async createRule(req, res) {
      const client = await pool.connect()
      try {
        await ensureDiscountEngineSchema(pool)
        const { error, value } = ruleSchema.validate(req.body, { stripUnknown: true })
        if (error) return res.status(400).json({ success: false, message: error.details[0].message })
        const facilityId = await getFacilityId(pool)
        const occupied = await loadOccupiedPromoCodes(pool, facilityId)
        const withPromo = ensureDiscountRulePromoCode(value, occupied)

        await client.query('BEGIN')
        const insert = await client.query(
          `INSERT INTO discount_rule
            (facility_id, name, description, type, amount_type, amount_value, apply_to, calc_base,
             priority, stackable, exclusivity_group, max_discount_cents, scope_level, scope_ref_id,
             active, starts_at, ends_at, max_redemptions, config)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           RETURNING id`,
          [
            facilityId,
            withPromo.name,
            withPromo.description || null,
            withPromo.type,
            withPromo.amountType,
            withPromo.amountValue,
            withPromo.applyTo,
            withPromo.calcBase,
            withPromo.priority,
            withPromo.stackable,
            withPromo.exclusivityGroup || null,
            withPromo.maxDiscountCents ?? null,
            withPromo.scopeLevel,
            withPromo.scopeRefId ?? null,
            withPromo.active,
            withPromo.startsAt ?? null,
            withPromo.endsAt ?? null,
            withPromo.maxRedemptions ?? null,
            withPromo.config || {},
          ],
        )
        const ruleId = Number(insert.rows[0].id)
        await replaceTiers(client, ruleId, withPromo.tiers || [])
        await client.query('COMMIT')
        const rule = await loadRuleWithTiers(pool, ruleId)
        res.json({ success: true, data: rule })
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        if (err.code === '23505') {
          return res.status(409).json({ success: false, message: 'A promo code with that code already exists' })
        }
        console.error('[scheduling] createRule:', err)
        res.status(500).json({ success: false, message: 'Failed to create discount rule' })
      } finally {
        client.release()
      }
    },

    async updateRule(req, res) {
      const client = await pool.connect()
      try {
        await ensureDiscountEngineSchema(pool)
        const id = Number(req.params.id)
        const { error, value } = ruleSchema.validate(req.body, { stripUnknown: true })
        if (error) return res.status(400).json({ success: false, message: error.details[0].message })
        const facilityId = await getFacilityId(pool)
        const occupied = await loadOccupiedPromoCodes(pool, facilityId, { excludeDiscountId: id })
        const withPromo = ensureDiscountRulePromoCode(value, occupied)

        await client.query('BEGIN')
        const upd = await client.query(
          `UPDATE discount_rule SET
             name=$2, description=$3, type=$4, amount_type=$5, amount_value=$6, apply_to=$7,
             calc_base=$8, priority=$9, stackable=$10, exclusivity_group=$11, max_discount_cents=$12,
             scope_level=$13, scope_ref_id=$14, active=$15, starts_at=$16, ends_at=$17,
             max_redemptions=$18, config=$19, updated_at=now()
           WHERE id=$1 RETURNING id`,
          [
            id,
            withPromo.name,
            withPromo.description || null,
            withPromo.type,
            withPromo.amountType,
            withPromo.amountValue,
            withPromo.applyTo,
            withPromo.calcBase,
            withPromo.priority,
            withPromo.stackable,
            withPromo.exclusivityGroup || null,
            withPromo.maxDiscountCents ?? null,
            withPromo.scopeLevel,
            withPromo.scopeRefId ?? null,
            withPromo.active,
            withPromo.startsAt ?? null,
            withPromo.endsAt ?? null,
            withPromo.maxRedemptions ?? null,
            withPromo.config || {},
          ],
        )
        if (upd.rows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).json({ success: false, message: 'Discount rule not found' })
        }
        await replaceTiers(client, id, withPromo.tiers || [])
        await client.query('COMMIT')
        const rule = await loadRuleWithTiers(pool, id)
        res.json({ success: true, data: rule })
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        if (err.code === '23505') {
          return res.status(409).json({ success: false, message: 'A promo code with that code already exists' })
        }
        console.error('[scheduling] updateRule:', err)
        res.status(500).json({ success: false, message: 'Failed to update discount rule' })
      } finally {
        client.release()
      }
    },

    async deleteRule(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const id = Number(req.params.id)
        const del = await pool.query('DELETE FROM discount_rule WHERE id = $1 RETURNING id', [id])
        if (del.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Discount rule not found' })
        }
        res.json({ success: true })
      } catch (err) {
        console.error('[scheduling] deleteRule:', err)
        res.status(500).json({ success: false, message: 'Failed to delete discount rule' })
      }
    },

    async updateGlobalSettings(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const facilityId = await getFacilityId(pool)
        const schema = Joi.object({
          maxFreeUnitsTotal: Joi.number().integer().min(0).allow(null).optional(),
          maxDiscountRedemptionsTotal: Joi.number().integer().min(0).allow(null).optional(),
        })
        const { error, value } = schema.validate(req.body, { stripUnknown: true })
        if (error) return res.status(400).json({ success: false, message: error.details[0].message })
        await pool.query(
          `INSERT INTO discount_global_settings (facility_id, max_free_units_total, max_discount_redemptions_total)
           VALUES ($1,$2,$3)
           ON CONFLICT (facility_id) DO UPDATE
             SET max_free_units_total = EXCLUDED.max_free_units_total,
                 max_discount_redemptions_total = EXCLUDED.max_discount_redemptions_total,
                 updated_at = now()`,
          [facilityId, value.maxFreeUnitsTotal ?? null, value.maxDiscountRedemptionsTotal ?? null],
        )
        res.json({ success: true })
      } catch (err) {
        console.error('[scheduling] updateGlobalSettings:', err)
        res.status(500).json({ success: false, message: 'Failed to update settings' })
      }
    },

    async validatePromo(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const facilityId = await getFacilityId(pool)
        const code = String(req.body?.code ?? '').trim()
        if (!code) return res.status(400).json({ success: false, message: 'Promo code is required' })
        const rules = await loadActiveDiscountRules(pool, facilityId)
        const now = Date.now()
        const match = rules.find(
          (r) =>
            r.type === 'promo_code' &&
            String(r.config?.code ?? '').trim().toLowerCase() === code.toLowerCase() &&
            (!r.startsAt || new Date(r.startsAt).getTime() <= now) &&
            (!r.endsAt || new Date(r.endsAt).getTime() >= now) &&
            (r.maxRedemptions == null || r.redeemedCount < r.maxRedemptions),
        )
        if (!match) {
          return res.json({ success: true, data: { valid: false, message: 'Invalid or expired promo code' } })
        }
        res.json({
          success: true,
          data: {
            valid: true,
            code,
            ruleId: match.id,
            name: match.name,
            amountType: match.amountType,
            amountValue: match.amountValue,
          },
        })
      } catch (err) {
        console.error('[scheduling] validatePromo:', err)
        res.status(500).json({ success: false, message: 'Failed to validate promo code' })
      }
    },

    async listSportDefaults(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const facilityId = await getFacilityId(pool)
        const tagsRes = await pool.query(
          `SELECT id, name FROM discipline_tag
           WHERE facility_id = $1 OR facility_id IS NULL
           ORDER BY sort_order, name`,
          [facilityId],
        )
        const defaultsRes = await pool.query('SELECT * FROM sport_pricing_default')
        const byTag = new Map()
        for (const row of defaultsRes.rows) byTag.set(Number(row.discipline_tag_id), row)
        res.json({
          success: true,
          data: tagsRes.rows.map((t) => {
            const d = byTag.get(Number(t.id))
            return {
              disciplineTagId: Number(t.id),
              name: t.name,
              costAmountCents: d ? Number(d.cost_amount_cents) : 0,
              costUnit: d ? d.cost_unit : 'per_month',
              freeSlotsPerUser: d ? Number(d.free_slots_per_user) : 0,
              maxFreeSlotsTotal: d?.max_free_slots_total != null ? Number(d.max_free_slots_total) : null,
              maxDiscountRedemptions:
                d?.max_discount_redemptions != null ? Number(d.max_discount_redemptions) : null,
              configured: Boolean(d),
            }
          }),
        })
      } catch (err) {
        console.error('[scheduling] listSportDefaults:', err)
        res.status(500).json({ success: false, message: 'Failed to load sport defaults' })
      }
    },

    async upsertSportDefault(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const schema = Joi.object({
          costAmountCents: Joi.number().integer().min(0).default(0),
          costUnit: Joi.string()
            .valid('per_slot', 'per_class', 'per_week', 'per_month', 'per_offering', 'per_hour')
            .default('per_month'),
          freeSlotsPerUser: Joi.number().integer().min(0).default(0),
          maxFreeSlotsTotal: Joi.number().integer().min(0).allow(null).optional(),
          maxDiscountRedemptions: Joi.number().integer().min(0).allow(null).optional(),
        })
        const { error, value } = schema.validate(req.body, { stripUnknown: true })
        if (error) return res.status(400).json({ success: false, message: error.details[0].message })
        const disciplineTagId = Number(req.params.id)
        await pool.query(
          `INSERT INTO sport_pricing_default
            (discipline_tag_id, cost_amount_cents, cost_unit, free_slots_per_user,
             max_free_slots_total, max_discount_redemptions)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (discipline_tag_id) DO UPDATE
             SET cost_amount_cents = EXCLUDED.cost_amount_cents,
                 cost_unit = EXCLUDED.cost_unit,
                 free_slots_per_user = EXCLUDED.free_slots_per_user,
                 max_free_slots_total = EXCLUDED.max_free_slots_total,
                 max_discount_redemptions = EXCLUDED.max_discount_redemptions,
                 updated_at = now()`,
          [
            disciplineTagId,
            value.costAmountCents,
            value.costUnit,
            value.freeSlotsPerUser,
            value.maxFreeSlotsTotal ?? null,
            value.maxDiscountRedemptions ?? null,
          ],
        )
        res.json({ success: true })
      } catch (err) {
        console.error('[scheduling] upsertSportDefault:', err)
        res.status(500).json({ success: false, message: 'Failed to save sport default' })
      }
    },

    async simulateOrder(req, res) {
      try {
        await ensureDiscountEngineSchema(pool)
        const { error, value } = simulateSchema.validate(req.body, { stripUnknown: true })
        if (error) return res.status(400).json({ success: false, message: error.details[0].message })
        const facilityId = await getFacilityId(pool)
        const rules = await loadActiveDiscountRules(pool, facilityId)
        const caps = await loadRedemptionCaps(pool, facilityId)
        const lines = value.lines.map((l, i) => ({ ...l, key: l.key || `sim-${i}` }))
        const result = computeOrderDiscounts({ lines, rules, promoCodes: value.promoCodes, caps })
        res.json({ success: true, data: result })
      } catch (err) {
        console.error('[scheduling] simulateOrder:', err)
        res.status(500).json({ success: false, message: 'Failed to simulate order' })
      }
    },
  }
}
