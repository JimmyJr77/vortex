import { useEffect, useRef } from 'react'
import { CheckCircle2, ShieldCheck, X } from 'lucide-react'
import {
  FLIP_FIT_AGE_BANDS,
  type FlipFitAgeBand,
  type FlipFitCardMatchStatus,
  type FlipFitScheduledExercise,
} from '../../coach/flipFitProgram'
import type { FlipFitCardReference } from '../../coach/flipFitCardReferences'
import { buildFlipFitScheduledPrescription } from '../../coach/flipFitPrescription'

const AGE_COPY: Record<FlipFitAgeBand, { label: string; sublabel: string }> = {
  '9-11': { label: 'Ages 9–11', sublabel: 'Regression' },
  '12-14': { label: 'Ages 12–14', sublabel: 'Foundation' },
  '15-18': { label: 'Ages 15–18', sublabel: 'Progression' },
}

const MATCH_COPY: Record<FlipFitCardMatchStatus, string> = {
  reused: 'Reused library card',
  alias: 'Matched through alias',
  new: 'New Flip & Fit card',
  review: 'Coach review flag',
}

const PLANNED_MATCH_COPY: Record<FlipFitCardMatchStatus, string> = {
  reused: 'Planned reuse candidate',
  alias: 'Planned alias candidate',
  new: 'Planned new-card candidate',
  review: 'Planned coach review',
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => (
    element.getAttribute('aria-hidden') !== 'true'
    && element.getClientRects().length > 0
  ))
}

