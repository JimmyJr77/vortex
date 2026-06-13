import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Calendar, Check, Loader2, Mail, MailPlus, X } from 'lucide-react'
import AdminSchedulingCategories from './scheduling/AdminSchedulingCategories'
import AdminSchedulingSlots from './scheduling/AdminSchedulingSlots'
import AdminSchedulingOverview from './scheduling/AdminSchedulingOverview'
import AdminSchedulingFormTab from './scheduling/AdminSchedulingFormTab'
import AdminSchedulingOfferings from './scheduling/AdminSchedulingOfferings'
import AdminSchedulingCosts from './scheduling/AdminSchedulingCosts'
import AdminSchedulingLegacyForms from './scheduling/AdminSchedulingLegacyForms'
import {
  adminDeleteSchedulingForm,
  adminFetchSchedulingForm,
  adminFetchSchedulingForms,
  adminFetchSignups,
  adminFetchOrphanedSignups,
  adminResendSignupEmail,
  adminUpdateSignupStatus,
  adminUpdateSignupMemberPassword,
  type SchedulingFormDetail,
  type SchedulingFormSummary,
  type SchedulingSignup,
  type SchedulingOrphanedSignup,
  type SchedulingOffering,
  type CategorySelection,
} from '../utils/schedulingApi'
import ClassEventsPanel from './programs/ClassEventsPanel'
import ProgramsSection from './programs/ProgramsSection'
import {
  fetchClassEventSchedulingFormId,
  fetchTopPrograms,
  fetchTopProgramsLegacy,
  type ClassEvent,
  type TopProgram,
} from '../utils/programsApi'

type Panel = 'overview' | 'form' | 'classEvents' | 'categories' | 'offerings' | 'slots' | 'costs' | 'signups'

const PANELS: { id: Panel; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'form', label: 'Form' },
  { id: 'classEvents', label: 'Classes & Events' },
  { id: 'categories', label: 'Categories' },
  { id: 'offerings', label: 'Offerings' },
  { id: 'slots', label: 'Slots' },
  { id: 'costs', label: 'Costs' },
  { id: 'signups', label: 'Signups' },
]

