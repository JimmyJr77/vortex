import Joi from 'joi'
import {
  applyFreePassLayer,
  BENEFIT_UNITS,
  APPLICATION_METHODS,
  SCOPE_LEVELS,
  loadActivePassTemplates,
  loadAttachmentsForScope,
  loadFreePassCaps,
  loadMemberPassGrants,
  mapPassTemplateRow,
  issueMemberPassGrant,
} from './freePassEngine.js'
import {
  loadBenefitSelectionsForScope,
  saveBenefitSelectionsForScope,
} from './benefitSelection.js'

async function getFacilityId(pool) {
  const res = await pool.query('SELECT id FROM facility LIMIT 1')
  return res.rows[0]?.id ?? null
}

const templateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().allow('', null).max(2000).optional(),
  active: Joi.boolean().default(true),
  startsAt: Joi.date().iso().allow(null).optional(),
  endsAt: Joi.date().iso().allow(null).optional(),
  benefitUnit: Joi.string()
    .valid(...BENEFIT_UNITS)
    .default('slot'),
  benefitQuantity: Joi.number().integer().min(1).default(1),
  applicationMethod: Joi.string()
    .valid(...APPLICATION_METHODS)
    .default('waive_enrollment'),
  scopeLevel: Joi.string()
    .valid(...SCOPE_LEVELS)
    .default('global'),
  scopeRefId: Joi.number().integer().allow(null).optional(),
  dayOfWeek: Joi.number().integer().min(0).max(6).allow(null).optional(),
  offeringIds: Joi.array().items(Joi.number().integer()).default([]),
  eligibility: Joi.object().default({}),
  issuance: Joi.object().default({}),
  debitsFreeClassAllowance: Joi.boolean().default(false),
  stackable: Joi.boolean().default(true),
  exclusivityGroup: Joi.string().trim().allow('', null).max(100).optional(),
  maxRedemptions: Joi.number().integer().min(0).allow(null).optional(),
  config: Joi.object().default({}),
})

const attachmentSchema = Joi.object({
  scopeLevel: Joi.string().valid('program', 'class').required(),
  scopeRefId: Joi.number().integer().required(),
  attachments: Joi.array()
    .items(
      Joi.object({
        passTemplateId: Joi.number().integer().required(),
        autoApply: Joi.boolean().default(true),
        sortOrder: Joi.number().integer().min(0).default(0),
      }),
    )
    .required(),
})

const grantSchema = Joi.object({
  passTemplateId: Joi.number().integer().required(),
  quantity: Joi.number().integer().min(1).default(1),
  expiresAt: Joi.date().iso().allow(null).optional(),
  sourceRef: Joi.string().trim().allow('', null).optional(),
})

const simulateSchema = Joi.object({
  promoCodes: Joi.array().items(Joi.string().trim()).default([]),
  isNewMember: Joi.boolean().default(false),
  lines: Joi.array()
    .items(
      Joi.object({
        key: Joi.string().optional(),
        formId: Joi.number().integer().allow(null).optional(),
        programId: Joi.number().integer().allow(null).optional(),
        sportId: Joi.number().integer().allow(null).optional(),
        offeringId: Joi.number().integer().allow(null).optional(),
        slotGroupId: Joi.number().integer().allow(null).optional(),
        timeSlotId: Joi.number().integer().allow(null).optional(),
        memberId: Joi.number().integer().allow(null).optional(),
        memberCity: Joi.string().allow('', null).optional(),
        memberSchool: Joi.string().allow('', null).optional(),
        memberGraduationYear: Joi.number().integer().allow(null).optional(),
        baseCents: Joi.number().integer().min(0).required(),
      }),
    )
    .min(1)
    .required(),
})

function templateToDb(value) {
  return {
    name: value.name,
    description: value.description ?? null,
    active: value.active !== false,
    starts_at: value.startsAt ?? null,
    ends_at: value.endsAt ?? null,
    benefit_unit: value.benefitUnit ?? 'slot',
    benefit_quantity: value.benefitQuantity ?? 1,
    application_method: value.applicationMethod ?? 'waive_enrollment',
    scope_level: value.scopeLevel ?? 'global',
    scope_ref_id: value.scopeRefId ?? null,
    day_of_week: value.dayOfWeek ?? null,
    offering_ids: value.offeringIds ?? [],
    eligibility: JSON.stringify(value.eligibility ?? {}),
    issuance: JSON.stringify(value.issuance ?? {}),
    debits_free_class_allowance: Boolean(value.debitsFreeClassAllowance),
    stackable: value.stackable !== false,
    exclusivity_group: value.exclusivityGroup || null,
    max_redemptions: value.maxRedemptions ?? null,
    config: JSON.stringify(value.config ?? {}),
  }
}

