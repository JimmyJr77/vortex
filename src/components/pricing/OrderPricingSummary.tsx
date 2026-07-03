import type { ReactNode } from 'react'
import type { SignupOrderPreview } from '../../utils/schedulingApi'
import { enrollmentDisplayLine } from '../../utils/enrollmentDisplayLine'

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`
}

function formatSignedMoney(cents: number) {
  const amount = Math.abs(cents) / 100
  if (cents < 0) return `-${formatMoney(amount)}`
  if (cents > 0) return `+${formatMoney(amount)}`
  return formatMoney(0)
}

function formatMonthDay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })
}

function formatMonthYear(dateStr: string) {
  const [y, m] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function firstMonthProrationDetail(item: NonNullable<SignupOrderPreview['firstMonth']>['items'][number]) {
  if (item.remainingClasses == null) {
    return 'Schedule dates TBD — full month billed'
  }
  const classCount = Math.min(item.remainingClasses, item.classesPerMonth)
  const classPhrase = `${classCount} of ${item.classesPerMonth} classes`
  if (item.classStartsFutureMonth && item.firstBillDate) {
    const monthLabel = item.firstServicePeriodStart
      ? formatMonthYear(item.firstServicePeriodStart)
      : formatMonthYear(item.firstBillDate)
    const billStart = formatMonthDay(item.firstBillDate)
    const monthlyRate = formatMoney(item.monthlyNetCents / 100)
    if (item.proratedCents <= 0 && (item.prepaidFirstMonthCents ?? 0) > 0) {
      const prepaid = formatMoney((item.prepaidFirstMonthCents ?? 0) / 100)
      return `${classPhrase} in ${monthLabel} · ${prepaid} due now, credited ${billStart}`
    }
    if (item.proratedCents <= 0) {
      return `${classPhrase} in ${monthLabel} · full month (${monthlyRate}) billed ${billStart}`
    }
    return `${classPhrase} in ${monthLabel} · recurring billing starts ${billStart}`
  }
  return `${classPhrase} remaining this month`
}

/**
 * Renders a prices/discounts/fees breakdown for a scheduling order preview.
 * Layout: existing classes → new classes → monthly subtotal → promo code → discounts →
 * current billing cycle (fees, prorated accounts, carried forward) →
 * final monthly total → due now.
 */
export default function OrderPricingSummary({
  preview,
  compact,
  variant = 'review',
  emphasizeCombinedTotal = false,
  promoCodeSection,
}: {
  preview: SignupOrderPreview
  compact?: boolean
  variant?: 'review' | 'success'
  emphasizeCombinedTotal?: boolean
  promoCodeSection?: ReactNode
}) {
  if (!preview.hasPricing && !(preview.passPurchases?.length ?? 0)) return null

  const newClassesHeading =
    variant === 'success' ? 'Classes in this signup' : 'New classes in this signup'

  const hasExisting = preview.existingClasses.length > 0
  const monthlySubtotal = preview.existingMonthlyTotal + preview.newSignupMonthlyTotal

  const passCreditMonthly =
    preview.freePasses?.enabled && preview.freePasses.totalCreditCents > 0
      ? preview.freePasses.totalCreditCents / 100
      : 0
  const engineDiscountRows = (() => {
    if (!preview.discounts?.enabled) return []
    type Row = {
      key: string
      name: string
      amount: number
      qualifiedLabel: string | null
      nextTierHint: string | null
    }
    const grouped = new Map<string, Row>()
    const add = (
      groupKey: string,
      name: string,
      amountCents: number,
      qualifiedLabel?: string | null,
      nextTierHint?: string | null,
    ) => {
      const existing = grouped.get(groupKey)
      if (existing) {
        existing.amount += amountCents / 100
        if (!existing.qualifiedLabel && qualifiedLabel) existing.qualifiedLabel = qualifiedLabel
        if (!existing.nextTierHint && nextTierHint) existing.nextTierHint = nextTierHint
      } else {
        grouped.set(groupKey, {
          key: groupKey,
          name,
          amount: amountCents / 100,
          qualifiedLabel: qualifiedLabel ?? null,
          nextTierHint: nextTierHint ?? null,
        })
      }
    }
    for (const line of preview.discounts.lines) {
      for (const applied of line.applied) {
        add(
          `rule-${applied.ruleId}`,
          applied.name,
          applied.amountCents,
          applied.qualifiedLabel,
          applied.nextTierHint,
        )
      }
    }
    preview.discounts.orderDiscounts.forEach((d, i) => {
      add(
        d.ruleId != null ? `rule-${d.ruleId}` : `order-${i}`,
        d.name,
        d.amountCents,
        d.qualifiedLabel,
        d.nextTierHint,
      )
    })
    return [...grouped.values()]
  })()
  const engineDiscountMonthly = engineDiscountRows.reduce((sum, d) => sum + d.amount, 0)
  const totalDiscounts = passCreditMonthly + engineDiscountMonthly

  const weeklyTierNotes = preview.formSummaries.filter(
    (summary) => summary.usesWeeklyTierPricing && summary.weeklyTierLabel,
  )

  const firstMonth = preview.firstMonth?.enabled ? preview.firstMonth : null
  const carriedForward = preview.carriedForward ?? {
    enabled: true,
    items: [],
    creditsCents: 0,
    debitsCents: 0,
    totalCents: 0,
  }

  const hasAdditionalFees =
    preview.additionalFees?.enabled && (preview.additionalFees.items.length ?? 0) > 0
  const hasProratedAccounts = Boolean(firstMonth?.items.length)
  const currentCycleDueCents =
    Math.round((preview.additionalFeesOneTime ?? 0) * 100) + (firstMonth?.totalCents ?? 0)
  const additionalFeesOneTime = preview.additionalFeesOneTime ?? 0
  const proratedDueNow = (firstMonth?.totalProratedCents ?? 0) / 100
  const prepaidDueNow = (firstMonth?.totalPrepaidCents ?? 0) / 100
  const dueNowBreakdown = (() => {
    const parts: string[] = []
    if (additionalFeesOneTime > 0) parts.push(`${formatMoney(additionalFeesOneTime)} fees`)
    if (prepaidDueNow > 0) parts.push(`${formatMoney(prepaidDueNow)} first month tuition`)
    if (proratedDueNow > 0) parts.push(`${formatMoney(proratedDueNow)} prorated accounts`)
    return parts.join(' + ')
  })()
  const showCurrentBillingCycle = variant === 'review'

  return (
    <div className="mt-6 space-y-4">
      {emphasizeCombinedTotal && (
        <div className="rounded-xl border-2 border-black bg-white px-4 py-3 text-center sm:text-left">
          <p className="text-sm text-gray-600">Combined estimated total</p>
          <p className={`font-display font-bold text-black ${compact ? 'text-xl' : 'text-2xl'}`}>
            {formatMoney(preview.estimatedMonthlyTotal)}/mo
          </p>
        </div>
      )}

      {hasExisting && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
          <h5 className={`font-semibold text-black mb-3 ${compact ? 'text-sm' : 'text-base'}`}>
            Existing classes
          </h5>
          <ul className="space-y-0">
            {preview.existingClasses.map((item) => (
              <li
                key={item.id ?? `${item.formId}-${item.slotLabel}`}
                className="flex items-start justify-between gap-3 px-3 py-1 text-sm text-gray-700"
              >
                <div className="min-w-0">
                  <p className="text-black leading-snug">
                    {enrollmentDisplayLine(item)}
                  </p>
                  {item.status === 'waitlisted' && (
                    <p className="text-xs text-amber-700 mt-1">On waitlist</p>
                  )}
                </div>
                <p className="shrink-0 text-right text-black">
                  {item.monthlyPrice != null && item.monthlyPrice > 0
                    ? `${formatMoney(item.monthlyPrice)}/mo`
                    : 'Free'}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between font-semibold text-black text-sm">
            <span>Existing classes total</span>
            <span>{formatMoney(preview.existingMonthlyTotal)}/mo</span>
          </div>
        </div>
      )}

      {(preview.newSignups.length > 0 || (preview.passPurchases?.length ?? 0) > 0) && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-700">
          <h5 className={`font-semibold text-black mb-3 ${compact ? 'text-sm' : 'text-base'}`}>
            {newClassesHeading} ({preview.newSignups.length})
          </h5>

          {preview.newSignups.length > 0 && (
            <ul className="space-y-0">
              {preview.newSignups.map((item) => (
                <li
                  key={item.slotKey ?? `${item.formId}-${item.slotLabel}`}
                  className="flex items-start justify-between gap-3 px-3 py-1"
                >
                  <div className="min-w-0">
                    <p className="text-black leading-snug">
                      {enrollmentDisplayLine(item)}
                    </p>
                    {item.multiClassPassApplied && item.classesRemainingAfterEnrollment != null && (
                      <p className="text-xs text-emerald-700 mt-1">
                        Covered by class pass · {item.classesRemainingAfterEnrollment} classes
                        remaining after this enrollment
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-right text-black">
                    {item.incrementalMonthly != null && item.incrementalMonthly > 0
                      ? `+${formatMoney(item.incrementalMonthly)}/mo`
                      : 'Free'}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {weeklyTierNotes.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
              {weeklyTierNotes.map((summary) => (
                <li key={summary.formId}>
                  {summary.formTitle}: program bundle ({summary.totalSlotCount}{' '}
                  {summary.totalSlotCount === 1 ? 'class' : 'classes'}) · {summary.weeklyTierLabel}
                </li>
              ))}
            </ul>
          )}

          {preview.passPurchases && preview.passPurchases.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Multi-class packages (one-time purchase)
              </p>
              <ul className="space-y-0">
                {preview.passPurchases.map((item) => (
                  <li
                    key={`${item.programsId}-${item.packageId}`}
                    className="flex items-start justify-between gap-3 px-3 py-1"
                  >
                    <div>
                      <p className="text-black">{item.label}</p>
                      <p className="text-xs text-gray-600">
                        {item.classCount} {item.classCount === 1 ? 'class' : 'classes'} credit
                      </p>
                    </div>
                    <p className="text-black">{formatMoney(item.priceDollars)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
            {hasExisting && (
              <div className="flex justify-between font-semibold text-black">
                <span>New classes total</span>
                <span>+{formatMoney(preview.newSignupMonthlyTotal)}/mo</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-black">
              <span>Monthly subtotal{hasExisting ? ' (existing + new)' : ''}</span>
              <span>{formatMoney(monthlySubtotal)}/mo</span>
            </div>
          </div>
        </div>
      )}

      {promoCodeSection}

      {totalDiscounts > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm">
          <h5 className={`font-semibold text-green-900 mb-2 ${compact ? 'text-sm' : 'text-base'}`}>
            Discounts &amp; promos applied
          </h5>
          <ul className="space-y-1">
            {preview.freePasses?.enabled &&
              preview.freePasses.items.map((item, i) => (
                <li key={`pass-${i}`} className="flex justify-between text-green-800">
                  <span>
                    Free pass: {item.templateName}
                    {item.prorated ? ' (prorated)' : ''}
                  </span>
                  <span>-{formatMoney(item.creditCents / 100)}/mo</span>
                </li>
              ))}
            {engineDiscountRows.map((d) => (
              <li key={d.key} className="text-green-800">
                <div className="flex justify-between">
                  <span>
                    {d.name}
                    {d.qualifiedLabel ? ` (${d.qualifiedLabel})` : ''}
                  </span>
                  <span>-{formatMoney(d.amount)}</span>
                </div>
                {d.nextTierHint && (
                  <p className="mt-0.5 text-xs text-green-700">{d.nextTierHint}</p>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-2 border-t border-green-200 flex justify-between font-semibold text-green-900">
            <span>Total discounts</span>
            <span>-{formatMoney(totalDiscounts)}/mo</span>
          </div>
        </div>
      )}

      {showCurrentBillingCycle && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm">
          <h5 className={`font-semibold text-amber-950 ${compact ? 'text-sm' : 'text-base'}`}>
            Current billing cycle
          </h5>
          <p className="mt-0.5 mb-3 text-xs text-amber-800">
            Amounts due for this signup. Billing renews on the 1st of each month.
          </p>

          <div className="space-y-4">
            {hasAdditionalFees && (
              <section>
                <h6 className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-2">
                  Additional fees
                </h6>
                <ul className="space-y-1">
                  {preview.additionalFees!.items.map((item, i) => (
                    <li key={`fee-${i}`} className="flex justify-between text-amber-950">
                      <span>
                        {item.name}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                        {item.recurring ? '/mo' : ''}
                      </span>
                      <span>+{formatMoney(item.amountCents / 100)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {hasProratedAccounts && (
              <section>
                <h6 className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-2">
                  {firstMonth!.items.some((item) => item.proratedCents > 0)
                    ? 'Prorated accounts'
                    : 'Upcoming class billing'}
                </h6>
                <ul className="space-y-0">
                  {firstMonth!.items.map((item) => (
                    <li
                      key={item.slotKey}
                      className="px-3 py-1 text-amber-950"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 leading-snug">
                          {item.displayLine ?? item.formTitle ?? 'Class'}
                        </p>
                        <p className="shrink-0 text-right">
                          {formatMoney(item.proratedCents / 100)}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-amber-800">
                        {firstMonthProrationDetail(item)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h6 className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-2">
                Debits/Credits carried forward
              </h6>
              <p className="mb-2 text-xs text-amber-800">
                Adjustments from pauses and other account activity that apply to upcoming billing
                periods.
              </p>
              <div className="space-y-0 px-3 py-1 text-amber-950">
                <div className="flex justify-between">
                  <span>Credits</span>
                  <span>{formatMoney((carriedForward.creditsCents ?? 0) / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Debits</span>
                  <span>{formatMoney((carriedForward.debitsCents ?? 0) / 100)}</span>
                </div>
              </div>
              {carriedForward.items.length > 0 && (
                <ul className="mt-2 space-y-0">
                  {carriedForward.items.map((item) => (
                    <li key={item.key} className="px-3 py-1 text-amber-950">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="leading-snug">{item.label}</p>
                          {item.detail && (
                            <p className="mt-0.5 text-xs text-amber-800">{item.detail}</p>
                          )}
                        </div>
                        <p className="shrink-0 text-right">
                          {formatSignedMoney(item.amountCents)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {carriedForward.items.length > 0 && (
                <div className="mt-2 pt-2 border-t border-amber-200 flex justify-between font-semibold text-amber-950">
                  <span>Net carried forward</span>
                  <span>{formatSignedMoney(carriedForward.totalCents)}</span>
                </div>
              )}
            </section>
          </div>

          <div className="mt-3 pt-3 border-t border-amber-200 flex justify-between font-semibold text-amber-950">
            <span>Due this billing cycle</span>
            <span>{formatMoney(currentCycleDueCents / 100)}</span>
          </div>
        </div>
      )}

      {!emphasizeCombinedTotal && (
        <>
          <div className="rounded-xl border-2 border-black bg-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className={`font-display font-bold text-black ${compact ? 'text-base' : 'text-lg'}`}>
                New monthly total
              </p>
              <p className="text-xs text-gray-600">
                {formatMoney(monthlySubtotal)} subtotal
                {totalDiscounts > 0 ? ` − ${formatMoney(totalDiscounts)} discounts` : ''}
                {(preview.additionalFeesMonthly ?? 0) > 0
                  ? ` + ${formatMoney(preview.additionalFeesMonthly ?? 0)} fees`
                  : ''}
              </p>
            </div>
            <p className={`font-display font-bold text-black ${compact ? 'text-xl' : 'text-2xl'}`}>
              {formatMoney(preview.estimatedMonthlyTotal)}/mo
            </p>
          </div>

          <div>
            <div className="rounded-xl border-2 border-black bg-white px-4 py-3 flex items-center justify-between">
              <div>
                <p className={`font-display font-bold text-black ${compact ? 'text-base' : 'text-lg'}`}>
                  Due Now
                </p>
                {dueNowBreakdown && (
                  <p className="text-xs text-gray-600">{dueNowBreakdown}</p>
                )}
              </div>
              <p className={`font-display font-bold text-black ${compact ? 'text-xl' : 'text-2xl'}`}>
                {formatMoney(currentCycleDueCents / 100)}
              </p>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Enrollment fees paid to hold registration will be applied to the first month of
              enrollment.
            </p>
          </div>
        </>
      )}

      <p className="text-xs text-gray-500 italic">{preview.disclaimer}</p>
    </div>
  )
}
