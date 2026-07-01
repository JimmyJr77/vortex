import type { SignupOrderPreview } from '../../utils/schedulingApi'

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`
}

/**
 * Renders a full prices/discounts/fees breakdown for a scheduling order preview.
 * Extracted from SchedulingSignupEmbed so it can be reused by the member-portal
 * checkout and family billing views.
 */
export default function OrderPricingSummary({
  preview,
  compact,
  variant = 'review',
  emphasizeCombinedTotal = false,
}: {
  preview: SignupOrderPreview
  compact?: boolean
  variant?: 'review' | 'success'
  emphasizeCombinedTotal?: boolean
}) {
  if (!preview.hasPricing && !(preview.passPurchases?.length ?? 0)) return null

  const pricingHeading =
    variant === 'success' ? 'Monthly pricing summary' : 'Estimated monthly pricing'

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
      {preview.existingClasses.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
          <h5 className={`font-semibold text-black mb-3 ${compact ? 'text-sm' : 'text-base'}`}>
            Existing classes
          </h5>
          <ul className="space-y-2">
            {preview.existingClasses.map((item) => (
              <li
                key={item.id ?? `${item.formId}-${item.slotLabel}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm text-gray-700"
              >
                <div className="min-w-0">
                  {item.formTitle && (
                    <p className="font-semibold text-black">{item.formTitle}</p>
                  )}
                  {item.slotLabel && <p>{item.slotLabel}</p>}
                  {item.status === 'waitlisted' && (
                    <p className="text-xs text-amber-700 mt-1">On waitlist</p>
                  )}
                </div>
                <p className="shrink-0 text-right font-semibold text-black">
                  {item.monthlyPrice != null && item.monthlyPrice > 0
                    ? `${formatMoney(item.monthlyPrice)}/mo`
                    : 'Free'}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between font-semibold text-black">
            <span>Existing classes total</span>
            <span>{formatMoney(preview.existingMonthlyTotal)}/mo</span>
          </div>
        </div>
      )}

      {preview.formSummaries.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-700">
          <h5 className={`font-semibold text-black mb-3 ${compact ? 'text-sm' : 'text-base'}`}>
            {pricingHeading}
          </h5>

          {preview.newSignups.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Classes in this signup ({preview.newSignups.length})
              </p>
              <ul className="space-y-2">
                {preview.newSignups.map((item) => (
                  <li
                    key={item.slotKey ?? `${item.formId}-${item.slotLabel}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      {item.formTitle && (
                        <p className="font-semibold text-black">{item.formTitle}</p>
                      )}
                      {item.slotLabel && <p>{item.slotLabel}</p>}
                      {item.multiClassPassApplied && item.classesRemainingAfterEnrollment != null && (
                        <p className="text-xs text-emerald-700 mt-1">
                          Authorized classes remaining after this enrollment:{' '}
                          {item.classesRemainingAfterEnrollment}
                        </p>
                      )}
                      {item.passItems && item.passItems.length > 0 && (
                        <ul className="mt-1 text-xs text-emerald-700">
                          {item.passItems.map((p, i) => (
                            <li key={i}>
                              Free pass: {p.templateName} −{formatMoney(p.creditCents / 100)}/mo
                              {p.prorated ? ' (prorated)' : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <p className="shrink-0 text-right font-semibold text-black">
                      {item.incrementalMonthly != null && item.incrementalMonthly > 0
                        ? `+${formatMoney(item.incrementalMonthly)}/mo`
                        : 'Free'}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.passPurchases && preview.passPurchases.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Multi-class packages
              </p>
              <ul className="space-y-2">
                {preview.passPurchases.map((item) => (
                  <li
                    key={`${item.programsId}-${item.packageId}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                  >
                    <div>
                      <p className="font-semibold text-black">{item.label}</p>
                      <p className="text-xs text-gray-600">
                        {item.classCount} {item.classCount === 1 ? 'class' : 'classes'} credit
                      </p>
                    </div>
                    <p className="font-semibold text-black">{formatMoney(item.priceDollars)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="space-y-3">
            {preview.formSummaries.map((summary) => (
              <li key={summary.formId}>
                <p className="font-semibold text-black">{summary.formTitle}</p>
                {summary.pricingAfter ? (
                  <ul className="mt-1 space-y-0.5">
                    {summary.usesWeeklyTierPricing && summary.weeklyTierLabel ? (
                      <>
                        <li>
                          Program bundle ({summary.totalSlotCount}{' '}
                          {summary.totalSlotCount === 1 ? 'class' : 'classes'}):{' '}
                          {summary.weeklyTierLabel}
                        </li>
                        {summary.existingSlotCount > 0 && summary.weeklyTierBeforeLabel && (
                          <li className="text-gray-600">
                            Was: {summary.weeklyTierBeforeLabel} ({summary.existingSlotCount}{' '}
                            {summary.existingSlotCount === 1 ? 'class' : 'classes'})
                          </li>
                        )}
                      </>
                    ) : (
                      <li>
                        Slots: {summary.existingSlotCount} current
                        {summary.newSlotCount > 0
                          ? ` + ${summary.newSlotCount} new = ${summary.totalSlotCount} total`
                          : ''}
                      </li>
                    )}
                    {summary.pricingAfter.hasFreeSlots && (
                      <li>
                        Free classes remaining after signup:{' '}
                        {summary.pricingAfter.freeSlotsRemaining}
                      </li>
                    )}
                    <li>
                      Subtotal before discounts:{' '}
                      {formatMoney(summary.pricingAfter.nonDiscountedMonthly)}/mo
                    </li>
                    {summary.discountMonthly > 0 && (
                      <li className="text-green-700">
                        Free class discount: -{formatMoney(summary.discountMonthly)}/mo
                      </li>
                    )}
                    <li>
                      Total after discounts: {formatMoney(summary.pricingAfter.discountedMonthly)}/mo
                    </li>
                    {summary.incrementalMonthly > 0 && (
                      <li>
                        Added by this signup: +{formatMoney(summary.incrementalMonthly)}/mo
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="mt-1 text-gray-600">No pricing configured for this class.</p>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 pt-3 border-t border-gray-200 space-y-1">
            {preview.existingClasses.length > 0 && (
              <p>
                Current order total: {formatMoney(preview.existingMonthlyTotal)}/mo
              </p>
            )}
            {preview.newSignupMonthlyTotal > 0 && (
              <p>
                New signups add: +{formatMoney(preview.newSignupMonthlyTotal)}/mo
              </p>
            )}
            <p className="font-semibold text-black">
              Estimated total: {formatMoney(preview.estimatedMonthlyTotal)}/mo
            </p>
            {preview.totalDiscountMonthly > 0 && (
              <p className="text-green-700">
                Total discounts applied: -{formatMoney(preview.totalDiscountMonthly)}/mo
              </p>
            )}
          </div>
        </div>
      )}

      {preview.freePasses?.enabled && preview.freePasses.totalCreditCents > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm">
          <h5 className={`font-semibold text-emerald-900 mb-2 ${compact ? 'text-sm' : 'text-base'}`}>
            Free passes applied
          </h5>
          <ul className="space-y-1">
            {preview.freePasses.items.map((item, i) => (
              <li key={i} className="flex justify-between text-emerald-800">
                <span>
                  {item.templateName}
                  {item.prorated ? ' (prorated)' : ''}
                </span>
                <span>-{formatMoney(item.creditCents / 100)}/mo</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-2 border-t border-emerald-200 flex justify-between font-semibold text-emerald-900">
            <span>Pass credits</span>
            <span>-{formatMoney(preview.freePasses.totalCreditCents / 100)}/mo</span>
          </div>
        </div>
      )}

      {preview.discounts?.enabled &&
        (preview.discounts.totalDiscountCents > 0 || preview.discounts.orderDiscounts.length > 0) && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm">
            <h5 className={`font-semibold text-green-900 mb-2 ${compact ? 'text-sm' : 'text-base'}`}>
              Discounts &amp; promos applied
            </h5>
            <ul className="space-y-1">
              {preview.discounts.lines.flatMap((line) =>
                line.applied.map((applied, i) => (
                  <li key={`${line.key}-${i}`} className="flex justify-between text-green-800">
                    <span>{applied.name}</span>
                    <span>-{formatMoney(applied.amountCents / 100)}</span>
                  </li>
                )),
              )}
              {preview.discounts.orderDiscounts.map((d, i) => (
                <li key={`order-${i}`} className="flex justify-between text-green-800">
                  <span>{d.name}</span>
                  <span>-{formatMoney(d.amountCents / 100)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 pt-2 border-t border-green-200 flex justify-between font-semibold text-green-900">
              <span>Estimated after discounts</span>
              <span>{formatMoney(preview.discounts.totalCents / 100)}/mo</span>
            </div>
          </div>
        )}

      {preview.additionalFees?.enabled && preview.additionalFees.items.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm">
          <h5 className={`font-semibold text-amber-900 mb-2 ${compact ? 'text-sm' : 'text-base'}`}>
            Additional fees
          </h5>
          <ul className="space-y-1">
            {preview.additionalFees.items.map((item, i) => (
              <li key={`fee-${i}`} className="flex justify-between text-amber-900">
                <span>
                  {item.name}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                  {item.recurring ? '/mo' : ''}
                </span>
                <span>+{formatMoney(item.amountCents / 100)}</span>
              </li>
            ))}
          </ul>
          {(preview.additionalFeesOneTime ?? 0) > 0 && (
            <p className="mt-2 text-amber-800">
              One-time fees at checkout: {formatMoney(preview.additionalFeesOneTime ?? 0)}
            </p>
          )}
        </div>
      )}

      {!emphasizeCombinedTotal && (
        <div className="rounded-xl border-2 border-black bg-white px-4 py-3 flex items-center justify-between">
          <div>
            <p className={`font-display font-bold text-black ${compact ? 'text-base' : 'text-lg'}`}>
              New monthly total
            </p>
            {preview.existingClasses.length > 0 && preview.newSignupMonthlyTotal > 0 && (
              <p className="text-xs text-gray-600">
                {formatMoney(preview.existingMonthlyTotal)} existing + {formatMoney(preview.newSignupMonthlyTotal)} new
              </p>
            )}
          </div>
          <p className={`font-display font-bold text-black ${compact ? 'text-xl' : 'text-2xl'}`}>
            {formatMoney(preview.estimatedMonthlyTotal)}/mo
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500 italic">{preview.disclaimer}</p>
    </div>
  )
}
