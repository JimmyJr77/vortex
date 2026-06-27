import { ClipboardList } from 'lucide-react'

export default function AdminEventSignups() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Signups</h2>
        <p className="text-sm text-gray-500">Track who has signed up for events.</p>
      </div>
      <div className="border border-dashed border-gray-300 rounded-xl bg-white p-10 text-center">
        <ClipboardList className="w-10 h-10 text-gray-400 mx-auto" />
        <h3 className="mt-4 font-bold text-gray-900">Event signups coming soon</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          This page will list members and families who have registered for events, with status and
          attendance tracking.
        </p>
      </div>
    </div>
  )
}
