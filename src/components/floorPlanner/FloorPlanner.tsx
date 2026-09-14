import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, Clock3, Copy, GripVertical, LayoutGrid, Loader2, MapPin, Plus, Save, Scissors, Search, RotateCcw, Trash2, Undo2, Users, X } from 'lucide-react'
import { fetchClassSetupOverview } from '../../utils/classSetupOverviewApi'
import { adminFetchSchedulingCalendar } from '../../utils/schedulingApi'
import { randomUUID } from '../../utils/uuid'
import { deleteView, isSavedView, listViews, loadCoaches, loadPlan, loadView, savePlan, saveView, type ViewSummary } from './api'
import { DAYS, LOCATION_OPTIONS, UNASSIGNED_LOCATION, BLOCK_HEIGHT, LANE_HEIGHT, currentWeekRange, resetFromSchedule, buildLibrary, colorStyle, conflicts, copyDay, layoutBlocks, mergeAdjacent, minutes, newPlan, nextColor, snap, timeLabel, timeValue, type Block, type Coach, type Plan, type PlannerClass } from './model'
import PlannerDialog from './PlannerDialog'

const CELL = 64
const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-vortex-red focus:outline-none focus:ring-2 focus:ring-red-100'
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40'
const primary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40'
const DRAG_TYPE = 'application/x-vortex-floor-class'
interface DragData { kind: 'class' | 'block'; id: string; offset: number }
interface Context { id: string; minute: number; x: number; y: number; anchor: HTMLElement }

