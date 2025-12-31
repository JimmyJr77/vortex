import { useState } from 'react'
import { motion } from 'framer-motion'
import { LogOut, Home, User, Calendar, MessageSquare, Trophy, BookOpen, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

interface MemberDashboardProps {
  member: any
  onLogout: () => void
  onReturnToWebsite?: () => void
}

type MemberPage = 'read-board' | 'athlete-page' | 'calendar' | 'communications' | 'challenges' | 'resources' | 'boosters'

export default function MemberDashboard({ member, onLogout, onReturnToWebsite }: MemberDashboardProps) {
  const [activePage, setActivePage] = useState<MemberPage>('read-board')

  const navigationItems = [
    { id: 'read-board' as MemberPage, label: 'Read Board', icon: BookOpen },
    { id: 'athlete-page' as MemberPage, label: 'Athlete Page', icon: User },
    { id: 'calendar' as MemberPage, label: 'Calendar & Events', icon: Calendar },
    { id: 'communications' as MemberPage, label: 'Communications', icon: MessageSquare },
    { id: 'challenges' as MemberPage, label: 'Challenges', icon: Trophy },
    { id: 'resources' as MemberPage, label: 'Resources', icon: BookOpen },
    { id: 'boosters' as MemberPage, label: 'Boosters', icon: Users },
  ]

  const renderPage = () => {
    switch (activePage) {
      case 'read-board':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Read Board</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Announcements and updates will appear here.</p>
            </div>
          </div>
        )
      case 'athlete-page':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Athlete Page</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Member Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
                    <div>
                      <span className="font-medium">Name:</span> {member.first_name} {member.last_name}
                    </div>
                    <div>
                      <span className="font-medium">Email:</span> {member.email}
                    </div>
                    {member.phone && (
                      <div>
                        <span className="font-medium">Phone:</span> {member.phone}
                      </div>
                    )}
                    {member.program && (
                      <div>
                        <span className="font-medium">Program:</span> {member.program}
                      </div>
                    )}
                  </div>
                </div>
                {member.children && member.children.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Children</h3>
                    <div className="space-y-2">
                      {member.children.map((child: any, index: number) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <div className="font-medium text-gray-900">{child.firstName} {child.lastName}</div>
                          <div className="text-sm text-gray-600">
                            Date of Birth: {new Date(child.dateOfBirth).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      case 'calendar':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Calendar & Events</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Upcoming events and calendar will appear here.</p>
            </div>
          </div>
        )
      case 'communications':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Communications</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Messages and communications will appear here.</p>
            </div>
          </div>
        )
      case 'challenges':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Challenges</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Challenges and competitions will appear here.</p>
            </div>
          </div>
        )
      case 'resources':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Resources</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Resources and documents will appear here.</p>
            </div>
          </div>
        )
      case 'boosters':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">Boosters</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Booster club information will appear here.</p>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center">
                <img 
                  src="/vortex_logo_1.png" 
                  alt="Vortex Athletics" 
                  className="h-12 w-auto"
                />
              </Link>
              <span className="text-gray-400">|</span>
              <span className="text-gray-700 font-medium">Member Portal</span>
            </div>
            <div className="flex items-center space-x-4">
              {onReturnToWebsite ? (
                <button
                  onClick={onReturnToWebsite}
                  className="flex items-center space-x-2 text-gray-700 hover:text-vortex-red transition-colors"
                >
                  <Home className="w-5 h-5" />
                  <span className="hidden sm:inline">Return to Website</span>
                </button>
              ) : (
                <Link
                  to="/"
                  className="flex items-center space-x-2 text-gray-700 hover:text-vortex-red transition-colors"
                >
                  <Home className="w-5 h-5" />
                  <span className="hidden sm:inline">Return to Website</span>
                </Link>
              )}
              <button
                onClick={onLogout}
                className="flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <ul className="space-y-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActivePage(item.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                          activePage === item.id
                            ? 'bg-vortex-red text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {renderPage()}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  )
}

