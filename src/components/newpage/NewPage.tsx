import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Menu, Pause, Play, Plus, X } from 'lucide-react'
import brandLogo from '../../assets/vortex-athletics-gymnastics-logo.webp'
import { BUSINESS_NAP, GOOGLE_MAPS_URL, SOCIAL_PROFILES, TEAM_EMAIL, TEAM_PHONE, TEAM_PHONE_E164 } from '../../config/contact'
import SeoHead from '../SeoHead'
import ParallaxGym from '../ParallaxGym'
import PublicNavigationLinks from './PublicNavigationLinks'
import { getHubSeoForPath } from '../../config/hubSeo'
import { HOME_FAQS } from '../../config/faqs'
import { getHubSchema } from '../../utils/schema'
import { liveTrainingEmbedUrl, trainingVideoUrl } from './media'
import { trackEvent } from '../../utils/analyticsClient'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import './NewPage.css'
import './NewPageFreeTrial.css'

const NewPageFreeTrial = lazyWithRetry(() => import('./NewPageFreeTrial'))
const NewPageInquiry = lazyWithRetry(() => import('./NewPageInquiry'))

type Program = 'gymnastics' | 'fit-flip'
type Overlay = Program | 'finder' | 'inquiry' | 'video' | 'live' | 'trial' | null

const programs = {
  gymnastics: {
    name: 'Gymnastics', eyebrow: 'THE FOUNDATION. THE FINESSE. THE FLIGHT.',
    image: '/gymnastics-hero.webp', alt: 'Young gymnasts learning together with a coach at Vortex',
    summary: 'Real gymnastics. Real development. Build the technique, strength, and confidence to keep moving forward.',
    detail: 'A traditional gymnastics program with a complete approach to development. Athletes learn the foundations shared across gymnastics disciplines, with the strength, explosiveness, and body control to put those skills into practice.',
    points: ['Foundations across artistic, rhythmic, acrobatic, aerobic, and trampoline & tumbling gymnastics.', 'Progressive skill development supported by purposeful physical preparation.', 'Developmental and team pathways with the same commitment to growth. Only team athletes compete.'],
    audience: 'For athletes learning and progressing in gymnastics.',
    tags: ['Foundational skills', 'Developmental & team'], href: '/enroll?sportFilter=all',
  },
  'fit-flip': {
    name: 'Fit & Flip', eyebrow: 'ATHLETIC DEVELOPMENT. WITH AN EDGE.',
    image: '/fit-and-flip-card.webp', alt: 'A Vortex athlete developing aerial body control on a trampoline',
    summary: 'Get stronger. Become more explosive. Learn to own your movement—on the floor, in the air, and in your sport.',
    detail: 'Athletic development built around the Triad of Athleticism: Strength, Explosiveness, and Body Control. Purposeful strength and power training meets gymnastics-inspired tumbling and movement for athletes across sports.',
    points: ['Strength and explosiveness to support more powerful movement and tumbling.', 'Gymnastics-inspired body control, coordination, aerial awareness, and landing mechanics.', 'For cheer, acro, dance, gymnasts seeking extra physical development, and athletes in every sport.'],
    audience: 'For cheer, acro, dance, gymnasts, and all-sport athletes.',
    tags: ['Strength & explosiveness', 'Tumbling & body control'], href: '/enroll?sportFilter=all',
  },
} as const

const triad = [
  { name: 'Strength', number: '01', line: 'Build the engine.', image: '/lifting-fundamentals-card.webp', alt: 'A young Vortex athlete practicing a barbell lift', text: 'Develop the physical capacity behind better movement. Build a strong foundation through progressive, coached strength work that meets athletes where they are.', application: 'From holding a handstand to holding your ground.', cues: ['Progressive resistance', 'Full-body strength', 'Strong foundations'] },
  { name: 'Explosiveness', number: '02', line: 'Turn strength into power.', image: '/plyometrics-1600.webp', alt: 'A young athlete practicing an explosive jump at Vortex', text: 'Learn to produce force with purpose. Jumps, takeoffs, and dynamic movement help athletes express their strength with speed and intent.', application: 'From a stronger tumbling takeoff to a more powerful first step.', cues: ['Powerful takeoffs', 'Reactive movement', 'Force production'] },
  { name: 'Body Control', number: '03', line: 'Own every movement.', image: '/fit-and-flip-card.webp', alt: 'A Vortex athlete rotating in the air above a trampoline', text: 'Connect strength and power with the ability to use them. Gymnastics-inspired training develops spatial awareness, coordination, and control on the ground and in the air.', application: 'From finding your landing to adapting on the field.', cues: ['Aerial awareness', 'Coordinated movement', 'Controlled landings'] },
] as const

