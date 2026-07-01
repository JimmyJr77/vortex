export function formatDateOnly(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

/**
 * Resolve active date window for a slot group or time slot row.
 * When linked to an offering without explicit active dates, offering dates win over form fallback.
 */
export function resolveSlotActiveDates(slot, form, offeringById = null) {
  if (slot.dates_tbd) {
    return {
      activeStart: null,
      activeEnd: null,
      datesTbd: true,
      inheritsFormDates: false,
      inheritsOfferingDates: false,
    }
  }

  const offeringId = slot.offering_id != null ? Number(slot.offering_id) : null
  const offering = offeringId != null && offeringById ? offeringById.get(offeringId) : null
  const hasExplicitSlotDates =
    formatDateOnly(slot.active_start) != null || formatDateOnly(slot.start_date) != null

  if (offering && (slot.inherits_offering_dates || !hasExplicitSlotDates)) {
    return {
      activeStart: formatDateOnly(offering.start_date),
      activeEnd: formatDateOnly(offering.end_date),
      datesTbd: false,
      inheritsFormDates: false,
      inheritsOfferingDates: Boolean(slot.inherits_offering_dates),
    }
  }

  const activeStart =
    formatDateOnly(slot.active_start) ??
    formatDateOnly(slot.start_date) ??
    formatDateOnly(form?.start_date) ??
    null
  const activeEnd =
    formatDateOnly(slot.active_end) ??
    formatDateOnly(slot.end_date) ??
    formatDateOnly(form?.end_date) ??
    null
  const inheritsFormDates =
    !slot.active_start && !slot.start_date && Boolean(form?.start_date || form?.end_date)
  return {
    activeStart,
    activeEnd,
    datesTbd: false,
    inheritsFormDates,
    inheritsOfferingDates: false,
  }
}

/** Build offering id → row map from calendar/admin SQL rows that join scheduling_offering. */
export function buildOfferingByIdFromRows(rows) {
  const offeringById = new Map()
  for (const row of rows) {
    const id = row.offering_id ?? row.sg_offering_id
    if (id == null) continue
    const start = row.offering_start_date ?? row.start_date
    if (start == null && row.offering_end_date == null && row.end_date == null) continue
    offeringById.set(Number(id), {
      start_date: start,
      end_date: row.offering_end_date ?? row.end_date,
    })
  }
  return offeringById
}
