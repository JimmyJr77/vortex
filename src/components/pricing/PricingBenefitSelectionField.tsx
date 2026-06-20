import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  adminFetchBenefitSelections,
  adminFetchDiscountRules,
  adminFetchFreePasses,
  adminSaveBenefitSelections,
  type BenefitScopeLevel,
  type DiscountRule,
  type FreePassTemplate,
  type PricingBenefitSelection,
  type PricingBenefitSelectionInput,
} from '../../utils/schedulingApi'

interface BenefitOption {
  benefitType: 'discount_rule' | 'free_pass'
  benefitId: number
  name: string
  code: string | null
  kind: string
}

interface Props {
  scopeLevel: BenefitScopeLevel
  scopeRefId: number
  title?: string
  description?: string
  compact?: boolean
}

function selectionKey(benefitType: string, benefitId: number) {
  return `${benefitType}:${benefitId}`
}

function promoCodeFromRule(rule: DiscountRule): string | null {
  if (rule.type !== 'promo_code' || !rule.config?.code) return null
  return String(rule.config.code).trim().toUpperCase()
}

function promoCodeFromPass(pass: FreePassTemplate): string | null {
  const code = pass.issuance?.promo_code
  if (!code) return null
  return String(code).trim().toUpperCase()
}

const PricingBenefitSelectionField = ({
  scopeLevel,
  scopeRefId,
  title = 'Discounts & free passes',
  description = 'Select which benefits apply at this level. Auto-apply enrolls without a code; member code lets families enter the promo at signup.',
  compact = false,
}: Props) => {
  const [options, setOptions] = useState<BenefitOption[]>([])
  const [selections, setSelections] = useState<PricingBenefitSelection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rulesRes, passes, current] = await Promise.all([
        adminFetchDiscountRules(),
        adminFetchFreePasses(),
        adminFetchBenefitSelections(scopeLevel, scopeRefId),
      ])
      const ruleOptions: BenefitOption[] = rulesRes.rules
        .filter((r) => r.active && r.type !== 'free_classes')
        .map((r) => ({
          benefitType: 'discount_rule',
          benefitId: r.id,
          name: r.name,
          code: promoCodeFromRule(r),
          kind: r.type.replace(/_/g, ' '),
        }))
      const passOptions: BenefitOption[] = passes
        .filter((p) => p.active)
        .map((p) => ({
          benefitType: 'free_pass',
          benefitId: p.id,
          name: p.name,
          code: promoCodeFromPass(p),
          kind: 'free pass',
        }))
      setOptions(
        [...ruleOptions, ...passOptions].sort((a, b) => a.name.localeCompare(b.name)),
      )
      setSelections(current)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load benefits')
    } finally {
      setLoading(false)
    }
  }, [scopeLevel, scopeRefId])

  useEffect(() => {
    void load()
  }, [load])

  const selectionMap = useMemo(() => {
    const map = new Map<string, PricingBenefitSelection>()
    for (const s of selections) {
      map.set(selectionKey(s.benefitType, s.benefitId), s)
    }
    return map
  }, [selections])

  const toggleSelected = (opt: BenefitOption) => {
    setSaved(false)
    const key = selectionKey(opt.benefitType, opt.benefitId)
    if (selectionMap.has(key)) {
      setSelections((prev) =>
        prev.filter((s) => selectionKey(s.benefitType, s.benefitId) !== key),
      )
    } else {
      setSelections((prev) => [
        ...prev,
        {
          scopeLevel,
          scopeRefId,
          benefitType: opt.benefitType,
          benefitId: opt.benefitId,
          autoApply: opt.code == null,
          allowMemberCode: opt.code != null,
          sortOrder: prev.length,
        },
      ])
    }
  }

  const patchSelection = (
    opt: BenefitOption,
    patch: Partial<Pick<PricingBenefitSelection, 'autoApply' | 'allowMemberCode'>>,
  ) => {
    setSaved(false)
    const key = selectionKey(opt.benefitType, opt.benefitId)
    setSelections((prev) =>
      prev.map((s) => (selectionKey(s.benefitType, s.benefitId) === key ? { ...s, ...patch } : s)),
    )
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const payload: PricingBenefitSelectionInput[] = selections.map((s, i) => ({
        benefitType: s.benefitType,
        benefitId: s.benefitId,
        autoApply: s.autoApply,
        allowMemberCode: s.allowMemberCode,
        sortOrder: i,
      }))
      const data = await adminSaveBenefitSelections({
        scopeLevel,
        scopeRefId,
        selections: payload,
      })
      setSelections(data)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white ${compact ? 'p-3 space-y-2' : 'p-4 space-y-3'}`}
    >
      <div>
        <h4 className={`font-bold text-gray-900 ${compact ? 'text-sm' : 'text-sm'}`}>{title}</h4>
        {!compact && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-gray-500">
          Create discounts or free passes in their tabs first, then select them here.
        </p>
      ) : (
        <ul className={`space-y-2 overflow-y-auto ${compact ? 'max-h-40' : 'max-h-64'}`}>
          {options.map((opt) => {
            const sel = selectionMap.get(selectionKey(opt.benefitType, opt.benefitId))
            const selected = Boolean(sel)
            const hasCode = opt.code != null
            return (
              <li
                key={selectionKey(opt.benefitType, opt.benefitId)}
                className="rounded border border-gray-100 px-3 py-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="flex items-start gap-2 cursor-pointer min-w-0 flex-1">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected}
                      onChange={() => toggleSelected(opt)}
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-gray-900 block truncate">{opt.name}</span>
                      <span className="text-xs text-gray-500 capitalize">
                        {opt.kind}
                        {opt.code ? (
                          <>
                            {' '}
                            · <span className="font-mono">{opt.code}</span>
                          </>
                        ) : null}
                      </span>
                    </span>
                  </label>
                </div>
                {selected && (
                  <div className="mt-2 ml-6 flex flex-wrap gap-4 text-xs text-gray-600">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sel?.autoApply ?? false}
                        onChange={(e) => patchSelection(opt, { autoApply: e.target.checked })}
                      />
                      Auto-apply
                    </label>
                    {hasCode && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sel?.allowMemberCode ?? false}
                          onChange={(e) =>
                            patchSelection(opt, { allowMemberCode: e.target.checked })
                          }
                        />
                        Member code
                      </label>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => void save()}
          className="px-3 py-1.5 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save benefits'}
        </button>
        {saved && <span className="text-xs text-green-700">Saved</span>}
      </div>
    </div>
  )
}

export default PricingBenefitSelectionField
