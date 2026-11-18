import { useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ATHLETIC_DEVELOPMENT_GUIDE } from '../../config/athleticDevelopmentGuide'
import { BOWIE_YOUTH_SPORTS_GUIDE } from '../../config/bowieYouthSportsGuide'
import { GYMNASTICS_VS_TUMBLING_GUIDE } from '../../config/gymnasticsVsTumblingGuide'
import { PRESCHOOL_GYMNASTICS_GUIDE } from '../../config/preschoolGymnasticsGuide'
import { DEVELOPMENTAL_GYMNASTICS_DROP_IN_HREF, FIT_AND_FLIP_DROP_IN_HREF } from '../../utils/publicBookingPrograms'
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
            <li><a href="#youth-gymnastics-classes">Youth gymnastics classes near Bowie</a></li>
            <li><a href="#youth-cheerleading">Youth cheerleading in Bowie</a></li>
            <li><a href="#indoor-winter-sports">Indoor winter sports</a></li>
            <li><a href="#choose-an-activity">How to choose an activity</a></li>
            <li><a href="#first-sports-ages-2-5">First sports classes for ages 2–5</a></li>
            <li><a href="#compare-athletic-training">Compare coached fitness and athletic training</a></li>
            <li><a href="#high-school-sports-training">High school sports training</a></li>
            <li><a href="#youth-team-training">Youth team training</a></li>
            <li><a href="#fitness-without-a-team">Fitness without joining a team</a></li>
            <li><a href="#parkour-and-ninja">Parkour, ninja classes, and obstacle courses</a></li>
            <li><a href="#teen-fitness-rooms">Fitness rooms for teens</a></li>
            <li><a href="#homeschool-pe">Homeschool gymnastics and PE</a></li>
            <li><a href="#before-signup">What to check before registering</a></li>
            <li><a href="#lower-cost-youth-sports">Lower-cost youth sports and fitness</a></li>
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
              eight-foot baskets.{' '}
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
              <a href="https://www.cityofbowie.org/485/Lessons-Camps">View skating lessons</a> ·{' '}
              <a href="#youth-ice-hockey">Compare youth ice hockey programs</a>
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

        <section id="youth-gymnastics-classes">
          <h2>Compare youth gymnastics classes near Bowie</h2>
          <p>
            Start with your child’s age and the skills they can already do comfortably. Ask which class takes
            first-time gymnasts, how coaches place children with experience, and whether you can try a class
            before enrolling.
          </p>
          <ul>
            <li>
              <strong>Vortex Athletics and Gymnastics in Bowie.</strong> We offer caregiver classes for ages 2–3 and
              preschool gymnastics for ages 4–5. Beginners ages 6–17 can look for a Tornadoes trial. Gymnasts in
              that age range who’ve taken classes before can look for a Trial Assessment to find a starting level.{' '}
              <Link to="/gymnastics">Compare Vortex gymnastics classes by age and level</Link> ·{' '}
              <Link to="/gymnastics#youth-gymnastics-schedule">See weekly Vortex gymnastics times</Link> ·{' '}
              <Link to="/gymnastics#first-visit">See what to expect at a first Vortex class</Link> ·{' '}
              <Link to="/gymnastics#trampoline-tumbling">See how Vortex teaches floor tumbling in group classes</Link>
            </li>
            <li>
              <strong>Train For Greatness in Bowie.</strong> Its girls’ beginner and intermediate classes start at age 5.
              The beginner class introduces tumbling, beam, bars, and vault. The gym also lists an advanced group
              and competitive team evaluations by request. For private gymnastics lessons, ask when booking whether
              your athlete will work one-on-one. A private session can include up to three athletes.{' '}
              <a href="https://www.trainforgreatnessmd.com/gymnastics">Compare Train For Greatness class levels</a> ·{' '}
              <a href="https://www.trainforgreatnessmd.com/private-lessons">Check private gymnastics lesson options</a>
            </li>
            <li>
              <strong>Thrive Gym on Defense Highway.</strong> Thrive lists toddler and preschool
              classes, grade-school gymnastics for ages 5–12, and middle and high school gymnastics for ages
              10–18. If your child is 10–12, ask which group fits their experience.{' '}
              <a href="https://www.thrivegym.org/classes">Check Thrive’s Defense Highway gymnastics listings</a>
            </li>
            <li>
              <strong>Docksiders Gymnastics in Millersville.</strong> Docksiders lists preschool classes and
              separate boys’ and girls’ programs. Families can request an evaluation to help choose a starting
              class.{' '}
              <a href="https://www.docksidersgymnastics.com/class-info">Compare Docksiders class levels</a>
            </li>
          </ul>
        </section>

        <section id="youth-cheerleading">
          <h2>Youth cheerleading in Bowie</h2>
          <p>
            Start with where your child wants to perform. Sideline cheer takes place at games. All-star programs
            can teach routine skills in a beginner group or prepare a team for competition.
          </p>
          <ul>
            <li>
              <strong>Sideline cheer.</strong> South Bowie Boys &amp; Girls Club lists sideline cheer for ages 5–14
              during football season. Athletes learn motions, jumps, and cheers. Check the next season’s age
              cutoff and registration.{' '}
              <a href="https://southbowiesharks.org/lady-sharks-cheer-program/sbbgc-sideline-cheer/">See the Lady Sharks sideline cheer program</a>.
            </li>
            <li>
              <strong>All-star cheer.</strong> POWER Athletics in Bowie lists a noncompetitive Exhibition level
              and a Novice level that performs at evaluated events. Ask which level fits a first-time cheerleader,
              what the evaluation involves, and which events require travel.{' '}
              <a href="https://www.powerathleticsmd.com/">Compare POWER Athletics cheer levels</a>.
            </li>
            <li>
              <strong>Tumbling or strength practice.</strong>{' '}
              <Link to="/gymnastics#trampoline-tumbling">Find coached floor tumbling in Vortex’s group gymnastics classes</Link>.
              For a class focused on floor or track skills,{' '}
              <Link to={`${GYMNASTICS_VS_TUMBLING_GUIDE.path}#nearby-tumbling-classes`}>compare dedicated tumbling classes</Link>{' '}
              and check what your child needs to know before starting. Fit &amp; Flip offers athletes ages 8–15 coached
              strength, jumping, and body control practice alongside their sport.{' '}
              <Link to="/fit-and-flip#body-control">See what Fit &amp; Flip athletes practice</Link>.
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
          <h3 id="youth-ice-hockey" className="athletic-guide-subheading scroll-mt-24">Youth ice hockey in Bowie</h3>
          <p>
            If your child is new to the ice, try a{' '}
            <a href="https://www.cityofbowie.org/650/Public-Skating-Sessions">public skating session</a> at Bowie Ice
            Arena or build basic skills in the city’s{' '}
            <a href="https://www.cityofbowie.org/485/Lessons-Camps">Learn-to-Skate group lessons</a>. Once they can
            skate, Bowie Hockey Club’s{' '}
            <a href="https://www.bowiehockey.org/program/bhc-learn-to-play/13025">Future Bruins Learn-to-Play program</a>{' '}
            introduces hockey skating and stickhandling. Ask the club which session fits your child’s age and skills.
          </p>
          <p>
            The club’s{' '}
            <a href="https://www.bowiehockey.org/program/bhc-recreational-program/12276">recreational hockey program</a>{' '}
            lists coed divisions for ages 4–18 and requires no tryout. The club expects basic skating skills and
            welcomes players who are new to hockey. Check division and equipment requirements with the club.
          </p>
        </section>

        <section id="choose-an-activity">
          <h2>Choose an activity your child wants to come back to</h2>
          <p>
            If your child keeps asking when they can play a game, look for a recreational team. Ask how much time
            beginners spend practicing and playing. If they’re drawn to running or jumping, track and field gives
            them a chance to try individual events in a team setting.
          </p>
          <p>
            If they keep talking about learning a cartwheel,{' '}
            <a href="#youth-gymnastics-classes">compare gymnastics classes near Bowie</a>.
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
          <h3 id="first-sports-ages-2-5" className="athletic-guide-subheading scroll-mt-24">
            First sports classes for ages 2–5 in Bowie
          </h3>
          <ul>
            <li>
              <strong>Gymnastics with a caregiver, ages 2–3.</strong> In Dirt Devils at Vortex, plan to join your
              child on the floor as they practice balancing, rolling, and jumping. Children must be potty
              trained for a trial.
            </li>
            <li>
              <strong>Group gymnastics, ages 4–5.</strong> In Twisters at Vortex, a coach shows the group what to
              try. Children practice simple shapes and landings and take turns.{' '}
              <Link to="/gymnastics#preschool">Compare Dirt Devils and Twisters</Link>.
            </li>
            <li>
              <strong>Starting with a ball.</strong> BallerTykes Rookies introduces basketball through games for
              ages 2–3. Bowie Community Center’s preschool soccer class teaches kicking, passing, and dribbling
              for ages 3–5.{' '}
              <a href="https://www.ballertykes.com/register">Check BallerTykes dates in Bowie</a> ·{' '}
              <a href="https://www.pgparks.com/your-guide">Find preschool soccer in the county guide</a>
            </li>
          </ul>
          <p className="mt-4">
            Before booking, confirm the age cutoff, whether an adult joins the class, and what your child should
            bring. <Link to="/gymnastics#first-visit">See what to expect at a first Vortex gymnastics class</Link>.
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
              <a href="https://www.goatlabperformance.com/programs/the-performance-lab">See the Performance Lab assessment</a>
            </li>
          </ul>
          <p className="mt-4">
            Before booking, ask what a coach will have your child try first and how they’ll adapt it for a
            beginner. Confirm whether your first visit is a regular class, a trial session, or a separate assessment.
          </p>
          <h3 id="high-school-sports-training" className="athletic-guide-subheading scroll-mt-24">
            Sports performance training for high school athletes
          </h3>
          <p>
            Fit &amp; Flip enrolls through age 15. Athletes ages 16–17 looking for coached speed, agility, and
            strength training can compare{' '}
            <a href="https://booking.redlineathletics.com/free-trial-booking-page-bowie">Redline’s small-group trial</a>{' '}
            and <a href="https://www.goatlabperformance.com/programs/the-performance-lab">The GOAT Lab’s assessment</a>.
            Share your teen’s practice and game schedule when you ask about times.
          </p>
          <p>
            If your teen wants to learn tumbling skills, <Link to="/gymnastics#teen">see Vortex’s gymnastics options for teens</Link>.
          </p>
        </section>

        <section id="youth-team-training">
          <h2>Youth sports team training in Bowie</h2>
          <p>
            Families can register an athlete for a weekly Fit &amp; Flip group class to practice strength,
            jumps, and body control for different sports.{' '}
            <Link to="/fit-and-flip#fit-flip-schedule">See recurring Fit &amp; Flip class times</Link>.
          </p>
          <p>
            Coaches booking for a whole roster can compare{' '}
            <a href="https://redlineathletics.com/location/bowie/#programs">Redline Athletics Bowie’s team training</a>,
            which is designed around the team’s schedule and goals, and{' '}
            <a href="https://www.goatlabperformance.com/programs/team-training">The GOAT Lab’s team training</a>,
            which adapts sessions to the group’s age, sport, and level. Share the roster size, age range,
            and possible training dates when you contact a program.
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
          <h3 id="parkour-and-ninja" className="athletic-guide-subheading scroll-mt-24">
            Parkour, ninja classes, and obstacle courses near Bowie
          </h3>
          <ul>
            <li>
              <strong>Beginner parkour and Little Ninja.</strong> The county lists Little Ninja for ages 3–5 and
              beginner parkour for ages 7–10 at Fairland Sports Complex. Parkour introduces vaulting, jumping,
              rolling, and climbing. Look for the next session in the{' '}
              <a href="https://www.pgparks.com/your-guide">county’s seasonal activity guide</a>.
            </li>
            <li>
              <strong>Coached obstacle skills.</strong> MGA Gymnastics lists one-hour Ninja Squad classes that work
              on handholds, balance across blocks, and the warped wall. Ask which class fits your child’s age.{' '}
              <a href="https://www.mga-gymnastics.com/ninja.html">See MGA’s Ninja Squad classes</a>.
            </li>
            <li>
              <strong>Obstacle-course play in Bowie.</strong> Sky Zone Bowie lists a Ninja Warrior Course as a
              park attraction. Check the attraction rules and ticket options before your visit.{' '}
              <a href="https://www.skyzone.com/bowie/attractions/ninja-warrior-course/">See Sky Zone’s Ninja Warrior Course</a>.
            </li>
            <li>
              <strong>Coached strength, jumping, and tumbling in Bowie.</strong> Fit &amp; Flip Cyclones groups
              athletes by ages 8–11 and 12–15.{' '}
              <Link to="/fit-and-flip#fit-flip-schedule">See weekly Fit &amp; Flip class times</Link>.
            </li>
          </ul>
          <h3 id="teen-fitness-rooms" className="athletic-guide-subheading scroll-mt-24">
            Which gyms in Bowie can teens use?
          </h3>
          <p>
            Teens ages 13–17 who live in Prince George’s or Montgomery County can use the fitness rooms at{' '}
            <a href="https://www.pgparks.com/facilities/bowie-community-center">Bowie Community Center</a> and{' '}
            <a href="https://www.pgparks.com/facilities/south-bowie-community-center">South Bowie Community Center</a>{' '}
            with a free Youth ID. Ages 13–15 need supervision from an adult with a valid fitness pass.{' '}
            <a href="https://www.pgparks.com/facilities-rentals/community-center-fees">Check the county’s Youth ID rules</a>.
          </p>
          <p>
            The <a href="https://www.cityofbowie.org/104/Gymnasium">city-run Bowie Gymnasium</a> offers court
            activities and has no fitness equipment. For a coached option, Vortex’s 90-minute Cyclones classes
            for ages 12–15 include strength work, jumps, and tumbling.{' '}
            <Link to="/fit-and-flip#fit-flip-schedule">See weekly Cyclones class times</Link>.
          </p>
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
              <Link to={DEVELOPMENTAL_GYMNASTICS_DROP_IN_HREF}>Browse youth gymnastics drop-in classes</Link>
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

        <section id="lower-cost-youth-sports">
          <h2>Where to find lower-cost youth sports and fitness</h2>
          <ul>
            <li>
              <strong>Bowie City Gymnasium and Ice Arena.</strong> Families who live within city limits and
              receive a qualifying benefit can apply for 50% off eligible city-run youth camps and classes
              at these facilities.{' '}
              <a href="https://www.cityofbowie.org/2987/Reduced-Fees-Program">Check Bowie’s reduced-fee eligibility and application</a>
            </li>
            <li>
              <strong>Prince George’s County recreation.</strong> County residents experiencing financial hardship
              can apply for help with eligible recreation programs that cost more than $35, including some
              gymnastics classes and group swim lessons. The county excludes sports team registrations and
              programs run by Boys &amp; Girls Clubs.{' '}
              <a href="https://www.pgparks.com/things-to-do/fee-assistance-scholarships">Check county fee assistance and how to apply</a>
            </li>
          </ul>
          <p className="mt-4">
            At Vortex, eligible athletes ages 8–15 can <Link to="/fit-and-flip#training-fit">look for a free Fit &amp; Flip trial</Link>.
          </p>
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
