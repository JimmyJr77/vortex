import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  CheckCircle,
  MapPin,
  Users,
  Award,
  Trophy,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { getApiUrl } from '../../utils/api'
import { parseDateOnly, formatDateForDisplay } from '../../utils/dateUtils'
import EventAttachedSignup from '../EventAttachedSignup'

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
  images?: string[]
  address?: string
  schedulingFormId?: number | null
  schedulingFormTitle?: string | null
}

function EventImageSlider({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (images.length === 0) return null

  if (images.length === 1) {
    return (
      <div className="w-full">
        <img
          src={images[0]}
          alt="Event"
          className="w-full h-64 md:h-96 object-cover rounded-lg"
        />
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <div className="relative overflow-hidden rounded-lg">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((image, index) => (
            <div key={index} className="w-full flex-shrink-0">
              <img
                src={image}
                alt={`Event ${index + 1}`}
                className="w-full h-64 md:h-96 object-cover"
              />
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)}
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
        aria-label="Previous image"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => setCurrentIndex((prev) => (prev + 1) % images.length)}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
        aria-label="Next image"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
        {images.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentIndex ? 'bg-white' : 'bg-white/50'
            }`}
            aria-label={`Go to image ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

const ReadBoardEventsTab = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [eventView, setEventView] = useState<'upcoming' | 'past'>('upcoming')
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setEventsLoading(true)
        setEventsError(null)
        const response = await fetch(`${getApiUrl()}/api/events`)
        if (!response.ok) {
          throw new Error(`Failed to fetch events: ${response.status}`)
        }
        const data = await response.json()

        if (data.success) {
          const events = data.data.map((event: Event & { startDate: string; endDate?: string }) => {
            const startDate = parseDateOnly(event.startDate)
            const endDate = event.endDate ? parseDateOnly(event.endDate) : undefined

            return {
              ...event,
              startDate: startDate || new Date(event.startDate),
              endDate: endDate || (event.endDate ? new Date(event.endDate) : undefined),
              datesAndTimes: Array.isArray(event.datesAndTimes)
                ? event.datesAndTimes.map((dt) => {
                    const parsedDate = parseDateOnly(dt.date as unknown as string)
                    return {
                      ...dt,
                      date: parsedDate || new Date(dt.date as unknown as string),
                    }
                  })
                : [],
              keyDetails: Array.isArray(event.keyDetails) ? event.keyDetails : [],
              images: Array.isArray(event.images) ? event.images : [],
            }
          })
          setAllEvents(events)
        }
      } catch (error) {
        console.error('Error fetching events:', error)
        setEventsError(error instanceof Error ? error.message : 'Unable to fetch events')
      } finally {
        setEventsLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const filteredEvents = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const upcomingEvents = allEvents
      .filter((event) => {
        const eventEndDate = event.endDate || event.startDate
        const eventEnd = new Date(eventEndDate)
        eventEnd.setHours(0, 0, 0, 0)
        return eventEnd >= today
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

    const pastEvents = allEvents
      .filter((event) => {
        const eventEndDate = event.endDate || event.startDate
        const eventEnd = new Date(eventEndDate)
        eventEnd.setHours(0, 0, 0, 0)
        return eventEnd < today
      })
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())

    const currentEvents = eventView === 'upcoming' ? upcomingEvents : pastEvents

    return currentEvents.filter((event) => {
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      const searchableText = [
        event.eventName,
        event.shortDescription,
        event.longDescription,
        event.address || '',
        ...(event.keyDetails || []),
      ]
        .join(' ')
        .toLowerCase()
      return searchableText.includes(query)
    })
  }, [allEvents, eventView, searchQuery])

  const formatDateRange = (start: Date | string, end?: Date | string) => {
    const startStr =
      start instanceof Date
        ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
        : start
    const endStr =
      end instanceof Date
        ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
        : end

    if (!endStr || startStr === endStr) {
      return formatDateForDisplay(startStr)
    }
    return `${formatDateForDisplay(startStr)} - ${formatDateForDisplay(endStr)}`
  }

  const formatDateTimeEntry = (entry: DateTimeEntry) => {
    const dateStr =
      entry.date instanceof Date
        ? formatDateForDisplay(
            `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, '0')}-${String(entry.date.getDate()).padStart(2, '0')}`,
          )
        : formatDateForDisplay(entry.date as unknown as string)

    if (entry.allDay) return `${dateStr}: All Day Event`
    if (entry.startTime && entry.endTime) return `${dateStr}: ${entry.startTime} - ${entry.endTime}`
    if (entry.startTime) return `${dateStr}: ${entry.startTime}`
    if (entry.description) return `${dateStr}: ${entry.description}`
    return dateStr
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

  return (
    <>
      <section className="section-padding bg-gray-50 pt-12">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search events by name, description, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors text-lg"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-gray-50 pt-0">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center justify-center gap-4 mb-12">
              <button
                type="button"
                onClick={() => setEventView(eventView === 'upcoming' ? 'past' : 'upcoming')}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Previous view"
              >
                <ChevronLeft className="w-6 h-6 text-vortex-red" />
              </button>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-black text-center">
                {eventView === 'upcoming' ? 'Upcoming' : 'Past'}{' '}
                <span className="text-vortex-red">Events</span>
              </h2>
              <button
                type="button"
                onClick={() => setEventView(eventView === 'upcoming' ? 'past' : 'upcoming')}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Next view"
              >
                <ChevronRight className="w-6 h-6 text-vortex-red" />
              </button>
            </div>

            {eventsLoading ? (
              <div className="text-center py-12">
                <p className="text-xl text-gray-600">Loading events...</p>
              </div>
            ) : eventsError ? (
              <div className="text-center py-12">
                <p className="text-xl text-red-600">Error loading events: {eventsError}</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl text-gray-600">
                  {searchQuery
                    ? `No events found matching "${searchQuery}"`
                    : 'No upcoming events at this time.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-w-4xl mx-auto">
                {filteredEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    className="flex items-start space-x-4 py-3 border-b border-gray-200 last:border-b-0"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.4 }}
                    viewport={{ once: true }}
                  >
                    <div className="flex-shrink-0 w-24 md:w-32">
                      <p className="text-sm md:text-base font-semibold text-vortex-red">
                        {formatDateRange(event.startDate, event.endDate)}
                      </p>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg md:text-xl font-display font-bold text-black mb-1">
                        {event.eventName}
                      </h3>
                      <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                        {event.shortDescription}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-8 text-center">
              Event <span className="text-vortex-red">Details</span>
            </h2>

            {eventsLoading ? (
              <div className="text-center py-12">
                <p className="text-xl text-gray-600">Loading events...</p>
              </div>
            ) : eventsError ? (
              <div className="text-center py-12">
                <p className="text-xl text-red-600">Error loading events: {eventsError}</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl text-gray-600">
                  {searchQuery
                    ? `No events found matching "${searchQuery}"`
                    : eventView === 'upcoming'
                      ? 'No upcoming events at this time.'
                      : 'No past events found.'}
                </p>
              </div>
            ) : (
              <div className="space-y-8 max-w-4xl mx-auto">
                {filteredEvents.map((event, index) => {
                  const Icon = getEventIcon(event.type || 'event')

                  return (
                    <motion.div
                      key={event.id}
                      className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border-2 border-gray-200"
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.6 }}
                      viewport={{ once: true }}
                    >
                      <div className="flex items-center space-x-4 mb-6">
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

                      <p className="text-gray-700 mb-6 leading-relaxed">{event.longDescription}</p>

                      {event.images && event.images.length > 0 && (
                        <div className="mb-6">
                          <EventImageSlider images={event.images} />
                        </div>
                      )}

                      {event.datesAndTimes && event.datesAndTimes.length > 0 && (
                        <div className="mb-6 space-y-3">
                          <h4 className="font-bold text-black mb-3">Dates & Times:</h4>
                          <ul className="space-y-2">
                            {event.datesAndTimes.map((entry, entryIndex) => (
                              <li
                                key={entryIndex}
                                className="flex items-start space-x-3 text-gray-700"
                              >
                                <Calendar className="w-4 h-4 text-vortex-red flex-shrink-0 mt-1" />
                                <span>{formatDateTimeEntry(entry)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {event.keyDetails && event.keyDetails.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-bold text-black mb-3">Key Details:</h4>
                          <ul className="space-y-2">
                            {event.keyDetails.map((detail, detailIndex) => (
                              <li key={detailIndex} className="flex items-start space-x-3">
                                <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0 mt-0.5" />
                                <span className="text-gray-700">{detail}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {event.address && (
                        <div className="mt-6">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-2 text-vortex-red hover:text-red-700 transition-colors"
                          >
                            <MapPin className="w-5 h-5" />
                            <span className="underline">{event.address}</span>
                          </a>
                        </div>
                      )}

                      {event.schedulingFormId != null && (
                        <EventAttachedSignup formId={event.schedulingFormId} />
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </>
  )
}

export default ReadBoardEventsTab
