import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  adminFetchSchedulingForm,
  adminSaveSchedulingForm,
} from '../../utils/schedulingApi'
import type { AdminProgramPricing, TopProgram } from '../../utils/programsApi'
import { formatSchedulingCosts } from '../../utils/classSchedulingSummary'
import PricingCostsFields from './PricingCostsFields'
import {
  pricingValuesFromClass,
  type PricingCostsValues,
} from './pricingCosts'
import PricingBenefitSelectionField from './PricingBenefitSelectionField'

interface Props {
  classRow: AdminProgramPricing
  program: TopProgram
  onRefresh: () => Promise<void>
}

const AdminPricingClassPanel = ({ classRow, onRefresh }: Props) => {
  const [values, setValues] = useState<PricingCostsValues>(() => pricingValuesFromClass(classRow))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [formTitle, setFormTitle] = useState(classRow.displayName)

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
  }, [formId, classRow.displayName])

  const handleCustomize = () => {
    setValues(pricingValuesFromClass(classRow))
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


  if (!formId) {
    return (
      <p className="text-sm text-gray-500">
        No scheduling form for this class yet. Set up scheduling first.
      </p>
    )
  }

  return (
    <div className="space-y-4 text-sm">
      {inherits && !editing ? (
        <div className="space-y-3">
          <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-800">
            Carried-over class pricing
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
              Class pricing
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
              Save class pricing
            </button>
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

    </div>
  )
}

export default AdminPricingClassPanel
