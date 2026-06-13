import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  adminSaveSchedulingForm,
  type SchedulingFormDetail,
} from '../../utils/schedulingApi'

interface Props {
  formId: number
  detail: SchedulingFormDetail
  onSaved: () => Promise<void>
}

const AdminSchedulingCosts = ({ formId, detail, onSaved }: Props) => {
  const [maxSlotsPerUser, setMaxSlotsPerUser] = useState<number | ''>(
    detail.maxSlotsPerUser ?? '',
  )
  const [slotCostMonthlyCents, setSlotCostMonthlyCents] = useState(
    detail.slotCostMonthlyCents ?? 0,
  )
  const [freeSlotsPerUser, setFreeSlotsPerUser] = useState(detail.freeSlotsPerUser ?? 0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMaxSlotsPerUser(detail.maxSlotsPerUser ?? '')
    setSlotCostMonthlyCents(detail.slotCostMonthlyCents ?? 0)
    setFreeSlotsPerUser(detail.freeSlotsPerUser ?? 0)
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
          maxSlotsPerUser: maxSlotsPerUser === '' ? null : Number(maxSlotsPerUser),
          slotCostMonthlyCents,
          freeSlotsPerUser,
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
      <div>
        <label className="block text-sm font-semibold mb-1">Max slots per user</label>
        <input
          type="number"
          min={1}
          placeholder="Unlimited"
          value={maxSlotsPerUser}
          onChange={(e) => {
            const v = e.target.value
            setMaxSlotsPerUser(v === '' ? '' : Math.max(1, Number(v)))
            setSaved(false)
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2"
        />
        <p className="text-xs text-gray-500 mt-1">Leave empty for no limit.</p>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Cost per slot per month ($)</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={slotCostMonthlyCents / 100}
          onChange={(e) => {
            setSlotCostMonthlyCents(Math.round((Number(e.target.value) || 0) * 100))
            setSaved(false)
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Free slots per user</label>
        <input
          type="number"
          min={0}
          value={freeSlotsPerUser}
          onChange={(e) => {
            setFreeSlotsPerUser(Math.max(0, Number(e.target.value) || 0))
            setSaved(false)
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2"
        />
      </div>
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
