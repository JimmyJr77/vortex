import DisciplineLandingPage from '../components/DisciplineLandingPage'
import { TRAMPOLINE_LANDING } from '../data/disciplineLandings'

interface TrampolineTumblingGymnasticsPageProps {
  onSignUpClick?: () => void
}

const TrampolineTumblingGymnasticsPage = ({
  onSignUpClick: _onSignUpClick,
}: TrampolineTumblingGymnasticsPageProps) => {
  return <DisciplineLandingPage config={TRAMPOLINE_LANDING} />
}

export default TrampolineTumblingGymnasticsPage
