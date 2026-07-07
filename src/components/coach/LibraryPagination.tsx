export default function LibraryPagination({
  total,
  limit,
  offset,
  onPageChange,
  loading = false,
}: {
  total: number
  limit: number
  offset: number
  onPageChange: (offset: number) => void
  loading?: boolean
}) {
  if (total <= limit) return null

  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)
  const rangeStart = offset + 1
  const rangeEnd = Math.min(offset + limit, total)

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
      <p className="text-sm text-gray-500">
        Showing{' '}
        <span className="font-medium tabular-nums text-gray-700">{rangeStart.toLocaleString()}</span>
        {' – '}
        <span className="font-medium tabular-nums text-gray-700">{rangeEnd.toLocaleString()}</span>
        {' of '}
        <span className="font-medium tabular-nums text-gray-700">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading || offset <= 0}
          onClick={() => onPageChange(Math.max(offset - limit, 0))}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600 tabular-nums">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={loading || offset + limit >= total}
          onClick={() => onPageChange(offset + limit)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
