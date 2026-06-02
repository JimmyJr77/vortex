import DisciplineLandingPage from '../components/DisciplineLandingPage'
import { RHYTHMIC_LANDING } from '../data/disciplineLandings'

interface RhythmicGymnasticsPageProps {
  onSignUpClick?: () => void
}

const RhythmicGymnasticsPage = ({ onSignUpClick: _onSignUpClick }: RhythmicGymnasticsPageProps) => {
  return <DisciplineLandingPage config={RHYTHMIC_LANDING} />
}

export default RhythmicGymnasticsPage
