import { Link } from 'react-router-dom'
import PublicSchedulingCalendar from '../scheduling/PublicSchedulingCalendar'

const ReadBoardScheduleTab = ({ showCalendar }: { showCalendar: boolean }) => (
  <section id="schedule" aria-labelledby="read-board-schedule-heading" className="np-browse-section np-browse-schedule bg-white">
    <div className="container-custom">
      <h2 id="read-board-schedule-heading" className="np-browse-section-title">Class schedule in Bowie, MD</h2>
      <p className="np-browse-description">
        The calendar covers kids’ gymnastics, Fit &amp; Flip, and Typhoons adult gymnastics. Use the booking links to check current openings.
      </p>
      {showCalendar && (
        <div className="mt-6 space-y-4" data-prerender-dynamic="">
          <p>Choose <strong>By class</strong>, then select a class to find its dates and times.</p>
          <PublicSchedulingCalendar theme="light" />
        </div>
      )}
      <ul className="np-browse-schedule-links" aria-label="Find an available class">
        <li><Link to="/#free-trial">Find a youth trial</Link></li>
        <li><Link to="/enroll">Browse recurring classes</Link></li>
        <li><Link to="/drop-in">Find a youth drop-in</Link></li>
        <li><Link to="/adult-gymnastics">Check adult class times</Link></li>
      </ul>
    </div>
  </section>
)

export default ReadBoardScheduleTab
