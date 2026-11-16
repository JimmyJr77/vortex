const defaults = { filesVisible: true, eventsVisible: true, listWidth: 320, sidebarWidth: 304 }

export async function getMessagePanelPreferences(pool, facilityId, userId) {
  const result = await pool.query(
    `SELECT files_visible AS "filesVisible", events_visible AS "eventsVisible", list_width AS "listWidth", sidebar_width AS "sidebarWidth"
     FROM coaching.message_panel_preference WHERE facility_id = $1 AND user_id = $2`,
    [facilityId, userId],
  )
  return result.rows[0] ?? defaults
}

export async function updateMessagePanelPreferences(pool, facilityId, userId, patch) {
  const keys = Object.keys(patch ?? {})
  if (!keys.length || keys.some((key) => !Object.hasOwn(defaults, key) || (key === 'listWidth' || key === 'sidebarWidth'
    ? !Number.isInteger(patch[key]) || patch[key] < 240 || patch[key] > 480
    : typeof patch[key] !== 'boolean'))) {
    const error = new Error('Provide boolean visibility settings or integer panel widths between 240 and 480 pixels.')
    error.statusCode = 400
    throw error
  }
  const result = await pool.query(
    `INSERT INTO coaching.message_panel_preference (facility_id, user_id, files_visible, events_visible, list_width, sidebar_width)
     VALUES ($1, $2, COALESCE($3, TRUE), COALESCE($4, TRUE), COALESCE($5, 320), COALESCE($6, 304))
     ON CONFLICT (facility_id, user_id) DO UPDATE SET
       files_visible = COALESCE($3, coaching.message_panel_preference.files_visible),
       events_visible = COALESCE($4, coaching.message_panel_preference.events_visible),
       list_width = COALESCE($5, coaching.message_panel_preference.list_width),
       sidebar_width = COALESCE($6, coaching.message_panel_preference.sidebar_width),
       updated_at = now()
     RETURNING files_visible AS "filesVisible", events_visible AS "eventsVisible", list_width AS "listWidth", sidebar_width AS "sidebarWidth"`,
    [facilityId, userId, patch.filesVisible ?? null, patch.eventsVisible ?? null, patch.listWidth ?? null, patch.sidebarWidth ?? null],
  )
  return result.rows[0]
}
