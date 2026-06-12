import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Calendar, Check, Loader2, Mail, MailPlus, Plus, X } from 'lucide-react'
import AdminSchedulingCategories from './scheduling/AdminSchedulingCategories'
import AdminSchedulingSignupFields from './scheduling/AdminSchedulingSignupFields'
import AdminSchedulingSlots from './scheduling/AdminSchedulingSlots'
import {
  adminDeleteSchedulingForm,
  adminFetchSchedulingForm,
  adminFetchSchedulingForms,
  adminFetchSignups,
  adminFetchOrphanedSignups,
  adminSaveSchedulingForm,
  adminResendSignupEmail,
  adminUpdateSignupFields,
  adminUpdateSignupStatus,
  adminUpdateSignupMemberPassword,
  type SchedulingFormDetail,
  type SchedulingFormSummary,
  type SchedulingSignup,
  type SchedulingOrphanedSignup,
} from '../utils/schedulingApi'
import { mergeSignupFieldsForSave } from '../config/schedulingSignupFields'
import { dateInputValue } from '../utils/dateUtils'

type Panel = 'settings' | 'categories' | 'slots' | 'signups'

const emptyForm = (): Partial<SchedulingFormSummary> & { title: string } => ({
  title: '',
  description: '',
  startDate: null,
  endDate: null,
  isActive: true,
  maxSlotsPerUser: null,
  slotCostMonthlyCents: 0,
  freeSlotsPerUser: 0,
})

const PANELS: { id: Panel; label: string }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'categories', label: 'Categories' },
  { id: 'slots', label: 'Slots' },
  { id: 'signups', label: 'Signups' },
]

