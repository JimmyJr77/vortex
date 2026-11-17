import { Suspense, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Menu, Pause, Play, Plus, X } from 'lucide-react'
import { BUSINESS_HOURS, BUSINESS_NAP, GOOGLE_DIRECTIONS_URL, INSIDE_THE_GYM_PATH, SOCIAL_PROFILES, TEAM_EMAIL, TEAM_PHONE, TEAM_PHONE_E164 } from '../../config/contact'
import SeoHead from '../SeoHead'
import ParallaxGym from '../ParallaxGym'
import PublicBrandImage from './PublicBrandImage'
import PublicDialog from './PublicDialog'
import PublicNavigationLinks from './PublicNavigationLinks'
import { getHubSeoForPath } from '../../config/hubSeo'
import { HOME_FAQS } from '../../config/faqs'
import { ATHLETIC_DEVELOPMENT_GUIDE } from '../../config/athleticDevelopmentGuide'
import { BOWIE_YOUTH_SPORTS_GUIDE } from '../../config/bowieYouthSportsGuide'
import { GYMNASTICS_VS_TUMBLING_GUIDE } from '../../config/gymnasticsVsTumblingGuide'
import { PRESCHOOL_GYMNASTICS_GUIDE } from '../../config/preschoolGymnasticsGuide'
import { PUBLIC_PROGRAMS } from '../../config/publicPrograms'
import searchPhotos from '../../config/publicSearchPhotos.json'
import trainingFilm from '../../config/publicTrainingVideo.json'
import { RETURNING_TO_GYMNASTICS_GUIDE } from '../../config/returningToGymnasticsGuide'
import { getHubSchema } from '../../utils/schema'
import { liveTrainingEmbedUrl, trainingVideoUrl } from './media'
import { trackEvent } from '../../utils/analyticsClient'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import './NewPage.css'
import './NewPageFreeTrial.css'

const NewPageFreeTrial = lazyWithRetry(() => import('./NewPageFreeTrial'))
const NewPageInquiry = lazyWithRetry(() => import('./NewPageInquiry'))
const TRIAL_ANCHORS = {
  navigation: 'open-free-trial-from-navigation',
  free_trial: 'open-free-trial',
} as const

type Program = 'gymnastics' | 'fit-flip'
type Overlay = Program | 'finder' | 'inquiry' | 'video' | 'live' | 'trial' | null

const heroPhoto = {
  src: searchPhotos.fitAndFlip,
  srcSet: searchPhotos.fitAndFlipSrcSet,
  // The source is 4:3. Account for the width required to cover each hero height.
  sizes: '(max-width: 620px) max(454px, calc(100vw - 44px)), (max-width: 860px) 687px, (max-width: 1150px) 714px, (min-width: 1440px) 787px, 736px',
}

const gymnasticsCardPhoto = {
  src: '/gymnastics-card.webp',
  srcSet: '/gymnastics-card-440.webp 440w, /gymnastics-card-832.webp 832w, /gymnastics-card.webp 900w',
  sizes: '(max-width: 620px) 100vw, (max-width: 776px) calc(100vw - 36px), 740px',
}

function homepagePhoto(src: string) {
  // Use the same candidate in the cards, hero, and dialogs that share a photo.
  if (src === heroPhoto.src) return heroPhoto
  if (src === gymnasticsCardPhoto.src) return gymnasticsCardPhoto
  return { src }
}

