import { Link } from 'react-router-dom'
import type { PublicYouthBooking } from '../../config/publicBookingSnapshot'
import { formatCents } from '../../utils/money'

const calendarDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
const clockTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
const dayList = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' })

function formatTime(time: string) {
  return clockTime.format(new Date(`1970-01-01T${time}Z`))
}

function formatPrice([low, high]: [number, number]) {
  return low === high ? formatCents(low) : `${formatCents(low)}–${formatCents(high)}`
}

export default function YouthBookingSummary({ booking, enrollmentHref, dropInHref }: {
  booking: PublicYouthBooking
  enrollmentHref: string
  dropInHref: string
}) {
  return (
    <div id="youth-booking-summary" className="np-youth-booking-summary" role="region" aria-labelledby="youth-booking-summary-heading">
      <header className="np-youth-booking-header">
        <h3 id="youth-booking-summary-heading">Weekly times and prices</h3>
        <p>All times Eastern.</p>
      </header>
      <ul className="np-youth-booking-classes">
        {booking.classes.map(({ formId, name, times, monthlyTuition, dropIn, dropInDays, dropInCapacity, dropInExcluded }) => (
          <li key={formId}>
            <h4>
              <Link to={`${enrollmentHref}&form=${formId}`} data-analytics-cta="browse_classes" data-analytics-section="youth_booking_summary">{name}</Link>
            </h4>
            <ul className="np-youth-booking-times">
              {times.map(({ days, startTime, endTime }) => (
                <li key={`${startTime}-${endTime}`}>
                  <span>{days}</span>
                  <span><time dateTime={startTime}>{formatTime(startTime)}</time>–<time dateTime={endTime}>{formatTime(endTime)}</time></span>
                </li>
              ))}
            </ul>
            {(monthlyTuition || dropIn || dropInExcluded) && (
              <dl className="np-youth-booking-prices">
                {monthlyTuition && <><dt>Base monthly tuition</dt><dd>{formatPrice(monthlyTuition)}</dd></>}
                {(dropInExcluded || dropIn) && (
                  <><dt>Nonmember drop-in</dt><dd>{dropInExcluded ? 'Unavailable' : dropIn && formatPrice(dropIn)}</dd></>
                )}
              </dl>
            )}
            {dropInDays.length > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                Listed drop-ins include dates on {dayList.format(dropInDays)}.
                {dropInCapacity != null && ` Up to ${dropInCapacity} athletes total per listed drop-in class.`}
              </p>
            )}
          </li>
        ))}
      </ul>
      <footer className="np-youth-booking-footer">
        <p>Catalog checked <time dateTime={booking.checkedOn}>{calendarDate.format(new Date(booking.checkedOn))}</time>. Confirm current prices and availability when you book.</p>
        {booking.classes.some(({ monthlyTuition }) => monthlyTuition !== null) && <p>Paid monthly enrollment requires an active annual membership.</p>}
        {booking.classes.some(({ dropInExcluded }) => !dropInExcluded) && (
          <Link to={dropInHref} data-analytics-cta="browse_drop_ins" data-analytics-section="youth_booking_summary">Check drop-in dates</Link>
        )}
      </footer>
    </div>
  )
}
