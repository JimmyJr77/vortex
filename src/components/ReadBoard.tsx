import { motion } from 'framer-motion'
import { Calendar, Clock, MapPin, Users, Award, Trophy, Zap, CheckCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getApiUrl } from '../utils/api'

interface DateTimeEntry {
  date: Date // Single date for this entry
  startTime?: string // Optional start time (e.g., "9:00 AM")
  endTime?: string // Optional end time (e.g., "3:00 PM")
  description?: string // Optional description (e.g., "All day", "Overnight", "Morning session")
  allDay?: boolean // Whether this is an all-day event
}

interface Event {
  id: string | number // Event ID for database linking
  eventName: string
  shortDescription: string // For Calendar of Events
  longDescription: string // For Event Details
  startDate: Date
  endDate?: Date
  type?: 'camp' | 'class' | 'event' | 'watch-party' // Optional for icon display
  datesAndTimes?: DateTimeEntry[] // Flexible dates and times configuration
  keyDetails?: string[] // Key Details for Event Details section
  images?: string[] // Event images
  address?: string // Address with map link capability
}

interface ClassGroup {
  category: string
  subcategories: {
    name: string
    classes: string[]
  }[]
}

interface ScheduledClass {
  name: string
  discipline: 'gymnastics' | 'ninja' | 'athleticism' | 'other'
}

interface ScheduleTimeSlot {
  time: string
  classes: ScheduledClass[]
}

interface DaySchedule {
  day: string
  timeSlots: ScheduleTimeSlot[]
}

interface MonthlySchedule {
  month: string
  schedule: DaySchedule[]
}

type TabType = 'classes' | 'schedule' | 'calendar'

