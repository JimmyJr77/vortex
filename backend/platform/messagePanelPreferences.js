const defaults = { filesVisible: true, eventsVisible: true }

export async function getMessagePanelPreferences(pool, facilityId, userId) {
  const result = await pool.query(
    `SELECT files_visible AS "filesVisible", events_visible AS "eventsVisible"
     FROM coaching.message_panel_preference WHERE facility_id = $1 AND user_id = $2`,
    [facilityId, userId],
  )
  return result.rows[0] ?? defaults
}

export async function updateMessagePanelPreferences(pool, facilityId, userId, patch) {
  const keys = Object.keys(patch ?? {})
  if (!keys.length || keys.some((key) => !Object.hasOwn(defaults, key) || typeof patch[key] !== 'boolean')) {
    const error = new Error('Provide filesVisible and/or eventsVisible as booleans.')
    error.statusCode = 400
    throw error
  }
  const result = await pool.query(
    `INSERT INTO coaching.message_panel_preference (facility_id, user_id, files_visible, events_visible)
     VALUES ($1, $2, COALESCE($3, TRUE), COALESCE($4, TRUE))
     ON CONFLICT (facility_id, user_id) DO UPDATE SET
       files_visible = COALESCE($3, coaching.message_panel_preference.files_visible),
       events_visible = COALESCE($4, coaching.message_panel_preference.events_visible),
       updated_at = now()
     RETURNING files_visible AS "filesVisible", events_visible AS "eventsVisible"`,
    [facilityId, userId, patch.filesVisible ?? null, patch.eventsVisible ?? null],
  )
  return result.rows[0]
}
