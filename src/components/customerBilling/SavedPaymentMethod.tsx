import type { CustomerBillingOverview } from './types'

export default function SavedPaymentMethod({ value }: { value: CustomerBillingOverview['paymentMethod'] }) {
  const method = value.paymentMethod
  const status = value.syncStatus
  return <div>
    {method ? <p className="mt-2 text-sm text-gray-700"><span className="capitalize">{method.brand}</span> •••• {method.last4}{method.expMonth && method.expYear ? <span className="text-gray-400"> · expires {method.expMonth}/{method.expYear}</span> : null}</p> : <p className="mt-2 text-sm text-gray-500">{status === 'failed' ? 'Saved payment details could not be synchronized.' : status === 'pending' || !status ? 'Saved payment details are awaiting synchronization.' : status === 'stale' ? 'Saved payment details need to be refreshed.' : 'No reusable default payment method found.'}</p>}
    {method && (status === 'failed' || status === 'stale') ? <p className="mt-2 text-xs text-amber-700">{status === 'failed' ? 'Synchronization failed.' : 'These saved details may have changed.'} Payment actions verify the current payment method.</p> : null}
    {value.syncedAt ? <p className="mt-2 text-xs text-gray-500">Last synchronized {new Date(value.syncedAt).toLocaleString()}</p> : null}
  </div>
}
