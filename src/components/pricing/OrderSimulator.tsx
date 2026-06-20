import { useState } from 'react'
import { Play } from 'lucide-react'
import {
  adminSimulateDiscountOrder,
  adminSimulateFreePasses,
  type FreePassBreakdown,
  type OrderDiscountBreakdown,
} from '../../utils/schedulingApi'

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-vortex-red focus:outline-none'

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const OrderSimulator = () => {
  const [classCount, setClassCount] = useState(2)
  const [priceEach, setPriceEach] = useState(100)
  const [childCount, setChildCount] = useState(1)
  const [promo, setPromo] = useState('')
  const [city, setCity] = useState('')
  const [school, setSchool] = useState('')
  const [result, setResult] = useState<OrderDiscountBreakdown | null>(null)
  const [passResult, setPassResult] = useState<FreePassBreakdown | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const lines = Array.from({ length: Math.max(1, classCount) }, (_, i) => ({
        key: `sim-${i}`,
        baseCents: Math.round(priceEach * 100),
        classOrdinal: i + 1,
        childOrdinal: Math.min(childCount, Math.floor(i / Math.max(1, Math.ceil(classCount / childCount))) + 1),
        memberCity: city || null,
        memberSchool: school || null,
      }))
      const breakdown = await adminSimulateDiscountOrder({
        promoCodes: promo.trim() ? [promo.trim()] : [],
        lines,
      })
      setResult(breakdown)
      try {
        setPassResult(
          await adminSimulateFreePasses({
            promoCodes: promo.trim() ? [promo.trim()] : [],
            lines,
          }),
        )
      } catch {
        setPassResult(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
      <h3 className="font-bold text-gray-900">Test an order</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-600"># Classes</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={classCount}
            onChange={(e) => setClassCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-600">Price each ($)</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={priceEach}
            onChange={(e) => setPriceEach(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-600"># Children</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={childCount}
            onChange={(e) => setChildCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-600">Promo code</label>
          <input type="text" className={inputClass} value={promo} onChange={(e) => setPromo(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-600">City</label>
          <input type="text" className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-600">School</label>
          <input type="text" className={inputClass} value={school} onChange={(e) => setSchool(e.target.value)} />
        </div>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
      >
        <Play className="w-4 h-4" /> {loading ? 'Calculating…' : 'Simulate'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-lg bg-white border border-gray-200 p-3 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{dollars(result.subtotalCents)}</span>
          </div>
          {result.lines.map((line, i) =>
            line.applied.length > 0 ? (
              <div key={line.key} className="pl-2 border-l-2 border-gray-100">
                <div className="text-xs text-gray-500">Class {i + 1}</div>
                {line.applied.map((a, j) => (
                  <div key={j} className="flex justify-between text-green-700">
                    <span>– {a.name}</span>
                    <span>-{dollars(a.amountCents)}</span>
                  </div>
                ))}
              </div>
            ) : null,
          )}
          {result.orderDiscounts.map((d, i) => (
            <div key={i} className="flex justify-between text-green-700">
              <span>– {d.name} (order)</span>
              <span>-{dollars(d.amountCents)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-gray-200 pt-2">
            <span className="text-gray-600">Total discount</span>
            <span className="font-medium text-green-700">-{dollars(result.totalDiscountCents)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900">
            <span>Estimated total</span>
            <span>{dollars(result.totalCents)}</span>
          </div>
        </div>
      )}

      {passResult?.enabled && passResult.totalCreditCents > 0 && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm space-y-1">
          <p className="font-semibold text-emerald-900">Free pass credits</p>
          {passResult.items.map((item, i) => (
            <div key={i} className="flex justify-between text-emerald-800">
              <span>{item.templateName}</span>
              <span>-{dollars(item.creditCents)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default OrderSimulator