const programs = {
  gymnastics: {
    name: 'Gymnastics', eyebrow: 'THE FOUNDATION. THE FINESSE. THE FLIGHT.',
    image: gymnasticsCardPhoto.src, alt: 'Young gymnasts learning together with a coach at Vortex',
    summary: 'Real gymnastics. Real development. Build the technique, strength, and confidence to keep moving forward.',
    detail: 'A traditional gymnastics program with a complete approach to development. Athletes learn the foundations shared across gymnastics disciplines, with the strength, explosiveness, and body control to put those skills into practice.',
    points: ['Foundations across artistic, rhythmic, acrobatic, aerobic, and trampoline & tumbling gymnastics.', 'Progressive skill development supported by purposeful physical preparation.', 'Developmental and team pathways with the same commitment to growth. Only team athletes compete.'],
    audience: 'For athletes learning and progressing in gymnastics.',
    tags: ['Foundational skills', 'Developmental & team'], page: '/gymnastics', linkText: 'Explore youth gymnastics',
    href: PUBLIC_PROGRAMS['/gymnastics'].primaryAction.href,
  },
  'fit-flip': {
    name: 'Fit & Flip', eyebrow: 'ATHLETIC DEVELOPMENT. WITH AN EDGE.',
    image: searchPhotos.fitAndFlip, alt: 'A Vortex athlete developing aerial body control on a trampoline',
    summary: 'Get stronger. Become more explosive. Learn to own your movement—on the floor, in the air, and in your sport.',
    detail: 'Athletic development built around the Triad of Athleticism: Strength, Explosiveness, and Body Control. Purposeful strength and power training meets gymnastics-inspired tumbling and movement for athletes across sports.',
    points: ['Strength and explosiveness to support more powerful movement and tumbling.', 'Gymnastics-inspired body control, coordination, aerial awareness, and landing mechanics.', 'For cheer, acro, dance, gymnasts seeking extra physical development, and athletes in every sport.'],
    audience: 'For cheer, acro, dance, gymnasts, and all-sport athletes.',
    tags: ['Strength & explosiveness', 'Tumbling & body control'], page: '/fit-and-flip', linkText: 'Explore Fit & Flip youth training',
    href: PUBLIC_PROGRAMS['/fit-and-flip'].primaryAction.href,
  },
} as const

const startingClasses = [
  {
    ages: 'Ages 2–5',
    shortName: 'Preschool gymnastics',
    name: 'Toddler and preschool gymnastics',
    detail: 'Ages 2–3 join a caregiver in Dirt Devils and must be potty trained for a trial. Ages 4–5 learn balance and basic gymnastics shapes in Twisters.',
    href: '/gymnastics#preschool',
    analyticsKey: 'explore_preschool_gymnastics',
    guide: {
      href: PRESCHOOL_GYMNASTICS_GUIDE.path,
      label: PRESCHOOL_GYMNASTICS_GUIDE.heading,
      analyticsKey: 'read_preschool_gymnastics_guide',
    },
  },
  {
    ages: 'Ages 6–17',
    shortName: 'Youth gymnastics',
    name: 'Gymnastics for kids and teens',
    detail: 'Beginners can try Tornadoes when a trial is available. Gymnasts with experience can start with a coach-led Trial Assessment.',
    href: '/gymnastics#choose-a-class',
    analyticsKey: 'explore_youth_gymnastics',
    guide: {
      href: GYMNASTICS_VS_TUMBLING_GUIDE.path,
      label: 'Compare gymnastics and tumbling for kids',
      analyticsKey: 'read_gymnastics_vs_tumbling_guide',
    },
  },
  {
    ages: 'Ages 8–15',
    shortName: 'Fit & Flip',
    name: 'Fit & Flip youth fitness',
    detail: 'Cyclones classes build strength, speed, and body control for sports and general fitness. See times for ages 8–11 and 12–15.',
    href: '/fit-and-flip#fit-flip-schedule',
    analyticsKey: 'explore_fit-flip',
    guide: {
      href: BOWIE_YOUTH_SPORTS_GUIDE.path,
      label: 'Compare youth sports and fitness in Bowie',
      analyticsKey: 'read_bowie_youth_sports_guide',
    },
  },
  {
    ages: 'Ages 18 and up',
    shortName: 'Adult gymnastics',
    name: 'Adult gymnastics',
    detail: 'Typhoons welcomes first-time and returning gymnasts for coached gymnastics and acrobatics.',
    href: '/adult-gymnastics',
    analyticsKey: 'explore_adult_gymnastics',
    guide: {
      href: RETURNING_TO_GYMNASTICS_GUIDE.path,
      label: RETURNING_TO_GYMNASTICS_GUIDE.heading,
      analyticsKey: 'read_returning_to_gymnastics_guide',
    },
  },
] as const

