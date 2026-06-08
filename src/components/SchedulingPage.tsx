import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, ChevronRight, Loader2 } from 'lucide-react'
import { fetchPublicSchedulingForms, type SchedulingFormSummary } from '../utils/schedulingApi'
import SchedulingSignupEmbed from './SchedulingSignupEmbed'

const SchedulingPage = () => {
  const [forms, setForms] = useState<SchedulingFormSummary[]>([])
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPublicSchedulingForms()
      .then(setForms)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load forms'))
      .finally(() => setLoading(false))
  }, [])

  const selectedForm = forms.find((f) => f.id === selectedFormId) ?? null

  if (loading && forms.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-vortex-red" />
      </div>
    )
  }

  if (forms.length === 0) {
    return (
      <section className="section-padding pt-below-site-header bg-white min-h-[50vh]">
        <div className="container-custom max-w-2xl mx-auto text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-3xl font-display font-bold text-black mb-4">Scheduling</h1>
          <p className="text-gray-600">
            {error || 'No scheduling signups are open right now. Check back soon.'}
          </p>
        </div>
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-black via-gray-900 to-black pt-below-site-header pb-12">
        <div className="container-custom text-center">
          <motion.h1
            className="text-4xl md:text-5xl font-display font-bold text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Scheduling <span className="text-vortex-red">Sign Up</span>
          </motion.h1>
          <p className="text-gray-300 max-w-2xl mx-auto text-lg">
            {selectedForm
              ? 'Choose your category, pick a time, and reserve your spot.'
              : 'Select a signup form to get started.'}
          </p>
        </div>
      </section>

      <section className="section-padding bg-gray-50">
        <div className="container-custom max-w-3xl mx-auto">
          {selectedFormId == null ? (
            <div className="space-y-4">
              <h2 className="text-xl font-display font-bold text-black">Available signups</h2>
              <div className="grid grid-cols-1 gap-4">
                {forms.map((form) => (
                  <button
                    key={form.id}
                    type="button"
                    onClick={() => setSelectedFormId(form.id)}
                    className="text-left bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:border-vortex-red hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-display font-bold text-black mb-2 group-hover:text-vortex-red transition-colors">
                          {form.title}
                        </h3>
                        {form.description && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-3">{form.description}</p>
                        )}
                        {(form.startDate || form.endDate) && (
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <Calendar className="w-4 h-4 shrink-0" />
                            {form.startDate && `Opens ${form.startDate}`}
                            {form.startDate && form.endDate && ' · '}
                            {form.endDate && `Closes ${form.endDate}`}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-vortex-red shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => setSelectedFormId(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:text-black transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Cancel
              </button>
              {selectedForm && (
                <SchedulingSignupEmbed key={selectedFormId} formId={selectedFormId} />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default SchedulingPage
