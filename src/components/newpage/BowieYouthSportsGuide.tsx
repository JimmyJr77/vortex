import { useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ATHLETIC_DEVELOPMENT_GUIDE } from '../../config/athleticDevelopmentGuide'
import { BOWIE_YOUTH_SPORTS_GUIDE } from '../../config/bowieYouthSportsGuide'
import { PRESCHOOL_GYMNASTICS_GUIDE } from '../../config/preschoolGymnasticsGuide'
import { FIT_AND_FLIP_DROP_IN_HREF } from '../../utils/publicBookingPrograms'
import GuideBreadcrumb from './GuideBreadcrumb'
import GuideByline from './GuideByline'
import './AthleticDevelopmentGuide.css'

export default function BowieYouthSportsGuide() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash])

  return (
    <article className="athletic-guide" aria-labelledby="bowie-youth-sports-title">
      <header className="athletic-guide-hero">
        <div className="athletic-guide-shell athletic-guide-intro">
          <div>
            <GuideBreadcrumb guideLabel={BOWIE_YOUTH_SPORTS_GUIDE.breadcrumbLabel} />
            <h1 id="bowie-youth-sports-title">{BOWIE_YOUTH_SPORTS_GUIDE.heading}</h1>
            <p className="athletic-guide-lead">
              Want to find a team, try a new sport, or give your child a regular way to move?
              Here’s where to look in Bowie and what to check before you sign up.
            </p>
            <GuideByline datePublished={BOWIE_YOUTH_SPORTS_GUIDE.datePublished} dateModified={BOWIE_YOUTH_SPORTS_GUIDE.dateModified} />
          </div>
          <img className="athletic-guide-image" src={BOWIE_YOUTH_SPORTS_GUIDE.image}
            alt={BOWIE_YOUTH_SPORTS_GUIDE.imageAlt} width={900} height={675} fetchPriority="high" />
        </div>
      </header>

      <div className="athletic-guide-body">
        <nav className="athletic-guide-index" aria-label="In this guide">
          <ul>
            <li><a href="#local-programs">Where to look</a></li>
            <li><a href="#choose-an-activity">How to choose an activity</a></li>
            <li><a href="#compare-athletic-training">Compare coached fitness and athletic training</a></li>
            <li><a href="#before-signup">What to check before registering</a></li>
          </ul>
        </nav>

        <section id="local-programs">
          <h2>Where to look for youth sports and athletics in Bowie</h2>
          <p>Start with the organization that runs the program. It can confirm age groups, locations, and registration.</p>
          <ul>
            <li>
              <strong>Bowie Boys &amp; Girls Club.</strong> The club’s track and field program serves ages 5–18,
              with indoor and outdoor seasons. Check the practice location before registering.{' '}
              <a href="https://www.bbgc.com/programs/track-and-field">View track and field</a> ·{' '}
              <a href="https://www.bbgc.com/programs">View all club programs</a>
            </li>
            <li>
              <strong>Bowie recreational baseball.</strong> Bowie Boys &amp; Girls Club offers recreational baseball
              for ages 4–14, with games and practices in Bowie. Start with T-ball in 4U or 5U and coach pitch in
              6U through 8U. Use the club’s birthdate chart to find your child’s division.{' '}
              <a href="https://www.bbgc.com/programs/baseball">Compare Bowie baseball divisions</a>
            </li>
            <li>
              <strong>Bowie FC soccer.</strong> The club’s Developmental program is part of Bowie Boys &amp; Girls Club
              and welcomes U4–U10 players without tryouts. Its competitive Academy has County and Travel teams
              for U8–U18, with tryouts. Ask the club which age group fits your child’s birth date.{' '}
              <a href="https://bowiesoccer.com/programs/">Compare Bowie FC soccer programs</a>
            </li>
            <li>
              <strong>South Bowie Boys &amp; Girls Club.</strong> For 2026–27, Sharks basketball serves ages 5–14.
              The coed Sharks Squirts group introduces ages 5–8 to basketball with three players per side and
              eight-foot baskets. The club also offers sports such as soccer and cheerleading.{' '}
              <a href="https://southbowiesharks.org/winter-sports-are-open/sbbgcc-basketball/">Check South Bowie basketball</a> ·{' '}
              <a href="https://southbowiesharks.org/open-sports/">Check South Bowie Sharks registrations</a>
            </li>
            <li>
              <strong>City of Bowie Municipal Gymnasium.</strong> Check for basketball, volleyball, and other court
              activities. Membership is limited to residents within Bowie’s city limits. Guests need to come with a
              member. Check youth supervision rules before visiting.{' '}
              <a href="https://www.cityofbowie.org/104/Gymnasium">Check city gym membership and rules</a>
              {' '}The city also runs separate Wiggle and Giggle sessions for residents and nonresidents. They’re
              designed for ages 1–6.{' '}
              <a href="https://www.cityofbowie.org/278/Programs-at-the-Gym">See the city’s gym programs</a>
            </li>
            <li>
              <strong>Bowie Ice Arena.</strong> A public skate gives beginners a chance to try the ice before committing
              to group lessons. Check the public session schedule and skate rental details, or look for a Learn-to-Skate
              group that fits your child.{' '}
              <a href="https://www.cityofbowie.org/650/Public-Skating-Sessions">Check public skating</a> ·{' '}
              <a href="https://www.cityofbowie.org/485/Lessons-Camps">View skating lessons</a>
            </li>
            <li>
              <strong>Prince George’s County Parks and Recreation.</strong> Compare leagues, skills classes, and camps
              across sports such as soccer, swimming, and tennis. In PARKS DIRECT, choose Activity Search and filter by
              age and location. Try Bowie Community Center or South Bowie Community Center for nearby options.{' '}
              <a href="https://www.pgparks.com/things-to-do/sports">Explore county youth sports</a> ·{' '}
              <a href="https://help.pgparksdirect.com/a/1416705-how-to-register-for-an-activity">Find and register for a county activity</a>
            </li>
          </ul>
        </section>

        <section id="choose-an-activity">
          <h2>Choose an activity your child wants to come back to</h2>
          <p>
            If your child keeps asking when they can play a game, look for a recreational team. Ask how much time
            beginners spend practicing and playing. If they’re drawn to running or jumping, track and field gives
            them a chance to try individual events in a team setting.
          </p>
          <p>
            If they keep talking about tumbling or learning a cartwheel, look for a gymnastics class matched to
            their age and experience. <Link to="/gymnastics">Explore youth gymnastics at Vortex</Link> and see{' '}
            <Link to="/gymnastics#first-visit">what to expect at their first class</Link>. Compare{' '}
            <Link to="/gymnastics#youth-gymnastics-schedule">weekly youth gymnastics times</Link> before choosing a class.
            For ages 2–5, see <Link to={PRESCHOOL_GYMNASTICS_GUIDE.path}>what children learn in preschool gymnastics</Link>.
          </p>
          <p>
            If they want to get stronger or move with more control, look for coached youth fitness. Fit &amp; Flip
            combines strength work, jumps, and gymnastics-inspired movement. It can give a beginner a place to start
            or support a child who already plays a sport. <Link to="/fit-and-flip">Explore Fit &amp; Flip</Link> or{' '}
            <Link to={FIT_AND_FLIP_DROP_IN_HREF}>check dates for a single Cyclones class</Link>.
          </p>
          <p>
            A single-day class gives your child a chance to try an activity before committing to a weekly schedule.{' '}
            <Link to="/drop-in">See the current Vortex drop-in listings</Link>.
          </p>
        </section>

        <section id="compare-athletic-training">
          <h2>Compare youth fitness and athletic training in Bowie</h2>
          <p>
            If your child wants to get stronger, learn to tumble, or improve how they move for a sport,
            compare what they’ll practice and how they can try a first session.
          </p>
          <ul>
            <li>
              <strong>Vortex Athletics Fit &amp; Flip.</strong> The 90-minute Cyclones classes serve ages 8–11 and 12–15.
              Beginners can practice strength work, jumps, and tumbling progressions. Families can start with one
              class or enroll weekly.{' '}
              <Link to="/fit-and-flip#fit-flip-class-example">See a Fit &amp; Flip class example</Link> ·{' '}
              <Link to={FIT_AND_FLIP_DROP_IN_HREF}>Check Cyclones trial and drop-in dates</Link>
            </li>
            <li>
              <strong>Redline Athletics Bowie.</strong> The Bowie trial page describes a 60-minute small-group
              session for ages 8–18 that includes speed, agility, strength, and power work. It also lists an Intro to
              Sports program for ages 3–7.{' '}
              <a href="https://booking.redlineathletics.com/free-trial-booking-page-bowie">See Redline’s first-session format and ages</a>
            </li>
            <li>
              <strong>The GOAT Lab.</strong> Foundation Lab for ages 6–8 emphasizes coordination and basic
              movements. Youth Lab for ages 9–12 adds running mechanics and changes of direction. Its Performance
              Lab for ages 13 and up starts with an assessment.{' '}
              <a href="https://www.goatlabperformance.com/programs/youth-athlete-development">See the younger age groups</a> ·{' '}
              <a href="https://www.goatlabperformance.com/programs/the-performance-lab">Check how teens start</a>
            </li>
          </ul>
          <p className="mt-4">
            Before booking, ask what a coach will have your child try first and how they’ll adapt it for a
            beginner. If your child already plays a sport, share their practice and game schedule with the coach.
            Confirm whether your first visit is a regular class, a trial session, or a separate assessment.
          </p>
        </section>

        <section id="before-signup">
          <h2>Compare two options before registering</h2>
          <ul>
            <li><strong>Starting group.</strong> Ask whether placement depends on age, grade, or experience, and what the first session looks like for a beginner.</li>
            <li><strong>Weekly schedule.</strong> Compare practice and game times, where sessions take place, and which days work for your family.</li>
            <li><strong>Total cost.</strong> Check whether uniforms, equipment, membership, or competition fees are included. See <Link to="/gymnastics#youth-gymnastics-pricing">youth gymnastics prices</Link> for weekly classes and drop-ins. <Link to="/fit-and-flip#fit-flip-class-pricing">Compare Fit &amp; Flip prices</Link> for youth strength and fitness.</li>
            <li><strong>First visit.</strong> Ask whether your child can observe, try a session, or start with a shorter program.</li>
            <li>
              <strong>Accommodations.</strong> If your child needs a disability accommodation for a county recreation
              program, register at least two weeks before it starts so you can request support.{' '}
              <a href="https://www.pgparks.com/things-to-do/disability-services">See county accommodation requests</a>
            </li>
          </ul>
        </section>

        <aside className="athletic-guide-next" aria-labelledby="bowie-youth-sports-next">
          <h2 id="bowie-youth-sports-next">Find a class at Vortex</h2>
          <p>Browse the class board for current programs. For help judging whether training fits alongside a sport, read the <Link to={ATHLETIC_DEVELOPMENT_GUIDE.path}>parent guide to athletic development</Link>.</p>
          <div className="athletic-guide-actions">
            <Link className="np-button" to="/read-board" data-analytics-cta="browse_classes" data-analytics-section="bowie_youth_sports_guide">
              Browse classes and schedules <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
    </article>
  )
}
