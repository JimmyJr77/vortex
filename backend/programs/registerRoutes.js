import Joi from 'joi'
import { ensureDisciplineTagsSchema, ensurePrimaryDisciplineTagColumn, ensureProgramPricingColumns, ensureProgramsSchedulingSchema, hasProgramSchedulingColumns, mapProgramRow, resolveProgramsSchema } from './schema.js'
import { consolidateClasses } from './reconcile.js'
import { deleteTopProgramCascade } from './deleteTopProgram.js'
import { listPublicClassesOffered } from './listPublicClassesOffered.js'
import { getProgramPrimarySportFields, setProgramPrimarySport } from './primarySport.js'
import { mapProgramPricingFields, resetAllClassesPricingToProgram } from './pricingDefaults.js'

const disciplineTagSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
})

function mapDisciplineTagRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    sortOrder: row.sort_order != null ? Number(row.sort_order) : 0,
  }
}

const topProgramSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  displayName: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional().allow('', null),
  primarySportId: Joi.number().integer().allow(null).optional(),
})

const classEventSchema = Joi.object({
  displayName: Joi.string().min(1).max(255).required(),
  skillLevel: Joi.string()
    .valid('EARLY_STAGE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED')
    .optional()
    .allow(null, ''),
  ageMin: Joi.number().integer().min(0).optional().allow(null),
  ageMax: Joi.number().integer().min(0).optional().allow(null),
  description: Joi.string().optional().allow('', null),
  skillRequirements: Joi.string().optional().allow('', null),
  isActive: Joi.boolean().optional(),
})

const topProgramUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  displayName: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).optional().allow('', null),
  archived: Joi.boolean().optional(),
  schedulingActive: Joi.boolean().optional(),
  schedulingEnrollSites: Joi.array()
    .items(Joi.string().valid('athletics', 'gymnastics', 'basketball'))
    .optional(),
  schedulingSignupFields: Joi.array().items(Joi.string()).optional().allow(null),
  schedulingMandateWaiver: Joi.boolean().optional(),
  markOverviewSaved: Joi.boolean().optional(),
  primarySportId: Joi.number().integer().allow(null).optional(),
  pricingMaxSlotsPerUser: Joi.number().integer().min(1).allow(null).optional(),
  pricingSlotCostMonthlyCents: Joi.number().integer().min(0).optional(),
  pricingCostUnit: Joi.string()
    .valid('per_slot', 'per_class', 'per_week', 'per_month', 'per_offering', 'per_hour')
    .optional(),
  pricingFreeSlotsPerUser: Joi.number().integer().min(0).optional(),
  pricingMaxFreeSlotsTotal: Joi.number().integer().min(0).allow(null).optional(),
  pricingPromoCodes: Joi.array().items(Joi.string().trim().max(100)).optional(),
})

async function getFacilityId(pool) {
  const facilityId = await pool.query('SELECT id FROM facility LIMIT 1')
  return facilityId.rows[0]?.id ?? null
}

