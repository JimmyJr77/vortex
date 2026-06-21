import { useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import {
  isMultiClassSystemRule,
  isMonthlySpendSystemRule,
  MULTI_CLASS_TARGET_LABELS,
  MULTI_CLASS_TIER_MATCH_MODES,
  MULTI_CLASS_TIER_MATCH_LABELS,
  MULTI_CLASS_DISCOUNT_TARGETS,
  defaultMultiClassTier,
  defaultMonthlySpendTier,
  nextMonthlySpendThreshold,
} from '../../utils/systemDiscounts'
import {
  type DiscountAmountType,
  type DiscountRule,
  type DiscountRuleInput,
  type DiscountRuleTier,
  type DiscountType,
} from '../../utils/schedulingApi'

interface Props {
  open: boolean
  rule: DiscountRule | null
  lockedType?: DiscountType
  onSave: (input: DiscountRuleInput) => Promise<void>
  onClose: () => void
}

const TYPE_LABELS: Record<DiscountType, string> = {
  promo_code: 'Promo code',
  school: 'School discount',
  city: 'City discount',
  multi_class: 'Multi-class discount',
  multi_child: 'Multi-child discount',
  spend_volume: 'Monthly spend discount',
  free_classes: 'Free classes',
}

const inputClass =
  'w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-vortex-red focus:outline-none box-border'

const selectClass = `${inputClass} py-0`

function toForm(rule: DiscountRule | null, lockedType?: DiscountType): DiscountRuleInput {
  if (rule) {
    return {
      name: rule.name,
      description: rule.description,
      type: rule.type,
      amountType: rule.amountType,
      amountValue: rule.amountValue,
      applyTo: rule.applyTo,
      calcBase: rule.calcBase,
      priority: rule.priority,
      stackable: rule.stackable,
      exclusivityGroup: rule.exclusivityGroup,
      maxDiscountCents: rule.maxDiscountCents,
      scopeLevel: rule.scopeLevel,
      scopeRefId: rule.scopeRefId,
      active: rule.active,
      startsAt: rule.startsAt,
      endsAt: rule.endsAt,
      maxRedemptions: rule.maxRedemptions,
      config: rule.config ?? {},
      tiers: rule.tiers ?? [],
    }
  }
  return {
    name: '',
    description: '',
    type: lockedType ?? 'promo_code',
    amountType: 'percent',
    amountValue: 1000,
    applyTo: 'per_class',
    calcBase: 'pre',
    priority: 100,
    stackable: true,
    exclusivityGroup: null,
    maxDiscountCents: null,
    scopeLevel: 'global',
    scopeRefId: null,
    active: true,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    config: lockedType === 'free_classes' ? { grant_unit: 'slot', quantity: 1 } : {},
    tiers: [],
  }
}

/** Percent rules store basis points (5000 = 50%); UI shows whole/fractional percent. */
function AmountInput({
  amountType,
  amountValue,
  onChange,
}: {
  amountType: DiscountAmountType
  amountValue: number
  onChange: (type: DiscountAmountType, value: number) => void
}) {
  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="block text-xs font-semibold mb-1 text-gray-600">Amount</label>
        <input
          type="number"
          min={0}
          step={amountType === 'percent' ? 0.5 : 0.01}
          className={inputClass}
          value={amountType === 'percent' ? amountValue / 100 : amountValue / 100}
          onChange={(e) => {
            const raw = Number(e.target.value) || 0
            onChange(amountType, Math.round(raw * 100))
          }}
        />
      </div>
      <div className="flex rounded-lg border border-gray-300 overflow-hidden">
        <button
          type="button"
          onClick={() => onChange('percent', amountValue)}
          className={`px-3 py-2 text-sm ${amountType === 'percent' ? 'bg-vortex-red text-white' : 'bg-white text-gray-700'}`}
        >
          %
        </button>
        <button
          type="button"
          onClick={() => onChange('fixed', amountValue)}
          className={`px-3 py-2 text-sm ${amountType === 'fixed' ? 'bg-vortex-red text-white' : 'bg-white text-gray-700'}`}
        >
          $
        </button>
      </div>
    </div>
  )
}

