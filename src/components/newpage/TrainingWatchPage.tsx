import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import video from '../../config/publicTrainingVideo.json'
import { INSIDE_THE_GYM_PATH } from '../../config/contact'
import './TrainingWatchPage.css'

const scenes = [
  {
    time: '0:00–0:04',
    description: 'Wide views show the Bowie gym’s mats, tumbling track, and overhead training rig.',
  },
  {
    time: '0:04–0:12',
    description: 'Athletes practice a pull-up, tumbling on the track and floor, and a straddle hold on small handstand bars.',
  },
  {
    time: '0:12–0:16',
    description: 'One athlete swings a kettlebell. Another presses to a handstand on the bars.',
  },
  {
    time: '0:16–0:24',
    description: 'The film ends with a quick change of direction near a cone and athletes crossing climbing obstacles over mats.',
  },
]

export default function TrainingWatchPage() {
  return (
    <div className="np-training-watch">
      <div className="np-training-watch-shell">
        <h1>{video.name}</h1>
        <p className="np-training-watch-intro">{video.description}</p>

        <figure className="np-training-watch-player">
          <video
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
            <a href={video.assetPath}>Watch the training film as an MP4</a>
          </video>
          <figcaption id="training-film-caption">{video.durationSeconds} seconds · Silent footage</figcaption>
        </figure>

        <section className="np-training-watch-scenes" aria-labelledby="training-film-scenes">
          <h2 id="training-film-scenes">What you’ll see</h2>
          <ol role="list">
            {scenes.map(scene => (
              <li key={scene.time}>
                <span>{scene.time}</span>
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
