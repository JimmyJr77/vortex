import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'node:url'
import { id, inputError } from './common.js'
import { resolveSlotActiveDates } from '../scheduling/slotActiveDates.js'
import { scheduleSignupCountSql } from '../scheduling/scheduleCapacity.js'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const dayIndex = row => row.datesTbd || row.dayOfWeek == null ? 7 : (Number(row.dayOfWeek) + 6) % 7
const byTime = (a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime)
  || a.className.localeCompare(b.className) || a.programName.localeCompare(b.programName) || a.slotId - b.slotId

export async function loadScheduleExport(db, facilityId, now = new Date()) {
  const facility = (await db.query(`SELECT name,COALESCE(NULLIF(timezone,''),'America/New_York') AS timezone,
    ($2::timestamptz AT TIME ZONE COALESCE(NULLIF(timezone,''),'America/New_York'))::date::text AS today
    FROM facility WHERE id=$1`, [id(facilityId, 'facility'), now])).rows[0]
  if (!facility) throw inputError('Facility not found.', 404)
  // Export the complete active catalog, never the paginated roster or member details.
  const { rows } = await db.query(`SELECT p.id AS "classId",COALESCE(p.display_name,p.name) AS "className",
    COALESCE(pr.display_name,pr.name,'Unassigned program') AS "programName",g.id AS "groupId",ts.id AS "slotId",
    COALESCE(EXTRACT(DOW FROM ts.specific_date)::int,ts.day_of_week) AS "dayOfWeek",
    ts.specific_date::text AS "specificDate",ts.week_letter AS "weekLetter",ts.schedule_mode AS "scheduleMode",
    ts.start_time::text AS "startTime",ts.end_time::text AS "endTime",
    ts.active_start::text AS slot_start,ts.active_end::text AS slot_end,ts.dates_tbd AS slot_tbd,
    g.active_start::text AS group_start,g.active_end::text AS group_end,g.dates_tbd AS group_tbd,
    g.offering_id,g.inherits_offering_dates,o.start_date::text AS offering_start,o.end_date::text AS offering_end,
    f.start_date::text AS form_start,f.end_date::text AS form_end,g.max_participants AS capacity,
    ${scheduleSignupCountSql('g.id')} AS enrolled,
    pending_registration_holds(g.id) AS reserved
    FROM program p JOIN facility loc ON loc.id=p.facility_id
    LEFT JOIN programs pr ON pr.id=p.programs_id AND pr.facility_id=p.facility_id
    JOIN scheduling_form f ON f.program_id=p.id AND f.is_active AND f.deleted_at IS NULL
    JOIN scheduling_slot_group g ON g.form_id=f.id AND g.is_active
    JOIN scheduling_time_slot ts ON ts.slot_group_id=g.id AND ts.form_id=f.id AND ts.is_active
    LEFT JOIN scheduling_offering o ON o.id=g.offering_id
    WHERE p.facility_id=$1 AND p.is_active AND p.archived IS NOT TRUE
      AND pr.archived IS NOT TRUE AND (pr.id IS NULL OR pr.is_active)
      AND (g.offering_id IS NULL OR o.is_selected)
    ORDER BY p.id,g.id,ts.id`, [facilityId])
  const schedules = rows.map(({ slot_start, slot_end, slot_tbd, group_start, group_end, group_tbd,
    offering_id, inherits_offering_dates, offering_start, offering_end, form_start, form_end, ...row }) => {
    const dates = resolveSlotActiveDates({
      active_start: slot_start ?? group_start,
      active_end: slot_end ?? group_end,
      dates_tbd: slot_tbd || group_tbd,
      offering_id, inherits_offering_dates,
    }, { start_date: form_start, end_date: form_end }, new Map([
      [Number(offering_id), { start_date: offering_start, end_date: offering_end }],
    ]))
    return { ...row, activeStart: dates.activeStart, activeEnd: dates.activeEnd, datesTbd: dates.datesTbd }
  }).filter(row => row.datesTbd || ((!row.activeEnd || row.activeEnd >= facility.today)
    && (!row.specificDate || (row.specificDate >= facility.today
      && (!row.activeStart || row.specificDate >= row.activeStart)
      && (!row.activeEnd || row.specificDate <= row.activeEnd)))))
  return { facilityName: facility.name, timezone: facility.timezone, asOf: facility.today,
    rows: schedules.map(row => ({ ...row, classId: Number(row.classId), groupId: Number(row.groupId), slotId: Number(row.slotId),
      capacity: Number(row.capacity), enrolled: Number(row.enrolled), reserved: Number(row.reserved),
      available: Math.max(0, Number(row.capacity) - Number(row.enrolled) - Number(row.reserved)) })) }
}

const time = value => {
  const [hour, minute] = value.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}
const clean = value => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/[\u2010-\u2015]/g, '-')
const schedule = row => [
  row.datesTbd ? 'Dates to be determined' : row.specificDate || (row.weekLetter ? `Week ${row.weekLetter}` : 'Weekly'),
  ...(!row.datesTbd && !row.specificDate && (row.activeStart || row.activeEnd) ? [`${row.activeStart || 'Open start'} to ${row.activeEnd || 'Ongoing'}`] : []),
  `Schedule #${row.groupId}`,
].join('\n')