const triad = [
  { name: 'Strength', number: '01', line: 'Build the engine.', image: '/lifting-fundamentals-card.webp', alt: 'A young Vortex athlete practicing a barbell lift', text: 'Develop the physical capacity behind better movement. Build a strong foundation through progressive, coached strength work that meets athletes where they are.', application: 'From holding a handstand to holding your ground.', cues: ['Progressive resistance', 'Full-body strength', 'Strong foundations'] },
  { name: 'Explosiveness', number: '02', line: 'Turn strength into power.', image: searchPhotos.plyometrics, alt: 'A young athlete practicing an explosive jump at Vortex', text: 'Learn to produce force with purpose. Jumps, takeoffs, and dynamic movement help athletes express their strength with speed and intent.', application: 'From a stronger tumbling takeoff to a more powerful first step.', cues: ['Powerful takeoffs', 'Reactive movement', 'Force production'] },
  { name: 'Body Control', number: '03', line: 'Own every movement.', image: searchPhotos.fitAndFlip, alt: 'A Vortex athlete rotating in the air above a trampoline', text: 'Connect strength and power with the ability to use them. Gymnastics-inspired training develops spatial awareness, coordination, and control on the ground and in the air.', application: 'From finding your landing to adapting on the field.', cues: ['Aerial awareness', 'Coordinated movement', 'Controlled landings'] },
] as const

const goals = [
  { title: 'Learn and progress in gymnastics', subtitle: 'Foundations, skills, developmental or team training', program: 'gymnastics' as Program, text: 'Start with Gymnastics. Build a broad technical foundation and the physical qualities to keep progressing. Developmental and team athletes share the same commitment to meaningful growth.' },
  { title: 'Build stronger, more powerful tumbling', subtitle: 'Cheer, acro, dance, and tumbling athletes', program: 'fit-flip' as Program, text: 'Start with Fit & Flip. Develop the strength and explosiveness behind your tumbling, alongside the body control to connect and refine your movement.' },
  { title: 'Become a better all-around athlete', subtitle: 'Football, soccer, basketball, and every sport', program: 'fit-flip' as Program, text: 'Start with Fit & Flip. Strength, explosiveness, and gymnastics-inspired body control come together to build a more capable athlete for your sport.' },
  { title: 'Add strength and power to my gymnastics', subtitle: 'Extra physical development for current gymnasts', program: 'fit-flip' as Program, text: 'Add Fit & Flip alongside gymnastics. Give strength, explosiveness, and body control dedicated attention to support your gymnastics development.' },
] as const

const faqs = HOME_FAQS.map(({ question, answer }) => [question, answer] as const)

function Brand({ footer = false }: { footer?: boolean }) {
  return <a className="np-brand" href="#top" aria-label="Vortex Athletics, back to top"><PublicBrandImage footer={footer} /></a>
}

function TrainingVideo({ paused, onPlaybackChange, onAutoplayBlocked, poster, full = false }: {
  paused: boolean
  onPlaybackChange?: (playing: boolean) => void
  onAutoplayBlocked?: () => void
  poster?: string
  full?: boolean
}) {
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
  if (failed) {
    if (!full) return null
    return <div className="np-video-fallback"><img src={poster} alt="A Vortex athlete practicing a flip" /><p>The training film is unavailable right now. <a href={SOCIAL_PROFILES[2]} target="_blank" rel="noreferrer">Watch Vortex on YouTube <ArrowUpRight size={16} /></a></p></div>
  }
  return <video ref={videoRef} className={loaded ? 'np-video is-loaded' : 'np-video'} poster={poster} src={sourceRequested ? trainingVideoUrl : undefined} muted loop={!full} playsInline controls={full} preload={paused ? 'none' : 'metadata'} aria-label="Vortex training film" onLoadedData={() => setLoaded(true)} onError={() => { setFailed(true); onPlaybackChange?.(false) }} onPlay={() => onPlaybackChange?.(true)} onPause={() => onPlaybackChange?.(false)} />
}

