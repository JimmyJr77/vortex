import { useCallback, useState } from 'react'
import { DollarSign, Loader2 } from 'lucide-react'
import AdminClassPicker from './admin/AdminClassPicker'
import AdminSchedulingCosts from './scheduling/AdminSchedulingCosts'
import {
  adminFetchSchedulingForm,
  type SchedulingFormDetail,
} from '../utils/schedulingApi'
import {
  fetchClassEventSchedulingFormId,
  type ClassEvent,
} from '../utils/programsApi'

const AdminPricing = () => {
  const [selectedClassEvent, setSelectedClassEvent] = useState<ClassEvent | null>(null)
  const [formId, setFormId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SchedulingFormDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadClassPricing = useCallback(async (classEvent: ClassEvent) => {
    setLoading(true)
    setError(null)
    try {
      const id =
        classEvent.schedulingFormId ?? (await fetchClassEventSchedulingFormId(classEvent.id))
      setFormId(id)
      const formDetail = await adminFetchSchedulingForm(id)
      setDetail(formDetail)
    } catch (e) {
      setFormId(null)
      setDetail(null)
      setError(e instanceof Error ? e.message : 'Failed to load pricing')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelectClass = (classEvent: ClassEvent) => {
    setSelectedClassEvent(classEvent)
    void loadClassPricing(classEvent)
  }

  const refresh = async () => {
    if (!formId) return
    const formDetail = await adminFetchSchedulingForm(formId)
    setDetail(formDetail)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-7 h-7 text-vortex-red" />
          Pricing
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Set slot costs and limits for each class scheduling form.
        </p>
      </div>

      <AdminClassPicker
        selectedClassEventId={selectedClassEvent?.id ?? null}
        onSelectClass={handleSelectClass}
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-vortex-red" />
        </div>
      )}

      {!loading && selectedClassEvent && formId && detail && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-black">
            {selectedClassEvent.displayName}
          </h3>
          <AdminSchedulingCosts formId={formId} detail={detail} onSaved={refresh} />
        </div>
      )}

      {!loading && !selectedClassEvent && (
        <p className="text-gray-600 text-sm">Select a class above to edit pricing.</p>
      )}
    </div>
  )
}

export default AdminPricing
