import CoachLayout from './coach/CoachLayout'
import type { PortalId } from '../utils/portalSession'

interface CoachAccount {
  fullName?: string
  email?: string
  [key: string]: unknown
}

interface CoachDashboardProps {
  coach: CoachAccount
  onLogout: () => void
  onReturnToWebsite?: () => void
  availablePortals?: PortalId[]
  onSwitchPortal?: (portal: 'admin' | 'coach' | 'member' | 'website') => void
}

export default function CoachDashboard(props: CoachDashboardProps) {
  return <CoachLayout {...props} />
}