export default function NewPage({ onLogin, isLoggedIn }: { onLogin: () => void; isLoggedIn: boolean }) {
  const { hash, key } = useLocation()
  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => {
      const id = hash.slice(1)
      document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash])
  const [menuOpen, setMenuOpen] = useState(false)
  const menuToggle = useRef<HTMLButtonElement>(null)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [inquiryProgram, setInquiryProgram] = useState<Program | undefined>()
  const [trialProgram, setTrialProgram] = useState<Program | undefined>()
  const handledTrialLocation = useRef<string | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<number | null>(null)
  const [activeTriad, setActiveTriad] = useState(0)
  const [motionPaused, setMotionPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData))
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [loadedHeroPhoto, setLoadedHeroPhoto] = useState<string>()
  const posterReady = Boolean(loadedHeroPhoto)
  const [backgroundCanPlay, setBackgroundCanPlay] = useState(false)
  const recommendationRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const handleAutoplayBlocked = useCallback(() => setMotionPaused(true), [])

  useEffect(() => {
    if (!posterReady || backgroundCanPlay) return
    // Small touch screens keep the poster until the visitor presses Play.
    if (window.matchMedia('(max-width: 620px) and (pointer: coarse)').matches) return
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
    if (selectedGoal !== null && overlay === 'finder') recommendationRef.current?.scrollIntoView({ block: 'nearest', behavior: motionPaused ? 'instant' : 'smooth' })
  }, [selectedGoal, overlay, motionPaused])

  function openInquiry(program?: Program) {
    trackEvent('inquiry_form_start', '/', { properties: { form_type: 'homepage_inquiry', program_slug: program } })
    setInquiryProgram(program)
    setOverlay('inquiry')
  }

  const openTrial = useCallback((section: string, program?: Program) => {
    trackEvent('trial_start', '/', { properties: { section, program_slug: program } })
    setTrialProgram(program)
    setOverlay('trial')
  }, [])

  useEffect(() => {
    const source = hash === `#${TRIAL_ANCHORS.navigation}` ? 'navigation'
      : hash === `#${TRIAL_ANCHORS.free_trial}` ? 'free_trial' : null
    if (!source) {
      if (handledTrialLocation.current !== null) {
        handledTrialLocation.current = null
        setOverlay(current => current === 'trial' ? null : current)
      }
      return
    }

    // A native click can set the fragment before React replaces the snapshot.
    const trialLocation = `${key}:${source}`
    if (handledTrialLocation.current === trialLocation) return
    handledTrialLocation.current = trialLocation
    document.getElementById('np-free-trial-heading')?.focus({ preventScroll: true })
    openTrial(source)
  }, [hash, key, openTrial])

  function activateTrialLink(event: MouseEvent<HTMLAnchorElement>, section: keyof typeof TRIAL_ANCHORS) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    event.preventDefault()
    openTrial(section)
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
      <SeoHead {...getHubSeoForPath('/')} schema={getHubSchema('/')} />
      <a className="np-skip" href="#main">Skip to content</a>
      <header className="np-header" onKeyDown={(event) => {
        if (event.key !== 'Escape' || !menuOpen) return
        setMenuOpen(false)
        menuToggle.current?.focus({ preventScroll: true })
      }}>
        <div className="np-container np-nav">
          <Brand />
          <nav className="np-desktop-nav" aria-label="Main navigation"><PublicNavigationLinks /></nav>
          <div className="np-nav-actions">
            <button className="np-login" data-analytics-cta="member_login" data-analytics-section="navigation" onClick={onLogin}>{isLoggedIn ? 'My portal' : 'Member login'}<ArrowUpRight size={14} /></button>
            <a className="np-button np-nav-cta" href={`#${TRIAL_ANCHORS.navigation}`} aria-haspopup="dialog"
              data-analytics-cta="free_trial" data-analytics-section="navigation" onClick={event => activateTrialLink(event, 'navigation')}>
              Try a free class <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <button ref={menuToggle} className="np-menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="np-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
          </div>
        </div>
        {menuOpen && <nav id="np-mobile-nav" className="np-mobile-nav" aria-label="Mobile navigation"><PublicNavigationLinks mobile onNavigate={() => setMenuOpen(false)} /><button data-analytics-cta="member_login" data-analytics-section="navigation" onClick={() => { setMenuOpen(false); onLogin() }}>{isLoggedIn ? 'My portal' : 'Member login'}<ArrowUpRight size={18} /></button></nav>}
      </header>

      <main id="main">
        <section className="np-hero">
          <div className="np-container np-hero-grid">
            <div className="np-hero-copy">
              <p className="np-eyebrow"><span className="np-red-dash" /> Built for more.</p>
              <h1>Gymnastics &amp; <span>youth athletic training</span> in Bowie, MD</h1>
              <p className="np-hero-description">Find a youth gymnastics class, build strength and speed in Fit &amp; Flip, or start adult gymnastics with a coach.</p>
              <div className="np-hero-buttons"><a href="#starting-classes" className="np-button" data-analytics-cta="explore_programs" data-analytics-section="hero">Explore programs <ArrowRight size={18} /></a><button className="np-text-button" onClick={() => openMedia('training_film')}><span className="np-play-outline"><Play size={13} fill="currentColor" /></span>See us in motion</button></div>
              <Link className="np-hero-location np-text-button" to="/contact">Directions to the Bowie gym <ArrowUpRight size={15} aria-hidden="true" /></Link>
            </div>
            <div className="np-hero-visual">
              <div className="np-orbit np-orbit-one" aria-hidden="true" /><div className="np-orbit np-orbit-two" aria-hidden="true" />
              <div className="np-hero-media">
                <img className="np-hero-poster" {...heroPhoto} alt="A young Vortex athlete in flight, practicing a flip on a trampoline"
                  width="900" height="675" fetchPriority="high"
                  onLoad={event => setLoadedHeroPhoto(event.currentTarget.currentSrc)}
                  onError={() => setLoadedHeroPhoto(heroPhoto.src)} />
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
          <div className="np-section-heading"><div><h2>Choose your program</h2></div><p>See what each class teaches and where to start.</p></div>
          <div className="np-program-grid">{(Object.entries(programs) as [Program, typeof programs[Program]][]).map(([id, program], index) => <article className="np-program" id={id} key={id}>
            <button className="np-program-image" onClick={() => openProgram(id, 'program_cards')} aria-label={`Explore ${program.name}`}><img {...homepagePhoto(program.image)} alt={program.alt} width="900" height="675" loading="lazy" /><span className="np-program-number">0{index + 1}</span><span className="np-image-arrow"><ArrowUpRight size={24} /></span></button>
            <div className="np-program-body"><p className="np-eyebrow">{program.eyebrow}</p><h3>{program.name}</h3><p>{program.summary}</p><p className="np-program-audience">{program.audience}</p><div className="np-tags">{program.tags.map(tag => <span key={tag}>{tag}</span>)}</div><Link className="np-program-link" to={program.page} data-analytics-cta={`explore_${id}`} data-analytics-section="program_cards">{program.linkText}<ArrowUpRight size={21} aria-hidden="true" /></Link></div>
          </article>)}</div>
          <section className="np-class-paths" id="starting-classes" aria-labelledby="np-starting-classes-heading">
            <h3 id="np-starting-classes-heading">Find a class by age and experience</h3>
            <nav className="np-class-options" aria-label="Choose a program by age">
              <ul role="list">
                {startingClasses.map(({ ages, shortName, href, analyticsKey }) => (
                  <li key={href}>
                    <Link to={href} data-analytics-cta={analyticsKey} data-analytics-section="starting_classes">
                      <small>{ages}</small>{' '}<span>{shortName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <ul className="np-class-paths-list" role="list">
              {startingClasses.map(({ ages, name, detail, href, analyticsKey, guide }) => (
                <li key={href}>
                  <h4>
                    <Link to={href} data-analytics-cta={analyticsKey} data-analytics-section="starting_classes">
                      <span><small>{ages}</small>{name}</span>
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </Link>
                  </h4>
                  <p>{detail}</p>
                  <Link className="np-text-button np-class-guide-link" to={guide.href}
                    data-analytics-cta={guide.analyticsKey} data-analytics-section="starting_classes">
                    {guide.label} <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <div className="np-path-help"><span>Compare programs based on what your athlete wants to learn.</span><button className="np-text-button" data-analytics-cta="program_finder" data-analytics-section="programs" onClick={() => setOverlay('finder')}>Find your fit <ArrowRight size={18} /></button></div>
        </section>

        <section className="np-container np-trial-section" id="free-trial" aria-labelledby="np-free-trial-heading">
          <div className="np-trial-invitation" id={TRIAL_ANCHORS.navigation}>
            <div id={TRIAL_ANCHORS.free_trial}>
              <p className="np-eyebrow">A FIRST STEP. A NEW POSSIBILITY.</p>
              <h2 id="np-free-trial-heading" tabIndex={-1}>Their next chapter.<br /><span>First class on us.</span></h2>
              <p>Experience Gymnastics or Fit & Flip with a free trial class. Choose the right age group, find a day that works, and come see what your athlete can do.</p>
              <a className="np-button" href={`#${TRIAL_ANCHORS.free_trial}`} aria-haspopup="dialog"
                data-analytics-cta="free_trial" data-analytics-section="free_trial" onClick={event => activateTrialLink(event, 'free_trial')}>
                Book a free trial <ArrowUpRight size={18} aria-hidden="true" />
              </a>
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
          <div className="np-triad-panel" id="np-triad-panel" role="tabpanel" aria-labelledby={`np-triad-tab-${activeTriad}`} tabIndex={0}><div className="np-triad-image"><img key={selectedTriad.image} {...homepagePhoto(selectedTriad.image)} alt={selectedTriad.alt} width="900" height="675" loading="lazy" /><span>{selectedTriad.number} / 03</span></div><div className="np-triad-copy" key={selectedTriad.name}><p className="np-eyebrow">THE {selectedTriad.name.toUpperCase()} ELEMENT</p><h3>{selectedTriad.line}</h3><p>{selectedTriad.text}</p><div className="np-triad-cues">{selectedTriad.cues.map(cue => <span key={cue}><Check size={15} />{cue}</span>)}</div><p className="np-triad-application">{selectedTriad.application}</p></div></div>
          <div className="np-triad-equation"><span>Strength</span><Plus size={18} /><span>Explosiveness</span><Plus size={18} /><span>Body control</span><ArrowRight size={20} /><strong>Athleticism.</strong></div>
          <div className="mt-5 flex justify-center">
            <Link className="np-text-button" to={ATHLETIC_DEVELOPMENT_GUIDE.path} data-analytics-cta="read_athletic_development_guide" data-analytics-section="triad">
              How to choose youth athletic development training <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div></section>

        <section className="np-container np-section np-approach" id="approach">
          <div className="np-approach-copy"><p className="np-eyebrow">03 / DEVELOPMENT WITH INTENTION</p><h2>More than<br /> going through<br /><span>the motions.</span></h2><p>We believe elite development is an approach to training. It starts with purposeful work, clear progressions, and a commitment to helping every athlete grow.</p><button className="np-text-button" onClick={() => openInquiry()}>Meet your next step <ArrowUpRight size={18} /></button></div>
          <div className="np-principles"><article><span>01</span><div><h3>Skills with a strong foundation.</h3><p>Gymnastics technique and physical development work together. Athletes build the strength and power to support the skills they are learning.</p></div></article><article><span>02</span><div><h3>Purpose in every progression.</h3><p>Start where the athlete is. Develop movement quality, reinforce the fundamentals, and work toward the next challenge with intention.</p></div></article><article><span>03</span><div><h3>Development for everyone.</h3><p>Team or developmental, the focus is real growth. Competition belongs to the team pathway. High-quality coaching belongs to every athlete.</p></div></article></div>
        </section>

        <section className="np-difference">
          <div className="np-container np-difference-grid">
            <div>
              <p className="np-eyebrow">THE VORTEX DIFFERENCE</p>
              <h2>Power is only<br />part of the picture.</h2>
              <p>What happens when an athlete can also rotate, balance, land, and adapt? Strength and explosiveness become more useful. That’s why body control is at the heart of our athletic development.</p>
              <Link className="np-button np-button-white" to="/fit-and-flip#athleticism-development" data-analytics-cta="explore_athleticism_development" data-analytics-section="training_approach">
                Discover Fit &amp; Flip <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <div className="np-difference-image">
              <img
                src="/calisthenics-card-1280.webp"
                srcSet="/calisthenics-card-640.webp 640w, /calisthenics-card-960.webp 960w, /calisthenics-card-1280.webp 1280w"
                sizes="auto, (max-width: 620px) calc(100vw - 44px), (max-width: 860px) calc(50vw - 45.5px), (max-width: 1150px) calc(50vw - 66px), (max-width: 1320px) calc(50vw - 106px), (min-width: 1440px) 580px, 554px"
                alt="An athlete practicing a controlled handstand at Vortex"
                width={1280}
                height={853}
                loading="lazy"
                decoding="async"
              />
              <span>CONTROL CHANGES EVERYTHING.</span>
            </div>
          </div>
        </section>

        <section className="np-container np-section np-faq" id="faq"><div><p className="np-eyebrow">A LITTLE CLARITY</p><h2>Good questions.<br /><span>Clear answers.</span></h2><p>Choosing a program should feel simple.<br />We’re here to help you find the right fit.</p><button className="np-text-button" onClick={() => openInquiry()}>Talk to our team <ArrowUpRight size={18} /></button></div><div className="np-faq-list">{faqs.map(([question, answer], index) => <details key={question}><summary data-analytics-cta={`faq_${index + 1}`} data-analytics-section="faq">{question}<Plus size={20} /></summary><p>{answer}</p></details>)}</div></section>

        <ParallaxGym paused={motionPaused} />

        <section className="np-visit" id="visit" aria-labelledby="np-visit-heading">
          <div className="np-container np-visit-inner">
            <p className="np-eyebrow">{BUSINESS_NAP.name}</p>
            <h2 id="np-visit-heading">Visit Vortex in <span>Bowie, MD</span></h2>
            <p>Find youth and adult gymnastics and Fit &amp; Flip training near Routes 50 and 3.</p>
            <div className="np-visit-details">
              <div>
                <h3>Address</h3>
                <address>
                  {BUSINESS_NAP.streetAddress}<br />
                  {BUSINESS_NAP.addressLocality}, {BUSINESS_NAP.addressRegion} {BUSINESS_NAP.postalCode}
                </address>
                <a className="np-text-button" href={GOOGLE_DIRECTIONS_URL} target="_blank" rel="noreferrer" data-analytics-cta="get_directions" data-analytics-section="visit">
                  Get directions <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
              <div>
                <h3>Facility hours</h3>
                <ul>
                  {BUSINESS_HOURS.map(({ label }) => <li key={label}>{label}</li>)}
                  <li>Sunday: Closed</li>
                </ul>
                <Link className="np-text-button" to="/read-board#schedule" data-analytics-cta="schedule" data-analytics-section="visit">
                  See the class schedule <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="np-visit-buttons">
              <button className="np-button" data-analytics-cta="program_finder" data-analytics-section="visit" onClick={() => setOverlay('finder')}>Find your program <ArrowUpRight size={18} /></button>
              <button className="np-button np-button-outline" onClick={() => openInquiry()}>Talk to our team <ArrowRight size={18} /></button>
              <Link className="np-text-button" to={INSIDE_THE_GYM_PATH} data-analytics-cta="see_inside_the_gym" data-analytics-section="visit">See inside the Bowie gym <ArrowUpRight size={16} aria-hidden="true" /></Link>
              <Link className="np-text-button" to={trainingFilm.path} data-analytics-cta="watch_training_film" data-analytics-section="visit">Watch the Vortex training film <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="np-footer np-container">
        <div className="np-footer-main">
          <div><Brand footer /><p>Gymnastics. Athletic development.<br />Built for more.</p></div>
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

      {overlay && <PublicDialog className={overlay === 'trial' ? 'np-dialog-trial' : overlay === 'video' || overlay === 'live' ? 'np-dialog-video' : ''} labelledBy={dialogLabel} view={overlay} onClose={() => setOverlay(null)}>
        {currentProgram && <><img className="np-dialog-image" {...homepagePhoto(currentProgram.image)} alt={currentProgram.alt} /><div className="np-dialog-content"><p className="np-eyebrow">{currentProgram.eyebrow}</p><h2 id="np-dialog-title">{currentProgram.name}</h2><p>{currentProgram.detail}</p><ul className="np-dialog-points">{currentProgram.points.map(point => <li key={point}><Check size={18} /><span>{point}</span></li>)}</ul>{overlay === 'gymnastics' && <div className="np-pathways"><div><strong>Developmental</strong><span>Learn. Progress. Grow.</span><p>Purposeful training without competition.</p></div><div><strong>Team</strong><span>Develop. Prepare. Compete.</span><p>The same focus on growth, with competition.</p></div></div>}<div className="np-dialog-actions"><button className="np-button" data-analytics-cta="free_trial" data-analytics-section="program" onClick={() => openTrial('program', overlay as Program)}>Try a free class <ArrowUpRight size={17} /></button><Link className="np-text-button" to={currentProgram.href} data-analytics-cta="browse_classes" data-analytics-section="program">Browse classes & enroll <ArrowUpRight size={17} /></Link><button className="np-text-button" onClick={() => openInquiry(overlay as Program)}>Ask about this program <ArrowRight size={17} /></button></div></div></>}
        {overlay === 'finder' && <div className="np-dialog-content np-finder"><p className="np-eyebrow">A GOOD PLACE TO START</p><h2 id="np-dialog-title">What’s their next goal?</h2><p>Tell us what your athlete is working toward.</p><div className="np-goal-options">{goals.map((goal, index) => <button key={goal.title} className={selectedGoal === index ? 'is-selected' : ''} aria-pressed={selectedGoal === index} onClick={() => setSelectedGoal(index)}><span><strong>{goal.title}</strong><small>{goal.subtitle}</small></span>{selectedGoal === index ? <Check size={20} /> : <ArrowUpRight size={20} />}</button>)}</div>{selectedGoal !== null && <div ref={recommendationRef} className="np-recommendation" aria-live="polite"><p className="np-eyebrow">YOUR STARTING POINT</p><h3>{programs[goals[selectedGoal].program].name}</h3><p>{goals[selectedGoal].text}</p><div className="np-dialog-actions"><button className="np-button" onClick={() => openProgram(goals[selectedGoal].program, 'finder_recommendation')}>Explore the program <ArrowRight size={17} /></button><button className="np-text-button" onClick={() => openInquiry(goals[selectedGoal].program)}>Talk to our team</button></div></div>}</div>}
        {overlay === 'trial' && <Suspense fallback={<div className="np-trial-flow"><h2 id="np-trial-title">Loading trial signup…</h2></div>}><NewPageFreeTrial initialProgram={trialProgram} onDone={() => setOverlay(null)} /></Suspense>}
        {overlay === 'inquiry' && <div className="np-dialog-content"><Suspense fallback={<h2 id="np-inquiry-title">Loading inquiry form…</h2>}><NewPageInquiry program={inquiryProgram} onDone={() => setOverlay(null)} /></Suspense></div>}
        {overlay === 'video' && <div className="np-video-dialog-content"><p className="np-eyebrow">INSIDE VORTEX</p><h2 id="np-dialog-title">See the work in motion.</h2><TrainingVideo full paused={false} poster={loadedHeroPhoto ?? heroPhoto.src} /><p>Strength. Explosiveness. Body control. Built together.</p>{liveTrainingEmbedUrl && <button className="np-button" onClick={() => openMedia('live_stream')}>Watch live <Play size={16} /></button>}</div>}
        {overlay === 'live' && liveTrainingEmbedUrl && <div className="np-video-dialog-content"><p className="np-eyebrow">INSIDE VORTEX</p><h2 id="np-dialog-title">Live from Vortex.</h2><iframe className="np-live-stream" src={liveTrainingEmbedUrl} title="Vortex live training stream" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /><button className="np-text-button" onClick={() => openMedia('training_film')}>Back to the training film <ArrowRight size={17} /></button></div>}
      </PublicDialog>}
    </div>
  )
}
