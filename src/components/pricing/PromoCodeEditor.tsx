import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { schoolsApi } from '../../utils/adminFeaturesApi'
import type { DiscountRule, DiscountRuleInput } from '../../utils/schedulingApi'
import {
  adminFetchOfferings,
  adminFetchSchedulingForms,
} from '../../utils/schedulingApi'
import {
  AMOUNT_APPLIES_LABELS,
  ELIGIBILITY_FIELD_LABELS,
  ELIGIBILITY_OPERATOR_LABELS,
  FREE_BENEFIT_LABELS,
  type EligibilityField,
  type EligibilityOperator,
  type EligibilityRule,
  type PromoFormState,
  describePromoSummary,
  getPromoStatus,
  gradeLevelsForPicker,
  graduationYearsForPicker,
  promoFormFromRule,
  promoFormToRuleInput,
  validatePromoForm,
} from '../../utils/promoDiscountModel'

interface Props {
  open: boolean
  rule: DiscountRule | null
  onSave: (input: DiscountRuleInput) => Promise<void>
  onClose: () => void
}

interface OfferingOption {
  id: number
  label: string
  formTitle: string
}

const controlClass =
  'w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-vortex-red focus:outline-none box-border'

const selectClass = `${controlClass} py-0`

const sectionClass = 'rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-4'

