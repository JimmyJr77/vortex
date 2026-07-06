import { Loader2 } from 'lucide-react'

export default function LibraryResultCount({
  count,
  loading,
  singular = 'card',
  plural = 'cards',
}: {
  count: number
  loading: boolean
  singular?: string
  plural?: string
}) {
  return (
    <p className="text-sm text-gray-600" aria-live="polite" aria-atomic="true">
      {loading ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
          Loading…
        </span>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-gray-900">{count.toLocaleString()}</span>
          {' '}
          {count === 1 ? singular : plural}
        </>
      )}
    </p>
  )
}
