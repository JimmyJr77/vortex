type RecordValue = Record<string, unknown>
const records = (value: unknown): RecordValue[] => Array.isArray(value) ? value.filter((item): item is RecordValue => !!item && typeof item === 'object') : []
const dollars = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100) : 'Unavailable'
const hours = (value: unknown) => typeof value === 'number' ? `${(value / 60).toFixed(2)} hours` : 'Unavailable'
const reviewReasons: Record<string, string> = {
  WORKWEEK_OPEN: 'This workweek is still open. Complete and approve its time after the week ends, then rebuild the preview.',
  HISTORY_REVIEW_REQUIRED: 'Prior paid hours and premiums could not be fully verified. Reconcile the earlier payroll records before approval.',
  OVERPAYMENT_REVIEW_REQUIRED: 'Prior premiums exceed the amount calculated here. Review a payroll correction; this run will not automatically deduct the difference.',
  CONTEXT_REVIEW_REQUIRED: 'Resolve the time or payroll history issues below, then rebuild the preview.',
}

export default function WorkweekReview({ snapshot }: { snapshot: unknown }) {
  const employees = records(snapshot && typeof snapshot === 'object' ? (snapshot as RecordValue).employees : null)
  const reviews = employees.flatMap(employee => records(employee.workweekSettlements).filter(week => week.requiresWeighted === true).map(week => ({ employee, week })))
  if (!reviews.length) return null
  return <section aria-label="Weighted overtime review" className="mt-4 space-y-3">
    <h4 className="font-black text-slate-900">Weighted overtime review</h4>
    <p className="text-sm text-slate-600">Each workweek uses its combined hourly earnings and hours. The premium below covers overtime earned through this pay period, less premiums already paid.</p>
    {reviews.map(({ employee, week }) => {
      const numerator = Number(week.regularRateNumerator)
      const denominator = Number(week.regularRateDenominator)
      const rate = Number.isFinite(numerator) && denominator > 0 ? dollars(numerator / denominator) : 'Unavailable'
      const applied = week.appliedToPayroll === true
      const correctionIds = [...new Set(records(employee.workweekPaidHistory).filter(history => history.week === week.week).flatMap(history => records(history.premiums).flatMap(premium => Array.isArray(premium.correctionSettlementIds) ? premium.correctionSettlementIds : [])))]
      return <article key={`${String(employee.employeeId)}-${String(week.week)}`} className={`rounded-xl border p-4 ${applied ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'}`}>
        <h5 className="font-bold text-slate-900">{String(employee.employeeName ?? employee.name ?? `Employee ${String(employee.employeeId)}`)} · week of {String(week.week)}</h5>
        <p className="mt-1 text-sm font-semibold">{applied ? 'Applied to this payroll' : `Review required: ${String(week.status ?? 'incomplete').replaceAll('_', ' ').toLowerCase()}`}</p>
        {!applied && reviewReasons[String(week.status)] ? <p className="mt-2 text-sm text-amber-950">{reviewReasons[String(week.status)]}</p> : null}
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Full workweek hours', hours(week.workedMinutes)],
            ['Weighted hourly rate', rate],
            ['Overtime through period', hours(week.payableOvertimeMinutes)],
            ['Premium earned through period', dollars(week.earnedPremiumThroughPeriodCents)],
            ['Premium already paid', dollars(week.previouslyPaidPremiumCents)],
            ['Premium applied this run', applied ? dollars(week.premiumDueCents) : 'Not applied'],
          ].map(([label, value]) => <div key={label}><dt className="text-slate-600">{label}</dt><dd className="font-bold text-slate-900">{value}</dd></div>)}
        </dl>
        <p className="mt-3 text-xs text-slate-600">The displayed hourly rate is rounded; payroll uses the unrounded rate. The premium is additional to straight-time pay for overtime hours.</p>
        {Array.isArray(week.priorRunIds) && week.priorRunIds.length > 0 ? <p className="mt-2 text-xs text-slate-600">Prior premium records: {week.priorRunIds.map(id => `run ${String(id)}`).join(', ')}.</p> : null}
        {correctionIds.length > 0 ? <p className="mt-2 text-xs text-slate-600">Paid correction settlements included in prior hours and premiums: {correctionIds.map(id => `#${String(id)}`).join(', ')}.</p> : null}
        {Array.isArray(week.issues) && week.issues.length > 0 ? <ul className="mt-2 list-inside list-disc text-sm text-amber-950">{week.issues.map((issue, index) => <li key={index}>{String(issue)}</li>)}</ul> : null}
      </article>
    })}
  </section>
}
