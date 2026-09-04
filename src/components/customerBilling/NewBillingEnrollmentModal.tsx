import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Loader2, Search, Users, X } from 'lucide-react'
import { getTodayDateString } from '../../utils/dateUtils'
import {
  adminCreateSignup,
  adminFetchSchedulingForm,
  adminFetchSchedulingForms,
  type SchedulingFormDetail,
  type SchedulingFormSummary,
  type SchedulingTimeSlot,
} from '../../utils/schedulingApi'
import { adminApiRequest } from '../../utils/api'
import type { CustomerBillingEnrollment, CustomerBillingMember } from './types'

interface ScheduleChoice {
  slotGroupId: number
  timeSlotId: number
  label: string
  availability: string
  isFull: boolean
}

interface ClassSwapPreview {
  effectiveDate: string
  sourceMonthlyCents: number
  replacementMonthlyCents: number
  sourceRemainingClasses: number
  unusedSourceCreditCents: number
  replacementFirstMonthCents: number
  replacementRemainingClasses: number | null
  settlementKind: 'one_time_charge' | 'account_credit' | 'no_change'
  settlementAmountCents: number
  ledgerDeltaCents: number
  resultingBalanceCents: number
}

interface Props {
  members: CustomerBillingMember[]
  initialMemberId: number | null
  onClose: () => void
  onCreated: (message: string) => void
  swapEnrollment?: CustomerBillingEnrollment | null
}

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((Number(cents) || 0) / 100)
}

function newRequestKey() {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `class-swap-${suffix}`
}

function classLabel(form: SchedulingFormSummary): string {
  return form.classDisplayName || form.title
}

function programLabel(form: SchedulingFormSummary): string {
  return form.programDisplayName || 'Other programs'
}

