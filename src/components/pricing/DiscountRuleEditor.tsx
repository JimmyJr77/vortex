import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
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
  free_classes: 'Free classes',
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-vortex-red focus:outline-none'

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

  if (!open) return null

  const update = (patch: Partial<DiscountRuleInput>) => setForm((f) => ({ ...f, ...patch }))
  const updateConfig = (patch: Record<string, unknown>) =>
    setForm((f) => ({ ...f, config: { ...f.config, ...patch } }))

  const isTiered = form.type === 'multi_class' || form.type === 'multi_child'

  const addTier = () => {
    const next: DiscountRuleTier = {
      threshold: (form.tiers.at(-1)?.threshold ?? 1) + 1,
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
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-black">
            {rule ? 'Edit' : 'New'} {TYPE_LABELS[form.type].toLowerCase()}
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
          {!lockedType && (
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Type</label>
              <select
                className={inputClass}
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
              onChange={(e) => updateConfig({ code: e.target.value.trim() })}
            />
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

        {/* Tier repeater */}
        {isTiered && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-600">
                Tiers ({form.type === 'multi_class' ? 'by class count' : 'by child count'})
              </label>
              <button
                type="button"
                onClick={addTier}
                className="inline-flex items-center gap-1 text-sm text-vortex-red hover:underline"
              >
                <Plus className="w-4 h-4" /> Add tier
              </button>
            </div>
            {form.tiers.length === 0 && (
              <p className="text-xs text-gray-400">No tiers yet. Add a tier for the 2nd, 3rd, etc.</p>
            )}
            {form.tiers.map((tier, index) => (
              <div key={index} className="flex items-end gap-2 border border-gray-200 rounded-lg p-2">
                <div className="w-24">
                  <label className="block text-xs text-gray-500 mb-1">At #</label>
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={tier.threshold}
                    onChange={(e) => updateTier(index, { threshold: Math.max(1, Number(e.target.value) || 1) })}
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
            ))}
          </div>
        )}

        {/* Scope + base */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Apply to</label>
            <select
              className={inputClass}
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
              className={inputClass}
              value={form.calcBase}
              onChange={(e) => update({ calcBase: e.target.value as DiscountRuleInput['calcBase'] })}
            >
              <option value="pre">List price (before other discounts)</option>
              <option value="post">Running price (after prior discounts)</option>
            </select>
          </div>
        </div>

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
