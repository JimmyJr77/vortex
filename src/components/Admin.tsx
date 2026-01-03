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
  tagType?: 'all_classes_and_parents' | 'specific_classes' | 'specific_categories' | 'all_parents' | 'boosters' | 'volunteers'
  tagClassIds?: number[]
  tagCategoryIds?: number[]
  tagAllParents?: boolean
  tagBoosters?: boolean
  tagVolunteers?: boolean
}

// Module 2: Family and Athlete interfaces
interface Athlete {
  id: number
  first_name: string
  last_name: string
  date_of_birth: string
  age?: number
  medical_notes?: string | null
  internal_flags?: string | null
  family_id: number
  user_id?: number | null // If set, this athlete is also a user (e.g., parent/guardian who trains)
  linked_user_id?: number | null
  linked_user_email?: string | null
  linked_user_name?: string | null
  linked_user_role?: string | null
  created_at: string
  updated_at: string
  emergency_contacts?: EmergencyContact[]
}

interface EmergencyContact {
  id: number
  name: string
  relationship?: string | null
  phone: string
  email?: string | null
}

interface Guardian {
  id: number
  email: string
  fullName: string
  phone?: string | null
  isPrimary: boolean
}

interface Family {
  id: number
  family_name?: string | null
  primary_user_id?: number | null
  primary_email?: string | null
  primary_name?: string | null
  primary_phone?: string | null
  guardians?: Guardian[]
  athletes?: Athlete[]
  created_at: string
  updated_at: string
  archived?: boolean
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
  // Module 2: Families and Athletes
  const [families, setFamilies] = useState<Family[]>([])
  const [familiesLoading, setFamiliesLoading] = useState(false)
  // @ts-expect-error - athletes state is set by fetchAthletes but not displayed in UI
  const [athletes, setAthletes] = useState<Athlete[]>([])
  // @ts-expect-error - athletesLoading state is set by fetchAthletes but not displayed in UI
  const [athletesLoading, setAthletesLoading] = useState(false)
  const [showAthleteForm, setShowAthleteForm] = useState(false)
  const [selectedFamilyId, _setSelectedFamilyId] = useState<number | null>(null)
  const [athleteFormData, setAthleteFormData] = useState({
    familyId: null as number | null,
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    medicalNotes: '',
    internalFlags: ''
  })
  const [familySearchQuery, setFamilySearchQuery] = useState('')
  // Comprehensive Member Management Modal
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [memberSearchResults, setMemberSearchResults] = useState<Family[]>([])
  const [selectedFamilyForMember, setSelectedFamilyForMember] = useState<Family | null>(null)
  const [memberModalMode, setMemberModalMode] = useState<'search' | 'new-family' | 'existing-family'>('search')
  const [newPrimaryAdult, setNewPrimaryAdult] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    username: '',
    password: 'vortex',
    program: 'Non-Participant',
    programId: null as number | null,
    daysPerWeek: 1,
    selectedDays: [] as string[]
  })
  const [_newAdditionalAdult, _setNewAdditionalAdult] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    program: ''
  })
  const [newFamilyMember, setNewFamilyMember] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    program: 'Non-Participant',
    programId: null as number | null,
    daysPerWeek: 1,
    selectedDays: [] as string[],
    medicalNotes: '',
    username: '',
    password: 'vortex'
  })
  const [newChildren, setNewChildren] = useState<Array<{
    firstName: string
    lastName: string
    dateOfBirth: string
    email: string
    password: string
    username: string
    medicalNotes: string
    internalFlags: string
    program: string
    programId: number | null
    daysPerWeek: number
    selectedDays: string[]
    userId: number | null
  }>>([])
  const [currentChild, setCurrentChild] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    password: '',
    username: '',
    medicalNotes: '',
    internalFlags: '',
    program: 'Non-Participant',
    programId: null as number | null,
    daysPerWeek: 1,
    selectedDays: [] as string[],
    userId: null as number | null // Optional: link to existing user if adult athlete
  })
  const [_availableUsers, setAvailableUsers] = useState<Array<{id: number, email: string, full_name: string, role: string}>>([])
  const [_userSearchQuery, setUserSearchQuery] = useState('')
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
    address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
    tagType: 'all_classes_and_parents',
    tagClassIds: [],
    tagCategoryIds: [],
    tagAllParents: false,
    tagBoosters: false,
    tagVolunteers: false
  })
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [useShortAsLong, setUseShortAsLong] = useState(true)
  const [showArchivedEvents, setShowArchivedEvents] = useState(false)
  const [showArchivedFamilies, setShowArchivedFamilies] = useState(false)
  const [selectedFamilyForView, setSelectedFamilyForView] = useState<Family | null>(null)
  const [showFamilyViewModal, setShowFamilyViewModal] = useState(false)
  const [editingFamily, setEditingFamily] = useState<Family | null>(null)
  const [showFamilyEditModal, setShowFamilyEditModal] = useState(false)
  // Member edit/view state
  const [editingMember, setEditingMember] = useState<{guardian: Guardian, family: Family} | null>(null)
  const [viewingMember, setViewingMember] = useState<{guardian: Guardian, family: Family} | null>(null)
  const [showMemberEditModal, setShowMemberEditModal] = useState(false)
  const [showMemberViewModal, setShowMemberViewModal] = useState(false)
  const [editingMemberData, setEditingMemberData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    username: '',
    password: ''
  })
  const [editingFamilyMembers, setEditingFamilyMembers] = useState<Array<{
    id?: number,
    firstName: string,
    lastName: string,
    dateOfBirth: string,
    email: string,
    username: string,
    password: string,
    medicalNotes: string,
    internalFlags: string,
    enrollments: Array<{
      id?: number,
      programId: number | null,
      programName: string,
      daysPerWeek: number,
      selectedDays: string[]
    }>,
    userId: number | null
  }>>([])
  const [newFamilyMemberInEdit, setNewFamilyMemberInEdit] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    username: '',
    password: 'vortex',
    medicalNotes: '',
    internalFlags: '',
    enrollments: [] as Array<{
      id?: number,
      programId: number | null,
      programName: string,
      daysPerWeek: number,
      selectedDays: string[]
    }>,
    address: ''
  })
  const [expandedFamilyMemberId, setExpandedFamilyMemberId] = useState<number | null>(null)
  const [expandedViewFamilyMemberId, setExpandedViewFamilyMemberId] = useState<number | null>(null)
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
  
  // Simplified function to get all Gymnastics programs sorted from easiest to hardest
  const getSimplifiedGymnasticsPrograms = (programsList: Program[]) => {
    const skillLevelOrder: (string | null)[] = ['EARLY_STAGE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', null]
    
    // Filter active, non-archived programs that match "Gymnastics" category
    const gymnasticsPrograms = programsList.filter(p => {
      if (!p.isActive || p.archived) return false
      const categoryName = (p.categoryDisplayName || p.categoryName || '').toLowerCase()
      return categoryName.includes('gymnastics')
    })
    
    // Sort by skill level (easiest to hardest), then alphabetically by display name
    return gymnasticsPrograms.sort((a, b) => {
      const aLevel = a.skillLevel || null
      const bLevel = b.skillLevel || null
      const aIndex = skillLevelOrder.indexOf(aLevel)
      const bIndex = skillLevelOrder.indexOf(bLevel)
      
      // First sort by skill level
      if (aIndex !== bIndex) {
        return aIndex - bIndex
      }
      
      // Then sort alphabetically by display name
      return a.displayName.localeCompare(b.displayName)
    })
  }
  
  const [editingProgramId, setEditingProgramId] = useState<number | null>(null)
  const [programFormData, setProgramFormData] = useState<Partial<Program>>({})
  const [showArchivedCategories, setShowArchivedCategories] = useState(false)
  const [showArchivedClasses, setShowArchivedClasses] = useState(false)
  const [categoryArchiveSearch, setCategoryArchiveSearch] = useState('')
  const [classArchiveSearch, setClassArchiveSearch] = useState('')
  const [classArchiveCategoryFilter, setClassArchiveCategoryFilter] = useState<number | 'all'>('all')
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
      fetchFamilies()
    } else if (activeTab === 'events') {
      fetchEvents()
    } else if (activeTab === 'classes') {
      fetchAllPrograms()
      fetchAllCategories()
    } else if (activeTab === 'admins') {
      fetchAdmins()
      fetchMyAccount()
    }
  }, [activeTab])

  // Fetch programs when member modal opens
  useEffect(() => {
    if (showMemberModal && programs.length === 0) {
      fetchAllPrograms()
    }
  }, [showMemberModal])


  // Debounce family search
  useEffect(() => {
    if (memberSearchQuery.length >= 2) {
      const timeoutId = setTimeout(() => {
        searchFamiliesForMember(memberSearchQuery)
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setMemberSearchResults([])
    }
  }, [memberSearchQuery])

  useEffect(() => {
    if (activeTab === 'classes') {
      fetchAllPrograms()
      fetchAllCategories()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchivedClasses, showArchivedCategories])


  // Module 2: Fetch families and athletes
  const fetchFamilies = async () => {
    try {
      setFamiliesLoading(true)
      setError(null)
      const apiUrl = getApiUrl()
      const params = new URLSearchParams()
      if (familySearchQuery) {
        params.append('search', familySearchQuery)
      }
      const response = await fetch(`${apiUrl}/api/admin/families?${params.toString()}`)
      if (!response.ok) {
        // Set empty array on error to prevent UI breakage
        setFamilies([])
        const errorText = await response.text().catch(() => response.statusText)
        console.error('Error fetching families:', response.status, errorText)
        // Only show error for non-500 errors to avoid alarming users for backend issues
        if (response.status !== 500) {
          setError(`Unable to fetch families: ${response.statusText}`)
        }
        return
      }
      const data = await response.json()
      if (data.success) {
        setFamilies(data.data)
      } else {
        setFamilies([])
      }
    } catch (error) {
      console.error('Error fetching families:', error)
      setFamilies([]) // Set empty array to prevent UI breakage
      // Only show error for non-network errors
      if (error instanceof Error && !error.message.includes('fetch')) {
        setError(error.message)
      }
    } finally {
      setFamiliesLoading(false)
    }
  }

  // @ts-expect-error - fetchAthletes function is kept for potential future use but not called since athletes section was removed
  const fetchAthletes = async () => {
    try {
      setAthletesLoading(true)
      setError(null)
      const apiUrl = getApiUrl()
      const params = new URLSearchParams()
      if (selectedFamilyId) {
        params.append('familyId', selectedFamilyId.toString())
      }
      const response = await fetch(`${apiUrl}/api/admin/athletes?${params.toString()}`)
      if (!response.ok) {
        // Set empty array on error to prevent UI breakage
        setAthletes([])
        const errorText = await response.text().catch(() => response.statusText)
        console.error('Error fetching athletes:', response.status, errorText)
        // Only show error for non-500 errors to avoid alarming users for backend issues
        if (response.status !== 500) {
          setError(`Unable to fetch athletes: ${response.statusText}`)
        }
        return
      }
      const data = await response.json()
      if (data.success) {
        setAthletes(data.data)
      } else {
        setAthletes([])
      }
    } catch (error) {
      console.error('Error fetching athletes:', error)
      setAthletes([]) // Set empty array to prevent UI breakage
      // Only show error for non-network errors
      if (error instanceof Error && !error.message.includes('fetch')) {
        setError(error.message)
      }
    } finally {
      setAthletesLoading(false)
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

  // Module 2: Family and Athlete handlers

  const handleCreateAthlete = async () => {
    try {
      if (!athleteFormData.familyId) {
        alert('Please select a family')
        return
      }
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/athletes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId: athleteFormData.familyId,
          firstName: athleteFormData.firstName,
          lastName: athleteFormData.lastName,
          dateOfBirth: athleteFormData.dateOfBirth,
          medicalNotes: athleteFormData.medicalNotes || null,
          internalFlags: athleteFormData.internalFlags || null
        })
      })

      if (response.ok) {
        await fetchFamilies()
        setShowAthleteForm(false)
        setAthleteFormData({
          familyId: null,
          firstName: '',
          lastName: '',
          dateOfBirth: '',
          medicalNotes: '',
          internalFlags: ''
        })
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to create athlete')
      }
    } catch (error) {
      console.error('Error creating athlete:', error)
      alert('Failed to create athlete')
    }
  }

  const handleArchiveFamily = async (id: number, archived: boolean) => {
    if (!confirm(archived ? 'Are you sure you want to archive this family?' : 'Are you sure you want to unarchive this family?')) {
      return
    }
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/families/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived })
      })
      if (response.ok) {
        await fetchFamilies()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to archive/unarchive family')
      }
    } catch (error) {
      console.error('Error archiving family:', error)
      alert('Failed to archive/unarchive family')
    }
  }

  const handleDeleteFamily = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this family? This will also delete all associated athletes. This action cannot be undone.')) {
      return
    }
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/families/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await fetchFamilies()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to delete family')
      }
    } catch (error) {
      console.error('Error deleting family:', error)
      alert('Failed to delete family')
    }
  }

  const handleViewFamily = (family: Family) => {
    setSelectedFamilyForView(family)
    setShowFamilyViewModal(true)
  }

  const handleEditFamily = (family: Family) => {
    setEditingFamily(family)
    setShowFamilyEditModal(true)
  }

  // Handle viewing/editing individual members (guardians)
  const handleViewMember = (guardian: Guardian, family: Family) => {
    setViewingMember({ guardian, family })
    setShowMemberViewModal(true)
  }

  const handleEditMember = async (guardian: Guardian, family: Family) => {
    setEditingMember({ guardian, family })
    
    const apiUrl = getApiUrl()
    
    // Fetch user details to get username and address
    let username = ''
    let address = ''
    try {
      const userResponse = await fetch(`${apiUrl}/api/admin/users/${guardian.id}`)
      if (userResponse.ok) {
        const userData = await userResponse.json()
        if (userData.success && userData.data) {
          username = userData.data.username || ''
          address = userData.data.address || ''
        }
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
    }
    
    // Parse fullName into firstName and lastName
    const nameParts = guardian.fullName.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    
    // Parse address into separate fields
    const parsedAddress = parseAddress(address)
    
    setEditingMemberData({
      firstName,
      lastName,
      email: guardian.email || '',
      phone: guardian.phone || '',
      addressStreet: parsedAddress.street,
      addressCity: parsedAddress.city,
      addressState: parsedAddress.state,
      addressZip: parsedAddress.zip,
      username,
      password: '' // Don't pre-fill password
    })
    
    // Load family members and their enrollments
    const familyMembers: Array<{
      id?: number,
      firstName: string,
      lastName: string,
      dateOfBirth: string,
      email: string,
      username: string,
      password: string,
      medicalNotes: string,
      internalFlags: string,
      enrollments: Array<{
        id?: number,
        programId: number | null,
        programName: string,
        daysPerWeek: number,
        selectedDays: string[]
      }>,
      userId: number | null
    }> = []
    
    if (family.athletes) {
      for (const athlete of family.athletes) {
        // Fetch all enrollments for this athlete
        const enrollments: Array<{
          id?: number,
          programId: number | null,
          programName: string,
          daysPerWeek: number,
          selectedDays: string[]
        }> = []
        
        try {
          const enrollmentsResponse = await fetch(`${apiUrl}/api/admin/athletes/${athlete.id}/enrollments`)
          if (enrollmentsResponse.ok) {
            const enrollmentsData = await enrollmentsResponse.json()
            if (enrollmentsData.success && enrollmentsData.data && enrollmentsData.data.length > 0) {
              for (const enrollment of enrollmentsData.data) {
                enrollments.push({
                  id: enrollment.id,
                  programId: enrollment.program_id || null,
                  programName: enrollment.program_display_name || 'Unknown Program',
                  daysPerWeek: enrollment.days_per_week || 1,
                  selectedDays: enrollment.selected_days || []
                })
              }
            }
          }
        } catch (error) {
          console.error('Error fetching enrollments:', error)
        }
        
        // Get email and username if athlete has user account
        let email = ''
        let username = ''
        if (athlete.user_id) {
          try {
            const userResponse = await fetch(`${apiUrl}/api/admin/users/${athlete.user_id}`)
            if (userResponse.ok) {
              const userData = await userResponse.json()
              if (userData.success && userData.data) {
                email = userData.data.email || ''
                username = userData.data.username || ''
              }
            }
          } catch (error) {
            console.error('Error fetching athlete user details:', error)
          }
        }
        
        familyMembers.push({
          id: athlete.id,
          firstName: athlete.first_name,
          lastName: athlete.last_name,
          dateOfBirth: athlete.date_of_birth || '',
          email,
          username,
          password: '',
          medicalNotes: athlete.medical_notes || '',
          internalFlags: athlete.internal_flags || '',
          enrollments,
          userId: athlete.user_id || null
        })
      }
    }
    
    setEditingFamilyMembers(familyMembers)
    setShowMemberEditModal(true)
  }

  const handleSaveMemberEdit = async () => {
    if (!editingMember) return
    
    try {
      const apiUrl = getApiUrl()
      
      // Update user account
      const response = await fetch(`${apiUrl}/api/admin/users/${editingMember.guardian.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: `${editingMemberData.firstName} ${editingMemberData.lastName}`,
          email: editingMemberData.email,
          phone: editingMemberData.phone ? cleanPhoneNumber(editingMemberData.phone) : null,
          address: combineAddress(editingMemberData.addressStreet, editingMemberData.addressCity, editingMemberData.addressState, editingMemberData.addressZip) || null,
          username: editingMemberData.username,
          ...(editingMemberData.password && { password: editingMemberData.password })
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to update user')
      }
      
      // Update or create family members (athletes)
      for (const member of editingFamilyMembers) {
        if (member.id) {
          // Update existing athlete
          await fetch(`${apiUrl}/api/admin/athletes/${member.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: member.firstName,
              lastName: member.lastName,
              dateOfBirth: member.dateOfBirth,
              medicalNotes: member.medicalNotes || null,
              internalFlags: member.internalFlags || null
            })
          })
          
          // Update user account if athlete has one (for adults)
          const birthDate = member.dateOfBirth ? new Date(member.dateOfBirth) : null
          const today = new Date()
          const age = birthDate ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0) : null
          if (age !== null && age >= 18 && member.userId) {
            await fetch(`${apiUrl}/api/admin/users/${member.userId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: member.email,
                username: member.username,
                ...(member.password && { password: member.password })
              })
            })
          }
          
          // Update enrollments
          // Delete existing enrollments first
          const existingEnrollments = await fetch(`${apiUrl}/api/admin/athletes/${member.id}/enrollments`)
          if (existingEnrollments.ok) {
            const enrollmentsData = await existingEnrollments.json()
            if (enrollmentsData.success && enrollmentsData.data) {
              for (const enrollment of enrollmentsData.data) {
                await fetch(`${apiUrl}/api/admin/enrollments/${enrollment.id}`, {
                  method: 'DELETE'
                })
              }
            }
          }
          
          // Create new enrollments
          for (const enrollment of (member.enrollments || [])) {
            if (enrollment.programId) {
              await fetch(`${apiUrl}/api/members/enroll`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({
                  programId: enrollment.programId,
                  familyMemberId: member.id,
                  daysPerWeek: enrollment.daysPerWeek,
                  selectedDays: enrollment.selectedDays
                })
              })
            }
          }
        } else {
          // Create new athlete
          const birthDate = member.dateOfBirth ? new Date(member.dateOfBirth) : null
          const today = new Date()
          const age = birthDate ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0) : null
          const isAdult = age !== null && age >= 18
          
          // Create user account first if adult
          let userId = null
          if (isAdult) {
            const userResponse = await fetch(`${apiUrl}/api/admin/users`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fullName: `${member.firstName} ${member.lastName}`,
                email: member.email,
                username: member.username,
                password: member.password || 'vortex',
                role: 'ATHLETE',
                address: combineAddress(editingMemberData.addressStreet, editingMemberData.addressCity, editingMemberData.addressState, editingMemberData.addressZip) || null
              })
            })
            if (userResponse.ok) {
              const userData = await userResponse.json()
              if (userData.success && userData.data) {
                userId = userData.data.id
              }
            }
          }
          
          // Create athlete
          const athleteResponse = await fetch(`${apiUrl}/api/admin/athletes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              familyId: editingMember.family.id,
              firstName: member.firstName,
              lastName: member.lastName,
              dateOfBirth: member.dateOfBirth,
              medicalNotes: member.medicalNotes || null,
              internalFlags: member.internalFlags || null,
              userId: userId
            })
          })
          
          if (athleteResponse.ok) {
            const athleteData = await athleteResponse.json()
            if (athleteData.success && athleteData.data) {
              // Create enrollments
              for (const enrollment of (member.enrollments || [])) {
                if (enrollment.programId) {
                  await fetch(`${apiUrl}/api/members/enroll`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                    },
                    body: JSON.stringify({
                      programId: enrollment.programId,
                      familyMemberId: athleteData.data.id,
                      daysPerWeek: enrollment.daysPerWeek,
                      selectedDays: enrollment.selectedDays
                    })
                  })
                }
              }
            }
          }
        }
      }
      
      await fetchFamilies()
      setShowMemberEditModal(false)
      setEditingMember(null)
      alert('Member updated successfully!')
    } catch (error) {
      console.error('Error updating member:', error)
      alert(error instanceof Error ? error.message : 'Failed to update member')
    }
  }


  // Search for existing families/adults
  const searchFamiliesForMember = async (query: string) => {
    if (!query || query.length < 2) {
      setMemberSearchResults([])
      return
    }
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/families?search=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setMemberSearchResults(data.data)
        }
      }
    } catch (error) {
      console.error('Error searching families:', error)
    }
  }

  // Handle selecting an existing family
  const handleSelectFamilyForMember = (family: Family) => {
    setSelectedFamilyForMember(family)
    setMemberModalMode('existing-family')
    setMemberSearchQuery('')
    setMemberSearchResults([])
  }

  // Generate unique username from first name and last name (firstname + first 2 letters of lastname)
  const generateUsername = async (firstName: string, lastName: string = ''): Promise<string> => {
    if (!firstName) return ''
    
    // Clean first name
    const cleanFirstName = firstName.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    if (!cleanFirstName) return ''
    
    // Get first 2 letters of last name (lowercase, no special chars)
    const cleanLastName = lastName.toLowerCase().trim().replace(/[^a-z0-9]/g, '').substring(0, 2)
    
    const baseUsername = cleanFirstName + cleanLastName
    if (!baseUsername) return ''
    
    let username = baseUsername
    let counter = 1
    
    try {
      const apiUrl = getApiUrl()
      // Check if username exists by searching for users
      let found = false
      do {
        const response = await fetch(`${apiUrl}/api/admin/users?search=${encodeURIComponent(username)}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            // Check if any user has this exact username
            const existingUser = data.data.find((u: any) => u.username?.toLowerCase() === username.toLowerCase())
            if (existingUser) {
              found = true
              username = `${baseUsername}${counter}`
              counter++
            } else {
              found = false
            }
          } else {
            found = false
          }
        } else {
          found = false
        }
      } while (found && counter < 100) // Safety limit
    } catch (error) {
      console.error('Error checking username:', error)
      // If check fails, just use base username
    }
    
    return username
  }

  // Helper function to combine address fields into a single string for API
  const combineAddress = (street: string, city: string, state: string, zip: string): string => {
    const parts = [street, city, state, zip].filter(part => part && part.trim())
    return parts.join(', ') || ''
  }

  // Helper function to parse address string into separate fields
  const parseAddress = (address: string): { street: string; city: string; state: string; zip: string } => {
    if (!address) return { street: '', city: '', state: '', zip: '' }
    
    // Try to parse common formats: "Street, City, State ZIP" or "Street, City, State, ZIP"
    const parts = address.split(',').map(p => p.trim())
    
    if (parts.length >= 3) {
      const street = parts[0]
      const city = parts[1]
      const stateZip = parts[2] || ''
      // Try to separate state and zip (format: "ST 12345" or "ST, 12345")
      const stateZipParts = stateZip.split(/\s+/)
      if (stateZipParts.length >= 2) {
        const state = stateZipParts[0]
        const zip = stateZipParts.slice(1).join(' ')
        return { street, city, state, zip }
      } else {
        return { street, city, state: stateZip, zip: '' }
      }
    } else if (parts.length === 2) {
      return { street: parts[0], city: parts[1], state: '', zip: '' }
    } else {
      return { street: address, city: '', state: '', zip: '' }
    }
  }

  // Format phone number as ###-###-####
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    // Limit to 10 digits
    const limited = digits.slice(0, 10)
    // Format as ###-###-####
    if (limited.length <= 3) {
      return limited
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`
    } else {
      return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`
    }
  }

  // Clean phone number (remove formatting) for storage/API
  const cleanPhoneNumber = (phone: string): string => {
    return phone.replace(/\D/g, '')
  }

  // Create new family with primary adult
  const handleCreateFamilyWithPrimaryAdult = async () => {
    try {
      if (!newPrimaryAdult.firstName || !newPrimaryAdult.lastName || !newPrimaryAdult.email) {
        alert('Please fill in first name, last name, and email for the primary adult')
        return
      }
      
      // Validate days selection if program is selected
      if (newPrimaryAdult.programId && newPrimaryAdult.selectedDays.length !== newPrimaryAdult.daysPerWeek) {
        alert(`Please select exactly ${newPrimaryAdult.daysPerWeek} day(s) for the primary adult`)
        return
      }
      
      // Validate days selection for all children
      for (const child of newChildren) {
        if (child.programId && child.selectedDays.length !== child.daysPerWeek) {
          alert(`Please select exactly ${child.daysPerWeek} day(s) for ${child.firstName} ${child.lastName}`)
          return
        }
      }
      
      // Ensure username is set
      if (!newPrimaryAdult.username) {
        newPrimaryAdult.username = await generateUsername(newPrimaryAdult.firstName, newPrimaryAdult.lastName)
      }

      const apiUrl = getApiUrl()
      
      // Generate username if not provided
      const username = newPrimaryAdult.username || await generateUsername(newPrimaryAdult.firstName, newPrimaryAdult.lastName)
      
      // Try to create the user, or use existing if email already registered
      let userId: number
      const userResponse = await fetch(`${apiUrl}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: `${newPrimaryAdult.firstName} ${newPrimaryAdult.lastName}`,
          email: newPrimaryAdult.email,
          phone: newPrimaryAdult.phone ? cleanPhoneNumber(newPrimaryAdult.phone) : null,
          address: combineAddress(newPrimaryAdult.addressStreet, newPrimaryAdult.addressCity, newPrimaryAdult.addressState, newPrimaryAdult.addressZip) || null,
          password: newPrimaryAdult.password || 'vortex',
          role: 'PARENT_GUARDIAN',
          username: username
        })
      })

      if (!userResponse.ok) {
        const data = await userResponse.json()
        // If email already exists, search for and use the existing user
        if (userResponse.status === 409 || data.message?.toLowerCase().includes('email') || data.message?.toLowerCase().includes('already')) {
          try {
            const searchResponse = await fetch(`${apiUrl}/api/admin/users?role=PARENT_GUARDIAN&search=${encodeURIComponent(newPrimaryAdult.email)}`)
            if (searchResponse.ok) {
              const searchData = await searchResponse.json()
              if (searchData.success && searchData.data && searchData.data.length > 0) {
                const existingUser = searchData.data.find((u: any) => u.email.toLowerCase() === newPrimaryAdult.email.toLowerCase())
                if (existingUser) {
                  userId = existingUser.id
                  console.log('Using existing user:', existingUser.id)
                  
                  // Check if user already has a family
                  const familiesResponse = await fetch(`${apiUrl}/api/admin/families?primaryUserId=${userId}`)
                  if (familiesResponse.ok) {
                    const familiesData = await familiesResponse.json()
                    if (familiesData.success && familiesData.data && familiesData.data.length > 0) {
                      const existingFamily = familiesData.data[0]
                      if (existingFamily) {
                        // User already has a family, use it instead of creating a new one
                        const familyId = existingFamily.id
                        const guardianIds = existingFamily.guardians?.map((g: any) => g.id) || [userId]
                        
                        // Add all family members if provided
                        for (const child of newChildren) {
                          if (child.firstName && child.lastName && child.dateOfBirth) {
                            let childUserId: number | null = null
                            
                            // Calculate age to determine if they need an account
                            const birthDate = new Date(child.dateOfBirth)
                            const today = new Date()
                            const age = today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
                            
                            // Create user account for all children (with username and password)
                            const childUsername = child.username || await generateUsername(child.firstName, child.lastName)
                            try {
                              const childUserResponse = await fetch(`${apiUrl}/api/admin/users`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  fullName: `${child.firstName} ${child.lastName}`,
                                  email: child.email || null,
                                  phone: null,
                                  password: child.password || 'vortex',
                                  role: age >= 18 ? 'PARENT_GUARDIAN' : 'ATHLETE',
                                  username: childUsername
                                })
                              })

                              if (childUserResponse.ok) {
                                const childUserData = await childUserResponse.json()
                                childUserId = childUserData.data.id
                                // Add to guardians if 18+
                                if (age >= 18 && childUserId !== null && !guardianIds.includes(childUserId)) {
                                  guardianIds.push(childUserId)
                                }
                              } else {
                                // If user creation fails (e.g., email exists), try to find existing user
                                const childData = await childUserResponse.json()
                                if (childUserResponse.status === 409 || childData.message?.toLowerCase().includes('email')) {
                                  const searchResponse = await fetch(`${apiUrl}/api/admin/users?role=${age >= 18 ? 'PARENT_GUARDIAN' : 'ATHLETE'}&search=${encodeURIComponent(child.email)}`)
                                  if (searchResponse.ok) {
                                    const searchData = await searchResponse.json()
                                    if (searchData.success && searchData.data && searchData.data.length > 0) {
                                      const existingUser = searchData.data.find((u: any) => u.email.toLowerCase() === child.email.toLowerCase())
                                      if (existingUser) {
                                        childUserId = existingUser.id
                                        if (age >= 18 && childUserId !== null && !guardianIds.includes(childUserId)) {
                                          guardianIds.push(childUserId)
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } catch (error) {
                              console.error('Error creating user for family member:', error)
                              // Continue without user account
                            }
                            
                            // Create athlete record
                            await fetch(`${apiUrl}/api/admin/athletes`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                familyId: familyId,
                                firstName: child.firstName,
                                lastName: child.lastName,
                                dateOfBirth: child.dateOfBirth,
                                medicalNotes: child.medicalNotes || null,
                                internalFlags: child.internalFlags || null,
                                userId: childUserId
                              })
                            })
                          }
                        }
                        
                        // Update family with all guardians if needed
                        if (guardianIds.length > existingFamily.guardians?.length) {
                          await fetch(`${apiUrl}/api/admin/families/${familyId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              familyName: existingFamily.family_name,
                              primaryUserId: userId,
                              guardianIds: guardianIds
                            })
                          })
                        }

                        // Refresh data
                        await fetchFamilies()
                        
                        // Reset form
                        setNewPrimaryAdult({ firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '', username: '', password: 'vortex', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [] })
                        setNewChildren([])
                        setCurrentChild({ firstName: '', lastName: '', dateOfBirth: '', email: '', password: 'vortex', username: '', medicalNotes: '', internalFlags: '', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [], userId: null })
                        setUserSearchQuery('')
                        setAvailableUsers([])
                        setMemberModalMode('search')
                        setShowMemberModal(false)
                        alert('Members added to existing family successfully!')
                        return
                      }
                    }
                  }
                } else {
                  throw new Error('Email already registered, but user not found in search results')
                }
              } else {
                throw new Error('Email already registered, but user not found in search results')
              }
            } else {
              // If search fails, still throw the original error but with more context
              throw new Error(data.message || 'Email already registered. Unable to find existing user account.')
            }
          } catch (error) {
            // If search fails (e.g., 500 error), throw the original error
            if (error instanceof Error) {
              throw error
            }
            throw new Error(data.message || 'Email already registered')
          }
        } else {
          throw new Error(data.message || 'Failed to create user account')
        }
      } else {
        const userData = await userResponse.json()
        userId = userData.data.id
      }

      // Enroll primary adult in program if selected
      if (newPrimaryAdult.programId) {
        // First, we need to create an athlete record for the primary adult if they're participating
        // Check if they already have an athlete record
        const athleteCheckResponse = await fetch(`${apiUrl}/api/admin/athletes?userId=${userId}`)
        let athleteId = null
        if (athleteCheckResponse.ok) {
          const athleteCheckData = await athleteCheckResponse.json()
          if (athleteCheckData.success && athleteCheckData.data && athleteCheckData.data.length > 0) {
            athleteId = athleteCheckData.data[0].id
          }
        }
        
        // If no athlete record exists, create one
        if (!athleteId) {
          // Get the family ID first (we'll create it next)
          // For now, we'll create the athlete after the family is created
        }
      }

      // Create family with this user as primary
      const familyResponse = await fetch(`${apiUrl}/api/admin/families`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyName: `${newPrimaryAdult.firstName} ${newPrimaryAdult.lastName}`,
          primaryUserId: userId,
          guardianIds: [userId]
        })
      })

      if (!familyResponse.ok) {
        const data = await familyResponse.json()
        throw new Error(data.message || 'Failed to create family')
      }

      const familyData = await familyResponse.json()
      const familyId = familyData.data.id
      const guardianIds = [userId] // Start with primary adult

      // Add all family members if provided
      for (const child of newChildren) {
        if (child.firstName && child.lastName && child.dateOfBirth) {
          let childUserId: number | null = null
          
          // Calculate age to determine if they need an account
          const birthDate = new Date(child.dateOfBirth)
          const today = new Date()
          const age = today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
          
          // Create user account for all children (with username and password)
          const childUsername = child.username || await generateUsername(child.firstName, child.lastName)
          try {
            const childUserResponse = await fetch(`${apiUrl}/api/admin/users`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fullName: `${child.firstName} ${child.lastName}`,
                email: child.email || null,
                phone: null,
                password: child.password || 'vortex',
                role: age >= 18 ? 'PARENT_GUARDIAN' : 'ATHLETE',
                username: childUsername
              })
            })

              if (childUserResponse.ok) {
                const childUserData = await childUserResponse.json()
                childUserId = childUserData.data.id
                // Add to guardians if 18+
                if (age >= 18 && childUserId !== null) {
                  guardianIds.push(childUserId)
                }
              } else {
                // If user creation fails (e.g., email exists), try to find existing user
                const childData = await childUserResponse.json()
                if (childUserResponse.status === 409 || childData.message?.toLowerCase().includes('email')) {
                  const searchResponse = await fetch(`${apiUrl}/api/admin/users?role=${age >= 18 ? 'PARENT_GUARDIAN' : 'ATHLETE'}&search=${encodeURIComponent(child.email)}`)
                  if (searchResponse.ok) {
                    const searchData = await searchResponse.json()
                    if (searchData.success && searchData.data && searchData.data.length > 0) {
                      const existingUser = searchData.data.find((u: any) => u.email.toLowerCase() === child.email.toLowerCase())
                      if (existingUser) {
                        childUserId = existingUser.id
                        if (age >= 18 && childUserId !== null) {
                          guardianIds.push(childUserId)
                        }
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error creating user for family member:', error)
              // Continue without user account, but still create athlete record
            }
          
          // Create athlete record
          const athleteResponse = await fetch(`${apiUrl}/api/admin/athletes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              familyId: familyId,
              firstName: child.firstName,
              lastName: child.lastName,
              dateOfBirth: child.dateOfBirth,
              medicalNotes: child.medicalNotes || null,
              internalFlags: child.internalFlags || null,
              userId: childUserId
            })
          })
          
          // Enroll in program if selected
          if (athleteResponse.ok && child.programId) {
            const athleteData = await athleteResponse.json()
            if (athleteData.success && athleteData.data) {
              await fetch(`${apiUrl}/api/members/enroll`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({
                  programId: child.programId,
                  familyMemberId: athleteData.data.id,
                  daysPerWeek: child.daysPerWeek,
                  selectedDays: child.selectedDays
                })
              })
            }
          }
        }
      }
      
      // Enroll primary adult in program if selected (after family is created)
      if (newPrimaryAdult.programId) {
        // Check if primary adult has an athlete record
        const athleteCheckResponse = await fetch(`${apiUrl}/api/admin/athletes?userId=${userId}`)
        if (athleteCheckResponse.ok) {
          const athleteCheckData = await athleteCheckResponse.json()
          if (athleteCheckData.success && athleteCheckData.data && athleteCheckData.data.length > 0) {
            const athleteId = athleteCheckData.data[0].id
            await fetch(`${apiUrl}/api/members/enroll`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
              },
              body: JSON.stringify({
                programId: newPrimaryAdult.programId,
                familyMemberId: athleteId,
                daysPerWeek: newPrimaryAdult.daysPerWeek,
                selectedDays: newPrimaryAdult.selectedDays
              })
            })
          } else {
            // Create athlete record for primary adult if they don't have one
            const athleteResponse = await fetch(`${apiUrl}/api/admin/athletes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                familyId: familyId,
                firstName: newPrimaryAdult.firstName,
                lastName: newPrimaryAdult.lastName,
                dateOfBirth: null, // Adults may not have DOB
                medicalNotes: null,
                internalFlags: null,
                userId: userId
              })
            })
            if (athleteResponse.ok) {
              const athleteData = await athleteResponse.json()
              if (athleteData.success && athleteData.data) {
                await fetch(`${apiUrl}/api/members/enroll`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                  },
                  body: JSON.stringify({
                    programId: newPrimaryAdult.programId,
                    familyMemberId: athleteData.data.id,
                    daysPerWeek: newPrimaryAdult.daysPerWeek,
                    selectedDays: newPrimaryAdult.selectedDays
                  })
                })
              }
            }
          }
        }
      }
      
      // Update family with all guardians
      if (guardianIds.length > 1) {
        await fetch(`${apiUrl}/api/admin/families/${familyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            familyName: `${newPrimaryAdult.firstName} ${newPrimaryAdult.lastName}`,
            primaryUserId: userId,
            guardianIds: guardianIds
          })
        })
      }

      // Refresh data
      await fetchFamilies()
      
      // Reset form
      setNewPrimaryAdult({ firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '', username: '', password: 'vortex', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [] })
      setNewChildren([])
      setCurrentChild({ firstName: '', lastName: '', dateOfBirth: '', email: '', password: 'vortex', username: '', medicalNotes: '', internalFlags: '', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [], userId: null })
      setUserSearchQuery('')
      setAvailableUsers([])
      setMemberModalMode('search')
      setShowMemberModal(false)
      alert('Family created successfully!')
    } catch (error) {
      console.error('Error creating family with primary adult:', error)
      alert(error instanceof Error ? error.message : 'Failed to create family')
    }
  }

  // Add member to existing family (unified handler for adults and children)
  const handleAddMemberToFamily = async () => {
    if (!selectedFamilyForMember) return
    
    try {
      if (!newFamilyMember.firstName || !newFamilyMember.lastName || !newFamilyMember.dateOfBirth || !newFamilyMember.username || !newFamilyMember.password) {
        alert('Please fill in first name, last name, date of birth, username, and password')
        return
      }
      
      // Validate days selection if program is selected
      if (newFamilyMember.programId && newFamilyMember.selectedDays.length !== newFamilyMember.daysPerWeek) {
        alert(`Please select exactly ${newFamilyMember.daysPerWeek} day(s)`)
        return
      }

      const apiUrl = getApiUrl()
      
      // Calculate age from date of birth
      const birthDate = new Date(newFamilyMember.dateOfBirth)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear() - 
        (today.getMonth() < birthDate.getMonth() || 
         (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)

      // Create user account for all members (adults and children)
      let userId: number | null = null
      const userResponse = await fetch(`${apiUrl}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: `${newFamilyMember.firstName} ${newFamilyMember.lastName}`,
          email: null, // Children may not have email
          phone: null,
          password: newFamilyMember.password || 'vortex',
          role: age >= 18 ? 'PARENT_GUARDIAN' : 'ATHLETE',
          username: newFamilyMember.username
        })
      })

      if (userResponse.ok) {
        const userData = await userResponse.json()
        userId = userData.data.id
      } else {
        const data = await userResponse.json()
        // If username already exists, try to find existing user
        if (userResponse.status === 409 && data.message?.toLowerCase().includes('username')) {
          // Try to find by username
          const searchResponse = await fetch(`${apiUrl}/api/admin/users?search=${encodeURIComponent(newFamilyMember.username)}`)
          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            if (searchData.success && searchData.data && searchData.data.length > 0) {
              const existingUser = searchData.data.find((u: any) => u.username?.toLowerCase() === newFamilyMember.username.toLowerCase())
              if (existingUser) {
                userId = existingUser.id
              } else {
                throw new Error('Username already taken. Please choose a different username.')
              }
            }
          }
        } else {
          throw new Error(data.message || 'Failed to create user account')
        }
      }
      
      // Create athlete record (works for both children and adults)
      const athleteResponse = await fetch(`${apiUrl}/api/admin/athletes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId: selectedFamilyForMember.id,
          firstName: newFamilyMember.firstName,
          lastName: newFamilyMember.lastName,
          dateOfBirth: newFamilyMember.dateOfBirth,
          medicalNotes: newFamilyMember.programId ? newFamilyMember.medicalNotes || null : null,
          internalFlags: null,
          userId: userId
        })
      })

      if (!athleteResponse.ok) {
        const data = await athleteResponse.json()
        throw new Error(data.message || 'Failed to add member to family')
      }
      
      // Enroll in program if selected
      const athleteData = await athleteResponse.json()
      if (newFamilyMember.programId && athleteData.success && athleteData.data) {
        await fetch(`${apiUrl}/api/members/enroll`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          },
          body: JSON.stringify({
              programId: newFamilyMember.programId,
              familyMemberId: athleteData.data.id,
              daysPerWeek: newFamilyMember.daysPerWeek,
              selectedDays: newFamilyMember.selectedDays
            })
        })
      }

      // If adult, add as guardian
      if (age >= 18 && userId) {
        const updateResponse = await fetch(`${apiUrl}/api/admin/families/${selectedFamilyForMember.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            familyName: selectedFamilyForMember.family_name,
            primaryUserId: selectedFamilyForMember.primary_user_id,
            guardianIds: [
              ...(selectedFamilyForMember.guardians?.map(g => g.id) || []),
              userId
            ]
          })
        })
        if (!updateResponse.ok) {
          console.warn('Failed to add guardian to family, but member was created')
        }
      }

      // Refresh family data
      const familyResponse = await fetch(`${apiUrl}/api/admin/families/${selectedFamilyForMember.id}`)
      if (familyResponse.ok) {
        const familyData = await familyResponse.json()
        if (familyData.success) {
          setSelectedFamilyForMember(familyData.data)
        }
      }

      await fetchFamilies()
      setNewFamilyMember({ firstName: '', lastName: '', dateOfBirth: '', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [], medicalNotes: '', username: '', password: 'vortex' })
      alert('Member added to family successfully!')
    } catch (error) {
      console.error('Error adding member to family:', error)
      alert(error instanceof Error ? error.message : 'Failed to add member')
    }
  }


  // Add current child to children array
  const handleAddChildToArray = async () => {
    if (!currentChild.firstName || !currentChild.lastName || !currentChild.dateOfBirth) {
      alert('Please fill in at least first name, last name, and date of birth')
      return
    }
    
    // Validate days selection if program is selected
    if (currentChild.programId && currentChild.selectedDays.length !== currentChild.daysPerWeek) {
      alert(`Please select exactly ${currentChild.daysPerWeek} day(s)`)
      return
    }
    
    // Generate username if not provided
    const username = currentChild.username || await generateUsername(currentChild.firstName, currentChild.lastName)
    const password = currentChild.password || 'vortex'
    
    setNewChildren([...newChildren, { ...currentChild, username, password }])
    // Reset form
    setCurrentChild({ firstName: '', lastName: '', dateOfBirth: '', email: '', password: 'vortex', username: '', medicalNotes: '', internalFlags: '', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [], userId: null })
    // Only clear user search if not in new-family mode
    if (memberModalMode !== 'new-family') {
      setUserSearchQuery('')
      setAvailableUsers([])
    }
  }

  // Remove child from children array
  const handleRemoveChildFromArray = (index: number) => {
    setNewChildren(newChildren.filter((_, i) => i !== index))
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

  const fetchAllPrograms = async () => {
    try {
      setProgramsLoading(true)
      setError(null)
      const apiUrl = getApiUrl()
      
      // Fetch both archived and active programs
      const [activeResponse, archivedResponse] = await Promise.all([
        fetch(`${apiUrl}/api/admin/programs?archived=false`),
        fetch(`${apiUrl}/api/admin/programs?archived=true`)
      ])
      
      if (!activeResponse.ok || !archivedResponse.ok) {
        throw new Error(`Backend returned error`)
      }
      
      const [activeData, archivedData] = await Promise.all([
        activeResponse.json(),
        archivedResponse.json()
      ])
      
      if (activeData.success && archivedData.success) {
        setPrograms([...activeData.data, ...archivedData.data])
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
      setError(error instanceof Error ? error.message : 'Unable to fetch programs')
    } finally {
      setProgramsLoading(false)
    }
  }

  const fetchAllCategories = async () => {
    try {
      setCategoriesLoading(true)
      const apiUrl = getApiUrl()
      
      // Fetch both archived and active categories
      const [activeResponse, archivedResponse] = await Promise.all([
        fetch(`${apiUrl}/api/admin/categories?archived=false`),
        fetch(`${apiUrl}/api/admin/categories?archived=true`)
      ])
      
      if (!activeResponse.ok || !archivedResponse.ok) {
        throw new Error(`Backend returned error`)
      }
      
      const [activeData, archivedData] = await Promise.all([
        activeResponse.json(),
        archivedResponse.json()
      ])
      
      if (activeData.success && archivedData.success) {
        setCategories([...activeData.data, ...archivedData.data])
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
        // If unarchiving a class, check if its category is archived and unarchive it too
        if (!archived) {
          const program = programs.find(p => p.id === id)
          if (program && program.categoryId) {
            const category = categories.find(c => c.id === program.categoryId)
            if (category && category.archived) {
              // Unarchive the category as well
              await fetch(`${apiUrl}/api/admin/categories/${category.id}/archive`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archived: false })
              })
            }
          }
        }
        await fetchAllPrograms()
        await fetchAllCategories()
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
        // Refresh both programs and categories to ensure UI is up to date
        await Promise.all([fetchAllPrograms(), fetchAllCategories()])
        // Clear editing state if the deleted program was being edited
        if (editingProgramId === id) {
          setEditingProgramId(null)
          setProgramFormData({})
        }
      } else {
        const data = await response.json()
        const errorMessage = data.errors ? data.errors.join(', ') : (data.message || 'Failed to delete program')
        alert(`Error deleting program: ${errorMessage}`)
        console.error('Delete program error response:', data)
      }
    } catch (error) {
      console.error('Error deleting program:', error)
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      alert(`Failed to delete program: ${errorMessage}`)
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
        await fetchAllCategories()
        await fetchAllPrograms()
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
        await fetchAllPrograms()
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
        await fetchAllCategories()
        await fetchAllPrograms()
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
        await fetchAllCategories()
        await fetchAllPrograms()
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
        await fetchAllCategories()
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
      isActive: program.isActive,
      archived: program.archived, // Preserve archived status
      categoryId: program.categoryId || null // Store for reference, but don't send in update
    })
  }

  const handleUpdateProgram = async () => {
    if (!editingProgramId) return
    
    try {
      const apiUrl = getApiUrl()
      // Ensure we don't send categoryId or archived in the update (these are managed separately)
      const updateData = { ...programFormData }
      delete updateData.categoryId
      delete updateData.archived
      
      const response = await fetch(`${apiUrl}/api/admin/programs/${editingProgramId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      
      if (response.ok) {
        // Refresh both programs and categories to ensure UI is up to date
        await Promise.all([fetchAllPrograms(), fetchAllCategories()])
        setEditingProgramId(null)
        setProgramFormData({})
      } else {
        const data = await response.json()
        const errorMessage = data.errors ? data.errors.join(', ') : (data.message || 'Failed to update program')
        alert(`Error updating program: ${errorMessage}`)
        console.error('Update program error response:', data)
      }
    } catch (error) {
      console.error('Error updating program:', error)
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      alert(`Failed to update program: ${errorMessage}`)
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
          address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
          tagType: 'all_classes_and_parents',
          tagClassIds: [],
          tagCategoryIds: [],
          tagAllParents: false,
          tagBoosters: false,
          tagVolunteers: false
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
      address: event.address || 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
      tagType: event.tagType || 'all_classes_and_parents',
      tagClassIds: event.tagClassIds || [],
      tagCategoryIds: event.tagCategoryIds || [],
      tagAllParents: event.tagAllParents || false,
      tagBoosters: event.tagBoosters || false,
      tagVolunteers: event.tagVolunteers || false
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
                onClick={() => { fetchFamilies(); }}
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
                onClick={() => {
                  fetchAllPrograms()
                  fetchAllCategories()
                }}
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
                {/* Archive Toggle Buttons */}
                <div className="flex gap-2 mb-4">
                  <motion.button
                    onClick={() => {
                      setShowArchivedCategories(!showArchivedCategories)
                      setShowArchivedClasses(false)
                    }}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                      showArchivedCategories
                        ? 'bg-gray-600 text-white hover:bg-gray-700'
                        : 'bg-gray-500 text-white hover:bg-gray-600'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Archive className="w-4 h-4" />
                    <span>{showArchivedCategories ? 'Show Active Categories' : 'Show Category Archives'}</span>
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setShowArchivedClasses(!showArchivedClasses)
                      setShowArchivedCategories(false)
                    }}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                      showArchivedClasses
                        ? 'bg-gray-600 text-white hover:bg-gray-700'
                        : 'bg-gray-500 text-white hover:bg-gray-600'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Archive className="w-4 h-4" />
                    <span>{showArchivedClasses ? 'Show Active Classes' : 'Show Class Archives'}</span>
                  </motion.button>
                </div>

                {/* Category Archives View */}
                {showArchivedCategories && (
                  <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-4">
                      Category Archives
                    </h2>
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search archived categories..."
                          value={categoryArchiveSearch}
                          onChange={(e) => setCategoryArchiveSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                        />
                      </div>
                    </div>
                    {categoriesLoading ? (
                      <div className="text-center py-12 text-gray-600">Loading...</div>
                    ) : (
                      <div className="space-y-4">
                        {categories
                          .filter(cat => cat.archived)
                          .filter(cat => 
                            !categoryArchiveSearch.trim() || 
                            cat.displayName.toLowerCase().includes(categoryArchiveSearch.toLowerCase()) ||
                            cat.name.toLowerCase().includes(categoryArchiveSearch.toLowerCase()) ||
                            (cat.description && cat.description.toLowerCase().includes(categoryArchiveSearch.toLowerCase()))
                          )
                          .map((category) => (
                            <div key={category.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-black">{category.displayName}</h3>
                                  {category.description && (
                                    <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                                  )}
                                </div>
                                <div className="flex gap-2">
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
                                </div>
                              </div>
                            </div>
                          ))}
                        {categories.filter(cat => cat.archived && 
                          (!categoryArchiveSearch.trim() || 
                            cat.displayName.toLowerCase().includes(categoryArchiveSearch.toLowerCase()) ||
                            cat.name.toLowerCase().includes(categoryArchiveSearch.toLowerCase()) ||
                            (cat.description && cat.description.toLowerCase().includes(categoryArchiveSearch.toLowerCase()))
                          )).length === 0 && (
                          <div className="text-center py-8 text-gray-500">No archived categories found</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Class Archives View */}
                {showArchivedClasses && (
                  <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-4">
                      Class Archives
                    </h2>
                    <div className="mb-4 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search archived classes..."
                          value={classArchiveSearch}
                          onChange={(e) => setClassArchiveSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Category</label>
                        <select
                          value={classArchiveCategoryFilter === 'all' ? 'all' : String(classArchiveCategoryFilter)}
                          onChange={(e) => setClassArchiveCategoryFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                          className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                        >
                          <option value="all">All Categories</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={String(cat.id)}>{cat.displayName}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {programsLoading ? (
                      <div className="text-center py-12 text-gray-600">Loading...</div>
                    ) : (
                      <div className="space-y-4">
                        {programs
                          .filter(p => p.archived)
                          .filter(p => {
                            if (classArchiveCategoryFilter === 'all') {
                              return true
                            }
                            // Match by categoryId (handle both number and string comparisons)
                            if (p.categoryId != null && (p.categoryId === classArchiveCategoryFilter || String(p.categoryId) === String(classArchiveCategoryFilter))) {
                              return true
                            }
                            // Match by categoryDisplayName as fallback
                            if (p.categoryDisplayName) {
                              const selectedCategory = categories.find(c => c.id === classArchiveCategoryFilter)
                              if (selectedCategory && selectedCategory.displayName === p.categoryDisplayName) {
                                return true
                              }
                            }
                            return false
                          })
                          .filter(p => 
                            !classArchiveSearch.trim() || 
                            p.displayName.toLowerCase().includes(classArchiveSearch.toLowerCase()) ||
                            p.name.toLowerCase().includes(classArchiveSearch.toLowerCase()) ||
                            (p.description && p.description.toLowerCase().includes(classArchiveSearch.toLowerCase()))
                          )
                          .map((program) => {
                            const programCategory = categories.find(c => 
                              c.id === program.categoryId || 
                              c.displayName === program.categoryDisplayName
                            )
                            return (
                              <div key={program.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
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
                                    {programCategory && (
                                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                        <p className="text-sm text-gray-700">
                                          <span className="font-semibold">Category:</span> {programCategory.displayName}
                                          <span className="text-xs text-gray-500 ml-2">(Category is preserved when unarchiving)</span>
                                        </p>
                                      </div>
                                    )}
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
                                          {programCategory && (
                                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                              {programCategory.displayName}
                                            </span>
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
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        {(() => {
                          const filteredPrograms = programs
                            .filter(p => p.archived)
                            .filter(p => {
                              if (classArchiveCategoryFilter === 'all') {
                                return true
                              }
                              // Match by categoryId (handle both number and string comparisons)
                              if (p.categoryId != null && (p.categoryId === classArchiveCategoryFilter || String(p.categoryId) === String(classArchiveCategoryFilter))) {
                                return true
                              }
                              // Match by categoryDisplayName as fallback
                              if (p.categoryDisplayName) {
                                const selectedCategory = categories.find(c => c.id === classArchiveCategoryFilter)
                                if (selectedCategory && selectedCategory.displayName === p.categoryDisplayName) {
                                  return true
                                }
                              }
                              return false
                            })
                            .filter(p => 
                              !classArchiveSearch.trim() || 
                              p.displayName?.toLowerCase().includes(classArchiveSearch.toLowerCase()) ||
                              p.name?.toLowerCase().includes(classArchiveSearch.toLowerCase()) ||
                              (p.description && p.description.toLowerCase().includes(classArchiveSearch.toLowerCase()))
                            )
                          
                          return filteredPrograms.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">No archived classes found</div>
                          ) : null
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Category & Class Management */}
                {!showArchivedCategories && !showArchivedClasses && (
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
                      Category & Class Management
                    </h2>
                    <div className="flex gap-2">
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
                          fetchAllPrograms()
                          fetchAllCategories()
                        }}
                        className="bg-vortex-red hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {categories
                        .filter(cat => !cat.archived)
                        .map((category) => {
                          const categoryPrograms = programs.filter(p => 
                            (p.categoryId === category.id || p.categoryDisplayName === category.displayName) &&
                            !p.archived
                          )

                          return (
                            <div key={category.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-xl md:text-2xl font-display font-bold text-black">
                                      {category.displayName}
                                    </h3>
                                  </div>
                                  {category.description && (
                                    <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedCategoryForClass(category.id)
                                      setProgramFormData({})
                                      setShowClassModal(true)
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 bg-vortex-red hover:bg-red-700 rounded text-white text-sm font-medium"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Add Class
                                  </button>
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
                                  <button
                                    onClick={() => handleArchiveCategory(category.id, true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium"
                                  >
                                    <Archive className="w-4 h-4" />
                                    Archive
                                  </button>
                                </div>
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
                                          <button
                                            onClick={() => handleArchiveProgram(program.id, true)}
                                            className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium"
                                          >
                                            <Archive className="w-4 h-4" />
                                            Archive
                                          </button>
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
                )}
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
                className="space-y-6"
              >
                {/* Members Section */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
                      Members ({families.filter(f => showArchivedFamilies ? f.archived : !f.archived).reduce((sum, f) => sum + (f.guardians?.length || 0) + (f.athletes?.length || 0), 0)})
                    </h2>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Search Members"
                        value={familySearchQuery}
                        onChange={(e) => {
                          setFamilySearchQuery(e.target.value)
                          fetchFamilies()
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <motion.button
                        onClick={() => setShowArchivedFamilies(!showArchivedFamilies)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                          showArchivedFamilies
                            ? 'bg-gray-600 text-white hover:bg-gray-700'
                            : 'bg-gray-500 text-white hover:bg-gray-600'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Archive className="w-4 h-4" />
                        <span>{showArchivedFamilies ? 'Show Active' : 'Show Archives'}</span>
                      </motion.button>
                      <motion.button
                        onClick={() => {
                          setShowMemberModal(true)
                          setMemberModalMode('search')
                          setSelectedFamilyForMember(null)
                          setMemberSearchQuery('')
                          setMemberSearchResults([])
                          // Reset form fields
                          setNewPrimaryAdult({ firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '', username: '', password: 'vortex', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [] })
                        }}
                        className="flex items-center space-x-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Create Member</span>
                      </motion.button>
                    </div>
                  </div>

                  {familiesLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading members...</div>
                  ) : (() => {
                    const filteredFamilies = families.filter(f => showArchivedFamilies ? f.archived : !f.archived)
                    const allMembers: Array<{family: Family, member: Guardian | Athlete, type: 'guardian' | 'athlete'}> = []
                    
                    filteredFamilies.forEach(family => {
                      if (family.guardians) {
                        family.guardians.forEach(guardian => {
                          allMembers.push({ family, member: guardian, type: 'guardian' })
                        })
                      }
                      if (family.athletes) {
                        family.athletes.forEach(athlete => {
                          allMembers.push({ family, member: athlete, type: 'athlete' })
                        })
                      }
                    })

                    if (allMembers.length === 0) {
                      return <div className="text-center py-12 text-gray-600">No {showArchivedFamilies ? 'archived' : ''} members yet</div>
                    }

                    return (
                      <div className="space-y-4">
                        {allMembers.map(({ family, member, type }) => {
                          const isGuardian = type === 'guardian'
                          const memberName = isGuardian 
                            ? (member as Guardian).fullName 
                            : `${(member as Athlete).first_name} ${(member as Athlete).last_name}`
                          const memberEmail = isGuardian ? (member as Guardian).email : null
                          const memberPhone = isGuardian ? (member as Guardian).phone : null
                          const memberAge = !isGuardian ? (member as Athlete).age : null

                          return (
                            <div 
                              key={`${family.id}-${type}-${isGuardian ? (member as Guardian).id : (member as Athlete).id}`}
                              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                            >
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex-1">
                                  <div className="text-black font-semibold text-lg">
                                    {memberName}
                                  </div>
                                  {memberEmail && (
                                    <div className="text-gray-600 text-sm mt-1">{memberEmail}</div>
                                  )}
                                  {memberPhone && (
                                    <div className="text-gray-600 text-sm">{memberPhone}</div>
                                  )}
                                  {memberAge !== null && (
                                    <div className="text-gray-600 text-sm">Age: {memberAge}</div>
                                  )}
                                  <div className="text-gray-500 text-xs mt-1">
                                    {isGuardian ? 'Guardian' : 'Athlete'} • Family ID: {family.id}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  {isGuardian ? (
                                    <>
                                      <motion.button
                                        onClick={() => handleViewMember(member as Guardian, family)}
                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        <Eye className="w-4 h-4" />
                                        View
                                      </motion.button>
                                      <motion.button
                                        onClick={() => handleEditMember(member as Guardian, family)}
                                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center gap-2"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                        Edit
                                      </motion.button>
                                    </>
                                  ) : (
                                    <>
                                      <motion.button
                                        onClick={() => {
                                          // For athletes, find their guardian and view that
                                          const primaryGuardian = family.guardians?.find(g => g.id === family.primary_user_id) || family.guardians?.[0]
                                          if (primaryGuardian) {
                                            handleViewMember(primaryGuardian, family)
                                          } else {
                                            handleViewFamily(family)
                                          }
                                        }}
                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        <Eye className="w-4 h-4" />
                                        View Family
                                      </motion.button>
                                      <motion.button
                                        onClick={() => {
                                          // For athletes, find their guardian and edit that
                                          const primaryGuardian = family.guardians?.find(g => g.id === family.primary_user_id) || family.guardians?.[0]
                                          if (primaryGuardian) {
                                            handleEditMember(primaryGuardian, family)
                                          } else {
                                            handleEditFamily(family)
                                          }
                                        }}
                                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center gap-2"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                        Edit Family
                                      </motion.button>
                                    </>
                                  )}
                                  {showArchivedFamilies ? (
                                    <>
                                      <motion.button
                                        onClick={() => handleArchiveFamily(family.id, false)}
                                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center gap-2"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        <Archive className="w-4 h-4" />
                                        Unarchive
                                      </motion.button>
                                      <motion.button
                                        onClick={() => handleDeleteFamily(family.id)}
                                        className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 flex items-center gap-2"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        <X className="w-4 h-4" />
                                        Delete
                                      </motion.button>
                                    </>
                                  ) : (
                                    <motion.button
                                      onClick={() => handleArchiveFamily(family.id, true)}
                                      className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 flex items-center gap-2"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      <Archive className="w-4 h-4" />
                                      Archive
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
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

      {/* Comprehensive Create Member Modal */}
      <AnimatePresence>
        {showMemberModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowMemberModal(false)
                setMemberModalMode('search')
                setSelectedFamilyForMember(null)
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
                  {memberModalMode === 'search' && 'Create Member - Search or New'}
                  {memberModalMode === 'new-family' && 'Create New Family'}
                  {memberModalMode === 'existing-family' && 'Add to Existing Family'}
                </h3>
                <button
                  onClick={() => {
                    setShowMemberModal(false)
                    setMemberModalMode('search')
                    setSelectedFamilyForMember(null)
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Search Mode */}
              {memberModalMode === 'search' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Search for Existing Family (by name or email)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={memberSearchQuery}
                        onChange={(e) => {
                          setMemberSearchQuery(e.target.value)
                          searchFamiliesForMember(e.target.value)
                        }}
                        placeholder="Type to search..."
                        className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      />
                    </div>
                    {memberSearchResults.length > 0 && (
                      <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                        {memberSearchResults.map((family) => (
                          <div
                            key={family.id}
                            onClick={() => handleSelectFamilyForMember(family)}
                            className="p-3 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                          >
                            <div className="font-semibold text-white">
                              {family.family_name || `${family.primary_name || 'Unnamed'} Family`}
                            </div>
                            {family.primary_email && (
                              <div className="text-sm text-gray-300">{family.primary_email}</div>
                            )}
                            {family.guardians && family.guardians.length > 0 && (
                              <div className="text-xs text-gray-400 mt-1">
                                {family.guardians.length} guardian(s), {family.athletes?.length || 0} athlete(s)
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-600 pt-4">
                    <button
                      onClick={() => setMemberModalMode('new-family')}
                      className="w-full bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Create New Family Instead
                    </button>
                  </div>
                </div>
              )}

              {/* New Family Mode */}
              {memberModalMode === 'new-family' && (
                <div className="space-y-6">
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-4">Family Member 1 (Must be an Adult) *</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                        <input
                          type="text"
                          value={newPrimaryAdult.firstName}
                          onChange={async (e) => {
                            const firstName = e.target.value
                            const username = await generateUsername(firstName, newPrimaryAdult.lastName)
                            setNewPrimaryAdult({ ...newPrimaryAdult, firstName, username })
                          }}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                        <input
                          type="text"
                          value={newPrimaryAdult.lastName}
                          onChange={async (e) => {
                            const lastName = e.target.value
                            const username = await generateUsername(newPrimaryAdult.firstName, lastName)
                            setNewPrimaryAdult({ ...newPrimaryAdult, lastName, username })
                          }}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                        <input
                          type="email"
                          value={newPrimaryAdult.email}
                          onChange={(e) => setNewPrimaryAdult({ ...newPrimaryAdult, email: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Phone *</label>
                        <input
                          type="tel"
                          value={newPrimaryAdult.phone}
                          onChange={(e) => {
                            const formatted = formatPhoneNumber(e.target.value)
                            setNewPrimaryAdult({ ...newPrimaryAdult, phone: formatted })
                          }}
                          placeholder="###-###-####"
                          maxLength={12}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          autoComplete="off"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Street</label>
                        <input
                          type="text"
                          value={newPrimaryAdult.addressStreet}
                          onChange={(e) => setNewPrimaryAdult({ ...newPrimaryAdult, addressStreet: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          placeholder="Street address"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">City</label>
                        <input
                          type="text"
                          value={newPrimaryAdult.addressCity}
                          onChange={(e) => setNewPrimaryAdult({ ...newPrimaryAdult, addressCity: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">State</label>
                        <input
                          type="text"
                          value={newPrimaryAdult.addressState}
                          onChange={(e) => setNewPrimaryAdult({ ...newPrimaryAdult, addressState: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          placeholder="State"
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Zip</label>
                        <input
                          type="text"
                          value={newPrimaryAdult.addressZip}
                          onChange={(e) => setNewPrimaryAdult({ ...newPrimaryAdult, addressZip: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          placeholder="ZIP code"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Username *</label>
                        <input
                          type="text"
                          value={newPrimaryAdult.username}
                          onChange={(e) => setNewPrimaryAdult({ ...newPrimaryAdult, username: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                        <input
                          type="password"
                          value={newPrimaryAdult.password}
                          onChange={(e) => setNewPrimaryAdult({ ...newPrimaryAdult, password: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          required
                          minLength={6}
                          autoComplete="new-password"
                        />
                        <p className="text-xs text-gray-400 mt-1">Default: vortex</p>
                      </div>
                      
                      {/* Enrollment Section */}
                      <div className="md:col-span-2 border-t border-gray-500 pt-4 mt-4">
                        <h5 className="text-sm font-semibold text-white mb-4">Enrollment</h5>
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Program/Class</label>
                          <select
                            value={newPrimaryAdult.programId || ''}
                            onChange={(e) => {
                              const programId = e.target.value ? parseInt(e.target.value) : null
                              const selectedProgram = programs.find(p => p.id === programId)
                              setNewPrimaryAdult({
                                ...newPrimaryAdult,
                                programId,
                                program: selectedProgram?.displayName || 'Non-Participant',
                                daysPerWeek: 1,
                                selectedDays: []
                              })
                            }}
                            className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          >
                            <option value="">Non-Participant</option>
                            {getSimplifiedGymnasticsPrograms(programs).map((program) => (
                              <option key={program.id} value={program.id}>
                                {program.displayName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {newPrimaryAdult.programId && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">Days Per Week *</label>
                            <select
                              value={newPrimaryAdult.daysPerWeek}
                              onChange={(e) => {
                                const daysPerWeek = parseInt(e.target.value)
                                setNewPrimaryAdult({
                                  ...newPrimaryAdult,
                                  daysPerWeek,
                                  selectedDays: newPrimaryAdult.selectedDays.length !== daysPerWeek ? [] : newPrimaryAdult.selectedDays
                                })
                              }}
                              className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                              required
                            >
                              <option value={1}>1 day</option>
                              <option value={2}>2 days</option>
                              <option value={3}>3 days</option>
                              <option value={4}>4 days</option>
                              <option value={5}>5 days</option>
                              <option value={6}>6 days</option>
                              <option value={7}>7 days</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-300 mb-2">
                              Select Days * ({newPrimaryAdult.selectedDays.length} of {newPrimaryAdult.daysPerWeek} selected)
                            </label>
                            <div className="grid grid-cols-7 gap-2">
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    const dayIndex = newPrimaryAdult.selectedDays.indexOf(day)
                                    if (dayIndex > -1) {
                                      setNewPrimaryAdult({
                                        ...newPrimaryAdult,
                                        selectedDays: newPrimaryAdult.selectedDays.filter(d => d !== day)
                                      })
                                    } else {
                                      if (newPrimaryAdult.selectedDays.length < newPrimaryAdult.daysPerWeek) {
                                        setNewPrimaryAdult({
                                          ...newPrimaryAdult,
                                          selectedDays: [...newPrimaryAdult.selectedDays, day]
                                        })
                                      } else {
                                        alert(`Please select exactly ${newPrimaryAdult.daysPerWeek} day(s)`)
                                      }
                                    }
                                  }}
                                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                    newPrimaryAdult.selectedDays.includes(day)
                                      ? 'bg-vortex-red text-white'
                                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                  }`}
                                >
                                  {day.substring(0, 3)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-4">Add Family Member 2 (Optional)</h4>
                    
                    {/* List of added children */}
                    {newChildren.length > 0 && (
                      <div className="mb-4 space-y-2">
                        <p className="text-sm text-gray-300 font-semibold">Family Members to be added ({newChildren.length}):</p>
                        {newChildren.map((child, index) => {
                          const birthDate = child.dateOfBirth ? new Date(child.dateOfBirth) : null
                          const today = new Date()
                          const age = birthDate ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0) : null
                          
                          return (
                            <div key={index} className="bg-gray-600 p-3 rounded flex justify-between items-center">
                              <div>
                                <span className="text-white font-medium">
                                  {child.firstName} {child.lastName}
                                </span>
                                {child.dateOfBirth && (
                                  <span className="text-gray-400 text-sm ml-2">
                                    (DOB: {new Date(child.dateOfBirth).toLocaleDateString()})
                                  </span>
                                )}
                                {child.email && (
                                  <span className="text-gray-400 text-sm ml-2">
                                    ({child.email})
                                  </span>
                                )}
                                {age !== null && age >= 18 && (
                                  <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded ml-2">
                                    Adult
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleRemoveChildFromArray(index)}
                                className="text-red-400 hover:text-red-300 text-sm font-semibold"
                              >
                                Remove
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Form to add a child */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">First Name</label>
                        <input
                          type="text"
                          value={currentChild.firstName}
                          onChange={(e) => setCurrentChild({ ...currentChild, firstName: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name</label>
                        <input
                          type="text"
                          value={currentChild.lastName}
                          onChange={(e) => setCurrentChild({ ...currentChild, lastName: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Date of Birth</label>
                        <input
                          type="date"
                          value={currentChild.dateOfBirth}
                          onChange={(e) => setCurrentChild({ ...currentChild, dateOfBirth: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Program/Class</label>
                        <select
                          value={currentChild.programId || ''}
                          onChange={(e) => {
                            const programId = e.target.value ? parseInt(e.target.value) : null
                            const selectedProgram = programs.find(p => p.id === programId)
                            setCurrentChild({
                              ...currentChild,
                              programId,
                              program: selectedProgram?.displayName || 'Non-Participant',
                              daysPerWeek: 1,
                              selectedDays: []
                            })
                          }}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        >
                          <option value="">Non-Participant</option>
                          {getSimplifiedGymnasticsPrograms(programs).map((program) => (
                            <option key={program.id} value={program.id}>
                              {program.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                      {currentChild.programId && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">Days Per Week *</label>
                            <select
                              value={currentChild.daysPerWeek}
                              onChange={(e) => {
                                const daysPerWeek = parseInt(e.target.value)
                                setCurrentChild({
                                  ...currentChild,
                                  daysPerWeek,
                                  selectedDays: currentChild.selectedDays.length !== daysPerWeek ? [] : currentChild.selectedDays
                                })
                              }}
                              className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                              required
                            >
                              <option value={1}>1 day</option>
                              <option value={2}>2 days</option>
                              <option value={3}>3 days</option>
                              <option value={4}>4 days</option>
                              <option value={5}>5 days</option>
                              <option value={6}>6 days</option>
                              <option value={7}>7 days</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-300 mb-2">
                              Select Days * ({currentChild.selectedDays.length} of {currentChild.daysPerWeek} selected)
                            </label>
                            <div className="grid grid-cols-7 gap-2">
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    const dayIndex = currentChild.selectedDays.indexOf(day)
                                    if (dayIndex > -1) {
                                      setCurrentChild({
                                        ...currentChild,
                                        selectedDays: currentChild.selectedDays.filter(d => d !== day)
                                      })
                                    } else {
                                      if (currentChild.selectedDays.length < currentChild.daysPerWeek) {
                                        setCurrentChild({
                                          ...currentChild,
                                          selectedDays: [...currentChild.selectedDays, day]
                                        })
                                      } else {
                                        alert(`Please select exactly ${currentChild.daysPerWeek} day(s)`)
                                      }
                                    }
                                  }}
                                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                    currentChild.selectedDays.includes(day)
                                      ? 'bg-vortex-red text-white'
                                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                  }`}
                                >
                                  {day.substring(0, 3)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Email {(() => {
                            if (!currentChild.dateOfBirth) return '(Optional)'
                            const birthDate = new Date(currentChild.dateOfBirth)
                            const today = new Date()
                            const age = today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
                            return age >= 18 ? '*' : '(Optional)'
                          })()}
                        </label>
                        <input
                          type="email"
                          value={currentChild.email}
                          onChange={(e) => setCurrentChild({ ...currentChild, email: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          required={(() => {
                            if (!currentChild.dateOfBirth) return false
                            const birthDate = new Date(currentChild.dateOfBirth)
                            const today = new Date()
                            const age = today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
                            return age >= 18
                          })()}
                        />
                      </div>
                      {currentChild.email && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                          <input
                            type="password"
                            value={currentChild.password}
                            onChange={(e) => setCurrentChild({ ...currentChild, password: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                            required={!!currentChild.email}
                            minLength={6}
                          />
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Medical Notes</label>
                        <textarea
                          value={currentChild.medicalNotes}
                          onChange={(e) => setCurrentChild({ ...currentChild, medicalNotes: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <button
                          onClick={handleAddChildToArray}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                        >
                          Finished with Member
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateFamilyWithPrimaryAdult}
                      className="flex-1 bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Create Member or Family
                    </button>
                    <button
                      onClick={() => {
                        setMemberModalMode('search')
                        setNewPrimaryAdult({ firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '', username: '', password: 'vortex', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [] })
                        setNewChildren([])
                        setCurrentChild({ firstName: '', lastName: '', dateOfBirth: '', email: '', password: 'vortex', username: '', medicalNotes: '', internalFlags: '', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [], userId: null })
                        setUserSearchQuery('')
                        setAvailableUsers([])
                      }}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Existing Family Mode */}
              {memberModalMode === 'existing-family' && selectedFamilyForMember && (
                <div className="space-y-6">
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-2">Family: {selectedFamilyForMember.family_name || 'Unnamed Family'}</h4>
                    <div className="text-sm text-gray-300">
                      {selectedFamilyForMember.guardians && selectedFamilyForMember.guardians.length > 0 && (
                        <div>Guardians: {selectedFamilyForMember.guardians.map(g => g.fullName).join(', ')}</div>
                      )}
                      {selectedFamilyForMember.athletes && selectedFamilyForMember.athletes.length > 0 && (
                        <div>Athletes: {selectedFamilyForMember.athletes.map(a => `${a.first_name} ${a.last_name}`).join(', ')}</div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-4">Add Additional Family Member(s)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                        <input
                          type="text"
                          value={newFamilyMember.firstName}
                          onChange={async (e) => {
                            const firstName = e.target.value
                            const username = await generateUsername(firstName, newFamilyMember.lastName)
                            setNewFamilyMember({ ...newFamilyMember, firstName, username })
                          }}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                        <input
                          type="text"
                          value={newFamilyMember.lastName}
                          onChange={async (e) => {
                            const lastName = e.target.value
                            const username = await generateUsername(newFamilyMember.firstName, lastName)
                            setNewFamilyMember({ ...newFamilyMember, lastName, username })
                          }}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Date of Birth *</label>
                        <input
                          type="date"
                          value={newFamilyMember.dateOfBirth}
                          onChange={(e) => setNewFamilyMember({ ...newFamilyMember, dateOfBirth: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Program/Class</label>
                        <select
                          value={newFamilyMember.programId || ''}
                          onChange={(e) => {
                            const programId = e.target.value ? parseInt(e.target.value) : null
                            const selectedProgram = programs.find(p => p.id === programId)
                            setNewFamilyMember({
                              ...newFamilyMember,
                              programId,
                              program: selectedProgram?.displayName || 'Non-Participant',
                              daysPerWeek: 1,
                              selectedDays: []
                            })
                          }}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        >
                          <option value="">Non-Participant</option>
                          {getSimplifiedGymnasticsPrograms(programs).map((program) => (
                            <option key={program.id} value={program.id}>
                              {program.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                      {newFamilyMember.programId && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">Days Per Week *</label>
                            <select
                              value={newFamilyMember.daysPerWeek}
                              onChange={(e) => {
                                const daysPerWeek = parseInt(e.target.value)
                                setNewFamilyMember({
                                  ...newFamilyMember,
                                  daysPerWeek,
                                  selectedDays: newFamilyMember.selectedDays.length !== daysPerWeek ? [] : newFamilyMember.selectedDays
                                })
                              }}
                              className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                              required
                            >
                              <option value={1}>1 day</option>
                              <option value={2}>2 days</option>
                              <option value={3}>3 days</option>
                              <option value={4}>4 days</option>
                              <option value={5}>5 days</option>
                              <option value={6}>6 days</option>
                              <option value={7}>7 days</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-300 mb-2">
                              Select Days * ({newFamilyMember.selectedDays.length} of {newFamilyMember.daysPerWeek} selected)
                            </label>
                            <div className="grid grid-cols-7 gap-2">
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    const dayIndex = newFamilyMember.selectedDays.indexOf(day)
                                    if (dayIndex > -1) {
                                      setNewFamilyMember({
                                        ...newFamilyMember,
                                        selectedDays: newFamilyMember.selectedDays.filter(d => d !== day)
                                      })
                                    } else {
                                      if (newFamilyMember.selectedDays.length < newFamilyMember.daysPerWeek) {
                                        setNewFamilyMember({
                                          ...newFamilyMember,
                                          selectedDays: [...newFamilyMember.selectedDays, day]
                                        })
                                      } else {
                                        alert(`Please select exactly ${newFamilyMember.daysPerWeek} day(s)`)
                                      }
                                    }
                                  }}
                                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                    newFamilyMember.selectedDays.includes(day)
                                      ? 'bg-vortex-red text-white'
                                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                  }`}
                                >
                                  {day.substring(0, 3)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Username *</label>
                        <input
                          type="text"
                          value={newFamilyMember.username}
                          onChange={(e) => setNewFamilyMember({ ...newFamilyMember, username: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                        <input
                          type="password"
                          value={newFamilyMember.password}
                          onChange={(e) => setNewFamilyMember({ ...newFamilyMember, password: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                          required
                        />
                        <p className="text-xs text-gray-400 mt-1">Default: vortex</p>
                      </div>
                      {newFamilyMember.program !== 'Non-Participant' && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Medical Notes</label>
                          <textarea
                            value={newFamilyMember.medicalNotes}
                            onChange={(e) => setNewFamilyMember({ ...newFamilyMember, medicalNotes: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                            placeholder="Enter any medical notes or special considerations..."
                          />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleAddMemberToFamily}
                      className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors"
                    >
                      Finished with Member
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowMemberModal(false)
                        setMemberModalMode('search')
                        setSelectedFamilyForMember(null)
                      }}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => {
                        setMemberModalMode('search')
                        setSelectedFamilyForMember(null)
                      }}
                      className="flex-1 bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Search Another Family
                    </button>
                  </div>
                </div>
              )}
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
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

      {/* Family View Modal */}
      <AnimatePresence>
        {showFamilyViewModal && selectedFamilyForView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowFamilyViewModal(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Family Details</h3>
                <button
                  onClick={() => setShowFamilyViewModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4">Family Information</h4>
                  <div className="text-sm text-gray-300 space-y-2">
                    <div>Family ID: {selectedFamilyForView.id}</div>
                    {selectedFamilyForView.family_name && (
                      <div>Family Name: {selectedFamilyForView.family_name}</div>
                    )}
                    <div>Created: {new Date(selectedFamilyForView.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {selectedFamilyForView.guardians && selectedFamilyForView.guardians.length > 0 && (
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-4">Guardians ({selectedFamilyForView.guardians.length})</h4>
                    <div className="space-y-3">
                      {selectedFamilyForView.guardians.map((guardian) => (
                        <div key={guardian.id} className="bg-gray-600 p-3 rounded">
                          <div className="text-white font-medium">{guardian.fullName}</div>
                          <div className="text-gray-300 text-sm mt-1">{guardian.email}</div>
                          {guardian.phone && (
                            <div className="text-gray-300 text-sm">{guardian.phone}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedFamilyForView.athletes && selectedFamilyForView.athletes.length > 0 && (
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-4">Athletes ({selectedFamilyForView.athletes.length})</h4>
                    <div className="space-y-3">
                      {selectedFamilyForView.athletes.map((athlete) => (
                        <div key={athlete.id} className="bg-gray-600 p-3 rounded">
                          <div className="text-white font-medium">{athlete.first_name} {athlete.last_name}</div>
                          <div className="text-gray-300 text-sm mt-1">
                            Date of Birth: {new Date(athlete.date_of_birth).toLocaleDateString()}
                            {athlete.age !== undefined && ` (Age ${athlete.age})`}
                          </div>
                          {athlete.medical_notes && (
                            <div className="text-gray-300 text-sm mt-1">Medical Notes: {athlete.medical_notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowFamilyViewModal(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Family Edit Modal */}
      <AnimatePresence>
        {showFamilyEditModal && editingFamily && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowFamilyEditModal(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Edit Family</h3>
                <button
                  onClick={() => setShowFamilyEditModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Family Name</label>
                  <input
                    type="text"
                    value={editingFamily.family_name || ''}
                    onChange={(e) => setEditingFamily({ ...editingFamily, family_name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                  />
                </div>

                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4">Guardians</h4>
                  {editingFamily.guardians && editingFamily.guardians.length > 0 ? (
                    <div className="space-y-2">
                      {editingFamily.guardians.map((guardian) => (
                        <div key={guardian.id} className="bg-gray-600 p-3 rounded text-white">
                          {guardian.fullName} ({guardian.email})
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">No guardians</div>
                  )}
                </div>

                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4">Athletes</h4>
                  {editingFamily.athletes && editingFamily.athletes.length > 0 ? (
                    <div className="space-y-2">
                      {editingFamily.athletes.map((athlete) => (
                        <div key={athlete.id} className="bg-gray-600 p-3 rounded text-white">
                          {athlete.first_name} {athlete.last_name} (Age {athlete.age || 'N/A'})
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">No athletes</div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowFamilyEditModal(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const apiUrl = getApiUrl()
                      const response = await fetch(`${apiUrl}/api/admin/families/${editingFamily.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          familyName: editingFamily.family_name,
                          primaryUserId: editingFamily.primary_user_id,
                          guardianIds: editingFamily.guardians?.map(g => g.id) || []
                        })
                      })
                      if (response.ok) {
                        await fetchFamilies()
                        setShowFamilyEditModal(false)
                        setEditingFamily(null)
                        alert('Family updated successfully!')
                      } else {
                        const data = await response.json()
                        alert(data.message || 'Failed to update family')
                      }
                    } catch (error) {
                      console.error('Error updating family:', error)
                      alert('Failed to update family')
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member View Modal */}
      <AnimatePresence>
        {showMemberViewModal && viewingMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMemberViewModal(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Member Details</h3>
                <button
                  onClick={() => setShowMemberViewModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* User Information */}
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4 text-lg">User Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">First Name:</span>
                      <div className="text-white font-medium">{viewingMember.guardian.fullName.split(' ')[0]}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Last Name:</span>
                      <div className="text-white font-medium">{viewingMember.guardian.fullName.split(' ').slice(1).join(' ')}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Email:</span>
                      <div className="text-white font-medium">{viewingMember.guardian.email || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Phone:</span>
                      <div className="text-white font-medium">{viewingMember.guardian.phone || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">User ID:</span>
                      <div className="text-white font-medium">{viewingMember.guardian.id}</div>
                    </div>
                  </div>
                </div>

                {/* Family Information */}
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4 text-lg">Family Information</h4>
                  <div className="text-sm text-gray-300 space-y-2">
                    <div>Family ID: {viewingMember.family.id}</div>
                    {viewingMember.family.family_name && (
                      <div>Family Name: {viewingMember.family.family_name}</div>
                    )}
                    <div>Created: {new Date(viewingMember.family.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Family Members */}
                {viewingMember.family.athletes && viewingMember.family.athletes.length > 0 && (
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-4 text-lg">Family Members ({viewingMember.family.athletes.length})</h4>
                    <div className="space-y-3">
                      {viewingMember.family.athletes.map((athlete) => (
                        <div key={athlete.id} className="bg-gray-600 p-4 rounded">
                          <div 
                            className="flex justify-between items-center cursor-pointer"
                            onClick={() => setExpandedViewFamilyMemberId(expandedViewFamilyMemberId === athlete.id ? null : athlete.id)}
                          >
                            <div className="flex-1">
                              <div className="text-white font-medium text-lg">
                                {athlete.first_name} {athlete.last_name}
                              </div>
                              <div className="text-gray-300 text-sm mt-1">
                                Date of Birth: {athlete.date_of_birth ? new Date(athlete.date_of_birth).toLocaleDateString() : 'N/A'}
                                {athlete.age !== undefined && ` (Age ${athlete.age})`}
                              </div>
                            </div>
                            <button className="text-gray-400 hover:text-white">
                              {expandedViewFamilyMemberId === athlete.id ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {expandedViewFamilyMemberId === athlete.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-4 pt-4 border-t border-gray-500"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                {athlete.user_id && (
                                  <div>
                                    <span className="text-gray-400">User ID:</span>
                                    <div className="text-white">{athlete.user_id}</div>
                                  </div>
                                )}
                                {athlete.medical_notes && (
                                  <div className="md:col-span-2">
                                    <span className="text-gray-400">Medical Notes:</span>
                                    <div className="text-white mt-1">{athlete.medical_notes}</div>
                                  </div>
                                )}
                                {athlete.internal_flags && (
                                  <div className="md:col-span-2">
                                    <span className="text-gray-400">Internal Flags:</span>
                                    <div className="text-white mt-1">{athlete.internal_flags}</div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Guardians */}
                {viewingMember.family.guardians && viewingMember.family.guardians.length > 1 && (
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-4 text-lg">Other Guardians ({viewingMember.family.guardians.length - 1})</h4>
                    <div className="space-y-3">
                      {viewingMember.family.guardians
                        .filter(g => g.id !== viewingMember.guardian.id)
                        .map((guardian) => (
                          <div key={guardian.id} className="bg-gray-600 p-3 rounded">
                            <div className="text-white font-medium">{guardian.fullName}</div>
                            <div className="text-gray-300 text-sm mt-1">{guardian.email}</div>
                            {guardian.phone && (
                              <div className="text-gray-300 text-sm">{guardian.phone}</div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowMemberViewModal(false)
                    handleEditMember(viewingMember.guardian, viewingMember.family)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Edit Member
                </button>
                <button
                  onClick={() => setShowMemberViewModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member Edit Modal */}
      <AnimatePresence>
        {showMemberEditModal && editingMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMemberEditModal(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Edit Member</h3>
                <button
                  onClick={() => setShowMemberEditModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* User Information - Editable Form */}
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4 text-lg">User Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                      <input
                        type="text"
                        value={editingMemberData.firstName}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, firstName: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                      <input
                        type="text"
                        value={editingMemberData.lastName}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, lastName: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                      <input
                        type="email"
                        value={editingMemberData.email}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, email: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Phone *</label>
                      <input
                        type="tel"
                        value={editingMemberData.phone}
                        onChange={(e) => {
                          const formatted = formatPhoneNumber(e.target.value)
                          setEditingMemberData({ ...editingMemberData, phone: formatted })
                        }}
                        placeholder="###-###-####"
                        maxLength={12}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        autoComplete="off"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Street</label>
                      <input
                        type="text"
                        value={editingMemberData.addressStreet}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, addressStreet: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        placeholder="Street address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">City</label>
                      <input
                        type="text"
                        value={editingMemberData.addressCity}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, addressCity: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">State</label>
                      <input
                        type="text"
                        value={editingMemberData.addressState}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, addressState: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        placeholder="State"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Zip</label>
                      <input
                        type="text"
                        value={editingMemberData.addressZip}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, addressZip: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        placeholder="ZIP code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Username *</label>
                      <input
                        type="text"
                        value={editingMemberData.username}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, username: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Password</label>
                      <input
                        type="password"
                        value={editingMemberData.password}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, password: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        placeholder="Leave blank to keep current password"
                        minLength={6}
                        autoComplete="new-password"
                      />
                      <p className="text-xs text-gray-400 mt-1">Leave blank to keep current password</p>
                    </div>
                  </div>
                </div>

                {/* Family Members - Editable */}
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4 text-lg">Family Members ({editingFamilyMembers.length})</h4>
                  <div className="space-y-4">
                    {editingFamilyMembers.map((member, index) => (
                      <div key={member.id || index} className="bg-gray-600 p-4 rounded">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="text-white font-medium">
                            {member.firstName} {member.lastName}
                          </h5>
                          <button
                            onClick={() => setExpandedFamilyMemberId(expandedFamilyMemberId === member.id ? null : (member.id || index))}
                            className="text-gray-400 hover:text-white"
                          >
                            {expandedFamilyMemberId === (member.id || index) ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        {expandedFamilyMemberId === (member.id || index) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-500"
                          >
                            <div>
                              <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                              <input
                                type="text"
                                value={member.firstName}
                                onChange={(e) => {
                                  const updated = [...editingFamilyMembers]
                                  updated[index].firstName = e.target.value
                                  setEditingFamilyMembers(updated)
                                }}
                                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                              <input
                                type="text"
                                value={member.lastName}
                                onChange={(e) => {
                                  const updated = [...editingFamilyMembers]
                                  updated[index].lastName = e.target.value
                                  setEditingFamilyMembers(updated)
                                }}
                                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-300 mb-2">Date of Birth *</label>
                              <input
                                type="date"
                                value={member.dateOfBirth}
                                onChange={(e) => {
                                  const updated = [...editingFamilyMembers]
                                  updated[index].dateOfBirth = e.target.value
                                  setEditingFamilyMembers(updated)
                                }}
                                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                required
                              />
                            </div>
                            {(() => {
                              const birthDate = member.dateOfBirth ? new Date(member.dateOfBirth) : null
                              const today = new Date()
                              const age = birthDate ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0) : null
                              const isAdult = age !== null && age >= 18
                              
                              return (
                                <>
                                  {isAdult && (
                                    <>
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                                        <input
                                          type="email"
                                          value={member.email}
                                          onChange={(e) => {
                                            const updated = [...editingFamilyMembers]
                                            updated[index].email = e.target.value
                                            setEditingFamilyMembers(updated)
                                          }}
                                          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-300 mb-2">Username *</label>
                                        <input
                                          type="text"
                                          value={member.username}
                                          onChange={(e) => {
                                            const updated = [...editingFamilyMembers]
                                            updated[index].username = e.target.value
                                            setEditingFamilyMembers(updated)
                                          }}
                                          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-300 mb-2">Password</label>
                                        <input
                                          type="password"
                                          value={member.password}
                                          onChange={(e) => {
                                            const updated = [...editingFamilyMembers]
                                            updated[index].password = e.target.value
                                            setEditingFamilyMembers(updated)
                                          }}
                                          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                          placeholder="Leave blank to keep current"
                                          minLength={6}
                                        />
                                      </div>
                                    </>
                                  )}
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Enrollment</label>
                                    <div className="space-y-3">
                                      {(member.enrollments || []).map((enrollment, enrollmentIndex) => {
                                        const selectedProgramIds = (member.enrollments || []).map(e => e.programId).filter(Boolean)
                                        return (
                                          <div key={enrollmentIndex} className="bg-gray-600 p-4 rounded border border-gray-500">
                                            <div className="flex justify-between items-center mb-3">
                                              <span className="text-white font-medium">Enrollment {enrollmentIndex + 1}</span>
                                              <button
                                                type="button"
                                              onClick={() => {
                                                const updated = [...editingFamilyMembers]
                                                if (!updated[index].enrollments) {
                                                  updated[index].enrollments = []
                                                }
                                                updated[index].enrollments = updated[index].enrollments.filter((_, i) => i !== enrollmentIndex)
                                                setEditingFamilyMembers(updated)
                                              }}
                                                className="text-red-400 hover:text-red-300"
                                              >
                                                <X className="w-4 h-4" />
                                              </button>
                                            </div>
                                            <div className="space-y-3">
                                              <div>
                                                <label className="block text-sm font-semibold text-gray-300 mb-2">Class *</label>
                                                <select
                                                  value={enrollment.programId || ''}
                                                  onChange={(e) => {
                                                    const updated = [...editingFamilyMembers]
                                                    if (!updated[index].enrollments) {
                                                      updated[index].enrollments = []
                                                    }
                                                    const programId = e.target.value ? parseInt(e.target.value) : null
                                                    const selectedProgram = programs.find(p => p.id === programId)
                                                    updated[index].enrollments[enrollmentIndex].programId = programId
                                                    updated[index].enrollments[enrollmentIndex].programName = selectedProgram?.displayName || ''
                                                    setEditingFamilyMembers(updated)
                                                  }}
                                                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                                  required
                                                >
                                                  <option value="">Select a class</option>
                                                  {getSimplifiedGymnasticsPrograms(programs).map((program) => {
                                                    const isSelected = selectedProgramIds.includes(program.id) && (member.enrollments || [])[enrollmentIndex].programId !== program.id
                                                    return (
                                                      <option 
                                                        key={program.id} 
                                                        value={program.id}
                                                        disabled={isSelected}
                                                      >
                                                        {program.displayName}
                                                      </option>
                                                    )
                                                  })}
                                                </select>
                                              </div>
                                              {enrollment.programId && (
                                                <>
                                                  <div>
                                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Days Per Week *</label>
                                                    <select
                                                      value={enrollment.daysPerWeek}
                                                      onChange={(e) => {
                                                        const updated = [...editingFamilyMembers]
                                                        if (!updated[index].enrollments) {
                                                          updated[index].enrollments = []
                                                        }
                                                        const daysPerWeek = parseInt(e.target.value)
                                                        updated[index].enrollments[enrollmentIndex].daysPerWeek = daysPerWeek
                                                        // Reset selected days if days per week changed
                                                        if (updated[index].enrollments[enrollmentIndex].selectedDays.length !== daysPerWeek) {
                                                          updated[index].enrollments[enrollmentIndex].selectedDays = []
                                                        }
                                                        setEditingFamilyMembers(updated)
                                                      }}
                                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                                      required
                                                    >
                                                      <option value={1}>1 day</option>
                                                      <option value={2}>2 days</option>
                                                      <option value={3}>3 days</option>
                                                      <option value={4}>4 days</option>
                                                      <option value={5}>5 days</option>
                                                      <option value={6}>6 days</option>
                                                      <option value={7}>7 days</option>
                                                    </select>
                                                  </div>
                                                  <div>
                                                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                                                      Select Days * ({enrollment.selectedDays.length} of {enrollment.daysPerWeek} selected)
                                                    </label>
                                                    <div className="grid grid-cols-7 gap-2">
                                                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                                        <button
                                                          key={day}
                                                          type="button"
                                                          onClick={() => {
                                                            const updated = [...editingFamilyMembers]
                                                            if (!updated[index].enrollments) {
                                                              updated[index].enrollments = []
                                                            }
                                                            const dayIndex = updated[index].enrollments[enrollmentIndex].selectedDays.indexOf(day)
                                                            if (dayIndex > -1) {
                                                              updated[index].enrollments[enrollmentIndex].selectedDays.splice(dayIndex, 1)
                                                            } else {
                                                              if (updated[index].enrollments[enrollmentIndex].selectedDays.length < updated[index].enrollments[enrollmentIndex].daysPerWeek) {
                                                                updated[index].enrollments[enrollmentIndex].selectedDays.push(day)
                                                              } else {
                                                                alert(`Please select exactly ${updated[index].enrollments[enrollmentIndex].daysPerWeek} day(s)`)
                                                                return
                                                              }
                                                            }
                                                            setEditingFamilyMembers(updated)
                                                          }}
                                                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                                            enrollment.selectedDays.includes(day)
                                                              ? 'bg-vortex-red text-white'
                                                              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                          }`}
                                                        >
                                                          {day.substring(0, 3)}
                                                        </button>
                                                      ))}
                                                    </div>
                                                  </div>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...editingFamilyMembers]
                                          if (!updated[index].enrollments) {
                                            updated[index].enrollments = []
                                          }
                                          updated[index].enrollments = [...(updated[index].enrollments || []), {
                                            programId: null,
                                            programName: '',
                                            daysPerWeek: 1,
                                            selectedDays: []
                                          }]
                                          setEditingFamilyMembers(updated)
                                        }}
                                        className="w-full px-4 py-2 bg-gray-600 text-white rounded border border-gray-500 hover:bg-gray-500 flex items-center justify-center gap-2"
                                      >
                                        <Plus className="w-4 h-4" />
                                        Add Enrollment
                                      </button>
                                    </div>
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Medical Notes</label>
                                    <textarea
                                      value={member.medicalNotes}
                                      onChange={(e) => {
                                        const updated = [...editingFamilyMembers]
                                        updated[index].medicalNotes = e.target.value
                                        setEditingFamilyMembers(updated)
                                      }}
                                      rows={2}
                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Internal Flags</label>
                                    <input
                                      type="text"
                                      value={member.internalFlags}
                                      onChange={(e) => {
                                        const updated = [...editingFamilyMembers]
                                        updated[index].internalFlags = e.target.value
                                        setEditingFamilyMembers(updated)
                                      }}
                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                    />
                                  </div>
                                </>
                              )
                            })()}
                          </motion.div>
                        )}
                      </div>
                    ))}
                    
                    {/* Add New Family Member Section */}
                    <div className="bg-gray-600 p-4 rounded border-2 border-dashed border-gray-500">
                      <h5 className="text-white font-medium mb-4">Add New Family Member</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">First Name</label>
                          <input
                            type="text"
                            value={newFamilyMemberInEdit.firstName}
                            onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, firstName: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name</label>
                          <input
                            type="text"
                            value={newFamilyMemberInEdit.lastName}
                            onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, lastName: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Date of Birth</label>
                          <input
                            type="date"
                            value={newFamilyMemberInEdit.dateOfBirth}
                            onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, dateOfBirth: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                          />
                        </div>
                        {(() => {
                          const birthDate = newFamilyMemberInEdit.dateOfBirth ? new Date(newFamilyMemberInEdit.dateOfBirth) : null
                          const today = new Date()
                          const age = birthDate ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0) : null
                          const isAdult = age !== null && age >= 18
                          const existingAddresses = Array.from(new Set([
                            combineAddress(editingMemberData.addressStreet, editingMemberData.addressCity, editingMemberData.addressState, editingMemberData.addressZip),
                            // Get addresses from family members if available
                            ...editingFamilyMembers.map(() => {
                              // Address would come from user accounts if available
                              return ''
                            }).filter(Boolean)
                          ])).filter(Boolean)
                          
                          return (
                            <>
                              {isAdult && (
                                <>
                                  <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                                    <input
                                      type="email"
                                      value={newFamilyMemberInEdit.email}
                                      onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, email: e.target.value })}
                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Username *</label>
                                    <input
                                      type="text"
                                      value={newFamilyMemberInEdit.username}
                                      onChange={async (e) => {
                                        const username = e.target.value
                                        if (!username) {
                                          const generated = await generateUsername(newFamilyMemberInEdit.firstName, newFamilyMemberInEdit.lastName)
                                          setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, username: generated })
                                        } else {
                                          setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, username })
                                        }
                                      }}
                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                                    <input
                                      type="password"
                                      value={newFamilyMemberInEdit.password}
                                      onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, password: e.target.value })}
                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                      required
                                      minLength={6}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Default: vortex</p>
                                  </div>
                                </>
                              )}
                              {existingAddresses.length > 0 && (
                                <div className="md:col-span-2">
                                  <label className="block text-sm font-semibold text-gray-300 mb-2">Mailing Address (Select from family or enter new)</label>
                                  <select
                                    value={newFamilyMemberInEdit.address}
                                    onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, address: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500 mb-2"
                                  >
                                    <option value="">Select existing address or enter new below</option>
                                    {existingAddresses.map((addr, idx) => (
                                      <option key={idx} value={addr}>{addr}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    value={newFamilyMemberInEdit.address}
                                    onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, address: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                    placeholder="Or enter new address"
                                  />
                                </div>
                              )}
                            </>
                          )
                        })()}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Enrollment</label>
                          <div className="space-y-3">
                            {newFamilyMemberInEdit.enrollments && newFamilyMemberInEdit.enrollments.length > 0 && newFamilyMemberInEdit.enrollments.map((enrollment, enrollmentIndex) => {
                              const selectedProgramIds = newFamilyMemberInEdit.enrollments.map(e => e.programId).filter(Boolean)
                              return (
                                <div key={enrollmentIndex} className="bg-gray-600 p-4 rounded border border-gray-500">
                                  <div className="flex justify-between items-center mb-3">
                                    <span className="text-white font-medium">Enrollment {enrollmentIndex + 1}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNewFamilyMemberInEdit({
                                          ...newFamilyMemberInEdit,
                                          enrollments: newFamilyMemberInEdit.enrollments.filter((_, i) => i !== enrollmentIndex)
                                        })
                                      }}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="space-y-3">
                                    <div>
                                      <label className="block text-sm font-semibold text-gray-300 mb-2">Class *</label>
                                      <select
                                        value={enrollment.programId || ''}
                                        onChange={(e) => {
                                          const programId = e.target.value ? parseInt(e.target.value) : null
                                          const selectedProgram = programs.find(p => p.id === programId)
                                          const updatedEnrollments = [...newFamilyMemberInEdit.enrollments]
                                          updatedEnrollments[enrollmentIndex].programId = programId
                                          updatedEnrollments[enrollmentIndex].programName = selectedProgram?.displayName || ''
                                          setNewFamilyMemberInEdit({
                                            ...newFamilyMemberInEdit,
                                            enrollments: updatedEnrollments
                                          })
                                        }}
                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                        required
                                      >
                                        <option value="">Select a class</option>
                                        {getSimplifiedGymnasticsPrograms(programs).map((program) => {
                                          const isSelected = selectedProgramIds.includes(program.id) && (newFamilyMemberInEdit.enrollments || [])[enrollmentIndex].programId !== program.id
                                          return (
                                            <option 
                                              key={program.id} 
                                              value={program.id}
                                              disabled={isSelected}
                                            >
                                              {program.displayName}
                                            </option>
                                          )
                                        })}
                                      </select>
                                    </div>
                                    {enrollment.programId && (
                                      <>
                                        <div>
                                          <label className="block text-sm font-semibold text-gray-300 mb-2">Days Per Week *</label>
                                          <select
                                            value={enrollment.daysPerWeek}
                                            onChange={(e) => {
                                              const daysPerWeek = parseInt(e.target.value)
                                              const updatedEnrollments = [...newFamilyMemberInEdit.enrollments]
                                              updatedEnrollments[enrollmentIndex].daysPerWeek = daysPerWeek
                                              // Reset selected days if days per week changed
                                              if (updatedEnrollments[enrollmentIndex].selectedDays.length !== daysPerWeek) {
                                                updatedEnrollments[enrollmentIndex].selectedDays = []
                                              }
                                              setNewFamilyMemberInEdit({
                                                ...newFamilyMemberInEdit,
                                                enrollments: updatedEnrollments
                                              })
                                            }}
                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                            required
                                          >
                                            <option value={1}>1 day</option>
                                            <option value={2}>2 days</option>
                                            <option value={3}>3 days</option>
                                            <option value={4}>4 days</option>
                                            <option value={5}>5 days</option>
                                            <option value={6}>6 days</option>
                                            <option value={7}>7 days</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                                            Select Days * ({enrollment.selectedDays.length} of {enrollment.daysPerWeek} selected)
                                          </label>
                                          <div className="grid grid-cols-7 gap-2">
                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                              <button
                                                key={day}
                                                type="button"
                                                onClick={() => {
                                                  const dayIndex = enrollment.selectedDays.indexOf(day)
                                                  const updatedEnrollments = [...newFamilyMemberInEdit.enrollments]
                                                  if (dayIndex > -1) {
                                                    updatedEnrollments[enrollmentIndex].selectedDays = updatedEnrollments[enrollmentIndex].selectedDays.filter(d => d !== day)
                                                  } else {
                                                    if (updatedEnrollments[enrollmentIndex].selectedDays.length < updatedEnrollments[enrollmentIndex].daysPerWeek) {
                                                      updatedEnrollments[enrollmentIndex].selectedDays.push(day)
                                                    } else {
                                                      alert(`Please select exactly ${updatedEnrollments[enrollmentIndex].daysPerWeek} day(s)`)
                                                      return
                                                    }
                                                  }
                                                  setNewFamilyMemberInEdit({
                                                    ...newFamilyMemberInEdit,
                                                    enrollments: updatedEnrollments
                                                  })
                                                }}
                                                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                                  enrollment.selectedDays.includes(day)
                                                    ? 'bg-vortex-red text-white'
                                                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                }`}
                                              >
                                                {day.substring(0, 3)}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                            <button
                              type="button"
                              onClick={() => {
                                if (!newFamilyMemberInEdit.enrollments) {
                                  setNewFamilyMemberInEdit({
                                    ...newFamilyMemberInEdit,
                                    enrollments: []
                                  })
                                }
                                setNewFamilyMemberInEdit({
                                  ...newFamilyMemberInEdit,
                                  enrollments: [
                                    ...(newFamilyMemberInEdit.enrollments || []),
                                    {
                                      programId: null,
                                      programName: '',
                                      daysPerWeek: 1,
                                      selectedDays: []
                                    }
                                  ]
                                })
                              }}
                              className="w-full px-4 py-2 bg-gray-600 text-white rounded border border-gray-500 hover:bg-gray-500 flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Add Enrollment
                            </button>
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Medical Notes</label>
                          <textarea
                            value={newFamilyMemberInEdit.medicalNotes}
                            onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, medicalNotes: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <button
                            onClick={() => {
                              if (!newFamilyMemberInEdit.firstName || !newFamilyMemberInEdit.lastName || !newFamilyMemberInEdit.dateOfBirth) {
                                alert('Please fill in first name, last name, and date of birth')
                                return
                              }
                              const birthDate = new Date(newFamilyMemberInEdit.dateOfBirth)
                              const today = new Date()
                              const age = today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
                              if (age >= 18 && (!newFamilyMemberInEdit.email || !newFamilyMemberInEdit.username)) {
                                alert('Adults must have email and username')
                                return
                              }
                              // Validate enrollments
                              if (newFamilyMemberInEdit.enrollments && newFamilyMemberInEdit.enrollments.length > 0) {
                                for (const enrollment of newFamilyMemberInEdit.enrollments) {
                                  if (!enrollment.programId) {
                                    alert('Please select a class for all enrollments')
                                    return
                                  }
                                  if (enrollment.selectedDays.length !== enrollment.daysPerWeek) {
                                    alert(`Please select exactly ${enrollment.daysPerWeek} day(s) for ${enrollment.programName || 'enrollment'}`)
                                    return
                                  }
                                }
                              }
                              setEditingFamilyMembers([...editingFamilyMembers, {
                                firstName: newFamilyMemberInEdit.firstName,
                                lastName: newFamilyMemberInEdit.lastName,
                                dateOfBirth: newFamilyMemberInEdit.dateOfBirth,
                                email: newFamilyMemberInEdit.email,
                                username: newFamilyMemberInEdit.username,
                                password: newFamilyMemberInEdit.password,
                                medicalNotes: newFamilyMemberInEdit.medicalNotes,
                                internalFlags: newFamilyMemberInEdit.internalFlags,
                                enrollments: newFamilyMemberInEdit.enrollments || [],
                                userId: null
                              }])
                              setNewFamilyMemberInEdit({
                                firstName: '',
                                lastName: '',
                                dateOfBirth: '',
                                email: '',
                                username: '',
                                password: 'vortex',
                                medicalNotes: '',
                                internalFlags: '',
                                enrollments: [],
                                address: ''
                              })
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                          >
                            Finished with Member
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowMemberEditModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMemberEdit}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Athlete Creation Form */}
      <AnimatePresence>
        {showAthleteForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAthleteForm(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Create New Athlete</h3>
                <button
                  onClick={() => setShowAthleteForm(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Family *</label>
                  <select
                    value={athleteFormData.familyId || ''}
                    onChange={(e) => setAthleteFormData({ ...athleteFormData, familyId: parseInt(e.target.value) || null })}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    required
                  >
                    <option value="">Select a Family</option>
                    {families.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.family_name || `${family.primary_name || 'Unnamed'} Family`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                    <input
                      type="text"
                      value={athleteFormData.firstName}
                      onChange={(e) => setAthleteFormData({ ...athleteFormData, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={athleteFormData.lastName}
                      onChange={(e) => setAthleteFormData({ ...athleteFormData, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Date of Birth *</label>
                    <input
                      type="date"
                      value={athleteFormData.dateOfBirth}
                      onChange={(e) => setAthleteFormData({ ...athleteFormData, dateOfBirth: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Medical Notes</label>
                  <textarea
                    value={athleteFormData.medicalNotes}
                    onChange={(e) => setAthleteFormData({ ...athleteFormData, medicalNotes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    placeholder="Any medical conditions, allergies, or special needs..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Internal Flags</label>
                  <input
                    type="text"
                    value={athleteFormData.internalFlags}
                    onChange={(e) => setAthleteFormData({ ...athleteFormData, internalFlags: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    placeholder="Internal notes or flags (admin only)"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleCreateAthlete}
                    className="flex-1 bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    Create Athlete
                  </button>
                  <button
                    onClick={() => setShowAthleteForm(false)}
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
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

                {/* Tags Section */}
                <div className="border-t border-gray-700 pt-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-4">Tags</label>
                  
                  <div className="space-y-4">
                    {/* Tag Type Selection */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Tag Type *</label>
                      <select
                        value={eventFormData.tagType || 'all_classes_and_parents'}
                        onChange={(e) => {
                          const newTagType = e.target.value as Event['tagType']
                          setEventFormData({
                            ...eventFormData,
                            tagType: newTagType,
                            // Reset dependent fields when changing tag type
                            tagClassIds: newTagType === 'specific_classes' ? (eventFormData.tagClassIds || []) : [],
                            tagCategoryIds: newTagType === 'specific_categories' ? (eventFormData.tagCategoryIds || []) : [],
                            tagAllParents: newTagType === 'all_parents',
                            tagBoosters: newTagType === 'boosters',
                            tagVolunteers: newTagType === 'volunteers'
                          })
                        }}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      >
                        <option value="all_classes_and_parents">All Classes and Parents (Default)</option>
                        <option value="specific_classes">Specific Classes</option>
                        <option value="specific_categories">Specific Categories</option>
                        <option value="all_parents">All Parents</option>
                        <option value="boosters">Boosters (Not Applicable Yet)</option>
                        <option value="volunteers">Volunteers (Not Applicable Yet)</option>
                      </select>
                    </div>

                    {/* Specific Classes Selection */}
                    {eventFormData.tagType === 'specific_classes' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Select Classes</label>
                        <div className="max-h-48 overflow-y-auto border border-gray-600 rounded bg-gray-700 p-2 space-y-2">
                          {programs.filter(p => !p.archived && p.isActive).map((program) => (
                            <label key={program.id} className="flex items-center space-x-2 text-white cursor-pointer hover:bg-gray-600 p-2 rounded">
                              <input
                                type="checkbox"
                                checked={eventFormData.tagClassIds?.includes(program.id) || false}
                                onChange={(e) => {
                                  const currentIds = eventFormData.tagClassIds || []
                                  if (e.target.checked) {
                                    setEventFormData({
                                      ...eventFormData,
                                      tagClassIds: [...currentIds, program.id]
                                    })
                                  } else {
                                    setEventFormData({
                                      ...eventFormData,
                                      tagClassIds: currentIds.filter(id => id !== program.id)
                                    })
                                  }
                                }}
                                className="w-4 h-4 text-vortex-red bg-gray-600 border-gray-500 rounded focus:ring-vortex-red"
                              />
                              <span className="text-sm">{program.displayName}</span>
                            </label>
                          ))}
                          {programs.filter(p => !p.archived && p.isActive).length === 0 && (
                            <div className="text-gray-400 text-sm p-2">No active classes available</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Specific Categories Selection */}
                    {eventFormData.tagType === 'specific_categories' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Select Categories</label>
                        <div className="max-h-48 overflow-y-auto border border-gray-600 rounded bg-gray-700 p-2 space-y-2 mb-4">
                          {categories.filter(c => !c.archived).map((category) => (
                            <label key={category.id} className="flex items-center space-x-2 text-white cursor-pointer hover:bg-gray-600 p-2 rounded">
                              <input
                                type="checkbox"
                                checked={eventFormData.tagCategoryIds?.includes(category.id) || false}
                                onChange={(e) => {
                                  const currentIds = eventFormData.tagCategoryIds || []
                                  if (e.target.checked) {
                                    setEventFormData({
                                      ...eventFormData,
                                      tagCategoryIds: [...currentIds, category.id]
                                    })
                                  } else {
                                    setEventFormData({
                                      ...eventFormData,
                                      tagCategoryIds: currentIds.filter(id => id !== category.id)
                                    })
                                  }
                                }}
                                className="w-4 h-4 text-vortex-red bg-gray-600 border-gray-500 rounded focus:ring-vortex-red"
                              />
                              <span className="text-sm">{category.displayName}</span>
                            </label>
                          ))}
                          {categories.filter(c => !c.archived).length === 0 && (
                            <div className="text-gray-400 text-sm p-2">No active categories available</div>
                          )}
                        </div>
                        
                        {/* Show classes for selected categories */}
                        {eventFormData.tagCategoryIds && eventFormData.tagCategoryIds.length > 0 && (
                          <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">
                              Classes in Selected Categories (Auto-populated)
                            </label>
                            <div className="max-h-32 overflow-y-auto border border-gray-600 rounded bg-gray-700 p-2 space-y-1">
                              {programs
                                .filter(p => 
                                  !p.archived && 
                                  p.isActive && 
                                  eventFormData.tagCategoryIds?.includes(p.categoryId || -1)
                                )
                                .map((program) => (
                                  <div key={program.id} className="text-sm text-gray-300 p-1">
                                    • {program.displayName}
                                  </div>
                                ))}
                              {programs.filter(p => 
                                !p.archived && 
                                p.isActive && 
                                eventFormData.tagCategoryIds?.includes(p.categoryId || -1)
                              ).length === 0 && (
                                <div className="text-gray-400 text-sm p-2">No classes found in selected categories</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* All Parents, Boosters, Volunteers - these are handled by tagType selection */}
                    {(eventFormData.tagType === 'all_parents' || eventFormData.tagType === 'boosters' || eventFormData.tagType === 'volunteers') && (
                      <div className="bg-gray-700 p-3 rounded border border-gray-600">
                        <p className="text-sm text-gray-300">
                          {eventFormData.tagType === 'all_parents' && 'This event will be visible to all parents.'}
                          {eventFormData.tagType === 'boosters' && 'Boosters tagging is not applicable yet.'}
                          {eventFormData.tagType === 'volunteers' && 'Volunteers tagging is not applicable yet.'}
                        </p>
                      </div>
                    )}
                  </div>
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
