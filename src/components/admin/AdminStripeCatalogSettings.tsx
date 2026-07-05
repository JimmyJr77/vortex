import { useCallback, useEffect, useState } from 'react'
import { CreditCard, Loader2, RefreshCw } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'

interface CatalogItemRow {
  offering: string
  entityType: string
  entityId: number
  subKey: string | null
  amountCents: number
  recurringInterval: string | null
  active: boolean
  stripeProductId: string
  stripePriceId: string
  lookupKey: string
  lastSyncedAt: string | null
}

interface CatalogStatus {
  stripeEnabled: boolean
  stripeMode: 'live' | 'test' | 'unknown' | 'none'
  lastSynced: string | null
  catalogItems: {
    active_count: string
    inactive_count: string
    total_count: string
  }
  items: CatalogItemRow[]
}

interface SyncSummary {
  programs: number
  fees: number
  forms: number
  formsChecked?: number
  formsDeactivated?: number
  errors: Array<{ type: string; id: string | number; message: string }>
}

interface SyncResult {
  status: string
  reason?: string
  summary?: SyncSummary
}

const thClass = 'px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-gray-300'
const tdClass = 'px-3 py-2 text-sm text-gray-900 border-b border-gray-200 align-top'

function formatSyncedAt(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatBilling(row: CatalogItemRow): string {
  if (row.recurringInterval === 'month') return 'Monthly'
  return 'One-time'
}

function formatEntityType(value: string): string {
  switch (value) {
    case 'program_option':
      return 'Program option'
    case 'multi_class_pass':
      return 'Multi-class pass'
    case 'additional_fee':
      return 'Additional fee'
    case 'class_override':
      return 'Class override'
    default:
      return value
  }
}

function stripeModeLabel(mode: CatalogStatus['stripeMode']): string {
  switch (mode) {
    case 'live':
      return 'Live'
    case 'test':
      return 'Test'
    case 'unknown':
      return 'Configured'
    default:
      return 'Not configured'
  }
}

export default function AdminStripeCatalogSettings() {
  const [status, setStatus] = useState<CatalogStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncErrors, setSyncErrors] = useState<SyncSummary['errors']>([])

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApiRequest('/api/admin/stripe/catalog-status')
      if (res.status === 403) {
        throw new Error('You need pricing.manage permission to view Stripe catalog settings.')
      }
      if (!res.ok) throw new Error(`Backend returned ${res.status}`)
      const json = await res.json()
      setStatus(json.data as CatalogStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Stripe catalog status')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const runSync = async () => {
    setSyncing(true)
    setError(null)
    setSyncMessage(null)
    setSyncErrors([])
    try {
      const res = await adminApiRequest('/api/admin/stripe/sync-catalog', { method: 'POST' })
      if (res.status === 403) {
        throw new Error('You need pricing.manage permission to sync the Stripe catalog.')
      }
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || `Sync failed (${res.status})`)
      }
      const result = json.data as SyncResult
      if (result.status === 'skipped') {
        setSyncMessage(
          result.reason === 'stripe_disabled'
            ? 'Stripe is disabled on the server (STRIPE_ENABLED or secret key missing).'
            : 'Catalog sync was skipped.',
        )
      } else if (result.summary) {
        const { programs, fees, forms, formsDeactivated = 0, errors } = result.summary
        setSyncErrors(errors)
        const overrideLabel =
          forms === 1 ? '1 class override' : `${forms} class overrides`
        const clearedNote =
          formsDeactivated > 0
            ? ` (${formsDeactivated} stale override${formsDeactivated === 1 ? '' : 's'} cleared)`
            : ''
        if (errors.length > 0) {
          setSyncMessage(
            `Sync finished with errors — ${programs} programs, ${fees} fees, ${overrideLabel}${clearedNote}; ${errors.length} failed.`,
          )
        } else {
          setSyncMessage(
            `Catalog synced — ${programs} programs, ${fees} fees, ${overrideLabel}${clearedNote}.`,
          )
        }
      } else {
        setSyncMessage('Catalog sync completed.')
      }
      await loadStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Catalog sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const items = status?.items ?? []

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600 text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading Stripe catalog status…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 max-w-3xl">
        Vortex program pricing, passes, fees, and class overrides are the source of truth. Use a full
        sync to push every sellable item to Stripe Products and Prices. Saving pricing in Admin
        usually syncs individual items automatically.
      </p>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {syncMessage && (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            syncErrors.length > 0 ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'
          }`}
        >
          {syncMessage}
        </div>
      )}

      {status && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stripe</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {status.stripeEnabled ? 'Enabled' : 'Disabled'}
            </p>
            <p className="text-sm text-gray-600 mt-1">Mode: {stripeModeLabel(status.stripeMode)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Catalog items</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {status.catalogItems.active_count} active
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {status.catalogItems.inactive_count} inactive · {status.catalogItems.total_count} total
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last sync</p>
            <p className="mt-1 text-sm text-gray-900">{formatSyncedAt(status.lastSynced)}</p>
          </div>
        </div>
      )}

      {syncErrors.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-950 max-w-3xl">
          <p className="font-semibold mb-2">Sync errors</p>
          <ul className="list-disc pl-5 space-y-1">
            {syncErrors.map((item, index) => (
              <li key={`${item.type}-${item.id}-${index}`}>
                {item.type} {item.id}: {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void runSync()}
          disabled={syncing || !status?.stripeEnabled}
          className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Syncing catalog…
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Sync catalog to Stripe
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <CreditCard className="w-4 h-4" />
          Refresh status
        </button>
      </div>

      {!status?.stripeEnabled && (
        <p className="text-xs text-gray-500">
          Enable Stripe on the server (`STRIPE_ENABLED=true` and a secret key) before running a sync.
        </p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Stripe catalog ({items.length} rows)
        </h3>
        <div className="overflow-x-auto border border-gray-300">
          <table className="min-w-full border-collapse bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className={thClass}>Offering</th>
                <th className={thClass}>Type</th>
                <th className={thClass}>Price</th>
                <th className={thClass}>Billing</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Stripe product</th>
                <th className={thClass}>Stripe price</th>
                <th className={thClass}>Synced</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-sm text-gray-500 text-center">
                    No catalog items mapped yet. Run a sync to populate Stripe.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.lookupKey} className={row.active ? undefined : 'bg-gray-50 text-gray-600'}>
                    <td className={tdClass}>{row.offering}</td>
                    <td className={tdClass}>{formatEntityType(row.entityType)}</td>
                    <td className={tdClass}>{formatMoney(row.amountCents)}</td>
                    <td className={tdClass}>{formatBilling(row)}</td>
                    <td className={tdClass}>{row.active ? 'Active' : 'Inactive'}</td>
                    <td className={`${tdClass} font-mono text-xs break-all`}>{row.stripeProductId}</td>
                    <td className={`${tdClass} font-mono text-xs break-all`}>{row.stripePriceId}</td>
                    <td className={tdClass}>{formatSyncedAt(row.lastSyncedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
