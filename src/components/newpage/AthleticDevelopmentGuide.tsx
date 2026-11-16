import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { ATHLETIC_DEVELOPMENT_GUIDE } from '../../config/athleticDevelopmentGuide'
import './AthleticDevelopmentGuide.css'

const sections = [
  { id: 'youth-sports', label: 'How it fits with youth sports' },
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
              Youth athletic development helps kids build movement skills they can carry between activities.
              Here’s what to look for when you watch a class and how to decide if it fits your child.
            </p>
            <p className="athletic-guide-byline">By Vortex Athletics</p>
          </div>
          <img
            className="athletic-guide-image"
            src={ATHLETIC_DEVELOPMENT_GUIDE.image}
            alt={ATHLETIC_DEVELOPMENT_GUIDE.imageAlt}
            width={1536}
            height={1024}
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
            Consider what your child wants to learn and what their week already includes. An athlete with games,
            practices, or gymnastics classes may benefit from a different starting point than a child looking for a
            new way to move. Leave room for enjoyable activities and active play.
          </p>
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