const AdminScheduling = () => {
  const [topPrograms, setTopPrograms] = useState<TopProgram[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null)
  const [selectedClassEvent, setSelectedClassEvent] = useState<ClassEvent | null>(null)
  const [forms, setForms] = useState<SchedulingFormSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SchedulingFormDetail | null>(null)
  const [signups, setSignups] = useState<SchedulingSignup[]>([])
  const [orphanedSignups, setOrphanedSignups] = useState<SchedulingOrphanedSignup[]>([])
  const [panel, setPanel] = useState<Panel>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<CategorySelection>(null)
  const [selectedOffering, setSelectedOffering] = useState<SchedulingOffering | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [signupActionId, setSignupActionId] = useState<number | null>(null)
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>({})
  const [passwordSavingId, setPasswordSavingId] = useState<number | null>(null)

  const iconActionClass =
    'p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none'

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
      setPanel('overview')
    },
    [],
  )

  useEffect(() => {
    loadTopPrograms()
      .then((data) => {
        const active = data.filter((p) => !p.archived)
        if (active.length > 0 && !selectedProgramId) {
          setSelectedProgramId(active[0].id)
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load programs'))
      .finally(() => setLoading(false))
  }, [loadTopPrograms, selectedProgramId])

  const refresh = async () => {
    if (!selectedId) return
    await loadDetail(selectedId)
    await loadSignups(selectedId)
    await loadOrphanedSignups(selectedId)
    await loadForms()
  }

  const selectedProgram = topPrograms.find((p) => p.id === selectedProgramId) ?? null

  const overviewReady = Boolean(selectedProgram?.schedulingOverviewSavedAt)
  const needsClassEvent = ['offerings', 'slots', 'costs', 'signups'].includes(panel)
  const showClassEventPrompt = needsClassEvent && !selectedClassEvent
  const showCategoryPrompt =
    ['offerings', 'slots'].includes(panel) && selectedClassEvent && selectedCategory === null
  const showOfferingPrompt =
    ['offerings', 'slots'].includes(panel) && selectedClassEvent && selectedCategory !== null && !selectedOffering

  const handleCategorySelect = useCallback((selection: CategorySelection) => {
    setSelectedCategory(selection)
    setSelectedOffering(null)
  }, [])

  const categoryApiId =
    selectedCategory === 'none' ? null : typeof selectedCategory === 'number' ? selectedCategory : undefined

  const categoryDisplayName =
    selectedCategory === 'none'
      ? 'No Category'
      : typeof selectedCategory === 'number' && detail
        ? (detail.allCategories?.find((c) => c.id === selectedCategory)?.name ??
          detail.categories.find((c) => c.id === selectedCategory)?.name ??
          null)
        : null

  const handleProgramSaved = (updated: TopProgram) => {
    setTopPrograms((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
  }

  const handleOfferingSelect = useCallback((offering: SchedulingOffering | null) => {
    setSelectedOffering(offering)
    if (offering) setSelectedCategory(offering.categoryId ?? 'none')
  }, [])

  const openDeleteConfirm = () => {
    if (!selectedId) return
    setDeleteConfirmText('')
    setDeleteConfirmOpen(true)
  }

  const closeDeleteConfirm = () => {
    setDeleteConfirmOpen(false)
    setDeleteConfirmText('')
  }

  const handleDeleteForm = async () => {
    if (!selectedId || deleteConfirmText.trim() !== 'DELETE') return
    setDeleting(true)
    setError(null)
    try {
      await adminDeleteSchedulingForm(selectedId)
      closeDeleteConfirm()
      setSelectedClassEvent(null)
      setSelectedId(null)
      setDetail(null)
      setSignups([])
      setOrphanedSignups([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete form')
    } finally {
      setDeleting(false)
    }
  }

  if (loading && topPrograms.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-vortex-red" />
      </div>
    )
  }

  return (
    <div className="container-custom py-8">
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
                    {selectedCategory !== null && (
                      <>
                        {' '}
                        · Category: <strong>{categoryDisplayName ?? 'Selected'}</strong>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-amber-700"> · Select a class or event in Classes &amp; Events</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
                {PANELS.map((p) => {
                  const locked = p.id === 'classEvents' && !overviewReady
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={locked}
                      title={locked ? 'Complete Overview first' : undefined}
                      onClick={() => !locked && setPanel(p.id)}
                      className={`px-4 py-2 rounded-lg font-semibold ${
                        panel === p.id
                          ? 'bg-vortex-red text-white'
                          : locked
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 flex justify-between">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                </div>
              )}

              {showClassEventPrompt && (
                <p className="text-gray-600 py-8">
                  Select a class or event in the <strong>Classes &amp; Events</strong> tab to manage{' '}
                  {panel}.
                </p>
              )}

              {panel === 'overview' && selectedProgram && (
                <AdminSchedulingOverview program={selectedProgram} onSaved={handleProgramSaved} />
              )}

              {panel === 'form' && selectedProgram && (
                <AdminSchedulingFormTab program={selectedProgram} onSaved={handleProgramSaved} />
              )}

              {panel === 'classEvents' && selectedProgramId && (
                overviewReady ? (
                  <ClassEventsPanel
                    programsId={selectedProgramId}
                    programsDisplayName={selectedProgram?.displayName}
                    selectedClassEventId={selectedClassEvent?.id ?? null}
                    onSelectClassEvent={handleSelectClassEvent}
                    onRefresh={refresh}
                  />
                ) : (
                  <p className="text-gray-600 py-8">
                    Save the <strong>Overview</strong> tab first, then add classes and events.
                  </p>
                )
              )}

              {showCategoryPrompt && (
                <p className="text-gray-600 py-8">
                  Select a category in the <strong>Categories</strong> tab to manage {panel}.
                </p>
              )}

              {showOfferingPrompt && panel === 'slots' && (
                <p className="text-gray-600 py-8">
                  Select an offering in the <strong>Offerings</strong> tab before building slots.
                </p>
              )}

              {panel === 'categories' && (
                <AdminSchedulingCategories
                  selectedCategory={selectedCategory}
                  onSelectCategory={handleCategorySelect}
                  onRefresh={refresh}
                />
              )}

              {panel === 'offerings' && selectedClassEvent && selectedId && selectedCategory !== null && (
                <AdminSchedulingOfferings
                  formId={selectedId}
                  selectedCategory={selectedCategory}
                  selectedOfferingId={selectedOffering?.id ?? null}
                  onOfferingSelect={handleOfferingSelect}
                />
              )}

              {panel === 'slots' && selectedClassEvent && selectedId && detail && selectedOffering && (
                <AdminSchedulingSlots
                  formId={selectedId}
                  detail={detail}
                  formStartDate={detail.startDate ?? null}
                  formEndDate={detail.endDate ?? null}
                  offeringId={selectedOffering.id}
                  offeringStartDate={selectedOffering.startDate}
                  offeringEndDate={selectedOffering.endDate}
                  offeringLabel={selectedOffering.label}
                  selectedCategoryId={categoryApiId ?? null}
                  categoryName={categoryDisplayName}
                  canBuild={Boolean(selectedCategory !== null && selectedOffering)}
                  orphanedSignups={orphanedSignups}
                  forms={forms}
                  onRefresh={refresh}
                />
              )}

              {panel === 'costs' && selectedClassEvent && selectedId && detail && (
                <div className="space-y-6">
                  <AdminSchedulingCosts formId={selectedId} detail={detail} onSaved={refresh} />
                  <button
                    type="button"
                    onClick={openDeleteConfirm}
                    className="border border-red-300 text-red-700 px-6 py-2 rounded-lg font-semibold hover:bg-red-50"
                  >
                    Delete scheduling form
                  </button>
                </div>
              )}

                            {panel === 'signups' && selectedClassEvent && selectedId && (
                <div className="overflow-x-auto">
                  {signups.length === 0 ? (
                    <p className="text-gray-600 flex items-center gap-2"><Calendar className="w-4 h-4" /> No signups yet.</p>
                  ) : (
                    <table className="w-max max-w-none text-sm table-auto border-collapse [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:align-top [&_td]:align-top">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-600">
                          <th className="py-2 pr-4 w-0">Name</th>
                          <th className="py-2 pr-4 w-0">Email</th>
                          <th className="py-2 pr-4 w-0">Account</th>
                          <th className="py-2 pr-4 w-0">Password</th>
                          <th className="py-2 pr-4 w-0">Total slots</th>
                          <th className="py-2 pr-4 w-0">Category</th>
                          <th className="py-2 pr-4 w-0">Slot</th>
                          <th className="py-2 pr-4 w-0">Status</th>
                          <th className="py-2 pr-4 w-0">Position</th>
                          <th className="py-2 pr-4 w-0">Confirm email</th>
                          <th className="py-2 pr-4 w-0">Waiver email</th>
                          <th className="py-2 w-0">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {signups.map((s) => {
                          const slotLines = (s.slotLabel || '—')
                            .split(';')
                            .map((line) => line.trim())
                            .filter(Boolean)

                          return (
                          <tr key={s.id} className="border-b border-gray-100">
                            <td className="py-3 pr-4 w-0">
                              {s.firstName || String(s.responses.first_name || '')}{' '}
                              {s.lastName || String(s.responses.last_name || '')}
                            </td>
                            <td className="py-3 pr-4 w-0">{s.email || String(s.responses.email || '')}</td>
                            <td className="py-3 pr-4 w-0 text-xs">
                              {s.memberId ? (
                                <span>
                                  #{s.memberId}
                                  {s.profileComplete === false && (
                                    <span className="ml-1 text-amber-700 font-medium">Incomplete</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-3 pr-4 w-0">
                              {s.memberId ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="password"
                                    placeholder="New password"
                                    value={passwordDrafts[s.id] ?? ''}
                                    onChange={(e) =>
                                      setPasswordDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                                    }
                                    className="w-28 rounded border border-gray-300 px-2 py-1 text-xs"
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      passwordSavingId === s.id ||
                                      !(passwordDrafts[s.id]?.length >= 6)
                                    }
                                    onClick={async () => {
                                      setPasswordSavingId(s.id)
                                      try {
                                        await adminUpdateSignupMemberPassword(
                                          s.id,
                                          passwordDrafts[s.id],
                                        )
                                        setPasswordDrafts((prev) => ({ ...prev, [s.id]: '' }))
                                      } catch (e) {
                                        alert(e instanceof Error ? e.message : 'Failed to save password')
                                      } finally {
                                        setPasswordSavingId(null)
                                      }
                                    }}
                                    className="text-xs text-vortex-red font-semibold hover:underline disabled:opacity-40"
                                  >
                                    Save
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3 pr-4 w-0 text-xs font-medium">
                              {s.totalSlotsForUser != null ? s.totalSlotsForUser : '—'}
                            </td>
                            <td className="py-3 pr-4 w-0">{s.categoryName}</td>
                            <td className="py-3 pr-4 w-0">
                              <div className="inline-flex flex-col gap-0.5">
                                {slotLines.map((line, lineIndex) => (
                                  <span key={lineIndex}>{line}</span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 pr-4 w-0 capitalize">
                              {s.status === 'waitlisted' ? (
                                <span className="text-amber-700">Waitlisted</span>
                              ) : (
                                s.status
                              )}
                            </td>
                            <td className="py-3 pr-4 w-0 text-xs text-gray-700">
                              {s.status === 'confirmed' && s.signupNumber != null && s.maxParticipants != null
                                ? `#${s.signupNumber} of ${s.maxParticipants}`
                                : s.status === 'waitlisted' && s.waitlistPosition != null
                                  ? `Waitlist #${s.waitlistPosition}`
                                  : '—'}
                            </td>
                            <td className="py-3 pr-4 w-0 text-xs">
                              {s.confirmationEmailSentAt ? (
                                <span className="text-green-700">Sent</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-3 pr-4 w-0 text-xs">
                              {s.waiverEmailSentAt ? (
                                <span className="text-green-700">Sent</span>
                              ) : detail?.mandateWaiver ? (
                                <span className="text-gray-400">—</span>
                              ) : (
                                <span className="text-gray-300">N/A</span>
                              )}
                            </td>
                            <td className="py-3 w-0">
                              <div className="inline-flex items-center gap-1 flex-nowrap">
                                {(s.status === 'confirmed' || s.status === 'waitlisted') && (
                                  <button
                                    type="button"
                                    title="Resend confirmation email"
                                    disabled={signupActionId === s.id}
                                    onClick={async () => {
                                      setSignupActionId(s.id)
                                      try {
                                        const updated = await adminResendSignupEmail(s.id, 'confirmation')
                                        setSignups((prev) =>
                                          prev.map((row) => (row.id === s.id ? { ...row, ...updated } : row)),
                                        )
                                      } catch (e) {
                                        alert(e instanceof Error ? e.message : 'Failed to resend confirmation email')
                                      } finally {
                                        setSignupActionId(null)
                                      }
                                    }}
                                    className={`${iconActionClass} text-blue-600 hover:text-blue-800`}
                                    aria-label="Resend confirmation email"
                                  >
                                    <Mail className="w-4 h-4" />
                                  </button>
                                )}
                                {detail?.mandateWaiver && (
                                  <button
                                    type="button"
                                    title="Resend waiver email"
                                    disabled={signupActionId === s.id}
                                    onClick={async () => {
                                      setSignupActionId(s.id)
                                      try {
                                        const updated = await adminResendSignupEmail(s.id, 'waiver')
                                        setSignups((prev) =>
                                          prev.map((row) => (row.id === s.id ? { ...row, ...updated } : row)),
                                        )
                                      } catch (e) {
                                        alert(e instanceof Error ? e.message : 'Failed to resend waiver email')
                                      } finally {
                                        setSignupActionId(null)
                                      }
                                    }}
                                    className={`${iconActionClass} text-indigo-600 hover:text-indigo-800`}
                                    aria-label="Resend waiver email"
                                  >
                                    <MailPlus className="w-4 h-4" />
                                  </button>
                                )}
                                {(s.status === 'confirmed' || s.status === 'waitlisted') && (
                                  <button
                                    type="button"
                                    title="Cancel signup"
                                    disabled={signupActionId === s.id}
                                    onClick={async () => {
                                      setSignupActionId(s.id)
                                      try {
                                        await adminUpdateSignupStatus(s.id, 'cancelled')
                                        if (selectedId) {
                                          await loadSignups(selectedId)
                                          await loadDetail(selectedId)
                                        }
                                      } catch (e) {
                                        alert(e instanceof Error ? e.message : 'Failed to cancel signup')
                                      } finally {
                                        setSignupActionId(null)
                                      }
                                    }}
                                    className={`${iconActionClass} text-red-600 hover:text-red-800`}
                                    aria-label="Cancel signup"
                                  >
                                    <Ban className="w-4 h-4" />
                                  </button>
                                )}
                                {s.status === 'cancelled' && (
                                  <button
                                    type="button"
                                    title="Reconfirm signup"
                                    disabled={signupActionId === s.id}
                                    onClick={async () => {
                                      setSignupActionId(s.id)
                                      try {
                                        await adminUpdateSignupStatus(s.id, 'confirmed')
                                        if (selectedId) {
                                          await loadSignups(selectedId)
                                          await loadDetail(selectedId)
                                        }
                                      } catch (e) {
                                        alert(e instanceof Error ? e.message : 'Failed to reconfirm signup')
                                      } finally {
                                        setSignupActionId(null)
                                      }
                                    }}
                                    className={`${iconActionClass} text-green-700 hover:text-green-900`}
                                    aria-label="Reconfirm signup"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AdminSchedulingLegacyForms onDeleted={() => loadForms()} />

      <AnimatePresence>
        {deleteConfirmOpen && selectedId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 flex items-center justify-center z-[200] p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            >
              <h2 className="text-2xl font-bold text-red-600 mb-4">Delete scheduling form</h2>
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete{' '}
                <strong>{selectedClassEvent?.displayName || detail?.title || 'this form'}</strong>? It will be removed from the admin
                portal and public scheduling page. Signups, slots, and other data will remain in the
                database.
              </p>
              <p className="text-gray-600 mb-4 text-sm">
                To confirm, type <strong>DELETE</strong> below:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDeleteForm}
                  disabled={deleteConfirmText.trim() !== 'DELETE' || deleting}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                    deleteConfirmText.trim() === 'DELETE' && !deleting
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {deleting ? 'Deleting…' : 'Delete form'}
                </button>
                <button
                  type="button"
                  onClick={closeDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AdminScheduling