async function createSchedulingFormForClassEvent(pool, classEvent, programsId, schema) {
  if (!schema.hasSchedulingProgramLink) return null
  const { ensureProgramPricingColumns } = await import('./schema.js')
  await ensureProgramPricingColumns(pool)
  const existing = await pool.query(
    `SELECT id FROM scheduling_form WHERE program_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [classEvent.id],
  )
  if (existing.rows.length > 0) return Number(existing.rows[0].id)

  let signupFields = null
  let mandateWaiver = false
  let isActive = classEvent.isActive !== false
  if (programsId) {
    const hasSchedCols = await hasProgramSchedulingColumns(pool, schema.programsTable)
    if (hasSchedCols) {
      const progRes = await pool.query(
        `SELECT scheduling_signup_fields, scheduling_mandate_waiver, scheduling_active
         FROM ${schema.programsTable} WHERE id = $1`,
        [programsId],
      )
      if (progRes.rows[0]) {
        signupFields = progRes.rows[0].scheduling_signup_fields
        mandateWaiver = Boolean(progRes.rows[0].scheduling_mandate_waiver)
        isActive = Boolean(progRes.rows[0].scheduling_active)
      }
    }
  }

  const cols = ['title', 'description', 'is_active']
  const vals = [classEvent.displayName, classEvent.description || null, isActive]
  if (signupFields) {
    cols.push('signup_fields', 'mandate_waiver')
    vals.push(JSON.stringify(signupFields), mandateWaiver)
  }
  if (schema.hasSchedulingProgramsLink && programsId) {
    cols.push('programs_id', 'program_id', 'pricing_overrides_program')
    vals.push(programsId, classEvent.id, false)
  } else if (schema.hasSchedulingProgramLink) {
    cols.push('program_id', 'pricing_overrides_program')
    vals.push(classEvent.id, false)
  }

  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ')
  const insert = await pool.query(
    `INSERT INTO scheduling_form (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    vals,
  )
  return Number(insert.rows[0].id)
}

export function registerProgramsPublicRoutes(app, pool) {
  app.get('/api/public/classes-offered', async (req, res) => {
    try {
      const { isEnrollSiteKey } = await import('../scheduling/enrollSites.js')
      const site = String(req.query.site || 'athletics')
      if (!isEnrollSiteKey(site)) {
        return res.status(400).json({ success: false, message: 'Invalid enroll site' })
      }
      const data = await listPublicClassesOffered(pool, site)
      res.json({ success: true, data })
    } catch (err) {
      console.error('[programs] public classes-offered:', err)
      res.status(500).json({ success: false, message: 'Failed to load classes offered' })
    }
  })
}

export function registerProgramsAdminRoutes(app, pool) {
  console.log('✅ Programs admin routes registered')

  app.get('/api/admin/programs/:programsId/class-events', async (req, res) => {
    try {
      await ensureProgramsSchedulingSchema(pool)
      await ensurePrimaryDisciplineTagColumn(pool)
      await ensureProgramPricingColumns(pool)
      const schema = await resolveProgramsSchema(pool)
      const programsId = Number(req.params.programsId)
      const { archived } = req.query
      let query = `
        SELECT
          p.id,
          p.category,
          p.${schema.programFkColumn} as "programsId",
          p.${schema.programFkColumn} as "categoryId",
          pr.display_name as "programsDisplayName",
          pr.display_name as "categoryDisplayName",
          pr.name as "programsName",
          pr.name as "categoryName",
          p.name,
          p.display_name as "displayName",
          p.skill_level as "skillLevel",
          p.age_min as "ageMin",
          p.age_max as "ageMax",
          p.description,
          p.skill_requirements as "skillRequirements",
          p.is_active as "isActive",
          p.archived,
          p.created_at as "createdAt",
          p.updated_at as "updatedAt",
          sf.id as "schedulingFormId",
          sf.is_active as "schedulingFormActive",
          sf.enroll_sites as "schedulingFormEnrollSites"
        FROM program p
        LEFT JOIN ${schema.programsTable} pr ON p.${schema.programFkColumn} = pr.id
        LEFT JOIN scheduling_form sf ON sf.program_id = p.id AND sf.deleted_at IS NULL
        WHERE p.${schema.programFkColumn} = $1
      `
      const params = [programsId]
      if (archived === 'true') {
        query += ' AND p.archived = $2'
        params.push(true)
      } else if (archived === 'false') {
        query += ' AND p.archived = $2'
        params.push(false)
      }
      query += ' ORDER BY p.archived ASC, p.display_name ASC'
      const result = await pool.query(query, params)
      res.json({ success: true, data: result.rows })
    } catch (err) {
      console.error('[programs] list class-events:', err)
      res.status(500).json({ success: false, message: 'Failed to load classes and events' })
    }
  })

  app.post('/api/admin/programs/:programsId/class-events', async (req, res) => {
    try {
      const { error, value } = classEventSchema.validate(req.body)
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message })
      }
      await ensureProgramsSchedulingSchema(pool)
      await ensurePrimaryDisciplineTagColumn(pool)
      await ensureProgramPricingColumns(pool)
      const schema = await resolveProgramsSchema(pool)
      const programsId = Number(req.params.programsId)
      if (!Number.isFinite(programsId)) {
        return res.status(400).json({ success: false, message: 'Invalid program id' })
      }

      const progCheck = await pool.query(
        `SELECT id, name FROM ${schema.programsTable} WHERE id = $1 AND archived = FALSE LIMIT 1`,
        [programsId],
      )
      if (progCheck.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Program not found' })
      }

      const facilityId = await getFacilityId(pool)
      if (!facilityId) return res.status(500).json({ success: false, message: 'No facility found' })

      const enumCheckResult = await pool.query(`
        SELECT unnest(enum_range(NULL::program_category))::text as enum_value
      `)
      const availableEnumValues = enumCheckResult.rows.map((row) => row.enum_value)
      const programName = progCheck.rows[0].name
      let categoryEnum =
        availableEnumValues.find((v) => v === programName) ??
        availableEnumValues[0] ??
        'GYMNASTICS'

      const colCheck = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'program'
          AND column_name IN ('programs_id', 'category_id', 'level_id')
      `)
      const programCols = new Set(colCheck.rows.map((r) => r.column_name))
      const fkCol = programCols.has('programs_id') ? 'programs_id' : 'category_id'

      let levelId = null
      if (value.skillLevel && programCols.has('level_id')) {
        const levelResult = await pool.query(
          'SELECT id FROM skill_levels WHERE name = $1 AND category_id = $2 LIMIT 1',
          [value.skillLevel, programsId],
        )
        if (levelResult.rows.length > 0) levelId = levelResult.rows[0].id
      }

      const baseName = value.displayName.toUpperCase().replace(/\s+/g, '_')
      const insertCols = ['facility_id', 'category', fkCol, 'name', 'display_name', 'skill_level']
      const insertVals = [
        facilityId,
        categoryEnum,
        programsId,
        baseName,
        value.displayName,
        value.skillLevel || null,
      ]
      const nameValueIndex = 3
      if (programCols.has('level_id')) {
        insertCols.push('level_id')
        insertVals.push(levelId)
      }
      insertCols.push('age_min', 'age_max', 'description', 'skill_requirements', 'is_active')
      insertVals.push(
        value.ageMin ?? null,
        value.ageMax ?? null,
        value.description || null,
        value.skillRequirements || null,
        value.isActive !== false,
      )

      const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ')
      const insertSql = `INSERT INTO program (${insertCols.join(', ')}) VALUES (${placeholders})
         RETURNING
           id,
           ${fkCol} as "programsId",
           ${fkCol} as "categoryId",
           name,
           display_name as "displayName",
           skill_level as "skillLevel",
           age_min as "ageMin",
           age_max as "ageMax",
           description,
           skill_requirements as "skillRequirements",
           is_active as "isActive",
           archived,
           created_at as "createdAt",
           updated_at as "updatedAt"`

      // The program table enforces UNIQUE (facility_id, category, name). The display
      // name may legitimately repeat across classes, so keep display_name as typed
      // and append a hidden numeric suffix to the internal name until the insert
      // succeeds.
      let result = null
      const maxAttempts = 50
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        insertVals[nameValueIndex] = attempt === 1 ? baseName : `${baseName}_${attempt}`
        try {
          result = await pool.query(insertSql, insertVals)
          break
        } catch (insertErr) {
          if (insertErr.code === '23505' && attempt < maxAttempts) continue
          throw insertErr
        }
      }

      const classEvent = result.rows[0]
      const formId = await createSchedulingFormForClassEvent(pool, classEvent, programsId, schema)
      if (formId) classEvent.schedulingFormId = formId

      res.json({ success: true, data: classEvent })
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'A class/event with this name already exists' })
      }
      console.error('[programs] create class-event:', err)
      res.status(500).json({ success: false, message: 'Failed to create class or event' })
    }
  })

  app.get('/api/admin/class-events/:id/scheduling-form', async (req, res) => {
    try {
      await ensureProgramsSchedulingSchema(pool)
      await ensurePrimaryDisciplineTagColumn(pool)
      await ensureProgramPricingColumns(pool)
      const schema = await resolveProgramsSchema(pool)
      if (!schema.hasSchedulingProgramLink) {
        return res.status(404).json({ success: false, message: 'Scheduling link not configured' })
      }
      let result = await pool.query(
        `SELECT id, title, is_active as "isActive" FROM scheduling_form
         WHERE program_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [req.params.id],
      )
      if (result.rows.length === 0) {
        const classRes = await pool.query(
          `SELECT p.*, p.${schema.programFkColumn} as programs_id FROM program p WHERE p.id = $1`,
          [req.params.id],
        )
        if (classRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Class/event not found' })
        }
        const row = classRes.rows[0]
        const formId = await createSchedulingFormForClassEvent(
          pool,
          {
            id: row.id,
            displayName: row.display_name,
            description: row.description,
            isActive: row.is_active,
          },
          row.programs_id,
          schema,
        )
        result = await pool.query(
          `SELECT id, title, is_active as "isActive" FROM scheduling_form WHERE id = $1`,
          [formId],
        )
      }
      res.json({ success: true, data: result.rows[0] })
    } catch (err) {
      console.error('[programs] scheduling-form:', err)
      res.status(500).json({ success: false, message: 'Failed to load scheduling form' })
    }
  })

  // Top-level programs list at /api/admin/programs-top (alias: GET /api/admin/categories in server.js)
  app.get('/api/admin/programs-top', async (req, res) => {
    try {
      await ensureProgramsSchedulingSchema(pool)
      await ensurePrimaryDisciplineTagColumn(pool)
      await ensureProgramPricingColumns(pool)
      const { ensureDiscountEngineSchema } = await import('./schema.js')
      await ensureDiscountEngineSchema(pool)
      const schema = await resolveProgramsSchema(pool)
      const { archived } = req.query
      const columnCheck = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'description'
      `, [schema.programsTable])
      const hasDescription = columnCheck.rows.length > 0
      const hasSchedulingCols = await hasProgramSchedulingColumns(pool, schema.programsTable)
      const schedCols = hasSchedulingCols
        ? `, scheduling_active as "schedulingActive",
           scheduling_enroll_sites as "schedulingEnrollSites",
           scheduling_signup_fields as "schedulingSignupFields",
           scheduling_mandate_waiver as "schedulingMandateWaiver",
           scheduling_overview_saved_at as "schedulingOverviewSavedAt"`
        : `, FALSE as "schedulingActive", NULL as "schedulingEnrollSites", NULL as "schedulingSignupFields",
           FALSE as "schedulingMandateWaiver", NULL as "schedulingOverviewSavedAt"`
      let query = `
        SELECT p.id, p.name, p.display_name as "displayName",
          ${hasDescription ? 'p.description,' : 'NULL as description,'}
          p.archived, p.created_at as "createdAt", p.updated_at as "updatedAt",
          primary_dt.id as "primarySportId",
          primary_dt.name as "primarySportName",
          p.pricing_max_slots_per_user as "pricingMaxSlotsPerUser",
          p.pricing_slot_cost_monthly_cents as "pricingSlotCostMonthlyCents",
          COALESCE(p.pricing_cost_unit, 'per_month') as "pricingCostUnit",
          COALESCE(p.pricing_cost_amount_cents, p.pricing_slot_cost_monthly_cents) as "pricingCostAmountCents",
          p.pricing_free_slots_per_user as "pricingFreeSlotsPerUser",
          p.pricing_max_free_slots_total as "pricingMaxFreeSlotsTotal",
          COALESCE(p.pricing_promo_codes, '[]'::jsonb) as "pricingPromoCodes"
          ${schedCols}
        FROM ${schema.programsTable} p
        LEFT JOIN discipline_tag primary_dt ON primary_dt.id = p.primary_discipline_tag_id
      `
      const params = []
      if (archived === 'true') {
        query += ' WHERE archived = $1'
        params.push(true)
      } else if (archived === 'false') {
        query += ' WHERE archived = $1'
        params.push(false)
      }
      query += ' ORDER BY archived ASC, display_name ASC'
      const result = await pool.query(query, params)
      res.json({ success: true, data: result.rows, programs: result.rows })
    } catch (err) {
      console.error('[programs] list top programs:', err)
      res.status(500).json({ success: false, message: 'Failed to load programs' })
    }
  })

  app.post('/api/admin/programs-top', async (req, res) => {
    try {
      const { error, value } = topProgramSchema.validate(req.body)
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message })
      }
      await ensureProgramsSchedulingSchema(pool)
      await ensurePrimaryDisciplineTagColumn(pool)
      await ensureProgramPricingColumns(pool)
      const schema = await resolveProgramsSchema(pool)
      const facilityId = await getFacilityId(pool)
      if (!facilityId) return res.status(500).json({ success: false, message: 'No facility found' })

      const columnCheck = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'description'
      `, [schema.programsTable])
      const hasDescription = columnCheck.rows.length > 0
      const hasSchedulingCols = await hasProgramSchedulingColumns(pool, schema.programsTable)
      const schedInsert = hasSchedulingCols ? ', scheduling_overview_saved_at' : ''
      const schedValues = hasSchedulingCols ? ', CURRENT_TIMESTAMP' : ''
      const schedReturn = hasSchedulingCols
        ? `, scheduling_active as "schedulingActive",
           scheduling_enroll_sites as "schedulingEnrollSites",
           scheduling_signup_fields as "schedulingSignupFields",
           scheduling_mandate_waiver as "schedulingMandateWaiver",
           scheduling_overview_saved_at as "schedulingOverviewSavedAt"`
        : ''

      const result = await pool.query(
        hasDescription
          ? `INSERT INTO ${schema.programsTable} (facility_id, name, display_name, description${schedInsert})
             VALUES ($1, $2, $3, $4${schedValues})
             RETURNING id, name, display_name as "displayName", description, archived,
               created_at as "createdAt", updated_at as "updatedAt"${schedReturn}`
          : `INSERT INTO ${schema.programsTable} (facility_id, name, display_name${schedInsert})
             VALUES ($1, $2, $3${schedValues})
             RETURNING id, name, display_name as "displayName", NULL as description, archived,
               created_at as "createdAt", updated_at as "updatedAt"${schedReturn}`,
        [
          facilityId,
          value.name.toUpperCase().replace(/\s+/g, '_'),
          value.displayName,
          ...(hasDescription ? [value.description || null] : []),
        ],
      )
      const created = result.rows[0]
      if (value.primarySportId !== undefined) {
        await setProgramPrimarySport(pool, created.id, value.primarySportId)
      }
      const primarySport = await getProgramPrimarySportFields(pool, created.id)
      res.json({ success: true, data: { ...created, ...primarySport } })
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'Program with this name already exists' })
      }
      console.error('[programs] create top program:', err)
      res.status(500).json({ success: false, message: 'Failed to create program' })
    }
  })

  app.put('/api/admin/programs-top/:id', async (req, res) => {
    try {
      const { error, value } = topProgramUpdateSchema.validate(req.body)
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message })
      }
      await ensureProgramsSchedulingSchema(pool)
      await ensurePrimaryDisciplineTagColumn(pool)
      await ensureProgramPricingColumns(pool)
      if (value.pricingCostUnit !== undefined || value.pricingSlotCostMonthlyCents !== undefined) {
        const { ensureDiscountEngineSchema } = await import('./schema.js')
        await ensureDiscountEngineSchema(pool)
      }
      const schema = await resolveProgramsSchema(pool)
      const updates = []
      const values = []
      let n = 1
      if (value.name !== undefined) {
        updates.push(`name = $${n++}`)
        values.push(value.name.toUpperCase().replace(/\s+/g, '_'))
      }
      if (value.displayName !== undefined) {
        updates.push(`display_name = $${n++}`)
        values.push(value.displayName)
      }
      if (value.description !== undefined) {
        updates.push(`description = $${n++}`)
        values.push(value.description || null)
      }
      if (value.archived !== undefined) {
        updates.push(`archived = $${n++}`)
        values.push(value.archived)
      }
      const hasSchedulingCols = await hasProgramSchedulingColumns(pool, schema.programsTable)
      if (hasSchedulingCols) {
        if (value.schedulingEnrollSites !== undefined) {
          const { normalizeEnrollSites } = await import('../scheduling/enrollSites.js')
          const enrollSites = normalizeEnrollSites(value.schedulingEnrollSites, false)
          updates.push(`scheduling_enroll_sites = $${n++}`)
          values.push(enrollSites)
          updates.push(`scheduling_active = $${n++}`)
          values.push(enrollSites.length > 0)
        } else if (value.schedulingActive !== undefined) {
          const { normalizeEnrollSites } = await import('../scheduling/enrollSites.js')
          const enrollSites = normalizeEnrollSites(null, value.schedulingActive)
          updates.push(`scheduling_active = $${n++}`)
          values.push(value.schedulingActive)
          updates.push(`scheduling_enroll_sites = $${n++}`)
          values.push(enrollSites)
        }
        if (value.schedulingSignupFields !== undefined) {
          updates.push(`scheduling_signup_fields = $${n++}`)
          values.push(
            value.schedulingSignupFields == null
              ? null
              : JSON.stringify(value.schedulingSignupFields),
          )
        }
        if (value.schedulingMandateWaiver !== undefined) {
          updates.push(`scheduling_mandate_waiver = $${n++}`)
          values.push(value.schedulingMandateWaiver)
        }
        if (value.markOverviewSaved) {
          updates.push(`scheduling_overview_saved_at = COALESCE(scheduling_overview_saved_at, CURRENT_TIMESTAMP)`)
        }
      }
      if (value.pricingMaxSlotsPerUser !== undefined) {
        updates.push(`pricing_max_slots_per_user = $${n++}`)
        values.push(value.pricingMaxSlotsPerUser)
      }
      if (value.pricingSlotCostMonthlyCents !== undefined) {
        updates.push(`pricing_slot_cost_monthly_cents = $${n++}`)
        values.push(value.pricingSlotCostMonthlyCents)
        updates.push(`pricing_cost_amount_cents = $${n++}`)
        values.push(value.pricingSlotCostMonthlyCents)
      }
      if (value.pricingCostUnit !== undefined) {
        updates.push(`pricing_cost_unit = $${n++}`)
        values.push(value.pricingCostUnit)
      }
      if (value.pricingFreeSlotsPerUser !== undefined) {
        updates.push(`pricing_free_slots_per_user = $${n++}`)
        values.push(value.pricingFreeSlotsPerUser)
      }
      if (value.pricingMaxFreeSlotsTotal !== undefined) {
        updates.push(`pricing_max_free_slots_total = $${n++}`)
        values.push(value.pricingMaxFreeSlotsTotal)
      }
      if (value.pricingPromoCodes !== undefined) {
        const { ensureDiscountEngineSchema } = await import('./schema.js')
        await ensureDiscountEngineSchema(pool)
        updates.push(`pricing_promo_codes = $${n++}::jsonb`)
        values.push(
          JSON.stringify(
            (value.pricingPromoCodes || [])
              .map((c) => String(c).trim().toUpperCase())
              .filter(Boolean),
          ),
        )
      }
      const hasPricingUpdate =
        value.pricingMaxSlotsPerUser !== undefined ||
        value.pricingSlotCostMonthlyCents !== undefined ||
        value.pricingCostUnit !== undefined ||
        value.pricingFreeSlotsPerUser !== undefined ||
        value.pricingMaxFreeSlotsTotal !== undefined ||
        value.pricingPromoCodes !== undefined
      if (updates.length === 0 && value.primarySportId === undefined && !hasPricingUpdate) {
        return res.status(400).json({ success: false, message: 'No fields to update' })
      }

      let row = null
      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP')
        values.push(req.params.id)
        const returnSched = hasSchedulingCols
          ? `, scheduling_active as "schedulingActive",
             scheduling_enroll_sites as "schedulingEnrollSites",
             scheduling_signup_fields as "schedulingSignupFields",
             scheduling_mandate_waiver as "schedulingMandateWaiver",
             scheduling_overview_saved_at as "schedulingOverviewSavedAt"`
          : ''
        const result = await pool.query(
          `UPDATE ${schema.programsTable} SET ${updates.join(', ')} WHERE id = $${n}
           RETURNING id, name, display_name as "displayName", description, archived${returnSched}`,
          values,
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Program not found' })
        }
        row = result.rows[0]
        if (hasSchedulingCols && (value.schedulingActive !== undefined || value.schedulingEnrollSites !== undefined)) {
          const { normalizeEnrollSites } = await import('../scheduling/enrollSites.js')
          const enrollSites =
            value.schedulingEnrollSites !== undefined
              ? normalizeEnrollSites(value.schedulingEnrollSites, false)
              : normalizeEnrollSites(null, value.schedulingActive)
          await pool.query(
            `UPDATE scheduling_form
             SET is_active = $1, enroll_sites = $2, updated_at = CURRENT_TIMESTAMP
             WHERE programs_id = $3 AND deleted_at IS NULL`,
            [enrollSites.length > 0, enrollSites, req.params.id],
          )
        }
      } else {
        const exists = await pool.query(
          `SELECT id FROM ${schema.programsTable} WHERE id = $1`,
          [req.params.id],
        )
        if (exists.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Program not found' })
        }
      }

      if (value.primarySportId !== undefined) {
        try {
          await setProgramPrimarySport(pool, Number(req.params.id), value.primarySportId)
        } catch (sportErr) {
          const status = sportErr.statusCode === 400 ? 400 : 500
          return res.status(status).json({
            success: false,
            message: sportErr.message || 'Failed to set primary sport',
          })
        }
      }

      if (!row) {
        const fetch = await pool.query(
          `SELECT id, name, display_name as "displayName", description, archived,
            pricing_max_slots_per_user, pricing_slot_cost_monthly_cents, pricing_free_slots_per_user,
            pricing_max_free_slots_total
           FROM ${schema.programsTable} WHERE id = $1`,
          [req.params.id],
        )
        row = {
          ...fetch.rows[0],
          ...mapProgramPricingFields(fetch.rows[0]),
        }
      } else {
        const pricingFetch = await pool.query(
          `SELECT pricing_max_slots_per_user, pricing_slot_cost_monthly_cents, pricing_free_slots_per_user,
                  pricing_max_free_slots_total
           FROM ${schema.programsTable} WHERE id = $1`,
          [req.params.id],
        )
        row = { ...row, ...mapProgramPricingFields(pricingFetch.rows[0] ?? {}) }
      }
      const primarySport = await getProgramPrimarySportFields(pool, req.params.id)
      res.json({ success: true, data: { ...row, ...primarySport } })
    } catch (err) {
      console.error('[programs] update top program:', err)
      res.status(500).json({ success: false, message: 'Failed to update program' })
    }
  })

  app.post('/api/admin/programs-top/:id/pricing/reset-classes', async (req, res) => {
    try {
      await ensureProgramPricingColumns(pool)
      const programsId = Number(req.params.id)
      const resetCount = await resetAllClassesPricingToProgram(pool, programsId)
      res.json({ success: true, resetCount })
    } catch (err) {
      console.error('[programs] reset program class pricing:', err)
      res.status(500).json({ success: false, message: 'Failed to reset class pricing' })
    }
  })

  app.patch('/api/admin/programs-top/:id/archive', async (req, res) => {
    try {
      await ensureProgramsSchedulingSchema(pool)
      await ensurePrimaryDisciplineTagColumn(pool)
      await ensureProgramPricingColumns(pool)
      const schema = await resolveProgramsSchema(pool)
      const archived = Boolean(req.body.archived)
      const result = await pool.query(
        `UPDATE ${schema.programsTable} SET archived = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING id`,
        [archived, req.params.id],
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Program not found' })
      }
      res.json({ success: true, message: archived ? 'Program archived' : 'Program restored' })
    } catch (err) {
      console.error('[programs] archive top program:', err)
      res.status(500).json({ success: false, message: 'Failed to archive program' })
    }
  })

  app.delete('/api/admin/programs-top/:id', async (req, res) => {
    try {
      await ensureProgramsSchedulingSchema(pool)
      const result = await deleteTopProgramCascade(pool, Number(req.params.id))
      if (!result.found) {
        return res.status(404).json({ success: false, message: 'Program not found' })
      }
      res.json({
        success: true,
        message:
          result.deletedClasses > 0
            ? `Program and ${result.deletedClasses} class(es) deleted`
            : 'Program deleted',
      })
    } catch (err) {
      console.error('[programs] delete top program:', err)
      res.status(500).json({ success: false, message: 'Failed to delete program' })
    }
  })

  // ============================================================
  // Discipline tags (global, searchable; associated at program level)
  // ============================================================

  app.get('/api/admin/discipline-tags', async (req, res) => {
    try {
      await ensureDisciplineTagsSchema(pool)
      const result = await pool.query(
        'SELECT id, name, sort_order FROM discipline_tag ORDER BY sort_order, name',
      )
      res.json({ success: true, data: result.rows.map(mapDisciplineTagRow) })
    } catch (err) {
      console.error('[programs] list discipline tags:', err)
      res.status(500).json({ success: false, message: 'Failed to load discipline tags' })
    }
  })

  app.post('/api/admin/discipline-tags', async (req, res) => {
    try {
      const { error, value } = disciplineTagSchema.validate(req.body)
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message })
      }
      await ensureDisciplineTagsSchema(pool)
      const facilityId = await getFacilityId(pool)
      const maxSort = await pool.query(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM discipline_tag',
      )
      const result = await pool.query(
        `INSERT INTO discipline_tag (facility_id, name, sort_order)
         VALUES ($1, $2, $3)
         RETURNING id, name, sort_order`,
        [facilityId, value.name, Number(maxSort.rows[0].next)],
      )
      res.json({ success: true, data: mapDisciplineTagRow(result.rows[0]) })
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'A tag with this name already exists' })
      }
      console.error('[programs] create discipline tag:', err)
      res.status(500).json({ success: false, message: 'Failed to create discipline tag' })
    }
  })

  app.put('/api/admin/discipline-tags/:id', async (req, res) => {
    try {
      const { error, value } = disciplineTagSchema.validate(req.body)
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message })
      }
      await ensureDisciplineTagsSchema(pool)
      const result = await pool.query(
        `UPDATE discipline_tag SET name = $1, updated_at = now()
         WHERE id = $2
         RETURNING id, name, sort_order`,
        [value.name, req.params.id],
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Discipline tag not found' })
      }
      res.json({ success: true, data: mapDisciplineTagRow(result.rows[0]) })
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'A tag with this name already exists' })
      }
      console.error('[programs] update discipline tag:', err)
      res.status(500).json({ success: false, message: 'Failed to update discipline tag' })
    }
  })

  app.delete('/api/admin/discipline-tags/:id', async (req, res) => {
    try {
      await ensureDisciplineTagsSchema(pool)
      const schema = await resolveProgramsSchema(pool)
      const tagId = Number(req.params.id)
      if (!Number.isFinite(tagId)) {
        return res.status(400).json({ success: false, message: 'Invalid tag id' })
      }

      const isActiveCol = await pool.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = $1 AND column_name = 'is_active' LIMIT 1`,
        [schema.programsTable],
      )
      const activeProgramClause =
        isActiveCol.rows.length > 0 ? 'AND COALESCE(pc.is_active, TRUE) = TRUE' : ''

      const inUse = await pool.query(
        `SELECT pc.display_name AS "displayName"
         FROM program_discipline_tag pdt
         JOIN ${schema.programsTable} pc ON pc.id = pdt.programs_id
         WHERE pdt.tag_id = $1
           AND pc.archived = FALSE
           ${activeProgramClause}
         ORDER BY pc.display_name`,
        [tagId],
      )

      if (inUse.rows.length > 0) {
        const programNames = inUse.rows.map((row) => row.displayName)
        return res.status(409).json({
          success: false,
          message: `This tag is still assigned to active programs (${programNames.join(', ')}). Remove it from those programs first.`,
          programs: programNames,
        })
      }

      const result = await pool.query('DELETE FROM discipline_tag WHERE id = $1 RETURNING id', [tagId])
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Discipline tag not found' })
      }
      res.json({ success: true, message: 'Discipline tag deleted' })
    } catch (err) {
      console.error('[programs] delete discipline tag:', err)
      res.status(500).json({ success: false, message: 'Failed to delete discipline tag' })
    }
  })

  app.get('/api/admin/programs-top/:id/discipline-tags', async (req, res) => {
    try {
      await ensureDisciplineTagsSchema(pool)
      const result = await pool.query(
        `SELECT d.id, d.name, d.sort_order
         FROM program_discipline_tag pdt
         JOIN discipline_tag d ON d.id = pdt.tag_id
         WHERE pdt.programs_id = $1
         ORDER BY d.sort_order, d.name`,
        [req.params.id],
      )
      res.json({ success: true, data: result.rows.map(mapDisciplineTagRow) })
    } catch (err) {
      console.error('[programs] list program discipline tags:', err)
      res.status(500).json({ success: false, message: 'Failed to load program discipline tags' })
    }
  })

  app.post('/api/admin/programs-top/:id/discipline-tags/:tagId', async (req, res) => {
    try {
      const programsId = Number(req.params.id)
      const tagId = Number(req.params.tagId)
      if (!Number.isFinite(programsId) || !Number.isFinite(tagId)) {
        return res.status(400).json({ success: false, message: 'Invalid program or tag id' })
      }
      await ensureDisciplineTagsSchema(pool)
      await ensurePrimaryDisciplineTagColumn(pool)
      const schema = await resolveProgramsSchema(pool)
      const prog = await pool.query(
        `SELECT primary_discipline_tag_id FROM ${schema.programsTable} WHERE id = $1`,
        [programsId],
      )
      if (prog.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Program not found' })
      }
      if (Number(prog.rows[0].primary_discipline_tag_id) === tagId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot add the primary sport as an additional tag',
        })
      }
      await pool.query(
        `INSERT INTO program_discipline_tag (programs_id, tag_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [programsId, tagId],
      )
      res.json({ success: true, message: 'Tag linked to program' })
    } catch (err) {
      console.error('[programs] link discipline tag:', err)
      res.status(500).json({ success: false, message: 'Failed to link discipline tag' })
    }
  })

  app.delete('/api/admin/programs-top/:id/discipline-tags/:tagId', async (req, res) => {
    try {
      await ensureDisciplineTagsSchema(pool)
      await pool.query(
        'DELETE FROM program_discipline_tag WHERE programs_id = $1 AND tag_id = $2',
        [req.params.id, req.params.tagId],
      )
      res.json({ success: true, message: 'Tag unlinked from program' })
    } catch (err) {
      console.error('[programs] unlink discipline tag:', err)
      res.status(500).json({ success: false, message: 'Failed to unlink discipline tag' })
    }
  })

  // Consolidate duplicate class rows (reverse the legacy physical split): merge
  // program rows sharing a parent + display name back into one class/form.
  // Idempotent. Never deletes scheduling data.
  app.post('/api/admin/programs/consolidate', async (req, res) => {
    try {
      await ensureProgramsSchedulingSchema(pool)
      const parentProgramId = req.body?.parentProgramId != null ? Number(req.body.parentProgramId) : null
      const programId = req.body?.programId != null ? Number(req.body.programId) : null
      const stats = await consolidateClasses(pool, { parentProgramId, programId })
      res.json({ success: true, data: stats })
    } catch (err) {
      console.error('[programs] consolidate classes:', err)
      res.status(500).json({ success: false, message: 'Failed to consolidate classes' })
    }
  })
}
