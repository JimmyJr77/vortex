import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BUSINESS_FACILITY_PHOTO } from '../../config/contact'
import { RETURNING_TO_GYMNASTICS_GUIDE } from '../../config/returningToGymnasticsGuide'
import GuideBreadcrumb from './GuideBreadcrumb'
import GuideByline from './GuideByline'
import './AthleticDevelopmentGuide.css'

export default function ReturningToGymnasticsGuide() {
  const guide = RETURNING_TO_GYMNASTICS_GUIDE

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
          </p>
          <p>
            USA Gymnastics describes weekly recreational classes and open gyms as ways adults can get
            back into the sport.{' '}
            <a href="https://usagym.org/men/pathways/">USA Gymnastics recreational pathways</a>
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
        </section>

        <aside className="athletic-guide-next" aria-labelledby="returning-to-gymnastics-next">
          <h2 id="returning-to-gymnastics-next">Try a coached class in Bowie, Maryland</h2>
          <p>Typhoons is Vortex’s gymnastics and acrobatics class for adults ages 18 and up.</p>
          <div className="athletic-guide-actions">
            <Link className="np-button" to="/adult-gymnastics" data-analytics-cta="explore_adult_gymnastics" data-analytics-section="returning_to_gymnastics_guide">
              Explore adult gymnastics <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
    </article>
  )
}
