import { motion } from 'framer-motion'
import { Calendar, Clock, MapPin, Users, Award, Trophy, Zap, CheckCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getApiUrl } from '../utils/api'
import { parseDateOnly, formatDateForDisplay, formatDateShort } from '../utils/dateUtils'

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

interface ClassDescription {
  name: string
  description: string
}

interface ClassGroup {
  category: string
  categoryDescription?: string
  classes: ClassDescription[]
  tenets?: string[] // For Athleticism Accelerator
}

interface ScheduledClass {
  name: string
  discipline: 'gymnastics' | 'ninja' | 'athleticism' | 'other'
  partialMonth?: boolean // Indicates class is not offered all month
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

type ScheduleView = 'day' | 'class'

const ReadBoard = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = January, 11 = December
  const [activeTab, setActiveTab] = useState<TabType>('classes')
  const [scheduleView, setScheduleView] = useState<ScheduleView>('day')

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
          day: 'Tuesday & Thursday',
          timeSlots: [
            { 
              time: '5:00 PM - 6:30 PM', 
              classes: [{ name: 'Tornadoes', discipline: 'ninja' }] 
            },
            { 
              time: '6:30 PM - 8:00 PM', 
              classes: [{ name: 'Cyclones', discipline: 'ninja' }] 
            },
            { 
              time: '8:00 PM - 9:30 PM', 
              classes: [{ name: 'Vortex Elite', discipline: 'ninja' }] 
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
          day: 'Monday, Wednesday & Friday',
          timeSlots: [
            { 
              time: '4:00 PM - 5:30 PM', 
              classes: [{ name: 'Tornadoes', discipline: 'athleticism', partialMonth: true }] 
            },
            { 
              time: '5:30 PM - 7:00 PM', 
              classes: [{ name: 'Cyclones', discipline: 'athleticism', partialMonth: true }] 
            },
            { 
              time: '7:00 PM - 8:30 PM', 
              classes: [{ name: 'Vortex Elite', discipline: 'athleticism', partialMonth: true }] 
            }
          ]
        },
        {
          day: 'Tuesday & Thursday',
          timeSlots: [
            { 
              time: '5:00 PM - 6:30 PM', 
              classes: [{ name: 'Tornadoes', discipline: 'ninja', partialMonth: true }] 
            },
            { 
              time: '6:30 PM - 8:00 PM', 
              classes: [{ name: 'Cyclones', discipline: 'ninja', partialMonth: true }] 
            },
            { 
              time: '8:00 PM - 9:30 PM', 
              classes: [{ name: 'Vortex Elite', discipline: 'ninja', partialMonth: true }] 
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
      categoryDescription: 'This category is designed to build the movement foundation every child needs before specialization. Classes emphasize body awareness, balance, coordination, listening skills, and confidence through guided play and structured exploration. The goal is not performance — it\'s building a lifelong relationship with movement.',
      classes: [
        {
          name: 'Dust Devils — Mommy & Me',
          description: 'A parent-assisted class that introduces toddlers to movement in a safe, playful environment. Children develop balance, coordination, spatial awareness, and comfort in a gym setting while strengthening the parent-child bond.'
        },
        {
          name: 'Little Twisters — Preschool & Early Stage Development',
          description: 'Focuses on independence, following instruction, and foundational gymnastics skills. Children improve coordination, strength, flexibility, and social interaction through age-appropriate challenges and obstacle-based learning.'
        }
      ]
    },
    {
      category: 'Gymnastics',
      categoryDescription: 'Our gymnastics track builds strength, flexibility, discipline, and technical skill through progressive instruction. Athletes learn how to control their bodies in space, manage risk safely, and develop mental focus — skills that translate to all sports and life.',
      classes: [
        {
          name: 'Tornadoes — Beginner',
          description: 'Introduces fundamental gymnastics skills such as rolls, cartwheels, handstands, bridges, and basic tumbling. Emphasis is on safe technique, confidence, flexibility, and learning how to train in a structured environment.'
        },
        {
          name: 'Cyclones — Intermediate',
          description: 'Athletes refine technique and begin linking skills together. Training focuses on strength, power, flexibility, consistency, and developing confidence in more advanced movements.'
        },
        {
          name: 'Vortex A4 Elite — Advanced',
          description: 'High-level training for committed athletes. Focus includes advanced tumbling, strength, precision, mental toughness, and performance readiness in a disciplined, goal-oriented setting.'
        }
      ]
    },
    {
      category: 'Vortex Ninja Classes',
      categoryDescription: 'Ninja classes develop functional strength, agility, grip, coordination, and problem-solving through obstacle-based movement. This track is ideal for athletes who thrive on challenge, creativity, and dynamic movement.',
      classes: [
        {
          name: 'Tornadoes — Beginner',
          description: 'Introduces climbing, swinging, jumping, and balance obstacles. Athletes build confidence, grip strength, coordination, and basic obstacle technique.'
        },
        {
          name: 'Cyclones — Intermediate',
          description: 'Focus shifts to efficiency, speed, and sequencing obstacles. Athletes learn how to move smoothly, conserve energy, and complete more complex challenges.'
        },
        {
          name: 'Vortex Elite — Advanced',
          description: 'Advanced obstacle training emphasizing endurance, strength, strategy, and mental resilience. Athletes are challenged to perform under pressure and adapt to high-difficulty obstacles.'
        }
      ]
    },
    {
      category: 'Athleticism Accelerator',
      categoryDescription: 'This program develops complete athletes, not sport-specific specialists. It is built around the 8 Tenets of Athleticism, ensuring athletes move better, perform better, and reduce injury risk across all sports.',
      tenets: [
        'Balance & Control – Ability to control the body in static and dynamic positions',
        'Coordination – Efficient integration of limbs, timing, and movement patterns',
        'Speed & Acceleration – Linear speed, first-step quickness, and reaction',
        'Agility & Change of Direction – Stopping, starting, cutting, and re-accelerating safely',
        'Strength – Age-appropriate foundational and functional strength',
        'Power – Explosive force production through jumping, throwing, and sprinting',
        'Mobility & Flexibility – Healthy joint ranges that support performance and injury prevention',
        'Kinematic Awareness – Understanding where the body is in space during dynamic movements'
      ],
      classes: [
        {
          name: 'Tornadoes — Beginner',
          description: 'Builds foundational athletic skills such as running mechanics, jumping, landing, balance, and coordination. Athletes are introduced to all 8 tenets in an age-appropriate way.'
        },
        {
          name: 'Cyclones — Intermediate',
          description: 'Focuses on speed, agility, strength development, and efficient movement. Athletes begin refining technique, improving power output, and learning how to train with intent.'
        },
        {
          name: 'Vortex Elite — Advanced',
          description: 'Advanced performance training emphasizing explosive power, acceleration/deceleration, rotational strength, and sport-transferable movement patterns. Athletes train with purpose and accountability.'
        }
      ]
    },
    {
      category: 'Adult Training Track – Fitness & Acrobatics',
      categoryDescription: 'Designed for adults seeking strength, mobility, conditioning, and body control in a scalable, supportive environment. No prior gymnastics or acrobatics experience required.',
      classes: [
        {
          name: 'Typhoons — Adult Fitness',
          description: 'Blends functional fitness, strength training, mobility work, and introductory acrobatics. Ideal for improving overall fitness, coordination, and confidence.'
        }
      ]
    },
    {
      category: 'Hurricane Academy (Homeschool)',
      categoryDescription: 'A daytime training program that integrates physical development with structure, discipline, and confidence-building — designed to complement homeschool schedules.',
      classes: [
        {
          name: 'All Levels',
          description: 'Students receive age- and skill-appropriate training across gymnastics, athleticism, and movement education while building focus, strength, and self-confidence.'
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
          // Convert date strings to Date objects using dateUtils to avoid timezone issues
          const events = data.data.map((event: any) => {
            const startDate = parseDateOnly(event.startDate)
            const endDate = event.endDate ? parseDateOnly(event.endDate) : undefined
            
            return {
              ...event,
              startDate: startDate || new Date(event.startDate), // Fallback if parsing fails
              endDate: endDate || (event.endDate ? new Date(event.endDate) : undefined),
              datesAndTimes: Array.isArray(event.datesAndTimes) 
                ? event.datesAndTimes.map((dt: any) => {
                    const parsedDate = parseDateOnly(dt.date)
                    return {
                      ...dt,
                      date: parsedDate || new Date(dt.date) // Fallback if parsing fails
                    }
                  })
                : [],
              keyDetails: Array.isArray(event.keyDetails) ? event.keyDetails : [],
              images: Array.isArray(event.images) ? event.images : []
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

  const formatDate = (date: Date | string) => {
    // Use dateUtils for consistent date formatting
    if (date instanceof Date) {
      // Convert Date to YYYY-MM-DD string for dateUtils
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return formatDateForDisplay(`${year}-${month}-${day}`)
    }
    return formatDateForDisplay(date)
  }

  const formatDateRange = (start: Date | string, end?: Date | string) => {
    const startStr = start instanceof Date 
      ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
      : start
    const endStr = end instanceof Date
      ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      : end
    
    if (!endStr || startStr === endStr) {
      return formatDateForDisplay(startStr)
    }
    return `${formatDateForDisplay(startStr)} - ${formatDateForDisplay(endStr)}`
  }

  const formatDateTimeEntry = (entry: DateTimeEntry) => {
    const dateStr = entry.date instanceof Date
      ? formatDateForDisplay(`${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, '0')}-${String(entry.date.getDate()).padStart(2, '0')}`)
      : formatDateForDisplay(entry.date)
    
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

  type ProgramType = 'developmental' | 'gymnastics' | 'athletics-fitness' | 'ninja' | 'adult' | 'homeschool'

  const getProgramType = (name: string, discipline: ScheduledClass['discipline']): ProgramType => {
    // Developmental classes
    if (name === 'Dust Devils (Mommy & Me)' || name === 'Dust Devils' || name === 'Little Twisters') {
      return 'developmental'
    }
    
    // Homeschool
    if (name === 'Hurricane Academy') {
      return 'homeschool'
    }
    
    // Adult classes
    if (name.includes('Typhoons') || name.includes('Adult')) {
      return 'adult'
    }
    
    // Ninja classes
    if (discipline === 'ninja') {
      return 'ninja'
    }
    
    // Athleticism Accelerator
    if (discipline === 'athleticism') {
      return 'athletics-fitness'
    }
    
    // Gymnastics
    if (discipline === 'gymnastics') {
      return 'gymnastics'
    }
    
    // Default fallback
    return 'gymnastics'
  }

  const getProgramColor = (programType: ProgramType) => {
    switch (programType) {
      case 'developmental':
        return 'bg-blue-500 text-white'
      case 'gymnastics':
        return 'bg-gray-500 text-white'
      case 'athletics-fitness':
        return 'bg-vortex-red text-white'
      case 'ninja':
        return 'bg-black text-white'
      case 'adult':
        return 'bg-purple-500 text-white'
      case 'homeschool':
        return 'bg-green-600 text-white'
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

  // Transform schedule from day-based to class-based
  const transformScheduleByClass = (schedule: DaySchedule[]) => {
    interface ClassSchedule {
      name: string
      discipline: ScheduledClass['discipline']
      programType: ProgramType
      partialMonth?: boolean
      sessions: Array<{
        day: string
        time: string
      }>
    }

    const classMap = new Map<string, ClassSchedule>()

    // Iterate through all days and time slots
    schedule.forEach((daySchedule) => {
      daySchedule.timeSlots.forEach((timeSlot) => {
        timeSlot.classes.forEach((scheduledClass) => {
          const key = `${scheduledClass.name}-${scheduledClass.discipline}`
          const programType = getProgramType(scheduledClass.name, scheduledClass.discipline)
          
          if (!classMap.has(key)) {
            classMap.set(key, {
              name: scheduledClass.name,
              discipline: scheduledClass.discipline,
              programType,
              partialMonth: scheduledClass.partialMonth,
              sessions: []
            })
          }
          
          const classSchedule = classMap.get(key)!
          classSchedule.sessions.push({
            day: daySchedule.day,
            time: timeSlot.time
          })
        })
      })
    })

    // Convert map to array and organize by category
    const classes = Array.from(classMap.values())
    
    // Category order: Developmental, Gymnastics, Ninja, Athleticism Accelerator, Homeschool, Adult
    const categoryOrder: ProgramType[] = ['developmental', 'gymnastics', 'ninja', 'athletics-fitness', 'homeschool', 'adult']
    
    // Group by category
    const groupedByCategory = categoryOrder.map(category => ({
      category,
      classes: classes.filter(c => c.programType === category).sort((a, b) => a.name.localeCompare(b.name))
    })).filter(group => group.classes.length > 0)

    return groupedByCategory
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
                  <h3 className="text-2xl font-display font-bold text-vortex-red mb-4">
                    {group.category}
                  </h3>
                  {group.categoryDescription && (
                    <p className="text-gray-700 mb-6 leading-relaxed">
                      {group.categoryDescription}
                    </p>
                  )}
                  {group.tenets && group.tenets.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-lg font-semibold text-black mb-3">
                        The 8 Tenets of Athleticism:
                      </h4>
                      <ul className="space-y-2 ml-4">
                        {group.tenets.map((tenet, tenetIndex) => (
                          <li
                            key={tenetIndex}
                            className="flex items-start space-x-3 text-gray-700"
                          >
                            <Zap className="w-4 h-4 text-vortex-red flex-shrink-0 mt-1" />
                            <span>{tenet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="space-y-6">
                    {group.classes.map((classItem, classIndex) => (
                      <div key={classIndex} className="border-l-4 border-vortex-red pl-4">
                        <h4 className="text-lg font-semibold text-black mb-2">
                          {classItem.name}
                        </h4>
                        <p className="text-gray-700 leading-relaxed">
                          {classItem.description}
                        </p>
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
      {/* Class Schedule */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center justify-center gap-4 mb-8">
              <button
                onClick={() => setSelectedMonth((selectedMonth - 1 + 12) % 12)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-6 h-6 text-vortex-red" />
              </button>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-black text-center">
                {months[selectedMonth]} <span className="text-vortex-red">Schedule</span>
              </h2>
              <button
                onClick={() => setSelectedMonth((selectedMonth + 1) % 12)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-6 h-6 text-vortex-red" />
              </button>
            </div>
            
            {/* Color Code Key */}
            <div className="max-w-5xl mx-auto mb-8">
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border-2 border-gray-200">
                <h3 className="text-xl font-display font-bold text-black mb-4">Program Color Code</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-blue-500"></div>
                    <span className="text-sm font-medium text-gray-700">Developmental</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-gray-500"></div>
                    <span className="text-sm font-medium text-gray-700">Gymnastics</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-vortex-red"></div>
                    <span className="text-sm font-medium text-gray-700">Athleticism Accelerator</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-black"></div>
                    <span className="text-sm font-medium text-gray-700">Ninja</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-purple-500"></div>
                    <span className="text-sm font-medium text-gray-700">Adult</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-green-600"></div>
                    <span className="text-sm font-medium text-gray-700">Homeschool</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Note about Athleticism Accelerator and Ninja */}
            {(months[selectedMonth] === 'February') && (
              <div className="max-w-5xl mx-auto mb-8">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        <strong>Note:</strong> Athleticism Accelerator and Ninja programs will kick off at the end of February. Classes with a black dashed border indicate they are not offered all month and will begin at the end of February.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* View Toggle */}
            <div className="max-w-5xl mx-auto mb-8 flex justify-center">
              <div className="inline-flex rounded-lg border-2 border-gray-200 bg-white p-1">
                <button
                  onClick={() => setScheduleView('day')}
                  className={`px-6 py-2 rounded-md font-semibold text-sm transition-all duration-300 ${
                    scheduleView === 'day'
                      ? 'bg-vortex-red text-white shadow-md'
                      : 'text-gray-700 hover:text-vortex-red'
                  }`}
                >
                  View by Day
                </button>
                <button
                  onClick={() => setScheduleView('class')}
                  className={`px-6 py-2 rounded-md font-semibold text-sm transition-all duration-300 ${
                    scheduleView === 'class'
                      ? 'bg-vortex-red text-white shadow-md'
                      : 'text-gray-700 hover:text-vortex-red'
                  }`}
                >
                  View by Class
                </button>
              </div>
            </div>

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

              if (scheduleView === 'class') {
                // Render by class view
                const classBasedSchedule = transformScheduleByClass(currentSchedule.schedule)
                const categoryNames: Record<ProgramType, string> = {
                  'developmental': 'Developmental',
                  'gymnastics': 'Gymnastics',
                  'ninja': 'Ninja',
                  'athletics-fitness': 'Athleticism Accelerator',
                  'homeschool': 'Homeschool',
                  'adult': 'Adult'
                }

                return (
                  <div className="space-y-8 max-w-5xl mx-auto">
                    {classBasedSchedule.map((categoryGroup, categoryIndex) => (
                      <motion.div
                        key={categoryGroup.category}
                        className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 md:p-8 border-2 border-gray-200"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: categoryIndex * 0.1, duration: 0.6 }}
                        viewport={{ once: true }}
                      >
                        <h3 className="text-2xl font-display font-bold text-vortex-red mb-6">
                          {categoryNames[categoryGroup.category]}
                        </h3>
                        <div className="space-y-6">
                          {categoryGroup.classes.map((classItem, classIndex) => {
                            const hasPartialMonth = classItem.partialMonth === true
                            const borderColor = hasPartialMonth 
                              ? (classItem.programType === 'ninja' ? 'border-2 border-dashed border-red-500' : 'border-2 border-dashed border-black')
                              : 'border border-gray-200'
                            return (
                              <div
                                key={classIndex}
                                className={`p-4 bg-white rounded-lg ${borderColor}`}
                              >
                                <div className="flex items-center mb-3">
                                  <span
                                    className={`inline-block px-4 py-2 rounded-lg font-semibold text-sm ${getProgramColor(classItem.programType)}`}
                                  >
                                    {formatClassName(classItem.name, classItem.discipline)}
                                  </span>
                                </div>
                                <div className="space-y-2 ml-2">
                                  {classItem.sessions.map((session, sessionIndex) => (
                                    <div
                                      key={sessionIndex}
                                      className="flex items-center text-gray-700"
                                    >
                                      <Calendar className="w-4 h-4 text-vortex-red mr-2 flex-shrink-0" />
                                      <span className="font-medium mr-3">{session.day}</span>
                                      <Clock className="w-4 h-4 text-vortex-red mr-2 flex-shrink-0" />
                                      <span>{session.time}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )
              }

              // Render by day view (original)
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
                                {timeSlot.classes.map((scheduledClass, classIndex) => {
                                  const programType = getProgramType(scheduledClass.name, scheduledClass.discipline)
                                  const hasPartialMonth = scheduledClass.partialMonth === true
                                  const borderColor = hasPartialMonth 
                                    ? (programType === 'ninja' ? 'border-2 border-dashed border-red-500' : 'border-2 border-dashed border-black')
                                    : ''
                                  return (
                                    <span
                                      key={classIndex}
                                      className={`inline-block px-4 py-2 rounded-lg font-medium text-sm ${getProgramColor(programType)} ${borderColor}`}
                                    >
                                      {formatClassName(scheduledClass.name, scheduledClass.discipline)}
                                    </span>
                                  )
                                })}
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

