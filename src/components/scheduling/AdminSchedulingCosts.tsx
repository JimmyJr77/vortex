import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  adminSaveSchedulingForm,
  type SchedulingFormDetail,
} from '../../utils/schedulingApi'
import PricingCostsFields, {
  pricingValuesFromClass,
  type PricingCostsValues,
} from '../pricing/PricingCostsFields'

interface Props {
  formId: number
  detail: SchedulingFormDetail
  onSaved: () => Promise<void>
}

const AdminSchedulingCosts = ({ formId, detail, onSaved }: Props) => {
  const [values, setValues] = useState<PricingCostsValues>(() =>
    pricingValuesFromClass({ ...detail, pricingOverridesProgram: true }),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValues(pricingValuesFromClass({ ...detail, pricingOverridesProgram: true }))
    setSaved(false)
  }, [detail])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await adminSaveSchedulingForm(
        {
          title: detail.title,
          description: detail.description,
          startDate: detail.startDate,
          endDate: detail.endDate,
          isActive: detail.isActive,
          slotCostMonthlyCents: values.slotCostMonthlyCents,
          freeSlotsPerUser: values.freeSlotsPerUser,
          maxFreeSlotsTotal:
            values.maxFreeSlotsTotal === '' ? null : Number(values.maxFreeSlotsTotal),
          pricingOverridesProgram: detail.pricingOverridesProgram ?? true,
        },
        formId,
      )
      await onSaved()
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <h3 className="text-lg font-bold text-black">Costs</h3>
        <p className="text-sm text-gray-600 mt-1">Pricing and slot limits for this class or event.</p>
      </div>
      <PricingCostsFields
        values={values}
        onChange={setValues}
        totalFreeSlotsLabel="Total free slots (class-wide)"
        totalFreeSlotsHelp="Leave empty for unlimited. Caps free slots across all members in this class."
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-vortex-red text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save costs
        </button>
        {saved && <span className="text-green-600 text-sm font-medium">Saved</span>}
      </div>
    </div>
  )
}

export default AdminSchedulingCosts
