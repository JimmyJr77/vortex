import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, ArrowRightLeft, GripVertical, Loader2, Search, X } from 'lucide-react'
import {
  fetchSwapClasses, fetchSwapStudents, finalizeClassSwap, previewClassSwap,
  type ClassSwapInput, type ClassSwapMode, type ClassSwapPreview,
  type SwapClass, type SwapEnrollment, type SwapEnrollmentKind, type SwapStudent,
} from '../../utils/classSwapsApi'
import { randomUUID } from '../../utils/uuid'
import ClassChangeEmailPreview from '../scheduling/ClassChangeEmailPreview'
import { classChangeDeliveryMessage } from '../../utils/classChangeNotification'

const kindLabels: Record<SwapEnrollmentKind, string> = {
  recurring: 'Enrolled', multi_class: 'Multi-class', trial: 'Upcoming trial', drop_in: 'Drop-in',
}
const fieldClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus:border-vortex-red focus:outline-none focus:ring-2 focus:ring-red-100'

function today() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function dateLabel(date: string | null) {
  if (!date) return ''
  const value = new Date(`${date}T12:00:00Z`)
  return Number.isNaN(value.getTime()) ? date : value.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

interface SwapDraft {
  input: ClassSwapInput
  student: SwapStudent
  from: SwapEnrollment
  to: SwapClass[]
}

function SwapConfirmation({ draft, onClose, onCompleted }: { draft: SwapDraft; onClose: () => void; onCompleted: (message: string) => void }) {
  const [preview, setPreview] = useState<ClassSwapPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [reason, setReason] = useState(draft.input.reason)
  const [emailBody, setEmailBody] = useState('')
  const [requestKey] = useState(() => `daily-class-swap-${randomUUID()}`)
  const dialogRef = useRef<HTMLElement>(null)
  const requiredWord = draft.input.mode === 'permanent' ? 'PERMANENT' : 'TEMPORARY'

  useEffect(() => {
    const controller = new AbortController()
    previewClassSwap(draft.input, controller.signal).then(data => {
      if (controller.signal.aborted) return
      setPreview(data)
      setEmailBody(data.notificationEmail?.body ?? '')
    }).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to preview this swap.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [draft])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    return () => previousFocus?.focus()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || loading || !preview || confirmation !== requiredWord || !reason.trim() || (preview.notificationEmail && !emailBody.trim())) return
    setSaving(true)
    setError(null)
    try {
      const result = await finalizeClassSwap({ ...draft.input, reason: reason.trim(), emailBody: preview.notificationEmail ? emailBody : undefined }, confirmation, requestKey)
      onCompleted(`${result.message || `${draft.student.name}’s ${draft.input.mode === 'temporary' ? 'one-time' : 'permanent'} class swap was saved.`} ${classChangeDeliveryMessage(result.notifications, result.notificationSummaryUnavailable)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this swap.')
      setSaving(false)
    }
  }

  return <div className="portal-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="class-swap-confirm-title" className="portal-dialog max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none" onKeyDown={event => {
      if (event.key === 'Escape' && !saving) onClose()
      if (event.key !== 'Tab') return
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)') ?? [])
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus() }
    }}>
      <div className="flex items-start justify-between gap-3">
        <div><h3 id="class-swap-confirm-title" className="text-xl font-bold text-gray-900">Confirm class swap</h3><p className="mt-1 text-sm text-gray-600">{draft.student.name} · {requiredWord === 'TEMPORARY' ? '1-time change' : 'Permanent change'}</p></div>
        <button type="button" disabled={saving} onClick={onClose} aria-label="Close class swap" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
      </div>
      <div className="my-5 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-[1fr_auto_1fr]">
        <div><span className="text-xs font-bold uppercase text-gray-500">From</span><p className="font-bold text-gray-900">{draft.from.className}</p><p className="text-sm text-gray-600">{draft.input.mode === 'permanent' && draft.from.wholeGroup ? draft.from.groupScheduleLabel || draft.from.scheduleLabel : draft.from.scheduleLabel}</p>{draft.input.sourceDate ? <p className="mt-1 text-sm text-gray-600">{dateLabel(draft.input.sourceDate)}</p> : null}</div>
        <ArrowRight className="h-5 w-5 self-center text-gray-400" />
        <div><span className="text-xs font-bold uppercase text-gray-500">To · {draft.to.length} replacement{draft.to.length === 1 ? '' : 's'}</span>{draft.to.map(target => <div key={target.key} className="mb-2"><p className="font-bold text-gray-900">{target.className}</p><p className="text-sm text-gray-600">{target.scheduleLabel}</p></div>)}<p className="mt-1 text-sm text-gray-600">{draft.input.mode === 'permanent' ? 'Begins ' : ''}{dateLabel(draft.input.effectiveDate)}</p></div>
      </div>
      {draft.input.mode === 'permanent' && draft.from.wholeGroup ? <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This combined enrollment is replaced one for one: {draft.to.length} original days/times → {draft.to.length} replacement days/times. All replacements and billing changes are saved together.</p> : null}
      {loading ? <p role="status" className="flex items-center gap-2 py-4 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> Checking availability and billing…</p> : null}
      {preview?.billingImpact ? <section aria-label="Billing impact" className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
        <h4 className="font-bold">Billing impact</h4>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div><dt>Original class this month</dt><dd className="font-bold">{money(preview.billingImpact.sourceFirstPeriodCents)}</dd></div>
          <div><dt>Replacement this month</dt><dd className="font-bold">{money(preview.billingImpact.replacementFirstMonthCents)}</dd></div>
          <div><dt>New monthly price</dt><dd className="font-bold">{money(preview.billingImpact.replacementMonthlyCents)}</dd></div>
          <div><dt>Account balance after swap</dt><dd className="font-bold">{money(preview.billingImpact.resultingBalanceCents)}</dd></div>
        </dl>
        {preview.billingImpact.laterSourceCreditCents ? <p className="mt-2">Later original-class bill credits: {money(preview.billingImpact.laterSourceCreditCents)}.</p> : null}
        {preview.billingImpact.replacementCatchupCents ? <p className="mt-2">Later replacement tuition: {money(preview.billingImpact.replacementCatchupCents)}.</p> : null}
        <p className="mt-3">Tuition, discounts and settled payments follow the existing billing transfer rules.</p>
      </section> : preview ? <p className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">{preview.message || 'Only the selected session moves. Regular enrollment and tuition stay unchanged.'}</p> : null}
      <form onSubmit={event => void submit(event)} className="space-y-4">
        {preview?.notificationEmail ? <ClassChangeEmailPreview preview={preview.notificationEmail} body={emailBody} onChange={setEmailBody} disabled={saving} /> : null}
        <label className="block text-sm font-semibold text-gray-700">Reason for swap<textarea value={reason} onChange={event => setReason(event.target.value)} disabled={saving} rows={2} required className={fieldClass} /></label>
        <label className="block text-sm font-semibold text-gray-700">Type {requiredWord} to confirm<input value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={saving || loading || !preview} autoComplete="off" spellCheck={false} className={fieldClass} /></label>
        {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button><button type="submit" disabled={saving || loading || !preview || confirmation !== requiredWord || !reason.trim() || Boolean(preview.notificationEmail && !emailBody.trim())} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}Finalize swap</button></div>
      </form>
    </section>
  </div>
}

export default function AdminClassSwaps() {
  const [mode, setMode] = useState<ClassSwapMode>('temporary')
  const [date, setDate] = useState(today)
  const [sourceDate, setSourceDate] = useState(today)
  const [students, setStudents] = useState<SwapStudent[]>([])
  const [classes, setClasses] = useState<SwapClass[]>([])
  const [studentKey, setStudentKey] = useState<string | null>(null)
  const [sourceKey, setSourceKey] = useState<string | null>(null)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentKind, setStudentKind] = useState('all')
  const [classSearch, setClassSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [classesLoading, setClassesLoading] = useState(true)
  const [studentsError, setStudentsError] = useState<string | null>(null)
  const [classesError, setClassesError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [success, setSuccess] = useState<string | null>(null)
  const [draft, setDraft] = useState<SwapDraft | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [selectedTargets, setSelectedTargets] = useState<SwapClass[]>([])
  const deferredStudentSearch = useDeferredValue(studentSearch.trim().toLocaleLowerCase())
  const deferredClassSearch = useDeferredValue(classSearch.trim().toLocaleLowerCase())
  const student = students.find(item => item.key === studentKey)
  const source = student?.enrollments.find(item => item.key === sourceKey)
  const requiredCount = mode === 'permanent' && source?.wholeGroup ? source.requiredReplacementCount || student?.enrollments.filter(item => item.source === source.source && item.signupId === source.signupId).length || 1 : 1
  const sourceEnrollments = useMemo(() => {
    if (!student || mode === 'temporary') return student?.enrollments ?? []
    const seen = new Set<string>()
    return student.enrollments.filter(item => {
      const key = `${item.source}:${item.signupId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [student, mode])

  useEffect(() => {
    const controller = new AbortController()
    setStudentsLoading(true)
    setStudentsError(null)
    fetchSwapStudents(controller.signal).then(data => setStudents(data.students)).catch(err => {
      if (!controller.signal.aborted) setStudentsError(err instanceof Error ? err.message : 'Unable to load students.')
    }).finally(() => { if (!controller.signal.aborted) setStudentsLoading(false) })
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    const controller = new AbortController()
    setClassesLoading(true)
    setClassesError(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setClasses([])
      setClassesLoading(false)
      return () => controller.abort()
    }
    fetchSwapClasses(mode, date, controller.signal).then(data => setClasses(data.classes)).catch(err => {
      if (!controller.signal.aborted) { setClasses([]); setClassesError(err instanceof Error ? err.message : 'Unable to load classes.') }
    }).finally(() => { if (!controller.signal.aborted) setClassesLoading(false) })
    return () => controller.abort()
  }, [mode, date, refresh])

  const filteredStudents = useMemo(() => students.filter(item => {
    const enrollments = item.enrollments.filter(enrollment => studentKind === 'all' || enrollment.kind === studentKind)
    return enrollments.length > 0 && (!deferredStudentSearch || `${item.name} ${enrollments.map(enrollment => `${enrollment.className} ${enrollment.programName || ''}`).join(' ')}`.toLocaleLowerCase().includes(deferredStudentSearch))
  }), [students, studentKind, deferredStudentSearch])
  const programs = useMemo(() => [...new Set(classes.map(item => item.programName || 'Other'))].sort(), [classes])
  const filteredClasses = useMemo(() => classes.filter(item =>
    (programFilter === 'all' || (item.programName || 'Other') === programFilter) &&
    (availabilityFilter === 'all' || item.availableSpots == null || item.availableSpots > 0) &&
    (!deferredClassSearch || `${item.className} ${item.programName || ''} ${item.scheduleLabel}`.toLocaleLowerCase().includes(deferredClassSearch)),
  ), [classes, programFilter, availabilityFilter, deferredClassSearch])

  const selectStudent = (item: SwapStudent) => {
    setStudentKey(item.key)
    setSourceKey(null)
    setSelectedTargets([])
    setSuccess(null)
  }

  const selectSource = (item: SwapEnrollment) => {
    if (item.key !== sourceKey) setSelectedTargets([])
    setSourceKey(item.key)
    setSuccess(null)
    if (mode === 'temporary' && item.classDate) { setSourceDate(item.classDate); setDate(item.classDate) }
  }

  const unavailableReason = (target: SwapClass, from = source) => {
    if (target.availableSpots != null && target.availableSpots <= 0) return 'Class full'
    if (!from) return 'Select a class on the left first'
    if (mode === 'permanent' && !from.canPermanent) return 'This booking supports a 1-time change'
    if (from.formId === target.formId && from.slotGroupId === target.slotGroupId &&
        (mode === 'permanent' || sourceDate === date) && ((mode === 'permanent' && from.wholeGroup) || from.timeSlotId == null || from.timeSlotId === target.timeSlotId)) return 'Current class'
    if (mode === 'temporary' && !sourceDate) return 'Choose the original session date'
    return null
  }

  const review = (targets: SwapClass[], from = source) => {
    if (!student || !from || classesLoading || studentsLoading || targets.some(target => unavailableReason(target, from))) return
    const count = mode === 'permanent' && from.wholeGroup ? from.requiredReplacementCount || student.enrollments.filter(item => item.source === from.source && item.signupId === from.signupId).length : 1
    if (targets.length !== count) return
    const target = targets[0]
    setDraft({ student, from, to: targets, input: {
      source: from.source, signupId: from.signupId, mode, effectiveDate: date,
      ...(mode === 'temporary' ? { sourceDate, sourceTimeSlotId: from.timeSlotId } : {}),
      targetFormId: target.formId, targetSlotGroupId: target.slotGroupId, targetTimeSlotId: target.timeSlotId,
      targetSelections: targets.map(item => ({ formId: item.formId, slotGroupId: item.slotGroupId, timeSlotId: item.timeSlotId })),
      reason: `${mode === 'permanent' ? 'Permanent' : 'One-time'} class swap: ${from.className} to ${targets.map(item => item.className).join(', ')}.`,
    } })
  }

  const chooseTarget = (target: SwapClass, from = source) => {
    if (!student || !from || classesLoading || studentsLoading || unavailableReason(target, from)) return
    const count = mode === 'permanent' && from.wholeGroup ? from.requiredReplacementCount || student.enrollments.filter(item => item.source === from.source && item.signupId === from.signupId).length : 1
    if (count === 1) { review([target], from); return }
    setSelectedTargets(current => current.some(item => item.key === target.key) ? current.filter(item => item.key !== target.key) : current.length < count ? [...current, target] : current)
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4">
      <fieldset><legend className="mb-2 text-sm font-semibold text-gray-700">Swap type</legend><div className="inline-flex rounded-lg border border-gray-300 p-1">{([['temporary', '1-time change'], ['permanent', 'Permanent change']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setSourceKey(null); setSelectedTargets([]); setSuccess(null) }} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === value ? 'bg-vortex-red text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{label}</button>)}</div></fieldset>
      {mode === 'temporary' ? <label className="text-sm font-semibold text-gray-700">Original session date<input type="date" value={sourceDate} onChange={event => setSourceDate(event.target.value)} className={fieldClass} /></label> : null}
      <label className="text-sm font-semibold text-gray-700">{mode === 'temporary' ? 'Swap date' : 'Swap begins'}<input type="date" value={date} onChange={event => { setDate(event.target.value); setSelectedTargets([]); setSuccess(null) }} className={fieldClass} /></label>
      <p className="max-w-sm text-xs leading-relaxed text-gray-500">{mode === 'temporary' ? 'Move one session, including to a different day. Availability counts registrations on the swap date.' : 'Replace an ongoing enrollment. Availability counts enrollments in effect when the swap begins.'}</p>
    </div>
    {success ? <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</p> : null}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
      <section aria-label="Students and current classes" className="min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <div><h3 className="font-bold text-gray-900">Choose a student</h3><p className="mt-1 text-xs text-gray-500">Active enrollments, upcoming trials, drop-ins and multi-class signups.</p></div>
        <label className="block text-sm font-semibold text-gray-700">Find a student<div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" /><input type="search" value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Name, class or program" className={`${fieldClass} pl-9`} /></div></label>
        <label className="block text-sm font-semibold text-gray-700">Student type<select value={studentKind} onChange={event => setStudentKind(event.target.value)} className={fieldClass}><option value="all">All students</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {studentsLoading ? <p role="status" className="flex items-center gap-2 py-3 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading students…</p> : studentsError ? <div role="alert" className="text-sm text-red-700">{studentsError}<button type="button" onClick={() => setRefresh(value => value + 1)} className="ml-2 underline">Retry</button></div> : <div className="max-h-60 space-y-1 overflow-y-auto" aria-label="Student list">
          {filteredStudents.map(item => <button key={item.key} type="button" aria-label={`Select student ${item.name}`} aria-pressed={studentKey === item.key} onClick={() => selectStudent(item)} className={`w-full rounded-lg border p-3 text-left ${studentKey === item.key ? 'border-vortex-red bg-red-50' : 'border-transparent hover:bg-gray-50'}`}><span className="block text-sm font-bold text-gray-900">{item.name}</span><span className="mt-1 block text-xs text-gray-500">{item.enrollments.length} class{item.enrollments.length === 1 ? '' : 'es'} · {[...new Set(item.enrollments.map(enrollment => kindLabels[enrollment.kind]))].join(', ')}</span></button>)}
          {!filteredStudents.length ? <p className="py-3 text-sm text-gray-500">No students match these filters.</p> : null}
        </div>}
        {student ? <div className="space-y-3 border-t border-gray-200 pt-4"><div><h4 className="font-bold text-gray-900">{student.name}</h4><p className="mt-1 text-xs text-gray-500">Select or drag the class to replace.</p></div>{sourceEnrollments.map(item => {
          const disabled = studentsLoading || item.canSwap === false || (mode === 'permanent' && !item.canPermanent)
          return <button key={item.key} type="button" aria-label={`From class ${item.className}`} aria-pressed={sourceKey === item.key} disabled={disabled} draggable={!disabled} onDragStart={event => { selectSource(item); event.dataTransfer.setData('application/x-vortex-class-swap', item.key); event.dataTransfer.effectAllowed = 'move' }} onClick={() => selectSource(item)} className={`flex w-full gap-2 rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${sourceKey === item.key ? 'border-vortex-red bg-red-50 ring-1 ring-vortex-red' : 'border-gray-200 hover:border-gray-400'}`}><GripVertical className="mt-1 h-4 w-4 shrink-0 text-gray-400" /><span className="min-w-0"><span className="block text-xs font-semibold text-gray-500">{kindLabels[item.kind]}</span><span className="mt-1 block font-bold text-gray-900">{item.className}</span><span className="block text-sm text-gray-600">{item.programName}</span><span className="mt-1 block text-xs text-gray-500">{mode === 'permanent' && item.wholeGroup ? item.groupScheduleLabel || item.scheduleLabel : item.scheduleLabel}</span>{mode === 'permanent' && item.wholeGroup ? <span className="mt-1 block text-xs font-semibold text-amber-700">Select {item.requiredReplacementCount || item.sourceSchedules?.length || 1} replacement days/times for this enrollment.</span> : null}{item.classDate ? <span className="block text-xs text-gray-500">{dateLabel(item.classDate)}</span> : null}{item.isClassSwap ? <span className="mt-1 block text-xs font-semibold text-blue-700">One-time swap scheduled for this session.</span> : null}{mode === 'permanent' && !item.canPermanent ? <span className="mt-1 block text-xs">Use a 1-time change for this booking.</span> : null}</span></button>
        })}</div> : <p className="border-t pt-4 text-sm text-gray-500">Choose a student to see their classes here.</p>}
      </section>
      <section aria-label="Destination classes" className="min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <div><h3 className="font-bold text-gray-900">Choose {requiredCount > 1 ? `${requiredCount} replacement days/times` : 'a replacement class'}</h3><p className="mt-1 text-xs text-gray-500">{mode === 'permanent' ? `Enrolled when the swap begins: ${dateLabel(date)}` : `Registered on ${dateLabel(date)}`} · Click a card or drop the original class onto it.</p></div>
        {source && requiredCount > 1 ? <div className="rounded-xl border border-red-200 bg-red-50 p-4" aria-label="Replacement selection">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-gray-900">{selectedTargets.length} of {requiredCount} replacement days/times selected</p><p className="mt-1 text-xs text-gray-600">Match every original day/time one for one. You can mix class types.</p></div><button type="button" onClick={() => review(selectedTargets)} disabled={selectedTargets.length !== requiredCount || classesLoading} className="rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Review swap</button></div>
          {selectedTargets.length ? <ul className="mt-3 space-y-2">{selectedTargets.map(target => <li key={target.key} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm"><span><strong>{target.className}</strong><span className="block text-xs text-gray-500">{target.scheduleLabel}</span></span><button type="button" aria-label={`Remove replacement ${target.className}`} onClick={() => setSelectedTargets(current => current.filter(item => item.key !== target.key))} className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button></li>)}</ul> : null}
        </div> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><label className="text-sm font-semibold text-gray-700">Filter classes<input type="search" value={classSearch} onChange={event => setClassSearch(event.target.value)} placeholder="Class, day or time" className={fieldClass} /></label><label className="text-sm font-semibold text-gray-700">Program<select value={programFilter} onChange={event => setProgramFilter(event.target.value)} className={fieldClass}><option value="all">All programs</option>{programs.map(program => <option key={program}>{program}</option>)}</select></label><label className="text-sm font-semibold text-gray-700">Availability<select value={availabilityFilter} onChange={event => setAvailabilityFilter(event.target.value)} className={fieldClass}><option value="all">All classes</option><option value="available">Available spots</option></select></label></div>
        {classesLoading ? <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading class availability…</p> : classesError ? <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{classesError}<button type="button" onClick={() => setRefresh(value => value + 1)} className="ml-2 underline">Retry</button></div> : <div className="grid gap-3 xl:grid-cols-2">
          {filteredClasses.map(item => {
            const unavailable = unavailableReason(item)
            const full = item.availableSpots != null && item.availableSpots <= 0
            const selected = selectedTargets.some(target => target.key === item.key)
            const limitReached = requiredCount > 1 && selectedTargets.length >= requiredCount && !selected
            return <button key={item.key} type="button" aria-label={`To class ${item.className}`} aria-disabled={Boolean(unavailable) || limitReached} aria-pressed={selected} onClick={() => chooseTarget(item)} onDragOver={event => { if (source && !unavailable && !limitReached) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOverKey(item.key) } }} onDragLeave={() => setDragOverKey(null)} onDrop={event => { event.preventDefault(); setDragOverKey(null); const from = student?.enrollments.find(enrollment => enrollment.key === event.dataTransfer.getData('application/x-vortex-class-swap')); if (from) chooseTarget(item, from) }} className={`rounded-xl border p-4 text-left transition-colors ${dragOverKey === item.key || selected ? 'border-vortex-red bg-red-50 ring-2 ring-red-100' : full ? 'border-gray-200 bg-gray-50' : 'border-gray-200 hover:border-vortex-red hover:bg-red-50/30'}`}>
              <span className="block text-xs font-semibold text-gray-500">{item.programName || 'Other'}</span><span className="mt-1 block font-bold text-gray-900">{item.className}</span><span className="mt-1 block text-sm text-gray-600">{item.scheduleLabel}</span>
              <span className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-gray-600">{item.enrolledCount}{item.capacity && item.capacity > 0 ? ` / ${item.capacity}` : ''} {mode === 'temporary' ? 'registered that day' : 'enrolled at swap date'}</span><span className={`rounded-full px-2 py-1 font-semibold ${full ? 'bg-gray-200 text-gray-600' : 'bg-green-50 text-green-700'}`}>{item.availableSpots == null ? 'Spots available' : full ? 'Full' : `${item.availableSpots} spot${item.availableSpots === 1 ? '' : 's'} available`}</span></span>
              <span className={`mt-3 block text-xs font-semibold ${unavailable || limitReached ? 'text-gray-400' : 'text-vortex-red'}`}>{unavailable || (selected ? 'Selected · click to remove' : limitReached ? 'All replacements selected' : requiredCount > 1 ? 'Select replacement →' : 'Review swap →')}</span>
            </button>
          })}
          {!filteredClasses.length ? <p className="col-span-full py-8 text-center text-sm text-gray-500">No classes match this date and these filters.</p> : null}
        </div>}
      </section>
    </div>
    {draft ? <SwapConfirmation draft={draft} onClose={() => setDraft(null)} onCompleted={message => { setDraft(null); setSourceKey(null); setSelectedTargets([]); setSuccess(message); setRefresh(value => value + 1) }} /> : null}
  </div>
}
