import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  DAY_OF_WEEK_LABELS,
  FREE_PASS_BENEFIT_LABELS,
  type FreePassBenefitUnit,
  type FreePassTemplate,
  type FreePassTemplateInput,
} from '../../utils/schedulingApi'

interface Props {
  open: boolean
  template: FreePassTemplate | null
  onSave: (input: FreePassTemplateInput) => Promise<void>
  onClose: () => void
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-vortex-red focus:outline-none'

function toForm(t: FreePassTemplate | null): FreePassTemplateInput {
  if (t) {
    return {
      name: t.name,
      description: t.description,
      active: t.active,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      benefitUnit: t.benefitUnit,
      benefitQuantity: t.benefitQuantity,
      applicationMethod: t.applicationMethod,
      scopeLevel: t.scopeLevel,
      scopeRefId: t.scopeRefId,
      dayOfWeek: t.dayOfWeek,
      offeringIds: t.offeringIds ?? [],
      eligibility: t.eligibility ?? {},
      issuance: t.issuance ?? {},
      debitsFreeClassAllowance: t.debitsFreeClassAllowance,
      stackable: t.stackable,
      exclusivityGroup: t.exclusivityGroup,
      maxRedemptions: t.maxRedemptions,
      config: t.config ?? {},
    }
  }
  return {
    name: '',
    description: '',
    active: true,
    startsAt: null,
    endsAt: null,
    benefitUnit: 'slot',
    benefitQuantity: 1,
    applicationMethod: 'waive_enrollment',
    scopeLevel: 'global',
    scopeRefId: null,
    dayOfWeek: null,
    offeringIds: [],
    eligibility: {},
    issuance: { auto_on_enroll: false, admin_only: false },
    debitsFreeClassAllowance: false,
    stackable: true,
    exclusivityGroup: null,
    maxRedemptions: null,
    config: {},
  }
}

const FreePassEditor = ({ open, template, onSave, onClose }: Props) => {
  const [form, setForm] = useState<FreePassTemplateInput>(() => toForm(template))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offeringIdsText, setOfferingIdsText] = useState('')

  useEffect(() => {
    if (open) {
      const next = toForm(template)
      setForm(next)
      setOfferingIdsText((next.offeringIds ?? []).join(', '))
      setError(null)
    }
  }, [open, template])

  if (!open) return null

  const update = (patch: Partial<FreePassTemplateInput>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      if (patch.benefitUnit === 'day' && next.applicationMethod === 'waive_enrollment') {
        next.applicationMethod = 'monthly_prorate'
      }
      if (patch.benefitUnit === 'slot' || patch.benefitUnit === 'offering') {
        next.applicationMethod = 'waive_enrollment'
      }
      return next
    })
  }

  const updateIssuance = (patch: Record<string, unknown>) => {
    setForm((prev) => ({ ...prev, issuance: { ...prev.issuance, ...patch } }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const offeringIds = offeringIdsText
        .split(/[,\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
      await onSave({ ...form, offeringIds })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{template ? 'Edit free pass' : 'New free pass'}</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-4 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Name</label>
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Description</label>
            <textarea
              className={inputClass}
              rows={2}
              value={form.description ?? ''}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Benefit</label>
              <select
                className={inputClass}
                value={form.benefitUnit}
                onChange={(e) => update({ benefitUnit: e.target.value as FreePassBenefitUnit })}
              >
                {(Object.keys(FREE_PASS_BENEFIT_LABELS) as FreePassBenefitUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {FREE_PASS_BENEFIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Quantity</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={form.benefitQuantity}
                onChange={(e) => update({ benefitQuantity: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          </div>

          {form.benefitUnit === 'day' && (
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Day of week</label>
              <select
                className={inputClass}
                value={form.dayOfWeek ?? ''}
                onChange={(e) =>
                  update({
                    dayOfWeek: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              >
                <option value="">Any day</option>
                {DAY_OF_WEEK_LABELS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Monthly credit is prorated from scheduled occurrences in the offering.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Scope</label>
              <select
                className={inputClass}
                value={form.scopeLevel}
                onChange={(e) =>
                  update({
                    scopeLevel: e.target.value as FreePassTemplateInput['scopeLevel'],
                    scopeRefId: e.target.value === 'global' ? null : form.scopeRefId,
                  })
                }
              >
                <option value="global">Global</option>
                <option value="sport">Sport (tag id)</option>
                <option value="program">Program</option>
                <option value="class">Class (form id)</option>
                <option value="offering">Offering</option>
              </select>
            </div>
            {form.scopeLevel !== 'global' && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600">Scope ref id</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.scopeRefId ?? ''}
                  onChange={(e) =>
                    update({
                      scopeRefId: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">
              Offering ids (optional filter, comma-separated)
            </label>
            <input
              className={inputClass}
              placeholder="e.g. 12, 15"
              value={offeringIdsText}
              onChange={(e) => setOfferingIdsText(e.target.value)}
            />
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Issuance</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.issuance?.auto_on_enroll)}
                onChange={(e) => updateIssuance({ auto_on_enroll: e.target.checked, admin_only: false })}
              />
              Auto-apply on enroll (when attached to class/program)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.issuance?.admin_only)}
                onChange={(e) =>
                  updateIssuance({ admin_only: e.target.checked, auto_on_enroll: false })
                }
              />
              Admin issue only
            </label>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Promo code (optional)</label>
              <input
                className={inputClass}
                placeholder="TRYFREE"
                value={String(form.issuance?.promo_code ?? '')}
                onChange={(e) => updateIssuance({ promo_code: e.target.value.trim().toUpperCase() })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.debitsFreeClassAllowance}
              onChange={(e) => update({ debitsFreeClassAllowance: e.target.checked })}
            />
            Count against member free-class allowance
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Valid from</label>
              <input
                type="date"
                className={inputClass}
                value={form.startsAt ? form.startsAt.slice(0, 10) : ''}
                onChange={(e) =>
                  update({
                    startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Valid through</label>
              <input
                type="date"
                className={inputClass}
                value={form.endsAt ? form.endsAt.slice(0, 10) : ''}
                onChange={(e) =>
                  update({
                    endsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Max redemptions</label>
            <input
              type="number"
              min={0}
              placeholder="Unlimited"
              className={inputClass}
              value={form.maxRedemptions ?? ''}
              onChange={(e) =>
                update({
                  maxRedemptions: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                })
              }
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => update({ active: e.target.checked })}
            />
            Active
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FreePassEditor
