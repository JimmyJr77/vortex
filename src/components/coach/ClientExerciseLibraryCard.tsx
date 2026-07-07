import { Clock, Play } from 'lucide-react'
import type { ClientExerciseView } from '../../coach/clientExerciseCard'

export default function ClientExerciseLibraryCard({ view }: { view: ClientExerciseView }) {
  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-3">
      <header className="w-full min-w-0 pr-8">
        <h3 className="text-base font-bold leading-snug text-gray-900">{view.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600 line-clamp-3">{view.subtitle}</p>
      </header>

      {view.dosageLabel && (
        <div className="flex w-full items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{view.dosageLabel}</span>
        </div>
      )}

      {(view.badges.length > 0 || view.hasVideo) && (
        <div className="flex w-full flex-wrap gap-1.5">
          {view.badges.map((badge) => (
            <span
              key={badge}
              className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700"
            >
              {badge}
            </span>
          ))}
          {view.hasVideo && (
            <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
              <Play className="h-3 w-3" aria-hidden />
              Demo available
            </span>
          )}
        </div>
      )}
    </div>
  )
}