const goals = [
  { title: 'Learn and progress in gymnastics', subtitle: 'Foundations, skills, developmental or team training', program: 'gymnastics' as Program, text: 'Start with Gymnastics. Build a broad technical foundation and the physical qualities to keep progressing. Developmental and team athletes share the same commitment to meaningful growth.' },
  { title: 'Build stronger, more powerful tumbling', subtitle: 'Cheer, acro, dance, and tumbling athletes', program: 'fit-flip' as Program, text: 'Start with Fit & Flip. Develop the strength and explosiveness behind your tumbling, alongside the body control to connect and refine your movement.' },
  { title: 'Become a better all-around athlete', subtitle: 'Football, soccer, basketball, and every sport', program: 'fit-flip' as Program, text: 'Start with Fit & Flip. Strength, explosiveness, and gymnastics-inspired body control come together to build a more capable athlete for your sport.' },
  { title: 'Add strength and power to my gymnastics', subtitle: 'Extra physical development for current gymnasts', program: 'fit-flip' as Program, text: 'Add Fit & Flip alongside gymnastics. Give strength, explosiveness, and body control dedicated attention to support your gymnastics development.' },
] as const

const faqs = HOME_FAQS.map(({ question, answer }) => [question, answer] as const)

function Brand() {
  return <a className="np-brand" href="#top" aria-label="Vortex Athletics, back to top"><img src={brandLogo} width="1086" height="171" alt="Vortex Athletics & Gymnastics" /></a>
}

function TrainingVideo({ paused, onPlaybackChange, onAutoplayBlocked, full = false }: { paused: boolean; onPlaybackChange?: (playing: boolean) => void; onAutoplayBlocked?: () => void; full?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [sourceRequested, setSourceRequested] = useState(false)
  const [inView, setInView] = useState(full)
  useEffect(() => {
    if (full || !videoRef.current) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 })
    observer.observe(videoRef.current)
    return () => observer.disconnect()
  }, [full])
  useEffect(() => {
    if (inView && !paused) setSourceRequested(true)
  }, [inView, paused])
  useEffect(() => {
    const video = videoRef.current
    if (!video || failed || !sourceRequested) return
    if (paused || !inView) video.pause()
    else void video.play().catch((error: unknown) => {
      // A scroll or dialog may interrupt a pending play request; that is not an autoplay denial.
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        onPlaybackChange?.(false)
        onAutoplayBlocked?.()
      }
    })
  }, [paused, inView, failed, sourceRequested, onPlaybackChange, onAutoplayBlocked])
  if (failed) return <div className="np-video-fallback"><img src="/fit-and-flip-card.webp" alt="A Vortex athlete practicing a flip" />{full && <p>The training film is unavailable right now. <a href={SOCIAL_PROFILES[2]} target="_blank" rel="noreferrer">Watch Vortex on YouTube <ArrowUpRight size={16} /></a></p>}</div>
  return <video ref={videoRef} className={loaded ? 'np-video is-loaded' : 'np-video'} poster="/fit-and-flip-card.webp" src={sourceRequested ? trainingVideoUrl : undefined} muted loop={!full} playsInline controls={full} preload={paused ? 'none' : 'metadata'} aria-label="Vortex training film" onLoadedData={() => setLoaded(true)} onError={() => { setFailed(true); onPlaybackChange?.(false) }} onPlay={() => onPlaybackChange?.(true)} onPause={() => onPlaybackChange?.(false)} />
}