export default function FlipFitExerciseModal({
  exercise,
  ageBand,
  matchStatus,
  canonicalReference,
  onAgeBandChange,
  onClose,
}: {
  exercise: FlipFitScheduledExercise
  ageBand: FlipFitAgeBand
  matchStatus: FlipFitCardMatchStatus
  canonicalReference: FlipFitCardReference | null
  onAgeBandChange: (ageBand: FlipFitAgeBand) => void
  onClose: () => void
}) {
  const card = exercise.card
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const overlay = overlayRef.current
    const dialog = dialogRef.current
    if (!overlay || !dialog) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const inertedSiblings: Array<{ element: HTMLElement; wasInert: boolean }> = []

    // The modal is rendered inside the schedule panel rather than in a portal.
    // Inert siblings at every ancestor level so the rest of the portal cannot
    // receive pointer or keyboard focus while the dialog is open.
    let branch: HTMLElement = overlay
    while (branch.parentElement) {
      const parent = branch.parentElement
      for (const sibling of Array.from(parent.children)) {
        if (sibling === branch || !(sibling instanceof HTMLElement)) continue
        inertedSiblings.push({ element: sibling, wasInert: sibling.inert })
        sibling.inert = true
      }
      branch = parent
      if (parent === body) break
    }

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'

    const focusFirst = () => {
      const target = focusableElements(dialog)[0] ?? dialog
      target.focus({ preventScroll: true })
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = focusableElements(dialog)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (!active || !dialog.contains(active)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus({ preventScroll: true })
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && dialog.contains(event.target)) return
      focusFirst()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    closeButtonRef.current?.focus({ preventScroll: true })

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      for (const { element, wasInert } of inertedSiblings) element.inert = wasInert
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true })
    }
  }, [])

  const active = card.ageScaling[ageBand]
  const activeScheduled = buildFlipFitScheduledPrescription(exercise, ageBand)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="flip-fit-exercise-title"
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 bg-gradient-to-br from-black via-gray-900 to-black px-5 py-4 text-white sm:px-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-300">
              <span>{card.phase.replace(/_/g, ' ')}</span>
              <span aria-hidden>·</span>
              <span>{canonicalReference ? MATCH_COPY[matchStatus] : PLANNED_MATCH_COPY[matchStatus]}</span>
              {canonicalReference?.canonicalDisplayName && (
                <><span aria-hidden>·</span><span>Canonical: {canonicalReference.canonicalDisplayName}</span></>
              )}
            </div>
            <h2 id="flip-fit-exercise-title" className="text-xl font-bold leading-tight sm:text-2xl">{card.name}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-300">{card.description}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-vortex-red"
            aria-label="Close exercise card"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
            <div className="space-y-5">
              <section aria-labelledby="active-prescription-title" className="rounded-xl border-2 border-vortex-red bg-red-50/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-vortex-red">Active prescription</p>
                    <h3 id="active-prescription-title" className="mt-1 text-lg font-bold text-gray-950">
                      {AGE_COPY[ageBand].label} · {active.variation}
                    </h3>
                  </div>
                  <span className="rounded-full bg-vortex-red px-3 py-1 text-xs font-bold text-white">{AGE_COPY[ageBand].sublabel}</span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="text-xs font-semibold uppercase text-gray-500">Scheduled dose</dt><dd className="mt-0.5 font-medium text-gray-900">{activeScheduled.display}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-gray-500">Work</dt><dd className="mt-0.5 font-medium text-gray-900">{activeScheduled.workDisplay}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-gray-500">Rest</dt><dd className="mt-0.5 font-medium text-gray-900">{activeScheduled.restDisplay}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-gray-500">Intensity</dt><dd className="mt-0.5 font-medium text-gray-900">{active.intensity}</dd></div>
                </dl>
                <p className="mt-3 text-sm leading-relaxed text-gray-700">{active.intent}</p>
                <p className={`mt-3 text-xs font-semibold ${activeScheduled.fitsAllocation ? 'text-emerald-700' : 'text-red-700'}`}>
                  {activeScheduled.fitsAllocation
                    ? `Fits the ${exercise.allocationMinutes}-minute station (${activeScheduled.estimatedSeconds} of ${activeScheduled.allocationSeconds} seconds scheduled).`
                    : `Does not fit the ${exercise.allocationMinutes}-minute station; adjust before coaching.`}
                </p>
              </section>

              <section aria-labelledby="age-scaling-title">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-vortex-red">Scale the same exercise</p>
                    <h3 id="age-scaling-title" className="text-lg font-bold text-gray-950">Three coach-ready avenues</h3>
                  </div>
                  <p className="text-xs text-gray-500">Select a card to make it the active portal view.</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  {FLIP_FIT_AGE_BANDS.map((band) => {
                    const prescription = card.ageScaling[band]
                    const scheduled = buildFlipFitScheduledPrescription(exercise, band)
                    const selected = band === ageBand
                    return (
                      <button
                        key={band}
                        type="button"
                        onClick={() => onAgeBandChange(band)}
                        aria-pressed={selected}
                        className={`rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-vortex-red ${selected ? 'border-vortex-red bg-red-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-400'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-gray-950">{AGE_COPY[band].label}</span>
                          {selected && <CheckCircle2 className="h-4 w-4 text-vortex-red" aria-label="Selected" />}
                        </div>
                        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{AGE_COPY[band].sublabel}</p>
                        <p className="mt-3 text-sm font-semibold leading-snug text-gray-900">{prescription.variation}</p>
                        <p className="mt-2 text-xs font-semibold leading-relaxed text-gray-700">{scheduled.display}</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-600">{scheduled.workDisplay} · {scheduled.restDisplay}</p>
                        <p className="mt-2 text-xs leading-relaxed text-gray-600">{prescription.scalingGuidance}</p>
                      </button>
                    )
                  })}
                </div>
              </section>

              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-xl border border-gray-200 p-4">
                  <h3 className="font-bold text-gray-950">How to coach it</h3>
                  <ol className="mt-3 space-y-2 text-sm text-gray-700">
                    {card.instructions.map((item, index) => <li key={item} className="flex gap-2"><span className="font-bold text-vortex-red">{index + 1}.</span><span>{item}</span></li>)}
                  </ol>
                </section>
                <section className="rounded-xl border border-gray-200 p-4">
                  <h3 className="font-bold text-gray-950">Look and listen for</h3>
                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                    {card.coachingCues.map((item) => <li key={item} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vortex-red" /><span>{item}</span></li>)}
                  </ul>
                  {card.commonErrors.length > 0 && (
                    <>
                      <h4 className="mt-4 border-t border-gray-100 pt-3 text-xs font-bold uppercase tracking-wide text-gray-500">Common errors</h4>
                      <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
                        {card.commonErrors.map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </>
                  )}
                </section>
              </div>
            </div>

            <aside className="space-y-4">
              <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="font-bold text-gray-950">Programming identity</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div><dt className="text-xs font-semibold uppercase text-gray-500">Methodology</dt><dd className="font-medium text-gray-900">{card.methodology}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-gray-500">Primary movement function</dt><dd className="font-medium text-gray-900">{exercise.movementFunction}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-gray-500">Movement pattern</dt><dd className="font-medium text-gray-900">{card.movementPattern}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-gray-500">Impact / freshness</dt><dd className="font-medium capitalize text-gray-900">{card.impactLevel} / {card.freshnessRequirement}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-gray-500">Body regions</dt><dd className="font-medium text-gray-900">{card.bodyRegions.join(', ')}</dd></div>
                </dl>
              </section>

              <section className="rounded-xl border border-gray-200 p-4">
                <h3 className="font-bold text-gray-950">Equipment</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {active.equipment.map((item) => <span key={item} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{item}</span>)}
                </div>
                {card.under9EquipmentNote && (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                    <strong>Under-9 equipment note:</strong> {card.under9EquipmentNote}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-gray-200 p-4">
                <h3 className="flex items-center gap-2 font-bold text-gray-950"><ShieldCheck className="h-4 w-4 text-vortex-red" /> Safety and supervision</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">{card.supervision}</p>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-gray-600">
                  {card.safetyNotes.map((item) => <li key={item}>• {item}</li>)}
                </ul>
                <p className="mt-3 text-xs font-semibold text-gray-700">Readiness: {active.readinessGate}</p>
              </section>

              <section className="rounded-xl border border-gray-200 p-4">
                <h3 className="font-bold text-gray-950">Tenets trained</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {card.tenets.map((tenet) => <span key={tenet} className="rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">{tenet}</span>)}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </section>
    </div>
  )
}
