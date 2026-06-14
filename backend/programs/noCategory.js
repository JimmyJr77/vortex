/** System-wide "No Category" scheduling category — never stored as NULL on program rows. */

export const NO_CATEGORY_NAME = 'No Category'

let cachedNoCategoryId = null

/**
 * Ensure a global scheduling_category row exists for "No Category".
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @returns {Promise<number>}
 */
export async function ensureNoCategoryCategory(db) {
  if (cachedNoCategoryId != null) return cachedNoCategoryId

  const existing = await db.query(
    `SELECT id FROM scheduling_category
     WHERE form_id IS NULL AND name = $1
     ORDER BY sort_order, id
     LIMIT 1`,
    [NO_CATEGORY_NAME],
  )
  if (existing.rows.length > 0) {
    cachedNoCategoryId = Number(existing.rows[0].id)
    return cachedNoCategoryId
  }

  const inserted = await db.query(
    `INSERT INTO scheduling_category (form_id, name, sort_order, is_active)
     VALUES (NULL, $1, -1, TRUE)
     RETURNING id`,
    [NO_CATEGORY_NAME],
  )
  cachedNoCategoryId = Number(inserted.rows[0].id)
  return cachedNoCategoryId
}

/** Map API/UI null to the concrete no-category id. */
export async function resolveSchedulingCategoryId(db, categoryId) {
  if (categoryId != null) return Number(categoryId)
  return ensureNoCategoryCategory(db)
}

export function isNoCategoryCategoryRow(row) {
  return row != null && row.form_id == null && row.name === NO_CATEGORY_NAME
}

export function resetNoCategoryCache() {
  cachedNoCategoryId = null
}