function programKey(value: string | null | undefined): string {
  return String(value ?? '').trim().toLocaleLowerCase()
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Dates to be announced'
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function classDates(form: SchedulingFormSummary): string {
  if (!form.startDate && !form.endDate) return 'Dates to be announced'
  return `${formatDate(form.startDate)} – ${formatDate(form.endDate)}`
}

function scheduleLabel(slot: SchedulingTimeSlot): string {
  const dateOrDay = slot.scheduleMode === 'date'
    ? formatDate(slot.specificDate)
    : slot.dayName || 'Scheduled class'
  const time = [slot.startTime, slot.endTime].filter(Boolean).join('–')
  return time ? `${dateOrDay} · ${time}` : dateOrDay
}

function scheduleChoices(detail: SchedulingFormDetail | null): ScheduleChoice[] {
  if (!detail) return []
  return detail.slotGroups
    .filter((group) => group.isActive)
    .flatMap((group) => group.occurrences
      .filter((slot) => slot.isActive)
      .map((slot) => ({
        slotGroupId: group.id,
        timeSlotId: slot.id,
        label: scheduleLabel(slot),
        availability: slot.spotsRemaining > 0
          ? `${slot.spotsRemaining} spot${slot.spotsRemaining === 1 ? '' : 's'} remaining`
          : 'Full · joins waitlist',
        isFull: slot.spotsRemaining <= 0,
      })))
}

export default function NewBillingEnrollmentModal({
  members,
  initialMemberId,
  onClose,
  onCreated,
  swapEnrollment = null,
}: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>(
    initialMemberId ?? members[0]?.id ?? '',
  )
  const [enrollmentDate, setEnrollmentDate] = useState(getTodayDateString())
  const [forms, setForms] = useState<SchedulingFormSummary[]>([])
  const [formsLoading, setFormsLoading] = useState(true)
  const [formsError, setFormsError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [programFilter, setProgramFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'enrollable'>('enrollable')
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null)
  const [formDetail, setFormDetail] = useState<SchedulingFormDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [selectedScheduleKey, setSelectedScheduleKey] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [swapPreview, setSwapPreview] = useState<ClassSwapPreview | null>(null)
  const [swapReason, setSwapReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [swapRequestKey] = useState(newRequestKey)
  const isSwap = swapEnrollment != null

  useEffect(() => {
    let cancelled = false
    setFormsLoading(true)
    void adminFetchSchedulingForms()
      .then((rows) => {
        if (!cancelled) setForms(rows.filter((form) => form.isActive))
      })
      .catch((caught) => {
        if (!cancelled) {
          setFormsError(caught instanceof Error ? caught.message : 'Classes could not be loaded.')
        }
      })
      .finally(() => {
        if (!cancelled) setFormsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedFormId == null) {
      setFormDetail(null)
      setDetailError(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    void adminFetchSchedulingForm(selectedFormId)
      .then((detail) => {
        if (!cancelled) setFormDetail(detail)
      })
      .catch((caught) => {
        if (!cancelled) {
          setDetailError(caught instanceof Error ? caught.message : 'Class schedules could not be loaded.')
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedFormId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, submitting])

  const programs = useMemo(
    () => [...new Set(forms.map(programLabel))].sort((left, right) => left.localeCompare(right)),
    [forms],
  )
  const currentProgram = useMemo(() => {
    if (!isSwap) return null
    const sourceProgramKey = programKey(swapEnrollment?.program_name)
    if (!sourceProgramKey) return null
    return programs.find((program) => programKey(program) === sourceProgramKey) ?? null
  }, [isSwap, programs, swapEnrollment?.program_name])
  const otherPrograms = useMemo(
    () => programs.filter((program) => program !== currentProgram),
    [currentProgram, programs],
  )

  useEffect(() => {
    if (isSwap) setProgramFilter(currentProgram ?? 'all')
  }, [currentProgram, isSwap])

  const visibleForms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return forms.filter((form) => {
      const matchesQuery = !normalizedQuery || [
        classLabel(form),
        form.title,
        form.description,
        programLabel(form),
      ].some((value) => value?.toLowerCase().includes(normalizedQuery))
      const matchesProgram = programFilter === 'all' || programLabel(form) === programFilter
      const isOpenForDate = !form.endDate || form.endDate >= enrollmentDate
      return matchesQuery && matchesProgram && (dateFilter === 'all' || isOpenForDate)
    })
  }, [dateFilter, enrollmentDate, forms, programFilter, query])
  const selectedForm = forms.find((form) => form.id === selectedFormId) ?? null
  const schedules = useMemo(() => scheduleChoices(formDetail), [formDetail])
  const selectedSchedule = schedules.find((choice) => (
    `${choice.slotGroupId}:${choice.timeSlotId}` === selectedScheduleKey
  )) ?? null
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null
  const canReview = Boolean(
    selectedMember && selectedForm && selectedSchedule && enrollmentDate &&
    (!isSwap || (!selectedSchedule.isFull && swapReason.trim())),
  )

  const selectClass = (formId: number) => {
    setSelectedFormId(formId)
    setSelectedScheduleKey(null)
    setReviewing(false)
    setSwapPreview(null)
    setError(null)
  }

  const confirmEnrollment = async () => {
    if (!selectedMember || !selectedForm || !selectedSchedule) return
    setSubmitting(true)
    setError(null)
    try {
      if (swapEnrollment) {
        const response = await adminApiRequest(
          `/api/admin/customer-billing/enrollments/${swapEnrollment.id}/class-swap`,
          {
            method: 'POST',
            headers: { 'Idempotency-Key': swapRequestKey },
            body: JSON.stringify({
              targetFormId: selectedForm.id,
              targetSlotGroupId: selectedSchedule.slotGroupId,
              targetTimeSlotId: selectedSchedule.timeSlotId,
              effectiveDate: enrollmentDate,
              reason: swapReason.trim(),
              requestKey: swapRequestKey,
            }),
          },
        )
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || 'The class move could not be applied.')
        const delta = Number(body.data?.ledgerDeltaCents ?? swapPreview?.ledgerDeltaCents ?? 0)
        onCreated(
          delta > 0
            ? `Class move completed. ${money(delta)} was added to the account balance as a one-time prorated charge.`
            : delta < 0
              ? `Class move completed. ${money(Math.abs(delta))} was added to the account as a prorated credit.`
              : 'Class move completed with no net prorated balance change.',
        )
        return
      }
      await adminCreateSignup({
        formId: selectedForm.id,
        slotGroupId: selectedSchedule.slotGroupId,
        timeSlotId: selectedSchedule.timeSlotId,
        memberId: selectedMember.id,
        enrollmentStartDate: enrollmentDate,
        sendEmails: true,
      })
      onCreated(`${selectedMember.name} was added to ${classLabel(selectedForm)}. The billing account has been refreshed.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The enrollment could not be added.')
    } finally {
      setSubmitting(false)
    }
  }

  const reviewSelection = async () => {
    if (!selectedMember || !selectedForm || !selectedSchedule) return
    if (!swapEnrollment) {
      setReviewing(true)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const response = await adminApiRequest(
        `/api/admin/customer-billing/enrollments/${swapEnrollment.id}/class-swap/preview`,
        {
          method: 'POST',
          body: JSON.stringify({
            targetFormId: selectedForm.id,
            targetSlotGroupId: selectedSchedule.slotGroupId,
            targetTimeSlotId: selectedSchedule.timeSlotId,
            effectiveDate: enrollmentDate,
            reason: swapReason.trim(),
          }),
        },
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'The class move could not be previewed.')
      setSwapPreview(body.data)
      setReviewing(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The class move could not be previewed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4" onMouseDown={() => !submitting && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-billing-enrollment-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-vortex-red">Account Billing &amp; Enrollments</p>
            <h2 id="new-billing-enrollment-title" className="mt-1 text-xl font-black text-gray-950">{isSwap ? 'Move to another class' : 'Add family enrollment'}</h2>
            <p className="mt-1 text-sm text-gray-500">{isSwap ? 'Choose a replacement class and schedule, then review any prorated balance change before applying the move.' : 'Select a family member, class, schedule, and effective enrollment date.'}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50" aria-label="Close new enrollment">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? <div role="alert" className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {reviewing && selectedMember && selectedForm && selectedSchedule ? (
            <div className="mx-auto max-w-2xl space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="h-5 w-5" /><h3 className="font-bold">{isSwap ? 'Review class move' : 'Review enrollment addition'}</h3></div>
                <p className="mt-2 text-sm text-emerald-900">{isSwap ? 'The current enrollment remains in the audit as cancelled and the replacement begins on the selected date.' : 'Are you sure you want to add this enrollment?'}</p>
              </div>
              <dl className="grid gap-x-6 gap-y-4 rounded-xl border border-gray-200 bg-gray-50 p-5 sm:grid-cols-2">
                <div><dt className="text-xs font-bold uppercase tracking-wide text-gray-500">Family member</dt><dd className="mt-1 font-semibold text-gray-950">{selectedMember.name}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-gray-500">Effective start</dt><dd className="mt-1 font-semibold text-gray-950">{formatDate(enrollmentDate)}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-gray-500">{isSwap ? 'Replacement class' : 'Class'}</dt><dd className="mt-1 font-semibold text-gray-950">{classLabel(selectedForm)}</dd><dd className="text-sm text-gray-600">{programLabel(selectedForm)}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-gray-500">Schedule</dt><dd className="mt-1 font-semibold text-gray-950">{selectedSchedule.label}</dd><dd className="text-sm text-gray-600">{selectedSchedule.availability}</dd></div>
              </dl>
              {swapPreview ? <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 text-sm text-violet-950"><strong>Billing impact</strong><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><span className="block text-xs font-semibold uppercase tracking-wide text-violet-700">Unused source-class credit</span><strong className="mt-1 block text-lg">{money(swapPreview.unusedSourceCreditCents)}</strong><span className="text-xs text-violet-800">{swapPreview.sourceRemainingClasses} unused scheduled session{swapPreview.sourceRemainingClasses === 1 ? '' : 's'}</span></div><div><span className="block text-xs font-semibold uppercase tracking-wide text-violet-700">Replacement first-period cost</span><strong className="mt-1 block text-lg">{money(swapPreview.replacementFirstMonthCents)}</strong><span className="text-xs text-violet-800">{swapPreview.replacementRemainingClasses ?? 0} scheduled session{swapPreview.replacementRemainingClasses === 1 ? '' : 's'} in this billing month</span></div><div><span className="block text-xs font-semibold uppercase tracking-wide text-violet-700">New monthly price</span><strong className="mt-1 block text-lg">{money(swapPreview.replacementMonthlyCents)}</strong></div><div><span className="block text-xs font-semibold uppercase tracking-wide text-violet-700">Account after move</span><strong className="mt-1 block text-lg">{money(swapPreview.resultingBalanceCents)}</strong></div></div><p className="mt-4 font-semibold">{swapPreview.settlementKind === 'one_time_charge' ? `${money(swapPreview.settlementAmountCents)} will be added as a one-time prorated account charge. The saved card will not be charged automatically.` : swapPreview.settlementKind === 'account_credit' ? `${money(swapPreview.settlementAmountCents)} will be recorded as an account credit. It can offset a future bill; use the existing refund action only if funds must return to the card.` : 'The unused credit and replacement cost offset exactly; no one-time balance entry is needed.'}</p></div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><strong>This will change the billing account for {selectedMember.name}.</strong><p className="mt-1 text-amber-800">The household’s recurring charges and discounts may be recalculated when the enrollment is added.</p></div>}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-2">
                {isSwap ? <div className="text-sm font-semibold text-gray-700"><span className="flex items-center gap-2"><Users className="h-4 w-4" /> Athlete</span><div className="mt-2 h-10 rounded-lg border border-gray-200 bg-white px-3 py-2 font-normal text-gray-900">{selectedMember?.name ?? swapEnrollment?.memberName}</div><p className="mt-1 text-xs font-normal text-gray-500">Replacing {swapEnrollment?.class_name || 'the current class'}.</p></div> : <label className="text-sm font-semibold text-gray-700"><span className="flex items-center gap-2"><Users className="h-4 w-4" /> Family member</span><select aria-label="Family member" value={selectedMemberId} onChange={(event) => { setSelectedMemberId(event.target.value ? Number(event.target.value) : ''); setReviewing(false) }} className="mt-2 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal text-gray-900"><option value="">Select a family member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.isActive ? '' : ' (inactive)'}</option>)}</select></label>}
                <label className="text-sm font-semibold text-gray-700"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {isSwap ? 'Move effective date' : 'Enrollment start date'}</span><input aria-label={isSwap ? 'Move effective date' : 'Enrollment start date'} type="date" min={isSwap ? undefined : getTodayDateString()} value={enrollmentDate} onChange={(event) => { setEnrollmentDate(event.target.value); setReviewing(false); setSwapPreview(null) }} className="mt-2 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal text-gray-900" /></label>
              </div>
              {isSwap ? <label className="block text-sm font-semibold text-gray-700">Administrative reason<textarea aria-label="Class move reason" rows={2} value={swapReason} onChange={(event) => { setSwapReason(event.target.value); setReviewing(false); setSwapPreview(null) }} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900" placeholder="Required for the billing and enrollment audit" /></label> : null}

              <section aria-labelledby="class-selection-title">
                <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 id="class-selection-title" className="font-bold text-gray-950">Find a class</h3><p className="mt-1 text-sm text-gray-500">Search and filter active class offerings before selecting a schedule.</p></div><span className="text-sm text-gray-500">{visibleForms.length} classes</span></div>
                <div className={`mt-4 grid gap-3 ${isSwap ? 'md:grid-cols-[1fr_220px]' : 'md:grid-cols-[1fr_220px_220px]'}`}>
                  <label className="relative"><span className="sr-only">Search classes</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search classes…" className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm" /></label>
                  <label><span className="sr-only">Filter by program</span><select aria-label="Filter by program" value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">{isSwap && currentProgram ? <><optgroup label="Current program"><option value={currentProgram}>{currentProgram}</option></optgroup><optgroup label="Other programs">{otherPrograms.map((program) => <option key={program} value={program}>{program}</option>)}</optgroup></> : <><option value="all">All programs</option>{programs.map((program) => <option key={program} value={program}>{program}</option>)}</>}</select></label>
                  {!isSwap ? <label><span className="sr-only">Filter by class dates</span><select aria-label="Filter by class dates" value={dateFilter} onChange={(event) => setDateFilter(event.target.value as 'all' | 'enrollable')} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="enrollable">Current &amp; upcoming</option><option value="all">All active classes</option></select></label> : null}
                </div>

                <div className="mt-4 max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                  {formsLoading ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading classes…</div> : null}
                  {formsError ? <div role="alert" className="p-4 text-sm text-red-700">{formsError}</div> : null}
                  {!formsLoading && !formsError && visibleForms.map((form) => {
                    const selected = selectedFormId === form.id
                    return <button key={form.id} type="button" onClick={() => selectClass(form.id)} className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left ${selected ? 'bg-red-50' : 'hover:bg-gray-50'}`}><span><span className="block font-semibold text-gray-950">{classLabel(form)}</span><span className="mt-0.5 block text-sm text-gray-600">{programLabel(form)} · {classDates(form)}</span>{form.description ? <span className="mt-1 block text-xs text-gray-500">{form.description}</span> : null}</span><ChevronRight className={`h-5 w-5 shrink-0 ${selected ? 'text-vortex-red' : 'text-gray-400'}`} /></button>
                  })}
                  {!formsLoading && !formsError && visibleForms.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">No active classes match these filters.</div> : null}
                </div>
              </section>

              {selectedForm ? <section aria-labelledby="schedule-selection-title" className="rounded-xl border border-gray-200 bg-white p-4"><div><h3 id="schedule-selection-title" className="font-bold text-gray-950">Select a schedule</h3><p className="mt-1 text-sm text-gray-500">{classLabel(selectedForm)} · {classDates(selectedForm)}</p></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{detailLoading ? <div className="col-span-full flex items-center gap-2 py-4 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading schedules…</div> : null}{detailError ? <div role="alert" className="col-span-full text-sm text-red-700">{detailError}</div> : null}{!detailLoading && !detailError && schedules.map((schedule) => { const key = `${schedule.slotGroupId}:${schedule.timeSlotId}`; const selected = selectedScheduleKey === key; return <button key={key} type="button" disabled={isSwap && schedule.isFull} onClick={() => { setSelectedScheduleKey(key); setReviewing(false); setSwapPreview(null) }} className={`rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-vortex-red bg-red-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}><span className="block font-semibold text-gray-950">{schedule.label}</span><span className="mt-1 block text-xs text-gray-500">{schedule.availability}{isSwap && schedule.isFull ? ' · unavailable for a class move' : ''}</span></button> })}{!detailLoading && !detailError && schedules.length === 0 ? <div className="col-span-full py-4 text-sm text-gray-500">No active schedules are available for this class.</div> : null}</div></section> : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-between gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          {reviewing ? <button type="button" onClick={() => setReviewing(false)} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"><ArrowLeft className="h-4 w-4" /> Back to edit</button> : <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">Cancel</button>}
          {reviewing ? <button type="button" onClick={() => void confirmEnrollment()} disabled={submitting || (isSwap && !swapPreview)} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {isSwap ? 'Confirm class move' : 'Yes, add enrollment'}</button> : <button type="button" onClick={() => void reviewSelection()} disabled={!canReview || detailLoading || submitting} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{isSwap ? 'Review class move' : 'Review addition'} <ChevronRight className="h-4 w-4" /></button>}
        </div>
      </div>
    </div>
  )
}
