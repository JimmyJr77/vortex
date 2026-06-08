import { useState } from 'react'
import SchedulingSignupEmbed from './SchedulingSignupEmbed'

interface Props {
  formId: number
}

const EventAttachedSignup = ({ formId }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center justify-center bg-vortex-red hover:bg-red-700 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-colors"
        aria-expanded={open}
      >
        Sign-up
      </button>
      {open && (
        <div className="mt-4">
          <SchedulingSignupEmbed formId={formId} compact fromEvent />
        </div>
      )}
    </div>
  )
}

export default EventAttachedSignup
