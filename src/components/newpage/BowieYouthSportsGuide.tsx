import { useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ATHLETIC_DEVELOPMENT_GUIDE } from '../../config/athleticDevelopmentGuide'
import { BOWIE_YOUTH_SPORTS_GUIDE } from '../../config/bowieYouthSportsGuide'
import { GYMNASTICS_VS_TUMBLING_GUIDE } from '../../config/gymnasticsVsTumblingGuide'
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
            srcSet={BOWIE_YOUTH_SPORTS_GUIDE.imageSrcSet}
            sizes="(max-width: 760px) 91vw, (max-width: 1264px) 43vw, 520px"
            alt={BOWIE_YOUTH_SPORTS_GUIDE.imageAlt} width={900} height={675} fetchPriority="high" />
        </div>
      </header>

      <div className="athletic-guide-body">
        <nav className="athletic-guide-index" aria-label="In this guide">
          <ul>
            <li><a href="#local-programs">Where to look</a></li>
            <li><a href="#indoor-winter-sports">Indoor winter sports</a></li>
            <li><a href="#choose-an-activity">How to choose an activity</a></li>
            <li><a href="#compare-athletic-training">Compare coached fitness and athletic training</a></li>
            <li><a href="#fitness-without-a-team">Fitness without joining a team</a></li>
            <li><a href="#homeschool-pe">Homeschool gymnastics and PE</a></li>
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
              <strong>BallerTykes basketball.</strong> The Bowie program serves ages 2–8. Its Rookies group
              introduces ages 2–3 to handling the ball through games. Use the registration page to confirm your
              child’s age group and current Bowie sessions.{' '}
              <a href="https://www.ballertykes.com/rookies">See what Rookies practice</a> ·{' '}
              <a href="https://www.ballertykes.com/register">Check BallerTykes sessions in Bowie</a>
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
            </li>
            <li>
              <strong>Bowie Ice Arena.</strong> A public skate gives beginners a chance to try the ice before committing
              to group lessons. Check the public session schedule and skate rental details, or look for a Learn-to-Skate
              group that fits your child.{' '}
              <a href="https://www.cityofbowie.org/650/Public-Skating-Sessions">Check public skating</a> ·{' '}
              <a href="https://www.cityofbowie.org/485/Lessons-Camps">View skating lessons</a>
            </li>
            <li>
              <strong>Learn to swim in Bowie and nearby.</strong> NotYetPro offers private, semi-private, and trio
              swim lessons at Sport Fit Bowie. Prince George’s County offers youth lessons for ages 6–12, teen
              lessons for ages 13–17, and adapted lessons for county residents with disabilities ages 4 and up.
              Check your child’s age group and the pool location before registering.{' '}
              <a href="https://www.notyetpro.org/swimschool/book/">Check NotYetPro lessons in Bowie</a> ·{' '}
              <a href="https://www.pgparks.com/things-to-do/aquatics">Check county swim lessons</a>
            </li>
            <li>
              <strong>Prince George’s County Parks and Recreation.</strong> Compare leagues, skills classes, and camps
              across sports such as soccer and tennis. In PARKS DIRECT, choose Activity Search and filter by
              age and location. Try Bowie Community Center or South Bowie Community Center for nearby options.{' '}
              <a href="https://www.pgparks.com/things-to-do/sports">Explore county youth sports</a> ·{' '}
              <a href="https://help.pgparksdirect.com/a/1416705-how-to-register-for-an-activity">Find and register for a county activity</a>
            </li>
          </ul>
        </section>

        <section id="indoor-winter-sports">
          <h2>Indoor winter sports for kids near Bowie</h2>
          <ul>
            <li>
              <strong>Soccer skills and small-sided games.</strong> DMV Marksmen’s indoor junior academy serves ages
              4–10 at Holy Trinity’s Reiber Center in Glenn Dale. Bowie FC’s winter futsal is part of its Academy
              County and Travel team programs.{' '}
              <a href="https://www.marksmenelite.com/marksmen-jr-academy--ages-6-10">Check indoor soccer training</a> ·{' '}
              <a href="https://bowiesoccer.com/programs/">See the Bowie FC futsal pathway</a>
            </li>
            <li>
              <strong>Winter basketball league.</strong> South Bowie Sharks teams practice and play league games.
              Check registration and ask where your child’s team will play.{' '}
              <a href="https://southbowiesharks.org/winter-sports-are-open/sbbgcc-basketball/">Check Sharks winter basketball</a>
            </li>
            <li>
              <strong>Indoor fitness and athletic development.</strong> Fit &amp; Flip’s Cyclones classes in Bowie
              combine strength work, jumps, and tumbling for ages 8–11 and 12–15. Check dates for a single class
              or compare times for weekly enrollment.{' '}
              <Link to={FIT_AND_FLIP_DROP_IN_HREF}>Check Cyclones drop-in dates</Link> ·{' '}
              <Link to="/fit-and-flip#fit-flip-schedule">See weekly Fit &amp; Flip times</Link>
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
            {' '}For a class focused on floor and track skills, <Link to={`${GYMNASTICS_VS_TUMBLING_GUIDE.path}#nearby-tumbling-classes`}>compare dedicated tumbling classes near Bowie</Link>.
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

        <section id="fitness-without-a-team">
          <h2>Fitness without joining a team</h2>
          <p>
            A weekly class teaches skills in stages. A movement session or open gym gives kids a way to be active
            on days that work for your family.
          </p>
          <ul>
            <li>
              <strong>Coached gymnastics for kids and teens.</strong> Vortex’s beginner Tornadoes classes teach
              rolls, cartwheels, and landings. First-time gymnasts ages 6–17 can look for a trial. Teens who have
              trained before can look for a placement assessment.{' '}
              <Link to="/gymnastics#teen">See gymnastics options for teens</Link> ·{' '}
              <Link to="/gymnastics#first-visit">Find a first gymnastics class</Link>
            </li>
            <li>
              <strong>Recreational open gym for older kids.</strong> South Bowie Community Center lists separate
              Pre-Teen Night sessions for ages 10–12 and Teen Night sessions for ages 13–17. Check current open gym
              hours and admission before you go.{' '}
              <a href="https://www.pgparks.com/facilities/south-bowie-community-center">See South Bowie’s open gym hours</a>
            </li>
            <li>
              <strong>Playful movement for younger children.</strong> Bowie’s Wiggle and Giggle sessions are designed
              for ages 1–6, and children ages 7–10 can also participate. Individual sessions can feature dance, yoga,
              tumbling, or other movement activities.{' '}
              <a href="https://www.cityofbowie.org/278/Programs-at-the-Gym">Check Bowie’s upcoming movement sessions</a>
            </li>
          </ul>
        </section>

        <section id="homeschool-pe">
          <h2>Homeschool gymnastics and PE near Bowie</h2>
          <ul>
            <li>
              <strong>Weekly gymnastics or a single class at Vortex Athletics in Bowie.</strong> Use the regular
              class schedule to match your child’s age and experience. For a younger child, start with preschool
              gymnastics for ages 2–5. For a school-age child, see which developmental gymnastics classes offer a
              trial.{' '}
              <Link to="/gymnastics#youth-gymnastics-schedule">Check Vortex’s weekly gymnastics times</Link> ·{' '}
              <Link to="/gymnastics#first-visit">Find a gymnastics trial</Link> ·{' '}
              <Link to="/drop-in">Browse available drop-in classes</Link>
            </li>
            <li>
              <strong>Daytime homeschool gymnastics in Landover.</strong> Prince George’s Sports &amp; Learning
              Complex lists homeschool gymnastics for individual enrollment. Search the county’s current guide
              for “Home-School” and check the age range and prerequisites for the specific class. The Silver &amp;
              Gold listing calls for prior Bronze-level experience.{' '}
              <a href="https://www.pgparks.com/your-guide">Look up seasonal homeschool classes</a>
            </li>
            <li>
              <strong>PE for a homeschool group or co-op.</strong> The same county complex offers structured PE
              for homeschool groups ages 5–17, with one-hour weekly lessons over six weeks. Ask the complex
              about group size, dates, and fees.{' '}
              <a href="https://www.pgparks.com/facilities/prince-georges-sports-and-learning-complex">See the county’s homeschool group program</a>
            </li>
          </ul>
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
