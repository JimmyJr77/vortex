import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import guideIndex from '../../config/publicGuideIndex.json'
import { PUBLIC_GUIDES } from '../../config/publicGuides'
import GuideBreadcrumb from './GuideBreadcrumb'
import './AthleticDevelopmentGuide.css'
import './TrainingGuidesIndex.css'

export default function TrainingGuidesIndex() {
  return (
    <div className="athletic-guide">
      <header className="athletic-guide-hero">
        <div className="athletic-guide-shell">
          <GuideBreadcrumb />
          <h1>{guideIndex.heading}</h1>
          <p className="athletic-guide-lead">
            Find youth sports in Bowie, see what kids practice in gymnastics, or plan your
            return to gymnastics as an adult.
          </p>
        </div>
      </header>

      <div className="athletic-guide-shell np-guides-content">
        <ul className="np-guides-grid" aria-label="Training guides">
          {PUBLIC_GUIDES.map((guide) => (
            <li key={guide.path} className="np-guides-card">
              <img src={guide.cardImage} alt={guide.imageAlt} width={640} height={400} loading="lazy" decoding="async" />
              <div className="np-guides-card-copy">
                <h2>
                  <Link to={guide.path} data-analytics-cta="open_training_guide" data-analytics-section="training_guides">
                    {guide.heading} <ArrowUpRight size={18} aria-hidden="true" />
                  </Link>
                </h2>
                <p>{guide.description}</p>
              </div>
            </li>
          ))}
        </ul>

        <nav aria-labelledby="training-guides-classes" className="np-guides-programs">
          <h2 id="training-guides-classes">Find a class in Bowie</h2>
          <ul>
            <li><Link to="/gymnastics">Youth gymnastics</Link></li>
            <li><Link to="/fit-and-flip">Fit &amp; Flip youth training</Link></li>
            <li><Link to="/adult-gymnastics">Adult gymnastics</Link></li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
