import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Clock, Loader2, Pencil, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { exerciseToClientView } from '../../coach/clientExerciseCard'
import type { Exercise } from '../../coach/types'
import { YoutubeVideoList } from '../YoutubeEmbedPlayer'

const MODAL_SHELL =
  'bg-white rounded-xl w-full max-w-4xl h-[min(85vh,720px)] overflow-hidden flex flex-col shadow-xl'

const MODAL_BODY = 'flex-1 min-h-0 overflow-y-auto p-5 space-y-5'

function Section({
  title,
  icon,
  children,
  emptyText,
  hasContent,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  emptyText: string
  hasContent: boolean
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        {icon}
        {title}
      </h3>
      {hasContent ? children : <p className="text-sm text-gray-500">{emptyText}</p>}
    </section>
  )
}

function BulletList({
  items,
  variant,
}: {
  items: string[]
  variant: 'check' | 'warning'
}) {
  const Icon = variant === 'check' ? Check : AlertTriangle
  const iconClass = variant === 'check' ? 'text-green-600' : 'text-amber-600'

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-gray-800">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function ClientExerciseDetailModal({
  exerciseId,
  preview,
  onClose,
  onEdit,
}: {
  exerciseId: number
  preview?: Exercise | null
  onClose: () => void
  onEdit?: () => void
}) {
  const [exercise, setExercise] = useState<Exercise | null>(preview ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [easierOpen, setEasierOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    coachFetch<Exercise>(`/api/coach/exercises/${exerciseId}`)
      .then(setExercise)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load exercise'))
      .finally(() => setLoading(false))
  }, [exerciseId])

  const view = useMemo(
    () => (exercise ? exerciseToClientView(exercise) : null),
    [exercise],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={MODAL_SHELL} role="dialog" aria-modal="true" aria-labelledby="client-exercise-title">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 shrink-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Client view</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && (
          <div className="flex flex-1 items-center justify-center gap-2 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        )}

        {error && !loading && (
          <div className="flex-1 p-5 text-sm text-red-600">{error}</div>
        )}

        {view && !loading && !error && (
          <>
            <div className={MODAL_BODY}>
              <header className="space-y-2 border-b border-gray-100 pb-4">
                <h2 id="client-exercise-title" className="text-xl font-bold text-gray-900">
                  {view.title}
                </h2>
                <p className="text-sm leading-relaxed text-gray-600">{view.subtitle}</p>
                {view.dosageLabel && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Clock className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{view.dosageLabel}</span>
                  </div>
                )}
                {view.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {view.badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </header>

              <Section
                title="What is this?"
                hasContent={Boolean(view.whatIsThis)}
                emptyText="Description not added yet."
              >
                <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{view.whatIsThis}</p>
              </Section>

              <Section
                title="How to do it"
                hasContent={view.howTo.length > 0}
                emptyText="Steps not added yet."
              >
                <ol className="list-decimal ml-5 space-y-2 text-sm text-gray-800">
                  {view.howTo.map((step) => (
                    <li key={step} className="leading-relaxed pl-1">{step}</li>
                  ))}
                </ol>
              </Section>

              <Section
                title="What to look for"
                icon={<Check className="h-4 w-4 text-green-600" aria-hidden />}
                hasContent={view.lookFor.length > 0}
                emptyText="Quality cues not added yet."
              >
                <BulletList items={view.lookFor} variant="check" />
              </Section>

              <Section
                title="What to watch out for"
                icon={<AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />}
                hasContent={view.watchOutFor.length > 0}
                emptyText="Safety notes not added yet."
              >
                <BulletList items={view.watchOutFor} variant="warning" />
              </Section>

              <Section
                title="Watch it"
                hasContent={view.videoUrls.length > 0}
                emptyText="No demo video yet."
              >
                <YoutubeVideoList urls={view.videoUrls} title={view.title} />
              </Section>

              {view.easierOption && (
                <section className="border-t border-gray-100 pt-2">
                  <button
                    type="button"
                    onClick={() => setEasierOpen((open) => !open)}
                    className="flex w-full items-center justify-between gap-2 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <span>Try this instead</span>
                    {easierOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                  </button>
                  {easierOpen && (
                    <p className="pb-2 text-sm leading-relaxed text-gray-700">{view.easierOption}</p>
                  )}
                </section>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 shrink-0">
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
