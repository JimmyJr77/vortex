import { ensureCoachClassAssignmentSchema } from './coachRoster.js'
import { randomUUID } from 'node:crypto'

function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

export function validateFloorPlan(plan) {
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value)
  const string = (value, max = 160) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
  const minute = (value) => Number.isInteger(value) && value >= 0 && value <= 1440
  if (!object(plan) || plan.version !== 1 || ![5, 10, 15, 30].includes(plan.increment)
    || !minute(plan.start) || !minute(plan.end) || plan.end - plan.start < 30
    || !Array.isArray(plan.locations) || plan.locations.length > 50
    || !Array.isArray(plan.classes) || plan.classes.length > 500
    || !Array.isArray(plan.blocks) || plan.blocks.length > 3000) throw invalid('Invalid floor plan settings.')
  const coachNames = (value) => Array.isArray(value) && value.length <= 30 && value.every((c) => string(c))
  const unique = (rows) => rows.every((row) => object(row) && string(row.id, 100)) && new Set(rows.map((r) => r.id)).size === rows.length
  if (![plan.locations, plan.classes, plan.blocks].every(unique)) throw invalid('Plan IDs must be unique.')
  if (!plan.locations.every((r) => string(r.name))) throw invalid('Every location needs a name.')
  if (!plan.classes.every((r) => string(r.name) && string(r.program) && coachNames(r.coaches) && Number.isInteger(r.duration) && r.duration >= 5 && r.duration <= 1440)) throw invalid('Invalid idea class.')
  const locations = new Set(plan.locations.map((r) => r.id))
  for (const b of plan.blocks) {
    if (!string(b.instanceId, 100) || !string(b.classId, 100) || !string(b.name) || !string(b.program)
      || !Number.isInteger(b.day) || b.day < 0 || b.day > 6 || !locations.has(b.locationId)
      || !minute(b.start) || !minute(b.end) || b.end - b.start < 5
      || !Number.isInteger(b.color) || b.color < 0 || b.color > 1000000
      || !coachNames(b.coaches)) throw invalid('Invalid class placement.')
  }
  return plan
}

export async function saveFloorPlan(pool, facilityId, userId, body) {
  if (!Number.isSafeInteger(body?.revision) || body.revision < 0) throw invalid('A plan revision is required.')
  const plan = validateFloorPlan(body.plan)
  const result = body.revision === 0
    ? await pool.query(`INSERT INTO public.floor_planner (facility_id, plan, updated_by)
        VALUES ($1, $2::jsonb, $3) ON CONFLICT (facility_id) DO NOTHING RETURNING plan, revision`,
      [facilityId, JSON.stringify(plan), userId])
    : await pool.query(`UPDATE public.floor_planner SET plan = $2::jsonb, revision = revision + 1,
        updated_by = $3, updated_at = now() WHERE facility_id = $1 AND revision = $4 RETURNING plan, revision`,
      [facilityId, JSON.stringify(plan), userId, body.revision])
  if (!result.rows[0]) throw invalid('Another admin saved this plan. Reload the saved plan before making further changes.', 409)
  return { ...result.rows[0], facilityId }
}

function viewId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw invalid('Invalid saved view.')
  return id
}

const VIEW_COLUMNS = 'id, name, plan, revision, selected_day AS "selectedDay", updated_at AS "updatedAt"'

export async function saveFloorPlannerView(pool, facilityId, userId, body, id = null) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 80) throw invalid('Enter a view name between 1 and 80 characters.')
  if (!Number.isInteger(body.selectedDay) || body.selectedDay < 0 || body.selectedDay > 6) throw invalid('Choose a valid day for this view.')
  const plan = validateFloorPlan(body.plan)
  if (id && (!Number.isSafeInteger(body.revision) || body.revision < 1)) throw invalid('A saved view revision is required.')
  let result
  try {
    result = id
      ? await pool.query(`UPDATE public.floor_planner_view SET name = $3, plan = $4::jsonb,
          selected_day = $5, updated_by = $6, revision = revision + 1, updated_at = now()
          WHERE facility_id = $1 AND id = $2 AND revision = $7 RETURNING ${VIEW_COLUMNS}`,
        [facilityId, viewId(id), name, JSON.stringify(plan), body.selectedDay, userId, body.revision])
      : await pool.query(`INSERT INTO public.floor_planner_view (facility_id, id, name, plan, selected_day, updated_by)
          VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING ${VIEW_COLUMNS}`,
        [facilityId, randomUUID(), name, JSON.stringify(plan), body.selectedDay, userId])
  } catch (error) {
    if (error.code === '23505') throw invalid('A view with that name already exists. Choose a different name.', 409)
    throw error
  }
  if (!result.rows[0]) throw invalid('This view was changed or deleted by another admin. Reload it before saving.', 409)
  return { ...result.rows[0], facilityId }
}

