import { CalendarDays, LayoutDashboard, MessageSquare, ShoppingBag, Sparkles, Target, Megaphone, Database, CircleHelp, FileText, Bell, Settings, ShieldCheck } from 'lucide-react'

export const legacySections = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, tabs: [{ id: 'calendar', label: 'Calendar', permission: 'scheduling.view' }] },
  { id: 'floorPlanner', label: 'Floor Planner', icon: LayoutDashboard, tabs: [{ id: 'floorPlanner', label: 'Floor Planner', permission: 'scheduling.view' }] },
  { id: 'messaging', label: 'Messages', icon: MessageSquare, tabs: [{ id: 'messages', label: 'Messages', permission: null }] },
  { id: 'store', label: 'Store', icon: ShoppingBag, tabs: [{ id: 'store', label: 'Store', permission: 'billing.view' }] },
  { id: 'highlightsEvents', label: 'Pages & Popups', icon: Sparkles, tabs: [{ id: 'specialPages', label: 'Special Pages', permission: 'classes.view' }, { id: 'highlights', label: 'Popups', permission: 'classes.view' }, { id: 'events', label: 'Events', permission: 'classes.view' }] },
  { id: 'opportunityResearch', label: 'Opportunities', icon: Target, tabs: [{ id: 'opportunities', label: 'Research board', permission: 'analytics.view' }] },
  { id: 'marketingVisibility', label: 'Marketing & Visibility', icon: Megaphone, tabs: [{ id: 'marketing', label: 'Marketing & Visibility', permission: 'analytics.view' }, { id: 'competitors', label: 'Competitors', permission: 'analytics.view' }] },
  { id: 'dataAnalysis', label: 'Database & Analysis', icon: Database, tabs: [{ id: 'analytics', label: 'Analytics & Engagement', permission: 'analytics.view' }, { id: 'dbQueries', label: 'Database Queries', permission: 'admin_access.manage' }, { id: 'schools', label: 'Schools', permission: 'schools.view' }] },
  { id: 'faqLibrary', label: 'FAQ library', icon: CircleHelp, tabs: [{ id: 'faqs', label: 'FAQ library', permission: null }] },
  { id: 'legal', label: 'Legal', icon: FileText, tabs: [{ id: 'waivers', label: 'Waivers', permission: 'waivers.view' }, { id: 'insurance', label: 'Insurance', permission: 'waivers.view' }, { id: 'staffLegal', label: 'Staff Policies and Signatures', permission: 'waivers.view' }] },
  { id: 'preferences', label: 'Preferences', icon: Bell, tabs: [{ id: 'preferences', label: 'Preferences', permission: null }] },
  { id: 'staffAccess', label: 'Staff Access', icon: ShieldCheck, tabs: [{ id: 'staffAccess', label: 'Staff Access', permission: 'admin_access.manage' }] },
  { id: 'settings', label: 'Settings', icon: Settings, tabs: [{ id: 'email', label: 'Settings', permission: 'admin_access.manage' }] },
] as const
export type LegacySection = typeof legacySections[number]['id']
