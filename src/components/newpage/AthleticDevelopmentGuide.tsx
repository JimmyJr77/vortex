import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { ATHLETIC_DEVELOPMENT_GUIDE } from '../../config/athleticDevelopmentGuide'
import { BOWIE_YOUTH_SPORTS_GUIDE } from '../../config/bowieYouthSportsGuide'
import GuideByline from './GuideByline'
import './AthleticDevelopmentGuide.css'

const sections = [
  { id: 'youth-sports', label: 'How it fits with youth sports' },
  { id: 'movement-examples', label: 'Examples of athleticism development' },
  { id: 'first-class', label: 'What to watch for in class' },
  { id: 'progress', label: 'How to spot progress' },
  { id: 'questions', label: 'Questions for the coach' },
] as const

export default function AthleticDevelopmentGuide() {
  return (
    <article className="athletic-guide" aria-labelledby="athletic-guide-title">
      <header className="athletic-guide-hero">
        <div className="athletic-guide-shell athletic-guide-intro">
          <div>
            <nav aria-label="Breadcrumb" className="athletic-guide-breadcrumb">
              <Link to="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Parent guide</span>
            </nav>
            <h1 id="athletic-guide-title">{ATHLETIC_DEVELOPMENT_GUIDE.heading}</h1>
            <p className="athletic-guide-lead">
              Athleticism development helps children build strength, speed, and body control they can use in
              sports and active play. Here’s what those skills look like in a coached class and how to decide
              if the class fits your child.
            </p>
            <GuideByline datePublished={ATHLETIC_DEVELOPMENT_GUIDE.datePublished} dateModified={ATHLETIC_DEVELOPMENT_GUIDE.dateModified} />
          </div>
          <img
            className="athletic-guide-image"
            src={ATHLETIC_DEVELOPMENT_GUIDE.image}
            srcSet={ATHLETIC_DEVELOPMENT_GUIDE.imageSrcSet}
            sizes="(max-width: 760px) 91vw, (max-width: 1200px) 42vw, 520px"
            alt={ATHLETIC_DEVELOPMENT_GUIDE.imageAlt}
            width={1536}
            height={1024}
            fetchPriority="high"
          />
        </div>
      </header>

      <div className="athletic-guide-body">
        <nav className="athletic-guide-index" aria-label="In this guide">
          <ul>
            {sections.map(({ id, label }) => <li key={id}><a href={'#' + id}>{label}</a></li>)}
          </ul>
        </nav>

        <section id="youth-sports">
          <h2>How athletic development fits alongside youth sports</h2>
          <p>
            At basketball practice, a player learns to read a defender and decide when to pass. In an athletic
            development class, they can spend time on the movement underneath that play, such as stopping under
            control before changing direction. A gymnast uses a similar skill when they slow down into a steady landing.
          </p>
          <p>
            Strength helps athletes produce and absorb force. Explosiveness helps them use it quickly for a first step
            or takeoff. Body control helps them stay balanced and organized as they move. These qualities work
            together across sports, and each sport still needs practice of its own skills.
          </p>
          <p>
            Before adding a class, look at a typical week. Count PE, practices, games, and the active play your
            child already enjoys. Ask them to name one thing they’d like to practice, such as balancing or changing
            direction with more control. Choose a class if they want to try it and the schedule leaves room for
            their other activities and time to rest.
          </p>
          <p>
            Children who aren’t on a team can start with active play or a coached class they enjoy. For nearby choices,
            see our <Link to={BOWIE_YOUTH_SPORTS_GUIDE.path}>guide to Bowie youth sports</Link>.
          </p>
        </section>

        <section id="movement-examples">
          <h2>What athleticism development looks like in class</h2>
          <p>
            Watch how the coach changes a movement as your child learns it. These are examples of what a coach
            might choose based on the child’s experience.
          </p>
          <ul>
            <li><strong>Strength.</strong> A coach might start with a bodyweight squat. Once the child can lower and stand with control across several attempts, the coach can add resistance.</li>
            <li><strong>Speed.</strong> A child might practice a short start, rest, and try again. The coach watches whether the first few steps stay consistent as the child gets faster.</li>
            <li><strong>Body control.</strong> A child might practice a small jump and steady landing. Once the landing is repeatable, the coach can connect the jump to another tumbling movement.</li>
          </ul>
          <p>See how Vortex teaches <Link to="/fit-and-flip#strength">youth strength training in Fit &amp; Flip</Link>.</p>
        </section>

        <section id="first-class">
          <h2>What to watch for in a first class</h2>
          <p>
            Look for a coach who explains the task, watches your child try it, and makes a useful adjustment.
            The American Academy of Pediatrics emphasizes proper technique and qualified supervision in youth
            strength training. In practice, you can look for these signs.
          </p>
          <ol>
            <li><strong>Preparation has a purpose.</strong> The warm-up rehearses a pattern athletes will use later, such as slowing into a balanced stop before adding speed.</li>
            <li><strong>Difficulty matches the child.</strong> The coach can make a drill simpler or change the equipment if a child is still learning the movement.</li>
            <li><strong>There’s time for feedback and recovery.</strong> Children get a clear cue and a chance to try it on the next attempt. When attempts get rushed, the coach can pause or adapt the task.</li>
            <li><strong>Control comes before progression.</strong> The coach looks for a repeatable starting skill before adding speed, resistance, or a more difficult landing.</li>
          </ol>
        </section>

        <section id="progress">
          <h2>How to tell if training is helping</h2>
          <p>
            Ask the coach to name one movement your child is working on and what they’ll watch for next time.
            Compare the same task under similar conditions over a few sessions. A quieter landing, a steadier
            change of direction, or needing fewer reminders can be progress, even when a stopwatch reading
            or the amount of weight stays the same.
          </p>
          <p>
            Ask your child what they enjoyed and what they could do with more confidence. Soreness tells you
            little about what they learned. Progress is easier to see when you compare your child with their own
            starting point and look for skills they can repeat.
          </p>
        </section>

        <section id="questions">
          <h2>Questions to ask a coach before enrolling</h2>
          <ul>
            <li>How do you choose a starting level for a child who’s new to this type of training?</li>
            <li>What do you change if a movement is too hard for my child to repeat with control?</li>
            <li>How would you fit this class around my child’s other practices and games?</li>
            <li>What’s one skill we could check again after a few visits to see what’s changed?</li>
          </ul>
        </section>

        <aside className="athletic-guide-next" aria-labelledby="athletic-guide-next-title">
          <h2 id="athletic-guide-next-title">See how Vortex approaches training</h2>
          <p>
            <Link to="/fit-and-flip" data-analytics-cta="explore_fit-flip" data-analytics-section="athletic_development_guide">Fit &amp; Flip in Bowie, Maryland</Link> combines coached strength work, explosive movement, and
            gymnastics-inspired body control. In our training approach, athletes prepare for the movements
            they’ll practice and work toward harder versions as their technique becomes more consistent.
          </p>
          <div className="athletic-guide-actions">
            <Link className="np-button" to="/enroll?program=Fit%20%26%20Flip" data-analytics-cta="browse_classes" data-analytics-section="athletic_development_guide">
              Browse Fit &amp; Flip classes <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className="athletic-guide-trial" to="/#free-trial" data-analytics-cta="free_trial_section" data-analytics-section="athletic_development_guide">
              Find a free trial <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </aside>

        <section className="athletic-guide-sources" aria-labelledby="athletic-guide-sources-title">
          <h2 id="athletic-guide-sources-title">Further reading</h2>
          <ul>
            <li><a href="https://pubmed.ncbi.nlm.nih.gov/32457216/">American Academy of Pediatrics clinical report on youth resistance training</a></li>
            <li><a href="https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/">National Strength and Conditioning Association position on long-term athletic development</a></li>
            <li><a href="https://www.cdc.gov/physical-activity-basics/adding-children-adolescents/">CDC guidance on making physical activity part of a child’s life</a></li>
          </ul>
        </section>
      </div>
    </article>
  )
}
