import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import {
  fetchClassEvents,
  fetchClassEventSchedulingFormId,
  updateTopProgram,
  type ClassEvent,
  type TopProgram,
} from '../../utils/programsApi'
import {
  adminFetchAllCategories,
  adminFetchOfferings,
  adminSetSchedulingFormActive,
  adminUpdateCategory,
  isNoCategoryCategory,
  type SchedulingCategory,
} from '../../utils/schedulingApi'

interface Props {
  program: TopProgram
  onSaved: (program: TopProgram) => void
  onSelectClassEvent: (classEvent: ClassEvent) => void | Promise<void>
  onOpenForm: () => void
}

type SetupStatus = 'none' | 'partial' | 'ready'

const SCHEDULING_VISIBILITY_LABEL = 'Show on /scheduling page'

function classShowsOnScheduling(classEvent: ClassEvent, programSchedulingActive: boolean): boolean {
  if (!programSchedulingActive) return false
  return classEvent.schedulingFormActive !== false
}

async function classSetupStatus(classEvent: ClassEvent): Promise<SetupStatus> {
  if (!classEvent.schedulingFormId) return 'none'
  try {
    const offerings = await adminFetchOfferings(classEvent.schedulingFormId)
    if (offerings.length === 0) return 'partial'
    return 'ready'
  } catch {
    return 'partial'
  }
}

