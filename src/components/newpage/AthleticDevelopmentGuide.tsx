import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { ATHLETIC_DEVELOPMENT_GUIDE } from '../../config/athleticDevelopmentGuide'
import { BOWIE_YOUTH_SPORTS_GUIDE } from '../../config/bowieYouthSportsGuide'
import { FIT_AND_FLIP_DROP_IN_HREF } from '../../utils/publicBookingPrograms'
import GuideBreadcrumb from './GuideBreadcrumb'
import GuideByline from './GuideByline'
import './AthleticDevelopmentGuide.css'

const sections = [
  { id: 'youth-sports', label: 'How it fits with youth sports' },
  { id: 'sports-season', label: 'Training around practices and games' },
  { id: 'movement-examples', label: 'Eight qualities of athleticism' },
  { id: 'movement-progression', label: 'How coaches progress a movement' },
  { id: 'strength-training-readiness', label: 'When to start strength training' },
  { id: 'first-class', label: 'What to watch for in class' },
  { id: 'progress', label: 'How coaches check progress' },
  { id: 'questions', label: 'Questions for the coach' },
] as const

export default function AthleticDevelopmentGuide() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash])

  return (
    <article className="athletic-guide" aria-labelledby="athletic-guide-title">
      <header className="athletic-guide-hero">
        <div className="athletic-guide-shell athletic-guide-intro">
          <div>
            <GuideBreadcrumb guideLabel={ATHLETIC_DEVELOPMENT_GUIDE.breadcrumbLabel} />
            <h1 id="athletic-guide-title">{ATHLETIC_DEVELOPMENT_GUIDE.heading}</h1>
            <p className="athletic-guide-lead">
              Athleticism development is the practice of building movement skills that children can use in
              sports and active play. See how coaches build strength, speed, agility, and body control over
              time, what to watch for when choosing a class, and how to see if the training is helping.
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
            Children who aren’t on a team can start with active play or a coached class they enjoy. For nearby choices,
            see our <Link to={BOWIE_YOUTH_SPORTS_GUIDE.path}>guide to Bowie youth sports</Link>.
          </p>
        </section>

        <section id="sports-season">
          <h2>Athletic training during and between sports seasons</h2>
          <p>
            Before adding a class, put practices, games, PE, and other activities on one calendar. Leave time for
            rest and tell the training coach what the full week looks like. The American Academy of Pediatrics
            emphasizes balancing how much young athletes train with enough time to recover.
          </p>
          <ul>
            <li>
              <strong>During a busy season.</strong> If a basketball player has team practice and a weekend
              tournament, ask the coach whether to keep the session light or skip it that week. If they train,
              they might rehearse a familiar balanced stop at a comfortable pace.
            </li>
            <li>
              <strong>Between seasons.</strong> With fewer team commitments, ask your child to pick one
              movement to build. A coach can use that same balanced stop as a starting point and add a
              change of direction once the athlete can repeat it consistently.
            </li>
          </ul>
          <p className="mt-4">
            The week’s schedule helps the coach decide when to keep a movement familiar and when to progress it.
            See how a coach could use that approach in a <Link to="/fit-and-flip#fit-flip-class-example">Fit &amp; Flip class</Link>.
          </p>
        </section>

        <section id="movement-examples">
          <h2>Eight qualities of youth athleticism</h2>
          <p>
            Vortex’s Athleticism Accelerator framework names eight qualities coaches develop. One movement can
            involve several of them. For example, landing a jump takes both strength to absorb force and
            balance to stay steady.
          </p>
          <ul>
            <li><strong>Strength.</strong> Produce and resist force. A child might practice lowering and standing in a bodyweight squat before a coach adds resistance.</li>
            <li><strong>Explosiveness.</strong> Use force quickly. A coach might ask a child to take off crisply in a short jump and rest before the next attempt.</li>
            <li><strong>Speed.</strong> Move quickly with consistent technique. A coach might watch the first few steps of a short sprint to see what stays steady as the child accelerates.</li>
            <li><strong>Agility.</strong> Slow down, redirect, and respond to a cue. A child might learn a planned turn before reacting to the coach’s signal for which way to go.</li>
            <li><strong>Flexibility and mobility.</strong> Reach a useful position and control it. A coach might use a shallow lunge with a reach, then adjust the depth as the child gains control.</li>
            <li><strong>Balance.</strong> Maintain or regain stability. A child might step onto one foot and practice getting steady enough to hold the position.</li>
            <li><strong>Coordination.</strong> Time the movement of different body parts. A coach might use skipping to help a child match the rhythm of their arms and legs.</li>
            <li><strong>Body control.</strong> Manage where the body is in space. A child might learn to hold a tucked shape through a roll and finish in a stable position.</li>
          </ul>
          <p>See how Vortex teaches <Link to="/fit-and-flip#strength">youth strength training in Fit &amp; Flip</Link>.</p>
        </section>

        <section id="movement-progression">
          <h2>How Vortex coaches progress a movement</h2>
          <p>
            Vortex uses four stages to teach movement. Here’s how a coach might take one athlete from a balanced
            stop to changing direction on a cue.
          </p>
          <ol>
            <li><strong>Control.</strong> The athlete approaches a line at an easy pace and comes to a balanced stop.</li>
            <li><strong>Produce.</strong> The coach asks for a quicker start from the same spot and checks whether the athlete can keep the stop steady.</li>
            <li><strong>Redirect.</strong> The athlete slows, plants, and changes direction toward a cone chosen in advance.</li>
            <li><strong>React.</strong> The athlete approaches the same area and responds when the coach signals which of two cones to move toward.</li>
          </ol>
          <p>
            The coach changes one demand at a time once the athlete can repeat the movement with control. Two
            children of the same age may practice different versions at the same station based on what each can
            do consistently.
          </p>
        </section>

        <section id="strength-training-readiness">
          <h2>When is a child ready to start strength training?</h2>
          <p>
            Look at how your child responds to instruction. Can they listen to a coach’s directions, wait for
            their turn, and try an adjustment when the coach gives feedback? A qualified coach can match the
            exercise to the child’s current ability and start with bodyweight movements, such as a squat.
            Read more in the <a href="https://www.sportsmed.org/youth-strength-training">American Orthopaedic Society for Sports Medicine’s youth strength training guidance</a>.
          </p>
          <h3>Do kids need weights to get stronger?</h3>
          <p>
            The CDC lists climbing and gymnastics as ways younger children build strength through play.
            In a coached class, a child can get feedback on one movement and practice it before increasing the difficulty.
            {' '}<a href="https://www.cdc.gov/physical-activity-basics/guidelines/children.html">CDC guidance on age-appropriate activity</a>
          </p>
          <p>
            At Vortex, Fit &amp; Flip has Cyclones groups for ages 8–11 and 12–15. If you’re considering a class,
            ask the coach what your child would start with and what they would look for before adding resistance.
            {' '}<Link to="/fit-and-flip#training-fit">See Fit &amp; Flip options for beginners</Link>.
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
          <h2>How coaches measure progress in youth athletic development</h2>
          <p>
            Time, distance, and weight can show one part of progress. A coach can also track whether a child
            can repeat the same movement with more control. The National Strength and Conditioning Association
            recommends evaluating both how a child moves and what the movement achieves in its
            {' '}<a href="https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/long-term-athletic-development-position-statement/">position statement on long-term athletic development</a>.
          </p>
          <h3 className="athletic-guide-subheading">The first two steps of a sprint</h3>
          <p>
            In one example from Vortex’s Athleticism Accelerator coaching library, the athlete starts still
            with one foot ahead of the other. The coach cues them to push the floor behind them and watches
            the first two steps.
          </p>
          <ul>
            <li><strong>Record the starting point.</strong> The coach notes how often the athlete can push forward without rocking back first or reaching for a longer step.</li>
            <li><strong>Repeat the same task.</strong> On a later visit, the coach uses the same setup and cue and counts controlled starts out of the attempts the athlete makes.</li>
            <li><strong>Decide what to practice next.</strong> If the athlete still reaches on most attempts, the coach can keep working on the same cue. If the push is steady more often, the coach can consider a longer start.</li>
          </ul>
          <p className="mt-4">
            After class, ask the coach which movement they’d check again and what change they’d look for.
            Ask your child what felt easier and what they’d like to practice again.
          </p>
        </section>

        <section id="questions">
          <h2>Questions to ask a coach before enrolling</h2>
          <ul>
            <li>How do you choose a starting level for a child who’s new to this type of training?</li>
            <li>What do you change if a movement is too hard for my child to repeat with control?</li>
            <li>How would you fit this class around my child’s other practices and games?</li>
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
            <Link className="np-button" to="/fit-and-flip#fit-flip-schedule" data-analytics-cta="browse_classes" data-analytics-section="athletic_development_guide">
              See recurring Fit &amp; Flip times <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className="athletic-guide-trial" to="/fit-and-flip#training-fit" data-analytics-cta="free_trial_section" data-analytics-section="athletic_development_guide">
              Find a free Fit &amp; Flip trial <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link className="athletic-guide-trial" to={FIT_AND_FLIP_DROP_IN_HREF} data-analytics-cta="browse_drop_ins" data-analytics-section="athletic_development_guide">
              See Fit &amp; Flip drop-in dates <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </aside>

        <section className="athletic-guide-sources" aria-labelledby="athletic-guide-sources-title">
          <h2 id="athletic-guide-sources-title">Further reading</h2>
          <ul>
            <li><a href="https://pubmed.ncbi.nlm.nih.gov/32457216/">American Academy of Pediatrics clinical report on youth resistance training</a></li>
            <li><a href="https://pubmed.ncbi.nlm.nih.gov/38247370/">American Academy of Pediatrics report on training load and recovery in youth sports</a></li>
            <li><a href="https://www.cdc.gov/physical-activity-basics/adding-children-adolescents/">CDC guidance on making physical activity part of a child’s life</a></li>
          </ul>
        </section>
      </div>
    </article>
  )
}