export default function FloorPlanner({ canManage, userId }: { canManage: boolean; userId: number | null }) {
  const [plan, setPlan] = useState<Plan>(newPlan)
  const [saved, setSaved] = useState('')
  const [revision, setRevision] = useState(0)
  const [activeView, setActiveView] = useState<ViewSummary | null>(null)
  const [views, setViews] = useState<ViewSummary[]>([])
  const [viewsError, setViewsError] = useState('')
  const [savedDay, setSavedDay] = useState(0)
  const [viewError, setViewError] = useState('')
  const [storageKey, setStorageKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [library, setLibrary] = useState<PlannerClass[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [libraryError, setLibraryError] = useState('')
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [day, setDay] = useState(() => (new Date().getDay() + 6) % 7)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Block | null>(null)
  const [pendingClass, setPendingClass] = useState<PlannerClass | null>(null)
  const [context, setContext] = useState<Context | null>(null)
  const [movingBlock, setMovingBlock] = useState<Block | null>(null)
  const [dialog, setDialog] = useState<'class' | 'copy' | 'location' | 'reload' | 'reset' | 'saveView' | 'deleteView' | null>(null)
  const [resetPreview, setResetPreview] = useState<{ plan: Plan; startDate: string; endDate: string } | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const resetRequest = useRef(0)
  const [deleteLocation, setDeleteLocation] = useState<string | null>(null)
  const [copyTarget, setCopyTarget] = useState(0)
  const [copyMode, setCopyMode] = useState('append')
  const [history, setHistory] = useState<Plan[]>([])
  const [dropPreview, setDropPreview] = useState<{ locationId: string; start: number; duration: number } | null>(null)
  const drag = useRef<DragData | null>(null)
  const resizeCleanup = useRef<(() => void) | null>(null)
  const [resizing, setResizing] = useState<Block | null>(null)
  const contextRef = useRef<HTMLDivElement>(null)
  const serialized = JSON.stringify(plan)
  const dirty = serialized !== saved || Boolean(activeView && day !== savedDay)
  const px = CELL / plan.increment
  const width = (plan.end - plan.start) * px
  const editing = canManage && !saving && !loading

  const reload = useCallback(async (restoreDraft = true, targetViewId = '') => {
    setLoading(true); setLoadError(''); setError('')
    try {
      const result = targetViewId ? await loadView(targetViewId) : await loadPlan()
      const initial = result.plan || newPlan()
      const key = `vortex-floor-planner:${result.facilityId}:${userId ?? 'admin'}${targetViewId ? `:${targetViewId}` : ''}`
      setStorageKey(key)
      if (isSavedView(result)) { setActiveView(result); setDay(result.selectedDay); setSavedDay(result.selectedDay) }
      else setActiveView(null)
      setSelected(null); setPendingClass(null); setContext(null); setNotice('')
      setSaved(JSON.stringify(initial)); setRevision(result.revision); setPlan(initial); setHistory([])
      if (restoreDraft && canManage) {
        try {
          const draft = JSON.parse(sessionStorage.getItem(key) || 'null')
          if (draft?.plan?.version === 1 && Array.isArray(draft.plan.blocks)) {
            setPlan(draft.plan); setRevision(draft.revision)
            if (targetViewId && Number.isInteger(draft.day) && draft.day >= 0 && draft.day <= 6) setDay(draft.day)
            setNotice('Restored your unsaved plan from this tab.')
          }
        } catch { /* Storage is optional; server saves remain available. */ }
      } else { try { sessionStorage.removeItem(key) } catch { /* optional */ } }
    } catch (err) { setLoadError(err instanceof Error ? err.message : 'Unable to load the plan.') }
    finally { setLoading(false) }
  }, [userId, canManage])
  const refreshViews = useCallback(async () => {
    try { setViews(await listViews()); setViewsError('') }
    catch (err) { setViewsError(err instanceof Error ? err.message : 'Unable to load saved views.') }
  }, [])
  const reloadLibrary = useCallback(async () => {
    setLibraryLoading(true); setLibraryError('')
    const [classesResult, coachesResult] = await Promise.allSettled([fetchClassSetupOverview(), loadCoaches()])
    const availableCoaches = coachesResult.status === 'fulfilled' ? coachesResult.value : []
    setCoaches(availableCoaches)
    if (classesResult.status === 'fulfilled') setLibrary(buildLibrary(classesResult.value.rows, availableCoaches))
    setLibraryError([
      classesResult.status === 'rejected' ? 'Scheduled classes could not load. You can still use idea classes.' : '',
      coachesResult.status === 'rejected' ? 'Coach assignments could not load. You can enter coach names manually.' : '',
    ].filter(Boolean).join(' '))
    setLibraryLoading(false)
  }, [])
  useEffect(() => { void reload(); void reloadLibrary(); void refreshViews() }, [reload, reloadLibrary, refreshViews])
  useEffect(() => {
    if (loading || loadError || !storageKey || !canManage) return
    try {
      if (dirty) sessionStorage.setItem(storageKey, JSON.stringify({ plan, revision, day }))
      else sessionStorage.removeItem(storageKey)
    } catch { /* Browser storage can be unavailable; the unsaved badge remains visible. */ }
  }, [plan, revision, day, dirty, loading, loadError, storageKey, canManage])
  useEffect(() => {
    if (!dirty || loading) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, loading])
  useEffect(() => () => resizeCleanup.current?.(), [])
  useEffect(() => {
    if (!context) return
    contextRef.current?.querySelector('button')?.focus({ preventScroll: true })
    const close = (event: Event) => { if (!contextRef.current?.contains(event.target as Node)) setContext(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setContext(null) }
    const anchorRect = context.anchor.getBoundingClientRect()
    const closeOnScroll = () => {
      const currentRect = context.anchor.getBoundingClientRect()
      // Focusing the class can queue a scroll event before this menu opens.
      // Only dismiss when a subsequent scroll actually moves its anchor.
      if (currentRect.top !== anchorRect.top || currentRect.left !== anchorRect.left) setContext(null)
    }
    window.addEventListener('pointerdown', close); window.addEventListener('keydown', escape); window.addEventListener('scroll', closeOnScroll, true)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape); window.removeEventListener('scroll', closeOnScroll, true) }
  }, [context])

  const commit = (next: Plan, message = '') => {
    if (!editing) return
    setHistory((previous) => [...previous.slice(-29), plan]); setPlan(next); setError(''); setNotice(message)
  }
  const updateBlock = (block: Block) => {
    const blocks = mergeAdjacent(plan.blocks.map((b) => b.id === block.id ? block : b), block.instanceId)
    commit({ ...plan, blocks }); setSelected(null)
  }
  const allClasses = useMemo(() => [...library, ...plan.classes], [library, plan.classes])
  const filtered = allClasses.filter((c) => `${c.name} ${c.program} ${c.coaches.join(' ')} ${c.schedule || ''}`.toLowerCase().includes(query.toLowerCase()))
  const dayBlocks = useMemo(() => plan.blocks.filter((b) => b.day === day), [plan.blocks, day])
  const warnings = useMemo(() => conflicts(dayBlocks), [dayBlocks])
  const rows = plan.locations.map((location) => ({ ...location, ...layoutBlocks(dayBlocks.filter((b) => b.locationId === location.id)) }))
  const ticks = Array.from({ length: Math.ceil((plan.end - plan.start) / plan.increment) }, (_, i) => plan.start + i * plan.increment)
  const hiddenCount = dayBlocks.filter((b) => b.start < plan.start || b.end > plan.end).length
  const chooseDay = (next: number) => { setDay(next); setSelected(null); setContext(null); setDropPreview(null); setPendingClass(null) }

  const addClass = (item: PlannerClass, locationId: string, start: number) => {
    if (start + item.duration > 1440) { setError('This class would end after midnight. Choose an earlier start time.'); return }
    const block: Block = { id: randomUUID(), instanceId: randomUUID(), classId: item.id, name: item.name, program: item.program, coaches: [...item.coaches], day, locationId, start, end: start + item.duration, color: nextColor(plan.blocks) }
    commit({ ...plan, blocks: [...plan.blocks, block], start: Math.min(plan.start, start), end: Math.max(plan.end, Math.ceil(block.end / plan.increment) * plan.increment) }, `${item.name} added to ${DAYS[day]}.`)
    setPendingClass(null); setSelected(block)
  }
  const dragStart = (event: DragEvent, data: DragData) => {
    drag.current = data; event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(data)); event.dataTransfer.effectAllowed = data.kind === 'class' ? 'copy' : 'move'; setContext(null)
  }
  const getDrop = (event: DragEvent<HTMLDivElement>) => {
    const data = drag.current
    if (!data) return null
    const item = data.kind === 'class' ? allClasses.find((c) => c.id === data.id) : plan.blocks.find((b) => b.id === data.id)
    if (!item) return null
    const duration = 'duration' in item ? item.duration : item.end - item.start
    const start = Math.max(0, Math.min(1440 - duration, snap(plan.start + (event.clientX - event.currentTarget.getBoundingClientRect().left) / px - data.offset, plan.increment)))
    return { data, item, start, duration }
  }
  const splitBlock = (id: string, minute: number) => {
    const block = plan.blocks.find((b) => b.id === id)
    if (!block || minute < block.start + 5 || minute > block.end - 5) { setError('Choose a split time at least 5 minutes from either end.'); return }
    commit({ ...plan, blocks: plan.blocks.flatMap((b) => b.id === id ? [{ ...b, end: minute }, { ...b, id: randomUUID(), start: minute }] : [b]) }, `Split at ${timeLabel(minute)}. Move either piece to another location; matching pieces rejoin when adjacent.`)
    setContext(null); setSelected(null)
  }
  const startResize = (event: ReactPointerEvent, block: Block, edge: 'start' | 'end') => {
    if (!editing) return
    event.preventDefault(); event.stopPropagation()
    const initialX = event.clientX
    let next = block
    const move = (e: PointerEvent) => {
      const minute = snap(block[edge] + (e.clientX - initialX) / px, plan.increment)
      next = { ...block, [edge]: edge === 'start' ? Math.max(0, Math.min(block.end - 5, minute)) : Math.min(1440, Math.max(block.start + 5, minute)) }
      setResizing(next)
    }
    const cleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', cancel); setResizing(null); resizeCleanup.current = null }
    const finish = () => { cleanup(); if (next.start !== block.start || next.end !== block.end) updateBlock(next) }
    const cancel = () => cleanup()
    resizeCleanup.current?.(); resizeCleanup.current = cleanup
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', cancel)
  }
  const prepareReset = async () => {
    const requestId = ++resetRequest.current
    setDialog('reset'); setResetPreview(null); setResetError(''); setResetLoading(true)
    const range = currentWeekRange()
    try {
      const [calendar, currentCoaches] = await Promise.all([
        adminFetchSchedulingCalendar({ ...range, formActive: 'active' }), loadCoaches(),
      ])
      if (requestId !== resetRequest.current) return
      setResetPreview({ plan: resetFromSchedule(plan, calendar.events, currentCoaches, range), ...range })
      setCoaches(currentCoaches)
    } catch (err) {
      if (requestId === resetRequest.current) setResetError(err instanceof Error ? err.message : 'Unable to read the current schedule. Your plan has not changed.')
    } finally { if (requestId === resetRequest.current) setResetLoading(false) }
  }
  const save = async () => {
    setSaving(true); setError('')
    try {
      const result = activeView ? await saveView(plan, day, activeView.name, activeView.id, revision) : await savePlan(plan, revision)
      setRevision(result.revision); setSaved(serialized); setSavedDay(day)
      if (isSavedView(result)) { setActiveView(result); setViews((items) => items.map((item) => item.id === result.id ? result : item)) }
      setNotice(activeView ? `View “${activeView.name}” saved.` : 'Weekly plan saved.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save the plan.') }
    finally { setSaving(false) }
  }

  const saveNewView = async (name: string) => {
    setSaving(true); setViewError('')
    try {
      const result = await saveView(plan, day, name)
      setActiveView(result); setRevision(result.revision); setSaved(serialized); setSavedDay(day)
      setStorageKey(`vortex-floor-planner:${result.facilityId}:${userId ?? 'admin'}:${result.id}`)
      setViews((items) => [...items, result].sort((a, b) => a.name.localeCompare(b.name)))
      setHistory([]); setDialog(null); setNotice(`View “${result.name}” saved. Changes now apply to this view.`)
    } catch (err) { setViewError(err instanceof Error ? err.message : 'Unable to save the view.') }
    finally { setSaving(false) }
  }
  const removeView = async () => {
    if (!activeView) return
    setSaving(true); setViewError('')
    try {
      await deleteView(activeView.id, revision)
      setViews((items) => items.filter((item) => item.id !== activeView.id))
      try { sessionStorage.removeItem(storageKey) } catch { /* Optional draft storage. */ }
      setDialog(null); await reload()
    } catch (err) { setViewError(err instanceof Error ? err.message : 'Unable to delete the view.') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center gap-3 p-12 text-gray-500"><Loader2 className="animate-spin" />Loading Floor Planner…</div>
  if (loadError) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6"><h2 className="text-xl font-bold">Floor Planner</h2><p className="my-3">{loadError}</p><button className={button} onClick={() => void reload()}>Load current week</button></div>

  return <div className="space-y-5 text-gray-900" data-testid="floor-planner">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-vortex-red"><LayoutGrid size={15} />Facility planning</div><h2 className="text-3xl font-bold tracking-tight">Floor Planner</h2><p className="mt-1 text-sm text-gray-500">A place for every class. A plan for every day.</p></div>
      <div className="flex flex-wrap items-center gap-2"><span className={`mr-2 text-xs font-medium ${dirty ? 'text-amber-700' : 'text-emerald-700'}`}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span><button className={button} disabled={!editing || !history.length} onClick={() => { setPlan(history[history.length - 1]); setHistory(history.slice(0, -1)); setSelected(null); setNotice('Last change undone.') }}><Undo2 size={15} />Undo</button><button className={button} disabled={saving} onClick={() => setDialog('reload')}>Reload saved</button><button className={button} disabled={!editing} onClick={() => void prepareReset()}><RotateCcw size={15} />Reset to current schedule</button>{canManage && <button className={primary} disabled={!dirty || saving} onClick={() => void save()}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{activeView ? 'Save view' : 'Save week'}</button>}</div>
    </header>
    <section aria-label="Saved planning views" className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <label className="min-w-56 text-xs font-semibold text-gray-600">Saved view<select aria-label="Saved view" className={`${input} mt-1`} value={activeView?.id || ''} disabled={saving} onChange={(e) => void reload(true, e.target.value)}><option value="">Current week</option>{views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>
      <p className="flex-1 text-xs text-gray-500">Each view saves all seven days, locations, classes, coaches, visible hours, and time increments.</p>
      <div className="flex gap-2"><button className={button} disabled={saving} onClick={() => void refreshViews()}>Refresh views</button><button className={button} disabled={!editing} onClick={() => { setViewError(''); setDialog('saveView') }}><Plus size={15} />Save as new view</button>{activeView && <button className={`${button} !text-red-600`} disabled={!editing} onClick={() => { setViewError(''); setDialog('deleteView') }}><Trash2 size={15} />Delete view</button>}</div>
      {viewsError && <p role="alert" className="w-full text-sm text-red-700">{viewsError} Your current board is still available.</p>}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900"><p><strong>Planning workspace</strong> · Changes here are saved separately from the live class schedule.</p>{!canManage && <span className="font-semibold">View only</span>}</div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
    <p role="status" className="sr-only">{notice}</p>
    {notice && <p className="flex items-center gap-2 text-sm text-emerald-700"><Check size={15} />{notice}</p>}
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-label="Weekly floor plan">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-4 pt-3">
        <div className="flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label="Day of week">{DAYS.map((name, index) => <button key={name} type="button" role="tab" aria-selected={day === index} aria-controls="floor-day-panel" id={`floor-day-${index}`} onKeyDown={(e) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? 6 : (index + (e.key === 'ArrowRight' ? 1 : 6)) % 7; chooseDay(next); document.getElementById(`floor-day-${next}`)?.focus() } }} onClick={() => chooseDay(index)} className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${day === index ? 'border-vortex-red text-vortex-red' : 'border-transparent text-gray-500 hover:text-gray-900'}`}><span>{name.slice(0, 3)}</span><span className={`rounded-md px-1.5 py-0.5 text-[10px] ${day === index ? 'bg-red-50' : 'bg-gray-100'}`}>{new Set(plan.blocks.filter((b) => b.day === index).map((b) => b.instanceId)).size}</span></button>)}</div>
        <button className={`${button} mb-3`} disabled={!editing || !dayBlocks.length} onClick={() => { setCopyTarget((day + 1) % 7); setCopyMode('append'); setDialog('copy') }}><Copy size={15} />Copy day</button>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 bg-gray-50/60 px-5 py-4">
        <div><h3 className="font-bold">{DAYS[day]} <span className="ml-2 text-sm font-normal text-gray-500">{new Set(dayBlocks.map((b) => b.instanceId)).size} {new Set(dayBlocks.map((b) => b.instanceId)).size === 1 ? 'class' : 'classes'} · {plan.locations.length} locations</span></h3><p className="mt-1 text-xs text-gray-500">Drag a class onto the grid. Pull either edge to resize. Right-click to split.</p></div>
        <div className="flex flex-wrap items-end gap-3"><label className="text-xs font-semibold text-gray-500">From<input aria-label="View start time" type="time" className={`${input} mt-1`} value={timeValue(plan.start)} disabled={!editing} onChange={(e) => { const start = minutes(e.target.value); if (start <= plan.end - 30) commit({ ...plan, start }) }} /></label><label className="text-xs font-semibold text-gray-500">To<select aria-label="View end time" className={`${input} mt-1`} value={plan.end} disabled={!editing} onChange={(e) => { const end = Number(e.target.value); if (end >= plan.start + 30) commit({ ...plan, end }) }}>{Array.from(new Set([...Array.from({ length: 48 }, (_, i) => (i + 1) * 30), plan.end])).sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m === 1440 ? 'Midnight' : timeLabel(m)}</option>)}</select></label><label className="text-xs font-semibold text-gray-500">Time increments<select aria-label="Time increments" className={`${input} mt-1`} value={plan.increment} disabled={!editing} onChange={(e) => commit({ ...plan, increment: Number(e.target.value) })}>{[5, 10, 15, 30].map((i) => <option key={i} value={i}>{i} minutes</option>)}</select></label></div>
      </div>
      {hiddenCount > 0 && <div className="flex items-center gap-3 bg-amber-50 px-5 py-2 text-xs text-amber-900">{hiddenCount} class segments extend outside the visible hours.<button className="font-bold underline" disabled={!editing} onClick={() => commit({ ...plan, start: Math.min(plan.start, ...dayBlocks.map((b) => b.start)), end: Math.max(plan.end, ...dayBlocks.map((b) => b.end)) })}>Fit all classes</button></div>}
      {pendingClass && <div className="flex items-center justify-between bg-red-50 px-5 py-2 text-sm text-red-900">Click a time cell to place {pendingClass.program} · {pendingClass.name}, or use its Add button for exact times.<button aria-label="Cancel placement" onClick={() => setPendingClass(null)}><X size={16} /></button></div>}
      <div className="max-h-[580px] overflow-auto" id="floor-day-panel" role="tabpanel" aria-labelledby={`floor-day-${day}`}>
        <div style={{ minWidth: width + 200 }}>
          <div className="sticky top-0 z-30 flex h-12 border-b border-gray-200 bg-white">
            <div className="sticky left-0 z-40 flex w-[200px] shrink-0 items-center gap-2 border-r border-gray-200 bg-gray-50 px-4 text-xs font-bold uppercase tracking-wider text-gray-500"><MapPin size={14} />Location</div>
            <div className="relative" style={{ width }}>{ticks.map((m) => <div key={m} className="absolute h-full border-l border-gray-100 pl-2 pt-4 text-[10px] font-semibold text-gray-500" style={{ left: (m - plan.start) * px, width: CELL }}>{timeLabel(m)}</div>)}</div>
          </div>
          {rows.map((row) => <div key={row.id} className="flex border-b border-gray-200" style={{ height: row.height }}>
            <div className="sticky left-0 z-20 flex w-[200px] shrink-0 flex-col justify-center gap-2 border-r border-gray-200 bg-white px-3">
              <label className="sr-only" htmlFor={`location-${row.id}`}>Location name</label><input id={`location-${row.id}`} aria-label={`Location name ${row.name}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold hover:border-gray-200 focus:border-vortex-red focus:outline-none" list="floor-location-options" value={row.name} disabled={!editing || row.id === UNASSIGNED_LOCATION} maxLength={160} onFocus={() => setHistory((previous) => [...previous.slice(-29), plan])} onChange={(e) => { setPlan({ ...plan, locations: plan.locations.map((l) => l.id === row.id ? { ...l, name: e.target.value } : l) }) }} onBlur={(e) => { if (!e.target.value.trim()) setPlan((p) => ({ ...p, locations: p.locations.map((l) => l.id === row.id ? { ...l, name: 'Unnamed location' } : l) })) }} />
              <div className="flex items-center justify-between px-2 text-[11px] text-gray-400"><span>{row.items.length} {row.items.length === 1 ? 'segment' : 'segments'}</span><button aria-label={`Delete location ${row.name}`} disabled={!editing} onClick={() => setDeleteLocation(row.id)} className="rounded p-1 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 size={13} /></button></div>
            </div>
            <div data-testid={`floor-row-${row.name}`} className="relative overflow-hidden" style={{ width, backgroundImage: 'linear-gradient(to right, #e5e7eb 1px, transparent 1px)', backgroundSize: `${CELL}px 100%` }}
              onDragOver={(e) => { if (!editing) return; const drop = getDrop(e); if (!drop) return; e.preventDefault(); e.dataTransfer.dropEffect = drop.data.kind === 'class' ? 'copy' : 'move'; setDropPreview({ locationId: row.id, start: drop.start, duration: drop.duration }) }}
              onDragLeave={() => setDropPreview(null)}
              onDrop={(e) => { e.preventDefault(); setDropPreview(null); if (!editing) return; const drop = getDrop(e); if (!drop) return; if (drop.data.kind === 'class') addClass(drop.item as PlannerClass, row.id, drop.start); else updateBlock({ ...drop.item as Block, locationId: row.id, start: drop.start, end: drop.start + drop.duration }); drag.current = null }}
              onClick={(e) => { if (!pendingClass || !editing) return; addClass(pendingClass, row.id, Math.max(0, snap(plan.start + (e.clientX - e.currentTarget.getBoundingClientRect().left) / px, plan.increment))) }}>
              {!row.items.length && <div className="pointer-events-none absolute left-5 top-11 flex items-center gap-2 text-xs text-gray-400"><Plus size={14} />Drop a class here</div>}
              {dropPreview?.locationId === row.id && <div className="pointer-events-none absolute top-2 z-10 h-[84px] rounded-lg border-2 border-dashed border-vortex-red bg-red-50/80 px-2 py-2 text-xs font-bold text-vortex-red" style={{ left: (dropPreview.start - plan.start) * px, width: dropPreview.duration * px }}>{timeLabel(dropPreview.start)}</div>}
              {row.items.map(({ block: original, lane }) => {
                const block = resizing?.id === original.id ? resizing : original
                const clippedStart = Math.max(block.start, plan.start), clippedEnd = Math.min(block.end, plan.end)
                if (clippedEnd <= clippedStart) return null
                const warning = warnings.get(block.id)
                return <div key={block.id} data-testid="floor-block" data-instance={block.instanceId} data-color={block.color} draggable={editing && !resizing} onDragStart={(e) => dragStart(e, { kind: 'block', id: block.id, offset: (e.clientX - e.currentTarget.getBoundingClientRect().left) / px + clippedStart - block.start })} onDragEnd={() => { drag.current = null; setDropPreview(null) }}
                  role="button" tabIndex={0} aria-label={`${block.program} · ${block.name}, ${timeLabel(block.start)} to ${timeLabel(block.end)}, ${row.name}${warning ? ', conflict' : ''}`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(block) } }}
                  onClick={(e) => { e.stopPropagation(); setSelected(block); setPendingClass(null) }}
                  onContextMenu={(e) => { e.preventDefault(); if (!editing) return; const minute = snap(clippedStart + (e.clientX - e.currentTarget.getBoundingClientRect().left) / px, plan.increment); setContext({ anchor: e.currentTarget, id: block.id, minute: Math.max(block.start + 5, Math.min(block.end - 5, minute)), x: Math.min(e.clientX, window.innerWidth - 250), y: Math.max(8, Math.min(e.clientY, window.innerHeight - 205)) }) }}
                  title={`${block.program} · ${block.name}\n${timeLabel(block.start)}–${timeLabel(block.end)} · ${block.end - block.start} min\n${block.coaches.join(', ') || 'Coach unassigned'}${warning ? `\n${[...warning].join('\n')}` : ''}`}
                  className={`absolute cursor-grab select-none overflow-hidden rounded-lg border border-l-[4px] px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-vortex-red ${selected?.id === block.id ? 'ring-2 ring-vortex-red ring-offset-1' : ''}`}
                  style={{ ...colorStyle(block.color), left: (clippedStart - plan.start) * px + 2, width: Math.max(16, (clippedEnd - clippedStart) * px - 4), top: lane * LANE_HEIGHT + 8, height: BLOCK_HEIGHT }}>
                  <div className="flex items-center gap-1"><span className="line-clamp-2 text-xs font-bold">{block.program} · {block.name}</span>{warning && <AlertTriangle size={13} className="shrink-0" />}</div><p className="mt-0.5 truncate text-[10px] font-medium">{timeLabel(block.start)}–{timeLabel(block.end)}</p><p className="mt-1 flex items-center gap-1 truncate text-[10px]"><Users size={10} className="shrink-0" /><span className="truncate">{block.coaches.join(', ') || 'Assign coach'}</span></p>
                  {editing && (['start', 'end'] as const).map((edge) => <span key={edge} data-testid={`resize-${edge}`} title={`Resize ${edge} time`} onPointerDown={(e) => startResize(e, original, edge)} onClick={(e) => e.stopPropagation()} draggable={false} onDragStart={(e) => { e.preventDefault(); e.stopPropagation() }} className={`absolute top-0 h-full w-2 cursor-ew-resize touch-none hover:bg-black/10 ${edge === 'start' ? 'left-0' : 'right-0'}`} />)}
                </div>
              })}
            </div>
          </div>)}
        </div>
      </div>
      <datalist id="floor-location-options">{LOCATION_OPTIONS.map((name) => <option key={name} value={name} />)}</datalist>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 px-5 py-3"><button className="inline-flex items-center gap-2 text-sm font-semibold text-vortex-red disabled:opacity-40" disabled={!editing || plan.locations.length >= 50} onClick={() => setDialog('location')}><Plus size={16} />Add location</button><span className="flex items-center gap-2 text-xs text-gray-500">{dayBlocks.some((b) => b.locationId === UNASSIGNED_LOCATION) && <span className="mr-2 font-semibold text-amber-700">{dayBlocks.filter((b) => b.locationId === UNASSIGNED_LOCATION).length} awaiting location</span>}{warnings.size ? <><AlertTriangle size={14} className="text-amber-600" />{warnings.size} segments with location or coach overlaps</> : <><Check size={14} className="text-emerald-600" />No location or coach overlaps</>}</span></div>
    </section>
    {selected && <section key={`${selected.id}:${selected.start}:${selected.end}`} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="Class details">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-bold">{plan.blocks.some((b) => b.id === selected.id) ? 'Edit class placement' : 'Place class'} · {selected.program} · {selected.name}</h3><button aria-label="Close class details" onClick={() => setSelected(null)}><X size={18} /></button></div>
      <form onSubmit={(e) => {
        e.preventDefault(); const form = new FormData(e.currentTarget)
        const start = minutes(String(form.get('start'))), end = form.get('end') === '24:00' ? 1440 : minutes(String(form.get('end')))
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1440 || end - start < 5) { setError('End time must be at least 5 minutes after the start.'); return }
        const block = { ...selected, name: String(form.get('name')).trim(), day: Number(form.get('day')), locationId: String(form.get('location')), start, end, coaches: [...new Set(String(form.get('coaches')).split(',').map((c) => c.trim()).filter(Boolean))] }
        if (!block.name || !plan.locations.some((l) => l.id === block.locationId)) { setError('Choose a class name and location.'); return }
        if (plan.blocks.some((b) => b.id === selected.id)) updateBlock(block)
        else { commit({ ...plan, blocks: [...plan.blocks, block], start: Math.min(plan.start, start), end: Math.max(plan.end, end) }, 'Class added.'); setSelected(null) }
      }}>
        <fieldset disabled={!editing} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <label className="text-xs font-semibold text-gray-600">Class name<input name="name" className={`${input} mt-1`} defaultValue={selected.name} required maxLength={160} /></label>
          <label className="text-xs font-semibold text-gray-600">Day<select name="day" className={`${input} mt-1`} defaultValue={selected.day}>{DAYS.map((name, i) => <option key={name} value={i}>{name}</option>)}</select></label>
          <label className="text-xs font-semibold text-gray-600">Location<select name="location" className={`${input} mt-1`} defaultValue={selected.locationId} required>{plan.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-gray-600">Start time<input name="start" type="time" step="60" className={`${input} mt-1`} defaultValue={timeValue(selected.start)} required /></label>
          <label className="text-xs font-semibold text-gray-600">End time<input name="end" type={selected.end === 1440 ? 'text' : 'time'} step="60" className={`${input} mt-1`} defaultValue={timeValue(selected.end)} required /></label>
          <label className="text-xs font-semibold text-gray-600">Coaches<input name="coaches" list="floor-coaches" className={`${input} mt-1`} defaultValue={selected.coaches.join(', ')} placeholder="Select or type names" /><span className="mt-1 block font-normal text-gray-400">Separate multiple names with commas.</span></label>
        </fieldset>
        {warnings.has(selected.id) && <p className="mt-3 text-sm text-amber-700">{[...warnings.get(selected.id)!].join(' · ')}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button type="submit" className={primary} disabled={!editing}>Apply placement</button><button type="button" className={button} onClick={() => setSelected(null)}>Close</button></div>{plan.blocks.some((b) => b.id === selected.id) && <div className="flex flex-wrap items-center gap-2"><input aria-label="Split time" type="time" defaultValue={timeValue(Math.max(selected.start + 5, Math.min(selected.end - 5, snap((selected.start + selected.end) / 2, plan.increment))))} className={`${input} !w-32`} id="floor-split-time" disabled={!editing || selected.end - selected.start < 10} /><button type="button" className={button} disabled={!editing || selected.end - selected.start < 10} onClick={() => { const el = document.getElementById('floor-split-time') as HTMLInputElement; if (el.value) splitBlock(selected.id, minutes(el.value)) }}><Scissors size={14} />Split</button><button type="button" className={`${button} !text-red-600`} disabled={!editing} onClick={() => { commit({ ...plan, blocks: plan.blocks.filter((b) => b.id !== selected.id) }, 'Class segment removed.'); setSelected(null) }}><Trash2 size={14} />Remove</button></div>}</div>
      </form>
    </section>}
    <datalist id="floor-coaches">{coaches.map((coach) => <option key={coach.id} value={coach.name} />)}</datalist>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="Class library">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-lg font-bold">Class library <span className="ml-1 text-sm font-normal text-gray-400">{allClasses.length}</span></h3><p className="mt-1 text-xs text-gray-500">Drag onto the board, select then click a time, or use Add for exact placement.</p></div><button className={button} disabled={!editing} onClick={() => setDialog('class')}><Plus size={16} />Notional Class</button></div>
      <div className="relative mt-4"><Search size={17} className="absolute left-3 top-3 text-gray-400" /><input aria-label="Find classes" type="search" className={`${input} !pl-10`} placeholder="Find a class, program, or coach…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      {libraryError && <p role="alert" className="mt-3 text-sm text-amber-700">{libraryError} <button className="font-bold underline" onClick={() => void reloadLibrary()}>Retry</button></p>}
      {libraryLoading && <p className="mt-4 text-sm text-gray-500">Loading scheduled classes…</p>}
      <div className="mt-4 grid max-h-[420px] gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filtered.map((item) => <div key={item.id} draggable={editing} onDragStart={(e) => dragStart(e, { kind: 'class', id: item.id, offset: 0 })} onDragEnd={() => { drag.current = null; setDropPreview(null) }} className={`group rounded-xl border p-4 ${pendingClass?.id === item.id ? 'border-vortex-red bg-red-50/50' : 'border-gray-200 bg-white hover:border-gray-400'}`} data-testid="library-class">
        <div className="flex items-start gap-2"><GripVertical size={16} className="mt-0.5 shrink-0 cursor-grab text-gray-300" /><button disabled={!editing} onClick={() => setPendingClass(item)} className="min-w-0 flex-1 text-left"><span className="line-clamp-2 text-sm font-bold" title={`${item.program} · ${item.name}`}>{item.program} · {item.name}</span></button>{item.idea && <span className="rounded bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">Idea</span>}</div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500"><span className="flex items-center gap-1"><Clock3 size={12} />{item.duration} min</span><span className="flex items-center gap-1"><Users size={12} />{item.coaches.join(', ') || 'Unassigned'}</span></div>
        <p className="mt-2 line-clamp-2 min-h-8 text-[11px] text-gray-400" title={item.schedule}>{item.schedule || 'For planning and scheduling ideas'}</p>
        <div className="mt-3 flex justify-between"><button className="inline-flex items-center gap-1 text-xs font-bold text-vortex-red disabled:opacity-40" disabled={!editing || !plan.locations.length} onClick={() => { setPendingClass(null); setSelected({ id: randomUUID(), instanceId: randomUUID(), classId: item.id, name: item.name, program: item.program, coaches: [...item.coaches], color: nextColor(plan.blocks), day, locationId: plan.locations[0].id, start: Math.min(plan.start, 1440 - item.duration), end: Math.min(plan.start + item.duration, 1440) }) }}><Plus size={13} />Add to {DAYS[day].slice(0, 3)}</button>{item.idea && <button aria-label={`Delete idea ${item.name}`} disabled={!editing} onClick={() => { commit({ ...plan, classes: plan.classes.filter((c) => c.id !== item.id) }, 'Idea removed from the library. Existing placements are kept.'); if (pendingClass?.id === item.id) setPendingClass(null) }} className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>}</div>
      </div>)}</div>
      {!libraryLoading && !filtered.length && <p className="py-8 text-center text-sm text-gray-500">{query ? 'No classes match your search.' : 'No scheduled classes yet. Create an idea class to start planning.'}</p>}
    </section>
    {context && createPortal(<div ref={contextRef} role="menu" aria-label="Class actions" className="fixed z-50 w-60 rounded-xl border border-gray-200 bg-white p-1.5 text-gray-900 shadow-xl" style={{ left: Math.max(8, context.x), top: context.y }}>
      <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-50" disabled={(plan.blocks.find((b) => b.id === context.id)?.end ?? 0) - (plan.blocks.find((b) => b.id === context.id)?.start ?? 0) < 10} onClick={() => splitBlock(context.id, context.minute)}><Scissors size={15} />Split at {timeLabel(context.minute)}</button>
      <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-50 disabled:opacity-40" disabled={plan.locations.length < 2} onClick={() => { setMovingBlock(plan.blocks.find((b) => b.id === context.id) || null); setContext(null) }}><MapPin size={15} />Move to location</button>
      <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-50" onClick={() => { setSelected(plan.blocks.find((b) => b.id === context.id) || null); setContext(null) }}><Clock3 size={15} />Edit time / coaches</button>
      <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => { commit({ ...plan, blocks: plan.blocks.filter((b) => b.id !== context.id) }, 'Class segment removed.'); setSelected(null); setContext(null) }}><Trash2 size={15} />Remove segment</button>
    </div>, document.body)}
    {movingBlock && <PlannerDialog title="Move to location" onClose={() => setMovingBlock(null)}>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault()
        if (!editing) return
        const locationId = String(new FormData(event.currentTarget).get('location'))
        const location = plan.locations.find((item) => item.id === locationId)
        const block = plan.blocks.find((item) => item.id === movingBlock.id)
        if (!location || !block || block.locationId === locationId) return
        updateBlock({ ...block, locationId })
        setNotice(`${block.program} · ${block.name} moved to ${location.name}. Times and coaches kept.`)
        setMovingBlock(null)
      }}>
        <div><p className="text-sm font-semibold">{movingBlock.program} · {movingBlock.name}</p><p className="mt-1 text-sm text-gray-600">{DAYS[movingBlock.day]} · {timeLabel(movingBlock.start)}–{timeLabel(movingBlock.end)}</p></div>
        <p className="text-sm text-gray-500">Choose a different location. The day, start and end times, and coaches stay the same.</p>
        <label className="block text-sm font-semibold">Destination location<select name="location" aria-label="Destination location" className={`${input} mt-1`} required disabled={!editing} defaultValue={plan.locations.find((location) => location.id !== movingBlock.locationId)?.id}>{plan.locations.filter((location) => location.id !== movingBlock.locationId).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <div className="flex gap-2"><button type="submit" className={primary} disabled={!editing}><MapPin size={15} />Move class</button><button type="button" className={button} onClick={() => setMovingBlock(null)}>Cancel</button></div>
      </form>
    </PlannerDialog>}
    {dialog === 'class' && <PlannerDialog title="Notional Class" onClose={() => setDialog(null)}><form className="space-y-4" onSubmit={(e) => {
      e.preventDefault(); const form = new FormData(e.currentTarget)
      const name = String(form.get('name')).trim(), duration = Number(form.get('duration'))
      if (!name || !Number.isInteger(duration) || duration < 5 || duration > 1440) return
      const item: PlannerClass = { id: randomUUID(), name, program: String(form.get('program')).trim() || 'Planning ideas', duration, coaches: String(form.get('coaches')).split(',').map((c) => c.trim()).filter(Boolean), idea: true }
      commit({ ...plan, classes: [...plan.classes, item] }, `${name} added to your idea library.`); setQuery(''); setDialog(null)
    }}><p className="text-sm text-gray-500">Create a class to explore in this plan. It will appear in the library for every day.</p><label className="block text-sm font-medium">Class name<input name="name" className={`${input} mt-1`} required maxLength={160} autoFocus /></label><label className="block text-sm font-medium">Program<input name="program" className={`${input} mt-1`} placeholder="Planning ideas" maxLength={160} /></label><label className="block text-sm font-medium">Duration (minutes)<input name="duration" type="number" min={5} max={1440} step={1} defaultValue={60} required className={`${input} mt-1`} /></label><label className="block text-sm font-medium">Coaches<input name="coaches" list="floor-coaches" className={`${input} mt-1`} placeholder="Names separated by commas" /></label><button className={primary} type="submit">Create class</button></form></PlannerDialog>}
    {dialog === 'location' && <PlannerDialog title="Add location" onClose={() => setDialog(null)}><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const name = String(new FormData(e.currentTarget).get('name')).trim(); if (!name) return; commit({ ...plan, locations: [...plan.locations, { id: randomUUID(), name }] }); setDialog(null) }}><p className="text-sm text-gray-500">Locations are shared across all seven days. Choose a suggestion or type your own.</p><label className="block text-sm font-medium">Location name<input name="name" list="floor-location-options" className={`${input} mt-1`} required maxLength={160} autoFocus /></label><button type="submit" className={primary}>Add location</button></form></PlannerDialog>}
    {dialog === 'copy' && <PlannerDialog title={`Copy ${DAYS[day]}`} onClose={() => setDialog(null)}><div className="space-y-4"><p className="text-sm text-gray-500">Copy class times, locations, split pieces, and coach assignments. The copied day can be edited independently.</p><label className="block text-sm font-medium">Destination day<select aria-label="Destination day" value={copyTarget} onChange={(e) => setCopyTarget(Number(e.target.value))} className={`${input} mt-1`}>{DAYS.map((name, i) => i !== day && <option key={name} value={i}>{name}</option>)}</select></label><label className="flex items-start gap-2 text-sm"><input type="radio" name="copy-mode" checked={copyMode === 'append'} onChange={() => setCopyMode('append')} className="mt-1" /><span><strong>Add to existing classes</strong><span className="block text-gray-500">Keep everything already on {DAYS[copyTarget]}.</span></span></label><label className="flex items-start gap-2 text-sm"><input type="radio" name="copy-mode" checked={copyMode === 'replace'} onChange={() => setCopyMode('replace')} className="mt-1" /><span><strong>Replace destination day</strong><span className="block text-gray-500">Remove {plan.blocks.filter((b) => b.day === copyTarget).length} existing segments from {DAYS[copyTarget]}.</span></span></label><button className={primary} onClick={() => { commit(copyDay(plan, day, copyTarget, copyMode === 'replace'), `${DAYS[day]} copied to ${DAYS[copyTarget]}.`); chooseDay(copyTarget); setDialog(null) }}><Copy size={16} />Copy to {DAYS[copyTarget]}</button></div></PlannerDialog>}
    {deleteLocation && <PlannerDialog title="Delete location" onClose={() => setDeleteLocation(null)}><p className="text-sm text-gray-600">Delete <strong>{plan.locations.find((l) => l.id === deleteLocation)?.name}</strong> and its {plan.blocks.filter((b) => b.locationId === deleteLocation).length} class segments across all seven days? You can undo this change.</p><div className="mt-5 flex gap-2"><button className={primary} onClick={() => { commit({ ...plan, locations: plan.locations.filter((l) => l.id !== deleteLocation), blocks: plan.blocks.filter((b) => b.locationId !== deleteLocation) }, 'Location removed from the week.'); setDeleteLocation(null); setSelected(null) }}>Delete location</button><button className={button} onClick={() => setDeleteLocation(null)}>Cancel</button></div></PlannerDialog>}
    {dialog === 'saveView' && <PlannerDialog title="Save as new view" onClose={() => { if (!saving) setDialog(null) }}><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const name = String(new FormData(e.currentTarget).get('name')).trim(); if (name) void saveNewView(name) }}>
      <p className="text-sm text-gray-600">Save an independent copy of this full weekly plan. You can reopen it from Saved view and update it with Save view. Your other saved layouts are kept.</p>
      <label className="block text-sm font-semibold">View name<input name="name" className={`${input} mt-1`} placeholder="e.g. Fall layout or Evening rotation" required maxLength={80} disabled={saving} autoFocus /></label>
      {viewError && <p role="alert" className="text-sm text-red-700">{viewError}</p>}
      <button type="submit" className={primary} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save new view</button>
    </form></PlannerDialog>}
    {dialog === 'deleteView' && activeView && <PlannerDialog title="Delete saved view" onClose={() => { if (!saving) setDialog(null) }}><p className="text-sm text-gray-600">Delete “{activeView.name}” and its unsaved changes? Your current week and other saved views are kept.</p>{viewError && <p role="alert" className="mt-3 text-sm text-red-700">{viewError}</p>}<div className="mt-5 flex gap-2"><button className={primary} disabled={saving} onClick={() => void removeView()}>Delete saved view</button><button className={button} disabled={saving} onClick={() => setDialog(null)}>Cancel</button></div></PlannerDialog>}
    {dialog === 'reset'  && <PlannerDialog title="Reset to current schedule" onClose={() => setDialog(null)}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Replace the entire planning week with this week's active scheduled classes. Each class starts in <strong>Unassigned</strong> at its scheduled time with its current coaches. Drag it to a location or edit its placement.</p>
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">This only changes the Floor Planner. The actual class schedule and coach assignments stay unchanged. Your locations and idea library are kept, and you can Undo the reset.</p>
        {resetLoading && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" />Reading the current schedule and coach assignments…</p>}
        {resetError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{resetError}<button className="ml-2 font-bold underline" onClick={() => void prepareReset()}>Try again</button></div>}
        {resetPreview && <><p className="text-sm font-semibold">{resetPreview.startDate} through {resetPreview.endDate} · {resetPreview.plan.blocks.length} scheduled classes</p><div className="grid grid-cols-7 gap-1 rounded-lg bg-gray-50 p-3 text-center">{DAYS.map((name, i) => <div key={name}><p className="text-[10px] text-gray-500">{name.slice(0, 3)}</p><p className="mt-1 text-sm font-bold">{resetPreview.plan.blocks.filter((b) => b.day === i).length}</p></div>)}</div>
          <p className="text-xs text-gray-500">Inactive schedules, expired offerings, and classes with dates still to be determined are excluded. Repeating and date-specific classes follow the actual calendar for these dates.</p>
          {resetPreview.plan.blocks.length === 0 && <p className="text-sm text-amber-800">No active classes this week. Resetting will clear the current planning board.</p>}
          <button className={primary} disabled={!editing} onClick={() => { commit(resetPreview.plan, `Plan reset from ${resetPreview.startDate} through ${resetPreview.endDate}. Assign locations and adjust coaches as needed.`); setSelected(null); setPendingClass(null); setContext(null); setDialog(null) }}><RotateCcw size={15} />Reset planning week</button>
        </>}
      </div>
    </PlannerDialog>}
    {dialog === 'reload'  && <PlannerDialog title={activeView ? 'Reload saved view' : 'Reload saved week'} onClose={() => setDialog(null)}><p className="text-sm text-gray-600">{dirty ? 'Discard your unsaved changes and load the latest saved week?' : 'Load the latest version saved by your team?'}</p><div className="mt-5 flex gap-2"><button className={primary} onClick={() => { setDialog(null); setSelected(null); setNotice(''); void reload(false, activeView?.id) }}>{activeView ? 'Reload saved view' : 'Reload saved week'}</button><button className={button} onClick={() => setDialog(null)}>Cancel</button></div></PlannerDialog>}
  </div>
}
