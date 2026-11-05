import { Suspense, useCallback, useState } from 'react'
import { BookOpen, CreditCard, Inbox, RefreshCw, Users, ReceiptText } from 'lucide-react'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import type { PortalId } from '../../utils/portalSession'
import PortalNavButtons from '../PortalNavButtons'
import { button, ErrorNotice, Loading } from './shared'
import { allowed, useRead, type Access, type BillingTarget } from './api'
import type { AccountingWorkspaceState } from './accounting/Accounting'

const Members = lazyWithRetry(() => import('./Members'))
const Leads = lazyWithRetry(() => import('./Leads'))
const Classes = lazyWithRetry(() => import('./Classes'))
const Billing = lazyWithRetry(() => import('../AdminCustomerBilling'))
const Accounting = lazyWithRetry(() => import('./accounting/Accounting'))
type Section = 'accounting' | 'members' | 'classes' | 'leads' | 'billing'
const sections = [
  { id: 'accounting' as const, label: 'Accounting', icon: ReceiptText, permission: 'billing.view' },
  { id: 'members' as const, label: 'Members & accounts', icon: Users, permission: 'members.view' },
  { id: 'classes' as const, label: 'Classes & schedules', icon: BookOpen, permission: 'classes.view' },
  { id: 'leads' as const, label: 'Leads', icon: Inbox, permission: 'members.view' },
  { id: 'billing' as const, label: 'Billing', icon: CreditCard, permission: 'billing.view' },
]

export default function NewAdmin({ onLogout, availablePortals = ['admin', 'new-admin'], onSwitchPortal }: {
  onLogout: () => void; availablePortals?: PortalId[]; onSwitchPortal?: (portal: PortalId) => void
}) {
  const [section, setSection] = useState<Section>('accounting')
  const [revision, setRevision] = useState(0)
  const [memberId, setMemberId] = useState<number | null>(null)
  const [billingTarget, setBillingTarget] = useState<BillingTarget | null>(null)
  const [accountingWorkspace, setAccountingWorkspace] = useState<AccountingWorkspaceState | null>(null)
  const access = useRead<Access>('/api/admin/access/me')
  const refresh = () => setRevision(value => value + 1)
  const consumeBillingTarget = useCallback(() => setBillingTarget(null), [])
  const openMember = (id: number) => { setMemberId(id); setSection('members') }
  const openBilling = (target: BillingTarget) => { setBillingTarget(target); setSection('billing') }
  const visible = access.data ? sections.filter(item => allowed(access.data!, item.permission)) : []
  const current = visible.find(item => item.id === section) ?? visible[0]
  return <div className="min-h-screen bg-slate-50 text-slate-950">
    <header className="bg-slate-950 px-5 py-5 text-white"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.2em] text-red-400">VORTEX ATHLETICS</p><h1 className="mt-1 text-2xl font-bold">New Admin</h1></div><PortalNavButtons activePortal="new-admin" availablePortals={availablePortals} onSwitchPortal={onSwitchPortal} onLogout={onLogout} /></div></header>
    <div className="mx-auto max-w-[1440px] p-4 sm:p-6">
      <nav aria-label="New Admin sections" className="mb-6 flex flex-wrap items-center gap-2">{visible.map(item => <button key={item.id} onClick={() => { setSection(item.id); setMemberId(null); refresh() }} aria-current={current?.id === item.id ? 'page' : undefined} className={`${button} ${current?.id === item.id ? '!border-red-600 !bg-red-600 !text-white' : ''}`}><item.icon className="h-4 w-4" />{item.label}</button>)}{current?.id !== 'billing' ? <button className={`${button} ml-auto`} onClick={refresh} aria-label="Refresh New Admin"><RefreshCw className="h-4 w-4" />Refresh</button> : null}</nav>
      {access.loading ? <Loading label="Checking administrative access…" /> : null}
      <ErrorNotice message={access.error} onRetry={() => window.location.reload()} />
      {access.data && !current ? <p role="status">Your staff account has no permissions for these administrative workflows.</p> : null}
      <main><Suspense fallback={<Loading label="Opening workspace…" />}>
        {access.data && current?.id === 'accounting' ? <Accounting revision={revision} onBilling={openBilling} workspace={accountingWorkspace} onWorkspaceChange={setAccountingWorkspace} /> : null}
        {access.data && current?.id === 'members' ? <Members access={access.data} revision={revision} selectedId={memberId} onSelect={setMemberId} onBilling={openBilling} /> : null}
        {access.data && current?.id === 'leads' ? <Leads access={access.data} revision={revision} onMember={openMember} /> : null}
        {access.data && current?.id === 'classes' ? <Classes access={access.data} revision={revision} onMember={openMember} /> : null}
        {access.data && current?.id === 'billing' ? <Billing accountTarget={billingTarget} onAccountTargetConsumed={consumeBillingTarget} accessContext={access.data} /> : null}
      </Suspense></main>
    </div>
  </div>
}