export async function deleteFloorPlannerView(pool, facilityId, id, revision) {
  if (!Number.isSafeInteger(revision) || revision < 1) throw invalid('A saved view revision is required.')
  const result = await pool.query('DELETE FROM public.floor_planner_view WHERE facility_id = $1 AND id = $2 AND revision = $3 RETURNING id', [facilityId, viewId(id), revision])
  if (!result.rows[0]) throw invalid('This view was changed or deleted by another admin. Reload it before deleting.', 409)
  return { id: result.rows[0].id }
}

export function registerFloorPlannerRoutes(app, pool, { jwtSecret, requirePermission }) {
  const can = (permission) => requirePermission(pool, jwtSecret, permission)
  const handle = (handler) => async (req, res) => {
    try { res.json({ success: true, data: await handler(req) }) }
    catch (error) {
      if (!error.status) console.error('[floor-planner]', error)
      res.status(error.status ?? 500).json({ success: false, message: error.status ? error.message : 'Unable to access Floor Planner. Please try again.' })
    }
  }
  app.get('/api/admin/floor-planner', ...can('scheduling.view'), handle(async (req) => {
    const facilityId = req.platformAuth.user.facility_id
    const result = await pool.query('SELECT plan, revision FROM public.floor_planner WHERE facility_id = $1', [facilityId])
    return { plan: null, revision: 0, ...result.rows[0], facilityId }
  }))
  app.put('/api/admin/floor-planner', ...can('scheduling.manage'), handle((req) =>
    saveFloorPlan(pool, req.platformAuth.user.facility_id, req.platformAuth.user.id, req.body)))
  app.get('/api/admin/floor-planner/views', ...can('scheduling.view'), handle(async (req) => {
    const result = await pool.query(`SELECT id, name, revision, selected_day AS "selectedDay", updated_at AS "updatedAt"
      FROM public.floor_planner_view WHERE facility_id = $1 ORDER BY lower(name), id`, [req.platformAuth.user.facility_id])
    return result.rows
  }))
  app.get('/api/admin/floor-planner/views/:id', ...can('scheduling.view'), handle(async (req) => {
    const result = await pool.query(`SELECT ${VIEW_COLUMNS} FROM public.floor_planner_view WHERE facility_id = $1 AND id = $2`, [req.platformAuth.user.facility_id, viewId(req.params.id)])
    if (!result.rows[0]) throw invalid('This saved view is no longer available.', 404)
    return { ...result.rows[0], facilityId: req.platformAuth.user.facility_id }
  }))
  app.post('/api/admin/floor-planner/views', ...can('scheduling.manage'), handle((req) =>
    saveFloorPlannerView(pool, req.platformAuth.user.facility_id, req.platformAuth.user.id, req.body)))
  app.put('/api/admin/floor-planner/views/:id', ...can('scheduling.manage'), handle((req) =>
    saveFloorPlannerView(pool, req.platformAuth.user.facility_id, req.platformAuth.user.id, req.body, req.params.id)))
  app.delete('/api/admin/floor-planner/views/:id', ...can('scheduling.manage'), handle((req) =>
    deleteFloorPlannerView(pool, req.platformAuth.user.facility_id, req.params.id, req.body?.revision)))
  app.get('/api/admin/floor-planner/coaches', ...can('scheduling.view'), handle(async (req) => {
    await ensureCoachClassAssignmentSchema(pool)
    const result = await pool.query(`SELECT au.id, au.full_name AS name,
        COALESCE(json_agg(json_build_object('programsId', a.programs_id, 'classId', a.program_id,
          'formId', a.scheduling_form_id, 'offeringId', a.scheduling_offering_id,
          'timeSlotId', a.scheduling_time_slot_id)) FILTER (WHERE a.id IS NOT NULL), '[]') AS assignments
      FROM app_user au JOIN coach_profile cp ON cp.user_id = au.id
      LEFT JOIN coach_class_assignment a ON a.coach_user_id = au.id
      WHERE au.facility_id = $1 AND au.is_active = true AND COALESCE(cp.is_active, true) = true
      GROUP BY au.id ORDER BY au.full_name`, [req.platformAuth.user.facility_id])
    return result.rows
  }))
}
