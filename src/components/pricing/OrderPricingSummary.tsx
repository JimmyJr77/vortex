import type { SignupOrderPreview } from '../../utils/schedulingApi'

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`
}

/**
 * Renders a prices/discounts/fees breakdown for a scheduling order preview.
 * Layout: existing classes → new classes → monthly subtotal → discounts →
 * additional fees → final monthly total. Each dollar amount appears once.
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

  const newClassesHeading =
    variant === 'success' ? 'Classes in this signup' : 'New classes in this signup'

  const hasExisting = preview.existingClasses.length > 0
  const monthlySubtotal = preview.existingMonthlyTotal + preview.newSignupMonthlyTotal

  const passCreditMonthly =
    preview.freePasses?.enabled && preview.freePasses.totalCreditCents > 0
      ? preview.freePasses.totalCreditCents / 100
      : 0
  const engineDiscountLines = preview.discounts?.enabled
    ? preview.discounts.lines.flatMap((line) =>
        line.applied.map((applied, i) => ({
          key: `${line.key}-${i}`,
          name: applied.name,
          amount: applied.amountCents / 100,
        })),
      )
    : []
  const orderDiscountLines = preview.discounts?.enabled
    ? preview.discounts.orderDiscounts.map((d, i) => ({
        key: `order-${i}`,
        name: d.name,
        amount: d.amountCents / 100,
      }))
    : []
  const engineDiscountMonthly =
    engineDiscountLines.reduce((sum, d) => sum + d.amount, 0) +
    orderDiscountLines.reduce((sum, d) => sum + d.amount, 0)
  const totalDiscounts = passCreditMonthly + engineDiscountMonthly

  const weeklyTierNotes = preview.formSummaries.filter(
    (summary) => summary.usesWeeklyTierPricing && summary.weeklyTierLabel,
  )

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
                        Covered by class pass · {item.classesRemainingAfterEnrollment} classes
                        remaining after this enrollment
                      </p>
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
            {engineDiscountLines.map((d) => (
              <li key={d.key} className="flex justify-between text-green-800">
                <span>{d.name}</span>
                <span>-{formatMoney(d.amount)}</span>
              </li>
            ))}
            {orderDiscountLines.map((d) => (
              <li key={d.key} className="flex justify-between text-green-800">
                <span>{d.name}</span>
                <span>-{formatMoney(d.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-2 border-t border-green-200 flex justify-between font-semibold text-green-900">
            <span>Total discounts</span>
            <span>-{formatMoney(totalDiscounts)}/mo</span>
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
      )}

      <p className="text-xs text-gray-500 italic">{preview.disclaimer}</p>
    </div>
  )
}
