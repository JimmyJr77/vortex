import DisciplineLandingPage from '../components/DisciplineLandingPage'
import { AEROBIC_LANDING } from '../data/disciplineLandings'

interface AerobicGymnasticsPageProps {
  onSignUpClick?: () => void
}

const AerobicGymnasticsPage = ({ onSignUpClick: _onSignUpClick }: AerobicGymnasticsPageProps) => {
  return <DisciplineLandingPage config={AEROBIC_LANDING} />
}

export default AerobicGymnasticsPage
