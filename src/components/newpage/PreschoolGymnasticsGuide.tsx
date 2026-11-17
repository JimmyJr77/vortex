import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PRESCHOOL_GYMNASTICS_GUIDE } from '../../config/preschoolGymnasticsGuide'
import { DEVELOPMENTAL_GYMNASTICS_HREF } from '../../utils/publicBookingPrograms'
import GuideBreadcrumb from './GuideBreadcrumb'
import GuideByline from './GuideByline'
import './AthleticDevelopmentGuide.css'

export default function PreschoolGymnasticsGuide() {
  return (
    <article className="athletic-guide" aria-labelledby="preschool-gymnastics-title">
      <header className="athletic-guide-hero">
        <div className="athletic-guide-shell athletic-guide-intro">
          <div>
            <GuideBreadcrumb guideLabel={PRESCHOOL_GYMNASTICS_GUIDE.breadcrumbLabel} />
            <h1 id="preschool-gymnastics-title">{PRESCHOOL_GYMNASTICS_GUIDE.heading}</h1>
            <p className="athletic-guide-lead">
              At Vortex in Bowie, Maryland, toddlers explore balance and jumping with a caregiver.
              Preschoolers practice simple gymnastics shapes, follow short coach cues, and take turns
              with their group.
            </p>
            <GuideByline datePublished={PRESCHOOL_GYMNASTICS_GUIDE.datePublished} dateModified={PRESCHOOL_GYMNASTICS_GUIDE.dateModified} />
          </div>
          <img
            className="athletic-guide-image"
            src={PRESCHOOL_GYMNASTICS_GUIDE.image}
            srcSet={`/campaign_early_dev_hero-720.webp 720w, ${PRESCHOOL_GYMNASTICS_GUIDE.image} 1600w`}
            sizes="(max-width: 760px) 90vw, (max-width: 1280px) 42vw, 520px"
            alt={PRESCHOOL_GYMNASTICS_GUIDE.imageAlt}
            width={1600}
            height={1065}
            fetchPriority="high"
          />
        </div>
      </header>

      <div className="athletic-guide-body">
        <nav className="athletic-guide-index" aria-label="In this guide">
          <ul>
            <li><a href="#gymnastics-before-age-2">Gymnastics before age 2</a></li>
            <li><a href="#ages-2-3">Ages 2–3 with a caregiver</a></li>
            <li><a href="#ages-4-5">Ages 4–5 in a group</a></li>
            <li><a href="#gymnastics-for-siblings">Gymnastics for siblings</a></li>
            <li><a href="#progress">What progress can look like</a></li>
          </ul>
        </nav>

        <section id="gymnastics-before-age-2">
          <h2>Parent-and-child gymnastics before age 2</h2>
          <p>
            Dirt Devils at Vortex starts at age 2. For younger toddlers, Prince George’s County offers
            One, Two &amp; You from 18 months at Fairland Sports Complex in Laurel. One adult participates
            with each child. Check the current session’s age rules and dates before registering.{' '}
            <a href="https://www.pgparks.com/your-guide">Find One, Two &amp; You in the county’s class guide</a> ·{' '}
            <a href="https://www.pgparks.com/facilities/fairland-aquatic-center">See the Fairland location</a>
          </p>
        </section>

        <section id="ages-2-3">
          <h2>What toddlers practice in Dirt Devils, ages 2–3</h2>
          <p>
            A parent or caregiver joins the toddler in this coach-led Mommy &amp; Me class. Children explore
            balance, rolling, jumping, and moving over obstacles through play. The caregiver can repeat the
            coach’s cue and help the child take their turn as the coach directs.
          </p>
          <p>
            A balance turn might begin with a coach asking the child to take one step and pause. A toddler
            might watch the demonstration, step with their caregiver nearby, then try the pause again.
            The child gets to practice listening, starting a movement, and stopping when asked.
          </p>
        </section>

        <section id="ages-4-5">
          <h2>What preschoolers practice in Twisters, ages 4–5</h2>
          <p>
            Preschoolers build coordination and body awareness as they try introductory gymnastics with
            their group. A coach can show a simple shape, such as reaching tall or making a tuck, and give
            each child a turn to try it. Practicing a tuck helps a child notice where their knees and torso
            are in relation to each other.
          </p>
          <p>
            A jumping activity might pair two short cues, like jump and then pause on two feet. That gives
            the child a chance to practice a steady landing and get ready for the next turn. Waiting,
            watching the demonstration, and returning to the group are skills children practice alongside
            the gymnastics movements.
          </p>
        </section>

        <section id="gymnastics-for-siblings">
          <h2>Can siblings take gymnastics on the same day?</h2>
          <p>
            Start with a class that matches each child’s age and experience. A 4-year-old can look for
            Twisters while a 7-year-old beginner looks for Tornadoes. Open both groups in the weekly
            schedule and look for times that overlap. Twisters usually lasts about an hour and Tornadoes
            about 90 minutes, so check when each class ends and whether both have room.{' '}
            <Link to="/gymnastics#youth-gymnastics-schedule">Compare weekly youth gymnastics times</Link>.
          </p>
          <p>
            For weekly enrollment, use one family account and choose a class and time for each athlete.
            When setting up an account, use Add member for each child. Book free trials one athlete at a time.{' '}
            <Link to={DEVELOPMENTAL_GYMNASTICS_HREF}>Choose recurring gymnastics classes</Link>.
          </p>
        </section>

        <section id="progress">
          <h2>Signs your child is making progress</h2>
          <p>Look for changes in how your child approaches a familiar activity.</p>
          <ul>
            <li><strong>Joining in.</strong> A child who usually watches starts to take a turn.</li>
            <li><strong>Following a cue.</strong> They hear “freeze” and pause, or copy one part of a shape the coach shows.</li>
            <li><strong>Controlling a movement.</strong> They come to a steadier stop, or repeat a movement with less prompting.</li>
          </ul>
          <p className="mt-4">
            After class, ask the coach which movement your child was working on and what they’ll practice
            next. That gives you something specific to look for the next time they try it.
          </p>
        </section>

        <aside className="athletic-guide-next" aria-labelledby="preschool-gymnastics-next">
          <h2 id="preschool-gymnastics-next">Plan your first class in Bowie</h2>
          <p>
            Use your child’s age on the day they’ll attend the Vortex trial. If they’ll be 4 that day,
            look for <Link to="/gymnastics#preschool">Twisters</Link>. Children must be potty trained for a
            Dirt Devils trial. You can also see{' '}
            <Link to="/gymnastics#gymnastics-attire">what to wear to class</Link>.
          </p>
          <div className="athletic-guide-actions">
            <Link className="np-button" to="/gymnastics#first-visit" data-analytics-cta="free_trial_section" data-analytics-section="preschool_gymnastics_guide">
              Find a free gymnastics trial <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
    </article>
  )
}
