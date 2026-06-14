import { useCallback, useEffect, useRef, useState } from 'react'
import { Calendar, Loader2, X } from 'lucide-react'
import AdminSchedulingSlots from './scheduling/AdminSchedulingSlots'
import AdminSchedulingOverview from './scheduling/AdminSchedulingOverview'
import AdminSchedulingFormTab from './scheduling/AdminSchedulingFormTab'
import AdminSchedulingOfferings from './scheduling/AdminSchedulingOfferings'
import AdminSchedulingLegacyForms from './scheduling/AdminSchedulingLegacyForms'
import {
  adminFetchSchedulingForm,
  adminFetchSchedulingForms,
  adminFetchSignups,
  adminFetchOrphanedSignups,
  type SchedulingFormDetail,
  type SchedulingFormSummary,
  type SchedulingSignup,
  type SchedulingOrphanedSignup,
  type SchedulingOffering,
  type CategorySelection,
} from '../utils/schedulingApi'
import ProgramsSection from './programs/ProgramsSection'
import {
  fetchClassEventSchedulingFormId,
  fetchClassEvents,
  fetchTopPrograms,
  fetchTopProgramsLegacy,
  type ClassEvent,
  type TopProgram,
} from '../utils/programsApi'
import {
  allSignupFieldKeys,
  type SchedulingNavigationIntent,
} from '../utils/schedulingNavigation'

type Panel = 'overview' | 'form' | 'offerings' | 'slots'

interface AdminSchedulingProps {
  navigationIntent?: SchedulingNavigationIntent | null
  onNavigationIntentConsumed?: () => void
}

const PANELS: { id: Panel; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'form', label: 'Form' },
  { id: 'offerings', label: 'Offerings' },
  { id: 'slots', label: 'Slots' },
]

