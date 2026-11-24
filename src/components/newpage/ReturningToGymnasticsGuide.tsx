import { useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { BUSINESS_FACILITY_PHOTO, BUSINESS_NAP, CONTACT_INQUIRY_PATH, GYMNASTICS_EQUIPMENT_PATH } from '../../config/contact'
import { RETURNING_TO_GYMNASTICS_GUIDE } from '../../config/returningToGymnasticsGuide'
import { ADULT_DROP_IN_HREF } from '../../utils/publicBookingPrograms'
import GuideBreadcrumb from './GuideBreadcrumb'
import GuideByline from './GuideByline'
import './AthleticDevelopmentGuide.css'

export default function ReturningToGymnasticsGuide() {
  const guide = RETURNING_TO_GYMNASTICS_GUIDE
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash])

  return (
    <article className="athletic-guide" aria-labelledby="returning-to-gymnastics-title">
      <header className="athletic-guide-hero">
        <div className="athletic-guide-shell athletic-guide-intro">
          <div>
            <GuideBreadcrumb guideLabel={guide.breadcrumbLabel} />
            <h1 id="returning-to-gymnastics-title">{guide.heading}</h1>
            <p className="athletic-guide-lead">
              If you did gymnastics as a kid or took a long break as an adult, pick one movement you’d like
              to work toward. A coach can help you choose a starting point based on what you can do today.
            </p>
            <GuideByline datePublished={guide.datePublished} dateModified={guide.dateModified} />
          </div>
          <img className="athletic-guide-image" src={guide.image} alt={guide.imageAlt}
            srcSet={BUSINESS_FACILITY_PHOTO.srcSet}
            sizes="(max-width: 760px) 91vw, (max-width: 1264px) 43vw, 520px"
            width={BUSINESS_FACILITY_PHOTO.width} height={BUSINESS_FACILITY_PHOTO.height} fetchPriority="high" />
        </div>
      </header>

      <div className="athletic-guide-body">
        <nav className="athletic-guide-index" aria-label="In this guide">
          <ul>
            <li><a href="#class-format">Choose a class format</a></li>
            <li><a href="#nearby-adult-gymnastics">Compare nearby classes and open gym</a></li>
            <li><a href="#adult-gymnastics-apparatus">Bars, beam, and vault</a></li>
            <li><a href="#adult-gymnastics-competition">Adult gymnastics competition</a></li>
            <li><a href="#what-to-tell-your-coach">What to tell your coach</a></li>
            <li><a href="#choose-a-starting-movement">Choose a starting movement</a></li>
            <li><a href="#track-your-progress">Keep a short practice note</a></li>
          </ul>
        </nav>

        <section id="class-format">
          <h2>Choose a class where you can get feedback</h2>
          <p>
            In a coach-led recreational class, you can ask for a movement to try and get feedback on it.
            Open gym can offer time for independent practice. Ask how much instruction is available and
            whether the class works on the skills that interest you, such as floor tumbling or balance.
            {' '}<Link to="/adult-gymnastics#class-format">See what to expect in a coached Typhoons class</Link>.
          </p>
          <p>
            USA Gymnastics describes weekly recreational classes and open gyms as ways adults can get
            back into the sport.{' '}
            <a href="https://usagym.org/men/pathways/">USA Gymnastics recreational pathways</a>
          </p>
        </section>

        <section id="nearby-adult-gymnastics">
          <h2>Adult gymnastics classes and open gym near Bowie</h2>
          <p>
            Look for a coached drop-in to try one class, a multi-week course for regular instruction, or open gym
            for time to practice on your own. Ask the provider what feedback and equipment are available.
          </p>
          <ul>
            <li>
              <strong>{BUSINESS_NAP.name} in Bowie.</strong> Typhoons is a 90-minute coached class for ages 18 and up
              that combines conditioning, mobility, and introductory acrobatics. Beginners and returning gymnasts
              can reserve one class or enroll weekly.{' '}
              <Link to={ADULT_DROP_IN_HREF}>See Typhoons drop-in dates</Link>
            </li>
            <li>
              <strong>Prince George’s County Parks and Recreation in Laurel and Landover.</strong> The county lists
              multi-week courses in basic gymnastics for ages 18 and up at Fairland Sports &amp; Aquatics Complex
              and Prince George’s Sports &amp; Learning Complex. Look for adult gymnastics in the current guide.
              {' '}<a href="https://www.pgparks.com/your-guide">Browse the county’s seasonal class guide</a>
            </li>
            <li>
              <strong>Emilia’s Acrobatics, Gymnastics, &amp; Cheer in Laurel.</strong> Its coached adult class
              serves ages 18 and up and focuses on floor and trampoline tumbling.{' '}
              <a href="https://www.eagcgym.com/recclasses">See Emilia’s adult gymnastics class</a>
            </li>
            <li>
              <strong>University of Maryland Gymkana in College Park.</strong> Gymkana offers instructor-led
              tumbling and trampoline classes for ages 14 and up. Choose a class from its multi-week session schedule.
              {' '}<a href="https://sph.umd.edu/student-opportunities/student-organizations-honor-societies-and-honor-programs/gymkana/gymkana-classes">See Gymkana’s adult class options</a>
            </li>
            <li>
              <strong>MGA Gymnastics in Upper Marlboro.</strong> Open gym is for ages 4 through adult and gives
              participants time to practice on gymnastics and tumbling equipment. Coaches can help set up equipment.
              {' '}<a href="https://www.mga-gymnastics.com/opengym.html">Check MGA’s open gym details</a>
            </li>
            <li>
              <strong>Docksiders Gymnastics in Millersville.</strong> Its self-paced adult open gym is for ages 16
              and up. Call to reserve a spot and confirm the current session time.
              {' '}<a href="https://www.docksidersgymnastics.com/adults">See Docksiders’ adult open gym details</a>
            </li>
          </ul>
        </section>

        <section id="adult-gymnastics-apparatus">
          <h2>Where can adults practice bars, beam, and vault?</h2>
          <p>
            If you want feedback on a beam turn or a bar swing, ask whether a coach teaches that event
            during class. If you already know what you want to practice, check which equipment is available
            at open gym.
          </p>
          <ul>
            <li>
              <strong>Coached apparatus practice.</strong> Dynamite in North Bethesda lists balance beam basics,
              uneven bar skills, and vault progressions in its adult gymnastics classes.{' '}
              <a href="https://www.dynamitegc.com/adult-gymnastics">See Dynamite’s adult apparatus classes</a>.
            </li>
            <li>
              <strong>Independent practice.</strong> MGA’s open gym in Upper Marlboro welcomes adults and lists
              bars, rings, and beams. Coaches can help set up equipment.{' '}
              <a href="https://www.mga-gymnastics.com/opengym.html">See MGA’s open gym equipment</a>.
            </li>
          </ul>
          <p className="mt-4">
            At Vortex, Typhoons combines conditioning, mobility, and introductory acrobatics.{' '}
            <Link to={GYMNASTICS_EQUIPMENT_PATH}>See Vortex’s practice beams and training rings</Link>.{' '}
            <Link to={CONTACT_INQUIRY_PATH}>Ask Vortex about Typhoons equipment</Link> before you book if you
            have a specific apparatus or skill in mind.
          </p>
        </section>

        <section id="adult-gymnastics-competition">
          <h2>Can adults compete in gymnastics?</h2>
          <p>
            Typhoons at Vortex is a coached recreational class that combines strength, conditioning,
            and mobility with introductory acrobatics.
          </p>
          <p>
            United Club Gymnastics, formerly NAIGC, offers individual membership to adults ages 18 and up
            regardless of student status or club affiliation. Adults can enter eligible meets as independent
            athletes. Check the Mid-Atlantic calendar listings for a meet that offers your event and level.{' '}
            <a href="https://unitedclubgymnastics.org/join/">Check individual membership</a> ·{' '}
            <a href="https://unitedclubgymnastics.org/events/">Browse the meet calendar</a>
          </p>
        </section>

        <section id="what-to-tell-your-coach">
          <h2>Give your coach three details</h2>
          <ul>
            <li>What you used to practice and roughly how long you’ve been away.</li>
            <li>What you do now and which movements you can repeat comfortably.</li>
            <li>One skill or part of a skill you’d like to work toward.</li>
          </ul>
          <p className="mt-4">
            You might say, “I did floor gymnastics as a teenager. I exercise now, but I haven’t practiced
            supporting my weight on my hands in years. I’d like to work toward a cartwheel.”
            That gives the coach something specific to ask about or watch.
          </p>
        </section>

        <section id="choose-a-starting-movement">
          <h2>Ask what to practice before the whole skill</h2>
          <p>
            In the cartwheel example, a coach might check how you support your weight through your hands
            or have you practice a balanced finish. Ask which part to start with and what the coach wants
            to see you repeat before adding the next part. British Gymnastics encourages clubs to adapt
            adult sessions to each participant’s experience and goals.{' '}
            <a href="https://a.storyblok.com/f/83342/x/68c3ae50a6/final-adult-gymnastics-support-guide-v5.pdf">British Gymnastics adult participation guide</a>
          </p>
        </section>

        <section id="track-your-progress">
          <h2>Keep a short note after class</h2>
          <p>Write down the movement, the coach’s cue, what you could repeat, and one question for next time.</p>
          <p>
            For example, “Balanced finish. The coach asked me to pause at the end. I could hold it on my
            preferred side. Next class I’ll ask what to adjust on the other side.” Bring the note to your
            next session so you and the coach can pick up from there.
          </p>
          <p>If you’re planning around work or other activities, <Link to="/adult-gymnastics#adult-weekly-training">see how to start with one adult gymnastics class a week</Link>.</p>
        </section>

        <aside className="athletic-guide-next" aria-labelledby="returning-to-gymnastics-next">
          <h2 id="returning-to-gymnastics-next">Try a coached class in Bowie, Maryland</h2>
          <p>Typhoons is Vortex’s gymnastics and acrobatics class for adults ages 18 and up.</p>
          <div className="athletic-guide-actions">
            <Link className="np-button" to="/adult-gymnastics" data-analytics-cta="explore_adult_gymnastics" data-analytics-section="returning_to_gymnastics_guide">
              Explore adult gymnastics <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className="athletic-guide-trial" to="/adult-gymnastics#adult-class-pricing" data-analytics-cta="compare_adult_class_prices" data-analytics-section="returning_to_gymnastics_guide">
              Compare monthly enrollment and drop-in prices <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
    </article>
  )
}
