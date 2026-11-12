import { Suspense, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import { button, Loading } from './shared'
import type { Access, BillingTarget } from './api'

const Accounts = lazyWithRetry(() => import('../AdminCustomerBilling'))
const Recovery = lazyWithRetry(() => import('../billing/BillingRecoveryAlerts'))
const Cancellations = lazyWithRetry(() => import('../billing/CancellationReviewPanel'))
const Disputes = lazyWithRetry(() => import('../billing/DisputeCasesPanel'))
const Operations = lazyWithRetry(() => import('../billing/StripeOperationsPanel'))
const Payments = lazyWithRetry(() => import('../billing/StripePaymentsPanel'))

export default function BillingWorkspace({ access, accountTarget, onAccountTargetConsumed }: { access: Access; accountTarget: BillingTarget | null; onAccountTargetConsumed: () => void }) {
  const [tab, setTab] = useState('accounts')
  const [version, setVersion] = useState(0)
  const tabs = [{ id: 'accounts', label: 'Account Billing & Enrollments' }, { id: 'billing', label: 'Billing' }, ...(access.isMasterAdmin ? [{ id: 'stripe', label: 'Stripe Payments' }] : [])]
  const current = accountTarget ? 'accounts' : tabs.some(item => item.id === tab) ? tab : 'accounts'
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold">Billing</h2><button className={button} onClick={() => setVersion(value => value + 1)}><RefreshCw className="h-4 w-4" />Refresh billing</button></div>
    <nav aria-label="Billing tabs" className="flex gap-1 overflow-x-auto border-b border-gray-200">{tabs.map(item => <button key={item.id} type="button" aria-current={current === item.id ? 'page' : undefined} onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${current === item.id ? 'border-vortex-red text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{item.label}</button>)}</nav>
    <Suspense fallback={<Loading label="Loading billing…" />}>
      {current === 'accounts' ? <Accounts key={`accounts-${version}`} accountTarget={accountTarget} onAccountTargetConsumed={() => { setTab('accounts'); onAccountTargetConsumed() }} /> : null}
      {current === 'billing' ? <div key={`billing-${version}`} className="space-y-6"><Recovery /><Cancellations /><Disputes /><Operations /></div> : null}
      {current === 'stripe' ? <Payments key={`stripe-${version}`} /> : null}
    </Suspense>
  </section>
}