function EligibilityRuleRow({
  rule,
  schools,
  onChange,
  onRemove,
}: {
  rule: EligibilityRule
  schools: Array<{ id: number; name: string }>
  onChange: (next: EligibilityRule) => void
  onRemove: () => void
}) {
  const isMulti = rule.operator === 'in' || rule.operator === 'not_in'
  const gradYears = graduationYearsForPicker()
  const grades = gradeLevelsForPicker()

  const renderValue = () => {
    if (rule.field === 'school') {
      if (isMulti) {
        const selected = new Set(
          Array.isArray(rule.value) ? rule.value.map(String) : rule.value ? [String(rule.value)] : [],
        )
        return (
          <select
            multiple
            className={`${controlClass} h-24`}
            value={[...selected]}
            onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
              onChange({ ...rule, value: opts })
            }}
          >
            {schools.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        )
      }
      return (
        <select
          className={controlClass}
          value={String(rule.value ?? '')}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
        >
          <option value="">Select school…</option>
          {schools.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      )
    }
    if (rule.field === 'graduation_year') {
      if (isMulti) {
        const selected = new Set(
          Array.isArray(rule.value)
            ? rule.value.map(Number)
            : rule.value != null
              ? [Number(rule.value)]
              : [],
        )
        return (
          <select
            multiple
            className={`${controlClass} h-24`}
            value={[...selected].map(String)}
            onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions).map((o) => Number(o.value))
              onChange({ ...rule, value: opts })
            }}
          >
            {gradYears.map((y) => (
              <option key={y} value={y}>
                Class of {y}
              </option>
            ))}
          </select>
        )
      }
      return (
        <select
          className={controlClass}
          value={rule.value != null ? String(rule.value) : ''}
          onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}
        >
          <option value="">Select year…</option>
          {gradYears.map((y) => (
            <option key={y} value={y}>
              Class of {y}
            </option>
          ))}
        </select>
      )
    }
    if (isMulti) {
      const selected = new Set(
        Array.isArray(rule.value) ? rule.value.map(Number) : rule.value != null ? [Number(rule.value)] : [],
      )
      return (
        <select
          multiple
          className={`${controlClass} h-24`}
          value={[...selected].map(String)}
          onChange={(e) => {
            const opts = Array.from(e.target.selectedOptions).map((o) => Number(o.value))
            onChange({ ...rule, value: opts })
          }}
        >
          {grades.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      )
    }
    return (
      <select
        className={controlClass}
        value={rule.value != null ? String(rule.value) : ''}
        onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}
      >
        <option value="">Select grade…</option>
        {grades.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.2fr_auto] gap-2 items-end">
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Field</label>
        <select
          className={controlClass}
          value={rule.field}
          onChange={(e) => {
            const field = e.target.value as EligibilityField
            onChange({
              field,
              operator: rule.operator,
              value: field === 'graduation_year' || field === 'grade_level' ? '' : '',
            })
          }}
        >
          {(Object.keys(ELIGIBILITY_FIELD_LABELS) as EligibilityField[]).map((f) => (
            <option key={f} value={f}>
              {ELIGIBILITY_FIELD_LABELS[f]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Operator</label>
        <select
          className={controlClass}
          value={rule.operator}
          onChange={(e) => {
            const operator = e.target.value as EligibilityOperator
            const multi = operator === 'in' || operator === 'not_in'
            onChange({
              ...rule,
              operator,
              value: multi ? [] : '',
            })
          }}
        >
          {(Object.keys(ELIGIBILITY_OPERATOR_LABELS) as EligibilityOperator[]).map((op) => (
            <option key={op} value={op}>
              {ELIGIBILITY_OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Value</label>
        {renderValue()}
        {isMulti && <p className="text-xs text-gray-400 mt-1">Hold Cmd/Ctrl to select multiple</p>}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="h-10 px-2 text-gray-400 hover:text-red-600"
        aria-label="Remove rule"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

const PromoCodeEditor = ({ open, rule, onSave, onClose }: Props) => {
  const [form, setForm] = useState<PromoFormState>(() => promoFormFromRule(rule))
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schools, setSchools] = useState<Array<{ id: number; name: string }>>([])
  const [offerings, setOfferings] = useState<OfferingOption[]>([])
  const [loadingRefs, setLoadingRefs] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(promoFormFromRule(rule))
    setError(null)
    setAdvancedOpen(false)
  }, [open, rule])

  const loadReferenceData = useCallback(async () => {
    setLoadingRefs(true)
    try {
      const [schoolList, forms] = await Promise.all([
        schoolsApi.list({ active: true }).catch(() => []),
        adminFetchSchedulingForms().catch(() => []),
      ])
      setSchools(schoolList.map((s) => ({ id: s.id, name: s.name })))
      const offeringOpts: OfferingOption[] = []
      for (const f of forms.filter((x) => x.isActive).slice(0, 40)) {
        try {
          const rows = await adminFetchOfferings(f.id)
          for (const o of rows) {
            offeringOpts.push({
              id: o.id,
              formTitle: f.title,
              label: o.label?.trim() || `${o.startDate} – ${o.endDate}`,
            })
          }
        } catch {
          /* skip form */
        }
      }
      setOfferings(offeringOpts)
    } finally {
      setLoadingRefs(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadReferenceData()
  }, [open, loadReferenceData])

  const update = (patch: Partial<PromoFormState>) => setForm((f) => ({ ...f, ...patch }))

  const statusPreview = useMemo(() => {
    if (!rule) return null
    return getPromoStatus({
      ...rule,
      active: form.active,
      startsAt: form.startsAt ? new Date(`${form.startsAt}T12:00:00`).toISOString() : null,
      endsAt: form.endsAt ? new Date(`${form.endsAt}T12:00:00`).toISOString() : null,
    })
  }, [rule, form.active, form.startsAt, form.endsAt])

  const summary = useMemo(() => describePromoSummary(form), [form])

  const needsOfferings =
    (form.discountKind === 'amount' && form.amountAppliesTo === 'class_offering') ||
    (form.discountKind === 'free_access' && form.benefitType === 'class_offering')

  const toggleOffering = (id: number) => {
    setForm((f) => {
      const set = new Set(f.classOfferingIds)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return { ...f, classOfferingIds: [...set] }
    })
  }

  const handleSave = async () => {
    const validationError = validatePromoForm(form)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(promoFormToRuleInput(form))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-black">{rule ? 'Edit promo code' : 'New promo code'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Basic */}
          <div className={sectionClass}>
            <h4 className="text-sm font-bold text-gray-900">Basic</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  className={controlClass}
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Summer signup discount"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Promo code</label>
                <input
                  type="text"
                  className={`${controlClass} uppercase font-mono`}
                  value={form.code}
                  onChange={(e) => update({ code: e.target.value.toUpperCase().replace(/\s/g, '') })}
                  placeholder="SUMMER25"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <input
                type="text"
                className={controlClass}
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Optional internal note"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Discount</label>
              <select
                className={selectClass}
                value={form.discountKind}
                onChange={(e) =>
                  update({ discountKind: e.target.value as PromoFormState['discountKind'] })
                }
              >
                <option value="amount">Amount (percent or fixed $)</option>
                <option value="free_access">Free access / free classes</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Choose whether this code reduces price or grants free time/classes.
              </p>
            </div>

            {form.discountKind === 'amount' && (
              <div className="space-y-4 border-t border-gray-200 pt-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Value</label>
                    <input
                      type="number"
                      min={0}
                      step={form.amountUnit === 'percent' ? 1 : 0.01}
                      className={controlClass}
                      value={form.amountValue}
                      onChange={(e) =>
                        update({ amountValue: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </div>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden h-10">
                    <button
                      type="button"
                      onClick={() => update({ amountUnit: 'percent' })}
                      className={`px-4 text-sm ${form.amountUnit === 'percent' ? 'bg-vortex-red text-white' : 'bg-white text-gray-700'}`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ amountUnit: 'fixed' })}
                      className={`px-4 text-sm ${form.amountUnit === 'fixed' ? 'bg-vortex-red text-white' : 'bg-white text-gray-700'}`}
                    >
                      $
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Applies to</label>
                  <select
                    className={selectClass}
                    value={form.amountAppliesTo}
                    onChange={(e) =>
                      update({
                        amountAppliesTo: e.target.value as PromoFormState['amountAppliesTo'],
                        classOfferingIds: [],
                      })
                    }
                  >
                    {(Object.keys(AMOUNT_APPLIES_LABELS) as Array<keyof typeof AMOUNT_APPLIES_LABELS>).map(
                      (k) => (
                        <option key={k} value={k}>
                          {AMOUNT_APPLIES_LABELS[k]}
                        </option>
                      ),
                    )}
                  </select>
                  {form.amountAppliesTo === 'date_window' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Use the start and end dates below to define when the code can be used. The
                      discount applies to the order total during that window.
                    </p>
                  )}
                </div>
              </div>
            )}

            {form.discountKind === 'free_access' && (
              <div className="space-y-4 border-t border-gray-200 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Free benefit</label>
                  <select
                    className={controlClass}
                    value={form.benefitType}
                    onChange={(e) =>
                      update({
                        benefitType: e.target.value as PromoFormState['benefitType'],
                        classOfferingIds: [],
                      })
                    }
                  >
                    {(Object.keys(FREE_BENEFIT_LABELS) as Array<keyof typeof FREE_BENEFIT_LABELS>).map(
                      (k) => (
                        <option key={k} value={k}>
                          {FREE_BENEFIT_LABELS[k]}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    className={controlClass}
                    value={form.freeQuantity}
                    onChange={(e) =>
                      update({ freeQuantity: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </div>
                {form.benefitType === 'days' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      How free days apply
                    </label>
                    <select
                      className={controlClass}
                      value={form.applicationMethod}
                      onChange={(e) =>
                        update({
                          applicationMethod: e.target.value as PromoFormState['applicationMethod'],
                        })
                      }
                    >
                      <option value="monthly_rate_credit">Discounted off the monthly rate</option>
                      <option value="free_solo_class_access">Granted as free solo class access</option>
                    </select>
                  </div>
                )}
                {(form.benefitType === 'weeks' || form.benefitType === 'months') && (
                  <p className="text-xs text-gray-500">
                    Free {form.benefitType} are converted to a monthly billing equivalent when pricing
                    is shown.
                  </p>
                )}
              </div>
            )}

            {needsOfferings && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Class offering{form.classOfferingIds.length === 1 ? '' : 's'}
                </label>
                {loadingRefs ? (
                  <p className="text-sm text-gray-400">Loading offerings…</p>
                ) : offerings.length === 0 ? (
                  <p className="text-sm text-gray-500">No offerings found. Create offerings on a class first.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {offerings.map((o) => (
                      <label
                        key={o.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.classOfferingIds.includes(o.id)}
                          onChange={() => toggleOffering(o.id)}
                        />
                        <span>
                          <span className="font-medium text-gray-900">{o.formTitle}</span>
                          <span className="text-gray-500"> — {o.label}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-200 pt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Valid from</label>
                <input
                  type="date"
                  className={controlClass}
                  value={form.startsAt ?? ''}
                  onChange={(e) => update({ startsAt: e.target.value || null })}
                />
                <p className="text-xs text-gray-400 mt-1">Leave empty for no start limit</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Valid through</label>
                <input
                  type="date"
                  className={controlClass}
                  value={form.endsAt ?? ''}
                  onChange={(e) => update({ endsAt: e.target.value || null })}
                />
                <p className="text-xs text-gray-400 mt-1">Leave empty for no end limit (permanent code)</p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.active}
                  onChange={(e) => update({ active: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">Active</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Controls whether this promo is enabled. Dates above limit when it can be used —
                    a promo can be active but outside its date window.
                  </span>
                </span>
              </label>
              {statusPreview && (
                <p className="text-xs text-gray-600 mt-2 pl-7">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full font-medium mr-1 ${
                      statusPreview.usableNow
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-50 text-amber-900'
                    }`}
                  >
                    {statusPreview.label}
                  </span>
                  {statusPreview.detail}
                </p>
              )}
            </div>
          </div>

          {/* Eligibility */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Customer eligibility</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  No rules = anyone with the code. Multiple rules use AND logic.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  update({
                    eligibilityRules: [
                      ...form.eligibilityRules,
                      { field: 'school', operator: 'is', value: '' },
                    ],
                  })
                }
                className="inline-flex items-center gap-1 text-sm text-vortex-red hover:underline shrink-0"
              >
                <Plus className="w-4 h-4" /> Add rule
              </button>
            </div>
            {form.eligibilityRules.length === 0 ? (
              <p className="text-sm text-gray-500">No restrictions — all customers may use this code.</p>
            ) : (
              <div className="space-y-3">
                {form.eligibilityRules.map((r, i) => (
                  <EligibilityRuleRow
                    key={i}
                    rule={r}
                    schools={schools}
                    onChange={(next) =>
                      update({
                        eligibilityRules: form.eligibilityRules.map((row, j) => (j === i ? next : row)),
                      })
                    }
                    onRemove={() =>
                      update({
                        eligibilityRules: form.eligibilityRules.filter((_, j) => j !== i),
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900">
            <p className="font-semibold mb-1">Summary</p>
            <p>{summary}</p>
          </div>

          {/* Advanced */}
          <div className="border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              {advancedOpen ? '▾' : '▸'} Advanced
            </button>
            {advancedOpen && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                  <input
                    type="number"
                    className={controlClass}
                    value={form.priority}
                    onChange={(e) => update({ priority: Number(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-400 mt-1">Lower number applies first</p>
                </div>
                {form.discountKind === 'amount' && form.amountUnit === 'percent' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Max discount ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className={controlClass}
                      placeholder="No cap"
                      value={form.maxDiscountCents != null ? form.maxDiscountCents / 100 : ''}
                      onChange={(e) =>
                        update({
                          maxDiscountCents:
                            e.target.value === ''
                              ? null
                              : Math.round((Number(e.target.value) || 0) * 100),
                        })
                      }
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Max redemptions
                  </label>
                  <input
                    type="number"
                    min={0}
                    className={controlClass}
                    placeholder="Unlimited"
                    value={form.maxRedemptions ?? ''}
                    onChange={(e) =>
                      update({
                        maxRedemptions:
                          e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </div>
                {form.discountKind === 'amount' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Calculate on
                    </label>
                    <select
                      className={selectClass}
                      value={form.calcBase}
                      onChange={(e) =>
                        update({ calcBase: e.target.value as PromoFormState['calcBase'] })
                      }
                    >
                      <option value="pre">List price (before other discounts)</option>
                      <option value="post">Running price (after prior discounts)</option>
                    </select>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Conflict group
                  </label>
                  <input
                    type="text"
                    className={controlClass}
                    placeholder="Optional — promos in the same group cannot stack"
                    value={form.exclusivityGroup ?? ''}
                    onChange={(e) => update({ exclusivityGroup: e.target.value || null })}
                  />
                </div>
                <label className="flex items-start gap-2 text-sm text-gray-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.stackable}
                    onChange={(e) => update({ stackable: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">Stackable with other discounts</span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      When off, this promo won&apos;t combine with other discounts. If two promos
                      conflict, lower priority number wins.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save promo'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PromoCodeEditor