const AdminSchedulingOverview = ({
  program,
  onSaved,
  onSelectClassEvent,
  onOpenForm,
}: Props) => {
  const [schedulingActive, setSchedulingActive] = useState(program.schedulingActive ?? false)
  const [savingProgram, setSavingProgram] = useState(false)
  const [programError, setProgramError] = useState<string | null>(null)
  const [classEvents, setClassEvents] = useState<ClassEvent[]>([])
  const [categories, setCategories] = useState<SchedulingCategory[]>([])
  const [setupByClassId, setSetupByClassId] = useState<Record<number, SetupStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingClassId, setTogglingClassId] = useState<number | null>(null)
  const [togglingCategoryId, setTogglingCategoryId] = useState<number | null>(null)
  const [bulkTogglingClasses, setBulkTogglingClasses] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [events, cats] = await Promise.all([
        fetchClassEvents({ programsId: program.id, archived: false }),
        adminFetchAllCategories(),
      ])
      setClassEvents(events)
      setCategories(cats)
      const statuses: Record<number, SetupStatus> = {}
      await Promise.all(
        events.map(async (ev) => {
          statuses[ev.id] = await classSetupStatus(ev)
        }),
      )
      setSetupByClassId(statuses)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load program overview')
    } finally {
      setLoading(false)
    }
  }, [program.id])

  useEffect(() => {
    setSchedulingActive(program.schedulingActive ?? false)
    void loadData()
  }, [program.id, program.schedulingActive, loadData])

  const programCategories = useMemo(() => {
    const linkedIds = new Set<number>()
    for (const ev of classEvents) {
      for (const cat of ev.schedulingCategories ?? []) {
        if (cat.id != null) linkedIds.add(cat.id)
      }
    }
    return categories.filter((cat) => linkedIds.has(cat.id) && !isNoCategoryCategory(cat))
  }, [classEvents, categories])

  const setClassSchedulingVisible = async (classEvent: ClassEvent, visible: boolean) => {
    let formId = classEvent.schedulingFormId
    if (!formId) {
      formId = await fetchClassEventSchedulingFormId(classEvent.id)
    }
    await adminSetSchedulingFormActive(formId, visible)
    setClassEvents((prev) =>
      prev.map((ev) =>
        ev.id === classEvent.id
          ? { ...ev, schedulingFormId: formId, schedulingFormActive: visible }
          : ev,
      ),
    )
  }

  const handleProgramSchedulingToggle = async (checked: boolean) => {
    setSavingProgram(true)
    setProgramError(null)
    try {
      const updated = await updateTopProgram(program.id, { schedulingActive: checked })
      setSchedulingActive(updated.schedulingActive ?? false)
      onSaved(updated)
      await loadData()
    } catch (e) {
      setProgramError(e instanceof Error ? e.message : 'Failed to update program visibility')
    } finally {
      setSavingProgram(false)
    }
  }

  const handleClassSchedulingToggle = async (classEvent: ClassEvent, checked: boolean) => {
    setTogglingClassId(classEvent.id)
    try {
      await setClassSchedulingVisible(classEvent, checked)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update class visibility on /scheduling')
    } finally {
      setTogglingClassId(null)
    }
  }

  const handleBulkClassSchedulingVisibility = async (visible: boolean) => {
    if (classEvents.length === 0 || !schedulingActive) return
    setBulkTogglingClasses(true)
    try {
      const updates = await Promise.all(
        classEvents.map(async (classEvent) => {
          let formId = classEvent.schedulingFormId
          if (!formId) {
            formId = await fetchClassEventSchedulingFormId(classEvent.id)
          }
          await adminSetSchedulingFormActive(formId, visible)
          return { id: classEvent.id, formId, visible }
        }),
      )
      setClassEvents((prev) =>
        prev.map((ev) => {
          const hit = updates.find((u) => u.id === ev.id)
          return hit
            ? { ...ev, schedulingFormId: hit.formId, schedulingFormActive: hit.visible }
            : ev
        }),
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update class visibility')
    } finally {
      setBulkTogglingClasses(false)
    }
  }

  const handleCategorySchedulingToggle = async (category: SchedulingCategory, checked: boolean) => {
    setTogglingCategoryId(category.id)
    try {
      await adminUpdateCategory(category.id, { name: category.name, isActive: checked })
      setCategories((prev) =>
        prev.map((cat) => (cat.id === category.id ? { ...cat, isActive: checked } : cat)),
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update category')
    } finally {
      setTogglingCategoryId(null)
    }
  }

  const handleClassClick = async (classEvent: ClassEvent) => {
    await onSelectClassEvent(classEvent)
    onOpenForm()
  }

  const classVisibilityDisabled = !schedulingActive || bulkTogglingClasses

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading program overview…
      </div>
    )
  }

  return (
    <div className="space-y-8 w-full">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {programError && <p className="text-sm text-red-600">{programError}</p>}

      <section className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Program</p>
          <h4 className="text-xl font-bold text-black mt-1">{program.displayName}</h4>
          {program.description ? (
            <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{program.description}</p>
          ) : (
            <p className="text-sm text-gray-500 mt-2 italic">No description</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Edit title and description in Admin → Classes → Programs.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold text-black cursor-pointer">
          <input
            type="checkbox"
            checked={schedulingActive}
            disabled={savingProgram}
            onChange={(e) => handleProgramSchedulingToggle(e.target.checked)}
            className="rounded border-gray-300"
          />
          {SCHEDULING_VISIBILITY_LABEL}
        </label>
        {!schedulingActive && (
          <p className="text-xs text-gray-500">
            This program and its classes are hidden from the public /scheduling page until you turn
            this on. Turning it back on selects all classes by default — adjust which ones to show
            below.
          </p>
        )}
      </section>

      {programCategories.length > 0 && (
        <section>
          <h4 className="text-base font-bold text-black mb-3">Class variations</h4>
          <p className="text-sm text-gray-600 mb-3">
            Categories linked to classes in this program. Unchecked variations are hidden from
            signup on /scheduling.
          </p>
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
            {programCategories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center justify-between gap-4 px-4 py-3 bg-white text-sm"
              >
                <span className="font-semibold text-black">{cat.name}</span>
                <label className="flex items-center gap-2 text-gray-700 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cat.isActive}
                    disabled={togglingCategoryId === cat.id}
                    onChange={(e) => handleCategorySchedulingToggle(cat, e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  {SCHEDULING_VISIBILITY_LABEL}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="text-base font-bold text-black mb-3">Classes &amp; Events</h4>
        <p className="text-sm text-gray-600 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Select a class to configure its signup form, offerings, and slots.</span>
          {classEvents.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs">
              <button
                type="button"
                disabled={classVisibilityDisabled}
                onClick={() => void handleBulkClassSchedulingVisibility(true)}
                className="text-vortex-red hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
              >
                Select all
              </button>
              <span className="text-gray-400">|</span>
              <button
                type="button"
                disabled={classVisibilityDisabled}
                onClick={() => void handleBulkClassSchedulingVisibility(false)}
                className="text-vortex-red hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
              >
                Deselect all
              </button>
            </span>
          )}
        </p>
        {classEvents.length === 0 ? (
          <p className="text-sm text-gray-600">No classes yet. Add classes in Admin → Classes.</p>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
            {classEvents.map((classEvent) => {
              const setup = setupByClassId[classEvent.id] ?? 'none'
              const showsOnScheduling = classShowsOnScheduling(classEvent, schedulingActive)
              return (
                <li key={classEvent.id} className="bg-white">
                  <button
                    type="button"
                    onClick={() => handleClassClick(classEvent)}
                    className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-black">{classEvent.displayName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {setup === 'ready'
                          ? 'Offerings configured'
                          : setup === 'partial'
                            ? 'Form exists — add offerings'
                            : 'Not set up for scheduling'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                  <div className="px-4 pb-3 flex items-center gap-3 border-t border-gray-100 pt-2">
                    <label
                      className={`flex items-center gap-2 text-sm text-gray-700 ${
                        classVisibilityDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={showsOnScheduling}
                        disabled={classVisibilityDisabled || togglingClassId === classEvent.id}
                        onChange={(e) => handleClassSchedulingToggle(classEvent, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      {SCHEDULING_VISIBILITY_LABEL}
                    </label>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default AdminSchedulingOverview