export function scheduleExportSections(rows) {
  const byDay = days.map((name, index) => ({ name, rows: rows.filter(row => dayIndex(row) === index).sort(byTime) }))
  const undated = rows.filter(row => dayIndex(row) === 7).sort(byTime)
  if (undated.length) byDay.push({ name: 'Dates to be determined', rows: undated })
  const classes = new Map()
  for (const row of rows) {
    if (!classes.has(row.classId)) classes.set(row.classId, { name: row.className, programName: row.programName, rows: [] })
    classes.get(row.classId).rows.push(row)
  }
  const byClass = [...classes.values()].sort((a, b) => a.name.localeCompare(b.name) || a.programName.localeCompare(b.programName))
  for (const group of byClass) group.rows.sort((a, b) => dayIndex(a) - dayIndex(b) || byTime(a, b))
  return { byDay, byClass }
}

export async function scheduleExportPdf(data) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 36, bufferPages: true,
    info: { Title: 'Vortex Athletics - Class schedule', Author: 'Vortex Athletics' } })
  doc.registerFont('Schedule', fileURLToPath(new URL('../payroll/forms/fonts/NotoSans-Regular.ttf', import.meta.url)))
  const chunks = []
  const completed = new Promise((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  const left = 36, width = 540, bottom = 712
  let y = 0, view = 'Schedule by day'
  const text = (value, x, top, w, size = 9, color = '#1e293b') => doc.font('Schedule').fontSize(size).fillColor(color).text(value, x, top, { width: w, lineGap: 2 })
  const height = (value, w, size = 9) => doc.font('Schedule').fontSize(size).heightOfString(value, { width: w, lineGap: 2 })
  const header = () => {
    doc.rect(left, 30, width, 4).fill('#b91c1c')
    text('VORTEX ATHLETICS', left, 44, width, 10, '#b91c1c')
    text(view, left, 65, width, 24)
    const facility = `${clean(data.facilityName)} | As of ${data.asOf} | ${data.timezone}`
    text(facility, left, 104, width, 9, '#475569')
    y = 104 + height(facility, width) + 9
    const note = 'All active and upcoming schedules. Available = capacity - enrolled - pending reservations. Times with the same schedule number share student places.'
    text(note, left, y, width, 8, '#64748b')
    y += height(note, width, 8) + 20
  }
  const nextPage = () => { doc.addPage(); header() }
  const groupHeader = (name, columns, continued = false) => {
    const title = `${clean(name)}${continued ? ' (continued)' : ''}`
    text(title, left, y, width, 13)
    y += height(title, width, 13) + 8
    doc.rect(left, y, width, 25).fill('#f1f5f9')
    let x = left
    for (const column of columns) { text(column.label, x + 8, y + 6, column.width - 16, 8, '#475569'); x += column.width }
    y += 25
  }
  const table = (name, rows, columns, values) => {
    const headingHeight = height(clean(name), width, 13) + 33
    const cellsFor = row => values(row).map(value => String(value).split('\n').map(clean).join('\n'))
    const rowHeight = cells => Math.max(35, ...cells.map((cell, index) => height(cell, columns[index].width - 16) + 16))
    if (y + headingHeight + (rows.length ? rowHeight(cellsFor(rows[0])) : 35) > bottom) nextPage()
    groupHeader(name, columns)
    if (!rows.length) { text('No scheduled classes.', left + 8, y + 8, width - 16, 9, '#64748b'); y += 35 }
    rows.forEach((row, index) => {
      const cells = cellsFor(row), h = rowHeight(cells)
      if (y + h > bottom) { nextPage(); groupHeader(name, columns, true) }
      if (index % 2 === 1) doc.rect(left, y, width, h).fill('#f8fafc')
      let x = left
      cells.forEach((cell, i) => { text(cell, x + 8, y + 8, columns[i].width - 16, 9, i === columns.length - 1 ? row.available ? '#047857' : '#b91c1c' : '#1e293b'); x += columns[i].width })
      y += h
      doc.moveTo(left, y).lineTo(left + width, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke()
    })
    y += 20
  }
  const availability = row => `${row.available} of ${row.capacity} places\n${row.enrolled} enrolled${row.reserved ? `\n${row.reserved} reserved` : ''}`
  const { byDay, byClass } = scheduleExportSections(data.rows)
  header()
  for (const group of byDay) table(group.name, group.rows,
    [{ label: 'Time', width: 112 }, { label: 'Class / program', width: 177 }, { label: 'Schedule', width: 143 }, { label: 'Available', width: 108 }],
    row => [`${time(row.startTime)} -\n${time(row.endTime)}`, `${row.className}\n${row.programName}`, schedule(row), availability(row)])
  view = 'Schedule by class'
  nextPage()
  if (!byClass.length) text('No active class schedules are available.', left, y, width, 11, '#64748b')
  for (const group of byClass) table(`${group.name} / ${group.programName}`, group.rows,
    [{ label: 'Day', width: 110 }, { label: 'Time', width: 140 }, { label: 'Schedule', width: 182 }, { label: 'Available', width: 108 }],
    row => [days[dayIndex(row)] || 'To be determined', `${time(row.startTime)} - ${time(row.endTime)}`, schedule(row), availability(row)])
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i)
    doc.moveTo(left, 728).lineTo(left + width, 728).strokeColor('#e2e8f0').stroke()
    text(`Vortex Athletics | Availability as of ${data.asOf}`, left, 738, 400, 8, '#64748b')
    text(`Page ${i + 1} of ${range.count}`, 480, 738, 96, 8, '#64748b')
  }
  doc.end()
  return completed
}
