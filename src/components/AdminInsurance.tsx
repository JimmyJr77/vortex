import { Shield } from 'lucide-react'

export default function AdminInsurance() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Insurance</h2>
        <p className="text-sm text-gray-500">House facility insurance information.</p>
      </div>
      <div className="border border-dashed border-gray-300 rounded-xl bg-white p-10 text-center">
        <Shield className="w-10 h-10 text-gray-400 mx-auto" />
        <h3 className="mt-4 font-bold text-gray-900">Insurance records coming soon</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          This page will store policy details, coverage documents, and renewal dates for the
          facility's insurance.
        </p>
      </div>
    </div>
  )
}
