import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminFetchDiscountRules } from '../../utils/schedulingApi'

interface Props {
  selectedCodes: string[]
  onChange: (codes: string[]) => void
  disabled?: boolean
}

const ProgramPromoCodesField = ({ selectedCodes, onChange, disabled = false }: Props) => {
  const [available, setAvailable] = useState<Array<{ code: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { rules } = await adminFetchDiscountRules()
      const promos = rules
        .filter((r) => r.type === 'promo_code' && r.config?.code)
        .map((r) => ({
          code: String(r.config.code).trim().toUpperCase(),
          name: r.name,
        }))
        .sort((a, b) => a.code.localeCompare(b.code))
      setAvailable(promos)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load promo codes')
      setAvailable([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedSet = useMemo(() => new Set(selectedCodes.map((c) => c.toUpperCase())), [selectedCodes])

  const toggle = (code: string) => {
    const upper = code.toUpperCase()
    if (selectedSet.has(upper)) {
      onChange(selectedCodes.filter((c) => c.toUpperCase() !== upper))
    } else {
      onChange([...selectedCodes, upper])
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-semibold text-black">Promo codes for this program</label>
        <p className="text-xs text-gray-500 mt-0.5">
          Only selected codes work when enrolling in classes under this program. Universal discounts
          (multi-child, multi-class, school, city, etc.) always apply and are not listed here.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading promo codes…</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : available.length === 0 ? (
        <p className="text-sm text-gray-500 rounded-lg border border-dashed border-gray-300 px-3 py-3">
          No promo codes yet. Create codes under Pricing → Discounts, then select them here.
        </p>
      ) : (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white">
          {available.map((promo) => (
            <label
              key={promo.code}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50 ${
                disabled ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <input
                type="checkbox"
                disabled={disabled}
                checked={selectedSet.has(promo.code)}
                onChange={() => toggle(promo.code)}
              />
              <span className="font-mono font-semibold text-gray-900">{promo.code}</span>
              <span className="text-gray-500 truncate">{promo.name}</span>
            </label>
          ))}
        </div>
      )}

      {selectedCodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedCodes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-mono font-medium text-gray-800"
            >
              {code}
            </span>
          ))}
        </div>
      )}

      {selectedCodes.length === 0 && !loading && available.length > 0 && (
        <p className="text-xs text-amber-700">
          No codes selected — promo codes will not apply to this program until you add at least one.
        </p>
      )}
    </div>
  )
}

export function normalizeProgramPromoCodes(codes: unknown): string[] {
  if (!Array.isArray(codes)) return []
  return codes.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
}

export default ProgramPromoCodesField
