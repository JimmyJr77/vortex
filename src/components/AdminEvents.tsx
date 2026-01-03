import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit2, Archive, X, Plus, Calendar, MapPin, CheckCircle, Award, Trophy, Search, ChevronUp, ChevronDown, Users } from 'lucide-react'
import { getApiUrl } from '../utils/api'

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

interface Program {
  id: number
  displayName: string
  archived?: boolean
  isActive?: boolean
  categoryId?: number | null
}

interface Category {
  id: number
  displayName: string
  archived?: boolean
}

interface AdminInfo {
  email: string
  name: string
  id?: number
}

interface AdminEventsProps {
  programs: Program[]
  categories: Category[]
  adminInfo: AdminInfo | null
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

export default function AdminEvents({ programs, categories, adminInfo }: AdminEventsProps) {
  const [error, setError] = useState<string | null>(null)
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
  const [showEditLog, setShowEditLog] = useState(false)
  const [editLog, setEditLog] = useState<Array<{ id: number; eventId: string | number; field: string; oldValue: string; newValue: string; changedBy: string; changedAt: string; adminName?: string; adminEmail?: string; createdAt?: string; changes?: Record<string, { oldValue: unknown; newValue: unknown }> }>>([])
  const [editLogLoading, setEditLogLoading] = useState(false)

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
        const parseLocalDate = (dateValue: string | Date | number | null | undefined): Date => {
          if (!dateValue) return new Date()
          if (dateValue instanceof Date) return dateValue
          
          // If it's already a Date object (from backend), use it
          if (typeof dateValue === 'object' && dateValue !== null && 'getTime' in dateValue) {
            return new Date(dateValue as Date)
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
        const eventsWithDates = data.data.map((event: Event & { startDate?: string | Date; endDate?: string | Date; datesAndTimes?: Array<{ date?: string | Date; [key: string]: unknown }> }) => {
          try {
            const parsedEvent = {
              ...event,
              archived: event.archived || false,
              startDate: parseLocalDate(event.startDate),
              endDate: event.endDate ? parseLocalDate(event.endDate) : undefined,
              datesAndTimes: Array.isArray(event.datesAndTimes) 
                ? event.datesAndTimes.map((dt: { date?: string | Date; [key: string]: unknown }) => {
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

  useEffect(() => {
    fetchEvents()
  }, [])

  return (
    <>
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
                  address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
                  tagType: 'all_classes_and_parents',
                  tagClassIds: [],
                  tagCategoryIds: [],
                  tagAllParents: false,
                  tagBoosters: false,
                  tagVolunteers: false
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
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : new Date(log.changedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {log.changes && Object.entries(log.changes).map(([field, change]) => {
                          const formatFieldName = (fieldName: string) => {
                            return fieldName
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/^./, str => str.toUpperCase())
                              .trim()
                          }
                          
                          const formatChangeValue = (val: unknown) => {
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
                                    {formatChangeValue(change.oldValue)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-400 text-xs mb-1 font-semibold">Updated:</p>
                                  <p className="text-white whitespace-pre-wrap break-words">
                                    {formatChangeValue(change.newValue)}
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
    </>
  )
}

