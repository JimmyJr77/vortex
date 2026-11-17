import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ATHLETIC_DEVELOPMENT_GUIDE } from '../../config/athleticDevelopmentGuide'
import { BOWIE_YOUTH_SPORTS_GUIDE } from '../../config/bowieYouthSportsGuide'
import './AthleticDevelopmentGuide.css'

export default function BowieYouthSportsGuide() {
  return (
    <article className="athletic-guide" aria-labelledby="bowie-youth-sports-title">
      <header className="athletic-guide-hero">
        <div className="athletic-guide-shell athletic-guide-intro">
          <div>
            <nav aria-label="Breadcrumb" className="athletic-guide-breadcrumb">
              <Link to="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Bowie youth sports guide</span>
            </nav>
            <h1 id="bowie-youth-sports-title">{BOWIE_YOUTH_SPORTS_GUIDE.heading}</h1>
            <p className="athletic-guide-lead">
              Want to find a team, try a new sport, or give your child a regular way to move?
              Here’s where to look in Bowie and what to check before you sign up.
            </p>
            <p className="athletic-guide-byline">By Vortex Athletics</p>
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
            <li><a href="#before-signup">What to check before registering</a></li>
          </ul>
        </nav>

        <section id="local-programs">
          <h2>Where to look for youth sports and athletics in Bowie</h2>
          <p>Start with the organization that runs the program. It can confirm age groups, locations, and registration.</p>
          <ul>
            <li>
              <strong>Bowie Boys &amp; Girls Club.</strong> Start here for organized sports such as soccer, basketball,
              and recreational baseball. The club also has a track and field program for children who want to run,
              jump, or try field events. <a href="https://www.bbgc.com/programs">View club programs</a> ·{' '}
              <a href="https://www.bbgc.com/programs/track-and-field">View track and field</a>
            </li>
            <li>
              <strong>City of Bowie Municipal Gymnasium.</strong> Check the gym for organized recreation and open
              gym. Review membership and supervision rules before taking a child to an open session.{' '}
              <a href="https://www.cityofbowie.org/104/Gymnasium">Check City gym programs and hours</a>
            </li>
            <li>
              <strong>Prince George’s County Parks and Recreation.</strong> The county lists leagues, skills classes,
              and camps across several sports. Check the location on the individual listing because the catalog covers
              the whole county. <a href="https://www.pgparks.com/things-to-do/sports">Explore county youth sports</a>
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
            their age and experience. <Link to="/gymnastics">Explore youth gymnastics at Vortex</Link>.
          </p>
          <p>
            If they want to get stronger or move with more control, look for coached youth fitness. Fit &amp; Flip
            combines strength work, jumps, and gymnastics-inspired movement. It can give a beginner a place to start
            or support a child who already plays a sport. <Link to="/fit-and-flip">Explore Fit &amp; Flip</Link>.
          </p>
          <p>
            A single-day class gives your child a chance to try an activity before committing to a weekly schedule.{' '}
            <Link to="/drop-in">See the current Vortex drop-in listings</Link>.
          </p>
        </section>

        <section id="before-signup">
          <h2>Compare two options before registering</h2>
          <ul>
            <li><strong>Starting group.</strong> Ask whether placement depends on age, grade, or experience, and what the first session looks like for a beginner.</li>
            <li><strong>Weekly schedule.</strong> Compare practice and game times, where sessions take place, and which days work for your family.</li>
            <li><strong>Total cost.</strong> Check whether uniforms, equipment, membership, or competition fees are included.</li>
            <li><strong>First visit.</strong> Ask whether your child can observe, try a session, or start with a shorter program.</li>
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
