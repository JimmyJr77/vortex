import brandLogo from '../assets/vortex-athletics-gymnastics-logo.webp'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Landmark, Menu, X } from 'lucide-react'
import { adminApiRequest, clearAdminSession, getAdminToken } from '../utils/api'
import type { PortalId } from '../utils/portalSession'
import { NOTIFICATION_NAV_EVENT, type NotificationNavigateDetail } from '../utils/notificationNavigation'
import StaffLegalPolicies from './legal/StaffLegalPolicies'
import PortalNavButtons from './PortalNavButtons'
import NotificationBell from './NotificationBell'

const AdminPayroll = lazy(() => import('./payroll/AdminPayroll'))

interface AdminProps {
  onLogout: () => void
  availablePortals?: PortalId[]
  onSwitchPortal?: (portal: PortalId) => void
}

interface AccessContext {
  permissions: string[]
  isMasterAdmin: boolean
}

export default function Admin({ onLogout, availablePortals = ['admin'], onSwitchPortal }: AdminProps) {
  const [navOpen, setNavOpen] = useState(false)
  const [accessContext, setAccessContext] = useState<AccessContext | null>(null)
  const [accessLoading, setAccessLoading] = useState(true)
  const [accessError, setAccessError] = useState('')

  useEffect(() => {
    if (!getAdminToken()) {
      clearAdminSession()
      onLogout()
    }
  }, [onLogout])

  useEffect(() => {
    let active = true
    const loadAccessContext = async () => {
      try {
        const response = await adminApiRequest('/api/admin/access/me')
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to check payroll access.')
        if (active) setAccessContext({
          permissions: data.data?.permissions ?? [],
          isMasterAdmin: Boolean(data.data?.isMasterAdmin),
        })
      } catch (error) {
        if (active) setAccessError(error instanceof Error ? error.message : 'Unable to check payroll access.')
      } finally {
        if (active) setAccessLoading(false)
      }
    }
    void loadAccessContext()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (accessLoading) return
    const params = new URLSearchParams(window.location.search)
    const familyId = Number(params.get('adminBillingFamilyId'))
    const memberId = Number(params.get('adminBillingMemberId'))
    if (Number.isSafeInteger(familyId) && familyId > 0) {
      sessionStorage.setItem('vortex_admin_handoff', JSON.stringify({ section: 'billing', familyId, memberId: Number.isSafeInteger(memberId) && memberId > 0 ? memberId : null }))
      onSwitchPortal?.('new-admin')
    }
  }, [accessLoading, onSwitchPortal])

  useEffect(() => {
    const onNavigateNotification = (event: Event) => {
      const detail = (event as CustomEvent<NotificationNavigateDetail>).detail
      if (detail?.portal !== 'admin' || (detail.section !== 'messages' && detail.section !== 'billing')) return
      sessionStorage.setItem('vortex_admin_handoff', JSON.stringify({ notification: detail }))
      onSwitchPortal?.('new-admin')
    }
    window.addEventListener(NOTIFICATION_NAV_EVENT, onNavigateNotification)
    return () => window.removeEventListener(NOTIFICATION_NAV_EVENT, onNavigateNotification)
  }, [onSwitchPortal])

  const canViewPayroll = Boolean(accessContext?.isMasterAdmin || accessContext?.permissions.includes('payroll.view'))

  return (
    <div className="portal-shell portal-admin">
      <StaffLegalPolicies portal="admin" />
      <header className="portal-header shrink-0">
        <div className="container-admin portal-header-inner">
          <div className="portal-header-identity">
            <button type="button" className="portal-menu-toggle lg:hidden" aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={navOpen} aria-controls="in-development-navigation" onClick={() => setNavOpen(open => !open)}>
              {navOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
            <img className="portal-brand" src={brandLogo} width="1086" height="171" alt="Vortex Athletics & Gymnastics" />
            <div className="portal-header-heading"><h1 className="portal-title">In Development</h1></div>
          </div>
          <PortalNavButtons activePortal="admin" availablePortals={availablePortals} onSwitchPortal={onSwitchPortal} onLogout={onLogout} notifications={<NotificationBell apiPrefix="admin" />} />
        </div>
      </header>

      <div className="container-admin pt-6 pb-6 grid gap-6 lg:grid-cols-[220px_1fr] flex-1 min-h-0 overflow-hidden">
        <nav id="in-development-navigation" aria-label="In Development sections" className={`portal-sidebar min-h-0 overflow-y-auto ${navOpen ? 'block' : 'hidden lg:block'}`}>
          {canViewPayroll ? <div className="portal-nav-card bg-white border border-gray-200 rounded-xl p-2">
            <button type="button" onClick={() => setNavOpen(false)} aria-current="page" className="portal-tab w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors">
              <Landmark className="w-4 h-4" aria-hidden="true" /> Payroll
            </button>
          </div> : null}
        </nav>

        <main className={`portal-main min-w-0 flex-col min-h-0 flex-1 overscroll-y-none overflow-y-auto ${navOpen ? 'hidden lg:flex' : 'flex'}`}>
          {accessLoading ? <div className="rounded-xl bg-white p-8 text-center text-gray-600 shadow-sm">Checking payroll access…</div>
            : accessError ? <p role="alert" className="rounded-xl bg-white p-8 text-red-700 shadow-sm">{accessError}</p>
              : canViewPayroll ? <Suspense fallback={<div className="py-16 text-center text-sm font-semibold text-slate-500">Loading payroll…</div>}><AdminPayroll /></Suspense>
                : <p role="status" className="rounded-xl bg-white p-8 text-gray-600 shadow-sm">Your staff account does not have access to Payroll.</p>}
        </main>
      </div>
    </div>
  )
}