const ReadBoard = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = January, 11 = December
  const [activeTab, setActiveTab] = useState<TabType>('classes')

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Schedule data by month
  const monthlySchedules: MonthlySchedule[] = [
    {
      month: 'January',
      schedule: [
        {
          day: 'Monday - Friday',
          timeSlots: [
            { 
              time: '2:00 PM - 3:00 PM', 
              classes: [{ name: 'Dust Devils (Mommy & Me)', discipline: 'other' }] 
            },
            { 
              time: '3:00 PM - 4:00 PM', 
              classes: [
                { name: 'Little Twisters', discipline: 'other' },
                { name: 'Hurricane Academy', discipline: 'other' }
              ] 
            },
            { 
              time: '4:00 PM - 5:00 PM', 
              classes: [{ name: 'Little Twisters', discipline: 'other' }] 
            },
            { 
              time: '4:00 PM - 5:30 PM', 
              classes: [
                { name: 'Tornadoes', discipline: 'gymnastics' },
                { name: 'Cyclones', discipline: 'gymnastics' }
              ] 
            },
            { 
              time: '5:30 PM - 7:00 PM', 
              classes: [
                { name: 'Tornadoes', discipline: 'gymnastics' },
                { name: 'Cyclones', discipline: 'gymnastics' },
                { name: 'Vortex A4 Elite', discipline: 'gymnastics' }
              ] 
            },
            { 
              time: '7:00 PM - 8:30 PM', 
              classes: [
                { name: 'Cyclones', discipline: 'gymnastics' },
                { name: 'Vortex A4 Elite', discipline: 'gymnastics' }
              ] 
            }
          ]
        },
        {
          day: 'Monday & Wednesday',
          timeSlots: [
            { 
              time: '7:00 PM - 8:30 PM', 
              classes: [{ name: 'Typhoons (Adult)', discipline: 'gymnastics' }] 
            }
          ]
        },
        {
          day: 'Saturday',
          timeSlots: [
            { 
              time: '9:00 AM - 10:00 AM', 
              classes: [
                { name: 'Dust Devils (Mommy & Me)', discipline: 'other' },
                { name: 'Little Twisters', discipline: 'other' }
              ] 
            },
            { 
              time: '10:00 AM - 11:30 AM', 
              classes: [
                { name: 'Tornadoes', discipline: 'gymnastics' },
                { name: 'Cyclones', discipline: 'gymnastics' },
                { name: 'Vortex A4 Elite', discipline: 'gymnastics' }
              ] 
            }
          ]
        }
      ]
    },
    {
      month: 'February',
      schedule: [
        {
          day: 'Monday - Friday',
          timeSlots: [
            { 
              time: '2:00 PM - 3:00 PM', 
              classes: [{ name: 'Dust Devils (Mommy & Me)', discipline: 'other' }] 
            },
            { 
              time: '3:00 PM - 4:00 PM', 
              classes: [
                { name: 'Little Twisters', discipline: 'other' },
                { name: 'Hurricane Academy', discipline: 'other' }
              ] 
            },
            { 
              time: '4:00 PM - 5:00 PM', 
              classes: [{ name: 'Little Twisters', discipline: 'other' }] 
            },
            { 
              time: '4:00 PM - 5:30 PM', 
              classes: [
                { name: 'Tornadoes', discipline: 'gymnastics' },
                { name: 'Cyclones', discipline: 'gymnastics' }
              ] 
            },
            { 
              time: '5:30 PM - 7:00 PM', 
              classes: [
                { name: 'Tornadoes', discipline: 'gymnastics' },
                { name: 'Cyclones', discipline: 'gymnastics' },
                { name: 'Vortex A4 Elite', discipline: 'gymnastics' },
                { name: 'Tornadoes', discipline: 'athleticism' },
                { name: 'Cyclones', discipline: 'athleticism' }
              ] 
            },
            { 
              time: '7:00 PM - 8:30 PM', 
              classes: [
                { name: 'Cyclones', discipline: 'gymnastics' },
                { name: 'Vortex A4 Elite', discipline: 'gymnastics' },
                { name: 'Vortex Elite', discipline: 'athleticism' },
                { name: 'Typhoons (Adult Gymnastics)', discipline: 'other' }
              ] 
            }
          ]
        },
        {
          day: 'Monday & Wednesday',
          timeSlots: [
            { 
              time: '7:00 PM - 8:30 PM', 
              classes: [{ name: 'Typhoons (Adult)', discipline: 'gymnastics' }] 
            }
          ]
        },
        {
          day: 'Saturday',
          timeSlots: [
            { 
              time: '9:00 AM - 10:00 AM', 
              classes: [
                { name: 'Dust Devils (Mommy & Me)', discipline: 'other' },
                { name: 'Little Twisters', discipline: 'other' }
              ] 
            },
            { 
              time: '10:00 AM - 11:30 AM', 
              classes: [
                { name: 'Tornadoes', discipline: 'gymnastics' },
                { name: 'Cyclones', discipline: 'gymnastics' },
                { name: 'Vortex A4 Elite', discipline: 'gymnastics' }
              ] 
            }
          ]
        }
      ]
    }
    // Add more months as needed
  ]

  const classGroupings: ClassGroup[] = [
    {
      category: 'Early Development Gymnastics & Athleticism',
      subcategories: [
        {
          name: '',
          classes: [
            'Dust Devils — Mommy & Me',
            'Little Twisters — Preschool & Early Stage'
          ]
        }
      ]
    },
    {
      category: 'Gymnastics',
      subcategories: [
        {
          name: '',
          classes: [
            'Tornadoes — Beginner',
            'Cyclones — Intermediate',
            'Vortex A4 Elite — Advanced'
          ]
        }
      ]
    },
    {
      category: 'Vortex Ninja Classes',
      subcategories: [
        {
          name: '',
          classes: [
            'Tornadoes — Beginner',
            'Cyclones — Intermediate',
            'Vortex Elite — Advanced'
          ]
        }
      ]
    },
    {
      category: 'Athleticism Accelerator',
      subcategories: [
        {
          name: '',
          classes: [
            'Tornadoes — Beginner',
            'Cyclones — Intermediate',
            'Vortex Elite — Advanced'
          ]
        }
      ]
    },
    {
      category: 'Adult Training Track Fitness & Acrobatics',
      subcategories: [
        {
          name: '',
          classes: [
            'Typhoons — Adult Fitness'
          ]
        }
      ]
    },
    {
      category: 'Hurricane Academy (Homeschool)',
      subcategories: [
        {
          name: '',
          classes: [
            'All Levels'
          ]
        }
      ]
    }
  ]

  // Events - fetched from database
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setEventsLoading(true)
        setEventsError(null)
        const apiUrl = getApiUrl()
        
        const response = await fetch(`${apiUrl}/api/events`)
        if (!response.ok) {
          throw new Error(`Failed to fetch events: ${response.status}`)
        }
        const data = await response.json()
        
        if (data.success) {
          // Convert date strings to Date objects and parse JSON fields
          const events = data.data.map((event: any) => ({
            ...event,
            startDate: new Date(event.startDate),
            endDate: event.endDate ? new Date(event.endDate) : undefined,
            datesAndTimes: Array.isArray(event.datesAndTimes) 
              ? event.datesAndTimes.map((dt: any) => ({
                  ...dt,
                  date: new Date(dt.date)
                }))
              : [],
            keyDetails: Array.isArray(event.keyDetails) ? event.keyDetails : [],
            images: Array.isArray(event.images) ? event.images : []
          }))
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

  // Filter out events more than 1 week in the past
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  
  const upcomingEvents = allEvents.filter(event => {
    const eventEndDate = event.endDate || event.startDate
    return eventEndDate >= oneWeekAgo
  }).sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  // Filter events based on search query - searches across all event fields
  const filteredEvents = upcomingEvents.filter(event => {
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
  })

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

  const getDisciplineColor = (discipline: ScheduledClass['discipline']) => {
    switch (discipline) {
      case 'gymnastics':
        return 'bg-gray-500 text-white'
      case 'ninja':
        return 'bg-black text-white'
      case 'athleticism':
        return 'bg-vortex-red text-white'
      default:
        return 'bg-gray-200 text-gray-700'
    }
  }

  // Image Slider Component
  const ImageSlider = ({ images }: { images: string[] }) => {
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

    const nextImage = () => {
      setCurrentIndex((prev) => (prev + 1) % images.length)
    }

    const prevImage = () => {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
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
        
        {/* Navigation buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            
            {/* Dots indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
            
            {/* Image counter */}
            <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>
    )
  }

  const formatClassName = (name: string, discipline: ScheduledClass['discipline']) => {
    // Add "Developmental" prefix to early development classes
    if (name === 'Dust Devils (Mommy & Me)' || name === 'Dust Devils' || name === 'Little Twisters') {
      return `Developmental | ${name}`
    }
    
    // Don't add prefix to other classes that are "other" discipline
    if (discipline === 'other') {
      return name
    }
    
    // Add appropriate prefix based on discipline
    switch (discipline) {
      case 'gymnastics':
        return `Gymnast | ${name}`
      case 'ninja':
        return `Ninja | ${name}`
      case 'athleticism':
        return `Athlete | ${name}`
      default:
        return name
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-gradient-to-br from-black via-gray-900 to-black pt-32 pb-0">
        <div className="container-custom">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6">
              Read <span className="text-vortex-red">Board</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Stay informed about classes, events, and important announcements
            </p>
          </motion.div>
          
          {/* Tabs */}
          <div className="flex justify-center border-t border-gray-700">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('classes')}
                className={`px-8 py-4 font-semibold text-lg transition-all duration-300 relative ${
                  activeTab === 'classes'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Classes Offered
                {activeTab === 'classes' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-8 py-4 font-semibold text-lg transition-all duration-300 relative ${
                  activeTab === 'schedule'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Schedule
                {activeTab === 'schedule' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-8 py-4 font-semibold text-lg transition-all duration-300 relative ${
                  activeTab === 'calendar'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Calendar
                {activeTab === 'calendar' && (
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
      </section>

      {/* Tab Content */}
      {activeTab === 'classes' && (
        <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-12 text-center">
              Classes <span className="text-vortex-red">Offered</span>
            </h2>
            <div className="space-y-8 max-w-5xl mx-auto">
              {classGroupings.map((group, groupIndex) => (
                <motion.div
                  key={group.category}
                  className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 md:p-8 border-2 border-gray-200"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIndex * 0.1, duration: 0.6 }}
                  viewport={{ once: true }}
                >
                  <h3 className="text-2xl font-display font-bold text-vortex-red mb-6">
                    {group.category}
                  </h3>
                  <div className="space-y-6">
                    {group.subcategories.map((subcategory, subIndex) => (
                      <div key={subIndex}>
                        {subcategory.name && (
                          <h4 className="text-lg font-semibold text-black mb-3">
                            {subcategory.name}
                          </h4>
                        )}
                        <ul className="space-y-2 ml-4">
                          {subcategory.classes.map((className, classIndex) => (
                            <li
                              key={classIndex}
                              className="flex items-start space-x-3 text-gray-700"
                            >
                              <Zap className="w-4 h-4 text-vortex-red flex-shrink-0 mt-1" />
                              <span>{className}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
      )}

      {activeTab === 'schedule' && (
        <>
          {/* Month Selector */}
          <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-8 text-center">
              Monthly <span className="text-vortex-red">Schedule</span>
            </h2>
            <div className="flex flex-wrap justify-center gap-3 mb-12 max-w-4xl mx-auto">
              {months.map((month, index) => (
                <motion.button
                  key={month}
                  onClick={() => setSelectedMonth(index)}
                  className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 ${
                    selectedMonth === index
                      ? 'bg-vortex-red text-white shadow-lg scale-105'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-200'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {month}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Class Schedule */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-12 text-center">
              {months[selectedMonth]} <span className="text-vortex-red">Schedule</span>
            </h2>
            {(() => {
              const currentSchedule = monthlySchedules.find(s => s.month === months[selectedMonth])
              
              if (!currentSchedule) {
                return (
                  <div className="text-center py-12">
                    <p className="text-xl text-gray-600">
                      Schedule for {months[selectedMonth]} will be available soon.
                    </p>
                  </div>
                )
              }

              return (
                <div className="space-y-6 max-w-5xl mx-auto">
                  {currentSchedule.schedule.map((daySchedule, dayIndex) => (
                    <motion.div
                      key={dayIndex}
                      className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 md:p-8 border-2 border-gray-200"
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: dayIndex * 0.1, duration: 0.6 }}
                      viewport={{ once: true }}
                    >
                      <h3 className="text-2xl font-display font-bold text-vortex-red mb-6 flex items-center">
                        <Calendar className="w-6 h-6 mr-2" />
                        {daySchedule.day}
                      </h3>
                      <div className="space-y-4">
                        {daySchedule.timeSlots.map((timeSlot, slotIndex) => (
                          <div
                            key={slotIndex}
                            className="flex flex-col md:flex-row md:items-start gap-4 p-4 bg-white rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center md:w-48 flex-shrink-0">
                              <Clock className="w-5 h-5 text-vortex-red mr-2" />
                              <span className="font-semibold text-gray-900">{timeSlot.time}</span>
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap gap-2">
                                {timeSlot.classes.map((scheduledClass, classIndex) => (
                                  <span
                                    key={classIndex}
                                    className={`inline-block px-4 py-2 rounded-lg font-medium text-sm ${getDisciplineColor(scheduledClass.discipline)}`}
                                  >
                                    {formatClassName(scheduledClass.name, scheduledClass.discipline)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )
            })()}
          </motion.div>
        </div>
      </section>
        </>
      )}

      {activeTab === 'calendar' && (
        <>
          {/* Search Bar - At top of Calendar tab */}
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

          {/* Calendar of Events */}
          <section className="section-padding bg-gray-50 pt-0">
            <div className="container-custom">
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-12 text-center">
                  Calendar of <span className="text-vortex-red">Events</span>
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
                      {searchQuery ? `No events found matching "${searchQuery}"` : 'No upcoming events at this time.'}
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

          {/* Event Details Sections */}
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
                      {searchQuery ? `No events found matching "${searchQuery}"` : 'No upcoming events at this time.'}
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
                          
                          <p className="text-gray-700 mb-6 leading-relaxed">
                            {event.longDescription}
                          </p>
                          
                          {/* Images Section */}
                          {event.images && event.images.length > 0 && (
                            <div className="mb-6">
                              <ImageSlider images={event.images} />
                            </div>
                          )}
                          
                          {/* Dates & Times Section */}
                          {event.datesAndTimes && event.datesAndTimes.length > 0 && (
                            <div className="mb-6 space-y-3">
                              <h4 className="font-bold text-black mb-3">
                                Dates & Times:
                              </h4>
                              <ul className="space-y-2">
                                {event.datesAndTimes.map((entry, entryIndex) => (
                                  <li key={entryIndex} className="flex items-start space-x-3 text-gray-700">
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
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default ReadBoard

