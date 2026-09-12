/** Archive one displayed schedule occurrence, retaining its enrollment history. */
export async function archiveClassSetupSchedule(pool, req, res) {
  const classId = Number(req.params.classId)
  const slotId = Number(req.params.slotId)
  const { archived } = req.body ?? {}
  if (![classId, slotId].every((id) => Number.isSafeInteger(id) && id > 0)
      || typeof archived !== 'boolean') {
    return res.status(400).json({ success: false, message: 'A class, schedule line, and archive state are required.' })
  }
  try {
    const result = await pool.query(
      `WITH changed_slot AS (
        UPDATE scheduling_time_slot slot
          SET is_active = $3
         FROM scheduling_form form
        WHERE slot.id = $2
          AND slot.form_id = form.id
          AND form.program_id = $1
          AND form.deleted_at IS NULL
        RETURNING slot.id, slot.is_active, slot.slot_group_id
      ), changed_group AS (
        UPDATE scheduling_slot_group slot_group
           SET is_active = CASE
             WHEN $3 THEN TRUE
             WHEN NOT EXISTS (
               SELECT 1 FROM scheduling_time_slot sibling
                WHERE sibling.slot_group_id = slot_group.id
                  AND sibling.id <> $2 AND sibling.is_active = TRUE
             ) THEN FALSE
             ELSE slot_group.is_active
           END
          FROM changed_slot
         WHERE slot_group.id = changed_slot.slot_group_id
        RETURNING slot_group.id
      )
      SELECT id, is_active FROM changed_slot`,
      [classId, slotId, !archived],
    )
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Schedule line not found for this class.' })
    }
    return res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('[programs] archive schedule line:', error)
    return res.status(500).json({ success: false, message: 'Failed to update schedule line.' })
  }
}
