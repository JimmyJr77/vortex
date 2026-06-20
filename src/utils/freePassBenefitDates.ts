export interface BenefitDateRange {
  startDate: string | null
  endDate: string | null
}

export function benefitDatesFromConfig(config: Record<string, unknown> | undefined): BenefitDateRange {
  const startRaw = config?.benefit_start_date
  const endRaw = config?.benefit_end_date
  const startDate =
    typeof startRaw === 'string' && startRaw.trim() ? startRaw.trim().slice(0, 10) : null
  const endDate = typeof endRaw === 'string' && endRaw.trim() ? endRaw.trim().slice(0, 10) : null
  return { startDate, endDate }
}

export function mergeBenefitDatesConfig(
  config: Record<string, unknown> | undefined,
  dates: BenefitDateRange,
): Record<string, unknown> {
  const next = { ...(config ?? {}) }
  const start = dates.startDate?.trim().slice(0, 10) ?? null
  const end = dates.endDate?.trim().slice(0, 10) ?? null

  if (start) {
    next.benefit_start_date = start
    next.benefit_end_date = end && end >= start ? end : start
  } else {
    delete next.benefit_start_date
    delete next.benefit_end_date
  }
  return next
}

export function describeBenefitDateRange(config: Record<string, unknown> | undefined): string | null {
  const { startDate, endDate } = benefitDatesFromConfig(config)
  if (!startDate) return null
  const through = endDate && endDate !== startDate ? endDate : null
  return through ? `${startDate} – ${through}` : startDate
}
