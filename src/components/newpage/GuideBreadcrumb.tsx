import { Link } from 'react-router-dom'
import guideIndex from '../../config/publicGuideIndex.json'

export default function GuideBreadcrumb({ guideLabel }: { guideLabel?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="athletic-guide-breadcrumb">
      <Link to="/">Home</Link>
      <span aria-hidden="true">/</span>
      {guideLabel ? (
        <>
          <Link to={guideIndex.path}>{guideIndex.label}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{guideLabel}</span>
        </>
      ) : <span aria-current="page">{guideIndex.label}</span>}
    </nav>
  )
}
