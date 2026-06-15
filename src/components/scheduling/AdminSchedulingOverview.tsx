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
  adminSetSchedulingFormEnrollSites,
  adminUpdateCategory,
  isNoCategoryCategory,
  type SchedulingCategory,
} from '../../utils/schedulingApi'
import {
  ALL_ENROLL_SITES,
  normalizeEnrollSites,
  type EnrollSiteKey,
} from '../../config/enrollSites'
import EnrollSiteVisibilityControls from './EnrollSiteVisibilityControls'

interface Props {
  program: TopProgram
  onSaved: (program: TopProgram) => void
  onSelectClassEvent: (classEvent: ClassEvent) => void | Promise<void>
  onOpenForm: () => void
}

type SetupStatus = 'none' | 'partial' | 'ready'

function programEnrollSites(program: TopProgram): EnrollSiteKey[] {
  return normalizeEnrollSites(program.schedulingEnrollSites, program.schedulingActive)
}

function classEnrollSites(classEvent: ClassEvent): EnrollSiteKey[] {
  return normalizeEnrollSites(
    classEvent.schedulingFormEnrollSites ?? undefined,
    classEvent.schedulingFormActive,
  )
}

function categoryEnrollSites(category: SchedulingCategory): EnrollSiteKey[] {
  return normalizeEnrollSites(category.enrollSites, category.isActive)
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
  const [programEnrollSiteSelection, setProgramEnrollSiteSelection] = useState<EnrollSiteKey[]>(
    () => programEnrollSites(program),
  )
  const [savingProgram, setSavingProgram] = useState(false)
  const [programError, setProgramError] = useState<string | null>(null)
  const [classEvents, setClassEvents] = useState<ClassEvent[]>([])
  const [categories, setCategories] = useState<SchedulingCategory[]>([])
  const [setupByClassId, setSetupByClassId] = useState<Record<number, SetupStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingClassId, setSavingClassId] = useState<number | null>(null)
  const [savingCategoryId, setSavingCategoryId] = useState<number | null>(null)
  const [bulkSavingClasses, setBulkSavingClasses] = useState(false)

  const programVisible = programEnrollSiteSelection.length > 0

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
    setProgramEnrollSiteSelection(programEnrollSites(program))
    void loadData()
  }, [program.id, program.schedulingActive, program.schedulingEnrollSites, loadData])

  const programCategories = useMemo(() => {
    const linkedIds = new Set<number>()
    for (const ev of classEvents) {
      for (const cat of ev.schedulingCategories ?? []) {
        if (cat.id != null) linkedIds.add(cat.id)
      }
    }
    return categories.filter((cat) => linkedIds.has(cat.id) && !isNoCategoryCategory(cat))
  }, [classEvents, categories])

  const saveClassEnrollSites = async (classEvent: ClassEvent, enrollSites: EnrollSiteKey[]) => {
    let formId = classEvent.schedulingFormId
    if (!formId) {
      formId = await fetchClassEventSchedulingFormId(classEvent.id)
    }
    await adminSetSchedulingFormEnrollSites(formId, enrollSites)
    setClassEvents((prev) =>
      prev.map((ev) =>
        ev.id === classEvent.id
          ? {
              ...ev,
              schedulingFormId: formId,
              schedulingFormActive: enrollSites.length > 0,
              schedulingFormEnrollSites: enrollSites,
            }
          : ev,
      ),
    )
  }

  const handleProgramEnrollSitesChange = async (sites: EnrollSiteKey[]) => {
    setSavingProgram(true)
    setProgramError(null)
    try {
      const updated = await updateTopProgram(program.id, { schedulingEnrollSites: sites })
      setProgramEnrollSiteSelection(programEnrollSites(updated))
      onSaved(updated)
      await loadData()
    } catch (e) {
      setProgramError(e instanceof Error ? e.message : 'Failed to update program visibility')
    } finally {
      setSavingProgram(false)
    }
  }

  const handleClassEnrollSitesChange = async (
    classEvent: ClassEvent,
    sites: EnrollSiteKey[],
  ) => {
    setSavingClassId(classEvent.id)
    try {
      await saveClassEnrollSites(classEvent, sites)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update class enroll visibility')
    } finally {
      setSavingClassId(null)
    }
  }

  const handleBulkClassEnrollSites = async (sites: EnrollSiteKey[]) => {
    if (classEvents.length === 0 || !programVisible) return
    setBulkSavingClasses(true)
    try {
      await Promise.all(classEvents.map((classEvent) => saveClassEnrollSites(classEvent, sites)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update class visibility')
    } finally {
      setBulkSavingClasses(false)
    }
  }

  const handleCategoryEnrollSitesChange = async (
    category: SchedulingCategory,
    sites: EnrollSiteKey[],
  ) => {
    setSavingCategoryId(category.id)
    try {
      const updated = await adminUpdateCategory(category.id, {
        name: category.name,
        enrollSites: sites,
      })
      setCategories((prev) =>
        prev.map((cat) => (cat.id === category.id ? { ...cat, ...updated } : cat)),
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update category')
    } finally {
      setSavingCategoryId(null)
    }
  }

  const handleClassClick = async (classEvent: ClassEvent) => {
    await onSelectClassEvent(classEvent)
    onOpenForm()
  }

  const classVisibilityDisabled = !programVisible || bulkSavingClasses

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
        <EnrollSiteVisibilityControls
          sites={programEnrollSiteSelection}
          disabled={savingProgram}
          onChange={(sites) => void handleProgramEnrollSitesChange(sites)}
        />
        {!programVisible && (
          <p className="text-xs text-gray-500">
            This program and its classes are hidden from public enroll pages until you select at
            least one site. Turning visibility back on selects all classes on all sites by default
            — adjust which ones to show below.
          </p>
        )}
      </section>

      {programCategories.length > 0 && (
        <section>
          <h4 className="text-base font-bold text-black mb-3">Class variations</h4>
          <p className="text-sm text-gray-600 mb-3">
            Categories linked to classes in this program. Unchecked sites hide that variation from
            signup on the matching enroll page.
          </p>
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
            {programCategories.map((cat) => (
              <li
                key={cat.id}
                className="flex flex-col gap-3 px-4 py-3 bg-white text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-semibold text-black">{cat.name}</span>
                <EnrollSiteVisibilityControls
                  sites={categoryEnrollSites(cat)}
                  disabled={!programVisible || savingCategoryId === cat.id}
                  layout="inline"
                  onChange={(sites) => void handleCategoryEnrollSitesChange(cat, sites)}
                />
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
                onClick={() => void handleBulkClassEnrollSites([...ALL_ENROLL_SITES])}
                className="text-vortex-red hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
              >
                Select all sites
              </button>
              <span className="text-gray-400">|</span>
              <button
                type="button"
                disabled={classVisibilityDisabled}
                onClick={() => void handleBulkClassEnrollSites([])}
                className="text-vortex-red hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
              >
                Clear all sites
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
                  <div
                    className="px-4 pb-3 border-t border-gray-100 pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EnrollSiteVisibilityControls
                      sites={classEnrollSites(classEvent)}
                      disabled={classVisibilityDisabled || savingClassId === classEvent.id}
                      layout="inline"
                      onChange={(sites) => void handleClassEnrollSitesChange(classEvent, sites)}
                    />
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
