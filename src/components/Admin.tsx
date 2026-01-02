import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, RefreshCw, Download, Edit2, Archive, X, Save, ChevronDown, ChevronUp, BarChart3, Users, Eye, MousePointer, Clock, TrendingUp, UserPlus, Plus, Calendar, MapPin, CheckCircle, Award, Trophy, Search } from 'lucide-react'
import { getAnalyticsData, clearAnalyticsData } from '../utils/analytics'
import { getApiUrl } from '../utils/api'

interface AdminProps {
  onLogout: () => void
}

interface AnalyticsData {
  totalPageViews: number
  totalEngagement: number
  totalSessions: number
  uniqueVisitorCount: number
  avgSessionTime: number
  engagementRate: string
  pageViewStats: Array<{ path: string; count: number }>
  buttonStats: Array<{ button: string; count: number }>
  recentPageViews: any[]
  recentEngagement: any[]
}

const AnalyticsView = ({ data }: { data: AnalyticsData | null }) => {
  if (!data) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="text-center py-12 text-gray-600">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
          Overview Statistics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3 mb-2">
              <Eye className="w-6 h-6 text-vortex-red" />
              <span className="text-gray-600 text-sm">Total Page Views</span>
            </div>
            <div className="text-3xl font-bold text-black">{data.totalPageViews.toLocaleString()}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3 mb-2">
              <Users className="w-6 h-6 text-vortex-red" />
              <span className="text-gray-600 text-sm">Unique Visitors</span>
            </div>
            <div className="text-3xl font-bold text-black">{data.uniqueVisitorCount.toLocaleString()}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3 mb-2">
              <MousePointer className="w-6 h-6 text-vortex-red" />
              <span className="text-gray-600 text-sm">Total Engagement</span>
            </div>
            <div className="text-3xl font-bold text-black">{data.totalEngagement.toLocaleString()}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3 mb-2">
              <Clock className="w-6 h-6 text-vortex-red" />
              <span className="text-gray-600 text-sm">Avg Session Time</span>
            </div>
            <div className="text-3xl font-bold text-black">{data.avgSessionTime}</div>
            <div className="text-xs text-gray-600 mt-1">minutes</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3 mb-2">
              <TrendingUp className="w-6 h-6 text-vortex-red" />
              <span className="text-gray-600 text-sm">Engagement Rate</span>
            </div>
            <div className="text-3xl font-bold text-black">{data.engagementRate}%</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3 mb-2">
              <BarChart3 className="w-6 h-6 text-vortex-red" />
              <span className="text-gray-600 text-sm">Total Sessions</span>
            </div>
            <div className="text-3xl font-bold text-black">{data.totalSessions.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Most Popular Pages */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-xl md:text-2xl font-display font-bold text-black mb-4">
          Most Popular Pages
        </h3>
        <div className="space-y-2">
          {data.pageViewStats.length > 0 ? (
            data.pageViewStats.map((page, index) => (
              <div key={page.path} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-vortex-red/20 rounded-lg flex items-center justify-center text-vortex-red font-bold">
                    {index + 1}
                  </div>
                  <span className="text-black font-medium">{page.path === '/' ? 'Home' : page.path}</span>
                </div>
                <div className="text-vortex-red font-bold">{page.count.toLocaleString()} views</div>
              </div>
            ))
          ) : (
            <div className="text-gray-600 text-center py-4">No page view data yet</div>
          )}
        </div>
      </div>

      {/* Most Clicked Buttons */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-xl md:text-2xl font-display font-bold text-black mb-4">
          Most Clicked Buttons
        </h3>
        <div className="space-y-2">
          {data.buttonStats.length > 0 ? (
            data.buttonStats.map((button, index) => (
              <div key={button.button} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-vortex-red/20 rounded-lg flex items-center justify-center text-vortex-red font-bold">
                    {index + 1}
                  </div>
                  <span className="text-black font-medium">{button.button}</span>
                </div>
                <div className="text-vortex-red font-bold">{button.count.toLocaleString()} clicks</div>
              </div>
            ))
          ) : (
            <div className="text-gray-600 text-center py-4">No button click data yet</div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
          <h3 className="text-xl md:text-2xl font-display font-bold text-black mb-4">
            Recent Page Views
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.recentPageViews.length > 0 ? (
              data.recentPageViews.map((pv, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200">
                  <div className="text-black font-medium">{pv.path === '/' ? 'Home' : pv.path}</div>
                  <div className="text-gray-600 text-xs mt-1">
                    {new Date(pv.timestamp).toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-600 text-center py-4">No recent page views</div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
          <h3 className="text-xl md:text-2xl font-display font-bold text-black mb-4">
            Recent Engagement
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.recentEngagement.length > 0 ? (
              data.recentEngagement.map((event, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-black font-medium">{event.type.replace('_', ' ')}</span>
                    <span className="text-vortex-red text-xs">{event.target}</span>
                  </div>
                  <div className="text-gray-600 text-xs mt-1">
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-600 text-center py-4">No recent engagement</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const EventsView = ({ 
  events, 
  loading, 
  searchQuery, 
  onSearchChange, 
  onEdit, 
  onDelete,
  onArchive,
  showArchived,
  error
}: { 
  events: Event[]
  loading: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  onEdit: (event: Event) => void
  onDelete: (id: string | number) => void
  onArchive: (id: string | number, archived: boolean) => void
  showArchived?: boolean
  error?: string | null
}) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const formatDateRange = (start: Date, end?: Date) => {
    if (!end || start.getTime() === end.getTime()) {
      return formatDate(start)
    }
    return `${formatDate(start)} - ${formatDate(end)}`
  }

  const formatDateTimeEntry = (entry: DateTimeEntry) => {
    const dateStr = formatDate(entry.date)
    
    if (entry.allDay) {
      return `${dateStr}: All Day Event`
    } else if (entry.startTime && entry.endTime) {
      return `${dateStr}: ${entry.startTime} - ${entry.endTime}`
    } else if (entry.startTime) {
      return `${dateStr}: ${entry.startTime}`
    } else if (entry.description) {
      return `${dateStr}: ${entry.description}`
    } else {
      return dateStr
    }
  }

  const getEventIcon = (type?: Event['type']) => {
    switch (type) {
      case 'camp':
        return Award
      case 'class':
        return Users
      case 'watch-party':
        return Trophy
      default:
        return Calendar
    }
  }

  // Filter events based on search query
  const filteredEvents = events.filter(event => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase()
    const searchableText = [
      event.eventName,
      event.shortDescription,
      event.longDescription,
      event.address || '',
      ...(event.keyDetails || [])
    ].join(' ').toLowerCase()
    
    return searchableText.includes(query)
  }).sort((a, b) => {
    // Handle cases where startDate might not be a valid Date object
    try {
      const aTime = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime()
      const bTime = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime()
      return aTime - bTime
    } catch {
      return 0
    }
  })

  if (loading) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="text-center py-12 text-gray-600">Loading events...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="text-center py-12">
          <div className="text-red-600 mb-4 font-semibold">Error Loading Events</div>
          <div className="text-gray-600 mb-4">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search events by name, description, or location..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors"
          />
        </div>
      </div>

      {/* Calendar of Events */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
          Calendar of Events {events.length > 0 && `(${events.length} total)`}
        </h2>
        
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">
              {searchQuery ? `No events found matching "${searchQuery}"` : `No events at this time. (Total events in database: ${events.length})`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between space-x-4 py-3 border-b border-gray-200 last:border-b-0"
              >
                <div className="flex items-start space-x-4 flex-1">
                  <div className="flex-shrink-0 w-32">
                    <p className="text-sm font-semibold text-vortex-red">
                      {formatDateRange(event.startDate, event.endDate)}
                    </p>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-display font-bold text-black mb-1">
                      {event.eventName}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {event.shortDescription}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => onEdit(event)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  {showArchived ? (
                    <>
                      <button
                        onClick={() => onArchive(event.id, false)}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                      >
                        <Archive className="w-4 h-4" />
                        Unarchive
                      </button>
                      <button
                        onClick={() => onDelete(event.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium"
                      >
                        <X className="w-4 h-4" />
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onArchive(event.id, true)}
                      className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium"
                    >
                      <Archive className="w-4 h-4" />
                      Archive
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Details */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
          Event Details
        </h2>
        
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">
              {searchQuery ? `No events found matching "${searchQuery}"` : 'No events at this time.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredEvents.map((event) => {
              const Icon = getEventIcon(event.type || 'event')
              
              return (
                <div
                  key={event.id}
                  className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border-2 border-gray-200"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-vortex-red/10 rounded-xl flex items-center justify-center">
                        <Icon className="w-6 h-6 text-vortex-red" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-display font-bold text-black">
                          {event.eventName}
                        </h3>
                        <p className="text-gray-600 flex items-center space-x-2 mt-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDateRange(event.startDate, event.endDate)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {event.archived && (
                        <span className="flex items-center gap-2 px-3 py-2 bg-gray-500 rounded text-white text-sm font-medium">
                          <Archive className="w-4 h-4" />
                          Archived
                        </span>
                      )}
                      <button
                        onClick={() => onEdit(event)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      {showArchived ? (
                        <>
                          <button
                            onClick={() => onArchive(event.id, false)}
                            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                          >
                            <Archive className="w-4 h-4" />
                            Unarchive
                          </button>
                          <button
                            onClick={() => onDelete(event.id)}
                            className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium"
                          >
                            <X className="w-4 h-4" />
                            Delete
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onArchive(event.id, true)}
                          className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium"
                        >
                          <Archive className="w-4 h-4" />
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-gray-700 mb-4 leading-relaxed">
                    {event.longDescription}
                  </p>
                  
                  {event.datesAndTimes && event.datesAndTimes.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <h4 className="font-bold text-black mb-2">Dates & Times:</h4>
                      <ul className="space-y-1">
                        {event.datesAndTimes.map((entry, entryIndex) => (
                          <li key={entryIndex} className="flex items-start space-x-2 text-gray-700 text-sm">
                            <Calendar className="w-4 h-4 text-vortex-red flex-shrink-0 mt-1" />
                            <span>{formatDateTimeEntry(entry)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {event.keyDetails && event.keyDetails.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-black mb-2">Key Details:</h4>
                      <ul className="space-y-1">
                        {event.keyDetails.map((detail, detailIndex) => (
                          <li key={detailIndex} className="flex items-start space-x-2">
                            <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700 text-sm">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {event.address && (
                    <div className="mt-4">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 text-vortex-red hover:text-red-700 transition-colors text-sm"
                      >
                        <MapPin className="w-4 h-4" />
                        <span className="underline">{event.address}</span>
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface User {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  athlete_age: number | null
  interests: string | null
  message: string | null
  created_at: string
  newsletter: boolean
  archived?: boolean
}

type FilterType = 'all' | 'newsletter' | 'interests'
type TabType = 'users' | 'analytics' | 'membership' | 'classes' | 'events' | 'admins'

interface DateTimeEntry {
  date: Date
  startTime?: string
  endTime?: string
  description?: string
  allDay?: boolean
}

interface Event {
  id: string | number
  eventName: string
  shortDescription: string
  longDescription: string
  startDate: Date
  endDate?: Date
  type?: 'camp' | 'class' | 'event' | 'watch-party'
  datesAndTimes?: DateTimeEntry[]
  keyDetails?: string[]
  address?: string
  archived?: boolean
}

interface MemberChild {
  id?: number
  firstName: string
  lastName: string
  dateOfBirth: string
}

interface Member {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  address: string | null
  account_status: 'active' | 'hold' | 'canceled' | 'past_due'
  program: string | null
  notes: string | null
  created_at: string
  children?: MemberChild[]
}

interface Program {
  id: number
  category: 'EARLY_DEVELOPMENT' | 'GYMNASTICS' | 'VORTEX_NINJA' | 'ATHLETICISM_ACCELERATOR' | 'ADULT_FITNESS' | 'HOMESCHOOL'
  categoryId?: number | null
  categoryName?: string | null
  categoryDisplayName?: string | null
  name: string
  displayName: string
  skillLevel: 'EARLY_STAGE' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null
  ageMin: number | null
  ageMax: number | null
  description: string | null
  skillRequirements: string | null
  isActive: boolean
  archived?: boolean
  createdAt: string
  updatedAt: string
}

interface Category {
  id: number
  name: string
  displayName: string
  description?: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}


export default function Admin({ onLogout }: AdminProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<User>>({})
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({ field: 'created_at', direction: 'desc' })
  const [activeTab, setActiveTab] = useState<TabType>('users')
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [memberFormData, setMemberFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    program: '',
    notes: '',
    children: [] as MemberChild[]
  })
  const [events, setEvents] = useState<Event[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | number | null>(null)
  const [eventFormData, setEventFormData] = useState<Partial<Event>>({
    eventName: '',
    shortDescription: '',
    longDescription: '',
    startDate: new Date(),
    endDate: undefined,
    type: 'event',
    datesAndTimes: [],
    keyDetails: [],
    address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
  })
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [useShortAsLong, setUseShortAsLong] = useState(true)
  const [showArchivedEvents, setShowArchivedEvents] = useState(false)
  const [adminInfo, setAdminInfo] = useState<{ email: string; name: string; id?: number; firstName?: string; lastName?: string; phone?: string; username?: string; isMaster?: boolean } | null>(null)
  const [showEditLog, setShowEditLog] = useState(false)
  const [editLog, setEditLog] = useState<any[]>([])
  const [editLogLoading, setEditLogLoading] = useState(false)
  const [admins, setAdmins] = useState<any[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [adminFormData, setAdminFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    password: ''
  })
  const [editingMyAccount, setEditingMyAccount] = useState(false)
  const [myAccountData, setMyAccountData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    password: ''
  })
  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(false)
  const [editingProgramId, setEditingProgramId] = useState<number | null>(null)
  const [programFormData, setProgramFormData] = useState<Partial<Program>>({})
  const [showArchivedPrograms, setShowArchivedPrograms] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [categoryFormData, setCategoryFormData] = useState<Partial<Category>>({})
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showClassModal, setShowClassModal] = useState(false)
  const [selectedCategoryForClass, setSelectedCategoryForClass] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
    loadAnalytics()
    
    // Get admin info from localStorage (set during login)
    const storedAdmin = localStorage.getItem('vortex-admin-info')
    if (storedAdmin) {
      try {
        setAdminInfo(JSON.parse(storedAdmin))
      } catch {
        // If parsing fails, use default admin info
        const defaultAdmin = { email: 'admin@vortexathletics.com', name: 'Admin' }
        setAdminInfo(defaultAdmin)
        localStorage.setItem('vortex-admin-info', JSON.stringify(defaultAdmin))
      }
    } else {
      // If no admin info stored, use default (shouldn't happen if login worked)
      const defaultAdmin = { email: 'admin@vortexathletics.com', name: 'Admin' }
      setAdminInfo(defaultAdmin)
      localStorage.setItem('vortex-admin-info', JSON.stringify(defaultAdmin))
    }
  }, [])


  const loadAnalytics = () => {
    const data = getAnalyticsData()
    setAnalyticsData(data)
  }

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics()
    } else if (activeTab === 'membership') {
      fetchMembers()
    } else if (activeTab === 'events') {
      fetchEvents()
    } else if (activeTab === 'classes') {
      fetchPrograms()
      fetchCategories()
    } else if (activeTab === 'admins') {
      fetchAdmins()
      fetchMyAccount()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'classes') {
      fetchPrograms()
    }
  }, [showArchivedPrograms])

  useEffect(() => {
    if (activeTab === 'classes') {
      fetchCategories()
    }
  }, [showArchivedPrograms])


  const fetchMembers = async () => {
    try {
      setMembersLoading(true)
      setError(null)
      const apiUrl = getApiUrl()
      
      const response = await fetch(`${apiUrl}/api/admin/members`)
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      
      if (data.success) {
        setMembers(data.data)
      }
    } catch (error) {
      console.error('Error fetching members:', error)
      setError(error instanceof Error ? error.message : 'Unable to fetch members')
    } finally {
      setMembersLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const apiUrl = getApiUrl()
      
      const regResponse = await fetch(`${apiUrl}/api/admin/registrations`)
      if (!regResponse.ok) {
        throw new Error(`Backend returned ${regResponse.status}: ${regResponse.statusText}`)
      }
      const regData = await regResponse.json()
      
      const newsResponse = await fetch(`${apiUrl}/api/admin/newsletter`)
      if (!newsResponse.ok) {
        throw new Error(`Backend returned ${newsResponse.status}: ${newsResponse.statusText}`)
      }
      const newsData = await newsResponse.json()
      
      if (regData.success && newsData.success) {
        const newsletterEmails = new Set(newsData.data.map((sub: any) => sub.email))
        
        const combinedUsers = regData.data.map((user: any) => ({
          ...user,
          newsletter: newsletterEmails.has(user.email)
        }))
        
        setUsers(combinedUsers)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setError(error instanceof Error ? error.message : 'Unable to connect to backend. Please check if the backend service is running on Render.')
    } finally {
      setLoading(false)
    }
  }

  const sortedUsers = [...users].sort((a, b) => {
    const aValue = a[sortConfig.field as keyof User]
    const bValue = b[sortConfig.field as keyof User]
    
    if (aValue === null || aValue === undefined) return 1
    if (bValue === null || bValue === undefined) return -1
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
    }
    
    return 0
  })

  // Filter users based on filter selection
  const filteredUsers = sortedUsers.filter(user => {
    if (filter === 'all') return true
    if (filter === 'newsletter') return user.newsletter
    if (filter === 'interests') return !!user.interests
    return true
  })

  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id)
    setEditingId(null)
  }

  const startEdit = (e: React.MouseEvent, user: User) => {
    e.stopPropagation()
    setEditingId(user.id)
    setEditData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      athlete_age: user.athlete_age,
      interests: user.interests,
      message: user.message
    })
  }

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editingId) return
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/registrations/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })
      
      if (response.ok) {
        await fetchData()
        setEditingId(null)
        setEditData({})
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user')
    }
  }

  const handleArchive = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('Archive this user?')) return
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/registrations/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error archiving user:', error)
      alert('Failed to archive user')
    }
  }

  const handleExportClick = () => {
    setShowExportDialog(true)
  }

  const exportToCSV = (exportNewsletter: boolean, exportInterests: boolean) => {
    const headers = ['Name', 'Email', 'Phone', 'Age', 'Interests', 'Newsletter', 'Date']
    
    const dataToExport = users.filter(user => {
      if (exportNewsletter && exportInterests) return user.newsletter || !!user.interests
      if (exportNewsletter) return user.newsletter
      if (exportInterests) return !!user.interests
      return true
    })
    
    if (dataToExport.length === 0) {
      alert('No users match the selected criteria')
      return
    }

    const csv = [
      headers.join(','),
      ...dataToExport.map(user => [
        `"${user.first_name} ${user.last_name}"`,
        user.email,
        user.phone || '',
        user.athlete_age || '',
        user.interests || '',
        user.newsletter ? 'Yes' : 'No',
        new Date(user.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vortex_roster.csv'
    a.click()
    URL.revokeObjectURL(url)
    setShowExportDialog(false)
  }

  const handleClearAnalytics = () => {
    if (confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
      clearAnalyticsData()
      loadAnalytics()
    }
  }

  const handleCreateMember = async () => {
    try {
      const apiUrl = getApiUrl()
      
      const response = await fetch(`${apiUrl}/api/admin/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: memberFormData.firstName,
          lastName: memberFormData.lastName,
          email: memberFormData.email,
          phone: memberFormData.phone || null,
          address: memberFormData.address || null,
          password: memberFormData.password,
          program: memberFormData.program || null,
          notes: memberFormData.notes || null,
          children: memberFormData.children
        })
      })

      if (response.ok) {
        await fetchMembers()
        setShowMemberForm(false)
        setMemberFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          address: '',
          password: '',
          program: '',
          notes: '',
          children: []
        })
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to create member')
      }
    } catch (error) {
      console.error('Error creating member:', error)
      alert('Failed to create member')
    }
  }

  const handleUpdateMemberStatus = async (id: number, status: string) => {
    try {
      const apiUrl = getApiUrl()
      
      const member = members.find(m => m.id === id)
      if (!member) return

      const response = await fetch(`${apiUrl}/api/admin/members/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: member.first_name,
          lastName: member.last_name,
          email: member.email,
          phone: member.phone,
          address: member.address,
          accountStatus: status,
          program: member.program,
          notes: member.notes,
          children: member.children || []
        })
      })

      if (response.ok) {
        await fetchMembers()
      }
    } catch (error) {
      console.error('Error updating member status:', error)
      alert('Failed to update member status')
    }
  }

  const addChild = () => {
    setMemberFormData({
      ...memberFormData,
      children: [...memberFormData.children, { firstName: '', lastName: '', dateOfBirth: '' }]
    })
  }

  const removeChild = (index: number) => {
    setMemberFormData({
      ...memberFormData,
      children: memberFormData.children.filter((_, i) => i !== index)
    })
  }

  const updateChild = (index: number, field: keyof MemberChild, value: string) => {
    const updatedChildren = [...memberFormData.children]
    updatedChildren[index] = { ...updatedChildren[index], [field]: value }
    setMemberFormData({ ...memberFormData, children: updatedChildren })
  }

  const fetchEvents = async () => {
    try {
      setEventsLoading(true)
      setError(null)
      const apiUrl = getApiUrl()
      
      const response = await fetch(`${apiUrl}/api/admin/events`)
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      
      if (data.success && data.data && Array.isArray(data.data)) {
        // Helper function to parse date strings in local timezone
        const parseLocalDate = (dateValue: any): Date => {
          if (!dateValue) return new Date()
          if (dateValue instanceof Date) return dateValue
          
          // If it's already a Date object (from backend), use it
          if (typeof dateValue === 'object' && dateValue.getTime) {
            return new Date(dateValue)
          }
          
          // If it's a string, parse it in local timezone
          if (typeof dateValue === 'string') {
            // Handle ISO strings (YYYY-MM-DDTHH:mm:ss.sssZ) by extracting just the date part
            const dateStr = dateValue.split('T')[0] // Get YYYY-MM-DD part
            const [year, month, day] = dateStr.split('-').map(Number)
            return new Date(year, month - 1, day)
          }
          
          return new Date(dateValue)
        }
        
        // Convert date strings to Date objects
        const eventsWithDates = data.data.map((event: any) => {
          try {
            const parsedEvent = {
              ...event,
              archived: event.archived || false,
              startDate: parseLocalDate(event.startDate),
              endDate: event.endDate ? parseLocalDate(event.endDate) : undefined,
              datesAndTimes: Array.isArray(event.datesAndTimes) 
                ? event.datesAndTimes.map((dt: any) => {
                    try {
                      return {
                        ...dt,
                        date: parseLocalDate(dt.date)
                      }
                    } catch (e) {
                      console.error('Error parsing date in datesAndTimes:', e, dt)
                      return {
                        ...dt,
                        date: new Date()
                      }
                    }
                  })
                : []
            }
            // Validate that startDate is a valid Date
            if (isNaN(parsedEvent.startDate.getTime())) {
              console.error('Invalid startDate for event:', event)
              parsedEvent.startDate = new Date()
            }
            return parsedEvent
          } catch (e) {
            console.error('Error parsing event:', e, event)
            return {
              ...event,
              startDate: new Date(),
              endDate: undefined,
              datesAndTimes: []
            }
          }
        })
        setEvents(eventsWithDates)
        setError(null) // Clear any previous errors
      } else {
        console.error('API returned success: false or no data', data)
        const errorMsg = data.message || 'Failed to fetch events'
        setError(errorMsg)
        setEvents([])
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      setError(error instanceof Error ? error.message : 'Unable to fetch events')
    } finally {
      setEventsLoading(false)
    }
  }

  const fetchAdmins = async () => {
    try {
      setAdminsLoading(true)
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/admins`)
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      if (data.success) {
        setAdmins(data.data)
      }
    } catch (error) {
      console.error('Error fetching admins:', error)
      setError(error instanceof Error ? error.message : 'Unable to fetch admins')
    } finally {
      setAdminsLoading(false)
    }
  }

  const fetchMyAccount = async () => {
    try {
      const adminId = localStorage.getItem('vortex-admin-id')
      if (!adminId) return
      
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/admins/me?id=${adminId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setMyAccountData({
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            email: data.data.email,
            phone: data.data.phone || '',
            username: data.data.username || '',
            password: ''
          })
          // Update adminInfo with the latest data including isMaster
          const updatedAdminInfo = {
            email: data.data.email,
            name: `${data.data.firstName} ${data.data.lastName}`,
            id: data.data.id,
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            phone: data.data.phone,
            username: data.data.username || '',
            isMaster: data.data.isMaster
          }
          setAdminInfo(updatedAdminInfo)
          localStorage.setItem('vortex-admin-info', JSON.stringify(updatedAdminInfo))
        }
      }
    } catch (error) {
      console.error('Error fetching my account:', error)
    }
  }

  const handleCreateAdmin = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminFormData)
      })

      if (response.ok) {
        await fetchAdmins()
        setShowAdminForm(false)
        setAdminFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          username: '',
          password: ''
        })
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to create admin')
      }
    } catch (error) {
      console.error('Error creating admin:', error)
      alert('Failed to create admin')
    }
  }

  const handleUpdateMyAccount = async () => {
    try {
      const adminId = localStorage.getItem('vortex-admin-id')
      if (!adminId) return

      const apiUrl = getApiUrl()
      const updateData: any = {
        firstName: myAccountData.firstName,
        lastName: myAccountData.lastName,
        email: myAccountData.email,
        phone: myAccountData.phone || null,
        username: myAccountData.username
      }
      
      if (myAccountData.password) {
        updateData.password = myAccountData.password
      }

      const response = await fetch(`${apiUrl}/api/admin/admins/${adminId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Update localStorage with new info
          const updatedAdmin = {
            email: data.data.email,
            name: `${data.data.firstName} ${data.data.lastName}`,
            id: data.data.id,
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            phone: data.data.phone,
            username: data.data.username || '',
            isMaster: data.data.isMaster
          }
          localStorage.setItem('vortex-admin-info', JSON.stringify(updatedAdmin))
          setAdminInfo(updatedAdmin)
          // Close edit mode and refresh account data
          setEditingMyAccount(false)
          await fetchMyAccount()
        }
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update account')
      }
    } catch (error) {
      console.error('Error updating account:', error)
      alert('Failed to update account')
    }
  }

  const fetchPrograms = async () => {
    try {
      setProgramsLoading(true)
      setError(null)
      const apiUrl = getApiUrl()
      
      const response = await fetch(`${apiUrl}/api/admin/programs?archived=${showArchivedPrograms}`)
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      
      if (data.success) {
        setPrograms(data.data)
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
      setError(error instanceof Error ? error.message : 'Unable to fetch programs')
    } finally {
      setProgramsLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true)
      const apiUrl = getApiUrl()
      
      const response = await fetch(`${apiUrl}/api/admin/categories?archived=${showArchivedPrograms}`)
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      
      if (data.success) {
        setCategories(data.data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setCategoriesLoading(false)
    }
  }


  const handleArchiveProgram = async (id: number, archived: boolean) => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/programs/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived })
      })
      
      if (response.ok) {
        await fetchPrograms()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to archive program')
      }
    } catch (error) {
      console.error('Error archiving program:', error)
      alert('Failed to archive program')
    }
  }

  const handleDeleteProgram = async (id: number) => {
    if (!confirm('Are you sure you want to delete this program? This action cannot be undone.')) {
      return
    }
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/programs/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchPrograms()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to delete program')
      }
    } catch (error) {
      console.error('Error deleting program:', error)
      alert('Failed to delete program')
    }
  }

  const handleCreateCategory = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryFormData)
      })
      
      if (response.ok) {
        await fetchCategories()
        await fetchPrograms()
        setCategoryFormData({ name: '', displayName: '', description: '' })
        setShowCategoryModal(false)
        setEditingCategoryId(null)
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to create category')
      }
    } catch (error) {
      console.error('Error creating category:', error)
      alert('Failed to create category')
    }
  }

  const handleCreateClass = async () => {
    if (!selectedCategoryForClass) {
      alert('Please select a category')
      return
    }
    
    try {
      const apiUrl = getApiUrl()
      // Create program with category_id
      const classData = {
        ...programFormData,
        categoryId: selectedCategoryForClass
      }
      
      // We need to create a program endpoint that accepts categoryId
      // For now, we'll use the existing structure but need to update backend
      const response = await fetch(`${apiUrl}/api/admin/programs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classData)
      })
      
      if (response.ok) {
        await fetchPrograms()
        setProgramFormData({})
        setShowClassModal(false)
        setSelectedCategoryForClass(null)
      } else {
        const data = await response.json()
        console.error('Create class error response:', data)
        const errorMsg = data.errors ? data.errors.join(', ') : (data.message || 'Failed to create class')
        alert(`Error creating class: ${errorMsg}`)
      }
    } catch (error) {
      console.error('Error creating class:', error)
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      alert(`Failed to create class: ${errorMessage}`)
    }
  }


  const handleUpdateCategory = async () => {
    if (!editingCategoryId) return
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/categories/${editingCategoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryFormData)
      })
      
      if (response.ok) {
        await fetchCategories()
        await fetchPrograms()
        setEditingCategoryId(null)
        setCategoryFormData({})
        setShowCategoryModal(false)
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update category')
      }
    } catch (error) {
      console.error('Error updating category:', error)
      alert('Failed to update category')
    }
  }

  const handleArchiveCategory = async (id: number, archived: boolean) => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/categories/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived })
      })
      
      if (response.ok) {
        await fetchCategories()
        await fetchPrograms()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to archive category')
      }
    } catch (error) {
      console.error('Error archiving category:', error)
      alert('Failed to archive category')
    }
  }

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return
    }
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/categories/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchCategories()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to delete category')
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('Failed to delete category')
    }
  }


  const handleEditProgram = (program: Program) => {
    setEditingProgramId(program.id)
    setProgramFormData({
      displayName: program.displayName,
      skillLevel: program.skillLevel,
      ageMin: program.ageMin,
      ageMax: program.ageMax,
      description: program.description || '',
      skillRequirements: program.skillRequirements || '',
      isActive: program.isActive
    })
  }

  const handleUpdateProgram = async () => {
    if (!editingProgramId) return
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/programs/${editingProgramId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(programFormData)
      })
      
      if (response.ok) {
        await fetchPrograms()
        setEditingProgramId(null)
        setProgramFormData({})
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update program')
      }
    } catch (error) {
      console.error('Error updating program:', error)
      alert('Failed to update program')
    }
  }

  const fetchEditLog = async (eventId: string | number) => {
    try {
      setEditLogLoading(true)
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/events/${eventId}/log`)
      if (!response.ok) {
        throw new Error(`Failed to fetch edit log: ${response.status}`)
      }
      const data = await response.json()
      if (data.success) {
        setEditLog(data.data)
      } else {
        setEditLog([])
      }
    } catch (error) {
      console.error('Error fetching edit log:', error)
      setEditLog([])
    } finally {
      setEditLogLoading(false)
    }
  }

  const handleCreateOrUpdateEvent = async () => {
    try {
      const apiUrl = getApiUrl()
      
      const url = editingEventId 
        ? `${apiUrl}/api/admin/events/${editingEventId}`
        : `${apiUrl}/api/admin/events`
      
      const method = editingEventId ? 'PUT' : 'POST'
      
      // Helper function to convert Date to YYYY-MM-DD string
      const formatDateOnly = (date: Date | undefined): string | undefined => {
        if (!date) return undefined
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      
      // Convert dates to date-only strings to avoid timezone issues
      const datesAndTimesFormatted = (eventFormData.datesAndTimes || []).map(entry => ({
        ...entry,
        date: formatDateOnly(entry.date instanceof Date ? entry.date : new Date(entry.date)) || formatDateOnly(new Date())
      }))
      
      // If checkbox is checked, use short description as long description
      const dataToSubmit = {
        ...eventFormData,
        startDate: formatDateOnly(eventFormData.startDate instanceof Date ? eventFormData.startDate : new Date(eventFormData.startDate || new Date())),
        endDate: eventFormData.endDate ? formatDateOnly(eventFormData.endDate instanceof Date ? eventFormData.endDate : new Date(eventFormData.endDate)) : undefined,
        datesAndTimes: datesAndTimesFormatted,
        longDescription: useShortAsLong ? eventFormData.shortDescription : eventFormData.longDescription,
        // Include admin info for edit tracking (only for updates)
        ...(editingEventId && adminInfo ? {
          adminEmail: adminInfo.email,
          adminName: adminInfo.name
        } : {})
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit)
      })

      if (response.ok) {
        await fetchEvents()
        setShowEventForm(false)
        setEditingEventId(null)
        setEventFormData({
          eventName: '',
          shortDescription: '',
          longDescription: '',
          startDate: new Date(),
          endDate: undefined,
          type: 'event',
          datesAndTimes: [],
          keyDetails: [],
          address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
        })
        setUseShortAsLong(true)
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to save event')
      }
    } catch (error) {
      console.error('Error saving event:', error)
      alert('Failed to save event')
    }
  }

  const handleEditEvent = (event: Event) => {
    setEditingEventId(event.id)
    const shortMatchesLong = event.shortDescription === event.longDescription
    // Ensure all datesAndTimes entries have allDay field for backward compatibility
    const datesAndTimes = (event.datesAndTimes || []).map(entry => ({
      ...entry,
      allDay: entry.allDay || false
    }))
    setEventFormData({
      eventName: event.eventName,
      shortDescription: event.shortDescription,
      longDescription: event.longDescription,
      startDate: event.startDate,
      endDate: event.endDate,
      type: event.type || 'event',
      datesAndTimes,
      keyDetails: event.keyDetails || [],
      address: event.address || 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
    })
    setUseShortAsLong(shortMatchesLong)
    setShowEventForm(true)
  }

  const handleArchiveEvent = async (id: string | number, archived: boolean) => {
    if (!confirm(archived ? 'Are you sure you want to archive this event?' : 'Are you sure you want to unarchive this event?')) return
    
    try {
      const apiUrl = getApiUrl()
      
      const response = await fetch(`${apiUrl}/api/admin/events/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived })
      })

      if (response.ok) {
        await fetchEvents()
      } else {
        alert('Failed to archive/unarchive event')
      }
    } catch (error) {
      console.error('Error archiving event:', error)
      alert('Failed to archive/unarchive event')
    }
  }

  const handleDeleteEvent = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this event?')) return
    
    try {
      const apiUrl = getApiUrl()
      
      const response = await fetch(`${apiUrl}/api/admin/events/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchEvents()
      } else {
        alert('Failed to delete event')
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Failed to delete event')
    }
  }

  const parseTime = (timeStr: string): { hour: number; minute: number; ampm: 'am' | 'pm' } => {
    // Default to 12:00am if empty
    if (!timeStr || timeStr.trim() === '') {
      return { hour: 12, minute: 0, ampm: 'am' }
    }
    
    // Parse ##:##am/pm format
    const match = timeStr.match(/(\d{1,2}):(\d{2})(am|pm)/i)
    if (match) {
      let hour = parseInt(match[1], 10)
      const minute = parseInt(match[2], 10)
      const ampm = match[3].toLowerCase() as 'am' | 'pm'
      
      // Convert to 24-hour for easier manipulation
      if (ampm === 'pm' && hour !== 12) hour += 12
      if (ampm === 'am' && hour === 12) hour = 0
      
      return { hour, minute, ampm }
    }
    
    // Fallback
    return { hour: 12, minute: 0, ampm: 'am' }
  }

  const formatTime = (hour: number, minute: number, ampm: 'am' | 'pm'): string => {
    // Convert from 24-hour to 12-hour
    let displayHour = hour
    if (hour === 0) {
      displayHour = 12
    } else if (hour > 12) {
      displayHour = hour - 12
    }
    
    const hourStr = displayHour.toString().padStart(2, '0')
    const minuteStr = minute.toString().padStart(2, '0')
    
    return `${hourStr}:${minuteStr}${ampm}`
  }

  const TimeSpinner = ({ value, onChange, allowEmpty = false }: { value: string; onChange: (value: string) => void; allowEmpty?: boolean }) => {
    const isEmpty = !value || value.trim() === ''
    
    // If empty and allowEmpty, show placeholder state
    if (isEmpty && allowEmpty) {
      return (
        <div className="flex items-center gap-2 bg-gray-600 rounded-lg border border-gray-500 px-2 py-2 h-[42px] w-fit">
          <button
            type="button"
            onClick={() => onChange('12:00am')}
            className="text-gray-400 hover:text-white text-sm"
          >
            Set Time
          </button>
        </div>
      )
    }
    
    const { hour, minute, ampm } = parseTime(value)
    
    const adjustHour = (delta: number) => {
      let newHour = hour + delta
      if (newHour < 0) newHour = 23
      if (newHour > 23) newHour = 0
      
      // Determine am/pm based on new hour
      let newAmpm: 'am' | 'pm' = ampm
      if (newHour === 0) newAmpm = 'am'
      else if (newHour === 12) newAmpm = 'pm'
      else if (newHour < 12) newAmpm = 'am'
      else newAmpm = 'pm'
      
      onChange(formatTime(newHour, minute, newAmpm))
    }
    
    const adjustMinute = (delta: number) => {
      let newMinute = minute + delta
      // Loop continuously: 59 -> 00 when going up, 00 -> 59 when going down
      if (newMinute < 0) {
        newMinute = 59
      } else if (newMinute > 59) {
        newMinute = 0
      }
      onChange(formatTime(hour, newMinute, ampm))
    }
    
    const toggleAmPm = () => {
      const newAmpm = ampm === 'am' ? 'pm' : 'am'
      onChange(formatTime(hour, minute, newAmpm))
    }
    
    // Convert to 12-hour for display
    let displayHour = hour
    if (hour === 0) displayHour = 12
    else if (hour > 12) displayHour = hour - 12
    
    return (
      <div className="flex items-center gap-1 bg-gray-600 rounded-lg border border-gray-500 px-2 py-2 h-[42px] w-fit">
        {/* Hour */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="1"
            max="12"
            value={displayHour}
            onChange={(e) => {
              let newHour = parseInt(e.target.value) || 1
              if (newHour < 1) newHour = 1
              if (newHour > 12) newHour = 12
              
              // Convert to 24-hour
              let hour24 = newHour
              if (ampm === 'pm' && newHour !== 12) hour24 = newHour + 12
              if (ampm === 'am' && newHour === 12) hour24 = 0
              
              onChange(formatTime(hour24, minute, ampm))
            }}
            className="w-10 text-center bg-transparent text-white border-none outline-none text-base font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => adjustHour(1)}
              className="text-gray-300 hover:text-white transition-colors p-0.5"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => adjustHour(-1)}
              className="text-gray-300 hover:text-white transition-colors p-0.5"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <span className="text-white text-base font-mono">:</span>
        
        {/* Minute */}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={minute.toString().padStart(2, '0')}
            onChange={(e) => {
              let newMinute = parseInt(e.target.value) || 0
              if (newMinute < 0) newMinute = 0
              if (newMinute > 59) newMinute = 59
              onChange(formatTime(hour, newMinute, ampm))
            }}
            className="w-10 text-center bg-transparent text-white border-none outline-none text-base font-mono [appearance:textfield]"
          />
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => adjustMinute(1)}
              className="text-gray-300 hover:text-white transition-colors p-0.5"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => adjustMinute(-1)}
              className="text-gray-300 hover:text-white transition-colors p-0.5"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* AM/PM */}
        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            onClick={toggleAmPm}
            className="text-white text-base font-semibold min-w-[2.5ch] text-center px-1.5 py-1 rounded hover:bg-gray-500 transition-colors"
          >
            {ampm.toUpperCase()}
          </button>
          <div className="flex flex-col">
            <button
              type="button"
              onClick={toggleAmPm}
              className="text-gray-300 hover:text-white transition-colors p-0.5"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleAmPm}
              className="text-gray-300 hover:text-white transition-colors p-0.5"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Admin Header Section - Dark Background */}
      <div className="bg-gradient-to-br from-black via-gray-900 to-black pt-32 pb-0">
        <div className="container-custom">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white text-center md:text-left">
              VORTEX <span className="text-vortex-red">ADMIN</span>
            </h1>
          <div className="flex gap-2">
            {activeTab === 'users' && (
              <>
                <motion.button
                  onClick={fetchData}
                  className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden md:inline">Refresh</span>
                </motion.button>
                <motion.button
                  onClick={handleExportClick}
                  className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden md:inline">Export</span>
                </motion.button>
              </>
            )}
            {activeTab === 'membership' && (
              <motion.button
                onClick={fetchMembers}
                className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden md:inline">Refresh</span>
              </motion.button>
            )}
            {activeTab === 'classes' && (
              <motion.button
                onClick={fetchPrograms}
                className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden md:inline">Refresh</span>
              </motion.button>
            )}
            {activeTab === 'events' && (
              <motion.button
                onClick={fetchEvents}
                className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden md:inline">Refresh</span>
              </motion.button>
            )}
            {activeTab === 'admins' && (
              <motion.button
                onClick={() => {
                  fetchAdmins()
                  fetchMyAccount()
                }}
                className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden md:inline">Refresh</span>
              </motion.button>
            )}
            {activeTab === 'analytics' && (
              <>
                <motion.button
                  onClick={loadAnalytics}
                  className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden md:inline">Refresh</span>
                </motion.button>
                <motion.button
                  onClick={handleClearAnalytics}
                  className="flex items-center space-x-2 bg-red-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-4 h-4" />
                  <span className="hidden md:inline">Clear Data</span>
                </motion.button>
              </>
            )}
            <motion.button
              onClick={onLogout}
              className="flex items-center space-x-2 bg-vortex-red text-white px-3 md:px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </motion.button>
          </div>
          </div>

          {/* Tabs */}
          <div className="flex justify-center border-t border-gray-700">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('admins')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'admins'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Admins
                {activeTab === 'admins' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('membership')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'membership'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Members
                {activeTab === 'membership' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'users'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Inquiries
                {activeTab === 'users' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('classes')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'classes'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Classes
                {activeTab === 'classes' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'events'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Events
                {activeTab === 'events' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'analytics'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Analytics & Engagement
                {activeTab === 'analytics' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section - White Background */}
      <div className="bg-white p-4 md:p-8">
        <div className="container-custom">

          <AnimatePresence mode="wait">
            {activeTab === 'analytics' ? (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <AnalyticsView data={analyticsData} />
              </motion.div>
            ) : activeTab === 'classes' ? (
              <motion.div
                key="classes"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Classes Management */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
                      Classes Management
                    </h2>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => {
                          setShowArchivedPrograms(!showArchivedPrograms)
                          fetchPrograms()
                          fetchCategories()
                        }}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                          showArchivedPrograms
                            ? 'bg-gray-600 text-white hover:bg-gray-700'
                            : 'bg-gray-500 text-white hover:bg-gray-600'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Archive className="w-4 h-4" />
                        <span>{showArchivedPrograms ? 'Show Active' : 'Show Archives'}</span>
                      </motion.button>
                      <motion.button
                        onClick={() => {
                          setEditingCategoryId(null)
                          setCategoryFormData({ name: '', displayName: '', description: '' })
                          setShowCategoryModal(true)
                        }}
                        className="flex items-center space-x-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Category</span>
                      </motion.button>
                    </div>
                  </div>

                  {programsLoading || categoriesLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading...</div>
                  ) : error ? (
                    <div className="text-center py-12">
                      <div className="text-red-600 mb-4 font-semibold">Error Loading Data</div>
                      <div className="text-gray-600 mb-4">{error}</div>
                      <button
                        onClick={() => {
                          fetchPrograms()
                          fetchCategories()
                        }}
                        className="bg-vortex-red hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {categories
                        .filter(cat => showArchivedPrograms ? cat.archived : !cat.archived)
                        .map((category) => {
                          const categoryPrograms = programs.filter(p => 
                            (p.categoryId === category.id || p.categoryDisplayName === category.displayName) &&
                            (showArchivedPrograms ? p.archived : !p.archived)
                          )

                          return (
                            <div key={category.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-xl md:text-2xl font-display font-bold text-black">
                                      {category.displayName}
                                    </h3>
                                    {category.archived && (
                                      <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded">Archived</span>
                                    )}
                                  </div>
                                  {category.description && (
                                    <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingCategoryId(category.id)
                                      setCategoryFormData({
                                        name: category.name,
                                        displayName: category.displayName,
                                        description: category.description || ''
                                      })
                                      setShowCategoryModal(true)
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Edit
                                  </button>
                                  {showArchivedPrograms ? (
                                    <>
                                      <button
                                      onClick={() => handleArchiveCategory(category.id, false)}
                                      className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                                    >
                                      <Archive className="w-4 h-4" />
                                      Unarchive
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCategory(category.id)}
                                      className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium"
                                    >
                                      <X className="w-4 h-4" />
                                      Delete
                                    </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleArchiveCategory(category.id, true)}
                                      className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium"
                                    >
                                      <Archive className="w-4 h-4" />
                                      Archive
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="mb-4">
                                <button
                                  onClick={() => {
                                    setSelectedCategoryForClass(category.id)
                                    setProgramFormData({})
                                    setShowClassModal(true)
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-vortex-red hover:bg-red-700 rounded text-white text-sm font-medium"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add Class
                                </button>
                              </div>
                              <div className="space-y-4">
                                {categoryPrograms.length === 0 ? (
                                  <div className="text-center py-8 text-gray-500 text-sm">No classes in this category</div>
                                ) : (
                                  categoryPrograms.map((program) => (
                                <div key={program.id} className="bg-white rounded-lg p-4 border border-gray-300">
                                  {editingProgramId === program.id ? (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name *</label>
                                          <input
                                            type="text"
                                            value={programFormData.displayName || ''}
                                            onChange={(e) => setProgramFormData({ ...programFormData, displayName: e.target.value })}
                                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                            required
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-semibold text-gray-700 mb-2">Skill Level</label>
                                          <select
                                            value={programFormData.skillLevel || ''}
                                            onChange={(e) => setProgramFormData({ ...programFormData, skillLevel: e.target.value as Program['skillLevel'] || null })}
                                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                          >
                                            <option value="">None (All Levels)</option>
                                            <option value="EARLY_STAGE">Early Stage</option>
                                            <option value="BEGINNER">Beginner</option>
                                            <option value="INTERMEDIATE">Intermediate</option>
                                            <option value="ADVANCED">Advanced</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Age</label>
                                          <input
                                            type="number"
                                            value={programFormData.ageMin ?? ''}
                                            onChange={(e) => setProgramFormData({ ...programFormData, ageMin: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                            min="0"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-semibold text-gray-700 mb-2">Maximum Age</label>
                                          <input
                                            type="number"
                                            value={programFormData.ageMax ?? ''}
                                            onChange={(e) => setProgramFormData({ ...programFormData, ageMax: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                            min="0"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                                        <textarea
                                          value={programFormData.description || ''}
                                          onChange={(e) => setProgramFormData({ ...programFormData, description: e.target.value })}
                                          rows={4}
                                          className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Skill Requirements</label>
                                        <input
                                          type="text"
                                          value={programFormData.skillRequirements || ''}
                                          onChange={(e) => setProgramFormData({ ...programFormData, skillRequirements: e.target.value })}
                                          className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                          placeholder="e.g., No Experience Required, Skill Evaluation Required"
                                        />
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          checked={programFormData.isActive ?? true}
                                          onChange={(e) => setProgramFormData({ ...programFormData, isActive: e.target.checked })}
                                          className="w-4 h-4 text-vortex-red bg-white border-gray-300 rounded focus:ring-vortex-red"
                                        />
                                        <label className="text-sm font-semibold text-gray-700">Active</label>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={handleUpdateProgram}
                                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                                        >
                                          <Save className="w-4 h-4" />
                                          Save Changes
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingProgramId(null)
                                            setProgramFormData({})
                                          }}
                                          className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium"
                                        >
                                          <X className="w-4 h-4" />
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <h4 className="text-lg font-semibold text-black">{program.displayName}</h4>
                                            {program.archived && (
                                              <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded">Archived</span>
                                            )}
                                            {!program.isActive && (
                                              <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded">Inactive</span>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                                            {program.skillLevel && (
                                              <div>
                                                <span className="font-medium text-gray-600">Skill Level:</span> {program.skillLevel.replace('_', ' ')}
                                              </div>
                                            )}
                                            {(program.ageMin !== null || program.ageMax !== null) && (
                                              <div>
                                                <span className="font-medium text-gray-600">Age Range:</span>{' '}
                                                {program.ageMin !== null ? program.ageMin : 'Any'} - {program.ageMax !== null ? program.ageMax : 'Any'}
                                              </div>
                                            )}
                                            {program.skillRequirements && (
                                              <div className="md:col-span-2">
                                                <span className="font-medium text-gray-600">Requirements:</span> {program.skillRequirements}
                                              </div>
                                            )}
                                            {program.description && (
                                              <div className="md:col-span-2">
                                                <span className="font-medium text-gray-600">Description:</span> {program.description}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => handleEditProgram(program)}
                                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                            Edit
                                          </button>
                                          {showArchivedPrograms ? (
                                            <>
                                              <button
                                                onClick={() => handleArchiveProgram(program.id, false)}
                                                className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                                              >
                                                <Archive className="w-4 h-4" />
                                                Unarchive
                                              </button>
                                              <button
                                                onClick={() => handleDeleteProgram(program.id)}
                                                className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium"
                                              >
                                                <X className="w-4 h-4" />
                                                Delete
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              onClick={() => handleArchiveProgram(program.id, true)}
                                              className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium"
                                            >
                                              <Archive className="w-4 h-4" />
                                              Archive
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : activeTab === 'events' ? (
              <motion.div
                key="events"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
                    Events Management
                  </h2>
                  <div className="flex gap-2">
                    <motion.button
                      onClick={() => setShowArchivedEvents(!showArchivedEvents)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                        showArchivedEvents
                          ? 'bg-gray-600 text-white hover:bg-gray-700'
                          : 'bg-gray-500 text-white hover:bg-gray-600'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Archive className="w-4 h-4" />
                      <span>{showArchivedEvents ? 'Show Active' : 'Show Archives'}</span>
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        setEditingEventId(null)
                        setEventFormData({
                          eventName: '',
                          shortDescription: '',
                          longDescription: '',
                          startDate: new Date(),
                          endDate: undefined,
                          type: 'event',
                          datesAndTimes: [],
                          keyDetails: [],
                          address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
                        })
                        setUseShortAsLong(true)
                        setShowEventForm(true)
                      }}
                      className="flex items-center space-x-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Event</span>
                    </motion.button>
                  </div>
                </div>
                <EventsView
                  events={showArchivedEvents ? events.filter(e => e.archived) : events.filter(e => !e.archived)}
                  loading={eventsLoading}
                  searchQuery={eventSearchQuery}
                  onSearchChange={setEventSearchQuery}
                  onEdit={handleEditEvent}
                  onDelete={handleDeleteEvent}
                  onArchive={handleArchiveEvent}
                  showArchived={showArchivedEvents}
                  error={error}
                />
              </motion.div>
            ) : activeTab === 'admins' ? (
              <motion.div
                key="admins"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200"
              >
                {/* My Account Section */}
                <div className="mb-8 bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-4">
                    My Account
                  </h2>
                  {editingMyAccount ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">First Name *</label>
                          <input
                            type="text"
                            value={myAccountData.firstName}
                            onChange={(e) => setMyAccountData({ ...myAccountData, firstName: e.target.value })}
                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name *</label>
                          <input
                            type="text"
                            value={myAccountData.lastName}
                            onChange={(e) => setMyAccountData({ ...myAccountData, lastName: e.target.value })}
                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                          <input
                            type="email"
                            value={myAccountData.email}
                            onChange={(e) => setMyAccountData({ ...myAccountData, email: e.target.value })}
                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                          <input
                            type="tel"
                            value={myAccountData.phone}
                            onChange={(e) => setMyAccountData({ ...myAccountData, phone: e.target.value })}
                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Username *</label>
                          <input
                            type="text"
                            value={myAccountData.username}
                            onChange={(e) => setMyAccountData({ ...myAccountData, username: e.target.value })}
                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">New Password (leave blank to keep current)</label>
                          <input
                            type="password"
                            value={myAccountData.password}
                            onChange={(e) => setMyAccountData({ ...myAccountData, password: e.target.value })}
                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                            placeholder="Enter new password (optional)"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateMyAccount}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                        >
                          <Save className="w-4 h-4" />
                          Save Changes
                        </button>
                        <button
                          onClick={() => {
                            setEditingMyAccount(false)
                            fetchMyAccount()
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Name</p>
                          <p className="text-lg font-semibold text-black">{myAccountData.firstName} {myAccountData.lastName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Email</p>
                          <p className="text-lg font-semibold text-black">{myAccountData.email}</p>
                        </div>
                        {myAccountData.phone && (
                          <div>
                            <p className="text-sm text-gray-600">Phone</p>
                            <p className="text-lg font-semibold text-black">{myAccountData.phone}</p>
                          </div>
                        )}
                        {myAccountData.username && (
                          <div>
                            <p className="text-sm text-gray-600">Username</p>
                            <p className="text-lg font-semibold text-black">{myAccountData.username}</p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          // Ensure we have the latest account data before editing
                          await fetchMyAccount()
                          setEditingMyAccount(true)
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium mt-4"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit My Account
                      </button>
                    </div>
                  )}
                </div>

                {/* Admins Management Section */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
                    Admins ({admins.length})
                  </h2>
                  {(adminInfo?.isMaster || admins.find(a => a.id === adminInfo?.id)?.isMaster) && (
                    <motion.button
                      onClick={() => setShowAdminForm(true)}
                      className="flex items-center space-x-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Create Admin</span>
                    </motion.button>
                  )}
                </div>

                {adminsLoading ? (
                  <div className="text-center py-12 text-gray-600">Loading admins...</div>
                ) : admins.length === 0 ? (
                  <div className="text-center py-12 text-gray-600">No admins yet</div>
                ) : (
                  <div className="space-y-4">
                    {admins.map((admin) => (
                      <div key={admin.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-black font-semibold text-lg">
                                {admin.firstName} {admin.lastName}
                                {admin.isMaster && (
                                  <span className="ml-2 text-xs bg-vortex-red text-white px-2 py-1 rounded">Master</span>
                                )}
                              </div>
                            </div>
                            <div className="text-gray-600 text-sm mt-1">{admin.email}</div>
                            {admin.phone && <div className="text-gray-600 text-sm">Phone: {admin.phone}</div>}
                            <div className="text-gray-600 text-sm">Username: {admin.username}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : activeTab === 'membership' ? (
              <motion.div
                key="membership"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
                    Members ({members.length})
                  </h2>
                <motion.button
                  onClick={() => setShowMemberForm(true)}
                  className="flex items-center space-x-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create Member</span>
                </motion.button>
              </div>

                {membersLoading ? (
                  <div className="text-center py-12 text-gray-600">Loading members...</div>
                ) : members.length === 0 ? (
                  <div className="text-center py-12 text-gray-600">No members yet</div>
                ) : (
                  <div className="space-y-4">
                    {members.map((member) => (
                      <div key={member.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-black font-semibold text-lg">
                              {member.first_name} {member.last_name}
                            </div>
                            <div className="text-gray-600 text-sm mt-1">{member.email}</div>
                            {member.phone && <div className="text-gray-600 text-sm">{member.phone}</div>}
                            {member.program && <div className="text-gray-600 text-sm">Program: {member.program}</div>}
                            {member.children && member.children.length > 0 && (
                              <div className="text-gray-600 text-sm mt-2">
                                Children: {member.children.map(c => `${c.firstName} ${c.lastName}`).join(', ')}
                              </div>
                            )}
                          </div>
                        <div className="flex flex-col gap-2">
                          <select
                            value={member.account_status}
                            onChange={(e) => handleUpdateMemberStatus(member.id, e.target.value)}
                            className={`px-3 py-2 rounded-lg font-semibold text-sm ${
                              member.account_status === 'active' ? 'bg-green-600 text-white' :
                              member.account_status === 'hold' ? 'bg-yellow-600 text-white' :
                              member.account_status === 'canceled' ? 'bg-gray-600 text-white' :
                              'bg-red-600 text-white'
                            }`}
                          >
                            <option value="active">Active</option>
                            <option value="hold">Hold</option>
                            <option value="canceled">Canceled</option>
                            <option value="past_due">Past Due</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200"
              >
                <div className="mb-4 md:mb-6">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-4">
                    Inquiries ({filteredUsers.length} of {users.length})
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                        filter === 'all'
                          ? 'bg-vortex-red text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      All Users ({users.length})
                    </button>
                    <button
                      onClick={() => setFilter('newsletter')}
                      className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                        filter === 'newsletter'
                          ? 'bg-vortex-red text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Newsletter ({users.filter(u => u.newsletter).length})
                    </button>
                    <button
                      onClick={() => setFilter('interests')}
                      className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                        filter === 'interests'
                          ? 'bg-vortex-red text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Interested ({users.filter(u => u.interests).length})
                    </button>
                  </div>
          </div>

                  {error ? (
                    <div className="text-center py-12">
                      <div className="text-red-600 mb-4 font-semibold">Backend Connection Error</div>
                      <div className="text-gray-600 mb-4">{error}</div>
                      <button
                        onClick={fetchData}
                        className="bg-vortex-red hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : loading ? (
                    <div className="text-center py-12 text-gray-600">Loading...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12 text-gray-600">No users match the selected filter</div>
                  ) : (
                    <div className="space-y-2">
                      {/* Column Headers */}
                      <div className="hidden md:flex items-center bg-gray-100 rounded-t-lg border border-gray-200">
                        <button 
                          onClick={() => handleSort('created_at')}
                          className="px-3 py-3 flex-1 min-w-[80px] text-xs text-gray-700 font-semibold text-left hover:text-black transition-colors"
                        >
                          Date {sortConfig.field === 'created_at' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                        </button>
                        <button 
                          onClick={() => handleSort('last_name')}
                          className="px-3 py-3 flex-1 min-w-[100px] text-xs text-gray-700 font-semibold text-left hover:text-black transition-colors"
                        >
                          Last Name {sortConfig.field === 'last_name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                        </button>
                        <button 
                          onClick={() => handleSort('first_name')}
                          className="px-3 py-3 flex-1 min-w-[100px] text-xs text-gray-700 font-semibold text-left hover:text-black transition-colors"
                        >
                          First Name {sortConfig.field === 'first_name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                        </button>
                        <div className="px-3 py-3 w-12 md:w-16 text-xs text-gray-700 font-semibold text-center">Newsletter</div>
                        <div className="w-8"></div>
                        <div className="px-3 py-3 w-12 md:w-16 text-xs text-gray-700 font-semibold text-center">Interested</div>
                      </div>
                      {filteredUsers.map((user) => (
                        <div key={user.id} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                          {/* Header Row - Always Visible */}
                          <div 
                            className="flex items-center cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => toggleExpand(user.id)}
                          >
                            {/* Date */}
                            <div className="px-3 py-3 flex-1 min-w-[80px] text-xs md:text-sm text-gray-600">
                              {new Date(user.created_at).toLocaleDateString()}
                            </div>
                            
                            {/* Last Name */}
                            <div className="px-3 py-3 flex-1 min-w-[100px] text-xs md:text-sm text-black font-medium">
                              {user.last_name}
                            </div>
                            
                            {/* First Name */}
                            <div className="px-3 py-3 flex-1 min-w-[100px] text-xs md:text-sm text-black font-medium">
                              {user.first_name}
                            </div>
                    
                    {/* Newsletter Checkmark */}
                    <div className="px-3 py-3 w-12 md:w-16 text-center">
                      {user.newsletter && (
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-green-600 rounded-full">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                    
                    {/* Spacer */}
                    <div className="w-8"></div>
                    
                    {/* Interest Checkmark */}
                    <div className="px-3 py-3 w-12 md:w-16 text-center">
                      {user.interests && (
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-600 rounded-full">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                    
                            {/* Expand/Collapse Icon */}
                            <div className="px-3 py-3">
                              {expandedId === user.id ? (
                                <ChevronUp className="w-5 h-5 text-gray-600" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-600" />
                              )}
                            </div>
                          </div>

                          {/* Expanded Details */}
                          <AnimatePresence>
                            {expandedId === user.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pt-2 border-t border-gray-200">
                                  {editingId === user.id ? (
                                    // Edit Mode
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">First Name</label>
                                          <input
                                            type="text"
                                            value={editData.first_name || ''}
                                            onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                                            className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">Last Name</label>
                                          <input
                                            type="text"
                                            value={editData.last_name || ''}
                                            onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                                            className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">Email</label>
                                          <input
                                            type="email"
                                            value={editData.email || ''}
                                            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                            className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">Phone</label>
                                          <input
                                            type="tel"
                                            value={editData.phone || ''}
                                            onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                            className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">Age</label>
                                          <input
                                            type="number"
                                            value={editData.athlete_age || ''}
                                            onChange={(e) => setEditData({ ...editData, athlete_age: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">Interests</label>
                                          <input
                                            type="text"
                                            value={editData.interests || ''}
                                            onChange={(e) => setEditData({ ...editData, interests: e.target.value })}
                                            className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600 block mb-1">Message</label>
                                        <textarea
                                          value={editData.message || ''}
                                          onChange={(e) => setEditData({ ...editData, message: e.target.value })}
                                          rows={3}
                                          className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300 resize-none"
                                        />
                                      </div>
                              <div className="flex gap-2 pt-2">
                                <button
                                  onClick={saveEdit}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                                >
                                  <Save className="w-4 h-4" />
                                  Save
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditData({}) }}
                                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium"
                                >
                                  <X className="w-4 h-4" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                                    ) : (
                                      // View Mode
                                      <div className="space-y-2 text-sm text-gray-700">
                                        <div><span className="text-gray-600 font-medium">Email:</span> {user.email}</div>
                                        <div><span className="text-gray-600 font-medium">Phone:</span> {user.phone || '-'}</div>
                                        <div><span className="text-gray-600 font-medium">Age:</span> {user.athlete_age || '-'}</div>
                                        <div><span className="text-gray-600 font-medium">Interests:</span> {user.interests || '-'}</div>
                                        {user.message && <div><span className="text-gray-600 font-medium">Additional Information or Questions:</span> {user.message}</div>}
                              <div className="flex gap-2 pt-3">
                                <button
                                  onClick={(e) => startEdit(e, user)}
                                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => handleArchive(e, user.id)}
                                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium"
                                >
                                  <Archive className="w-4 h-4" />
                                  Archive
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      {/* Member Creation Form */}
      <AnimatePresence>
        {showMemberForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMemberForm(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Create New Member</h3>
                <button
                  onClick={() => setShowMemberForm(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                    <input
                      type="text"
                      value={memberFormData.firstName}
                      onChange={(e) => setMemberFormData({ ...memberFormData, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={memberFormData.lastName}
                      onChange={(e) => setMemberFormData({ ...memberFormData, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                    <input
                      type="email"
                      value={memberFormData.email}
                      onChange={(e) => setMemberFormData({ ...memberFormData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={memberFormData.phone}
                      onChange={(e) => setMemberFormData({ ...memberFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Address</label>
                    <input
                      type="text"
                      value={memberFormData.address}
                      onChange={(e) => setMemberFormData({ ...memberFormData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                    <input
                      type="password"
                      value={memberFormData.password}
                      onChange={(e) => setMemberFormData({ ...memberFormData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Program</label>
                    <select
                      value={memberFormData.program}
                      onChange={(e) => setMemberFormData({ ...memberFormData, program: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    >
                      <option value="">Select Program</option>
                      <option value="Athleticism Accelerator">Athleticism Accelerator</option>
                      <option value="Trampoline & Tumbling">Trampoline & Tumbling</option>
                      <option value="Artistic Gymnastics">Artistic Gymnastics</option>
                      <option value="Rhythmic Gymnastics">Rhythmic Gymnastics</option>
                      <option value="Ninja and Fitness">Ninja and Fitness</option>
                      <option value="Competition Programs">Competition Programs</option>
                      <option value="Daytime Programs">Daytime Programs</option>
                      <option value="Private Coaching">Private Coaching</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Notes</label>
                  <textarea
                    value={memberFormData.notes}
                    onChange={(e) => setMemberFormData({ ...memberFormData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-300">Children</label>
                    <button
                      type="button"
                      onClick={addChild}
                      className="flex items-center space-x-1 text-vortex-red hover:text-red-400 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Child</span>
                    </button>
                  </div>
                  {memberFormData.children.map((child, index) => (
                    <div key={index} className="bg-gray-700 p-3 rounded mb-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="First Name"
                          value={child.firstName}
                          onChange={(e) => updateChild(index, 'firstName', e.target.value)}
                          className="px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        />
                        <input
                          type="text"
                          placeholder="Last Name"
                          value={child.lastName}
                          onChange={(e) => updateChild(index, 'lastName', e.target.value)}
                          className="px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        />
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={child.dateOfBirth}
                            onChange={(e) => updateChild(index, 'dateOfBirth', e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          />
                          <button
                            type="button"
                            onClick={() => removeChild(index)}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleCreateMember}
                    className="flex-1 bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    Create Member
                  </button>
                  <button
                    onClick={() => setShowMemberForm(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Dialog */}
      <AnimatePresence>
        {showExportDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowExportDialog(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-2xl font-display font-bold text-white mb-4">Export Data</h3>
              <p className="text-gray-400 mb-6">Select which data to export:</p>
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => exportToCSV(true, true)}
                  className="w-full bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Export All
                </button>
                <button
                  onClick={() => exportToCSV(true, false)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Newsletter Only ({users.filter(u => u.newsletter).length})
                </button>
                <button
                  onClick={() => exportToCSV(false, true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Interested Only ({users.filter(u => u.interests).length})
                </button>
              </div>
              <button
                onClick={() => setShowExportDialog(false)}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event Form Modal */}
      <AnimatePresence>
        {showEventForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowEventForm(false)
                setEditingEventId(null)
              }}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">
                  {editingEventId ? 'Edit Event' : 'Create New Event'}
                </h3>
                <button
                  onClick={() => {
                    setShowEventForm(false)
                    setEditingEventId(null)
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Event Name *</label>
                    <input
                      type="text"
                      value={eventFormData.eventName || ''}
                      onChange={(e) => setEventFormData({ ...eventFormData, eventName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Event Type</label>
                    <select
                      value={eventFormData.type || 'event'}
                      onChange={(e) => setEventFormData({ ...eventFormData, type: e.target.value as Event['type'] })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    >
                      <option value="event">Event</option>
                      <option value="camp">Camp</option>
                      <option value="class">Class</option>
                      <option value="watch-party">Watch Party</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={eventFormData.startDate ? (() => {
                      const date = eventFormData.startDate instanceof Date ? eventFormData.startDate : new Date(eventFormData.startDate)
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      return `${year}-${month}-${day}`
                    })() : ''}
                    onChange={(e) => {
                      // Create date in local timezone to avoid timezone shift
                      const dateValue = e.target.value
                      if (dateValue) {
                        const [year, month, day] = dateValue.split('-').map(Number)
                        const localDate = new Date(year, month - 1, day)
                        setEventFormData({ ...eventFormData, startDate: localDate })
                      }
                    }}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">End Date (Optional)</label>
                  <input
                    type="date"
                    value={eventFormData.endDate ? (() => {
                      const date = eventFormData.endDate instanceof Date ? eventFormData.endDate : new Date(eventFormData.endDate)
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      return `${year}-${month}-${day}`
                    })() : ''}
                    onChange={(e) => {
                      // Create date in local timezone to avoid timezone shift
                      const dateValue = e.target.value
                      if (dateValue) {
                        const [year, month, day] = dateValue.split('-').map(Number)
                        const localDate = new Date(year, month - 1, day)
                        setEventFormData({ ...eventFormData, endDate: localDate })
                      } else {
                        setEventFormData({ ...eventFormData, endDate: undefined })
                      }
                    }}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Short Description *</label>
                  <textarea
                    value={eventFormData.shortDescription || ''}
                    onChange={(e) => {
                      const newShort = e.target.value
                      setEventFormData({ 
                        ...eventFormData, 
                        shortDescription: newShort,
                        longDescription: useShortAsLong ? newShort : eventFormData.longDescription
                      })
                    }}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    placeholder="Brief description for calendar view..."
                    required
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={useShortAsLong}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setUseShortAsLong(checked)
                        if (checked) {
                          setEventFormData({ 
                            ...eventFormData, 
                            longDescription: eventFormData.shortDescription || '' 
                          })
                        }
                      }}
                      className="w-4 h-4 text-vortex-red bg-gray-700 border-gray-600 rounded focus:ring-vortex-red"
                    />
                    <span className="text-sm font-semibold text-gray-300">Use Short Description for Long Description</span>
                  </label>
                </div>
                {!useShortAsLong && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Long Description *</label>
                    <textarea
                      value={eventFormData.longDescription || ''}
                      onChange={(e) => setEventFormData({ ...eventFormData, longDescription: e.target.value })}
                      rows={5}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      placeholder="Detailed description for event details section..."
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Address</label>
                  <input
                    type="text"
                    value={eventFormData.address || 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'}
                    onChange={(e) => setEventFormData({ ...eventFormData, address: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                  />
                </div>

                {/* Dates & Times */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-300">Dates & Times</label>
                    <button
                      type="button"
                      onClick={() => setEventFormData({
                        ...eventFormData,
                        datesAndTimes: [...(eventFormData.datesAndTimes || []), { date: new Date(), startTime: '12:00am', endTime: '', description: '', allDay: false }]
                      })}
                      className="flex items-center space-x-1 text-vortex-red hover:text-red-400 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Date/Time Entry</span>
                    </button>
                  </div>
                  {(eventFormData.datesAndTimes || []).map((entry, index) => (
                    <div key={index} className="bg-gray-700 p-3 rounded mb-2 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="flex flex-col">
                          <label className="text-xs text-gray-400 mb-1">Date</label>
                          <input
                            type="date"
                            value={entry.date ? (() => {
                              const date = entry.date instanceof Date ? entry.date : new Date(entry.date)
                              const year = date.getFullYear()
                              const month = String(date.getMonth() + 1).padStart(2, '0')
                              const day = String(date.getDate()).padStart(2, '0')
                              return `${year}-${month}-${day}`
                            })() : ''}
                            onChange={(e) => {
                              // Create date in local timezone to avoid timezone shift
                              const dateValue = e.target.value
                              const updated = [...(eventFormData.datesAndTimes || [])]
                              if (dateValue) {
                                const [year, month, day] = dateValue.split('-').map(Number)
                                const localDate = new Date(year, month - 1, day)
                                updated[index] = { ...updated[index], date: localDate }
                              } else {
                                updated[index] = { ...updated[index], date: new Date() }
                              }
                              setEventFormData({ ...eventFormData, datesAndTimes: updated })
                            }}
                            className="px-3 py-2 bg-gray-600 text-white rounded-lg border border-gray-500 h-[42px]"
                          />
                        </div>
                        {!entry.allDay && (
                          <div className="flex flex-col">
                            <label className="text-xs text-gray-400 mb-1">Start Time</label>
                            <TimeSpinner
                              value={entry.startTime || '12:00am'}
                              onChange={(newTime) => {
                                const updated = [...(eventFormData.datesAndTimes || [])]
                                updated[index] = { ...updated[index], startTime: newTime }
                                setEventFormData({ ...eventFormData, datesAndTimes: updated })
                              }}
                            />
                          </div>
                        )}
                        {!entry.allDay && (
                          <div className="flex flex-col">
                            <label className="text-xs text-gray-400 mb-1">End Time (Optional)</label>
                            <div className="flex items-center gap-2">
                              <TimeSpinner
                                value={entry.endTime || ''}
                                onChange={(newTime) => {
                                  const updated = [...(eventFormData.datesAndTimes || [])]
                                  updated[index] = { ...updated[index], endTime: newTime }
                                  setEventFormData({ ...eventFormData, datesAndTimes: updated })
                                }}
                                allowEmpty={true}
                              />
                              {entry.endTime && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...(eventFormData.datesAndTimes || [])]
                                    updated[index] = { ...updated[index], endTime: '' }
                                    setEventFormData({ ...eventFormData, datesAndTimes: updated })
                                  }}
                                  className="text-gray-400 hover:text-white text-xs"
                                  title="Clear end time"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                              {!entry.endTime && (
                                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={entry.allDay || false}
                                    onChange={(e) => {
                                      const updated = [...(eventFormData.datesAndTimes || [])]
                                      updated[index] = { 
                                        ...updated[index], 
                                        allDay: e.target.checked,
                                        startTime: e.target.checked ? '' : (updated[index].startTime || '12:00am'),
                                        endTime: e.target.checked ? '' : updated[index].endTime
                                      }
                                      setEventFormData({ ...eventFormData, datesAndTimes: updated })
                                    }}
                                    className="w-4 h-4 text-vortex-red bg-gray-600 border-gray-500 rounded focus:ring-vortex-red"
                                  />
                                  <span>All Day</span>
                                </label>
                              )}
                            </div>
                          </div>
                        )}
                        {entry.allDay && (
                          <div className="flex flex-col md:col-span-2">
                            <label className="text-xs text-gray-400 mb-1">End Time (Optional)</label>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center bg-gray-600 rounded-lg border border-gray-500 px-4 py-2 h-[42px]">
                                <span className="text-white text-sm">All Day Event</span>
                              </div>
                              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={true}
                                  onChange={() => {
                                    const updated = [...(eventFormData.datesAndTimes || [])]
                                    updated[index] = { 
                                      ...updated[index], 
                                      allDay: false,
                                      startTime: '12:00am',
                                      endTime: ''
                                    }
                                    setEventFormData({ ...eventFormData, datesAndTimes: updated })
                                  }}
                                  className="w-4 h-4 text-vortex-red bg-gray-600 border-gray-500 rounded focus:ring-vortex-red"
                                />
                                <span>All Day</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={entry.description || ''}
                          onChange={(e) => {
                            const updated = [...(eventFormData.datesAndTimes || [])]
                            updated[index] = { ...updated[index], description: e.target.value }
                            setEventFormData({ ...eventFormData, datesAndTimes: updated })
                          }}
                          className="flex-1 px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (eventFormData.datesAndTimes || []).filter((_, i) => i !== index)
                            setEventFormData({ ...eventFormData, datesAndTimes: updated })
                          }}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Key Details */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-300">Key Details</label>
                    <button
                      type="button"
                      onClick={() => setEventFormData({
                        ...eventFormData,
                        keyDetails: [...(eventFormData.keyDetails || []), '']
                      })}
                      className="flex items-center space-x-1 text-vortex-red hover:text-red-400 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Key Detail</span>
                    </button>
                  </div>
                  {(eventFormData.keyDetails || []).map((detail, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Key detail..."
                        value={detail}
                        onChange={(e) => {
                          const updated = [...(eventFormData.keyDetails || [])]
                          updated[index] = e.target.value
                          setEventFormData({ ...eventFormData, keyDetails: updated })
                        }}
                        className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (eventFormData.keyDetails || []).filter((_, i) => i !== index)
                          setEventFormData({ ...eventFormData, keyDetails: updated })
                        }}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleCreateOrUpdateEvent}
                    className="flex-1 bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    {editingEventId ? 'Update Event' : 'Create Event'}
                  </button>
                  <button
                    onClick={() => {
                      setShowEventForm(false)
                      setEditingEventId(null)
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {/* Edit Log Link - Only show when editing existing event */}
                {editingEventId && (
                  <div className="pt-4 mt-4 border-t border-gray-700">
                    <button
                      type="button"
                        onClick={() => {
                          setShowEditLog(true)
                          fetchEditLog(editingEventId)
                        }}
                      className="text-gray-400 hover:text-white text-sm underline transition-colors"
                    >
                      View Edit Log
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Log Modal */}
      <AnimatePresence>
        {showEditLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowEditLog(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-3xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Edit Log</h3>
                <button
                  onClick={() => setShowEditLog(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {editLogLoading ? (
                <div className="text-center py-12 text-gray-400">Loading log...</div>
              ) : editLog.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No edit history available</div>
              ) : (
                <div className="space-y-4">
                  {editLog.map((log) => (
                    <div key={log.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-white font-semibold">
                            {log.adminName || 'Unknown Admin'}
                          </p>
                          <p className="text-gray-400 text-sm">{log.adminEmail}</p>
                        </div>
                        <p className="text-gray-400 text-sm">
                          {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(log.changes).map(([field, change]: [string, any]) => {
                          const formatFieldName = (fieldName: string) => {
                            return fieldName
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/^./, str => str.toUpperCase())
                              .trim()
                          }
                          
                          const formatChangeValue = (val: any) => {
                            if (val === null || val === undefined) return '(empty)'
                            if (Array.isArray(val)) {
                              if (val.length === 0) return '(empty array)'
                              return val.map((item, idx) => {
                                if (typeof item === 'object') {
                                  return JSON.stringify(item, null, 2)
                                }
                                return `${idx + 1}. ${String(item)}`
                              }).join('\n')
                            }
                            if (typeof val === 'object') {
                              return JSON.stringify(val, null, 2)
                            }
                            return String(val)
                          }
                          
                          return (
                            <div key={field} className="bg-gray-600 rounded p-3">
                              <p className="text-vortex-red font-semibold text-sm mb-2">
                                {formatFieldName(field)}
                              </p>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-400 text-xs mb-1 font-semibold">Previous:</p>
                                  <p className="text-gray-300 line-through whitespace-pre-wrap break-words">
                                    {formatChangeValue(change.old)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-400 text-xs mb-1 font-semibold">Updated:</p>
                                  <p className="text-white whitespace-pre-wrap break-words">
                                    {formatChangeValue(change.new)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Creation Form */}
      <AnimatePresence>
        {showAdminForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAdminForm(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Create New Admin</h3>
                <button
                  onClick={() => setShowAdminForm(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                    <input
                      type="text"
                      value={adminFormData.firstName}
                      onChange={(e) => setAdminFormData({ ...adminFormData, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={adminFormData.lastName}
                      onChange={(e) => setAdminFormData({ ...adminFormData, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                    <input
                      type="email"
                      value={adminFormData.email}
                      onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={adminFormData.phone}
                      onChange={(e) => setAdminFormData({ ...adminFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Username *</label>
                    <input
                      type="text"
                      value={adminFormData.username}
                      onChange={(e) => setAdminFormData({ ...adminFormData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                    <input
                      type="password"
                      value={adminFormData.password}
                      onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleCreateAdmin}
                    className="flex-1 bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    Create Admin
                  </button>
                  <button
                    onClick={() => setShowAdminForm(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Category Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowCategoryModal(false)
                setEditingCategoryId(null)
                setCategoryFormData({})
              }}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">
                  {editingCategoryId ? 'Edit Category' : 'Add New Category'}
                </h3>
                <button
                  onClick={() => {
                    setShowCategoryModal(false)
                    setEditingCategoryId(null)
                    setCategoryFormData({})
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Name (Internal) *</label>
                    <input
                      type="text"
                      value={categoryFormData.name || ''}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      placeholder="e.g., GYMNASTICS"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Display Name *</label>
                    <input
                      type="text"
                      value={categoryFormData.displayName || ''}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, displayName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      placeholder="e.g., Gymnastics"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
                  <textarea
                    value={categoryFormData.description || ''}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    placeholder="Optional description for this category"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowCategoryModal(false)
                      setEditingCategoryId(null)
                      setCategoryFormData({})
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (editingCategoryId) {
                        await handleUpdateCategory()
                        setShowCategoryModal(false)
                      } else {
                        await handleCreateCategory()
                      }
                    }}
                    className="px-4 py-2 bg-vortex-red hover:bg-red-700 rounded text-white text-sm font-medium"
                  >
                    {editingCategoryId ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Class Modal */}
      <AnimatePresence>
        {showClassModal && selectedCategoryForClass && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowClassModal(false)
                setSelectedCategoryForClass(null)
                setProgramFormData({})
              }}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">
                  Add New Class
                </h3>
                <button
                  onClick={() => {
                    setShowClassModal(false)
                    setSelectedCategoryForClass(null)
                    setProgramFormData({})
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Display Name *</label>
                    <input
                      type="text"
                      value={programFormData.displayName || ''}
                      onChange={(e) => setProgramFormData({ ...programFormData, displayName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Skill Level</label>
                    <select
                      value={programFormData.skillLevel || ''}
                      onChange={(e) => setProgramFormData({ ...programFormData, skillLevel: e.target.value as Program['skillLevel'] || null })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    >
                      <option value="">None (All Levels)</option>
                      <option value="EARLY_STAGE">Early Stage</option>
                      <option value="BEGINNER">Beginner</option>
                      <option value="INTERMEDIATE">Intermediate</option>
                      <option value="ADVANCED">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Minimum Age</label>
                    <input
                      type="number"
                      value={programFormData.ageMin ?? ''}
                      onChange={(e) => setProgramFormData({ ...programFormData, ageMin: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Maximum Age</label>
                    <input
                      type="number"
                      value={programFormData.ageMax ?? ''}
                      onChange={(e) => setProgramFormData({ ...programFormData, ageMax: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
                  <textarea
                    value={programFormData.description || ''}
                    onChange={(e) => setProgramFormData({ ...programFormData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Skill Requirements</label>
                  <input
                    type="text"
                    value={programFormData.skillRequirements || ''}
                    onChange={(e) => setProgramFormData({ ...programFormData, skillRequirements: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    placeholder="e.g., No Experience Required, Skill Evaluation Required"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={programFormData.isActive ?? true}
                    onChange={(e) => setProgramFormData({ ...programFormData, isActive: e.target.checked })}
                    className="w-4 h-4 text-vortex-red bg-gray-600 border-gray-500 rounded focus:ring-vortex-red"
                  />
                  <label className="text-sm font-semibold text-gray-300">Active</label>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowClassModal(false)
                      setSelectedCategoryForClass(null)
                      setProgramFormData({})
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateClass}
                    className="px-4 py-2 bg-vortex-red hover:bg-red-700 rounded text-white text-sm font-medium"
                  >
                    Create Class
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
