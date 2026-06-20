import { useCallback, useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  adminFetchMemberPricingSummary,
  type MemberPricingSummary,
  type SignupOrderPreview,
} from '../../utils/schedulingApi'

interface Props {
  memberId: number | null
  memberLabel: string
  onClose: () => void
}

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`
}

function PricingBody({ preview }: { preview: SignupOrderPreview }) {
  if (!preview.hasPricing && preview.existingClasses.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        No class registrations or pricing configured for this member.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {preview.existingClasses.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Class registrations</h4>
          <ul className="space-y-2">
            {preview.existingClasses.map((item) => (
              <li
                key={item.id ?? `${item.formId}-${item.slotLabel}`}
                className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
              >
                <p className="font-medium text-gray-900">{item.formTitle}</p>
                <p className="text-gray-600">
                  {item.categoryName}
                  {item.slotLabel ? ` — ${item.slotLabel}` : ''}
                </p>
                {item.status === 'waitlisted' && (
                  <p className="text-xs text-amber-700 mt-1">Waitlisted</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.formSummaries.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Monthly costs</h4>
          <ul className="space-y-3">
            {preview.formSummaries.map((summary) => (
              <li
                key={summary.formId}
                className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm"
              >
                <p className="font-semibold text-gray-900">{summary.formTitle}</p>
                {summary.pricingAfter ? (
                  <ul className="mt-2 space-y-1 text-gray-700">
                    <li>
                      {summary.totalSlotCount} slot{summary.totalSlotCount === 1 ? '' : 's'} enrolled
                    </li>
                    <li>
                      List price: {formatMoney(summary.pricingAfter.nonDiscountedMonthly)}/mo
                    </li>
                    {summary.pricingAfter.discountMonthly > 0 && (
                      <li className="text-green-700">
                        Free-slot discount: -{formatMoney(summary.pricingAfter.discountMonthly)}/mo
                      </li>
                    )}
                    <li className="font-semibold text-gray-900">
                      Estimated: {formatMoney(summary.pricingAfter.discountedMonthly)}/mo
                    </li>
                  </ul>
                ) : (
                  <p className="text-gray-500 mt-1">No pricing configured</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.hasPricing && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <div className="flex justify-between font-semibold text-gray-900">
            <span>Estimated monthly total</span>
            <span>{formatMoney(preview.estimatedMonthlyTotal)}/mo</span>
          </div>
          {preview.totalDiscountMonthly > 0 && (
            <p className="text-green-700 text-xs mt-1">
              Includes {formatMoney(preview.totalDiscountMonthly)}/mo in free-slot discounts
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 italic">{preview.disclaimer}</p>
    </div>
  )
}

const MemberPricingModal = ({ memberId, memberLabel, onClose }: Props) => {
  const [data, setData] = useState<MemberPricingSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (memberId == null) return
    setLoading(true)
    setError(null)
    try {
      setData(await adminFetchMemberPricingSummary(memberId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pricing')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    if (memberId != null) void load()
  }, [memberId, load])

  if (memberId == null) return null

  const storedDiscounts = (data?.signupRows ?? []).flatMap((row) => {
    const applied = row.pricingBreakdown?.line?.applied ?? []
    return applied.map((a) => ({
      key: `${row.id}-${a.ruleId}`,
      classLabel: `${row.formTitle} — ${row.categoryName}`,
      name: a.name,
      amountCents: a.amountCents,
    }))
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Registrations &amp; pricing</h3>
            <p className="text-sm text-gray-500">{memberLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading && (
            <div className="py-12 flex justify-center text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
          {error && !loading && (
            <p className="text-sm text-red-600 py-4">{error}</p>
          )}
          {data && !loading && (
            <>
              <PricingBody preview={data.preview} />
              {storedDiscounts.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    Discounts recorded at signup
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {storedDiscounts.map((d) => (
                      <li key={d.key} className="flex justify-between gap-3 text-green-800">
                        <span className="min-w-0">
                          <span className="font-medium">{d.name}</span>
                          <span className="text-gray-500 text-xs block truncate">{d.classLabel}</span>
                        </span>
                        <span className="shrink-0">-{formatMoney(d.amountCents / 100)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MemberPricingModal
