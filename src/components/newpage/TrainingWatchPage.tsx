import { ArrowUpRight } from 'lucide-react'
import { useEffect, useRef, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import video from '../../config/publicTrainingVideo.json'
import { INSIDE_THE_GYM_PATH } from '../../config/contact'
import './TrainingWatchPage.css'

const scenes = [
  {
    id: 'gym-view',
    start: 0,
    description: 'Wide views show the Bowie gym’s mats, tumbling track, and overhead training rig.',
  },
  {
    id: 'gymnastics-skills',
    start: 4,
    description: 'Athletes practice a pull-up, tumbling on the track and floor, and a straddle hold on small handstand bars.',
  },
  {
    id: 'strength-and-handstand',
    start: 12,
    description: 'One athlete swings a kettlebell. Another presses to a handstand on the bars.',
  },
  {
    id: 'change-of-direction',
    start: 16,
    description: 'The film ends with a quick change of direction near a cone and athletes crossing climbing obstacles over mats.',
  },
]

export default function TrainingWatchPage() {
  const playerRef = useRef<HTMLVideoElement>(null)
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash])

  function playScene(event: MouseEvent<HTMLAnchorElement>, start: number) {
    const player = playerRef.current
    if (!player || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    event.preventDefault()
    player.currentTime = start
    player.focus({ preventScroll: true })
    player.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    void player.play().catch(() => {
      // Keep the selected time and leave playback available through the native controls.
    })
  }

  return (
    <div className="np-training-watch">
      <div className="np-training-watch-shell">
        <h1>{video.name}</h1>
        <p className="np-training-watch-intro">{video.description}</p>

        <figure className="np-training-watch-player">
          <video
            ref={playerRef}
            src={video.assetPath}
            poster={video.thumbnail}
            width={720}
            height={406}
            controls
            playsInline
            preload="none"
            aria-label={video.name}
            aria-describedby="training-film-caption"
          >
            <track kind="descriptions" src="/newpage/training-film-descriptions.vtt" srcLang="en" label="English visual descriptions" />
            <a href={video.assetPath}>Watch the training film as an MP4</a>
          </video>
          <figcaption id="training-film-caption">{video.durationSeconds} seconds · Silent footage</figcaption>
        </figure>

        <section className="np-training-watch-scenes" aria-labelledby="training-film-scenes">
          <h2 id="training-film-scenes">What you’ll see</h2>
          <ol role="list">
            {scenes.map(scene => (
              <li key={scene.id} id={scene.id}>
                <a href={`${video.assetPath}#t=${scene.start}`} onClick={event => playScene(event, scene.start)}>
                  Play from 0:{String(scene.start).padStart(2, '0')}
                </a>
                <p>{scene.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <nav className="np-training-watch-next" aria-labelledby="training-film-next">
          <h2 id="training-film-next">Train at Vortex in Bowie</h2>
          <ul>
            <li><Link to="/gymnastics">Explore youth gymnastics <ArrowUpRight size={17} aria-hidden="true" /></Link></li>
            <li><Link to="/fit-and-flip">Explore Fit &amp; Flip youth training <ArrowUpRight size={17} aria-hidden="true" /></Link></li>
            <li><Link to={INSIDE_THE_GYM_PATH}>See inside the Bowie gym <ArrowUpRight size={17} aria-hidden="true" /></Link></li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
