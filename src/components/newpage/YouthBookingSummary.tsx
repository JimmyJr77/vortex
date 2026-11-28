import { Link } from 'react-router-dom'
import type { PublicYouthBooking } from '../../config/publicBookingSnapshot'
import { formatCents } from '../../utils/money'
import { DEVELOPMENTAL_GYMNASTICS_PROGRAM, FIT_AND_FLIP_BOOKING_PROGRAM, type RecurringBookingProgram } from '../../utils/publicBookingPrograms'
import RecurringRegistrationLink from './RecurringRegistrationLink'
import RecurringBookingTerms from './RecurringBookingTerms'
import usePublicDropInEligibility from './usePublicDropInEligibility'

const calendarDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
const clockTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
const dayList = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' })

function formatTime(time: string) {
  return clockTime.format(new Date(`1970-01-01T${time}Z`))
}

function formatPrice([low, high]: [number, number]) {
  return low === high ? formatCents(low) : `${formatCents(low)}–${formatCents(high)}`
}

export default function YouthBookingSummary({
  booking, enrollmentHref, dropInHref, isYouthGymnastics = false,
  programName = isYouthGymnastics ? DEVELOPMENTAL_GYMNASTICS_PROGRAM : FIT_AND_FLIP_BOOKING_PROGRAM,
  id = 'youth-booking-summary', analyticsSection = 'youth_booking_summary',
}: {
  booking: PublicYouthBooking
  enrollmentHref: string
  dropInHref: string
  isYouthGymnastics?: boolean
  programName?: RecurringBookingProgram
  id?: string
  analyticsSection?: string
}) {
  const eligibility = usePublicDropInEligibility(programName)
  const classes = booking.classes.map(classItem => ({
    ...classItem,
    dropInExcluded: eligibility ? eligibility.get(classItem.formId) ?? true : classItem.dropInExcluded,
  }))
  return (
    <div id={id} className="np-youth-booking-summary" role="region" aria-labelledby={`${id}-heading`}>
      <header className="np-youth-booking-header">
        <h3 id={`${id}-heading`}>Weekly times and prices</h3>
        <p>All times Eastern.</p>
      </header>
      <ul className="np-youth-booking-classes">
        {classes.map(({ formId, name, times, monthlyTuition, dropIn, dropInDays, dropInCapacity, dropInExcluded }) => (
          <li key={formId}>
            <h4>
              <Link to={`${enrollmentHref}&form=${formId}`} data-analytics-cta="browse_classes" data-analytics-section={analyticsSection}>{name}</Link>
            </h4>
            <ul className="np-youth-booking-times">
              {times.map(({ days, startTime, endTime }) => (
                <li key={`${startTime}-${endTime}`}>
                  <span>{days}</span>
                  <span><time dateTime={startTime}>{formatTime(startTime)}</time>–<time dateTime={endTime}>{formatTime(endTime)}</time></span>
                </li>
              ))}
            </ul>
            <dl className="np-youth-booking-prices">
              {monthlyTuition && <><dt>Base monthly tuition</dt><dd>{formatPrice(monthlyTuition)}</dd></>}
              <dt>Nonmember drop-in</dt><dd>{dropInExcluded ? 'Unavailable' : dropIn ? formatPrice(dropIn) : 'Check dates'}</dd>
            </dl>
            {!isYouthGymnastics && dropInDays.length > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                Listed drop-ins include dates on {dayList.format(dropInDays)}.
                {dropInCapacity != null && ` Up to ${dropInCapacity} athletes total per listed drop-in class.`}
              </p>
            )}
            <RecurringRegistrationLink href={`${enrollmentHref}&form=${formId}`} className={name} section={analyticsSection}
              dropInHref={dropInExcluded ? undefined : dropInHref} />
          </li>
        ))}
      </ul>
      <footer className="np-youth-booking-footer">
        <p>Catalog checked <time dateTime={booking.checkedOn}>{calendarDate.format(new Date(booking.checkedOn))}</time>. Confirm current prices and availability when you book.</p>
        <p>Paid monthly enrollment requires an active annual membership.</p>
        {classes.some(({ dropInExcluded }) => !dropInExcluded) && (
          <Link to={dropInHref} data-analytics-cta="browse_drop_ins" data-analytics-section={analyticsSection}>Check drop-in dates</Link>
        )}
        <RecurringBookingTerms />
      </footer>
    </div>
  )
}