export default function NewPage({ onLogin, isLoggedIn }: { onLogin: () => void; isLoggedIn: boolean }) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => {
      const id = hash.slice(1)
      document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash])
  const [menuOpen, setMenuOpen] = useState(false)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [inquiryProgram, setInquiryProgram] = useState<Program | undefined>()
  const [trialProgram, setTrialProgram] = useState<Program | undefined>()
  const [selectedGoal, setSelectedGoal] = useState<number | null>(null)
  const [activeTriad, setActiveTriad] = useState(0)
  const [motionPaused, setMotionPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData))
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [posterReady, setPosterReady] = useState(false)
  const [backgroundCanPlay, setBackgroundCanPlay] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const recommendationRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const isDialogOpen = overlay !== null
  const handleAutoplayBlocked = useCallback(() => setMotionPaused(true), [])

  useEffect(() => {
    if (!posterReady || backgroundCanPlay) return
    // Give the poster a paint before the video can compete for bandwidth.
    let afterPaint = 0
    const beforePaint = requestAnimationFrame(() => {
      afterPaint = requestAnimationFrame(() => setBackgroundCanPlay(true))
    })
    return () => {
      cancelAnimationFrame(beforePaint)
      cancelAnimationFrame(afterPaint)
    }
  }, [posterReady, backgroundCanPlay])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => { if (media.matches) setMotionPaused(true) }
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!isDialogOpen || !dialog) return
    const trigger = document.activeElement as HTMLElement | null
    dialog.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      trigger?.focus({ preventScroll: true })
    }
  }, [isDialogOpen])

  useEffect(() => {
    if (overlay) dialogRef.current?.querySelector<HTMLButtonElement>('.np-dialog-close')?.focus({ preventScroll: true })
  }, [overlay])

  useEffect(() => {
    if (selectedGoal !== null && overlay === 'finder') recommendationRef.current?.scrollIntoView({ block: 'nearest', behavior: motionPaused ? 'instant' : 'smooth' })
  }, [selectedGoal, overlay, motionPaused])

  function openInquiry(program?: Program) {
    trackEvent('inquiry_form_start', '/', { properties: { form_type: 'homepage_inquiry', program_slug: program } })
    setInquiryProgram(program)
    setOverlay('inquiry')
  }

  function openTrial(section: string, program?: Program) {
    trackEvent('trial_start', '/', { properties: { section, program_slug: program } })
    setTrialProgram(program)
    setOverlay('trial')
  }

  function openProgram(program: Program, target: string) {
    trackEvent('program_interest', '/', { properties: { program_slug: program, target } })
    setOverlay(program)
  }

  function openMedia(target: 'training_film' | 'live_stream') {
    trackEvent('media_engagement', '/', { properties: { target, action: 'open' } })
    setOverlay(target === 'training_film' ? 'video' : 'live')
  }

  const selectedTriad = triad[activeTriad]
  const currentProgram = overlay === 'gymnastics' || overlay === 'fit-flip' ? programs[overlay] : null
  const dialogLabel = overlay === 'inquiry' ? 'np-inquiry-title' : overlay === 'trial' ? 'np-trial-title' : 'np-dialog-title'

  return (
    <div className={`np-page${motionPaused ? ' np-motion-paused' : ''}`} id="top">
      <SeoHead {...getHubSeoForPath('/')} schema={getHubSchema('/')} preloadImage="/fit-and-flip-card.webp" />
      <a className="np-skip" href="#main">Skip to content</a>
      <header className="np-header">
        <div className="np-container np-nav">
          <Brand />
          <nav className="np-desktop-nav" aria-label="Main navigation"><PublicNavigationLinks /></nav>
          <div className="np-nav-actions"><button className="np-login" data-analytics-cta="member_login" data-analytics-section="navigation" onClick={onLogin}>{isLoggedIn ? 'My portal' : 'Member login'}<ArrowUpRight size={14} /></button><button className="np-button np-nav-cta" data-analytics-cta="free_trial" data-analytics-section="navigation" onClick={() => openTrial('navigation')}>Try a free class <ArrowUpRight size={16} /></button><button className="np-menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="np-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
        </div>
        {menuOpen && <nav id="np-mobile-nav" className="np-mobile-nav" aria-label="Mobile navigation"><PublicNavigationLinks mobile onNavigate={() => setMenuOpen(false)} /><button data-analytics-cta="member_login" data-analytics-section="navigation" onClick={() => { setMenuOpen(false); onLogin() }}>{isLoggedIn ? 'My portal' : 'Member login'}<ArrowUpRight size={18} /></button></nav>}
      </header>

      <main id="main">
        <section className="np-hero">
          <div className="np-container np-hero-grid">
            <div className="np-hero-copy">
              <p className="np-eyebrow"><span className="np-red-dash" /> GYMNASTICS + ATHLETIC DEVELOPMENT</p>
              <h1>Built for<br /><span>more.</span></h1>
              <p className="np-hero-intro">Stronger athletes.<br />Greater possibilities.</p>
              <p className="np-hero-description">From their first handstand to their next competitive edge. Purposeful gymnastics and athletic development that build strength, explosiveness, and body control.</p>
              <div className="np-hero-buttons"><a href="#programs" className="np-button" data-analytics-cta="explore_programs" data-analytics-section="hero">Explore programs <ArrowRight size={18} /></a><button className="np-text-button" onClick={() => openMedia('training_film')}><span className="np-play-outline"><Play size={13} fill="currentColor" /></span>See us in motion</button></div>
              <div className="np-hero-location"><span className="np-location-dot" /><span>BOWIE, MARYLAND · BUILT FOR EVERY ATHLETE.</span></div>
            </div>
            <div className="np-hero-visual">
              <div className="np-orbit np-orbit-one" aria-hidden="true" /><div className="np-orbit np-orbit-two" aria-hidden="true" />
              <div className="np-hero-media">
                <img className="np-hero-poster" src="/fit-and-flip-card.webp" alt="A young Vortex athlete in flight, practicing a flip on a trampoline" width="900" height="675" fetchPriority="high" onLoad={() => setPosterReady(true)} onError={() => setPosterReady(true)} />
                <TrainingVideo paused={!backgroundCanPlay || motionPaused || overlay !== null} onPlaybackChange={setVideoPlaying} onAutoplayBlocked={handleAutoplayBlocked} />
                <div className="np-media-shade" />
                <span className="np-media-label"><span /> THE WORK. THE PROGRESS. THE POSSIBILITY.</span>
                <div className="np-media-caption"><div><span>THIS IS VORTEX.</span><strong>A higher standard<br />of development.</strong></div><button className="np-media-control" aria-label={!motionPaused && videoPlaying ? 'Pause background video' : 'Play background video'} onClick={() => { setBackgroundCanPlay(true); setMotionPaused(!motionPaused && videoPlaying) }}>{!motionPaused && videoPlaying ? <Pause size={19} /> : <Play size={19} />}</button></div>
              </div>
              <div className="np-hero-note"><span className="np-note-icon"><ArrowUpRight size={23} /></span><span>Big goals.<br /><strong>Built from the ground up.</strong></span><span className="np-note-index">01—03</span></div>
            </div>
          </div>
          <div className="np-container np-sport-strip"><span>BUILT HERE. APPLIED EVERYWHERE.</span><div>Gymnastics <i>✳</i> Cheer & acro <i>✳</i> Dance <i>✳</i> Field & court <i>✳</i> Your sport</div><a href="#programs" aria-label="Scroll to our programs"><ArrowDown size={20} /></a></div>
        </section>

        <section className="np-section np-container" id="programs">
          <div className="np-section-heading"><div><p className="np-eyebrow">01 / FIND YOUR PATH</p><h2>Two programs.<br /><span>One higher standard.</span></h2></div><p>Different goals. The same belief: every athlete deserves purposeful coaching and the opportunity to grow.</p></div>
          <div className="np-program-grid">{(Object.entries(programs) as [Program, typeof programs[Program]][]).map(([id, program], index) => <article className="np-program" id={id} key={id}>
            <button className="np-program-image" onClick={() => openProgram(id, 'program_cards')} aria-label={`Explore ${program.name}`}><img src={program.image} alt={program.alt} width="900" height="675" loading="lazy" /><span className="np-program-number">0{index + 1}</span><span className="np-image-arrow"><ArrowUpRight size={24} /></span></button>
            <div className="np-program-body"><p className="np-eyebrow">{program.eyebrow}</p><h3>{program.name}</h3><p>{program.summary}</p><p className="np-program-audience">{program.audience}</p><div className="np-tags">{program.tags.map(tag => <span key={tag}>{tag}</span>)}</div><button className="np-program-link" onClick={() => openProgram(id, 'program_cards')}>Explore {program.name}<ArrowUpRight size={21} /></button></div>
          </article>)}</div>
          <div className="np-path-help"><span>Not sure where to begin? Start with your athlete’s goals.</span><button className="np-text-button" data-analytics-cta="program_finder" data-analytics-section="programs" onClick={() => setOverlay('finder')}>Find your fit <ArrowRight size={18} /></button></div>
        </section>

        <section className="np-container np-trial-section" id="free-trial" aria-labelledby="np-free-trial-heading">
          <div className="np-trial-invitation">
            <div>
              <p className="np-eyebrow">A FIRST STEP. A NEW POSSIBILITY.</p>
              <h2 id="np-free-trial-heading">Their next chapter.<br /><span>First class on us.</span></h2>
              <p>Experience Gymnastics or Fit & Flip with a free trial class. Choose the right age group, find a day that works, and come see what your athlete can do.</p>
              <button className="np-button" data-analytics-cta="free_trial" data-analytics-section="free_trial" onClick={() => openTrial('free_trial')}>Book a free trial <ArrowUpRight size={18} /></button>
              <p className="np-trial-drop-in">Already used your free trial? Join us for a drop-in class.<Link to="/drop-in" data-analytics-cta="book_drop_in" data-analytics-section="free_trial">Book a drop-in class <ArrowUpRight size={16} /></Link></p>
            </div>
            <div className="np-trial-invitation-points">
              <div><span>01</span><div><strong>Find their fit.</strong><p>Choose Gymnastics or Fit & Flip and enter your child’s age.</p></div></div>
              <div><span>02</span><div><strong>Choose their first day.</strong><p>See available classes, enrolled athletes, and open places.</p></div></div>
              <div><span>03</span><div><strong>Register. Then come train.</strong><p>Complete the family details and waivers. Your one-time trial is $0.</p></div></div>
            </div>
          </div>
        </section>

        <section className="np-triad-section" id="triad"><div className="np-container np-section">
          <div className="np-section-heading"><div><p className="np-eyebrow">02 / THE TRIAD OF ATHLETICISM</p><h2>Strong. Explosive.<br /><span>In control.</span></h2></div><p>Three connected qualities. One complete athlete. The foundation of Fit & Flip—and the physical qualities we develop in our gymnasts.</p></div>
          <div className="np-triad-tabs" role="tablist" aria-label="The Triad of Athleticism">{triad.map((item, index) => <button ref={node => { tabRefs.current[index] = node }} key={item.name} id={`np-triad-tab-${index}`} role="tab" aria-selected={activeTriad === index} aria-controls="np-triad-panel" tabIndex={activeTriad === index ? 0 : -1} onClick={() => setActiveTriad(index)} onKeyDown={event => { let next = index; if (event.key === 'ArrowRight') next = (index + 1) % 3; else if (event.key === 'ArrowLeft') next = (index + 2) % 3; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = 2; else return; event.preventDefault(); setActiveTriad(next); tabRefs.current[next]?.focus() }}><span>{item.number}</span>{item.name}<ArrowUpRight size={20} /></button>)}</div>
          <div className="np-triad-panel" id="np-triad-panel" role="tabpanel" aria-labelledby={`np-triad-tab-${activeTriad}`} tabIndex={0}><div className="np-triad-image"><img key={selectedTriad.image} src={selectedTriad.image} alt={selectedTriad.alt} width="900" height="675" loading="lazy" /><span>{selectedTriad.number} / 03</span></div><div className="np-triad-copy" key={selectedTriad.name}><p className="np-eyebrow">THE {selectedTriad.name.toUpperCase()} ELEMENT</p><h3>{selectedTriad.line}</h3><p>{selectedTriad.text}</p><div className="np-triad-cues">{selectedTriad.cues.map(cue => <span key={cue}><Check size={15} />{cue}</span>)}</div><p className="np-triad-application">{selectedTriad.application}</p></div></div>
          <div className="np-triad-equation"><span>Strength</span><Plus size={18} /><span>Explosiveness</span><Plus size={18} /><span>Body control</span><ArrowRight size={20} /><strong>Athleticism.</strong></div>
        </div></section>

        <section className="np-container np-section np-approach" id="approach">
          <div className="np-approach-copy"><p className="np-eyebrow">03 / DEVELOPMENT WITH INTENTION</p><h2>More than<br /> going through<br /><span>the motions.</span></h2><p>We believe elite development is an approach to training. It starts with purposeful work, clear progressions, and a commitment to helping every athlete grow.</p><button className="np-text-button" onClick={() => openInquiry()}>Meet your next step <ArrowUpRight size={18} /></button></div>
          <div className="np-principles"><article><span>01</span><div><h3>Skills with a strong foundation.</h3><p>Gymnastics technique and physical development work together. Athletes build the strength and power to support the skills they are learning.</p></div></article><article><span>02</span><div><h3>Purpose in every progression.</h3><p>Start where the athlete is. Develop movement quality, reinforce the fundamentals, and work toward the next challenge with intention.</p></div></article><article><span>03</span><div><h3>Development for everyone.</h3><p>Team or developmental, the focus is real growth. Competition belongs to the team pathway. High-quality coaching belongs to every athlete.</p></div></article></div>
        </section>

        <section className="np-difference"><div className="np-container np-difference-grid"><div><p className="np-eyebrow">THE VORTEX DIFFERENCE</p><h2>Power is only<br />part of the picture.</h2><p>What happens when an athlete can also rotate, balance, land, and adapt? Strength and explosiveness become more useful. That’s why body control is at the heart of our athletic development.</p><button className="np-button np-button-white" onClick={() => openProgram('fit-flip', 'training_approach')}>Discover Fit & Flip <ArrowUpRight size={18} /></button></div><div className="np-difference-image"><img src="/calisthenics-card.jpg" alt="An athlete practicing a controlled handstand at Vortex" width="1536" height="1024" loading="lazy" /><span>CONTROL CHANGES EVERYTHING.</span></div></div></section>

        <section className="np-container np-section np-faq" id="faq"><div><p className="np-eyebrow">A LITTLE CLARITY</p><h2>Good questions.<br /><span>Clear answers.</span></h2><p>Choosing a program should feel simple.<br />We’re here to help you find the right fit.</p><button className="np-text-button" onClick={() => openInquiry()}>Talk to our team <ArrowUpRight size={18} /></button></div><div className="np-faq-list">{faqs.map(([question, answer], index) => <details key={question}><summary data-analytics-cta={`faq_${index + 1}`} data-analytics-section="faq">{question}<Plus size={20} /></summary><p>{answer}</p></details>)}</div></section>

        <ParallaxGym paused={motionPaused} />

        <section className="np-visit" id="visit"><div className="np-container np-visit-inner"><p className="np-eyebrow">YOUR NEXT LEVEL STARTS HERE</p><h2>Let’s build<br /><span>what’s next.</span></h2><p>A first skill. A stronger takeoff. A more complete athlete.<br />Find the right path at Vortex.</p><div className="np-visit-buttons"><button className="np-button" data-analytics-cta="program_finder" data-analytics-section="visit" onClick={() => setOverlay('finder')}>Find your program <ArrowUpRight size={18} /></button><button className="np-button np-button-outline" onClick={() => openInquiry()}>Talk to our team <ArrowRight size={18} /></button></div><a className="np-address" href={GOOGLE_MAPS_URL} target="_blank" rel="noreferrer">{BUSINESS_NAP.streetAddress} · {BUSINESS_NAP.addressLocality}, {BUSINESS_NAP.addressRegion} {BUSINESS_NAP.postalCode}<ArrowUpRight size={16} /></a></div></section>
      </main>

      <footer className="np-footer np-container">
        <div className="np-footer-main">
          <div><Brand /><p>Gymnastics. Athletic development.<br />Built for more.</p></div>
          <div>
            <span className="np-footer-label">COME TRAIN WITH US</span>
            <Link to="/enroll">Class enrollment</Link>
            <Link to="/contact">Contact &amp; location</Link>
            <a href={`tel:${TEAM_PHONE_E164}`}>{TEAM_PHONE}</a>
            <a href={`mailto:${TEAM_EMAIL}`}>{TEAM_EMAIL}</a>
          </div>
          <div>
            <span className="np-footer-label">STAY CONNECTED</span>
            <Link to="/store">Vortex store</Link>
            <a href={SOCIAL_PROFILES[0]} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={14} /></a>
            <a href={SOCIAL_PROFILES[2]} target="_blank" rel="noreferrer">YouTube <ArrowUpRight size={14} /></a>
          </div>
          <a className="np-back-top" href="#top">Back to top <ArrowUpRight size={17} /></a>
        </div>
        <div className="np-footer-bottom">
          <span>© {new Date().getFullYear()} Vortex Athletics and Gymnastics</span>
          <div>
            <Link to="/privacy-policy">Privacy</Link>
            <Link to="/terms-of-service">Terms</Link>
            <button onClick={() => setMotionPaused(!motionPaused)}>{motionPaused ? 'Enable motion' : 'Pause motion'}</button>
          </div>
        </div>
      </footer>

      {overlay && <dialog ref={dialogRef} className={`np-dialog ${overlay === 'trial' ? 'np-dialog-trial' : overlay === 'video' || overlay === 'live' ? 'np-dialog-video' : ''}`} aria-labelledby={dialogLabel} onCancel={() => setOverlay(null)} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOverlay(null) } }}><button className="np-dialog-close" aria-label="Close dialog" onClick={() => setOverlay(null)}><X size={22} /></button>
        {currentProgram && <><img className="np-dialog-image" src={currentProgram.image} alt={currentProgram.alt} /><div className="np-dialog-content"><p className="np-eyebrow">{currentProgram.eyebrow}</p><h2 id="np-dialog-title">{currentProgram.name}</h2><p>{currentProgram.detail}</p><ul className="np-dialog-points">{currentProgram.points.map(point => <li key={point}><Check size={18} /><span>{point}</span></li>)}</ul>{overlay === 'gymnastics' && <div className="np-pathways"><div><strong>Developmental</strong><span>Learn. Progress. Grow.</span><p>Purposeful training without competition.</p></div><div><strong>Team</strong><span>Develop. Prepare. Compete.</span><p>The same focus on growth, with competition.</p></div></div>}<div className="np-dialog-actions"><button className="np-button" data-analytics-cta="free_trial" data-analytics-section="program" onClick={() => openTrial('program', overlay as Program)}>Try a free class <ArrowUpRight size={17} /></button><Link className="np-text-button" to={currentProgram.href} data-analytics-cta="browse_classes" data-analytics-section="program">Browse classes & enroll <ArrowUpRight size={17} /></Link><button className="np-text-button" onClick={() => openInquiry(overlay as Program)}>Ask about this program <ArrowRight size={17} /></button></div></div></>}
        {overlay === 'finder' && <div className="np-dialog-content np-finder"><p className="np-eyebrow">A GOOD PLACE TO START</p><h2 id="np-dialog-title">What’s their next goal?</h2><p>Tell us what your athlete is working toward.</p><div className="np-goal-options">{goals.map((goal, index) => <button key={goal.title} className={selectedGoal === index ? 'is-selected' : ''} aria-pressed={selectedGoal === index} onClick={() => setSelectedGoal(index)}><span><strong>{goal.title}</strong><small>{goal.subtitle}</small></span>{selectedGoal === index ? <Check size={20} /> : <ArrowUpRight size={20} />}</button>)}</div>{selectedGoal !== null && <div ref={recommendationRef} className="np-recommendation" aria-live="polite"><p className="np-eyebrow">YOUR STARTING POINT</p><h3>{programs[goals[selectedGoal].program].name}</h3><p>{goals[selectedGoal].text}</p><div className="np-dialog-actions"><button className="np-button" onClick={() => openProgram(goals[selectedGoal].program, 'finder_recommendation')}>Explore the program <ArrowRight size={17} /></button><button className="np-text-button" onClick={() => openInquiry(goals[selectedGoal].program)}>Talk to our team</button></div></div>}</div>}
        {overlay === 'trial' && <Suspense fallback={<div className="np-trial-flow"><h2 id="np-trial-title">Loading trial signup…</h2></div>}><NewPageFreeTrial initialProgram={trialProgram} onDone={() => setOverlay(null)} /></Suspense>}
        {overlay === 'inquiry' && <div className="np-dialog-content"><Suspense fallback={<h2 id="np-inquiry-title">Loading inquiry form…</h2>}><NewPageInquiry program={inquiryProgram} onDone={() => setOverlay(null)} /></Suspense></div>}
        {overlay === 'video' && <div className="np-video-dialog-content"><p className="np-eyebrow">INSIDE VORTEX</p><h2 id="np-dialog-title">See the work in motion.</h2><TrainingVideo full paused={false} /><p>Strength. Explosiveness. Body control. Built together.</p>{liveTrainingEmbedUrl && <button className="np-button" onClick={() => openMedia('live_stream')}>Watch live <Play size={16} /></button>}</div>}
        {overlay === 'live' && liveTrainingEmbedUrl && <div className="np-video-dialog-content"><p className="np-eyebrow">INSIDE VORTEX</p><h2 id="np-dialog-title">Live from Vortex.</h2><iframe className="np-live-stream" src={liveTrainingEmbedUrl} title="Vortex live training stream" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /><button className="np-text-button" onClick={() => openMedia('training_film')}>Back to the training film <ArrowRight size={17} /></button></div>}
      </dialog>}
    </div>
  )
}
