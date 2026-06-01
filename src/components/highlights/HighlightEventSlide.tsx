import { useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Calendar } from 'lucide-react'
import type { HighlightEventData } from '../../types/highlights'
import { formatDateForDisplay } from '../../utils/dateUtils'
import HighlightLetterFrame from './HighlightLetterFrame'

interface HighlightEventSlideProps {
  event: HighlightEventData
}

const HighlightEventSlide = ({ event }: HighlightEventSlideProps) => {
  const images = event.images ?? []
  const [imgIndex, setImgIndex] = useState(0)

  const startLabel = event.startDate
    ? formatDateForDisplay(
        event.startDate instanceof Date
          ? event.startDate.toISOString().slice(0, 10)
          : String(event.startDate),
      )
    : null

  return (
    <HighlightLetterFrame>
    <div className="space-y-4 text-left px-2 py-2">
      <h3 className="text-xl font-bold text-gray-900">{event.eventName}</h3>
      {startLabel && (
        <p className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4 text-vortex-red" />
          {startLabel}
        </p>
      )}
      {event.address && (
        <p className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4 text-vortex-red shrink-0 mt-0.5" />
          {event.address}
        </p>
      )}
      {images.length > 0 && (
        <div className="relative rounded-lg overflow-hidden">
          <img
            src={images[imgIndex]}
            alt=""
            className="w-full max-h-48 object-cover rounded-lg"
          />
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setImgIndex((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setImgIndex((i) => (i + 1) % images.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      )}
      <p className="text-gray-800 font-medium">{event.shortDescription}</p>
      <div className="text-sm text-gray-600 whitespace-pre-wrap">{event.longDescription}</div>
      {event.keyDetails && event.keyDetails.length > 0 && (
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          {event.keyDetails.map((detail, i) => (
            <li key={i}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
    </HighlightLetterFrame>
  )
}

export default HighlightEventSlide
