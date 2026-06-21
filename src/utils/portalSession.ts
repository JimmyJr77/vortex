export type PortalRole = string | { role?: string }
export type PortalId = 'website' | 'admin' | 'coach' | 'member'

export interface PortalAccount {
  id?: number
  email?: string
  firstName?: string
  lastName?: string
  fullName?: string
  phone?: string
  username?: string
  role?: string
  roles?: PortalRole[]
  availablePortals?: string[]
  isAdmin?: boolean
  isCoach?: boolean
  hasMemberPortal?: boolean
  [key: string]: unknown
}

export function getRoleKeys(account: PortalAccount | null): string[] {
  const roles = account?.roles || (account?.role ? [account.role] : [])
  return roles.map((role) => (typeof role === 'string' ? role : role?.role)).filter(Boolean) as string[]
}

export function getAvailablePortals(account: PortalAccount | null): PortalId[] {
  if (account?.availablePortals?.length) {
    return account.availablePortals.filter((portal): portal is PortalId =>
      ['website', 'admin', 'coach', 'member'].includes(portal),
    )
  }
  const roles = getRoleKeys(account)
  return [
    ...(account?.hasMemberPortal || roles.some((role) => ['PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE', 'MEMBER'].includes(role)) ? ['member' as const] : []),
    ...(account?.isCoach || roles.includes('COACH') ? ['coach' as const] : []),
    ...(account?.isAdmin || roles.some((role) => ['OWNER_ADMIN', 'MASTER_ADMIN', 'ADMIN'].includes(role)) ? ['admin' as const] : []),
  ]
}

export function bestPortalForAccount(account: PortalAccount | null): PortalId {
  const portals = getAvailablePortals(account)
  return portals.includes('member') ? 'member' : (portals[0] ?? 'member')
}

export function clearPortalSession(): void {
  localStorage.removeItem('vortex_member_token')
  localStorage.removeItem('vortex_member')
  localStorage.removeItem('vortex_admin')
  localStorage.removeItem('adminToken')
  localStorage.removeItem('vortex-admin-info')
  localStorage.removeItem('vortex-admin-id')
}

export function persistMemberSession(token: string, account: PortalAccount): void {
  localStorage.setItem('vortex_member_token', token)
  localStorage.setItem('vortex_member', JSON.stringify(account))
}

export function persistAdminSessionFromAccount(token: string, account: PortalAccount): void {
  localStorage.setItem('vortex_admin', 'true')
  localStorage.setItem('adminToken', token)
  localStorage.setItem('vortex-admin-info', JSON.stringify({
    email: account.email,
    name: account.fullName || `${account.firstName || ''} ${account.lastName || ''}`.trim() || account.email,
    id: account.id,
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone,
    username: account.username,
    isMaster: getRoleKeys(account).some((role) => role === 'MASTER_ADMIN' || role === 'OWNER_ADMIN'),
  }))
  if (account.id != null) localStorage.setItem('vortex-admin-id', String(account.id))
}
