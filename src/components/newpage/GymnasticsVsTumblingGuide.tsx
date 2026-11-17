import { useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { CONTACT_INQUIRY_PATH } from '../../config/contact'
import { GYMNASTICS_VS_TUMBLING_GUIDE } from '../../config/gymnasticsVsTumblingGuide'
import { PRESCHOOL_GYMNASTICS_GUIDE } from '../../config/preschoolGymnasticsGuide'
import GuideBreadcrumb from './GuideBreadcrumb'
import GuideByline from './GuideByline'
import './AthleticDevelopmentGuide.css'

export default function GymnasticsVsTumblingGuide() {
  const guide = GYMNASTICS_VS_TUMBLING_GUIDE
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash])

  return (
    <article className="athletic-guide" aria-labelledby="gymnastics-tumbling-title">
      <header className="athletic-guide-hero">
        <div className="athletic-guide-shell athletic-guide-intro">
          <div>
            <GuideBreadcrumb guideLabel={guide.breadcrumbLabel} />
            <h1 id="gymnastics-tumbling-title">{guide.heading}</h1>
            <p className="athletic-guide-lead">
              Tumbling is a group of acrobatic skills children practice on a floor or track.
              A gymnastics class can teach tumbling alongside other skills, such as balancing or working
              on apparatus. Compare what kids practice in each format and where to find a dedicated tumbling class near Bowie.
            </p>
            <GuideByline datePublished={guide.datePublished} dateModified={guide.dateModified} />
          </div>
          <img className="athletic-guide-image" src={guide.image} alt={guide.imageAlt}
            srcSet={guide.imageSrcSet}
            sizes="(max-width: 760px) 91vw, (max-width: 1264px) 43vw, 520px"
            width={1600} height={1067} fetchPriority="high" />
        </div>
      </header>

      <div className="athletic-guide-body">
        <nav className="athletic-guide-index" aria-label="In this guide">
          <ul>
            <li><a href="#where-tumbling-fits">Where tumbling fits</a></li>
            <li><a href="#choose-a-class">Which class to try</a></li>
            <li><a href="#boys-gymnastics">Boys’ gymnastics and apparatus classes</a></li>
            <li><a href="#nearby-tumbling-classes">Dedicated tumbling classes near Bowie</a></li>
            <li><a href="#accessible-gymnastics">Adaptive and accessible gymnastics</a></li>
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
              cartwheels, and handstands. If your child has taken classes before, see{' '}
              <Link to="/gymnastics#class-placement">how coaches choose a gymnastics level</Link>.
            </li>
            <li>
              <strong>To build strength and power for tumbling, cheer, or another sport.</strong> Explore{' '}
              <Link to="/fit-and-flip#body-control">Fit &amp; Flip</Link>. Coaches combine resistance work
              and jump training with drills on trampolines and tumble tracks. Fit &amp; Flip Cyclones trial
              groups cover ages 8–11 and 12–15.
            </li>
            <li>
              <strong>To focus on floor or track skills.</strong> Look for a dedicated class where most of the session
              goes toward tumbling. <a href="#nearby-tumbling-classes">Compare nearby tumbling classes</a>.
            </li>
          </ul>
          <p className="mt-4">
            A 10-year-old who wants to learn a cartwheel can start with Tornadoes. A 10-year-old cheer athlete
            working on a stronger takeoff and steadier landing could start with Fit &amp; Flip. If your child has
            a specific skill in mind, tell the coach what they can already do and ask which class works on it.
          </p>
          <p>For ages 2–5, see <Link to={PRESCHOOL_GYMNASTICS_GUIDE.path}>what kids practice in preschool gymnastics</Link>.</p>
        </section>

        <section id="boys-gymnastics">
          <h2>Boys’ gymnastics and apparatus classes near Bowie</h2>
          <p>
            If your child wants to work on rings, pommel horse, or high bar, check which apparatus their group
            will use. Those are events in men’s artistic gymnastics, along with floor, vault, and parallel bars.{' '}
            <a href="https://members.usagym.org/pages/gymnastics101/men/events.html">See the men’s artistic events from USA Gymnastics</a>.
          </p>
          <ul>
            <li>
              <strong>General gymnastics foundations in Bowie.</strong> Vortex’s beginner Tornadoes classes teach
              rolls, cartwheels, handstands, and controlled landings. First-time gymnasts ages 6–17 can look for a
              trial. Ask which equipment your child’s group uses.{' '}
              <Link to="/gymnastics#first-visit">See how a Vortex trial works</Link>
            </li>
            <li>
              <strong>Boys’ gymnastics in Upper Marlboro.</strong> MGA lists a class that teaches skills across
              all six men’s artistic events, including pommel horse and rings. Ask MGA which starting group fits
              your child’s age and experience.{' '}
              <a href="https://www.mga-gymnastics.com/boys.html">See MGA’s boys’ gymnastics class</a>
            </li>
            <li>
              <strong>County gymnastics in Landover.</strong> The seasonal guide lists Boys Bronze and Boys Silver
              at the Prince George’s Sports &amp; Learning Complex. Bronze listings have no prerequisites. For
              Silver, the guide calls for independent rolls and cartwheels as well as strength on the apparatus.
              Check the age and prerequisites for the current session.{' '}
              <a href="https://www.pgparks.com/your-guide">Look up boys’ gymnastics in the county guide</a>
            </li>
          </ul>
        </section>

        <section id="nearby-tumbling-classes">
          <h2>Dedicated tumbling classes near Bowie</h2>
          <p>Compare the starting skills and class format, especially if your child is trying tumbling for the first time.</p>
          <ul>
            <li>
              <strong>Marlboro Cheer in Upper Marlboro.</strong> It lists preschool tumbling for ages 3–5 and a Level 1
              class for ages 5–8 that teaches skills such as rolls and cartwheels. It also lists open tumbling for extra practice.
              {' '}<a href="https://www.marlborocheer.org/tumbling.php">Compare Marlboro Cheer classes and open tumbling</a>
            </li>
            <li>
              <strong>MGA Gymnastics in Upper Marlboro.</strong> Its one-hour classes start at age 5 and run from beginner to advanced.
              MGA lists equipment such as a tumble track and spring floor. Ask which equipment your child’s group will use.
              {' '}<a href="https://www.mga-gymnastics.com/tumbling.html">See MGA’s tumbling groups and equipment</a>
            </li>
            <li>
              <strong>Platinum Force Athletics in Crofton.</strong> Its recreational program offers weekly one-hour classes and
              welcomes children without prior tumbling experience. Confirm your child’s age group before registering.
              {' '}<a href="https://www.platinumforceathletics.com/tumbling-classes">Check Platinum Force’s recreational tumbling</a>
            </li>
            <li>
              <strong>Prince George’s County Parks and Recreation.</strong> The seasonal guide lists floor tumbling and
              Trampoline &amp; Tumbling courses at Fairland in Laurel and the Sports &amp; Learning Complex in Landover.
              Some beginner listings already require a forward roll and a handstand skill.
              {' '}<a href="https://www.pgparks.com/your-guide">Check the county’s current guide for tumbling prerequisites</a>
            </li>
          </ul>
        </section>

        <section id="accessible-gymnastics">
          <h2>Adaptive and accessible gymnastics near Bowie</h2>
          <ul>
            <li>
              <strong>Adaptive gymnastics in Laurel.</strong> Emilia’s lists a dedicated class for children with
              neurological or physical disabilities. Ask how the instructor adapts activities and manages noise
              and crowds during class.{' '}
              <a href="https://www.eagcgym.com/recclasses">See Emilia’s adaptive gymnastics class</a>
            </li>
            <li>
              <strong>Accommodations in county recreation classes.</strong> The{' '}
              <a href="https://www.pgparks.com/facilities/prince-georges-sports-and-learning-complex">
                Prince George’s Sports &amp; Learning Complex
              </a>{' '}
              in Landover offers gymnastics. For a regular county recreation class, register at least two weeks
              before it starts and contact Program Access to request a disability accommodation.{' '}
              <a href="https://www.pgparks.com/things-to-do/disability-services#disability">See how to request a county accommodation</a>
            </li>
          </ul>
          <p>
            If you’re considering a Vortex class in Bowie, <Link to={CONTACT_INQUIRY_PATH}>ask Vortex about class access or participation</Link>{' '}
            before booking. You can ask about the space, noise levels, or what the coach expects children to do independently.
          </p>
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
