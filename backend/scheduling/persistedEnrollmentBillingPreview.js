import { resolveFamilyEnrollmentPricing } from '../billing/familyEnrollmentPricing.js'
import { billingDateString } from '../billing/canonicalBillingMigrationState.js'
import { prorationForLine } from './firstMonthProration.js'

/** Recover an omitted enrollment preview from confirmed enrollments and the
 * authoritative household prices. Missing pricing must stop billing visibly;
 * it must never create a recurrence while silently omitting its first bill. */
export async function buildPersistedEnrollmentBillingPreview(db, {
  familyId, memberId, signups,
  pricingResolver = resolveFamilyEnrollmentPricing,
}) {
  const preview = { newSignups: [], discounts: { enabled: true, lines: [] },
    firstMonth: { enabled: true, items: [] } }
  const pricesByMonth = new Map()
  for (const signup of signups) {
    const source = (await db.query(`SELECT signup.*, member.family_id
      FROM scheduling_signup signup JOIN member ON member.id = signup.member_id
      WHERE signup.id = $1 AND signup.status = 'confirmed'`, [signup.signupId])).rows[0]
    if (!source || Number(source.member_id) !== Number(memberId)
      || Number(source.family_id) !== Number(familyId)
      || Number(source.form_id) !== Number(signup.formId)
      || Number(source.slot_group_id) !== Number(signup.slotGroupId)
      || String(source.time_slot_id ?? '') !== String(signup.timeSlotId ?? '')) {
      throw new Error('Initial enrollment billing requires a confirmed signup in the exact household.')
    }
    const start = billingDateString(source.enrollment_start_date ?? source.created_at)
    if (!start) throw new Error('Initial enrollment billing requires an enrollment date.')
    const periodKey = start.slice(0, 7)
    if (!pricesByMonth.has(periodKey)) pricesByMonth.set(periodKey,
      await pricingResolver(db, { familyId, periodKey, ensureSchema: false, strictPricing: true }))
    const line = pricesByMonth.get(periodKey).lines.find((item) => Number(item.signupId) === Number(source.id))
    if (!line) throw new Error(`Enrollment ${source.id} has no authoritative recurring price; its purchase preview is required.`)
    if (![line.grossCents, line.discountCents, line.netCents].every(
      (value) => Number.isSafeInteger(value) && value >= 0)
      || line.grossCents - line.discountCents !== line.netCents) {
      throw new Error(`Enrollment ${source.id} has inconsistent initial billing prices.`)
    }
    const calendarRows = (await db.query(`SELECT ts.*,
      sg.active_start AS sg_active_start, sg.active_end AS sg_active_end,
      sg.dates_tbd AS sg_dates_tbd, sg.inherits_offering_dates AS sg_inherits_offering_dates,
      sg.offering_id AS sg_offering_id, sg.is_active AS sg_is_active,
      sf.start_date AS form_start_date, sf.end_date AS form_end_date,
      sf.title AS form_title, sf.program_id, sf.programs_id, sf.is_active AS form_is_active
      FROM scheduling_time_slot ts JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
      JOIN scheduling_form sf ON sf.id = ts.form_id WHERE ts.slot_group_id = $1`,
    [source.slot_group_id])).rows
    const proration = prorationForLine(calendarRows, {
      slotGroupId: Number(source.slot_group_id),
      timeSlotId: source.time_slot_id == null ? null : Number(source.time_slot_id), fromDate: start,
    })
    const slotKey = `${signup.formId}:${signup.slotGroupId}:${signup.timeSlotId ?? 'none'}`
    // Preserve the ordinary purchase path's full first-service-month prepayment
    // for future starts; current-month purchases use calendar-based proration.
    const ratio = proration.classStartsFutureMonth ? 1 : proration.ratio
    const originalApplied = source.pricing_breakdown?.line?.applied ?? []
    const originalDiscount = originalApplied.reduce((sum, item) => sum + (Number(item.amountCents) || 0), 0)
    if (originalApplied.some((item) => item.freeDurationMonths || item.freeDurationWeeks)
      && originalDiscount !== line.discountCents) {
      throw new Error(`Enrollment ${source.id} has a duration-limited discount requiring its original purchase preview.`)
    }
    preview.newSignups.push({ slotKey, billingType: 'recurring',
      selectedPricingOptionKey: line.selectedPricingOptionKey ?? source.pricing_breakdown?.selectedPricingOptionKey ?? null })
    preview.discounts.lines.push({ key: slotKey, baseCents: line.grossCents,
      applied: originalDiscount === line.discountCents ? originalApplied : (line.discountCents ? [{ amountCents: line.discountCents }] : []) })
    preview.firstMonth.items.push({ ...proration, slotKey, ratio, enrollmentStartDate: start,
      monthlyNetCents: line.netCents, proratedCents: Math.round(line.netCents * ratio),
      prepaidFirstMonthCents: proration.classStartsFutureMonth ? line.netCents : 0 })
  }
  return preview
}
