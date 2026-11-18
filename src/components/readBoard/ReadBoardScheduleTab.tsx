import { Suspense } from 'react'
import { Link } from 'react-router-dom'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'

const PublicSchedulingCalendar = lazyWithRetry(() => import('../scheduling/PublicSchedulingCalendar'))

const ReadBoardScheduleTab = ({ showCalendar }: { showCalendar: boolean }) => (
  <section id="schedule" aria-labelledby="read-board-schedule-heading" className="np-browse-section np-browse-schedule bg-white">
    <div className="container-custom">
      <h2 id="read-board-schedule-heading" className="np-browse-section-title">Class schedule in Bowie, MD</h2>
      <p className="np-browse-description">
        The calendar covers kids’ gymnastics, Fit &amp; Flip, and Typhoons adult gymnastics. Use the booking links to check current openings.
      </p>
      <ul className="np-browse-schedule-links" aria-label="Class times by program">
        <li><Link to="/gymnastics#youth-gymnastics-schedule">Check youth gymnastics class times</Link></li>
        <li><Link to="/fit-and-flip#fit-flip-schedule">Check Fit &amp; Flip class times</Link></li>
        <li><Link to="/adult-gymnastics#adult-class-schedule">Check adult class times</Link></li>
      </ul>
      {showCalendar && (
        <div className="mt-6 space-y-4" data-prerender-dynamic="">
          <p>Choose <strong>By class</strong> to find dates for one class. In <strong>Day</strong> view, <strong>Sign Up</strong> and <strong>Check waitlist</strong> keep your selected date and time.</p>
          <Suspense fallback={<p role="status">Loading class calendar…</p>}>
            <PublicSchedulingCalendar theme="light" />
          </Suspense>
        </div>
      )}
      <ul className="np-browse-schedule-links" aria-label="Find an available class">
        <li><Link to="/#free-trial">Find a youth trial</Link></li>
        <li><Link to="/enroll">Browse recurring classes</Link></li>
        <li><Link to="/drop-in">Find a youth drop-in</Link></li>
      </ul>
    </div>
  </section>
)

export default ReadBoardScheduleTab
