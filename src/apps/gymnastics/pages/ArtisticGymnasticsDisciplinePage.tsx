import DisciplineLandingPage from '../components/DisciplineLandingPage'
import { ARTISTIC_LANDING } from '../data/disciplineLandings'

interface ArtisticGymnasticsDisciplinePageProps {
  onSignUpClick?: () => void
}

const ArtisticGymnasticsDisciplinePage = ({
  onSignUpClick: _onSignUpClick,
}: ArtisticGymnasticsDisciplinePageProps) => {
  return <DisciplineLandingPage config={ARTISTIC_LANDING} />
}

export default ArtisticGymnasticsDisciplinePage