function CsvField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string[] | undefined
  placeholder: string
  onChange: (next: string[]) => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 text-gray-600">{label}</label>
      <input
        type="text"
        className={inputClass}
        placeholder={placeholder}
        value={(value ?? []).join(', ')}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
      <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
    </div>
  )
}

const DiscountRuleEditor = ({ open, rule, lockedType, onSave, onClose }: Props) => {
  const [form, setForm] = useState<DiscountRuleInput>(() => toForm(rule, lockedType))
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(toForm(rule, lockedType))
      setError(null)
      setAdvancedOpen(false)
    }
  }, [open, rule, lockedType])

  if (!open) return null

  const update = (patch: Partial<DiscountRuleInput>) => setForm((f) => ({ ...f, ...patch }))
  const updateConfig = (patch: Record<string, unknown>) =>
    setForm((f) => ({ ...f, config: { ...f.config, ...patch } }))

  const isTiered =
    form.type === 'multi_class' || form.type === 'multi_child' || form.type === 'spend_volume'

  const isSpendVolume = form.type === 'spend_volume'

  const isSystemMultiClass =
    isMultiClassSystemRule(rule) ||
    form.config?.system_key === 'multi_class' ||
    form.config?.system_key === 'multi_family'

  const isSystemMonthlySpend =
    isSpendVolume &&
    (isMonthlySpendSystemRule(rule) ||
      form.config?.system_key === 'monthly_spend' ||
      rule?.exclusivityGroup === 'monthly_spend')

  const isSystemRule = isSystemMultiClass || isSystemMonthlySpend

  const addTier = () => {
    if (isSpendVolume) {
      const threshold = nextMonthlySpendThreshold(form.tiers)
      update({ tiers: [...form.tiers, defaultMonthlySpendTier(threshold)] })
      return
    }
    const nextThreshold = (form.tiers.at(-1)?.threshold ?? 1) + 1
    const next: DiscountRuleTier = isSystemMultiClass
      ? defaultMultiClassTier(nextThreshold)
      : {
          threshold: nextThreshold,
          amountType: 'percent',
          amountValue: 1000,
        }
    update({ tiers: [...form.tiers, next] })
  }
  const updateTier = (index: number, patch: Partial<DiscountRuleTier>) => {
    update({ tiers: form.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) })
  }
  const removeTier = (index: number) => {
    update({ tiers: form.tiers.filter((_, i) => i !== index) })
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    if (form.type === 'promo_code' && !String(form.config.code ?? '').trim()) {
      setError('Promo code is required')
      return
    }
    if ((isSystemRule || isSpendVolume) && form.tiers.length === 0) {
      setError(isSpendVolume ? 'Add at least one spend threshold' : 'Add at least one tier')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...form, name: form.name.trim() })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className={`relative bg-white rounded-xl shadow-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 ${
          isSpendVolume ? 'max-w-5xl' : 'max-w-2xl'
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-black">
            {rule ? 'Edit' : 'New'}{' '}
            {isSystemMonthlySpend
              ? 'monthly spend discount'
              : isSpendVolume
                ? 'monthly spend discount'
                : isSystemMultiClass
                ? 'multi-class discount'
                : TYPE_LABELS[form.type].toLowerCase()}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {(isSystemMonthlySpend || isSpendVolume) && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {isSystemMonthlySpend
              ? 'Discount unlocks when total monthly enrollment spend reaches each threshold. Set minimum paid classes and per-class floors on each threshold row.'
              : 'Set spend thresholds with optional paid-class requirements per row. When total monthly spend reaches each amount, the matching discount applies.'}
          </div>
        )}

        {isSystemMultiClass && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
            Applies when an account has multiple paid classes — one student with two classes
            qualifies the same as two family members with one class each. Free-only enrollments do
            not count.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Name</label>
            <input
              type="text"
              className={inputClass}
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>
          {!lockedType && !isSystemRule && (
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Type</label>
              <select
                className={selectClass}
                value={form.type}
                onChange={(e) => update({ type: e.target.value as DiscountType })}
              >
                {(Object.keys(TYPE_LABELS) as DiscountType[])
                  .filter((t) => t !== 'free_classes' || form.type === 'free_classes')
                  .map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isSpendVolume && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Discount applies to</label>
              <select
                className={selectClass}
                value={String(form.config.discount_target ?? 'total')}
                onChange={(e) => updateConfig({ discount_target: e.target.value })}
              >
                {MULTI_CLASS_DISCOUNT_TARGETS.map((target) => (
                  <option key={target} value={target}>
                    {MULTI_CLASS_TARGET_LABELS[target]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">
                Minimum list price per paid class ($)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                placeholder="No minimum"
                value={
                  form.config.min_per_class_cents != null
                    ? Number(form.config.min_per_class_cents) / 100
                    : ''
                }
                onChange={(e) =>
                  updateConfig({
                    min_per_class_cents:
                      e.target.value === '' ? null : Math.round(Number(e.target.value) * 100),
                  })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional rule-wide floor. Override per spend threshold below.
              </p>
            </div>
          </div>
        )}

        {isSystemMultiClass && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">
                Minimum paid classes
              </label>
              <input
                type="number"
                min={2}
                className={inputClass}
                value={Number(
                  form.config.min_paying_classes ?? form.config.min_paying_members ?? 2,
                )}
                onChange={(e) =>
                  updateConfig({ min_paying_classes: Math.max(2, Number(e.target.value) || 2) })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Account must have at least this many paid class enrollments before any tier applies.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Discount applies to</label>
              <select
                className={selectClass}
                value={String(form.config.discount_target ?? 'lowest')}
                onChange={(e) => updateConfig({ discount_target: e.target.value })}
              >
                {MULTI_CLASS_DISCOUNT_TARGETS.map((target) => (
                  <option key={target} value={target}>
                    {MULTI_CLASS_TARGET_LABELS[target]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Tier matching</label>
              <select
                className={selectClass}
                value={String(form.config.tier_match_mode ?? 'best_eligible')}
                onChange={(e) => updateConfig({ tier_match_mode: e.target.value })}
              >
                {MULTI_CLASS_TIER_MATCH_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {MULTI_CLASS_TIER_MATCH_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1 text-gray-600">
                Minimum list price per paid class ($)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                placeholder="No minimum"
                value={
                  form.config.min_per_class_cents != null
                    ? Number(form.config.min_per_class_cents) / 100
                    : ''
                }
                onChange={(e) =>
                  updateConfig({
                    min_per_class_cents:
                      e.target.value === '' ? null : Math.round(Number(e.target.value) * 100),
                  })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional rule-wide floor. Each paid enrollment must meet this list price to count.
                Override per tier below.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-600">Description</label>
          <input
            type="text"
            className={inputClass}
            value={form.description ?? ''}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>

        {/* Type-specific fields */}
        {form.type === 'promo_code' && (
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Promo code</label>
            <input
              type="text"
              className={`${inputClass} uppercase`}
              placeholder="SUMMER25"
              value={String(form.config.code ?? '')}
              onChange={(e) => updateConfig({ code: e.target.value.trim(), promo_code_auto_generated: false })}
            />
            <p className="text-xs text-gray-500 mt-1">Auto-generated on save if left blank.</p>
          </div>
        )}

        {form.type !== 'promo_code' && (
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Promo code (optional)</label>
            <input
              type="text"
              className={`${inputClass} uppercase`}
              placeholder="Auto-generated on save"
              value={String(form.config.promo_code ?? '')}
              onChange={(e) =>
                updateConfig({
                  promo_code: e.target.value.trim().toUpperCase(),
                  promo_code_auto_generated: false,
                })
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              Tracking code for this discount. Auto-generated if left blank.
            </p>
          </div>
        )}

        {form.type === 'school' && (
          <CsvField
            label="School names"
            placeholder="Lincoln High, Jefferson Middle"
            value={form.config.school_names}
            onChange={(next) => updateConfig({ school_names: next })}
          />
        )}

        {form.type === 'city' && (
          <CsvField
            label="Cities"
            placeholder="Springfield, Shelbyville"
            value={form.config.cities}
            onChange={(next) => updateConfig({ cities: next })}
          />
        )}

        {form.type === 'free_classes' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Free unit</label>
              <select
                className={inputClass}
                value={String(form.config.grant_unit ?? 'slot')}
                onChange={(e) => updateConfig({ grant_unit: e.target.value })}
              >
                <option value="slot">Slot</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="offering">Offering</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Quantity</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={Number(form.config.quantity ?? 1)}
                onChange={(e) => updateConfig({ quantity: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          </div>
        )}

        {/* Amount (not used for tiered types, which use per-tier amounts) */}
        {!isTiered && form.type !== 'free_classes' && (
          <AmountInput
            amountType={form.amountType}
            amountValue={form.amountValue}
            onChange={(type, value) => update({ amountType: type, amountValue: value })}
          />
        )}

        {/* Spend thresholds / class-count tiers */}
        {isTiered && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-600">
                {isSpendVolume
                  ? 'Spend thresholds'
                  : isSystemMultiClass
                    ? 'Tiers (by paid class count on account)'
                    : `Tiers (${form.type === 'multi_class' ? 'by class count' : 'by child count'})`}
              </label>
              <button
                type="button"
                onClick={addTier}
                className="inline-flex items-center gap-1 text-sm text-vortex-red hover:underline"
              >
                <Plus className="w-4 h-4" /> {isSpendVolume ? 'Add threshold' : 'Add tier'}
              </button>
            </div>
            {form.tiers.length === 0 && (
              <p className="text-xs text-gray-400">
                {isSpendVolume
                  ? 'No thresholds yet. Example: $199/mo spend + 2 paid classes → 5% off; $299/mo → 10% off.'
                  : isSystemMultiClass
                    ? 'No tiers yet. Example: 2 paid classes → 10%, 3 → 15%.'
                    : 'No tiers yet. Add a tier for the 2nd, 3rd, etc.'}
              </p>
            )}
            {form.tiers.map((tier, index) =>
              isSpendVolume ? (
                <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Monthly spend reaches ($)</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={inputClass}
                        value={tier.threshold / 100}
                        onChange={(e) =>
                          updateTier(index, {
                            threshold: Math.max(0, Math.round((Number(e.target.value) || 0) * 100)),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Min paid classes</label>
                      <input
                        type="number"
                        min={0}
                        className={inputClass}
                        placeholder="None"
                        value={tier.minPaidEnrollments ?? ''}
                        onChange={(e) =>
                          updateTier(index, {
                            minPaidEnrollments:
                              e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Min $/class</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={inputClass}
                        placeholder="Rule default"
                        value={
                          tier.minPerClassCents != null ? tier.minPerClassCents / 100 : ''
                        }
                        onChange={(e) =>
                          updateTier(index, {
                            minPerClassCents:
                              e.target.value === ''
                                ? null
                                : Math.round(Number(e.target.value) * 100),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Max discount ($)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className={inputClass}
                        placeholder="No cap"
                        value={
                          tier.maxDiscountCents != null ? tier.maxDiscountCents / 100 : ''
                        }
                        onChange={(e) =>
                          updateTier(index, {
                            maxDiscountCents:
                              e.target.value === ''
                                ? null
                                : Math.round(Number(e.target.value) * 100),
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2 flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <label className="block text-xs text-gray-500 mb-1">Discount</label>
                        <AmountInput
                          amountType={tier.amountType}
                          amountValue={tier.amountValue}
                          onChange={(type, value) =>
                            updateTier(index, { amountType: type, amountValue: value })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTier(index)}
                        className="p-2 text-gray-400 hover:text-red-600 shrink-0"
                        aria-label="Remove threshold"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : isSystemMultiClass ? (
                <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Paid classes</label>
                      <input
                        type="number"
                        min={2}
                        className={inputClass}
                        value={tier.threshold}
                        onChange={(e) =>
                          updateTier(index, { threshold: Math.max(2, Number(e.target.value) || 2) })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Min account monthly ($)</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={inputClass}
                        placeholder="0"
                        value={
                          tier.minMonthlyCents != null ? tier.minMonthlyCents / 100 : ''
                        }
                        onChange={(e) =>
                          updateTier(index, {
                            minMonthlyCents:
                              e.target.value === ''
                                ? null
                                : Math.round(Number(e.target.value) * 100),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Min paid classes</label>
                      <input
                        type="number"
                        min={0}
                        className={inputClass}
                        placeholder={String(tier.threshold)}
                        value={tier.minPaidEnrollments ?? ''}
                        onChange={(e) =>
                          updateTier(index, {
                            minPaidEnrollments:
                              e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Min $/class</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={inputClass}
                        placeholder="Rule default"
                        value={
                          tier.minPerClassCents != null ? tier.minPerClassCents / 100 : ''
                        }
                        onChange={(e) =>
                          updateTier(index, {
                            minPerClassCents:
                              e.target.value === ''
                                ? null
                                : Math.round(Number(e.target.value) * 100),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Max discount ($)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className={inputClass}
                        placeholder="No cap"
                        value={
                          tier.maxDiscountCents != null ? tier.maxDiscountCents / 100 : ''
                        }
                        onChange={(e) =>
                          updateTier(index, {
                            maxDiscountCents:
                              e.target.value === ''
                                ? null
                                : Math.round(Number(e.target.value) * 100),
                          })
                        }
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Discount</label>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          className={inputClass}
                          value={tier.amountValue / 100}
                          onChange={(e) =>
                            updateTier(index, {
                              amountType: 'percent',
                              amountValue: Math.round((Number(e.target.value) || 0) * 100),
                            })
                          }
                        />
                      </div>
                      <span className="pb-2 text-sm text-gray-500">%</span>
                      <button
                        type="button"
                        onClick={() => removeTier(index)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        aria-label="Remove tier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={index} className="flex items-end gap-2 border border-gray-200 rounded-lg p-2">
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 mb-1">At #</label>
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={tier.threshold}
                      onChange={(e) =>
                        updateTier(index, { threshold: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <AmountInput
                      amountType={tier.amountType}
                      amountValue={tier.amountValue}
                      onChange={(type, value) => updateTier(index, { amountType: type, amountValue: value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTier(index)}
                    className="p-2 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ),
            )}
          </div>
        )}

        {isSystemRule && (
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Calculate on</label>
            <select
              className={selectClass}
              value={form.calcBase}
              onChange={(e) => update({ calcBase: e.target.value as DiscountRuleInput['calcBase'] })}
            >
              <option value="pre">List price (before other discounts)</option>
              <option value="post">Running price (after prior discounts)</option>
            </select>
          </div>
        )}

        {/* Scope + base */}
        {!isSystemRule && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Apply to</label>
            <select
              className={selectClass}
              value={form.applyTo}
              onChange={(e) => update({ applyTo: e.target.value as DiscountRuleInput['applyTo'] })}
            >
              <option value="per_class">Each class</option>
              <option value="order_total">Order total</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Calculate on</label>
            <select
              className={selectClass}
              value={form.calcBase}
              onChange={(e) => update({ calcBase: e.target.value as DiscountRuleInput['calcBase'] })}
            >
              <option value="pre">List price (before other discounts)</option>
              <option value="post">Running price (after prior discounts)</option>
            </select>
          </div>
        </div>
        )}

        {/* Window */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Starts</label>
            <input
              type="date"
              className={inputClass}
              value={form.startsAt ? form.startsAt.slice(0, 10) : ''}
              onChange={(e) => update({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Ends</label>
            <input
              type="date"
              className={inputClass}
              value={form.endsAt ? form.endsAt.slice(0, 10) : ''}
              onChange={(e) => update({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update({ active: e.target.checked })}
          />
          Active
        </label>

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
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600">Priority</label>
                <input
                  type="number"
                  className={inputClass}
                  value={form.priority}
                  onChange={(e) => update({ priority: Number(e.target.value) || 0 })}
                />
                <p className="text-xs text-gray-400 mt-1">Lower applies first</p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600">
                  Exclusivity group
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.exclusivityGroup ?? ''}
                  onChange={(e) => update({ exclusivityGroup: e.target.value || null })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600">
                  Max discount ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={inputClass}
                  placeholder="No cap"
                  value={form.maxDiscountCents != null ? form.maxDiscountCents / 100 : ''}
                  onChange={(e) =>
                    update({
                      maxDiscountCents:
                        e.target.value === '' ? null : Math.round((Number(e.target.value) || 0) * 100),
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600">
                  Max redemptions
                </label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  placeholder="Unlimited"
                  value={form.maxRedemptions ?? ''}
                  onChange={(e) =>
                    update({ maxRedemptions: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 col-span-2">
                <input
                  type="checkbox"
                  checked={form.stackable}
                  onChange={(e) => update({ stackable: e.target.checked })}
                />
                Stackable with other discounts
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
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
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DiscountRuleEditor
