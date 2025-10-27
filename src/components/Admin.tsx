import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LogOut, RefreshCw, Download, Mail, Phone } from 'lucide-react'

interface AdminProps {
  onLogout: () => void
}

export default function Admin({ onLogout }: AdminProps) {
  const [registrations, setRegistrations] = useState<any[]>([])
  const [newsletter, setNewsletter] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [regResponse, newsResponse] = await Promise.all([
        fetch('http://localhost:3001/api/admin/registrations'),
        fetch('http://localhost:3001/api/admin/newsletter')
      ])

      const regData = await regResponse.json()
      const newsData = await newsResponse.json()

      if (regData.success) setRegistrations(regData.data)
      if (newsData.success) setNewsletter(newsData.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return

    const headers = Object.keys(data[0])
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-display font-bold text-white">
            VORTEX <span className="text-vortex-red">ADMIN</span>
          </h1>
          <motion.button
            onClick={onLogout}
            className="flex items-center space-x-2 bg-vortex-red text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </motion.button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Registrations Section */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-display font-bold text-white">Registrations</h2>
              <div className="flex space-x-2">
                <motion.button
                  onClick={fetchData}
                  className="bg-vortex-red text-white px-4 py-2 rounded hover:bg-red-700 transition-colors flex items-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </motion.button>
                <motion.button
                  onClick={() => exportToCSV(registrations, 'vortex_registrations.csv')}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </motion.button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-600 text-left text-gray-200 uppercase text-sm leading-normal">
                    <th className="py-3 px-6">Name</th>
                    <th className="py-3 px-6">Email</th>
                    <th className="py-3 px-6">Date</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center">Loading...</td>
                    </tr>
                  ) : registrations.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center">No registrations yet</td>
                    </tr>
                  ) : (
                    registrations.map((reg) => (
                      <tr key={reg.id} className="border-b border-gray-700 hover:bg-gray-700">
                        <td className="py-3 px-6">{reg.first_name} {reg.last_name}</td>
                        <td className="py-3 px-6">{reg.email}</td>
                        <td className="py-3 px-6">
                          {new Date(reg.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Newsletter Section */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-display font-bold text-white">Newsletter</h2>
              <div className="flex space-x-2">
                <motion.button
                  onClick={fetchData}
                  className="bg-vortex-red text-white px-4 py-2 rounded hover:bg-red-700 transition-colors flex items-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </motion.button>
                <motion.button
                  onClick={() => exportToCSV(newsletter, 'vortex_newsletter.csv')}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </motion.button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-600 text-left text-gray-200 uppercase text-sm leading-normal">
                    <th className="py-3 px-6">Email</th>
                    <th className="py-3 px-6">Date</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={2} className="py-4 text-center">Loading...</td>
                    </tr>
                  ) : newsletter.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-4 text-center">No subscribers yet</td>
                    </tr>
                  ) : (
                    newsletter.map((sub) => (
                      <tr key={sub.id} className="border-b border-gray-700 hover:bg-gray-700">
                        <td className="py-3 px-6">{sub.email}</td>
                        <td className="py-3 px-6">
                          {new Date(sub.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

