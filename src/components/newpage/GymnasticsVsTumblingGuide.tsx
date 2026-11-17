import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GYMNASTICS_VS_TUMBLING_GUIDE } from '../../config/gymnasticsVsTumblingGuide'
import { PRESCHOOL_GYMNASTICS_GUIDE } from '../../config/preschoolGymnasticsGuide'
import GuideByline from './GuideByline'
import './AthleticDevelopmentGuide.css'

export default function GymnasticsVsTumblingGuide() {
  const guide = GYMNASTICS_VS_TUMBLING_GUIDE

  return (
    <article className="athletic-guide" aria-labelledby="gymnastics-tumbling-title">
      <header className="athletic-guide-hero">
        <div className="athletic-guide-shell athletic-guide-intro">
          <div>
            <nav aria-label="Breadcrumb" className="athletic-guide-breadcrumb">
              <Link to="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{guide.breadcrumbLabel}</span>
            </nav>
            <h1 id="gymnastics-tumbling-title">{guide.heading}</h1>
            <p className="athletic-guide-lead">
              Tumbling is a group of acrobatic skills children practice on a floor or track.
              A gymnastics class can teach tumbling alongside other skills, such as balancing or working
              on apparatus. The right starting class depends on what your child wants to practice.
            </p>
            <GuideByline datePublished={guide.datePublished} dateModified={guide.dateModified} />
          </div>
          <img className="athletic-guide-image" src={guide.image} alt={guide.imageAlt}
            width={1600} height={1067} fetchPriority="high" />
        </div>
      </header>

      <div className="athletic-guide-body">
        <nav className="athletic-guide-index" aria-label="In this guide">
          <ul>
            <li><a href="#where-tumbling-fits">Where tumbling fits</a></li>
            <li><a href="#choose-a-class">Which class to try</a></li>
            <li><a href="#questions-for-the-coach">Questions for the coach</a></li>
          </ul>
        </nav>

        <section id="where-tumbling-fits">
          <h2>Where tumbling fits in gymnastics</h2>
          <p>
            A roll, cartwheel, or round-off can be part of a tumbling progression. A coach might first
            watch how a child supports their weight or finishes a movement before asking them to
            connect it to the next skill.
          </p>
          <p>
            In artistic gymnastics, tumbling is part of the floor routine. In competitive Trampoline &amp; Tumbling,
            athletes perform power tumbling on a sprung runway. USA Gymnastics also lists individual trampoline,
            synchronized trampoline, and double mini as events in that discipline. If you’re looking for a
            dedicated tumbling class, ask how much time the coach spends on floor or track skills.
          </p>
          <p>
            <a href="https://members.usagym.org/pages/gymnastics101/women/events.html">Artistic gymnastics events</a>
            {' · '}
            <a href="https://members.usagym.org/pages/gymnastics101/tt/events.html">Trampoline &amp; Tumbling events</a>
            {' '}from USA Gymnastics.
          </p>
        </section>

        <section id="choose-a-class">
          <h2>Which class should your child try in Bowie?</h2>
          <ul>
            <li>
              <strong>To learn gymnastics skills, including floor tumbling.</strong> Start with{' '}
              <Link to="/gymnastics#beginner">Vortex’s developmental gymnastics pathway</Link>. First-time
              gymnasts ages 6–17 can look for a Tornadoes trial. Coaches work on foundations such as rolls,
              cartwheels, and handstands. Kids or teens with previous gymnastics experience can choose the
              experienced pathway in the trial finder so a coach can assess their starting point.
            </li>
            <li>
              <strong>To build strength and power for tumbling, cheer, or another sport.</strong> Explore{' '}
              <Link to="/fit-and-flip#body-control">Fit &amp; Flip</Link>. Coaches combine resistance work
              and jump training with drills on trampolines and tumble tracks. Fit &amp; Flip Cyclones trial
              groups cover ages 8–11 and 12–15.
            </li>
          </ul>
          <p className="mt-4">
            A 10-year-old who wants to learn a cartwheel can start with Tornadoes. A 10-year-old cheer athlete
            working on a stronger takeoff and steadier landing could start with Fit &amp; Flip. If your child has
            a specific skill in mind, tell the coach what they can already do and ask which class works on it.
          </p>
          <p>For ages 2–5, see <Link to={PRESCHOOL_GYMNASTICS_GUIDE.path}>what kids practice in preschool gymnastics</Link>.</p>
        </section>

        <section id="questions-for-the-coach">
          <h2>Three questions to ask before booking</h2>
          <ul>
            <li>Which skills do beginners practice, and are there prerequisites for this class?</li>
            <li>How much time will my child spend on floor or track work compared with other activities?</li>
            <li>What will you look for before moving my child on to their next skill?</li>
          </ul>
        </section>

        <aside className="athletic-guide-next" aria-labelledby="gymnastics-tumbling-next">
          <h2 id="gymnastics-tumbling-next">Find a class to try</h2>
          <p>Use your child’s age and goals to choose a program. You’ll see the dates that are currently available.</p>
          <div className="athletic-guide-actions">
            <Link className="np-button" to="/#free-trial" data-analytics-cta="free_trial_section" data-analytics-section="gymnastics_vs_tumbling_guide">
              Find a free trial <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className="athletic-guide-trial" to="/read-board#classes">Browse current classes</Link>
          </div>
        </aside>
      </div>
    </article>
  )
}
