import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import {
  type AdditionalFee,
  type AdditionalFeeApplyBasis,
  type AdditionalFeeInput,
  type AdditionalFeeTriggerType,
  type DiscountScopeLevel,
  adminFetchSchedulingForms,
} from '../../utils/schedulingApi'
import { fetchDisciplineTags, fetchTopPrograms } from '../../utils/programsApi'
import {
  FEE_APPLY_BASIS_LABELS,
  FEE_TEMPLATES,
  FEE_TRIGGER_LABELS,
  describeFeeSummary,
} from '../../utils/additionalFeeModel'

interface Props {
  open: boolean
  fee: AdditionalFee | null
  onSave: (input: AdditionalFeeInput) => Promise<void>
  onClose: () => void
}

const controlClass =
  'w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-vortex-red focus:outline-none'

function toForm(fee: AdditionalFee | null): AdditionalFeeInput {
  if (fee) {
    return {
      name: fee.name,
      description: fee.description,
      amountCents: fee.amountCents,
      applyBasis: fee.applyBasis,
      applyInterval: fee.applyInterval,
      triggerType: fee.triggerType,
      scopeLevel: fee.scopeLevel,
      scopeRefId: fee.scopeRefId,
      active: fee.active,
      startsAt: fee.startsAt,
      endsAt: fee.endsAt,
      priority: fee.priority,
      config: fee.config ?? {},
    }
  }
  return {
    name: '',
    description: null,
    amountCents: 0,
    applyBasis: 'per_order',
    applyInterval: 1,
    triggerType: 'each_enrollment',
    scopeLevel: 'global',
    scopeRefId: null,
    active: true,
    startsAt: null,
    endsAt: null,
    priority: 100,
    config: {},
  }
}

const AdditionalFeeEditor = ({ open, fee, onSave, onClose }: Props) => {
  const [form, setForm] = useState<AdditionalFeeInput>(() => toForm(fee))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sports, setSports] = useState<Array<{ id: number; name: string }>>([])
  const [programs, setPrograms] = useState<Array<{ id: number; displayName: string }>>([])
  const [classes, setClasses] = useState<Array<{ id: number; title: string }>>([])

  useEffect(() => {
    if (!open) return
    setForm(toForm(fee))
    setError(null)
    void Promise.all([
      fetchDisciplineTags(),
      fetchTopPrograms(false),
      adminFetchSchedulingForms(),
    ]).then(([sportRows, programRows, formRows]) => {
      setSports(sportRows)
      setPrograms(programRows.map((p) => ({ id: p.id, displayName: p.displayName })))
      setClasses(formRows.map((f) => ({ id: f.id, title: f.title })))
    })
  }, [open, fee])

  const summary = useMemo(
    () =>
      form.name.trim()
        ? describeFeeSummary({ ...form, id: 0, facilityId: null } as AdditionalFee)
        : null,
    [form],
  )

  if (!open) return null

  const update = (patch: Partial<AdditionalFeeInput>) => setForm((prev) => ({ ...prev, ...patch }))

  const applyTemplate = (templateId: string) => {
    const template = FEE_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    update({
      name: template.defaults.name ?? form.name,
      applyBasis: template.defaults.applyBasis ?? form.applyBasis,
      applyInterval: template.defaults.applyInterval ?? form.applyInterval,
      triggerType: template.defaults.triggerType ?? form.triggerType,
    })
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    if (form.scopeLevel !== 'global' && form.scopeRefId == null) {
      setError('Select what this fee applies to')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        amountCents: Math.max(0, Math.round(form.amountCents)),
        applyInterval: Math.max(1, form.applyInterval || 1),
        scopeRefId: form.scopeLevel === 'global' ? null : form.scopeRefId,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const scopeOptions = (() => {
    switch (form.scopeLevel) {
      case 'sport':
        return sports.map((s) => ({ id: s.id, label: s.name }))
      case 'program':
        return programs.map((p) => ({ id: p.id, label: p.displayName }))
      case 'class':
        return classes.map((c) => ({ id: c.id, label: c.title }))
      default:
        return []
    }
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{fee ? 'Edit fee' : 'New additional fee'}</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!fee && (
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Start from template</label>
              <select
                className={controlClass}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) applyTemplate(e.target.value)
                  e.target.value = ''
                }}
              >
                <option value="">Choose a template…</option>
                {FEE_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Name</label>
            <input
              className={controlClass}
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Annual Fee"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Description (optional)</label>
            <textarea
              className={`${controlClass} h-20 py-2`}
              value={form.description ?? ''}
              onChange={(e) => update({ description: e.target.value || null })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Amount ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className={controlClass}
                value={form.amountCents / 100}
                onChange={(e) =>
                  update({ amountCents: Math.round((Number(e.target.value) || 0) * 100) })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Charged</label>
              <select
                className={controlClass}
                value={form.applyBasis}
                onChange={(e) => update({ applyBasis: e.target.value as AdditionalFeeApplyBasis })}
              >
                {(Object.keys(FEE_APPLY_BASIS_LABELS) as AdditionalFeeApplyBasis[]).map((b) => (
                  <option key={b} value={b}>
                    {FEE_APPLY_BASIS_LABELS[b]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.applyBasis === 'per_month' && (
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Every N months</label>
              <input
                type="number"
                min={1}
                className={controlClass}
                value={form.applyInterval}
                onChange={(e) => update({ applyInterval: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">When it applies</label>
            <select
              className={controlClass}
              value={form.triggerType}
              onChange={(e) => update({ triggerType: e.target.value as AdditionalFeeTriggerType })}
            >
              {(Object.keys(FEE_TRIGGER_LABELS) as AdditionalFeeTriggerType[]).map((t) => (
                <option key={t} value={t}>
                  {FEE_TRIGGER_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Scope</label>
              <select
                className={controlClass}
                value={form.scopeLevel}
                onChange={(e) =>
                  update({
                    scopeLevel: e.target.value as DiscountScopeLevel,
                    scopeRefId: null,
                  })
                }
              >
                <option value="global">All programs & classes</option>
                <option value="sport">Primary sport</option>
                <option value="program">Program</option>
                <option value="class">Class</option>
              </select>
            </div>
            {form.scopeLevel !== 'global' && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600">Applies to</label>
                <select
                  className={controlClass}
                  value={form.scopeRefId ?? ''}
                  onChange={(e) =>
                    update({ scopeRefId: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">Select…</option>
                  {scopeOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Starts</label>
              <input
                type="date"
                className={controlClass}
                value={form.startsAt ? form.startsAt.slice(0, 10) : ''}
                onChange={(e) =>
                  update({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Ends</label>
              <input
                type="date"
                className={controlClass}
                value={form.endsAt ? form.endsAt.slice(0, 10) : ''}
                onChange={(e) =>
                  update({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })
                }
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

          {summary && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-100">
              {summary}
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
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

export default AdditionalFeeEditor