const AdminScheduling = ({
  navigationIntent = null,
  onNavigationIntentConsumed,
}: AdminSchedulingProps) => {
  const [topPrograms, setTopPrograms] = useState<TopProgram[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(
    navigationIntent?.programsId ?? null,
  )
  const [selectedClassEvent, setSelectedClassEvent] = useState<ClassEvent | null>(null)
  const [forms, setForms] = useState<SchedulingFormSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SchedulingFormDetail | null>(null)
  const [signups, setSignups] = useState<SchedulingSignup[]>([])
  const [orphanedSignups, setOrphanedSignups] = useState<SchedulingOrphanedSignup[]>([])
  const [panel, setPanel] = useState<Panel>('overview')
  const [forwardFormSelectAll, setForwardFormSelectAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<CategorySelection>(null)
  const [selectedOffering, setSelectedOffering] = useState<SchedulingOffering | null>(null)
  const programsLoaded = useRef(false)

  const loadTopPrograms = useCallback(async () => {
    try {
      const data = await fetchTopPrograms(false)
      setTopPrograms(data.filter((p) => !p.archived))
      return data
    } catch {
      const legacy = await fetchTopProgramsLegacy(false).catch(() => [])
      setTopPrograms(legacy.filter((p) => !p.archived))
      return legacy
    }
  }, [])

  const loadForms = useCallback(async () => {
    const data = await adminFetchSchedulingForms()
    setForms(data)
    return data
  }, [])

  const loadDetail = useCallback(async (id: number) => {
    const data = await adminFetchSchedulingForm(id)
    setDetail(data)
  }, [])

  const loadSignups = useCallback(async (formId: number) => {
    const data = await adminFetchSignups(formId)
    setSignups(data)
  }, [])

  const loadOrphanedSignups = useCallback(async (formId: number) => {
    const data = await adminFetchOrphanedSignups(formId)
    setOrphanedSignups(data)
  }, [])

  const loadSchedulingForClassEvent = useCallback(
    async (classEvent: ClassEvent | null) => {
      if (!classEvent) {
        setSelectedId(null)
        setDetail(null)
        setSignups([])
        setOrphanedSignups([])
        setSelectedCategory(null)
        setSelectedOffering(null)
        return
      }
      try {
        const formId =
          classEvent.schedulingFormId ?? (await fetchClassEventSchedulingFormId(classEvent.id))
        setSelectedId(formId)
        await Promise.allSettled([
          loadDetail(formId),
          loadSignups(formId),
          loadOrphanedSignups(formId),
        ])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load scheduling form')
      }
    },
    [loadDetail, loadSignups, loadOrphanedSignups],
  )

  const handleSelectClassEvent = useCallback(
    async (event: ClassEvent | null) => {
      setSelectedClassEvent(event)
      setSelectedCategory(event?.schedulingCategoryId ?? 'none')
      setSelectedOffering(null)
      setLoading(true)
      setError(null)
      try {
        await loadSchedulingForClassEvent(event)
      } finally {
        setLoading(false)
      }
    },
    [loadSchedulingForClassEvent],
  )

  const handleSelectProgram = useCallback(
    (program: TopProgram | null) => {
      setSelectedProgramId(program?.id ?? null)
      setSelectedClassEvent(null)
      setSelectedId(null)
      setDetail(null)
      setSignups([])
      setOrphanedSignups([])
      setSelectedCategory(null)
      setSelectedOffering(null)
      setForwardFormSelectAll(false)
      setPanel('overview')
    },
    [],
  )

  const applyProgramDraftDefaults = useCallback((program: TopProgram): TopProgram => {
    const allFields = allSignupFieldKeys()
    return {
      ...program,
      schedulingActive: program.schedulingActive ?? true,
      schedulingSignupFields: allFields,
      schedulingMandateWaiver: true,
      schedulingOverviewSavedAt:
        program.schedulingOverviewSavedAt ?? new Date().toISOString(),
    }
  }, [])

  const applyNavigationIntent = useCallback(
    async (intent: SchedulingNavigationIntent, programs: TopProgram[]) => {
      const program = programs.find((p) => p.id === intent.programsId)
      if (!program) {
        throw new Error('Program not found for scheduling setup')
      }

      const draftedProgram = applyProgramDraftDefaults(program)
      setTopPrograms((prev) =>
        prev.map((p) => (p.id === draftedProgram.id ? draftedProgram : p)),
      )
      setForwardFormSelectAll(true)
      setSelectedProgramId(intent.programsId)
      setSelectedCategory(intent.categorySelection)
      setSelectedOffering(null)
      setPanel(intent.targetPanel)

      const classEvents = await fetchClassEvents({
        programsId: intent.programsId,
        archived: false,
      })
      const classEvent = classEvents.find((event) => event.id === intent.classEventId)
      if (!classEvent) {
        throw new Error('Class not found for scheduling setup')
      }

      setSelectedClassEvent(classEvent)
      const formId =
        classEvent.schedulingFormId ?? (await fetchClassEventSchedulingFormId(classEvent.id))
      setSelectedId(formId)
      await Promise.allSettled([
        loadDetail(formId),
        loadSignups(formId),
        loadOrphanedSignups(formId),
      ])
    },
    [applyProgramDraftDefaults, loadDetail, loadSignups, loadOrphanedSignups],
  )

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      // Re-apply when Classes tab sends a new navigation intent; skip idle reloads.
      if (!navigationIntent && programsLoaded.current) return

      setLoading(true)
      setError(null)
      try {
        const data = await loadTopPrograms()
        if (cancelled) return

        if (navigationIntent) {
          await applyNavigationIntent(navigationIntent, data)
          programsLoaded.current = true
          onNavigationIntentConsumed?.()
        } else if (!programsLoaded.current) {
          programsLoaded.current = true
          const active = data.filter((p) => !p.archived)
          if (active.length > 0) {
            setSelectedProgramId((current) => current ?? active[0].id)
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load scheduling')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [navigationIntent, loadTopPrograms, applyNavigationIntent, onNavigationIntentConsumed])

  const refresh = async () => {
    if (!selectedId) return
    await loadDetail(selectedId)
    await loadSignups(selectedId)
    await loadOrphanedSignups(selectedId)
    await loadForms()
  }

  const selectedProgram = topPrograms.find((p) => p.id === selectedProgramId) ?? null

  const needsClassEvent = ['form', 'offerings', 'slots'].includes(panel)
  const showClassEventPrompt = needsClassEvent && !selectedClassEvent
  // Offerings/Slots are scoped to a category; default to "No Category" so the
  // admin is never forced to bounce back to the Categories tab just to proceed.
  const effectiveCategory: CategorySelection = selectedCategory ?? 'none'

  const handleOfferingContinueToSlots = useCallback(() => {
    setPanel('slots')
  }, [])

  const categoryApiId =
    effectiveCategory === 'none' ? null : typeof effectiveCategory === 'number' ? effectiveCategory : undefined

  const categoryDisplayName =
    effectiveCategory === 'none'
      ? 'No Category'
      : typeof effectiveCategory === 'number' && detail
        ? (detail.allCategories?.find((c) => c.id === effectiveCategory)?.name ??
          detail.categories.find((c) => c.id === effectiveCategory)?.name ??
          selectedClassEvent?.schedulingCategoryName ??
          null)
        : typeof effectiveCategory === 'number'
          ? (selectedClassEvent?.schedulingCategoryName ?? null)
          : null

  const offeringDisplayName =
    selectedOffering?.label?.trim() ||
    (selectedOffering?.startDate && selectedOffering?.endDate
      ? `${selectedOffering.startDate} – ${selectedOffering.endDate}`
      : null)

  const handleProgramSaved = (updated: TopProgram) => {
    setForwardFormSelectAll(false)
    setTopPrograms((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
  }

  const handleOfferingSelect = useCallback((offering: SchedulingOffering | null) => {
    setSelectedOffering(offering)
    if (offering) setSelectedCategory(offering.categoryId ?? 'none')
  }, [])

  if (loading && topPrograms.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-vortex-red" />
            Class &amp; Event Scheduling &amp; Signup Forms
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Configure offerings, slots, and signup forms for each class and event.
          </p>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-vortex-red" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-7 h-7 text-vortex-red" />
          Class &amp; Event Scheduling &amp; Signup Forms
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Configure offerings, slots, and signup forms for each class and event.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 shrink-0">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-black">Programs</h2>
          </div>
          <ProgramsSection
            compact
            selectedProgramId={selectedProgramId}
            onSelectProgram={handleSelectProgram}
          />
        </aside>

        <div className="flex-1 min-w-0">
          {!selectedProgramId ? (
            <p className="text-gray-600">Select or create a program in the sidebar.</p>
          ) : (
            <>
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                Program: <strong>{selectedProgram?.displayName}</strong>
                {selectedClassEvent ? (
                  <>
                    {' '}
                    · Class/Event: <strong>{selectedClassEvent.displayName}</strong>
                    {categoryDisplayName && (
                      <>
                        {' '}
                        · <strong>{categoryDisplayName}</strong>
                      </>
                    )}
                    {offeringDisplayName && (
                      <>
                        {' '}
                        · <strong>{offeringDisplayName}</strong>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-amber-700"> · Select a class in Overview to continue</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
                {PANELS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPanel(p.id)}
                    className={`px-4 py-2 rounded-lg font-semibold ${
                      panel === p.id
                        ? 'bg-vortex-red text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 flex justify-between">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                </div>
              )}

              {showClassEventPrompt && (
                <p className="text-gray-600 py-8">
                  Select a class in <strong>Overview</strong> to manage {panel}.
                </p>
              )}

              {panel === 'overview' && selectedProgram && (
                <AdminSchedulingOverview
                  program={selectedProgram}
                  onSaved={handleProgramSaved}
                  onSelectClassEvent={handleSelectClassEvent}
                  onOpenForm={() => setPanel('form')}
                />
              )}

              {panel === 'form' && selectedClassEvent && selectedId && detail && (
                <AdminSchedulingFormTab
                  formId={selectedId}
                  initialSignupFields={detail.signupFields}
                  initialMandateWaiver={detail.mandateWaiver}
                  selectAllFields={forwardFormSelectAll}
                  onSaved={async () => {
                    setForwardFormSelectAll(false)
                    await refresh()
                  }}
                  onContinue={() => setPanel('offerings')}
                />
              )}

              {panel === 'offerings' && selectedClassEvent && selectedId && (
                <AdminSchedulingOfferings
                  formId={selectedId}
                  selectedCategory={effectiveCategory}
                  selectedOfferingId={selectedOffering?.id ?? null}
                  onOfferingSelect={handleOfferingSelect}
                  onContinueToSlots={handleOfferingContinueToSlots}
                />
              )}

              {panel === 'slots' && selectedClassEvent && selectedId && detail && !selectedOffering && (
                <p className="text-gray-600 py-8">
                  Select an offering in <strong>Offerings</strong> to view and manage its time slots.
                </p>
              )}

              {panel === 'slots' && selectedClassEvent && selectedId && detail && selectedOffering && (
                <AdminSchedulingSlots
                  formId={selectedId}
                  detail={detail}
                  formStartDate={detail.startDate ?? null}
                  formEndDate={detail.endDate ?? null}
                  offeringId={selectedOffering?.id ?? null}
                  offeringStartDate={selectedOffering?.startDate ?? null}
                  offeringEndDate={selectedOffering?.endDate ?? null}
                  offeringLabel={offeringDisplayName}
                  selectedCategoryId={categoryApiId ?? null}
                  categoryName={categoryDisplayName}
                  canBuild={Boolean(selectedOffering)}
                  orphanedSignups={orphanedSignups}
                  signups={signups}
                  forms={forms}
                  onRefresh={refresh}
                />
              )}
            </>
          )}
        </div>
      </div>

      <AdminSchedulingLegacyForms onDeleted={() => loadForms()} />
    </div>
  )
}

export default AdminScheduling
