import CoachLayout from './coach/CoachLayout'

interface CoachAccount {
  fullName?: string
  email?: string
  [key: string]: unknown
}

interface CoachDashboardProps {
  coach: CoachAccount
  onLogout: () => void
  onReturnToWebsite?: () => void
  availablePortals?: string[]
  onSwitchPortal?: (portal: 'admin' | 'coach' | 'member' | 'website') => void
}

export default function CoachDashboard(props: CoachDashboardProps) {
  return <CoachLayout {...props} />
}
