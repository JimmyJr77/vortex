import { motion } from 'framer-motion'
import { Calendar, Clock, MapPin, Users, Award, Trophy, Zap, CheckCircle, Search } from 'lucide-react'
import { useState } from 'react'

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

  // Events - chronologically ordered
  // In production, these would be loaded from a database
  // NOTE: When creating events in the admin portal, the default address should be "Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715"
  const allEvents: Event[] = [
    {
      id: 1,
      eventName: 'Christmas Camp',
      shortDescription: 'Celebrate the holidays with our exciting Christmas Camp! This week-long adventure combines gymnastics fundamentals, ninja obstacle training, and athletic development activities.',
      longDescription: 'Celebrate the holidays with our exciting Christmas Camp! This week-long adventure combines gymnastics fundamentals, ninja obstacle training, and athletic development activities. Perfect for keeping kids active and engaged during the holiday break while building strength, coordination, and confidence. Our experienced coaches will guide athletes through fun, age-appropriate challenges that make learning feel like play.',
      startDate: new Date(2026, 11, 20), // Dec 20, 2026
      endDate: new Date(2026, 11, 28), // Dec 28, 2026
      type: 'camp',
      datesAndTimes: [
        { date: new Date(2026, 11, 20), startTime: '9:00 AM', endTime: '3:00 PM' },
        { date: new Date(2026, 11, 21), startTime: '9:00 AM', endTime: '3:00 PM' },
        { date: new Date(2026, 11, 22), startTime: '9:00 AM', endTime: '3:00 PM' },
        { date: new Date(2026, 11, 23), startTime: '9:00 AM', endTime: '3:00 PM' },
        { date: new Date(2026, 11, 24), startTime: '9:00 AM', endTime: '12:00 PM', description: 'Half day - Holiday Eve' },
        { date: new Date(2026, 11, 26), startTime: '9:00 AM', endTime: '3:00 PM' },
        { date: new Date(2026, 11, 27), startTime: '9:00 AM', endTime: '3:00 PM' },
        { date: new Date(2026, 11, 28), startTime: '9:00 AM', endTime: '3:00 PM' }
      ],
      keyDetails: [
        'Ages 5-18 welcome - grouped by age and skill level',
        'Includes healthy lunch and afternoon snacks',
        'Early drop-off (8:00 AM) and late pick-up (4:00 PM) available',
        'Holiday-themed activities and games',
        'Progress tracking through Athleticism Accelerator™',
        'Take-home camp certificate and progress report'
      ],
      address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
    },
    {
      id: 2,
      eventName: 'NCAA College Football National Championship Watch Party',
      shortDescription: 'Join the Vortex community for the biggest game in college football! Watch the NCAA College Football National Championship Game on our big screen.',
      longDescription: 'Join the Vortex community for the biggest game in college football! Watch the NCAA College Football National Championship Game on our big screen as we cheer on the nation\'s top collegiate teams competing for the national title. This is a perfect opportunity to come together as a community, enjoy great food and company, and experience the excitement of championship football. Bring the whole family for an evening of fun, community, and gridiron action!',
      startDate: new Date(2026, 0, 19), // Jan 19, 2026
      type: 'watch-party',
      datesAndTimes: [
        { date: new Date(2026, 0, 19), startTime: '6:00 PM', endTime: '10:00 PM', description: 'Pre-game coverage starts at 6:00 PM, kickoff at 7:00 PM' }
      ],
      keyDetails: [
        'All ages welcome - family-friendly event',
        'Complimentary pizza, snacks, and beverages',
        'Raffle prizes throughout the evening',
        'Game day atmosphere with large screen viewing',
        'Meet and connect with other Vortex families',
        'Free event - no registration required'
      ],
      address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
    },
    {
      id: 3,
      eventName: 'International Gymnastics Camp',
      shortDescription: 'Experience world-class training at our International Gymnastics Camp! This intensive 6-day camp brings together elite coaches from international programs.',
      longDescription: 'Experience world-class training at our International Gymnastics Camp! This intensive 6-day camp brings together elite coaches from international programs to share advanced techniques, training methodologies, and competitive strategies. Designed for competitive team members and advanced athletes, this camp focuses on skill refinement, routine construction, mental preparation, and performance optimization. Athletes will receive personalized feedback, video analysis, and training plans to elevate their competitive performance.',
      startDate: new Date(2026, 0, 15), // Jan 15, 2026
      endDate: new Date(2026, 0, 20), // Jan 20, 2026
      type: 'camp',
      datesAndTimes: [
        { date: new Date(2026, 0, 15), startTime: '8:00 AM', endTime: '5:00 PM', description: 'Day 1 - Orientation & Assessment' },
        { date: new Date(2026, 0, 16), description: 'All day training' },
        { date: new Date(2026, 0, 17), description: 'All day training' },
        { date: new Date(2026, 0, 18), description: 'All day training' },
        { date: new Date(2026, 0, 19), description: 'All day training' },
        { date: new Date(2026, 0, 20), startTime: '8:00 AM', endTime: '2:00 PM', description: 'Final day - Showcase & Evaluations' }
      ],
      keyDetails: [
        'Guest coaches from top international programs',
        'Comprehensive skill assessments and video analysis',
        'Personalized training plans and feedback',
        'Routine construction and choreography workshops',
        'Mental training and competition preparation',
        'For competitive team members and advanced athletes (evaluation required)',
        'Limited spots available - early registration recommended'
      ],
      address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
    },
    {
      id: 4,
      eventName: 'Superbowl Watch Party',
      shortDescription: 'Get ready for the biggest game of the year! Join the Vortex family for our annual Superbowl Watch Party.',
      longDescription: 'Get ready for the biggest game of the year! Join the Vortex family for our annual Superbowl Watch Party. We\'ll transform our main gym into the ultimate viewing experience with a large screen, comfortable seating, and game day atmosphere. This is a great opportunity to relax, have fun, and connect with the Vortex community while watching the championship game. Whether you\'re a football fan or just here for the snacks and company, everyone is welcome!',
      startDate: new Date(2026, 1, 8), // Feb 8, 2026
      type: 'watch-party',
      keyDetails: [
        '6:00 PM kickoff (pre-game coverage starts earlier)',
        'Game day snacks, pizza, and beverages provided',
        'Family-friendly environment - all ages welcome',
        'Raffle prizes and halftime games',
        'Comfortable viewing area with seating',
        'Free event for Vortex athletes and families',
        'RSVP recommended for planning purposes'
      ],
      address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
    },
    {
      id: 5,
      eventName: 'Athleticism Accelerator and Vortex Ninja Classes Begin',
      shortDescription: 'The wait is over! Our highly anticipated Athleticism Accelerator and Vortex Ninja programs officially launch on February 15th.',
      longDescription: 'The wait is over! Our highly anticipated Athleticism Accelerator and Vortex Ninja programs officially launch on February 15th. These programs combine cutting-edge athletic development with fun, engaging training that builds strength, agility, coordination, and confidence. The Athleticism Accelerator focuses on the 8 Tenets of Athleticism through science-backed training methods, while Vortex Ninja offers obstacle-based training that develops functional movement and body control. Both programs integrate seamlessly with our gymnastics foundation to create complete athletes.',
      startDate: new Date(2026, 1, 15), // Feb 15, 2026
      type: 'class',
      keyDetails: [
        'New class schedules and times available now',
        'Open enrollment for all skill levels - beginner to advanced',
        'Free trial classes available - experience before you commit',
        'Small group sizes for personalized attention',
        'Technology-integrated training with real-time feedback',
        'Progress tracking through Athleticism Accelerator™ system',
        'Flexible scheduling options available',
        'Contact us to register or schedule a free trial class'
      ],
      address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
    },
    {
      id: 6,
      eventName: 'Winter Showcase & Evaluations',
      shortDescription: 'Join us for our Winter Showcase, celebrating three months of growth and achievement!',
      longDescription: 'Join us for our Winter Showcase, celebrating three months of growth and achievement! This special event provides parents with the opportunity to see firsthand the learning and improvement their athletes have made during the winter season (December, January, and February). Athletes will demonstrate their skills and progress through routines and skill demonstrations. Additionally, our coaches will conduct internal evaluations for all athletes to determine level advancement or identify areas needing additional development time.',
      startDate: new Date(2026, 1, 28), // Feb 28, 2026
      type: 'event',
      keyDetails: [
        'Athlete skill demonstrations and routines',
        'Parent viewing of athlete progress and achievements',
        'Internal evaluations for level advancement decisions',
        'Individual progress reports and feedback',
        'Celebration of winter season accomplishments',
        'All program participants welcome',
        'Schedule and timing details to be announced'
      ],
      address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
    },
    {
      id: 7,
      eventName: 'Spring Showcase & Evaluations',
      shortDescription: 'Celebrate the spring season at our Spring Showcase! This quarterly event showcases the incredible progress athletes have made.',
      longDescription: 'Celebrate the spring season at our Spring Showcase! This quarterly event showcases the incredible progress athletes have made during the spring months (March, April, and May). Parents will witness their athletes\' growth through skill demonstrations, routine performances, and progress presentations. Our coaching team will conduct comprehensive evaluations to assess each athlete\'s readiness for level advancement, ensuring appropriate placement and continued development.',
      startDate: new Date(2026, 4, 30), // May 30, 2026
      type: 'event',
      keyDetails: [
        'Spring season progress demonstrations',
        'Parent viewing of athlete achievements and skill development',
        'Comprehensive athlete evaluations for level placement',
        'Individualized feedback and progress assessments',
        'Recognition of spring season accomplishments',
        'All program levels and ages participate',
        'Schedule and timing details to be announced'
      ],
      address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
    },
    {
      id: 8,
      eventName: 'Summer Showcase & Evaluations',
      shortDescription: 'Showcase the summer season\'s achievements at our Summer Showcase!',
      longDescription: 'Showcase the summer season\'s achievements at our Summer Showcase! This event highlights the dedication and progress athletes have shown throughout the summer months (June, July, and August). Parents will see their athletes demonstrate new skills, improved techniques, and overall growth. Our coaching staff will perform detailed evaluations to determine each athlete\'s progression path, identifying those ready to advance to the next level and those who would benefit from additional time at their current level.',
      startDate: new Date(2026, 7, 29), // Aug 29, 2026
      type: 'event',
      keyDetails: [
        'Summer season skill demonstrations and routines',
        'Parent viewing of athlete learning and improvement',
        'Detailed evaluations for level advancement decisions',
        'Progress reports and personalized feedback',
        'Celebration of summer achievements',
        'All athletes participate in showcase',
        'Schedule and timing details to be announced'
      ],
      address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
    },
    {
      id: 9,
      eventName: 'Autumn/Fall Showcase & Evaluations',
      shortDescription: 'Close out the year with our Autumn/Fall Showcase! This final showcase of the year celebrates the growth and achievements athletes have accomplished.',
      longDescription: 'Close out the year with our Autumn/Fall Showcase! This final showcase of the year celebrates the growth and achievements athletes have accomplished during the fall season (September, October, and November). Parents will have the opportunity to see their athletes\' progress through comprehensive skill demonstrations and routine performances. Our coaches will conduct year-end evaluations to assess readiness for level advancement, ensuring each athlete is placed appropriately for continued success in the coming year.',
      startDate: new Date(2026, 10, 28), // Nov 28, 2026
      type: 'event',
      keyDetails: [
        'Fall season progress demonstrations and performances',
        'Parent viewing of athlete learning and improvement',
        'Year-end evaluations for level advancement',
        'Comprehensive progress reports and assessments',
        'Celebration of fall season and annual achievements',
        'All program participants showcase their progress',
        'Schedule and timing details to be announced'
      ],
      address: 'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715'
    }
  ]

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
                
                {filteredEvents.length === 0 ? (
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
                
                {filteredEvents.length === 0 ? (
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