export function createFreePassHandlers(pool) {
  return {
    async listTemplates(req, res) {
      try {
        const facilityId = await getFacilityId(pool)
        const res2 = await pool.query(
          `SELECT * FROM free_pass_template
           WHERE ($1::bigint IS NULL OR facility_id = $1)
           ORDER BY name ASC`,
          [facilityId],
        )
        res.json({ success: true, data: res2.rows.map(mapPassTemplateRow) })
      } catch (err) {
        console.error('[freePass] listTemplates:', err)
        res.status(500).json({ success: false, message: 'Failed to load free passes' })
      }
    },

    async createTemplate(req, res) {
      try {
        const { error, value } = templateSchema.validate(req.body, { stripUnknown: true })
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const facilityId = await getFacilityId(pool)
        const db = templateToDb(value)
        const result = await pool.query(
          `INSERT INTO free_pass_template
             (facility_id, name, description, active, starts_at, ends_at,
              benefit_unit, benefit_quantity, application_method, scope_level, scope_ref_id,
              day_of_week, offering_ids, eligibility, issuance, debits_free_class_allowance,
              stackable, exclusivity_group, max_redemptions, config)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,$17,$18,$19,$20::jsonb)
           RETURNING *`,
          [
            facilityId,
            db.name,
            db.description,
            db.active,
            db.starts_at,
            db.ends_at,
            db.benefit_unit,
            db.benefit_quantity,
            db.application_method,
            db.scope_level,
            db.scope_ref_id,
            db.day_of_week,
            db.offering_ids,
            db.eligibility,
            db.issuance,
            db.debits_free_class_allowance,
            db.stackable,
            db.exclusivity_group,
            db.max_redemptions,
            db.config,
          ],
        )
        res.status(201).json({ success: true, data: mapPassTemplateRow(result.rows[0]) })
      } catch (err) {
        console.error('[freePass] createTemplate:', err)
        res.status(500).json({ success: false, message: 'Failed to create free pass' })
      }
    },

    async updateTemplate(req, res) {
      try {
        const id = Number(req.params.id)
        const { error, value } = templateSchema.validate(req.body, { stripUnknown: true })
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const db = templateToDb(value)
        const result = await pool.query(
          `UPDATE free_pass_template SET
             name=$1, description=$2, active=$3, starts_at=$4, ends_at=$5,
             benefit_unit=$6, benefit_quantity=$7, application_method=$8,
             scope_level=$9, scope_ref_id=$10, day_of_week=$11, offering_ids=$12,
             eligibility=$13::jsonb, issuance=$14::jsonb, debits_free_class_allowance=$15,
             stackable=$16, exclusivity_group=$17, max_redemptions=$18, config=$19::jsonb,
             updated_at=now()
           WHERE id=$20 RETURNING *`,
          [
            db.name,
            db.description,
            db.active,
            db.starts_at,
            db.ends_at,
            db.benefit_unit,
            db.benefit_quantity,
            db.application_method,
            db.scope_level,
            db.scope_ref_id,
            db.day_of_week,
            db.offering_ids,
            db.eligibility,
            db.issuance,
            db.debits_free_class_allowance,
            db.stackable,
            db.exclusivity_group,
            db.max_redemptions,
            db.config,
            id,
          ],
        )
        if (!result.rows[0]) {
          return res.status(404).json({ success: false, message: 'Free pass not found' })
        }
        res.json({ success: true, data: mapPassTemplateRow(result.rows[0]) })
      } catch (err) {
        console.error('[freePass] updateTemplate:', err)
        res.status(500).json({ success: false, message: 'Failed to update free pass' })
      }
    },

    async deleteTemplate(req, res) {
      try {
        const id = Number(req.params.id)
        const result = await pool.query(
          'DELETE FROM free_pass_template WHERE id = $1 RETURNING id',
          [id],
        )
        if (!result.rows[0]) {
          return res.status(404).json({ success: false, message: 'Free pass not found' })
        }
        res.json({ success: true })
      } catch (err) {
        console.error('[freePass] deleteTemplate:', err)
        res.status(500).json({ success: false, message: 'Failed to delete free pass' })
      }
    },

    async getAttachments(req, res) {
      try {
        const scopeLevel = req.query.scopeLevel
        const scopeRefId = Number(req.query.scopeRefId)
        if (!scopeLevel || !Number.isFinite(scopeRefId)) {
          return res.status(400).json({ success: false, message: 'scopeLevel and scopeRefId required' })
        }
        const selections = await loadBenefitSelectionsForScope(pool, scopeLevel, scopeRefId)
        const attachments = selections
          .filter((s) => s.benefitType === 'free_pass')
          .map((s) => ({
            id: s.id,
            scopeLevel,
            scopeRefId,
            passTemplateId: s.benefitId,
            autoApply: s.autoApply,
            sortOrder: s.sortOrder,
          }))
        res.json({ success: true, data: attachments })
      } catch (err) {
        console.error('[freePass] getAttachments:', err)
        res.status(500).json({ success: false, message: 'Failed to load attachments' })
      }
    },

    async putAttachments(req, res) {
      try {
        const { error, value } = attachmentSchema.validate(req.body, { stripUnknown: true })
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const existing = await loadBenefitSelectionsForScope(pool, value.scopeLevel, value.scopeRefId)
        const nonPass = existing.filter((s) => s.benefitType !== 'free_pass')
        const passSelections = value.attachments.map((a, i) => ({
          benefitType: 'free_pass',
          benefitId: a.passTemplateId,
          autoApply: a.autoApply !== false,
          allowMemberCode: false,
          sortOrder: a.sortOrder ?? i,
        }))
        await saveBenefitSelectionsForScope(pool, value.scopeLevel, value.scopeRefId, [
          ...nonPass.map((s) => ({
            benefitType: s.benefitType,
            benefitId: s.benefitId,
            autoApply: s.autoApply,
            allowMemberCode: s.allowMemberCode,
            sortOrder: s.sortOrder,
          })),
          ...passSelections,
        ])
        const attachments = await loadBenefitSelectionsForScope(pool, value.scopeLevel, value.scopeRefId)
        res.json({
          success: true,
          data: attachments
            .filter((s) => s.benefitType === 'free_pass')
            .map((s) => ({
              id: s.id,
              scopeLevel: value.scopeLevel,
              scopeRefId: value.scopeRefId,
              passTemplateId: s.benefitId,
              autoApply: s.autoApply,
              sortOrder: s.sortOrder,
            })),
        })
      } catch (err) {
        console.error('[freePass] putAttachments:', err)
        res.status(500).json({ success: false, message: 'Failed to save attachments' })
      }
    },

    async listMemberGrants(req, res) {
      try {
        const memberId = Number(req.params.memberId)
        const grants = await loadMemberPassGrants(pool, memberId)
        res.json({ success: true, data: grants })
      } catch (err) {
        console.error('[freePass] listMemberGrants:', err)
        res.status(500).json({ success: false, message: 'Failed to load member passes' })
      }
    },

    async issueMemberGrant(req, res) {
      try {
        const memberId = Number(req.params.memberId)
        const { error, value } = grantSchema.validate(req.body, { stripUnknown: true })
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const grant = await issueMemberPassGrant(pool, {
          memberId,
          passTemplateId: value.passTemplateId,
          quantity: value.quantity,
          issuedBy: 'admin',
          sourceRef: value.sourceRef ?? null,
          expiresAt: value.expiresAt ?? null,
        })
        if (!grant) {
          return res.status(404).json({ success: false, message: 'Pass template not found' })
        }
        res.status(201).json({ success: true, data: grant })
      } catch (err) {
        console.error('[freePass] issueMemberGrant:', err)
        res.status(500).json({ success: false, message: 'Failed to issue pass' })
      }
    },

    async simulate(req, res) {
      try {
        const { error, value } = simulateSchema.validate(req.body, { stripUnknown: true })
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const facilityId = await getFacilityId(pool)
        const templates = await loadActivePassTemplates(pool, facilityId)
        const caps = await loadFreePassCaps(pool, facilityId)
        const memberId = value.lines[0]?.memberId ?? null
        const grants = memberId ? await loadMemberPassGrants(pool, memberId) : []

        const lines = []
        for (let i = 0; i < value.lines.length; i += 1) {
          const l = value.lines[i]
          const { resolveBenefitSelectionsForLine } = await import('./benefitSelection.js')
          const resolved = await resolveBenefitSelectionsForLine(pool, {
            sportId: l.sportId ?? null,
            programId: l.programId ?? null,
            formId: l.formId ?? null,
            categoryId: l.categoryId ?? null,
          })
          lines.push({
            key: l.key ?? `line-${i}`,
            formId: l.formId ?? null,
            programId: l.programId ?? null,
            sportId: l.sportId ?? null,
            offeringId: l.offeringId ?? null,
            slotGroupId: l.slotGroupId ?? null,
            timeSlotId: l.timeSlotId ?? null,
            memberId: l.memberId ?? null,
            memberCity: l.memberCity ?? null,
            memberSchool: l.memberSchool ?? null,
            memberGraduationYear: l.memberGraduationYear ?? null,
            baseCents: l.baseCents,
            costUsesSelections: resolved.usesCostSelections,
            freePassAttachments: resolved.freePassAttachments.map((a) => ({
              passTemplateId: a.passTemplateId,
              autoApply: a.autoApply,
              allowMemberCode: resolved.selections.find(
                (s) => s.benefitType === 'free_pass' && s.benefitId === a.passTemplateId,
              )?.allowMemberCode !== false,
            })),
          })
        }

        const result = applyFreePassLayer({
          lines,
          templates,
          grants,
          attachments: [],
          promoCodes: value.promoCodes,
          caps,
          isNewMember: value.isNewMember,
        })
        res.json({ success: true, data: result })
      } catch (err) {
        console.error('[freePass] simulate:', err)
        res.status(500).json({ success: false, message: 'Simulation failed' })
      }
    },
  }
}
