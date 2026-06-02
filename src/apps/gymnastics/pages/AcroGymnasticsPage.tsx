import DisciplineLandingPage from '../components/DisciplineLandingPage'
import { ACRO_LANDING } from '../data/disciplineLandings'

interface AcroGymnasticsPageProps {
  onSignUpClick?: () => void
}

const AcroGymnasticsPage = ({ onSignUpClick: _onSignUpClick }: AcroGymnasticsPageProps) => {
  return <DisciplineLandingPage config={ACRO_LANDING} />
}

export default AcroGymnasticsPage
