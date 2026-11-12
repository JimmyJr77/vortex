/** Keep schedule identities and enrollments when editing a group. Caller owns the transaction. */
export async function updateScheduleSlots(db, group, rows) {
  const existing = (await db.query(
    'SELECT * FROM scheduling_time_slot WHERE slot_group_id=$1 AND is_active=TRUE ORDER BY id FOR UPDATE', [group.id],
  )).rows
  const available = [...existing]
  const dateKey = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10)
  const sameOccurrence = (slot, row) => slot.schedule_mode === row.scheduleMode
    && (slot.week_letter ?? null) === (row.weekLetter ?? null)
    && (slot.day_of_week ?? null) === (row.dayOfWeek ?? null)
    && dateKey(slot.specific_date) === dateKey(row.specificDate)
    && String(slot.start_time).slice(0, 5) === row.startTime.slice(0, 5)
  // Reserve unchanged occurrences first so inserting/reordering days cannot steal their IDs.
  const assignments = rows.map(row => {
    const index = available.findIndex(slot => sameOccurrence(slot, row))
    return index < 0 ? null : available.splice(index, 1)[0]
  })
  for (let i = 0; i < rows.length; i++) assignments[i] ??= available.shift() ?? null
  const saved = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const values = [group.form_id, group.id, row.scheduleMode, row.weekLetter, row.dayOfWeek,
      row.specificDate, row.startTime, row.endTime, group.max_participants,
      row.activeStart, row.activeEnd, row.datesTbd]
    const result = assignments[i]
      ? await db.query(`UPDATE scheduling_time_slot SET form_id=$1,slot_group_id=$2,schedule_mode=$3,
          week_letter=$4,day_of_week=$5,specific_date=$6,start_time=$7,end_time=$8,max_participants=$9,
          active_start=$10,active_end=$11,dates_tbd=$12,updated_at=now() WHERE id=$13 RETURNING *`,
        [...values, assignments[i].id])
      : await db.query(`INSERT INTO scheduling_time_slot(form_id,slot_group_id,schedule_mode,week_letter,
          day_of_week,specific_date,start_time,end_time,max_participants,active_start,active_end,dates_tbd,is_active)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE) RETURNING *`, values)
    saved.push(result.rows[0])
  }
  if (available.length) {
    // A removed occurrence follows the remaining schedule, without changing status or billing.
    const removedIds = available.map(slot => slot.id)
    await db.query(`UPDATE scheduling_signup SET time_slot_id=$1
      WHERE slot_group_id=$2 AND time_slot_id=ANY($3::bigint[]) AND orphaned_at IS NULL`,
    [saved[0].id, group.id, removedIds])
    await db.query('UPDATE scheduling_time_slot SET is_active=FALSE,updated_at=now() WHERE id=ANY($1::bigint[])', [removedIds])
  }
  return saved
}
