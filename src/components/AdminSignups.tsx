import { useCallback, useState } from 'react'
import { ChevronDown, ChevronUp, ClipboardList, Loader2 } from 'lucide-react'
import AdminArchivedSignupsPanel from './admin/AdminArchivedSignupsPanel'
import AdminClassPicker from './admin/AdminClassPicker'
import AdminSignupsTable from './admin/AdminSignupsTable'
import OrphanedSignupsPanel from './scheduling/OrphanedSignupsPanel'
import {
  adminFetchOrphanedSignups,
  adminFetchSchedulingForm,
  adminFetchSchedulingForms,
  adminFetchSignups,
  type SchedulingFormDetail,
  type SchedulingFormSummary,
  type SchedulingOrphanedSignup,
  type SchedulingSignup,
} from '../utils/schedulingApi'
import {
  fetchClassEventSchedulingFormId,
  type ClassEvent,
} from '../utils/programsApi'

const AdminSignups = () => {
  const [selectedClassEvent, setSelectedClassEvent] = useState<ClassEvent | null>(null)
  const [formId, setFormId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SchedulingFormDetail | null>(null)
  const [signups, setSignups] = useState<SchedulingSignup[]>([])
  const [archivedSignups, setArchivedSignups] = useState<SchedulingSignup[]>([])
  const [orphanedSignups, setOrphanedSignups] = useState<SchedulingOrphanedSignup[]>([])
  const [forms, setForms] = useState<SchedulingFormSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orphanedOpen, setOrphanedOpen] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)

  const loadClassSignups = useCallback(async (classEvent: ClassEvent) => {
    setLoading(true)
    setError(null)
    try {
      const id =
        classEvent.schedulingFormId ?? (await fetchClassEventSchedulingFormId(classEvent.id))
      setFormId(id)
      const [formDetail, signupRows, archivedRows, orphanedRows, allForms] = await Promise.all([
        adminFetchSchedulingForm(id),
        adminFetchSignups(id),
        adminFetchSignups(id, { archived: true }),
        adminFetchOrphanedSignups(id),
        adminFetchSchedulingForms(),
      ])
      setDetail(formDetail)
      setSignups(signupRows)
      setArchivedSignups(archivedRows)
      setOrphanedSignups(orphanedRows)
      setForms(allForms)
    } catch (e) {
      setFormId(null)
      setDetail(null)
      setSignups([])
      setArchivedSignups([])
      setOrphanedSignups([])
      setError(e instanceof Error ? e.message : 'Failed to load signups')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelectClass = (classEvent: ClassEvent) => {
    setSelectedClassEvent(classEvent)
    setOrphanedOpen(false)
    setArchivedOpen(false)
    void loadClassSignups(classEvent)
  }

  const refresh = async () => {
    if (!formId) return
    const [formDetail, signupRows, archivedRows, orphanedRows] = await Promise.all([
      adminFetchSchedulingForm(formId),
      adminFetchSignups(formId),
      adminFetchSignups(formId, { archived: true }),
      adminFetchOrphanedSignups(formId),
    ])
    setDetail(formDetail)
    setSignups(signupRows)
    setArchivedSignups(archivedRows)
    setOrphanedSignups(orphanedRows)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-vortex-red" />
          Class Registrations
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          View and manage registrations for each class scheduling form.
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

      {!loading && selectedClassEvent && formId && (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-black">{selectedClassEvent.displayName}</h3>
          <AdminSignupsTable
            signups={signups}
            detail={detail}
            formId={formId}
            onRefresh={refresh}
          />

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setArchivedOpen((open) => !open)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
            >
              <span className="font-semibold text-gray-900">
                Archived signups
                {archivedSignups.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    ({archivedSignups.length})
                  </span>
                )}
              </span>
              {archivedOpen ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
            {archivedOpen && (
              <div className="p-4 border-t border-gray-200">
                <AdminArchivedSignupsPanel signups={archivedSignups} onRefresh={refresh} />
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOrphanedOpen((open) => !open)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
            >
              <span className="font-semibold text-gray-900">
                Orphaned signups
                {orphanedSignups.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    ({orphanedSignups.length})
                  </span>
                )}
              </span>
              {orphanedOpen ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
            {orphanedOpen && (
              <div className="p-4 border-t border-gray-200">
                <OrphanedSignupsPanel
                  orphanedSignups={orphanedSignups}
                  forms={forms}
                  onRefresh={refresh}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !selectedClassEvent && (
        <p className="text-gray-600 text-sm">Select a class above to view signups.</p>
      )}
    </div>
  )
}

export default AdminSignups
