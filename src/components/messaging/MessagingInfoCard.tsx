interface MessagingInfoCardProps {
  infoJson?: Record<string, unknown> | null
  title?: string
}

function formatValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function MessagingInfoCard({ infoJson, title = 'Thread info' }: MessagingInfoCardProps) {
  if (!infoJson || Object.keys(infoJson).length === 0) return null

  const entries = Object.entries(infoJson).filter(([, v]) => v != null && v !== '')

  if (entries.length === 0) return null

  return (
    <div className="mx-4 mb-3 rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200 bg-white text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <dl className="divide-y divide-gray-100">
        {entries.map(([key, value]) => (
          <div key={key} className="px-3 py-2 grid grid-cols-[minmax(0,38%)_1fr] gap-2 text-sm">
            <dt className="text-gray-500 font-medium">{humanizeKey(key)}</dt>
            <dd className="text-gray-900 whitespace-pre-wrap break-words">{formatValue(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