const AdminScheduling = () => {
  const [forms, setForms] = useState<SchedulingFormSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SchedulingFormDetail | null>(null)
  const [signups, setSignups] = useState<SchedulingSignup[]>([])
  const [orphanedSignups, setOrphanedSignups] = useState<SchedulingOrphanedSignup[]>([])
  const [panel, setPanel] = useState<Panel>('settings')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formDraft, setFormDraft] = useState(emptyForm())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [signupFieldsDraft, setSignupFieldsDraft] = useState<string[]>([])
  const [mandateWaiverDraft, setMandateWaiverDraft] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [signupActionId, setSignupActionId] = useState<number | null>(null)
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>({})
  const [passwordSavingId, setPasswordSavingId] = useState<number | null>(null)

  const iconActionClass =
    'p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none'

  const loadForms = useCallback(async () => {
    const data = await adminFetchSchedulingForms()
    setForms(data)
    return data
  }, [])

  const loadDetail = useCallback(async (id: number) => {
    const data = await adminFetchSchedulingForm(id)
    setDetail(data)
    const startDate = dateInputValue(data.startDate) || null
    const endDate = dateInputValue(data.endDate) || null
    setFormDraft({
      title: data.title,
      description: data.description,
      startDate,
      endDate,
      isActive: data.isActive,
      maxSlotsPerUser: data.maxSlotsPerUser ?? null,
      slotCostMonthlyCents: data.slotCostMonthlyCents ?? 0,
      freeSlotsPerUser: data.freeSlotsPerUser ?? 0,
    })
    setSignupFieldsDraft(data.signupFields)
    setMandateWaiverDraft(data.mandateWaiver ?? false)
    setSettingsSaved(false)
  }, [])

  const loadSignups = useCallback(async (formId: number) => {
    const data = await adminFetchSignups(formId)
    setSignups(data)
  }, [])

  const loadOrphanedSignups = useCallback(async (formId: number) => {
    const data = await adminFetchOrphanedSignups(formId)
    setOrphanedSignups(data)
  }, [])

  useEffect(() => {
    loadForms()
      .then((data) => {
        if (data.length > 0 && !selectedId) setSelectedId(data[0].id)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [loadForms, selectedId])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    setError(null)
    Promise.allSettled([loadDetail(selectedId), loadSignups(selectedId), loadOrphanedSignups(selectedId)]).then((results) => {
      const failures = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => (r.reason instanceof Error ? r.reason.message : 'Failed to load scheduling data'))
      if (failures.length === results.length) {
        setError(failures[0])
      } else if (failures.length > 0) {
        setError(failures.join(' · '))
      }
    }).finally(() => setLoading(false))
  }, [selectedId, loadDetail, loadSignups, loadOrphanedSignups])

  const refresh = async () => {
    if (!selectedId) return
    await loadDetail(selectedId)
    await loadSignups(selectedId)
    await loadOrphanedSignups(selectedId)
    await loadForms()
  }

  const handleCreateForm = async () => {
    setSaving(true)
    setError(null)
    try {
      const created = await adminSaveSchedulingForm({ title: 'New scheduling form', isActive: false })
      await loadForms()
      setSelectedId(created.id)
      setPanel('settings')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create form')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!selectedId) return
    setSaving(true)
    setError(null)
    setSettingsSaved(false)
    const startDate = dateInputValue(formDraft.startDate) || null
    const endDate = dateInputValue(formDraft.endDate) || null
    const formPayload = { ...formDraft, startDate, endDate }
    try {
      const mergedFields = mergeSignupFieldsForSave(signupFieldsDraft, mandateWaiverDraft)
      await Promise.all([
        adminSaveSchedulingForm(formPayload, selectedId),
        adminUpdateSignupFields(selectedId, mergedFields, mandateWaiverDraft),
      ])
      // Keep the dates the user saved — production API may still return legacy strings.
      setFormDraft((d) => ({ ...d, ...formPayload }))
      setDetail((prev) => (prev ? { ...prev, startDate, endDate } : prev))
      await loadSignups(selectedId)
      await loadForms()
      const data = await adminFetchSchedulingForm(selectedId)
      setDetail({ ...data, startDate, endDate })
      setSignupFieldsDraft(data.signupFields)
      setMandateWaiverDraft(data.mandateWaiver ?? false)
      setSettingsSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

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
      const data = await loadForms()
      setSelectedId(data[0]?.id ?? null)
      setDetail(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete form')
    } finally {
      setDeleting(false)
    }
  }

  if (loading && forms.length === 0) {
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-black">Forms</h2>
            <button
              type="button"
              onClick={handleCreateForm}
              disabled={saving}
              className="p-2 rounded-lg bg-vortex-red text-white hover:bg-red-700"
              title="New form"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {forms.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedId(f.id)}
                className={`w-full text-left rounded-lg px-4 py-3 border transition-colors ${
                  selectedId === f.id
                    ? 'border-vortex-red bg-red-50 text-black font-semibold'
                    : 'border-gray-200 hover:border-gray-400 text-gray-700'
                }`}
              >
                {f.title}
                {!f.isActive && <span className="text-xs text-gray-500 block">Inactive</span>}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {!selectedId || !detail ? (
            <p className="text-gray-600">Create or select a scheduling form to manage.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
                {PANELS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPanel(p.id)}
                    className={`px-4 py-2 rounded-lg font-semibold ${
                      panel === p.id ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

              {panel === 'settings' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 max-w-2xl">
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-black">Form details</h3>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Title</label>
                      <input
                        value={formDraft.title}
                        onChange={(e) => {
                          setFormDraft((d) => ({ ...d, title: e.target.value }))
                          setSettingsSaved(false)
                        }}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Description</label>
                      <textarea
                        rows={3}
                        value={formDraft.description || ''}
                        onChange={(e) => {
                          setFormDraft((d) => ({ ...d, description: e.target.value }))
                          setSettingsSaved(false)
                        }}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1">Start date</label>
                        <input
                          type="date"
                          value={dateInputValue(formDraft.startDate)}
                          onChange={(e) => {
                            setFormDraft((d) => ({ ...d, startDate: e.target.value || null }))
                            setSettingsSaved(false)
                          }}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">End date</label>
                        <input
                          type="date"
                          value={dateInputValue(formDraft.endDate)}
                          onChange={(e) => {
                            setFormDraft((d) => ({ ...d, endDate: e.target.value || null }))
                            setSettingsSaved(false)
                          }}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formDraft.isActive !== false}
                        onChange={(e) => {
                          setFormDraft((d) => ({ ...d, isActive: e.target.checked }))
                          setSettingsSaved(false)
                        }}
                      />
                      <span className="font-semibold">Active (visible on /scheduling)</span>
                    </label>
                  </section>

                  <section className="border-t border-gray-200 pt-8 space-y-4">
                    <h3 className="text-lg font-bold text-black">Availability and Costs</h3>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Max slots per user</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="Unlimited"
                        value={formDraft.maxSlotsPerUser ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setFormDraft((d) => ({
                            ...d,
                            maxSlotsPerUser: v === '' ? null : Math.max(1, Number(v)),
                          }))
                          setSettingsSaved(false)
                        }}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty for no limit on this form.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Cost per slot per month ($)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={(formDraft.slotCostMonthlyCents ?? 0) / 100}
                        onChange={(e) => {
                          const dollars = Number(e.target.value) || 0
                          setFormDraft((d) => ({
                            ...d,
                            slotCostMonthlyCents: Math.round(dollars * 100),
                          }))
                          setSettingsSaved(false)
                        }}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Free slots per user</label>
                      <input
                        type="number"
                        min={0}
                        value={formDraft.freeSlotsPerUser ?? 0}
                        onChange={(e) => {
                          setFormDraft((d) => ({
                            ...d,
                            freeSlotsPerUser: Math.max(0, Number(e.target.value) || 0),
                          }))
                          setSettingsSaved(false)
                        }}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2"
                      />
                    </div>
                  </section>

                  <section className="border-t border-gray-200 pt-8">
                    <h3 className="text-lg font-bold text-black mb-4">Signup fields</h3>
                    <AdminSchedulingSignupFields
                      selected={signupFieldsDraft}
                      waiverEnabled={mandateWaiverDraft}
                      onSelectedChange={(fields) => {
                        setSignupFieldsDraft(fields)
                        setSettingsSaved(false)
                      }}
                      onWaiverChange={(enabled) => {
                        setMandateWaiverDraft(enabled)
                        setSettingsSaved(false)
                      }}
                    />
                  </section>

                  <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-8">
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={saving}
                      className="bg-vortex-red text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60"
                    >
                      Save/Update Form
                    </button>
                    <button
                      type="button"
                      onClick={openDeleteConfirm}
                      className="border border-red-300 text-red-700 px-6 py-2 rounded-lg font-semibold hover:bg-red-50"
                    >
                      Delete form
                    </button>
                    {settingsSaved && <span className="text-green-600 text-sm font-medium">Saved</span>}
                  </div>
                </motion.div>
              )}

              {panel === 'categories' && (
                <AdminSchedulingCategories onRefresh={refresh} />
              )}

              {panel === 'slots' && (
                <AdminSchedulingSlots
                  formId={selectedId}
                  detail={detail}
                  formStartDate={formDraft.startDate ?? null}
                  formEndDate={formDraft.endDate ?? null}
                  orphanedSignups={orphanedSignups}
                  forms={forms}
                  onRefresh={refresh}
                />
              )}

              {panel === 'signups' && (
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
                <strong>{formDraft.title || 'this form'}</strong>? It will be removed from the admin
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
