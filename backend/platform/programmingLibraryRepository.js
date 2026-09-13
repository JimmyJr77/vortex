import { loadProgrammingMethodBundle, attachProgrammingMethod } from './programmingMethodProgramming.js'
import { normalizePhaseKey } from './sessionPhaseKeys.js'
import { libraryScopeId } from './coachingLibraryContext.js'

/**
 * Shared list/search repository. Generation sees only published accessible rows;
 * the existing editor explicitly includes the authenticated author's drafts.
 * Pagination is reported so a truncated search cannot establish an ExerciseGap.
 */
export async function loadProgrammingLibraryPage(pool, context, filters = {}) {
  const facilityId = libraryScopeId(context.facilityId, 'facilityId')
  const userId = libraryScopeId(context.userId, 'userId')
  const { q, category, phaseKey, groupFriendly = false, includeOwnDrafts = false, limit = 500, offset = 0 } = filters
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new RangeError('limit must be from 1 to 500')
  if (!Number.isSafeInteger(offset) || offset < 0) throw new RangeError('offset must be a nonnegative integer')
  if (typeof includeOwnDrafts !== 'boolean' || typeof groupFriendly !== 'boolean') throw new TypeError('library filters must use booleans')
  for (const [field, value] of Object.entries({ q, category })) {
    if (value != null && typeof value !== 'string') throw new TypeError(`${field} must be a string`)
  }
  const phase = phaseKey == null ? null : normalizePhaseKey(phaseKey)
  if (phaseKey != null && !phase) throw new TypeError('phaseKey must identify an existing session phase')
  const params = [facilityId, userId]
  const where = [
    'pm.facility_id = $1',
    'pm.archived = FALSE',
    includeOwnDrafts
      ? `((pm.visibility = 'facility' AND pm.is_published = TRUE) OR pm.created_by = $2)`
      : `pm.is_published = TRUE AND (pm.visibility = 'facility' OR pm.created_by = $2)`,
  ]
  if (q?.trim()) {
    params.push(`%${q.trim()}%`)
    where.push(`(pm.name ILIKE $${params.length} OR pm.definition ILIKE $${params.length} OR pm.coach_summary ILIKE $${params.length})`)
  }
  if (category) {
    params.push(category)
    where.push(`pm.category = $${params.length}`)
  }
  if (phase) {
    params.push(phase)
    where.push(`(pm.best_session_phase = $${params.length} OR $${params.length} = ANY(pm.compatible_session_phases))`)
  }
  if (groupFriendly) where.push(`(pm.workout_builder_rules->>'group_friendly')::boolean IS TRUE`)
  params.push(limit + 1, offset)
  const result = await pool.query(
    `SELECT pm.* FROM coaching.programming_method pm WHERE ${where.join(' AND ')}
     ORDER BY pm.category, pm.name, pm.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )
  const rows = result.rows.slice(0, limit)
  const bundle = await loadProgrammingMethodBundle(pool, rows.map((row) => String(row.id)))
  return {
    methods: rows.map((row) => attachProgrammingMethod(row, bundle)),
    hasMore: result.rows.length > limit,
    nextOffset: result.rows.length > limit ? offset + limit : null,
  }
}

/** Bound complete-search attempts consistently across librarians and composition. */
export async function loadPublishedProgrammingMethods(pool, context) {
  const methods = []
  let offset = 0
  for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
    const page = await loadProgrammingLibraryPage(pool, context, { offset, limit: 500 })
    methods.push(...page.methods)
    if (!page.hasMore) return { methods, searchComplete: true }
    offset = page.nextOffset
  }
  return { methods, searchComplete: false }
}
