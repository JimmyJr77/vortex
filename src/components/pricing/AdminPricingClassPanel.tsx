import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  adminFetchFormCategories,
  adminFetchSchedulingForm,
  adminSaveSchedulingForm,
  resetClassPricing,
  type SchedulingCategory,
} from '../../utils/schedulingApi'
import type { AdminProgramPricing, TopProgram } from '../../utils/programsApi'
import { formatSchedulingCosts } from '../../utils/classSchedulingSummary'
import PricingCostsFields, {
  pricingValuesFromClass,
  pricingValuesFromProgram,
  type PricingCostsValues,
} from './PricingCostsFields'
import ConfirmPricingActionModal from './ConfirmPricingActionModal'
import PricingBenefitSelectionField from './PricingBenefitSelectionField'

interface Props {
  classRow: AdminProgramPricing
  program: TopProgram
  onRefresh: () => Promise<void>
}

const AdminPricingClassPanel = ({ classRow, program, onRefresh }: Props) => {
  const [values, setValues] = useState<PricingCostsValues>(() => pricingValuesFromClass(classRow))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [formTitle, setFormTitle] = useState(classRow.displayName)
  const [categories, setCategories] = useState<SchedulingCategory[]>([])

  const inherits = !classRow.pricingOverridesProgram
  const formId = classRow.schedulingFormId

  useEffect(() => {
    setValues(pricingValuesFromClass(classRow))
    setEditing(false)
    setSaved(false)
    setError(null)
  }, [classRow])

  useEffect(() => {
    if (!formId) return
    void adminFetchSchedulingForm(formId)
      .then((form) => setFormTitle(form.title))
      .catch(() => setFormTitle(classRow.displayName))
    void adminFetchFormCategories(formId)
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [formId, classRow.displayName])

  const programDefaultsLabel = formatSchedulingCosts({
    slotCostMonthlyCents: program.pricingSlotCostMonthlyCents,
    freeSlotsPerUser: program.pricingFreeSlotsPerUser,
    maxFreeSlotsTotal: program.pricingMaxFreeSlotsTotal,
  })

  const handleCustomize = () => {
    setValues(pricingValuesFromProgram(program))
    setEditing(true)
    setSaved(false)
  }

  const handleSaveOverride = async () => {
    if (!formId) {
      setError('No scheduling form linked to this class')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await adminSaveSchedulingForm(
        {
          title: formTitle,
          slotCostMonthlyCents: values.slotCostMonthlyCents,
          costUnit: values.costUnit,
          freeSlotsPerUser: values.freeSlotsPerUser,
          maxFreeSlotsTotal:
            values.maxFreeSlotsTotal === '' ? null : Number(values.maxFreeSlotsTotal),
          pricingOverridesProgram: true,
        },
        formId,
      )
      await onRefresh()
      setEditing(false)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!formId) return
    setResetting(true)
    setError(null)
    try {
      await resetClassPricing(formId)
      await onRefresh()
      setConfirmReset(false)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset')
    } finally {
      setResetting(false)
    }
  }

  if (!formId) {
    return (
      <p className="text-sm text-gray-500">
        No scheduling form for this class yet. Set up scheduling first.
      </p>
    )
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg bg-gray-100 border border-gray-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
          Program defaults ({program.displayName})
        </p>
        <p className="text-gray-800">{programDefaultsLabel}</p>
      </div>

      {inherits && !editing ? (
        <div className="space-y-3">
          <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-800">
            Using program defaults
          </span>
          <p className="text-gray-700">
            Effective pricing:{' '}
            {formatSchedulingCosts({
              slotCostMonthlyCents: classRow.slotCostMonthlyCents,
              freeSlotsPerUser: classRow.freeSlotsPerUser,
              maxFreeSlotsTotal: classRow.maxFreeSlotsTotal,
            })}
          </p>
          <button
            type="button"
            onClick={handleCustomize}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Customize pricing
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {!inherits && (
            <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-900">
              Custom override
            </span>
          )}
          <PricingCostsFields
            values={values}
            onChange={setValues}
            totalFreeSlotsLabel="Total free slots (class-wide)"
            totalFreeSlotsHelp="Leave empty for unlimited. Caps free slots across all members in this class."
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveOverride}
              disabled={saving}
              className="bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save override
            </button>
            {!inherits && (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                disabled={resetting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
              >
                Reset to program defaults
              </button>
            )}
            {editing && inherits && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setValues(pricingValuesFromClass(classRow))
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            )}
            {saved && <span className="text-green-600 text-sm font-medium">Saved</span>}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {formId != null && (
        <PricingBenefitSelectionField
          scopeLevel="class"
          scopeRefId={formId}
          title="Class discounts & free passes"
        />
      )}

      {categories.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-sm font-bold text-gray-900">Category-level benefits</h5>
          {categories.map((cat) => (
            <PricingBenefitSelectionField
              key={cat.id}
              scopeLevel="category"
              scopeRefId={cat.id}
              title={cat.name}
              compact
            />
          ))}
        </div>
      )}

      <ConfirmPricingActionModal
        open={confirmReset}
        title="Reset class pricing"
        message={`Reset pricing for "${classRow.displayName}" to ${program.displayName} program defaults?`}
        confirmLabel="Reset"
        loading={resetting}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => void handleReset()}
      />
    </div>
  )
}

export default AdminPricingClassPanel
