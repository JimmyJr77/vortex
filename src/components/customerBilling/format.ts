export function money(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function localDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return includeTime
    ? date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function calendarDate(value: string | null | undefined): string {
  if (!value) return '—'
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return localDate(value)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12)
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function monthLabel(value: string | null | undefined): string {
  if (!value) return 'Indefinite'
  const [year, month] = value.slice(0, 7).split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export function billingMonthLabel(value: string | null | undefined): string {
  if (!value) return 'Unknown billing month'
  const [year, month] = value.slice(0, 7).split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function currentMonthInput(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function statusTone(status: string): string {
  const normalized = status.toLowerCase()
  if (['active', 'confirmed', 'healthy', 'paid', 'succeeded', 'synced', 'issued'].includes(normalized)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  if (['failed', 'critical', 'cancelled', 'void'].includes(normalized)) {
    return 'bg-red-50 text-red-700 border-red-200'
  }
  if (['paused', 'pending', 'pending_sync', 'requested', 'warning', 'checkout_pending', 'processing'].includes(normalized)) {
    return 'bg-amber-50 text-amber-800 border-amber-200'
  }
  return 'bg-gray-50 text-gray-600 border-gray-200'
}
