import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import SchedulingPage from '../../src/components/SchedulingPage'
import MemberClassesOfferedEnroll from '../../src/components/member/MemberClassesOfferedEnroll'
import { fetchClassesOffered, type PublicProgramOffered } from '../../src/utils/publicClassesApi'
import { getApiUrl } from '../../src/utils/api'
import '../../src/index.css'

export function MemberCatalog() {
  const [programs, setPrograms] = useState<PublicProgramOffered[]>([])
  useEffect(() => { void fetchClassesOffered().then(result => setPrograms(result.programs)) }, [])
  return <MemberClassesOfferedEnroll apiUrl={getApiUrl()} memberToken="fixture-member" programs={programs}
    members={[{ id: 301, label: 'Fixture Athlete' }]} defaultMemberId={301} enrollments={[]} onEnrolled={() => {}} />
}
createRoot(document.getElementById('root')!).render(<BrowserRouter>
  {new URLSearchParams(location.search).has('member') ? <MemberCatalog /> : <SchedulingPage />}
</BrowserRouter>)
